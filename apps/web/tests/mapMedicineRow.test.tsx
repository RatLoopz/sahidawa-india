import { describe, it, expect } from "vitest";
import { mapMedicineRow } from "../src/lib/mapMedicineRow";

describe("mapMedicineRow", () => {
    it("maps a complete medicine row", () => {
        const row = {
            id: 1,
            brand_name: "Dolo 650",
            generic_name: "Paracetamol",
            composition: "Paracetamol 650mg",
            manufacturer: "Micro Labs",
            cdsco_approval_status: "Approved",
            expiry_date: "12/2028",
            mrp: 100,
            jan_aushadhi_price: 75,
        };

        expect(mapMedicineRow(row)).toEqual({
            id: "1",
            brand_name: "Dolo 650",
            generic_name: "Paracetamol",
            composition: "Paracetamol 650mg",
            manufacturer: "Micro Labs",
            cdsco_approval_status: "Approved",
            expiry_date: "12/2028",
            mrp: 100,
            jan_aushadhi_price: 75,
        });
    });

    it("returns undefined when expiry_date is missing", () => {
        const result = mapMedicineRow({
            id: 1,
        });

        expect(result.expiry_date).toBeUndefined();
    });

    it("preserves valid numeric prices", () => {
        const result = mapMedicineRow({
            mrp: 250,
            jan_aushadhi_price: 150,
        });

        expect(result.mrp).toBe(250);
        expect(result.jan_aushadhi_price).toBe(150);
    });

    it("returns null for string price values", () => {
        const result = mapMedicineRow({
            mrp: "250",
            jan_aushadhi_price: "150",
        });

        expect(result.mrp).toBeNull();
        expect(result.jan_aushadhi_price).toBeNull();
    });

    it("returns null for NaN prices", () => {
        const result = mapMedicineRow({
            mrp: NaN,
            jan_aushadhi_price: NaN,
        });

        expect(result.mrp).toBeNull();
        expect(result.jan_aushadhi_price).toBeNull();
    });

    it("preserves null price values", () => {
        const result = mapMedicineRow({
            mrp: null,
            jan_aushadhi_price: null,
        });

        expect(result.mrp).toBeNull();
        expect(result.jan_aushadhi_price).toBeNull();
    });

    it("preserves undefined price values", () => {
        const result = mapMedicineRow({});

        expect(result.mrp).toBeUndefined();
        expect(result.jan_aushadhi_price).toBeUndefined();
    });

    it("handles missing fields gracefully", () => {
        expect(mapMedicineRow({})).toEqual({
            id: "",
            brand_name: "",
            generic_name: "",
            composition: "",
            manufacturer: "",
            cdsco_approval_status: "",
            expiry_date: undefined,
            mrp: undefined,
            jan_aushadhi_price: undefined,
        });
    });

    it("converts non-string fields using String()", () => {
        const result = mapMedicineRow({
            id: 123,
            brand_name: 456,
            generic_name: true,
            composition: false,
            manufacturer: 789,
            cdsco_approval_status: 1,
        });

        expect(result).toMatchObject({
            id: "123",
            brand_name: "456",
            generic_name: "true",
            composition: "false",
            manufacturer: "789",
            cdsco_approval_status: "1",
        });
    });
});
