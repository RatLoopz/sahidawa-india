# ADR — feat(scan): share verification results

> **Date:** 2024-07-20 | **PR:** [PR_NUMBER] | **Status:** Accepted

## Context

The SahiDawa platform lacked a direct and user-friendly mechanism for users to share the results of their medicine verification scans. This limitation hindered the rapid dissemination of critical health information, such as verified safe medicines or alerts regarding unverified/counterfeit products, which is crucial for public awareness and reporting within rural health contexts. Users were previously required to manually copy text or take screenshots, leading to a cumbersome and inconsistent experience.

## Decision

A sharing feature was implemented for medicine verification results, leveraging platform-native capabilities where available, with a robust fallback.

The implementation details are as follows:
- The Web Share API (`navigator.share`) was adopted as the primary sharing mechanism for mobile devices and browsers that support it, providing a native and integrated sharing experience.
- A clipboard fallback was developed for desktop environments or browsers without Web Share API support. This involved programmatically creating a temporary `textarea` element, populating it with the share text, executing a copy command, and then removing the element.
- Localized share copy was introduced, dynamically generated based on the verification outcome (verified, counterfeit, or unverified) and relevant medicine details. A utility function, `buildVerificationShareText`, was created to encapsulate this logic.
- User interface elements (share buttons) were integrated into the `VerifiedSafeResult`, `CounterfeitAlertResult`, and `UnverifiedResult` components, allowing users to initiate the sharing process directly from the scan results page.

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| **Manual Copy/Paste Only** | This approach would have maintained the status quo, requiring users to manually select and copy text. It was rejected due to its poor user experience, especially on mobile, and its failure to leverage modern browser and OS capabilities for seamless sharing. |
| **Server-side Generated Share Links** | This alternative would involve generating unique URLs for each verification result, storing them on the backend, and then sharing these links. It was rejected due to the added backend complexity, database requirements for storing ephemeral share data, and the dependency on an active internet connection for recipients to view the content. The current text-based sharing is simpler and more resilient. |
| **Custom Buttons for Specific Social Platforms** | Implementing dedicated buttons for platforms like WhatsApp, Twitter, or Facebook would require integrating platform-specific SDKs or deep links. This was rejected due to increased bundle size, vendor lock-in, and the ongoing maintenance overhead for each platform. The Web Share API offers a single, standardized interface that adapts to the user's available apps. |

## Consequences

**Positive:**
- Significantly improved user experience for sharing critical medicine verification information.
- Facilitates the rapid and widespread dissemination of public health alerts regarding counterfeit or unverified medicines.
- Leverages native operating system sharing capabilities, providing a familiar and integrated user flow on supported devices.
- Enhances the platform's utility as a community health tool by enabling easy information sharing.

**Trade-offs:**
- The clipboard fallback mechanism, while functional, offers a less integrated and potentially less intuitive experience compared to the native Web Share API.
- Increased client-side code complexity for managing sharing logic, UI state (e.g., "copied" feedback), and browser compatibility.
- Dependency on browser support for the Web Share API, although the robust fallback mitigates this risk.

## Related Issues & PRs

- PR: [PR_NUMBER] - feat(scan): share verification results
- Issue #797