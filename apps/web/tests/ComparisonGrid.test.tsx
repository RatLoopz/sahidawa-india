import { renderToStaticMarkup } from "react-dom/server";

import ComparisonGrid from "../src/components/ComparisonGrid";

describe("ComparisonGrid", () => {
    const medicineA = {
        id: "1",
        brand_name: "Crocin",
        generic_name: "Paracetamol",
        composition: "Paracetamol 500mg",
        manufacturer: "ABC Pharma",
        mrp: 100,
        jan_aushadhi_price: 25,
        expiry_date: "2027-12-31",
        medicine_type: "brand" as const,
        cdsco_approval_status: "approved",
    };

    const medicineB = {
        id: "2",
        brand_name: "Dolo",
        generic_name: "Paracetamol",
        composition: "Paracetamol 650mg",
        manufacturer: "XYZ Pharma",
        mrp: 120,
        jan_aushadhi_price: 30,
        expiry_date: "2028-01-01",
        medicine_type: "brand" as const,
        cdsco_approval_status: "recalled",
    };

    it("renders empty state when no medicines are selected", () => {
        const markup = renderToStaticMarkup(<ComparisonGrid medicine1={null} medicine2={null} />);

        expect(markup).toContain("Select two medicines above to see the comparison.");
    });

    it("renders medicine names in table headers", () => {
        const markup = renderToStaticMarkup(
            <ComparisonGrid medicine1={medicineA} medicine2={medicineB} />
        );

        expect(markup).toContain("Crocin");
        expect(markup).toContain("Dolo");
    });

    it("falls back to generic name when brand name is missing", () => {
        const genericMedicine = {
            ...medicineA,
            brand_name: null,
        };

        const markup = renderToStaticMarkup(
            <ComparisonGrid medicine1={genericMedicine} medicine2={null} />
        );

        expect(markup).toContain("Paracetamol");
    });

    it("formats prices correctly", () => {
        const markup = renderToStaticMarkup(
            <ComparisonGrid medicine1={medicineA} medicine2={medicineB} />
        );

        expect(markup).toContain("₹100.00");
        expect(markup).toContain("₹25.00");
    });

    it("shows savings amount and percentage", () => {
        const markup = renderToStaticMarkup(
            <ComparisonGrid medicine1={medicineA} medicine2={medicineB} />
        );

        expect(markup).toContain("Save ₹75.00 (75.0%)");
    });

    it("shows no savings when jan aushadhi price is not lower than mrp", () => {
        const medicine = {
            ...medicineA,
            mrp: 50,
            jan_aushadhi_price: 50,
        };

        const markup = renderToStaticMarkup(
            <ComparisonGrid medicine1={medicine} medicine2={null} />
        );

        expect(markup).toContain("No savings");
    });

    it("formats CDSCO status labels", () => {
        const markup = renderToStaticMarkup(
            <ComparisonGrid medicine1={medicineA} medicine2={medicineB} />
        );

        expect(markup).toContain("Approved");
        expect(markup).toContain("Recalled");
    });

    it("shows a safety alert banner when a medicine is recalled", () => {
        const markup = renderToStaticMarkup(
            <ComparisonGrid medicine1={medicineA} medicine2={medicineB} />
        );

        expect(markup).toContain('role="alert"');
        expect(markup).toContain("Safety alert");
        expect(markup).toContain("Dolo has been flagged as");
    });

    it("shows a safety alert banner when a medicine is banned", () => {
        const bannedMedicine = {
            ...medicineA,
            cdsco_approval_status: "banned",
        };

        const markup = renderToStaticMarkup(
            <ComparisonGrid medicine1={bannedMedicine} medicine2={null} />
        );

        expect(markup).toContain('role="alert"');
        expect(markup).toContain("Crocin has been flagged as");
    });

    it("does not show a safety alert banner when both medicines are approved", () => {
        const approvedMedicine = {
            ...medicineB,
            cdsco_approval_status: "approved",
        };

        const markup = renderToStaticMarkup(
            <ComparisonGrid medicine1={medicineA} medicine2={approvedMedicine} />
        );

        expect(markup).not.toContain("Safety alert");
    });

    it("shows unavailable text when prices are missing", () => {
        const medicine = {
            ...medicineA,
            mrp: null,
            jan_aushadhi_price: null,
        };

        const markup = renderToStaticMarkup(
            <ComparisonGrid medicine1={medicine} medicine2={null} />
        );

        expect(markup).toContain("Price unavailable");
    });
});
