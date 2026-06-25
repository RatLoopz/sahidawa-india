# SahiDawa Issue Drafts

These are four new issue proposals for the SahiDawa project. Each draft follows the repository's GitHub issue templates and is intentionally chosen to avoid duplication of the current open issues.

---

## Issue 1 — Bug

**Title:** [BUG] Compare Medicine page resets selected medicines after back navigation

**Which part of SahiDawa is broken?**
- Frontend — Next.js UI (apps/web)

**Bug Description**
When I select two medicines on the Compare Medicine page and then use the browser back button or navigate away briefly, the selected medicines are sometimes cleared when I return. This breaks the comparison workflow and forces users to start over.

**Expected Behavior**
The Compare Medicine page should preserve the selected medicines during browser navigation and only reset when the user explicitly changes the selection.

**Screenshots**
[Insert screenshot showing the compare page selection before and after navigation]

**GSSoC 2026**
I am a GSSoC 2026 participant and would like to fix this bug.

**Code of Conduct**
I have read and agree to SahiDawa's [Code of Conduct](https://github.com/RatLoopz/sahidawa-india/blob/main/CODE_OF_CONDUCT.md).

---

## Issue 2 — Bug

**Title:** [BUG] Pharmacy search API fails to match multi-word medicine names

**Which part of SahiDawa is broken?**
- Backend — Express API (apps/api)

**Bug Description**
The pharmacy search API returns valid results for simple queries, but it returns inconsistent or incomplete results when the search term contains multiple words or punctuation (for example, searching a generic medicine name with a brand qualifier). This causes pharmacies stocking the right item to be omitted from results.

**Expected Behavior**
The pharmacy search endpoint should support multi-word medicine queries and return relevant pharmacies for normal user search phrases.

**Screenshots**
[Insert screenshot or request/response example showing the inconsistent pharmacy search behavior]

**GSSoC 2026**
I am a GSSoC 2026 participant and would like to fix this bug.

**Code of Conduct**
I have read and agree to SahiDawa's [Code of Conduct](https://github.com/RatLoopz/sahidawa-india/blob/main/CODE_OF_CONDUCT.md).

---

## Issue 3 — Performance

**Title:** [Performance] Medicine search results render slowly on low-end mobile devices

**🔍 Have You Searched Existing Issues?**
I have searched the existing issues to avoid duplicates.

**📉 Describe the Performance Issue**
The medicine search and results page in apps/web becomes slow and laggy on low-end mobile devices. The delay is noticeable when typing the query and while scrolling the result list, suggesting the current client-side rendering or filtering approach is too heavy.

**🧪 Environment Details**
- OS: Android 12
- Browser: Chrome Mobile
- Device: Low-end smartphone with limited CPU/RAM
- App area: Medicine search / results page in apps/web

**🔁 Steps to Reproduce**
1. Open the SahiDawa web app on a low-end mobile device.
2. Go to the medicine search page.
3. Type a search query with 3+ characters.
4. Observe the search result rendering delay and scrolling stutter.

**📋 Logs / Screenshots (Optional)**
[Insert logs or screenshots showing the slow search rendering or browser performance timing]

**🙌 Contributor Checklist**
- I agree to follow this project's Code of Conduct
- I want to work on this issue
- I am a GSSOC'26 contributor

---

## Issue 4 — Feature

**Title:** [FEATURE] Add a guided onboarding card for the voice triage flow

**Which area does this feature belong to?**
- ML / AI — Voice, OCR, LangChain (apps/ml)

**Estimated Difficulty**
- 🟡 Intermediate — Some experience needed

**What problem does this solve?**
Many users may not understand how to start and stop the voice triage feature or which languages are supported. Without clear inline guidance, first-time users can get stuck on the voice recording flow.

**Proposed Solution**
Add a contextual onboarding card or tooltip on the voice triage page that explains how to begin recording, how to stop, supported languages, and what to do if the microphone permission prompt appears. The card should be dismissible and should not block the main chat interface.

**Acceptance Criteria**
- A "How to use voice triage" card appears on the voice triage screen for first-time users.
- The card explains start/stop recording, supported languages, and next steps clearly.
- The card can be dismissed and remains hidden once dismissed.
- The voice triage UI still loads normally and the feature remains fully functional.

**GSSoC 2026**
I am a GSSoC 2026 participant and would like to implement this feature.

**Code of Conduct**
I have read and agree to SahiDawa's [Code of Conduct](https://github.com/RatLoopz/sahidawa-india/blob/main/CODE_OF_CONDUCT.md).
