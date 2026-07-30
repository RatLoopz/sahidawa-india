import { supabase } from '../db/client';
import { escapePostgrest, buildOrConditions } from '../utils/db';

/**
 * Repository for medicine-related database operations.
 * Centralizes all medicine queries to eliminate scattered Supabase calls.
 */
export const medicineRepository = {
    /**
     * Find a medicine by its UUID.
     */
    async findById(id: string, columns = '*') {
        const { data, error } = await supabase
            .from('medicines')
            .select(columns)
            .eq('id', id)
            .maybeSingle();
        if (error) throw error;
        return data;
    },

    /**
     * Find a medicine by batch number.
     */
    async findByBatchNumber(batchNumber: string) {
        const { data, error } = await supabase
            .from('medicines')
            .select('id')
            .eq('batch_number', batchNumber);
        if (error) throw error;
        return data;
    },

    /**
     * Find a medicine by brand name (exact or fuzzy match).
     */
    async findByBrandName(brandName: string) {
        const { data, error } = await supabase
            .from('medicines')
            .select(
                'id, brand_name, generic_name, manufacturer, batch_number, ' +
                    'expiry_date, cdsco_approval_status, is_counterfeit_alert, ' +
                    'is_cdsco_verified, cdsco_match_score, matched_cdsco_product, ' +
                    'matched_cdsco_manufacturer, product_match_score, manufacturer_match_score, ' +
                    'composition, mrp, jan_aushadhi_price'
            )
            .or(
                `brand_name.ilike."%${escapePostgrest(brandName)}%",generic_name.ilike."%${escapePostgrest(brandName)}%"`
            )
            .limit(1)
            .maybeSingle();
        if (error) throw error;
        return data;
    },

    /**
     * Search medicines by multiple words (brand_name or generic_name).
     */
    async searchByWords(words: string[]) {
        const orFilter = buildOrConditions(['brand_name', 'generic_name'], words);
        const { data, error } = await supabase
            .from('medicines')
            .select('brand_name, generic_name')
            .or(orFilter)
            .limit(80);
        if (error) throw error;
        return data;
    },

    /**
     * Search medicines using the text search RPC.
     */
    async rpcSearchText(queryText: string, matchCount = 3) {
        return supabase.rpc('search_medicines_text', {
            query_text: queryText,
            match_count: matchCount,
        });
    },

    /**
     * Get medicines by composition for alternatives lookup.
     */
    async findByComposition(composition: string, limit = 10) {
        const { data, error } = await supabase
            .from('medicines')
            .select('id, brand_name, generic_name, mrp, jan_aushadhi_price')
            .eq('composition', composition)
            .limit(limit);
        if (error) throw error;
        return data;
    },

    /**
     * Get verified medicines (is_cdsco_verified = true).
     */
    async findVerified(limit = 50) {
        const { data, error } = await supabase
            .from('medicines')
            .select('id, brand_name, generic_name, manufacturer, is_cdsco_verified')
            .eq('is_cdsco_verified', true)
            .limit(limit);
        if (error) throw error;
        return data;
    },

    /**
     * Get counterfeit-flagged medicines.
     */
    async findCounterfeit(limit = 50) {
        const { data, error } = await supabase
            .from('medicines')
            .select('id, brand_name, generic_name, manufacturer, is_counterfeit_alert')
            .eq('is_counterfeit_alert', true)
            .limit(limit);
        if (error) throw error;
        return data;
    },

    /**
     * Upsert medicines (for ETL/bulk operations).
     */
    async upsert(medicines: Record<string, unknown>[]) {
        const { data, error } = await supabase
            .from('medicines')
            .upsert(medicines, { onConflict: 'id' });
        if (error) throw error;
        return data;
    },

    /**
     * Update a medicine by ID.
     */
    async update(id: string, updateData: Record<string, unknown>) {
        const { data, error } = await supabase
            .from('medicines')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data;
    },
};
