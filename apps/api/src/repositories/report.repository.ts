import { supabase } from '../db/client';

/**
 * Repository for counterfeit report database operations.
 * Centralizes all report queries.
 */
export const reportRepository = {
    /**
     * Find a report by ID.
     */
    async findById(id: string, columns = '*') {
        const { data, error } = await supabase
            .from('counterfeit_reports')
            .select(columns)
            .eq('id', id)
            .maybeSingle();
        if (error) throw error;
        return data;
    },

    /**
     * Find a report by hash (for duplicate detection).
     */
    async findByHash(reportHash: string) {
        const { data, error } = await supabase
            .from('counterfeit_reports')
            .select('id, reported_brand_name, status, district, created_at, scanned_barcode, medicine_id')
            .eq('report_hash', reportHash)
            .maybeSingle();
        if (error) throw error;
        return data;
    },

    /**
     * Get reports for a specific user (reporter).
     */
    async findByReporter(userId: string, limit = 20, cursor?: string) {
        let query = supabase
            .from('counterfeit_reports')
            .select('id, reported_brand_name, scanned_barcode, photo_url, district, status, created_at')
            .eq('reporter_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (cursor) {
            query = query.lt('created_at', cursor);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data;
    },

    /**
     * Get paginated reports with optional filters.
     */
    async findPaginated(options: {
        page?: number;
        limit?: number;
        status?: string;
        district?: string;
        brand?: string;
    } = {}) {
        const { page = 1, limit = 20, status, district, brand } = options;
        const offset = (page - 1) * limit;

        let query = supabase
            .from('counterfeit_reports')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (status) query = query.eq('status', status);
        if (district) query = query.ilike('district', `%${district}%`);
        if (brand) query = query.ilike('reported_brand_name', `%${brand}%`);

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
     * Create a new report.
     */
    async create(reportData: Record<string, unknown>) {
        const { data, error } = await supabase
            .from('counterfeit_reports')
            .insert(reportData)
            .select('id, reported_brand_name, status, district, created_at, scanned_barcode, medicine_id')
            .single();
        if (error) throw error;
        return data;
    },

    /**
     * Upsert a report (for duplicate handling).
     */
    async upsert(reportData: Record<string, unknown>) {
        const { data, error } = await supabase
            .from('counterfeit_reports')
            .upsert(reportData, { onConflict: 'report_hash', ignoreDuplicates: true })
            .select('id, reported_brand_name, status, district, created_at, scanned_barcode, medicine_id');
        if (error) throw error;
        return data?.[0] || null;
    },

    /**
     * Update report status.
     */
    async updateStatus(id: string, status: string, updateData?: Record<string, unknown>) {
        const payload = { status, ...updateData, updated_at: new Date().toISOString() };
        const { data, error } = await supabase
            .from('counterfeit_reports')
            .update(payload)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    /**
     * Count reports by status for a district.
     */
    async countByDistrict(district: string) {
        const { count, error } = await supabase
            .from('counterfeit_reports')
            .select('*', { count: 'exact', head: true })
            .eq('district', district);
        if (error) throw error;
        return count || 0;
    },

    /**
     * Get report statistics.
     */
    async getStats() {
        const { data, error } = await supabase
            .from('counterfeit_reports')
            .select('status')
            .order('created_at', { ascending: false })
            .limit(1000);
        if (error) throw error;

        const stats = { total: data?.length || 0, pending: 0, verified: 0, rejected: 0 };
        data?.forEach((r: { status: string }) => {
            if (r.status === 'pending') stats.pending++;
            else if (r.status === 'verified') stats.verified++;
            else if (r.status === 'rejected') stats.rejected++;
        });
        return stats;
    },
};
