// Make React testing utilities know the environment supports act(...)
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// Helpful matchers
import "fake-indexeddb/auto";
import "@testing-library/jest-dom";

const clonePolyfill = (value: any) => JSON.parse(JSON.stringify(value));
if (!(globalThis as any).structuredClone) {
    (globalThis as any).structuredClone = clonePolyfill;
}
if (typeof global !== "undefined" && !(global as any).structuredClone) {
    (global as any).structuredClone = clonePolyfill;
}
if (typeof window !== "undefined" && !(window as any).structuredClone) {
    (window as any).structuredClone = clonePolyfill;
}

// Minimal OffscreenCanvas mock used by image processing code
if (!(globalThis as any).OffscreenCanvas) {
    class OffscreenCanvasMock {
        width: number;
        height: number;
        constructor(w = 1, h = 1) {
            this.width = w;
            this.height = h;
        }
        getContext() {
            return {
                filter: "",
                drawImage: () => {},
                putImageData: () => {},
                getImageData: (_x: number, _y: number, w: number, h: number) => ({
                    data: new Uint8ClampedArray(w * h * 4),
                    width: w,
                    height: h,
                }),
                canvas: this,
                toDataURL: () => "",
            };
        }
        transferToImageBitmap() {
            return {};
        }
        convertToBlob() {
            return Promise.resolve(new Blob());
        }
    }
    (globalThis as any).OffscreenCanvas = OffscreenCanvasMock;
}

// createImageBitmap mock
if (!(globalThis as any).createImageBitmap) {
    (globalThis as any).createImageBitmap = async (img: any) => img;
}

// Minimal Worker mock (no-op)
if (!(globalThis as any).Worker) {
    class WorkerMock {
        onmessage: ((ev: any) => void) | null = null;
        onerror: ((ev: any) => void) | null = null;
        constructor() {}
        postMessage() {}
        terminate() {}
        addEventListener() {}
        removeEventListener() {}
    }
    (globalThis as any).Worker = WorkerMock;
}

// Minimal Image mock
if (!(globalThis as any).Image) {
    class ImageMock {
        src = "";
        width = 0;
        height = 0;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        constructor() {}
    }
    (globalThis as any).Image = ImageMock as any;
}

// Ensure HTMLCanvasElement.toBlob exists in jsdom
if (typeof HTMLCanvasElement !== "undefined" && !HTMLCanvasElement.prototype.toBlob) {
    HTMLCanvasElement.prototype.toBlob = function (callback: (b: Blob | null) => void) {
        try {
            const canvas = this as HTMLCanvasElement;
            // Guard against zero-dimension canvas which causes toDataURL to fail in jsdom
            if (canvas.width > 0 && canvas.height > 0) {
                const dataUrl = canvas.toDataURL?.() ?? "";
                callback(new Blob([dataUrl], { type: "image/png" }));
            } else {
                callback(new Blob([], { type: "image/png" }));
            }
        } catch {
            // Return a valid empty blob instead of null so tests don't crash during setup
            callback(new Blob([], { type: "image/png" }));
        }
    };
}

// Polyfill scrollIntoView for JSDOM
if (typeof window !== "undefined" && window.Element) {
    window.Element.prototype.scrollIntoView = () => {};
}
