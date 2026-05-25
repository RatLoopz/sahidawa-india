'use client';

import { useEffect, useState, useCallback } from 'react';

/**
 * Minimal type definition for the browser's BeforeInstallPromptEvent.
 * Not yet part of the official TypeScript lib types.
 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

/**
 * useInstallPrompt
 *
 * Hook for handling the PWA "Add to Home Screen" install prompt.
 *
 * Usage:
 * ```tsx
 * const { isInstallable, promptInstall, isInstalled } = useInstallPrompt();
 * ```
 *
 * - `isInstallable`: true when the browser has a deferred install prompt ready.
 * - `isInstalled`:   true when the app is already running as a standalone PWA.
 * - `promptInstall`: call this to trigger the native install dialog.
 */
export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if already running as an installed PWA
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    setIsInstalled(standalone);

    // Capture the deferred install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    // Hide the prompt if the app gets installed in another tab / session
    const handleAppInstalled = () => {
      setIsInstallable(false);
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  /**
   * Trigger the native PWA install dialog.
   * Returns the user's choice ('accepted' | 'dismissed') or null if unavailable.
   */
  const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | null> => {
    if (!deferredPrompt) return null;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    // The prompt can only be used once; discard it afterwards
    setDeferredPrompt(null);
    setIsInstallable(false);

    return outcome;
  }, [deferredPrompt]);

  return { isInstallable, isInstalled, promptInstall };
}
