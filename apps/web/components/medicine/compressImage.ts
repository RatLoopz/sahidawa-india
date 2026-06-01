const COMPRESSION_THRESHOLD = 2 * 1024 * 1024;
const MAX_DIMENSION = 2048;
const OUTPUT_QUALITY = 0.8;

export async function compressImage(file: File): Promise<File> {
    if (file.size <= COMPRESSION_THRESHOLD) {
        return file;
    }

    const img = await createImageBitmap(file);

    let { width, height } = img;
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
        img.close();
        return file;
    }

    ctx.drawImage(img, 0, 0, width, height);
    img.close();

    const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/webp", OUTPUT_QUALITY)
    );

    if (!blob || blob.size >= file.size) {
        return file;
    }

    const extension = file.name.replace(/.*\./, "");
    const baseName = file.name.slice(0, -extension.length - 1);
    const name = `${baseName}.webp`;

    return new File([blob], name, { type: "image/webp" });
}
