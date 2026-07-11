function clampChannel(value: number): number {
    return Math.min(255, Math.max(0, value));
}

function rgbToHsl(red: number, green: number, blue: number): [number, number, number] {
    const normalizedRed = red / 255;
    const normalizedGreen = green / 255;
    const normalizedBlue = blue / 255;
    const max = Math.max(normalizedRed, normalizedGreen, normalizedBlue);
    const min = Math.min(normalizedRed, normalizedGreen, normalizedBlue);
    const lightness = (max + min) / 2;

    if (max === min) {
        return [0, 0, lightness];
    }

    const delta = max - min;
    const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);

    let hue = 0;
    switch (max) {
        case normalizedRed:
            hue =
                (normalizedGreen - normalizedBlue) / delta +
                (normalizedGreen < normalizedBlue ? 6 : 0);
            break;
        case normalizedGreen:
            hue = (normalizedBlue - normalizedRed) / delta + 2;
            break;
        default:
            hue = (normalizedRed - normalizedGreen) / delta + 4;
            break;
    }

    return [hue / 6, saturation, lightness];
}

function hslToRgb(hue: number, saturation: number, lightness: number): [number, number, number] {
    if (saturation === 0) {
        const channel = lightness * 255;
        return [channel, channel, channel];
    }

    const q =
        lightness < 0.5
            ? lightness * (1 + saturation)
            : lightness + saturation - lightness * saturation;
    const p = 2 * lightness - q;
    const hueToChannel = (offset: number) => {
        let channelHue = offset;
        if (channelHue < 0) channelHue += 1;
        if (channelHue > 1) channelHue -= 1;
        if (channelHue < 1 / 6) return p + (q - p) * 6 * channelHue;
        if (channelHue < 1 / 2) return q;
        if (channelHue < 2 / 3) return p + (q - p) * (2 / 3 - channelHue) * 6;
        return p;
    };

    return [
        hueToChannel(hue + 1 / 3) * 255,
        hueToChannel(hue) * 255,
        hueToChannel(hue - 1 / 3) * 255,
    ];
}

function applySelectiveSaturation(pixels: Uint8ClampedArray): Uint8ClampedArray {
    const enhanced = new Uint8ClampedArray(pixels);

    for (let index = 0; index < enhanced.length; index += 4) {
        const [hue, saturation, lightness] = rgbToHsl(
            enhanced[index],
            enhanced[index + 1],
            enhanced[index + 2]
        );

        if (lightness <= 0.15 || lightness >= 0.85 || saturation <= 0.05) {
            continue;
        }

        const luminanceMask = 1 - Math.abs(lightness - 0.5) * 2;
        const nextSaturation = Math.min(
            1,
            Math.max(0, saturation + saturation * (1 - saturation) * 0.3 * luminanceMask)
        );
        const [red, green, blue] = hslToRgb(hue, nextSaturation, lightness);

        enhanced[index] = clampChannel(red);
        enhanced[index + 1] = clampChannel(green);
        enhanced[index + 2] = clampChannel(blue);
    }

    return enhanced;
}

function applyUnsharpMask(
    pixels: Uint8ClampedArray,
    width: number,
    height: number
): Uint8ClampedArray {
    if (width < 3 || height < 3) {
        return pixels;
    }

    const sharpened = new Uint8ClampedArray(pixels);

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const index = (y * width + x) * 4;

            for (let channel = 0; channel < 3; channel++) {
                const value =
                    3.0 * pixels[index + channel] -
                    0.5 * pixels[((y - 1) * width + x) * 4 + channel] -
                    0.5 * pixels[((y + 1) * width + x) * 4 + channel] -
                    0.5 * pixels[(y * width + (x - 1)) * 4 + channel] -
                    0.5 * pixels[(y * width + (x + 1)) * 4 + channel];

                sharpened[index + channel] = clampChannel(value);
            }
        }
    }

    return sharpened;
}

const SAMPLE_STRIDE = 16;
const PHOTO_CONTRAST_FILTER = 1.06;
const DARK_IMAGE_BRIGHTNESS_FILTER = 1.08;
const BRIGHT_IMAGE_BRIGHTNESS_FILTER = 0.94;

