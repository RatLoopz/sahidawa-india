# PR #773 — fix(web): enable Kannada and Punjabi locales

> **Merged:** 2026-05-27 | **Author:** @shashank03-dev | **Area:** Frontend | **Impact Score:** 22 | **Closes:** #755

## What Changed

This pull request enables full internationalization (i18n) support for Kannada (`kn`) and Punjabi (`pa`) locales within the `apps/web` Next.js frontend. We updated the `next-intl` routing configuration, the Next.js middleware proxy matcher, and the `LanguageSwitcher` component to display these languages. Additionally, we extended the chat API's locale support for system prompts and introduced a new Jest test suite to ensure proper i18n configuration and UI rendering for these new locales.

## The Problem Being Solved

Prior to this PR, while message files for Kannada and Punjabi might have existed in our `apps/web/messages` directory, these locales were not integrated into the application's routing, language selection UI, or backend API's language-aware processing. Users attempting to access `/kn` or `/pa` routes would encounter routing errors, and the language switcher would not offer these options. Furthermore, our AI chat system would not correctly identify and utilize these locales for generating language-specific responses, leading to a fragmented or non-existent user experience for Kannada and Punjabi speakers. This PR resolves these integration gaps, making these languages fully accessible and functional across the platform.

## Files Modified

- `apps/web/app/[locale]/LanguageSwitcher.tsx`
- `apps/web/app/api/chat/route.ts`
- `apps/web/i18n/routing.ts`
- `apps/web/proxy.ts`
- `apps/web/tests/chat-route.test.ts`
- `apps/web/tests/i18n-locales.test.tsx`

## Implementation Details

The implementation involved modifications across several key areas of our `apps/web` application to integrate Kannada and Punjabi:

1.  **`apps/web/i18n/routing.ts`**: We updated the `locales` array within the `defineRouting` configuration from `next-intl/routing`. The `kn` and `pa` locale codes were appended to the existing list, allowing `next-intl` to recognize and handle incoming requests for these language paths (e.g., `/kn`, `/pa`). This is fundamental for `next-intl` to correctly route and load locale-specific messages.

2.  **`apps/web/proxy.ts`**: Our Next.js middleware uses `createMiddleware(routing)` to handle i18n routing. The `config.matcher` regex was updated to include `kn` and `pa` in the list of matched internationalized path segments. Specifically, the regex `/(ta|en|bn|te|mr|gu|ur|od|hi)/:path*` was extended to `/(ta|en|bn|te|mr|gu|ur|od|hi|kn|pa)/:path*`. This ensures that requests to `/kn` or `/pa` (and their sub-paths) are correctly intercepted and processed by our i18n middleware, preventing 404 errors for these routes.

3.  **`apps/web/app/[locale]/LanguageSwitcher.tsx`**:
    *   The `languages` array, which defines the options available in the UI's language dropdown, was extended. New objects `{ code: "kn", label: "Kannada", native: "ಕನ್ನಡ" }` and `{ code: "pa", label: "Punjabi", native: "ਪੰਜਾਬੀ" }` were added. This makes Kannada and Punjabi visible and selectable to users in the frontend.
    *   A minor refactor was performed by removing the unused `useTranslations` import. This was a cleanup as the component only needed `useLocale` and did not directly use translation keys within its rendering logic for the language labels themselves, which are hardcoded in the `languages` array.

4.  **`apps/web/app/api/chat/route.ts`**:
    *   The `supportedLocales` array, which dictates which locales our AI chat API can explicitly handle for system prompts, was updated to include `"pa"`. Kannada (`"kn"`) was already present from a previous change, but Punjabi was missing.
    *   The `localeMap` object, which maps locale codes to their full English names for use in the AI model's system instruction, was extended with `pa: "Punjabi"`. This ensures that when a chat request is made with `locale: "pa"`, the Gemini model receives a system instruction that explicitly guides it to respond in Punjabi.

5.  **`apps/web/tests/chat-route.test.ts`**: A new Jest test case was added to verify the chat API's handling of the Punjabi locale. This test simulates a `POST` request to `/api/chat` with `locale: "pa"` and asserts that the `generateContentMock` (representing our AI model interaction) is called with a `systemInstruction` containing the string "Punjabi". This confirms that our backend correctly identifies the Punjabi locale and passes the appropriate language context to the AI model.

