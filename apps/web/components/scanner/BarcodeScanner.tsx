"use client";

import { useEffect, useRef, useState, useCallback, useId } from "react";
import { Camera, AlertCircle, VideoOff, Zap, ZapOff } from "lucide-react";
import { LiveMessage } from "@/components/ui/LiveMessage";

/**
 * Status of the barcode scanner lifecycle.
 * - `initializing`: Camera access is being requested.
 * - `scanning`: Camera is active and scanning for barcodes.
 * - `permission-denied`: User denied camera access.
 * - `unavailable`: No suitable camera device was found.
 * - `error`: An unexpected error occurred during setup.
 */
type ScannerStatus = "initializing" | "scanning" | "permission-denied" | "unavailable" | "error";

/** Props accepted by the {@link BarcodeScanner} component. */
interface BarcodeScannerProps {
    /** Callback invoked with the decoded barcode text on a successful scan. */
    onScan: (barcodeText: string) => void;
    /** Minimum interval in milliseconds between consecutive scan callbacks. Defaults to `2000`. */
    debounceMs?: number;
}

/**
 * Stops all active tracks on the given `MediaStream`, releasing the camera
 * hardware and turning off the camera indicator light.
 */
function stopMediaStream(stream: MediaStream | null): void {
    if (!stream) return;
    for (const track of stream.getTracks()) {
        track.stop();
    }
}

/**
 * A production-ready barcode scanner component powered by ZXing.
 *
 * Features:
 * - Uses the rear (environment-facing) camera on mobile devices.
 * - Prevents duplicate scan events via a configurable debounce window.
 * - Handles permission denial, missing cameras, and scan failures gracefully.
 * - Fully cleans up video tracks, reader instances, and timers on unmount.
 * - Safe for Next.js App Router (client-only rendering, no SSR browser API access).
 * - Flashlight/Torch toggle support for low-light environments.
 *
 * @example
 * ```tsx
 * <BarcodeScanner onScan={(text) => console.log(text)} debounceMs={2500} />
 * ```
 */
