export default function ProfileLoading() {
    return (
        <div className="flex-grow bg-(--color-surface-muted) px-6 py-8">
            <div className="mx-auto max-w-3xl">
                {/* Back Button Skeleton */}
                <div className="mb-6 inline-flex items-center gap-2 px-3 py-2">
                    <div className="h-[18px] w-[18px] animate-pulse rounded-md bg-slate-200 dark:bg-slate-800" />
                    <div className="h-4 w-24 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
                </div>

                {/* Header Skeleton */}
                <div className="mb-8 flex items-center gap-4">
                    <div className="h-16 w-16 flex-shrink-0 animate-pulse rounded-3xl bg-slate-200 dark:bg-slate-800" />

                    <div className="flex flex-col gap-2">
                        <div className="h-7 w-36 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
                        <div className="h-4 w-56 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
                    </div>
                </div>

                {/* Profile Card Skeleton */}
                <div className="overflow-hidden rounded-3xl border border-(--color-border-muted) bg-(--color-surface-page) shadow-sm">
                    {/* User Info Skeleton */}
                    <div className="flex items-center justify-between border-b border-(--color-border-muted) p-6">
                        <div className="flex flex-col gap-2">
                            <div className="h-5 w-28 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
                            <div className="h-4 w-40 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
                        </div>

                        <div className="h-12 w-12 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
                    </div>

                    {/* Menu Items Skeleton */}
                    <div className="divide-y divide-(--color-border-muted)">
                        {/* Row 1 */}
                        <div className="flex w-full items-center justify-between p-5">
                            <div className="flex items-center gap-3">
                                <div className="h-5 w-5 animate-pulse rounded-md bg-slate-200 dark:bg-slate-800" />
                                <div className="h-4 w-44 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
                            </div>
                            <div className="h-4 w-4 animate-pulse rounded-md bg-slate-200 dark:bg-slate-800" />
                        </div>

                        {/* Row 2 */}
                        <div className="flex w-full items-center justify-between p-5">
                            <div className="flex items-center gap-3">
                                <div className="h-5 w-5 animate-pulse rounded-md bg-slate-200 dark:bg-slate-800" />
                                <div className="h-4 w-36 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
                            </div>
                            <div className="h-4 w-4 animate-pulse rounded-md bg-slate-200 dark:bg-slate-800" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
