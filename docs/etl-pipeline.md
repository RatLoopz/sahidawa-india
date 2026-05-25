# ETL Pipeline — Architecture & Developer Guide

## Overview

The `apps/etl/` workspace is the single source of truth for all data ingestion in SahiDawa. It replaces the previously scattered ETL code in `apps/ml/etl/`, `apps/ml/scrapers/`, and `data/`.

## How the pipeline works

```
┌─────────────────────────────────────────────────────────────┐
│                     run_all.py                              │
│                                                             │
│  STEP 1  JanAushadhiScraper.scrape()                        │
│          └─ Playwright headless browser                     │
│          └─ Downloads CSV from janaushadhi.gov.in           │
│          └─ Saves to data/raw/janaushadhi/                  │
│                          │                                  │
│                          ▼  raw CSV path                    │
│  STEP 2  JanAushadhiNormalizer.normalize()                  │
│          └─ Standardises column names                       │
│          └─ Extracts strength, dosage_form, schedule        │
│          └─ Returns pd.DataFrame (10 columns)               │
│                          │                                  │
│                          ▼  pd.DataFrame                    │
│  STEP 2b CDSCOValidator.validate()          (in-memory)     │
│          └─ CDSCOScraper fetches reference CSV once         │
│          └─ Fuzzy-matches generic_name + manufacturer       │
│          └─ Appends is_cdsco_verified, cdsco_match_score    │
│                          │                                  │
│                          ▼  validated pd.DataFrame          │
│  STEP 3  SupabaseLoader.load()                              │
│          └─ Batched upserts (100 rows/batch)                │
│          └─ Conflict key: generic_name+strength+            │
│             dosage_form+source                              │
│          └─ Failed rows → etl_failed_rows table + CSV       │
└─────────────────────────────────────────────────────────────┘
```

### Data flow in detail

| Stage | Input | Output | Location |
|---|---|---|---|
| Scrape | URL | `data/raw/janaushadhi/janaushadhi_raw_<ts>.csv` | `src/scrapers/jan_aushadhi.py` |
| Normalize | raw CSV | `pd.DataFrame` (10 cols) | `src/scrapers/jan_aushadhi.py` |
| CDSCO fetch | CDSCO API | `data/seeds/cdsco_reference.csv` | `src/scrapers/cdsco.py` |
| Validate | DataFrame + reference CSV | DataFrame + 6 new columns | `src/validators/cdsco_validator.py` |
| Load | validated DataFrame | Supabase `medicines` table | `src/loaders/supabase_loader.py` |
| Retry | `etl_failed_rows` table | updated rows in Supabase | `src/loaders/supabase_loader.py` |

### CDSCO validation scoring

Each row is scored against the CDSCO brand-name registry using weighted fuzzy matching:

```
final_score = 0.7 × product_name_score + 0.3 × manufacturer_score
```

A row is marked `is_cdsco_verified = True` when `final_score >= 90`.

---

## How to run locally

### Prerequisites

```bash
# Python 3.10+
cd apps/etl
pip install -e .
playwright install chromium

# Environment variables (repo root)
cp ../../.env.example ../../.env
# Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
```

### Run the full pipeline

```bash
python run_all.py
```

### Common flags

```bash
# Use an existing raw CSV (skip the 60s browser scrape)
python run_all.py --skip-scrape

# Scrape only — useful for testing the browser step
python run_all.py --scrape-only

# Retry rows that failed in a previous run
python run_all.py --retry-failed

# Force re-download of CDSCO reference data
python run_all.py --refresh-cdsco
```

---

## How to add a new scraper

1. Create `src/scrapers/<source_name>.py` with a class that exposes:
   - `scrape() -> Path` (or `async scrape() -> Path` for JS-rendered sites)
   - `normalize(raw_path: Path) -> pd.DataFrame` — output must include at minimum: `generic_name`, `manufacturer`, `source`

2. Register it in `run_all.py` — add a new step between NORMALIZE and LOAD following the same pattern as the Jan Aushadhi step.

3. Add any new dependencies to `pyproject.toml` under `[project] dependencies`.

### Minimal scraper template

```python
# src/scrapers/my_source.py
from pathlib import Path
import pandas as pd
from src.utils.logger import logger

class MySourceScraper:
    def scrape(self) -> Path:
        # fetch data, save to data/raw/my_source/
        ...
        return raw_csv_path

    def normalize(self, raw_path: Path) -> pd.DataFrame:
        df = pd.read_csv(raw_path)
        # clean and reshape
        df["source"] = "my_source"
        return df
```

---

## Directory structure

```
apps/etl/
├── pyproject.toml              # Python project config (requires-python = ">=3.10")
├── README.md
├── run_all.py                  # Main orchestrator — entry point
└── src/
    ├── scrapers/
    │   ├── jan_aushadhi.py     # Scraper + normalizer for Jan Aushadhi
    │   └── cdsco.py            # CDSCO reference data fetcher
    ├── validators/
    │   └── cdsco_validator.py  # Fuzzy-match validator
    ├── loaders/
    │   └── supabase_loader.py  # Shared Supabase upsert loader
    └── utils/
        └── logger.py           # Shared logger
```

---

## Error handling & retry

When a batch upsert fails, the loader automatically falls back to row-by-row inserts. Rows that still fail are:

1. Logged as structured JSON to stdout (for CI/log aggregators)
2. Written to `data/failed/<pipeline>/failed_rows_<timestamp>.csv`
3. Persisted to the `etl_failed_rows` Supabase table (with fingerprint deduplication)

To retry them later:

```bash
python run_all.py --retry-failed
```

The `etl_failed_rows` table schema is defined in:
`supabase/migrations/20260520000000_create_etl_failed_rows.sql`
