import { useEffect, useRef, useState } from "react";
import { detectPackaging } from "@/lib/vision/detectPackaging";

const CHECK_INTERVAL_MS = 500;

export function usePackagingHint(
    videoRef: React.RefObject<HTMLVideoElement | null>,
    enabled: boolean
) {
    const [looksLikePackaging, setLooksLikePackaging] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        if (!enabled) return;
        if (!canvasRef.current) {
            canvasRef.current = document.createElement("canvas");
        }

        let cancelled = false;
        const canvas = canvasRef.current;

        const intervalId = window.setInterval(async () => {
            const video = videoRef.current;
            if (!video || video.readyState < video.HAVE_CURRENT_DATA) return;

            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext("2d");
            if (!ctx) return;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            try {
                const result = await detectPackaging(canvas);
                if (!cancelled) setLooksLikePackaging(result.looksLikePackaging);
            } catch (err) {
                // OpenCV not loaded yet, or a transient frame error — skip silently in prod
                if (process.env.NODE_ENV === "development") {
                    console.debug("Transient packaging detection error:", err);
                }
            }
        }, CHECK_INTERVAL_MS);

        return () => {
            cancelled = true;
            window.clearInterval(intervalId);
        };
    }, [videoRef, enabled]);

    return looksLikePackaging;
}
