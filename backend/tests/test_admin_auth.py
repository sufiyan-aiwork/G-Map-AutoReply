"""
Comprehensive Unit & Integration Tests for Administrator Authentication System:
- scrypt password hashing & hmac.compare_digest verification
- Valid login, HttpOnly / SameSite=Lax / Secure-in-prod 8h cookie
- Invalid password, unknown user, and sliding-window rate limiting
- Inactive admin rejection (at login and mid-session)
- Expired and tampered token rejection
- Logout cookie clearing & server-side jti revocation
- Complete 401 protection audit across all protected endpoints vs public /health
- Google OAuth callback reachability without admin session + single-use state validation
- Scheduler independence from admin browser login/logout
"""

import asyncio
from unittest.mock import AsyncMock, patch
import pytest
from httpx import AsyncClient, ASGITransport

from app.config import settings
from app.integrations.google_business import google_client
from app.integrations.supabase_client import db
from app.main import app
from app.services.admin_auth_service import AdminAuthService
from app.services.scheduler_service import SchedulerService


async def _seed_test_admin(
    username: str = "test_admin_user",
    password: str = "StrongPass!2026",
    is_active: bool = True,
):
    pw_hash = AdminAuthService.hash_password(password)
    return await db.create_admin_user(
        username=username,
        password_hash=pw_hash,
        full_name="Test Administrator",
        is_active=is_active,
    )


@pytest.fixture(autouse=True)
def reset_auth_state():
    AdminAuthService.reset_rate_limits()
    AdminAuthService._revoked_jtis.clear()
    AdminAuthService._pending_oauth_states.clear()
    orig_admins = list(db._admin_users)
    orig_test_mode = db._isolated_test_mode
    db._isolated_test_mode = True
    yield
    db._admin_users = orig_admins
    db._isolated_test_mode = orig_test_mode
    AdminAuthService.reset_rate_limits()


# ====================================================================
# 1. Password Hashing & Verification Tests
# ====================================================================
def test_scrypt_password_hashing_and_constant_time_verification():
    pw = "TechzoneSecure#2026"
    h1 = AdminAuthService.hash_password(pw)
    h2 = AdminAuthService.hash_password(pw)

    assert h1.startswith("scrypt$16384$8$1$")
    assert h1 != h2  # Unique 16-byte random salt per hash
    assert pw not in h1

    assert AdminAuthService.verify_password(pw, h1) is True
    assert AdminAuthService.verify_password("WrongPass!", h1) is False
    assert AdminAuthService.verify_password("", h1) is False
    assert AdminAuthService.verify_password(pw, "invalid_hash_format") is False


# ====================================================================
# 2. Login, Cookie Security Flags, & Audit Logging
# ====================================================================
@pytest.mark.asyncio
async def test_valid_login_sets_httponly_cookie_and_audits():
    admin = await _seed_test_admin("test_valid_admin", "ValidPass!123")

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post(
            "/api/admin/login",
            json={"username": "test_valid_admin", "password": "ValidPass!123"},
        )

    assert res.status_code == 200
    body = res.json()
    assert body["authenticated"] is True
    assert body["admin"]["username"] == "test_valid_admin"
    assert body["expires_in"] == 8 * 3600
    assert "password_hash" not in body["admin"]
    assert "token" not in body

    set_cookie = res.headers.get("set-cookie", "")
    assert f"{settings.ADMIN_COOKIE_NAME}=" in set_cookie
    assert "HttpOnly" in set_cookie or "httponly" in set_cookie.lower()
    assert "SameSite=lax" in set_cookie or "samesite=lax" in set_cookie.lower()
    assert "Max-Age=28800" in set_cookie or "max-age=28800" in set_cookie.lower()

    # Verify audit log does NOT contain password, hash, or token
    recent_log = db._logs[0]
    assert recent_log["event_type"] == "admin_login_success"
    assert "ValidPass!123" not in recent_log["description"]
    assert admin["password_hash"] not in recent_log["description"]


@pytest.mark.asyncio
async def test_cookie_secure_flag_enabled_in_production():
    await _seed_test_admin("test_prod_admin", "ProdPass!123")
    orig_env = settings.ENVIRONMENT
    try:
        settings.ENVIRONMENT = "production"
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.post(
                "/api/admin/login",
                json={"username": "test_prod_admin", "password": "ProdPass!123"},
            )
        assert res.status_code == 200
        set_cookie = res.headers.get("set-cookie", "").lower()
        assert "secure" in set_cookie
        assert "httponly" in set_cookie
    finally:
        settings.ENVIRONMENT = orig_env


