from typing import List
from pydantic import BaseModel
from thefuzz import process

# Explicitly create the MatchResult model demanded by the criteria
class MatchResult(BaseModel):
    name: str
    score: int

def find_matches(query: str, medicines: List[str]) -> List[MatchResult]:
    """
    Compares an OCR query string against a list of valid medicine names.
    Returns the top 3 closest matches with their similarity scores (0-100).
    """
    if not query or not medicines:
        return []

    # Extract top 3 matches using Levenshtein distance
    results = process.extract(query, medicines, limit=3)
    
    # Return instances of MatchResult instead of raw dictionaries
    return [MatchResult(name=name, score=score) for name, score, *_ in results]