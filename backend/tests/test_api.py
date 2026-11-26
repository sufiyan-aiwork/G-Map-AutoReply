"""
Integration tests for FastAPI endpoints.
Techzone Academy Review Automation.
"""

import pytest
from httpx import AsyncClient, ASGITransport
from app.config import settings
from app.integrations.supabase_client import db
from app.main import app
from app.services.admin_auth_service import AdminAuthService


@pytest.fixture(autouse=True)
def isolate_supabase_writes():
    orig_mode = db._isolated_test_mode
    orig_cfg = dict(db._business_config)
    orig_reviews = [dict(r) for r in db._reviews]
    orig_pubs = [dict(p) for p in db._published_replies]
    db._isolated_test_mode = True
    yield
    db._isolated_test_mode = orig_mode
    db._business_config = orig_cfg
    db._reviews = orig_reviews
    db._published_replies = orig_pubs


async def _auth_cookies():
    admin = await db.create_admin_user(
        "test_api_suite_admin",
        AdminAuthService.hash_password("TestSuitePass!123"),
    )
    token, _ = AdminAuthService.create_session_token(admin)
    csrf = AdminAuthService.derive_csrf_token(token)
    return {settings.ADMIN_COOKIE_NAME: token}, {"X-CSRF-Token": csrf}


async def _new_client():
    cookies, headers = await _auth_cookies()
    return AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        cookies=cookies,
        headers=headers,
    )


@pytest.mark.asyncio
async def test_health_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["business"] == "Techzone Academy"

@pytest.mark.asyncio
async def test_dashboard_summary_endpoint():
    async with await _new_client() as ac:
        response = await ac.get("/api/dashboard/summary")
    assert response.status_code == 200
    data = response.json()
    assert "total_reviews" in data
    assert "positive_reviews_count" in data
    assert "negative_reviews_count" in data
    assert "star_rating_distribution" in data
    assert data["total_reviews"] >= 5

@pytest.mark.asyncio
async def test_reviews_list_and_filter():
    async with await _new_client() as ac:
        # Fetch all
        res_all = await ac.get("/api/reviews")
        assert res_all.status_code == 200
        reviews = res_all.json()
        assert len(reviews) >= 5
        
        # Filter 5 stars
        res_5 = await ac.get("/api/reviews?rating=5")
        assert res_5.status_code == 200
        for r in res_5.json():
            assert r["star_rating"] == 5

@pytest.mark.asyncio
async def test_simulate_reviews_all_five_ratings():
    async with await _new_client() as ac:
        await ac.post("/api/automation/resume")
        try:
            for stars in [5, 4, 3, 2, 1]:
                payload = {
                    "star_rating": stars,
                    "review_text": f"Automated test review with {stars} stars",
                    "reviewer_name": f"Tester {stars}",
                    "auto_publish": True
                }
                res = await ac.post("/api/reviews/test-simulate", json=payload)
                assert res.status_code == 201
                body = res.json()
                review = body["review"]
                publish_result = body["publish_result"]
                
                assert review["star_rating"] == stars
                assert publish_result["dry_run"] is True
                if stars in [3, 4, 5]:
                    assert publish_result["category"] == "positive"
                    assert "Thank you" in publish_result["reply_text"]
                else:
                    assert publish_result["category"] == "negative"
                    assert "apologise" in publish_result["reply_text"].lower()
        finally:
            await ac.post("/api/automation/pause")

@pytest.mark.asyncio
async def test_automation_pause_and_resume():
    async with await _new_client() as ac:
        # Pause
        res_pause = await ac.post("/api/automation/pause")
        assert res_pause.status_code == 200
        assert res_pause.json()["auto_reply_enabled"] is False
        
        # Check status
        res_status = await ac.get("/api/automation/status")
        assert res_status.json()["auto_reply_enabled"] is False
        
        # Ingest review while paused -> should remain pending/paused
        payload = {
            "star_rating": 5,
            "review_text": "Review during pause test",
            "reviewer_name": "Paused User",
            "auto_publish": True
        }
        res_ingest = await ac.post("/api/reviews/test-simulate", json=payload)
        assert res_ingest.status_code == 201
        assert res_ingest.json()["publish_result"]["success"] is False
        assert res_ingest.json()["publish_result"]["reason"] == "automation_paused"
        
        # Resume
        res_resume = await ac.post("/api/automation/resume")
        assert res_resume.status_code == 200
        assert res_resume.json()["auto_reply_enabled"] is True
        
        # Always restore to PAUSED to honor project requirement
        await ac.post("/api/automation/pause")

