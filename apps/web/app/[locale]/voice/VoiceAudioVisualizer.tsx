"use client";

import { useEffect, useRef } from "react";

type WindowWithWebkitAudio = Window & {
    webkitAudioContext?: typeof AudioContext;
};

export function VoiceAudioVisualizer({
    stream,
    isActive,
    isFading,
    animationsEnabled,
    visualizerLabel,
    volumeLabel,
    liveVolumeLabel,
    stillVolumeLabel,
    visualizerUnavailableLabel,
}: {
    stream: MediaStream | null;
    isActive: boolean;
    isFading: boolean;
    animationsEnabled: boolean;
    visualizerLabel: string;
    volumeLabel: string;
    liveVolumeLabel: string;
    stillVolumeLabel: string;
    visualizerUnavailableLabel: string;
}) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const volumeFillRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!stream || !isActive || !animationsEnabled || typeof window === "undefined") {
            return;
        }

        const canvasElement = canvasRef.current;
        if (!canvasElement) {
            return;
        }

        const AudioContextConstructor =
            window.AudioContext ?? (window as WindowWithWebkitAudio).webkitAudioContext;
        const drawingContext = canvasElement.getContext("2d");

        if (!AudioContextConstructor || !drawingContext) {
            return;
        }

        const canvas = canvasElement;
        const canvasContext = drawingContext;

        const audioContext = new AudioContextConstructor();
        const analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(stream);
        let waveform = new Uint8Array(analyser.fftSize);
        let animationFrame = 0;
        let disposed = false;
        let width = 0;
        let height = 0;

        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.82;
        waveform = new Uint8Array(analyser.fftSize);
        source.connect(analyser);

        function resizeCanvas() {
            const rect = canvas.getBoundingClientRect();
            const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
            width = Math.max(1, rect.width);
            height = Math.max(1, rect.height);
            canvas.width = Math.floor(width * pixelRatio);
            canvas.height = Math.floor(height * pixelRatio);
            canvasContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        }

        const resizeObserver =
            typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => resizeCanvas());

        resizeCanvas();
        resizeObserver?.observe(canvas);

        function draw(timestamp: number) {
            if (disposed) {
                return;
            }

            analyser.getByteTimeDomainData(waveform);

            let squaredTotal = 0;
            for (let index = 0; index < waveform.length; index += 1) {
                const normalized = (waveform[index] - 128) / 128;
                squaredTotal += normalized * normalized;
            }

            const volume = Math.min(1, Math.sqrt(squaredTotal / waveform.length) * 3.4);
            const idlePulse = 0.16 + Math.sin(timestamp / 520) * 0.06;
            const visualIntensity = Math.max(volume, idlePulse);
            const centerY = height / 2;
            const amplitude = 8 + visualIntensity * 34;
            const sampleCount = 56;
            const step = Math.max(1, Math.floor(waveform.length / sampleCount));

            canvasContext.clearRect(0, 0, width, height);

            const glowGradient = canvasContext.createLinearGradient(0, 0, width, 0);
            glowGradient.addColorStop(0, "rgba(16, 185, 129, 0.05)");
            glowGradient.addColorStop(0.5, `rgba(52, 211, 153, ${0.12 + visualIntensity * 0.16})`);
            glowGradient.addColorStop(1, "rgba(16, 185, 129, 0.05)");
            canvasContext.fillStyle = glowGradient;
            canvasContext.fillRect(0, centerY - amplitude - 10, width, amplitude * 2 + 20);

            const strokeGradient = canvasContext.createLinearGradient(0, 0, width, 0);
            strokeGradient.addColorStop(0, "rgba(16, 185, 129, 0.25)");
            strokeGradient.addColorStop(
                0.5,
                `rgba(110, 231, 183, ${0.66 + visualIntensity * 0.28})`
            );
            strokeGradient.addColorStop(1, "rgba(5, 150, 105, 0.38)");

            canvasContext.beginPath();
            canvasContext.lineWidth = 3;
            canvasContext.lineCap = "round";
            canvasContext.lineJoin = "round";
            canvasContext.strokeStyle = strokeGradient;

            let previousX = 0;
            let previousY = centerY;

            for (let point = 0; point <= sampleCount; point += 1) {
                const dataIndex = Math.min(waveform.length - 1, point * step);
                const normalized = (waveform[dataIndex] - 128) / 128;
                const x = (point / sampleCount) * width;
                const y =
                    centerY +
                    normalized * amplitude +
                    Math.sin(timestamp / 260 + point * 0.34) * (volume < 0.05 ? 5 : 2);

                if (point === 0) {
                    canvasContext.moveTo(x, y);
                } else {
                    const midpointX = (previousX + x) / 2;
                    const midpointY = (previousY + y) / 2;
                    canvasContext.quadraticCurveTo(previousX, previousY, midpointX, midpointY);
                }

                previousX = x;
                previousY = y;
            }

            canvasContext.lineTo(width, previousY);
            canvasContext.stroke();

            canvasContext.globalAlpha = 0.28;
            canvasContext.beginPath();
            canvasContext.lineWidth = 8;
            canvasContext.strokeStyle = strokeGradient;
            canvasContext.moveTo(0, centerY);
            canvasContext.bezierCurveTo(
                width * 0.25,
                centerY - amplitude * 0.5,
                width * 0.75,
                centerY + amplitude * 0.5,
                width,
                centerY
            );
            canvasContext.stroke();
            canvasContext.globalAlpha = 1;

            if (volumeFillRef.current) {
                volumeFillRef.current.style.transform = `scaleX(${Math.max(0.08, volume)})`;
            }

            animationFrame = window.requestAnimationFrame(draw);
        }

        animationFrame = window.requestAnimationFrame(draw);

        return () => {
            disposed = true;
            window.cancelAnimationFrame(animationFrame);
            resizeObserver?.disconnect();
            source.disconnect();
            analyser.disconnect();
            if (audioContext.state !== "closed") {
                void audioContext.close();
            }
        };
    }, [stream, isActive, animationsEnabled]);

    const showCanvas = Boolean(stream && animationsEnabled);
    const fallbackShouldPulse = animationsEnabled && !stream && isActive;

    return (
        <div
            className={`flex h-28 w-full max-w-sm flex-col items-center justify-center transition-opacity duration-300 ${
                isActive && !isFading ? "opacity-100" : "opacity-70"
            }`}
            role="img"
            aria-label={visualizerLabel}
        >
            {showCanvas ? (
                <canvas
                    ref={canvasRef}
                    aria-hidden="true"
                    className="h-20 w-full rounded-2xl border border-emerald-100/80 bg-emerald-50/40"
                />
            ) : (
                <div className="flex h-20 w-full flex-col items-center justify-center rounded-2xl border border-emerald-100/80 bg-emerald-50/50">
                    <span
                        className={`h-4 w-4 rounded-full bg-emerald-500 ${
                            fallbackShouldPulse ? "motion-safe:animate-pulse" : ""
                        }`}
                        aria-hidden="true"
                    />
                    <span className="mt-3 text-xs font-bold tracking-widest text-emerald-700 uppercase">
                        {visualizerUnavailableLabel}
                    </span>
                </div>
            )}

            <div className="mt-3 w-full max-w-[13rem]">
                <div className="flex items-center justify-between text-[10px] font-bold tracking-widest text-emerald-700 uppercase">
                    <span>{volumeLabel}</span>
                    <span aria-hidden="true">
                        {animationsEnabled ? liveVolumeLabel : stillVolumeLabel}
                    </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-emerald-100">
                    <div
                        ref={volumeFillRef}
                        className="h-full origin-left rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300 transition-transform duration-150"
                        style={{ transform: showCanvas ? "scaleX(0.08)" : "scaleX(0.18)" }}
                        aria-hidden="true"
                    />
                </div>
            </div>
        </div>
    );
}
