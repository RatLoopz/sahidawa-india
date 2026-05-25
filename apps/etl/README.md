# sahidawa-etl

Unified ETL workspace for SahiDawa. Consolidates all data ingestion pipelines — Jan Aushadhi scraper, CDSCO validator, and Supabase loader — into one place.

## Quick start

```bash
cd apps/etl

# Install dependencies
pip install -e .

# One-time: install Playwright's Chromium browser
playwright install chromium

# Copy root .env if not already present
cp ../../.env.example ../../.env
# Fill in SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY

# Run the full pipeline
python run_all.py
```

## CLI flags

| Flag | Effect |
|---|---|
| `--skip-scrape` | Use the most recent existing raw CSV instead of scraping |
| `--scrape-only` | Scrape only — skip validation and DB load |
| `--retry-failed` | Retry rows saved in the `etl_failed_rows` table |
| `--refresh-cdsco` | Force re-download of CDSCO reference data |

## See also

[docs/etl-pipeline.md](../../docs/etl-pipeline.md) — full architecture, data flow, and guide for adding new scrapers.
