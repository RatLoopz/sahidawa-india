import { supabase } from "../db/client";

/**
 * Repository for notification subscriber database operations.
 * Centralizes all subscriber queries.
 */
export const subscriberRepository = {
    /**
     * Find a subscriber by phone number.
     */
    async findByPhone(phone: string) {
        const { data, error } = await supabase
            .from("notification_subscribers")
            .select("*")
            .eq("phone", phone)
            .maybeSingle();
        if (error) throw error;
        return data;
    },

    /**
     * Find a subscriber by user ID.
     */
    async findByUserId(userId: string) {
        const { data, error } = await supabase
            .from("notification_subscribers")
            .select("phone, channels, language, district, is_active")
            .eq("user_id", userId)
            .maybeSingle();
        if (error) throw error;
        return data;
    },

    /**
     * Get all active subscribers for a district (for broadcasting).
     */
    async findActiveByDistrict(district: string, batchSize = 500, offset = 0) {
        let query = supabase
            .from("notification_subscribers")
            .select("*")
            .eq("is_active", true)
            .eq("status", "active")
            .order("id")
            .range(offset, offset + batchSize - 1);

        if (district && district.toLowerCase() !== "all") {
            query = query.ilike("district", `%${district}%`);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    },

    /**
     * Create a new subscriber.
     */
    async create(subscriberData: Record<string, unknown>) {
        const { data, error } = await supabase
            .from("notification_subscribers")
            .insert(subscriberData)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    /**
     * Update a subscriber.
     */
    async update(phone: string, updateData: Record<string, unknown>) {
        const { data, error } = await supabase
            .from("notification_subscribers")
            .update({ ...updateData, updated_at: new Date().toISOString() })
            .eq("phone", phone)
            .select();
        if (error) throw error;
        return data;
    },

    /**
     * Update subscriber by user ID.
     */
    async updateByUserId(userId: string, updateData: Record<string, unknown>) {
        const { data, error } = await supabase
            .from("notification_subscribers")
            .update({ ...updateData, updated_at: new Date().toISOString() })
            .eq("user_id", userId)
            .select();
        if (error) throw error;
        return data;
    },

    /**
     * Delete a subscriber by phone.
     */
    async deleteByPhone(phone: string) {
        const { data, error } = await supabase
            .from("notification_subscribers")
            .delete()
            .eq("phone", phone)
            .select();
        if (error) throw error;
        return data;
    },

    /**
     * Delete a subscriber by user ID.
     */
    async deleteByUserId(userId: string) {
        const { data, error } = await supabase
            .from("notification_subscribers")
            .delete()
            .eq("user_id", userId)
            .select();
        if (error) throw error;
        return data;
    },

    /**
     * Get subscriber count by district.
     */
    async countByDistrict() {
        const { data, error } = await supabase
            .from("notification_subscribers")
            .select("district, is_active");
        if (error) throw error;

        const counts: Record<string, { total: number; active: number }> = {};
        data?.forEach((s: { district: string; is_active: boolean }) => {
            const d = s.district || "unknown";
            if (!counts[d]) counts[d] = { total: 0, active: 0 };
            counts[d].total++;
            if (s.is_active) counts[d].active++;
        });
        return counts;
    },
};