@pytest.mark.asyncio
async def test_preview_reply_endpoint():
    async with await _new_client() as ac:
        # Get a review
        res = await ac.get("/api/reviews")
        assert res.status_code == 200
        reviews = res.json()
        assert len(reviews) > 0
        
        target = reviews[0]
        preview_res = await ac.get(f"/api/reviews/{target['id']}/preview-reply")
        assert preview_res.status_code == 200
        data = preview_res.json()
        
        assert data["review_id"] == target["id"]
        assert data["star_rating"] == target["star_rating"]
        if target["star_rating"] >= 3:
            assert data["category"] == "positive"
            assert "Techzone Academy" in data["reply_preview"]
        else:
            assert data["category"] == "negative"
            assert "apologise" in data["reply_preview"].lower()

@pytest.mark.asyncio
async def test_preview_reply_not_found():
    async with await _new_client() as ac:
        preview_res = await ac.get("/api/reviews/non-existent-id/preview-reply")
        assert preview_res.status_code == 404

@pytest.mark.asyncio
async def test_publish_single_reply_duplicate_prevention():
    from app.integrations.supabase_client import db

    async with await _new_client() as ac:
        reviews = await db.get_reviews()
        assert len(reviews) > 0
        
        target = reviews[0]
        target["publishing_status"] = "published"
        target["matched_reply"] = "Existing reply text"
        
        res = await ac.post(f"/api/reviews/{target['id']}/publish-reply")
        assert res.status_code == 409
        assert "already has a published" in res.json()["detail"].lower()

@pytest.mark.asyncio
async def test_publish_single_reply_controlled_success():
    from unittest.mock import patch, AsyncMock
    from app.integrations.supabase_client import db

    async with await _new_client() as ac:
        reviews = await db.get_reviews()
        assert len(reviews) > 0
        
        target = reviews[0]
        target["publishing_status"] = "pending"
        target["matched_reply"] = None
        target["processing_status"] = "pending"
        target["google_review_id"] = "AbFvO_real_test_001"
        target["location_id"] = "locations/test_loc_1"
        target["account_id"] = "accounts/test_acc_1"
        
        with patch("app.services.publishing_service.google_client.publish_reply", new_callable=AsyncMock) as mock_pub, \
             patch("app.services.publishing_service.google_client.get_review", new_callable=AsyncMock) as mock_verify:
            mock_pub.return_value = {
                "success": True,
                "http_status": 200,
                "review_id": target.get("google_review_id"),
                "response": {"comment": "Thank you for sharing your valuable feedback with Techzone Academy!"}
            }
            mock_verify.side_effect = [
                {"success": True, "has_reply": False},
                {
                    "success": True,
                    "has_reply": True,
                    "reply_state": "published",
                    "reply_comment": "Thank you for sharing your valuable feedback with Techzone Academy!"
                },
            ]
            
            res = await ac.post(f"/api/reviews/{target['id']}/publish-reply")
            assert res.status_code == 200
            data = res.json()
            assert data["success"] is True
            assert data["result"]["publishing_status"] == "published"
            assert "published and verified" in data["message"].lower()
            mock_pub.assert_called_once()
            assert mock_verify.call_count == 2

@pytest.mark.asyncio
async def test_disconnected_oauth_cannot_publish():
    from unittest.mock import patch
    from app.integrations.supabase_client import db
    from app.integrations.google_business import google_client
    from app.services.publishing_service import PublishingService

    reviews = await db.get_reviews()
    assert len(reviews) > 0

    target = reviews[0]
    target["publishing_status"] = "pending"
    target["matched_reply"] = None
    target["google_review_id"] = "AbFvO_real_test_002"
    target["location_id"] = "locations/test_loc_1"
    target["account_id"] = "accounts/test_acc_1"

    orig_access = google_client.access_token
    orig_refresh = google_client.refresh_token
    try:
        google_client.access_token = None
        google_client.refresh_token = None
        google_client.is_mock_connected = False

        with patch.object(google_client, "_load_tokens_from_file", return_value=None), \
             patch.object(google_client, "is_connected", return_value=False):
            res = await PublishingService.publish_reply_for_review(target, manual_override=True)
            assert res["success"] is False
            assert res["publishing_status"] == "failed"
            assert "disconnected" in res["error"].lower() or "authentication" in res["error"].lower()
    finally:
        google_client.access_token = orig_access
        google_client.refresh_token = orig_refresh

