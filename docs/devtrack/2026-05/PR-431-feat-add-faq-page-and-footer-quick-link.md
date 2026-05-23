# PR #431 — feat: add FAQ page and footer quick link

> **Merged:** 2026-05-22 | **Author:** @ANISHA-RAWAT | **Area:** Frontend | **Impact Score:** 10 | **Closes:** #408

## What Changed

This pull request introduces a new Frequently Asked Questions (FAQ) page to our SahiDawa web application. The new page, located at `apps/web/app/[locale]/faq/page.tsx`, provides users with common questions and answers about the platform, presented in an interactive accordion format. Additionally, we have integrated a quick link to this new FAQ page within the "Quick Links" section of our global `Footer` component, found in `apps/web/app/[locale]/components/Footer.tsx`, enhancing discoverability.

## The Problem Being Solved

Before this PR, our SahiDawa platform lacked a centralized and easily discoverable resource for users to find answers to common inquiries. Users often had to infer information or navigate through various sections to understand core functionalities, our mission, or how to contribute. This absence created a potential barrier for new users seeking quick information and meant we were not proactively addressing frequently asked questions. Implementing a dedicated FAQ page directly addresses this by providing a self-service information hub, improving user onboarding and overall user experience.

## Files Modified

- `apps/web/app/[locale]/components/Footer.tsx`
- `apps/web/app/[locale]/faq/page.tsx`

## Implementation Details

This PR primarily involves the creation of a new Next.js page and a minor modification to an existing shared component.

1.  **New FAQ Page (`apps/web/app/[locale]/faq/page.tsx`):**
    *   This file defines the `FAQPage` component, which is a client-side React component as indicated by `"use client";`. This is necessary for managing interactive UI state.
    *   **State Management:** We utilize the `useState` hook (`const [openIndex, setOpenIndex] = useState<number | null>(null);`) to control the accordion's open/closed state. `openIndex` stores the index of the currently expanded FAQ item, or `null` if all are collapsed.
    *   **FAQ Data Structure:** A JavaScript array named `faqs` is defined directly within the component. Each element in this array is an object with `question` and `answer` string properties, representing a single FAQ entry.
    *   **Accordion UI Rendering:** The `FAQPage` component maps over the `faqs` array to render each question-answer pair.
        *   Each FAQ item is wrapped in a `div` with styling for a card-like appearance.
        *   A `button` element serves as the clickable header for each FAQ. Its `onClick` handler calls the `toggle` function, which updates `openIndex`.
        *   Inside the button, the `faq.question` is displayed alongside a dynamic icon (`ChevronUp` or `ChevronDown` from `lucide-react`) indicating the current state (expanded or collapsed).
        *   The `faq.answer` is rendered within a separate `div` only when `openIndex === i` (i.e., when its corresponding question is clicked), creating the accordion effect.
    *   **Page Structure:** The page is divided into three main `section` elements:
        *   A "Hero" section with a title ("Frequently Asked Questions"), a descriptive subtitle, and a "GSSoC 2026 Open Source Project" badge.
        *   The "FAQ List" section, which contains the interactive accordion components.
        *   A "Still have questions?" Call to Action (CTA) section at the bottom, prompting users to contact us via a `Link` to `/contact`.
    *   **Styling:** All visual elements are styled using Tailwind CSS utility classes, ensuring a consistent look and feel with the rest of the SahiDawa platform.
    *   **Internationalization (i18n) Routing:** The `Link` component from `@/i18n/routing` is used for navigation (e.g., to `/contact`), ensuring compatibility with our locale-aware routing system.

2.  **Footer Integration (`apps/web/app/[locale]/components/Footer.tsx`):**
    *   A new `Link` component has been added within the `Quick Links` section of the `Footer` component.
    *   The `href` attribute is set to `/faq`, pointing directly to the newly created FAQ page.
    *   The link text is "FAQ".
    *   The `className` (`transition-all duration-200 hover:translate-x-1 hover:text-white`) ensures that the new link adheres to the existing styling and hover effects of other quick links in the footer.

## Technical Decisions

1.  **Client Component for FAQ Page:** We opted to make `apps/web/app/[locale]/faq/page.tsx` a client component (`"use client";`) due to the interactive nature of the accordion UI, which requires client-side JavaScript and React's `useState` hook for state management. While the initial content could be server-rendered, the dynamic collapsing and expanding functionality necessitates a client component.
2.  **Hardcoded FAQ Data:** The FAQ questions and answers are currently hardcoded within the `faqs` array directly in the `page.tsx` file. This decision was made for rapid initial implementation, as the number of FAQs is relatively small and static for now. This approach avoids the overhead of introducing a data fetching layer for this specific content.
3.  **`lucide-react` for Icons:** We continued our practice of using `lucide-react` for UI icons (`ChevronDown`, `ChevronUp`, `ShieldCheck`, `HelpCircle`). This maintains visual consistency across the application and leverages a lightweight, tree-shakable icon library.
4.  **`@/i18n/routing` for Navigation:** The `Link` component from our custom `@/i18n/routing` module is used for all internal navigation (`/faq`, `/contact`). This is a crucial decision to ensure that our routing infrastructure correctly handles locale prefixes (e.g., `/en/faq`, `/hi/faq`) as part of our internationalization strategy.
5.  **Tailwind CSS for Styling:** The entire UI of the FAQ page and the footer link are styled exclusively with Tailwind CSS utility classes. This aligns with our existing frontend development workflow, promoting rapid development, maintainability, and a consistent design system.

