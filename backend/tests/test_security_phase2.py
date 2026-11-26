"""
Comprehensive Phase 2 Security Remediation Verification Tests:
1. Google OAuth token AES-256-GCM encryption, plaintext migration, tamper rejection, rotated refresh tokens & atomic writes.
2. Trusted-proxy X-Forwarded-For spoofing defense, per-IP & per-username rate limiting, and bounded memory cap.
3. CSRF X-CSRF-Token & Origin/Referer enforcement across state-changing endpoints + login/logout compatibility.
4. Publishing safety: verification_pending 409/block, live Google existing owner reply preservation, per-review lock,
   UUID/google_review_id reconciliation, and simulator isolation (zero live Google PUTs).
5. API hardening: validation limits, PostgREST query encoding, security headers, 413 payload size limit,
   safe error responses, and production ADMIN_AUTH_SECRET validation.
"""

import asyncio
import base64
import json
import secrets
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import httpx
import pytest
from httpx import ASGITransport, AsyncClient

from app.api.admin_auth import _extract_client_ip
from app.config import settings
from app.integrations.google_business import GoogleBusinessProfileClient
from app.integrations.supabase_client import db
from app.main import app
from app.services.admin_auth_service import AdminAuthService
from app.services.publishing_service import PublishingService
from app.services.review_service import ReviewService


@pytest.fixture(autouse=True)
def isolate_phase2_state():
    AdminAuthService.reset_rate_limits()
    AdminAuthService._revoked_jtis.clear()
    AdminAuthService._pending_oauth_states.clear()
    orig_iso = db._isolated_test_mode
    orig_admins = list(db._admin_users)
    orig_reviews = [dict(r) for r in db._reviews]
    orig_pubs = [dict(p) for p in db._published_replies]
    orig_cfg = dict(db._business_config)
    orig_revoked = dict(db._revoked_tokens)
    orig_states = dict(db._oauth_states)
    db._isolated_test_mode = True
    yield
    db._isolated_test_mode = orig_iso
    db._admin_users = orig_admins
    db._reviews = orig_reviews
    db._published_replies = orig_pubs
    db._business_config = orig_cfg
    db._revoked_tokens = orig_revoked
    db._oauth_states = orig_states
    AdminAuthService.reset_rate_limits()


async def _authed_client():
    admin = await db.create_admin_user(
        "test_sec2_admin",
        AdminAuthService.hash_password("Sec2StrongPass!2026"),
        is_active=True,
    )
    token, _ = AdminAuthService.create_session_token(admin)
    csrf = AdminAuthService.derive_csrf_token(token)
    return AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        cookies={settings.ADMIN_COOKIE_NAME: token},
        headers={"X-CSRF-Token": csrf},
    )


