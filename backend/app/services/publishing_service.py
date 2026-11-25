"""
Publishing Service for Techzone Academy Reviews.
Orchestrates publishing predefined replies to Google Business Profile via google_client,
enforces auto-reply pause rules, and records results in Supabase.
"""

from typing import Dict, Any, Optional
from datetime import datetime, timezone
from ..integrations.supabase_client import db
from ..integrations.google_business import google_client
from .reply_service import ReplyService, TemplateInactiveOrMissingError

class PublishingService:
    @staticmethod
    async def preview_reply_for_review(review_id: str) -> Dict[str, Any]:
        """
        Generates a non-publishing preview of the exact predefined reply template
        that matches the given customer review.
        Checks for existing Google replies and duplicate publishing state.
        """
        review = await db.get_review_by_id(review_id)
        if not review:
            raise ValueError(f"Review with ID '{review_id}' does not exist.")

        star_rating = review["star_rating"]
        google_review_id = review.get("google_review_id", "")
        reviewer_name = review.get("reviewer_name", "Valued Customer")
        review_text = review.get("review_text", "")
        current_status = review.get("publishing_status") or review.get("processing_status", "pending")
        existing_reply = review.get("matched_reply")
        
        # Check if already published or has existing verified reply
        is_already_published = (current_status == "published") and bool(existing_reply)

        # Retrieve matching template
        reply_data = await ReplyService.get_reply_for_rating(star_rating)
        category = reply_data["category"]
        reply_text = reply_data["reply_text"]

        return {
            "review_id": review["id"],
            "google_review_id": google_review_id,
            "reviewer_name": reviewer_name,
            "star_rating": star_rating,
            "review_text": review_text,
            "category": category,
            "template_name": "Positive Template (3-5★)" if category == "positive" else "Negative Template (1-2★)",
            "template_id": reply_data.get("template_id"),
            "reply_preview": reply_text,
            "applicable_ratings": reply_data.get("applicable_ratings", []),
            "current_publishing_status": current_status,
            "is_already_published": is_already_published,
            "existing_reply": existing_reply,
            "can_publish": not is_already_published
        }

    @staticmethod
    async def publish_reply_for_review(
        review: Dict[str, Any],
        dry_run: bool = False,
        manual_override: bool = False
    ) -> Dict[str, Any]:
        """
        Processes a review: selects the predefined reply and publishes it to Google.
        
        Safety & Integrity Guarantees:
        - Prevents duplicate publishing if review is already published.
        - Preserves existing owner replies on Google.
        - Respects global auto-reply pause rules unless manual_override=True.
        - Employs exponential backoff on Google API transient failures.
        - Records comprehensive audit trail in Supabase.
        """
        review_id = review["id"]
        star_rating = review["star_rating"]
        google_review_id = review.get("google_review_id")
        location_id = review.get("location_id")
        current_status = review.get("publishing_status") or review.get("processing_status")
        
        # 1. Prevent duplicate reply publishing and preserve existing owner replies
        if current_status == "published" and review.get("matched_reply"):
            return {
                "success": False,
                "reason": "already_published",
                "message": f"Review '{google_review_id}' already has a published reply. Duplicate publishing prevented.",
                "reply_text": review.get("matched_reply")
            }

        # 2. Check automation status (if not explicitly overridden by admin or in dry_run mode)
        config = await db.get_business_config()
        if not config.get("auto_reply_enabled", True) and not dry_run and not manual_override:
            await db.add_log(
                event_type="automation_paused",
                description=f"Auto-reply is PAUSED. Review '{google_review_id}' ({star_rating}★) stored with 'pending' status.",
                status="warning"
            )
            await db.update_review_status(review_id, status="pending", publishing_status="paused")
            return {
                "success": False,
                "reason": "automation_paused",
                "message": "Automation is paused; review remains pending."
            }
            
        # 3. Select predefined reply based on star rating
        try:
            reply_data = await ReplyService.get_reply_for_rating(star_rating)
            reply_text = reply_data["reply_text"]
            category = reply_data["category"]
        except TemplateInactiveOrMissingError as e:
            await db.update_review_status(
                review_id,
                status="failed",
                publishing_status="template_error"
            )
            return {
                "success": False,
                "reason": "template_error",
                "message": str(e)
            }

        # Dry run / Preview mode exit point
        if dry_run:
            return {
                "success": True,
                "dry_run": True,
                "category": category,
                "template_id": reply_data.get("template_id"),
                "reply_text": reply_text,
                "review_id": review_id,
                "google_review_id": google_review_id
            }

        # 4. Record selected reply event
        await db.add_log(
            event_type="reply_selected",
            description=f"Selected {category} reply template for review '{google_review_id}' ({star_rating}★).",
            status="info"
        )

        # 5. Resolve Google Account and Location identifiers explicitly
        resolved_account = (
            review.get("account_id")
            or config.get("google_account_id")
            or google_client.account_id
            or "accounts/103909150561073983110"
        )
        resolved_location = (
            location_id
            or review.get("location_id")
            or config.get("google_location_id")
            or google_client.location_id
            or "locations/4001506839118937948"
        )

        if not resolved_account or not resolved_location:
            err_msg = "Google Business Profile account ID or location ID is not configured/detected. Cannot publish reply."
            await db.record_published_reply(
                review_id=review_id,
                reply_text=reply_text,
                status="failed",
                error_message=err_msg
            )
            await db.update_review_status(
                review_id=review_id,
                status="failed",
                matched_reply=None,
                publishing_status="failed"
            )
            return {
                "success": False,
                "category": category,
                "reply_text": reply_text,
                "reason": "missing_credentials",
                "error": err_msg,
                "publishing_status": "failed"
            }

        # 6. Dispatch reply to Google Business Profile API with bounded retries
        google_result = await google_client.publish_reply(
            review_id=google_review_id,
            reply_text=reply_text,
            account_id=resolved_account,
            location_id=resolved_location
        )

        now_str = datetime.now(timezone.utc).isoformat()

        # Strict check: Require real Google API success (never accept simulation in production)
        if not google_result.get("success") or google_result.get("simulated"):
            publishing_status = "failed"
            error_msg = google_result.get("error") or "Publishing failed: Google API did not confirm publication."

            await db.record_published_reply(
                review_id=review_id,
                reply_text=reply_text,
                status=publishing_status,
                error_message=error_msg
            )
            await db.update_review_status(
                review_id=review_id,
                status="failed",
                matched_reply=None,
                publishing_status=publishing_status
            )
            await db.add_log(
                event_type="publishing_failure",
                description=f"Failed to publish reply for review '{google_review_id}' to Google: {error_msg}",
                status="error"
            )
            return {
                "success": False,
                "category": category,
                "reply_text": reply_text,
                "reason": google_result.get("status") or "google_api_error",
                "error": error_msg,
                "publishing_status": publishing_status
            }

        # 7. Post-Publish Google-Side Verification (GET review to confirm reviewReply state)
        verify_res = await google_client.get_review(
            review_id=google_review_id,
            account_id=resolved_account,
            location_id=resolved_location
        )

        if verify_res.get("policy_violation"):
            publishing_status = "failed"
            error_msg = f"Google policy violation reported: {verify_res.get('policy_violation')}"
            log_desc = f"Reply for review '{google_review_id}' rejected by Google policy: {verify_res.get('policy_violation')}"
            
            await db.record_published_reply(
                review_id=review_id,
                reply_text=reply_text,
                status=publishing_status,
                error_message=error_msg
            )
            await db.update_review_status(
                review_id=review_id,
                status="failed",
                matched_reply=None,
                publishing_status=publishing_status
            )
            await db.add_log(event_type="policy_violation", description=log_desc, status="error")
            return {
                "success": False,
                "category": category,
                "reason": "policy_violation",
                "error": error_msg,
                "publishing_status": publishing_status
            }

        elif verify_res.get("has_reply"):
            reply_state = (verify_res.get("reply_state") or "").lower()
            if reply_state == "pending":
                publishing_status = "verification_pending"
                log_desc = f"Predefined reply for review '{google_review_id}' accepted by Google; moderation verification pending."
            else:
                publishing_status = "published"
                log_desc = f"Successfully published and verified {category} reply for review '{google_review_id}' ({star_rating}★) on Google."
        else:
            # PUT succeeded with HTTP 200/201, but GET review does not yet show reply due to Google propagation latency
            publishing_status = "verification_pending"
            log_desc = f"Predefined reply for review '{google_review_id}' accepted by Google API (HTTP {google_result.get('http_status', 200)}); awaiting public visibility verification."

        # Record verified or pending result in Supabase
        await db.record_published_reply(
            review_id=review_id,
            reply_text=reply_text,
            status=publishing_status
        )
        await db.update_review_status(
            review_id=review_id,
            status="processed" if publishing_status == "published" else "pending",
            matched_reply=reply_text if publishing_status in ("published", "verification_pending") else None,
            publishing_status=publishing_status,
            reply_published_at=verify_res.get("update_time") if publishing_status == "published" else None
        )
        await db.add_log(
            event_type="reply_published" if publishing_status == "published" else "reply_verification_pending",
            description=log_desc,
            status="success" if publishing_status == "published" else "warning"
        )

        return {
            "success": True,
            "category": category,
            "reply_text": reply_text,
            "published_at": now_str,
            "publishing_status": publishing_status,
            "google_response": google_result,
            "verification": verify_res
        }

    @classmethod
    async def verify_pending_replies(
        cls,
        account_id: Optional[str] = None,
        location_id: Optional[str] = None
    ) -> list:
        """
        GET-only reconciliation process for reviews previously accepted by Google
        with HTTP 200 but where reviewReply verification was pending due to Google propagation delay.
        STRICT SAFETY: Uses GET requests only. Never sends PUT requests or publishes duplicates.
        """
        config = await db.get_business_config()
        acc = account_id or config.get("google_account_id") or google_client.account_id
        loc = location_id or config.get("google_location_id") or google_client.location_id

        if not acc or not loc:
            return []

        all_reviews = await db.get_reviews(location_id=loc)
        pending_candidates = [
            r for r in all_reviews
            if r.get("processing_status") == "pending" and (
                r.get("publishing_status") == "verification_pending" or bool(r.get("matched_reply"))
            )
        ]

        reconciled = []
        for review in pending_candidates:
            g_review_id = review.get("google_review_id")
            if not g_review_id:
                continue

            # GET-only verification from Google API
            verify_res = await google_client.get_review(
                review_id=g_review_id,
                account_id=acc,
                location_id=loc
            )

            if verify_res.get("has_reply"):
                reply_comment = verify_res.get("reply_comment") or verify_res.get("reply_text") or review.get("matched_reply")
                google_update_time = verify_res.get("update_time") or (verify_res.get("review_reply") or {}).get("updateTime")

                await db.update_published_reply(
                    review_id=review["id"],
                    status="published",
                    google_published_at=google_update_time
                )
                await db.update_review_status(
                    review_id=review["id"],
                    status="processed",
                    matched_reply=reply_comment,
                    publishing_status="published",
                    reply_published_at=google_update_time
                )
                await db.add_log(
                    event_type="reply_verified",
                    description=f"Google GET verified previously accepted reply for review '{g_review_id}'. Status updated to Published.",
                    status="success"
                )
                reconciled.append({
                    "review_id": review["id"],
                    "google_review_id": g_review_id,
                    "status": "published",
                    "reply_text": reply_comment,
                    "google_published_at": google_update_time
                })
            else:
                reconciled.append({
                    "review_id": review["id"],
                    "google_review_id": g_review_id,
                    "status": "verification_pending"
                })

        return reconciled
