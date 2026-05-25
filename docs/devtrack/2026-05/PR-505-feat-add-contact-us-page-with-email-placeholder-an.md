# PR #505 — feat: add contact us page with email placeholder and helpful links

> **Merged:** 2026-05-24 | **Author:** @ANISHA-RAWAT | **Area:** Frontend | **Impact Score:** 5 | **Closes:** #432

## What Changed

This PR primarily introduces a new "Contact Us" page, intended to be located at `apps/web/app/[locale]/contact/page.tsx`, providing users with various ways to connect with the SahiDawa team. It includes cards for email, Discord, bug reports, and contribution guidelines, alongside links to other important pages like Privacy Policy, About, and FAQ. A placeholder `[ADMIN_EMAIL]` is used for the contact email, requiring a maintainer action to configure. Additionally, a link to this new "Contact Us" page was added to the footer's Quick Links section. Crucially, while the PR description details the creation of the Contact Us page, the provided Git Diff only shows significant updates to the existing `apps/web/app/[locale]/privacy/page.tsx` file, which received a complete visual and structural overhaul to enhance clarity and user experience.

## The Problem Being Solved

Before this PR, SahiDawa lacked a dedicated, user-friendly "Contact Us" page, which is a fundamental component for any public-facing platform to foster user engagement, support, and community building. Users had no clear, centralized way to reach out for inquiries, report bugs, or find information on how to contribute. Furthermore, the existing "Privacy Policy" page was visually less engaging and less structured, potentially hindering user comprehension of our data handling practices. This update addresses both the need for direct communication channels and improved transparency regarding user data.

## Files Modified

- `apps/web/app/[locale]/privacy/page.tsx`

## Implementation Details

The core implementation detailed in the provided diff focuses on the complete refactoring of the `PrivacyPolicyPage` component within `apps/web/app/[locale]/privacy/page.tsx`.

- **`apps/web/app/[locale]/privacy/page.tsx` Refactor:**
    - The `PrivacyPolicyPage` functional component was entirely rewritten to adopt a more modern and structured layout using Tailwind CSS.
    - **Hero Section:** A new top-level `section` element was introduced with styling `border-b border-gray-100 px-4 py-16 text-center`. This section now prominently features:
        - A `GSSoC 2026 Open Source Project` badge, styled with `inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-4 py-1.5 text-sm font-medium text-green-700` and an animated pulse indicator (`h-2 w-2 animate-pulse rounded-full bg-green-500`).
        - A large `h1` title for "Privacy Policy" using `text-5xl font-extrabold text-gray-900` with the word "Policy" highlighted in `text-green-500`.
        - A descriptive paragraph explaining our transparency commitment, centered with `mx-auto max-w-xl text-lg text-gray-500`.
        - A set of three informative badges (`🔒 No Data Sold. Ever.`, `🍪 No Tracking Cookies`, `⭐ Open Source MIT License`) displayed using `flex flex-wrap justify-center gap-3` and styled with `rounded-full border` and specific text colors to convey key privacy commitments at a glance.
    - **Content Section:** The main policy details are now contained within a `section` styled with `bg-gray-50 px-4 py-16`. This section uses `mx-auto max-w-3xl space-y-6` to center the content and provide vertical spacing between policy cards.
    - **Policy Cards:** The detailed policy information is broken down into distinct `div` elements, each acting as a visually separate card. These cards are styled with `rounded-2xl border border-gray-100 bg-white p-8 shadow-sm` for a clean, modern appearance.
        - **"1. Information We Collect" Card:** This card includes an emoji icon (`📋`), an `h2` title (`text-xl font-bold text-gray-900`), an introductory paragraph, and an unordered list (`ul`) detailing the types of information SahiDawa collects (medicine barcode/image scans, location data for pharmacy finder, voice input) and explicitly stating what is _not_ collected (name, phone number, Aadhaar). List items use `flex items-start gap-3` for alignment and small `span` elements (`h-2 w-2 rounded-full`) as custom bullet points, color-coded (`bg-green-400` for collected, `bg-red-400` for not collected) for quick visual distinction.
        - **"2. How We Use Your Data" Card:** Structured similarly, this card explains how collected data is utilized (verification against CDSCO database, anonymous reports for counterfeit heatmap) and reiterates that no personal data is shared with third parties.
        - **"3. Cookies" Card:** This card specifically addresses cookie usage, clarifying that SahiDawa employs only `essential cookies` (e.g., language preference) and explicitly avoids tracking, advertising, or analytics cookies.
    - All styling throughout the `PrivacyPolicyPage` is implemented using Tailwind CSS utility classes directly within the JSX, adhering to a utility-first CSS approach.

