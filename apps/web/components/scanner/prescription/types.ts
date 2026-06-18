import type { MedicineExplanation } from "@/lib/api";

export interface DashboardMedicine {
    id: string;
    verified: boolean;
    brand_name: string;
    generic_name: string;
    manufacturer: string;
    cdsco_approval_status: string;
    composition?: string | null;
    mrp?: number | null;
    jan_aushadhi_price?: number | null;
    explanation?: MedicineExplanation | null;
    explanationLoading?: boolean;
    explanationError?: string | null;
}
