# PR #500 — feat(ml): build commercial MRP scraper using OpenFDA API and NPPA reference prices

> **Merged:** 2026-05-24 | **Author:** @Subhra-Nandi | **Area:** ML/AI | **Impact Score:** 24 | **Closes:** #376

## What Changed

This pull request introduces a new Python-based scraper, `apps/ml/scrapers/commercial_mrp.py`, designed to fetch commercial Maximum Retail Price (MRP) data for common medicines using the OpenFDA Drug Label API and an internal NPPA reference table. We have integrated this new data source into our existing ETL pipeline by adding a `merge_commercial_mrp()` method to the `SupabaseLoader` in `apps/ml/etl/loader.py`, which updates the `mrp` column in our `medicines` database table. The `apps/ml/run_pipeline.py` script was also updated to include new command-line flags (`--commercial-mrp` and `--commercial-csv`) to orchestrate the scraping and merging process.

## The Problem Being Solved

Prior to this change, our `medicines` table lacked comprehensive commercial MRP data. While we had Jan Aushadhi prices, the absence of real market prices for commercially available drugs prevented our Savings Comparison UI from accurately demonstrating the potential cost savings for users choosing Jan Aushadhi alternatives. This limitation hindered a core value proposition of the SahiDawa platform, as users could not see a direct, data-driven comparison of prices. The existing ETL pipeline was not equipped to acquire or integrate this type of commercial pricing information.

## Files Modified

- `apps/ml/etl/loader.py`
- `apps/ml/run_pipeline.py`
- `apps/ml/scrapers/commercial_mrp.py`

## Implementation Details

### `apps/ml/scrapers/commercial_mrp.py`

This new module defines the `CommercialMRPScraper` class, responsible for fetching and structuring commercial drug data.

1.  **Constants and References:**
    - `OUTPUT_DIR`: Specifies the output directory for raw CSV files as `data/raw/commercial/`.
    - `OPENFDA_URL`: The base URL for the OpenFDA Drug Label API (`https://api.fda.gov/drug/label.json`).
    - `NPPA_MRP_REFERENCE`: A dictionary mapping generic drug name keywords (e.g., "paracetamol") to their approximate ceiling MRPs in INR (₹), sourced from the National Pharmaceutical Pricing Authority (NPPA) public data. This serves as our primary source for commercial MRP values, as OpenFDA does not provide Indian market prices.
    - `SEARCH_QUERIES`: A list of generic drug names derived from the keys of `NPPA_MRP_REFERENCE`, used to query the OpenFDA API.
    - `STRENGTH_PATTERN`: A regular expression (`r"(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml|iu|units?|%)"`) used to extract dosage strength and unit from drug descriptions.

2.  **`CommercialMRPScraper` Class:**
    - **`__init__(self, max_results_per_query: int = 10)`:** Initializes the scraper with a `max_results_per_query` limit for OpenFDA API calls and sets up a `requests.Session` with a custom `User-Agent` (`SahiDawa-ETL/1.0`) and `Accept` header for polite API interaction.
    - **`scrape(self) -> Path`:** The main orchestration method.
        - It iterates through `SEARCH_QUERIES`, calling `_fetch_openfda()` for each query.
        - After fetching all records, it performs deduplication based on a combined key of `(brand_name, generic_name)` to ensure unique entries.
        - Finally, it calls `_save_csv()` to write the collected data to a timestamped CSV file in `OUTPUT_DIR`.
    - **`_fetch_openfda(self, query: str) -> list[dict]`:**
        - Constructs OpenFDA API requests using the `search` parameter (`openfda.generic_name:"{query}"`) and `limit` (`RESULTS_PER_PAGE`).
        - Implements a robust retry mechanism with exponential backoff (`MAX_RETRIES`, `BACKOFF_BASE`) and random delays (`MIN_DELAY_SEC`, `MAX_DELAY_SEC`) between requests to respect API rate limits and handle transient network issues.
        - Handles pagination using the `skip` parameter to fetch multiple pages of results up to `max_results_per_query`.
        - Parses the JSON response and extracts relevant drug information using `_parse_record()`.
        - Enriches each record with an MRP by calling `_get_mrp_from_nppa()`.
    - **`_parse_record(self, hit: dict) -> dict | None`:**
        - Extracts `brand_name` (from `openfda.brand_name`), `generic_name` (from `openfda.generic_name`), and `strength` (from `strength` or `active_ingredient` fields) from a single OpenFDA API response `hit`.
        - Uses `STRENGTH_PATTERN` to normalize strength values.
        - Returns a dictionary with `brand_name`, `generic_name`, `strength`, and `source` (set to "OpenFDA/NPPA").
    - **`_get_mrp_from_nppa(self, generic_name: str) -> float | None`:**
        - Performs a case-insensitive lookup in the `NPPA_MRP_REFERENCE` dictionary using keywords from the provided `generic_name`.
        - Returns the corresponding MRP if a match is found, otherwise `None`.
    - **`_save_csv(self) -> Path`:**
        - Generates a timestamped filename (`commercial_mrp_<timestamp>.csv`).
        - Writes the collected `self.results` to this CSV file with headers: `brand_name`, `generic_name`, `strength`, `mrp`, `source`.

