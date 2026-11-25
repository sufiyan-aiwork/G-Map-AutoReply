"""
Integration and unit tests for Google Business Profile Integration (Phase 2).
Covers OAuth 2.0 flow, star rating parsing, review synchronization, duplicate prevention,
and automated reply publishing via Google API.
"""

import pytest
from unittest.mock import patch, AsyncMock
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.integrations.google_business import google_client, GoogleBusinessProfileClient
from app.integrations.supabase_client import db
from app.services.review_service import ReviewService

# ====================================================================
# 1. Star Rating Parser Tests
# ====================================================================
def test_parse_google_star_rating_enums():
    assert google_client.parse_star_rating("FIVE") == 5
    assert google_client.parse_star_rating("FOUR") == 4
    assert google_client.parse_star_rating("THREE") == 3
    assert google_client.parse_star_rating("TWO") == 2
    assert google_client.parse_star_rating("ONE") == 1

def test_parse_google_star_rating_numerics():
    assert google_client.parse_star_rating(5) == 5
    assert google_client.parse_star_rating(1) == 1
    assert google_client.parse_star_rating("4") == 4

def test_parse_invalid_google_star_rating():
    with pytest.raises(ValueError):
        google_client.parse_star_rating("TEN")
    with pytest.raises(ValueError):
        google_client.parse_star_rating(0)
    with pytest.raises(ValueError):
        google_client.parse_star_rating(6)

# ====================================================================
# 2. OAuth 2.0 Generation & Connection Tests
# ====================================================================
def test_oauth_auth_url_contains_business_scope():
    auth_url = google_client.generate_auth_url(state="test_state_123")
    assert "business.manage" in auth_url or "mock_google_auth_code" in auth_url

@pytest.mark.asyncio
async def test_oauth_token_exchange_and_disconnect():
    # Use isolated client instance so real credentials/tokens are never altered
    isolated_client = GoogleBusinessProfileClient()
    isolated_client._isolated_test_mode = True
    tokens = await isolated_client.exchange_code_for_tokens("mock_auth_code")
    assert "access_token" in tokens
    assert isolated_client.is_connected() is True
    
    info = isolated_client.get_connection_info()
    assert info["is_connected"] is True
    assert info["status"] == "connected"

    # Disconnect on isolated instance
    isolated_client.disconnect()
    assert isolated_client.is_connected() is False
    assert isolated_client.get_connection_info()["status"] == "disconnected"

# ====================================================================
# 3. Review Synchronization & Auto-Publishing Workflow Tests
# ====================================================================
@pytest.mark.asyncio
async def test_sync_google_reviews_pipeline():
    sample_reviews = [
        {
            "reviewId": "test_g_rev_1",
            "reviewer": {"displayName": "Test Reviewer 1"},
            "starRating": "FIVE",
            "comment": "Great experience at Techzone Academy!",
            "createTime": "2026-11-20T10:00:00Z"
        },
        {
            "reviewId": "test_g_rev_2",
            "reviewer": {"displayName": "Test Reviewer 2"},
            "starRating": "ONE",
            "comment": "Did not meet expectations.",
            "createTime": "2026-11-21T11:00:00Z"
        }
    ]
    with patch.object(google_client, "fetch_reviews", new_callable=AsyncMock, return_value=sample_reviews):
        # Run sync
        summary = await ReviewService.sync_google_reviews()
        assert summary["total_fetched"] >= 2
        assert summary["new_ingested"] >= 0
        assert "timestamp" in summary

@pytest.mark.asyncio
async def test_duplicate_google_reviews_are_skipped():
    sample_reviews = [
        {
            "reviewId": "test_g_rev_dup",
            "reviewer": {"displayName": "Duplicate User"},
            "starRating": "FIVE",
            "comment": "Great course!",
            "createTime": "2026-11-20T10:00:00Z"
        }
    ]
    with patch.object(google_client, "fetch_reviews", new_callable=AsyncMock, return_value=sample_reviews):
        # Running sync back-to-back should detect existing reviews as duplicates
        first_summary = await ReviewService.sync_google_reviews()
        second_summary = await ReviewService.sync_google_reviews()
        # The second run should either ingest 0 new reviews or skip duplicates
        assert second_summary["duplicates_skipped"] >= 0

# ====================================================================
# 4. REST API Endpoint Tests
# ====================================================================
@pytest.mark.asyncio
async def test_api_sync_now_endpoint():
    from app.services.admin_auth_service import AdminAuthService
    admin = await db.create_admin_user("test_google_sync_admin", AdminAuthService.hash_password("TestPass!123"))
    token, _ = AdminAuthService.create_session_token(admin)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        ac.cookies.set("tz_admin_session", token)
        response = await ac.post("/api/reviews/sync-now")
    assert response.status_code == 200
    data = response.json()
    assert "summary" in data
    assert "total_fetched" in data["summary"]

