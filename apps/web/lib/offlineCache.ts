// apps/web/lib/offlineCache.ts

const CACHE_KEY = "sahidawa_offline_scans";

export interface ScanResult {
    brand_name: string;
    active_components: string;
    counterfeit_status: string;
    timestamp: number;
}

export const saveVerificationResult = (data: ScanResult) => {
    if (typeof window === "undefined") return;

    const existingData = getVerificationResults();
    const newData = [data, ...existingData].slice(0, 10); // Keep only last 10 scans
    localStorage.setItem(CACHE_KEY, JSON.stringify(newData));
};

export const getVerificationResults = (): ScanResult[] => {
    if (typeof window === "undefined") return [];

    const data = localStorage.getItem(CACHE_KEY);
    if (!data) return [];

    try {
        const parsed = JSON.parse(data);
        if (!Array.isArray(parsed)) {
            throw new Error("Cached scan history is not an array");
        }
        return parsed;
    } catch (err) {
        console.warn("[offlineCache] Corrupted scan history detected, clearing cache:", err);
        localStorage.removeItem(CACHE_KEY);
        return [];
    }
};