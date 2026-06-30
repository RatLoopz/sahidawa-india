process.env.SUPABASE_URL = process.env.SUPABASE_URL || "http://localhost:54321";
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "test-anon-key";

(global as any).WebSocket = (global as any).WebSocket || class {};

jest.mock("../src/db/client", () => ({
    supabase: {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        upsert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        single: jest.fn(),
    },
}));

jest.mock("../src/services/reportValidation.service", () => ({
    validateReport: jest.fn().mockResolvedValue({
        passed: true,
        riskScore: 0,
        reasons: [],
        isDuplicate: false,
        duplicateGroupId: undefined,
    }),
    computeReportHash: jest
        .fn()
        .mockReturnValue("abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"),
    anonymizeIp: jest.fn().mockReturnValue("127.0.0.1"),
}));

jest.mock("../src/middleware/auth", () => {
    let isAdmin = false;
    return {
        optionalAuth: (req: any, res: any, next: any) => {
            next();
        },
        requireAuth: (req: any, res: any, next: any) => {
            const token = req.headers.authorization?.slice(7);
            if (!token) {
                return res.status(401).json({ error: "Unauthenticated" });
            }
            req.user = {
                id: "test-user-id",
                email: "test@example.com",
                role: isAdmin ? "admin" : "user",
            };
            next();
        },
        requireRole:
            (...roles: string[]) =>
            (req: any, res: any, next: any) => {
                const token = req.headers.authorization?.slice(7);
                if (!token) {
                    return res.status(401).json({ error: "Authentication is required" });
                }
                isAdmin = req.headers["x-admin"] === "true";
                const userRole = isAdmin ? "admin" : "user";
                if (!roles.includes(userRole)) {
                    return res.status(403).json({ error: "Insufficient permissions" });
                }
                req.user = {
                    id: isAdmin ? "admin-id" : "user-id",
                    email: "test@example.com",
                    role: userRole,
                };
                next();
            },
    };
});

import request from "supertest";
import app from "../src/app";
import { supabase } from "../src/db/client";

const mockedSupabase = supabase as any;

