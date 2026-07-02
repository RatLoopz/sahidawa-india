# PR #2991 — feat(i18n): localize ABHA Records & fix regional translation JSON structures

> **Merged:** 2026-07-02 | **Author:** @naborajs | **Area:** i18n | **Impact Score:** 62 | **Closes:** #2907

## What Changed

We localized all hardcoded English strings on the ABHA (Ayushman Bharat Health Account) Records page using the `next-intl` library. We introduced a new `"AbhaRecords"` translation namespace across all 19 regional Indian language JSON files. Additionally, we resolved critical syntax errors (missing closing braces and commas) in several upstream regional translation files to ensure valid JSON parsing and successful production builds.

## The Problem Being Solved

SahiDawa is designed to serve rural Indian populations, making comprehensive regional language support a core requirement. Prior to this PR, the ABHA Records page (`apps/web/app/[locale]/abha-records/page.tsx`) contained hardcoded English strings for critical UI elements, such as page headers, loading states, error messages, and empty states. This excluded non-English speaking users from managing their digital health records. 

Furthermore, several regional language JSON files in `apps/web/messages/` contained syntax errors—specifically, missing closing braces and commas before the `"NotFound"` and `"Settings"` blocks. These syntax errors broke JSON parsing, risking runtime crashes and blocking successful Next.js production builds.

## Files Modified

- `apps/web/app/[locale]/abha-records/page.tsx`
- `apps/web/messages/as.json`
- `apps/web/messages/bn.json`
- `apps/web/messages/en.json`
- `apps/web/messages/gu.json`
- `apps/web/messages/hi.json`
- `apps/web/messages/kn.json`
- `apps/web/messages/kok.json`
- `apps/web/messages/ks.json`
- `apps/web/messages/mai.json`
- `apps/web/messages/ml.json`
- `apps/web/messages/mni.json`
- `apps/web/messages/mr.json`
- `apps/web/messages/or.json`
- `apps/web/messages/pa.json`
- `apps/web/messages/sa.json`
- `apps/web/messages/sd.json`
- `apps/web/messages/ta.json`
- `apps/web/messages/te.json`
- `apps/web/messages/ur.json`

## Implementation Details

### 1. Frontend Localization with `next-intl`
In `apps/web/app/[locale]/abha-records/page.tsx`, we integrated the `useTranslations` hook from `next-intl` to dynamically render localized strings based on the active locale:

```tsx
import { useTranslations } from "next-intl";

export default function ABHARecordsPage() {
    const t = useTranslations("AbhaRecords");
    // ...
```

We replaced the hardcoded strings with key-based translation lookups:
- `"Back to Profile"` $\rightarrow$ `{t("backToProfile")}`
- `"ABHA Records"` $\rightarrow$ `{t("title")}`
- `"Loading records..."` $\rightarrow$ `{t("loading")}`
- `"No prescriptions found."` $\rightarrow$ `{t("noPrescriptions")}`
- `"Failed to load records"` $\rightarrow$ `t("failedToLoad")` (used inside the catch block of the `getABHAPrescriptions` API call)

We also added `t` to the dependency array of the `useEffect` hook that fetches the records to ensure correct hook dependency tracking and prevent stale translation references.

### 2. JSON Syntax Corrections
We corrected structural syntax errors in the regional translation files (such as `as.json`, `bn.json`, `gu.json`, `kn.json`, `kok.json`, `ks.json`, etc.). We added missing closing braces and commas to properly close preceding blocks before declaring the `"NotFound"` and `"Settings"` blocks:

```json
    },
    "NotFound": {
        "badge": "404 Error",
        ...
    },
```

### 3. Namespace Propagation
We appended the new `"AbhaRecords"` namespace to all 19 regional language files, translating the keys (`backToProfile`, `title`, `loading`, `noPrescriptions`, `failedToLoad`) into Assamese (`as`), Bengali (`bn`), English (`en`), Gujarati (`gu`), Hindi (`hi`), Kannada (`kn`), Konkani (`kok`), Kashmiri (`ks`), Maithili (`mai`), Malayalam (`ml`), Manipuri (`mni`), Marathi (`mr`), Odia (`or`), Punjabi (`pa`), Sanskrit (`sa`), Sindhi (`sd`), Tamil (`ta`), Telugu (`te`), and Urdu (`ur`).

## Technical Decisions

- **Namespace Isolation:** We created a dedicated `"AbhaRecords"` namespace rather than reusing generic keys. This isolates the page's copy, allowing translators to provide context-specific medical terminology without affecting other parts of the application.
- **Strict JSON Validation:** We chose to run a Node.js-based inline validation script in our local testing workflow to parse every JSON file. This ensures that any syntax regressions are caught immediately before code reaches the CI/CD pipeline.
- **Dependency Array Inclusion:** Including `t` in the `useEffect` dependency array ensures compliance with React's `exhaustive-deps` linting rules, preventing potential stale closure bugs if the locale changes dynamically.

## How To Re-Implement (Contributor Reference)

If you need to localize a new page or add a new namespace to our translation system, follow these steps:

1. **Identify Hardcoded Strings:** Locate all user-facing text nodes, placeholder text, and error messages in your target component.
2. **Import and Initialize Hook:**
   ```tsx
   import { useTranslations } from "next-intl";
   
   // Inside your component:
   const t = useTranslations("YourNewNamespace");
   ```
3. **Replace UI Strings:** Replace static text with `{t("yourKey")}`. For dynamic error messages inside `try/catch` blocks, use `t("errorKey")`.
4. **Update Effects:** If `t` is used inside a `useEffect` hook, ensure `t` is added to the dependency array:
   ```tsx
   useEffect(() => {
       // logic using t
   }, [t]);
   ```
5. **Update Translation Files:** 
   Open `apps/web/messages/en.json` and add your new namespace block:
   ```json
   "YourNewNamespace": {
       "yourKey": "English Translation"
   }
   ```
   Replicate this block across all other 18 regional JSON files (e.g., `hi.json`, `bn.json`, etc.) with their respective translations.
6. **Validate JSON Syntax:**
   Run the following command to ensure no syntax errors (like missing commas or braces) were introduced:
   ```bash
   node -e "const fs = require('fs'); const path = require('path'); fs.readdirSync('./apps/web/messages').forEach(f => { if(f.endsWith('.json')) JSON.parse(fs.readFileSync(path.join('./apps/web/messages', f), 'utf8')); }); console.log('All parsed successfully!')"
   ```
7. **Verify Build:** Run `npx turbo run build` to verify that Next.js compiles the localized routes successfully.

## Impact on System Architecture

This change strengthens our internationalization architecture by ensuring that the ABHA Records module is fully integrated into our regionalization pipeline. By fixing the structural JSON syntax errors, we have stabilized our translation parsing engine, preventing build-time failures across all localized routes (`/[locale]/*`). This establishes a clean, error-free baseline for future localization efforts.

## Testing & Verification

- **Syntax Verification:** We validated all 19 regional JSON files using an inline Node.js script that reads and executes `JSON.parse()` on each file. All files parsed successfully with zero syntax errors.
- **Build Verification:** We executed a local production build using `npx turbo run build`, which completed successfully with no TypeScript, compilation, or translation-related errors.
- **Manual UI Testing:** We verified the ABHA Records page locally (`npm run dev`) by switching between different locales (e.g., English and Bengali) and confirming that all elements—including the back link, page title, loading state, empty state, and error boundaries—rendered with their correct regional translations.