function createImageEnhancementPlan(pixels: Uint8ClampedArray): {
    filter: string;
    shouldRunWorker: boolean;
} {
    let extremeCount = 0;
    let sampleCount = 0;
    let sumLuminance = 0;

    for (let index = 0; index < pixels.length; index += SAMPLE_STRIDE) {
        const luminance =
            0.299 * pixels[index] + 0.587 * pixels[index + 1] + 0.114 * pixels[index + 2];

        sumLuminance += luminance;
        if (luminance < 15 || luminance > 240) {
            extremeCount++;
        }
        sampleCount++;
    }

    if (!sampleCount) {
        return {
            filter: "none",
            shouldRunWorker: false,
        };
    }

    const isDigitalGraphic = extremeCount / sampleCount > 0.1;
    if (isDigitalGraphic) {
        return {
            filter: "none",
            shouldRunWorker: false,
        };
    }

    const avgLuminance = sumLuminance / sampleCount;
    const filters = [`contrast(${PHOTO_CONTRAST_FILTER})`];

    if (avgLuminance < 100) {
        filters.push(`brightness(${DARK_IMAGE_BRIGHTNESS_FILTER})`);
    } else if (avgLuminance > 180) {
        filters.push(`brightness(${BRIGHT_IMAGE_BRIGHTNESS_FILTER})`);
    }

    return {
        filter: filters.join(" "),
        shouldRunWorker: true,
    };
}

const ctx: Worker = self as any;
ctx.onmessage = async (event: MessageEvent) => {
    const { id, pixels, width, height, file } = event.data;

    try {
        if (file) {
            if (
                typeof OffscreenCanvas === "undefined" ||
                typeof createImageBitmap === "undefined"
            ) {
                ctx.postMessage({ id, fallback: true });
                return;
            }

            const img = await createImageBitmap(file);
            let targetWidth = img.width;
            let targetHeight = img.height;
            const maxLongEdge = 1200;

            if (Math.max(targetWidth, targetHeight) > maxLongEdge) {
                if (targetWidth > targetHeight) {
                    targetHeight = Math.round((targetHeight * maxLongEdge) / targetWidth);
                    targetWidth = maxLongEdge;
                } else {
                    targetWidth = Math.round((targetWidth * maxLongEdge) / targetHeight);
                    targetHeight = maxLongEdge;
                }
            }

            const canvas = new OffscreenCanvas(targetWidth, targetHeight);
            const canvasContext = canvas.getContext("2d");
            if (!canvasContext)
                throw new Error("OffscreenCanvas 2D context initialization failed.");

            canvasContext.drawImage(img, 0, 0, targetWidth, targetHeight);

            let sampledImageData: ImageData;
            try {
                sampledImageData = canvasContext.getImageData(0, 0, targetWidth, targetHeight);
            } catch {
                const blob = await canvas.convertToBlob({ type: "image/webp", quality: 0.8 });
                ctx.postMessage({ id, file: blob });
                return;
            }

            const plan = createImageEnhancementPlan(sampledImageData.data);

            if (plan.filter !== "none") {
                canvasContext.filter = plan.filter;
                canvasContext.drawImage(img, 0, 0, targetWidth, targetHeight);
                canvasContext.filter = "none";
            }

            if (plan.shouldRunWorker) {
                const filteredImageData = canvasContext.getImageData(
                    0,
                    0,
                    targetWidth,
                    targetHeight
                );
                const enhancedPixels = applyUnsharpMask(
                    applySelectiveSaturation(filteredImageData.data),
                    targetWidth,
                    targetHeight
                );
                filteredImageData.data.set(enhancedPixels);
                canvasContext.putImageData(filteredImageData, 0, 0);
            }

            const outBlob = await canvas.convertToBlob({ type: "image/webp", quality: 0.8 });
            ctx.postMessage({ id, file: outBlob });
        } else if (pixels) {
            const enhancedPixels = applyUnsharpMask(
                applySelectiveSaturation(pixels),
                width,
                height
            );
            ctx.postMessage({ id, pixels: enhancedPixels }, [enhancedPixels.buffer]);
        }
    } catch (error: any) {
        ctx.postMessage({
            id,
            error: error instanceof Error ? error.message : "Image enhancement worker failed.",
        });
    }
};
