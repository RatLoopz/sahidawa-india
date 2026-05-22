'use client';

import { useEffect } from 'react';

/**
 * Component to register service worker and initialize offline support
 * Placed at the app root to ensure it runs on app load
 */
export function ServiceWorkerProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Only register in browser environment
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    // Register service worker
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('✅ Service Worker registered:', registration);

        // Check for updates periodically
        setInterval(() => {
          registration.update().catch((error) => {
            console.log('Failed to check for SW updates:', error);
          });
        }, 60000); // Check every minute

        // Listen for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New service worker is ready
                console.log('📦 New Service Worker version available');
              }
            });
          }
        });
      })
      .catch((error) => {
        console.log('❌ Service Worker registration failed:', error);
      });
  }, []);

  return <>{children}</>;
}
