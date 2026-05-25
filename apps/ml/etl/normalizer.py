# ⚠️  MIGRATED — do not add code here.
#
# The normalizer has been moved to the unified ETL workspace:
#   apps/etl/src/scrapers/jan_aushadhi.py  (JanAushadhiNormalizer)
#
# This stub re-exports the class so any remaining internal imports
# inside apps/ml/ continue to work during the transition period.

from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "apps" / "etl"))

from src.scrapers.jan_aushadhi import JanAushadhiNormalizer  # noqa: F401


def normalize_latest():
    raise RuntimeError(
        "normalize_latest() has moved to apps/etl. "
        "Run: cd apps/etl && python run_all.py --skip-scrape"
    )
