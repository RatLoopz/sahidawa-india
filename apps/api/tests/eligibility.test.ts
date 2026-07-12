import request from "supertest";
import app from "../src/app";

jest.mock("../src/db/supabase", () => {
    return {
        anonSupabase: {
            from: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            ilike: jest.fn((field, value) => {
                if (value.toLowerCase().includes("maharashtra")) {
                    return Promise.resolve({
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
                    });
                }
                return Promise.resolve({ data: [], error: null });
            }),
        },
    };
});

describe("POST /api/v1/scheme-eligibility", () => {
    const originalEnv = process.env;
    const originalFetch = global.fetch;
    let mockFetch: jest.Mock;

    beforeAll(() => {
        global.fetch = jest.fn();
        mockFetch = global.fetch as jest.Mock;
    });

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...originalEnv };
        delete process.env.PMJAY_BASE_URL;
        delete process.env.PMJAY_API_KEY;
    });

    afterAll(() => {
        process.env = originalEnv;
        global.fetch = originalFetch;
    });

    describe("Fallback (Unconfigured)", () => {
        it("should evaluate scheme eligibility based on BPL card status and state", async () => {
            const res = await request(app).post("/api/v1/scheme-eligibility").send({
                age: 45,
                annual_income: 80000,
                family_size: 5,
                state: "Maharashtra",
                has_bpl_card: true,
                has_abha_id: false,
            });

            expect(res.status).toBe(200);
            expect(res.body.eligible_schemes).toBeDefined();

            // Assert PMJAY is in the list of eligible schemes
            const hasPMJAY = res.body.eligible_schemes.some(
                (s: any) => s.name.includes("PM-JAY") || s.name.includes("Ayushman Bharat")
            );
            expect(hasPMJAY).toBe(true);

            // Assert MJPJAY is in the list of eligible schemes for Maharashtra
            const hasMJPJAY = res.body.eligible_schemes.some(
                (s: any) => s.name.includes("MJPJAY") || s.name.includes("Mahatma Jyotirao Phule")
            );
            expect(hasMJPJAY).toBe(true);
        });

        it("should evaluate scheme eligibility for higher income households", async () => {
            const res = await request(app).post("/api/v1/scheme-eligibility").send({
                age: 30,
                annual_income: 600000,
                family_size: 4,
                state: "Maharashtra",
                has_bpl_card: false,
                has_abha_id: false,
            });

            expect(res.status).toBe(200);
            // High income and no BPL card/ABHA card should not qualify for PM-JAY
            const hasPMJAY = res.body.eligible_schemes.some(
                (s: any) => s.name.includes("PM-JAY") || s.name.includes("Ayushman Bharat")
            );
            expect(hasPMJAY).toBe(false);
        });
    });

    describe("PM-JAY API Integration (Configured)", () => {
        beforeEach(() => {
            process.env.PMJAY_BASE_URL = "https://api.pmjay.gov.in";
            process.env.PMJAY_API_KEY = "mock-api-key";
            // Set timeout low for tests so they run fast
            process.env.GOVT_API_TIMEOUT = "100";
        });

        function mockFetchResponse(status: number, data: any) {
            return Promise.resolve({
                ok: status >= 200 && status < 300,
                status,
                statusText: status === 200 ? "OK" : "Error",
                json: () => {
                    if (typeof data === "string") {
                        return Promise.reject(new Error(data));
                    }
                    return Promise.resolve(data);
                },
            } as any);
        }

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

            const res = await request(app).post("/api/v1/scheme-eligibility").send({
                age: 45,
                annual_income: 80000,
                family_size: 5,
                state: "Maharashtra",
                has_bpl_card: true,
                has_abha_id: false,
            });

            expect(res.status).toBe(200);
            expect(res.body.eligible_schemes).toHaveLength(1);
            expect(res.body.eligible_schemes[0].name).toBe("API Ayushman Bharat - PM-JAY");
            expect(res.body.eligible_schemes[0].description).toBe("Mocked description");
        });

        it("should return 401 on authentication failures", async () => {
            mockFetch.mockResolvedValueOnce(mockFetchResponse(401, {}));

            const res = await request(app).post("/api/v1/scheme-eligibility").send({
                age: 45,
                annual_income: 80000,
                family_size: 5,
                state: "Maharashtra",
                has_bpl_card: true,
                has_abha_id: false,
            });

            expect(res.status).toBe(401);
            expect(res.body.error).toContain("Authentication failed");
        });

        it("should return 504 on request timeout", async () => {
            const abortError = new DOMException("The user aborted a request.", "AbortError");
            // Fails on initial try and all 2 retries (total 3 attempts)
            mockFetch.mockRejectedValue(abortError);

            const res = await request(app).post("/api/v1/scheme-eligibility").send({
                age: 45,
                annual_income: 80000,
                family_size: 5,
                state: "Maharashtra",
                has_bpl_card: true,
                has_abha_id: false,
            });

            expect(res.status).toBe(504);
            expect(res.body.error).toContain("timed out");
        });

        it("should return 502 on invalid JSON response", async () => {
            mockFetch.mockResolvedValueOnce(mockFetchResponse(200, "Invalid JSON string"));

            const res = await request(app).post("/api/v1/scheme-eligibility").send({
                age: 45,
                annual_income: 80000,
                family_size: 5,
                state: "Maharashtra",
                has_bpl_card: true,
                has_abha_id: false,
            });

            expect(res.status).toBe(502);
            expect(res.body.error).toContain("Invalid response format");
        });

        it("should return 502 on mismatching schema (missing scheme_name)", async () => {
            mockFetch.mockResolvedValueOnce(
                mockFetchResponse(200, {
                    schemes: [
                        {
                            // scheme_name is missing
                            description: "No name",
                        },
                    ],
                })
            );

            const res = await request(app).post("/api/v1/scheme-eligibility").send({
                age: 45,
                annual_income: 80000,
                family_size: 5,
                state: "Maharashtra",
                has_bpl_card: true,
                has_abha_id: false,
            });

            expect(res.status).toBe(502);
            expect(res.body.error).toContain("Invalid response format");
        });

        it("should return 502 on persistent upstream server failure", async () => {
            mockFetch.mockResolvedValue(mockFetchResponse(500, {}));

            const res = await request(app).post("/api/v1/scheme-eligibility").send({
                age: 45,
                annual_income: 80000,
                family_size: 5,
                state: "Maharashtra",
                has_bpl_card: true,
                has_abha_id: false,
            });

            expect(res.status).toBe(502);
            expect(res.body.error).toContain("upstream error");
        });

        it("should return 502 on network exceptions", async () => {
            mockFetch.mockRejectedValue(new Error("Connection refused"));

            const res = await request(app).post("/api/v1/scheme-eligibility").send({
                age: 45,
                annual_income: 80000,
                family_size: 5,
                state: "Maharashtra",
                has_bpl_card: true,
                has_abha_id: false,
            });

            expect(res.status).toBe(502);
            expect(res.body.error).toContain("Network communication error");
        });
    });
});
