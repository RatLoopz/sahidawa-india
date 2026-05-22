"use client";

import { useEffect, useState } from "react";
import { WifiOff, Wifi } from "lucide-react";
import { useOfflineStatus } from "@/hooks/useOfflineStatus";

/**
 * OfflineBanner - Displays connection status to user
 * Shows when offline, hides when online
 * Can be dismissed by user and reappears if connection is lost
 */
export function OfflineBanner() {
    const { isOffline, isStatusDirty, isTestMode } = useOfflineStatus();
    const [isDismissed, setIsDismissed] = useState(false);
    const [showAnimation, setShowAnimation] = useState(false);

    // Debug logging
    useEffect(() => {
        console.log("🔍 OfflineBanner state:", {
            isOffline,
            isStatusDirty,
            isTestMode,
            isDismissed,
            showAnimation,
            shouldRender: isOffline && !isDismissed,
        });
    }, [isOffline, isStatusDirty, isDismissed, showAnimation, isTestMode]);

    // Reset dismissal state when status changes
    useEffect(() => {
        if (isStatusDirty) {
            setIsDismissed(false);
        }
    }, [isStatusDirty]);

    // Trigger animation on state change
    useEffect(() => {
        if (isOffline && !isDismissed) {
            console.log("✨ Triggering banner animation");
            setShowAnimation(true);
        } else {
            setShowAnimation(false);
        }
    }, [isOffline, isDismissed]);

    // Auto-hide banner 5 seconds after coming back online
    useEffect(() => {
        if (!isOffline && showAnimation) {
            console.log("💚 Coming back online, auto-hiding banner in 3s");
            const timer = setTimeout(() => {
                setShowAnimation(false);
                setIsDismissed(true);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [isOffline, showAnimation]);

    const handleDismiss = () => {
        setIsDismissed(true);
        setShowAnimation(false);
    };

    // Render nothing if online and not showing and not in test mode
    if (!isOffline && !showAnimation && !isTestMode) {
        return null;
    }

    const bannerText = isOffline ? "⚠️ YOU ARE OFFLINE" : "✅ BACK ONLINE";
    const bannerDescription = isOffline
        ? "Changes will sync when connection returns" + (isTestMode ? " [TEST MODE]" : "")
        : "Syncing data...";

    return (
        <div
            className={`fixed top-20 right-0 left-0 z-40 transition-all duration-300 ${
                showAnimation ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"
            } ${
                isOffline
                    ? "border-b-4 border-amber-700 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 shadow-2xl"
                    : "border-b-4 border-emerald-700 bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500 shadow-2xl"
            }`}
            style={{
                backgroundColor: isOffline ? "#f59e0b" : "#10b981",
                borderBottom: `4px solid ${isOffline ? "#b45309" : "#059669"}`,
                top: "80px",
            }}
        >
            <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex flex-1 items-center gap-4">
                        {isOffline ? (
                            <WifiOff
                                size={28}
                                className="flex-shrink-0 animate-pulse text-white drop-shadow-lg"
                            />
                        ) : (
                            <Wifi
                                size={28}
                                className="flex-shrink-0 animate-pulse text-white drop-shadow-lg"
                            />
                        )}
                        <div className="min-w-0 flex-1">
                            <p className="text-base font-bold text-white drop-shadow-md md:text-lg">
                                {bannerText}
                            </p>
                            <p className="text-sm text-white/90 drop-shadow-sm">
                                {bannerDescription}
                            </p>
                        </div>
                    </div>

                    {isOffline && (
                        <button
                            onClick={handleDismiss}
                            className="flex-shrink-0 transform rounded-lg border border-white/40 bg-white/20 px-6 py-2.5 text-base font-bold whitespace-nowrap text-white shadow-lg transition-all hover:scale-105 hover:bg-white/30"
                            aria-label="Dismiss"
                        >
                            {isTestMode ? "Close Demo" : "Dismiss"}
                        </button>
                    )}

                    {isTestMode && !isOffline && (
                        <button
                            onClick={() => {
                                // Remove offline=true from URL and reload
                                const url = new URL(window.location.href);
                                url.searchParams.delete("offline");
                                window.location.href = url.toString();
                            }}
                            className="flex-shrink-0 transform rounded-lg border border-white/40 bg-white/20 px-6 py-2.5 text-base font-bold whitespace-nowrap text-white shadow-lg transition-all hover:scale-105 hover:bg-white/30"
                            aria-label="Exit test mode"
                        >
                            Exit Demo
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
