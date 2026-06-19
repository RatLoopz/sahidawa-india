"use client";

import { useEffect, useState } from "react";

export type NetworkQuality = "fast" | "slow" | "offline" | "unknown";

interface NetworkInformation {
    effectiveType?: "slow-2g" | "2g" | "3g" | "4g";
    downlink?: number;
    rtt?: number;
    saveData?: boolean;
    addEventListener?: (type: string, listener: () => void) => void;
    removeEventListener?: (type: string, listener: () => void) => void;
}

function getQuality(connection: NetworkInformation | null): NetworkQuality {
    if (!navigator.onLine) return "offline";
    if (!connection) return "unknown";

    const { effectiveType, downlink, saveData } = connection;

    if (saveData) return "slow";
    if (effectiveType === "slow-2g" || effectiveType === "2g") return "slow";
    if (effectiveType === "3g" && (downlink ?? 1) < 1.5) return "slow";

    return "fast";
}

/**
 * Detects network quality using the Network Information API.
 * Returns "slow" for 2G/slow-2G/save-data mode, "fast" for 3G/4G,
 * "offline" when disconnected, and "unknown" when API is unavailable.
 *
 * Use this to adapt timeouts, image quality, and retry strategies.
 */
export function useNetworkQuality(): {
    quality: NetworkQuality;
    isSlow: boolean;
    saveData: boolean;
} {
    const [quality, setQuality] = useState<NetworkQuality>("unknown");
    const [saveData, setSaveData] = useState(false);

    useEffect(() => {
        if (typeof navigator === "undefined") return;

        const connection =
            (navigator as unknown as { connection?: NetworkInformation }).connection ??
            (navigator as unknown as { mozConnection?: NetworkInformation }).mozConnection ??
            (navigator as unknown as { webkitConnection?: NetworkInformation }).webkitConnection ??
            null;

        function update() {
            const q = getQuality(connection);
            setQuality(q);
            setSaveData(connection?.saveData ?? false);
        }

        update();

        // Listen for connection changes
        connection?.addEventListener?.("change", update);
        window.addEventListener("online", update);
        window.addEventListener("offline", update);

        return () => {
            connection?.removeEventListener?.("change", update);
            window.removeEventListener("online", update);
            window.removeEventListener("offline", update);
        };
    }, []);

    return { quality, isSlow: quality === "slow", saveData };
}
