"""
Reply Service for Techzone Academy.
Handles selection of predefined reply templates and validation.
Strictly relies on star rating classification (positive vs negative).
"""

from typing import Dict, Any, Optional
from .rating_service import classify_rating
from ..integrations.supabase_client import db

class TemplateInactiveOrMissingError(Exception):
    """Raised when a required reply template is missing or deactivated."""
    pass

class ReplyService:
    @staticmethod
    async def get_reply_for_rating(star_rating: int) -> Dict[str, Any]:
        """
        Selects the predefined reply template for a given star rating.
        
        Rules:
        - 3, 4, 5 stars -> positive template
        - 1, 2 stars -> negative template
        
        Raises TemplateInactiveOrMissingError if the template is not found or is inactive.
        """
        category = classify_rating(star_rating)
        template = await db.get_template_by_category(category)
        
        if not template:
            await db.add_log(
                event_type="template_missing",
                description=f"CRITICAL: No template found for category '{category}' (stars={star_rating}). Reply skipped.",
                status="error"
            )
            raise TemplateInactiveOrMissingError(f"Reply template for category '{category}' is missing from the database.")
            
        if not template.get("is_active", True):
            await db.add_log(
                event_type="template_inactive",
                description=f"WARNING: Template for category '{category}' is inactive. Reply publication blocked.",
                status="warning"
            )
            raise TemplateInactiveOrMissingError(f"Reply template for category '{category}' is currently disabled/inactive.")

        return {
            "category": category,
            "template_id": template.get("id"),
            "reply_text": template["reply_text"],
            "applicable_ratings": template.get("applicable_ratings", [])
        }

    @staticmethod
    async def get_all_templates():
        return await db.get_templates()

    @staticmethod
    async def update_template(category: str, reply_text: Optional[str] = None, is_active: Optional[bool] = None):
        if category not in ("positive", "negative"):
            raise ValueError(f"Invalid category '{category}'. Must be 'positive' or 'negative'.")
            
        updated = await db.update_template(category=category, reply_text=reply_text, is_active=is_active)
        if updated:
            action_desc = []
            if reply_text:
                action_desc.append("text updated")
            if is_active is not None:
                action_desc.append(f"status set to {'active' if is_active else 'inactive'}")
            await db.add_log(
                event_type="template_updated",
                description=f"Reply template '{category}' was modified: {', '.join(action_desc)}.",
                status="info"
            )
        return updated
