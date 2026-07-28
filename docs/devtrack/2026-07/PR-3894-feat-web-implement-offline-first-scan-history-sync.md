# PR #3894 — feat(web): implement offline-first scan history sync and connection s…

> **Merged:** 2026-07-28 | **Author:** @jamunatg2006-sys | **Area:** i18n | **Impact Score:** 23 | **Closes:** #3892

## What Changed

We implemented an automatic, offline-first synchronization mechanism for the medicine scan history page that triggers immediately when a user's device transitions from offline to online. To support this, we introduced a real-time connection status badge in the UI that displays localized synchronization states (`Synced`, `Offline`, `Syncing`, or `Sync Error`) using dynamic Tailwind CSS animations. Additionally, we updated the manual "Sync to Cloud" button to be disabled during offline states or active sync operations, and added translation keys for these new states across all six of our supported regional language locale files.

## The Problem Being Solved

SahiDawa is frequently deployed in rural Indian health camps and remote villages where internet connectivity is highly intermittent, unstable, or completely absent. Prior to this PR, our scan history page relied on manual synchronization triggers and lacked visibility into whether local scans had successfully reached our cloud database. 

This created two critical issues:
1. **Data Loss Risk:** Users had no visual indication of whether their scanned medicine history was safely backed up or stored only locally in the browser, leading to potential data loss if they cleared browser cache while offline.
2. **Poor UX & Wasteful Requests:** Users could repeatedly click the manual "Sync to Cloud" button while offline, resulting in failed network requests, unhandled promise rejections, and a frustrating user experience.

## Files Modified

- `apps/web/app/[locale]/history/page.tsx`
- `apps/web/messages/en.json`
- `apps/web/messages/hi.json`
- `apps/web/messages/kok.json`
- `apps/web/messages/mai.json`
- `apps/web/messages/mni.json`
- `apps/web/messages/sd.json`

## Implementation Details

### 1. Connection and Sync State Management
In `apps/web/app/[locale]/history/page.tsx`, we introduced two new state variables to track the network and synchronization lifecycle:
- `isOnline`: A boolean state initialized with an SSR-safe check:
  ```typescript
  const [isOnline, setIsOnline] = useState<boolean>(() =>
      typeof window !== "undefined" ? window.navigator.onLine : true
  );
  ```
- `syncStatus`: A state machine representing the exact synchronization phase: `"synced" | "pending" | "syncing" | "error"`.

### 2. Network Event Listeners
We registered native browser event listeners within a `useEffect` hook to dynamically update the `isOnline` state when the browser fires `online` or `offline` events. A cleanup function is returned to prevent memory leaks when the component unmounts:
```typescript
useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
    };
}, []);
```

### 3. Memoized Sync and Load Functions
To prevent unnecessary re-renders and infinite loops within our dependency arrays, we wrapped `loadHistory` and `syncHistoryFromCloud` in React's `useCallback` hook. 
- `syncHistoryFromCloud` checks the network status before attempting a sync. If offline, it immediately sets `syncStatus` to `"pending"` and exits. Otherwise, it transitions through `"syncing"`, calls our core `syncScanHistoryWithCloud()` utility, reloads the local history, and sets the status to `"synced"`. If an API error occurs, it catches the exception, logs it, and transitions to `"error"`.

### 4. Reactive Sync Triggering
We established a reactive `useEffect` hook that monitors the `isOnline` state. When `isOnline` transitions to `true`, it automatically fires the memoized `syncHistoryFromCloud()` function. If it transitions to `false`, it immediately updates the UI state to `"pending"`.

### 5. Dynamic UI Badge & Button States
We added a responsive status badge next to the page title. The badge uses conditional rendering to display different visual indicators based on `syncStatus`:
- **Synced:** Emerald text with a double-ring pulsing animation (`animate-ping` + static dot).
- **Offline (Sync Pending):** Amber text with a solid amber dot.
- **Syncing:** Sky blue text with a double-ring pulsing animation.
- **Sync Error:** Red text with a solid red dot.

The manual sync button's `disabled` attribute was updated to:
```tsx
disabled={isSyncing || !isOnline}
```
This prevents users from triggering manual sync requests when the device is offline or when an active sync is already running.

### 6. Multi-Language Localization (i18n)
We integrated the new status strings with `next-intl` by adding four new translation keys (`sync_status_synced`, `sync_status_offline`, `sync_status_syncing`, `sync_status_error`) across all our supported language files:
- English (`en.json`)
- Hindi (`hi.json`)
- Konkani (`kok.json`)
- Maithili (`mai.json`)
- Manipuri (`mni.json`)
- Sindhi (`sd.json`)

