"""
Administrator Authentication API & FastAPI Route Protection Dependency.
Provides cookie-based login, logout, session verification, and require_admin guard.
"""

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from typing import Dict, Any

from ..config import settings
from ..integrations.supabase_client import db
from ..models.admin import (
    AdminLoginRequest,
    AdminLogoutResponse,
    AdminSessionResponse,
    AdminUserInfo,
)
from ..services.admin_auth_service import AdminAuthService

router = APIRouter(prefix="/api/admin", tags=["Admin Auth"])


def _extract_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


async def require_admin(request: Request) -> Dict[str, Any]:
    """
    FastAPI dependency enforcing an active, authenticated administrator session.
    Reads the signed HttpOnly cookie and validates signature, expiry, revocation,
    and active status of the administrator account.
    """
    token = request.cookies.get(settings.ADMIN_COOKIE_NAME)
    admin = await AdminAuthService.validate_session(token)
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Administrator authentication required.",
        )
    return admin


@router.post("/login", response_model=AdminSessionResponse)
async def admin_login(
    req: AdminLoginRequest,
    request: Request,
    response: Response,
):
    """
    Authenticates an administrator using scrypt password verification,
    enforces login rate limiting, logs audit events, and sets an HttpOnly session cookie.
    """
    client_ip = _extract_client_ip(request)
    auth_result = await AdminAuthService.authenticate(
        username=req.username,
        password=req.password,
        client_ip=client_ip,
    )

    is_prod = settings.ENVIRONMENT.lower() == "production"
    response.set_cookie(
        key=settings.ADMIN_COOKIE_NAME,
        value=auth_result["token"],
        httponly=True,
        secure=is_prod,
        samesite="lax",
        max_age=auth_result["expires_in"],
        path="/",
    )

    return AdminSessionResponse(
        authenticated=True,
        admin=AdminUserInfo(**auth_result["admin"]),
        expires_in=auth_result["expires_in"],
    )


@router.post("/logout", response_model=AdminLogoutResponse)
async def admin_logout(request: Request, response: Response):
    """
    Revokes the active session token, clears the HttpOnly session cookie,
    and records the logout event without interrupting background scheduler operations.
    """
    token = request.cookies.get(settings.ADMIN_COOKIE_NAME)
    admin = await AdminAuthService.validate_session(token)
    AdminAuthService.revoke_session_token(token)

    is_prod = settings.ENVIRONMENT.lower() == "production"
    response.delete_cookie(
        key=settings.ADMIN_COOKIE_NAME,
        path="/",
        httponly=True,
        secure=is_prod,
        samesite="lax",
    )

    if admin:
        await db.add_log(
            event_type="admin_logout",
            description=f"Administrator '{admin['username']}' signed out.",
            status="info",
        )

    return AdminLogoutResponse(
        authenticated=False,
        message="Logged out successfully.",
    )


@router.get("/me", response_model=AdminSessionResponse)
async def get_current_admin(current_admin: Dict[str, Any] = Depends(require_admin)):
    """Returns the currently authenticated administrator profile."""
    return AdminSessionResponse(
        authenticated=True,
        admin=AdminUserInfo(**current_admin),
    )
