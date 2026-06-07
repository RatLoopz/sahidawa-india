import {
    buildLocalScanHistoryEntry,
    normalizeLocalScanHistoryPageRequest,
} from "@/lib/localScanHistory";

describe("local scan history helpers", () => {
    it("normalizes invalid pagination requests to a bounded page window", () => {
        expect(normalizeLocalScanHistoryPageRequest({ page: -4, pageSize: 500 })).toEqual({
            page: 1,
            pageSize: 50,
            offset: 0,
        });

        expect(normalizeLocalScanHistoryPageRequest({ page: 3, pageSize: 20 })).toEqual({
            page: 3,
            pageSize: 20,
            offset: 40,
        });
    });

    it("builds a compact verified history entry from a verification result", () => {
        const entry = buildLocalScanHistoryEntry({
            query: " BATCH-001 ",
            source: "manual",
            result: {
                verified: true,
                medicine: {
                    brand_name: "Paracetamol",
                    generic_name: "Acetaminophen",
                    manufacturer: "Sahi Pharma",
                    batch_number: "BATCH-001",
                    expiry_date: "2028-03-01T00:00:00.000Z",
                    cdsco_approval_status: "approved",
                    is_counterfeit_alert: false,
                },
                scanMeta: {
                    recentScanCount24h: 1,
                    recentScanCount7d: 2,
                    suspicious: false,
                    suspicionReasons: [],
                },
            },
            scannedAt: "2026-06-07T10:00:00.000Z",
        });

        expect(entry).toMatchObject({
            query: "BATCH-001",
            source: "manual",
            status: "verified",
            brandName: "Paracetamol",
            genericName: "Acetaminophen",
            manufacturer: "Sahi Pharma",
            batchNumber: "BATCH-001",
            expiryDate: "2028-03-01T00:00:00.000Z",
            cdscoApprovalStatus: "approved",
            isCounterfeitAlert: false,
            scannedAt: "2026-06-07T10:00:00.000Z",
        });
    });
});
