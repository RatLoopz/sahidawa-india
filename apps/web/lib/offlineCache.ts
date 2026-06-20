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
  return data ? JSON.parse(data) : [];
};