import { renderToStaticMarkup } from "react-dom/server";

import ComparisonGrid, { type Medicine } from "../src/components/ComparisonGrid";
import { COMPARE_SELECT_FIELDS } from "../src/lib/compareSelectFields";
import { mapMedicineRow } from "../src/lib/mapMedicineRow";

function buildMedicine(overrides: Partial<Medicine> = {}): Medicine {
    return {
        id: "med-1",
        brand_name: "Dolo 650",
        generic_name: "Paracetamol",
        composition: "Paracetamol 650 mg",
        manufacturer: "Micro Labs",
        cdsco_approval_status: "approved",
        expiry_date: "2027-06-01",
        ...overrides,
    };
}

describe("compare pricing", () => {
    it("maps mrp and Jan Aushadhi price from medicine rows", () => {
        expect(
            mapMedicineRow({
                id: "med-1",
                brand_name: "Dolo 650",
                generic_name: "Paracetamol",
                composition: "Paracetamol 650 mg",
                manufacturer: "Micro Labs",
                cdsco_approval_status: "approved",
                expiry_date: "2027-06-01",
                mrp: 30,
                jan_aushadhi_price: 15,
            })
        ).toEqual({
            id: "med-1",
            brand_name: "Dolo 650",
            generic_name: "Paracetamol",
            composition: "Paracetamol 650 mg",
            manufacturer: "Micro Labs",
            cdsco_approval_status: "approved",
            expiry_date: "2027-06-01",
            mrp: 30,
            jan_aushadhi_price: 15,
        });
    });

    it("includes both pricing fields in the compare-page search query", () => {
        expect(COMPARE_SELECT_FIELDS).toContain("mrp");
        expect(COMPARE_SELECT_FIELDS).toContain("jan_aushadhi_price");
    });

    it("preserves the empty state when no medicines are selected", () => {
        const markup = renderToStaticMarkup(<ComparisonGrid medicine1={null} medicine2={null} />);

        expect(markup).toContain("Select two medicines above to see the comparison.");
    });

    it("renders both pricing rows and savings for medicines with lower Jan Aushadhi prices", () => {
        const markup = renderToStaticMarkup(
            <ComparisonGrid
                medicine1={buildMedicine({
                    mrp: 30,
                    jan_aushadhi_price: 15,
                })}
                medicine2={buildMedicine({
                    id: "med-2",
                    brand_name: "Azithral 500",
                    generic_name: "Azithromycin",
                    mrp: 119.5,
                    jan_aushadhi_price: 42,
                })}
            />
        );

        expect(markup).toContain("Market price (MRP)");
        expect(markup).toContain("Jan Aushadhi price");
        expect(markup).toContain("Savings vs MRP");
        expect(markup).toContain("₹30.00");
        expect(markup).toContain("₹15.00");
        expect(markup).toContain("Save ₹15.00 (50.0%)");
        expect(markup).toContain("Save ₹77.50 (64.9%)");
    });

    it("uses per-cell fallback text when individual prices are missing", () => {
        const markup = renderToStaticMarkup(
            <ComparisonGrid
                medicine1={buildMedicine({
                    mrp: null,
                    jan_aushadhi_price: 14,
                })}
                medicine2={buildMedicine({
                    id: "med-2",
                    brand_name: "Pantocid 40",
                    generic_name: "Pantoprazole",
                    mrp: 168,
                    jan_aushadhi_price: null,
                })}
            />
        );

        expect(markup).toContain("Price unavailable");
        expect(markup).not.toContain("Price comparison requires");
        expect(markup).not.toContain("mrp</code>");
    });

    it("treats zero Jan Aushadhi price as valid data and still renders savings", () => {
        const markup = renderToStaticMarkup(
            <ComparisonGrid
                medicine1={buildMedicine({
                    mrp: 10,
                    jan_aushadhi_price: 0,
                })}
                medicine2={null}
            />
        );

        expect(markup).toContain("₹10.00");
        expect(markup).toContain("₹0.00");
        expect(markup).toContain("Save ₹10.00 (100.0%)");
        expect(markup).not.toContain("Price unavailable");
    });

    it("shows no savings when mrp is not higher than Jan Aushadhi price", () => {
        const markup = renderToStaticMarkup(
            <ComparisonGrid
                medicine1={buildMedicine({
                    mrp: 14,
                    jan_aushadhi_price: 14,
                })}
                medicine2={null}
            />
        );

        expect(markup).toContain("No savings");
    });
});
