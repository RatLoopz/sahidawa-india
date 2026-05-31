# Apps / Web — SahiDawa Frontend

> **India's First Open-Source Citizen Medicine Verifier & Rural Health Bridge**

This directory contains the Next.js web application for SahiDawa, a GSSoC 2026 open-source project.

---

## Workspace Dev Commands

The web app is part of an npm workspace monorepo. Run commands from the **repo root** (`sahidawa-india/`).

```bash
# Start only the web app dev server
npm run dev -w web

# Start all workspace dev servers
npm run dev

# Install / update a package inside the web workspace
npm install <package-name> -w web

# Lint and test
npm run lint -w web
npm test -w web

# Package installation from root (adds to workspace)
npm install <package-name> -w=apps/web
```

---

## Directory Map

```
apps/web/
├── app/
│   ├── [locale]/         # Locale-aware route group (Next.js file routing)
│   │   ├── page.tsx      # Homepage
│   │   ├── scan/         # Medicine barcode/OCR scan page
│   │   ├── voice/        # AI voice triage page
│   │   ├── report/       # Report fake medicine wizard
│   │   ├── map/          # Verified pharmacy map
│   │   ├── health/       # AI health chat assistant
│   │   ├── compare/      # Medicine comparison tool
│   │   ├── profile/      # User profile
│   │   ├── login/        # Authentication
│   │   └── ...
│   └── layout.tsx        # Root layout (supabase providers, theme, fonts)
├── components/
│   ├── scanner/
│   │   ├── BarcodeScanner.tsx   # ZXing camera barcode scanner
│   │   ├── ExpiryBadge.tsx      # Expiry status badge
│   │   └── LasaConfirmation.tsx # Look-alike/sound-alike drug confirmation
│   ├── reports/
│   │   └── ReportWizard.tsx     # 3-step fake medicine report form
│   ├── medicine/
│   │   ├── MedicinePhotoUpload.tsx  # Drag-and-drop photo upload
│   │   ├── useUpload.ts             # Image upload hook (R2 via API)
│   │   └── validateMedicineFile.ts  # File validation
│   ├── health/          # AI chat UI components (ChatBubble, TrustBar, etc.)
│   ├── alerts/          # Recall push subscriber
│   ├── ui/              # Shared primitives (Skeleton, EmptyState, Icons, LiveMessage)
│   ├── Map.tsx          # Leaflet pharmacy map shell
│   └── OfflineBanner.tsx
├── hooks/
│   ├── useOnlineRetry.ts    # Auto-retries queued requests on reconnect
│   ├── useOfflineStatus.ts  # Online/offline state tracking
│   └── useInstallPrompt.ts  # PWA install prompt
├── lib/
│   ├── api.ts            # Verify medicine, submit report, geocode, pharmacy fetch
│   ├── apiWithRetry.ts   # fetchWithRetry + offline request queue
│   ├── supabase.ts       # Supabase client (auth, database)
│   ├── imageEnhancer.ts  # Off-thread image enhancement via Web Worker
│   ├── imageEnhancer.shared.ts  # Shared enhancement plan + pixel ops
│   ├── env.ts            # Env var loaders (NEXT_PUBLIC_*)
│   └── ...
├── messages/             # Translation JSON files (12 locales)
├── i18n/
│   ├── routing.ts        # Locale routing config + navigation helpers
│   └── request.ts        # Server-side message loading per request
├── src/
│   ├── styles/print.css  # Print-specific overrides
│   └── utils/medicineParser.ts
├── public/
│   ├── workers/imageEnhancer.worker.js  # Unsharp mask + selective saturation worker
│   └── sw.js             # Service Worker (offline cache)
└── tests/                # Jest unit/integration tests
```

---

## i18n Localization Workflow

SahiDawa uses **next-intl** (v4) for internationalization with file-based routing.

### Locale Routing

Supported locales are declared in `i18n/routing.ts`:

```ts
// apps/web/i18n/routing.ts
export const routing = defineRouting({
  locales: ['en', 'ta', 'bn', 'te', 'mr', 'gu', 'ur', 'od', 'hi', 'kn', 'pa', 'sa'],
  defaultLocale: 'en',
});
```

Every URL is prefixed with the locale, e.g. `/en/scan`, `/hi/map`, `/ta/voice`.

### Adding Translation Keys

1. **Add the key to `messages/en.json`** (the reference locale). Use nested namespaces matching the page or component:

```json
{
  "ScanPage": {
    "scan_title": "Scan Medicine",
    "scan_subtitle": "Point camera at packaging or barcode",
    "ocr_status": "Extracting text..."
  }
}
```

2. **Add translations for every other locale** under the same key path in each file:
   - `messages/hi.json`
   - `messages/ta.json`
   - `messages/te.json`
   - `messages/kn.json`
   - `messages/bn.json`
   - `messages/gu.json`
   - `messages/ur.json`
   - `messages/od.json`
   - `messages/mr.json`
   - `messages/pa.json`
   - `messages/sa.json`

3. **Use translations in Server Components** (`app/[locale]/page.tsx`) via the `getTranslations` function:

```tsx
import { getTranslations } from 'next-intl/server';

export async function generateMetadata() {
  const t = await getTranslations('ScanPage');
  return { title: t('scan_title') };
}
```

4. **Use translations in Client Components** via the `useTranslations` hook:

```tsx
'use client';
import { useTranslations } from 'next-intl';

export function ScanButton() {
  const t = useTranslations('ScanPage');
  return <button>{t('scan_title')}</button>;
}
```

