"""
Review Ingestion, Synchronization, and Duplicate Prevention Service.
Enforces idempotency using (location_id, google_review_id) and orchestrates Google review fetching.
"""

from typing import Dict, Any, Optional, List
import logging
import asyncio
from datetime import datetime, timezone
from ..integrations.supabase_client import db
from ..integrations.google_business import google_client
from .publishing_service import PublishingService

logger = logging.getLogger("review_service")

class DuplicateReviewError(Exception):
    pass

class ReviewService:
    _sync_lock: asyncio.Lock = asyncio.Lock()

    @staticmethod
    async def process_new_review(
        location_id: str,
        google_review_id: str,
        star_rating: int,
        review_text: Optional[str] = None,
        reviewer_name: Optional[str] = "Valued Customer",
        review_created_at: Optional[str] = None,
        auto_publish: bool = False
    ) -> Dict[str, Any]:
        """
        Ingests a customer review:
        1. Checks for duplicates by (location_id, google_review_id).
        2. Persists review into Supabase.
        3. If auto_publish=True, triggers PublishingService.
        """
        # Step 1: Duplicate check
        is_duplicate = await db.review_exists(location_id=location_id, google_review_id=google_review_id)
        if is_duplicate:
            await db.add_log(
                event_type="duplicate_detected",
                description=f"Duplicate review detected for google_review_id='{google_review_id}' at location='{location_id}'. Ignored.",
                status="warning"
            )
            raise DuplicateReviewError(f"Review '{google_review_id}' has already been processed for this location.")

        # Step 2: Store review record
        review_data = {
            "google_review_id": google_review_id,
            "location_id": location_id,
            "star_rating": star_rating,
            "review_text": review_text,
            "reviewer_name": reviewer_name,
            "review_created_at": review_created_at or datetime.now(timezone.utc).isoformat(),
            "processing_status": "pending"
        }
        
        stored_review = await db.create_review(review_data)
        await db.add_log(
            event_type="review_stored",
            description=f"Stored review '{google_review_id}' ({star_rating}★) from {reviewer_name}.",
            status="info"
        )

        # Step 3: Trigger auto-reply if enabled
        publish_result = None
        if auto_publish:
            # Immediate Pause Safeguard: Re-verify auto_reply_enabled directly before publishing
            fresh_config = await db.get_business_config()
            if not fresh_config.get("auto_reply_enabled", True):
                logger.info(f"Auto-publish skipped for review '{google_review_id}': automation was paused.")
                publish_result = {
                    "success": False,
                    "reason": "automation_paused",
                    "publishing_status": "pending",
                    "review_id": stored_review["id"],
                    "error": "Automatic review replies are paused."
                }
            else:
                publish_result = await PublishingService.publish_reply_for_review(stored_review)
            
        # Re-fetch updated review
        updated_review = await db.get_review_by_id(stored_review["id"])
        return {
            "review": updated_review or stored_review,
            "publish_result": publish_result
        }

    @classmethod
    async def sync_google_reviews(
        cls,
        account_id: Optional[str] = None,
        location_id: Optional[str] = None,
        auto_publish: bool = False
    ) -> Dict[str, Any]:
        """
        Fetches customer reviews from Google Business Profile,
        checks for existing owner replies and duplicates, stores new reviews in Supabase.
        Handles pagination across all available pages.
        When auto_publish is True, automatically publishes predefined replies strictly
        for newly discovered customer reviews.
        """
        if cls._sync_lock.locked():
            logger.warning("Review synchronization skipped: another sync cycle is currently in progress.")
            return {
                "status": "skipped",
                "reason": "concurrent_sync_in_progress",
                "total_fetched": 0,
                "new_ingested": 0,
                "replies_published": 0,
                "duplicates_skipped": 0,
                "already_replied_count": 0
            }

        async with cls._sync_lock:
            config = await db.get_business_config()
            acc = account_id or google_client.account_id or config.get("google_account_id")
            loc = location_id or google_client.location_id or config.get("google_location_id")

            if not acc or not loc:
                if not google_client.is_connected():
                    acc = acc or "accounts/1098273491823749"
                    loc = loc or "locations/892348723948234"
                else:
                    await db.add_log(
                        event_type="sync_skipped",
                        description="Google review sync skipped: Google Account ID or Location ID not configured/detected.",
                        status="warning"
                    )
                    return {
                        "total_fetched": 0,
                        "new_ingested": 0,
                        "replies_published": 0,
                        "duplicates_skipped": 0,
                        "already_replied_count": 0,
                        "error": "Google Account ID or Location ID not configured/detected."
                    }

            await db.add_log(
                event_type="sync_started",
                description=f"Started synchronizing Google Business Profile reviews for {loc}...",
                status="info"
            )

            # Step 0: GET-only reconciliation for previously accepted replies awaiting Google verification
            await PublishingService.verify_pending_replies(account_id=acc, location_id=loc)

            # Retrieve reviews from Google API (handles pagination up to all reviews)
            google_reviews = await google_client.fetch_reviews(account_id=acc, location_id=loc)
            
            total_fetched = len(google_reviews)
            new_ingested = 0
            replies_published = 0
            duplicates_skipped = 0
            already_replied_count = 0

            for item in google_reviews:
                g_review_id = item.get("reviewId")
                if not g_review_id:
                    continue

                # Check if review already has an owner reply directly on Google
                google_reply = item.get("reviewReply")
                has_google_reply = bool(google_reply)
                
                # Check duplicate in database
                is_dup = await db.review_exists(location_id=loc, google_review_id=g_review_id)
                if is_dup:
                    # Reconciliation: If review was stored as pending but Google now exposes the owner reply
                    if has_google_reply:
                        db_rev = await db.get_review_by_id(g_review_id)
                        if db_rev and db_rev.get("processing_status") == "pending":
                            reply_text = google_reply.get("comment", "")
                            reply_time = google_reply.get("updateTime")
                            await db.update_published_reply(
                                review_id=db_rev["id"],
                                status="published",
                                google_published_at=reply_time
                            )
                            await db.update_review_status(
                                review_id=db_rev["id"],
                                status="processed",
                                matched_reply=reply_text,
                                publishing_status="published",
                                reply_published_at=reply_time
                            )
                    duplicates_skipped += 1
                    continue

                # Parse star rating safely
                try:
                    star_rating = google_client.parse_star_rating(item.get("starRating"))
                except Exception as e:
                    logger.warning(f"Could not parse star rating for review {g_review_id}: {e}")
                    continue

                reviewer_name = "Valued Customer"
                if isinstance(item.get("reviewer"), dict):
                    reviewer_name = item["reviewer"].get("displayName") or "Valued Customer"
                
                comment_text = item.get("comment", "")
                create_time = item.get("createTime") or datetime.now(timezone.utc).isoformat()
                
                if has_google_reply:
                    # If Google already has a reply posted previously, record review and preserve owner reply
                    existing_reply_text = google_reply.get("comment", "")
                    reply_published_at = google_reply.get("updateTime")
                    review_data = {
                        "google_review_id": g_review_id,
                        "location_id": loc,
                        "star_rating": star_rating,
                        "review_text": comment_text,
                        "reviewer_name": reviewer_name,
                        "review_created_at": create_time,
                        "processing_status": "processed",
                        "matched_reply": existing_reply_text,
                        "publishing_status": "published",
                        "reply_published_at": reply_published_at
                    }
                    await db.create_review(review_data)
                    already_replied_count += 1
                    new_ingested += 1
                    continue

                # Immediate Pause Safeguard:
                # Re-verify auto_reply_enabled directly before processing each new review
                current_auto_publish = auto_publish
                if current_auto_publish:
                    fresh_config = await db.get_business_config()
                    if not fresh_config.get("auto_reply_enabled", True):
                        current_auto_publish = False
                        logger.info(
                            f"Immediate pause safeguard triggered mid-cycle: automation was paused. "
                            f"Review '{g_review_id}' will be stored as pending without publishing."
                        )

                # Ingest new review into Supabase
                try:
                    res = await ReviewService.process_new_review(
                        location_id=loc,
                        google_review_id=g_review_id,
                        star_rating=star_rating,
                        review_text=comment_text,
                        reviewer_name=reviewer_name,
                        review_created_at=create_time,
                        auto_publish=current_auto_publish
                    )
                    new_ingested += 1
                    pub_res = res.get("publish_result") if isinstance(res, dict) else None
                    if pub_res and pub_res.get("success"):
                        replies_published += 1
                except DuplicateReviewError:
                    duplicates_skipped += 1
                except Exception as e:
                    logger.error(f"Error processing review {g_review_id}: {e}")

            summary = {
                "total_fetched": total_fetched,
                "new_ingested": new_ingested,
                "replies_published": replies_published,
                "duplicates_skipped": duplicates_skipped,
                "already_replied_count": already_replied_count,
                "timestamp": google_client.last_sync_at
            }

            await db.add_log(
                event_type="sync_completed",
                description=f"Google review sync completed: {total_fetched} reviews fetched from Google, {new_ingested} newly ingested, {duplicates_skipped} duplicates skipped, {already_replied_count} already had owner replies on Google.",
                status="success"
            )

            return summary

    @staticmethod
    async def get_reviews(
        rating: Optional[int] = None,
        status: Optional[str] = None,
        location_id: Optional[str] = None,
        genuine_only: bool = False
    ) -> List[Dict[str, Any]]:
        return await db.get_reviews(
            rating=rating,
            status=status,
            location_id=location_id,
            genuine_only=genuine_only
        )

    @staticmethod
    async def get_review_by_id(review_id: str) -> Optional[Dict[str, Any]]:
        return await db.get_review_by_id(review_id)
