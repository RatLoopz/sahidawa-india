# SahiDawa — Deployment & Environment Setup Guide

This guide explains how to configure environment variables and deploy the three layers of the SahiDawa stack (Frontend, API Backend, ML Backend) for both Local Development and Production environments.

---

## 1. Local Setup

When running SahiDawa on your local machine, you need to set up two environment files: one for the root directory (used by Docker and the API backend) and one specifically for the Next.js frontend.

### Root `.env` (API & ML Services)

Create a `.env` file in the root of the project (`sahidawa-india/.env`) by copying `.env.example`:

```bash
cp .env.example .env
```

Fill in the necessary values:

```env
# Database
SUPABASE_URL=https://[your-project].supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# External APIs
GEMINI_API_KEY=your_gemini_key
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Local Ports
PORT=4000
ML_PORT=8000
NODE_ENV=development
```

### Frontend `.env.local`

Create an `.env.local` file inside `apps/web/`:

```bash
cp .env.example apps/web/.env.local
```

The frontend **only** needs variables prefixed with `NEXT_PUBLIC_`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://[your-project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Local API endpoints
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_ML_URL=http://localhost:8000
```

---

## 2. Production Deployment

In production, you do **not** upload `.env` files. Instead, you enter these key-value pairs directly into the dashboard of your hosting providers (Vercel, Render, etc.).

### A. Frontend (Vercel)

The Next.js frontend is deployed on Vercel.
Go to **Vercel Dashboard → Project Settings → Environment Variables**.

Add the following keys. Note that we use the live API URLs here instead of `localhost`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://[your-project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
NEXT_PUBLIC_API_URL=https://sahidawa-api.onrender.com
NEXT_PUBLIC_ML_URL=https://sahidawa-ml.onrender.com
```

> **⚠️ WARNING:** Never put secret keys (like `SUPABASE_SERVICE_ROLE_KEY` or `CLOUDINARY_API_SECRET`) in Vercel. Vercel exposes `NEXT_PUBLIC_` variables to the user's browser. Secret keys belong on the backend.

### B. API Backend (Render Node.js Service)

The Express API is deployed as a Web Service on Render.
Go to **Render Dashboard → Web Service Settings → Environment**.

Add the following keys:

```env
PORT=4000
NODE_ENV=production
SUPABASE_URL=https://[your-project].supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
GEMINI_API_KEY=your_gemini_key
```

### C. ML Backend (Render Python FastAPI Service)

The Machine Learning service handles Voice Triage, Image Analysis, and CDSCO verification. It is deployed as a separate Web Service on Render using Docker or Python environment.

Add the following keys to its Render Environment:

```env
PORT=8000
NODE_ENV=production
OTEL_SDK_DISABLED=true
```

> **Note:** `OTEL_SDK_DISABLED=true` is critical to prevent OpenTelemetry from spamming the Render logs with "Connection Refused" warnings when attempting to send traces to a non-existent localhost collector.

### D. Redis / Upstash Cache

The API backend uses Redis for caching drug queries to reduce Supabase reads. We recommend the free tier from **Upstash**.

1. Create a Redis database on Upstash.
2. Copy the **Redis URL** (it looks like `rediss://default:password@endpoint.upstash.io:6379`).
3. Add it to the **API Backend (Render)** environment variables:

```env
REDIS_URL=rediss://default:...
```

---

## 3. Keep-Alive Configuration (Free Tier Hosting)

Free hosting providers like Render spin down your services after 15 minutes of inactivity, causing "cold start" timeouts (up to 50 seconds delay) for users visiting the frontend.

To prevent this, SahiDawa includes an automatic GitHub Actions workflow (`.github/workflows/keep-alive.yml`). This cron job pings the API and ML `/health` endpoints every 14 minutes, ensuring your Render services never sleep and the frontend always remains responsive. No additional setup is required once the code is pushed to your `main` branch.
