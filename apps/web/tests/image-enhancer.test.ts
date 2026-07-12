import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import { preprocessMedicineImage } from "../lib/imageEnhancer";

type CanvasMock = {
    width: number;
    height: number;
    drawFilters: string[];
    context: {
        filter: string;
        drawImage: jest.Mock;
        getImageData: jest.Mock;
        putImageData: jest.Mock;
        createImageData: jest.Mock;
    };
    toBlob: jest.Mock;
};

function createPixelBuffer(values: number[]): Uint8ClampedArray {
    return new Uint8ClampedArray(values);
}

function createCanvas(
    imageData: Uint8ClampedArray,
    toBlobCalls: Array<[string, number | undefined]>
) {
    const context = {
        filter: "none",
        drawImage: jest.fn(),
        getImageData: jest.fn(() => ({
            data: new Uint8ClampedArray(imageData),
            width: 2,
            height: 2,
        })),
        putImageData: jest.fn(),
        createImageData: jest.fn((width: number, height: number) => ({
            data: new Uint8ClampedArray(width * height * 4),
            width,
            height,
        })),
    };

    const canvas: CanvasMock = {
        width: 0,
        height: 0,
        drawFilters: [],
        context,
        toBlob: jest.fn(
            (callback: (blob: Blob | null) => void, type?: string, quality?: number) => {
                toBlobCalls.push([type ?? "", quality]);
                callback(new Blob(["optimized"], { type: type ?? "image/webp" }));
            }
        ),
    };

    return canvas;
}

describe("preprocessMedicineImage", () => {
    const realWindow = globalThis.window;
    const realDocument = globalThis.document;
    const realImage = globalThis.Image;
    const realWorker = globalThis.Worker;
    const realCreateObjectURL = URL.createObjectURL;
    const realRevokeObjectURL = URL.revokeObjectURL;

    beforeEach(() => {
        jest.restoreAllMocks();
    });

    afterEach(() => {
        globalThis.window = realWindow;
        globalThis.document = realDocument;
        globalThis.Image = realImage;
        globalThis.Worker = realWorker;
        URL.createObjectURL = realCreateObjectURL;
        URL.revokeObjectURL = realRevokeObjectURL;
    });

    it("offloads photo enhancement to a worker, uses canvas filters, and serializes as WebP", async () => {
        const toBlobCalls: Array<[string, number | undefined]> = [];
        const imagePixels = createPixelBuffer([
            40, 42, 44, 255, 70, 72, 74, 255, 110, 112, 114, 255, 150, 152, 154, 255,
        ]);
        const canvases: CanvasMock[] = [];
        const workerInstances: Array<{ postMessage: jest.Mock }> = [];

        globalThis.window = {} as Window & typeof globalThis;

        jest.spyOn(document, "createElement").mockImplementation((tagName: string) => {
            if (tagName !== "canvas") {
                return realDocument.createElement(tagName);
            }

            const canvas = createCanvas(imagePixels, toBlobCalls);
            canvas.context.drawImage = jest.fn(() => {
                canvas.drawFilters.push(canvas.context.filter);
            });
            canvases.push(canvas);
            return {
                width: canvas.width,
                height: canvas.height,
                getContext: jest.fn(() => canvas.context),
                toBlob: canvas.toBlob,
            } as any;
        });

        URL.createObjectURL = jest.fn(() => "blob:mock-url");
        URL.revokeObjectURL = jest.fn();

        class MockImage {
            onload: null | (() => void) = null;
            onerror: null | (() => void) = null;
            width = 2;
            height = 2;
            crossOrigin = "";

            set src(_value: string) {
                this.onload?.();
            }
        }

        class MockWorker {
            listeners: Record<string, ((event: unknown) => void)[]> = { message: [], error: [] };

            addEventListener = jest.fn((type: string, listener: (event: unknown) => void) => {
                if (!this.listeners[type]) this.listeners[type] = [];
                this.listeners[type].push(listener);
            });

            removeEventListener = jest.fn((type: string, listener: (event: unknown) => void) => {
                if (this.listeners[type]) {
                    this.listeners[type] = this.listeners[type].filter((l) => l !== listener);
                }
            });

            onmessage: null | ((event: { data: any }) => void) = null;
            onerror: null | ((error: unknown) => void) = null;

            postMessage = jest.fn((message: any) => {
                const trigger = (data: any) => {
                    const event = { data };
                    this.onmessage?.(event);
                    this.listeners.message?.forEach((l) => l(event));
                };

                if (message.file) {
                    trigger({ id: message.id, fallback: true });
                } else if (message.pixels) {
                    trigger({ id: message.id, pixels: message.pixels });
                }
            });
            terminate = jest.fn();

            constructor() {
                workerInstances.push(this);
            }
        }

        globalThis.Image = MockImage as unknown as typeof Image;
        globalThis.Worker = MockWorker as unknown as typeof Worker;

        const input = new File(["photo"], "medicine.jpg", { type: "image/jpeg" });
        const result = await preprocessMedicineImage(input);
        const drawFilters = canvases.flatMap((canvas) => canvas.drawFilters);

        expect(result).toBeInstanceOf(Blob);
        expect((result as Blob).type).toBe("image/webp");
        expect(workerInstances).toHaveLength(1);
        expect(workerInstances[0].postMessage).toHaveBeenCalledTimes(2);
        expect(drawFilters).toContain("contrast(1.06) brightness(1.08)");
        expect(toBlobCalls).toEqual([["image/webp", 0.8]]);
    });

    it("falls back to synchronous enhancement when worker construction throws", async () => {
        const toBlobCalls: Array<[string, number | undefined]> = [];
        const imagePixels = createPixelBuffer([
            40, 42, 44, 255, 70, 72, 74, 255, 110, 112, 114, 255, 150, 152, 154, 255,
        ]);
        const canvases: CanvasMock[] = [];

        globalThis.window = {} as Window & typeof globalThis;
        jest.spyOn(document, "createElement").mockImplementation((tagName: string) => {
            if (tagName !== "canvas") {
                return realDocument.createElement(tagName);
            }

            const canvas = createCanvas(imagePixels, toBlobCalls);
            canvases.push(canvas);
            return {
                width: canvas.width,
                height: canvas.height,
                getContext: jest.fn(() => canvas.context),
                toBlob: canvas.toBlob,
            } as any;
        });

        URL.createObjectURL = jest.fn(() => "blob:mock-url");
        URL.revokeObjectURL = jest.fn();

        class MockImage {
            onload: null | (() => void) = null;
            onerror: null | (() => void) = null;
            width = 2;
            height = 2;
            crossOrigin = "";

            set src(_value: string) {
                this.onload?.();
            }
        }

        class ThrowingWorker {
            constructor() {
                throw new Error("worker init failed");
            }
        }

        globalThis.Image = MockImage as unknown as typeof Image;
        globalThis.Worker = ThrowingWorker as unknown as typeof Worker;

        const input = new File(["photo"], "medicine.jpg", { type: "image/jpeg" });
        const result = await preprocessMedicineImage(input);
        const putImageDataCalls = canvases.reduce(
            (count, canvas) => count + canvas.context.putImageData.mock.calls.length,
            0
        );

        expect(result).toBeInstanceOf(Blob);
        expect((result as Blob).type).toBe("image/webp");
        expect(putImageDataCalls).toBe(1);
        expect(toBlobCalls).toEqual([["image/webp", 0.8]]);
    });
});
