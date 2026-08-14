# ADR — fix(web): remove unsafe-eval from production CSP

> **Date:** 2026-08-08 | **PR:** #4222 | **Status:** Accepted

## Context
The SahiDawa web application's Content Security Policy (CSP) included `'unsafe-eval'` to accommodate the requirements of OpenCV.js, which uses `new Function()` for WASM/JavaScript interop. However, this weakened the application's security posture. The need to remove `'unsafe-eval'` from the production CSP while preserving the functionality of OpenCV.js drove this architectural decision.

## Decision
The decision was made to isolate OpenCV.js execution within a sandboxed iframe, utilizing the `sandbox="allow-scripts"` attribute without `allow-same-origin`, thereby removing the need for `'unsafe-eval'` in the main application's CSP. To facilitate secure communication between the sandboxed iframe and the main application, measures such as `event.source` validation, unique request IDs, pending-request tracking, request timeouts, and cleanup and cancellation mechanisms were implemented.

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| Retaining `'unsafe-eval'` in the CSP | This option was rejected due to the significant security risks associated with allowing arbitrary code evaluation in the main application context. |
| Using a different computer vision library that does not require `new Function()` | This alternative was likely considered but rejected either due to the lack of a suitable replacement that meets the application's requirements or the significant development effort required to integrate a new library. |

## Consequences

**Positive:**
- Enhanced security posture of the SahiDawa web application by removing `'unsafe-eval'` from the production CSP.
- Preservation of OpenCV.js functionality within a sandboxed environment, ensuring the application's packaging detection capabilities remain intact.

**Trade-offs:**
- Added complexity due to the introduction of a sandboxed iframe and the necessary communication mechanisms between the iframe and the main application.

## Related Issues & PRs

- PR #4222: fix(web): remove unsafe-eval from production CSP
- Issue #4219