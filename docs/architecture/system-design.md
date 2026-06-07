# SahiDawa — System Design

> **Single source of truth for how the system is architected and where every file lives.**  
> High-level architecture diagrams are at the top; granular file/directory breakdowns follow.

---

## 🏗️ Monorepo Structure (NPM Workspaces)

SahiDawa is structured as a **Monorepo** (Monolithic Repository). Instead of having separate repositories for the frontend and backend, everything lives here under one roof. We use **NPM Workspaces** to manage multiple independent sub-projects efficiently.

### Directory Layout

- **`apps/`**: Contains the actual runnable applications.
    - **`apps/web`**: Next.js 16 Frontend (React 19, Tailwind CSS v4).
    - **`apps/api`**: Node.js/Express Backend (will connect to Supabase).
    - **`apps/ml`**: Python FastAPI service (for Machine Learning and Voice/Vision Processing).

- **`packages/`**: Contains shared code that can be used across multiple apps.
    - _Example_: If we build a shared UI component library or common database schemas in the future, they will live here. Even if this folder is currently empty, do not delete it, as it is pre-configured for future scalability.

---

## 🛠️ Installation & Setup Rules

**CRITICAL: NEVER run `npm install` inside the `apps/web` or `apps/api` folders directly.**

Because this is a workspace-enabled monorepo, NPM uses **Hoisting** to share common dependencies at the root level to save disk space.

### 1. Initial Setup

When you clone the repository, navigate to the **root folder (`sahidawa-india`)** and run:

```bash
npm install
```

_This will automatically install and link all dependencies for all apps and packages._

### 2. Adding New Packages

If you need to install a new package for a specific app, stay in the **root folder** and use the `-w` (workspace) flag:

- To add a package to the frontend:
    ```bash
    npm install <package-name> -w web
    ```
- To add a package to the backend:
    ```bash
    npm install <package-name> -w api
    ```

---

## 🚀 Running the Apps

You can start any app from the **root folder** using the workspace flag:

- **Run Frontend (Next.js):**
    ```bash
    npm run dev -w web
    ```
- **Run Backend (Express):**
    ```bash
    npm run dev -w api
    ```

---

## 📦 Versioning & Dependency Locking

We strictly use exact versions or locked ranges (e.g., `^16.2.4`) in our `package.json` files instead of `"latest"`.

**Why?**  
If we used `"latest"`, two contributors cloning the repo on different days might get different versions of Next.js or React, leading to severe version mismatch errors and broken builds.

By locking the versions:

1. Every contributor runs the exact same environment.
2. The `package-lock.json` at the root guarantees deterministic installations.

**Current Tech Stack Versions (Locked):**

- Next.js: `v16.2.4`
- React: `v19.x`
- Tailwind CSS: `v4.x`

---

## 🗺️ Codebase Map

> **Use this to locate exactly which file to edit for any task.**  
> Every file listed here has been verified to exist. Empty directories are noted.

---

### FRONTEND — `apps/web/`

#### Entry Points

| File                          | Purpose                                                                       | Status          |
| ----------------------------- | ----------------------------------------------------------------------------- | --------------- |
| `app/layout.tsx`              | Root HTML shell, global fonts, metadata                                       | ✅ Exists       |
| `app/globals.css`             | Tailwind v4 CSS, custom `@keyframes scan` animation                           | ✅ Exists       |
| `app/page.tsx`                | Home dashboard — 303 lines, full UI with nav/hero/feature cards               | ✅ Built        |
| `app/scan/page.tsx`           | Medicine scanner — camera viewfinder + file upload + result overlay           | ✅ Built (mock) |
| `app/[locale]/voice/page.tsx` | Voice triage — records audio, uploads it for ASR, and shows AI triage results | ✅ Built        |
| `app/map/page.tsx`            | Pharmacy map — static grid mockup, no real Leaflet                            | ✅ Built (mock) |
| `next.config.mjs`             | Next.js config (minimal, 92 bytes)                                            | ✅ Exists       |
| `postcss.config.mjs`          | Uses `@tailwindcss/postcss` plugin                                            | ✅ Exists       |

