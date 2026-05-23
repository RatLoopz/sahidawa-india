# PWA Offline Support Implementation

## Overview

This document describes the PWA offline support system implemented for SahiDawa. The system ensures that the app remains functional when network connectivity is lost, with graceful fallbacks and automatic retry mechanisms.

## Architecture

### Components

#### 1. **useOfflineStatus Hook** (`hooks/useOfflineStatus.ts`)
- Monitors online/offline status using browser's `navigator.onLine` event
- Manages state for offline indicators and UI updates
- Provides callback registration system for retry logic when coming back online

**Usage:**
```typescript
const { isOffline, isStatusDirty, registerRetryCallback } = useOfflineStatus();
```

#### 2. **OfflineBanner Component** (`components/OfflineBanner.tsx`)
- Displays connection status banner at top of page
- Shows "You are offline" when disconnected
- Auto-hides after 3 seconds when reconnected
- Uses Tailwind CSS animations for smooth transitions
- Integrates with i18n for multilingual support

#### 3. **Request Retry System** (`lib/apiWithRetry.ts`)
- Implements exponential backoff retry logic with jitter
- Wraps all API calls for consistent retry behavior
- Configurable retry attempts (default: 3)
- Includes timeout support
- Manages offline request queue for batching

**Features:**
- Exponential backoff: $\text{delay} = \min(\text{initial} \times 2^{attempt}, \text{max})$
- Jitter to prevent thundering herd: $\pm 10\%$ random variance
- Selective retry based on HTTP status codes
- Doesn't retry 400/401/403/404 errors
- Timeout handling with AbortController

#### 4. **OfflineErrorBoundary Component** (`components/OfflineErrorBoundary.tsx`)
- React error boundary for offline/network errors
- Catches and prevents app crashes
- Provides graceful fallback UI
- Distinguishes between network and other errors

#### 5. **Service Worker** (`public/sw.js`)
- Implements multi-strategy caching:
  - **Network-first for API calls**: Uses network, falls back to cache
  - **Network-first for HTML**: For navigation, respects user intent
  - **Cache-first for static assets**: CSS, JS, images, fonts
- Handles push notifications for medicine recalls
- Manages cache cleanup on activation

#### 6. **ServiceWorkerProvider** (`components/ServiceWorkerProvider.tsx`)
- Registers service worker on app initialization
- Monitors for service worker updates
- Provides console feedback for debugging

#### 7. **Offline Page** (`app/[locale]/offline/page.tsx`)
- Fallback page when accessing uncached content offline
- User-friendly UI with retry options
- Links to homepage

#### 8. **useOnlineRetry Hook** (`hooks/useOnlineRetry.ts`)
- Automatically retries queued requests when coming back online
- Shows toast notifications for retry status
- Integrates with offline request queue

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

## Caching Strategies

### API Calls (Network-First)
1. Attempt network request
2. If successful, cache response and return
3. If offline/failed, return cached response if available
4. If no cache, return offline error

### HTML Documents (Network-First for Navigation)
1. Attempt network request
2. If successful, cache and return
3. If offline, return cached version
4. If no cache, return offline fallback page

### Static Assets (Cache-First)
1. Check cache first
2. If found, return immediately
3. If not cached, fetch from network
4. Cache successful responses
5. If offline, return placeholder for images

## Retry Logic

### Exponential Backoff with Jitter

```
Attempt 1: Immediate
Attempt 2: 1000ms + jitter
Attempt 3: 2000ms + jitter
Attempt 4: 4000ms + jitter (max 10000ms)
```

### Selective Retry

- **Retried**: 5xx, network errors, timeouts, 429 (rate limit)
- **Not retried**: 400, 401, 403, 404

## i18n Support

Offline messages support all 22 Indian languages via i18n translations:
- `offline.bannerOffline` - Offline status banner
- `offline.descriptionOffline` - Offline description
- `offline.bannerOnline` - Online status banner
- `offline.descriptionOnline` - Reconnecting description
- `offline.dismiss` - Dismiss button

See [messages/en.json](../../messages/en.json) for full translations.

## API Updates

All API functions in `lib/api.ts` now use `fetchWithRetry()`:

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

## Testing Offline Functionality

### In Browser DevTools

1. **Simulate offline:**
   - DevTools → Network tab → Offline checkbox
   - Or: DevTools → Cmd+Shift+P → "Go offline"

2. **Test cache:**
   - Navigate to a page while online
   - Go offline
   - Refresh page - should still work

3. **Test retry:**
   - Go offline
   - Make an API call (will queue)
   - Come back online
   - Should auto-retry and show toast

### Test Endpoints

```bash
# Test API with retry
curl -X POST http://localhost:4000/api/verify \
  -H "Content-Type: application/json" \
  -d '{"batchNumber":"ABC123"}'

# Test after going offline in DevTools
# Request should retry automatically
```

## Performance Considerations

### Cache Size
- **API Cache**: ~5MB (configurable)
- **Static Cache**: ~10MB (for CSS, JS, images)
- **Offline Pages**: ~100KB

### Network Behavior
- Retries use exponential backoff to avoid overwhelming server
- Jitter prevents synchronized retry storms
- Timeout prevents hanging requests

### Mobile Considerations
- Lightweight retries for data-constrained networks
- Respects user's save-data preference (Future enhancement)
- Clear offline indicators for rural users

## Accessibility

- OfflineBanner includes ARIA labels
- Error messages readable by screen readers
- Keyboard navigation supported
- Color contrast meets WCAG standards

## Error Handling

### User-Facing Errors
- Network errors → "You are offline" message
- Timeouts → Automatic retry with backoff
- All failures → Graceful fallback UI

### Development Logging
- Console logs for all retry attempts
- Service worker registration status
- Cache size and hit rates (future)

## Future Enhancements

1. **Sync API** - Queue writes (POST/PUT/DELETE) for later
2. **Bandwidth Awareness** - Detect slow 2G/3G and adjust retry behavior
3. **Smart Caching** - Predict which pages user will need offline
4. **IndexedDB** - Store larger datasets offline (medicine database)
5. **Push Notifications** - Sync alerts when coming back online
6. **Periodic Sync** - Background sync when on WiFi

## Troubleshooting

### Service Worker Not Registering
- Check HTTPS (required in production, localhost OK)
- Clear browser cache and reload
- Check console for registration errors

### Offline Banner Always Showing
- May indicate intermittent connectivity
- Check browser's offline simulation is disabled
- Restart browser

### Retries Not Working
- Verify service worker is registered
- Check Network tab for request status
- Ensure API endpoints are responding

## Browser Support

- ✅ Chrome/Edge 60+
- ✅ Firefox 55+
- ✅ Safari 11.1+
- ⚠️ IE 11 (no support)

## Related Issues/PRs

- #[issue-number] - PWA Offline Support
- Fixes: Offline users losing app access
- Related: #[PR-number] - Service Worker enhancement

## References

- [MDN - Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [MDN - Cache API](https://developer.mozilla.org/en-US/docs/Web/API/Cache)
- [Google Workbox Strategies](https://developers.google.com/web/tools/workbox/modules/workbox-strategies)
- [Network First vs Cache First](https://developers.google.com/web/tools/workbox/modules/workbox-strategies#network_first_network_falling_back_to_cache)
