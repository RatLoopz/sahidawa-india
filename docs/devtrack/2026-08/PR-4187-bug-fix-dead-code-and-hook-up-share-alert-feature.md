# PR #4187 — [BUG] Fix dead code and hook up share alert feature

> **Merged:** 2026-08-06 | **Author:** @kumudasrip | **Area:** Frontend | **Impact Score:** 5 | **Closes:** #4066

## What Changed

We removed dead code and an ESLint bypass from our main alerts log page and successfully implemented a fully functional "Share Alert" feature. The sharing logic was refactored and relocated directly into the individual alert item component, where we hooked it up to a new interactive button. This allows users to natively share or copy critical drug safety alerts with a single click.

## The Problem Being Solved

Prior to this PR, our system contained a dead `handleShareAlert` function in `apps/web/app/[locale]/alerts/page.tsx` that was bypassed using an `eslint-disable-next-line @typescript-eslint/no-unused-vars` comment. The actual user interface lacked any way for users to share these safety alerts. 

For SahiDawa's target audience—including rural health workers, doctors, and everyday consumers in India—the ability to quickly disseminate CDSCO (Central Drugs Standard Control Organisation) drug safety alerts, counterfeit warnings, and batch recalls via platforms like WhatsApp or SMS is critical. Leaving this feature unimplemented was a missed opportunity for community health impact and left unnecessary technical debt in our codebase.

## Files Modified

- `apps/web/app/[locale]/alerts/page.tsx`
- `apps/web/components/alerts/AlertItem.tsx`

## Implementation Details

### 1. Dead Code Elimination
We purged the unused `handleShareAlert` function from the parent page component (`apps/web/app/[locale]/alerts/page.tsx`). We also cleaned up minor indentation inconsistencies in the empty-state rendering logic of the alert log page to maintain code quality.

### 2. Component-Level Logic Relocation
We moved the sharing logic to `apps/web/components/alerts/AlertItem.tsx` to keep the component self-contained and highly reusable. 

### 3. Sharing Workflow & Web Share API Integration
Inside `AlertItem.tsx`, we implemented the `handleShareAlert` function with the following technical flow:
- **Event Propagation Control:** We call `e.stopPropagation()` at the very beginning of the click handler. Because `AlertItem` is a collapsible accordion component, this prevents the card from expanding or collapsing when the user clicks the share button.
- **Dynamic Text Generation:** The function resolves the drug brand name using a fallback chain: `alert.reported_brand_name || alert.brand_name || alert.brand || "SYSTEM_UPDATE"`. It then formats a standardized safety message containing the brand name and the batch number (`alert.batch_number || "N/A"`).
- **Web Share API with Clipboard Fallback:** 
  - The system first checks if `navigator.share` is supported by the user's browser (common on mobile devices). If supported, it invokes the native share sheet with the safety alert details.
  - If the Web Share API is unsupported or fails (e.g., on desktop browsers), the system falls back to the Clipboard API (`navigator.clipboard.writeText`).
  - We integrated `sonner` toast notifications to provide immediate visual feedback, displaying a success toast ("Alert details copied to clipboard!") or an error toast if the clipboard write fails.

### 4. UI/UX Enhancements
We imported the `Share2` icon from `lucide-react` and added a new button to the action bar of the `AlertItem` header. The button is styled using Tailwind CSS (`text-slate-400 transition-colors hover:text-emerald-500`) and includes proper accessibility attributes (`title="Share Alert"`, `aria-label="Share Alert"`).

## Technical Decisions

- **Co-location of Logic:** We chose to place the sharing logic directly inside `AlertItem.tsx` rather than passing down a handler from the parent page. This makes the `AlertItem` component modular and independent, allowing it to be rendered in other views (like a dashboard or a search results page) without requiring parent prop drilling.
- **Mobile-First Sharing:** By prioritizing `navigator.share`, we ensure a seamless native sharing experience on mobile devices (where users typically share directly to WhatsApp or Telegram). The clipboard fallback ensures desktop users are not left without a functional workflow.
- **Toast Feedback via Sonner:** We utilized our existing `sonner` library for toast notifications to maintain a consistent UI feedback loop across the application.

## How To Re-Implement (Contributor Reference)

If you need to implement a similar sharing feature in another part of the SahiDawa platform, follow this pattern:

1. **Import Dependencies:**
   Ensure you have the necessary icons and toast utilities imported:
   ```typescript
   import { Share2 } from "lucide-react";
   import { toast } from "sonner";
   ```

2. **Prevent Accordion/Parent Click Triggers:**
   Always pass the click event to your handler and stop propagation if the button is nested inside a clickable card:
   ```typescript
   const handleShare = (e: React.MouseEvent) => {
       e.stopPropagation();
       // sharing logic here
   };
   ```

3. **Implement the Web Share + Clipboard Fallback Pattern:**
   ```typescript
   const shareText = `⚠️ SahiDawa Alert: ...`;
   
   const writeToClipboard = () => {
       navigator.clipboard
           .writeText(shareText)
           .then(() => toast.success("Copied to clipboard!"))
           .catch((err) => {
               console.error(err);
               toast.error("Failed to copy.");
           });
   };

   if (navigator.share) {
       navigator.share({ title: "Alert", text: shareText }).catch(() => {
           writeToClipboard();
       });
   } else {
       writeToClipboard();
   }
   ```

4. **Add Accessible Button Markup:**
   Ensure the button has clear interactive states and screen-reader accessible labels:
   ```tsx
   <button
       onClick={handleShare}
       className="text-slate-400 transition-colors hover:text-emerald-500"
       title="Share Alert"
       aria-label="Share Alert"
   >
       <Share2 size={16} />
   </button>
   ```

## Impact on System Architecture

- **Zero Bundle Size Overhead:** We utilized existing dependencies (`lucide-react`, `sonner`) and native web APIs (`navigator.share`, `navigator.clipboard`), keeping our bundle size optimized.
- **Improved Code Maintainability:** Removing dead code and ESLint bypasses keeps our static analysis checks clean and prevents technical debt from accumulating.
- **Enhanced User Engagement:** Providing an easy way to share safety alerts directly increases the virality and utility of SahiDawa's safety registry in community health channels.

## Testing & Verification

- **Web Share API Testing:** Verified on mobile browsers (Chrome for Android, Safari for iOS) to ensure the native OS share dialog opens with the correct pre-filled text.
- **Fallback Testing:** Verified on desktop browsers (where `navigator.share` is typically undefined) to ensure the text is copied to the clipboard and the success toast is displayed.
- **Edge Case Handling:** Tested alerts with missing batch numbers and missing brand names to ensure the fallback strings (`"N/A"` and `"SYSTEM_UPDATE"`) render gracefully without crashing the application.