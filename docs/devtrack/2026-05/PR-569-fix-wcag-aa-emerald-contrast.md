# PR #569 — Fix/wcag aa emerald contrast

> **Merged:** 2026-05-25 | **Author:** @Subhra-Nandi | **Area:** Frontend | **Impact Score:** 10 | **Closes:** #477

## What Changed

This pull request systematically audits and upgrades the usage of `emerald` color shades across the Voice Triage pages within our `apps/web` Next.js frontend. Specifically, we have replaced instances of `emerald-500` and `emerald-600` with higher contrast variants, primarily `emerald-700` for text elements and `emerald-600` for UI components, to ensure full compliance with WCAG AA accessibility contrast requirements on a white background.

## The Problem Being Solved

Prior to this change, several UI elements and text labels on our Voice Triage pages were using `emerald-500` (`#10b981`) and `emerald-600` (`#059669`) on a white background. Our internal audit revealed that `emerald-500` only achieved a contrast ratio of 2.9:1, which is significantly below all WCAG AA thresholds. While `emerald-600` achieved 3.76:1, it passed the 3:1 requirement for UI components and large text, but critically failed the 4.5:1 requirement for normal-sized text. This lack of sufficient contrast posed an accessibility barrier for users with visual impairments, making parts of the Voice Triage interface difficult to read and interact with.

## Files Modified

- `apps/web/app/[locale]/voice/VoicePanels.tsx`
- `apps/web/app/[locale]/voice/page.tsx`

## Implementation Details

The implementation involved a targeted update of Tailwind CSS color utility classes within the `VoicePanels.tsx` and `page.tsx` components, which collectively render the Voice Triage user interface.

In `apps/web/app/[locale]/voice/VoicePanels.tsx`:
- Within the `VoiceIntroPanel` component, the `Volume2` icon, which previously used `text-emerald-500`, was updated to `text-emerald-700`. This ensures the icon's color meets the 4.5:1 contrast ratio required for normal text elements.
- In the `VoiceProcessingPanel` component, the `Sparkles` icon's color was changed from `text-emerald-500` to `text-emerald-700` for the same reason of achieving sufficient contrast for visual elements treated as text.
- Also within `VoiceProcessingPanel`, the spinner ring's top border color, defined by `border-t-emerald-500`, was upgraded to `border-t-emerald-600`. This change ensures the UI component meets the WCAG AA 3:1 contrast ratio (achieving 3.76:1).
- For the `VoiceListeningPanel` component, the status label's text color was updated from `text-emerald-600` to `text-emerald-700`. This was crucial because `emerald-600` (3.76:1) did not meet the 4.5:1 requirement for normal text, whereas `emerald-700` (5.48:1) does.
- In the `VoiceResultPanel` component, the background color of the recommendation number circles was changed from `bg-emerald-500` to `bg-emerald-600`. These circles function as UI components, and `emerald-600` provides the necessary 3.76:1 contrast ratio against the white text within them.

In `apps/web/app/[locale]/voice/page.tsx`:
- The primary microphone button, which is a key interactive UI component, had its background color updated from `bg-emerald-500` to `bg-emerald-600`. This ensures the button's background meets the 3:1 contrast requirement for UI elements.
- Similarly, the pulsating ring effect around the microphone button, defined by `bg-emerald-500`, was also updated to `bg-emerald-600` to maintain consistent accessibility for this visual indicator.

All these changes were applied by directly modifying the respective `className` attributes in the JSX, leveraging Tailwind CSS's utility-first approach.

## Technical Decisions

The core technical decision was to strictly adhere to WCAG AA contrast guidelines. Our system evaluated the existing `emerald` color palette against a white background, which is the predominant background color on the Voice Triage pages.
- `emerald-500` (`#10b981`) with a contrast ratio of 2.9:1 was deemed insufficient for all use cases.
- `emerald-600` (`#059669`) with a contrast ratio of 3.76:1 was identified as suitable for UI components and large text (which require a minimum of 3:1 contrast) but inadequate for normal text (which requires 4.5:1).
- `emerald-700` (`#047857`) with a robust contrast ratio of 5.48:1 was chosen for all normal text elements and icons treated as text, as it comfortably exceeds the 4.5:1 requirement.

