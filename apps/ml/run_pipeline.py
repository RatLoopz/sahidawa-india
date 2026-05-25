# ⚠️  MIGRATED — do not add code here.
#
# The pipeline runner has been moved to the unified ETL workspace:
#   apps/etl/run_all.py
#
# To run the full pipeline:
#   cd apps/etl && python run_all.py
#
# Supported flags:
#   --skip-scrape    Use the most recent existing raw CSV
#   --scrape-only    Scrape only, skip validate + load
#   --retry-failed   Retry rows from etl_failed_rows table
#   --refresh-cdsco  Force re-download of CDSCO reference data

import sys

if __name__ == "__main__":
    print(
        "\n⚠️  run_pipeline.py has moved.\n"
        "Run the unified pipeline instead:\n\n"
        "    cd apps/etl\n"
        "    python run_all.py\n"
    )
    sys.exit(1)