6.  **`apps/web/tests/i18n-locales.test.tsx`**: A new dedicated Jest test suite was introduced to provide comprehensive regression testing for i18n locale availability:
    *   It uses `it.each` to iterate over `["kn", "pa"]` and asserts that `routing.locales` (from `apps/web/i18n/routing.ts`) contains each of these locales. This verifies that `next-intl` is configured to recognize them.
    *   Another test case asserts that every locale defined in `routing.locales` is also present in the `proxyConfig.matcher`. This ensures consistency between our `next-intl` routing and the Next.js middleware's path matching, preventing unhandled routes.
    *   A third `it.each` test verifies the `LanguageSwitcher` component. It renders the component to static markup for `kn` and `pa` locales (by mocking `useLocale`) and asserts that the native language label (e.g., "ಕನ್ನಡ" for `kn`, "ਪੰਜਾਬੀ" for `pa`) is present in the rendered HTML. This confirms that the UI correctly displays the new language options with their native names.

## Technical Decisions

Our primary technical decision was to leverage the existing `next-intl` library for frontend internationalization, which provides robust routing and message management. By extending its `defineRouting` configuration in `apps/web/i18n/routing.ts`, we ensure that locale-aware URLs are handled consistently.

The use of `apps/web/proxy.ts` with `createMiddleware` is a standard Next.js pattern for applying middleware logic, including i18n routing, to specific path patterns. Updating the `matcher` regex in `proxy.ts` was a deliberate choice to ensure that the Next.js server correctly intercepts and processes requests for `/kn` and `/pa` paths before they hit the application's page rendering logic, preventing 404s.

For the `LanguageSwitcher.tsx`, directly adding the new locales to the `languages` array was the most straightforward approach, as these are static definitions for the UI. The removal of the unused `useTranslations` import was a minor code quality improvement, adhering to best practices of removing dead code.

In the `apps/web/app/api/chat/route.ts`, extending the `supportedLocales` array and `localeMap` was crucial. This design ensures that our AI model receives explicit language context, which is vital for generating accurate and culturally relevant responses. Without this, the model might default to English or produce less optimal output.

Finally, the decision to add comprehensive Jest tests in `apps/web/tests/chat-route.test.ts` and the new `apps/web/tests/i18n-locales.test.tsx` was critical for maintaining code quality and preventing regressions. These tests validate the correct configuration of routing, proxy matching, and UI rendering, providing confidence that future changes won't inadvertently break i18n support for these or other locales. We chose Jest for its integration with our existing testing setup and its capabilities for mocking and snapshot testing.

## How To Re-Implement (Contributor Reference)

To re-implement or add a new locale to the SahiDawa web platform, a contributor would follow these steps:

1.  **Create Message Files**: First, ensure you have the necessary JSON message files for the new locale (e.g., `kn.json`, `pa.json`) in the `apps/web/messages` directory, containing all required translation keys.
2.  **Update `next-intl` Routing**:
    *   Open `apps/web/i18n/routing.ts`.
    *   Locate the `locales` array within `defineRouting`.
    *   Add the new locale code (e.g., `'xx'`) to this array: `locales: ['en', ..., 'xx']`.
3.  **Update Next.js Middleware Proxy**:
    *   Open `apps/web/proxy.ts`.
    *   Locate the `matcher` array in the `config` object.
    *   Find the regex that matches internationalized pathnames (e.g., `/(ta|en|...)/:path*`).
    *   Add the new locale code to this regex pattern: `matcher: ['/', '/(ta|en|...|xx)/:path*']`.
4.  **Update Language Switcher UI**:
    *   Open `apps/web/app/[locale]/LanguageSwitcher.tsx`.
    *   Locate the `languages` array.
    *   Add a new object for the locale, including its code, English label, and native script label: `{ code: "xx", label: "New Language", native: "ਨਵੀਂ ਭਾਸ਼ਾ" }`.
    *   If `useTranslations` is imported but not used, consider removing it for cleanup.
5.  **Update Chat API Locale Support (if applicable)**:
    *   Open `apps/web/app/api/chat/route.ts`.
    *   Add the new locale code to the `supportedLocales` array.
    *   Add an entry to the `localeMap` object, mapping the locale code to its English name (e.g., `xx: "New Language"`). This ensures the AI model receives proper context.