### `apps/ml/etl/loader.py`

The `SupabaseLoader` class was extended to incorporate the commercial MRP data.

1.  **`merge_commercial_mrp(self, mrp_csv_path: "Path", table: str = "medicines") -> dict`:**
    - This new method reads the CSV file generated by `CommercialMRPScraper` using `pandas.read_csv()`.
    - It iterates through each row of the DataFrame, extracting `generic_name` and `mrp`.
    - For each record, it queries the Supabase `medicines` table to find existing entries that match the `generic_name` (using `ilike` for case-insensitive partial matching) and where the `mrp` column is currently `null`. This ensures a non-destructive merge, only populating `mrp` where it's missing.
    - For every matching record found, it updates the `mrp` column with the scraped value using `self.client.table(table).update({"mrp": float(mrp)}).eq("id", match["id"]).execute()`.
    - A small `time.sleep(0.1)` is included for polite interaction with the Supabase API.
    - It tracks and returns statistics on `total`, `updated`, `not_found`, and `failed` records, along with a `success_rate`.
2.  **`_upsert_payloads`:** The comment for this method was updated to clarify that for commercial MRP records, we use `merge_commercial_mrp` for a targeted update, while for Janaushadhi records, we still use the full uniqueness key for upsert.

### `apps/ml/run_pipeline.py`

This script, which orchestrates our ETL pipeline, was updated to allow execution of the new commercial MRP scraping and merging.

1.  **`argparse` Additions:**
    - `--commercial-mrp`: A new flag (`action="store_true"`) to trigger the commercial MRP scraping and merging process.
    - `--commercial-csv`: An optional flag (`type=str, default=None`) to provide a path to an existing commercial MRP CSV file, allowing the merging step to run without re-scraping.
2.  **Conditional Execution:**
    - The script now checks if either `--commercial-mrp` or `--commercial-csv` flags are present.
    - If `--commercial-csv` is provided, it directly uses that path.
    - If `--commercial-mrp` is set (and no `--commercial-csv`), it instantiates `CommercialMRPScraper()` and calls its `scrape()` method to generate the CSV.
    - In both cases, it then instantiates `SupabaseLoader()` and calls `loader.merge_commercial_mrp()` with the determined CSV path.
    - If neither commercial MRP flag is present, the script falls back to its original behavior of running the full Janaushadhi ETL pipeline.

## Technical Decisions

1.  **OpenFDA API for Drug Data:** We chose the OpenFDA Drug Label API over direct scraping of Indian pharmacy websites (like 1mg) because the latter often employ JavaScript rendering (e.g., React apps) and anti-scraping measures, making programmatic data extraction complex and brittle. OpenFDA provides a free, official, and structured REST API, eliminating the need for browser automation or complex parsing, and significantly reducing maintenance overhead.
2.  **NPPA Reference for MRP:** OpenFDA does not provide Indian market-specific MRPs. To address this, we decided to use a curated internal `NPPA_MRP_REFERENCE` table. This pragmatic approach allows us to quickly integrate relevant pricing data for the Indian context, leveraging publicly available government data for ceiling prices, even if it's not directly from a live commercial source. This balances data availability with implementation complexity.
3.  **Non-Destructive MRP Merge:** The `merge_commercial_mrp()` method explicitly uses `is_("mrp", "null")` in its Supabase query. This design decision ensures that we only update the `mrp` column for records where it is currently unset. This prevents overwriting any potentially more accurate or manually curated MRP data that might already exist in our database from other sources, making the merge operation safe and additive.
4.  **Flexible `generic_name` Matching:** We opted for `ilike("generic_name", f"%{generic_name}%")` for matching records in the `medicines` table. This allows for case-insensitive, partial matching, which is crucial given potential variations in how generic names might be stored in our database versus how they appear in the scraped data. This increases the likelihood of successful matches and data enrichment.
5.  **Robust API Interaction:** The `CommercialMRPScraper` includes polite rate limiting (random delays) and exponential backoff with retries. This is a critical decision for interacting with external APIs like OpenFDA, preventing our IP from being blocked and ensuring the scraper can recover from transient network issues or temporary API unavailability, leading to more reliable data acquisition.
6.  **Pandas for Data Handling:** Using `pandas` for reading and processing the CSV file in `merge_commercial_mrp()` is a standard and efficient choice for tabular data manipulation in Python. It simplifies data loading, iteration, and ensures robust handling of CSV formats.

