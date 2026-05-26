# SahiDawa Offline Architecture — Master Guide

> **Audience:** This guide serves both end-users and developers.
> It covers how offline support works (architecture and UX) and how to build
> features that integrate with it (code patterns and best practices).

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Service Worker Logic](#service-worker-logic)
4. [Caching Strategies](#caching-strategies)
5. [Retry Logic](#retry-logic)
6. [Developer Guidelines](#developer-guidelines)
7. [Configuration](#configuration)
8. [Testing Offline Mode](#testing-offline-mode)
9. [Best Practices](#best-practices)
10. [Troubleshooting](#troubleshooting)
11. [Performance Considerations](#performance-considerations)
12. [Accessibility](#accessibility)
13. [i18n Support](#i18n-support)
14. [Browser Support](#browser-support)
15. [Future Enhancements](#future-enhancements)
16. [References](#references)

---

## Overview

SahiDawa is built as an **offline-first PWA** to serve rural Indian users who
may have intermittent or no internet connectivity. The offline system ensures
the app remains functional when network connectivity is lost, with graceful
fallbacks and automatic retry mechanisms.

The system is composed of seven integrated components that work together to
detect connectivity changes, serve cached content, queue failed requests, and
retry them automatically when connectivity is restored.

### Data Flow

```
User goes offline
    ↓
useOfflineStatus detects change
    ↓
OfflineBanner shows "You are offline"
    ↓
Failed API requests trigger retry logic
    ↓
Requests cached in memory queue
    ↓
Service Worker serves cached content
    ↓
User comes back online
    ↓
useOnlineRetry triggers
    ↓
Queued requests retried automatically
    ↓
Success toast shown
    ↓
OfflineBanner hides after 3 seconds
```

---

## Architecture

### Components

#### 1. `useOfflineStatus` Hook (`hooks/useOfflineStatus.ts`)

Monitors online/offline status using the browser's `navigator.onLine` event.
Manages state for offline indicators and UI updates. Provides a callback
registration system for retry logic when coming back online.

```typescript
const { isOffline, isStatusDirty, registerRetryCallback } = useOfflineStatus();
```

---

#### 2. `OfflineBanner` Component (`components/OfflineBanner.tsx`)

Displays a connection status banner at the top of the page. Shows
"You are offline" when disconnected and auto-hides after 3 seconds when
reconnected. Uses Tailwind CSS animations for smooth transitions and integrates
with i18n for multilingual support.

---

#### 3. Request Retry System (`lib/apiWithRetry.ts`)

Implements exponential backoff retry logic with jitter. Wraps all API calls
for consistent retry behavior.

**Features:**
- Exponential backoff: $\text{delay} = \min(\text{initial} \times 2^{attempt}, \text{max})$
- Jitter to prevent thundering herd: $\pm 10\%$ random variance
- Configurable retry attempts (default: 3)
- Selective retry based on HTTP status codes (does not retry 400/401/403/404)
- Timeout handling with `AbortController`
- Offline request queue for batching

---

#### 4. `OfflineErrorBoundary` Component (`components/OfflineErrorBoundary.tsx`)

React error boundary for offline/network errors. Catches and prevents app
crashes, provides graceful fallback UI, and distinguishes between network
errors and other errors.

---

#### 5. Service Worker (`public/sw.js`)

Implements multi-strategy caching (see [Service Worker Logic](#service-worker-logic)
below). Also handles push notifications for medicine recalls and manages cache
cleanup on activation.

---

#### 6. `ServiceWorkerProvider` (`components/ServiceWorkerProvider.tsx`)

Registers the service worker on app initialization, monitors for updates, and
provides console feedback for debugging.

---

#### 7. Offline Page (`app/[locale]/offline/page.tsx`)

Fallback page shown when the user tries to access uncached content while
offline. Provides a user-friendly UI with retry options and links to homepage.

---

#### 8. `useOnlineRetry` Hook (`hooks/useOnlineRetry.ts`)

Automatically retries queued requests when the app comes back online. Shows
toast notifications for retry status and integrates with the offline request
queue.

---

## Service Worker Logic

The service worker (`public/sw.js`) sits between the browser and the network,
intercepting all requests and applying the appropriate caching strategy.

### Cache Names

```javascript
const OFFLINE_CACHE_NAME = 'sahidawa-offline-v1';
const API_CACHE_NAME     = 'sahidawa-api-v1';
const STATIC_CACHE_NAME  = 'sahidawa-static-v1';
```

### How Status Detection Works

The app detects offline status via the browser's `online`/`offline` events:

```javascript
window.addEventListener('online',  () => console.log('Back online!'));
window.addEventListener('offline', () => console.log('Gone offline'));
```

---

## Caching Strategies

### API Calls — Network-First

1. Attempt the network request
2. If successful, cache the response and return it
3. If offline or failed, return the cached response if available
4. If no cache exists, return an offline error

### HTML Documents — Network-First for Navigation

1. Attempt the network request
2. If successful, cache and return
3. If offline, return the cached version
4. If no cache, return the offline fallback page

### Static Assets — Cache-First

1. Check the cache first
2. If found, return immediately
3. If not cached, fetch from network
4. Cache successful responses
5. If offline and no cache, return placeholder for images

---

## Retry Logic

### Exponential Backoff with Jitter

```
Attempt 1: Immediate
Attempt 2: 1000ms + jitter
Attempt 3: 2000ms + jitter
Attempt 4: 4000ms + jitter (max 10000ms)
```

### Selective Retry

| Status | Retried? |
|---|---|
| 5xx server errors | ✅ Yes |
| Network errors | ✅ Yes |
| Timeouts | ✅ Yes |
| 429 Rate limit | ✅ Yes |
| 400 Bad request | ❌ No |
| 401 Unauthorized | ❌ No |
| 403 Forbidden | ❌ No |
| 404 Not found | ❌ No |

---

## Developer Guidelines

### Using Offline Status in Components

```typescript
'use client';

import { useOfflineStatus } from '@/hooks/useOfflineStatus';
import { OfflineBanner } from '@/components/OfflineBanner';

export function MyComponent() {
  const { isOffline, isStatusDirty } = useOfflineStatus();

  if (isOffline) {
    return <div>Currently offline - using cached data</div>;
  }

  return <div>Normal online mode</div>;
}
```

### Using Retry Logic for API Calls

```typescript
import { fetchWithRetry } from '@/lib/apiWithRetry';

async function verifyMedicine(barcode: string) {
  // fetchWithRetry automatically:
  // 1. Retries on network errors
  // 2. Uses exponential backoff
  // 3. Respects timeouts

  const response = await fetchWithRetry(
    `${API_BASE}/api/verify`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ barcode }),
      timeout: 10000, // 10 second timeout
    },
    {
      maxRetries: 3,
      initialDelayMs: 1000,
    }
  );

  if (!response.ok) throw new Error('Verification failed');
  return response.json();
}
```

All API functions in `lib/api.ts` use `fetchWithRetry()`:

```typescript
// Before
const res = await fetch(`${API_BASE}/api/verify`, {...});

// After
const res = await fetchWithRetry(`${API_BASE}/api/verify`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ batchNumber }),
  timeout: 10000,
});
```

### Automatic Retry on Reconnect

```typescript
'use client';

import { useOnlineRetry } from '@/hooks/useOnlineRetry';

export function MyPage() {
  // Hook automatically handles:
  // 1. Detecting when app comes back online
  // 2. Retrying queued requests
  // 3. Showing toast notifications
  useOnlineRetry();

  return (
    <div>
      <h1>Content that auto-retries when online</h1>
    </div>
  );
}
```

### Adding Error Boundaries

Error boundaries are already configured in `app/[locale]/layout.tsx`, but you
can add them to specific sections:

```typescript
'use client';

import { OfflineErrorBoundary } from '@/components/OfflineErrorBoundary';

export default function ScanPage() {
  return (
    <OfflineErrorBoundary>
      <ScannerContent />
    </OfflineErrorBoundary>
  );
}
```

### Providing Offline Feedback in Forms

```typescript
'use client';

import { useOfflineStatus } from '@/hooks/useOfflineStatus';

export function MedicineForm() {
  const { isOffline } = useOfflineStatus();

  return (
    <form>
      <input disabled={isOffline} placeholder="Medicine name" />
      {isOffline && <p>Changes will sync when online</p>}
    </form>
  );
}
```

### Handling Errors Gracefully

```typescript
try {
  await verifyMedicine(barcode);
} catch (error) {
  if (error.message.includes('offline')) {
    // Show cached data
  } else {
    // Show error to user
  }
}
```

---

## Configuration

### Retry Settings

Modify retry behavior in `lib/apiWithRetry.ts`:

```typescript
const DEFAULT_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,              // Max retry attempts
  initialDelayMs: 1000,       // Initial backoff delay
  maxDelayMs: 10000,          // Maximum backoff delay
  backoffMultiplier: 2,       // Exponential multiplier
  shouldRetry: (error, attempt) => {
    // Custom retry logic
    return attempt <= 3;
  },
};
```

### Cache Settings

Modify service worker caching in `public/sw.js`:

```javascript
const OFFLINE_CACHE_NAME = 'sahidawa-offline-v1';
const API_CACHE_NAME     = 'sahidawa-api-v1';
const STATIC_CACHE_NAME  = 'sahidawa-static-v1';
```

---

## Testing Offline Mode

### Method 1: DevTools Simulation

```
1. Open Chrome DevTools (F12)
2. Go to Network tab
3. Check "Offline" checkbox
4. Make API calls — they will queue and retry
5. Uncheck "Offline" — requests retry automatically
```

Or via the command palette: DevTools → Cmd+Shift+P → "Go offline"

### Method 2: Network Throttling

```
1. DevTools → Network tab
2. Throttling dropdown → Select "Offline"
3. Make slow network observations
4. Switch back to normal
```

### Method 3: Terminal (macOS/Linux)

```bash
# Simulate network failure
sudo ifconfig en0 down

# Restore network
sudo ifconfig en0 up
```

### Test Endpoints

```bash
# Test API with retry
curl -X POST http://localhost:4000/api/verify \
  -H "Content-Type: application/json" \
  -d '{"batchNumber":"ABC123"}'

# Test after going offline in DevTools
# Request should retry automatically
```

### What to Verify

- Navigate to a page while online, go offline, refresh — page should still work
- Make an API call while offline — request should queue
- Come back online — queued request should auto-retry and show a success toast

---

## Best Practices

### 1. Always use `fetchWithRetry` for API calls

```typescript
// ✅ Good
const res = await fetchWithRetry(`${API_BASE}/api/verify`, options);

// ❌ Avoid
const res = await fetch(`${API_BASE}/api/verify`, options);
```

### 2. Always provide offline feedback in interactive UI

Show the user that their action will sync later, and disable inputs that
cannot work offline.

### 3. Test all four offline scenarios

- No internet connection
- Slow/intermittent connection
- Request timeout
- Failed retries exhausted

### 4. Implement cache versioning when updating the service worker

Update the cache name constants (e.g., `sahidawa-cache-v2`) to force
clients to pick up the new service worker and evict stale cached responses.

---

## Troubleshooting

### Service Worker Not Registering

- HTTPS is required in production (localhost is fine for development)
- Clear browser cache and reload
- Check the console for registration errors
- Verify via console:

```typescript
navigator.serviceWorker.getRegistrations()
  .then(regs => console.log('SW Registrations:', regs));
```

### Offline Banner Always Showing

- Check browser's offline simulation is disabled (DevTools → Network → uncheck Offline)
- May indicate intermittent connectivity — check your network
- Restart browser

### Retries Not Happening

- Verify `fetchWithRetry` is used (not raw `fetch`)
- Check the Network tab for retry attempts
- Ensure no JavaScript errors in console

### Cache Not Working

1. Clear browser cache: DevTools → Application → Clear site data
2. Restart browser
3. Check SW is active: DevTools → Application → Service Workers

### Cached Data Is Stale

Implement cache versioning — update the cache name constant in `public/sw.js`
(e.g., `sahidawa-cache-v2`) to force a fresh cache.

---

## Performance Considerations

### Cache Size Targets

| Cache | Target Size |
|---|---|
| API Cache | ~5MB |
| Static Cache | ~10MB (CSS, JS, images) |
| Offline Pages | ~100KB |

### Network Behavior

- Retries use exponential backoff to avoid overwhelming the server
- Jitter prevents synchronized retry storms
- Timeout prevents hanging requests

### Mobile / Rural Network Considerations

- Lightweight retries for data-constrained networks
- Respects user's save-data preference (planned)
- Clear offline indicators designed for rural users with low-end devices

### Performance Tips

1. Only cache essential data to keep cache size small
2. Use aggressive timeouts — fail fast on slow networks
3. Batch related requests together
4. Reduce retry frequency on low battery (planned)

---

## Accessibility

- `OfflineBanner` includes ARIA labels
- Error messages are readable by screen readers
- Keyboard navigation is supported throughout
- Color contrast meets WCAG AA standards

---

## i18n Support

Offline messages support all 22 Indian languages via i18n translations.
See [`messages/en.json`](../../messages/en.json) for the full translation keys.

| Key | Purpose |
|---|---|
| `offline.bannerOffline` | Offline status banner |
| `offline.descriptionOffline` | Offline description |
| `offline.bannerOnline` | Online status banner |
| `offline.descriptionOnline` | Reconnecting description |
| `offline.dismiss` | Dismiss button |

---

## Browser Support

| Browser | Support |
|---|---|
| Chrome / Edge 60+ | ✅ Full support |
| Firefox 55+ | ✅ Full support |
| Safari 11.1+ | ✅ Full support |
| IE 11 | ❌ Not supported |

---

## Future Enhancements

1. **Sync API** — Queue writes (POST/PUT/DELETE) for background sync
2. **Bandwidth Awareness** — Detect 2G/3G and adjust retry behavior
3. **Smart Caching** — Predict which pages the user will need offline
4. **IndexedDB** — Store larger datasets offline (medicine database)
5. **Push Notifications** — Sync alerts when coming back online
6. **Periodic Sync** — Background sync when on WiFi
7. **Metrics** — Cache hit rate monitoring and error log analysis

---

## Related Files

| File | Purpose |
|---|---|
| `lib/apiWithRetry.ts` | Fetch wrapper with retry logic |
| `lib/api.ts` | API utility functions |
| `hooks/useOfflineStatus.ts` | Offline detection hook |
| `hooks/useOnlineRetry.ts` | Auto-retry on reconnect hook |
| `components/OfflineBanner.tsx` | Connection status banner |
| `components/OfflineErrorBoundary.tsx` | Error boundary for network errors |
| `components/ServiceWorkerProvider.tsx` | Service worker registration |
| `public/sw.js` | Service worker implementation |
| `app/[locale]/offline/page.tsx` | Offline fallback page |

---

## References

- [MDN — Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [MDN — Cache API](https://developer.mozilla.org/en-US/docs/Web/API/Cache)
- [Google Workbox Strategies](https://developers.google.com/web/tools/workbox/modules/workbox-strategies)
- [Network First vs Cache First](https://developers.google.com/web/tools/workbox/modules/workbox-strategies#network_first_network_falling_back_to_cache)