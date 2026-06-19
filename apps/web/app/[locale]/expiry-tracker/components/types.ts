import type React from "react";

export interface Medicine {
    id: string;
    name: string;
    expiryDate: string;
    batchNumber?: string;
    notes?: string;
}

export type FilterStatus = "all" | "expired" | "expiringSoon" | "safe";
export type SortOption = "expirySoonest" | "expiryLatest" | "alpha";

export interface ExpiryStatus {
    icon: React.ReactNode;
    text: string;
    color: string;
    key: FilterStatus;
}