---

## Tailwind CSS v4 Standard

There is **no `tailwind.config.js`** in this project. SahiDawa uses **Tailwind CSS v4** with its new `@theme` directive.

### Where Custom Tokens Live

All custom design tokens are defined inside `app/[locale]/globals.css` using CSS custom properties on `:root` (and `.dark` for dark mode). The file imports Tailwind at the top and defines the theme via `@theme`:

```css
/* apps/web/app/[locale]/globals.css */
@import "tailwindcss";

:root {
    --color-brand-primary: #10b981;
    --color-brand-success: #16a34a;
    --color-brand-secondary: #2563eb;
    --color-accent-cyan: #0891b2;
    --color-accent-warning: #fbbf24;
    --color-accent-danger: #dc2626;
    --color-surface-page: #ffffff;
    --color-border-muted: #e2e8f0;
    --color-text-primary: #1e293b;
    /* ... */
}

.dark {
    --color-surface-page: #0f172a;
    --color-text-primary: #f8fafc;
    /* ... */
}

@theme {
    --font-sans: var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif;
}
```

### Referencing Tokens in Code

Use the CSS variable tokens with arbitrary value syntax (`--color-*`):

```tsx
className="bg-[--color-brand-primary] text-[--color-text-primary]"
className="border-[--color-border-muted]"
```

### Custom Animations

Animations are defined as `@keyframes` inside `@layer base` in the same `globals.css` file:

- `animate-scan` — scanner sweep (used in `BarcodeScanner.tsx`)
- `animate-slideIn` — chat message entrance
- `animate-bounce` — typing indicator
- `animate-blob` — glassmorphism blob movement
- `marker-bounce-in` — pharmacy map marker hover

---

## Key Frontend Concepts

### Client-Side Barcode Scanning (ZXing)

The barcode scanner runs entirely client-side using **[@zxing/browser](https://github.com/zxing-js/browser)** and **[@zxing/library](https://github.com/zxing-js/library)**.

- **Component** [`components/scanner/BarcodeScanner.tsx`](components/scanner/BarcodeScanner.tsx)
- Uses `BrowserMultiFormatReader` from `@zxing/browser` to read from a live camera stream
- Supports formats: EAN_13, EAN_8, CODE_128, CODE_39, QR_CODE, DATA_MATRIX
- Includes torch/torch toggle for low-light environments
- Debounces duplicate scans and suppresses calls during active verification
- Falls back gracefully on permission errors, missing devices, and unsupported browsers

Scan flow:
1. Camera stream initialized via `navigator.mediaDevices.getUserMedia`
2. ZXing continuously decodes frames
3. On barcode detection → fires `onScan(text)` callback → verifies against CDSCO API

### Off-Thread OCR Text Extraction (Tesseract.js)

When barcode scanning fails, the app falls back to **OCR** using [Tesseract.js](https://github.com/naptha/tesseract.js) running inside a **Web Worker**.

- **Page** [`app/[locale]/scan/page.tsx`](app/[locale]/scan/page.tsx) orchestrates the OCR
- **Web Worker** [`public/workers/imageEnhancer.worker.js`](public/workers/imageEnhancer.worker.js) performs unsharp masking and selective saturation on the extracted image pixels **off the main thread**

OCR pipeline:

1. User uploads or captures a medicine image
2. ZXing attempts barcode decode
3. On failure → `Tesseract.createWorker("eng", 1)` is initialized
4. Image is pre-processed off-thread:
   - `enhancePixelsOffThread()` posts pixel data to the worker
   - Worker returns enhanced pixels via `postMessage` (transferable buffer)
5. `ocrWorker.recognize(dataUrl)` extracts text with confidence
6. Extracted text (brand name / batch number) is parsed and matched against the medicine database

Off-thread processing ensures the UI stays responsive during the heavy pixel manipulation and OCR workload.

### Image Enhancement Worker

The `imageEnhancer.ts` module creates and manages a persistent `Worker` from `/workers/imageEnhancer.worker.js`. It applies:

- **Unsharp mask** convolution for edge sharpening
- **Selective saturation** tuned by luminance to boost color only where appropriate

Processing is triggered via `preprocessMedicineImage()` — the canvas image is downsampled (max 1200px long edge), filtered, optionally enhanced in the worker, and output as WebP.

### Offline-First Hooks

The app uses three custom hooks for resilient offline behavior:

| Hook | Purpose |
|------|---------|
| `useOfflineStatus` | Tracks `isOffline` / `isOnline` with `navigator.onLine` events |
| `useOnlineRetry` | Automatically replays queued API requests when connectivity returns |
| `useInstallPrompt` | Captures the native PWA install prompt event |

Requests made with `fetchWithRetry` are automatically enqueued when offline and replayed on reconnection by `useOnlineRetry`.

---

## Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 / React 19 |
| Styling | Tailwind CSS v4 (`@theme` directive, no config file) |
| i18n | next-intl v4 (file-based locale routing) |
| Auth / DB | Supabase (`@supabase/ssr`, `@supabase/auth-helpers-nextjs`) |
| Barcode Scanning | `@zxing/browser` + `@zxing/library` |
| OCR | `tesseract.js` v7 (Web Worker) |
| Maps | `react-leaflet` + Leaflet |
| Forms | React Hook Form + Zod |
| UI | Framer Motion, Sonner (toasts), Lucide icons |
| Testing | Jest + jsdom |
| Language | TypeScript (strict) |
