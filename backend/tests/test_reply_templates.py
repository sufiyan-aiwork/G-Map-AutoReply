"""
Unit tests for Reply Templates and Selection Logic.
Techzone Academy.
"""

import pytest
from app.services.reply_service import ReplyService, TemplateInactiveOrMissingError
from app.integrations.supabase_client import db

@pytest.mark.asyncio
async def test_exactly_two_reply_templates_exist():
    templates = await ReplyService.get_all_templates()
    categories = [t["category"] for t in templates]
    assert len(templates) == 2
    assert "positive" in categories
    assert "negative" in categories

@pytest.mark.asyncio
async def test_positive_reply_selection_for_3_4_5_stars():
    for stars in [3, 4, 5]:
        reply = await ReplyService.get_reply_for_rating(stars)
        assert reply["category"] == "positive"
        assert "Techzone Academy" in reply["reply_text"]
        assert 3 in reply["applicable_ratings"]
        assert 4 in reply["applicable_ratings"]
        assert 5 in reply["applicable_ratings"]

@pytest.mark.asyncio
async def test_negative_reply_selection_for_1_2_stars():
    for stars in [1, 2]:
        reply = await ReplyService.get_reply_for_rating(stars)
        assert reply["category"] == "negative"
        assert "apologise" in reply["reply_text"].lower()
        assert 1 in reply["applicable_ratings"]
        assert 2 in reply["applicable_ratings"]

@pytest.mark.asyncio
async def test_inactive_template_blocks_publishing():
    # Deactivate positive template
    await ReplyService.update_template("positive", is_active=False)
    
    with pytest.raises(TemplateInactiveOrMissingError):
        await ReplyService.get_reply_for_rating(5)
        
    # Reactivate positive template
    await ReplyService.update_template("positive", is_active=True)
    reply = await ReplyService.get_reply_for_rating(5)
    assert reply["category"] == "positive"

@pytest.mark.asyncio
async def test_update_template_text():
    new_text = "Updated positive reply text for Techzone Academy students."
    await ReplyService.update_template("positive", reply_text=new_text)
    
    reply = await ReplyService.get_reply_for_rating(5)
    assert reply["reply_text"] == new_text
    
    # Restore standard initial text
    initial_positive = "Thank you for sharing your valuable feedback with Techzone Academy! We are happy to have you as part of our learning community. We truly appreciate your support!"
    await ReplyService.update_template("positive", reply_text=initial_positive)
