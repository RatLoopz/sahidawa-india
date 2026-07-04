import { buildMedicineVoiceSearchFilter } from "../src/routes/medicine";

describe("buildMedicineVoiceSearchFilter", () => {
    it("builds the expected normal PostgREST OR filter", () => {
        expect(buildMedicineVoiceSearchFilter("Crocin")).toBe(
            'brand_name.ilike."%Crocin%",generic_name.ilike."%Crocin%"'
        );
    });

    it("quotes and escapes quote, wildcard, comma, and paren payloads", () => {
        const payload = 'Crocin"%),id.eq.123,or(generic_name.ilike."%%';

        expect(buildMedicineVoiceSearchFilter(payload)).toBe(
            'brand_name.ilike."%Crocin""\\%),id.eq.123,or(generic\\_name.ilike.""\\%\\%%",generic_name.ilike."%Crocin""\\%),id.eq.123,or(generic\\_name.ilike.""\\%\\%%"'
        );
    });
});
