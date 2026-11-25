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


async def _auth_cookies():
    admin = await db.create_admin_user(
        "test_api_suite_admin",
        AdminAuthService.hash_password("TestSuitePass!123"),
    )
    token, _ = AdminAuthService.create_session_token(admin)
    return {settings.ADMIN_COOKIE_NAME: token}


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
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test", cookies=await _auth_cookies()) as ac:
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
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test", cookies=await _auth_cookies()) as ac:
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
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test", cookies=await _auth_cookies()) as ac:
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
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test", cookies=await _auth_cookies()) as ac:
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
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test", cookies=await _auth_cookies()) as ac:
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
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test", cookies=await _auth_cookies()) as ac:
        preview_res = await ac.get("/api/reviews/non-existent-id/preview-reply")
        assert preview_res.status_code == 404

@pytest.mark.asyncio
async def test_publish_single_reply_duplicate_prevention():
    from unittest.mock import patch, AsyncMock
    from app.integrations.supabase_client import db

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test", cookies=await _auth_cookies()) as ac:
        # Create a mock review in memory or query existing
        reviews = await db.get_reviews()
        if not reviews:
            pytest.skip("No reviews available for testing")
        
        target = reviews[0]
        # Simulate that it already has a published reply
        original_status = target.get("publishing_status")
        original_matched = target.get("matched_reply")
        
        try:
            target["publishing_status"] = "published"
            target["matched_reply"] = "Existing reply text"
            
            res = await ac.post(f"/api/reviews/{target['id']}/publish-reply")
            assert res.status_code == 409
            assert "already has a published reply" in res.json()["detail"]
        finally:
            target["publishing_status"] = original_status
            target["matched_reply"] = original_matched

@pytest.mark.asyncio
async def test_publish_single_reply_controlled_success():
    from unittest.mock import patch, AsyncMock
    from app.integrations.supabase_client import db

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test", cookies=await _auth_cookies()) as ac:
        reviews = await db.get_reviews()
        if not reviews:
            pytest.skip("No reviews available for testing")
        
        target = reviews[0]
        original_status = target.get("publishing_status")
        original_matched = target.get("matched_reply")
        original_proc = target.get("processing_status")
        
        try:
            target["publishing_status"] = "pending"
            target["matched_reply"] = None
            target["processing_status"] = "pending"
            
            # Mock google_client.publish_reply and get_review for genuine verified publish
            with patch("app.services.publishing_service.google_client.publish_reply", new_callable=AsyncMock) as mock_pub, \
                 patch("app.services.publishing_service.google_client.get_review", new_callable=AsyncMock) as mock_verify:
                mock_pub.return_value = {
                    "success": True,
                    "http_status": 200,
                    "review_id": target.get("google_review_id"),
                    "response": {"comment": "Thank you for sharing your valuable feedback with Techzone Academy!"}
                }
                mock_verify.return_value = {
                    "success": True,
                    "has_reply": True,
                    "reply_state": "published",
                    "reply_comment": "Thank you for sharing your valuable feedback with Techzone Academy!"
                }
                
                res = await ac.post(f"/api/reviews/{target['id']}/publish-reply")
                assert res.status_code == 200
                data = res.json()
                assert data["success"] is True
                assert data["result"]["publishing_status"] == "published"
                assert "published and verified" in data["message"].lower()
                mock_pub.assert_called_once()
                mock_verify.assert_called_once()
        finally:
            # Restore state
            target["publishing_status"] = original_status
            target["matched_reply"] = original_matched
            target["processing_status"] = original_proc

