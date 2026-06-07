"use client";

import React from "react";

export function SkeletonLoader() {
    return (
        <div className="animate-in fade-in zoom-in absolute inset-0 z-20 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm duration-300">
            <div className="relative w-full max-w-sm overflow-hidden rounded-[2.5rem] border border-(--color-border-muted) bg-(--color-surface-page) p-8 shadow-2xl">
                <div className="absolute top-0 right-0 left-0 h-2 animate-pulse bg-slate-600" />

                <div className="flex flex-col items-center space-y-4 text-center">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-800 shadow-inner">
                        <div className="h-10 w-10 animate-pulse rounded-full bg-slate-700" />
                    </div>

                    <div className="space-y-2">
                        <div className="mx-auto h-6 w-44 animate-[shimmer_1.5s_infinite] rounded bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 bg-[length:200%_100%]" />
                        <div className="mx-auto h-4 w-36 animate-[shimmer_1.5s_infinite] rounded bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 bg-[length:200%_100%]" />
                    </div>

                    <div className="mx-auto h-6 w-28 animate-pulse rounded-full bg-slate-800" />

                    <div className="grid w-full grid-cols-2 gap-3 pt-2">
                        <div className="space-y-2 rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted) p-3">
                            <div className="mx-auto h-3 w-3/4 animate-pulse rounded bg-slate-800" />
                            <div className="mx-auto h-5 w-1/2 animate-pulse rounded bg-slate-700" />
                        </div>
                        <div className="space-y-2 rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted) p-3">
                            <div className="mx-auto h-3 w-3/4 animate-pulse rounded bg-slate-800" />
                            <div className="mx-auto h-5 w-1/2 animate-pulse rounded bg-slate-700" />
                        </div>
                    </div>

                    <div className="grid w-full grid-cols-2 gap-3">
                        <div className="space-y-2 rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted) p-3">
                            <div className="mx-auto h-3 w-3/4 animate-pulse rounded bg-slate-800" />
                            <div className="mx-auto h-5 w-1/2 animate-pulse rounded bg-slate-700" />
                        </div>
                        <div className="space-y-2 rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted) p-3">
                            <div className="mx-auto h-3 w-3/4 animate-pulse rounded bg-slate-800" />
                            <div className="mx-auto h-5 w-1/2 animate-pulse rounded bg-slate-700" />
                        </div>
                    </div>

                    <div className="mx-auto h-12 w-full animate-pulse rounded-2xl bg-slate-800" />

                    <div className="flex w-full gap-3">
                        <div className="h-4 flex-1 animate-pulse rounded bg-slate-800" />
                        <div className="h-4 w-16 animate-pulse rounded bg-slate-800" />
                    </div>
                </div>
            </div>
        </div>
    );
}
