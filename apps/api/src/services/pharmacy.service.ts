import { pharmacyRepository } from "../repositories/pharmacy.repository";
import { redisRepository } from "../repositories/redis.repository";
import { buildOrConditions } from "../utils/db";
import logger from "../utils/logger";
import { z } from "zod";
import { FormattedPharmacy, PharmacyRpcResult } from "../types/pharmacy.types";

const MAX_RESULTS = 200;

interface PharmacyRow {
    /* same as route file — move this interface here */
    id?: string;
    name: string;
    address: string;
    lat?: number;
    lng?: number;
    location?: { type: string; coordinates: number[] } | null;
    phone_number: string | null;
    is_verified: boolean;
    district: string | null;
    state: string | null;
    status?: "pending" | "approved" | "rejected";
    updated_at?: string;
    is_active?: boolean;
    deleted_at?: string | null;
}
interface PharmacyWithRawDistance extends FormattedPharmacy {
    rawDistance: number;
}

const inventoryRowSchema = z.object({
    medicine_name: z.string().min(1, "Medicine name is required"),
    batch_number: z.string().min(1, "Batch number is required"),
    expiry_date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Expiry date must be in YYYY-MM-DD format"),
    quantity: z.preprocess(
        (val) => Number(val),
        z.number().int().nonnegative("Quantity must be a positive number")
    ),
    mrp: z.preprocess((val) => Number(val), z.number().positive("MRP must be a valid price")),
});

// ── Helpers (moved from route file) ──
function calculateDistanceKM(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * (Math.PI / 180)) *
            Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function extractCoordinates(p: PharmacyRow) {
    if (p.lat !== undefined && p.lng !== undefined)
        return { lat: Number(p.lat), lng: Number(p.lng) };
    if (p.location?.coordinates)
        return { lat: Number(p.location.coordinates[1]), lng: Number(p.location.coordinates[0]) };
    return { lat: 0, lng: 0 };
}

function formatPharmacy(p: PharmacyRow, distanceKm: number): FormattedPharmacy {
    const coords = extractCoordinates(p);
    return {
        id: p.id,
        name: p.name || "Unknown Pharmacy",
        address: p.address || "Unknown Address",
        lat: coords.lat,
        lng: coords.lng,
        distance: `${distanceKm.toFixed(1)} km`,
        phone_number: p.phone_number || null,
        is_verified: p.is_verified ?? false,
        district: p.district || null,
        state: p.state || null,
        updated_at: p.updated_at,
        is_active: p.is_active,
        deleted_at: p.deleted_at,
    };
}

// Common CSV parsing used by both bulk-upload and inventory/upload
function parseInventoryCsv(fileContent: string, pharmacyId: string) {
    const lines = fileContent
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
    if (lines.length <= 1) {
        const err: any = new Error("The file appears empty or is missing rows.");
        err.status = 400;
        throw err;
    }
    if (lines.length > 501) {
        const err: any = new Error(
            "Bulk upload exceeds the maximum limit of 500 items per request."
        );
        err.status = 400;
        throw err;
    }

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const rowsToInsert: any[] = [];
    const failedRows: Array<{ row: number; reason: string }> = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i]
            .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
            .map((v) => v.replace(/^"|"$/g, "").trim());
        const rowData: Record<string, any> = {};
        headers.forEach((header, index) => {
            const val = values[index];
            rowData[header] = val === "" || val === undefined ? undefined : val;
        });

        const result = inventoryRowSchema.safeParse(rowData);
        if (!result.success) {
            failedRows.push({
                row: i + 1,
                reason: result.error.issues.map((e) => e.message).join(", "),
            });
            continue;
        }
        rowsToInsert.push({ pharmacy_id: pharmacyId, ...result.data });
    }
    return { rowsToInsert, failedRows, totalRows: lines.length - 1 };
}

