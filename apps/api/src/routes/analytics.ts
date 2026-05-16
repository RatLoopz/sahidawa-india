// @ts-ignore
import { Router } from 'express';
import { z } from 'zod';

const router = Router();
const QuerySchema = z.object({
  days: z.coerce.number().min(1).default(30),
});

router.get('/heatmap', async (req, res) => {
  try {
    const { days } = QuerySchema.parse(req.query);
    // Placeholder for actual DB data
    const mockData = [{ lat: 21.25, lng: 81.63, created_at: new Date().toISOString() }];

    const geoJson = {
      type: "FeatureCollection",
      features: mockData.map(d => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [d.lng, d.lat] },
        properties: { intensity: 1 }
      }))
    };
    res.json(geoJson);
  } catch (e) {
    res.status(400).json({ error: "Invalid query" });
  }
});

export default router;