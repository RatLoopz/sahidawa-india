// Make React testing utilities know the environment supports act(...)
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

// Helpful matchers
import '@testing-library/jest-dom/extend-expect'

// Minimal OffscreenCanvas mock used by image processing code
if (!(globalThis as any).OffscreenCanvas) {
  class OffscreenCanvasMock {
    width: number
    height: number
    constructor(w = 1, h = 1) {
      this.width = w
      this.height = h
    }
    getContext(_type?: string) {
      return {
        filter: '',
        drawImage: () => {},
        putImageData: () => {},
        getImageData: (_x: number, _y: number, w: number, h: number) => ({
          data: new Uint8ClampedArray(w * h * 4),
          width: w,
          height: h,
        }),
        canvas: this,
        toDataURL: () => '',
      }
    }
    transferToImageBitmap() {
      return {}
    }
    convertToBlob() {
      return Promise.resolve(new Blob())
    }
  }
  ;(globalThis as any).OffscreenCanvas = OffscreenCanvasMock
}

// createImageBitmap mock
if (!(globalThis as any).createImageBitmap) {
  ;(globalThis as any).createImageBitmap = async (img: any) => img
}

// Minimal Worker mock (no-op)
if (!(globalThis as any).Worker) {
  class WorkerMock {
    onmessage: ((ev: any) => void) | null = null
    onerror: ((ev: any) => void) | null = null
    constructor(_script?: string) {}
    postMessage(_msg?: any) {}
    terminate() {}
    addEventListener() {}
    removeEventListener() {}
  }
  ;(globalThis as any).Worker = WorkerMock
}

// Minimal Image mock
if (!(globalThis as any).Image) {
  class ImageMock {
    src = ''
    width = 0
    height = 0
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    constructor() {}
  }
  ;(globalThis as any).Image = ImageMock as any
}

// Ensure HTMLCanvasElement.toBlob exists in jsdom
if (!HTMLCanvasElement.prototype.toBlob) {
  HTMLCanvasElement.prototype.toBlob = function (callback: (b: Blob | null) => void) {
    try {
      const dataUrl = (this as HTMLCanvasElement).toDataURL ? (this as HTMLCanvasElement).toDataURL() : ''
      callback(new Blob([dataUrl], { type: 'image/png' }))
    } catch {
      callback(null)
    }
  }
}
