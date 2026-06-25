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
