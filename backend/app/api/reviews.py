"""
Customer Reviews Management and Ingestion API.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import Optional, List
import uuid
from ..models.review import ReviewResponse, SimulateReviewRequest
from ..services.review_service import ReviewService, DuplicateReviewError
from .admin_auth import require_admin

router = APIRouter(
    prefix="/api/reviews",
    tags=["Reviews"],
    dependencies=[Depends(require_admin)],
)

@router.get("", response_model=List[ReviewResponse])
async def list_reviews(
    rating: Optional[int] = Query(None, ge=1, le=5, description="Filter by star rating"),
    status: Optional[str] = Query(None, description="Filter by processing status")
):
    from ..integrations.google_business import google_client
    from ..integrations.supabase_client import db
    config = await db.get_business_config()
    active_location = config.get("google_location_id") or "locations/4001506839118937948"
    is_live = google_client.has_credentials

    reviews = await ReviewService.get_reviews(
        rating=rating,
        status=status,
        location_id=active_location if is_live else None,
        genuine_only=is_live
    )
    return reviews

@router.get("/{review_id}", response_model=ReviewResponse)
async def get_review(review_id: str):
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
    from ..services.publishing_service import PublishingService
    try:
        preview = await PublishingService.preview_reply_for_review(review_id)
        return preview
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.post("/{review_id}/publish-reply")
async def publish_single_review_reply(review_id: str):
    """
    Controlled Live Test & Single Review Publishing Endpoint:
    Allows an administrator to explicitly publish the predefined reply for ONE specific review.
    Enforces duplicate prevention and preserves existing Google replies.
    """
    from ..services.publishing_service import PublishingService
    review = await ReviewService.get_review_by_id(review_id)
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Review with ID '{review_id}' not found."
        )

    current_status = review.get("publishing_status") or review.get("processing_status")
    if current_status == "published" and review.get("matched_reply"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Review '{review.get('google_review_id')}' already has a published reply. Duplicate publishing prevented."
        )

    try:
        result = await PublishingService.publish_reply_for_review(review, manual_override=True)
        if not result.get("success"):
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
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.post("/test-simulate", status_code=status.HTTP_201_CREATED)
async def simulate_review(req: SimulateReviewRequest):
    """
    Simulates receiving a new review from Google Business Profile.
    Tests rating classification, Supabase storage, and automated reply publishing.
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
            auto_publish=req.auto_publish
        )
        return {
            "message": "Review ingested and processed successfully.",
            "review": result["review"],
            "publish_result": result["publish_result"]
        }
    except DuplicateReviewError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

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
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

