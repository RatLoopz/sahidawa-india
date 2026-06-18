import React from "react";
import { Loader2 } from "lucide-react";

interface ScanLoadersProps {
    status: "idle" | "compressing" | "ocr" | "matching" | "done" | "error";
    statusMessage: string;
    progress: number;
}

export function ScanLoaders({ status, statusMessage, progress }: ScanLoadersProps) {
    if (status !== "compressing" && status !== "ocr" && status !== "matching") return null;

    return (
        <div className="relative space-y-6 overflow-hidden rounded-3xl border border-(--color-border-muted) bg-(--color-surface-muted) p-8 text-center shadow-xl">
            {/* Simulated laser scan line */}
            {status === "ocr" && (
                <div className="animate-scan absolute right-4 left-4 z-20 h-[2.5px] bg-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.8)]"></div>
            )}

            <div className="flex justify-center">
                <Loader2 className="animate-spin text-emerald-500" size={48} />
            </div>

            <div className="mx-auto max-w-sm space-y-2">
                <p className="text-base font-bold text-(--color-text-primary)">{statusMessage}</p>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div
                        className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                        style={{
                            width:
                                status === "compressing"
                                    ? `${progress}%`
                                    : status === "ocr"
                                      ? "60%"
                                      : "90%",
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
