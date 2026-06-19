# ADR — feat: add scan history feature

> **Date:** 2026-07-29 | **PR:** #1469 | **Status:** Accepted

## Context

The SahiDawa platform required a mechanism for users to review their past medicine verification scans. This feature was identified as critical for users, particularly in rural areas with intermittent or no internet connectivity, to maintain a personal record of their interactions with the platform. The existing system lacked any persistent, client-side storage for scan results, meaning users could not track previous verifications, suspicious findings, or failed attempts across sessions or when offline.

## Decision

An offline-first Medicine Scan History feature was implemented. The core decision was to utilize `IndexedDB` for persistent local storage of scan entries directly within the user's browser. This approach enabled the storage of scan results (including status like Verified, Suspicious, Fake, and failed attempts) and associated metadata. A dedicated `/history` page was developed to display these records, offering summary statistics and individual entry deletion functionality. `IndexedDB` initialization was designed to be SSR-safe within the Next.js application to ensure compatibility and robust operation.

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| Server-side storage for scan history | Would require constant internet connectivity, directly contradicting the "offline-first" and rural health platform goals. Introduced significant backend complexity for user authentication, data privacy, and scalability for individual user history. |
| Local Storage / Session Storage | `Local Storage` has limited storage capacity (typically 5-10MB) and synchronous API, which can block the main thread for larger datasets. `Session Storage` is cleared upon session end, failing the persistence requirement. Neither offers robust querying or indexing capabilities suitable for a growing history list. |
| No history feature | Directly contradicted the identified user need for tracking past medicine verifications, leading to a poorer user experience and reduced utility of the platform, especially in offline scenarios. |
| Web SQL Database | This technology is deprecated by the W3C and has inconsistent browser support. `IndexedDB` is the current recommended standard for client-side structured data storage. |
| PouchDB / RxDB (or other IndexedDB wrappers) | While offering higher-level abstractions and synchronization capabilities, these introduce additional dependencies and increased bundle size. For the current scope, direct `IndexedDB` usage with a custom, lightweight wrapper was deemed sufficient and provided fine-grained control without the overhead of a full-fledged database abstraction layer. |

## Consequences

**Positive:**
- Enabled offline access to personal scan history, crucial for users in low-connectivity environments.
- Enhanced user experience by providing a persistent record of medicine verifications and attempts.
- Offered valuable insights through dashboard statistics (Verified, Suspicious, Fake counts).
- Supported the saving of failed verification attempts, providing a comprehensive user record.
- Improved platform utility and user trust by allowing review of past actions without server dependency.

**Trade-offs:**
- Scan history is confined to the specific device and browser; it does not sync across multiple devices or browsers.
- Data is susceptible to loss if the user clears browser data, switches devices, or if the `IndexedDB` becomes corrupted.
- Increased client-side code complexity for `IndexedDB` management, schema migrations (if needed in the future), and SSR-safe initialization.

## Related Issues & PRs

- PR #1469: feat: add scan history feature
- Issue #925