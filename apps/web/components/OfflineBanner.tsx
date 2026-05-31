"use client";

import { useEffect, useState } from "react";
import { WifiOff, Wifi, X } from "lucide-react";
import { useOfflineStatus } from "@/hooks/useOfflineStatus";
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
 */
export function OfflineBanner() {
    const t = useTranslations("offline");
    const { isOffline, isStatusDirty, isTestMode } = useOfflineStatus();
    const [isDismissed, setIsDismissed] = useState(false);
    const [isVisible, setIsVisible] = useState(false);

    // Reset dismissal whenever the connection status changes
    useEffect(() => {
        if (isStatusDirty) {
            setIsDismissed(false);
        }
    }, [isStatusDirty]);

    // Drive banner visibility
    useEffect(() => {
        if (isOffline && !isDismissed) {
            setIsVisible(true);
        } else if (!isOffline && isVisible) {
            // Stay visible briefly to show "Back Online" message, then hide
            const timer = setTimeout(() => {
                setIsVisible(false);
                setIsDismissed(true);
            }, 3000);
            return () => clearTimeout(timer);
        } else if (!isOffline && !isVisible) {
            // Nothing to show
        }
    }, [isOffline, isDismissed, isVisible]);

    const handleDismiss = () => {
        setIsDismissed(true);
        setIsVisible(false);
    };

    // Don't mount the DOM node at all when not needed (unless in test mode)
    if (!isVisible && !isTestMode) return null;

    const isCurrentlyOffline = isOffline || isTestMode;

    return (
        <div
            role="alert"
            aria-live="assertive"
            aria-atomic="true"
            className={`fixed right-0 left-0 z-50 transition-all duration-300 ease-in-out ${isVisible || isTestMode ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"} ${
                isCurrentlyOffline
                    ? "border-b-2 border-amber-600 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500"
                    : "border-b-2 border-emerald-600 bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500"
            } shadow-lg`}
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
                                {isCurrentlyOffline ? t("bannerOffline") : t("bannerOnline")}
                            </p>
                            <p className="truncate text-xs text-white/85">
                                {isCurrentlyOffline
                                    ? t("descriptionOffline") + (isTestMode ? " · Test mode" : "")
                                    : t("descriptionOnline")}
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
            </div>
        </div>
    );
}
