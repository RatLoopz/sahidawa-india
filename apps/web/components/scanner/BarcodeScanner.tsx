"use client";

import { useEffect, useRef, useState, useCallback, useId } from "react";
import { Camera, AlertCircle, VideoOff, Zap, ZapOff } from "lucide-react";
import { LiveMessage } from "@/components/ui/LiveMessage";

type ScannerStatus = "initializing" | "scanning" | "permission-denied" | "unavailable" | "error";

interface BarcodeScannerProps {
    onScan: (barcodeText: string) => void;
    debounceMs?: number;
    isVerifying?: boolean;
    apiError?: string | null;
    onRetry?: () => void;
    onPermissionDenied?: () => void;
}

function stopMediaStream(stream: MediaStream | null): void {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    track.stop();
  }
}

export function BarcodeScanner({
  onScan,
  debounceMs = 2000,
  isVerifying,
  apiError,
  onRetry,
  onPermissionDenied,
}: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastScanRef = useRef<string>("");
  const lastScanTimeRef = useRef<number>(0);
  const controlsRef = useRef<{ stop: () => void } | null>(null);

  // Use refs to track external state without restarting the camera hardware
  const isVerifyingRef = useRef(isVerifying);
  const apiErrorRef = useRef(apiError);

  const [status, setStatus] = useState<ScannerStatus>("initializing");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const initializingMessageId = useId();
  const permissionDeniedMessageId = useId();
  const unavailableMessageId = useId();
  const scannerErrorMessageId = useId();

  // Update refs when props change
  useEffect(() => {
    isVerifyingRef.current = isVerifying;
    apiErrorRef.current = apiError;
  }, [isVerifying, apiError]);

  const handleCameraRetry = () => {
    setStatus("initializing");
    setErrorMessage("");
    setRetryCount((prev) => prev + 1);
  };

  const shouldEmitScan = useCallback(
    (text: string): boolean => {
      const now = Date.now();
      if (text === lastScanRef.current && now - lastScanTimeRef.current < debounceMs) {
        return false;
      }
      lastScanRef.current = text;
      lastScanTimeRef.current = now;
      return true;
    },
    [debounceMs]
  );

  useEffect(() => {
    let cancelled = false;

    const startScanner = async (): Promise<void> => {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const { DecodeHintType, BarcodeFormat } = await import("@zxing/library");

      if (cancelled) return;

      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.CODE_128,
        BarcodeFormat.QR_CODE,
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.CODE_39,
        BarcodeFormat.DATA_MATRIX,
      ]);
      hints.set(DecodeHintType.TRY_HARDER, true);

      const reader = new BrowserMultiFormatReader(hints, {
        delayBetweenScanAttempts: 300,
      });

      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          if (!cancelled) {
            setStatus("unavailable");
            setErrorMessage("Camera access is not supported by this browser.");
          }
          return;
        }

        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" } },
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }

        if (cancelled) {
          stopMediaStream(stream);
          return;
        }

        streamRef.current = stream;
        if (!videoRef.current) return;

        const controls = await reader.decodeFromStream(
          stream,
          videoRef.current,
          (result: any, error: any) => {
            if (result) {
              // Ignore scans if we are verifying or currently showing an error
              if (isVerifyingRef.current || apiErrorRef.current) return; 

              const text = result.getText().trim();
              if (shouldEmitScan(text)) {
                onScan(text);
              }
            }

            if (error && error.name !== "NotFoundException") {
               // Ignore continuous decode errors
            }
          }
        );

        if (cancelled) {
          controls.stop();
          return;
        }

        controlsRef.current = controls;
        setStatus("scanning");

        const track = stream.getVideoTracks()[0];
        if (track) {
          const capabilities = track.getCapabilities ? track.getCapabilities() : {};
          if ("torch" in capabilities) setHasTorch(true);
        }
      } catch (err: unknown) {
        if (cancelled) return;
        const errorObj = err instanceof Error ? err : new Error(String(err));
        if (errorObj.name === "NotAllowedError" ||
          errorObj.name === "PermissionDeniedError") {
          setStatus("permission-denied");
          setErrorMessage(
        "Camera access was denied. Please allow camera permissions in your browser settings."
      );
    onPermissionDenied?.(); // Add this line
}

        if (errorObj.name === "NotAllowedError" || errorObj.name === "PermissionDeniedError") {
          setStatus("permission-denied");
          setErrorMessage("Camera access was denied. Please allow camera permissions in your browser settings.");
        } else if (errorObj.name === "NotFoundError" || errorObj.name === "DevicesNotFoundError") {
          setStatus("unavailable");
          setErrorMessage("No suitable camera was found on this device.");
        } else {
          setStatus("error");
          setErrorMessage(errorObj.message || "Failed to start the barcode scanner.");
        }
      }
    };

    startScanner();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
      stopMediaStream(streamRef.current);
      streamRef.current = null;
      setHasTorch(false);
      setTorchOn(false);
    };
  }, [retryCount, shouldEmitScan, onScan]); // isVerifying and apiError are purposefully removed here!

  const toggleTorch = async () => {
    // ... (Keep existing torch logic)
    const stream = streamRef.current;
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    if (!track) return;
    const capabilities = track.getCapabilities ? track.getCapabilities() : {};
    if (!("torch" in capabilities)) return;
    const nextTorchState = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: nextTorchState } as any] });
      setTorchOn(nextTorchState);
    } catch (err) {
      console.error("Failed to toggle torch constraint:", err);
    }
  };

  return (
    <div className="relative h-full w-full bg-black overflow-hidden rounded-2xl">
      
      {/* 1. THE BASE CAMERA LAYER (Always rendered) */}
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        playsInline
        muted
      />

      {/* 2. THE ERROR OVERLAY */}
      {apiError && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-slate-900 p-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20">
            <AlertCircle size={32} className="text-red-400" />
          </div>
          <h3 className="text-lg font-bold text-white">Verification Failed</h3>
          <p className="max-w-xs text-sm text-slate-400">{apiError}</p>
          {onRetry && (
            <button
              onClick={onRetry} // Now we ONLY clear the error. The camera underneath is already ready!
              className="rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-600 shadow-lg mt-4"
            >
              Retry Verification
            </button>
          )}
        </div>
      )}

      {/* 3. THE LOADING OVERLAY */}
      {!apiError && isVerifying && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-slate-900/95 p-6 backdrop-blur-sm">
          <div className="flex w-full max-w-sm flex-col items-center animate-pulse gap-6 rounded-2xl bg-slate-800 p-8 shadow-xl">
            <div className="h-16 w-16 rounded-2xl bg-slate-700"></div>
            <div className="flex w-full flex-col items-center gap-3">
              <div className="h-4 w-3/4 rounded-full bg-slate-700"></div>
              <div className="h-4 w-1/2 rounded-full bg-slate-700"></div>
            </div>
            <div className="flex w-full gap-4">
              <div className="h-12 flex-1 rounded-xl bg-slate-700"></div>
              <div className="h-12 flex-1 rounded-xl bg-slate-700"></div>
            </div>
            <div className="h-20 w-full rounded-xl bg-slate-700"></div>
            <p className="text-sm font-medium text-slate-400">
              Verifying with CDSCO Database...
            </p>
          </div>
        </div>
      )}

    {/* 4. CAMERA STATUS OVERLAYS */}
{!apiError && !isVerifying && (
  <>
    {status === "initializing" && (
      <div
        id={initializingMessageId}
        className="absolute inset-0 z-30 flex flex-col 
        items-center justify-center gap-3 bg-slate-900"
        role="status"
        aria-live="polite"
      >
        <div className="h-10 w-10 animate-spin rounded-full 
        border-4 border-white/10 border-t-emerald-500" />
        <p className="text-sm font-medium text-slate-400">
          Starting camera...
        </p>
      </div>
    )}

    {status === "permission-denied" && (
      <div
        id={permissionDeniedMessageId}
        className="absolute inset-0 z-30 flex flex-col 
        items-center justify-center gap-4 bg-slate-900 
        p-6 text-center"
        role="alert"
        aria-live="assertive"
      >
        <div className="flex h-16 w-16 items-center 
        justify-center rounded-full bg-red-500/20">
          <AlertCircle size={32} className="text-red-400" />
        </div>
        <h3 className="text-lg font-bold text-white">
          Camera Access Denied
        </h3>
        <p className="max-w-xs text-sm text-slate-400">
          {errorMessage}
        </p>

        {/* Browser specific instructions */}
        <div className="w-full max-w-xs rounded-xl 
        bg-slate-800 p-4 text-left text-xs 
        text-slate-400 space-y-1">
          <p className="font-bold text-slate-300 mb-2">
            How to enable camera:
          </p>
          <p>🔵 <strong>Chrome:</strong> Click the 🔒 lock 
          icon in address bar → Camera → Allow</p>
          <p>🦊 <strong>Firefox:</strong> Click the 🔒 lock 
          icon → Clear Permission → Reload</p>
          <p>🧭 <strong>Safari:</strong> Settings → Safari 
          → Camera → Allow</p>
        </div>

        <button
          onClick={handleCameraRetry}
          className="rounded-full bg-emerald-500 px-6 
          py-2.5 text-sm font-bold text-white 
          transition-colors hover:bg-emerald-600 
          shadow-lg"
        >
          Retry Camera
        </button>

        {/* Fallback options */}
        <p className="text-xs text-slate-500">
          Or use these alternatives:
        </p>
        <div className="flex w-full max-w-xs gap-3">
          <button
            onClick={() => {
              const input = document.getElementById(
                "medicine-upload"
              );
              input?.click();
            }}
            className="flex-1 rounded-xl border 
            border-slate-700 bg-slate-800 py-2.5 
            text-xs font-semibold text-slate-300 
            hover:bg-slate-700 transition-colors"
          >
            📷 Upload Photo
          </button>
          <button
            onClick={onRetry}
            className="flex-1 rounded-xl border 
            border-slate-700 bg-slate-800 py-2.5 
            text-xs font-semibold text-slate-300 
            hover:bg-slate-700 transition-colors"
          >
            ⌨️ Manual Entry
          </button>
        </div>
      </div>
    )}

    {status === "unavailable" && (
      <div
        id={unavailableMessageId}
        className="absolute inset-0 z-30 flex flex-col 
        items-center justify-center gap-4 bg-slate-900 
        p-6 text-center"
        role="alert"
        aria-live="assertive"
      >
        <div className="flex h-16 w-16 items-center 
        justify-center rounded-full bg-amber-500/20">
          <VideoOff size={32} className="text-amber-400" />
        </div>
        <h3 className="text-lg font-bold text-white">
          No Camera Found
        </h3>
        <p className="max-w-xs text-sm text-slate-400">
          {errorMessage}
        </p>
        <div className="flex w-full max-w-xs gap-3">
          <button
            onClick={() => {
              const input = document.getElementById(
                "medicine-upload"
              );
              input?.click();
            }}
            className="flex-1 rounded-xl border 
            border-slate-700 bg-slate-800 py-2.5 
            text-xs font-semibold text-slate-300 
            hover:bg-slate-700 transition-colors"
          >
            📷 Upload Photo
          </button>
          <button
            onClick={onRetry}
            className="flex-1 rounded-xl border 
            border-slate-700 bg-slate-800 py-2.5 
            text-xs font-semibold text-slate-300 
            hover:bg-slate-700 transition-colors"
          >
            ⌨️ Manual Entry
          </button>
        </div>
      </div>
    )}

    {status === "error" && (
      <div
        id={scannerErrorMessageId}
        className="absolute inset-0 z-30 flex flex-col 
        items-center justify-center gap-4 bg-slate-900 
        p-6 text-center"
        role="alert"
        aria-live="assertive"
      >
        <div className="flex h-16 w-16 items-center 
        justify-center rounded-full bg-red-500/20">
          <AlertCircle size={32} className="text-red-400" />
        </div>
        <h3 className="text-lg font-bold text-white">
          Scanner Error
        </h3>
        <p className="max-w-xs text-sm text-slate-400">
          {errorMessage}
        </p>
        <button
          onClick={handleCameraRetry}
          className="rounded-full bg-emerald-500 px-6 
          py-2.5 text-sm font-bold text-white 
          transition-colors hover:bg-emerald-600"
        >
          Try Again
        </button>
        <div className="flex w-full max-w-xs gap-3">
          <button
            onClick={() => {
              const input = document.getElementById(
                "medicine-upload"
              );
              input?.click();
            }}
            className="flex-1 rounded-xl border 
            border-slate-700 bg-slate-800 py-2.5 
            text-xs font-semibold text-slate-300 
            hover:bg-slate-700 transition-colors"
          >
            📷 Upload Photo
          </button>
          <button
            onClick={onRetry}
            className="flex-1 rounded-xl border 
            border-slate-700 bg-slate-800 py-2.5 
            text-xs font-semibold text-slate-300 
            hover:bg-slate-700 transition-colors"
          >
            ⌨️ Manual Entry
          </button>
        </div>
      </div>
    )}

    {status === "scanning" && (
      <div className="absolute right-3 bottom-3 z-30 
      flex items-center gap-1.5 rounded-full 
      bg-black/60 px-3 py-1.5 backdrop-blur-md">
        <Camera size={14} className="text-emerald-400" />
        <span className="text-xs font-medium 
        text-emerald-400">Scanning</span>
      </div>
      )}
    </>
  )}
    </div>
);
}