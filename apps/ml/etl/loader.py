# ⚠️  MIGRATED — do not add code here.
#
# The loader has been moved to the unified ETL workspace:
#   apps/etl/src/loaders/supabase_loader.py  (SupabaseLoader)
#
# This stub re-exports the class so any remaining internal imports
# inside apps/ml/ continue to work during the transition period.

from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "apps" / "etl"))

from src.loaders.supabase_loader import SupabaseLoader  # noqa: F401


def load_processed_csv(csv_path=None):
    raise RuntimeError(
        "load_processed_csv() has moved to apps/etl. "
        "Run: cd apps/etl && python run_all.py --skip-scrape"
    )