- **`apps/web/app/[locale]/contact/page.tsx` Creation:** Not documented in this PR.
- **Footer Link Addition:** Not documented in this PR.

## Technical Decisions

1.  **Next.js App Router Pattern:** The use of `app/[locale]/privacy/page.tsx` (and implicitly `app/[locale]/contact/page.tsx`) aligns with the Next.js App Router convention for internationalized routing. This structure allows for locale-specific content to be served dynamically based on the `[locale]` segment, which is crucial for SahiDawa's goal of reaching diverse linguistic communities in India.
2.  **Tailwind CSS for Styling:** The extensive use of Tailwind CSS utility classes directly in the JSX for the `PrivacyPolicyPage` redesign demonstrates a commitment to a utility-first CSS methodology. This approach promotes rapid UI development, consistency, and maintainability by avoiding custom CSS classes and instead composing designs from a set of predefined, low-level utility classes. This decision likely aims to keep the styling consistent across new pages like the Contact Us page.
3.  **Placeholder for Admin Email:** For the Contact Us page, the decision to use a `[ADMIN_EMAIL]` placeholder as a constant within the `apps/web/app/[locale]/contact/page.tsx` file (as described in the PR) is a pragmatic choice. It allows the feature to be merged and deployed without immediate access to a final, official email address, while clearly indicating a required post-merge configuration step for maintainers. This separates deployment from sensitive configuration, which can be managed by authorized personnel.
4.  **Card-Based Layout for Information:** The `PrivacyPolicyPage` redesign, with its distinct card sections for different policy aspects, improves readability and scannability. This pattern is likely extended to the Contact Us page, as suggested by the PR description's mention of "Cards for Email, Discord, Bug Report, Contribute," indicating a consistent UI/UX approach across informational pages.

## How To Re-Implement (Contributor Reference)

To re-implement the changes observed in `apps/web/app/[locale]/privacy/page.tsx` from scratch, a contributor would follow these steps:

1.  **Create/Locate the Page File:** Ensure the file `apps/web/app/[locale]/privacy/page.tsx` exists within the Next.js App Router structure.
2.  **Define the Component:** Export a default functional React component named `PrivacyPolicyPage`.
    ```typescript
    export default function PrivacyPolicyPage() {
      return (
        <main className="min-h-screen bg-white">
          {/* Content will go here */}
        </main>
      );
    }
    ```
3.  **Implement the Hero Section:**
    - Add a `section` element with `border-b border-gray-100 px-4 py-16 text-center`.
    - Inside, create the GSSoC badge:
        ```html
        <div
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-4 py-1.5 text-sm font-medium text-green-700"
        >
            <span className="h-2 w-2 animate-pulse rounded-full bg-green-500"></span>
            GSSoC 2026 Open Source Project
        </div>
        ```
    - Add the main title:
        ```html
        <h1 className="mb-4 text-5xl font-extrabold text-gray-900">
            Privacy <span className="text-green-500">Policy</span>
        </h1>
        ```
    - Include the descriptive paragraph and the three commitment badges, using `flex flex-wrap justify-center gap-3` for the badges.
