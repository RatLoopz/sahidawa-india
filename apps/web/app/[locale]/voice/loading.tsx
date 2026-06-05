export default function VoiceLoading() {
    return (
        <div className="relative flex min-h-screen flex-col overflow-hidden bg-slate-50">
            {/* Decorative blobs — matches real page */}
            <div className="absolute top-0 right-0 -mt-20 -mr-20 h-96 w-96 rounded-full bg-emerald-100/40 blur-3xl" />
            <div className="absolute bottom-0 left-0 -mb-20 -ml-20 h-80 w-80 rounded-full bg-blue-100/40 blur-3xl" />

            {/* Header skeleton */}
            <div className="relative z-10 flex items-center gap-4 px-6 pt-14 pb-4">
                <div className="h-10 w-10 animate-pulse rounded-2xl bg-slate-200" />
                <div className="space-y-1.5">
                    <div className="h-3.5 w-28 animate-pulse rounded-full bg-slate-200" />
                    <div className="h-2.5 w-20 animate-pulse rounded-full bg-slate-200" />
                </div>
            </div>

            {/* Center content skeleton */}
            <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-8 px-6">
                {/* Title skeleton */}
                <div className="flex flex-col items-center space-y-3">
                    <div className="h-8 w-52 animate-pulse rounded-2xl bg-slate-200" />
                    <div className="h-3 w-64 animate-pulse rounded-full bg-slate-200" />
                    <div className="h-3 w-44 animate-pulse rounded-full bg-slate-200" />
                </div>

                {/* Feature cards skeleton */}
                <div className="grid w-full max-w-sm grid-cols-2 gap-4">
                    <div className="space-y-2 rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
                        <div className="h-5 w-5 animate-pulse rounded-md bg-slate-200" />
                        <div className="h-2.5 w-16 animate-pulse rounded-full bg-slate-200" />
                        <div className="h-3.5 w-24 animate-pulse rounded-full bg-slate-200" />
                    </div>
                    <div className="space-y-2 rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
                        <div className="h-5 w-5 animate-pulse rounded-md bg-slate-200" />
                        <div className="h-2.5 w-16 animate-pulse rounded-full bg-slate-200" />
                        <div className="h-3.5 w-20 animate-pulse rounded-full bg-slate-200" />
                    </div>
                </div>
            </div>

            {/* Mic button skeleton — pulsing circle, microphone-loading feel */}
            <div className="relative z-10 flex flex-col items-center gap-6 p-12">
                <div className="relative flex items-center justify-center">
                    {/* Outer pulse rings */}
                    <div
                        className="absolute h-24 w-24 animate-pulse rounded-full bg-emerald-400/20"
                        style={{ animationDuration: "1.6s" }}
                    />
                    <div
                        className="absolute h-32 w-32 animate-pulse rounded-full bg-emerald-400/10"
                        style={{ animationDuration: "2.2s" }}
                    />
                    {/* Mic button shimmer */}
                    <div className="h-24 w-24 animate-pulse rounded-full bg-emerald-200" />
                </div>
                <div className="h-3 w-24 animate-pulse rounded-full bg-slate-200" />
            </div>

            {/* Footer text skeleton */}
            <div className="flex justify-center p-8">
                <div className="h-2.5 w-56 animate-pulse rounded-full bg-slate-200" />
            </div>
        </div>
    );
}
