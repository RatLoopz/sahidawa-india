/**
 * Adaptive client-side data hygiene and image enhancement feature for sahidawa-india
 */

export async function preprocessMedicineImage(
    input: File | Blob | string
): Promise<Blob | File | string> {
    // 1. Safe Guard for Server-Side Rendering (SSR) environment executions
    if (
        typeof window === "undefined" ||
        !(() => {
            try {
                return !!document.createElement("canvas");
            } catch {
                return false;
            }
        })()
    ) {
        return input;
    }

    // 2. Input MIME Type and Instance Structural Verification Guardrail
    if (input instanceof File && !input.type.startsWith("image/")) {
        console.warn("Invalid file payload provided. Bypassing enhancement processor pipelines.");
        return input;
    }

    return new Promise((resolve, reject) => {
        try {
            const img = new Image();
            img.crossOrigin = "Anonymous";

            const isString = typeof input === "string";
            const url = isString ? input : URL.createObjectURL(input);

            // Preserve absolute incoming MIME structure to guard alpha channels / transparency
            const outputMimeType = input instanceof File ? input.type : "image/jpeg";

            // 3. Image Network Loading Timeout Engine Protection Guard (15 Second Limit)
            const executionTimeoutTracker = setTimeout(() => {
                img.onload = null;
                img.onerror = null;
                if (!isString) URL.revokeObjectURL(url);
                console.warn(
                    "Image payload ingestion timed out. Falling back to original resource stream."
                );
                resolve(input);
            }, 15000);

            img.onload = () => {
                clearTimeout(executionTimeoutTracker);

                // 4. Resolution Bounds & Performance Downscaling
                let width = img.width;
                let height = img.height;
                const maxLongEdge = 1200;

                if (Math.max(width, height) > maxLongEdge) {
                    if (width > height) {
                        height = Math.round((height * maxLongEdge) / width);
                        width = maxLongEdge;
                    } else {
                        width = Math.round((width * maxLongEdge) / height);
                        height = maxLongEdge;
                    }
                }

                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");

                if (!ctx) {
                    if (!isString) URL.revokeObjectURL(url);
                    return reject(new Error("Canvas 2D context context initialization dropped."));
                }

                // Draw standard clean buffer layout onto canvas plane
                ctx.drawImage(img, 0, 0, width, height);
                if (!isString) URL.revokeObjectURL(url);

                let imageData: ImageData;
                try {
                    imageData = ctx.getImageData(0, 0, width, height);
                } catch (error) {
                    console.warn(
                        "Canvas getImageData locked via cross-origin parameters. Gracefully bypassing manipulation step tracks.",
                        error
                    );
                    return resolve(input);
                }

                const data = imageData.data;

                // 5. Context Aware Texture Complexity Parsing Check (Digital Graphic Filter Gate)
                let extremeCount = 0;
                let sampleCount = 0;
                let sumLuminance = 0;

                for (let i = 0; i < data.length; i += 16) {
                    const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                    sumLuminance += l;
                    if (l < 15 || l > 240) {
                        extremeCount++;
                    }
                    sampleCount++;
                }

                const isDigitalGraphic = extremeCount / sampleCount > 0.1;
                const avgLuminance = sumLuminance / sampleCount;

                // 6. Unified Mathematical Adaptation Pipeline (Optimized for Mobile Performance)
                if (!isDigitalGraphic) {
                    // Dynamic Gamma Tuning
                    let gamma = 1.0;
                    if (avgLuminance < 100) {
                        gamma = 0.8; // Gently brighten underexposed images
                    } else if (avgLuminance > 180) {
                        gamma = 1.15; // Gently darken overexposed glare
                    }

                    // Mild Contrast Curve Parameters
                    const contrast = 12;
                    const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));

                    const clamp = (val: number) => Math.min(255, Math.max(0, val));

                    // Color Space Helpers
                    const rgbToHsl = (r: number, g: number, b: number) => {
                        r /= 255;
                        g /= 255;
                        b /= 255;
                        const max = Math.max(r, g, b),
                            min = Math.min(r, g, b);
                        let h = 0,
                            s = 0,
                            l = (max + min) / 2;
                        if (max !== min) {
                            const d = max - min;
                            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
                            switch (max) {
                                case r:
                                    h = (g - b) / d + (g < b ? 6 : 0);
                                    break;
                                case g:
                                    h = (b - r) / d + 2;
                                    break;
                                case b:
                                    h = (r - g) / d + 4;
                                    break;
                            }
                            h /= 6;
                        }
                        return [h, s, l];
                    };

                    const hslToRgb = (h: number, s: number, l: number) => {
                        let r, g, b;
                        if (s === 0) {
                            r = g = b = l;
                        } else {
                            const hue2rgb = (p: number, q: number, t: number) => {
                                if (t < 0) t += 1;
                                if (t > 1) t -= 1;
                                if (t < 1 / 6) return p + (q - p) * 6 * t;
                                if (t < 1 / 2) return q;
                                if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                                return p;
                            };
                            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
                            const p = 2 * l - q;
                            r = hue2rgb(p, q, h + 1 / 3);
                            g = hue2rgb(p, q, h);
                            b = hue2rgb(p, q, h - 1 / 3);
                        }
                        return [r * 255, g * 255, b * 255];
                    };

                    // Single-Pass Pixel Loop for Gamma, Contrast, and Smart Saturation
                    for (let i = 0; i < data.length; i += 4) {
                        let r = data[i],
                            g = data[i + 1],
                            b = data[i + 2];

                        // A. Gamma Correction
                        if (gamma !== 1.0) {
                            r = 255 * Math.pow(r / 255, gamma);
                            g = 255 * Math.pow(g / 255, gamma);
                            b = 255 * Math.pow(b / 255, gamma);
                        }

                        // B. Mild Contrast Application
                        r = clamp(contrastFactor * (r - 128) + 128);
                        g = clamp(contrastFactor * (g - 128) + 128);
                        b = clamp(contrastFactor * (b - 128) + 128);

                        // C. Smart Saturation (Luminance Masked to prevent neon noise artifacts)
                        const [h, s, l] = rgbToHsl(r, g, b);

                        // Protect dark shadows (<0.15), bright glares (>0.85), and true grays (s<0.05)
                        if (l > 0.15 && l < 0.85 && s > 0.05) {
                            // The mask peaks at 1.0 for mid-tones and drops to 0 at the boundaries
                            const lumMask = 1.0 - Math.abs(l - 0.5) * 2.0;
                            let newS = s + s * (1.0 - s) * 0.3 * lumMask;
                            newS = Math.min(1.0, Math.max(0.0, newS));

                            const [nR, nG, nB] = hslToRgb(h, newS, l);
                            r = nR;
                            g = nG;
                            b = nB;
                        }

                        data[i] = r;
                        data[i + 1] = g;
                        data[i + 2] = b;
                    }
                }

                ctx.putImageData(imageData, 0, 0);
                let finalCanvasToBlob = canvas;

                // 7. Sharpness Optimization Segment: Softened Unsharp Mask
                if (!isDigitalGraphic) {
                    const sharpCanvas = document.createElement("canvas");
                    sharpCanvas.width = width;
                    sharpCanvas.height = height;
                    const sharpCtx = sharpCanvas.getContext("2d")!;
                    sharpCtx.drawImage(canvas, 0, 0);

                    const sourceData = sharpCtx.getImageData(0, 0, width, height);
                    const destData = sharpCtx.createImageData(width, height);

                    const src = sourceData.data;
                    const dst = destData.data;
                    const w = width;
                    const h = height;

                    // Safe, dampened sharpening kernel to boost text without crunching boundaries
                    for (let y = 1; y < h - 1; y++) {
                        for (let x = 1; x < w - 1; x++) {
                            const idx = (y * w + x) * 4;
                            for (let c = 0; c < 3; c++) {
                                const val =
                                    3.0 * src[idx + c] -
                                    0.5 * src[((y - 1) * w + x) * 4 + c] -
                                    0.5 * src[((y + 1) * w + x) * 4 + c] -
                                    0.5 * src[(y * w + (x - 1)) * 4 + c] -
                                    0.5 * src[(y * w + (x + 1)) * 4 + c];
                                dst[idx + c] = Math.min(255, Math.max(0, val));
                            }
                            dst[idx + 3] = src[idx + 3]; // Preserve alpha
                        }
                    }

                    // Frame Boundary Padding Sync
                    for (let y = 0; y < h; y++) {
                        for (let x = 0; x < w; x++) {
                            if (y === 0 || y === h - 1 || x === 0 || x === w - 1) {
                                const idx = (y * w + x) * 4;
                                dst[idx] = src[idx];
                                dst[idx + 1] = src[idx + 1];
                                dst[idx + 2] = src[idx + 2];
                                dst[idx + 3] = src[idx + 3];
                            }
                        }
                    }
                    sharpCtx.putImageData(destData, 0, 0);
                    finalCanvasToBlob = sharpCanvas;
                }

                // 8. Output Serialization
                finalCanvasToBlob.toBlob(
                    (blob) => {
                        if (blob) {
                            resolve(blob);
                        } else {
                            resolve(input);
                        }
                    },
                    outputMimeType,
                    outputMimeType === "image/png" ? undefined : 0.8
                );
            };

            img.onerror = () => {
                clearTimeout(executionTimeoutTracker);
                if (!isString) URL.revokeObjectURL(url);
                console.warn("Source resource parsing failed. Dropping compression parameters.");
                resolve(input);
            };

            img.src = url;
        } catch (error) {
            console.error("Execution boundary loop exception caught:", error);
            resolve(input);
        }
    });
}
