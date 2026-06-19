/** Pharmacy row as returned by the get_nearest_pharmacies RPC. */
export interface PharmacyRpcResult {
    name: string;
    address: string;
    district: string | null;
    state: string | null;
    phone_number: string | null;
    is_verified: boolean;
    lat: number;
    lng: number;
    distance: number;
}

/** Formatted pharmacy object returned in triage responses. */
export interface FormattedPharmacy {
    name: string;
    address: string;
    lat: number;
    lng: number;
    distance: string;
    phone_number: string | null;
    is_verified: boolean;
    district: string | null;
    state: string | null;
}
