/**
 * detectPackaging.ts
 *
 * Public API for packaging geometry detection.
 * The actual OpenCV processing runs inside a sandboxed iframe
 * (see loadOpenCv.ts) to keep 'unsafe-eval' out of the main page's CSP.
 *
 * Pipeline: grayscale -> Gaussian blur -> Canny edges -> contours ->
 * approxPolyDP -> keep ~4-corner, ~90deg, large-enough contours.
 */

export type { DetectPackagingResult, DetectOptions } from "./loadOpenCv";
export { detectPackaging, destroySandbox } from "./loadOpenCv";
