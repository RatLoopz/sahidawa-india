# Sahidawa India — Frontend (`apps/web`)

The web frontend for Sahidawa India — a crowdsourced medicine safety platform. Built with **Next.js 16** (App Router), **React 19**, **TypeScript 6**, **Tailwind CSS v4**, and **next-intl** for i18n.

---

## Tech Stack

| Layer      | Technology                             |
| ---------- | -------------------------------------- |
| Framework  | Next.js 16 (App Router)                |
| Language   | TypeScript 6                           |
| UI         | React 19, Tailwind CSS v4              |
| Icons      | Lucide React                           |
| i18n       | next-intl (11 languages)               |
| Forms      | react-hook-form + Zod                  |
| Auth       | Supabase SSR                           |
| Maps       | Leaflet + react-leaflet + Overpass API |
| Barcode    | ZXing                                  |
| PWA        | Service Worker + Manifest              |
| AI Chat    | Google GenAI                           |
| OCR        | Tesseract.js                           |
| Animations | Framer Motion                          |
| Testing    | Jest + ts-jest + jsdom                 |

---

## Project Structure

```
apps/web/
├── app/
│   ├── [locale]/           # Dynamic locale routes (en, ta, bn, ...)
│   │   ├── page.tsx        # Home page
│   │   ├── about/          # About page
│   │   ├── admin/          # Admin dashboard (auth-guarded)
│   │   ├── alerts/         # CDSCO alerts
│   │   ├── compare/        # Medicine price comparison
│   │   ├── contact/        # Contact form
│   │   ├── faq/            # FAQ page
│   │   ├── health/         # AI Health Assistant chat
│   │   ├── how-it-works/   # How it works
│   │   ├── login/          # Login page
│   │   ├── map/            # Pharmacy map (Leaflet)
│   │   ├── offline/        # Offline mode page
│   │   ├── privacy/        # Privacy policy
│   │   ├── profile/        # User profile
│   │   ├── report/         # Report suspicious medicine
│   │   ├── reports/me/     # My reports list
│   │   ├── scan/           # Barcode/QR scanner
│   │   ├── voice/          # Voice health triage
│   │   ├── components/     # Page-level components
│   │   ├── globals.css     # Tailwind v4 + design tokens
│   │   ├── layout.tsx      # Root layout (providers, nav, footer)
│   │   ├── error.tsx       # Error boundary
│   │   ├── not-found.tsx   # 404 page
│   │   └── loading.tsx     # Loading spinner
│   ├── api/                # API routes
│   │   ├── chat/           # AI chat endpoint
│   │   ├── overpass/       # OpenStreetMap proxy
│   │   ├── upload/         # File upload endpoint
│   │   └── voice/          # Voice transcription endpoint
│   └── components/         # App-route-level components
│       ├── health/         # ChatUI, ActionCard, ChatBubble, etc.
│       └── Map.tsx
├── components/             # Shared/reusable components
│   ├── ui/                 # EmptyState, Icons, LiveMessage, Skeleton
│   ├── alerts/             # RecallPushSubscriber
│   ├── medicine/           # MedicinePhotoUpload, useUpload, etc.
│   ├── reports/            # ReportWizard
│   ├── scanner/            # BarcodeScanner, ExpiryBadge, LasaConfirmation
│   ├── Card.tsx
│   ├── LazyImage.tsx
│   ├── OfflineBanner.tsx
│   ├── OfflineErrorBoundary.tsx
│   ├── SearchSuggestions.tsx
│   └── ServiceWorkerProvider.tsx
├── hooks/
│   ├── useInstallPrompt.ts  # PWA install prompt
│   ├── useOfflineStatus.ts   # Online/offline detection
│   └── useOnlineRetry.ts     # Retry on reconnect
├── i18n/
│   ├── request.ts            # next-intl request config
│   └── routing.ts            # Locale defs + navigation helpers
├── lib/
│   ├── api.ts                # API client
│   ├── apiWithRetry.ts       # Retry wrapper
│   ├── supabase.ts           # Supabase client
│   ├── structuredLogger.ts   # Structured logging
│   ├── rateLimit.ts          # Rate limiting (Upstash)
│   └── voice/                # Voice emergency helpers
├── messages/                 # i18n JSON files (12 locales)
├── public/
│   ├── icons/                # PWA icons (maskable)
│   ├── manifest.json         # PWA manifest
│   ├── sw.js                 # Service Worker
│   └── workers/              # Web Workers
├── scripts/
│   └── voice-a11y-audit.mjs  # Accessibility audit
├── src/                      # Legacy/migrated components
├── tests/                    # Jest test files
├── Dockerfile                # Multi-stage build
├── next.config.mjs
├── proxy.ts                  # next-intl middleware + auth guard
├── package.json
├── tsconfig.json
└── jest.config.cjs
```

---

## Getting Started

### Prerequisites

- Node.js >= 20
- Supabase project (for auth + database)
- Redis instance (Upstash or local)

### Setup

1. **Install dependencies**

    ```bash
    npm install
    ```