@pytest.mark.asyncio
async def test_mock_response_cannot_create_published_record():
    from unittest.mock import patch, AsyncMock
    from app.integrations.supabase_client import db
    from app.services.publishing_service import PublishingService

    reviews = await db.get_reviews()
    assert len(reviews) > 0

    target = reviews[0]
    target["publishing_status"] = "pending"
    target["matched_reply"] = None
    target["google_review_id"] = "AbFvO_real_test_003"
    target["location_id"] = "locations/test_loc_1"
    target["account_id"] = "accounts/test_acc_1"

    with patch("app.services.publishing_service.google_client.get_review", new_callable=AsyncMock, return_value={"success": True, "has_reply": False}), \
         patch("app.services.publishing_service.google_client.publish_reply", new_callable=AsyncMock) as mock_pub:
        mock_pub.return_value = {
            "success": True,
            "comment": "Mock reply",
            "simulated": True
        }

        res = await PublishingService.publish_reply_for_review(target, manual_override=True)
        assert res["success"] is False
        assert res["publishing_status"] == "failed"

@pytest.mark.asyncio
async def test_verification_pending_when_propagation_delayed():
    from unittest.mock import patch, AsyncMock
    from app.integrations.supabase_client import db
    from app.services.publishing_service import PublishingService

    reviews = await db.get_reviews()
    assert len(reviews) > 0

    target = reviews[0]
    target["publishing_status"] = "pending"
    target["matched_reply"] = None
    target["google_review_id"] = "AbFvO_real_test_004"
    target["location_id"] = "locations/test_loc_1"
    target["account_id"] = "accounts/test_acc_1"

    with patch("app.services.publishing_service.google_client.publish_reply", new_callable=AsyncMock) as mock_pub, \
         patch("app.services.publishing_service.google_client.get_review", new_callable=AsyncMock) as mock_verify:
        mock_pub.return_value = {
            "success": True,
            "http_status": 200,
            "response": {"comment": "Predefined reply"}
        }
        mock_verify.return_value = {
            "success": True,
            "has_reply": False,
            "reply_state": "unreplied"
        }

        res = await PublishingService.publish_reply_for_review(target, manual_override=True)
        assert res["success"] is True
        assert res["publishing_status"] == "verification_pending"

@pytest.mark.asyncio
async def test_policy_violation_marks_failed():
    from unittest.mock import patch, AsyncMock
    from app.integrations.supabase_client import db
    from app.services.publishing_service import PublishingService

    reviews = await db.get_reviews()
    assert len(reviews) > 0

    target = reviews[0]
    target["publishing_status"] = "pending"
    target["matched_reply"] = None
    target["google_review_id"] = "AbFvO_real_test_005"
    target["location_id"] = "locations/test_loc_1"
    target["account_id"] = "accounts/test_acc_1"

    with patch("app.services.publishing_service.google_client.publish_reply", new_callable=AsyncMock) as mock_pub, \
         patch("app.services.publishing_service.google_client.get_review", new_callable=AsyncMock) as mock_verify:
        mock_pub.return_value = {
            "success": True,
            "http_status": 200,
            "response": {"comment": "Predefined reply"}
        }
        mock_verify.side_effect = [
            {"success": True, "has_reply": False},
            {
                "success": True,
                "policy_violation": "SPAM_CONTENT",
                "has_reply": False
            },
        ]

        res = await PublishingService.publish_reply_for_review(target, manual_override=True)
        assert res["success"] is False
        assert res["publishing_status"] == "failed"
        assert "policy violation" in res["error"].lower()

@pytest.mark.asyncio
async def test_http_errors_recorded_correctly():
    from unittest.mock import patch, AsyncMock
    from app.integrations.supabase_client import db
    from app.services.publishing_service import PublishingService

    reviews = await db.get_reviews()
    assert len(reviews) > 0

    target = reviews[0]
    target["publishing_status"] = "pending"
    target["matched_reply"] = None
    target["google_review_id"] = "AbFvO_real_test_006"
    target["location_id"] = "locations/test_loc_1"
    target["account_id"] = "accounts/test_acc_1"

    for code in [401, 403, 404, 429, 500]:
        target["publishing_status"] = "pending"
        target["matched_reply"] = None
        with patch("app.services.publishing_service.google_client.get_review", new_callable=AsyncMock, return_value={"success": True, "has_reply": False}), \
             patch("app.services.publishing_service.google_client.publish_reply", new_callable=AsyncMock) as mock_pub:
            mock_pub.return_value = {
                "success": False,
                "http_status": code,
                "error": f"Google API error HTTP {code}"
            }

            res = await PublishingService.publish_reply_for_review(target, manual_override=True)
            assert res["success"] is False
            assert res["publishing_status"] == "failed"
            assert str(code) in res["error"]