## How To Re-Implement (Contributor Reference)

To re-implement this feature from scratch, a contributor would follow these steps:

1.  **Set up Environment:**
    - Ensure Python 3.x is installed.
    - Install necessary libraries: `pip install requests pandas supabase-py`.
    - Create the output directory: `mkdir -p apps/ml/data/raw/commercial`.

2.  **Create the Scraper (`apps/ml/scrapers/commercial_mrp.py`):**
    - **Define Constants:** Establish `OUTPUT_DIR`, `OPENFDA_URL`, `MIN_DELAY_SEC`, `MAX_DELAY_SEC`, `MAX_RETRIES`, `BACKOFF_BASE`, `RESULTS_PER_PAGE`, and `STRENGTH_PATTERN` regex.
    - **NPPA Reference:** Create the `NPPA_MRP_REFERENCE` dictionary with generic names and their corresponding MRPs. This is a critical data source for pricing.
    - **Search Queries:** Generate `SEARCH_QUERIES` from the keys of `NPPA_MRP_REFERENCE`.
    - **`CommercialMRPScraper` Class:**
        - **`__init__`:** Initialize `requests.Session` with a `User-Agent` and `Accept` header.
        - **`_sleep()`:** Implement a function for random delays between API calls.
        - **`_get_mrp_from_nppa(generic_name: str)`:** Implement the lookup logic for `NPPA_MRP_REFERENCE`.
        - **`_parse_record(hit: dict)`:** Extract `brand_name`, `generic_name`, `strength` from OpenFDA `hit` dictionary, using `STRENGTH_PATTERN` for strength normalization. Handle missing fields gracefully.
        - **`_fetch_openfda(query: str)`:**
            - Construct API URL with `search=openfda.generic_name:"{query}"`, `limit`, and `skip` for pagination.
            - Implement a `for` loop for `MAX_RETRIES` with `try-except requests.RequestException`.
            - Inside the loop, make `session.get()` request.
            - If successful, parse JSON, iterate `results`, call `_parse_record` and `_get_mrp_from_nppa`.
            - Implement exponential backoff (`time.sleep(BACKOFF_BASE ** attempt)`) on failure.
            - Include `_sleep()` after each successful request.
        - **`_save_csv()`:** Use Python's `csv` module or `pandas.DataFrame.to_csv()` to write `self.results` to a timestamped CSV file in `OUTPUT_DIR` with columns: `brand_name`, `generic_name`, `strength`, `mrp`, `source`.
        - **`scrape()`:** Orchestrate the calls to `_fetch_openfda`, perform deduplication on `(brand_name, generic_name)`, and then call `_save_csv`.

3.  **Extend the Loader (`apps/ml/etl/loader.py`):**
    - **`SupabaseLoader` Class:**
        - **`merge_commercial_mrp(self, mrp_csv_path: Path, table: str = "medicines") -> dict`:**
            - Import `pandas`.
            - Read the CSV: `df = pd.read_csv(mrp_csv_path)`.
            - Initialize `updated`, `not_found`, `failed` counters.
            - Loop `for _, row in df.iterrows():`.
            - Extract `generic_name` and `mrp` from `row`.
            - Construct Supabase query: `self.client.table(table).select("id, generic_name, mrp").ilike("generic_name", f"%{generic_name}%").is_("mrp", "null").execute()`.
            - Iterate `matches = response.data` and for each `match`:
                - `self.client.table(table).update({"mrp": float(mrp)}).eq("id", match["id"]).execute()`.
                - Increment `updated`.
            - Include `time.sleep(0.1)` after each row's processing.
            - Add `try-except Exception` block for robust error handling.
            - Return a dictionary of statistics.

