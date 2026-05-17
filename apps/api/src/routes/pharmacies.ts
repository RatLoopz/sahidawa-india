import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import supabase from '../db/supabase';

const router = Router();

const nearestQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

// Haversine formula fallback
function calculateDistanceKM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * GET /api/pharmacies/nearest?lat=...&lng=...
 * Returns up to 3 nearby Jan Aushadhi Kendras.
 */
router.get('/nearest', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = nearestQuerySchema.safeParse(req.query);

    if (!result.success) {
      res.status(400).json({
        error: 'Invalid coordinates',
        details: result.error.flatten().fieldErrors,
      });
      return;
    }

    const { lat, lng } = result.data;

    // 1. Validate environment configuration
    // This provides a clear API response if developers forgot to setup their .env file
    const hasSupabaseUrl = !!process.env.SUPABASE_URL;
    const hasSupabaseKey = !!(process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);

    if (!hasSupabaseUrl || !hasSupabaseKey) {
      console.error('❌ Configuration Error: Missing Supabase credentials in /nearest route.');
      return res.status(500).json({
        error: 'Server Configuration Error',
        message: 'The backend is missing database credentials.',
        hint: 'Please ensure SUPABASE_URL and SUPABASE_ANON_KEY are set in your root .env file.',
        missing_vars: {
          SUPABASE_URL: !hasSupabaseUrl,
          SUPABASE_KEY: !hasSupabaseKey
        }
      });
    }

    // Call the PostGIS RPC function via Supabase
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_nearest_pharmacies', {
      query_lat: lat,
      query_lng: lng,
    });

    if (!rpcError && rpcData) {
      // Map response to match expected format ("1.6 km")
      const pharmacies = rpcData.map((p: any) => ({
        name: p.name,
        address: p.address,
        lat: p.lat,
        lng: p.lng,
        distance: `${Number(p.distance).toFixed(1)} km`,
      }));

      return res.json({ pharmacies });
    }

    console.warn('⚠️ PostGIS RPC failed or unavailable, falling back to Haversine calculation.', rpcError?.message);

    // Fallback: PostGIS might not be configured, or the RPC migration is unapplied.
    // We attempt to fetch all pharmacies and calculate in memory.
    const { data: allPharmacies, error: fetchError } = await supabase
      .from('pharmacies')
      .select('*');

    if (fetchError) {
      console.error('❌ Fallback database query failed. Details:', fetchError);

      const errMsg = fetchError.message?.toLowerCase() || '';
      let hint = 'Check your SUPABASE_URL and ensure your database is running.';

      // Provide developer-friendly hints based on the error type
      if (errMsg.includes('api key') || errMsg.includes('jwt')) {
        hint = 'Your Supabase API key is invalid or expired. Check your .env setup.';
      } else if (errMsg.includes('relation "public.pharmacies" does not exist') || fetchError.code === '42P01') {
        hint = 'The "pharmacies" table is missing. Did you forget to run the Supabase migrations/seeds?';
      }

      res.status(500).json({
        error: 'Database Query Failed',
        details: fetchError.message,
        code: fetchError.code || 'UNKNOWN',
        hint
      });
      return;
    }

    // Attempt to extract lat/lng and compute distance
    const computedPharmacies = (allPharmacies || [])
      .map((p: any) => {
        let pLat = 0;
        let pLng = 0;

        if (p.lat !== undefined && p.lng !== undefined) {
          // Backward compatibility if developers bypassed the PostGIS 'location' column directly
          pLat = Number(p.lat);
          pLng = Number(p.lng);
        } else if (p.location && typeof p.location === 'object' && p.location.coordinates) {
          // If it resolves as a GeoJSON Point object (standard in some query conversions)
          pLng = Number(p.location.coordinates[0]);
          pLat = Number(p.location.coordinates[1]);
        }

        // Extremely distant fallback (this prevents crashing if coordinates fail to parse)
        const distanceKm = calculateDistanceKM(lat, lng, pLat, pLng);

        return {
          name: p.name || 'Unknown Pharmacy',
          address: p.address || 'Unknown Address',
          lat: pLat,
          lng: pLng,
          rawDistance: distanceKm,
          distance: `${distanceKm.toFixed(1)} km`,
        };
      })
      .filter((p) => p.lat !== 0 && p.lng !== 0) // Strip invalid parses
      .sort((a, b) => a.rawDistance - b.rawDistance)
      .slice(0, 3); // Take top 3 closest

    // Strip internal sorting field to preserve API contract exactly
    const formattedPharmacies = computedPharmacies.map(p => {
      const { rawDistance, ...rest } = p;
      return rest;
    });

    res.json({ pharmacies: formattedPharmacies });

  } catch (err) {
    next(err);
  }
});

export default router;
