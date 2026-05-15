## 📋 PR Summary

Added Progressive Web App (PWA) support to make SahiDawa installable on Android devices with proper manifest configuration, theme integration, and installable icons.

---

## 🔗 Related Issue

Closes #33

---

## 🏷️ PR Type

* [✓] 🐛 Bug Fix
* [✓] ✨ New Feature / Enhancement
* [ ] 📖 Documentation
* [ ] 🌏 Translation (i18n)
* [✓] 🎨 UI / UX Improvement
* [ ] ⚙️ DevOps / CI-CD
* [ ] 🤖 ML / AI Feature
* [ ] 🔒 Security Fix
* [ ] ♻️ Refactor / Code Quality

---

## 🗂️ Area Changed

* [✓] `apps/web` — Next.js Frontend
* [ ] `apps/api` — Node.js / Express Backend
* [ ] `apps/ml` — Python / FastAPI ML Service
* [ ] `data/` — Database seeds / migrations
* [ ] `docs/` — Documentation
* [ ] `.github/` — GitHub config, workflows
* [ ] Root config (package.json, etc.)

---

## 📝 What Was Done

* Added `manifest.json` for PWA support
* Added installable app icons (192x192 and 512x512)
* Linked manifest in `app/[locale]/layout.tsx`
* Added theme color metadata and viewport configuration
* Verified manifest and installability in browser DevTools
* Tested Lighthouse audit and PWA compatibility

---

## 📸 Screenshots / Demo

* Lighthouse audit screenshot
* Manifest validation screenshot
* Install App / Add to Home Screen screenshot

---

## ✅ Contributor Checklist

* [✓] My PR has a linked issue (see above)
* [✓] I have pulled the latest `main` and rebased/merged before this PR
* [✓] My code follows the patterns in `docs/code-guide.md`
* [✓] I ran `npm run dev -w web` (frontend) or `npm run dev -w api` (backend) — no build errors
* [✓] For backend: All responses return structured JSON `{ success, data, error }`
* [✓] Screenshots/test output added (for UI or API changes)
* [✓] I have performed a self-review of my own code

---

## 🎓 GSSoC 2026

* [✓] I am a GSSoC 2026 participant