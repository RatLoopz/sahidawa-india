import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../db/client';
import logger from '../utils/logger';

const router = Router();
const QuerySchema = z.object({
  days: z.coerce.number().min(1).default(30),
});

router.get('/heatmap', async (req: Request, res: Response) => {
  try {
    const { days } = QuerySchema.parse(req.query);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data: scans, error } = await supabase
      .from('scan_history')
      .select('latitude, longitude, created_at')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .gte('created_at', since);

    if (error) {
      logger.error({ message: 'Failed to fetch scan history for heatmap', error, days });
      res.status(500).json({ error: 'Failed to fetch heatmap data' });
      return;
    }

    const grouped = new Map<string, { lat: number; lng: number; intensity: number }>();
    for (const scan of scans || []) {
      const lat = Math.round(parseFloat(scan.latitude as string) * 100) / 100;
      const lng = Math.round(parseFloat(scan.longitude as string) * 100) / 100;
      const key = `${lat},${lng}`;
      const entry = grouped.get(key) || { lat, lng, intensity: 0 };
      entry.intensity++;
      grouped.set(key, entry);
    }

    const features = Array.from(grouped.values()).map((point) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [point.lng, point.lat],
      },
      properties: { intensity: point.intensity },
    }));

    const geoJson = {
      type: 'FeatureCollection',
      features,
    };

    res.json(geoJson);
  } catch (e) {
    if (e instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid query parameters', details: e.errors });
      return;
    }
    logger.error({ message: 'Unexpected error in analytics heatmap', error: e });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;