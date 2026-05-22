export default function MapLoading() {
    return (
        <div className="flex h-screen flex-col overflow-hidden bg-slate-50 font-sans">
            <div className="z-30 flex items-center gap-3 border-b border-slate-100 bg-white px-4 py-3 shadow-sm">
                <div className="h-9 w-9 shrink-0 animate-pulse rounded-xl bg-slate-100" />
                <div className="h-10 flex-1 animate-pulse rounded-2xl bg-slate-100" />
            </div>

            <div className="z-20 border-b border-slate-100 bg-white px-4 pt-3 pb-5 shadow-sm">
                <div className="flex gap-2">
                    <div className="h-8 w-24 animate-pulse rounded-full bg-slate-200" />
                    <div
                        className="h-8 w-32 animate-pulse rounded-full bg-emerald-100"
                        style={{ animationDelay: "80ms" }}
                    />
                    <div
                        className="h-8 w-24 animate-pulse rounded-full bg-slate-100"
                        style={{ animationDelay: "160ms" }}
                    />
                    <div
                        className="h-8 w-20 animate-pulse rounded-full bg-slate-100"
                        style={{ animationDelay: "240ms" }}
                    />
                </div>
            </div>

            <div className="relative flex-1 overflow-hidden bg-slate-200">
                <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                        background:
                            "linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.16) 50%, transparent 65%)",
                        backgroundSize: "250% 100%",
                        animation: "map-shimmer 2.4s ease-in-out infinite",
                    }}
                />

                <div className="absolute top-1/3 left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2">
                    <div className="h-12 w-12 animate-pulse rounded-full border-4 border-white bg-emerald-200 shadow-lg" />
                    <div className="h-5 w-28 animate-pulse rounded-full bg-white/90 shadow" />
                </div>

                <div className="absolute top-1/2 right-1/4">
                    <div className="h-10 w-10 animate-pulse rounded-full border-4 border-white bg-blue-200 shadow-md" />
                </div>

                <div className="absolute bottom-1/4 left-1/4">
                    <div
                        className="h-10 w-10 animate-pulse rounded-full border-4 border-white bg-blue-200 shadow-md"
                        style={{ animationDelay: "300ms" }}
                    />
                </div>

                <div className="absolute top-4 right-4 flex flex-col gap-2">
                    <div className="h-10 w-10 animate-pulse rounded-xl bg-white shadow-md" />
                    <div
                        className="h-10 w-10 animate-pulse rounded-xl bg-white shadow-md"
                        style={{ animationDelay: "120ms" }}
                    />
                </div>

                <div className="absolute right-0 bottom-0 left-0 space-y-3 p-4">
                    {[0, 1, 2].map((i) => (
                        <div
                            key={i}
                            className="flex items-center justify-between rounded-3xl border border-slate-100 bg-white p-5 shadow-xl"
                            style={{ opacity: 1 - i * 0.15 }}
                        >
                            <div className="flex items-start gap-4">
                                <div
                                    className="h-12 w-12 shrink-0 animate-pulse rounded-2xl"
                                    style={{
                                        background:
                                            i === 0
                                                ? "var(--color-brand-primary-soft)"
                                                : "var(--color-brand-secondary-soft)",
                                        animationDelay: `${i * 100}ms`,
                                    }}
                                />

                                <div className="flex flex-col gap-2 pt-1">
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="h-3 animate-pulse rounded-full bg-slate-200"
                                            style={{
                                                width: [160, 110, 140][i],
                                                animationDelay: `${i * 80}ms`,
                                            }}
                                        />

                                        <div
                                            className="h-4 w-14 animate-pulse rounded-md bg-emerald-100"
                                            style={{ animationDelay: `${i * 80 + 40}ms` }}
                                        />
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <div
                                            className="h-2.5 w-16 animate-pulse rounded-full bg-slate-100"
                                            style={{ animationDelay: `${i * 80 + 80}ms` }}
                                        />

                                        <div
                                            className="h-2.5 w-8 animate-pulse rounded-full bg-amber-100"
                                            style={{ animationDelay: `${i * 80 + 120}ms` }}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div
                                className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-slate-200"
                                style={{ animationDelay: `${i * 100 + 60}ms` }}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