# ====================================================================
# 1. Google OAuth Token AES-256-GCM Encryption & Migration
# ====================================================================
def test_google_token_aes256_gcm_roundtrip_tamper_and_migration(tmp_path, monkeypatch):
    key = base64.urlsafe_b64encode(secrets.token_bytes(32)).decode("ascii")
    monkeypatch.setattr(settings, "GOOGLE_TOKEN_ENCRYPTION_KEY", key)
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "test-client.apps.googleusercontent.com")
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_SECRET", "test-secret")

    token_path = tmp_path / ".google_tokens.json"

    # Write legacy plaintext token file
    legacy_payload = {
        "access_token": "ya29.legacy_access_val",
        "refresh_token": "1//0g_legacy_refresh_val",
        "account_id": "accounts/acc_legacy",
        "location_id": "locations/loc_legacy",
        "updated_at": "2026-11-26T00:00:00Z",
    }
    token_path.write_text(json.dumps(legacy_payload), encoding="utf-8")

    client = GoogleBusinessProfileClient(token_file=str(token_path))
    assert client.access_token == "ya29.legacy_access_val"
    assert client.refresh_token == "1//0g_legacy_refresh_val"

    # Encrypt and persist atomically
    client._save_tokens_to_file(force_write=True)
    disk_obj = json.loads(token_path.read_text(encoding="utf-8"))
    assert disk_obj["encrypted"] is True
    assert disk_obj["alg"] == "AES-256-GCM"
    assert "ya29.legacy_access_val" not in token_path.read_text(encoding="utf-8")
    assert "1//0g_legacy_refresh_val" not in token_path.read_text(encoding="utf-8")

    # Reload into a new client using the same key
    reloaded = GoogleBusinessProfileClient(token_file=str(token_path))
    assert reloaded.access_token == "ya29.legacy_access_val"
    assert reloaded.refresh_token == "1//0g_legacy_refresh_val"
    assert reloaded.account_id == "accounts/acc_legacy"
    assert reloaded.location_id == "locations/loc_legacy"

    # Wrong key fails decryption cleanly without loading secrets
    wrong_key = base64.urlsafe_b64encode(secrets.token_bytes(32)).decode("ascii")
    monkeypatch.setattr(settings, "GOOGLE_TOKEN_ENCRYPTION_KEY", wrong_key)
    bad_client = GoogleBusinessProfileClient(token_file=str(token_path))
    assert bad_client.access_token is None
    assert bad_client.refresh_token is None

    # Tampered ciphertext rejected cleanly
    monkeypatch.setattr(settings, "GOOGLE_TOKEN_ENCRYPTION_KEY", key)
    tampered = dict(disk_obj)
    tampered["ciphertext"] = "AAAA" + tampered["ciphertext"][4:]
    token_path.write_text(json.dumps(tampered), encoding="utf-8")
    tampered_client = GoogleBusinessProfileClient(token_file=str(token_path))
    assert tampered_client.access_token is None
    assert tampered_client.refresh_token is None


@pytest.mark.asyncio
async def test_rotated_refresh_token_is_persisted(tmp_path, monkeypatch):
    key = base64.urlsafe_b64encode(secrets.token_bytes(32)).decode("ascii")
    monkeypatch.setattr(settings, "GOOGLE_TOKEN_ENCRYPTION_KEY", key)
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "test-client.apps.googleusercontent.com")
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_SECRET", "test-secret")

    token_path = tmp_path / ".google_tokens.json"
    client = GoogleBusinessProfileClient(token_file=str(token_path))
    client.access_token = "old_access"
    client.refresh_token = "1//0g_old_refresh"

    async def mock_post(self, url, *args, **kwargs):
        return httpx.Response(
            200,
            json={"access_token": "ya29.new_access", "refresh_token": "1//0g_rotated_refresh", "expires_in": 3600},
            request=httpx.Request("POST", str(url)),
        )

    with patch.object(httpx.AsyncClient, "post", mock_post):
        fresh = await client.refresh_access_token()

    assert fresh == "ya29.new_access"
    assert client.refresh_token == "1//0g_rotated_refresh"

    reloaded = GoogleBusinessProfileClient(token_file=str(token_path))
    assert reloaded.access_token == "ya29.new_access"
    assert reloaded.refresh_token == "1//0g_rotated_refresh"


# ====================================================================
# 2. X-Forwarded-For Spoofing Protection & Bounded Rate Limiting
# ====================================================================
def test_extract_client_ip_ignores_untrusted_x_forwarded_for(monkeypatch):
    monkeypatch.setattr(settings, "TRUSTED_PROXY_IPS", ["127.0.0.1", "10.0.0.0/8"])

    untrusted_req = SimpleNamespace(
        client=SimpleNamespace(host="203.0.113.55"),
        headers={"x-forwarded-for": "1.2.3.4, 5.6.7.8"},
    )
    assert _extract_client_ip(untrusted_req) == "203.0.113.55"

    trusted_req = SimpleNamespace(
        client=SimpleNamespace(host="127.0.0.1"),
        headers={"x-forwarded-for": "198.51.100.77, 10.1.2.3"},
    )
    assert _extract_client_ip(trusted_req) == "198.51.100.77"


