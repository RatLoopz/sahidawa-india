# DevTrack: Fix Scanner Page UI, Navbar Visibility, and Result States (#1075)

## Overview

This pull request addresses several critical bugs on the `/en/scan` page (Issue #1075):

1. **Metadata & Semantic Headings:** Fixed the browser tab title / metadata merging and introduced a semantically correct `<h1>` tag in the `PageHeader` component.
2. **Navbar Visibility:** Resolved z-index clashing and obscured elements by rendering the scanner container correctly under the global top sticky navbar with standard responsive height layout (`min-h-[calc(100vh-4rem)]`) and inline header (`variant="light"`).
3. **Stuck loader / Result States:** Resolved the stuck "Analysing..." status on scanner/manual submit verification by updating `processVerificationResult` to trigger `setShowResult(true)` across all verification outcomes.

---

## Detailed Changes

### 1. Global Layout (`apps/web/app/[locale]/layout.tsx`)

- Removed the duplicate mounting of `{children}` which was causing Next.js dehydration conflicts, duplicate component instances, and broken metadata mapping.
- Standardized the layout content to render exactly once inside a clean `<main className="flex flex-col flex-grow">` container.

### 2. Page Header Component (`apps/web/app/[locale]/components/PageHeader.tsx`)

- Changed the primary page title element from a generic `<span>` to a semantic `<h1>` tag to improve accessibility and satisfy SEO heading requirements.

### 3. Scanner Page (`apps/web/app/[locale]/scan/page.tsx`)

- Changed PageHeader variant from `variant="dark"` (absolute positioning overlay) to `variant="light"` (inline normal block flow) so it flows gracefully below the sticky global `Navbar`.
- Updated the scanner root layout container class to `min-h-[calc(100vh-4rem)]` to perfectly fill the viewport height below the 64px (`4rem`) top navbar.
- Fixed the missing outcome trigger by adding `setShowResult(true)` inside all branches of `processVerificationResult` to ensure scanner verification results (such as Verified, Counterfeit Alerts, or LASA confirmation) render correctly instead of staying stuck on "Analysing...".
