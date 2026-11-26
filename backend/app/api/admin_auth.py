"""
Administrator Authentication API & FastAPI Route Protection Dependency.
Provides cookie-based login, logout, session verification, CSRF protection,
Origin/Referer verification, and trusted-proxy client IP extraction.
"""

import ipaddress
from urllib.parse import urlparse
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from typing import Dict, Any, Optional

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
_UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def _is_trusted_proxy(ip_str: Optional[str]) -> bool:
    if not ip_str:
        return False
    try:
        addr = ipaddress.ip_address(ip_str.strip())
    except ValueError:
        return False

    for entry in settings.TRUSTED_PROXY_IPS:
        candidate = (entry or "").strip()
        if not candidate:
            continue
        try:
            if "/" in candidate:
                if addr in ipaddress.ip_network(candidate, strict=False):
                    return True
            elif addr == ipaddress.ip_address(candidate):
                return True
        except ValueError:
            continue
    return False


def _extract_client_ip(request: Request) -> str:
    """
    Extracts client IP safely: trusts X-Forwarded-For ONLY when the direct peer
    IP is in TRUSTED_PROXY_IPS, parsing right-to-left past trusted proxy hops.
    """
    peer_ip = request.client.host if (request.client and request.client.host) else None
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded and _is_trusted_proxy(peer_ip):
        hops = [h.strip() for h in forwarded.split(",") if h.strip()]
        for hop in reversed(hops):
            try:
                ipaddress.ip_address(hop)
            except ValueError:
                continue
            if not _is_trusted_proxy(hop):
                return hop
        if hops:
            return hops[0]
    return peer_ip or "unknown"


def _extract_request_origin(request: Request) -> Optional[str]:
    origin = request.headers.get("origin")
    if origin:
        return origin.strip().rstrip("/")
    referer = request.headers.get("referer")
    if referer:
        parsed = urlparse(referer.strip())
        if parsed.scheme and parsed.netloc:
            return f"{parsed.scheme}://{parsed.netloc}"
    return None


def _is_allowed_origin(origin: str, request: Request) -> bool:
    normalized = origin.rstrip("/")
    allowed = {(o or "").strip().rstrip("/") for o in settings.CORS_ORIGINS if o}
    frontend = (settings.FRONTEND_URL or "").strip().rstrip("/")
    if frontend:
        allowed.add(frontend)
    if normalized in allowed:
        return True
    # Also allow same-origin host match when deployed directly behind TLS proxy
    host = request.headers.get("host")
    if host:
        scheme = request.url.scheme or "https"
        if normalized == f"{scheme}://{host}":
            return True
    return False


def validate_origin_if_present(request: Request) -> None:
    if request.method.upper() not in _UNSAFE_METHODS:
        return
    req_origin = _extract_request_origin(request)
    if req_origin and not _is_allowed_origin(req_origin, request):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cross-origin request rejected.",
        )


async def require_admin(request: Request) -> Dict[str, Any]:
    """
    FastAPI dependency enforcing an active, authenticated administrator session.
    Reads the signed HttpOnly cookie, checks signature/expiry/revocation/active status,
    and validates Origin/Referer + session-bound X-CSRF-Token on state-changing requests.
    """
    token = request.cookies.get(settings.ADMIN_COOKIE_NAME)
    resolved = await AdminAuthService.validate_session_with_payload(token)
    if not resolved:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Administrator authentication required.",
        )

    admin, payload = resolved
    if request.method.upper() in _UNSAFE_METHODS:
        validate_origin_if_present(request)
        provided_csrf = request.headers.get("x-csrf-token")
        if not AdminAuthService.verify_csrf_token(payload, provided_csrf):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Missing or invalid CSRF token.",
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
    enforces trusted-proxy login rate limiting, validates Origin if present,
    logs audit events, and sets an HttpOnly session cookie.
    """
    validate_origin_if_present(request)
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
        csrf_token=auth_result.get("csrf_token"),
    )


@router.post("/logout", response_model=AdminLogoutResponse)
async def admin_logout(request: Request, response: Response):
    """
    Validates Origin/CSRF for active sessions, revokes the session token cleanly,
    clears the HttpOnly session cookie, and records the logout event.
    """
    validate_origin_if_present(request)
    token = request.cookies.get(settings.ADMIN_COOKIE_NAME)
    resolved = await AdminAuthService.validate_session_with_payload(token)

    if resolved:
        admin, payload = resolved
        provided_csrf = request.headers.get("x-csrf-token")
        if not AdminAuthService.verify_csrf_token(payload, provided_csrf):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Missing or invalid CSRF token.",
            )
    else:
        admin = None

    await AdminAuthService.revoke_session_token_persistent(token)

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
async def get_current_admin(
    request: Request,
    current_admin: Dict[str, Any] = Depends(require_admin),
):
    """Returns the currently authenticated administrator profile and session CSRF token."""
    token = request.cookies.get(settings.ADMIN_COOKIE_NAME)
    csrf_token = AdminAuthService.derive_csrf_token(token or "")
    return AdminSessionResponse(
        authenticated=True,
        admin=AdminUserInfo(**current_admin),
        csrf_token=csrf_token,
    )
