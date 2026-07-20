import type React from "react";
import type { TrackedMedicine } from "@sahidawa/types";

export type { TrackedMedicine as Medicine };

export type FilterStatus = "all" | "expired" | "expiringSoon" | "safe";
export type SortOption = "expirySoonest" | "expiryLatest" | "alpha";

export interface ExpiryStatus {
    icon: React.ReactNode;
    text: string;
    color: string;
    key: FilterStatus;
}
