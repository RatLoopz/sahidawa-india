import {
    MEDICINE_IMAGE_MAX_SIZE,
    MEDICINE_IMAGE_MIN_HEIGHT,
    MEDICINE_IMAGE_MIN_WIDTH,
    SUPPORTED_MEDICINE_IMAGE_TYPES,
    validateMedicineImage,
} from "@/lib/imageValidation";

describe("validateMedicineImage", () => {
    const originalImage = global.Image;
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;

    class MockImage {
        naturalWidth = MEDICINE_IMAGE_MIN_WIDTH;
        naturalHeight = MEDICINE_IMAGE_MIN_HEIGHT;

        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;

        set src(_value: string) {
            setTimeout(() => {
                this.onload?.();
            }, 0);
        }
    }

    beforeEach(() => {
        Object.defineProperty(global, "Image", {
            configurable: true,
            writable: true,
            value: MockImage,
        });

        Object.defineProperty(URL, "createObjectURL", {
            configurable: true,
            writable: true,
            value: jest.fn(() => "blob:medicine-image"),
        });

        Object.defineProperty(URL, "revokeObjectURL", {
            configurable: true,
            writable: true,
            value: jest.fn(),
        });
    });

    afterEach(() => {
        Object.defineProperty(global, "Image", {
            configurable: true,
            writable: true,
            value: originalImage,
        });

        Object.defineProperty(URL, "createObjectURL", {
            configurable: true,
            writable: true,
            value: originalCreateObjectURL,
        });

        Object.defineProperty(URL, "revokeObjectURL", {
            configurable: true,
            writable: true,
            value: originalRevokeObjectURL,
        });

        jest.restoreAllMocks();
    });

    it("accepts a valid JPEG image", async () => {
        const file = new File(["valid-image"], "medicine.jpg", {
            type: "image/jpeg",
        });

        const result = await validateMedicineImage(file);

        expect(result).toEqual({ valid: true });
    });

    it("accepts all configured supported image formats", () => {
        expect(SUPPORTED_MEDICINE_IMAGE_TYPES).toEqual(["image/jpeg", "image/png", "image/webp"]);
    });

    it("rejects unsupported image formats before reading dimensions", async () => {
        const file = new File(["image"], "medicine.gif", {
            type: "image/gif",
        });

        const result = await validateMedicineImage(file);

        expect(result).toEqual({
            valid: false,
            error: "Unsupported image format. Please upload a JPG, PNG, or WebP image.",
        });

        expect(URL.createObjectURL).not.toHaveBeenCalled();
    });

    it("rejects images larger than the maximum file size", async () => {
        const file = new File(["image"], "medicine.jpg", {
            type: "image/jpeg",
        });

        Object.defineProperty(file, "size", {
            configurable: true,
            value: MEDICINE_IMAGE_MAX_SIZE + 1,
        });

        const result = await validateMedicineImage(file);

        expect(result).toEqual({
            valid: false,
            error: "Image exceeds the 10MB file size limit.",
        });

        expect(URL.createObjectURL).not.toHaveBeenCalled();
    });

    it("rejects images below the minimum width", async () => {
        class LowWidthImage extends MockImage {
            naturalWidth = MEDICINE_IMAGE_MIN_WIDTH - 1;
            naturalHeight = MEDICINE_IMAGE_MIN_HEIGHT;
        }

        Object.defineProperty(global, "Image", {
            configurable: true,
            writable: true,
            value: LowWidthImage,
        });

        const file = new File(["image"], "medicine.png", {
            type: "image/png",
        });

        const result = await validateMedicineImage(file);

        expect(result).toEqual({
            valid: false,
            error: `Image resolution is too low. Please upload an image of at least ${MEDICINE_IMAGE_MIN_WIDTH}×${MEDICINE_IMAGE_MIN_HEIGHT} pixels.`,
        });
    });

    it("rejects images below the minimum height", async () => {
        class LowHeightImage extends MockImage {
            naturalWidth = MEDICINE_IMAGE_MIN_WIDTH;
            naturalHeight = MEDICINE_IMAGE_MIN_HEIGHT - 1;
        }

        Object.defineProperty(global, "Image", {
            configurable: true,
            writable: true,
            value: LowHeightImage,
        });

        const file = new File(["image"], "medicine.webp", {
            type: "image/webp",
        });

        const result = await validateMedicineImage(file);

        expect(result).toEqual({
            valid: false,
            error: `Image resolution is too low. Please upload an image of at least ${MEDICINE_IMAGE_MIN_WIDTH}×${MEDICINE_IMAGE_MIN_HEIGHT} pixels.`,
        });
    });

    it("returns a readable error when image dimensions cannot be loaded", async () => {
        class BrokenImage extends MockImage {
            set src(_value: string) {
                setTimeout(() => {
                    this.onerror?.();
                }, 0);
            }
        }

        Object.defineProperty(global, "Image", {
            configurable: true,
            writable: true,
            value: BrokenImage,
        });

        const file = new File(["broken"], "medicine.jpg", {
            type: "image/jpeg",
        });

        const result = await validateMedicineImage(file);

        expect(result).toEqual({
            valid: false,
            error: "Could not read this image. Please choose another image file.",
        });
    });

    it("revokes the temporary object URL after successful validation", async () => {
        const file = new File(["image"], "medicine.jpg", {
            type: "image/jpeg",
        });

        await validateMedicineImage(file);

        expect(URL.createObjectURL).toHaveBeenCalledWith(file);
        expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:medicine-image");
    });

    it("revokes the temporary object URL when image loading fails", async () => {
        class BrokenImage extends MockImage {
            set src(_value: string) {
                setTimeout(() => {
                    this.onerror?.();
                }, 0);
            }
        }

        Object.defineProperty(global, "Image", {
            configurable: true,
            writable: true,
            value: BrokenImage,
        });

        const file = new File(["broken"], "medicine.jpg", {
            type: "image/jpeg",
        });

        await validateMedicineImage(file);

        expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:medicine-image");
    });
});
