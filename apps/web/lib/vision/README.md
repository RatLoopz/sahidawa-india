# Packaging Geometry Detection

Classical computer-vision pre-check run entirely in-browser via OpenCV.js
before the (slower) barcode lookup / future ML classifier.

Pipeline: grayscale → Gaussian blur → Canny edge detection → findContours →
approxPolyDP (keep ~4-corner, ~90°-angle, large-enough shapes) → boolean.

No training, no model file — pure geometry, so this ships without any ML
infra. See `detectPackaging.ts`. OpenCV.js is loaded lazily via
`loadOpenCv.ts` only when the scanner page mounts (not bundled app-wide).