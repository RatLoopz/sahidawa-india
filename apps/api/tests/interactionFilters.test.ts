import {
    buildInteractionPairFilter,
    buildMedicineResolutionFilter,
} from "../src/routes/interactions";

describe("interaction PostgREST filters", () => {
    it("quotes and escapes medicine lookup values inside OR filters", () => {
        const payload = 'Crocin"%),id.eq.123,or(generic_name.ilike."%%';

        expect(buildMedicineResolutionFilter(payload)).toBe(
            'id.eq."Crocin""\\%),id.eq.123,or(generic\\_name.ilike.""\\%\\%",brand_name.ilike."%Crocin""\\%),id.eq.123,or(generic\\_name.ilike.""\\%\\%%",generic_name.ilike."%Crocin""\\%),id.eq.123,or(generic\\_name.ilike.""\\%\\%%"'
        );
    });

    it("quotes and escapes both drug ids in pair interaction filters", () => {
        const first = 'warfarin"),or(drug_a_id.eq."%';
        const second = "ibuprofen,drug_b_id.eq.paracetamol";

        expect(buildInteractionPairFilter(first, second)).toBe(
            'and(drug_a_id.eq."warfarin""),or(drug\\_a\\_id.eq.""\\%",drug_b_id.eq."ibuprofen,drug\\_b\\_id.eq.paracetamol"),and(drug_a_id.eq."ibuprofen,drug\\_b\\_id.eq.paracetamol",drug_b_id.eq."warfarin""),or(drug\\_a\\_id.eq.""\\%")'
        );
    });
});
