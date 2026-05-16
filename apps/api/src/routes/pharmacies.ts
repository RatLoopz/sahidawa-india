import { Router, Request, Response } from 'express';
import { z } from 'zod';

const router = Router();

const nearestQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

/**
 * GET /api/pharmacies/nearest?lat=...&lng=...
 * Returns 3 nearby Jan Aushadhi Kendra mock locations.
 */
router.get('/nearest', (req: Request, res: Response) => {
  const result = nearestQuerySchema.safeParse(req.query);

  if (!result.success) {
    res.status(400).json({
      error: 'Invalid coordinates',
      details: result.error.flatten().fieldErrors,
    });
    return;
  }

  const { lat, lng } = result.data;

  // Mock stores — 1° ≈ 111km offset formula (from issue hint)
  const mockStores = [
    {
      name: 'Jan Aushadhi Kendra - Station Road',
      address: '123 Station Rd, New Delhi',
      lat: parseFloat((lat + 0.01).toFixed(6)),
      lng: parseFloat((lng + 0.01).toFixed(6)),
      distance: '1.6 km',
    },
    {
      name: 'Jan Aushadhi Kendra - Market Square',
      address: '456 Market St, New Delhi',
      lat: parseFloat((lat - 0.02).toFixed(6)),
      lng: parseFloat((lng + 0.015).toFixed(6)),
      distance: '2.8 km',
    },
    {
      name: 'Jan Aushadhi Kendra - Park View',
      address: '789 Park Ave, New Delhi',
      lat: parseFloat((lat + 0.03).toFixed(6)),
      lng: parseFloat((lng - 0.01).toFixed(6)),
      distance: '3.5 km',
    },
  ];

  // TODO: Phase 2 — Replace mock with PostGIS ST_DWithin query:
  // SELECT name, address,
  //   ST_Y(location::geometry) AS lat,
  //   ST_X(location::geometry) AS lng,
  //   ST_Distance(location, ST_MakePoint($lng, $lat)::geography) / 1000 AS distance
  // FROM pharmacies
  // WHERE ST_DWithin(location, ST_MakePoint($lng, $lat)::geography, 5000)
  // ORDER BY distance
  // LIMIT 3;

  res.json({ pharmacies: mockStores });
});

export default router;
