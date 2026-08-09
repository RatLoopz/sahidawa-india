export const MEDICINE_IMAGE_MAX_SIZE = 10 * 1024 * 1024; // 10 MB
export const MEDICINE_IMAGE_MIN_WIDTH = 1;
export const MEDICINE_IMAGE_MIN_HEIGHT = 1;

export const SUPPORTED_MEDICINE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type ImageValidationResult = { valid: true } | { valid: false; error: string };

function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
        const objectUrl = URL.createObjectURL(file);
        const image = new Image();

        image.onload = () => {
            const dimensions = {
                width: image.naturalWidth,
                height: image.naturalHeight,
            };

            URL.revokeObjectURL(objectUrl);
            resolve(dimensions);
        };

        image.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error("Unable to read image dimensions"));
        };

        image.src = objectUrl;
    });
}

export async function validateMedicineImage(file: File): Promise<ImageValidationResult> {
    if (
        !SUPPORTED_MEDICINE_IMAGE_TYPES.includes(
            file.type as (typeof SUPPORTED_MEDICINE_IMAGE_TYPES)[number]
        )
    ) {
        return {
            valid: false,
            error: "Unsupported image format. Please upload a JPG, PNG, or WebP image.",
        };
    }

    if (file.size > MEDICINE_IMAGE_MAX_SIZE) {
        return {
            valid: false,
            error: "Image exceeds the 10MB file size limit.",
        };
    }

    try {
        const { width, height } = await getImageDimensions(file);

        if (width < MEDICINE_IMAGE_MIN_WIDTH || height < MEDICINE_IMAGE_MIN_HEIGHT) {
            return {
                valid: false,
                error: `Image resolution is too low. Please upload an image of at least ${MEDICINE_IMAGE_MIN_WIDTH}×${MEDICINE_IMAGE_MIN_HEIGHT} pixels.`,
            };
        }
    } catch {
        return {
            valid: false,
            error: "Could not read this image. Please choose another image file.",
        };
    }

    return { valid: true };
}
