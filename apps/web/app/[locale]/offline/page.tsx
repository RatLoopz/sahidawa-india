"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
    WifiOff,
    Home,
    RefreshCw,
    Wifi,
    Pill,
    MapPin,
    ShieldCheck,
    PartyPopper,
    History,
} from "lucide-react";
import { getVerificationResults, type ScanResult } from "@/lib/offlineCache";
import { PageHeader } from "../components/PageHeader";

/**
 * OfflinePage — Premium offline fallback UI for SahiDawa.
 * Automatically redirects to home when the connection is restored.
 */
export default function OfflinePage() {
    const t = useTranslations("offline");
    const [isRetrying, setIsRetrying] = useState(false);
    const [retryCount, setRetryCount] = useState(0);
    const [showReconnected, setShowReconnected] = useState(false);
    const [history, setHistory] = useState<ScanResult[]>([]);
    // Sync initial state from navigator.onLine after mount
    useEffect(() => {
        setHistory(getVerificationResults());

        const handleOnline = () => {
            setShowReconnected(true);
            // Auto-redirect after a short confirmation delay
            setTimeout(() => {
                window.location.href = "/";
            }, 1800);
        };

        const handleOffline = () => {
            setShowReconnected(false);
        };

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
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
            <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-6">
                <div className="animate-fadeIn max-w-md text-center">
                    {/* Animated checkmark ring */}
                    <div className="relative mx-auto mb-8 h-28 w-28">
                        <div className="absolute inset-0 animate-ping rounded-full bg-emerald-500/20" />
                        <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-2xl shadow-emerald-500/40">
                            <Wifi size={52} className="text-white" />
                        </div>
                    </div>

                    <h1 className="mb-3 flex items-center justify-center gap-2 text-3xl font-bold text-white">
                        {t("bannerOnline")} <PartyPopper className="h-8 w-8 text-emerald-400" />
                    </h1>
                    <p className="mb-2 text-lg text-emerald-400">{t("descriptionOnline")}</p>
                    <p className="text-sm text-slate-400">{t("redirecting")}</p>

                    {/* Progress bar */}
                    <div className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-slate-700">
                        <div className="animate-progress h-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400" />
                    </div>
                </div>
            </main>
        );
    }

    // ─── Offline state ────────────────────────────────────────────────────────
    return (
        <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
            <PageHeader backHref="/" variant="dark" hideBackButton />
            {/* Background glow blobs */}
            <div className="pointer-events-none absolute top-1/4 left-1/4 h-64 w-64 rounded-full bg-amber-500/5 blur-3xl" />
            <div className="pointer-events-none absolute right-1/4 bottom-1/4 h-80 w-80 rounded-full bg-emerald-500/5 blur-3xl" />

            <div className="relative w-full max-w-lg text-center">
                {/* Icon */}
                <div className="relative mx-auto mb-8 h-28 w-28">
                    <div className="absolute inset-0 animate-pulse rounded-full bg-amber-500/20" />
                    <div className="relative flex h-28 w-28 items-center justify-center rounded-full border border-amber-500/30 bg-gradient-to-br from-amber-500/30 to-amber-600/20 backdrop-blur-sm">
                        <WifiOff size={52} className="text-amber-400" />
                    </div>
                </div>

                {/* Headline */}
                <h1 className="mb-3 text-4xl font-bold tracking-tight text-white">{t("title")}</h1>
                <p className="mb-2 text-lg leading-relaxed text-slate-400">{t("description")}</p>
                <p className="mb-10 text-sm leading-relaxed text-slate-500">
                    {t("subtitle")}
                    {retryCount > 0 && (
                        <span className="ml-1 text-amber-400">{t("attempt", { retryCount })}</span>
                    )}
                </p>

                {/* Action buttons */}
                <div className="mb-10 space-y-3">
                    <button
                        id="offline-retry-btn"
                        onClick={handleRetry}
                        disabled={isRetrying}
                        className="inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-6 py-3.5 font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all duration-200 hover:-translate-y-0.5 hover:from-emerald-500 hover:to-emerald-400 hover:shadow-emerald-500/40 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <RefreshCw size={18} className={isRetrying ? "animate-spin" : ""} />
                        {isRetrying ? t("checkingConnection") : t("tryAgain")}
                    </button>

                    <a
                        id="offline-home-btn"
                        href="/"
                        className="block w-full rounded-xl border border-slate-700 bg-slate-800 px-6 py-3.5 font-semibold text-slate-200 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-600 hover:bg-slate-700"
                    >
                        <span className="inline-flex items-center justify-center gap-2.5">
                            <Home size={18} />
                            {t("goHome")}
                        </span>
                    </a>
                </div>
                
                {history.length > 0 && (
                    <div className="mt-8 mb-10 text-left">
                        <h2 className="flex items-center gap-2 mb-4 text-sm font-bold tracking-wider text-emerald-400 uppercase">
                            <History size={16} /> Recent Scans
                        </h2>
                        <div className="space-y-3">
                            {history.map((scan, i) => (
                                <div key={i} className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
                                    <p className="font-bold text-white">{scan.brand_name}</p>
                                    <p className="text-xs text-slate-400">{scan.active_components}</p>
                                    <p className="text-[10px] text-emerald-500 font-bold mt-1">
                                        {scan.counterfeit_status}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {/* Feature chips — reassure user what cached features they can still use */}
                <div className="border-t border-slate-800 pt-8">
                    <p className="mb-4 text-xs font-medium tracking-widest text-slate-500 uppercase">
                        {t("cachedAvailable")}
                    </p>
                    <div className="flex flex-wrap justify-center gap-2">
                        {[
                            { icon: ShieldCheck, label: t("cachedVerifications") },
                            { icon: MapPin, label: t("savedPharmacies") },
                            { icon: Pill, label: t("browsedMedicines") },
                        ].map(({ icon: Icon, label }) => (
                            <div
                                key={label}
                                className="flex items-center gap-1.5 rounded-full border border-slate-700/60 bg-slate-800/60 px-3 py-1.5 text-xs font-medium text-slate-400"
                            >
                                <Icon size={12} />
                                {label}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Brand footer */}
                <p className="mt-8 text-xs text-slate-600">{t("footer")}</p>
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
