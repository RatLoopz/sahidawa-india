# Changelog

All notable changes to **SahiDawa — India's Open-Source Citizen Medicine Verifier** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

- TensorFlow Lite on-device medicine packaging image classifier
- Whisper ASR voice input supporting all 22 Indian scheduled languages
- Sarvam AI + LangChain RAG-based multilingual health assistant
- Autonomous CDSCO drug alert monitoring agent (polls every 6 hours via LangChain)
- Community-powered counterfeit medicine heatmap (D3.js, district-level)
- Push notification system for district-level drug recall alerts
- WCAG 2.1 full accessibility audit and fixes
- Lighthouse CI integration (target score: 90+)
- Docker Compose setup for self-hosting by NGOs and state governments
- OpenAPI / Swagger documentation for all REST endpoints
- ABHA (Ayushman Bharat Health Account) health card integration (optional)
- Public production launch 🚀

---

## [0.2.0] — 2026-05 · Phase 2: Map, Multilingual & Offline

> Focus: Making SahiDawa accessible to rural India with offline support and multilingual capabilities.

### Added

- **Pharmacy & ASHA Worker Map** — Leaflet.js + OpenStreetMap integration with PostGIS `ST_DWithin` geo-queries to find nearby verified Jan Aushadhi stores and ASHA workers
- **i18n System** — `next-intl` wiring for all 22 Indian scheduled languages; one JSON file per language under `apps/web/messages/`
- **Cloudinary Integration** — Medicine photo upload component for citizens to report suspicious medicines; stored at `cloud_name/sahidawa/reports/{batch}_{timestamp}`
- **Offline-First PWA** — Workbox service worker with cache strategies for medicine lookups and map tiles; app works without internet after first load
- **FastAPI ML Microservice** — Python FastAPI scaffolding for the ML service (`apps/ml/`) with router and model structure
- **Redis Caching** — Upstash Redis integration for fast, cached drug lookup responses; reduces database hits significantly
- **OpenCV.js Packaging Geometry Detection** — In-browser image analysis to detect packaging shape and text layout anomalies

### Infrastructure

- `docker-compose.dev.yml` added for streamlined local full-stack development
- GitHub Actions CI pipeline extended to cover ML service linting and tests

---

## [0.1.0] — 2026-04 · Phase 1: Foundation & Core Scanner

> Focus: Project scaffolding, core medicine verification pipeline, and open source community setup.

### Added

- **Project Scaffolding** — Monorepo setup with `apps/web` (Next.js 14 + TypeScript + Tailwind CSS), `apps/api` (Node.js + Express + TypeScript), `apps/ml` (Python + FastAPI), and `packages/shared` (shared TypeScript types)
- **Medicine Barcode/QR Scanner UI** — In-browser scanner using `@zxing/browser`; supports Code128, QR Code, EAN-13, and EAN-8 formats
- **CDSCO Drug Database Integration** — Scraper + PostgreSQL schema for batch numbers, manufacturers, drug alerts sourced from [cdsco.gov.in](https://cdsco.gov.in)
- **Medicine Lookup REST API** — Node.js + Express endpoints for batch number verification; input validation via Zod; rate limiting middleware
- **Supabase Integration** — Managed PostgreSQL + PostGIS + pgvector on Supabase free tier for development
- **i18n Foundation** — `next-intl` setup with English (`en.json`) as the base language; scaffold for 22 Indian scheduled languages
- **GitHub Actions CI Pipeline** — Automated lint, build, and test runs on every PR targeting `main`
- **Community & Contribution Setup**
  - `README.md` with full architecture diagram, tech stack, and project roadmap
  - `CONTRIBUTING.md` with detailed contribution workflow, coding standards, and GSSoC 2026 guidelines
  - `CODE_OF_CONDUCT.md`
  - `SETUPGUIDE.MD` for maintainer and contributor onboarding
  - `.github/ISSUE_TEMPLATE/` — bug report and feature request templates
  - `.github/PULL_REQUEST_TEMPLATE.md`
  - `.env.example` with all required environment variables documented
- **Data Seeds** — Initial `data/seeds/medicines.csv` structure for CDSCO drug database seeding
- **Shared TypeScript Types** — `packages/shared/src/types.ts` for cross-service type safety
- **Documentation** — Initial `docs/` folder with architecture, API reference, codebase map, local setup guide, and ETL pipeline documentation

### Infrastructure

- `package.json` monorepo root with npm workspaces for `apps/*` and `packages/*`
- `.gitignore` configured for Node.js, Python, and environment files
- MIT License

---

## Notes

- Dates use `YYYY-MM` format (monthly releases during active development)
- All contributions follow the [Conventional Commits](https://www.conventionalcommits.org/) standard
- For the full commit history, see [commits on GitHub](https://github.com/RatLoopz/sahidawa-india/commits/main)
- To contribute, read the [Contributing Guide](./CONTRIBUTING.md) first

---

*Built with ❤️ for 1.4 billion Indians — because healthcare is a right, not a privilege.*