'use client';

import { useEffect, useState, useCallback } from 'react';
import { WifiOff, Home, RefreshCw, Wifi, Pill, MapPin, ShieldCheck } from 'lucide-react';

/**
 * OfflinePage — Premium offline fallback UI for SahiDawa.
 * Automatically redirects to home when the connection is restored.
 */
export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [showReconnected, setShowReconnected] = useState(false);

  // Sync initial state from navigator.onLine after mount
  useEffect(() => {
    setIsOnline(window.navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnected(true);
      // Auto-redirect after a short confirmation delay
      setTimeout(() => {
        window.location.href = '/';
      }, 1800);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleRetry = useCallback(() => {
    setIsRetrying(true);
    setRetryCount((c) => c + 1);

    // Give the browser time to attempt a real network check
    setTimeout(() => {
      if (navigator.onLine) {
        window.location.reload();
      } else {
        setIsRetrying(false);
      }
    }, 1500);
  }, []);

  // ─── Reconnected state ───────────────────────────────────────────────────
  if (showReconnected) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-6">
        <div className="text-center max-w-md animate-fadeIn">
          {/* Animated checkmark ring */}
          <div className="relative w-28 h-28 mx-auto mb-8">
            <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
            <div className="relative w-28 h-28 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-2xl shadow-emerald-500/40">
              <Wifi size={52} className="text-white" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-white mb-3">
            Back Online! 🎉
          </h1>
          <p className="text-emerald-400 text-lg mb-2">Connection restored</p>
          <p className="text-slate-400 text-sm">Redirecting you to SahiDawa…</p>

          {/* Progress bar */}
          <div className="mt-6 w-full bg-slate-700 rounded-full h-1.5 overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full animate-progress" />
          </div>
        </div>
      </main>
    );
  }

  // ─── Offline state ────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 relative overflow-hidden">
      {/* Background glow blobs */}
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative text-center max-w-lg w-full">
        {/* Icon */}
        <div className="relative w-28 h-28 mx-auto mb-8">
          <div className="absolute inset-0 rounded-full bg-amber-500/20 animate-pulse" />
          <div className="relative w-28 h-28 rounded-full bg-gradient-to-br from-amber-500/30 to-amber-600/20 border border-amber-500/30 flex items-center justify-center backdrop-blur-sm">
            <WifiOff size={52} className="text-amber-400" />
          </div>
        </div>

        {/* Headline */}
        <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">
          You're Offline
        </h1>
        <p className="text-slate-400 text-lg mb-2 leading-relaxed">
          SahiDawa needs an internet connection to verify medicines and locate pharmacies.
        </p>
        <p className="text-slate-500 text-sm mb-10 leading-relaxed">
          Please check your Wi-Fi or mobile data and try again.
          {retryCount > 0 && (
            <span className="ml-1 text-amber-400">
              (Attempt {retryCount})
            </span>
          )}
        </p>

        {/* Action buttons */}
        <div className="space-y-3 mb-10">
          <button
            id="offline-retry-btn"
            onClick={handleRetry}
            disabled={isRetrying}
            className="w-full inline-flex items-center justify-center gap-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:-translate-y-0.5 active:translate-y-0"
          >
            <RefreshCw
              size={18}
              className={isRetrying ? 'animate-spin' : ''}
            />
            {isRetrying ? 'Checking connection…' : 'Try Again'}
          </button>

          <a
            id="offline-home-btn"
            href="/"
            className="block w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-200 font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 hover:-translate-y-0.5"
          >
            <span className="inline-flex items-center justify-center gap-2.5">
              <Home size={18} />
              Go to Home
            </span>
          </a>
        </div>

        {/* Feature chips — reassure user what cached features they can still use */}
        <div className="border-t border-slate-800 pt-8">
          <p className="text-slate-500 text-xs font-medium uppercase tracking-widest mb-4">
            Previously visited pages may still be available
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {[
              { icon: ShieldCheck, label: 'Cached Verifications' },
              { icon: MapPin,       label: 'Saved Pharmacies' },
              { icon: Pill,         label: 'Browsed Medicines' },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-1.5 bg-slate-800/60 border border-slate-700/60 text-slate-400 text-xs font-medium px-3 py-1.5 rounded-full"
              >
                <Icon size={12} />
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Brand footer */}
        <p className="text-xs text-slate-600 mt-8">
          SahiDawa will automatically sync when your connection returns.
        </p>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes progress {
          from { width: 0%; }
          to   { width: 100%; }
        }
        .animate-fadeIn  { animation: fadeIn  0.5s ease-out forwards; }
        .animate-progress { animation: progress 1.6s ease-in-out forwards; }
      `}</style>
    </main>
  );
}
