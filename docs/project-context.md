# SahiDawa — Project Context

> **Single source of truth.** Read this first before making ANY code change.  
> Last updated: May 2026 | Codebase version: MVP Phase 1

---

## 1. What Is SahiDawa?

SahiDawa ("Sahi Dawa" = Correct Medicine in Hindi) is **India's first open-source citizen medicine verification platform**. It solves three simultaneous problems:

1. **Fake medicines** — 12–25% of medicines in India are counterfeit. No citizen-facing verifier exists.
2. **Rural healthcare access** — 65% of India lives in rural areas with no qualified doctor nearby.
3. **Language barrier** — 22 official Indian languages, but all health apps only work in English.

**Core user:** A rural Indian citizen or ASHA worker who wants to verify a medicine strip before consuming it.

---

## 2. The Three User Flows (Do Not Break These)

```
Flow 1 — Scan & Verify
  User scans barcode/QR or uploads photo
  → OCR / barcode reader extracts ID
  → Express API queries Supabase medicines table
  → Returns: REAL ✅ / SUSPICIOUS ⚠️ / FAKE ❌

Flow 2 — Voice Health Triage
  User speaks symptoms in their language (Hindi, Tamil, etc.)
  → Whisper ASR transcribes audio
  → Sarvam AI / LangChain processes in their language
  → Returns: Basic triage advice + nearest pharmacy

Flow 3 — Pharmacy Map
  User opens map
  → PostGIS query finds nearest verified Jan Aushadhi stores + ASHA workers
  → Leaflet.js renders pins on OpenStreetMap
  → User can call or navigate
```

---

## 3. Monorepo Structure (NPM Workspaces)

```
sahidawa-india/               ← Root (always run npm commands from here)
├── apps/
│   ├── web/                  ← Next.js 16 frontend  (port 3000)
│   │   ├── app/              ← App Router pages
│   │   │   ├── page.tsx      ← Home dashboard (BUILT)
│   │   │   ├── scan/page.tsx ← Medicine scanner (BUILT - mock)
│   │   │   ├── voice/page.tsx← Voice triage (BUILT - mock)
│   │   │   └── map/page.tsx  ← Pharmacy map (BUILT - mock)
│   │   ├── components/       ← Shared UI components (mostly empty)
│   │   ├── hooks/            ← Custom React hooks (empty)
│   │   ├── lib/              ← API clients, utilities (empty)
│   │   └── messages/         ← i18n JSON files (22 languages - empty)
│   │
│   ├── api/                  ← Express 5 backend (port 4000)
│   │   └── src/
│   │       ├── index.ts      ← Server entry point (BUILT - only health check)
│   │       ├── db/
│   │       │   ├── client.ts ← Supabase client singleton
│   │       │   └── schema.sql← Full DB schema (medicines, pharmacies, reports)
│   │       ├── routes/       ← EMPTY — needs all route files
│   │       ├── services/     ← EMPTY — needs business logic
│   │       └── middleware/   ← EMPTY — needs auth, rate-limit, validate
│   │
│   └── ml/                   ← FastAPI Python service (port 8000)
│       ├── main.py           ← Entry point (BUILT - only health check)
│       ├── routers/          ← EMPTY — needs ocr.py, voice.py
│       ├── services/         ← EMPTY — needs whisper, matcher, langchain
│       ├── models/           ← EMPTY — TF Lite model files go here
│       └── agent/            ← EMPTY — CDSCO monitoring agent
│
├── packages/                 ← Shared code (currently empty, reserved for future)
├── data/
│   └── seeds/                ← CDSCO medicine seed data (CSV empty, needs data)
└── docs/                     ← Documentation for contributors
```

---

## 4. Current Build Status (What Is Mock vs Real)

| Feature | Status | File | Notes |
|---|---|---|---|
| Home Dashboard | ✅ Built | `apps/web/app/page.tsx` | Real UI, no backend calls |
| Medicine Scanner UI | ✅ Built (mock) | `apps/web/app/scan/page.tsx` | `setTimeout` simulates scan |
| Voice Triage UI | ✅ Built (mock) | `apps/web/app/voice/page.tsx` | `setTimeout` simulates voice |
| Pharmacy Map UI | ✅ Built (mock) | `apps/web/app/map/page.tsx` | Static pins, no Leaflet yet |
| Express API server | ✅ Scaffolded | `apps/api/src/index.ts` | Only `/` and `/health` routes |
| Supabase DB schema | ✅ Written | `apps/api/src/db/schema.sql` | Not yet applied to Supabase |
| Supabase client | ✅ Written | `apps/api/src/db/client.ts` | Ready to use |
| FastAPI ML server | ✅ Scaffolded | `apps/ml/main.py` | Only `/` and `/health` routes |
| Medicine data | ❌ Empty | `data/seeds/medicines.csv` | Needs CDSCO seed data |
| API routes | ❌ Missing | `apps/api/src/routes/` | All route files needed |
| OCR endpoint | ❌ Missing | `apps/ml/routers/ocr.py` | Needs pytesseract |
| Voice endpoint | ❌ Missing | `apps/ml/routers/voice.py` | Needs openai-whisper |
| Leaflet map | ❌ Missing | `apps/web/app/map/page.tsx` | Replace mock with real |