4.  **Update the Pipeline Runner (`apps/ml/run_pipeline.py`):**
    - **`argparse`:** Add `parser.add_argument("--commercial-mrp", action="store_true", ...)` and `parser.add_argument("--commercial-csv", type=str, default=None, ...)`
    - **Conditional Logic:**

        ```python
        if args.commercial_mrp or args.commercial_csv:
            from scrapers.commercial_mrp import CommercialMRPScraper
            from pathlib import Path
            # (import SupabaseLoader if not already imported)

            if args.commercial_csv:
                csv_path = Path(args.commercial_csv)
            else:
                scraper = CommercialMRPScraper() # or with specific max_pages_per_query
                csv_path = scraper.scrape()

            loader = SupabaseLoader()
            stats = loader.merge_commercial_mrp(csv_path)
            print(f"\n✅ Commercial MRP merge complete: {stats['updated']} rows updated")
        else:
            # Existing full pipeline logic
            asyncio.run(run_full_pipeline(...))
        ```

## Impact on System Architecture

This change significantly enhances our data enrichment capabilities and directly impacts the user experience.

1.  **Data Enrichment:** We now have a robust mechanism to populate the `mrp` column in our `medicines` table with commercial market prices. This moves us closer to having a comprehensive dataset for all relevant medicine pricing.
2.  **New External Data Source Integration:** The SahiDawa system now formally integrates the OpenFDA API as a source for drug label information, expanding our data acquisition ecosystem beyond just Jan Aushadhi sources. This sets a precedent for integrating other structured external APIs.
3.  **Enhanced ETL Pipeline:** The existing ETL pipeline has been extended to include a new, distinct stage for commercial MRP data acquisition and merging. This modular addition keeps our pipeline flexible and scalable, allowing for independent execution and monitoring of this specific data flow.
4.  **Improved User Interface Functionality:** The most direct impact is on the Savings Comparison UI. By populating commercial MRPs, the platform can now accurately calculate and display the savings users can achieve by opting for Jan Aushadhi medicines, fulfilling a critical feature requirement and enhancing the platform's utility for rural health workers and patients.
5.  **Foundation for Price Volatility Analysis:** With commercial MRP data now being collected, we lay the groundwork for future features such as tracking price changes, identifying market trends, and potentially even predicting price fluctuations, which could be valuable for procurement and policy recommendations.

## Testing & Verification

The changes were verified through several steps:

1.  **Scraper Execution:** The `CommercialMRPScraper` was run independently, and its output CSV (`data/raw/commercial/commercial_mrp_<timestamp>.csv`) was inspected. The PR description notes that the scraper successfully fetched "240+ records across 48/50 queries," indicating successful API interaction and data extraction.
2.  **Loader Statistics:** The `merge_commercial_mrp()` method in `SupabaseLoader` provides detailed statistics (`updated`, `not_found`, `failed`, `success_rate`). These statistics were monitored during testing to confirm successful merging operations and identify any issues with matching or database updates.
3.  **Database Inspection:** Direct queries to the Supabase `medicines` table were performed to verify that the `mrp` column was correctly updated for relevant records where it was previously `null`.
4.  **UI Verification:** The most critical verification involved the SahiDawa Savings Comparison UI. Screenshots provided in the PR ("Proof of Work") demonstrate that the UI now correctly displays savings, confirming that the newly populated `mrp` data is being utilized as intended.

**Edge Cases Considered:**

- **Generic Name Mismatches:** The use of `ilike("generic_name", f"%{generic_name}%")` helps mitigate minor variations in generic names between OpenFDA/NPPA data and our database.
- **Existing MRP Values:** The `is_("mrp", "null")` filter ensures that already populated `mrp` values are not overwritten, preserving any potentially more accurate or manually entered data.
- **API Rate Limits/Network Issues:** The scraper's built-in retry mechanism with exponential backoff and random delays handles transient network failures and prevents IP blocking from the OpenFDA API.
- **Missing Data:** The scraper gracefully handles cases where `brand_name`, `generic_name`, or `strength` might be missing from OpenFDA responses, and the loader handles cases where `generic_name` or `mrp` are missing from the CSV or where a generic name from the CSV cannot be found in our database.
- **No Matches in DB:** The `not_found` counter in `merge_commercial_mrp` specifically tracks records from the CSV that could not be matched to existing `medicines` entries, providing visibility into data coverage.
