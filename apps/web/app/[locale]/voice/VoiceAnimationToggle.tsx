"use client";

import { Activity, Sparkles } from "lucide-react";

export function VoiceAnimationToggle({
    label,
    liveLabel,
    reducedMotionLabel,
    enabled,
    onToggle,
}: {
    label: string;
    liveLabel: string;
    reducedMotionLabel: string;
    enabled: boolean;
    onToggle: (enabled: boolean) => void;
}) {
    return (
        <div className="mt-4 rounded-2xl border border-emerald-100 bg-white/95 p-1.5 shadow-sm shadow-slate-200/80">
            <button
                type="button"
                role="switch"
                aria-checked={enabled}
                onClick={() => onToggle(!enabled)}
                className="group flex w-full items-center justify-between gap-4 rounded-xl px-3 py-2.5 text-left transition-all duration-300 hover:bg-emerald-50/70 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:outline-none"
            >
                <span className="flex min-w-0 items-center gap-3">
                    <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-300 ${
                            enabled
                                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/25"
                                : "bg-slate-100 text-slate-500"
                        }`}
                        aria-hidden="true"
                    >
                        {enabled ? <Sparkles size={17} /> : <Activity size={17} />}
                    </span>
                    <span className="min-w-0">
                        <span className="block text-sm font-black text-slate-800">{label}</span>
                        <span
                            className={`mt-0.5 block text-[10px] font-bold tracking-widest uppercase ${
                                enabled ? "text-emerald-700" : "text-slate-400"
                            }`}
                            aria-hidden="true"
                        >
                            {enabled ? liveLabel : reducedMotionLabel}
                        </span>
                    </span>
                </span>
                <span
                    className={`relative flex h-8 w-14 shrink-0 items-center rounded-full p-1 transition-all duration-300 ${
                        enabled ? "bg-emerald-600 shadow-lg shadow-emerald-500/25" : "bg-slate-200"
                    }`}
                    aria-hidden="true"
                >
                    <span
                        className={`h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-300 ${
                            enabled ? "translate-x-6" : "translate-x-0"
                        }`}
                    />
                </span>
            </button>
        </div>
    );
}