---

## 5. Tech Stack (Exact Versions — Do Not Downgrade)

### Frontend (`apps/web`)
- **Next.js** `^16.2.4` with App Router
- **React** `^19.2.5`
- **Tailwind CSS** `^4.2.4` — uses `@tailwindcss/postcss`, NOT `tailwind.config.js`
- **Lucide React** `^1.14.0` — icon library
- **TypeScript** `^6.0.3`

> ⚠️ Tailwind v4 breaking change: use `bg-linear-to-b` not `bg-gradient-to-b`. Use `bg-size-[...]` not `bg-[size:...]`.

### Backend (`apps/api`)
- **Node.js** 22+
- **Express** `^5.0.0`
- **@supabase/supabase-js** `^2.105.3`
- **TypeScript** `^5.5.0`
- **ts-node-dev** for development hot-reload

### ML Service (`apps/ml`)
- **Python** 3.12+
- **FastAPI** `>=0.115.0`
- **uvicorn** with standard extras
- **pydantic** `>=2.9.0`

### Database
- **Supabase** (managed PostgreSQL) with:
  - **PostGIS** extension — pharmacy geo queries
  - **pgvector** extension — RAG embeddings (Phase 3)
- Tables: `medicines`, `pharmacies`, `counterfeit_reports`

---

## 6. Environment Variables

All keys from `.env.example`:
```
SUPABASE_URL          # Supabase project URL
SUPABASE_ANON_KEY     # Public anon key (safe for client)
SUPABASE_SERVICE_ROLE_KEY  # Admin key (server only, never expose)
PORT=4000             # Express API port
ML_PORT=8000          # FastAPI ML port
REDIS_URL             # Upstash Redis (caching, Phase 2)
CLOUDINARY_URL        # Media storage (Phase 2)
SARVAM_API_KEY        # Indian language LLM (Phase 3)
```

---

## 7. NPM Workspace Commands (Always From Root)

```bash
# Install all dependencies for all apps
npm install

# Run frontend
npm run dev -w web           # → http://localhost:3000

# Run backend
npm run dev -w api           # → http://localhost:4000

# Add package to specific workspace
npm install <pkg> -w web     # frontend only
npm install <pkg> -w api     # backend only
npm install <pkg> -w sahidawa-api  # also works (package.json "name")

# NEVER do this: (breaks hoisting)
# cd apps/web && npm install  ← WRONG
```

---

## 8. Design System (Tailwind v4 Tokens)

- **Brand color:** Emerald — `emerald-500` (#10b981), `emerald-400`, `emerald-600`
- **Background:** `black`, `slate-900`, `slate-50` (light mode)
- **Text:** `slate-900` (light), `white` (dark screens)
- **Borders:** `white/10`, `slate-200`
- **Danger:** `red-500`, `rose-500`
- **Warning:** `amber-400`
- **Font:** System sans-serif via Tailwind default
- **Rounded:** `rounded-2xl`, `rounded-[2.5rem]` for cards
- **Scanner screens** (scan, voice) use **black background**
- **Home/map** uses **slate-50 light background**

---

## 9. Development Phase Roadmap

| Phase | Timeline | Focus | Status |
|---|---|---|---|
| Phase 1 | Pre-GSSoC (May) | Scanner UI + DB schema + API scaffold | 🚧 In Progress |
| Phase 2 | Mid-May | Leaflet map + i18n + Cloudinary + Redis | 🔜 Next |
| Phase 3 | June | Whisper voice + Sarvam AI + LangChain RAG + CDSCO agent | 🔜 Planned |
| Phase 4 | July | Accessibility + Docker + OpenAPI + Launch | 🔜 Planned |

---

## 10. Key Constraints (Never Violate)

1. **Free forever** — No paid APIs in core flow. Whisper = local. Maps = OpenStreetMap.
2. **Works on 2G** — All pages must be lightweight. No heavy client-side bundles.
3. **No `cd apps/web && npm install`** — Always from root with `-w` flag.
4. **Never commit `.env`** — Only update `.env.example`.
5. **`SUPABASE_SERVICE_ROLE_KEY` is server-only** — Never expose in client/frontend code.
6. **Tailwind v4** — No `tailwind.config.js`. Config is in `globals.css` using `@theme`.
7. **Next.js App Router only** — No Pages Router patterns (`getServerSideProps`, etc.).