## Technical Decisions

### Why Native Window Listeners Instead of a Heavy Library?
We chose to use native `window.addEventListener("online", ...)` and `window.navigator.onLine` instead of pulling in external network-state libraries (like `react-detect-offline` or `@react-native-community/netinfo`). This decision was made to keep our JavaScript bundle size as small as possible, ensuring fast page loads on low-end mobile devices operating on 2G/3G networks in rural India.

### Why `useCallback` for Data Fetching?
In previous iterations, helper functions were declared inline, causing them to be re-created on every render cycle. By wrapping `loadHistory` and `syncHistoryFromCloud` in `useCallback`, we stabilized their references. This allowed us to safely include them in the dependency arrays of our `useEffect` hooks without triggering infinite render loops.

### SSR-Safe State Initialization
Since Next.js performs Server-Side Rendering (SSR), accessing the global `window` object directly during initial state declaration would throw a `ReferenceError: window is not defined` on the server. We resolved this by initializing `isOnline` using a lazy initializer function that safely checks if `typeof window !== "undefined"` before reading `window.navigator.onLine`.

## How To Re-Implement (Contributor Reference)

If you need to implement a similar offline-first synchronization pattern on another page (e.g., medicine verification logs or user profile updates), follow these steps:

1. **Define the Sync States:**
   Establish states for tracking network connectivity and the synchronization state machine:
   ```typescript
   const [isOnline, setIsOnline] = useState<boolean>(() =>
       typeof window !== "undefined" ? window.navigator.onLine : true
   );
   const [syncStatus, setSyncStatus] = useState<"synced" | "pending" | "syncing" | "error">("synced");
   ```

2. **Set Up Network Listeners:**
   Add a `useEffect` hook to bind to the browser's connectivity events. Ensure you clean up the event listeners on unmount:
   ```typescript
   useEffect(() => {
       const handleOnline = () => setIsOnline(true);
       const handleOffline = () => setIsOnline(false);
       window.addEventListener("online", handleOnline);
       window.addEventListener("offline", handleOffline);
       return () => {
           window.removeEventListener("online", handleOnline);
           window.removeEventListener("offline", handleOffline);
       };
   }, []);
   ```

3. **Memoize the Sync Logic:**
   Wrap your synchronization logic in a `useCallback` hook. Ensure it handles the offline boundary check gracefully:
   ```typescript
   const syncData = useCallback(async () => {
       if (typeof window !== "undefined" && !window.navigator.onLine) {
           setSyncStatus("pending");
           return;
       }
       try {
           setSyncStatus("syncing");
           await executeCloudSyncApi();
           setSyncStatus("synced");
       } catch (error) {
           setSyncStatus("error");
       }
   }, []);
   ```

4. **Trigger Sync on Reconnection:**
   Use a `useEffect` hook to watch `isOnline` and trigger the sync when the network returns:
   ```typescript
   useEffect(() => {
       if (isOnline) {
           void syncData();
       } else {
           setSyncStatus("pending");
       }
   }, [isOnline, syncData]);
   ```

5. **Disable Interactive Controls:**
   Always disable manual sync buttons or form submissions when `!isOnline` or when `syncStatus === "syncing"`.

6. **Add Localized Strings:**
   Do not hardcode UI strings. Add corresponding keys to `apps/web/messages/*.json` for all 6 regional languages and consume them using `useTranslations()`.

## Impact on System Architecture

This change shifts SahiDawa's web application towards a more resilient, offline-first architecture. By decoupling user actions from immediate network availability, we ensure that the application remains fully functional in offline environments while guaranteeing data consistency through automatic background synchronization once a network connection is re-established. This architecture significantly reduces server load by eliminating redundant, failing API requests from offline clients.

## Testing & Verification

We verified this implementation using the following methods:
1. **Network Throttling Simulation:** Using Chrome DevTools Network tab, we toggled the connection state between **Online** and **Offline**.
   - *Offline Transition:* The status badge immediately updated to `Offline (Sync Pending)` (amber), and the manual sync button was disabled.
   - *Online Transition:* The background auto-sync fired instantly, the badge transitioned to `Syncing...` (sky pulse) and then settled on `Synced` (emerald pulse) once the API call resolved successfully.
2. **Code Quality Checks:**
   - Ran `npx eslint apps/web/app/[locale]/history/page.tsx` to ensure code style compliance.
   - Ran `npx prettier --check apps/web/app/[locale]/history/page.tsx` to verify formatting.
   - Executed `git diff --check` to ensure no trailing whitespaces or unresolved merge conflicts remained.