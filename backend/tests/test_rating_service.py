"""
Unit tests for Star Rating Classification Logic.
Techzone Academy Review Automation.
"""

import pytest
from app.services.rating_service import classify_rating

def test_five_star_is_positive():
    assert classify_rating(5) == "positive"

def test_four_star_is_positive():
    assert classify_rating(4) == "positive"

def test_three_star_is_positive():
    assert classify_rating(3) == "positive"

def test_two_star_is_negative():
    assert classify_rating(2) == "negative"

def test_one_star_is_negative():
    assert classify_rating(1) == "negative"

@pytest.mark.parametrize("invalid_rating", [0, 6, -1, 10, "five", None])
def test_invalid_star_rating_raises_value_error(invalid_rating):
    with pytest.raises(ValueError):
        classify_rating(invalid_rating)
