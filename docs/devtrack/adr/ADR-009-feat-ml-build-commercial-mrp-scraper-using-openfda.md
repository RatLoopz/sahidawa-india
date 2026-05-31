# ADR — feat(ml): build commercial MRP scraper using OpenFDA API and NPPA reference prices

> **Date:** 2026-05-24 | **PR:** #500 | **Status:** Accepted

## Context

The SahiDawa platform lacked comprehensive commercial Maximum Retail Price (MRP) data for medicines. This deficiency prevented the "Savings Comparison UI" from accurately demonstrating potential cost savings when comparing commercial medicine prices against Jan Aushadhi (government-subsidized) prices. To provide a valuable service to users, it was critical to populate the `mrp` column in the `medicines` table with real-world market prices.

## Decision

A Python-based commercial MRP scraper was developed and integrated into the existing ETL pipeline to automatically fetch and merge commercial medicine prices.

The implementation details are as follows:

- A new Python module, `apps/ml/scrapers/commercial_mrp.py`, was created to handle the scraping logic.
- The scraper leverages the OpenFDA Drug Label REST API for drug information and enriches this data with NPPA (National Pharmaceutical Pricing Authority) ceiling MRPs, specifically targeting common generic medicines.
- Polite scraping practices were implemented, including random delays (1-3s) and exponential backoff for retries, to avoid overwhelming API endpoints.
- Scraped data, including `brand_name`, `generic_name`, `strength`, and `mrp`, is deduplicated and saved to `data/raw/commercial/commercial_mrp_<timestamp>.csv`.
- The `apps/ml/etl/loader.py` module was extended with a `merge_commercial_mrp()` method. This method reads the generated CSV and matches records to existing entries in the `medicines` Supabase table primarily by `generic_name` (case-insensitive).
- Crucially, the merge operation is non-destructive, only updating the `mrp` column for existing medicine rows where `mrp` is currently `null`.
- The `apps/ml/run_pipeline.py` script was updated to include `--commercial-mrp` and `--commercial-csv` flags, allowing for flexible execution of the scraping and merging process.

## Alternatives Considered

| Alternative                                          | Why Rejected                                                                                                                                                                                 |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Manual Data Entry/Procurement**                    | Not scalable for a large and frequently changing dataset. Prone to human error and would incur significant operational costs.                                                                |
| **Direct Web Scraping of Commercial Pharmacy Sites** | Highly fragile due to frequent website layout changes, leading to high maintenance overhead. Risk of IP blocking and potential legal/ethical concerns regarding terms of service violations. |
| **Purchase Commercial Drug Price Data**              | Incurred significant recurring costs for data licensing. Data might not be perfectly tailored to the specific Indian market context or cover all required generic medicines.                 |

## Consequences

**Positive:**

- Enables the "Savings Comparison UI" to display accurate and valuable cost savings against Jan Aushadhi prices, enhancing user utility.
- Automates the population of critical `mrp` data, reducing manual effort and improving data completeness.
- Leverages free and publicly available APIs (OpenFDA, NPPA), minimizing operational costs associated with data acquisition.
- Provides a robust and extensible framework for future expansion of commercial medicine data.

**Trade-offs:**

- Introduces a dependency on external APIs (OpenFDA, NPPA), making the ETL pipeline susceptible to their availability, rate limits, and potential API changes.
- The `generic_name` matching logic, while robust, may occasionally lead to imperfect matches or require refinement for edge cases.
- The polite rate limiting and exponential backoff mechanisms add to the overall execution time of the ETL pipeline.
- Requires periodic execution to ensure the `mrp` data remains current and reflects market fluctuations.

## Related Issues & PRs

- PR #500: feat(ml): build commercial MRP scraper using OpenFDA API and NPPA reference prices
- Issue #376
