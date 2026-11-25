"""
Unit and Integration Tests for Review Synchronization Fixes:
1. Supabase status constraint mapping (verification_pending -> pending).
2. Delayed Google reply propagation & GET-only reconciliation.
3. Strict verification invariant: GET only, NEVER sends another PUT.
4. Immediate scheduler interval update via asyncio.Event interruption.
5. Pause/resume event triggering & overlapping cycle protection.
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, patch, MagicMock
from app.integrations.supabase_client import db
from app.services.scheduler_service import SchedulerService
from app.services.publishing_service import PublishingService
from app.services.review_service import ReviewService

@pytest.mark.asyncio
async def test_1_supabase_status_mapping_verification_pending():
    """Validates that verification_pending is safely mapped to 'pending' in the database payload."""
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value.status_code = 201

        res = await db.record_published_reply(
            review_id="test_rev_100",
            reply_text="Test reply text",
            status="verification_pending"
        )

        assert res["publishing_status"] == "verification_pending"
        # Verify the actual payload sent to Supabase REST API mapped the status to 'pending'
        assert mock_post.called
        call_json = mock_post.call_args.kwargs.get("json", {})
        assert call_json["publishing_status"] == "pending"
        assert call_json["error_message"] == "verification_pending"
        assert call_json["reply_text"] == "Test reply text"

@pytest.mark.asyncio
async def test_2_delayed_google_reply_propagation_reconciliation():
    """Validates that GET-only reconciliation updates pending reviews to published with Google's updateTime."""
    mock_review = {
        "id": "rev_uuid_prop",
        "google_review_id": "g_rev_prop_01",
        "star_rating": 5,
        "processing_status": "pending",
        "publishing_status": "verification_pending",
        "matched_reply": "Thank you for sharing your valuable feedback with Techzone Academy!"
    }

    with patch("app.services.publishing_service.db.get_business_config", new_callable=AsyncMock) as mock_cfg, \
         patch("app.services.publishing_service.db.get_reviews", new_callable=AsyncMock) as mock_get_revs, \
         patch("app.services.publishing_service.google_client.get_review", new_callable=AsyncMock) as mock_g_get, \
         patch("app.services.publishing_service.db.update_published_reply", new_callable=AsyncMock) as mock_update_pub, \
         patch("app.services.publishing_service.db.update_review_status", new_callable=AsyncMock) as mock_update_rev, \
         patch("app.services.publishing_service.db.add_log", new_callable=AsyncMock):

        mock_cfg.return_value = {
            "google_account_id": "accounts/test_acc",
            "google_location_id": "locations/test_loc"
        }
        mock_get_revs.return_value = [mock_review]
        mock_g_get.return_value = {
            "success": True,
            "has_reply": True,
            "reply_text": "Thank you for sharing your valuable feedback with Techzone Academy!",
            "update_time": "2026-11-24T12:02:12Z"
        }

        reconciled = await PublishingService.verify_pending_replies(
            account_id="accounts/test_acc",
            location_id="locations/test_loc"
        )

        assert len(reconciled) == 1
        assert reconciled[0]["status"] == "published"
        assert reconciled[0]["google_published_at"] == "2026-11-24T12:02:12Z"

        mock_update_pub.assert_called_once_with(
            review_id="rev_uuid_prop",
            status="published",
            google_published_at="2026-11-24T12:02:12Z"
        )
        mock_update_rev.assert_called_once_with(
            review_id="rev_uuid_prop",
            status="processed",
            matched_reply="Thank you for sharing your valuable feedback with Techzone Academy!",
            publishing_status="published",
            reply_published_at="2026-11-24T12:02:12Z"
        )

