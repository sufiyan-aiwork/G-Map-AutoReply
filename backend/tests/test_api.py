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


@pytest.mark.asyncio
async def test_dashboard_summary_days_filter_and_validation(monkeypatch):
    from datetime import datetime, timedelta
    from unittest.mock import patch
    from app.api.dashboard import resolve_configured_timezone
    from app.integrations.google_business import google_client

    monkeypatch.setattr(settings, "TIMEZONE", "Asia/Kolkata")
    tz, tz_name = resolve_configured_timezone()
    assert tz_name == "Asia/Kolkata"

    now_tz = datetime.now(tz).replace(hour=12, minute=0, second=0, microsecond=0)
    db._reviews = [
        # Inside 7 days (today & 6 days ago): 1 published (5*), 1 failed (1*)
        {
            "id": "rev-d0",
            "google_review_id": "AbFvO_d0",
            "location_id": "locations/loc1",
            "star_rating": 5,
            "publishing_status": "published",
            "processing_status": "processed",
            "review_created_at": now_tz.isoformat(),
        },
        {
            "id": "rev-d6",
            "google_review_id": "AbFvO_d6",
            "location_id": "locations/loc1",
            "star_rating": 1,
            "publishing_status": "failed",
            "processing_status": "failed",
            "review_created_at": (now_tz - timedelta(days=6)).isoformat(),
        },
        # Inside 14 days (10 days ago): recent reply_published_at must NOT pull old review into 7-day window
        {
            "id": "rev-d10",
            "google_review_id": "AbFvO_d10",
            "location_id": "locations/loc1",
            "star_rating": 4,
            "publishing_status": "published",
            "processing_status": "processed",
            "review_created_at": (now_tz - timedelta(days=10)).isoformat(),
            "reply_published_at": now_tz.isoformat(),
        },
        # Inside 21 days (20 days ago)
        {
            "id": "rev-d20",
            "google_review_id": "AbFvO_d20",
            "location_id": "locations/loc1",
            "star_rating": 2,
            "publishing_status": "pending",
            "processing_status": "pending",
            "review_created_at": (now_tz - timedelta(days=20)).isoformat(),
        },
        # Inside 30 days (29 days ago) and outside 30 days (35 days ago)
        {
            "id": "rev-d29",
            "google_review_id": "AbFvO_d29",
            "location_id": "locations/loc1",
            "star_rating": 3,
            "publishing_status": "verification_pending",
            "processing_status": "pending",
            "review_created_at": (now_tz - timedelta(days=29)).isoformat(),
        },
        {
            "id": "rev-d35",
            "google_review_id": "AbFvO_d35",
            "location_id": "locations/loc1",
            "star_rating": 5,
            "publishing_status": "published",
            "processing_status": "processed",
            "review_created_at": (now_tz - timedelta(days=35)).isoformat(),
        },
    ]

    with patch.object(google_client, "client_id", None):
        async with await _new_client() as ac:
            r_all = await ac.get("/api/dashboard/summary")
            assert r_all.status_code == 200
            d_all = r_all.json()
            assert d_all["period_days"] is None
            assert d_all["total_reviews"] == 6
            assert d_all["positive_reviews_count"] == 4
            assert d_all["negative_reviews_count"] == 2
            assert d_all["total_published_replies"] == 3
            assert d_all["failed_publishing_attempts"] == 1
            assert d_all["pending_reviews_count"] == 2
            assert d_all["star_rating_distribution"] == {"5": 2, "4": 1, "3": 1, "2": 1, "1": 1}

            r7 = await ac.get("/api/dashboard/summary?days=7")
            assert r7.status_code == 200
            d7 = r7.json()
            assert d7["period_days"] == 7
            assert d7["timezone"] == "Asia/Kolkata"
            assert d7["total_reviews"] == 2
            assert d7["positive_reviews_count"] == 1
            assert d7["negative_reviews_count"] == 1
            assert d7["total_published_replies"] == 1
            assert d7["failed_publishing_attempts"] == 1
            assert d7["pending_reviews_count"] == 0
            assert d7["average_star_rating"] == 3.0
            assert d7["star_rating_distribution"] == {"5": 1, "4": 0, "3": 0, "2": 0, "1": 1}

            r14 = await ac.get("/api/dashboard/summary?days=14")
            assert r14.status_code == 200
            assert r14.json()["total_reviews"] == 3
            assert r14.json()["total_published_replies"] == 2

            r21 = await ac.get("/api/dashboard/summary?days=21")
            assert r21.status_code == 200
            assert r21.json()["total_reviews"] == 4
            assert r21.json()["pending_reviews_count"] == 1

            r30 = await ac.get("/api/dashboard/summary?days=30")
            assert r30.status_code == 200
            d30 = r30.json()
            assert d30["total_reviews"] == 5
            assert d30["pending_reviews_count"] == 2
            assert d30["total_published_replies"] == 2
            assert d30["failed_publishing_attempts"] == 1

            # Reject unsupported day intervals
            for bad_days in (0, 5, 15, 90):
                bad_res = await ac.get(f"/api/dashboard/summary?days={bad_days}")
                assert bad_res.status_code == 400


def test_calendar_day_boundary_respects_configured_timezone():
    from datetime import datetime, timezone
    from app.api.dashboard import filter_reviews_by_calendar_days, resolve_configured_timezone

    tz, _ = resolve_configured_timezone("Asia/Kolkata")
    # 2026-11-26 01:00 IST == 2026-11-25 19:30 UTC
    # Last 7 IST calendar days (including Nov 26) starts 2026-11-20 00:00 IST == 2026-11-19 18:30 UTC
    now_utc = datetime(2026, 11, 25, 19, 30, 0, tzinfo=timezone.utc)
    reviews = [
        {"id": "before_ist_midnight", "review_created_at": "2026-11-19T18:29:59Z"},
        {"id": "at_ist_midnight", "review_created_at": "2026-11-19T18:30:00Z"},
        {"id": "today_ist", "review_created_at": "2026-11-25T19:00:00Z"},
        {"id": "missing_date", "review_created_at": None, "created_at": "2026-11-25T19:00:00Z"},
    ]

    filtered, start_date, end_date = filter_reviews_by_calendar_days(reviews, 7, tz, now_dt=now_utc)
    assert start_date.isoformat() == "2026-11-20"
    assert end_date.isoformat() == "2026-11-26"
    assert [r["id"] for r in filtered] == ["at_ist_midnight", "today_ist"]



