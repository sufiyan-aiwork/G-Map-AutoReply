"""
Customer Reviews Management and Ingestion API.
"""

import re
import uuid
import logging
from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import Optional, List
from ..models.review import ReviewResponse, SimulateReviewRequest
from ..services.review_service import ReviewService, DuplicateReviewError
from .admin_auth import require_admin

logger = logging.getLogger("reviews_api")

router = APIRouter(
    prefix="/api/reviews",
    tags=["Reviews"],
    dependencies=[Depends(require_admin)],
)

_SAFE_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,128}$")
_ALLOWED_STATUSES = {"pending", "processed", "failed", "ignored"}


def _validate_review_id(review_id: str) -> str:
    if not review_id or not _SAFE_ID_PATTERN.match(review_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid review identifier format.",
        )
    return review_id


@router.get("", response_model=List[ReviewResponse])
async def list_reviews(
    rating: Optional[int] = Query(None, ge=1, le=5, description="Filter by star rating"),
    status_filter: Optional[str] = Query(None, alias="status", max_length=40, description="Filter by processing status")
):
    if status_filter is not None and status_filter.lower() not in _ALLOWED_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid status filter value.",
        )

    from ..integrations.google_business import google_client
    from ..integrations.supabase_client import db
    config = await db.get_business_config()
    active_location = config.get("google_location_id")
    is_live = google_client.has_credentials

    reviews = await ReviewService.get_reviews(
        rating=rating,
        status=status_filter.lower() if status_filter else None,
        location_id=active_location if (is_live and active_location) else None,
        genuine_only=is_live
    )
    return reviews

@router.get("/{review_id}", response_model=ReviewResponse)
async def get_review(review_id: str):
    _validate_review_id(review_id)
    review = await ReviewService.get_review_by_id(review_id)
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Review with id '{review_id}' not found."
        )
    return review

@router.get("/{review_id}/preview-reply")
async def preview_review_reply(review_id: str):
    """
    Controlled Preview Endpoint:
    Returns the exact predefined reply template that matches the review's star rating
    without publishing anything to Google Business Profile.
    """
    _validate_review_id(review_id)
    from ..services.publishing_service import PublishingService
    try:
        preview = await PublishingService.preview_reply_for_review(review_id)
        return preview
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Preview reply error for {review_id}: {type(e).__name__}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to preview predefined reply.")

@router.post("/{review_id}/publish-reply")
async def publish_single_review_reply(review_id: str):
    """
    Controlled Live Test & Single Review Publishing Endpoint:
    Allows an administrator to explicitly publish the predefined reply for ONE specific review.
    Enforces duplicate prevention (published & verification_pending) and preserves existing Google replies.
    """
    _validate_review_id(review_id)
    from ..services.publishing_service import PublishingService
    review = await ReviewService.get_review_by_id(review_id)
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Review with ID '{review_id}' not found."
        )

    current_status = (review.get("publishing_status") or review.get("processing_status") or "").lower()
    if current_status in ("published", "verification_pending") or bool(review.get("matched_reply")):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Review '{review.get('google_review_id')}' already has a published or pending-verification reply. Duplicate publishing prevented."
        )

    try:
        result = await PublishingService.publish_reply_for_review(review, manual_override=True)
        if not result.get("success"):
            if result.get("reason") in ("already_published", "verification_pending", "already_replied_on_google"):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=result.get("message") or "Review already has an existing reply. Duplicate publishing prevented.",
                )
            return {
                "message": result.get("error") or result.get("message", "Publishing failed."),
                "success": False,
                "result": result
            }

        pub_status = result.get("publishing_status", "published")
        if pub_status == "published":
            msg = "Predefined reply published and verified on Google Business Profile."
        elif pub_status == "verification_pending":
            msg = "Predefined reply submitted to Google Business Profile; verification pending."
        else:
            msg = "Predefined reply processed."

        return {
            "message": msg,
            "success": True,
            "result": result
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Publish single reply error for {review_id}: {type(e).__name__}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to publish reply to Google Business Profile.")

@router.post("/test-simulate", status_code=status.HTTP_201_CREATED)
async def simulate_review(req: SimulateReviewRequest):
    """
    Simulates receiving a new review from Google Business Profile in sandbox/dry-run mode.
    NEVER dispatches real replies to Google Business Profile API.
    """
    simulated_id = f"sim_rev_{uuid.uuid4().hex[:8]}"
    location_id = "locations/techzone_main_campus"
    
    try:
        result = await ReviewService.process_new_review(
            location_id=location_id,
            google_review_id=simulated_id,
            star_rating=req.star_rating,
            review_text=req.review_text,
            reviewer_name=req.reviewer_name,
            auto_publish=bool(req.auto_publish),
            simulator_only=True,
        )
        return {
            "message": "Review ingested and simulated safely in dry-run mode.",
            "review": result["review"],
            "publish_result": result["publish_result"]
        }
    except DuplicateReviewError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e:
        logger.error(f"Simulate review error: {type(e).__name__}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to simulate review.")

@router.post("/sync-now")
async def trigger_manual_sync():
    """
    Manually triggers an immediate synchronization of reviews from Google Business Profile
    and publishes predefined replies according to star ratings.
    """
    try:
        summary = await ReviewService.sync_google_reviews()
        return {
            "message": "Google reviews synchronized successfully.",
            "summary": summary
        }
    except Exception as e:
        logger.error(f"Manual sync error: {type(e).__name__}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to synchronize Google reviews.")

