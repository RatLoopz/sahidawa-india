/**
 * loadOpenCv.ts
 *
 * Isolates OpenCV.js inside a sandboxed iframe so the main page's strict CSP
 * (no 'unsafe-eval') is not compromised. OpenCV's Emscripten build requires
 * new Function() for WASM-JS interop, which needs 'unsafe-eval'. By running
 * it in a sandboxed iframe (allow-scripts, no allow-same-origin), the iframe
 * gets its own opaque origin and a separate CSP context where 'unsafe-eval'
 * is permitted, while the parent page remains protected.
 *
 * Communication uses postMessage with per-request correlation IDs so that
 * stale or spoofed responses cannot resolve the wrong detection request.
 */

export interface DetectPackagingResult {
    looksLikePackaging: boolean;
}

export interface DetectOptions {
    minAreaRatio?: number;
    angleToleranceDeg?: number;
}

// ── Per-iframe readiness state ───────────────────────────────────────────────
// A fresh (promise, resolver) pair is created for each iframe lifecycle.
// destroySandbox() swaps in a new pair so that a subsequent
// detectPackaging() call creates a fresh iframe and waits correctly.

let readyResolve: (() => void) | null = null;
let readyPromise = createReadyPromise();

function createReadyPromise(): Promise<void> {
    return new Promise<void>((resolve) => {
        readyResolve = resolve;
    });
}

// ── Sandbox singleton ────────────────────────────────────────────────────────
let sandboxIframe: HTMLIFrameElement | null = null;
let sandboxReady = false;
let readyListener: ((evt: MessageEvent) => void) | null = null;

function ensureSandbox(): HTMLIFrameElement {
    if (sandboxIframe) return sandboxIframe;

    if (typeof window === "undefined") {
        throw new Error("loadOpenCv must run in the browser");
    }

    const iframe = document.createElement("iframe");
    // allow-scripts: needed for OpenCV.js to execute
    // NO allow-same-origin: keeps the iframe in a unique opaque origin,
    // isolating its CSP from the parent page
    iframe.sandbox.add("allow-scripts");
    iframe.src = "/opencv/sandbox.html";
    iframe.style.display = "none";
    iframe.title = "OpenCV sandbox";

    document.body.appendChild(iframe);
    sandboxIframe = iframe;

    // Listen for the sandbox's readiness signal. The sandbox sends this
    // message only after its inline script has fully executed, which means
    // the message handler inside the sandbox is registered and ready to
    // receive detection requests. We do NOT use the iframe `load` event
    // because that fires before the inline script runs.
    readyListener = (evt: MessageEvent) => {
        if (evt.data?.type === "opencv-sandbox-ready") {
            sandboxReady = true;
            readyResolve?.();
        }
    };
    window.addEventListener("message", readyListener);

    return iframe;
}

// ── Pending detection requests ───────────────────────────────────────────────
// Keyed by requestId. Each entry holds the resolve/reject callbacks for one
// in-flight detection. When a matching response arrives, the entry is removed.
// When the iframe is destroyed, all entries are rejected.

interface PendingRequest {
    resolve: (value: DetectPackagingResult) => void;
    reject: (reason: Error) => void;
    timer: ReturnType<typeof setTimeout>;
}

const pendingRequests = new Map<string, PendingRequest>();

// ── Global message handler ───────────────────────────────────────────────────
// A single window-level listener dispatches sandbox responses to the correct
// pending request by matching requestId. This prevents stale or spoofed
// messages from resolving a different request.

if (typeof window !== "undefined") {
    window.addEventListener("message", (evt: MessageEvent) => {
        // Only accept messages that look like sandbox detection responses
        const data = evt.data;
        if (!data || data.type !== "opencv-detect-packaging-result") return;

        // Validate that the message came from our sandbox iframe. For a
        // sandboxed iframe with an opaque origin, evt.source should be the
        // iframe's contentWindow. This blocks messages from other windows.
        if (sandboxIframe && evt.source !== sandboxIframe.contentWindow) return;

        const pending = pendingRequests.get(data.requestId);
        if (!pending) return; // Stale or untracked response — ignore

        pendingRequests.delete(data.requestId);
        clearTimeout(pending.timer);

        if (data.error) {
            pending.reject(new Error(data.error));
        } else {
            pending.resolve(data.result);
        }
    });
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Detect whether an image contains rectangular packaging (medicine box).
 * Sends image data to the sandboxed OpenCV iframe for processing.
 *
 * Each call generates a unique requestId so that concurrent or stale
 * responses cannot resolve the wrong request.
 */
export async function detectPackaging(
    source: HTMLCanvasElement | HTMLImageElement,
    options: DetectOptions = {}
): Promise<DetectPackagingResult> {
    if (typeof window === "undefined") {
        throw new Error("detectPackaging must run in the browser");
    }

    const iframe = ensureSandbox();

    // Wait for the sandbox's inline script to be registered (NOT just the
    // iframe load event, which fires before the script runs).
    if (!sandboxReady) {
        await readyPromise;
    }

    // If the iframe was destroyed while we were waiting, create a fresh one
    if (!sandboxIframe || !sandboxIframe.contentWindow) {
        throw new Error("OpenCV sandbox was destroyed before detection could complete");
    }

    // Convert source to a Blob for postMessage transfer
    const blob = await sourceToBlob(source);

    const requestId = `det_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    return new Promise<DetectPackagingResult>((resolve, reject) => {
        const timer = setTimeout(() => {
            pendingRequests.delete(requestId);
            reject(new Error("OpenCV sandbox detection timed out"));
        }, 10000);

        pendingRequests.set(requestId, { resolve, reject, timer });

        iframe.contentWindow!.postMessage(
            {
                type: "opencv-detect-packaging",
                requestId,
                imageData: blob,
                minAreaRatio: options.minAreaRatio,
                angleToleranceDeg: options.angleToleranceDeg,
            },
            "*"
        );
    });
}

/**
 * Destroy the sandbox iframe, cancel all pending requests, and reset
 * readiness state so a future detectPackaging() call creates a fresh iframe.
 */
export function destroySandbox(): void {
    // Cancel all pending detection requests
    for (const [, entry] of pendingRequests) {
        clearTimeout(entry.timer);
        entry.reject(new Error("OpenCV sandbox destroyed"));
    }
    pendingRequests.clear();

    // Remove the readiness message listener
    if (readyListener) {
        window.removeEventListener("message", readyListener);
        readyListener = null;
    }

    // Remove the iframe from the DOM
    if (sandboxIframe) {
        sandboxIframe.remove();
        sandboxIframe = null;
    }

    // Reset readiness state with a fresh promise/resolver pair
    sandboxReady = false;
    readyPromise = createReadyPromise();
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function sourceToBlob(source: HTMLCanvasElement | HTMLImageElement): Promise<Blob> {
    return new Promise<Blob>((resolve, reject) => {
        if (source instanceof HTMLCanvasElement) {
            source.toBlob((b) => {
                if (b) resolve(b);
                else reject(new Error("Failed to convert canvas to blob"));
            }, "image/png");
        } else {
            const canvas = document.createElement("canvas");
            canvas.width = source.naturalWidth || source.width;
            canvas.height = source.naturalHeight || source.height;
            const ctx = canvas.getContext("2d");
            if (!ctx) return reject(new Error("Failed to get canvas context"));
            ctx.drawImage(source, 0, 0);
            canvas.toBlob((b) => {
                if (b) resolve(b);
                else reject(new Error("Failed to convert image to blob"));
            }, "image/png");
        }
    });
}