@pytest.mark.asyncio
async def test_login_rate_limit_cannot_be_bypassed_by_spoofed_header():
    await db.create_admin_user("test_xff_admin", AdminAuthService.hash_password("RealPass!2026"), is_active=True)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Even rotating fake X-Forwarded-For on every request hits the IP + global username limit
        for i in range(settings.ADMIN_LOGIN_MAX_ATTEMPTS):
            res = await ac.post(
                "/api/admin/login",
                headers={"X-Forwarded-For": f"198.51.100.{i + 10}"},
                json={"username": "test_xff_admin", "password": "WrongPassword"},
            )
            assert res.status_code == 401

        blocked = await ac.post(
            "/api/admin/login",
            headers={"X-Forwarded-For": "198.51.100.250"},
            json={"username": "test_xff_admin", "password": "RealPass!2026"},
        )
        assert blocked.status_code == 429


def test_rate_limit_memory_cap_prevents_unbounded_growth():
    orig_cap = AdminAuthService._MAX_RATE_LIMIT_KEYS
    try:
        AdminAuthService._MAX_RATE_LIMIT_KEYS = 25
        for idx in range(60):
            AdminAuthService._record_failed_attempt(f"192.0.2.{idx}", f"user_{idx}")
        assert len(AdminAuthService._failed_attempts) <= 25
    finally:
        AdminAuthService._MAX_RATE_LIMIT_KEYS = orig_cap


# ====================================================================
# 3. Session Security & CSRF / Origin Protection
# ====================================================================
def test_production_rejects_missing_or_weak_admin_auth_secret(monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "ADMIN_AUTH_SECRET", "replace-with-strong-random-secret-at-least-32-chars")
    with pytest.raises(RuntimeError):
        AdminAuthService.validate_runtime_security()

    monkeypatch.setattr(settings, "ADMIN_AUTH_SECRET", "too-short-secret")
    with pytest.raises(RuntimeError):
        AdminAuthService.validate_runtime_security()

    monkeypatch.setattr(settings, "ADMIN_AUTH_SECRET", secrets.token_urlsafe(48))
    AdminAuthService.validate_runtime_security()


@pytest.mark.asyncio
async def test_persistent_revocation_blocks_session_even_after_memory_clear():
    admin = await db.create_admin_user("test_rev_admin", AdminAuthService.hash_password("Pass!2026"), is_active=True)
    token, _ = AdminAuthService.create_session_token(admin)
    assert await AdminAuthService.validate_session(token) is not None

    await AdminAuthService.revoke_session_token_persistent(token)
    AdminAuthService._revoked_jtis.clear()  # Simulate process restart / second worker
    assert await AdminAuthService.validate_session(token) is None


@pytest.mark.asyncio
async def test_csrf_and_origin_protection_on_state_changing_endpoints():
    await db.create_admin_user("test_csrf_admin", AdminAuthService.hash_password("CsrfPass!2026"), is_active=True)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Untrusted Origin rejected on login
        bad_login = await ac.post(
            "/api/admin/login",
            headers={"Origin": "https://evil.example.com"},
            json={"username": "test_csrf_admin", "password": "CsrfPass!2026"},
        )
        assert bad_login.status_code == 403

        # Trusted Origin login succeeds and returns CSRF token
        ok_login = await ac.post(
            "/api/admin/login",
            headers={"Origin": "http://localhost:5174"},
            json={"username": "test_csrf_admin", "password": "CsrfPass!2026"},
        )
        assert ok_login.status_code == 200
        csrf = ok_login.json()["csrf_token"]
        assert csrf

        # Missing X-CSRF-Token rejected on state-changing routes
        for path in ("/api/automation/pause", "/api/auth/google/disconnect", "/api/admin/logout"):
            res = await ac.post(path)
            assert res.status_code == 403

        # Wrong X-CSRF-Token rejected
        bad_csrf = await ac.post("/api/automation/pause", headers={"X-CSRF-Token": "forged_csrf"})
        assert bad_csrf.status_code == 403

        # Untrusted Referer rejected even with valid CSRF token
        bad_ref = await ac.post(
            "/api/automation/pause",
            headers={"X-CSRF-Token": csrf, "Referer": "https://attacker.example.org/phish"},
        )
        assert bad_ref.status_code == 403

        # Valid CSRF token + trusted Origin succeeds
        ok_pause = await ac.post(
            "/api/automation/pause",
            headers={"X-CSRF-Token": csrf, "Origin": "http://localhost:5174"},
        )
        assert ok_pause.status_code == 200
        assert ok_pause.json()["auto_reply_enabled"] is False

        ok_logout = await ac.post("/api/admin/logout", headers={"X-CSRF-Token": csrf})
        assert ok_logout.status_code == 200


