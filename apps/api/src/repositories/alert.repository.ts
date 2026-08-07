import { supabase } from "../db/client";

/**
 * Repository for drug alert database operations.
 * Centralizes all drug alert queries.
 */
export const alertRepository = {
    /**
     * Find an alert by ID.
     */
    async findById(id: string, columns = "*") {
        const { data, error } = await supabase
            .from("drug_alerts")
            .select(columns)
            .eq("id", id)
            .maybeSingle();
        if (error) throw error;
        return data;
    },

    /**
     * Get paginated alerts with optional filters.
     */
    async findPaginated(
        options: {
            page?: number;
            limit?: number;
            brand?: string;
            region?: string;
            batchNumber?: string;
        } = {}
    ) {
        const { page = 1, limit = 20, brand, region, batchNumber } = options;
        const offset = (page - 1) * limit;

        let query = supabase
            .from("drug_alerts")
            .select("*", { count: "exact" })
            .order("created_at", { ascending: false })
            .range(offset, offset + limit - 1);

        if (brand) query = query.ilike("brand_name", `%${brand}%`);
        if (region) query = query.ilike("region", `%${region}%`);
        if (batchNumber) query = query.eq("batch_number", batchNumber);

        const { data, error, count } = await query;
        if (error) throw error;

        return {
            data: data || [],
            total: count || 0,
            page,
            limit,
            totalPages: count ? Math.ceil(count / limit) : 0,
        };
    },

    /**
     * Get alerts for a specific medicine.
     */
    async findByMedicineId(medicineId: string, limit = 50) {
        const { data, error } = await supabase
            .from("drug_alerts")
            .select("*")
            .eq("medicine_id", medicineId)
            .order("created_at", { ascending: false })
            .limit(limit);
        if (error) throw error;
        return data;
    },

    /**
     * Get alerts by district for targeted notifications.
     */
    async findByDistrict(district: string, limit = 100) {
        const { data, error } = await supabase
            .from("drug_alerts")
            .select("*")
            .ilike("district", `%${district}%`)
            .eq("is_active", true)
            .order("created_at", { ascending: false })
            .limit(limit);
        if (error) throw error;
        return data;
    },

    /**
     * Get system-wide alert statistics.
     */
    async getStats() {
        const { data, error } = await supabase.from("drug_alerts").select("severity, is_active");
        if (error) throw error;

        const stats = {
            total: data?.length || 0,
            active: 0,
            critical: 0,
            high: 0,
            medium: 0,
            low: 0,
        };
        data?.forEach((a: { severity: string; is_active: boolean }) => {
            if (a.is_active) stats.active++;
            if (a.severity === "critical") stats.critical++;
            else if (a.severity === "high") stats.high++;
            else if (a.severity === "medium") stats.medium++;
            else if (a.severity === "low") stats.low++;
        });
        return stats;
    },

    /**
     * Create a new alert.
     */
    async create(alertData: Record<string, unknown>) {
        const { data, error } = await supabase
            .from("drug_alerts")
            .insert(alertData)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    /**
     * Update alert status.
     */
    async updateStatus(id: string, updateData: Record<string, unknown>) {
        const { data, error } = await supabase
            .from("drug_alerts")
            .update({ ...updateData, updated_at: new Date().toISOString() })
            .eq("id", id)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    /**
     * Mark alert as broadcasted.
     */
    async markBroadcasted(id: string) {
        const { error } = await supabase
            .from("drug_alerts")
            .update({ broadcasted: true })
            .eq("id", id);
        if (error) throw error;
    },

    /**
     * Snooze an alert until a specific time.
     */
    async snooze(id: string, snoozedUntil: string) {
        const { data, error } = await supabase
            .from("drug_alerts")
            .update({ snoozed_until: snoozedUntil, updated_at: new Date().toISOString() })
            .eq("id", id)
            .select()
            .single();
        if (error) throw error;
        return data;
    },
};
