import { buildVerificationShareText, type VerificationShareCopy } from "../lib/verificationShare";

const copy: VerificationShareCopy = {
    realStatus: "Verified REAL",
    suspiciousStatus: "Marked SUSPICIOUS",
    warningPrefix: "WARNING",
    verifiedBy: "by SahiDawa",
    batchLabel: "Batch",
    manufacturerLabel: "Manufacturer",
    avoidAndReport: "Please avoid and report to your nearest health worker.",
    verifyYourself: "Verify yourself",
    unknownMedicine: "Unknown medicine",
    unknownBatch: "Unknown batch",
    unknownManufacturer: "Unknown manufacturer",
};

describe("buildVerificationShareText", () => {
    it("formats a verified real medicine share payload", () => {
        const text = buildVerificationShareText({
            copy,
            result: {
                verified: true,
                medicine: {
                    brand_name: "Calpol 500",
                    generic_name: "Paracetamol",
                    manufacturer: "GSK",
                    batch_number: "BATCH-1",
                    expiry_date: null,
                    cdsco_approval_status: "approved",
                    is_counterfeit_alert: false,
                },
            },
            appUrl: "https://example.test",
        });

        expect(text).toBe(
            [
                "✅ Calpol 500 — Verified REAL by SahiDawa",
                "Batch: BATCH-1 | Manufacturer: GSK",
                "Verify yourself: https://example.test",
            ].join("\n")
        );
    });

    it("formats suspicious and unverified results as a warning", () => {
        const text = buildVerificationShareText({
            copy,
            result: { verified: false, message: "No match found" },
            brandName: "Unknown Strip",
            batchNumber: "ZX-88",
        });

        expect(text).toBe(
            [
                "⚠️ WARNING: Unknown Strip — Marked SUSPICIOUS by SahiDawa",
                "Batch: ZX-88 | Please avoid and report to your nearest health worker.",
            ].join("\n")
        );
    });

    it("treats verified counterfeit alerts as suspicious", () => {
        const text = buildVerificationShareText({
            copy,
            result: {
                verified: true,
                medicine: {
                    brand_name: "Flagged Capsule",
                    generic_name: "Unknown",
                    manufacturer: "Suspicious Maker",
                    batch_number: "BAD-7",
                    expiry_date: null,
                    cdsco_approval_status: "banned",
                    is_counterfeit_alert: true,
                },
            },
        });

        expect(text).toBe(
            [
                "⚠️ WARNING: Flagged Capsule — Marked SUSPICIOUS by SahiDawa",
                "Batch: BAD-7 | Please avoid and report to your nearest health worker.",
            ].join("\n")
        );
    });
});