# ====================================================================
# 4. Google Review Publishing Safety & Simulator Isolation
# ====================================================================
@pytest.mark.asyncio
async def test_verification_pending_blocks_duplicate_publish():
    async with await _authed_client() as ac:
        target = db._reviews[0]
        target["publishing_status"] = "verification_pending"
        target["matched_reply"] = "Already accepted by Google"

        with patch("app.services.publishing_service.google_client.publish_reply", new_callable=AsyncMock) as mock_pub:
            res = await ac.post(f"/api/reviews/{target['id']}/publish-reply")
            assert res.status_code == 409
            mock_pub.assert_not_called()

            svc_res = await PublishingService.publish_reply_for_review(target, manual_override=True)
            assert svc_res["success"] is False
            assert svc_res["reason"] == "verification_pending"
            mock_pub.assert_not_called()


@pytest.mark.asyncio
async def test_manual_google_reply_is_preserved_and_never_overwritten():
    target = {
        "id": "rev-preserve-1",
        "google_review_id": "AbFvO_manual_reply_001",
        "location_id": "locations/loc_test_1",
        "account_id": "accounts/acc_test_1",
        "star_rating": 5,
        "processing_status": "pending",
        "publishing_status": "pending",
        "matched_reply": None,
    }
    db._reviews.insert(0, target)

    with patch("app.services.publishing_service.google_client.get_review", new_callable=AsyncMock) as mock_get, \
         patch("app.services.publishing_service.google_client.publish_reply", new_callable=AsyncMock) as mock_pub:
        mock_get.return_value = {
            "success": True,
            "has_reply": True,
            "reply_comment": "Manual owner response already posted on Google UI.",
            "update_time": "2026-11-26T10:00:00Z",
        }

        res = await PublishingService.publish_reply_for_review(target, manual_override=True)
        assert res["success"] is False
        assert res["reason"] == "already_replied_on_google"
        assert res["reply_text"] == "Manual owner response already posted on Google UI."
        mock_pub.assert_not_called()

        updated = await db.get_review_by_id("rev-preserve-1")
        assert updated["publishing_status"] == "published"
        assert updated["matched_reply"] == "Manual owner response already posted on Google UI."


@pytest.mark.asyncio
async def test_concurrent_publish_attempts_locked_per_review():
    target = {
        "id": "rev-concurrent-1",
        "google_review_id": "AbFvO_concurrent_001",
        "location_id": "locations/loc_test_1",
        "account_id": "accounts/acc_test_1",
        "star_rating": 5,
        "processing_status": "pending",
        "publishing_status": "pending",
        "matched_reply": None,
    }
    db._reviews.insert(0, target)

    async def slow_get(*args, **kwargs):
        await asyncio.sleep(0.03)
        return {"success": True, "has_reply": False}

    async def slow_put(*args, **kwargs):
        await asyncio.sleep(0.03)
        return {"success": True, "http_status": 200, "comment": "Predefined reply"}

    # Ensure post-PUT verification returns published on second GET after PUT completes
    call_seq = {"puts": 0}

    async def seq_get(*args, **kwargs):
        await asyncio.sleep(0.02)
        if call_seq["puts"] == 0:
            return {"success": True, "has_reply": False}
        return {"success": True, "has_reply": True, "reply_state": "published", "reply_comment": "Predefined reply"}

    async def seq_put(*args, **kwargs):
        call_seq["puts"] += 1
        return await slow_put(*args, **kwargs)

    with patch("app.services.publishing_service.google_client.get_review", side_effect=seq_get), \
         patch("app.services.publishing_service.google_client.publish_reply", side_effect=seq_put):
        res1, res2 = await asyncio.gather(
            PublishingService.publish_reply_for_review(target, manual_override=True),
            PublishingService.publish_reply_for_review(target, manual_override=True),
        )

    assert call_seq["puts"] == 1
    assert sum(1 for r in (res1, res2) if r.get("success")) == 1
    assert any(not r.get("success") for r in (res1, res2))


