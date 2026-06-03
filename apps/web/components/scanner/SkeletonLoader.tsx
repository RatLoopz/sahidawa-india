"use client";

import React from "react";

export function SkeletonLoader() {
    return (
        <div className="animate-fadeIn mx-auto mt-4 w-full max-w-md space-y-5 rounded-2xl border border-emerald-500/20 bg-slate-900/40 p-5 shadow-xl backdrop-blur-md">
            {/* 1. Header Metadata Processing Title */}
            <div className="flex items-center gap-3">
                <div className="h-10 w-10 animate-pulse rounded-xl border border-emerald-500/20 bg-emerald-500/10" />
                <div className="flex-1 space-y-2">
                    <div className="h-4 w-1/3 animate-pulse rounded bg-emerald-500/20" />
                    <div className="h-3 w-1/4 animate-pulse rounded bg-slate-700" />
                </div>
            </div>

            <div className="border-b border-white/5" />

            {/* 2. Mimic Prescription Image Frame with Sliding Shimmer Loop */}
            <div className="relative flex h-40 w-full animate-[shimmer_1.5s_infinite] flex-col items-center justify-center gap-2 rounded-xl border border-white/5 bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 bg-[length:200%_100%]">
                <div className="h-2 w-24 animate-bounce rounded bg-emerald-400/40" />
                <span className="font-mono text-2xl font-bold tracking-widest text-emerald-400/60">
                    OCR
                </span>
            </div>

            {/* 3. Text Extraction Matrix Line Placeholders */}
            <div className="space-y-2.5">
                <div className="h-3 w-full animate-pulse rounded bg-slate-800" />
                <div className="h-3 w-11/12 animate-pulse rounded bg-slate-800" />
                <div className="h-3 w-3/4 animate-pulse rounded bg-slate-700/60" />
            </div>

            {/* 4. Verified Metadata Action Pill Footers */}
            <div className="flex gap-2 pt-1">
                <div className="h-5 w-16 animate-pulse rounded-full border border-emerald-500/20 bg-emerald-500/10" />
                <div className="h-5 w-20 animate-pulse rounded-full bg-slate-800" />
            </div>
        </div>
    );
}
