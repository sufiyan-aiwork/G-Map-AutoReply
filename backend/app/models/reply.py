from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from enum import Enum

class ReplyCategory(str, Enum):
    POSITIVE = "positive"
    NEGATIVE = "negative"

class ReplyTemplateBase(BaseModel):
    category: ReplyCategory
    reply_text: str = Field(..., min_length=5, description="Predefined template text")
    applicable_ratings: List[int] = Field(..., description="List of star ratings this template applies to")
    is_active: bool = Field(True, description="Whether this template is enabled for auto-publishing")

class ReplyTemplateUpdate(BaseModel):
    reply_text: Optional[str] = Field(None, min_length=5)
    is_active: Optional[bool] = None

class ReplyTemplateResponse(ReplyTemplateBase):
    id: str
    created_at: datetime
    updated_at: datetime

class PublishedReplyResponse(BaseModel):
    id: str
    review_id: str
    reply_text: str
    publishing_status: str
    google_published_at: Optional[datetime] = None
    error_message: Optional[str] = None
    created_at: datetime
