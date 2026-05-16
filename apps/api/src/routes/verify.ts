import { Router, Request, Response } from 'express';
import { z } from 'zod';

const router = Router();

/**
 * Mock medicine database keyed by batch number.
 * TODO: Replace with real Supabase DB lookup in Phase 1 (see db/schema.sql — medicines table).
 */
const MOCK_MEDICINES: Record<
  string,
  { name: string; expiry: string; manufacturer: string }
> = {
  'BATCH-CIPLA-001': {
    name: 'Azithromycin 500mg',
    expiry: '2026-12-31',
    manufacturer: 'Cipla Ltd.',
  },
  'BATCH-SUN-002': {
    name: 'Paracetamol 650mg',
    expiry: '2027-03-15',
    manufacturer: 'Sun Pharmaceuticals',
  },
  'BATCH-DR-003': {
    name: 'Metformin 500mg',
    expiry: '2026-08-20',
    manufacturer: "Dr. Reddy's Laboratories",
  },
  'BATCH-AMAN-004': {
    name: 'Amoxicillin 250mg',
    expiry: '2025-11-30',
    manufacturer: 'Mankind Pharma',
  },
};

/**
 * Zod schema for the POST /verify request body.
 * batchNumber must be a non-empty string with at least 3 characters.
 */
const verifySchema = z.object({
  batchNumber: z
    .string({ message: 'batchNumber is required and must be a string' })
    .min(3, 'batchNumber must be at least 3 characters long'),
});

/**
 * POST /api/verify
 *
 * Verifies if a medicine batch number is authentic.
 *
 * @body  { batchNumber: string }
 * @returns 200  { verified: true,  medicine: { name, expiry, manufacturer } }
 * @returns 404  { verified: false, message: "Medicine not found" }
 * @returns 400  { error: string, details: ZodIssue[] }
 */
router.post('/', (req: Request, res: Response) => {
  // --- Input validation ---
  const parsed = verifySchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid request body',
      details: parsed.error.issues,
    });
    return;
  }

  const { batchNumber } = parsed.data;

  // --- Mock DB lookup ---
  const medicine = MOCK_MEDICINES[batchNumber.toUpperCase()] ?? MOCK_MEDICINES[batchNumber];

  if (!medicine) {
    res.status(404).json({
      verified: false,
      message: 'Medicine not found',
    });
    return;
  }

  // --- Success ---
  res.status(200).json({
    verified: true,
    medicine,
  });
});

export default router;