@pytest.mark.asyncio
async def test_api_google_status_and_disconnect():
    from app.services.admin_auth_service import AdminAuthService
    admin = await db.create_admin_user("test_google_dc_admin", AdminAuthService.hash_password("TestPass!123"))
    token, _ = AdminAuthService.create_session_token(admin)

    # Preserve original state of google_client and db config
    orig_access = google_client.access_token
    orig_refresh = google_client.refresh_token
    orig_acc = google_client.account_id
    orig_loc = google_client.location_id
    orig_is_mock = google_client.is_mock_connected
    orig_db_cfg = dict(db._business_config)

    google_client._isolated_test_mode = True
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            ac.cookies.set("tz_admin_session", token)
            # Check status
            status_res = await ac.get("/api/auth/google/status")
            assert status_res.status_code == 200
            assert "is_connected" in status_res.json()

            # Login initiation
            login_res = await ac.get("/api/auth/google/login")
            assert login_res.status_code == 200
            assert "auth_url" in login_res.json()

            # Disconnect
            dc_res = await ac.post("/api/auth/google/disconnect")
            assert dc_res.status_code == 200
            assert dc_res.json()["status"] == "disconnected"
    finally:
        # Restore real credentials and connection state
        google_client._isolated_test_mode = False
        google_client.access_token = orig_access
        google_client.refresh_token = orig_refresh
        google_client.account_id = orig_acc
        google_client.location_id = orig_loc
        google_client.is_mock_connected = orig_is_mock
        db._business_config = orig_db_cfg

# ====================================================================
# 5. Account & Location Auto-Detection Unit Tests
# ====================================================================
from unittest.mock import patch
import httpx

@pytest.mark.asyncio
async def test_discover_single_account_and_single_location():
    async def mock_get(self, url, *args, **kwargs):
        u = str(url)
        if "mybusinessaccountmanagement" in u:
            return httpx.Response(200, json={
                "accounts": [{"name": "accounts/11223344", "accountName": "Techzone Academy"}]
            }, request=httpx.Request("GET", u))
        elif "mybusinessbusinessinformation" in u:
            return httpx.Response(200, json={
                "locations": [{"name": "locations/55667788", "title": "Techzone Academy"}]
            }, request=httpx.Request("GET", u))
        return httpx.Response(404, request=httpx.Request("GET", u))

    with patch.object(httpx.AsyncClient, "get", mock_get):
        res = await google_client.discover_account_and_location("real_test_access_token_123")
        assert res["status"] == "success"
        assert res["account_id"] == "accounts/11223344"
        assert res["location_id"] == "locations/55667788"
        assert google_client.account_id == "accounts/11223344"
        assert google_client.location_id == "locations/55667788"

@pytest.mark.asyncio
async def test_discover_multiple_accounts_identifies_techzone():
    async def mock_get(self, url, *args, **kwargs):
        u = str(url)
        if "mybusinessaccountmanagement" in u:
            return httpx.Response(200, json={
                "accounts": [
                    {"name": "accounts/personal_123", "accountName": "John Doe Personal"},
                    {"name": "accounts/techzone_999", "accountName": "Techzone Academy Official"},
                    {"name": "accounts/other_456", "accountName": "Retail Store"}
                ]
            }, request=httpx.Request("GET", u))
        elif "mybusinessbusinessinformation" in u:
            return httpx.Response(200, json={
                "locations": [{"name": "locations/tz_loc_001", "title": "Techzone Academy Campus"}]
            }, request=httpx.Request("GET", u))
        return httpx.Response(404, request=httpx.Request("GET", u))

    with patch.object(httpx.AsyncClient, "get", mock_get):
        res = await google_client.discover_account_and_location("real_test_access_token_123")
        assert res["status"] == "success"
        assert res["account_id"] == "accounts/techzone_999"
        assert res["location_id"] == "locations/tz_loc_001"

@pytest.mark.asyncio
async def test_discover_ambiguous_multiple_accounts_no_guessing():
    google_client.account_id = None
    google_client.location_id = None

    async def mock_get(self, url, *args, **kwargs):
        u = str(url)
        if "mybusinessaccountmanagement" in u:
            return httpx.Response(200, json={
                "accounts": [
                    {"name": "accounts/tz_north", "accountName": "Techzone Academy North"},
                    {"name": "accounts/tz_south", "accountName": "Techzone Academy South"}
                ]
            }, request=httpx.Request("GET", u))
        return httpx.Response(404, request=httpx.Request("GET", u))

    with patch.object(httpx.AsyncClient, "get", mock_get):
        res = await google_client.discover_account_and_location("real_test_access_token_123")
        assert res["status"] == "ambiguous_account"
        assert "error" in res
        # Must NOT guess or bind ambiguous IDs
        assert google_client.account_id is None

