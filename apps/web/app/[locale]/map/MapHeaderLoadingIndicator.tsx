"use client";

import { Loader2 } from "lucide-react";

export default function MapHeaderLoadingIndicator() {
    return (
        <div
            data-testid="pharmacy-header-loading-card"
            role="status"
            aria-live="polite"
            className="flex min-w-0 items-center gap-3 rounded-2xl border border-emerald-200/70 bg-emerald-50/90 px-3 py-2 text-left shadow-sm ring-1 ring-emerald-500/10 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:ring-emerald-400/10"
        >
            <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-emerald-600 shadow-sm dark:bg-slate-950">
                <span className="absolute h-8 w-8 animate-ping rounded-full bg-emerald-400/30" />
                <Loader2 size={15} className="relative animate-spin" aria-hidden />
            </div>
            <div className="min-w-0">
                <span className="block truncate text-[11px] font-black text-(--color-text-primary)">
                    Finding trusted pharmacies
                </span>
                <span className="block truncate text-[10px] font-semibold text-(--color-text-secondary)">
                    Checking verified partners and OSM stores
                </span>
            </div>
            <div aria-hidden="true" className="ml-auto hidden items-center gap-1.5 sm:flex">
                <span className="h-1.5 w-7 animate-pulse rounded-full bg-emerald-300/80" />
                <span className="h-1.5 w-4 animate-pulse rounded-full bg-emerald-200/80 [animation-delay:150ms]" />
                <span className="h-1.5 w-2 animate-pulse rounded-full bg-emerald-100 [animation-delay:300ms] dark:bg-emerald-900" />
            </div>
        </div>
    );
}
