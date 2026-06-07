export function MedicineResultSkeleton() {
    return (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
            <div className="relative w-full max-w-sm overflow-hidden rounded-[2.5rem] bg-white p-8 text-slate-900 shadow-2xl">
                <div className="absolute top-0 right-0 left-0 h-2 animate-pulse bg-emerald-500"></div>
                <div className="flex flex-col items-center space-y-4 text-center">
                    <div className="h-20 w-20 animate-pulse rounded-full bg-gray-200"></div>
                    <div className="w-full space-y-2">
                        <div className="mx-auto h-7 w-3/4 animate-pulse rounded-lg bg-gray-200"></div>
                        <div className="mx-auto h-4 w-1/2 animate-pulse rounded-lg bg-gray-200"></div>
                    </div>
                    <div className="grid w-full grid-cols-2 gap-3 pt-2">
                        <div className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                            <div className="mx-auto h-3 w-3/4 animate-pulse rounded bg-gray-200"></div>
                            <div className="mx-auto h-5 w-1/2 animate-pulse rounded bg-gray-200"></div>
                        </div>
                        <div className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                            <div className="mx-auto h-3 w-3/4 animate-pulse rounded bg-gray-200"></div>
                            <div className="mx-auto h-5 w-1/2 animate-pulse rounded bg-gray-200"></div>
                        </div>
                    </div>
                    <div className="w-full space-y-2 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                        <div className="h-4 w-full animate-pulse rounded bg-gray-200"></div>
                        <div className="h-4 w-5/6 animate-pulse rounded bg-gray-200"></div>
                    </div>
                    <div className="h-12 w-full animate-pulse rounded-2xl bg-gray-200 py-4"></div>
                    <div className="h-4 w-24 animate-pulse rounded bg-gray-200"></div>
                </div>
            </div>
        </div>
    );
}
