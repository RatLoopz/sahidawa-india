import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
    return (
        <div className="min-h-screen bg-(--color-surface-page) p-6 text-(--color-text-primary)">
            <div className="mx-auto max-w-3xl">
                {/* Title + connection status badge */}
                <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                    <Skeleton className="h-10 w-64 rounded-xl" />
                    <Skeleton className="h-6 w-28 rounded-full" />
                </div>

                {/* Action Buttons Skeleton */}
                <div className="mb-6 flex flex-wrap gap-3">
                    <Skeleton className="h-10 w-36 rounded-xl" />
                    <Skeleton className="h-10 w-36 rounded-xl" />
                </div>

                {/* Stats Summary Grid Skeleton */}
                <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-4">
                    {[...Array(4)].map((_, i) => (
                        <Skeleton key={i} className="h-24 rounded-2xl border border-white/10" />
                    ))}
                </div>

                {/* Filter / search bar skeleton (matches the real controls row) */}
                <div className="mb-4 flex flex-wrap gap-3">
                    <Skeleton className="min-w-[200px] flex-1 rounded-xl" />
                    <Skeleton className="h-10 w-28 rounded-xl" />
                    <Skeleton className="h-10 w-32 rounded-xl" />
                </div>

                {/* History Cards List Skeleton — mirrors a real history card's
                    internal layout (title, status, timestamp, delete button)
                    to avoid Cumulative Layout Shift when content arrives. */}
                <div className="space-y-4">
                    {[...Array(5)].map((_, i) => (
                        <div
                            key={i}
                            className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg backdrop-blur-sm"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="w-full">
                                    <div className="flex items-center gap-1">
                                        <Skeleton className="h-6 w-40" />
                                        <Skeleton className="h-5 w-5 rounded-md" />
                                    </div>
                                    <Skeleton className="mt-2 h-4 w-28" />
                                    <Skeleton className="mt-2 h-4 w-44" />
                                </div>
                                <Skeleton className="h-9 w-20 rounded-lg" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
