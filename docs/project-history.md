# Project Provenance & History

This document serves as the public ledger of independent development for SahiDawa Open Health. It documents the repository's origin, major milestones, roadmap history, and dated GitHub references. The purpose of this page is to provide a transparent, verifiable timeline of our open-source safety infrastructure.

## Repository Origin

SahiDawa started as an independent open-source initiative designed to bridge the gap in medicine safety for rural India. Driven by the alarming statistics on counterfeit medicines, the project laid its foundation by integrating open government datasets (CDSCO) into a robust PostgreSQL database, serving it via a Next.js frontend.

- **Initial Commit & Foundation**: Established the Next.js frontend, Express API gateway, and initial schema for medicine verification.
- **Core Motivation**: To build a citizen-facing verifier for detecting safety risks, reporting counterfeits, and tracking regulatory alerts in multiple Indian languages.

## GirlScript Summer of Code (GSSoC) 2026

SahiDawa was officially selected as a participating project in **GirlScript Summer of Code 2026**. This milestone expanded the project from a core team initiative to a community-driven movement.

- **Track 1**: Open Source Track (Enabling broad community contributions for i18n, mapping, and UI).
- **Track 2**: Agents for India Track (Building the autonomous CDSCO drug alert monitoring agent).
- **Partnership**: Recognized as a Cloudinary Bounty Partner project, encouraging contributors to implement media APIs for counterfeit image analysis.

## Roadmap & Milestone History

### Phase 1: Foundation & Core Scanner (May 2026)
- Scaffolded Next.js (App Router), Express API, and FastAPI services.
- Successfully built the offline-first Barcode/QR scanner UI using ZXing and Tesseract.js.
- Deployed the CDSCO database schema to a Supabase Postgres instance.

### Phase 2: Localization & Intelligence (June 2026)
- Integrated `next-intl` to support 22 Indian languages.
- Began mapping infrastructure with Leaflet.js and OpenStreetMap.
- Initiated Cloudinary image upload workflows for community counterfeit reporting.

### Phase 3: The Safety Infrastructure Pivot (July 2026)
- **Identity Shift**: Transitioned from a generic "medicine search" utility to **SahiDawa Open Health**, a dedicated medicine safety infrastructure.
- **Flagship Focus**: Shifted core roadmap toward Counterfeit Intelligence — Scan, Verify, Recall/LASA risk detection, Public Reporting, District Heatmaps, and Alerts.
- **Provenance Documentation**: Established this history ledger to document independent open-source development and avoid overlap with commercial pharmacy search platforms.

## Verifiable GitHub References

This timeline is backed by our open-source commit history. You can trace the evolution of SahiDawa through:
- [Pull Requests](https://github.com/RatLoopz/sahidawa-india/pulls?q=is%3Apr+is%3Aclosed) — Review merged contributions spanning UI changes, AI/ML integrations, and core database queries.
- [Issues](https://github.com/RatLoopz/sahidawa-india/issues?q=is%3Aissue) — Explore feature requests, community discussions, and architectural planning threads.
- [DevTrack Documentation](../docs/devtrack/) — Explore our automated PR tracking logs that capture incremental development steps.

> **Note**: This document is maintained for transparency. SahiDawa Open Health operates as a free, open-source safety network for the public good, with zero commercial motivation.
