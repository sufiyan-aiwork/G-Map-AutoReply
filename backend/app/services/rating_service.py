"""
Rating Classification Service for Techzone Academy Customer Reviews.

Strict Deterministic Classification Rules:
- 5 stars -> Positive Reply
- 4 stars -> Positive Reply
- 3 stars -> Positive Reply
- 2 stars -> Negative Reply
- 1 star  -> Negative Reply

No dynamic LLM, no AI sentiment analysis. Strictly star-based.
"""

from typing import Literal

POSITIVE_RATINGS = {3, 4, 5}
NEGATIVE_RATINGS = {1, 2}

def classify_rating(stars: int) -> Literal["positive", "negative"]:
    """
    Classifies a customer star rating into either 'positive' or 'negative'.
    
    Args:
        stars: Integer star rating from 1 to 5
        
    Returns:
        "positive" if stars in {3, 4, 5}
        "negative" if stars in {1, 2}
        
    Raises:
        ValueError: If rating is outside 1..5
    """
    if not isinstance(stars, int) or isinstance(stars, bool):
        try:
            stars = int(stars)
        except (ValueError, TypeError):
            raise ValueError(f"Invalid star rating type: {type(stars)}. Expected integer between 1 and 5.")

    if stars in POSITIVE_RATINGS:
        return "positive"
    elif stars in NEGATIVE_RATINGS:
        return "negative"
    else:
        raise ValueError(f"Invalid star rating: {stars}. Rating must be an integer between 1 and 5.")
