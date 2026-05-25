import {
    extractExpiryDate,
    extractBatchNumber,
    extractMedicineName,
} from "../src/utils/medicineParser";

describe("extractExpiryDate", () => {
    it("parses EXPIRY DATE style formats", () => {
        expect(extractExpiryDate("EXP.DATE 12/2029")).toBe("12/2029");
        expect(extractExpiryDate("EXPIRY DATE 05/26")).toBe("05/2026");
        expect(extractExpiryDate("EXPIRY 09/2028")).toBe("09/2028");
        expect(extractExpiryDate("USE BEFORE: 02/27")).toBe("02/2027");
        expect(extractExpiryDate("E.D. 11/30")).toBe("11/2030");
    });

    it("parses wordy month formats", () => {
        expect(extractExpiryDate("EXP DEC 2028")).toBe("12/2028");
        expect(extractExpiryDate("EXPIRY JAN. 2030")).toBe("01/2030");
        expect(extractExpiryDate("FEB 2027")).toBe("02/2027");
    });

    it("parses generic expiry patterns", () => {
        expect(extractExpiryDate("06/2029")).toBe("06/2029");
        expect(extractExpiryDate("04/28")).toBe("04/2028");
    });

    it("parses DD/MM/YYYY and extracts MM/YYYY", () => {
        expect(extractExpiryDate("EXPIRY 15/08/2027")).toBe("08/2027");
        expect(extractExpiryDate("12-04-2029")).toBe("04/2029");
    });

    it("returns null for invalid or missing dates", () => {
        expect(extractExpiryDate("NO DATE HERE")).toBeNull();
        expect(extractExpiryDate("EXPIRY 13/2029")).toBeNull(); // Invalid month
        expect(extractExpiryDate("12/2019")).toBeNull(); // Past year out of regex bounds
    });
});

describe("extractBatchNumber", () => {
    it("extracts batch numbers with standard labels", () => {
        expect(extractBatchNumber("BATCH NO. A39281")).toBe("A39281");
        expect(extractBatchNumber("LOT NO. 8827-C")).toBe("8827-C");
        expect(extractBatchNumber("B. NO. BTC981")).toBe("BTC981");
    });

    it("extracts batch numbers via uppercase code patterns", () => {
        expect(extractBatchNumber("Sample test B90231X text")).toBe("B90231X");
        expect(extractBatchNumber("Composition of PARACETAMOL LOT: LT88219")).toBe("LT88219");
    });

    it("ignores blocklisted words", () => {
        expect(extractBatchNumber("APPROVED BATCH CDSCO")).toBeNull();
        expect(extractBatchNumber("MRP RS 150")).toBeNull();
    });
});

describe("extractMedicineName", () => {
    it("extracts clean all-caps medicine name", () => {
        expect(extractMedicineName("COMPOSITION:\nPARACETAMOL TABLETS IP\nKEEP OUT OF REACH")).toBe(
            "PARACETAMOL TABLETS IP"
        );
    });

    it("skips metadata labels and extracts the brand", () => {
        expect(
            extractMedicineName("BATCH NO 8271\nMFG DATE 10/25\nPAN-D CAPSULES\nMRP RS 120")
        ).toBe("PAN-D CAPSULES");
    });

    it("falls back to generic line cleanup if no all-caps found", () => {
        expect(extractMedicineName("Some Random Line\nparacetamol tablets\nBatch 289")).toBe(
            "Some Random Line"
        );
    });
});
