"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { initBackgroundSync } from "@/lib/backgroundSync";

/**
 * ServiceWorkerProvider
 *
 * Registers the SahiDawa service worker and manages its lifecycle:
 * - Registers /sw.js on mount (production + browsers with SW support)
 * - Polls for updates every 60 s
 * - Notifies the user with a Sonner toast when a new version is ready,
 *   offering a one-click reload to activate it
 */
export function ServiceWorkerProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

        let updateInterval: ReturnType<typeof setInterval> | null = null;

        const register = async () => {
            try {
                const registration = await navigator.serviceWorker.register("/sw.js", {
                    scope: "/",
                });

                // Poll for SW updates every 60 s
                updateInterval = setInterval(() => {
                    registration.update().catch(() => {});
                }, 60_000);

                // Listen for a new SW becoming available
                registration.addEventListener("updatefound", () => {
                    const newWorker = registration.installing;
                    if (!newWorker) return;

                    newWorker.addEventListener("statechange", () => {
                        if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                            // A new SW has installed but is waiting to activate — prompt the user
                            toast.info("A new version of SahiDawa is available.", {
                                id: "sw-update",
                                duration: Infinity,
                                action: {
                                    label: "Update now",
                                    onClick: () => {
                                        // Tell the waiting SW to skip waiting and take control
                                        newWorker.postMessage({ type: "SKIP_WAITING" });
                                        // Reload once the new SW has claimed this page
                                        navigator.serviceWorker.addEventListener(
                                            "controllerchange",
                                            () => window.location.reload(),
                                            { once: true }
                                        );
                                    },
                                },
                            });
                        }
                    });
                });
            } catch (error) {
                // Service worker registration failed — app still works, just without offline support
                console.warn("[SW] Registration failed:", error);
            }
        };

        register();

        // Clean up the polling interval when the component unmounts
        return () => {
            if (updateInterval) clearInterval(updateInterval);
        };
    }, []);

    // Global background sync for offline reports
    useEffect(() => {
        if (typeof window === "undefined") return;
        const cleanup = initBackgroundSync((count) => {
            toast.success(
                `${count} pending report${count > 1 ? "s" : ""} submitted now that you're back online.`
            );
            // Dispatch a custom event so active pages (like ReportWizard) can update their UI
            window.dispatchEvent(new CustomEvent("reports-synced", { detail: { count } }));
        });
        return cleanup;
    }, []);

    return <>{children}</>;
}
