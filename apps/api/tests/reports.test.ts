process.env.SUPABASE_URL = process.env.SUPABASE_URL || "http://localhost:54321";
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "test-anon-key";

(global as any).WebSocket = (global as any).WebSocket || class {};

jest.mock("../src/db/client", () => ({
    supabase: {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        single: jest.fn(),
    },
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

const mockedSupabase = supabase as jest.Mocked<typeof supabase>;

describe("Reports API Routes", () => {
    beforeEach(() => {
        jest.clearAllMocks();
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

            mockedSupabase.insert = jest.fn().mockReturnValue({
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

            mockedSupabase.insert = jest.fn().mockReturnValue({
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

            const response = await request(app).post("/api/reports").send(payload);

            expect(response.status).toBe(201);
            expect(response.body.report.report_location).toBe("POINT(72.8777 19.0760)");
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
                    order: jest.fn().mockResolvedValueOnce({
                        data: mockReports,
                        error: null,
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
                    order: jest.fn().mockResolvedValueOnce({
                        data: [],
                        error: null,
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
            mockedSupabase.select = jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValueOnce({
                        data: null,
                        error: null,
                    }),
                }),
            });

            mockedSupabase.update = jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                    select: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValueOnce({
                            data: null,
                            error: null,
                        }),
                    }),
                }),
            });

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

            mockedSupabase.select = jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValueOnce({
                        data: { id: "report-id-123" },
                        error: null,
                    }),
                }),
            });

            mockedSupabase.update = jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                    select: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValueOnce({
                            data: updatedReport,
                            error: null,
                        }),
                    }),
                }),
            });

            const response = await request(app)
                .patch("/api/reports/report-id-123/status")
                .set("Authorization", "Bearer admin-token")
                .set("X-Admin", "true")
                .send({ status: "verified_fake" });

            expect(response.status).toBe(200);
            expect(response.body.report).toHaveProperty("status", "verified_fake");
        });

        it("accepts all valid status values", async () => {
            const validStatuses = ["pending", "verified_fake", "false_alarm"];

            for (const status of validStatuses) {
                mockedSupabase.select = jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValueOnce({
                            data: { id: "report-id" },
                            error: null,
                        }),
                    }),
                });

                mockedSupabase.update = jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        select: jest.fn().mockReturnValue({
                            single: jest.fn().mockResolvedValueOnce({
                                data: { id: "report-id", status },
                                error: null,
                            }),
                        }),
                    }),
                });

                const response = await request(app)
                    .patch(`/api/reports/report-id-${status}/status`)
                    .set("Authorization", "Bearer admin-token")
                    .set("X-Admin", "true")
                    .send({ status });

                expect(response.status).toBe(200);
            }
        });
    });
});
