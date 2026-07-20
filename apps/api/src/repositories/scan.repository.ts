import { supabase } from "../db/client";
import { escapePostgrest, buildOrConditions } from "../utils/db";

export const scanRepository = {
    async searchMedicinesByWords(searchWords: string[]) {
        const orFilter = buildOrConditions(["brand_name", "generic_name"], searchWords);
        const { data, error } = await supabase
            .from("medicines")
            .select("brand_name, generic_name")
            .or(orFilter)
            .limit(80);
        if (error) throw error;
        return data;
    },

    async findMedicineByMatchedName(matchedName: string) {
        const { data, error } = await supabase
            .from("medicines")
            .select(
                "id, brand_name, generic_name, manufacturer, batch_number, " +
                    "expiry_date, cdsco_approval_status, is_counterfeit_alert, " +
                    "is_cdsco_verified, cdsco_match_score, matched_cdsco_product, " +
                    "matched_cdsco_manufacturer, product_match_score, manufacturer_match_score, " +
                    "composition, mrp, jan_aushadhi_price"
            )
            .or(
                `brand_name.ilike."%${escapePostgrest(matchedName)}%",generic_name.ilike."%${escapePostgrest(matchedName)}%"`
            )
            .limit(1)
            .maybeSingle();
        if (error) throw error;
        return data;
    },

    async rpcSearchMedicinesText(queryText: string, matchCount = 3) {
        return supabase.rpc("search_medicines_text", {
            query_text: queryText,
            match_count: matchCount,
        });
    },

    async searchMedicinesFallback(words: string[]) {
        const orConditions = buildOrConditions(["brand_name", "generic_name"], words);
        const { data, error } = await supabase
            .from("medicines")
            .select("brand_name, generic_name")
            .or(orConditions)
            .limit(3);
        if (error) throw error;
        return data;
    },

    async findMedicineByBrandName(brandName: string) {
        const { data, error } = await supabase
            .from("medicines")
            .select(
                "id, brand_name, generic_name, manufacturer, batch_number, expiry_date, cdsco_approval_status, is_counterfeit_alert, is_cdsco_verified, cdsco_match_score, matched_cdsco_product, matched_cdsco_manufacturer, product_match_score, manufacturer_match_score, composition, mrp, jan_aushadhi_price"
            )
            .or(
                `brand_name.ilike."%${escapePostgrest(brandName)}%",generic_name.ilike."%${escapePostgrest(brandName)}%"`
            )
            .limit(1)
            .maybeSingle();
        if (error) throw error;
        return data as any;
    },
};