#### Directories That Are EMPTY (Need Contributors)

| Directory                    | What Should Go Here                                                                                                         |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `components/health/`         | Health score, medicine detail card components                                                                               |
| `components/map/`            | Leaflet map wrapper, pharmacy card, pin components                                                                          |
| `components/reports/`        | ReportWizard.tsx (counterfeit report form with wizard steps)                                                                |
| `components/scanner/`        | BarcodeScanner.tsx, ExpiryBadge.tsx                                                                                         |
| `hooks/`                     | useOnlineRetry.ts, useOfflineStatus.ts, useInstallPrompt.ts                                                                 |
| `lib/`                       | API client (`lib/api.ts`), Supabase browser client (`lib/supabase.ts`)                                                      |
| `messages/`                  | 12 locale files: en.json, hi.json, ur.json, ta.json, te.json, kn.json, gu.json, od.json, pa.json, sa.json, bn.json, mr.json |
| `public/`                    | App icons, manifest.json, static images                                                                                     |
| `app/[locale]/not-found.tsx` | Localized 404 page                                                                                                          |
| `app/loading.tsx`            | Global loading skeleton                                                                                                     |
| `app/global-error.tsx`       | Global error boundary                                                                                                       |

#### Key Patterns in Existing Pages

**State machine pattern (scan/page.tsx):**

```ts
const [scanning, setScanning] = useState(true);
const [result, setResult] = useState<null | "valid" | "invalid">(null);
const [uploadedImage, setUploadedImage] = useState<string | null>(null);
// setTimeout mocks the real API call — replace with fetch()
```

**Dark scanner screen style:**

```tsx
<div className="min-h-screen bg-black text-white font-sans relative flex flex-col">
```

**Light home screen style:**

```tsx
<div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
```

---

### BACKEND — `apps/api/`

#### Existing Files

| File                 | Purpose                                                             | Status        |
| -------------------- | ------------------------------------------------------------------- | ------------- |
| `src/index.ts`       | Express server — only `GET /` and `GET /health`                     | ✅ Scaffolded |
| `src/db/client.ts`   | Supabase JS client singleton                                        | ✅ Ready      |
| `src/db/schema.sql`  | Full PostgreSQL schema (medicines, pharmacies, counterfeit_reports) | ✅ Written    |
| `src/db/migrations/` | Migration files directory                                           | 🔜 Empty      |
| `package.json`       | Express 5, Supabase, Redis, Helmet, Morgan                          | ✅ Exists     |
| `tsconfig.json`      | TypeScript config                                                   | ✅ Exists     |
| `tests/`             | Test directory                                                      | 🔜 Empty      |

#### Directories That Are EMPTY (Need Contributors)

| Directory         | What Belongs Here                                                                                              |
| ----------------- | -------------------------------------------------------------------------------------------------------------- |
| `src/routes/`     | `verify.ts`, `pharmacies.ts`, `reports.ts`, `alerts.ts`, `ml.ts`, `analytics.ts`, `lasa.ts`, `admin.routes.ts` |
| `src/services/`   | `medicineService.ts`, `pharmacyService.ts`                                                                     |
| `src/middleware/` | `rateLimit.ts`, `validate.ts`, `auth.ts`, `errorHandler.ts`                                                    |

#### How to Add a New Route

```ts
// 1. Create: apps/api/src/routes/verify.ts
import { Router } from 'express'
const router = Router()
router.post('/', async (req, res) => { ... })
export default router

// 2. Register in: apps/api/src/index.ts
import verifyRouter from './routes/verify'
app.use('/api/verify', verifyRouter)
```

#### Database Client Usage

```ts
// Import in any service file:
import supabase from "../db/client";

const { data, error } = await supabase
    .from("medicines")
    .select("*")
    .eq("barcode_id", barcode)
    .single();
```

