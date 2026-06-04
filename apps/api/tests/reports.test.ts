import { Request, Response } from "express";
import { createMocks } from "node-mocks-http";
import router from "../src/routes/reports";
import * as supabaseModule from "../src/db/client";

jest.mock("../src/db/client");

const mockSupabase = supabaseModule.supabase as jest.Mocked<typeof supabaseModule.supabase>;

describe("Reports API Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/reports - Create Report", () => {
    it("should return 400 when required field medicineName is missing", async () => {
      const payload = {
        manufacturer: "Pharma Inc",
        description: "This is a detailed description of a counterfeit medicine found",
        images: ["https://example.com/image1.jpg"],
        pharmacyName: "City Pharmacy",
        address: "123 Main Street",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400001",
      };

      mockSupabase.from = jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().resolvedValue({
              data: null,
              error: { message: "Column validation failed" },
            }),
          }),
        }),
      });

      const { req, res } = createMocks({
        method: "POST",
        url: "/",
        body: payload,
        headers: {
          "content-type": "application/json",
        },
      });

      await router(req as any, res as any);

      expect(res._getStatusCode()).toBe(400);
      expect(res._getJSONData().error).toBeDefined();
    });

    it("should return 400 when images array is empty", async () => {
      const payload = {
        medicineName: "Aspirin",
        manufacturer: "Pharma Inc",
        description: "This is a detailed description of a counterfeit medicine found",
        images: [],
        pharmacyName: "City Pharmacy",
        address: "123 Main Street",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400001",
      };

      const { req, res } = createMocks({
        method: "POST",
        url: "/",
        body: payload,
        headers: {
          "content-type": "application/json",
        },
      });

      await router(req as any, res as any);

      expect(res._getStatusCode()).toBe(400);
    });

    it("should return 201 when valid report payload is submitted", async () => {
      const payload = {
        medicineName: "Aspirin",
        manufacturer: "Pharma Inc",
        description: "This is a detailed description of a counterfeit medicine found",
        images: ["https://example.com/image1.jpg"],
        pharmacyName: "City Pharmacy",
        address: "123 Main Street",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400001",
        latitude: 19.076,
        longitude: 72.8479,
      };

      const mockReport = {
        id: "report-123",
        reported_brand_name: "Aspirin",
        manufacturer: "Pharma Inc",
        description: payload.description,
        photo_url: payload.images[0],
        pharmacy_name: "City Pharmacy",
        status: "pending",
        report_location: "POINT(72.8479 19.076)",
      };

      mockSupabase.from = jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().resolvedValue({
              data: mockReport,
              error: null,
            }),
          }),
        }),
      });

      const { req, res } = createMocks({
        method: "POST",
        url: "/",
        body: payload,
        headers: {
          "content-type": "application/json",
        },
      });

      await router(req as any, res as any);

      expect(res._getStatusCode()).toBe(201);
      expect(res._getJSONData().report).toBeDefined();
    });

    it("should correctly parse coordinates into POINT format", async () => {
      const payload = {
        medicineName: "Aspirin",
        manufacturer: "Pharma Inc",
        description: "This is a detailed description of a counterfeit medicine found",
        images: ["https://example.com/image1.jpg"],
        pharmacyName: "City Pharmacy",
        address: "123 Main Street",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400001",
        latitude: 28.6139,
        longitude: 77.209,
      };

      const mockReport = {
        id: "report-123",
        report_location: "POINT(77.209 28.6139)",
      };

      mockSupabase.from = jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().resolvedValue({
              data: mockReport,
              error: null,
            }),
          }),
        }),
      });

      const { req, res } = createMocks({
        method: "POST",
        url: "/",
        body: payload,
        headers: {
          "content-type": "application/json",
        },
      });

      await router(req as any, res as any);

      expect(res._getStatusCode()).toBe(201);
    });

    it("should return 500 on database insertion error", async () => {
      const payload = {
        medicineName: "Aspirin",
        manufacturer: "Pharma Inc",
        description: "This is a detailed description of a counterfeit medicine found",
        images: ["https://example.com/image1.jpg"],
        pharmacyName: "City Pharmacy",
        address: "123 Main Street",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400001",
      };

      mockSupabase.from = jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().resolvedValue({
              data: null,
              error: { message: "Database connection failed" },
            }),
          }),
        }),
      });

      const { req, res } = createMocks({
        method: "POST",
        url: "/",
        body: payload,
        headers: {
          "content-type": "application/json",
        },
      });

      await router(req as any, res as any);

      expect(res._getStatusCode()).toBe(500);
    });
  });

  describe("GET /api/reports/mine - Get User Reports", () => {
    it("should return 401 when user is not authenticated", async () => {
      const { req, res } = createMocks({
        method: "GET",
        url: "/mine",
        headers: {},
      });

      (req as any).user = null;

      await router(req as any, res as any);

      expect(res._getStatusCode()).toBe(401);
    });

    it("should return user reports when authenticated", async () => {
      const mockReports = [
        {
          id: "report-1",
          reported_brand_name: "Aspirin",
          status: "pending",
          created_at: "2024-01-01T00:00:00Z",
        },
        {
          id: "report-2",
          reported_brand_name: "Paracetamol",
          status: "verified_fake",
          created_at: "2024-01-02T00:00:00Z",
        },
      ];

      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().resolvedValue({
              data: mockReports,
              error: null,
            }),
          }),
        }),
      });

      const { req, res } = createMocks({
        method: "GET",
        url: "/mine",
        headers: {},
      });

      (req as any).user = { id: "user-123" };

      await router(req as any, res as any);

      expect(res._getStatusCode()).toBe(200);
      expect(res._getJSONData().reports).toHaveLength(2);
    });

    it("should return empty array when user has no reports", async () => {
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().resolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      });

      const { req, res } = createMocks({
        method: "GET",
        url: "/mine",
        headers: {},
      });

      (req as any).user = { id: "user-123" };

      await router(req as any, res as any);

      expect(res._getStatusCode()).toBe(200);
      expect(res._getJSONData().reports).toHaveLength(0);
    });

    it("should return 500 on database error", async () => {
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().resolvedValue({
              data: null,
              error: { message: "Database error" },
            }),
          }),
        }),
      });

      const { req, res } = createMocks({
        method: "GET",
        url: "/mine",
        headers: {},
      });

      (req as any).user = { id: "user-123" };

      await router(req as any, res as any);

      expect(res._getStatusCode()).toBe(500);
    });
  });

  describe("PATCH /api/reports/:id/status - Update Report Status", () => {
    it("should return 400 when status is invalid", async () => {
      const { req, res } = createMocks({
        method: "PATCH",
        url: "/report-123/status",
        body: { status: "invalid_status" },
        headers: {
          "content-type": "application/json",
        },
      });

      (req as any).user = { id: "admin-123", role: "admin" };

      await router(req as any, res as any);

      expect(res._getStatusCode()).toBe(400);
    });

    it("should return 404 when report does not exist", async () => {
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().resolvedValue({
              data: null,
              error: { message: "No rows returned" },
            }),
          }),
        }),
      });

      const { req, res } = createMocks({
        method: "PATCH",
        url: "/report-123/status",
        body: { status: "verified_fake" },
        headers: {
          "content-type": "application/json",
        },
      });

      (req as any).user = { id: "admin-123", role: "admin" };
      (req as any).params = { id: "report-123" };

      await router(req as any, res as any);

      expect(res._getStatusCode()).toBe(404);
    });

    it("should successfully update report status when authenticated as admin", async () => {
      const mockReport = {
        id: "report-123",
        reported_brand_name: "Aspirin",
        status: "verified_fake",
        district: "Mumbai",
      };

      mockSupabase.from = jest.fn()
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().resolvedValue({
                data: mockReport,
                error: null,
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().resolvedValue({
                  data: mockReport,
                  error: null,
                }),
              }),
            }),
          }),
        });

      const { req, res } = createMocks({
        method: "PATCH",
        url: "/report-123/status",
        body: { status: "verified_fake" },
        headers: {
          "content-type": "application/json",
        },
      });

      (req as any).user = { id: "admin-123", role: "admin" };
      (req as any).params = { id: "report-123" };

      await router(req as any, res as any);

      expect(res._getStatusCode()).toBe(200);
      expect(res._getJSONData().report).toBeDefined();
    });

    it("should return 400 with detailed error issues when validation fails", async () => {
      const { req, res } = createMocks({
        method: "PATCH",
        url: "/report-123/status",
        body: { status: "unknown_status" },
        headers: {
          "content-type": "application/json",
        },
      });

      (req as any).user = { id: "admin-123", role: "admin" };

      await router(req as any, res as any);

      expect(res._getStatusCode()).toBe(400);
      expect(res._getJSONData().details).toBeDefined();
    });

    it("should return 500 on database update error", async () => {
      mockSupabase.from = jest.fn()
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().resolvedValue({
                data: { id: "report-123" },
                error: null,
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().resolvedValue({
                  data: null,
                  error: { message: "Database error" },
                }),
              }),
            }),
          }),
        });

      const { req, res } = createMocks({
        method: "PATCH",
        url: "/report-123/status",
        body: { status: "verified_fake" },
        headers: {
          "content-type": "application/json",
        },
      });

      (req as any).user = { id: "admin-123", role: "admin" };
      (req as any).params = { id: "report-123" };

      await router(req as any, res as any);

      expect(res._getStatusCode()).toBe(500);
    });
  });
});
