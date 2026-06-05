import request from "supertest";
import app from "../src/app";

jest.mock("../src/db/client", () => {
    const mock = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn(),
    };

    return { supabase: mock };
});

import { supabase } from "../src/db/client";

const mockedSupabase = supabase as any;

describe("GET /api/verify/batch/:batchNumber", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedSupabase.maybeSingle.mockReset();
    });

    it("returns traceability details when a dedicated batch record exists", async () => {
        mockedSupabase.maybeSingle.mockResolvedValueOnce({
            data: {
                batch_number: "BN2024001",
                manufacturing_date: "2026-01-10",
                expiry_date: "2099-12-31",
                recall_status: "none",
                recall_reason: null,
                quantity_produced: 5000,
                medicine: {
                    id: "medicine-1",
                    brand_name: "SahiCure",
                    generic_name: "Paracetamol",
                    cdsco_approval_status: "Approved",
                    is_counterfeit_alert: false,
                },
                manufacturer: {
                    name: "Sahi Pharma Ltd",
                    license_number: "LIC-12345",
                    address: "Industrial Area",
                    city: "Ahmedabad",
                    state: "Gujarat",
                    pincode: "380001",
                    phone: "07912345678",
                    email: "quality@sahipharma.example",
                    website: "https://sahipharma.example",
                    gmp_certified: true,
                    location: {
                        coordinates: [72.5714, 23.0225],
                    },
                },
            },
            error: null,
        });

        const response = await request(app).get("/api/verify/batch/BN2024001");

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
            found: true,
            source: "batches",
            batch: {
                batch_number: "BN2024001",
                manufacturing_date: "2026-01-10",
                expiry_date: "2099-12-31",
                recall_status: "none",
                recall_reason: null,
                quantity_produced: 5000,
            },
            medicine: {
                id: "medicine-1",
                brand_name: "SahiCure",
                generic_name: "Paracetamol",
                cdsco_approval_status: "Approved",
                is_counterfeit_alert: false,
            },
            manufacturer: {
                name: "Sahi Pharma Ltd",
                license_number: "LIC-12345",
                coordinates: {
                    lat: 23.0225,
                    lng: 72.5714,
                },
            },
            expiry_status: "green",
        });
        expect(mockedSupabase.from).toHaveBeenCalledTimes(1);
        expect(mockedSupabase.from).toHaveBeenCalledWith("batches");
        expect(mockedSupabase.eq).toHaveBeenCalledWith("batch_number", "BN2024001");
    });

    it("falls back to the medicines table when no batch row exists", async () => {
        mockedSupabase.maybeSingle
            .mockResolvedValueOnce({ data: null, error: null })
            .mockResolvedValueOnce({
                data: {
                    id: "medicine-2",
                    brand_name: "CiproSafe",
                    generic_name: "Ciprofloxacin",
                    manufacturer: "Fallback Pharma",
                    batch_number: "MED-FALLBACK-7",
                    manufacturing_date: "2025-02-15",
                    expiry_date: "2026-09-30",
                    cdsco_approval_status: "Approved",
                    is_counterfeit_alert: false,
                    manufacturer_id: "manufacturer-7",
                },
                error: null,
            })
            .mockResolvedValueOnce({
                data: {
                    name: "Fallback Pharma Pvt Ltd",
                    license_number: "MFG-777",
                    address: "Plot 7",
                    city: "Pune",
                    state: "Maharashtra",
                    pincode: "411001",
                    phone: "02012345678",
                    email: "qa@fallback.example",
                    website: "https://fallback.example",
                    gmp_certified: true,
                    location: {
                        coordinates: [73.8567, 18.5204],
                    },
                },
                error: null,
            });

        const response = await request(app).get("/api/verify/batch/MED-FALLBACK-7");

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
            found: true,
            source: "medicines",
            batch: {
                batch_number: "MED-FALLBACK-7",
                manufacturing_date: "2025-02-15",
                expiry_date: "2026-09-30",
                recall_status: "none",
                recall_reason: null,
            },
            medicine: {
                id: "medicine-2",
                brand_name: "CiproSafe",
                generic_name: "Ciprofloxacin",
            },
            manufacturer: {
                name: "Fallback Pharma Pvt Ltd",
                license_number: "MFG-777",
                coordinates: {
                    lat: 18.5204,
                    lng: 73.8567,
                },
            },
        });
        expect(mockedSupabase.from).toHaveBeenNthCalledWith(1, "batches");
        expect(mockedSupabase.from).toHaveBeenNthCalledWith(2, "medicines");
        expect(mockedSupabase.from).toHaveBeenNthCalledWith(3, "manufacturers");
        expect(mockedSupabase.eq).toHaveBeenNthCalledWith(1, "batch_number", "MED-FALLBACK-7");
        expect(mockedSupabase.eq).toHaveBeenNthCalledWith(2, "batch_number", "MED-FALLBACK-7");
        expect(mockedSupabase.eq).toHaveBeenNthCalledWith(3, "id", "manufacturer-7");
    });

    it("returns 404 when neither batch nor medicine records match", async () => {
        mockedSupabase.maybeSingle
            .mockResolvedValueOnce({ data: null, error: null })
            .mockResolvedValueOnce({ data: null, error: null });

        const response = await request(app).get("/api/verify/batch/UNKNOWN123");

        expect(response.status).toBe(404);
        expect(response.body).toEqual({
            found: false,
            message: "No batch or medicine record found for this batch number.",
        });
        expect(mockedSupabase.from).toHaveBeenNthCalledWith(1, "batches");
        expect(mockedSupabase.from).toHaveBeenNthCalledWith(2, "medicines");
    });

    it("returns 400 for invalid batch number input before querying Supabase", async () => {
        const response = await request(app).get("/api/verify/batch/ab");

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Invalid batch number");
        expect(response.body.details).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    message: "Batch number must be at least 3 characters",
                }),
            ])
        );
        expect(mockedSupabase.from).not.toHaveBeenCalled();
    });

    it("rejects wildcard characters before querying Supabase", async () => {
        const response = await request(app).get("/api/verify/batch/BN2024%25");

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Invalid batch number");
        expect(response.body.details).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    message: "Batch number contains invalid characters",
                }),
            ])
        );
        expect(mockedSupabase.from).not.toHaveBeenCalled();
    });

    it("returns 500 when the primary batch lookup fails", async () => {
        mockedSupabase.maybeSingle.mockResolvedValueOnce({
            data: null,
            error: { message: "database unavailable" },
        });

        const response = await request(app).get("/api/verify/batch/BN2024001");

        expect(response.status).toBe(500);
        expect(response.body).toEqual({ error: "Database lookup failed" });
        expect(mockedSupabase.from).toHaveBeenCalledTimes(1);
        expect(mockedSupabase.from).toHaveBeenCalledWith("batches");
    });

    it("uses exact batch-number matching and preserves request casing", async () => {
        mockedSupabase.maybeSingle
            .mockResolvedValueOnce({ data: null, error: null })
            .mockResolvedValueOnce({ data: null, error: null });

        await request(app).get("/api/verify/batch/bn2024001");

        expect(mockedSupabase.eq).toHaveBeenNthCalledWith(1, "batch_number", "bn2024001");
        expect(mockedSupabase.eq).toHaveBeenNthCalledWith(2, "batch_number", "bn2024001");
    });
});
