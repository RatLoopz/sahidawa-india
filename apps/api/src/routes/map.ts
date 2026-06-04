import { Router, Request, Response } from 'express';
import { supabase } from '../db/client';

const router = Router();

// GET /api/map/nearby?lat=18.52&lng=73.85&radius_km=10
router.get('/nearby', async (req: Request, res: Response) => {
  const lat = parseFloat(req.query.lat as string);
  const lng = parseFloat(req.query.lng as string);
  const radius_km = parseFloat((req.query.radius_km as string) || '10');

  if (isNaN(lat) || isNaN(lng)) {
    return res.status(400).json({ error: 'lat and lng are required query params' });
  }

  try {
    const [pharmaciesRes, ashaRes] = await Promise.all([
      supabase.rpc('get_nearby_pharmacies', { user_lat: lat, user_lng: lng, radius_m: radius_km * 1000 }),
      supabase.rpc('get_nearby_asha_workers', { user_lat: lat, user_lng: lng, radius_m: radius_km * 1000 }),
    ]);

    if (pharmaciesRes.error) throw pharmaciesRes.error;
    if (ashaRes.error) throw ashaRes.error;

    res.json({
      pharmacies: pharmaciesRes.data,
      asha_workers: ashaRes.data,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;