export function BarcodeScanner({ onScan, debounceMs = 2000 }: BarcodeScannerProps) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const lastScanRef = useRef<string>("");
    const lastScanTimeRef = useRef<number>(0);
    const controlsRef = useRef<{ stop: () => void } | null>(null);

    const [status, setStatus] = useState<ScannerStatus>("initializing");
    const [errorMessage, setErrorMessage] = useState<string>("");
    const [hasTorch, setHasTorch] = useState(false);
    const [torchOn, setTorchOn] = useState(false);
    const [retryCount, setRetryCount] = useState(0);
    const initializingMessageId = useId();
    const permissionDeniedMessageId = useId();
    const unavailableMessageId = useId();
    const scannerErrorMessageId = useId();

    const handleRetry = () => {
        setStatus("initializing");
        setErrorMessage("");
        setRetryCount((prev) => prev + 1);
    };

    /**
     * Determines whether a scan result should be emitted based on the
     * debounce window and duplicate text check.
     */
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
            // Dynamic import ensures ZXing is only loaded client-side, avoiding
            // SSR errors in Next.js where browser APIs are unavailable.
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
                        setErrorMessage(
                            "Camera access is not supported by this browser. Please use HTTPS or a compatible browser."
                        );
                    }
                    return;
                }

                // Attempt to acquire the rear camera first; fall back to any camera.
                let stream: MediaStream;
                try {
                    stream = await navigator.mediaDevices.getUserMedia({
                        video: { facingMode: { ideal: "environment" } },
                    });
                } catch {
                    // Fallback: any available camera
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
                    (
                        result: { getText(): string } | undefined,
                        error: { name?: string } | undefined
                    ) => {
                        if (result) {
                            const text = result.getText().trim();
                            if (text && shouldEmitScan(text)) {
                                onScan(text);
                            }
                        }
                        // ZXing fires `NotFoundException` continuously while scanning —
                        // this is expected behaviour and should NOT be treated as an error.
                        if (error && error.name !== "NotFoundException") {
                            // Non-critical decode errors are silently ignored to avoid
                            // flooding the console during normal scanning operation.
                        }
                    }
                );

                if (cancelled) {
                    controls.stop();
                    stopMediaStream(stream);
                    return;
                }

                controlsRef.current = controls;
                setStatus("scanning");

                // Check for torch capability on the active stream
                const track = stream.getVideoTracks()[0];
                if (track) {
                    const capabilities = track.getCapabilities ? track.getCapabilities() : {};
                    if ("torch" in capabilities) {
                        setHasTorch(true);
                    }
                }
            } catch (err: unknown) {
                if (cancelled) return;

                const errorObj = err instanceof Error ? err : new Error(String(err));

                if (
                    errorObj.name === "NotAllowedError" ||
                    errorObj.name === "PermissionDeniedError"
                ) {
                    setStatus("permission-denied");
                    setErrorMessage(
                        "Camera access was denied. Please allow camera permissions in your browser settings and try again."
                    );
                } else if (
                    errorObj.name === "NotFoundError" ||
                    errorObj.name === "DevicesNotFoundError" ||
                    errorObj.name === "OverconstrainedError"
                ) {
                    setStatus("unavailable");
                    setErrorMessage("No suitable camera was found on this device.");
                } else if (
                    errorObj.name === "NotReadableError" ||
                    errorObj.name === "TrackStartError"
                ) {
                    setStatus("error");
                    setErrorMessage("Camera is already in use by another application or tab.");
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
        // `onScan` and `shouldEmitScan` are stable via useCallback in the parent
        // and within this component respectively. Re-running the effect on every
        // render would restart the camera unnecessarily, except when `retryCount` changes.
    }, [retryCount]);

    const toggleTorch = async () => {
        const stream = streamRef.current;
        if (!stream) return;
        const track = stream.getVideoTracks()[0];
        if (!track) return;

        const capabilities = track.getCapabilities ? track.getCapabilities() : {};
        if (!("torch" in capabilities)) return;

        const nextTorchState = !torchOn;
        try {
            await track.applyConstraints({
                advanced: [{ torch: nextTorchState } as any],
            });
            setTorchOn(nextTorchState);
        } catch (err) {
            console.error("Failed to toggle torch constraint:", err);
        }
    };

    if (status === "permission-denied") {
        return (
            <LiveMessage
                tone="critical"
                describedBy={permissionDeniedMessageId}
                className="flex flex-col items-center justify-center gap-4 p-6 text-center"
            >
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20">
                    <AlertCircle size={32} className="text-red-400" />
                </div>
                <h3 className="text-lg font-bold text-white">Camera Permission Required</h3>
                <p id={permissionDeniedMessageId} className="max-w-xs text-sm text-slate-400">
                    {errorMessage}
                </p>
                <button
                    onClick={handleRetry}
                    className="rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-bold text-white transition-all duration-300 hover:scale-105 hover:bg-emerald-400 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-black focus:outline-none active:scale-95"
                >
                    Retry
                </button>
            </LiveMessage>
        );
    }

    if (status === "unavailable") {
        return (
            <LiveMessage
                tone="critical"
                describedBy={unavailableMessageId}
                className="flex flex-col items-center justify-center gap-4 p-6 text-center"
            >
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/20">
                    <VideoOff size={32} className="text-amber-400" />
                </div>
                <h3 className="text-lg font-bold text-white">Camera Unavailable</h3>
                <p id={unavailableMessageId} className="max-w-xs text-sm text-slate-400">
                    {errorMessage}
                </p>
            </LiveMessage>
        );
    }

    if (status === "error") {
        return (
            <LiveMessage
                tone="critical"
                describedBy={scannerErrorMessageId}
                className="flex flex-col items-center justify-center gap-4 p-6 text-center"
            >
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20">
                    <AlertCircle size={32} className="text-red-400" />
                </div>
                <h3 className="text-lg font-bold text-white">Scanner Error</h3>
                <p id={scannerErrorMessageId} className="max-w-xs text-sm text-slate-400">
                    {errorMessage}
                </p>
                <button
                    onClick={handleRetry}
                    className="rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-bold text-white transition-all duration-300 hover:scale-105 hover:bg-emerald-400 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-black focus:outline-none active:scale-95"
                >
                    Retry
                </button>
            </LiveMessage>
        );
    }

    return (
        <div className="relative h-full w-full">
            {status === "initializing" && (
                <LiveMessage
                    tone="polite"
                    describedBy={initializingMessageId}
                    className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3"
                >
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/10 border-t-emerald-500" />
                    <p id={initializingMessageId} className="text-sm font-medium text-slate-400">
                        Starting camera…
                    </p>
                </LiveMessage>
            )}
            <video
                ref={videoRef}
                className="h-full w-full object-cover"
                autoPlay
                playsInline
                muted
            />
            {status === "scanning" && (
                <div className="absolute right-3 bottom-3 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 backdrop-blur-sm">
                    <Camera size={14} className="text-emerald-400" />
                    <span className="text-xs font-medium text-emerald-400">Scanning</span>
                </div>
            )}
            {status === "scanning" && hasTorch && (
                <button
                    onClick={toggleTorch}
                    type="button"
                    className="absolute top-4 right-4 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white backdrop-blur-md transition-all duration-300 hover:scale-105 hover:bg-black/85 active:scale-95"
                    title={torchOn ? "Turn off flashlight" : "Turn on flashlight"}
                    aria-label={torchOn ? "Turn off flashlight" : "Turn on flashlight"}
                >
                    {torchOn ? (
                        <Zap className="h-5 w-5 animate-pulse fill-amber-400 text-amber-400" />
                    ) : (
                        <ZapOff className="h-5 w-5 text-white" />
                    )}
                </button>
            )}
        </div>
    );
}
