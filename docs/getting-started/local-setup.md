# SahiDawa — Complete Setup Guide

---

## PART 1: GitHub Repository Setup (Do This First)

### Step 1 — Create the repository

1. Go to [github.com/new](https://github.com/new)
2. Repository name: `sahidawa-india`
3. Description: `India's first open-source citizen medicine verifier — scan to verify real vs fake medicines, find pharmacies, AI health assistant in 22 Indian languages`
4. Visibility: **Public** (required for GSSoC)
5. Check: Add a README file
6. Choose license: **MIT License**
7. Click **Create repository**

---

### Step 2 — Upload your files

After creating the repo:

```bash
# Clone your new repo
git clone https://github.com/YOUR_USERNAME/sahidawa-india.git
cd sahidawa-india

# Copy the files from this guide into the repo
# (README.md, CONTRIBUTING.md, etc.)

git add .
git commit -m "chore: initial project setup with docs and structure"
git push origin main
```

---

### Step 3 — Set up repository settings

Go to your repo → **Settings**:

#### General tab

- Under **Features**, enable:
    - [x] Issues
    - [x] Projects
    - [x] Discussions
    - [x] Sponsorships (optional)

#### Branches tab

- Set **Default branch** to `main`
- Add **Branch protection rule** for `main`:
    - [x] Require a pull request before merging
    - [x] Require status checks to pass before merging
    - [x] Require branches to be up to date before merging

---

### Step 4 — Create GitHub Labels

Go to **Issues → Labels → New Label** and create all 30 labels listed at the bottom of `GITHUB_ISSUES.md`.

Quick way — use the GitHub CLI:

```bash
# Install GitHub CLI: https://cli.github.com/
gh label create "good-first-issue" --color "#7057ff" --description "Perfect for first-time contributors"
gh label create "intermediate" --color "#e4e669" --description "Requires some experience"
gh label create "advanced" --color "#d93f0b" --description "Complex implementation"
gh label create "gssoc-bounty" --color "#ff6600" --description "Earns GSSoC Cloudinary bonus points"
gh label create "gssoc-agents-track" --color "#ff9900" --description "GSSoC Agents for India track"
# ... (continue for all labels from GITHUB_ISSUES.md)
```

---

### Step 5 — Create the folder structure

Create these empty files to show the project architecture:

```bash
mkdir -p apps/web/app apps/web/components/scanner apps/web/components/map
mkdir -p apps/web/components/health apps/web/components/reports
mkdir -p apps/web/messages apps/web/hooks apps/web/lib apps/web/public
mkdir -p apps/api/src/routes apps/api/src/services apps/api/src/middleware
mkdir -p apps/api/src/db/migrations apps/api/tests
mkdir -p apps/ml/routers apps/ml/services apps/ml/models apps/ml/agent
mkdir -p packages/shared/src data/seeds docs .github/workflows
mkdir -p .github/ISSUE_TEMPLATE

# Create placeholder files to commit
touch apps/web/app/page.tsx
touch apps/web/app/layout.tsx
touch apps/api/src/index.ts
touch apps/ml/main.py
touch packages/shared/src/types.ts
touch data/seeds/medicines.csv
touch docs/architecture.md
touch .env.example
```

---

### Step 6 — Create .env.example

Create `.env.example` in repo root:

```bash
# Supabase (free at supabase.com)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Cloudinary (free at cloudinary.com) — GSSoC Bounty Partner
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Redis / Upstash (free at upstash.com)
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token_here

# Sarvam AI (register at sarvam.ai)
SARVAM_API_KEY=your_sarvam_key

# App config
NEXT_PUBLIC_APP_URL=http://localhost:3000
API_URL=http://localhost:4000
ML_SERVICE_URL=http://localhost:8000
NODE_ENV=development
```

---

### Step 7 — Post your first 10 issues

Use the issues from `GITHUB_ISSUES.md`. Post in this order for best results:

**Post first (before applying):**

1. Issue #1 — Hindi translation (good-first-issue)
2. Issue #2 — Tamil translation (good-first-issue)
3. Issue #7 — Barcode scanner (intermediate)
4. Issue #8 — Medicine lookup API (intermediate)
5. Issue #10 — Cloudinary photo upload (intermediate, bounty)
6. Issue #22 — GitHub issue templates (good-first-issue)
7. Issue #20 — GitHub Actions CI (intermediate)
8. Issue #30 — CDSCO scraper (intermediate)
9. Issue #17 — CDSCO alert agent (advanced, Agents track)
10. Issue #16 — LangChain RAG (advanced)

**Label each issue correctly** — GSSoC reviewers specifically look for:

- Multiple `good-first-issue` labels (shows beginner-friendly)
- At least 1 `gssoc-agents-track` label (dual-track appeal)
- At least 1 `gssoc-bounty` (Cloudinary partner appeal)

---

### Step 8 — Set up GitHub Project Board

Go to **Projects → New Project → Board view**

Create columns:

- `Backlog` — all open issues start here
- `Ready` — issues with clear acceptance criteria, ready to pick
- `In Progress` — assigned to a contributor
- `In Review` — PR open, under review
- `Done` — merged

Move your 10 posted issues to `Ready`.

---

### Step 9 — Add GitHub Discussions

Go to **Discussions → New Category** and create:

- `Announcements` (maintainers only)
- `Q&A` — contributors ask questions
- `Ideas` — feature suggestions
- `Show & Tell` — contributors share their progress
- `GSSoC 2026` — program-specific discussion

Post a welcome message in Announcements.

---

### Step 10 — Create a basic Next.js app

Before applying, have SOMETHING working:

```bash
cd apps/web
npx create-next-app@latest . --typescript --tailwind --app --src-dir
npm install @zxing/browser next-intl @supabase/supabase-js
npm run dev
# Verify: http://localhost:3000 shows something
```

Deploy it to Vercel for free:

1. Go to [vercel.com](https://vercel.com) → **Import Project**
2. Connect your GitHub repo
3. Click **Deploy**
4. Copy the live URL (e.g. `https://sahidawa-india.vercel.app`)

**This live URL goes in your GSSoC application.** A live deployment = serious project.

---

## PART 2: GSSoC 2026 Project Admin Application

### Application URL

👉 **[https://gssoc.girlscript.org/apply](https://gssoc.girlscript.org/apply)**

Select role: **Project Admin**

---

### Application Fields — Exact Answers

Below is what to write for each field in the GSSoC application. Adapt slightly in your own words.

---

**Project Name:**

```
SahiDawa — India's Open-Source Medicine Verifier & Rural Health Bridge
```

---

**Project GitHub URL:**

```
https://github.com/YOUR_USERNAME/sahidawa-india
```

---

**Live Demo URL (if any):**

```
https://sahidawa-india.vercel.app
```

---

**Project Description (2–3 sentences):**

```
SahiDawa lets any Indian citizen scan a medicine barcode to instantly verify if it's real or fake using CDSCO's public drug database, find the nearest verified pharmacy or Jan Aushadhi store, and get AI health guidance in 22 Indian languages — all offline-capable and completely free. India has a 12–25% counterfeit medicine problem and 65% of its population lives in rural areas with almost no qualified healthcare access. SahiDawa is the first open-source, citizen-facing platform that solves both problems simultaneously.
```

---

**What problem does your project solve?**

```
12–25% of medicines sold in India are counterfeit or substandard (survey data) — a July 2025 Delhi Police bust found fake J&J and GSK medicines made of chalk powder reaching government hospitals. Meanwhile, 65% of India's population lives in rural areas where 67% of "healthcare providers" have zero medical qualifications, and patients travel 50–100km for basic care. Health information is almost entirely in English or Hindi, excluding 500M+ speakers of other Indian languages.

SahiDawa solves all three: (1) citizens scan any medicine barcode and instantly verify it against the CDSCO public drug database; (2) an offline-first map shows verified pharmacies, Jan Aushadhi stores, and ASHA workers nearby; (3) a voice-first AI health assistant works in all 22 Indian scheduled languages and refers users to appropriate care. The autonomous CDSCO alert monitoring agent (LangChain) sends real-time drug recall warnings to affected districts.
```

---

**What makes your project unique? (USPs)**

```
1. FIRST open-source citizen-facing medicine verifier in India — CDSCO data is public but no one has built a usable app on it.
2. Offline-first PWA — works without internet, critical for rural India's intermittent connectivity.
3. 22 Indian scheduled language support with voice input (Whisper + Sarvam AI) — no health app does this.
4. Community-powered counterfeit heatmap by district — first crowdsourced, real-time fake medicine intelligence.
5. Autonomous CDSCO alert agent (LangChain) — perfect fit for GSSoC 2026's new Agents for India track.
6. Cloudinary Media API integration for medicine photo comparison — GSSoC bounty partner alignment.
7. 100% open source, MIT licensed, self-hostable — state governments and NGOs can deploy their own instance.
```

---

**Tech stack:**

```
Frontend: Next.js 14, TypeScript, Tailwind CSS, shadcn/ui, Workbox (PWA), ZXing barcode scanner, Leaflet.js + OpenStreetMap, next-intl (i18n)
Backend: Node.js, Express, TypeScript, Redis (Upstash)
ML Service: Python, FastAPI, OpenCV, TensorFlow Lite, Whisper (self-hosted), Sarvam AI, LangChain
Database: PostgreSQL, PostGIS, pgvector, Supabase
Media: Cloudinary (GSSoC bounty partner)
Infrastructure: Docker, GitHub Actions, Vercel, Railway
```

---

**How many contributors can your project support?**

```
50+

We have designed the issue structure to support:
- 22 language translation issues (one per contributor each)
- 15+ frontend component issues (beginner to intermediate)
- 10+ backend API issues (intermediate)
- 8+ ML/AI issues (advanced)
- 5+ DevOps/documentation issues (beginner to intermediate)

Every contributor finds meaningful work at their level.
```

---

**Do you plan to use Cloudinary?**

```
Yes — Cloudinary is central to SahiDawa:
1. Medicine photo upload (citizens report suspicious medicines)
2. Image transformation for packaging comparison (real vs fake visual analysis)
3. Training dataset management (photos labeled and organized for ML classifier)
4. Contributors who build Cloudinary features earn GSSoC bonus leaderboard points
```

---

**Is this project suitable for the Agents for India track?**

```
Yes — SahiDawa has a dedicated AI agent: an autonomous LangChain agent that polls CDSCO drug alerts every 6 hours, cross-references with our medicine database, and sends push notifications to affected districts. This is a real-world AI agent solving a critical Indian public health problem — exactly what the Agents for India track is for.
```

---

**What is your availability as a Project Admin?**

```
I commit to:
- Reviewing and responding to all PRs within 24 hours
- Reviewing and assigning issues within 12 hours
- Weekly contributor standups (async or live)
- Being active on Discord/GitHub Discussions throughout the program
- Merging valid contributions promptly (not letting PRs sit > 48 hours)
```

---

**Previous open source experience (if any):**

```
[Add your own GitHub contributions, projects, hackathons here]
```

---

**Why should GSSoC select this project?**

```
SahiDawa ticks every box GSSoC 2026 values:

✅ Real-world impact at scale — 1.4 billion citizens affected by the problems we solve. This is not a to-do app.
✅ Quality over quantity — we are building a real platform with real users in mind, not chasing PR counts.
✅ Dual-track alignment — Open Source Track (50+ issues) + Agents for India Track (CDSCO alert agent).
✅ Cloudinary bounty integration — medicine photo pipeline directly uses Cloudinary Media API.
✅ Beginner-friendly — 22 translation issues alone give 22 first-timers a meaningful contribution.
✅ Expandable — post-GSSoC: food adulteration detection, water quality reports, ABHA integration.
✅ Live project — not just an idea. A working deployment is live at [your Vercel URL].

India's counterfeit medicine problem kills people. SahiDawa gives citizens the power to protect themselves and their families. Every PR merged is potentially a life saved.
```

---

## PART 3: After Submission — While You Wait

### Week 1 (Apply + setup)

- [ ] Repo created with README, CONTRIBUTING.md
- [ ] 10+ issues posted with proper labels
- [ ] Next.js app deployed to Vercel
- [ ] GitHub Actions CI running
- [ ] Application submitted at gssoc.girlscript.org

### Week 2 (While selections happen)

- [ ] Post 20 more issues (reach 30+ total)
- [ ] Write `docs/architecture.md` with system diagram
- [ ] Create basic barcode scan → CDSCO lookup working
- [ ] Add yourself to Discord to network with other project admins
- [ ] Share project on LinkedIn + Twitter with #GSSoC2026

### If selected (April 2026)

- [ ] Post welcome message in GitHub Discussions
- [ ] Create Discord server and share link in README
- [ ] Write onboarding video / Loom walkthrough
- [ ] Assign mentors per feature area
- [ ] Host kick-off call for contributors

---

## Timeline Summary

| Date                 | Action                                               |
| -------------------- | ---------------------------------------------------- |
| **Now (April 2026)** | Create repo, post 10 issues, deploy to Vercel, APPLY |
| **This week**        | Post 30 issues, add basic barcode scan MVP           |
| **Late April**       | GSSoC selection announced — onboard contributors     |
| **April–June**       | Main contribution period (review PRs daily)          |
| **June–July**        | Final evaluations, recognition                       |

---

_Good luck. You're building something that genuinely matters._ 🇮🇳
