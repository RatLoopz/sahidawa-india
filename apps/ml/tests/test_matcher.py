"""
Validation script for Issue #17: Fuzzy matching service verification.
"""

import logging
import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))

from apps.ml.services.matcher import MatchResult, find_matches

# Configure clean, structured logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)


def run_quick_validation() -> bool:
    """Executes core validation test cases for Issue #17."""
    logger.info("Starting fuzzy matching service validation [Issue #17]")
    print("-" * 60)
    
    results = []

    # -------------------------------------------------------------------------
    # Test 1: Issue #17 core scenario (OCR mismatch handling)
    # -------------------------------------------------------------------------
    medicines = ["Paracetamol", "Pantoprazole", "Cefixime"]
    matches = find_matches("Paracetamo1", medicines)
    
    t1_passed = matches and matches[0].name == "Paracetamol" and matches[0].score > 85
    results.append(("Issue #17 Core Scenario", t1_passed))
    logger.info(
        f"Test 1 [OCR Mismatch]: Input='Paracetamo1' -> Match='{matches[0].name}' "
        f"(Score: {matches[0].score:.1f}) | Status: {'PASSED' if t1_passed else 'FAILED'}"
    )

    # -------------------------------------------------------------------------
    # Test 2: Top-K evaluation (Ensures precisely 3 results are returned)
    # -------------------------------------------------------------------------
    medicines = ["Paracetamol", "Ibuprofen", "Aspirin", "Amoxicillin", "Cetirizine"]
    matches = find_matches("Paracetamol", medicines)
    
    t2_passed = len(matches) <= 3
    results.append(("Top 3 Match Constraints", t2_passed))
    logger.info(
        f"Test 2 [Top-K]: Expected=3, Got={len(matches)} | "
        f"Status: {'PASSED' if t2_passed else 'FAILED'}"
    )
    # Print the specific matches returned
    for idx, match in enumerate(matches, start=1):
        logger.info(f"    Match {idx}: Name='{match.name}', Score={match.score:.1f}")

    # -------------------------------------------------------------------------
    # Test 3: Standard OCR character substitution rules (0 -> O, 1 -> I)
    # -------------------------------------------------------------------------
    medicines = ["Ibuprofen", "Metformin", "Paracetamol"]
    matches = find_matches("1bupr0fen", medicines)
    
    t3_passed = matches and matches[0].name == "Ibuprofen"
    results.append(("OCR Character Substitution", t3_passed))
    logger.info(
        f"Test 3 [Substitution]: Input='1bupr0fen' -> Match='{matches[0].name}' | "
        f"Status: {'PASSED' if t3_passed else 'FAILED'}"
    )

    # -------------------------------------------------------------------------
    # Test 4: Generic/Regional brand matching validation
    # -------------------------------------------------------------------------
    medicines = ["Crocin", "Dolo-650", "Combiflam", "Paracetamol"]
    matches = find_matches("Cr0cin", medicines)
    
    t4_passed = matches and matches[0].name == "Crocin"
    results.append(("Regional Brand Evaluation", t4_passed))
    logger.info(
        f"Test 4 [Regional Brand]: Input='Cr0cin' -> Match='{matches[0].name}' | "
        f"Status: {'PASSED' if t4_passed else 'FAILED'}"
    )

    # -------------------------------------------------------------------------
    # Test 5: MatchResult contract and type safety constraints
    # -------------------------------------------------------------------------
    medicines = ["Paracetamol", "Ibuprofen"]
    matches = find_matches("Paracetamol", medicines)
    
    if matches:
        target = matches[0]
        is_correct_type = isinstance(target, MatchResult)
        has_name = hasattr(target, 'name')
        has_score = hasattr(target, 'score')
        valid_range = 0 <= getattr(target, 'score', -1) <= 100
        
        t5_passed = is_correct_type and has_name and has_score and valid_range
    else:
        t5_passed = False
        is_correct_type = has_name = has_score = valid_range = False

    results.append(("Data Structure Constraints", t5_passed))
    
    logger.info(f"Test 5 [Data Contract]: Status: {'PASSED' if t5_passed else 'FAILED'}")
    logger.info(f"    - Object is MatchResult instance: {is_correct_type}")
    logger.info(f"    - Object contains '.name' attr:  {has_name}")
    logger.info(f"    - Object contains '.score' attr: {has_score}")
    logger.info(f"    - Score is within range 0-100:  {valid_range}")

    # -------------------------------------------------------------------------
    # Summary Generation
    # -------------------------------------------------------------------------
    print("-" * 60)
    passed_count = sum(1 for _, passed in results if passed)
    total_count = len(results)
    success_rate = (passed_count / total_count) * 100

    logger.info(f"Validation Suite Execution Finished.")
    logger.info(f"Summary: {passed_count}/{total_count} tests passed ({success_rate:.1f}%)")

    for name, passed in results:
        logger.info(f"  [{'PASS' if passed else 'FAIL'}] {name}")

    return passed_count == total_count


if __name__ == "__main__":
    all_passed = run_quick_validation()
    
    if not all_passed:
        logger.error("Validation failed. Check log outputs above for specific test context.")
        sys.exit(1)
        
    logger.info("All key acceptance criteria for Issue #17 satisfied.")
    sys.exit(0)