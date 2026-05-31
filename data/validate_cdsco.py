# ⚠️  MIGRATED — do not add code here.
#
# CDSCO validation has been split into two modules in the unified ETL workspace:
#
#   Fetcher   → apps/etl/src/scrapers/cdsco.py       (CDSCOScraper)
#   Validator → apps/etl/src/validators/cdsco_validator.py  (CDSCOValidator)
#
# To run the full pipeline (includes CDSCO validation):
#   cd apps/etl && python run_all.py
#
# To force a fresh CDSCO reference download:
#   cd apps/etl && python run_all.py --refresh-cdsco

raise ImportError(
    "data/validate_cdsco.py has been migrated to apps/etl/. "
    "See apps/etl/src/scrapers/cdsco.py and apps/etl/src/validators/cdsco_validator.py"
)