This granular approach, distinguishing between text/icon elements and interactive UI components, allowed us to optimize color choices for accessibility without unnecessarily darkening all `emerald` instances. We chose to use the next available darker shade that met the specific requirement, rather than a single blanket change, to maintain the visual aesthetic as much as possible while prioritizing accessibility.

## How To Re-Implement (Contributor Reference)

Should a similar accessibility issue arise with color contrast in the future, or if a new feature requires `emerald` colors:

1.  **Identify Target Elements:** Locate the specific UI components, text labels, or icons that utilize `emerald` colors within the `apps/web` frontend, particularly on pages with a white or light background.
2.  **Determine Element Type:** Classify the element as either "normal text," "large text," or a "UI component."
    *   Normal text: Any text smaller than 18pt (24px) or 14pt (18.66px) bold.
    *   Large text: Text that is 18pt (24px) or larger, or 14pt (18.66px) and bold or larger.
    *   UI component: Non-textual elements like buttons, borders, icons (when not conveying primary information through text).
3.  **Calculate Contrast Ratio:** Use an accessibility tool (e.g., WebAIM Contrast Checker, browser developer tools' accessibility tab) to measure the contrast ratio between the `emerald` color and its background (e.g., `#FFFFFF` for white).
4.  **Apply WCAG AA Thresholds:**
    *   For normal text, the contrast ratio must be at least 4.5:1.
    *   For large text and UI components, the contrast ratio must be at least 3:1.
5.  **Select Appropriate `emerald` Shade:**
    *   If the current `emerald` shade (e.g., `emerald-500`) fails the requirement, test darker shades like `emerald-600` or `emerald-700`.
    *   Based on this PR, `emerald-700` (`#047857`, 5.48:1 on white) is suitable for all text and icons.
    *   `emerald-600` (`#059669`, 3.76:1 on white) is suitable for UI components and large text.
6.  **Update Tailwind CSS Classes:** Modify the `className` attribute of the affected JSX element. For example:
    *   `className="text-emerald-500"` becomes `className="text-emerald-700"`
    *   `className="bg-emerald-500"` becomes `className="bg-emerald-600"`
    *   `className="border-t-emerald-500"` becomes `className="border-t-emerald-600"`
7.  **Verify:** Visually inspect the changes and re-run contrast checks to confirm compliance.

## Impact on System Architecture

This change is primarily a localized UI/UX improvement focused on accessibility within a specific feature area (Voice Triage). It does not introduce new architectural patterns, dependencies, or significant performance implications. However, it reinforces our commitment to WCAG AA standards across the SahiDawa platform. This sets a precedent for future frontend development, mandating that all new color choices and existing color usages undergo similar accessibility audits, especially for critical user flows. It ensures that our `apps/web` frontend remains inclusive and usable for a wider range of users, aligning with our mission for rural health accessibility.

## Testing & Verification

Verification for this change was primarily conducted through manual auditing and calculation of contrast ratios. The PR description includes a detailed "Contrast audit summary" table, which explicitly lists the "Before" and "After" color usages, their calculated contrast ratios, and their WCAG AA pass/fail status. This table serves as direct evidence of the verification process. A screenshot was also provided as "Proof of Work" to visually demonstrate the updated UI. The contributor checklist confirms that the author performed a self-review and verified the project locally for compile/build errors, ensuring the changes were integrated correctly without introducing regressions. No specific automated accessibility tests were documented as part of this PR, but the manual audit was thorough. Edge cases related to different background colors were not applicable as the issue was specific to `emerald` colors on a white background.