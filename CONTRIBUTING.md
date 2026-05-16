# Contributing to SahiDawa 🩺

Thank you for wanting to contribute to SahiDawa! Every PR you submit helps protect a real person from a fake medicine. Read this guide fully before submitting your first contribution — it will save you time and help your PR get merged faster.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How to Get Started](#how-to-get-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Contribution Workflow](#contribution-workflow)
- [Types of Contributions](#types-of-contributions)
- [Coding Standards](#coding-standards)
- [Commit Message Format](#commit-message-format)
- [Pull Request Guidelines](#pull-request-guidelines)
- [Issue Guidelines](#issue-guidelines)
- [GSSoC 2026 Contributors](#gssoc-2026-contributors)
- [Getting Help](#getting-help)

---

## Code of Conduct

This project follows a strict Code of Conduct. We do not tolerate discrimination, harassment, or disrespect of any kind. By contributing, you agree to uphold these standards.

Read the full [Code of Conduct](./CODE_OF_CONDUCT.md).

---

## How to Get Started

### Step 1 — Find an issue

- Go to [Issues](https://github.com/YOUR_USERNAME/sahidawa-india/issues)
- Filter by label: `good-first-issue` (beginners), `intermediate`, `advanced`, `ml`, `i18n`, `agent`
- Read the issue fully, including the **Acceptance Criteria** section
- Comment: _"I'd like to work on this"_
- Wait for a maintainer to assign it to you (usually within 12 hours)

> **Do not submit a PR for an unassigned issue.** We work this way to avoid duplicate effort.

### Step 2 — Fork and clone

```bash
# Fork the repo on GitHub, then:
git clone https://github.com/YOUR_USERNAME/sahidawa-india.git
cd sahidawa-india
git remote add upstream https://github.com/ORIGINAL_OWNER/sahidawa-india.git
```

### Step 3 — Create a branch

```bash
# Always branch from main
git checkout main
git pull upstream main
git checkout -b feat/your-feature-name
# or: fix/your-bugfix-name
# or: i18n/tamil-translation
# or: docs/setup-guide
```

### Step 4 — Make your changes

Follow the [Coding Standards](#coding-standards) below.

### Step 5 — Test your changes

```bash
# Frontend tests
cd apps/web && npm run test

# API tests
cd apps/api && npm run test

# ML service tests
cd apps/ml && pytest

# Lint check
npm run lint
```

### Step 6 — Commit and push

```bash
git add .
git commit -m "feat(scanner): add barcode decode for QR codes"
git push origin feat/your-feature-name
```

### Step 7 — Open a Pull Request

- Go to your fork on GitHub
- Click **Compare & pull request**
- Fill out the PR template completely
- Link the issue: `Closes #123`
- Wait for review — we respond within 24 hours

---

## Development Setup

### Requirements

| Tool    | Version    | Install                            |
| ------- | ---------- | ---------------------------------- |
| Node.js | >= 18.0.0  | [nodejs.org](https://nodejs.org)   |
| Python  | >= 3.10    | [python.org](https://python.org)   |
| Docker  | >= 24.0    | [docker.com](https://docker.com)   |
| Git     | Any recent | [git-scm.com](https://git-scm.com) |
| Supabase CLI | Latest | [supabase.com](https://supabase.com/docs/guides/cli/getting-started) |

### Environment Variables

Copy `.env.example` to `.env.local` (frontend) and `.env` (API). You need:

```bash
# Supabase — free at supabase.com (no credit card)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Cloudinary — free at cloudinary.com
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Redis — free at upstash.com (no credit card)
UPSTASH_REDIS_REST_URL=your_redis_url
UPSTASH_REDIS_REST_TOKEN=your_token
```

> **For i18n contributors (translations):** You do NOT need any environment variables. Just edit the JSON file and run `npm run dev`.

### Running with Docker (Recommended)

```bash
cp .env.example .env
# Fill in your keys, then:
docker compose -f docker-compose.dev.yml up --build
```

### Running manually

```bash
# Terminal 1 — Local Database (Supabase)
# Ensure Docker is running in the background first
npx supabase start

# Terminal 2 — Frontend
cd apps/web
npm install
npm run dev          # http://localhost:3000

# Terminal 2 — API
cd apps/api
npm install
npm run dev          # http://localhost:4000

# Terminal 3 — ML Service (optional for Phase 1/2 work)
cd apps/ml
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## ⚠️ Troubleshooting npm install Failures

If you encounter `No matching version found` errors while running `npm install`, it may be caused by the canary package versions currently used in this project.

Try running:

```bash
npm install --legacy-peer-deps
```

or:

```bash
npm install --force
```

If the issue still persists, you may temporarily downgrade package versions locally to get the project running on your machine.

> ⚠️ Important:
> Do not commit modified `package.json` or `package-lock.json` files created during local downgrades. Revert those changes before pushing your PR.

---

## Contribution Types

### 🟢 Beginner — Great for first-time open source contributors

#### Translation (i18n)

Each Indian language has a dedicated issue. Pick one unclaimed language.

1. Open `apps/web/messages/en.json`
2. Copy the entire file
3. Create `apps/web/messages/[language-code].json`
4. Translate every value (keep the keys in English — only translate values)
5. Do NOT translate: URLs, component names, variable placeholders like `{count}`

Example:

```json
// en.json
{ "scan.button": "Scan Medicine", "scan.result.real": "This medicine is REAL" }

// ta.json (Tamil)
{ "scan.button": "மருந்தை ஸ்கேன் செய்யுங்கள்", "scan.result.real": "இந்த மருந்து உண்மையானது" }
```

#### UI Components

- Pick a component issue labeled `good-first-issue` + `frontend`
- All components go in `apps/web/components/`
- Use shadcn/ui primitives wherever possible
- Must be accessible (keyboard navigable, proper ARIA labels)

#### Documentation

- Fix typos, improve explanations, add usage examples
- All docs are Markdown files in `docs/`

#### Database Seeds

- Add medicine entries to `data/seeds/medicines.csv`
- Format: `batch_number,brand_name,generic_name,manufacturer,strength,form`
- Source only from [official CDSCO drug database](https://cdsco.gov.in/opencms/opencms/en/consumer/Know-your-medicine/)

---

### 🟡 Intermediate

#### Barcode Scanner Integration

- Uses `@zxing/browser` library
- Component: `apps/web/components/scanner/`
- Must work on mobile Chrome and Safari
- Needs to handle: Code128, QR Code, EAN-13, EAN-8 formats

#### Pharmacy Map

- Uses Leaflet.js + OpenStreetMap
- Backend: PostGIS `ST_DWithin` query to find pharmacies within radius
- Component: `apps/web/components/map/`
- Must work offline (tiles cached by Workbox)

#### Cloudinary Integration

- Photo upload component for reporting suspicious medicines
- Use Cloudinary's upload widget or direct API
- Store: `cloud_name/sahidawa/reports/{medicine_batch}_{timestamp}`
- See [Cloudinary docs](https://cloudinary.com/documentation/upload_widget)

#### API Routes

- All routes in `apps/api/src/routes/`
- Use TypeScript — no `any` types
- Every route needs: input validation (Zod), error handling, rate limiting
- Write tests in `apps/api/tests/`

---

### 🔴 Advanced

#### Medicine Image Classifier (TF Lite)

- Training data: Cloudinary photo submissions
- Task: Binary classification — real packaging vs suspicious/fake
- Target: TF Lite model running on-device (< 5MB)
- See `apps/ml/models/` for model structure

#### Whisper Voice Integration

- Self-hosted Whisper endpoint in FastAPI (`apps/ml/routers/voice.py`)
- Accept audio blob from browser MediaRecorder API
- Return transcript + detected language
- Handle all 22 Indian scheduled languages

#### LangChain RAG Health Assistant

- Knowledge base: NHP drug monographs + CDSCO guidelines (chunked + embedded)
- Vector store: pgvector in Supabase
- LLM: Sarvam AI (Indian language aware)
- Output: Triage recommendation + nearest doctor/pharmacy
- See `apps/ml/services/rag/`

#### CDSCO Alert Monitoring Agent

- LangChain agent that polls CDSCO every 6 hours
- Tools: `fetch_cdsco_alerts`, `lookup_medicine_db`, `send_district_notification`
- Runs as a cron job in `apps/ml/agent/`
- This is the GSSoC **Agents for India Track** flagship feature

---

## Coding Standards

### TypeScript / JavaScript

```typescript
// ✅ Good — typed, descriptive, handles errors
async function verifyMedicine(
  batchNumber: string,
): Promise<VerificationResult> {
  if (!batchNumber || batchNumber.length < 4) {
    throw new ValidationError("Invalid batch number");
  }
  // ...
}

// ❌ Bad — untyped, vague name, no error handling
async function check(b: any) {
  // ...
}
```

- Use TypeScript everywhere — no `any` types
- Use `async/await` over `.then()` chains
- All functions must have JSDoc comments for public APIs
- Use `zod` for all API input validation
- Prefer `const` over `let`, never use `var`

### Python (ML Service)

```python
# ✅ Good — typed hints, docstring, handles exceptions
def decode_barcode(image_bytes: bytes) -> BarcodeResult | None:
    """
    Decode a barcode or QR code from raw image bytes.

    Args:
        image_bytes: Raw image data as bytes

    Returns:
        BarcodeResult with format and value, or None if no barcode found
    """
    try:
        # ...
    except Exception as e:
        logger.error(f"Barcode decode failed: {e}")
        return None
```

- Use Python type hints everywhere
- Write docstrings for all public functions
- Use `pydantic` for request/response models in FastAPI
- All ML models must have evaluation metrics documented

### CSS / Tailwind

- Use Tailwind utility classes only — no custom CSS unless unavoidable
- Mobile-first responsive design
- Test on 320px wide viewport (minimum)
- All interactive elements must have focus states

---

## Commit Message Format

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>

[optional body]

[optional footer: Closes #issue-number]
```

**Types:**
| Type | Use For |
|------|---------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `i18n` | Translation / language files |
| `style` | Code formatting, no logic change |
| `refactor` | Code restructure, no feature/fix |
| `test` | Adding or fixing tests |
| `chore` | Build process, dependencies |
| `perf` | Performance improvement |
| `agent` | AI agent-related changes |

**Examples:**

```bash
feat(scanner): add QR code support to barcode decoder
fix(map): correct pharmacy pin location offset on mobile
i18n(tamil): add complete Tamil translation for scanner UI
docs(setup): add Docker setup instructions for Windows
agent(cdsco): implement 6-hour CDSCO alert polling loop
test(api): add unit tests for medicine verification endpoint
```

---

## Pull Request Guidelines

### Before submitting

- [ ] My branch is up-to-date with `main` (`git pull upstream main`)
- [ ] I have formatted my code using Prettier (`npx prettier --write .`)
- [ ] All tests pass (`npm run test` and/or `pytest`)
- [ ] Lint passes (`npm run lint`)
- [ ] I have tested on mobile viewport (Chrome DevTools)
- [ ] I have written tests for new functionality
- [ ] I have updated documentation if needed
- [ ] My commit messages follow the Conventional Commits format

### PR Title Format

Same as commit messages:

```
feat(scanner): add ZXing barcode scanner component
```

### PR Description

Use the PR template (`.github/PULL_REQUEST_TEMPLATE.md`). Do not skip sections.

Always include:

- What you changed and why
- Screenshot/video for UI changes
- `Closes #issue-number`

### Review process

1. A maintainer reviews within **24 hours**
2. You may get change requests — address them and re-request review
3. Minimum 1 approving review required to merge
4. Maintainer merges (contributors do not merge their own PRs)

---

## Issue Guidelines

### Before opening a new issue

1. Search existing issues to avoid duplicates
2. Check the [Project Roadmap](./README.md#roadmap--phases)

### Bug Reports

Use the bug report template. Include:

- Steps to reproduce (numbered, specific)
- Expected behaviour
- Actual behaviour
- Browser + OS version
- Screenshot or screen recording if applicable

### Feature Requests

Use the feature request template. Include:

- Problem you're solving (not just the solution)
- Who benefits from this feature
- Rough implementation idea (optional)

---

## GSSoC 2026 Contributors

Welcome! A few things specific to GSSoC:

### Getting points

Points are awarded per merged PR based on complexity:

- `good-first-issue` PRs → lower complexity score
- `intermediate` PRs → medium score
- `advanced` / `ml` / `agent` PRs → higher score
- **Cloudinary bounty PRs** → bonus GSSoC leaderboard points (see [Cloudinary bounty issues](#))

### Rules for GSSoC

- One issue per contributor at a time — finish it before claiming another
- Do not open spam PRs (typo fixes, single character changes without an issue)
- AI-generated code is allowed only if you understand it, test it, and it works correctly
- If you use AI to generate code, disclose it in your PR description

### Getting unstuck

- Check `docs/` first
- Ask in the `#help` channel on our Discord
- Comment on the issue with your specific question
- Do not DM maintainers for help — ask publicly so everyone benefits

---

## Getting Help

| Channel                                                                           | For                                  |
| --------------------------------------------------------------------------------- | ------------------------------------ |
| [GitHub Issues](https://github.com/YOUR_USERNAME/sahidawa-india/issues)           | Bug reports, feature requests        |
| [GitHub Discussions](https://github.com/YOUR_USERNAME/sahidawa-india/discussions) | Questions, ideas, general discussion |
| [Discord #help](#)                                                                | Quick questions during development   |
| [Discord #introductions](#)                                                       | Introduce yourself to the team       |

---

_Thank you for contributing to SahiDawa. You're helping protect real people from fake medicines._ 🙏
