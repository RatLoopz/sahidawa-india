process.env.SUPABASE_URL = process.env.SUPABASE_URL || "http://localhost:54321";
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "test-anon-key";
(global as any).WebSocket = (global as any).WebSocket || class {};

import { validateReport, ReportPayload } from "../src/services/reportValidation.service";
import { supabase } from "../src/db/client";

jest.mock("../src/db/client", () => ({
    supabase: {
        from: jest.fn(),
    },
}));

function mockQueryResult(data: any[], error: any = null) {
    const builder: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        ilike: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: data[0] ?? null, error }),
        single: jest.fn().mockResolvedValue({ data: data[0] ?? null, error }),
    };
    // Make the builder itself awaitable for chains that don't terminate in
    // .maybeSingle()/.single() (e.g. chains ending in .limit() or .gte())
    builder.then = (resolve: any) => Promise.resolve({ data, error }).then(resolve);
    return builder;
}

const basePayload: ReportPayload = {
    medicineName: "Paracetamol",
    manufacturer: "ABC Pharma",
    description: "Suspicious packaging",
    pharmacyName: "Apollo Pharmacy",
    address: "123 Main St",
    city: "Pune",
    state: "Maharashtra",
    pincode: "411001",
    district: "Pune",
};

describe("reportValidation.service - distinct count checks", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should NOT flag geographic spread when 5 duplicate reports come from the same IP and same district", async () => {
        (supabase.from as jest.Mock).mockImplementation(() =>
            mockQueryResult(Array(5).fill({ district: "Pune" }))
        );

        const result = await validateReport(basePayload, "1.2.3.4", null);

        const geoReason = result.reasons.find((r) => r.includes("geographic spread"));
        expect(geoReason).toBeUndefined();
    });

    it("should flag geographic spread when an IP reports for 3+ distinct districts", async () => {
        (supabase.from as jest.Mock).mockImplementation(() =>
            mockQueryResult([{ district: "Pune" }, { district: "Mumbai" }, { district: "Nashik" }])
        );

        const result = await validateReport(basePayload, "1.2.3.4", null);

        const geoReason = result.reasons.find((r) => r.includes("geographic spread"));
        expect(geoReason).toContain("3 different districts");
    });

    it("should NOT flag Sybil pattern when 8 duplicate reports come from the same IP for one district", async () => {
        (supabase.from as jest.Mock).mockImplementation(() =>
            mockQueryResult(Array(8).fill({ ip_address: "1.2.3.4" }))
        );

        const result = await validateReport(basePayload, "1.2.3.4", null);

        const sybilReason = result.reasons.find(
            (r) => r.includes("Sybil pattern") && r.includes("district")
        );
        expect(sybilReason).toBeUndefined();
    });

    it("should flag Sybil pattern when 8+ distinct IPs report for the same district", async () => {
        (supabase.from as jest.Mock).mockImplementation(() =>
            mockQueryResult(Array.from({ length: 8 }, (_, i) => ({ ip_address: `1.2.3.${i}` })))
        );

        const result = await validateReport(basePayload, "1.2.3.4", null);

        const sybilReason = result.reasons.find(
            (r) => r.includes("Sybil pattern") && r.includes("district")
        );
        expect(sybilReason).toContain("8 different reporters");
    });
});
