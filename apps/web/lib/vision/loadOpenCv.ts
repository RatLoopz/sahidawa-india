// Lazily loads OpenCV.js from a CDN (or /public) and resolves once cv.onRuntimeInitialized fires.
// Only call this from the scanner page — never import it app-wide.

let cvLoadPromise: Promise<any> | null = null;

export function loadOpenCv(): Promise<any> {
    if (typeof window === "undefined") {
        return Promise.reject(new Error("loadOpenCv must run in the browser"));
    }

    // Already loaded
    if ((window as any).cv?.Mat) {
        return Promise.resolve((window as any).cv);
    }

    if (cvLoadPromise) return cvLoadPromise;

    cvLoadPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "/opencv/opencv.js";
        script.async = true;

        script.onload = () => {
            const cv = (window as any).cv;
            if (!cv) return reject(new Error("OpenCV.js failed to attach to window"));
            cv.onRuntimeInitialized = () => resolve(cv);
        };
        script.onerror = () => reject(new Error("Failed to load OpenCV.js script"));

        document.body.appendChild(script);
    });

    return cvLoadPromise;
}
