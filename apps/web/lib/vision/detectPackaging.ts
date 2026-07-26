/**
 * detectPackaging.ts
 *
 * Lightweight classical CV check: does the current camera frame contain
 * a roughly rectangular object (medicine box/packaging)?
 *
 * Pipeline: grayscale -> Gaussian blur -> Canny edges -> contours ->
 * approxPolyDP -> keep ~4-corner, ~90°, large-enough contours.
 *
 * No ML model. Pure geometry. Runs entirely client-side.
 */

import { loadOpenCv } from "./loadOpenCv";

export interface DetectPackagingResult {
    looksLikePackaging: boolean;
}

interface DetectOptions {
    /** Minimum contour area as a fraction of total frame area (default 5%) */
    minAreaRatio?: number;
    /** Allowed deviation from 90° corners, in degrees (default 15) */
    angleToleranceDeg?: number;
}

export async function detectPackaging(
    source: HTMLCanvasElement | HTMLImageElement,
    options: DetectOptions = {}
): Promise<DetectPackagingResult> {
    const cv = await loadOpenCv();
    const { minAreaRatio = 0.02, angleToleranceDeg = 25 } = options;

    // Mats we own and must delete
    const src = cv.imread(source);
    const gray = new cv.Mat();
    const blurred = new cv.Mat();
    const edges = new cv.Mat();
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();

    let looksLikePackaging = false;

    try {
        const frameArea = src.rows * src.cols;
        const minArea = frameArea * minAreaRatio;

        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
        cv.GaussianBlur(gray, blurred, new cv.Size(3, 3), 0);
        cv.Canny(blurred, edges, 30, 100);
        cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

        for (let i = 0; i < contours.size(); i++) {
            const contour = contours.get(i);
            const area = cv.contourArea(contour);

            if (area < minArea) {
                contour.delete();
                continue;
            }

            const approx = new cv.Mat();
            const perimeter = cv.arcLength(contour, true);
            cv.approxPolyDP(contour, approx, 0.02 * perimeter, true);

            if (approx.rows === 4 && cv.isContourConvex(approx)) {
                if (hasRoughlyRightAngles(cv, approx, angleToleranceDeg)) {
                    looksLikePackaging = true;
                }
            }

            approx.delete();
            contour.delete();

            if (looksLikePackaging) break;
        }
    } finally {
        // CRITICAL: delete every Mat to avoid WASM heap leaks
        src.delete();
        gray.delete();
        blurred.delete();
        edges.delete();
        contours.delete();
        hierarchy.delete();
    }

    return { looksLikePackaging };
}

/** Checks that all 4 corners of a quadrilateral are close to 90°. */
function hasRoughlyRightAngles(cv: any, approx: any, toleranceDeg: number): boolean {
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < 4; i++) {
        pts.push({ x: approx.intAt(i, 0), y: approx.intAt(i, 1) });
    }

    for (let i = 0; i < 4; i++) {
        const p0 = pts[(i + 3) % 4];
        const p1 = pts[i];
        const p2 = pts[(i + 1) % 4];

        const v1 = { x: p0.x - p1.x, y: p0.y - p1.y };
        const v2 = { x: p2.x - p1.x, y: p2.y - p1.y };

        const dot = v1.x * v2.x + v1.y * v2.y;
        const mag1 = Math.hypot(v1.x, v1.y);
        const mag2 = Math.hypot(v2.x, v2.y);
        if (mag1 === 0 || mag2 === 0) return false;

        const angleDeg = (Math.acos(dot / (mag1 * mag2)) * 180) / Math.PI;
        if (Math.abs(angleDeg - 90) > toleranceDeg) return false;
    }

    return true;
}