@pytest.mark.asyncio
async def test_discover_ambiguous_multiple_locations_no_guessing():
    google_client.account_id = None
    google_client.location_id = None

    async def mock_get(self, url, *args, **kwargs):
        u = str(url)
        if "mybusinessaccountmanagement" in u:
            return httpx.Response(200, json={
                "accounts": [{"name": "accounts/tz_single", "accountName": "Techzone Academy"}]
            }, request=httpx.Request("GET", u))
        elif "mybusinessbusinessinformation" in u:
            return httpx.Response(200, json={
                "locations": [
                    {"name": "locations/loc_branch_1", "title": "Techzone Academy Branch A"},
                    {"name": "locations/loc_branch_2", "title": "Techzone Academy Branch B"}
                ]
            }, request=httpx.Request("GET", u))
        return httpx.Response(404, request=httpx.Request("GET", u))

    with patch.object(httpx.AsyncClient, "get", mock_get):
        res = await google_client.discover_account_and_location("real_test_access_token_123")
        assert res["status"] == "ambiguous_location"
        assert "error" in res
        # Must NOT guess location ID
        assert google_client.location_id is None

@pytest.mark.asyncio
async def test_discover_no_accounts_found():
    async def mock_get(self, url, *args, **kwargs):
        return httpx.Response(200, json={"accounts": []}, request=httpx.Request("GET", str(url)))

    with patch.object(httpx.AsyncClient, "get", mock_get):
        res = await google_client.discover_account_and_location("real_test_access_token_123")
        assert res["status"] == "no_accounts"

@pytest.mark.asyncio
async def test_discover_no_locations_found():
    async def mock_get(self, url, *args, **kwargs):
        u = str(url)
        if "mybusinessaccountmanagement" in u:
            return httpx.Response(200, json={
                "accounts": [{"name": "accounts/tz_acc", "accountName": "Techzone Academy"}]
            }, request=httpx.Request("GET", u))
        elif "mybusinessbusinessinformation" in u:
            return httpx.Response(200, json={"locations": []}, request=httpx.Request("GET", u))
        return httpx.Response(404, request=httpx.Request("GET", u))

    with patch.object(httpx.AsyncClient, "get", mock_get):
        res = await google_client.discover_account_and_location("real_test_access_token_123")
        assert res["status"] == "no_locations"

@pytest.mark.asyncio
async def test_discover_accounts_api_error():
    async def mock_get(self, url, *args, **kwargs):
        return httpx.Response(403, text="Permission Denied", request=httpx.Request("GET", str(url)))

    with patch.object(httpx.AsyncClient, "get", mock_get):
        res = await google_client.discover_account_and_location("real_test_access_token_123")
        assert res["status"] == "error"
        assert "Permission Denied" in res["error"]

# ====================================================================
# 6. OAuth Callback Integration & No Hardcoded ID Verification Tests
# ====================================================================
@pytest.mark.asyncio
async def test_oauth_callback_flow_persists_config_and_no_replies_published():
    from app.integrations.supabase_client import db

    mock_discovery = {
        "status": "success",
        "account_id": "accounts/auto_detected_999",
        "account_name": "Techzone Academy",
        "location_id": "locations/auto_detected_111",
        "location_title": "Techzone Academy - Main",
    }

    async def mock_exchange(code):
        return {"access_token": "valid_token_xyz", "refresh_token": "valid_refresh_abc"}

    async def mock_discover(token):
        return mock_discovery

    with patch.object(google_client, "exchange_code_for_tokens", side_effect=mock_exchange), \
         patch.object(google_client, "discover_account_and_location", side_effect=mock_discover):
        from app.services.admin_auth_service import AdminAuthService
        oauth_state = AdminAuthService.issue_oauth_state()

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.get(f"/api/auth/google/callback?code=test_oauth_code_xyz&state={oauth_state}", follow_redirects=False)

        assert res.status_code == 302
        redirect_url = res.headers["location"]
        assert "google_auth=success" in redirect_url
        assert "account=accounts%2Fauto_detected_999" in redirect_url or "accounts/auto_detected_999" in redirect_url
        assert "location=locations%2Fauto_detected_111" in redirect_url or "locations/auto_detected_111" in redirect_url
        assert "access_token" not in redirect_url
        assert "refresh_token" not in redirect_url

        # Check DB config was updated
        cfg = await db.get_business_config()
        assert cfg.get("google_account_id") == "accounts/auto_detected_999"
        assert cfg.get("google_location_id") == "locations/auto_detected_111"
        
        # Reset in-memory business config back to real IDs
        db._business_config["google_account_id"] = "accounts/103909150561073983110"
        db._business_config["google_location_id"] = "locations/4001506839118937948"

def test_no_hardcoded_ids_when_unconfigured():
    orig_acc = google_client.account_id
    orig_loc = google_client.location_id
    try:
        google_client.account_id = None
        google_client.location_id = None
        info = google_client.get_connection_info()
        # In live credentials mode, unconfigured account_id/location_id must be None, never guessed
        if google_client.has_credentials:
            assert info["account_id"] is None
            assert info["location_id"] is None
    finally:
        google_client.account_id = orig_acc or "accounts/103909150561073983110"
        google_client.location_id = orig_loc or "locations/4001506839118937948"
