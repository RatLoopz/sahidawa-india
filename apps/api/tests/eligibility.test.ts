import request from "supertest";
import app from "../src/app";
import { dbConfig } from "../src/db/client";

jest.mock("../src/db/client", () => ({
    dbConfig: {
        isSupabaseOffline: false,
        offlineSince: null,
        setOffline: jest.fn(),
        setOnline: jest.fn(),
    },
    pool: {
        acquire: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
        stats: { active: 0, queued: 0, max: 20 },
    },
    supabase: {},
    serviceRoleSupabase: {},
}));

jest.mock("../src/db/supabase", () => ({
    anonSupabase: {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        ilike: jest.fn((_, value) =>
            Promise.resolve(
                value.toLowerCase().includes("maharashtra")
                    ? {
                          data: [
                              {
                                  scheme_name: "Mahatma Jyotirao Phule Jan Arogya Yojana (MJPJAY)",
                                  description: "Cashless health insurance scheme.",
                                  coverage: "Up to 5 Lakh.",
                                  how_to_apply: "Visit a network hospital.",
                                  link: "https://www.jeevandayee.gov.in/",
                              },
                          ],
                          error: null,
                      }
                    : { data: [], error: null }
            )
        ),
    },
}));

// Helpers
const post = (body: object) => request(app).post("/api/v1/scheme-eligibility").send(body);
const hasScheme = (schemes: any[], ...keywords: string[]) =>
    schemes.some((s) => keywords.some((k) => s.name.includes(k)));
const defaultPayload = {
    age: 45,
    annual_income: 80000,
    family_size: 5,
    state: "Maharashtra",
    has_bpl_card: true,
    has_abha_id: false,
};

function mockFetchResponse(status: number, data: any) {
    return Promise.resolve({
        ok: status >= 200 && status < 300,
        status,
        statusText: status === 200 ? "OK" : "Error",
        json: () =>
            typeof data === "string" ? Promise.reject(new Error(data)) : Promise.resolve(data),
    } as any);
}

