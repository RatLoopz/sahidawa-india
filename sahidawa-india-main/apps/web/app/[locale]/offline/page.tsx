'use client';

import { useEffect, useState } from 'react';
import { WifiOff, Home, RefreshCw } from 'lucide-react';

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(window.navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) {
    // Redirect to home if we're back online
    typeof window !== 'undefined' && window.location.href === '/' ? null : null;
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-6">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center mx-auto mb-6">
          <WifiOff size={40} className="text-amber-600 dark:text-amber-400" />
        </div>

        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">
          Offline Mode
        </h1>

        <p className="text-slate-600 dark:text-slate-400 mb-2">
          You don't have an internet connection right now.
        </p>

        <p className="text-sm text-slate-500 dark:text-slate-500 mb-8">
          Some features are unavailable while offline. Try to connect to the internet
          or browse cached content.
        </p>

        <div className="space-y-3">
          <button
            onClick={() => window.location.reload()}
            className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
          >
            <RefreshCw size={18} />
            Try Again
          </button>

          <a
            href="/"
            className="block bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white font-semibold py-3 px-4 rounded-lg transition-colors"
          >
            <span className="inline-flex items-center justify-center gap-2">
              <Home size={18} />
              Go to Home
            </span>
          </a>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-500 mt-6">
          SahiDawa will automatically sync when your connection returns.
        </p>
      </div>
    </main>
  );
}
