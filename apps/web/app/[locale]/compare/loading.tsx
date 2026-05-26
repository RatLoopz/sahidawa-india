export default function CompareLoading() {
    return (
        <div className="min-h-screen bg-slate-50 text-slate-900">
            {/* PageHeader Skeleton */}
            <div className="relative border-b border-slate-200 bg-white px-4 py-5">
                <div className="container mx-auto flex max-w-4xl flex-col items-center gap-2">
                    <div className="h-4 w-36 animate-pulse rounded-lg bg-slate-200" />
                    <div className="h-5 w-52 animate-pulse rounded-xl bg-slate-200" />
                </div>
                {/* Back arrow */}
                <div className="absolute top-1/2 left-5 h-8 w-8 -translate-y-1/2 animate-pulse rounded-lg bg-slate-200" />
            </div>

            <main className="container mx-auto max-w-4xl space-y-6 px-4 py-8">
                {/* Search Section Skeleton */}
                <section className="rounded-xl border border-slate-200 bg-white p-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                        {/* First medicine */}
                        <div className="flex flex-col gap-2">
                            <div className="h-4 w-28 animate-pulse rounded-lg bg-slate-200" />
                            <div className="h-10 w-full animate-pulse rounded-lg bg-slate-100" />
                        </div>

                        {/* Second medicine */}
                        <div className="flex flex-col gap-2">
                            <div className="h-4 w-32 animate-pulse rounded-lg bg-slate-200" />
                            <div className="h-10 w-full animate-pulse rounded-lg bg-slate-100" />
                        </div>
                    </div>
                </section>

                {/* Empty state card skeleton — matches "Select two medicines above" card */}
                <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white py-16">
                    <div className="h-4 w-72 animate-pulse rounded-lg bg-slate-200" />
                </div>

                {/* "Find pharmacies" link skeleton */}
                <div className="flex justify-center">
                    <div className="h-4 w-28 animate-pulse rounded-lg bg-slate-200" />
                </div>
            </main>
        </div>
    );
}
