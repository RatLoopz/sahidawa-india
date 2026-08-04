"use client";

import { useEffect, useState } from "react";
import { WifiOff, Wifi, X, RotateCw, Trash2 } from "lucide-react";
import { useOfflineStatus } from "@/hooks/useOfflineStatus";
import { useSyncQueue } from "@/hooks/useSyncQueue";
import { useTranslations } from "next-intl";

/**
 * OfflineBanner — Sticky connectivity status banner.
 *
 * Behaviour:
 * - Slides in from the top when the user loses connectivity.
 * - Changes colour and icon when connectivity is restored.
 * - Auto-dismisses 3 s after coming back online.
 * - Can be manually dismissed by the user at any time.
 * - Reappears automatically on subsequent disconnections.
 * - Stays visible while the server has rejected queued actions so the user can
 *   retry them (after refreshing credentials) or discard them.
 */
export function OfflineBanner() {
    const t = useTranslations("offline");
    const { isOffline, isStatusDirty, isTestMode } = useOfflineStatus();
    const { pendingCount, rejected, retry, discard } = useSyncQueue();
    const [isDismissed, setIsDismissed] = useState(false);
    const [isVisible, setIsVisible] = useState(false);

    const hasRejectedSync = rejected.length > 0;

    // Reset dismissal whenever the connection status changes
    useEffect(() => {
        if (isStatusDirty) {
            setIsDismissed(false);
        }
    }, [isStatusDirty]);

    // Drive banner visibility — also stay visible while queued actions were
    // rejected by the server so the user can act on them.
    useEffect(() => {
        if ((isOffline && !isDismissed) || hasRejectedSync) {
            setIsVisible(true);
        } else if (!isOffline && !hasRejectedSync && isVisible) {
            // Stay visible briefly to show "Back Online" message, then hide
            const timer = setTimeout(() => {
                setIsVisible(false);
                setIsDismissed(true);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [isOffline, isDismissed, isVisible, hasRejectedSync]);

    const handleDismiss = () => {
        setIsDismissed(true);
        setIsVisible(false);
    };

    // Don't mount the DOM node at all when not needed (unless in test mode)
    if (!isVisible && !isTestMode) return null;

    const isCurrentlyOffline = isOffline || isTestMode;
    const needsAttention = !isCurrentlyOffline && hasRejectedSync;
    const bannerTone = isCurrentlyOffline
        ? "border-amber-600 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500"
        : needsAttention
          ? "border-red-600 bg-gradient-to-r from-red-600 via-red-500 to-red-500"
          : "border-emerald-600 bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500";

    return (
        <div
            role="alert"
            aria-live="assertive"
            aria-atomic="true"
            className={`fixed right-0 left-0 z-50 transition-all duration-300 ease-in-out ${isVisible || isTestMode ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"} ${bannerTone} shadow-lg`}
            style={{ top: "64px" }}
        >
            <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between gap-3">
                    {/* Icon + message */}
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                        {isCurrentlyOffline ? (
                            <WifiOff
                                size={22}
                                aria-hidden="true"
                                className="flex-shrink-0 animate-pulse text-white drop-shadow"
                            />
                        ) : (
                            <Wifi
                                size={22}
                                aria-hidden="true"
                                className="flex-shrink-0 text-white drop-shadow"
                            />
                        )}

                        <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-white drop-shadow-sm">
                                {isCurrentlyOffline
                                    ? t("bannerOffline")
                                    : hasRejectedSync
                                      ? t("syncFailedTitle")
                                      : t("bannerOnline")}
                            </p>
                            <p className="truncate text-xs text-white/85">
                                {isCurrentlyOffline
                                    ? t("descriptionOffline") + (isTestMode ? " · Test mode" : "")
                                    : hasRejectedSync
                                      ? t("syncFailedDescription")
                                      : t("descriptionOnline")}
                                {pendingCount > 0 && isCurrentlyOffline && (
                                    <span className="ml-2 rounded bg-amber-700/50 px-2 py-0.5 font-semibold">
                                        {pendingCount} action(s) pending sync
                                    </span>
                                )}
                            </p>
                        </div>
                    </div>

                    {/* Dismiss button (only shown when offline) */}
                    {isCurrentlyOffline && (
                        <button
                            id="offline-banner-dismiss"
                            onClick={handleDismiss}
                            aria-label={t("dismiss")}
                            className="flex-shrink-0 rounded-md p-1.5 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
                        >
                            <X size={18} />
                        </button>
                    )}
                </div>

                {/* Rejected sync actions — retry or discard */}
                {hasRejectedSync && (
                    <div className="mt-3 rounded-md bg-black/20 p-3">
                        <ul className="space-y-2">
                            {rejected.slice(0, 5).map((entry) => (
                                <li
                                    key={entry.id}
                                    className="flex flex-wrap items-center gap-2 text-xs text-white"
                                >
                                    <span className="min-w-0 flex-1 truncate">
                                        <span className="font-semibold">
                                            {entry.method} {entry.status}
                                        </span>
                                        {" — "}
                                        {entry.error
                                            ? entry.error.replace(/\s+/g, " ").slice(0, 160)
                                            : entry.url}
                                    </span>
                                    <button
                                        onClick={() => discard(entry.id)}
                                        aria-label={t("syncDiscard")}
                                        className="flex shrink-0 items-center gap-1 rounded bg-white/20 px-2 py-1 font-semibold transition-colors hover:bg-white/30"
                                    >
                                        <Trash2 size={14} aria-hidden="true" />
                                        {t("syncDiscard")}
                                    </button>
                                </li>
                            ))}
                            {rejected.length > 5 && (
                                <li className="text-xs text-white/80">
                                    +{rejected.length - 5} more
                                </li>
                            )}
                        </ul>
                        <button
                            onClick={retry}
                            className="mt-3 flex items-center gap-1.5 rounded bg-white px-3 py-1.5 text-xs font-bold text-red-600 transition-colors hover:bg-white/90"
                        >
                            <RotateCw size={14} aria-hidden="true" />
                            {t("syncRetry")}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
