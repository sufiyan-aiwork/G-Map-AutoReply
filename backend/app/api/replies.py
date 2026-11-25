"""
Predefined Reply Templates API.
Provides endpoints to view, update, and toggle the two fixed reply templates.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from ..models.reply import ReplyTemplateResponse, ReplyTemplateUpdate
from ..services.reply_service import ReplyService
from .admin_auth import require_admin

router = APIRouter(
    prefix="/api/replies",
    tags=["Reply Templates"],
    dependencies=[Depends(require_admin)],
)

@router.get("/templates", response_model=List[ReplyTemplateResponse])
async def get_templates():
    """Returns both positive and negative reply templates."""
    return await ReplyService.get_all_templates()

@router.put("/templates/{category}", response_model=ReplyTemplateResponse)
async def update_template(category: str, update_data: ReplyTemplateUpdate):
    """
    Updates the predefined reply template for 'positive' or 'negative' reviews.
    Allows editing reply text and toggling active status.
    """
    category_lower = category.lower()
    if category_lower not in ("positive", "negative"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Category must be either 'positive' or 'negative'."
        )
        
    updated = await ReplyService.update_template(
        category=category_lower,
        reply_text=update_data.reply_text,
        is_active=update_data.is_active
    )
    
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template for category '{category}' not found."
        )
        
    return updated
