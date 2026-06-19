export default function Loading() {
    return (
        <div className="min-h-screen bg-(--color-surface-page) p-6 text-(--color-text-primary)">
            <div className="mx-auto max-w-3xl">
                {/* Title Skeleton */}
                <div className="mb-6 h-10 w-64 animate-pulse rounded-xl bg-white/5" />

                {/* Action Buttons Skeleton */}
                <div className="mb-6 flex flex-wrap gap-3">
                    <div className="h-10 w-36 animate-pulse rounded-xl bg-white/5" />
                    <div className="h-10 w-36 animate-pulse rounded-xl bg-white/5" />
                </div>

                {/* Stats Summary Grid Skeleton */}
                <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-4">
                    {[...Array(4)].map((_, i) => (
                        <div
                            key={i}
                            className="h-24 animate-pulse rounded-2xl border border-white/10 bg-white/5"
                        />
                    ))}
                </div>

                {/* History Cards List Skeleton */}
                <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                        <div
                            key={i}
                            className="h-[128px] animate-pulse rounded-2xl border border-white/10 bg-white/5"
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
