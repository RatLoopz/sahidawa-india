import {
    createImageEnhancementPlan,
    enhanceImagePixels,
    WEBP_OUTPUT_QUALITY,
    WEBP_OUTPUT_TYPE,
} from "./imageEnhancer.shared";

let workerRequestSequence = 0;

function hasCanvasSupport(): boolean {
    if (typeof window === "undefined") {
        return false;
    }

    try {
        const doc =
            typeof globalThis !== "undefined" && globalThis.document
                ? globalThis.document
                : document;
        return !!doc.createElement("canvas");
    } catch {
        return false;
    }
}

async function processFullPipelineInWorker(
    file: File | Blob,
    worker: Worker
): Promise<Blob | File> {
    const requestId = `preprocess-${workerRequestSequence++}`;
    return new Promise((resolve, reject) => {
        const cleanUp = () => {
            worker.removeEventListener("message", handler);
            worker.removeEventListener("error", errHandler);
        };

        const handler = (event: MessageEvent) => {
            const data = event.data;
            if (data.id === requestId) {
                cleanUp();
                if (data.error) {
                    reject(new Error(data.error));
                } else if (data.fallback) {
                    reject(new Error("FALLBACK"));
                } else if (data.file) {
                    resolve(data.file);
                } else {
                    reject(new Error("Unknown worker response"));
                }
            }
        };

        const errHandler = (err: ErrorEvent) => {
            cleanUp();
            reject(err);
        };
        worker.addEventListener("message", handler);
        worker.addEventListener("error", errHandler);

        worker.postMessage({ id: requestId, file });
    });
}

async function enhancePixelsOffThread(
    pixels: Uint8ClampedArray,
    width: number,
    height: number,
    worker?: Worker | null
): Promise<Uint8ClampedArray> {
    const fallbackPixels = new Uint8ClampedArray(pixels);

    try {
        if (!worker) {
            return enhanceImagePixels(fallbackPixels, width, height);
        }

        const transferablePixels = new Uint8ClampedArray(pixels);
        const requestId = `image-enhancement-${workerRequestSequence++}`;

        return await new Promise<Uint8ClampedArray>((resolve, reject) => {
            const cleanUp = () => {
                worker.removeEventListener("message", handler);
                worker.removeEventListener("error", errHandler);
            };

            const handler = (event: MessageEvent) => {
                const data = event.data;
                if (data.id === requestId) {
                    cleanUp();
                    if (data.error) {
                        reject(new Error(data.error));
                    } else if (data.pixels) {
                        resolve(new Uint8ClampedArray(data.pixels));
                    } else {
                        reject(new Error("Empty pixels returned"));
                    }
                }
            };

            const errHandler = (err: ErrorEvent) => {
                cleanUp();
                reject(err);
            };
            worker.addEventListener("message", handler);
            worker.addEventListener("error", errHandler);
            worker.postMessage(
                {
                    id: requestId,
                    width,
                    height,
                    pixels: transferablePixels,
                },
                [transferablePixels.buffer]
            );
        });
    } catch (error) {
        console.warn(
            "Image enhancement worker failed. Falling back to synchronous processing.",
            error
        );
        return enhanceImagePixels(fallbackPixels, width, height);
    }
}

export async function preprocessMedicineImage(
    input: File | Blob | string,
    providedWorker?: Worker | null
): Promise<Blob | File | string> {
    if (!hasCanvasSupport()) {
        return input;
    }

    if (input instanceof File && !input.type.startsWith("image/")) {
        console.warn("Invalid file payload provided. Bypassing enhancement processor pipelines.");
        return input;
    }

    let workerToUse = providedWorker;
    let isTempWorker = false;

    if (typeof input !== "string" && typeof Worker !== "undefined") {
        try {
            if (!workerToUse) {
                workerToUse = new Worker(
                    new URL("./workers/imageEnhancer.worker.ts", import.meta.url)
                );
                isTempWorker = true;
            }
            const result = await processFullPipelineInWorker(input, workerToUse);
            if (isTempWorker) workerToUse.terminate();
            return result;
        } catch (err) {
            if (isTempWorker && workerToUse) workerToUse.terminate();
            if (err instanceof Error && err.message !== "FALLBACK") {
                console.warn("Full pipeline worker failed, falling back to main thread:", err);
            }
        }
    }

    const cleanup = () => {
        if (isTempWorker && workerToUse) {
            workerToUse.terminate();
        }
    };

    try {
        const result = await new Promise<Blob | File | string>((resolve, reject) => {
            try {
                const img = new Image();
                img.crossOrigin = "Anonymous";

                const isString = typeof input === "string";
                const url = isString ? input : URL.createObjectURL(input);
                const executionTimeoutTracker = setTimeout(() => {
                    img.onload = null;
                    img.onerror = null;
                    img.src = "";
                    if (!isString) {
                        URL.revokeObjectURL(url);
                    }
                    console.warn(
                        "Image payload ingestion timed out. Falling back to original resource stream."
                    );
                    resolve(input);
                }, 15000);

                img.onload = async () => {
                    clearTimeout(executionTimeoutTracker);

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

                    const doc =
                        typeof globalThis !== "undefined" && globalThis.document
                            ? globalThis.document
                            : document;
                    const canvas = doc.createElement("canvas");
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext("2d");

                    if (!ctx) {
                        if (!isString) {
                            URL.revokeObjectURL(url);
                        }
                        reject(new Error("Canvas 2D context initialization dropped."));
                        return;
                    }

                    ctx.drawImage(img, 0, 0, width, height);
                    if (!isString) {
                        URL.revokeObjectURL(url);
                    }

                    let sampledImageData: ImageData;
                    try {
                        sampledImageData = ctx.getImageData(0, 0, width, height);
                    } catch (error) {
                        console.warn(
                            "Canvas getImageData locked via cross-origin parameters. Gracefully bypassing manipulation step tracks.",
                            error
                        );
                        resolve(input);
                        return;
                    }

                    const plan = createImageEnhancementPlan(sampledImageData.data);

                    if (plan.filter !== "none") {
                        ctx.filter = plan.filter;
                        ctx.drawImage(img, 0, 0, width, height);
                        ctx.filter = "none";
                    }

                    if (plan.shouldRunWorker) {
                        try {
                            const filteredImageData = ctx.getImageData(0, 0, width, height);
                            const enhancedPixels = await enhancePixelsOffThread(
                                filteredImageData.data,
                                width,
                                height,
                                workerToUse
                            );

                            filteredImageData.data.set(enhancedPixels);
                            ctx.putImageData(filteredImageData, 0, 0);
                        } catch (error) {
                            console.warn(
                                "Image enhancement worker pipeline failed. Continuing with filtered canvas output.",
                                error
                            );
                        }
                    }

                    canvas.toBlob(
                        (blob) => {
                            if (blob) {
                                resolve(blob);
                            } else {
                                resolve(input);
                            }
                        },
                        WEBP_OUTPUT_TYPE,
                        WEBP_OUTPUT_QUALITY
                    );
                };

                img.onerror = () => {
                    clearTimeout(executionTimeoutTracker);
                    if (!isString) {
                        URL.revokeObjectURL(url);
                    }
                    console.warn(
                        "Source resource parsing failed. Dropping compression parameters."
                    );
                    resolve(input);
                };

                img.src = url;
            } catch (error) {
                console.error("Execution boundary loop exception caught:", error);
                resolve(input);
            }
        });
        return result;
    } catch (err) {
        console.error("Pipeline breakdown:", err);
        return input;
    } finally {
        cleanup();
    }
}
