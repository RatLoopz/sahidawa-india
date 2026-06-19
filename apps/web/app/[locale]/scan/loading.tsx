export default function ScanLoading() {
    return (
        <div className="relative flex min-h-screen flex-col bg-black font-sans text-white">
            {/* Header Skeleton */}
            <div className="absolute top-0 right-0 left-0 z-20 flex items-center gap-4 bg-transparent px-4 py-3">
                <div className="h-12 w-12 shrink-0 animate-pulse rounded-2xl bg-white/10" />

                <div className="space-y-2">
                    <div className="h-4 w-36 animate-pulse rounded-full bg-white/15" />

                    <div className="h-3 w-24 animate-pulse rounded-full bg-white/10" />
                </div>
            </div>

            {/* Viewfinder Area */}
            <div className="relative flex flex-1 items-center justify-center overflow-hidden">
                {/* Background */}
                <div className="absolute inset-0 bg-slate-900">
                    <div className="absolute inset-0 animate-pulse bg-emerald-500/5" />
                </div>

                {/* Scanner Frame */}
                <div className="relative z-10 h-72 w-72 md:h-96 md:w-96">
                    <div className="absolute top-0 left-0 h-12 w-12 rounded-tl-2xl border-t-4 border-l-4 border-emerald-500" />

                    <div className="absolute top-0 right-0 h-12 w-12 rounded-tr-2xl border-t-4 border-r-4 border-emerald-500" />

                    <div className="absolute bottom-0 left-0 h-12 w-12 rounded-bl-2xl border-b-4 border-l-4 border-emerald-500" />

                    <div className="absolute right-0 bottom-0 h-12 w-12 rounded-br-2xl border-r-4 border-b-4 border-emerald-500" />

                    {/* Spinner */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="h-16 w-16 animate-spin rounded-full border-4 border-white/10 border-t-emerald-500" />
                    </div>
                </div>
            </div>

            {/* Bottom Guidance */}
            <div className="flex flex-col items-center gap-6 bg-gradient-to-t from-black to-transparent p-8">
                <div className="h-3 w-64 animate-pulse rounded-full bg-white/10" />

                <div className="flex gap-4">
                    <div className="h-12 w-40 animate-pulse rounded-full bg-white/10" />

                    <div className="h-12 w-12 animate-pulse rounded-2xl bg-white/10" />
                </div>
            </div>
        </div>
    );
}