export const pharmacyService = {
    // POST /
    async registerPharmacy(input: any, userId: string) {
        const existing = await pharmacyRepository.findByLicenseId(input.licenseId);
        if (existing) {
            const err: any = new Error("A pharmacy with this license ID is already registered");
            err.status = 409;
            throw err;
        }
        return pharmacyRepository.insertPharmacy({
            name: input.name,
            license_id: input.licenseId,
            address: input.address,
            district: input.district,
            state: input.state,
            phone_number: input.phone_number ?? null,
            location:
                input.lat !== undefined && input.lng !== undefined
                    ? `POINT(${input.lng} ${input.lat})`
                    : null,
            is_verified: false,
            status: "pending",
            created_by: userId,
        });
    },

    // GET /search-by-medicine
    async searchByMedicine(rawQuery: string) {
        const words = rawQuery
            .toLowerCase()
            .split(/\s+/)
            .map((w) => w.trim())
            .filter((w) => w.length >= 2);
        if (words.length === 0) {
            const err: any = new Error(
                "Query contains no searchable words (each word must be at least 2 characters)"
            );
            err.status = 400;
            throw err;
        }

        const cacheKey = `pharmacies:medicine-search:${words.join(":")}`;
        const cached = await redisRepository.get(cacheKey);
        if (cached) return JSON.parse(cached);

        const orFilter = buildOrConditions(["medicine_name"], words);
        const inventoryRows = await pharmacyRepository.searchInventoryByMedicine(orFilter);

        const pharmacyMap = new Map<string, any>();
        for (const row of inventoryRows ?? []) {
            const pharmacy = (row as any).pharmacies;
            if (!pharmacy || pharmacy.status !== "approved") continue;
            const pid = pharmacy.id;
            if (!pharmacyMap.has(pid)) {
                pharmacyMap.set(pid, {
                    pharmacy_id: pid,
                    pharmacy_name: pharmacy.name ?? "Unknown Pharmacy",
                    address: pharmacy.address ?? "Unknown Address",
                    district: pharmacy.district ?? null,
                    state: pharmacy.state ?? null,
                    phone_number: pharmacy.phone_number ?? null,
                    is_verified: pharmacy.is_verified ?? false,
                    matched_medicines: new Set<string>(),
                });
            }
            if (row.medicine_name) pharmacyMap.get(pid)!.matched_medicines.add(row.medicine_name);
        }

        const pharmacies = Array.from(pharmacyMap.values()).map(
            ({ matched_medicines, ...rest }) => ({
                ...rest,
                matched_medicines: Array.from(matched_medicines),
            })
        );

        const responseBody = { pharmacies, query: rawQuery, total: pharmacies.length };
        await redisRepository.set(cacheKey, JSON.stringify(responseBody), 300);
        return responseBody;
    },

    // GET /nearest
    async getNearest(lat: number, lng: number, radius: number) {
        const { data: rpcData, error: rpcError } = await pharmacyRepository.rpcGetNearestPharmacies(
            lat,
            lng,
            radius
        );

        if (!rpcError && rpcData) {
            const pharmacies = (rpcData as PharmacyRpcResult[])
                .map((p) => ({
                    name: p.name || "Unknown Pharmacy",
                    address: p.address || "Unknown Address",
                    lat: p.lat,
                    lng: p.lng,
                    distance: `${Number(p.distance).toFixed(1)} km`,
                    phone_number: p.phone_number || null,
                    is_verified: p.is_verified ?? false,
                    district: p.district || null,
                    state: p.state || null,
                }))
                .slice(0, MAX_RESULTS);
            return { pharmacies };
        }

        logger.warn("PostGIS RPC failed, falling back to Haversine", { error: rpcError?.message });
        const allPharmacies = await pharmacyRepository.findAllApprovedForFallback();

        const pharmacies = ((allPharmacies || []) as PharmacyRow[])
            .filter((p) => p.status === "approved")
            .map((p): PharmacyWithRawDistance => {
                const coords = extractCoordinates(p);
                const distanceKm = calculateDistanceKM(lat, lng, coords.lat, coords.lng);
                return { ...formatPharmacy(p, distanceKm), rawDistance: distanceKm };
            })
            .filter((p) => p.lat !== 0 && p.lng !== 0 && p.rawDistance <= radius)
            .sort((a, b) => a.rawDistance - b.rawDistance)
            .slice(0, MAX_RESULTS)
            .map(({ rawDistance, ...rest }) => rest);

        return { pharmacies };
    },

    // GET /in-bounds
    async getInBounds(params: {
        south: number;
        west: number;
        north: number;
        east: number;
        since?: Date;
        limit: number;
        offset: number;
    }) {
        const { south, west, north, east, since, limit, offset } = params;
        const syncedAt = new Date().toISOString();
        const centerLat = (south + north) / 2;
        const centerLng = (west + east) / 2;

        const { data: rpcData, error: rpcError } = since
            ? await pharmacyRepository.rpcGetPharmaciesInBoundsDelta({
                  south,
                  west,
                  north,
                  east,
                  since: since.toISOString(),
              })
            : await pharmacyRepository.rpcGetPharmaciesInBounds({
                  south,
                  west,
                  north,
                  east,
                  limit,
                  offset,
              });

        if (!rpcError && rpcData) {
            const pharmacies = (rpcData as PharmacyRpcResult[])
                .map((p) => ({
                    id: p.id,
                    name: p.name || "Unknown Pharmacy",
                    address: p.address || "Unknown Address",
                    lat: p.lat,
                    lng: p.lng,
                    distance: `${Number(p.distance).toFixed(1)} km`,
                    phone_number: p.phone_number || null,
                    is_verified: p.is_verified ?? false,
                    district: p.district || null,
                    state: p.state || null,
                    updated_at: p.updated_at,
                    is_active: p.is_active ?? true,
                    deleted_at: p.deleted_at ?? null,
                }))
                .slice(0, MAX_RESULTS);
            return { pharmacies, syncedAt, delta: since !== undefined };
        }

        logger.warn("PostGIS bounds RPC unavailable, falling back", { error: rpcError?.message });
        const allPharmacies = await pharmacyRepository.findInBoundsFallback(since?.toISOString());

        const pharmacies = ((allPharmacies || []) as PharmacyRow[])
            .filter((p) => {
                if (p.status !== "approved") return false;
                if (!since && p.is_active === false) return false;
                return true;
            })
            .map((p) => {
                const coords = extractCoordinates(p);
                const distanceKm = calculateDistanceKM(
                    centerLat,
                    centerLng,
                    coords.lat,
                    coords.lng
                );
                return {
                    id: p.id,
                    name: p.name || "Unknown Pharmacy",
                    address: p.address || "Unknown Address",
                    lat: coords.lat,
                    lng: coords.lng,
                    distance: `${distanceKm.toFixed(1)} km`,
                    phone_number: p.phone_number || null,
                    is_verified: p.is_verified ?? false,
                    district: p.district || null,
                    state: p.state || null,
                    updated_at: p.updated_at,
                    is_active: p.is_active,
                    deleted_at: p.deleted_at,
                    coords,
                };
            })
            .filter(
                (p) =>
                    p.coords.lat !== 0 &&
                    p.coords.lng !== 0 &&
                    p.coords.lat >= south &&
                    p.coords.lat <= north &&
                    p.coords.lng >= west &&
                    p.coords.lng <= east
            )
            .slice(0, MAX_RESULTS)
            .map(({ coords, ...rest }) => rest);

        return { pharmacies, syncedAt, delta: since !== undefined };
    },

    // POST /bulk-upload
    async bulkUploadByUser(userId: string, fileContent: string) {
        const pharmacy = await pharmacyRepository.findByCreatedBy(userId);
        if (!pharmacy) {
            const err: any = new Error("No registered pharmacy found for this authorized user.");
            err.status = 404;
            throw err;
        }
        const { rowsToInsert, failedRows, totalRows } = parseInventoryCsv(fileContent, pharmacy.id);
        let successCount = 0;
        if (rowsToInsert.length > 0) {
            await pharmacyRepository.insertInventoryRows(rowsToInsert);
            successCount = rowsToInsert.length;
        }
        return { totalRows, successCount, failedCount: failedRows.length, errors: failedRows };
    },

    // POST /:id/inventory/upload
    async uploadInventoryForPharmacy(
        pharmacyId: string,
        userId: string,
        userRole: string,
        fileContent: string
    ) {
        const pharmacy: any = await pharmacyRepository.findById(pharmacyId);
        if (!pharmacy) {
            const err: any = new Error("Pharmacy not found");
            err.status = 404;
            throw err;
        }
        const isOwner = pharmacy.created_by === userId;
        const isAdmin = userRole === "admin" || userRole === "moderator";
        if (!isOwner && !isAdmin) {
            const err: any = new Error("You can only upload inventory for pharmacies you own");
            err.status = 403;
            throw err;
        }

        const { rowsToInsert, failedRows, totalRows } = parseInventoryCsv(fileContent, pharmacyId);
        let successCount = 0;
        if (rowsToInsert.length > 0) {
            await pharmacyRepository.insertInventoryRows(rowsToInsert);
            successCount = rowsToInsert.length;
        }
        return { totalRows, successCount, failedCount: failedRows.length, errors: failedRows };
    },

    // PUT /:id
    async updatePharmacy(pharmacyId: string, userId: string, userRole: string, updateData: any) {
        const pharmacy: any = await pharmacyRepository.findById(
            pharmacyId,
            "id, created_by, status"
        );
        if (!pharmacy) {
            const err: any = new Error("Pharmacy not found");
            err.status = 404;
            throw err;
        }
        const isOwner = pharmacy.created_by === userId;
        const isAdmin = userRole === "admin" || userRole === "moderator";
        if (!isOwner && !isAdmin) {
            const err: any = new Error("You can only update pharmacies you own");
            err.status = 403;
            throw err;
        }

        delete updateData.id;
        delete updateData.created_by;
        if (!isAdmin) {
            delete updateData.status;
            delete updateData.is_verified;
        }
        return pharmacyRepository.updatePharmacy(pharmacyId, updateData);
    },

    // DELETE /:id
    async deletePharmacy(pharmacyId: string, userId: string, userRole: string) {
        const pharmacy: any = await pharmacyRepository.findById(
            pharmacyId,
            "id, created_by, status"
        );
        if (!pharmacy) {
            const err: any = new Error("Pharmacy not found");
            err.status = 404;
            throw err;
        }
        const isOwner = pharmacy.created_by === userId;
        const isAdmin = userRole === "admin" || userRole === "moderator";
        if (!isOwner && !isAdmin) {
            const err: any = new Error("You can only delete pharmacies you own");
            err.status = 403;
            throw err;
        }
        await pharmacyRepository.softDelete(pharmacyId);
    },
};
