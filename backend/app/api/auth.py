"""
Google Account Authentication and OAuth 2.0 API.
Handles authorization initiation, OAuth callback handling, token storage, and disconnection.
"""

from fastapi import APIRouter, Depends, Query, Request, HTTPException, status
from fastapi.responses import RedirectResponse
from typing import Dict, Any, Optional
from urllib.parse import urlencode
from ..config import settings
from ..integrations.google_business import google_client
from ..integrations.supabase_client import db
from ..services.admin_auth_service import AdminAuthService
from .admin_auth import require_admin

router = APIRouter(prefix="/api/auth/google", tags=["Google Auth"])


def _frontend_redirect_base() -> str:
    return (settings.FRONTEND_URL or "http://localhost:5174").strip().rstrip("/")


@router.get("/status", dependencies=[Depends(require_admin)])
async def get_google_status() -> Dict[str, Any]:
    """Returns safe Google Business Profile integration readiness and status."""
    return google_client.get_connection_info()

@router.get("/login")
async def initiate_google_login(current_admin: Dict[str, Any] = Depends(require_admin)):
    """
    Generates the Google OAuth 2.0 authorization URL with a signed single-use
    CSRF state token and returns it for browser redirection.
    """
    oauth_state = await AdminAuthService.issue_oauth_state_async(admin_id=current_admin.get("id"))
    auth_url = google_client.generate_auth_url(state=oauth_state)
    return {
        "auth_url": auth_url,
        "state": oauth_state,
        "redirect_mode": "browser",
        "scope": "https://www.googleapis.com/auth/business.manage"
    }

@router.get("/callback")
async def google_oauth_callback(
    code: Optional[str] = Query(None, max_length=2048, description="Google OAuth authorization code"),
    error: Optional[str] = Query(None, max_length=256, description="Google OAuth error response"),
    state: Optional[str] = Query(None, max_length=512, description="Signed OAuth CSRF state parameter")
):
    """
    OAuth 2.0 callback endpoint.
    Accessible directly from Google's browser redirect and protected by signed single-use state validation.
    Exchanges code for tokens, runs automatic account and location detection,
    securely stores discovered resource IDs in business_config,
    records the event in system_logs, and redirects back to the frontend.
    Never exposes OAuth tokens or secrets to the frontend.
    Does NOT publish replies to real reviews during this authentication flow.
    """
    frontend_base = _frontend_redirect_base()

    if not await AdminAuthService.verify_oauth_state_async(state):
        await db.add_log(
            event_type="oauth_state_invalid",
            description="Rejected Google OAuth callback due to missing, invalid, or expired CSRF state token.",
            status="warning"
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OAuth state parameter."
        )
    if error:
        await db.add_log(
            event_type="oauth_failed",
            description=f"Google OAuth authorization rejected or failed ({error[:100]}).",
            status="error"
        )
        params = urlencode({"google_auth": "error", "message": "Google OAuth authorization was declined or failed."})
        return RedirectResponse(url=f"{frontend_base}/?{params}", status_code=status.HTTP_302_FOUND)

    if not code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing 'code' query parameter in OAuth callback."
        )

    try:
        # Step 1: Exchange authorization code for tokens (retained securely in backend memory/encrypted storage only)
        token_data = await google_client.exchange_code_for_tokens(code)
        access_token = token_data.get("access_token")

        # Step 2: Auto-detect Google Business Profile account and location
        discovery = await google_client.discover_account_and_location(access_token)
        discovery_status = discovery.get("status")

        if discovery_status == "success":
            account_id = discovery.get("account_id")
            location_id = discovery.get("location_id")
            account_name = discovery.get("account_name", "Techzone Academy")
            location_title = discovery.get("location_title", location_id)

            # Persist discovered IDs into Supabase PostgreSQL business_config
            await db.update_business_config(
                google_account_id=account_id,
                google_location_id=location_id
            )

            await db.add_log(
                event_type="google_connected",
                description=f"Authorized Google Business Profile! Auto-detected account '{account_name}' ({account_id}) and location '{location_title}' ({location_id}).",
                status="success"
            )

            params = urlencode({
                "google_auth": "success",
                "account": account_id or "",
                "location": location_id or ""
            })
            return RedirectResponse(url=f"{frontend_base}/?{params}", status_code=status.HTTP_302_FOUND)

        elif discovery_status == "ambiguous_account":
            error_msg = discovery.get("error", "Multiple Google Business accounts detected without unique Techzone match.")
            await db.add_log(
                event_type="google_auth_warning",
                description=f"OAuth authorized, but {error_msg}",
                status="warning"
            )
            params = urlencode({
                "google_auth": "ambiguous_account",
                "message": error_msg
            })
            return RedirectResponse(url=f"{frontend_base}/?{params}", status_code=status.HTTP_302_FOUND)

        elif discovery_status == "ambiguous_location":
            account_id = discovery.get("account_id")
            if account_id:
                await db.update_business_config(google_account_id=account_id)
            error_msg = discovery.get("error", "Multiple locations detected under account without unique Techzone match.")
            await db.add_log(
                event_type="google_auth_warning",
                description=f"OAuth authorized for account {account_id}, but {error_msg}",
                status="warning"
            )
            params = urlencode({
                "google_auth": "ambiguous_location",
                "account": account_id or "",
                "message": error_msg
            })
            return RedirectResponse(url=f"{frontend_base}/?{params}", status_code=status.HTTP_302_FOUND)

        elif discovery_status in ("no_accounts", "no_locations"):
            error_msg = discovery.get("error", "No Google Business Profile account or location found.")
            await db.add_log(
                event_type="google_auth_warning",
                description=f"OAuth authorized, but {error_msg}",
                status="warning"
            )
            params = urlencode({
                "google_auth": discovery_status,
                "message": error_msg
            })
            return RedirectResponse(url=f"{frontend_base}/?{params}", status_code=status.HTTP_302_FOUND)

        else:
            await db.add_log(
                event_type="discovery_error",
                description=str(discovery.get("error", "Failed to auto-detect Google Business Profile account and location."))[:300],
                status="error"
            )
            params = urlencode({
                "google_auth": "discovery_error",
                "message": "Failed to auto-detect Google Business Profile account and location."
            })
            return RedirectResponse(url=f"{frontend_base}/?{params}", status_code=status.HTTP_302_FOUND)

    except Exception as e:
        await db.add_log(
            event_type="oauth_error",
            description=f"Error exchanging Google OAuth code ({type(e).__name__}).",
            status="error"
        )
        params = urlencode({
            "google_auth": "error",
            "message": "Google OAuth token exchange failed. Please try again."
        })
        return RedirectResponse(url=f"{frontend_base}/?{params}", status_code=status.HTTP_302_FOUND)

@router.post("/disconnect", dependencies=[Depends(require_admin)])
async def disconnect_google() -> Dict[str, Any]:
    """Disconnects the Google account, clears stored tokens, and unsets detected IDs in database."""
    google_client.disconnect()
    await db.update_business_config(google_account_id="", google_location_id="")
    await db.add_log(
        event_type="google_disconnected",
        description="Administrator disconnected Techzone Academy's Google Business Profile.",
        status="warning"
    )
    return {
        "status": "disconnected",
        "message": "Google Business Profile successfully disconnected."
    }
