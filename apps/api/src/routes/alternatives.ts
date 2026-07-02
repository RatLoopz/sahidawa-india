import { Router, Request, Response } from "express";
import { supabase } from "../db/client";
import logger from "../utils/logger";
import { escapePostgrest } from "../utils/db";
import { barcodeLimiter } from "../middleware/rateLimit";
import { redisClient } from "../utils/redis";

const router = Router();

interface StoreLocation {
    lat?: string | number;
    lng?: string | number;
    location?: {
        coordinates?: [number, number];
    };
}

function extractCoordinates(p: StoreLocation): { lat: number; lng: number } {
    if (p.lat !== undefined && p.lng !== undefined) {
        return { lat: Number(p.lat), lng: Number(p.lng) };
    }
    if (p.location && typeof p.location === "object" && p.location.coordinates) {
        return {
            lat: Number(p.location.coordinates[1]),
            lng: Number(p.location.coordinates[0]),
        };
    }
    return { lat: 0, lng: 0 };
}

/**
 * @openapi
 * /api/v1/alternatives/{medicine_id}:
 *   get:
 *     tags:
 *       - Medicine Alternatives
 *     summary: Get Jan Aushadhi generic alternatives for a brand medicine
 *     description: Returns generic alternatives with price comparison and the nearest pharmacy store details.
 *     parameters:
 *       - in: path
 *         name: medicine_id
 *         required: true
 *         schema:
 *           type: string
 *         description: The UUID, barcode, or brand name of the medicine
 *       - in: query
 *         name: lat
 *         required: false
 *         schema:
 *           type: number
 *         description: Latitude of user to find nearest store
 *       - in: query
 *         name: lng
 *         required: false
 *         schema:
 *           type: number
 *         description: Longitude of user to find nearest store
 *     responses:
 *       200:
 *         description: Alternatives found
 *       404:
 *         description: Medicine or alternative not found
 *       500:
 *         description: Server error
 */
