import request from "supertest";
import app from "../src/app";

jest.mock("../src/db/client", () => {
    return {
        supabase: {
            from: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            range: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn(),
        },
    };
});

import { supabase } from "../src/db/client";

const mockAlerts = [
    {
        id: "uuid-1",
        reported_brand_name: "Paracetamol 500mg",
        manufacturer: "ABC Pharma",
        batch_number: "BAT001",
        alert_type: "nsq",
        risk_level: "high",
        district: "Mumbai",
        state: "Maharashtra",
        reported_at: "2024-01-10",
        created_at: "2024-01-10T10:00:00Z",
    },
    {
        id: "uuid-2",
        reported_brand_name: "Amoxicillin 250mg",
        manufacturer: "XYZ Labs",
        batch_number: "BAT002",
        alert_type: "recalled",
        risk_level: "high",
        district: "Delhi",
        state: "Delhi",
        reported_at: "2024-01-11",
        created_at: "2024-01-11T10:00:00Z",
    },
];

describe("GET /api/alerts", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should return 200 with an array of alerts for a valid query", async () => {
        ((supabase as any).range as jest.Mock).mockResolvedValue({
            data: mockAlerts,
            error: null,
        });

        const res = await request(app).get("/api/alerts");

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.alerts)).toBe(true);
        expect(res.body.alerts).toHaveLength(2);
        expect(res.body.alerts[0].batch_number).toBe("BAT001");
        expect(res.body.page).toBe(1);
    });

    it("should return 200 with paginated results on page 2", async () => {
        const page2Alerts = [
            {
                id: "uuid-3",
                reported_brand_name: "Ibuprofen 400mg",
                manufacturer: "DEF Pharma",
                batch_number: "BAT003",
                alert_type: "counterfeit",
                risk_level: "high",
                district: "Pune",
                state: "Maharashtra",
                reported_at: "2024-01-12",
                created_at: "2024-01-12T10:00:00Z",
            },
        ];

        ((supabase as any).range as jest.Mock).mockResolvedValue({
            data: page2Alerts,
            error: null,
        });

        const res = await request(app).get("/api/alerts?page=2&pageSize=20");

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.alerts)).toBe(true);
        expect(res.body.alerts).toHaveLength(1);
        expect(res.body.page).toBe(2);
        expect(res.body.pageSize).toBe(20);
    });

    it("should return 200 with an empty array when page is out of bounds", async () => {
        ((supabase as any).range as jest.Mock).mockResolvedValue({
            data: [],
            error: null,
        });

        const res = await request(app).get("/api/alerts?page=9999");

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.alerts)).toBe(true);
        expect(res.body.alerts).toHaveLength(0);
    });

    it("should return 200 with an empty array when database has no alerts", async () => {
        ((supabase as any).range as jest.Mock).mockResolvedValue({
            data: null,
            error: null,
        });

        const res = await request(app).get("/api/alerts");

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.alerts)).toBe(true);
        expect(res.body.alerts).toHaveLength(0);
    });

    it("should return 400 for invalid page parameter", async () => {
        const res = await request(app).get("/api/alerts?page=0");

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Invalid pagination parameters");
    });

    it("should return 500 when the database query fails", async () => {
        ((supabase as any).range as jest.Mock).mockResolvedValue({
            data: null,
            error: { message: "connection refused" },
        });

        const res = await request(app).get("/api/alerts");

        expect(res.status).toBe(500);
        expect(res.body.error).toBe("Failed to fetch alerts");
    });
});