6.  **Add/Update Tests**:
    *   For frontend i18n configuration, create or update a test file like `apps/web/tests/i18n-locales.test.tsx`.
        *   Add assertions to check if `routing.locales` contains the new locale.
        *   Verify that the `proxyConfig.matcher` regex includes the new locale.
        *   Add a test case to render the `LanguageSwitcher` and assert that the native label for the new locale is present in the markup.
    *   For backend API locale support, update `apps/web/tests/chat-route.test.ts`.
        *   Add a new `it` block to test the chat API with the new locale, asserting that the AI model's system instruction contains the correct language name.
7.  **Verify Locally**:
    *   Run `npm run build -w web` to ensure the project compiles.
    *   Run `npm run test -w web` to execute all tests.
    *   Start the development server (`npm run dev -w web`).
    *   Navigate to `http://localhost:3001/xx` (replace `xx` with your locale code) and confirm the page loads correctly.
    *   Check the language switcher dropdown in the UI to confirm the new language is listed and selectable.
    *   Test the chat functionality with the new locale selected to ensure AI responses are in the correct language.

## Impact on System Architecture

This change significantly enhances the internationalization capabilities of the SahiDawa web platform, moving us closer to our goal of serving diverse linguistic communities across India. By fully enabling Kannada and Punjabi, we expand our user reach and improve accessibility for millions of potential users.

Architecturally, this PR reinforces our `next-intl`-based i18n strategy, demonstrating its extensibility for adding new languages with minimal structural changes. It solidifies the pattern of updating three core areas for each new locale:
1.  **Routing Configuration**: `apps/web/i18n/routing.ts` and `apps/web/proxy.ts` for URL handling.
2.  **User Interface**: `apps/web/app/[locale]/LanguageSwitcher.tsx` for discoverability.
3.  **Backend AI Integration**: `apps/web/app/api/chat/route.ts` for intelligent, language-aware responses.

This consistent pattern simplifies future locale additions. The introduction of `apps/web/tests/i18n-locales.test.tsx` also establishes a robust testing framework for i18n, ensuring that our multilingual support remains stable and prevents regressions as the platform evolves. This strengthens our overall system's resilience and maintainability for internationalization.

## Testing & Verification

This change was thoroughly tested and verified through a combination of automated and manual checks:

1.  **Automated Unit Tests**:
    *   `npm run test -w web -- --runInBand` was executed, resulting in `17 passed, 17 total` test suites and `107 passed, 107 total` tests.
    *   **`apps/web/tests/chat-route.test.ts`**: The newly added test case verified that the `POST /api/chat` endpoint correctly processes the `pa` (Punjabi) locale, ensuring the AI model's `systemInstruction` includes "Punjabi".
    *   **`apps/web/tests/i18n-locales.test.tsx`**: This new test suite provided specific verification for i18n configuration:
        *   It confirmed that `kn` and `pa` are included in `routing.locales`.
        *   It validated that all locales in `routing.locales` are correctly matched by the `proxyConfig.matcher` regex, preventing routing issues.
        *   It asserted that the `LanguageSwitcher` component renders the native labels "ಕನ್ನಡ" and "ਪੰਜਾਬੀ" when the respective locales are active, confirming UI integration.

2.  **Local Browser Checks**:
    *   The application was accessed at `http://localhost:3001/en`.
    *   The language switcher dropdown was opened, and `ಕನ್ನಡ` (Kannada) and `ਪੰਜਾਬੀ` (Punjabi) were confirmed to be listed as options.
    *   Selecting Kannada successfully routed the application to `/kn` and displayed Kannada text in the hero and navigation sections.
    *   Selecting Punjabi successfully routed the application to `/pa` and displayed Punjabi text in the hero and navigation sections.
    *   Direct navigation to `http://localhost:3001/kn` and `http://localhost:3001/pa` was performed, confirming that both routes returned a `200 OK` status.

3.  **Code Quality Checks**:
    *   `npx eslint app/'[locale]'/LanguageSwitcher.tsx i18n/routing.ts proxy.ts tests/i18n-locales.test.tsx` was run, passing with no output, indicating no linting issues in the modified files.
    *   `npm run build -w web` was executed, confirming successful compilation and static page generation for the web application.

Edge cases considered include ensuring that the proxy matcher is comprehensive enough to catch all defined locales, preventing 404s for valid language routes. The new `i18n-locales.test.tsx` specifically addresses this by comparing `routing.locales` against the `proxyConfig.matcher`. The chat API's `supportedLocales` and `localeMap` are designed to gracefully fall back to English (`en`) if an unsupported locale is provided, ensuring robustness.