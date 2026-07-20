import { supabase } from "../db/client";

export const pharmacyRepository = {
    async findByLicenseId(licenseId: string) {
        const { data, error } = await supabase
            .from("pharmacies")
            .select("id")
            .eq("license_id", licenseId)
            .maybeSingle();
        if (error) throw error;
        return data;
    },

    async insertPharmacy(payload: any) {
        const { data, error } = await supabase.from("pharmacies").insert(payload).select().single();
        if (error) throw error;
        return data;
    },

    async findById(id: string, columns = "id, created_by, status") {
        const { data, error } = await supabase
            .from("pharmacies")
            .select(columns)
            .eq("id", id)
            .maybeSingle();
        if (error) throw error;
        return data;
    },

    async findByCreatedBy(userId: string) {
        const { data, error } = await supabase
            .from("pharmacies")
            .select("id")
            .eq("created_by", userId)
            .maybeSingle();
        if (error) throw error;
        return data;
    },

    async updatePharmacy(id: string, updateData: any) {
        const { data, error } = await supabase
            .from("pharmacies")
            .update(updateData)
            .eq("id", id)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async softDelete(id: string) {
        const { error } = await supabase
            .from("pharmacies")
            .update({ status: "rejected" })
            .eq("id", id);
        if (error) throw error;
    },

    async searchInventoryByMedicine(orFilter: string) {
        const { data, error } = await supabase
            .from("pharmacy_inventory")
            .select(
                "medicine_name, pharmacy_id, pharmacies!inner(id, name, address, district, state, phone_number, is_verified, status)"
            )
            .or(orFilter)
            .limit(500);
        if (error) throw error;
        return data;
    },

    async rpcGetNearestPharmacies(lat: number, lng: number, radius: number) {
        return supabase.rpc("get_nearest_pharmacies", {
            query_lat: lat,
            query_lng: lng,
            search_radius_km: radius,
        });
    },

    async findAllApprovedForFallback() {
        const { data, error } = await supabase
            .from("pharmacies")
            .select("name, address, location, phone_number, is_verified, district, state, status")
            .eq("status", "approved")
            .limit(3000);
        if (error) throw error;
        return data;
    },

    async rpcGetPharmaciesInBounds(params: {
        south: number;
        west: number;
        north: number;
        east: number;
        limit: number;
        offset: number;
    }) {
        return supabase.rpc("get_pharmacies_in_bounds", params);
    },

    async rpcGetPharmaciesInBoundsDelta(params: {
        south: number;
        west: number;
        north: number;
        east: number;
        since: string;
    }) {
        return supabase.rpc("get_pharmacies_in_bounds_delta", params);
    },

    async findInBoundsFallback(since?: string) {
        let query = supabase.from("pharmacies").select("*").limit(3000);
        if (since) {
            query = query.gte("updated_at", since);
        }
        const { data, error } = await query;
        if (error) throw error;
        return data;
    },

    async insertInventoryRows(rows: any[]) {
        const { data, error } = await supabase.from("pharmacy_inventory").insert(rows);
        if (error) throw error;
        return data;
    },
};
