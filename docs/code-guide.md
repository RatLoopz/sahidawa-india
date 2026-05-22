# SahiDawa — Developer Guide

> **Read this when you're unsure HOW to implement something.**  
> Contains patterns, rules, and anti-patterns specific to this codebase.

---

## When to Edit Which File

| Task | File to Edit | Notes |
|---|---|---|
| Change home page UI | `apps/web/app/page.tsx` | 303 lines — light theme |
| Change scanner UI | `apps/web/app/scan/page.tsx` | Dark theme, has upload logic |
| Change voice UI | `apps/web/app/voice/page.tsx` | Dark theme, mock state machine |
| Change map UI | `apps/web/app/map/page.tsx` | Light theme, static mock |
| Add a new page | `apps/web/app/<route>/page.tsx` | App Router — folder = route |
| Add shared component | `apps/web/components/<name>.tsx` | Keep focused, typed props |
| Add a custom hook | `apps/web/hooks/use<Name>.ts` | Prefix with `use`, return object |
| Add API call utility | `apps/web/lib/api.ts` | Create if not exists |
| Add Express route | `apps/api/src/routes/<name>.ts` + register in `index.ts` | See pattern in CODEBASE_MAP |
| Add business logic | `apps/api/src/services/<name>.ts` | Keep routes thin |
| Add middleware | `apps/api/src/middleware/<name>.ts` | Then apply in `index.ts` |
| Add FastAPI endpoint | `apps/ml/routers/<name>.py` + register in `main.py` | See pattern in CODEBASE_MAP |
| Add Python service | `apps/ml/services/<name>.py` | Import in router |
| Add DB query | Use `supabase` client from `apps/api/src/db/client.ts` | Never raw SQL via JS |
| Modify DB schema | Add migration in `apps/api/src/db/migrations/` | Never alter schema.sql directly |

---

## Tailwind v4 — Critical Rules

```
❌ WRONG (Tailwind v3 syntax)         ✅ RIGHT (Tailwind v4 syntax)
bg-gradient-to-b                      bg-linear-to-b
bg-gradient-to-t                      bg-linear-to-t
bg-[size:40px_40px]                   bg-size-[40px_40px]
<style jsx>{...}</style>              Move to globals.css @keyframes
tailwind.config.js                    @theme block in globals.css
```

**Adding custom animations:**
```css
/* In apps/web/app/globals.css ONLY */
@keyframes my-animation {
  0% { transform: translateY(0); }
  100% { transform: translateY(10px); }
}
/* Then use in Tailwind as: animate-[my-animation_2s_ease-in-out_infinite] */
```

---

## Next.js 16 App Router — Rules

```
❌ DO NOT USE                    ✅ USE INSTEAD
getServerSideProps               async Server Component
getStaticProps                   generateStaticParams
useRouter().push() for data      fetch() in Server Components
<style jsx>                      CSS Modules or globals.css
```

**Client vs Server Components:**
- Default = Server Component (no interactivity needed)
- Add `"use client"` only when using: `useState`, `useEffect`, `onClick`, browser APIs
- Current pages with `"use client"`: `scan/page.tsx`, `voice/page.tsx`

**Special Files (App Router):**
```
app/not-found.tsx     → Custom 404 page (create this)
app/loading.tsx       → Loading skeleton (create this)
app/error.tsx         → Error boundary — MUST have "use client" + reset prop
app/global-error.tsx  → Root error — MUST include own <html><body>
```

---

## Express 5 — Rules

- **No `app.get(path, callback)` callback errors** — Express 5 handles async errors automatically
- Use `router.get()` in route files, not `app.get()` 
- Always respond with structured JSON: `res.json({ success: true, data: ... })`
- Error responses: `res.status(400).json({ error: "message", details: [...] })`
- HTTP status codes to use:
  - `200` — success
  - `201` — created
  - `400` — bad input (validation error)
  - `404` — resource not found
  - `429` — rate limited
  - `500` — server error (never expose internal details)

---

## Supabase — Rules

