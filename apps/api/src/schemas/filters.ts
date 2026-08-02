import { z } from "zod";

/**
 * Brand / medicine name filter — trimmed, bounded length.
 */
export const brandFilterSchema = z.object({
    brand: z.string().trim().min(1).max(200).optional(),
});

/**
 * Region / state filter.
 */
export const regionFilterSchema = z.object({
    region: z.string().trim().min(1).max(100).optional(),
});

/**
 * Batch number filter.
 */
export const batchFilterSchema = z.object({
    batch_number: z.string().trim().min(1).max(100).optional(),
});

/**
 * Combined common filters used by alerts, analytics, etc.
 */
export const commonFiltersSchema = brandFilterSchema
    .merge(regionFilterSchema)
    .merge(batchFilterSchema);

/**
 * Geolocation query params (lat/lng with bounds validation).
 */
export const geolocationQuerySchema = z.object({
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    radius_km: z.coerce.number().min(0.1).max(500).default(10),
});
