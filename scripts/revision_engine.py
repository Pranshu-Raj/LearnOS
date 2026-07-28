from datetime import datetime, timedelta, date
from typing import Dict, Any

# Standard Spaced Repetition Interval Sequence (in days)
INTERVAL_SEQUENCE = [1, 3, 7, 16, 35]

def calculate_next_review(current_count: int = 0, rating: str = 'solid', base_date: date = None) -> Dict[str, Any]:
    """
    Calculates spaced repetition metrics for a topic review session.
    
    Args:
        current_count (int): Current number of completed reviews.
        rating (str): User rating - 'solid' (progress sequence) or 'shaky' (reset to day 1).
        base_date (date): Starting date for calculation (defaults to today).
        
    Returns:
        Dict containing updated last_reviewed, next_review_due, review_count, interval_days, ease_rating.
    """
    if base_date is None:
        base_date = date.today()
        
    rating_lower = rating.lower()
    
    if rating_lower == 'solid':
        next_count = current_count + 1
        if next_count <= len(INTERVAL_SEQUENCE):
            interval_days = INTERVAL_SEQUENCE[next_count - 1]
        else:
            # Beyond sequence, double the max interval (35, 70, 140...)
            multiplier = 2 ** (next_count - len(INTERVAL_SEQUENCE))
            interval_days = INTERVAL_SEQUENCE[-1] * multiplier
    else:  # 'shaky'
        next_count = 1
        interval_days = 1

    next_review_due = base_date + timedelta(days=interval_days)

    return {
        "last_reviewed": base_date.isoformat(),
        "next_review_due": next_review_due.isoformat(),
        "review_count": next_count,
        "interval_days": interval_days,
        "ease_rating": rating_lower
    }
