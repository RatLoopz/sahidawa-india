import { z } from "zod";

export const VALID_MEDICINE_STATUSES = ["safe", "suspicious", "recalled", "pending_review"] as const;

export const medicineStatusSchema = z.object({
  status: z.enum(VALID_MEDICINE_STATUSES),
});

export const medicineUpdateSchema = z.object({
  status: z.enum(VALID_MEDICINE_STATUSES).optional(),
  is_counterfeit_alert: z.boolean().optional(),
});

export function validateMedicineStatus(status: string): status is (typeof VALID_MEDICINE_STATUSES)[number] {
  return VALID_MEDICINE_STATUSES.includes(status as any);
}

export function getValidStatusList(): string {
  return VALID_MEDICINE_STATUSES.join(", ");
}
