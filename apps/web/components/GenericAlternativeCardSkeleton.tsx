import React from "react";

const GenericAlternativeCardSkeleton = () => {
    return (
        <div className="group relative w-full animate-pulse overflow-hidden rounded-[2.5rem] border border-emerald-500/20 bg-linear-to-b from-white to-emerald-50/10 p-6 text-(--color-text-primary) shadow-xl">
            {/* Ambient Background Glow Skeleton */}
            <div className="pointer-events-none absolute -top-16 -right-16 h-32 w-32 rounded-full bg-gray-200/50 blur-2xl"></div>

            <div className="flex flex-col space-y-5">
                {/* Header Badge Skeleton */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 rounded-full bg-gray-200 px-3.5 py-1">
                        <div className="h-3 w-3 rounded-full bg-gray-300"></div>
                        <div className="h-3 w-32 rounded bg-gray-300"></div>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="h-4 w-4 rounded bg-gray-300"></div>
                        <div className="h-4 w-20 rounded bg-gray-300"></div>
                    </div>
                </div>

                {/* Brand vs Generic Comparison Skeleton */}
                <div className="space-y-4">
                    {/* Prescribed Brand Skeleton */}
                    <div className="flex items-start justify-between gap-4 rounded-2xl border border-dashed border-(--color-border-muted) bg-slate-50/50 p-4 dark:bg-slate-800/10">
                        <div className="space-y-2">
                            <div className="h-3 w-24 rounded bg-gray-300"></div>
                            <div className="h-5 w-32 rounded bg-gray-300"></div>
                            <div className="h-3 w-40 rounded bg-gray-300"></div>
                        </div>
                        <div className="space-y-1 text-right">
                            <div className="ml-auto h-3 w-8 rounded bg-gray-300"></div>
                            <div className="h-6 w-16 rounded bg-gray-300"></div>
                        </div>
                    </div>

                    {/* Generic Alternative Skeleton */}
                    <div className="flex items-start justify-between gap-4 rounded-2xl border border-emerald-500/25 bg-emerald-50/30 p-4 dark:border-emerald-500/15 dark:bg-emerald-950/10">
                        <div className="space-y-2">
                            <div className="h-3 w-32 rounded bg-gray-300"></div>
                            <div className="flex items-center gap-1.5">
                                <div className="h-4 w-4 rounded bg-gray-300"></div>
                                <div className="h-5 w-28 rounded bg-gray-300"></div>
                            </div>
                            <div className="h-3 w-40 rounded bg-gray-300"></div>
                        </div>
                        <div className="space-y-1 text-right">
                            <div className="ml-auto h-3 w-10 rounded bg-gray-300"></div>
                            <div className="h-7 w-16 rounded bg-gray-300"></div>
                        </div>
                    </div>
                </div>

                {/* Savings Summary Banner Skeleton */}
                <div className="rounded-2xl bg-gray-200 p-4 text-center">
                    <div className="mx-auto mb-2 h-3 w-32 rounded bg-gray-300"></div>
                    <div className="mx-auto h-6 w-48 rounded bg-gray-300"></div>
                </div>

                {/* Nearest Store Info Skeleton */}
                <div className="flex items-start gap-3 rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted) p-4">
                    <div className="mt-1 rounded-xl bg-gray-200 p-2">
                        <div className="h-5 w-5 rounded bg-gray-300"></div>
                    </div>
                    <div className="flex-1 space-y-2">
                        <div className="h-3 w-40 rounded bg-gray-300"></div>
                        <div className="h-4 w-48 rounded bg-gray-300"></div>
                        <div className="h-3 w-32 rounded bg-gray-300"></div>
                    </div>
                </div>

                {/* Call to Action Button Skeleton */}
                <div className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gray-300 py-3.5">
                    <div className="h-4 w-44 rounded bg-gray-400"></div>
                    <div className="h-4 w-4 rounded bg-gray-400"></div>
                </div>
            </div>
        </div>
    );
};

export default GenericAlternativeCardSkeleton;
