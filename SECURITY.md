# Security Policy

## Supported Versions

The following versions of SahiDawa currently receive security updates:

| Version | Supported          |
| ------- | ------------------ |
| `main` (latest) | ✅ Active support |
| Older branches  | ❌ No support      |

> SahiDawa is currently in active development (pre-release). We recommend always using the latest code from the `main` branch.

---

## Reporting a Vulnerability

We take security seriously — especially given that SahiDawa handles **sensitive health and medicine data** for millions of citizens.

**Please do NOT report security vulnerabilities via public GitHub Issues.**

### How to Report

1. **Preferred method:** Use [GitHub's Private Security Disclosure](https://github.com/RatLoopz/sahidawa-india/security/advisories/new) to submit a confidential report.
2. **Alternative:** Email the maintainers directly at the contact listed in the repository profile or Discord.

### What to Include in Your Report

Please provide as much of the following as possible to help us understand and reproduce the issue:

- A clear description of the vulnerability
- Steps to reproduce (proof of concept if available)
- The potential impact (data exposure, authentication bypass, etc.)
- Affected component (frontend, API, ML service, database, etc.)
- Any suggested mitigation or fix

### What to Expect

| Stage | Timeline |
|-------|----------|
| Initial acknowledgement | Within **48–72 hours** |
| Status update | Within **7 days** |
| Patch / resolution | Depends on severity (critical: ASAP, others: within 30 days) |

We will keep you informed throughout the process and credit you in the release notes (unless you prefer to remain anonymous).

---

## Scope

The following are **in scope** for security reports:

- Authentication or authorization flaws
- SQL injection, XSS, or other injection vulnerabilities
- Exposure of sensitive medicine or health data
- Insecure API endpoints (e.g., unauthenticated access to drug data)
- Dependency vulnerabilities with a direct exploit path
- Broken access control in Supabase RLS policies

The following are **out of scope**:

- Rate limiting on non-sensitive endpoints
- Issues on third-party services (Supabase, Vercel, Railway) that are not within our control
- Theoretical vulnerabilities with no practical exploit
- Issues in development/local-only environments

---

## Security Best Practices in SahiDawa

SahiDawa is built with the following security principles:

- **No sensitive data sold or shared** — SahiDawa is 100% ad-free and never monetizes user health data
- **Supabase Row Level Security (RLS)** — Database access is scoped per user/role
- **Environment variables** — All secrets (API keys, DB URLs) are stored in `.env` and never committed (see `.env.example`)
- **Input validation** — All user-submitted medicine scan data and symptom reports are validated server-side
- **Minimal data collection** — We collect only what is necessary to provide the service
- **Open source transparency** — All code is public and auditable by the community

---

## Disclosure Policy

We follow **Coordinated Disclosure**:

1. Reporter submits the vulnerability privately
2. We confirm, investigate, and develop a fix
3. We release the fix and notify the reporter
4. A public disclosure (GitHub Security Advisory) is published after the patch is live

We kindly ask reporters to allow us a reasonable time to patch before any public disclosure.

---

## Contact

For non-urgent security questions, you can also reach us on the [SahiDawa Discord](https://discord.gg/sahidawa) in the `#security` channel.

---

*Thank you for helping keep SahiDawa safe for 1.4 billion Indians. 🇮🇳*