# PR #1059 — Fix profile page footer alignment and layout structure

> **Author:** @shuvam776 | **Area:** layout/ui | **Impact Score:** 15 | **Closes:** #1059

## What Changed

This pull request resolves the footer rendering order issues on the profile page (`/en/profile`). We wrapped the child pages in a `<div className="flex flex-col flex-grow">` in the root locale layout and refactored the profile page (`page.tsx`) and its loading skeleton (`loading.tsx`) to use `flex-grow` instead of `min-h-screen`. This guarantees a flawless sticky footer layout where content scales dynamically to fit the viewport without unnecessary scrollbars or layout displacement.

## The Problem Being Solved

On `/en/profile`, the full-page footer rendered before/on top of the profile content because of incorrect positioning and lack of standard flex layouts on body and main tags. This buried the "Your Profile" section completely below the fold of the page. Additionally, forcing `min-h-screen` on the page itself pushed the footer out of bounds, adding needless scrollbars on large viewports even for short content pages.

## Files Modified

- `apps/web/app/[locale]/layout.tsx`
- `apps/web/app/[locale]/profile/page.tsx`
- `apps/web/app/[locale]/profile/loading.tsx`

## Implementation Details

1. **`layout.tsx`:** Updated body styles to `flex min-h-screen flex-col` and wrapped children under `<div className="flex flex-col flex-grow">` to define a clear global flex column flow.
2. **`profile/page.tsx`:** Replaced the rigid `min-h-screen` class on the page root wrapper with `flex-grow` to allow the profile section to fill the remaining screen space perfectly.
3. **`profile/loading.tsx`:** Swapped `min-h-screen` with `flex-grow` to maintain UI and size consistency during transition states.

## Testing & Verification

- **Visual Alignment:** The footer is cleanly positioned at the absolute bottom of the page when content is short, and flows naturally below content when the window height is small.
- **Scrollbar Elimination:** The profile page no longer displays scrollbars on screen heights where all page content fits comfortably.
