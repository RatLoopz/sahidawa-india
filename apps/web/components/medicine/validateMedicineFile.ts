export type ValidationResult = { valid: true } | { valid: false; error: string };

export const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const ALLOWED_TYPES_SET = new Set<string>(ALLOWED_MIME_TYPES);
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Pure function that validates a File before upload.
 * Checks MIME type and file size — no side effects, no I/O.
 */
export function validateMedicineFile(file: File): ValidationResult {
    if (!ALLOWED_TYPES_SET.has(file.type)) {
        return {
            valid: false,
            error: "Only JPG, PNG, and WebP images are supported.",
        };
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
        return {
            valid: false,
            error: `File is too large. Maximum size is ${MAX_IMAGE_SIZE_BYTES / 1024 / 1024} MB (your file: ${(file.size / 1024 / 1024).toFixed(1)} MB).`,
        };
    }

    return { valid: true };
}
