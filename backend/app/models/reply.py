from pydantic import BaseModel, Field, field_validator
from typing import List, Optional
from datetime import datetime
from enum import Enum

class ReplyCategory(str, Enum):
    POSITIVE = "positive"
    NEGATIVE = "negative"

class ReplyTemplateBase(BaseModel):
    category: ReplyCategory
    reply_text: str = Field(..., min_length=5, max_length=4096, description="Predefined template text (max 4096 chars per GBP API limit)")
    applicable_ratings: List[int] = Field(..., description="List of star ratings this template applies to")
    is_active: bool = Field(True, description="Whether this template is enabled for auto-publishing")

class ReplyTemplateUpdate(BaseModel):
    reply_text: Optional[str] = Field(None, min_length=5, max_length=4096)
    is_active: Optional[bool] = None

    @field_validator("reply_text")
    @classmethod
    def validate_reply_text_not_blank(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            stripped = v.strip()
            if len(stripped) < 5:
                raise ValueError("Reply template text must contain at least 5 non-whitespace characters.")
            return stripped
        return v

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
