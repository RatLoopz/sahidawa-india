/** Pharmacy row as returned by the get_nearest_pharmacies RPC. */
export interface PharmacyRpcResult {
    id?: string;
    name: string;
    address: string;
    district: string | null;
    state: string | null;
    phone_number: string | null;
    is_verified: boolean;
    lat: number;
    lng: number;
    distance: number;
    updated_at?: string;
    is_active?: boolean;
    deleted_at?: string | null;
}

/** Formatted pharmacy object returned in triage responses. */
export interface FormattedPharmacy {
    id?: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
    distance: string;
    phone_number: string | null;
    is_verified: boolean;
    district: string | null;
    state: string | null;
    updated_at?: string;
    is_active?: boolean;
    deleted_at?: string | null;
}
