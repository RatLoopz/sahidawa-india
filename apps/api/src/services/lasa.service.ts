import { supabase } from "../db/client";

export type LasaMatchType = "sound-alike" | "look-alike";

export interface LasaMatch {
    name: string;
    type: LasaMatchType;
    score?: number;
}

export const detectLasaConflicts = async (medicineName: string): Promise<LasaMatch[]> => {
    const targetName = medicineName.trim();
    
    if (!targetName) return [];

    const { data, error } = await supabase.rpc('find_lasa_conflicts', {
        target_name: targetName
    });

    if (error) {
        throw new Error(`Failed to check LASA conflicts: ${error.message}`);
    }

    return (data || []).map((row: any) => ({
        name: row.name,
        type: row.match_type as LasaMatchType,
        score: row.match_type === 'sound-alike' ? 1.0 : 0.85
    }));
};