---

### ML SERVICE — `apps/ml/`

#### Existing Files

| File                        | Purpose                                                                | Status    |
| --------------------------- | ---------------------------------------------------------------------- | --------- |
| `main.py`                   | FastAPI app with CORS, root routes, and router loading for ASR/OCR     | ✅ Built  |
| `requirements.txt`          | fastapi, uvicorn, pydantic, python-dotenv                              | ✅ Exists |
| `routers/asr.py`            | Faster-Whisper transcription endpoint used by Voice Triage             | ✅ Built  |
| `routers/ocr.py`            | OCR extraction router                                                  | ✅ Exists |
| `routers/analyze.py`        | Medicine analysis endpoint                                             | ✅ Built  |
| `services/router_loader.py` | Optional router bootstrap helper so ASR can boot without OCR-only deps | ✅ Built  |
| `models/`                   | Empty — TF Lite `.tflite` model files                                  | 🔜 Empty  |
| `agent/`                    | Empty — CDSCO monitoring LangChain agent                               | 🔜 Empty  |

#### How to Add a New Router

```python
# 1. Create: apps/ml/routers/ocr.py
from fastapi import APIRouter
router = APIRouter(prefix="/ocr", tags=["OCR"])

@router.post("/extract")
async def extract_text(...):
    ...

# 2. Register in: apps/ml/main.py
from routers import ocr
app.include_router(ocr.router)
```

---

### DATABASE — Supabase Schema

#### Tables (defined in `apps/api/src/db/schema.sql`)

-- Enable PostGIS extension for Pharmacy Mapping (Phase 2)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Enable pgvector extension for RAG embeddings (Phase 3)
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable pg_trgm extension for fuzzy text matching (Phase 2)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

**`medicines`** — Master drug data from CDSCO

```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
barcode_id VARCHAR(100) UNIQUE, -- EAN/UPC barcode
brand_name VARCHAR(255),
generic_name VARCHAR(500) NOT NULL,
manufacturer VARCHAR(255) NOT NULL,
batch_number VARCHAR(100),
manufacturing_date DATE,
expiry_date DATE,
composition TEXT,
strength VARCHAR(100),
dosage_form VARCHAR(100),
schedule VARCHAR(50),
source VARCHAR(100) DEFAULT 'manual',
cdsco_approval_status VARCHAR(50) DEFAULT 'approved', -- 'approved', 'recalled', 'banned'
is_counterfeit_alert BOOLEAN DEFAULT FALSE,
mrp NUMERIC(10, 2),
jan_aushadhi_price NUMERIC(10, 2),
created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
CONSTRAINT medicines_mrp_non_negative CHECK (mrp IS NULL OR mrp >= 0),
CONSTRAINT medicines_jan_aushadhi_price_non_negative CHECK (jan_aushadhi_price IS NULL OR jan_aushadhi_price >= 0),
CONSTRAINT medicines_mrp_gte_jan_aushadhi_price CHECK (
    mrp IS NULL
    OR jan_aushadhi_price IS NULL
    OR mrp >= jan_aushadhi_price
)
```

**`pharmacies`** — Jan Aushadhi stores with PostGIS coordinates

```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
name VARCHAR(255) NOT NULL,
address TEXT NOT NULL,
district VARCHAR(100) NOT NULL,
state VARCHAR(100) NOT NULL,
phone_number VARCHAR(20),
is_verified BOOLEAN DEFAULT TRUE,
location geography(POINT, 4326), -- PostGIS Point (Longitude, Latitude)
created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
```

**`counterfeit_reports`** — Community-reported fake medicines (Heatmap Data)

```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
medicine_id UUID REFERENCES medicines(id),
scanned_barcode VARCHAR(100),
reported_brand_name VARCHAR(255),
reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
manufacturer VARCHAR(255),
description TEXT,
pharmacy_name VARCHAR(255),
address TEXT,
city VARCHAR(100),
state VARCHAR(100),
pincode VARCHAR(10),
photo_url TEXT, -- Cloudinary URL
photo_urls TEXT[] DEFAULT '{}'::text[],
report_location geography(POINT, 4326),
district VARCHAR(100),
status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'verified_fake', 'false_alarm'
created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
```

