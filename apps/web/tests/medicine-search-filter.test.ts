import { buildMedicineNameSearchFilter } from "@/lib/supabase/medicineSearch";

describe("buildMedicineNameSearchFilter", () => {
    it("builds the expected normal PostgREST OR filter", () => {
        expect(buildMedicineNameSearchFilter(" Crocin ")).toBe(
            'brand_name.ilike."%Crocin%",generic_name.ilike."%Crocin%"'
        );
    });

    it("returns null for queries below the search threshold", () => {
        expect(buildMedicineNameSearchFilter("c")).toBeNull();
    });

    it("keeps quote, wildcard, comma, and paren payloads inside quoted filter values", () => {
        const payload = 'Crocin"%),id.eq.123,or(generic_name.ilike."%%';

        expect(buildMedicineNameSearchFilter(payload)).toBe(
            'brand_name.ilike."%Crocin""\\%),id.eq.123,or(generic\\_name.ilike.""\\%\\%%",generic_name.ilike."%Crocin""\\%),id.eq.123,or(generic\\_name.ilike.""\\%\\%%"'
        );
    });
});
