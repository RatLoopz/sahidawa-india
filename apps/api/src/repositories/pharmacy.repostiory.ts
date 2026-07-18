// apps/api/src/repositories/pharmacy.repository.ts
import { supabase } from "../db/client";

export class PharmacyRepository {
    // Bulk upload repository handler
    async insertBulkInventory(rows: any[]) {
        const { data, error } = await supabase
            .from("pharmacy_inventory") // Humari inventory table ka naam schema me pharmacy_inventory tha
            .insert(rows);
        if (error) throw error;
        return data;
    }

    // Find unique physical pharmacy check
    async findPharmacyByLicense(licenseId: string) {
        return await supabase
            .from("pharmacies")
            .select("id")
            .eq("license_id", licenseId)
            .maybeSingle();
    }

    // Insert a newly registered pharmacy entry
    async createPharmacy(insertData: any) {
        return await supabase.from("pharmacies").insert(insertData).select().single();
    }

    // Core database hit for inventory matches
    async searchInventoryByMedicines(orFilter: string) {
        return await supabase
            .from("pharmacy_inventory")
            .select(
                "medicine_name, pharmacy_id, pharmacies!inner(id, name, address, district, state, phone_number, is_verified, status)"
            )
            .or(orFilter)
            .limit(500);
    }

    async softDeletePharmacy(id: string) {
        const { data, error } = await supabase
            .from("pharmacies")
            .update({ status: "archived" })
            .eq("id", id);
        if (error) throw error;
        return data;
    }
}