**`audit_logs`** — Transparency for Admin Actions

```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
admin_id UUID REFERENCES auth.users(id),
action VARCHAR(100) NOT NULL, -- e.g., 'VERIFIED_FAKE', 'UPDATE_MEDICINE'
target_type VARCHAR(50) NOT NULL, -- e.g., 'REPORT', 'MEDICINE'
target_id UUID NOT NULL,
details JSONB,
created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
```

**`district_alerts`** — District Level Alerts

```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
district VARCHAR(100) NOT NULL,
state VARCHAR(100),
alert_level VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high'
medicine_name VARCHAR(255),
is_active BOOLEAN DEFAULT TRUE,
created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
```

**`barcode_mappings`** — Real-world scanning intelligence

```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
barcode_id VARCHAR(100) NOT NULL,
medicine_id UUID REFERENCES medicines(id),
scan_count INTEGER DEFAULT 1,
confidence_score NUMERIC(3,2) DEFAULT 1.00,
created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
UNIQUE(barcode_id, medicine_id)
```

**`drug_alerts`** — Official Drug Alerts (CDSCO NSQ/Recalls)

```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
medicine_id UUID REFERENCES medicines(id),
reported_brand_name VARCHAR(255),
manufacturer VARCHAR(255),
batch_number VARCHAR(100),
alert_type VARCHAR(100), -- 'nsq', 'recalled', 'counterfeit'
risk_level VARCHAR(50) DEFAULT 'high',
district VARCHAR(100),
state VARCHAR(100),
source_url TEXT,
reported_at DATE,
created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
```

**`push_subscriptions`** — Web Push Subscriptions

```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
endpoint TEXT NOT NULL UNIQUE,
subscription JSONB NOT NULL,
created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
```

**`etl_failed_rows`** — ETL Failed Rows

```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
pipeline_name VARCHAR(100) NOT NULL,
source_table VARCHAR(100) NOT NULL,
row_fingerprint VARCHAR(64) NOT NULL,
row_payload JSONB NOT NULL,
medicine_name VARCHAR(500),
unresolved_value TEXT,
error_category VARCHAR(100),
db_error_code VARCHAR(20),
error_message TEXT,
attempt_count INTEGER DEFAULT 1,
status VARCHAR(50) DEFAULT 'failed',
created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
last_attempt_at TIMESTAMP WITH TIME ZONE
```

#### PostGIS Geo Query Pattern

```sql
-- Find pharmacies within 5km of user
SELECT *, ST_Distance(location, ST_MakePoint(lon, lat)::geography) AS dist
FROM pharmacies
WHERE ST_DWithin(location, ST_MakePoint(lon, lat)::geography, 5000)
ORDER BY dist LIMIT 10;
```

---

### DATA — `data/`

| File                       | Status             | Notes                            |
| -------------------------- | ------------------ | -------------------------------- |
| `data/seeds/medicines.csv` | ❌ Empty           | Needs CDSCO medicine data        |
| `data/seeds/`              | 🔜 Needs SQL files | `001_schema.sql`, `002_seed.sql` |

---

### CONFIG FILES

| File                       | Purpose                                        |
| -------------------------- | ---------------------------------------------- |
| `.env.example`             | All required env vars documented               |
| `package.json` (root)      | NPM workspaces config — `apps/*`, `packages/*` |
| `apps/web/package.json`    | Frontend deps with exact locked versions       |
| `apps/api/package.json`    | Backend deps                                   |
| `apps/ml/requirements.txt` | Python deps                                    |
| `.github/ISSUE_TEMPLATE/`  | Bug report + feature request templates         |
| `.github/workflows/`       | Empty — CI pipeline needed                     |