describe("POST /api/v1/scheme-eligibility", () => {
    const originalEnv = process.env;
    const originalFetch = global.fetch;
    let mockFetch: jest.Mock;

    beforeAll(() => {
        global.fetch = jest.fn();
        mockFetch = global.fetch as jest.Mock;
    });
    beforeEach(() => {
        mockFetch.mockReset();
        process.env = { ...originalEnv };
        delete process.env.PMJAY_BASE_URL;
        delete process.env.PMJAY_API_KEY;
    });
    afterAll(() => {
        process.env = originalEnv;
        global.fetch = originalFetch;
    });

    describe("Fallback (Unconfigured)", () => {
        it("should return PM-JAY and MJPJAY for eligible Maharashtra user", async () => {
            const res = await post({
                age: 45,
                annual_income: 80000,
                family_size: 5,
                state: "Maharashtra",
                has_bpl_card: true,
                has_abha_id: false,
            });
            expect(res.status).toBe(200);
            expect(hasScheme(res.body.eligible_schemes, "PM-JAY", "Ayushman Bharat")).toBe(true);
            expect(hasScheme(res.body.eligible_schemes, "MJPJAY", "Mahatma Jyotirao Phule")).toBe(
                true
            );
        });

        it("should not return PM-JAY for high-income user without BPL/ABHA", async () => {
            const res = await post({
                age: 30,
                annual_income: 600000,
                family_size: 4,
                state: "Maharashtra",
                has_bpl_card: false,
                has_abha_id: false,
            });
            expect(res.status).toBe(200);
            expect(hasScheme(res.body.eligible_schemes, "PM-JAY", "Ayushman Bharat")).toBe(false);
        });
    });

    describe("PM-JAY API Integration (Configured)", () => {
        beforeEach(() => {
            process.env.PMJAY_BASE_URL = "https://api.pmjay.gov.in";
            process.env.PMJAY_API_KEY = "mock-api-key";
            process.env.GOVT_API_TIMEOUT = "100";
        });

        it("should return eligible schemes from API on success", async () => {
            mockFetch.mockResolvedValueOnce(
                mockFetchResponse(200, {
                    schemes: [
                        {
                            scheme_name: "API Ayushman Bharat - PM-JAY",
                            description: "Mocked description",
                            coverage: "Mocked coverage",
                            how_to_apply: "Mocked application process",
                            link: "https://mock.pmjay.gov.in",
                        },
                    ],
                })
            );
            const res = await post(defaultPayload);
            expect(res.status).toBe(200);
            expect(res.body.eligible_schemes).toHaveLength(1);
            expect(res.body.eligible_schemes[0].name).toBe("API Ayushman Bharat - PM-JAY");
            expect(res.body.eligible_schemes[0].description).toBe("Mocked description");
        });

        it("should return 401 on authentication failures", async () => {
            mockFetch.mockResolvedValueOnce(mockFetchResponse(401, {}));
            const res = await post(defaultPayload);
            expect(res.status).toBe(401);
            expect(res.body.error).toContain("Authentication failed");
        });

        it("should return 504 on request timeout", async () => {
            const abortError = new DOMException("The user aborted a request.", "AbortError");
            mockFetch
                .mockRejectedValueOnce(abortError)
                .mockRejectedValueOnce(abortError)
                .mockRejectedValueOnce(abortError);
            const res = await post(defaultPayload);
            expect(res.status).toBe(504);
            expect(res.body.error).toContain("timed out");
        });

        it("should return 502 on invalid JSON response", async () => {
            mockFetch.mockResolvedValueOnce(mockFetchResponse(200, "Invalid JSON string"));
            const res = await post(defaultPayload);
            expect(res.status).toBe(502);
            expect(res.body.error).toContain("Invalid response format");
        });

        it("should return 502 on mismatching schema (missing scheme_name)", async () => {
            mockFetch.mockResolvedValueOnce(
                mockFetchResponse(200, { schemes: [{ description: "No name" }] })
            );
            const res = await post(defaultPayload);
            expect(res.status).toBe(502);
            expect(res.body.error).toContain("Invalid response format");
        });

        it("should return 502 on persistent upstream server failure", async () => {
            mockFetch.mockResolvedValue(mockFetchResponse(500, {}));
            const res = await post(defaultPayload);
            expect(res.status).toBe(502);
            expect(res.body.error).toContain("upstream error");
        });

        it("should return 502 on network exceptions", async () => {
            mockFetch.mockRejectedValue(new Error("Connection refused"));
            const res = await post(defaultPayload);
            expect(res.status).toBe(502);
            expect(res.body.error).toContain("Network communication error");
        });
    });

    describe("Offline Database Fallback", () => {
        beforeEach(() => {
            (dbConfig as any).isSupabaseOffline = true;
        });
        afterEach(() => {
            (dbConfig as any).isSupabaseOffline = false;
        });

        it.each([
            [
                "Maharashtra",
                {
                    age: 35,
                    annual_income: 100000,
                    family_size: 4,
                    state: "Maharashtra",
                    has_bpl_card: true,
                    has_abha_id: false,
                },
                ["MJPJAY", "Mahatma Jyotiba Phule"],
            ],
            [
                "Delhi",
                {
                    age: 40,
                    annual_income: 120000,
                    family_size: 3,
                    state: "Delhi",
                    has_bpl_card: true,
                    has_abha_id: false,
                },
                ["Delhi Arogya Kosh", "DAK"],
            ],
            [
                "Kerala",
                {
                    age: 50,
                    annual_income: 90000,
                    family_size: 5,
                    state: "Kerala",
                    has_bpl_card: true,
                    has_abha_id: false,
                },
                ["Karunya", "KASP"],
            ],
            [
                "Karnataka",
                {
                    age: 28,
                    annual_income: 150000,
                    family_size: 4,
                    state: "Karnataka",
                    has_bpl_card: false,
                    has_abha_id: true,
                },
                ["Arogya Karnataka", "AB-ArK"],
            ],
            [
                "Uttar Pradesh",
                {
                    age: 45,
                    annual_income: 80000,
                    family_size: 6,
                    state: "Uttar Pradesh",
                    has_bpl_card: true,
                    has_abha_id: false,
                },
                ["Mukhyamantri Jan Arogya", "AB-MJAY UP"],
            ],
            [
                "Tamil Nadu",
                {
                    age: 55,
                    annual_income: 70000,
                    family_size: 4,
                    state: "Tamil Nadu",
                    has_bpl_card: true,
                    has_abha_id: false,
                },
                ["Chief Minister", "CMCHIS"],
            ],
        ])(
            "should return correct scheme for %s when DB is offline",
            async (_, payload, keywords) => {
                const res = await post(payload as object);
                expect(res.status).toBe(200);
                expect(hasScheme(res.body.eligible_schemes, ...keywords)).toBe(true);
            }
        );

        it("should return national schemes alongside offline state scheme", async () => {
            const res = await post({
                age: 35,
                annual_income: 150000,
                family_size: 4,
                state: "Maharashtra",
                has_bpl_card: true,
                has_abha_id: false,
            });
            expect(res.status).toBe(200);
            expect(hasScheme(res.body.eligible_schemes, "PM-JAY", "Ayushman Bharat")).toBe(true);
            expect(hasScheme(res.body.eligible_schemes, "MJPJAY", "Mahatma Jyotiba Phule")).toBe(
                true
            );
        });

        it("should not crash for an unknown state when DB is offline", async () => {
            const res = await post({
                age: 35,
                annual_income: 100000,
                family_size: 3,
                state: "Meghalaya",
                has_bpl_card: true,
                has_abha_id: false,
            });
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.eligible_schemes)).toBe(true);
        });

        it("should fall back to static data when DB query returns an error", async () => {
            (dbConfig as any).isSupabaseOffline = false;
            const supabaseMock = require("../src/db/supabase");
            const originalIlike = supabaseMock.anonSupabase.ilike;
            supabaseMock.anonSupabase.ilike = jest
                .fn()
                .mockResolvedValue({ data: null, error: { message: "DB connection failed" } });

            const res = await post({
                age: 35,
                annual_income: 100000,
                family_size: 4,
                state: "Maharashtra",
                has_bpl_card: true,
                has_abha_id: false,
            });

            supabaseMock.anonSupabase.ilike = originalIlike;
            expect(res.status).toBe(200);
            expect(hasScheme(res.body.eligible_schemes, "MJPJAY", "Mahatma Jyotiba Phule")).toBe(
                true
            );
        });
    });
});