# ====================================================================
# 3. Invalid Credentials, Inactive Admin, & Rate Limiting
# ====================================================================
@pytest.mark.asyncio
async def test_invalid_password_rejected_and_logged():
    await _seed_test_admin("test_wrongpw_admin", "CorrectPass!123")

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post(
            "/api/admin/login",
            json={"username": "test_wrongpw_admin", "password": "WrongPassword"},
        )

    assert res.status_code == 401
    assert settings.ADMIN_COOKIE_NAME not in res.cookies
    assert db._logs[0]["event_type"] == "admin_login_failed"
    assert "WrongPassword" not in db._logs[0]["description"]
    assert "CorrectPass!123" not in db._logs[0]["description"]


@pytest.mark.asyncio
async def test_inactive_admin_rejected_at_login_and_mid_session():
    # Case A: Inactive admin cannot log in
    await _seed_test_admin("test_inactive_admin", "InactivePass!123", is_active=False)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post(
            "/api/admin/login",
            json={"username": "test_inactive_admin", "password": "InactivePass!123"},
        )
    assert res.status_code == 403

    # Case B: Active admin deactivated mid-session is immediately locked out
    active_admin = await _seed_test_admin("test_deactivated_admin", "ActivePass!123", is_active=True)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        login_res = await ac.post(
            "/api/admin/login",
            json={"username": "test_deactivated_admin", "password": "ActivePass!123"},
        )
        assert login_res.status_code == 200
        me_ok = await ac.get("/api/admin/me")
        assert me_ok.status_code == 200

        # Deactivate admin account in DB
        active_admin["is_active"] = False
        me_blocked = await ac.get("/api/admin/me")
        assert me_blocked.status_code == 401


@pytest.mark.asyncio
async def test_login_rate_limiting():
    await _seed_test_admin("test_ratelimit_admin", "RealPass!123")

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        for _ in range(settings.ADMIN_LOGIN_MAX_ATTEMPTS):
            res = await ac.post(
                "/api/admin/login",
                json={"username": "test_ratelimit_admin", "password": "BadPassword"},
            )
            assert res.status_code == 401

        blocked = await ac.post(
            "/api/admin/login",
            json={"username": "test_ratelimit_admin", "password": "RealPass!123"},
        )
        assert blocked.status_code == 429
        assert "too many failed login attempts" in blocked.json()["detail"].lower()


# ====================================================================
# 4. Session Expiration & Logout Revocation Tests
# ====================================================================
@pytest.mark.asyncio
async def test_session_expiration_and_tampered_tokens_rejected():
    admin = await _seed_test_admin("test_exp_admin", "ExpPass!123")
    expired_token, _ = AdminAuthService.create_session_token(admin, expires_minutes=-5)
    valid_token, _ = AdminAuthService.create_session_token(admin, expires_minutes=60)
    tampered_token = valid_token[:-3] + "xyz"

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        ac.cookies.set(settings.ADMIN_COOKIE_NAME, expired_token)
        res_exp = await ac.get("/api/admin/me")
        assert res_exp.status_code == 401

        ac.cookies.set(settings.ADMIN_COOKIE_NAME, tampered_token)
        res_tamper = await ac.get("/api/dashboard/summary")
        assert res_tamper.status_code == 401


@pytest.mark.asyncio
async def test_logout_clears_cookie_and_revokes_token():
    await _seed_test_admin("test_logout_admin", "LogoutPass!123")

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        login_res = await ac.post(
            "/api/admin/login",
            json={"username": "test_logout_admin", "password": "LogoutPass!123"},
        )
        assert login_res.status_code == 200
        saved_cookie = ac.cookies.get(settings.ADMIN_COOKIE_NAME)
        assert saved_cookie

        logout_res = await ac.post("/api/admin/logout")
        assert logout_res.status_code == 200
        assert logout_res.json()["authenticated"] is False

        # Cookie cleared from client; /me fails
        assert (await ac.get("/api/admin/me")).status_code == 401

        # Replaying previously captured cookie is rejected via jti revocation
        ac.cookies.set(settings.ADMIN_COOKIE_NAME, saved_cookie)
        assert (await ac.get("/api/admin/me")).status_code == 401
        assert (await ac.get("/api/reviews")).status_code == 401


# ====================================================================
# 5. API Endpoint Protection Audit
# ====================================================================
@pytest.mark.asyncio
async def test_unauthorized_api_access_blocked_and_health_public():
    protected_gets = [
        "/api/admin/me",
        "/api/dashboard/summary",
        "/api/reviews",
        "/api/reviews/some-id",
        "/api/reviews/some-id/preview-reply",
        "/api/replies/templates",
        "/api/database/status",
        "/api/automation/status",
        "/api/logs",
        "/api/auth/google/status",
        "/api/auth/google/login",
    ]
    protected_posts = [
        "/api/reviews/some-id/publish-reply",
        "/api/reviews/test-simulate",
        "/api/reviews/sync-now",
        "/api/automation/pause",
        "/api/automation/resume",
        "/api/auth/google/disconnect",
    ]
    protected_puts = [
        "/api/replies/templates/positive",
        "/api/automation/settings",
    ]

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Public /health works
        health_res = await ac.get("/health")
        assert health_res.status_code == 200

        for path in protected_gets:
            assert (await ac.get(path)).status_code == 401, f"Expected 401 for GET {path}"
        for path in protected_posts:
            assert (await ac.post(path)).status_code == 401, f"Expected 401 for POST {path}"
        for path in protected_puts:
            assert (await ac.put(path, json={})).status_code == 401, f"Expected 401 for PUT {path}"


