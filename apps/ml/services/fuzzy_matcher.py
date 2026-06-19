from rapidfuzz import process, fuzz
from metaphone import doublemetaphone
import logging

logger = logging.getLogger(__name__)

def get_phonetic_fuzzy_match(query: str, medicine_db: list[str], edit_threshold: int = 80) -> dict | None:
    """
    Executes a two-stage matching pipeline: 
    Stage 1: Filter candidates using RapidFuzz edit distance.
    Stage 2: Confirm match using Double Metaphone phonetics.
    """
    if not query or not medicine_db:
        return None

    # Standardize input string
    query = query.strip().lower()
    
    # Stage 1: Filter using RapidFuzz WRatio
    # process.extract returns a list of tuples: (choice, score, index)
    matches = process.extract(query, medicine_db, scorer=fuzz.WRatio, limit=10)
    stage1_candidates = [m for m in matches if m[1] >= edit_threshold]
    
    # Compute Metaphone codes for ASR output
    query_codes = doublemetaphone(query)
    
    # Stage 2: Match phonetic codes among filtered candidates
    if stage1_candidates:
        for candidate, score, _ in stage1_candidates:
            cand_codes = doublemetaphone(candidate.lower())
            
            # Check intersections of primary or secondary phonetic codes
            if (query_codes[0] and query_codes[0] == cand_codes[0]) or \
               (query_codes[1] and query_codes[1] == cand_codes[0]) or \
               (query_codes[0] and query_codes[0] == cand_codes[1]):
                
                return {
                    "matched_name": candidate,
                    "score": score,
                    "is_corrected": candidate.lower() != query
                }
            
    # Fallback safety: If no candidates passed the initial threshold check,
    # or if phonetic match failed, check the absolute highest scoring item from raw matches.
    if matches:
        best_match, best_score, _ = matches[0]
        if best_score >= 95:
            return {
                "matched_name": best_match,
                "score": best_score,
                "is_corrected": best_match.lower() != query
            }

    return None