4.  **Implement the Content Section:**
    - Add another `section` element with `bg-gray-50 px-4 py-16`.
    - Inside, create a container `div` with `mx-auto max-w-3xl space-y-6` to hold the policy cards.
5.  **Create Policy Cards:** For each policy point (Information We Collect, How We Use Your Data, Cookies), create a `div` element with the base styling `rounded-2xl border border-gray-100 bg-white p-8 shadow-sm`.
    - **Card Structure:** Each card should contain:
        - A `div` for the icon and title (`flex items-center gap-3 mb-4`).
        - An emoji `span` for the icon (e.g., `<span className="text-2xl">📋</span>`).
        - An `h2` for the title (e.g., `<h2 className="text-xl font-bold text-gray-900">1. Information We Collect</h2>`).
        - A descriptive paragraph (`p` tag).
        - For list-based cards, use a `ul` with `space-y-3`. Each `li` should use `flex items-start gap-3` and a `span` for the custom bullet point (`mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-green-400` or `bg-red-400`).
6.  **Tailwind CSS:** Ensure Tailwind CSS is correctly configured in the project. All styling relies on Tailwind utility classes. No custom CSS modules or stylesheets are required for this component.

**For the "Contact Us" page (`apps/web/app/[locale]/contact/page.tsx`) and footer link:** Not documented in this PR.

## Impact on System Architecture

This change primarily impacts the frontend user experience and information architecture of the SahiDawa web platform.

1.  **Enhanced User Engagement:** The introduction of a dedicated "Contact Us" page provides a clear, accessible channel for users to interact with the SahiDawa team, fostering trust and community. This is critical for an open-source project relying on user feedback and contributions.
2.  **Improved Transparency:** The comprehensive redesign of the `PrivacyPolicyPage` significantly enhances the clarity and readability of our data privacy commitments. This reinforces SahiDawa's dedication to user privacy and ethical data handling, which is paramount for a health-related platform.
3.  **Standardized Information Pages:** The consistent use of a card-based layout and Tailwind CSS for both the new Contact Us page (as described) and the updated Privacy Policy page establishes a standardized pattern for informational content. This will streamline the development of future pages like "About Us" or "FAQ" by providing a reusable design language.
4.  **Maintainer Action Required:** The placeholder email in the Contact Us page introduces a minor, one-time configuration step for maintainers, highlighting the need for careful environment-specific configuration management.
5.  **No Backend Impact:** This PR is purely a frontend feature, with no direct changes to backend APIs, database schemas, or core business logic. The email functionality, once configured, will likely rely on standard `mailto:` links or a separate email service, which is outside the scope of this frontend change.

## Testing & Verification

Verification for the changes in `apps/web/app/[locale]/privacy/page.tsx` would involve:

1.  **Visual Inspection:** Navigating to `/privacy` (or `/en/privacy`, `/hi/privacy` depending on locale configuration) in a web browser to ensure the page renders correctly with the new Hero section, content cards, and all styling applied as intended by Tailwind CSS.
2.  **Content Accuracy:** Reviewing the text within each card to confirm it accurately reflects SahiDawa's privacy policy statements regarding data collection, usage, and cookie policy.
3.  **Responsiveness:** Checking the page layout across different screen sizes to ensure the Tailwind CSS responsive utilities handle various viewports gracefully.

For the "Contact Us" page and the footer link: Not documented in this PR. However, typical verification would involve:

1.  **Navigation:** Confirming that the "Contact Us" link appears in the footer's Quick Links section and correctly navigates to the new `/contact` page.
2.  **Page Content:** Visually inspecting the Contact Us page to ensure all cards (Email, Discord, Bug Report, Contribute) are present and correctly styled.
3.  **Link Functionality:** Verifying that the Discord, Bug Report, and Contribute links correctly point to their respective external resources.
4.  **Email Placeholder:** Confirming that the `[ADMIN_EMAIL]` placeholder is visible in the email card until configured, and that once configured, the `mailto:` link correctly opens the user's default email client with the specified address.