@pytest.mark.asyncio
async def test_protected_endpoints_accessible_when_authenticated():
    await _seed_test_admin("test_auth_access", "AccessPass!123")

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        login_res = await ac.post(
            "/api/admin/login",
            json={"username": "test_auth_access", "password": "AccessPass!123"},
        )
        assert login_res.status_code == 200

        for path in [
            "/api/admin/me",
            "/api/dashboard/summary",
            "/api/reviews",
            "/api/replies/templates",
            "/api/automation/status",
            "/api/logs",
            "/api/auth/google/status",
        ]:
            res = await ac.get(path)
            assert res.status_code == 200, f"Expected 200 for authenticated GET {path}"


# ====================================================================
# 6. Google OAuth Callback Compatibility & CSRF State Protection
# ====================================================================
@pytest.mark.asyncio
async def test_google_oauth_callback_compatibility_and_state_validation():
    await _seed_test_admin("test_oauth_admin", "OAuthPass!123")

    mock_discovery = {
        "status": "success",
        "account_id": "accounts/auto_detected_test",
        "account_name": "Techzone Academy",
        "location_id": "locations/auto_detected_test",
        "location_title": "Techzone Academy - Main",
    }

    # Step 1: Authenticated admin initiates Google OAuth login and gets signed state
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as admin_ac:
        await admin_ac.post(
            "/api/admin/login",
            json={"username": "test_oauth_admin", "password": "OAuthPass!123"},
        )
        init_res = await admin_ac.get("/api/auth/google/login")
        assert init_res.status_code == 200
        oauth_state = init_res.json()["state"]

    # Step 2: Google redirects browser to /api/auth/google/callback WITHOUT admin cookies
    with patch.object(google_client, "exchange_code_for_tokens", new_callable=AsyncMock) as mock_exch, \
         patch.object(google_client, "discover_account_and_location", new_callable=AsyncMock) as mock_disc:
        mock_exch.return_value = {"access_token": "tok_abc", "refresh_token": "ref_xyz"}
        mock_disc.return_value = mock_discovery

        orig_cfg = dict(db._business_config)
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as unauthed_ac:
                # Missing state rejected
                no_state = await unauthed_ac.get("/api/auth/google/callback?code=abc", follow_redirects=False)
                assert no_state.status_code == 400
                mock_exch.assert_not_called()

                # Invalid/tampered state rejected
                bad_state = await unauthed_ac.get(
                    "/api/auth/google/callback?code=abc&state=forged_state",
                    follow_redirects=False,
                )
                assert bad_state.status_code == 400
                mock_exch.assert_not_called()

                # Valid signed state accepted even without admin cookie
                ok_res = await unauthed_ac.get(
                    f"/api/auth/google/callback?code=valid_code&state={oauth_state}",
                    follow_redirects=False,
                )
                assert ok_res.status_code == 302
                assert "google_auth=success" in ok_res.headers["location"]
                mock_exch.assert_called_once()

                # Replaying same single-use state rejected
                replay_res = await unauthed_ac.get(
                    f"/api/auth/google/callback?code=valid_code&state={oauth_state}",
                    follow_redirects=False,
                )
                assert replay_res.status_code == 400
        finally:
            db._business_config = orig_cfg


# ====================================================================
# 7. Scheduler Independence From Admin Browser Sessions
# ====================================================================
@pytest.mark.asyncio
async def test_scheduler_independent_of_admin_login_and_logout():
    await _seed_test_admin("test_sched_admin", "SchedPass!123")

    with patch("app.services.review_service.ReviewService.sync_google_reviews", new_callable=AsyncMock) as mock_sync, \
         patch("app.services.scheduler_service.db.get_business_config", new_callable=AsyncMock) as mock_cfg:
        mock_cfg.return_value = {"auto_reply_enabled": False, "polling_interval": 15}
        mock_sync.return_value = {"total_fetched": 0, "new_ingested": 0, "replies_published": 0}

        try:
            await SchedulerService.start_background_loop()
            await asyncio.sleep(0.05)
            assert SchedulerService._is_running is True
            assert mock_sync.called

            # Admin logs in then logs out -> scheduler must stay running untouched
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
                await ac.post(
                    "/api/admin/login",
                    json={"username": "test_sched_admin", "password": "SchedPass!123"},
                )
                logout_res = await ac.post("/api/admin/logout")
                assert logout_res.status_code == 200

            assert SchedulerService._is_running is True
            assert SchedulerService._scheduler_task is not None
            assert not SchedulerService._scheduler_task.done()
        finally:
            await SchedulerService.stop_background_loop()