@pytest.mark.asyncio
async def test_disconnected_oauth_cannot_publish():
    from unittest.mock import patch
    from app.integrations.supabase_client import db
    from app.integrations.google_business import google_client
    from app.services.publishing_service import PublishingService

    reviews = await db.get_reviews()
    if not reviews:
        pytest.skip("No reviews available")

    target = reviews[0]
    # Ensure google_client is disconnected
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
    if not reviews:
        pytest.skip("No reviews available")

    target = reviews[0]
    original_status = target.get("publishing_status")
    original_matched = target.get("matched_reply")

    try:
        target["publishing_status"] = "pending"
        target["matched_reply"] = None

        # Simulate a mock fallback returning success=True, simulated=True
        with patch("app.services.publishing_service.google_client.publish_reply", new_callable=AsyncMock) as mock_pub:
            mock_pub.return_value = {
                "success": True,
                "comment": "Mock reply",
                "simulated": True
            }

            res = await PublishingService.publish_reply_for_review(target, manual_override=True)
            # Must reject simulation as a published record
            assert res["success"] is False
            assert res["publishing_status"] == "failed"
    finally:
        target["publishing_status"] = original_status
        target["matched_reply"] = original_matched

@pytest.mark.asyncio
async def test_verification_pending_when_propagation_delayed():
    from unittest.mock import patch, AsyncMock
    from app.integrations.supabase_client import db
    from app.services.publishing_service import PublishingService

    reviews = await db.get_reviews()
    if not reviews:
        pytest.skip("No reviews available")

    target = reviews[0]
    original_status = target.get("publishing_status")
    original_matched = target.get("matched_reply")

    try:
        target["publishing_status"] = "pending"
        target["matched_reply"] = None

        # PUT succeeds (200), but GET review does not yet reflect reviewReply
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
    finally:
        target["publishing_status"] = original_status
        target["matched_reply"] = original_matched

@pytest.mark.asyncio
async def test_policy_violation_marks_failed():
    from unittest.mock import patch, AsyncMock
    from app.integrations.supabase_client import db
    from app.services.publishing_service import PublishingService

    reviews = await db.get_reviews()
    if not reviews:
        pytest.skip("No reviews available")

    target = reviews[0]
    original_status = target.get("publishing_status")
    original_matched = target.get("matched_reply")

    try:
        target["publishing_status"] = "pending"
        target["matched_reply"] = None

        with patch("app.services.publishing_service.google_client.publish_reply", new_callable=AsyncMock) as mock_pub, \
             patch("app.services.publishing_service.google_client.get_review", new_callable=AsyncMock) as mock_verify:
            mock_pub.return_value = {
                "success": True,
                "http_status": 200,
                "response": {"comment": "Predefined reply"}
            }
            mock_verify.return_value = {
                "success": True,
                "policy_violation": "SPAM_CONTENT",
                "has_reply": False
            }

            res = await PublishingService.publish_reply_for_review(target, manual_override=True)
            assert res["success"] is False
            assert res["publishing_status"] == "failed"
            assert "policy violation" in res["error"].lower()
    finally:
        target["publishing_status"] = original_status
        target["matched_reply"] = original_matched

@pytest.mark.asyncio
async def test_http_errors_recorded_correctly():
    from unittest.mock import patch, AsyncMock
    from app.integrations.supabase_client import db
    from app.services.publishing_service import PublishingService

    reviews = await db.get_reviews()
    if not reviews:
        pytest.skip("No reviews available")

    target = reviews[0]
    original_status = target.get("publishing_status")
    original_matched = target.get("matched_reply")

    try:
        target["publishing_status"] = "pending"
        target["matched_reply"] = None

        for code in [401, 403, 404, 429, 500]:
            with patch("app.services.publishing_service.google_client.publish_reply", new_callable=AsyncMock) as mock_pub:
                mock_pub.return_value = {
                    "success": False,
                    "http_status": code,
                    "error": f"Google API error {code}: Mock error"
                }

                res = await PublishingService.publish_reply_for_review(target, manual_override=True)
                assert res["success"] is False
                assert res["publishing_status"] == "failed"
                assert str(code) in res["error"]
    finally:
        target["publishing_status"] = original_status
        target["matched_reply"] = original_matched


