/**
 * Medicine-related shared types.
 *
 * SahiDawa has two distinct "medicine" entities that were previously declared
 * inline in multiple frontend files. They are kept separate on purpose because
 * they map to two different Supabase tables with different shapes:
 *
 *  - `Medicine`       → `public.medicines` (CDSCO master catalog)
 *  - `TrackedMedicine` → `public.expiry_tracker_items` (per-user expiry tracking)
 */

/**
 * A projection of a row from the `public.medicines` table (CDSCO master
 * catalog). Field names mirror the Supabase schema. The fields that are
 * nullable in the database (`barcode_id`, `batch_number`, `manufacturing_date`,
 * `expiry_date`, `composition`) and the audit columns (`is_counterfeit_alert`,
 * `created_at`, `updated_at`) are optional here because different frontend
 * surfaces select different subsets of columns. `medicine_type` is a UI-only
 * hint not stored in the database, and `mrp` / `jan_aushadhi_price` are optional
 * because some projection sites omit them.
 */
export interface Medicine {
    id: string;
    brand_name: string;
    generic_name: string;
    manufacturer: string;
    cdsco_approval_status: string;
    barcode_id?: string | null;
    composition?: string | null;
    batch_number?: string | null;
    manufacturing_date?: string | null;
    expiry_date?: string | null;
    is_counterfeit_alert?: boolean;
    created_at?: string;
    updated_at?: string;
    mrp?: number | null;
    jan_aushadhi_price?: number | null;
    medicine_type?: "brand" | "generic";
}

/**
 * A row from the `public.expiry_tracker_items` table (per-user expiry tracking).
 * The frontend models this with camelCase UI fields (e.g. `expiryDate`).
 */
export interface TrackedMedicine {
    id: string;
    name: string;
    expiryDate: string;
    batchNumber?: string;
    notes?: string;
    snoozedUntil?: string;
}
