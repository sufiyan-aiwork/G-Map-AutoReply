"""
Dashboard Summary and Analytics API.
"""

from datetime import date, datetime, timedelta, timezone, tzinfo
import re
from typing import Dict, Any, List, Optional, Tuple
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from fastapi import APIRouter, Depends, HTTPException, Query, status
from ..config import settings
from ..integrations.supabase_client import db
from .admin_auth import require_admin

router = APIRouter(
    prefix="/api/dashboard",
    tags=["Dashboard"],
    dependencies=[Depends(require_admin)],
)

ALLOWED_SUMMARY_DAYS = {7, 14, 21, 30}
_OFFSET_PATTERN = re.compile(r"^(?:UTC)?([+-])(\d{2}):?(\d{2})$", re.IGNORECASE)
_FIXED_TIMEZONE_OFFSETS: Dict[str, timedelta] = {
    "ASIA/KOLKATA": timedelta(hours=5, minutes=30),
    "ASIA/CALCUTTA": timedelta(hours=5, minutes=30),
    "IST": timedelta(hours=5, minutes=30),
    "UTC": timedelta(0),
    "ETC/UTC": timedelta(0),
    "Z": timedelta(0),
}


def resolve_configured_timezone(tz_name: Optional[str] = None) -> Tuple[tzinfo, str]:
    """Resolves configured IANA/offset timezone safely even if OS tzdata package is absent."""
    candidate = (tz_name or settings.TIMEZONE or "Asia/Kolkata").strip()
    try:
        return ZoneInfo(candidate), candidate
    except (ZoneInfoNotFoundError, KeyError, ValueError):
        pass

    upper = candidate.upper()
    if upper in _FIXED_TIMEZONE_OFFSETS:
        return timezone(_FIXED_TIMEZONE_OFFSETS[upper], candidate), candidate

    match = _OFFSET_PATTERN.match(candidate)
    if match:
        sign = 1 if match.group(1) == "+" else -1
        delta = sign * timedelta(hours=int(match.group(2)), minutes=int(match.group(3)))
        return timezone(delta, candidate), candidate

    local_tz = datetime.now().astimezone().tzinfo or timezone.utc
    return local_tz, getattr(local_tz, "tzname", lambda _: "UTC")(None) or "UTC"


def _parse_review_created_at(value: Any) -> Optional[datetime]:
    """Parses review_created_at into a timezone-aware UTC datetime, or None if invalid."""
    if not value:
        return None
    if isinstance(value, datetime):
        dt = value
    elif isinstance(value, str):
        raw = value.strip()
        if not raw:
            return None
        if raw.endswith("Z"):
            raw = raw[:-1] + "+00:00"
        try:
            dt = datetime.fromisoformat(raw)
        except ValueError:
            return None
    else:
        return None

    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def filter_reviews_by_calendar_days(
    reviews: List[Dict[str, Any]],
    days: int,
    tz: tzinfo,
    now_dt: Optional[datetime] = None,
) -> Tuple[List[Dict[str, Any]], date, date]:
    """Filters reviews strictly by review_created_at over the last `days` calendar days including today."""
    current = now_dt.astimezone(tz) if now_dt else datetime.now(tz)
    today_date = current.date()
    start_date = today_date - timedelta(days=days - 1)

    filtered: List[Dict[str, Any]] = []
    for review in reviews:
        parsed_dt = _parse_review_created_at(review.get("review_created_at"))
        if parsed_dt is None:
            continue
        review_date = parsed_dt.astimezone(tz).date()
        if start_date <= review_date <= today_date:
            filtered.append(review)

    return filtered, start_date, today_date


@router.get("/summary")
async def get_dashboard_summary(
    days: Optional[int] = Query(
        None,
        description="Optional calendar-day lookback window including today (7, 14, 21, or 30).",
    )
) -> Dict[str, Any]:
    if days is not None and days not in ALLOWED_SUMMARY_DAYS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid days parameter. Allowed values are 7, 14, 21, or 30.",
        )

    config = await db.get_business_config()
    active_location = config.get("google_location_id")

    from ..integrations.google_business import google_client
    is_live = google_client.has_credentials

    reviews = await db.get_reviews(
        location_id=active_location if (is_live and active_location) else None,
        genuine_only=is_live
    )

    tz, tz_name = resolve_configured_timezone()
    period_start_date: Optional[date] = None
    period_end_date: Optional[date] = None
    if days is not None:
        reviews, period_start_date, period_end_date = filter_reviews_by_calendar_days(reviews, days, tz)

    total_reviews = len(reviews)
    positive_reviews = [r for r in reviews if r.get("star_rating") in (3, 4, 5)]
    negative_reviews = [r for r in reviews if r.get("star_rating") in (1, 2)]

    published_replies = [r for r in reviews if r.get("publishing_status") == "published"]
    failed_replies = [r for r in reviews if r.get("publishing_status") in ("failed", "template_error")]
    pending_replies = [
        r
        for r in reviews
        if (r.get("publishing_status") or r.get("processing_status") or "").lower()
        in ("pending", "verification_pending")
    ]

    avg_rating = round(sum(r.get("star_rating", 0) for r in reviews) / total_reviews, 2) if total_reviews > 0 else 0.0

    rating_distribution = {
        5: len([r for r in reviews if r.get("star_rating") == 5]),
        4: len([r for r in reviews if r.get("star_rating") == 4]),
        3: len([r for r in reviews if r.get("star_rating") == 3]),
        2: len([r for r in reviews if r.get("star_rating") == 2]),
        1: len([r for r in reviews if r.get("star_rating") == 1]),
    }

    return {
        "business_name": config.get("business_name", "Techzone Academy"),
        "total_reviews": total_reviews,
        "positive_reviews_count": len(positive_reviews),
        "negative_reviews_count": len(negative_reviews),
        "total_published_replies": len(published_replies),
        "failed_publishing_attempts": len(failed_replies),
        "pending_reviews_count": len(pending_replies),
        "average_star_rating": avg_rating,
        "star_rating_distribution": rating_distribution,
        "auto_reply_enabled": config.get("auto_reply_enabled", True),
        "polling_interval": config.get("polling_interval", 15),
        "period_days": days,
        "timezone": tz_name,
        "period_start_date": period_start_date.isoformat() if period_start_date else None,
        "period_end_date": period_end_date.isoformat() if period_end_date else None,
    }
