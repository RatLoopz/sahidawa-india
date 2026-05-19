/**
 * Adaptive client-side data hygiene and image enhancement feature for sahidawa-india
 */

export async function preprocessMedicineImage(input: File | Blob | string): Promise<Blob | File | string> {
  return new Promise((resolve, reject) => {
    try {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      const isString = typeof input === 'string';
      const url = isString ? input : URL.createObjectURL(input);

      img.onload = () => {
        // 1. Resolution Bounds & Performance Downscaling
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

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          if (!isString) URL.revokeObjectURL(url);
          return reject(new Error('Canvas 2D context not available'));
        }

        ctx.drawImage(img, 0, 0, width, height);
        if (!isString) URL.revokeObjectURL(url); // Explicitly free memory

        let imageData: ImageData;
        try {
          imageData = ctx.getImageData(0, 0, width, height);
        } catch (error) {
          console.warn('Canvas getImageData failed (likely CORS). Falling back to original.', error);
          return resolve(input);
        }
        const data = imageData.data;

        // --- NEW: Sample Scan Method (Digital Graphic / Clean Screenshot Check) ---
        let extremeCount = 0;
        let sampleCount = 0;
        for (let i = 0; i < data.length; i += 16) {
          const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          if (l < 15 || l > 240) {
            extremeCount++;
          }
          sampleCount++;
        }
        const isDigitalGraphic = (extremeCount / sampleCount) > 0.30;

        // 2. Exact Algorithmic Methods
        
        if (!isDigitalGraphic) {
          // Contrast Method: Dynamic Linear Histogram Stretching
          let minL = 255;
          let maxL = 0;
          for (let i = 0; i < data.length; i += 4) {
            const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            if (l < minL) minL = l;
            if (l > maxL) maxL = l;
          }

          if (minL > 0 || maxL < 255) {
            if (maxL > minL) { // Avoid division by zero
              const stretchRatio = 255 / (maxL - minL);
              for (let i = 0; i < data.length; i += 4) {
                data[i] = Math.min(255, Math.max(0, (data[i] - minL) * stretchRatio));
                data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - minL) * stretchRatio));
                data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - minL) * stretchRatio));
              }
            }
          }
        }

        // Helper function: RGB to HSL
        const rgbToHsl = (r: number, g: number, b: number) => {
          r /= 255; g /= 255; b /= 255;
          const max = Math.max(r, g, b), min = Math.min(r, g, b);
          let h = 0, s = 0, l = (max + min) / 2;
          if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
              case r: h = (g - b) / d + (g < b ? 6 : 0); break;
              case g: h = (b - r) / d + 2; break;
              case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
          }
          return [h, s, l];
        };

        // Helper function: HSL to RGB
        const hslToRgb = (h: number, s: number, l: number) => {
          let r, g, b;
          if (s === 0) {
            r = g = b = l; // achromatic
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
          return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
        };

        // Saturation Method: Muted-Weighted Vibrance Mapping via HSL
        const scaleFactor = 0.5; // Tunable vibrance scale factor
        for (let i = 0; i < data.length; i += 4) {
          const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
          let newS = s + (1.0 - s) * (1.0 - s) * scaleFactor;
          newS = Math.min(1.0, Math.max(0.0, newS));
          const [r, g, b] = hslToRgb(h, newS, l);
          data[i] = r;
          data[i + 1] = g;
          data[i + 2] = b;
        }

        // Dynamic Range Method: Adaptive Gamma Correction Curve
        let sumLuminance = 0;
        for (let i = 0; i < data.length; i += 4) {
          sumLuminance += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        }
        const avgLuminance = sumLuminance / (width * height);
        
        let adaptiveGamma = 1.0;
        if (avgLuminance < 128) {
          adaptiveGamma = 0.7 + (0.3 * (avgLuminance / 128));
        } else {
          adaptiveGamma = 1.0 + (0.5 * ((avgLuminance - 128) / 127));
        }

        if (adaptiveGamma !== 1.0) {
          for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.pow(data[i] / 255, adaptiveGamma) * 255;
            data[i + 1] = Math.pow(data[i + 1] / 255, adaptiveGamma) * 255;
            data[i + 2] = Math.pow(data[i + 2] / 255, adaptiveGamma) * 255;
          }
        }

        // Exposure / Brightness Method: Local Illumination Map Estimation
        const shadowLiftThreshold = 80;
        const liftFactor = 1.2;
        for (let i = 0; i < data.length; i += 4) {
          const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          if (l < shadowLiftThreshold && l > 10) { 
            const ratio = 1 + ((shadowLiftThreshold - l) / shadowLiftThreshold) * (liftFactor - 1);
            data[i] = Math.min(255, data[i] * ratio);
            data[i + 1] = Math.min(255, data[i + 1] * ratio);
            data[i + 2] = Math.min(255, data[i + 2] * ratio);
          }
        }

        ctx.putImageData(imageData, 0, 0);

        let finalCanvasToBlob = canvas;

        if (!isDigitalGraphic) {
          // Sharpness Method: 3x3 Laplacian Convolution Kernel Matrix
          const sharpCanvas = document.createElement('canvas');
          sharpCanvas.width = width;
          sharpCanvas.height = height;
          const sharpCtx = sharpCanvas.getContext('2d')!;
          sharpCtx.drawImage(canvas, 0, 0);
          
          const sourceData = sharpCtx.getImageData(0, 0, width, height);
          const destData = sharpCtx.createImageData(width, height);
          
          const src = sourceData.data;
          const dst = destData.data;
          
          const w = width;
          const h = height;
          
          for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
              const idx = (y * w + x) * 4;
              for (let c = 0; c < 3; c++) {
                let val = 5 * src[idx + c]
                          - src[((y - 1) * w + x) * 4 + c]
                          - src[((y + 1) * w + x) * 4 + c]
                          - src[(y * w + (x - 1)) * 4 + c]
                          - src[(y * w + (x + 1)) * 4 + c];
                dst[idx + c] = Math.min(255, Math.max(0, val));
              }
              dst[idx + 3] = src[idx + 3];
            }
          }
          
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

        // 4. Output Compression
        finalCanvasToBlob.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Canvas to Blob conversion failed'));
            }
          },
          'image/jpeg',
          0.80
        );

      };

      img.onerror = () => {
        if (!isString) URL.revokeObjectURL(url);
        reject(new Error('Image failed to load'));
      };

      img.src = url;
    } catch (error) {
      reject(error);
    }
  });
}
