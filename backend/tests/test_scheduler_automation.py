"""
Automated tests for Scheduler Automatic Publishing Implementation.
Covers the 10 core scenarios:
1. Dynamic Automation State Check: auto_reply_enabled=True -> auto_publish=True
2. Dynamic Automation State Check: auto_reply_enabled=False -> auto_publish=False
3. Existing reviews skipped via review_exists duplicate detection
4. New reviews auto-published only when auto_publish=True
5. Immediate Pause Safeguard: pause stops publishing immediately
6. Resume Functionality: resume processes future reviews automatically
7. Mid-Cycle Pause Safeguard: blocks subsequent reviews in batch
8. Concurrency Protection: overlapping cycles locked via _sync_lock
9. Manual Publishing: works independently of global automation setting (manual_override=True)
10. Historical Isolation: failed and pending reviews are never automatically retried
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, patch, MagicMock
from app.services.scheduler_service import SchedulerService
from app.services.review_service import ReviewService, DuplicateReviewError
from app.services.publishing_service import PublishingService

@pytest.mark.asyncio
async def test_1_scheduler_sync_now_when_automation_enabled():
    """Scenario 1: When auto_reply_enabled=True, sync_now calls sync_google_reviews with auto_publish=True."""
    with patch("app.services.scheduler_service.db.get_business_config", new_callable=AsyncMock) as mock_config, \
         patch("app.services.review_service.ReviewService.sync_google_reviews", new_callable=AsyncMock) as mock_sync:
        mock_config.return_value = {"auto_reply_enabled": True, "polling_interval": 15}
        mock_sync.return_value = {"total_fetched": 5, "new_ingested": 1, "replies_published": 1}

        result = await SchedulerService.sync_now()

        mock_sync.assert_called_once_with(auto_publish=True)
        assert result["status"] == "success"
        assert result["summary"]["replies_published"] == 1

@pytest.mark.asyncio
async def test_2_scheduler_sync_now_when_automation_disabled():
    """Scenario 2: When auto_reply_enabled=False, sync_now calls sync_google_reviews with auto_publish=False."""
    with patch("app.services.scheduler_service.db.get_business_config", new_callable=AsyncMock) as mock_config, \
         patch("app.services.review_service.ReviewService.sync_google_reviews", new_callable=AsyncMock) as mock_sync:
        mock_config.return_value = {"auto_reply_enabled": False, "polling_interval": 15}
        mock_sync.return_value = {"total_fetched": 5, "new_ingested": 1, "replies_published": 0}

        result = await SchedulerService.sync_now()

        mock_sync.assert_called_once_with(auto_publish=False)
        assert result["status"] == "success"
        assert result["summary"]["replies_published"] == 0

@pytest.mark.asyncio
async def test_3_existing_reviews_skipped_via_duplicate_detection():
    """Scenario 3: Existing reviews in Supabase are strictly skipped and never reprocessed."""
    mock_reviews = [
        {
            "reviewId": "existing_rev_001",
            "starRating": "FIVE",
            "comment": "Existing 5 star review",
            "reviewer": {"displayName": "User A"}
        },
        {
            "reviewId": "existing_rev_002",
            "starRating": "ONE",
            "comment": "Existing 1 star review",
            "reviewer": {"displayName": "User B"}
        }
    ]

    with patch("app.services.review_service.google_client.is_connected", return_value=True), \
         patch("app.services.review_service.google_client.fetch_reviews", new_callable=AsyncMock) as mock_fetch, \
         patch("app.services.review_service.db.review_exists", new_callable=AsyncMock) as mock_exists, \
         patch("app.services.review_service.db.create_review", new_callable=AsyncMock) as mock_create, \
         patch("app.services.review_service.PublishingService.publish_reply_for_review", new_callable=AsyncMock) as mock_pub, \
         patch("app.services.review_service.db.get_business_config", new_callable=AsyncMock) as mock_config, \
         patch("app.services.review_service.db.add_log", new_callable=AsyncMock):

        mock_config.return_value = {"google_account_id": "acc_1", "google_location_id": "loc_1", "auto_reply_enabled": True}
        mock_fetch.return_value = mock_reviews
        mock_exists.return_value = True  # Both reviews already exist

        summary = await ReviewService.sync_google_reviews(account_id="acc_1", location_id="loc_1", auto_publish=True)

        assert summary["total_fetched"] == 2
        assert summary["duplicates_skipped"] == 2
        assert summary["new_ingested"] == 0
        assert summary["replies_published"] == 0
        mock_create.assert_not_called()
        mock_pub.assert_not_called()

@pytest.mark.asyncio
async def test_4_new_reviews_auto_published_only_when_enabled():
    """Scenario 4: New reviews trigger automatic publishing only when auto_publish=True and automation is active."""
    new_google_review = {
        "reviewId": "new_rev_101",
        "starRating": "FIVE",
        "comment": "Great course!",
        "reviewer": {"displayName": "New Student"}
    }

    # Case A: auto_publish=False -> Ingests review, does NOT call publishing service
    with patch("app.services.review_service.google_client.is_connected", return_value=True), \
         patch("app.services.review_service.google_client.fetch_reviews", new_callable=AsyncMock) as mock_fetch, \
         patch("app.services.review_service.db.review_exists", new_callable=AsyncMock) as mock_exists, \
         patch("app.services.review_service.db.create_review", new_callable=AsyncMock) as mock_create, \
         patch("app.services.review_service.PublishingService.publish_reply_for_review", new_callable=AsyncMock) as mock_pub, \
         patch("app.services.review_service.db.get_review_by_id", new_callable=AsyncMock) as mock_get_by_id, \
         patch("app.services.review_service.db.get_business_config", new_callable=AsyncMock) as mock_config, \
         patch("app.services.review_service.db.add_log", new_callable=AsyncMock):

        mock_config.return_value = {"google_account_id": "acc_1", "google_location_id": "loc_1", "auto_reply_enabled": False}
        mock_fetch.return_value = [new_google_review]
        mock_exists.return_value = False
        mock_create.return_value = {"id": "db_rev_101", "star_rating": 5, "processing_status": "pending"}
        mock_get_by_id.return_value = {"id": "db_rev_101", "star_rating": 5, "processing_status": "pending"}

        summary = await ReviewService.sync_google_reviews(account_id="acc_1", location_id="loc_1", auto_publish=False)

        assert summary["new_ingested"] == 1
        assert summary["replies_published"] == 0
        mock_create.assert_called_once()
        mock_pub.assert_not_called()

    # Case B: auto_publish=True -> Ingests review AND publishes predefined reply
    with patch("app.services.review_service.google_client.is_connected", return_value=True), \
         patch("app.services.review_service.google_client.fetch_reviews", new_callable=AsyncMock) as mock_fetch, \
         patch("app.services.review_service.db.review_exists", new_callable=AsyncMock) as mock_exists, \
         patch("app.services.review_service.db.create_review", new_callable=AsyncMock) as mock_create, \
         patch("app.services.review_service.PublishingService.publish_reply_for_review", new_callable=AsyncMock) as mock_pub, \
         patch("app.services.review_service.db.get_review_by_id", new_callable=AsyncMock) as mock_get_by_id, \
         patch("app.services.review_service.db.get_business_config", new_callable=AsyncMock) as mock_config, \
         patch("app.services.review_service.db.add_log", new_callable=AsyncMock):

        mock_config.return_value = {"google_account_id": "acc_1", "google_location_id": "loc_1", "auto_reply_enabled": True}
        mock_fetch.return_value = [new_google_review]
        mock_exists.return_value = False
        mock_create.return_value = {"id": "db_rev_101", "star_rating": 5, "processing_status": "pending"}
        mock_get_by_id.return_value = {"id": "db_rev_101", "star_rating": 5, "processing_status": "processed"}
        mock_pub.return_value = {"success": True, "publishing_status": "published"}

        summary = await ReviewService.sync_google_reviews(account_id="acc_1", location_id="loc_1", auto_publish=True)

        assert summary["new_ingested"] == 1
        assert summary["replies_published"] == 1
        mock_create.assert_called_once()
        mock_pub.assert_called_once()

@pytest.mark.asyncio
async def test_5_immediate_pause_safeguard():
    """Scenario 5: Pausing automation immediately sets auto_reply_enabled=False and blocks publishing."""
    with patch("app.services.scheduler_service.db.update_business_config", new_callable=AsyncMock) as mock_update, \
         patch("app.services.scheduler_service.db.add_log", new_callable=AsyncMock):
        res = await SchedulerService.pause_automation()
        assert res["status"] == "paused"
        assert res["auto_reply_enabled"] is False
        mock_update.assert_called_once_with(auto_reply_enabled=False)

    # Verify process_new_review stops publishing if paused
    with patch("app.services.review_service.db.review_exists", return_value=False), \
         patch("app.services.review_service.db.create_review", new_callable=AsyncMock) as mock_create, \
         patch("app.services.review_service.db.get_business_config", new_callable=AsyncMock) as mock_config, \
         patch("app.services.review_service.PublishingService.publish_reply_for_review", new_callable=AsyncMock) as mock_pub, \
         patch("app.services.review_service.db.get_review_by_id", new_callable=AsyncMock) as mock_get_id, \
         patch("app.services.review_service.db.add_log", new_callable=AsyncMock):

        mock_config.return_value = {"auto_reply_enabled": False}
        mock_create.return_value = {"id": "test_rev_paused", "star_rating": 5}
        mock_get_id.return_value = {"id": "test_rev_paused", "star_rating": 5}

        result = await ReviewService.process_new_review(
            location_id="loc_1",
            google_review_id="g_paused_1",
            star_rating=5,
            review_text="Test",
            auto_publish=True  # Requested auto_publish, but automation is paused in DB
        )

        assert result["publish_result"]["success"] is False
        assert result["publish_result"]["reason"] == "automation_paused"
        mock_pub.assert_not_called()

@pytest.mark.asyncio
async def test_6_resume_functionality():
    """Scenario 6: Resuming automation sets auto_reply_enabled=True and enables future auto publishing."""
    with patch("app.services.scheduler_service.db.update_business_config", new_callable=AsyncMock) as mock_update, \
         patch("app.services.scheduler_service.db.add_log", new_callable=AsyncMock):
        res = await SchedulerService.resume_automation()
        assert res["status"] == "active"
        assert res["auto_reply_enabled"] is True
        mock_update.assert_called_once_with(auto_reply_enabled=True)

@pytest.mark.asyncio
async def test_7_mid_cycle_pause_blocks_subsequent_reviews_in_batch():
    """Scenario 7: Mid-cycle pause safeguard stops subsequent automatic publishing in the same sync batch."""
    batch_reviews = [
        {"reviewId": "batch_rev_1", "starRating": "FIVE", "comment": "First"},
        {"reviewId": "batch_rev_2", "starRating": "FIVE", "comment": "Second"},
        {"reviewId": "batch_rev_3", "starRating": "FIVE", "comment": "Third"}
    ]

    # First review checks config -> enabled. Second and third check config -> paused.
    configs = [
        {"auto_reply_enabled": True},   # Initial check at start
        {"auto_reply_enabled": True},   # Check before rev_1 process
        {"auto_reply_enabled": True},   # Inside process_new_review for rev_1
        {"auto_reply_enabled": False},  # Mid-cycle check before rev_2
        {"auto_reply_enabled": False},  # Mid-cycle check before rev_3
    ]

    async def dynamic_config():
        if configs:
            return configs.pop(0)
        return {"auto_reply_enabled": False}

    with patch("app.services.review_service.google_client.is_connected", return_value=True), \
         patch("app.services.review_service.google_client.fetch_reviews", new_callable=AsyncMock) as mock_fetch, \
         patch("app.services.review_service.db.review_exists", new_callable=AsyncMock, return_value=False), \
         patch("app.services.review_service.db.create_review", new_callable=AsyncMock) as mock_create, \
         patch("app.services.review_service.PublishingService.publish_reply_for_review", new_callable=AsyncMock) as mock_pub, \
         patch("app.services.review_service.PublishingService.verify_pending_replies", new_callable=AsyncMock), \
         patch("app.services.review_service.db.get_review_by_id", new_callable=AsyncMock) as mock_get_id, \
         patch("app.services.review_service.db.get_business_config", side_effect=dynamic_config), \
         patch("app.services.review_service.db.add_log", new_callable=AsyncMock):

        mock_fetch.return_value = batch_reviews
        mock_create.side_effect = lambda data: {"id": data["google_review_id"], **data}
        mock_get_id.side_effect = lambda rid: {"id": rid, "star_rating": 5}
        mock_pub.return_value = {"success": True, "publishing_status": "published"}

        summary = await ReviewService.sync_google_reviews(account_id="acc_1", location_id="loc_1", auto_publish=True)

        assert summary["total_fetched"] == 3
        assert summary["new_ingested"] == 3
        # Exactly 1 was published before pause took effect; remaining 2 were ingested as pending without publishing
        assert summary["replies_published"] == 1
        assert mock_pub.call_count == 1

@pytest.mark.asyncio
async def test_8_concurrency_protection_sync_lock():
    """Scenario 8: Concurrent sync attempts are locked and skipped to prevent duplicate publications."""
    # Ensure lock is not held initially
    if ReviewService._sync_lock.locked():
        ReviewService._sync_lock.release()

    async with ReviewService._sync_lock:
        # While lock is acquired by another process/cycle:
        result = await ReviewService.sync_google_reviews()
        assert result["status"] == "skipped"
        assert result["reason"] == "concurrent_sync_in_progress"
        assert result["total_fetched"] == 0
        assert result["replies_published"] == 0

@pytest.mark.asyncio
async def test_9_manual_publishing_works_while_automation_is_disabled():
    """Scenario 9: Administrators can publish individual replies manually even when global automation is paused."""
    review_record = {
        "id": "manual_rev_uuid",
        "google_review_id": "g_manual_001",
        "star_rating": 5,
        "reviewer_name": "Manual Tester",
        "review_text": "Manual publish test",
        "publishing_status": "pending",
        "matched_reply": None
    }

    with patch("app.services.publishing_service.db.get_business_config", new_callable=AsyncMock) as mock_config, \
         patch("app.services.publishing_service.google_client.publish_reply", new_callable=AsyncMock) as mock_g_pub, \
         patch("app.services.publishing_service.google_client.get_review", new_callable=AsyncMock) as mock_g_get, \
         patch("app.services.publishing_service.db.update_review_status", new_callable=AsyncMock) as mock_update, \
         patch("app.services.publishing_service.db.record_published_reply", new_callable=AsyncMock) as mock_record, \
         patch("app.services.publishing_service.db.add_log", new_callable=AsyncMock):

        mock_config.return_value = {"auto_reply_enabled": False}  # Automation is globally PAUSED
        mock_g_pub.return_value = {"success": True, "updateTime": "2026-11-24T16:00:00Z"}
        mock_g_get.return_value = {
            "success": True,
            "has_reply": True,
            "reply_text": "Thank you for sharing your valuable feedback with Techzone Academy! We are happy to have you as part of our learning community. We truly appreciate your support!",
            "update_time": "2026-11-24T16:00:00Z",
            "reply_state": None,
            "policy_violation": None,
            "review": {
                "reviewReply": {
                    "comment": "Thank you for sharing your valuable feedback with Techzone Academy! We are happy to have you as part of our learning community. We truly appreciate your support!",
                    "updateTime": "2026-11-24T16:00:00Z"
                }
            }
        }

        # With manual_override=True, publishing succeeds despite auto_reply_enabled=False
        result = await PublishingService.publish_reply_for_review(review_record, manual_override=True)

        assert result["success"] is True
        assert result["publishing_status"] == "published"
        mock_g_pub.assert_called_once()
        mock_update.assert_called_with(
            review_id="manual_rev_uuid",
            status="processed",
            matched_reply=result["reply_text"],
            publishing_status="published",
            reply_published_at="2026-11-24T16:00:00Z"
        )

@pytest.mark.asyncio
async def test_10_historical_failed_and_pending_reviews_never_retried():
    """Scenario 10: Scheduler sync only handles items from Google fetch, never re-queries or retries DB records."""
    with patch("app.services.review_service.google_client.is_connected", return_value=True), \
         patch("app.services.review_service.google_client.fetch_reviews", new_callable=AsyncMock) as mock_fetch, \
         patch("app.services.review_service.PublishingService.verify_pending_replies", new_callable=AsyncMock), \
         patch("app.services.review_service.db.get_reviews", new_callable=AsyncMock) as mock_get_reviews, \
         patch("app.services.review_service.db.get_business_config", new_callable=AsyncMock) as mock_config, \
         patch("app.services.review_service.db.add_log", new_callable=AsyncMock):

        mock_config.return_value = {"google_account_id": "acc_1", "google_location_id": "loc_1", "auto_reply_enabled": True}
        mock_fetch.return_value = []  # No new reviews from Google

        summary = await ReviewService.sync_google_reviews(account_id="acc_1", location_id="loc_1", auto_publish=True)

        assert summary["total_fetched"] == 0
        assert summary["new_ingested"] == 0
        assert summary["replies_published"] == 0
        # Verify db.get_reviews was never called to query pending/failed historical reviews
        mock_get_reviews.assert_not_called()
