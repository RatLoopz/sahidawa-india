# PR #502 — feat: add privacy policy page with responsive card layout and footer …

> **Merged:** 2026-05-24 | **Author:** @ANISHA-RAWAT | **Area:** Frontend | **Impact Score:** 10

## What Changed

We have implemented a new, dedicated Privacy Policy page within our Next.js application, accessible at the `/privacy` route. This page, defined in `apps/web/app/[locale]/privacy/page.tsx`, features a responsive, card-based layout that clearly outlines our data collection, usage, cookie policy, third-party services, and security measures. Simultaneously, a "Privacy Policy" link has been added to the "Quick Links" section of the global `Footer` component, located at `apps/web/app/[locale]/components/Footer.tsx`, ensuring easy navigation for our users.

## The Problem Being Solved

Prior to this pull request, the SahiDawa platform lacked a formal and easily accessible privacy policy. This was a critical omission for an application dealing with user data, even if anonymized, and aiming to build trust within the Indian healthcare ecosystem. Without a clear privacy statement, users would be unaware of what data we collect (e.g., medicine scans, temporary location data), how it's used (e.g., CDSCO verification, counterfeit heatmap), and what we explicitly do _not_ collect (e.g., Aadhaar, personal identifiers). This gap hindered transparency, potentially impacted user adoption, and posed a compliance risk, which was tracked by issue #409.

## Files Modified

- `apps/web/app/[locale]/components/Footer.tsx`
- `apps/web/app/[locale]/privacy/page.tsx`

## Implementation Details

The core of this feature is the creation of a new Next.js page component, `PrivacyPolicyPage`, exported as default from `apps/web/app/[locale]/privacy/page.tsx`. This component renders a `main` HTML element that serves as the page container, styled with `min-h-screen bg-white`.

The page content is logically divided into three primary `section` elements:

1.  **Hero Section:** This initial section is centrally aligned (`text-center`) with vertical padding (`py-16 px-4`) and a bottom border (`border-b border-gray-100`). It prominently features a "GSSoC 2026 Open Source Project" badge, styled with `bg-green-50 border border-green-200 text-green-700` and an `animate-pulse` green dot. The main heading `<h1>` displays "Privacy Policy" with the word "Policy" highlighted in `text-green-500`. An introductory paragraph and three informative chips (`🔒 No Data Sold. Ever.`, `🍪 No Tracking Cookies`, `⭐ Open Source MIT License`) provide a concise overview of our privacy principles.

2.  **Content Section:** This section, styled with `bg-gray-50 py-16 px-4`, contains the detailed privacy policy information. It uses a `max-w-3xl mx-auto space-y-6` container to center the content and provide vertical spacing between policy cards. Each policy point is presented within a `div` element acting as a distinct card, uniformly styled with `bg-white rounded-2xl border border-gray-100 shadow-sm p-8`.
    - Each card begins with an emoji icon (e.g., `📋`, `🔍`, `🍪`) and an `<h2>` heading (`text-xl font-bold text-gray-900`) for clear topic identification.
    - Information is conveyed through paragraphs (`<p>`) and unordered lists (`<ul>`). List items (`<li>`) feature custom bullet points implemented as `span` elements (`w-2 h-2 rounded-full`). These bullets are color-coded: `bg-green-400` for data we collect or use, and `bg-red-400` for data we explicitly do _not_ collect or share (e.g., "We do **not** collect your name, phone number, or Aadhaar").
    - The "Third-Party Services" card specifically uses a `grid grid-cols-2 gap-3` layout to display the names of integrated services (Cloudinary, Supabase, OpenStreetMap, Sarvam AI) within `div` chips styled with `bg-gray-50 rounded-xl px-4 py-3`.
    - The "Contact Us" card is visually emphasized with `border border-green-100` and includes a placeholder `[ADMIN_EMAIL]`, styled as an `inline-block bg-green-50 border border-green-200 text-green-700 text-sm font-semibold px-4 py-2 rounded-lg`, along with a link to our Discord community.

3.  **Bottom Section:** A final `text-center py-10 px-4 border-t border-gray-100` section reiterates SahiDawa's core mission statement: "SahiDawa is free, open-source, and built for 1.4 billion Indians. No ads. No premium. No data sold. Ever."

The `apps/web/app/[locale]/components/Footer.tsx` file was modified to integrate a new `Link` component from `next/link`. This `Link` is added within the `Quick Links` section of the footer, immediately following the "About Us" link. Its `href` attribute is set to `/privacy`, and it applies the standard footer link styling: `transition-all duration-200 hover:translate-x-1 hover:text-white`.

## Technical Decisions

