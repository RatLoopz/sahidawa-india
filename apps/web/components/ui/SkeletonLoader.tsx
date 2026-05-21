import React from "react";

export interface SkeletonLoaderProps {
    type?: "card" | "list" | "search" | "details" | "generic";
    count?: number;
    className?: string;
}

export function SkeletonLoader({ type = "generic", count = 1, className = "" }: SkeletonLoaderProps) {
    const elements = Array.from({ length: count }, (_, i) => i);

    if (type === "card") {
        return (
            <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${className}`}>
                {elements.map((i) => (
                    <div
                        key={i}
                        className="flex animate-pulse gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
                    >
                        <div className="h-10 w-10 shrink-0 rounded-full bg-slate-200"></div>
                        <div className="flex-1 space-y-2 py-1">
                            <div className="h-4 w-3/4 rounded bg-slate-200"></div>
                            <div className="h-3 w-1/2 rounded bg-slate-200"></div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (type === "list") {
        return (
            <div className={`flex flex-col gap-3 ${className}`}>
                {elements.map((i) => (
                    <div
                        key={i}
                        className="flex animate-pulse items-start gap-3 rounded-xl border border-slate-100 bg-white p-4 shadow-sm"
                    >
                        <div className="h-9 w-9 shrink-0 rounded-lg bg-slate-200"></div>
                        <div className="flex-1 space-y-2">
                            <div className="h-4 w-2/3 rounded bg-slate-200"></div>
                            <div className="h-3 w-1/3 rounded bg-slate-200"></div>
                            <div className="mt-2 h-3 w-1/4 rounded bg-slate-200"></div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (type === "search") {
        return (
            <div className={`flex flex-col ${className}`}>
                {elements.map((i) => (
                    <div
                        key={i}
                        className="flex animate-pulse items-center gap-3 border-b border-slate-100 px-4 py-3"
                    >
                        <div className="h-8 w-8 shrink-0 rounded-full bg-slate-200"></div>
                        <div className="flex-1 space-y-2">
                            <div className="h-4 w-1/2 rounded bg-slate-200"></div>
                            <div className="h-3 w-1/4 rounded bg-slate-200"></div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (type === "details") {
        return (
            <div className={`space-y-4 ${className}`}>
                <div className="h-48 w-full animate-pulse rounded-2xl bg-slate-200"></div>
                <div className="space-y-2">
                    <div className="h-6 w-3/4 animate-pulse rounded bg-slate-200"></div>
                    <div className="h-4 w-1/2 animate-pulse rounded bg-slate-200"></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="h-16 w-full animate-pulse rounded-xl bg-slate-200"></div>
                    <div className="h-16 w-full animate-pulse rounded-xl bg-slate-200"></div>
                </div>
            </div>
        );
    }

    // generic
    return (
        <div className={`flex flex-col gap-4 ${className}`}>
            {elements.map((i) => (
                <div key={i} className="h-24 w-full animate-pulse rounded-xl bg-slate-200"></div>
            ))}
        </div>
    );
}