@pytest.mark.asyncio
async def test_simulator_never_calls_google_publish():
    async with await _authed_client() as ac:
        await ac.post("/api/automation/resume")
        with patch("app.integrations.google_business.google_client.publish_reply", new_callable=AsyncMock) as mock_pub:
            res = await ac.post(
                "/api/reviews/test-simulate",
                json={"star_rating": 5, "review_text": "Simulator safety check", "auto_publish": True},
            )
            assert res.status_code == 201
            assert res.json()["publish_result"]["dry_run"] is True
            mock_pub.assert_not_called()

            # Direct publish of simulated ID is also blocked
            sim_id = res.json()["review"]["id"]
            pub_res = await PublishingService.publish_reply_for_review(res.json()["review"], manual_override=True)
            assert pub_res["success"] is False
            assert pub_res["reason"] == "simulated_review"
            assert sim_id
            mock_pub.assert_not_called()


@pytest.mark.asyncio
async def test_google_review_reconciliation_uses_location_and_google_review_id():
    pending_rev = {
        "id": "uuid-not-matching-google-id",
        "google_review_id": "AbFvO_reconcile_123",
        "location_id": "locations/loc_reconcile",
        "star_rating": 5,
        "processing_status": "pending",
        "publishing_status": "pending",
        "matched_reply": None,
    }
    db._reviews.insert(0, pending_rev)

    found = await db.get_review_by_google_id("locations/loc_reconcile", "AbFvO_reconcile_123")
    assert found is not None
    assert found["id"] == "uuid-not-matching-google-id"

    with patch("app.services.review_service.google_client.is_connected", return_value=True), \
         patch("app.services.review_service.PublishingService.verify_pending_replies", new_callable=AsyncMock, return_value=[]), \
         patch("app.services.review_service.google_client.fetch_reviews", new_callable=AsyncMock) as mock_fetch:
        mock_fetch.return_value = [
            {
                "reviewId": "AbFvO_reconcile_123",
                "starRating": "FIVE",
                "comment": "Great!",
                "reviewReply": {"comment": "Thank you!", "updateTime": "2026-11-26T12:00:00Z"},
            }
        ]
        await ReviewService.sync_google_reviews(account_id="accounts/acc", location_id="locations/loc_reconcile", auto_publish=False)

    assert pending_rev["processing_status"] == "processed"
    assert pending_rev["publishing_status"] == "published"
    assert pending_rev["matched_reply"] == "Thank you!"


# ====================================================================
# 5. API Hardening: Validation, Safe Errors, Headers & Payload Limits
# ====================================================================
@pytest.mark.asyncio
async def test_api_validation_security_headers_and_payload_limits():
    async with await _authed_client() as ac:
        # Security headers verified on API responses
        health = await ac.get("/health")
        assert health.headers.get("x-content-type-options") == "nosniff"
        assert health.headers.get("x-frame-options") == "DENY"
        assert health.headers.get("referrer-policy") == "strict-origin-when-cross-origin"

        # Cache-Control no-store on /api/ routes
        me_res = await ac.get("/api/admin/me")
        assert "no-store" in (me_res.headers.get("cache-control") or "")

        # Template > 4096 chars or blank whitespace rejected
        too_long = await ac.put("/api/replies/templates/positive", json={"reply_text": "x" * 4097})
        assert too_long.status_code == 422

        blank = await ac.put("/api/replies/templates/positive", json={"reply_text": "       "})
        assert blank.status_code == 422

        # Invalid review_id format & status query rejected cleanly
        bad_id = await ac.get("/api/reviews/bad$id&eq=1")
        assert bad_id.status_code == 400

        bad_status = await ac.get("/api/reviews?status=pending%26extra=1")
        assert bad_status.status_code == 400

        # Request payload size > MAX_REQUEST_BODY_BYTES returns 413
        oversized = await ac.post(
            "/api/reviews/test-simulate",
            content=json.dumps({"star_rating": 5, "review_text": "a" * (settings.MAX_REQUEST_BODY_BYTES + 100)}),
            headers={"Content-Type": "application/json"},
        )
        assert oversized.status_code == 413