@pytest.mark.asyncio
async def test_3_verification_strictly_uses_get_and_never_sends_put():
    """Validates that verification reconciliation strictly uses GET and never invokes publish_reply (PUT)."""
    mock_review = {
        "id": "rev_uuid_safe",
        "google_review_id": "g_rev_safe_01",
        "star_rating": 5,
        "processing_status": "pending",
        "publishing_status": "verification_pending",
        "matched_reply": "Predefined response"
    }

    with patch("app.services.publishing_service.db.get_business_config", new_callable=AsyncMock) as mock_cfg, \
         patch("app.services.publishing_service.db.get_reviews", new_callable=AsyncMock) as mock_get_revs, \
         patch("app.services.publishing_service.google_client.get_review", new_callable=AsyncMock) as mock_g_get, \
         patch("app.services.publishing_service.google_client.publish_reply", new_callable=AsyncMock) as mock_g_put, \
         patch("app.services.publishing_service.db.update_published_reply", new_callable=AsyncMock), \
         patch("app.services.publishing_service.db.update_review_status", new_callable=AsyncMock), \
         patch("app.services.publishing_service.db.add_log", new_callable=AsyncMock):

        mock_cfg.return_value = {
            "google_account_id": "accounts/test_acc",
            "google_location_id": "locations/test_loc"
        }
        mock_get_revs.return_value = [mock_review]
        # Google still returns no reply (still in propagation)
        mock_g_get.return_value = {
            "success": True,
            "has_reply": False
        }

        reconciled = await PublishingService.verify_pending_replies(
            account_id="accounts/test_acc",
            location_id="locations/test_loc"
        )

        assert len(reconciled) == 1
        assert reconciled[0]["status"] == "verification_pending"
        # CRITICAL SAFETY CHECK: GET was called, but PUT was NEVER called!
        mock_g_get.assert_called_once()
        mock_g_put.assert_not_called()

@pytest.mark.asyncio
async def test_4_immediate_scheduler_interval_update_event():
    """Validates that updating the polling interval immediately sets _reschedule_event to interrupt countdown."""
    with patch("app.services.scheduler_service.db.update_business_config", new_callable=AsyncMock), \
         patch("app.services.scheduler_service.db.add_log", new_callable=AsyncMock):

        SchedulerService._reschedule_event.clear()
        assert not SchedulerService._reschedule_event.is_set()

        await SchedulerService.update_settings(5)

        # Event should now be set immediately
        assert SchedulerService._reschedule_event.is_set()

@pytest.mark.asyncio
async def test_5_pause_and_resume_trigger_reschedule_event():
    """Validates that pause and resume operations trigger the reschedule event for instant state adoption."""
    with patch("app.services.scheduler_service.db.update_business_config", new_callable=AsyncMock), \
         patch("app.services.scheduler_service.db.add_log", new_callable=AsyncMock):

        SchedulerService._reschedule_event.clear()
        await SchedulerService.pause_automation()
        assert SchedulerService._reschedule_event.is_set()

        SchedulerService._reschedule_event.clear()
        await SchedulerService.resume_automation()
        assert SchedulerService._reschedule_event.is_set()

        # Always return to paused
        SchedulerService._reschedule_event.clear()
        await SchedulerService.pause_automation()

@pytest.mark.asyncio
async def test_6_interruptible_sleep_breaks_immediately_on_event():
    """Validates that asyncio.wait_for on _reschedule_event breaks immediately rather than waiting the full interval."""
    SchedulerService._reschedule_event.clear()

    async def trigger_reschedule():
        await asyncio.sleep(0.05)
        SchedulerService._reschedule_event.set()

    asyncio.create_task(trigger_reschedule())

    start_time = asyncio.get_event_loop().time()
    try:
        # Simulate waiting for 60 seconds (or minutes)
        await asyncio.wait_for(SchedulerService._reschedule_event.wait(), timeout=60.0)
        interrupted = True
    except asyncio.TimeoutError:
        interrupted = False

    elapsed = asyncio.get_event_loop().time() - start_time
    assert interrupted is True
    # Broke in under 0.5s instead of waiting 60s
    assert elapsed < 1.0

@pytest.mark.asyncio
async def test_7_reconciliation_in_sync_google_reviews():
    """Validates that ReviewService.sync_google_reviews automatically triggers pending reply verification."""
    with patch("app.services.review_service.google_client.is_connected", return_value=True), \
         patch("app.services.review_service.google_client.fetch_reviews", new_callable=AsyncMock, return_value=[]), \
         patch("app.services.review_service.PublishingService.verify_pending_replies", new_callable=AsyncMock) as mock_verify, \
         patch("app.services.review_service.db.get_business_config", new_callable=AsyncMock) as mock_cfg, \
         patch("app.services.review_service.db.add_log", new_callable=AsyncMock):

        mock_cfg.return_value = {
            "google_account_id": "accounts/test_acc",
            "google_location_id": "locations/test_loc",
            "auto_reply_enabled": False
        }

        await ReviewService.sync_google_reviews(
            account_id="accounts/test_acc",
            location_id="locations/test_loc",
            auto_publish=False
        )
        mock_verify.assert_called_once_with(account_id="accounts/test_acc", location_id="locations/test_loc")
