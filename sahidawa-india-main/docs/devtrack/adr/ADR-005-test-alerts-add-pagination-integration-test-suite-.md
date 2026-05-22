# ADR — test(alerts): add pagination integration test suite and alerts route

> **Date:** 2026-05-19 | **PR:** #344 | **Status:** Accepted

## Context

The SahiDawa platform required a mechanism to efficiently retrieve and display `drug_alerts`. As the volume of alerts was expected to grow, fetching all alerts in a single request would lead to performance degradation, increased server load, and a poor user experience. A paginated API endpoint was necessary to manage data transfer and presentation effectively.

## Decision

A new paginated API endpoint, `GET /api/v1/alerts`, was implemented within the `apps/api` service. This endpoint accepts `page` (1-based, default 1) and `limit` (items per page, default 10, max 100) as query parameters. The backend logic calculates the appropriate offset and uses Supabase's `range` and `count: "exact"` features to retrieve a subset of `drug_alerts` along with the total count.

The API response was standardized to include `data` (the array of alerts), `pageIndex`, `pageSize`, `totalCount`, and `totalPageCount`, providing comprehensive pagination metadata to client applications. Robust input validation was included to handle invalid `page` or `limit` parameters, defaulting to sensible values or capping the limit. A comprehensive integration test suite was developed to validate the endpoint's functionality, boundary conditions, and error handling.

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| **Retrieve All Alerts** | Inefficient for growing datasets, leading to high memory consumption, slow response times, and poor user experience. Not scalable for a production system. |
| **Offset-based Pagination without Total Counts** | While simpler to implement by omitting the `count: "exact"` query, this approach prevents clients from displaying total item counts or total page numbers. This limitation hinders user navigation (e.g., "Go to last page") and overall understanding of the dataset's scope, resulting in a poorer user experience. |
| **Cursor-based Pagination** | More complex to implement on both backend and frontend, and does not inherently support "jump to page N" functionality, which is often desired for administrative lists. While potentially more performant for extremely large, frequently updated datasets, the current scale and use case for alerts did not warrant this added complexity over traditional offset-based pagination with total counts. |

## Consequences

**Positive:**
- Enabled efficient retrieval and display of `drug_alerts`, improving API performance and reducing server load.
- Enhanced user experience by allowing users to browse alerts in manageable, paginated chunks.
- Established a standardized and robust pagination pattern for future API endpoints within the `apps/api` service.
- Comprehensive integration test coverage ensures the reliability and correctness of the pagination logic and prevents regressions.
- Provided full pagination metadata (`totalCount`, `totalPageCount`) to clients, enabling richer UI components and navigation.

**Trade-offs:**
- The `count: "exact"` operation in Supabase (which translates to `COUNT(*)`) can introduce performance overhead on very large tables, especially without appropriate database indexing.
- Requires client-side logic to manage `page` and `limit` parameters and interpret the returned pagination metadata for UI presentation.

## Related Issues & PRs

- PR #344: test(alerts): add pagination integration test suite and alerts route
- Issue #291