describe("Reports API Routes", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        Object.assign(mockedSupabase, {
            from: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            upsert: jest.fn().mockReturnThis(),
            update: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            gte: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            single: jest.fn(),
        });
    });

    describe("POST /api/reports", () => {
        it("returns 400 when medicineName is missing", async () => {
            const payload = {
                manufacturer: "TestCo",
                description: "This is a detailed description of the issue",
                images: ["https://example.com/image1.jpg"],
                pharmacyName: "Test Pharmacy",
                address: "123 Main St",
                city: "Delhi",
                state: "Delhi",
                pincode: "110001",
            };

            const response = await request(app).post("/api/reports").send(payload);

            expect(response.status).toBe(400);
            expect(response.body.error).toBe("Invalid report payload");
        });

        it("returns 400 when required image array is missing", async () => {
            const payload = {
                medicineName: "Aspirin 500mg",
                manufacturer: "TestCo",
                description: "This is a detailed description of the issue",
                pharmacyName: "Test Pharmacy",
                address: "123 Main St",
                city: "Delhi",
                state: "Delhi",
                pincode: "110001",
            };

            const response = await request(app).post("/api/reports").send(payload);

            expect(response.status).toBe(400);
            expect(response.body.error).toBe("Invalid report payload");
        });

        it("returns 201 when valid report payload is submitted", async () => {
            const payload = {
                medicineName: "Aspirin 500mg",
                manufacturer: "TestCo",
                description: "This is a detailed description of the issue",
                images: ["https://example.com/image1.jpg"],
                pharmacyName: "Test Pharmacy",
                address: "123 Main St",
                city: "Delhi",
                state: "Delhi",
                pincode: "110001",
                latitude: 12.9716,
                longitude: 77.5946,
            };

            mockedSupabase.upsert = jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValueOnce({
                        data: {
                            id: "report-id-123",
                            ...payload,
                            report_location: "POINT(77.5946 12.9716)",
                            created_at: "2026-06-03T23:31:00Z",
                        },
                        error: null,
                    }),
                }),
            });

            const response = await request(app).post("/api/reports").send(payload);

            expect(response.status).toBe(201);
            expect(response.body.report).toHaveProperty("id");
            expect(response.body.report).toHaveProperty("report_location");
        });

        it("parses coordinates into POINT format correctly", async () => {
            const payload = {
                medicineName: "Paracetamol 650mg",
                manufacturer: "TestCo",
                description: "Test description with minimum length required",
                images: ["https://example.com/image.jpg"],
                pharmacyName: "Test Pharmacy",
                address: "123 Main St",
                city: "Mumbai",
                state: "Maharashtra",
                pincode: "400001",
                latitude: 19.076,
                longitude: 72.8777,
            };

            mockedSupabase.upsert = jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValueOnce({
                        data: {
                            id: "report-id-456",
                            ...payload,
                            report_location: "POINT(72.8777 19.0760)",
                            created_at: "2026-06-03T23:31:00Z",
                        },
                        error: null,
                    }),
                }),
            });

            const response = await request(app)
                .post("/api/reports")
                .set("X-Forwarded-For", "1.2.3.4")
                .send(payload);

            expect(response.status).toBe(201);
            expect(response.body.report.report_location).toBe("POINT(72.8777 19.0760)");
        });

        it("returns warning and validation when validation service flags the report", async () => {
            const validateReport = jest.requireMock(
                "../src/services/reportValidation.service"
            ).validateReport;
            validateReport.mockResolvedValueOnce({
                passed: false,
                riskScore: 0.85,
                reasons: ["Burst detected: 12 reports for district in last hour"],
                isDuplicate: false,
                duplicateGroupId: undefined,
            });

            const payload = {
                medicineName: "Aspirin 500mg",
                manufacturer: "TestCo",
                description: "This is a detailed description of the issue",
                images: ["https://example.com/image1.jpg"],
                pharmacyName: "Test Pharmacy",
                address: "123 Main St",
                city: "Delhi",
                state: "Delhi",
                pincode: "110001",
            };

            mockedSupabase.upsert = jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValueOnce({
                        data: {
                            id: "report-id-flagged",
                            ...payload,
                            is_escalated: true,
                            risk_score: 0.85,
                            created_at: "2026-06-03T23:31:00Z",
                        },
                        error: null,
                    }),
                }),
            });

            const response = await request(app)
                .post("/api/reports")
                .set("X-Forwarded-For", "1.2.3.5")
                .send(payload);

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty("warning");
            expect(response.body.warning).toContain("flagged for review");
            expect(response.body).toHaveProperty("validation");
            expect(response.body.validation).toHaveProperty("riskScore", 0.85);
            expect(response.body.validation.reasons).toContain(
                "Burst detected: 12 reports for district in last hour"
            );
        });

        it("stores is_escalated = true when validation fails", async () => {
            const validateReport = jest.requireMock(
                "../src/services/reportValidation.service"
            ).validateReport;
            validateReport.mockResolvedValueOnce({
                passed: false,
                riskScore: 0.9,
                reasons: ["Duplicate report: 3 similar report(s) found in last 24h"],
                isDuplicate: true,
                duplicateGroupId: "original-report-id",
            });

            const payload = {
                medicineName: "Aspirin 500mg",
                manufacturer: "TestCo",
                description: "This is a detailed description of the issue",
                images: ["https://example.com/image1.jpg"],
                pharmacyName: "Test Pharmacy",
                address: "123 Main St",
                city: "Delhi",
                state: "Delhi",
                pincode: "110001",
            };

            let insertedPayload: Record<string, unknown> = {};
            mockedSupabase.upsert = jest.fn().mockImplementation((vals) => {
                insertedPayload = vals;
                return {
                    select: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValueOnce({
                            data: {
                                id: "report-id-dup",
                                ...vals,
                                created_at: "2026-06-03T23:31:00Z",
                            },
                            error: null,
                        }),
                    }),
                };
            });

            await request(app).post("/api/reports").set("X-Forwarded-For", "1.2.3.6").send(payload);

            expect(insertedPayload.is_escalated).toBe(true);
            expect(insertedPayload.risk_score).toBe(0.9);
            expect(insertedPayload.duplicate_group_id).toBe("original-report-id");
        });

        it("falls back to city as district when no district field is provided (backward compatibility)", async () => {
            const payload = {
                medicineName: "Aspirin 500mg",
                manufacturer: "TestCo",
                description: "This is a detailed description of the issue",
                images: ["https://example.com/image1.jpg"],
                pharmacyName: "Test Pharmacy",
                address: "123 Main St",
                city: "Pune",
                state: "Maharashtra",
                pincode: "411001",
            };

            let insertedPayload: Record<string, unknown> = {};
            mockedSupabase.upsert = jest.fn().mockImplementation((vals) => {
                insertedPayload = vals;
                return {
                    select: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValueOnce({
                            data: {
                                id: "report-id-fallback",
                                ...vals,
                                created_at: "2026-06-03T23:31:00Z",
                            },
                            error: null,
                        }),
                    }),
                };
            });

            const response = await request(app)
                .post("/api/reports")
                .set("X-Forwarded-For", "1.2.3.7")
                .send(payload);

            expect(response.status).toBe(201);
            expect(insertedPayload.city).toBe("Pune");
            expect(insertedPayload.district).toBe("Pune");
        });

        it("uses the explicit district field instead of city when both are provided", async () => {
            const payload = {
                medicineName: "Aspirin 500mg",
                manufacturer: "TestCo",
                description: "This is a detailed description of the issue",
                images: ["https://example.com/image1.jpg"],
                pharmacyName: "Test Pharmacy",
                address: "123 Main St",
                city: "Pune",
                district: "Pune District",
                state: "Maharashtra",
                pincode: "411001",
            };

            let insertedPayload: Record<string, unknown> = {};
            mockedSupabase.upsert = jest.fn().mockImplementation((vals) => {
                insertedPayload = vals;
                return {
                    select: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValueOnce({
                            data: {
                                id: "report-id-explicit-district",
                                ...vals,
                                created_at: "2026-06-03T23:31:00Z",
                            },
                            error: null,
                        }),
                    }),
                };
            });

            const response = await request(app)
                .post("/api/reports")
                .set("X-Forwarded-For", "1.2.3.8")
                .send(payload);

            expect(response.status).toBe(201);
            // city and district are stored as distinct values, not aliased.
            expect(insertedPayload.city).toBe("Pune");
            expect(insertedPayload.district).toBe("Pune District");
        });

        it("passes the explicit district (not city) to validateReport's burst/sybil detection", async () => {
            const validateReport = jest.requireMock(
                "../src/services/reportValidation.service"
            ).validateReport;

            const payload = {
                medicineName: "Aspirin 500mg",
                manufacturer: "TestCo",
                description: "This is a detailed description of the issue",
                images: ["https://example.com/image1.jpg"],
                pharmacyName: "Test Pharmacy",
                address: "123 Main St",
                city: "Pune",
                district: "Pune District",
                state: "Maharashtra",
                pincode: "411001",
            };

            mockedSupabase.upsert = jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValueOnce({
                        data: {
                            id: "report-id-validate-district",
                            ...payload,
                            created_at: "2026-06-03T23:31:00Z",
                        },
                        error: null,
                    }),
                }),
            });

            await request(app).post("/api/reports").set("X-Forwarded-For", "1.2.3.9").send(payload);

            const [validationPayloadArg] =
                validateReport.mock.calls[validateReport.mock.calls.length - 1];
            expect(validationPayloadArg.city).toBe("Pune");
            expect(validationPayloadArg.district).toBe("Pune District");
        });

        it("rejects a district shorter than the minimum length when explicitly provided", async () => {
            const payload = {
                medicineName: "Aspirin 500mg",
                manufacturer: "TestCo",
                description: "This is a detailed description of the issue",
                images: ["https://example.com/image1.jpg"],
                pharmacyName: "Test Pharmacy",
                address: "123 Main St",
                city: "Pune",
                district: "P",
                state: "Maharashtra",
                pincode: "411001",
            };

            const response = await request(app)
                .post("/api/reports")
                .set("X-Forwarded-For", "1.2.3.10")
                .send(payload);

            expect(response.status).toBe(400);
            expect(response.body.error).toBe("Invalid report payload");
        });

        it("does not leak stack trace or internal error details when validateReport throws", async () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = "production";

            const { validateReport } = require("../src/services/reportValidation.service");
            validateReport.mockRejectedValueOnce(new Error("DB connection failed: ECONNREFUSED"));

            const payload = {
                medicineName: "Aspirin 500mg",
                manufacturer: "TestCo",
                description: "This is a detailed description of the issue",
                images: ["https://example.com/image1.jpg"],
                pharmacyName: "Test Pharmacy",
                address: "123 Main St",
                city: "Delhi",
                state: "Delhi",
                pincode: "110001",
            };

            const response = await request(app)
                .post("/api/reports")
                .set("X-Forwarded-For", "9.9.9.9")
                .set("X-Forwarded-Proto", "https")
                .send(payload);

            process.env.NODE_ENV = originalEnv;

            expect(response.status).toBe(500);
            expect(response.body).not.toHaveProperty("stack");
            expect(response.body).not.toHaveProperty("details");
            expect(response.body.error).not.toHaveProperty("stack");
            expect(JSON.stringify(response.body)).not.toContain("ECONNREFUSED");
            expect(JSON.stringify(response.body)).not.toContain(".ts");
        });

        it("delegates errors to the global error handler instead of the inline catch block", async () => {
            const { validateReport } = require("../src/services/reportValidation.service");
            validateReport.mockRejectedValueOnce(new Error("Simulated internal failure"));

            const payload = {
                medicineName: "Aspirin 500mg",
                manufacturer: "TestCo",
                description: "This is a detailed description of the issue",
                images: ["https://example.com/image1.jpg"],
                pharmacyName: "Test Pharmacy",
                address: "123 Main St",
                city: "Delhi",
                state: "Delhi",
                pincode: "110001",
            };

            const response = await request(app)
                .post("/api/reports")
                .set("X-Forwarded-For", "9.9.9.8")
                .send(payload);

            // Shape matches errorHandler's { success, error: { message, ... } }
            // contract, not the old inline { error, details, stack } shape.
            expect(response.status).toBe(500);
            expect(response.body).toHaveProperty("success", false);
            expect(response.body.error).toHaveProperty("message");
            expect(response.body).not.toHaveProperty("details");
        });

        it("returns 400 when an invalid state is provided", async () => {
            const payload = {
                medicineName: "Aspirin 500mg",
                manufacturer: "TestCo",
                description: "This is a detailed description of the issue",
                images: ["https://example.com/image1.jpg"],
                pharmacyName: "Test Pharmacy",
                address: "123 Main St",
                city: "Pune",
                state: "Maharastra", // Typo in state
                pincode: "411001",
            };

            const response = await request(app).post("/api/reports").send(payload);

            expect(response.status).toBe(400);
            expect(response.body.error).toBe("Invalid report payload");
            expect(response.body.issues[0].message).toBe("Invalid state: Maharastra");
        });

        it("returns 400 when an invalid district is provided for a valid state", async () => {
            const payload = {
                medicineName: "Aspirin 500mg",
                manufacturer: "TestCo",
                description: "This is a detailed description of the issue",
                images: ["https://example.com/image1.jpg"],
                pharmacyName: "Test Pharmacy",
                address: "123 Main St",
                city: "Pune",
                district: "pune dist", // Typo in district
                state: "Maharashtra",
                pincode: "411001",
            };

            const response = await request(app).post("/api/reports").send(payload);

            expect(response.status).toBe(400);
            expect(response.body.error).toBe("Invalid report payload");
            expect(response.body.issues[0].message).toBe(
                "Invalid district 'pune dist' for state 'Maharashtra'"
            );
        });
    });

    describe("GET /api/reports/mine", () => {
        it("returns 401 when authentication token is missing", async () => {
            const response = await request(app).get("/api/reports/mine");

            expect(response.status).toBe(401);
            expect(response.body.error).toBe("Unauthenticated");
        });

        it("returns 200 and user reports list when authenticated", async () => {
            const mockReports = [
                {
                    id: "report-1",
                    reported_brand_name: "Aspirin 500mg",
                    status: "pending",
                    created_at: "2026-06-01T00:00:00Z",
                    photo_url: "https://example.com/image1.jpg",
                    district: "Delhi",
                },
                {
                    id: "report-2",
                    reported_brand_name: "Paracetamol 650mg",
                    status: "verified_fake",
                    created_at: "2026-06-02T00:00:00Z",
                    photo_url: "https://example.com/image2.jpg",
                    district: "Mumbai",
                },
            ];

            mockedSupabase.select = jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                    order: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValueOnce({
                            data: mockReports,
                            error: null,
                        }),
                    }),
                }),
            });

            const response = await request(app)
                .get("/api/reports/mine")
                .set("Authorization", "Bearer test-token");

            expect(response.status).toBe(200);
            expect(response.body.reports).toHaveLength(2);
            expect(response.body.reports[0]).toHaveProperty("id");
            expect(response.body.reports[0]).toHaveProperty("status");
        });

        it("returns empty array when user has no reports", async () => {
            mockedSupabase.select = jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                    order: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValueOnce({
                            data: [],
                            error: null,
                        }),
                    }),
                }),
            });

            const response = await request(app)
                .get("/api/reports/mine")
                .set("Authorization", "Bearer test-token");

            expect(response.status).toBe(200);
            expect(response.body.reports).toHaveLength(0);
        });
    });

    describe("PATCH /api/reports/:id/status", () => {
        it("returns 403 when non-admin user tries to update status", async () => {
            const response = await request(app)
                .patch("/api/reports/report-id-123/status")
                .set("Authorization", "Bearer test-token")
                .send({ status: "verified_fake" });

            expect(response.status).toBe(403);
            expect(response.body.error).toContain("Insufficient permissions");
        });

        it("returns 400 when invalid status is provided", async () => {
            const response = await request(app)
                .patch("/api/reports/report-id-123/status")
                .set("Authorization", "Bearer admin-token")
                .set("X-Admin", "true")
                .send({ status: "invalid_status" });

            expect(response.status).toBe(400);
            expect(response.body.error).toContain("Invalid report status");
        });

        it("returns 404 when report does not exist", async () => {
            mockedSupabase.single = jest
                .fn()
                .mockResolvedValueOnce({ data: null, error: null })
                .mockResolvedValueOnce({ data: null, error: null });

            const response = await request(app)
                .patch("/api/reports/non-existent-id/status")
                .set("Authorization", "Bearer admin-token")
                .set("X-Admin", "true")
                .send({ status: "verified_fake" });

            expect(response.status).toBe(404);
            expect(response.body.error).toContain("not found");
        });

        it("returns 200 and updates status when admin updates with valid status", async () => {
            const updatedReport = {
                id: "report-id-123",
                status: "verified_fake",
                reported_brand_name: "Fake Medicine",
                created_at: "2026-06-01T00:00:00Z",
            };

            mockedSupabase.single = jest
                .fn()
                .mockResolvedValueOnce({ data: { id: "report-id-123" }, error: null })
                .mockResolvedValueOnce({ data: updatedReport, error: null });

            const response = await request(app)
                .patch("/api/reports/report-id-123/status")
                .set("Authorization", "Bearer admin-token")
                .set("X-Admin", "true")
                .send({ status: "verified_fake" });

            expect(response.status).toBe(200);
            expect(response.body.report).toHaveProperty("status", "verified_fake");
        });

        it("sets is_escalated = false when admin verifies a report", async () => {
            const updatedReport = {
                id: "report-id-123",
                status: "verified_fake",
                reported_brand_name: "Fake Medicine",
                district: "Delhi",
                is_escalated: false,
                created_at: "2026-06-01T00:00:00Z",
            };

            mockedSupabase.single = jest
                .fn()
                .mockResolvedValueOnce({ data: { id: "report-id-123" }, error: null })
                .mockResolvedValueOnce({ data: updatedReport, error: null });

            const response = await request(app)
                .patch("/api/reports/report-id-123/status")
                .set("Authorization", "Bearer admin-token")
                .set("X-Admin", "true")
                .send({ status: "verified_fake" });

            expect(response.status).toBe(200);
            expect(response.body.report).toHaveProperty("is_escalated", false);
        });

        it("accepts all valid status values", async () => {
            const validStatuses = ["pending", "verified_fake", "false_alarm"];

            for (const status of validStatuses) {
                mockedSupabase.single = jest
                    .fn()
                    .mockResolvedValueOnce({ data: { id: "report-id" }, error: null })
                    .mockResolvedValueOnce({ data: { id: "report-id", status }, error: null });

                const response = await request(app)
                    .patch(`/api/reports/report-id-${status}/status`)
                    .set("Authorization", "Bearer admin-token")
                    .set("X-Admin", "true")
                    .send({ status });

                expect(response.status).toBe(200);
            }
        });

        it("resets broadcasted=false on the district_alerts upsert when threshold is crossed", async () => {
            const updatedReport = {
                id: "report-id-123",
                district: "Delhi",
                reported_brand_name: "Fake Medicine",
                status: "verified_fake",
                created_at: "2026-06-01T00:00:00Z",
            };

            let upsertPayload: Record<string, unknown> | null = null;
            const originalFrom = mockedSupabase.from;

            (mockedSupabase.from as jest.Mock) = jest.fn().mockImplementation((table: string) => {
                if (table === "counterfeit_reports") {
                    return {
                        select: jest.fn().mockImplementation((_cols?: string, opts?: any) => {
                            if (opts && opts.head) {
                                // Threshold count query chain: .eq().eq().eq()
                                return {
                                    eq: jest.fn().mockReturnValue({
                                        eq: jest.fn().mockReturnValue({
                                            eq: jest
                                                .fn()
                                                .mockResolvedValue({ count: 5, error: null }),
                                        }),
                                    }),
                                };
                            }
                            // Existence-check chain: .eq().single()
                            return {
                                eq: jest.fn().mockReturnValue({
                                    single: jest.fn().mockResolvedValue({
                                        data: { id: "report-id-123" },
                                        error: null,
                                    }),
                                }),
                            };
                        }),
                        update: jest.fn().mockReturnValue({
                            eq: jest.fn().mockReturnValue({
                                select: jest.fn().mockReturnValue({
                                    single: jest
                                        .fn()
                                        .mockResolvedValue({ data: updatedReport, error: null }),
                                }),
                            }),
                        }),
                    };
                }
                if (table === "district_alerts") {
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockReturnValue({
                                eq: jest.fn().mockReturnValue({
                                    maybeSingle: jest.fn().mockResolvedValue({
                                        data: { alert_level: "low" },
                                        error: null,
                                    }),
                                }),
                            }),
                        }),
                        upsert: jest.fn().mockImplementation((payload: Record<string, unknown>) => {
                            upsertPayload = payload;
                            return {
                                select: jest.fn().mockReturnValue({
                                    single: jest.fn().mockResolvedValue({
                                        data: payload,
                                        error: null,
                                    }),
                                }),
                            };
                        }),
                    };
                }
                return {};
            });

            const response = await request(app)
                .patch("/api/reports/report-id-123/status")
                .set("Authorization", "Bearer admin-token")
                .set("X-Admin", "true")
                .send({ status: "verified_fake" });

            mockedSupabase.from = originalFrom;

            expect(response.status).toBe(200);
            expect(upsertPayload).not.toBeNull();
            expect(upsertPayload).toHaveProperty("broadcasted", false);
        });
    });
});
