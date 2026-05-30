export type ValidationResult =
  | { valid: true }
  | { valid: false; error: string };

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Pure function that validates a File before upload.
 * Checks MIME type and file size — no side effects, no I/O.
 */
export function validateMedicineFile(file: File): ValidationResult {
  if (!ALLOWED_TYPES.has(file.type)) {
    return {
      valid: false,
      error: "Only JPG, PNG, and WebP images are supported.",
    };
  }

  if (file.size > MAX_SIZE_BYTES) {
    return {
      valid: false,
      error: `File is too large. Maximum size is 5 MB (your file: ${(file.size / 1024 / 1024).toFixed(1)} MB).`,
    };
  }

  return { valid: true };
}
