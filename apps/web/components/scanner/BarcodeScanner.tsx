"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, NotFoundException } from "@zxing/library";
import { Zap, ZapOff, AlertCircle } from "lucide-react";

interface BarcodeScannerProps {
    onScanSuccess: (result: string) => void;
    onError?: (error: Error) => void;
}

export default function BarcodeScanner({ onScanSuccess, onError }: BarcodeScannerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [hasTorch, setHasTorch] = useState(false);
    const [torchOn, setTorchOn] = useState(false);
    const [initError, setInitError] = useState<string | null>(null);
    const readerRef = useRef<BrowserMultiFormatReader | null>(null);

    useEffect(() => {
        let activeStream: MediaStream | null = null;
        const codeReader = new BrowserMultiFormatReader();
        readerRef.current = codeReader;

        const startCamera = async () => {
            if (!videoRef.current) return;
            try {
                // Use decodeFromConstraints to support facingMode environment and start scanning
                await codeReader.decodeFromConstraints(
                    {
                        video: {
                            facingMode: "environment",
                            width: { ideal: 1280 },
                            height: { ideal: 720 },
                        },
                    },
                    videoRef.current,
                    (result, err) => {
                        if (result) {
                            onScanSuccess(result.getText());
                        }
                        if (err && !(err instanceof NotFoundException)) {
                            // Non-critical decoding errors are ignored (normal operation)
                            console.debug("ZXing decode error:", err);
                        }
                    }
                );

                // Detect torch capability after the stream is active
                const stream = videoRef.current.srcObject as MediaStream;
                if (stream) {
                    activeStream = stream;
                    const track = stream.getVideoTracks()[0];
                    if (track) {
                        // Check capabilities
                        const capabilities = track.getCapabilities ? track.getCapabilities() : {};
                        if ("torch" in capabilities) {
                            setHasTorch(true);
                        }
                    }
                }
            } catch (err) {
                console.error("Failed to start barcode scanner:", err);
                const errorMessage = err instanceof Error ? err.message : "Unable to access camera";
                setInitError(errorMessage);
                if (onError) {
                    onError(err instanceof Error ? err : new Error(errorMessage));
                }
            }
        };

        startCamera();

        return () => {
            // Clean up and stop camera
            if (activeStream) {
                activeStream.getTracks().forEach((track) => track.stop());
            }
            codeReader.reset();
        };
    }, [onScanSuccess, onError]);

    const toggleTorch = async () => {
        if (!videoRef.current) return;
        const stream = videoRef.current.srcObject as MediaStream;
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

    if (initError) {
        return (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 p-4 text-center">
                <AlertCircle className="mb-2 h-10 w-10 text-red-500" />
                <p className="text-sm font-semibold text-slate-200">Camera Access Error</p>
                <p className="mt-1 text-xs text-slate-400 max-w-xs">{initError}</p>
            </div>
        );
    }

    return (
        <div className="relative h-full w-full overflow-hidden">
            <video
                ref={videoRef}
                className="h-full w-full object-cover"
                playsInline
                muted
            />
            {hasTorch && (
                <button
                    onClick={toggleTorch}
                    type="button"
                    className="absolute top-4 right-4 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white backdrop-blur-md transition-all hover:bg-black/80 active:scale-95"
                    title={torchOn ? "Turn off flashlight" : "Turn on flashlight"}
                    aria-label={torchOn ? "Turn off flashlight" : "Turn on flashlight"}
                >
                    {torchOn ? (
                        <Zap className="h-5 w-5 text-amber-400 fill-amber-400" />
                    ) : (
                        <ZapOff className="h-5 w-5 text-white" />
                    )}
                </button>
            )}
        </div>
    );
}
