const NETWORK_PROFILES = {
    "4g": { maxSizeMB: 1.0, maxDimension: 1920 },
    "3g": { maxSizeMB: 0.5, maxDimension: 1280 },
    "2g": { maxSizeMB: 0.2, maxDimension: 800 },
    "slow-2g": { maxSizeMB: 0.2, maxDimension: 800 },
    default: { maxSizeMB: 1.0, maxDimension: 1920 },
} as const;

const OUTPUT_QUALITY = 0.8;

function getCompressionProfile(): { maxSizeMB: number; maxDimension: number } {
    const connection =
        (navigator as unknown as { connection?: { effectiveType?: string } }).connection ??
        (navigator as unknown as { mozConnection?: { effectiveType?: string } }).mozConnection ??
        (navigator as unknown as { webkitConnection?: { effectiveType?: string } })
            .webkitConnection ??
        null;

    const effectiveType = connection?.effectiveType ?? "default";
    return (
        NETWORK_PROFILES[effectiveType as keyof typeof NETWORK_PROFILES] ?? NETWORK_PROFILES.default
    );
}

export async function compressImage(
    file: File,
    onProgress?: (progress: number) => void
): Promise<File> {
    const { maxSizeMB, maxDimension } = getCompressionProfile();
    const threshold = maxSizeMB * 1024 * 1024;

    if (file.size <= threshold) {
        onProgress?.(100);
        return file;
    }

    onProgress?.(10);

    const img = await createImageBitmap(file);
    let { width, height } = img;

    if (width > maxDimension || height > maxDimension) {
        const ratio = Math.min(maxDimension / width, maxDimension / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
    }

    onProgress?.(40);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
        img.close();
        onProgress?.(100);
        return file;
    }

    ctx.drawImage(img, 0, 0, width, height);
    img.close();

    onProgress?.(70);

    const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/webp", OUTPUT_QUALITY)
    );

    onProgress?.(90);

    if (!blob || blob.size >= file.size) {
        onProgress?.(100);
        return file;
    }

    const extension = file.name.replace(/.*\./, "");
    const baseName = file.name.slice(0, -extension.length - 1);
    const name = `${baseName}.webp`;

    onProgress?.(100);
    return new File([blob], name, { type: "image/webp" });
}
