from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum

class ProcessingStatus(str, Enum):
    PENDING = "pending"
    PROCESSED = "processed"
    FAILED = "failed"
    IGNORED = "ignored"

class ReviewBase(BaseModel):
    google_review_id: str = Field(..., description="Unique Google review identifier")
    location_id: str = Field(..., description="Google Business Profile location ID")
    star_rating: int = Field(..., ge=1, le=5, description="Star rating between 1 and 5")
    review_text: Optional[str] = Field(None, description="Customer review text content")
    reviewer_name: Optional[str] = Field("Valued Customer", description="Reviewer display name")
    review_created_at: Optional[datetime] = Field(default_factory=datetime.utcnow)

class ReviewCreate(ReviewBase):
    pass

class ReviewResponse(ReviewBase):
    id: str
    processing_status: ProcessingStatus
    created_at: datetime
    updated_at: datetime
    matched_reply: Optional[str] = None
    publishing_status: Optional[str] = None
    reply_published_at: Optional[datetime] = None

class ReviewListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    reviews: List[ReviewResponse]

class SimulateReviewRequest(BaseModel):
    star_rating: int = Field(..., ge=1, le=5, description="Star rating 1-5")
    review_text: Optional[str] = "Simulated review for Techzone Academy"
    reviewer_name: Optional[str] = "Test Student"
    auto_publish: Optional[bool] = True
