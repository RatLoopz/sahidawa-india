import { Router, Request, Response, NextFunction } from "express";
import { anonSupabase } from "../db/supabase";
import logger from "../utils/logger";
import {
    assessUrgency,
    medicineQuerySchema,
    recommendSchema,
    retrieveRelevantMedicines,
    MEDICINE_RAG_DISCLAIMER,
    type MedicineMatch,
} from "../services/medicineRag.service";

const router = Router();

/** Maximum number of pharmacies returned alongside a recommendation. */
const MAX_PHARMACY_RESULTS = 5;

/** Pharmacy row as returned by the get_nearest_pharmacies RPC. */
interface PharmacyRpcResult {
    name: string;
    address: string;
    district: string | null;
    state: string | null;
    phone_number: string | null;
    is_verified: boolean;
    lat: number;
    lng: number;
    distance: number;
}

/** Formatted pharmacy object returned in triage responses. */
interface FormattedPharmacy {
    name: string;
    address: string;
    lat: number;
    lng: number;
    distance: string;
    phone_number: string | null;
    is_verified: boolean;
    district: string | null;
    state: string | null;
}

function formatPharmacy(p: PharmacyRpcResult): FormattedPharmacy {
    return {
        name: p.name || "Unknown Pharmacy",
        address: p.address || "Unknown Address",
        lat: p.lat,
        lng: p.lng,
        distance: `${Number(p.distance).toFixed(1)} km`,
        phone_number: p.phone_number || null,
        is_verified: p.is_verified ?? false,
        district: p.district || null,
        state: p.state || null,
    };
}

/**
 * Returns the nearest verified Jan Aushadhi pharmacies to a coordinate using
 * the existing PostGIS RPC. Resolves to an empty array on any error so the
 * recommendation can still return its medicine suggestions.
 */
async function findNearestPharmacies(
    lat: number,
    lng: number,
    radius: number
): Promise<FormattedPharmacy[]> {
    const { data, error } = await anonSupabase.rpc("get_nearest_pharmacies", {
        query_lat: lat,
        query_lng: lng,
        search_radius_km: radius,
    });

    if (error || !Array.isArray(data)) {
        logger.warn("get_nearest_pharmacies RPC unavailable for triage recommendation", {
            error: error?.message,
        });
        return [];
    }

    return (data as PharmacyRpcResult[]).map(formatPharmacy).slice(0, MAX_PHARMACY_RESULTS);
}

/**
 * @openapi
 * /api/triage/medicine-query:
 *   post:
 *     summary: Answer a medicine-related question via RAG
 *     description: >
 *       Retrieves the medicines most relevant to a free-text query using a
 *       pgvector semantic search over drug monographs, with a pg_trgm fuzzy
 *       fallback. Intended for voice/chat queries such as "fever and body ache".
 *     tags:
 *       - Triage
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [query]
 *             properties:
 *               query:
 *                 type: string
 *                 example: "paracetamol for fever"
 *               limit:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 20
 *                 default: 5
 *     responses:
 *       200:
 *         description: Relevant medicines and a safety disclaimer
 *       400:
 *         description: Invalid request body
 *       500:
 *         description: Server or database error
 */
router.post("/medicine-query", async (req: Request, res: Response, next: NextFunction) => {
    const parsed = medicineQuerySchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({
            error: "Invalid medicine query",
            details: parsed.error.flatten().fieldErrors,
        });
        return;
    }

    try {
        const { query, limit } = parsed.data;
        const medicines = await retrieveRelevantMedicines(query, limit);

        res.json({
            query,
            medicines,
            disclaimer: MEDICINE_RAG_DISCLAIMER,
        });
    } catch (err) {
        next(err);
    }
});

/**
 * @openapi
 * /api/triage/recommend:
 *   post:
 *     summary: Recommend medicines and nearby pharmacies for symptoms
 *     description: >
 *       Classifies urgency from the symptom description, retrieves relevant
 *       medicines from the monograph RAG index, and — when coordinates are
 *       supplied — returns the nearest Jan Aushadhi pharmacies that dispense
 *       generic medicines. If urgent-care keywords are detected the response
 *       advises seeking immediate medical attention.
 *     tags:
 *       - Triage
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [symptoms]
 *             properties:
 *               symptoms:
 *                 type: string
 *                 example: "fever and headache since morning"
 *               lat:
 *                 type: number
 *                 example: 28.6304
 *               lng:
 *                 type: number
 *                 example: 77.2177
 *               radius:
 *                 type: number
 *                 default: 50
 *               limit:
 *                 type: integer
 *                 default: 5
 *     responses:
 *       200:
 *         description: Urgency flag, recommended medicines, and nearby pharmacies
 *       400:
 *         description: Invalid request body
 *       500:
 *         description: Server or database error
 */
router.post("/recommend", async (req: Request, res: Response, next: NextFunction) => {
    const parsed = recommendSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({
            error: "Invalid recommendation request",
            details: parsed.error.flatten().fieldErrors,
        });
        return;
    }

    try {
        const { symptoms, lat, lng, radius, limit } = parsed.data;

        const urgency = assessUrgency(symptoms);
        const medicines: MedicineMatch[] = await retrieveRelevantMedicines(symptoms, limit);

        const pharmacies =
            lat !== undefined && lng !== undefined
                ? await findNearestPharmacies(lat, lng, radius)
                : [];

        res.json({
            symptoms,
            emergency: urgency.emergency,
            urgentKeywords: urgency.matched,
            medicines,
            pharmacies,
            disclaimer: urgency.emergency
                ? "These symptoms may need urgent medical attention. Please contact a doctor or emergency services immediately. " +
                  MEDICINE_RAG_DISCLAIMER
                : MEDICINE_RAG_DISCLAIMER,
        });
    } catch (err) {
        next(err);
    }
});

export default router;