router.get("/:medicine_id", barcodeLimiter, async (req: Request, res: Response): Promise<void> => {
    try {
        const medicine_id = req.params.medicine_id as string;
        const lat = req.query.lat ? parseFloat(req.query.lat as string) : undefined;
        const lng = req.query.lng ? parseFloat(req.query.lng as string) : undefined;
        const cacheKey =
            lat !== undefined && lng !== undefined
                ? `alt_cache:${medicine_id.toLowerCase()}:${lat.toFixed(3)}:${lng.toFixed(3)}`
                : `alt_cache:${medicine_id.toLowerCase()}`;

        if (lat !== undefined && lng !== undefined) {
            if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
                res.status(400).json({
                    error: "Invalid coordinates: lat must be [-90, 90] and lng must be [-180, 180]",
                });
                return;
            }
        }

        if (!medicine_id) {
            res.status(400).json({ error: "medicine_id is required" });
            return;
        }
        try {
            const cached = await redisClient.get(cacheKey);

            if (cached) {
                logger.info(`Alternatives cache HIT: ${cacheKey}`);
                res.status(200).json(JSON.parse(cached));
                return;
            }
        } catch (err) {
            logger.warn("Redis cache read failed", { err });
        }

        interface MedicineRecord {
            id?: string;
            brand_name?: string;
            generic_name?: string;
            mrp?: number;
            brand_price?: number;
            jan_aushadhi_price?: number;
        }

        // 1. Look up medicine in medicines table by ID, barcode, or brand name
        let medicine: MedicineRecord | null = null;

        // Try UUID match
        const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(medicine_id)) {
            const { data } = await supabase
                .from("medicines")
                .select("id, brand_name, generic_name, mrp, jan_aushadhi_price")
                .eq("id", medicine_id)
                .maybeSingle();
            medicine = data;
        }

        // Try barcode match if not matched by UUID
        if (!medicine) {
            const { data } = await supabase
                .from("medicines")
                .select("id, brand_name, generic_name, mrp, jan_aushadhi_price")
                .eq("barcode_id", medicine_id)
                .maybeSingle();
            medicine = data;
        }

        // Try brand name match if still not matched
        if (!medicine) {
            const { data } = await supabase
                .from("medicines")
                .select("id, brand_name, generic_name, mrp, jan_aushadhi_price")
                .ilike("brand_name", medicine_id)
                .limit(1)
                .maybeSingle();
            medicine = data;
        }

        interface GenericAlternative {
            brand_name?: string;
            generic_name?: string;
            brand_price?: number;
            brand_mrp?: number;
            jan_aushadhi_price?: number;
            savings_percentage?: number;
            generic_name_display?: string;
        }

        // 2. Fetch alternative from generic_alternatives
        let alternative: GenericAlternative | null = null;

        if (medicine) {
            const { data } = await supabase
                .from("generic_alternatives")
                .select("*")
                .or(
                    `brand_medicine_id.eq.${medicine.id},brand_name.ilike."%${escapePostgrest(String(medicine.brand_name))}%"`
                )
                .limit(1)
                .maybeSingle();
            alternative = data;
        } else {
            // Try lookup directly in generic_alternatives by brand name or generic name matching medicine_id
            const { data } = await supabase
                .from("generic_alternatives")
                .select("*")
                .or(
                    `brand_name.ilike."%${escapePostgrest(String(medicine_id))}%",generic_name.ilike."%${escapePostgrest(medicine_id)}%"`
                )
                .limit(1)
                .maybeSingle();
            alternative = data;
        }

        if (!alternative) {
            res.status(404).json({
                error: "No generic alternative found for this medicine",
                suggestion: "Visit your nearest Jan Aushadhi store or ask your pharmacist.",
            });
            return;
        }

        // 3. Find nearest pharmacy
        let nearestStore = null;

        if (lat !== undefined && lng !== undefined && !isNaN(lat) && !isNaN(lng)) {
            // Call get_nearest_pharmacies RPC
            const { data: rpcData, error: rpcError } = await supabase.rpc(
                "get_nearest_pharmacies",
                {
                    query_lat: lat,
                    query_lng: lng,
                    search_radius_km: 100,
                }
            );

            if (!rpcError && rpcData && rpcData.length > 0) {
                nearestStore = {
                    name: rpcData[0].name,
                    lat: Number(rpcData[0].lat),
                    lng: Number(rpcData[0].lng),
                    distance: `${Number(rpcData[0].distance).toFixed(1)} km`,
                };
            }
        }

        // Fallback: Get first pharmacy in database as a default store
        if (!nearestStore) {
            const { data: defaultStores } = await supabase
                .from("pharmacies")
                .select("name, address, location, phone_number, is_verified, district, state")
                .limit(1);

            if (defaultStores && defaultStores.length > 0) {
                const store = defaultStores[0];
                const coords = extractCoordinates(store);
                nearestStore = {
                    name: store.name,
                    lat: coords.lat,
                    lng: coords.lng,
                    distance: "Nearest store",
                };
            }
        }

        const brandPrice = Number(
            alternative.brand_price || alternative.brand_mrp || medicine?.mrp || 120.0
        );
        const jaPrice = Number(
            alternative.jan_aushadhi_price || medicine?.jan_aushadhi_price || 15.0
        );
        const savingsPct =
            alternative.savings_percentage ??
            Math.round(((brandPrice - jaPrice) / brandPrice) * 100);

        const responseData = {
            brand_name: alternative.brand_name || medicine?.brand_name || medicine_id,
            generic_name: alternative.generic_name || medicine?.generic_name,
            brand_price: brandPrice,
            jan_aushadhi_price: jaPrice,
            savings_percentage: savingsPct,
            alternative_name:
                alternative.generic_name_display ||
                alternative.generic_name ||
                (medicine?.generic_name
                    ? `${medicine.generic_name} (Generic)`
                    : "Atorvastatin 10mg (Generic)"),
            nearest_store: nearestStore,
        };

        try {
            await redisClient.set(cacheKey, JSON.stringify(responseData), {
                EX: 86400,
            });

            logger.info(`Alternatives cache SET: ${cacheKey}`);
        } catch (err) {
            logger.warn("Redis cache write failed", { err });
        }

        res.status(200).json(responseData);
    } catch (error) {
        logger.error("Error in alternatives lookup", { error });
        res.status(500).json({ error: "Failed to fetch medicine alternatives" });
    }
});

export default router;