2. **Environment variables**

    Copy the root `.env.example` to `.env.local` in `apps/web/` and fill in:

    ```env
    NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
    UPSTASH_REDIS_REST_URL=your_upstash_url
    UPSTASH_REDIS_REST_TOKEN=your_upstash_token
    GOOGLE_GENAI_API_KEY=your_google_ai_key
    ```

3. **Run the dev server**

    ```bash
    npm run dev
    ```

    Or from the monorepo root:

    ```bash
    npm run dev -w web
    ```

    The app starts at `http://localhost:3000`.

---

## Available Scripts

| Script            | Command                             | Description               |
| ----------------- | ----------------------------------- | ------------------------- |
| `dev`             | `next dev`                          | Start development server  |
| `build`           | `next build --webpack`              | Production build          |
| `start`           | `next start`                        | Start production server   |
| `lint`            | `eslint .`                          | Lint all files            |
| `test`            | `jest --config jest.config.cjs`     | Run test suite            |
| `test:a11y:voice` | `node scripts/voice-a11y-audit.mjs` | Voice accessibility audit |

---

## i18n (Internationalization)

11 supported locales, including English:

| Code | Language |
| ---- | -------- |
| `en` | English  |
| `hi` | Hindi    |
| `bn` | Bengali  |
| `ta` | Tamil    |
| `te` | Telugu   |
| `mr` | Marathi  |
| `gu` | Gujarati |
| `kn` | Kannada  |
| `pa` | Punjabi  |
| `od` | Odia     |
| `ur` | Urdu     |

New languages can be added by:

1. Adding the locale code to `i18n/routing.ts`
2. Creating a `messages/{code}.json` file
3. Adding the locale to the middleware pattern in `proxy.ts`

---

## Key Features

### Medicine Scanner

Barcode/QR scanning via ZXing, with expiry date badges and LASA drug confirmation.

### Voice Health Triage

Multi-language speech-to-text triage with confidence scoring, emergency detection, and accessibility-first UI.

### Pharmacy Map

Leaflet-powered map with Overpass API integration for finding nearby pharmacies.

### AI Health Assistant

Chat-based assistant using Google GenAI for medicine information and health guidance.

### PWA Support

Full offline support via Service Worker, install prompt, and offline error boundaries.

### CDSCO Alerts

Real-time alerts from India's drug regulatory authority.

---

## Testing

Tests are in `tests/` and use Jest with `jest-environment-jsdom` and `ts-jest`.

```bash
npm run test                    # Run all tests
npm run test -- --watch         # Watch mode
npm run test -- --coverage      # Coverage report
```

Mock helpers for `next-intl` are in `tests/mocks/`.

---

## Styling

This project uses **Tailwind CSS v4** with CSS-first configuration:

- `@import "tailwindcss"` in `globals.css`
- Design tokens as CSS custom properties in the `@theme` block
- Custom animations: `scan`, `slideIn`, `blob`, `marker-bounce-in`, etc.
- `prefers-reduced-motion` support for accessibility

---

## Docker

```bash
docker build -t sahidawa-web .
docker run -p 3000:3000 sahidawa-web
```

Multi-stage build: `deps` → `dev` → `builder` → `runner` (distroless).

---

## Architecture Decisions

| Decision              | Rationale                                               |
| --------------------- | ------------------------------------------------------- |
| App Router            | Server Components by default, streaming, nested layouts |
| next-intl             | Best-in-class i18n for Next.js, supports RSC            |
| Supabase SSR          | Auth with middleware-based route protection             |
| Tailwind v4 CSS-first | No config file, faster builds, CSS-native               |
| Husky pre-commits     | Enforce linting before commits                          |

---

## Pages Overview

| Route              | Description                                  |
| ------------------ | -------------------------------------------- |
| `/`                | Home — hero, scan CTA, features, live alerts |
| `/about`           | About the project                            |
| `/alerts`          | Live CDSCO drug recall alerts                |
| `/admin/dashboard` | Admin panel (auth required)                  |
| `/compare`         | Medicine price comparison                    |
| `/contact`         | Contact form                                 |
| `/faq`             | Frequently asked questions                   |
| `/health`          | AI Health Assistant chat                     |
| `/how-it-works`    | Platform walkthrough                         |
| `/login`           | Authentication                               |
| `/map`             | Nearby pharmacy finder                       |
| `/offline`         | Offline instruction page                     |
| `/privacy`         | Privacy policy                               |
| `/profile`         | User profile (auth required)                 |
| `/report`          | Report suspicious/fake medicine              |
| `/reports/me`      | My submitted reports                         |
| `/scan`            | Medicine barcode/QR scanner                  |
| `/voice`           | Voice-based health triage                    |

---

## Contributing

1. Branch from `main`: `git checkout -b feat/your-feature`
2. Write tests for new functionality
3. Ensure `npm run lint` and `npm run test` pass
4. Open a PR against `main`

See the [root contributing guide](../../CONTRIBUTING.md) for detailed guidelines.