1.  **Next.js App Router for New Page:** We chose to implement the Privacy Policy page using the Next.js App Router convention (`apps/web/app/[locale]/privacy/page.tsx`). This decision aligns with our current frontend architecture, providing automatic routing and leveraging Next.js's capabilities for server-side rendering or static site generation, ensuring the page is performant and SEO-friendly. The `[locale]` segment is included to support future internationalization efforts, allowing the policy to be translated for various regional languages.
2.  **Tailwind CSS for Styling:** The entire page is styled exclusively with Tailwind CSS utility classes. This choice maintains consistency with the existing SahiDawa design system, enables rapid development, and ensures the page is fully responsive across different devices (desktop, tablet, mobile) without requiring custom CSS. Examples include `flex`, `grid`, `space-y-`, `rounded-`, `shadow-sm`, and various `text-` and `bg-` color classes.
3.  **Card-Based Content Organization:** The decision to present the privacy policy content in a series of distinct, visually separated cards was made to enhance readability and user comprehension. Breaking down complex information into digestible, themed sections with clear headings and emoji icons makes the policy less daunting and easier for users to navigate and understand.
4.  **Explicit `[ADMIN_EMAIL]` Placeholder:** The inclusion of an explicit `[ADMIN_EMAIL]` placeholder in the "Contact Us" section was a deliberate choice to ensure that a critical piece of contact information is not overlooked. This acts as a clear call-to-action for maintainers to replace it with the official SahiDawa email address post-merge, preventing the deployment of a legally incomplete document.
5.  **Footer Link for Discoverability:** Placing the "Privacy Policy" link directly in the global `Footer` component ensures high discoverability. The footer is a conventional location for such legal and informational links, making it intuitive for users to find without actively searching.

## How To Re-Implement (Contributor Reference)

To re-implement the Privacy Policy page and its footer integration, a contributor would perform the following steps:

1.  **Create the Privacy Policy Page File:**
    - Navigate to the `apps/web/app/[locale]/` directory.
    - Create a new sub-directory named `privacy`.
    - Inside `apps/web/app/[locale]/privacy/`, create a new file named `page.tsx`.
    - Populate `page.tsx` with the `PrivacyPolicyPage` functional component, ensuring it exports as default. The component should render the `main` element with `min-h-screen bg-white`.
    - Structure the content into three main `<section>` elements:
        - The **Hero Section** should include the GSSoC badge, the `<h1>` title "Privacy Policy" with `text-green-500` for "Policy", an introductory paragraph, and the three feature chips ("No Data Sold", "No Tracking Cookies", "Open Source MIT License").
        - The **Content Section** (`bg-gray-50 py-16 px-4`) should contain a `max-w-3xl mx-auto space-y-6` container. Within this container, create eight distinct `div` elements, each representing a policy card. Each card should have `bg-white rounded-2xl border border-gray-100 shadow-sm p-8`.
            - Each card needs an emoji icon and an `<h2>` heading.
            - Use `<p>` tags for descriptive text and `<ul>` with `<li>` for bullet points. For bullet points, use `span` elements (`w-2 h-2 rounded-full`) with `bg-green-400` or `bg-red-400` as appropriate.
            - For the "Third-Party Services" card, implement a `grid grid-cols-2 gap-3` for the service chips (`bg-gray-50 rounded-xl px-4 py-3`).
            - For the "Contact Us" card, ensure the `[ADMIN_EMAIL]` placeholder is present and styled as an `inline-block bg-green-50 border border-green-200 text-green-700 text-sm font-semibold px-4 py-2 rounded-lg`, and include the Discord link.
        - The **Bottom Section** (`text-center py-10 px-4 border-t border-gray-100`) should contain the SahiDawa mission statement.

2.  **Modify the Footer Component:**
    - Open `apps/web/app/[locale]/components/Footer.tsx`.
    - Locate the `div` element that contains the "Quick Links" section (e.g., where "About Us" is listed).
    - Add a new `Link` component from `next/link` within this `div`, ensuring it is a sibling to existing links.
    - Set its `href` prop to `"/privacy"`.
    - Apply the standard footer link styling: `className="transition-all duration-200 hover:translate-x-1 hover:text-white"`.
    - The text content of the link should be "Privacy Policy".

3.  **Post-Merge Maintainer Action:**
    - After the code is merged and deployed, a maintainer _must_ manually edit `apps/web/app/[locale]/privacy/page.tsx` to replace the `[ADMIN_EMAIL]` placeholder with the official SahiDawa administrative email address (e.g., `<span className="font-semibold text-green-600">hello@sahidawa.in</span>`). This is a critical step for legal and operational completeness.

## Impact on System Architecture

This change primarily impacts the frontend information architecture by introducing a new static content page. It leverages our existing Next.js App Router and Tailwind CSS framework, demonstrating the scalability of our current stack for adding informational pages without introducing new dependencies or complex architectural layers. The addition of the footer link enhances the application's overall navigability and user experience by making essential legal information readily discoverable. This also establishes a reusable pattern for future static content pages, promoting consistency in design and implementation across the platform.

## Testing & Verification

Verification of this change involved a combination of functional and visual checks:

1.  **Direct Page Access:** We verified that navigating directly to `/privacy` (or `/[locale]/privacy` if a specific locale was active) successfully loaded the new Privacy Policy page without errors.
2.  **Footer Link Navigation:** We tested the "Privacy Policy" link in the footer to ensure it correctly navigated to the newly created page.
3.  **Responsive Design:** The page was tested across various viewport sizes (desktop, tablet, mobile) to confirm that the card layout, text, and imagery adapted responsively as intended by the Tailwind CSS utility classes.
4.  **Content Review:** The text content was thoroughly reviewed for accuracy, clarity, grammar, and adherence to SahiDawa's actual data handling practices.
5.  **Placeholder Confirmation:** We confirmed the presence and correct styling of the `[ADMIN_EMAIL]` placeholder, ensuring the required post-merge action for maintainers is clearly visible.
6.  **External Link Validation:** The Discord community link within the "Contact Us" section was checked to ensure it correctly points to the intended external URL.

No specific edge cases were identified that were not addressed by the design or the explicit maintainer action. However, future considerations for localization of the policy content itself would be a natural extension of the `[locale]` routing.
