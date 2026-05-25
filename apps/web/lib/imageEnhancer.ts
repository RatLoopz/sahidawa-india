import {
    createImageEnhancementPlan,
    enhanceImagePixels,
    WEBP_OUTPUT_QUALITY,
    WEBP_OUTPUT_TYPE,
    type ImageEnhancementResponse,
} from "./imageEnhancer.shared";

type PendingWorkerRequest = {
    resolve: (pixels: Uint8ClampedArray) => void;
    reject: (error: Error) => void;
};

let enhancementWorker: Worker | null = null;
let workerRequestSequence = 0;
const pendingWorkerRequests = new Map<string, PendingWorkerRequest>();

function hasCanvasSupport(): boolean {
    if (typeof window === "undefined") {
        return false;
    }

    try {
        return !!document.createElement("canvas");
    } catch {
        return false;
    }
}

function resetWorker() {
    enhancementWorker?.terminate();
    enhancementWorker = null;
    pendingWorkerRequests.clear();
}

function ensureEnhancementWorker(): Worker | null {
    if (typeof Worker === "undefined") {
        return null;
    }

    if (enhancementWorker) {
        return enhancementWorker;
    }

    const worker = new Worker("/workers/imageEnhancer.worker.js");

    worker.onmessage = (event: MessageEvent<ImageEnhancementResponse>) => {
        const { id, pixels, error } = event.data;
        const pendingRequest = pendingWorkerRequests.get(id);
        if (!pendingRequest) {
            return;
        }

        pendingWorkerRequests.delete(id);

        if (error) {
            pendingRequest.reject(new Error(error));
            return;
        }

        if (!pixels) {
            pendingRequest.reject(new Error("Image enhancement worker returned no pixel buffer."));
            return;
        }

        pendingRequest.resolve(new Uint8ClampedArray(pixels));
    };

    worker.onerror = () => {
        for (const pendingRequest of pendingWorkerRequests.values()) {
            pendingRequest.reject(new Error("Image enhancement worker crashed."));
        }
        resetWorker();
    };

    enhancementWorker = worker;
    return worker;
}

async function enhancePixelsOffThread(
    pixels: Uint8ClampedArray,
    width: number,
    height: number
): Promise<Uint8ClampedArray> {
    const fallbackPixels = new Uint8ClampedArray(pixels);

    try {
        const worker = ensureEnhancementWorker();
        if (!worker) {
            return enhanceImagePixels(fallbackPixels, width, height);
        }

        const transferablePixels = new Uint8ClampedArray(pixels);
        const requestId = `image-enhancement-${workerRequestSequence++}`;

        return await new Promise<Uint8ClampedArray>((resolve, reject) => {
            pendingWorkerRequests.set(requestId, { resolve, reject });

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
    input: File | Blob | string
): Promise<Blob | File | string> {
    if (!hasCanvasSupport()) {
        return input;
    }

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
            const executionTimeoutTracker = setTimeout(() => {
                img.onload = null;
                img.onerror = null;
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

                const canvas = document.createElement("canvas");
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
                            height
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