```ts
// ✅ CORRECT — Always check for error
const { data, error } = await supabase.from('medicines').select('*')
if (error) throw new Error(error.message)

// ✅ Single record
.single()   // throws if 0 or >1 results
.maybeSingle()  // returns null if not found (safer)

// ❌ NEVER expose SUPABASE_SERVICE_ROLE_KEY in frontend
// ❌ NEVER use .from() without RLS if table has sensitive data
```

**RLS Policy Pattern:**
```sql
-- Public read (medicines are public data)
CREATE POLICY "public read" ON medicines FOR SELECT USING (true);

-- Authenticated write (reports need auth)
CREATE POLICY "auth write" ON counterfeit_reports 
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
```

---

## FastAPI — Rules

```python
# ✅ Always type your request/response with Pydantic
from pydantic import BaseModel

class VerifyRequest(BaseModel):
    barcode_id: str

class VerifyResponse(BaseModel):
    verified: bool
    medicine: dict | None = None

@router.post("/verify", response_model=VerifyResponse)
async def verify(req: VerifyRequest):
    ...

# ✅ File uploads use UploadFile
from fastapi import UploadFile, File
async def upload(file: UploadFile = File(...)):
    contents = await file.read()
```

---

## State Management Pattern (Frontend)

We use **local React state** only (no Redux, no Zustand yet). Pattern:

```tsx
// For async operations, use this state machine pattern:
type Status = 'idle' | 'loading' | 'success' | 'error'
const [status, setStatus] = useState<Status>('idle')
const [data, setData] = useState<YourType | null>(null)
const [error, setError] = useState<string | null>(null)

// Replace mock setTimeout with real fetch:
const handleScan = async (barcode: string) => {
  setStatus('loading')
  try {
    const res = await fetch(`/api/verify`, {
      method: 'POST',
      body: JSON.stringify({ barcodeId: barcode }),
      headers: { 'Content-Type': 'application/json' }
    })
    const json = await res.json()
    setData(json)
    setStatus('success')
  } catch (e) {
    setError('Verification failed')
    setStatus('error')
  }
}
```

---

## Installing Packages (Critical)

```bash
# ALWAYS from the root directory of the monorepo

# Frontend package:
npm install <package> -w web

# Backend package:
npm install <package> -w api
npm install -D <package> -w api   # dev dependency

# Python (from apps/ml/ directory, in venv):
cd apps/ml
pip install <package>
pip freeze > requirements.txt

# NEVER:
# cd apps/web && npm install <package>   ← breaks workspace hoisting
```

---

## Common Mistakes to Avoid

| Mistake | Why Wrong | Fix |
|---|---|---|
| Using `bg-gradient-to-b` | Tailwind v4 renamed it | Use `bg-linear-to-b` |
| `<style jsx>` | Not supported in Next.js App Router | Use `globals.css` |
| `import type` missing for TS types | Causes build errors | Always `import type { Foo }` for types |
| `npm install` inside `apps/web/` | Breaks workspace hoisting | Use `npm install -w web` from root |
| Hardcoding Supabase URL in code | Security risk | Always `process.env.SUPABASE_URL` |
| Using Pages Router patterns | Wrong router | Use App Router (`app/` directory) |
| Raw `fetch()` in Server Components without error handling | Crashes page | Always `try/catch` |
| Exposing service role key to client | Security breach | Server-side only, never in `apps/web/` |

---

## Port Reference

| Service | Port | Start Command |
|---|---|---|
| Frontend (Next.js) | 3000 | `npm run dev -w web` |
| Backend (Express) | 4000 | `npm run dev -w api` |
| ML Service (FastAPI) | 8000 | `uvicorn main:app --reload` (from `apps/ml/`) |

---

## External Services Reference

| Service | What For | Free? | Key Location |
|---|---|---|---|
| Supabase | PostgreSQL + Auth | ✅ Free tier | `.env` → `SUPABASE_URL` |
| Redis (Upstash) | Drug lookup cache | ✅ Free tier | `.env` → `REDIS_URL` |
| Cloudinary | Medicine photo storage | ✅ Free tier | `.env` → `CLOUDINARY_URL` |
| Sarvam AI | Indian language LLM | ✅ Dev tier | `.env` → `SARVAM_API_KEY` |
| OpenStreetMap | Map tiles | ✅ Always free | No key needed |
| Whisper (local) | Voice transcription | ✅ Self-hosted | No key needed |
