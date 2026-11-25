"""
Dashboard Summary and Analytics API.
"""

from fastapi import APIRouter, Depends
from typing import Dict, Any
from ..integrations.supabase_client import db
from .admin_auth import require_admin

router = APIRouter(
    prefix="/api/dashboard",
    tags=["Dashboard"],
    dependencies=[Depends(require_admin)],
)

@router.get("/summary")
async def get_dashboard_summary() -> Dict[str, Any]:
    config = await db.get_business_config()
    active_location = config.get("google_location_id") or "locations/4001506839118937948"

    from ..integrations.google_business import google_client
    is_live = google_client.has_credentials

    reviews = await db.get_reviews(
        location_id=active_location if is_live else None,
        genuine_only=is_live
    )
    
    total_reviews = len(reviews)
    positive_reviews = [r for r in reviews if r.get("star_rating") in (3, 4, 5)]
    negative_reviews = [r for r in reviews if r.get("star_rating") in (1, 2)]
    
    published_replies = [r for r in reviews if r.get("publishing_status") == "published"]
    failed_replies = [r for r in reviews if r.get("publishing_status") in ("failed", "template_error")]
    
    avg_rating = round(sum(r.get("star_rating", 0) for r in reviews) / total_reviews, 2) if total_reviews > 0 else 0.0
    
    rating_distribution = {
        5: len([r for r in reviews if r.get("star_rating") == 5]),
        4: len([r for r in reviews if r.get("star_rating") == 4]),
        3: len([r for r in reviews if r.get("star_rating") == 3]),
        2: len([r for r in reviews if r.get("star_rating") == 2]),
        1: len([r for r in reviews if r.get("star_rating") == 1]),
    }
    
    config = await db.get_business_config()

    return {
        "business_name": config.get("business_name", "Techzone Academy"),
        "total_reviews": total_reviews,
        "positive_reviews_count": len(positive_reviews),
        "negative_reviews_count": len(negative_reviews),
        "total_published_replies": len(published_replies),
        "failed_publishing_attempts": len(failed_replies),
        "average_star_rating": avg_rating,
        "star_rating_distribution": rating_distribution,
        "auto_reply_enabled": config.get("auto_reply_enabled", True),
        "polling_interval": config.get("polling_interval", 15)
    }
