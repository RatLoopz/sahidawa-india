import { escapePostgrest } from "./utils";

export function buildMedicineNameSearchFilter(query: string): string | null {
    const q = query.trim();
    if (q.length < 2) return null;

    const pattern = `%${escapePostgrest(q)}%`;
    return `brand_name.ilike."${pattern}",generic_name.ilike."${pattern}"`;
}