## How To Re-Implement (Contributor Reference)

To re-implement this FAQ feature from scratch, a contributor would follow these steps:

1.  **Create the FAQ Page File:**
    *   Create a new file at `apps/web/app/[locale]/faq/page.tsx`.
    *   At the very top of the file, add `"use client";` to designate it as a client component.
    *   Import necessary React hooks: `import { useState } from "react";`.
    *   Import icons from `lucide-react`: `import { ChevronDown, ChevronUp, ShieldCheck, HelpCircle } from "lucide-react";`.
    *   Import our i18n-aware `Link` component: `import { Link } from "@/i18n/routing";`.

2.  **Define FAQ Data:**
    *   Declare a `const` array named `faqs` within the `page.tsx` file. Each element should be an object with `question: string` and `answer: string` properties. For example:
        ```typescript
        const faqs = [
            {
                question: "What is SahiDawa?",
                answer: "SahiDawa is India's first open-source citizen medicine verification platform...",
            },
            // ... more FAQ objects
        ];
        ```

3.  **Implement the `FAQPage` Component:**
    *   Export a default functional component named `FAQPage`.
    *   Inside `FAQPage`, initialize the accordion state: `const [openIndex, setOpenIndex] = useState<number | null>(null);`.
    *   Define the `toggle` function: `const toggle = (i: number) => { setOpenIndex(openIndex === i ? null : i); };`.
    *   Structure the component's JSX with a main `div` container.
    *   **Hero Section:** Create a `<section>` for the hero, including a title (`h1`), subtitle (`p`), and a badge. Apply Tailwind classes for styling (e.g., `bg-white`, `border-b`, `text-center`).
    *   **FAQ List Section:** Create another `<section>` for the FAQ list.
        *   Inside, use `faqs.map((faq, i) => (...))` to iterate over the `faqs` array.
        *   For each `faq`, render a `div` representing an accordion item. Apply classes like `rounded-3xl`, `border`, `bg-white`, `shadow-sm`.
        *   Inside the item `div`, render a `button` element. Attach `onClick={() => toggle(i)}`.
        *   Within the `button`, display the `faq.question` and conditionally render `ChevronUp` (if `openIndex === i`) or `ChevronDown` (otherwise) using `lucide-react` components.
        *   Conditionally render a `div` for the `faq.answer` only if `openIndex === i`. Apply classes for text styling and padding.
    *   **CTA Section:** Create a final `<section>` for the "Still have questions?" call to action. Include an `h2`, `p`, and a `Link` component (from `@/i18n/routing`) pointing to `/contact`, styled as a button.

4.  **Integrate into Footer:**
    *   Open `apps/web/app/[locale]/components/Footer.tsx`.
    *   Locate the `Quick Links` section within the `Footer` component's JSX.
    *   Add a new `Link` component:
        ```typescript jsx
        <Link href="/faq" className="transition-all duration-200 hover:translate-x-1 hover:text-white">
            FAQ
        </Link>
        ```
    *   Ensure this `Link` is placed logically among other quick links.

## Impact on System Architecture

This change primarily impacts the frontend user interface and the overall information architecture of the SahiDawa web application.
*   **Enhanced User Experience:** It significantly improves the discoverability of essential information about SahiDawa, making the platform more user-friendly for new and returning users alike.
*   **Information Architecture Expansion:** We have added a new top-level content page (`/faq`) to our site structure, accessible directly from the global footer. This expands our public-facing content and makes our platform more self-serviceable.
*   **Scalability for Content:** While the FAQ data is currently hardcoded, the component structure is designed to be extensible. Future iterations could involve fetching FAQ data from a Content Management System (CMS) or a dedicated API endpoint, allowing for dynamic updates without requiring code changes. This PR establishes the foundational UI for such an evolution.
*   **No Backend Impact:** This feature is entirely frontend-driven and does not introduce any changes to our backend services, database schema, or API contracts.
*   **Internationalization Readiness:** By leveraging the `[locale]` segment in the page path and using the `@/i18n/routing` `Link` component, the new FAQ page is inherently prepared for future internationalization of its content, aligning with our broader strategy to support multiple Indian languages.

## Testing & Verification

Verification of this change involved manual testing of the frontend application:

1.  **Footer Link Verification:**
    *   We navigated to the SahiDawa homepage and scrolled to the footer.
    *   We confirmed the presence of a new "FAQ" link within the "Quick Links" section.
    *   We clicked the "FAQ" link and verified that it successfully navigated to the new `/faq` page.
2.  **FAQ Page Functionality:**
    *   On the `/faq` page, we visually inspected the layout and content to ensure all questions and answers were displayed correctly according to the design.
    *   We tested the accordion functionality by clicking each question. We confirmed that clicking a question expanded its corresponding answer and collapsed any other open answers. Clicking an already open question successfully collapsed its answer.
    *   We verified the visual styling, ensuring consistency with our design system, including colors, typography, spacing, and icon usage.
    *   We tested the "Still have questions?" Call to Action (CTA) section, confirming that the "Contact Us" button correctly linked to the `/contact` page.
3.  **Responsiveness:** Not documented in this PR.
4.  **Edge Cases:** Not documented in this PR.