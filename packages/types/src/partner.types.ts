export interface PharmacyPartner {
    id: string;
    pharmacy_name: string;
    pharmacist_name: string;
    license_number: string;
    phone_number: string;
    email?: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    latitude?: number;
    longitude?: number;
    status: "pending" | "verified" | "rejected";
    created_at: string;
    updated_at: string;
}

export type PharmacyPartnerRegistration = Omit<
    PharmacyPartner,
    "id" | "status" | "created_at" | "updated_at"
>;
