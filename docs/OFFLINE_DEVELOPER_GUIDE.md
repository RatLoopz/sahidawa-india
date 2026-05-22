# Offline Support - Developer Guide

## Quick Start

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

Error boundaries are already configured in `app/[locale]/layout.tsx`, but you can add them to specific sections:

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

## How It Works

### 1. Detecting Offline Status
The app detects offline status via the `online`/`offline` events:
```javascript
window.addEventListener('online', () => console.log('Back online!'));
window.addEventListener('offline', () => console.log('Gone offline'));
```

### 2. Showing Banner
When offline is detected, `OfflineBanner` automatically appears at the top of the page showing "You are offline".

### 3. Graceful Fallbacks
- **API calls**: Return cached responses if available
- **Static assets**: Served from cache immediately
- **Navigation**: Cached pages work normally

### 4. Automatic Retry
When the app detects it's back online, it automatically retries failed requests with exponential backoff.

## Testing Offline Mode

### Method 1: DevTools Simulation
```
1. Open Chrome DevTools (F12)
2. Go to Network tab
3. Check "Offline" checkbox
4. Make API calls - they'll queue and retry
5. Uncheck "Offline" - requests retry automatically
```

### Method 2: Network Throttling
```
1. DevTools → Network tab
2. Throttling dropdown → Select "Offline"
3. Make slow network observations
4. Switch back to normal
```

### Method 3: Terminal Command (macOS/Linux)
```bash
# Simulate network failure
sudo ifconfig en0 down

# Restore network
sudo ifconfig en0 up
```

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
const API_CACHE_NAME = 'sahidawa-api-v1';
const STATIC_CACHE_NAME = 'sahidawa-static-v1';
```

## Best Practices

### 1. Always Use `fetchWithRetry` for APIs
```typescript
// ✅ Good
const res = await fetchWithRetry(`${API_BASE}/api/verify`, options);

// ❌ Avoid
const res = await fetch(`${API_BASE}/api/verify`, options);
```

### 2. Provide Offline Feedback
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

### 3. Handle Errors Gracefully
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

### 4. Test Offline Scenarios
Create test cases for:
- No internet connection
- Slow/intermittent connection
- Request timeout
- Failed retries

## Troubleshooting

### Service Worker Not Registering
```typescript
// Check in browser console
navigator.serviceWorker.getRegistrations()
  .then(regs => console.log('SW Registrations:', regs));
```

### Cache Not Working
1. Clear browser cache: DevTools → Application → Clear site data
2. Restart browser
3. Check SW is active: DevTools → Application → Service Workers

### Retries Not Happening
1. Verify `fetchWithRetry` is used (not `fetch`)
2. Check Network tab shows retry attempts
3. Ensure no JavaScript errors in console

## Common Issues

### Issue: Offline banner stays visible
**Solution**: Check browser's offline simulation is off, or restart browser

### Issue: API calls fail immediately offline
**Solution**: Ensure you're using `fetchWithRetry`, not `fetch`

### Issue: Cached data is stale
**Solution**: Implement cache versioning (e.g., `sahidawa-cache-v2`)

## Performance Tips

1. **Optimize cache size**: Only cache essential data
2. **Use aggressive timeouts**: Fail fast on slow networks
3. **Batch retries**: Group related requests
4. **Monitor battery**: Reduce retry frequency on low battery

## Next Steps

1. Test offline functionality in production
2. Monitor error logs for retry patterns
3. Add metrics for cache hit rate
4. Implement write sync for forms (POST/PUT/DELETE)
5. Add bandwidth-aware retry strategies

## Related Files

- [Complete Documentation](./OFFLINE_SUPPORT.md)
- [API Utilities](../lib/api.ts)
- [Offline Hook](../hooks/useOfflineStatus.ts)
- [Service Worker](../public/sw.js)
- [Tests](../tests/offline.test.ts)

## Support

For issues or questions:
1. Check the [Offline Support Documentation](./OFFLINE_SUPPORT.md)
2. Review test files for examples
3. Open an issue on GitHub with reproduction steps
