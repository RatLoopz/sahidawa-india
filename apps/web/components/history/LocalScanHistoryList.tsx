"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    AlertTriangle,
    ChevronLeft,
    ChevronRight,
    Download,
    History,
    RotateCcw,
    Trash2,
} from "lucide-react";
import {
    clearLocalScanHistory,
    DEFAULT_LOCAL_SCAN_HISTORY_PAGE_SIZE,
    getLocalScanHistoryPage,
    type LocalScanHistoryEntry,
    type LocalScanHistoryPage,
} from "@/lib/localScanHistory";

const statusStyles: Record<string, string> = {
    verified:
        "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300",
    suspicious:
        "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300",
    counterfeit:
        "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300",
    unverified:
        "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300",
    error: "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400",
};

export function LocalScanHistoryList() {
    const [historyPage, setHistoryPage] = useState<LocalScanHistoryPage | null>(null);
    const [page, setPage] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [isClearing, setIsClearing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadPage = useCallback(async (nextPage: number) => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await getLocalScanHistoryPage(
                nextPage,
                DEFAULT_LOCAL_SCAN_HISTORY_PAGE_SIZE
            );
            setHistoryPage(result);
            setPage(result.page);
        } catch {
            setError("Unable to load local scan history.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadPage(page);
    }, [loadPage, page]);

    const rangeLabel = useMemo(() => {
        if (!historyPage || historyPage.total === 0) return "No scans saved yet";
        const start = (historyPage.page - 1) * historyPage.pageSize + 1;
        const end = start + historyPage.entries.length - 1;
        return `Showing ${start}-${end} of ${historyPage.total} scans`;
    }, [historyPage]);

    const handleClear = async () => {
        setIsClearing(true);
        setError(null);
        try {
            await clearLocalScanHistory();
            await loadPage(1);
        } catch {
            setError("Unable to clear local scan history.");
        } finally {
            setIsClearing(false);
        }
    };

    const handleExportCSV = async () => {
        setError(null);
        try {
            const result = await getLocalScanHistoryPage(1, 10000);
            const allEntries = result.entries;
            if (!allEntries || allEntries.length === 0) return;

            const headers = [
                "Date",
                "Brand Name",
                "Generic Name",
                "Batch Number",
                "Status",
                "Verification Result",
            ];
            const rows = allEntries.map((entry: LocalScanHistoryEntry) => [
                new Date(entry.scannedAt).toLocaleString(),
                entry.brandName || "N/A",
                entry.genericName || "N/A",
                entry.batchNumber || entry.query || "N/A",
                entry.status,
                entry.message || "N/A",
            ]);

            const csvContent = [
                headers.join(","),
                ...rows.map((row: string[]) =>
                    row.map((val: string) => `"${String(val).replace(/"/g, '""')}"`).join(",")
                ),
            ].join("\n");

            const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute(
                "download",
                `sahidawa_scan_history_${new Date().toISOString().split("T")[0]}.csv`
            );
            link.click();
            URL.revokeObjectURL(url);
        } catch {
            setError("Unable to export local scan history.");
        }
    };

    const entries = historyPage?.entries ?? [];
    const hasEntries = entries.length > 0;

    return (
        <section className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-4 border-b border-(--color-border-muted) pb-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                        Local device history
                    </p>
                    <h2 className="text-3xl font-black tracking-tight text-(--color-text-primary)">
                        Recent medicine scans
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm text-(--color-text-secondary)">
                        Stored only in this browser. The page loads a small window of scans at a
                        time so large local histories stay responsive.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => loadPage(page)}
                        disabled={isLoading}
                        aria-label="Refresh history"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-(--color-border-muted) bg-(--color-surface-page) text-(--color-text-secondary) transition-colors hover:bg-(--color-surface-muted) disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <RotateCcw size={18} />
                    </button>
                    <button
                        type="button"
                        onClick={handleExportCSV}
                        disabled={!hasEntries || isLoading}
                        className="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                    >
                        <Download size={16} />
                        Export CSV
                    </button>
                    <button
                        type="button"
                        onClick={handleClear}
                        disabled={!hasEntries || isClearing}
                        className="inline-flex items-center justify-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300 dark:hover:bg-red-950/40"
                    >
                        <Trash2 size={16} />
                        Clear
                    </button>
                </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold text-(--color-text-secondary)">{rangeLabel}</p>
                {historyPage && historyPage.totalPages > 0 && (
                    <p className="text-sm text-(--color-text-muted)">
                        Page {historyPage.page} of {historyPage.totalPages}
                    </p>
                )}
            </div>

            {error && (
                <div
                    className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300"
                    role="alert"
                >
                    <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                    {error}
                </div>
            )}

            {isLoading && !historyPage ? (
                <div className="grid gap-3">
                    {Array.from({ length: 4 }, (_, index) => (
                        <div
                            key={index}
                            className="h-28 animate-pulse rounded-lg border border-(--color-border-muted) bg-(--color-surface-muted)"
                        />
                    ))}
                </div>
            ) : hasEntries ? (
                <div className="grid gap-3">
                    {entries.map((entry) => (
                        <HistoryEntryCard key={entry.id} entry={entry} />
                    ))}
                </div>
            ) : (
                <div className="flex min-h-72 flex-col items-center justify-center rounded-lg border border-dashed border-(--color-border-muted) bg-(--color-surface-muted) p-8 text-center">
                    <History size={40} className="text-(--color-text-muted)" />
                    <h3 className="mt-4 text-xl font-bold text-(--color-text-primary)">
                        No local scans yet
                    </h3>
                    <p className="mt-2 max-w-sm text-sm text-(--color-text-secondary)">
                        Verified, unverified, and failed scans will appear here after you use the
                        scanner on this device.
                    </p>
                </div>
            )}

            <div className="flex items-center justify-between border-t border-(--color-border-muted) pt-5">
                <button
                    type="button"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={!historyPage?.hasPreviousPage || isLoading}
                    aria-label="Previous page"
                    className="inline-flex items-center gap-2 rounded-full border border-(--color-border-muted) bg-(--color-surface-page) px-4 py-2 text-sm font-bold text-(--color-text-primary) transition-colors hover:bg-(--color-surface-muted) disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <ChevronLeft size={16} />
                    Previous
                </button>
                <button
                    type="button"
                    onClick={() => setPage((current) => current + 1)}
                    disabled={!historyPage?.hasNextPage || isLoading}
                    aria-label="Next page"
                    className="inline-flex items-center gap-2 rounded-full border border-(--color-border-muted) bg-(--color-surface-page) px-4 py-2 text-sm font-bold text-(--color-text-primary) transition-colors hover:bg-(--color-surface-muted) disabled:cursor-not-allowed disabled:opacity-50"
                >
                    Next
                    <ChevronRight size={16} />
                </button>
            </div>
        </section>
    );
}

function HistoryEntryCard({ entry }: { entry: LocalScanHistoryEntry }) {
    const title = entry.brandName || entry.batchNumber || entry.query || "Unknown medicine";
    const subtitle = [entry.genericName, entry.manufacturer].filter(Boolean).join(" · ");
    const statusClassName = statusStyles[entry.status] ?? statusStyles.error;

    return (
        <article className="rounded-lg border border-(--color-border-muted) bg-(--color-surface-page) p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-bold break-words text-(--color-text-primary)">
                            {title}
                        </h3>
                        <span
                            className={`rounded-full border px-2.5 py-1 text-xs font-bold capitalize ${statusClassName}`}
                        >
                            {entry.status}
                        </span>
                    </div>
                    {subtitle && (
                        <p className="mt-1 text-sm text-(--color-text-secondary)">{subtitle}</p>
                    )}
                    {entry.message && (
                        <p className="mt-2 text-sm text-(--color-text-secondary)">
                            {entry.message}
                        </p>
                    )}
                </div>
                <time
                    dateTime={entry.scannedAt}
                    className="shrink-0 text-sm font-medium text-(--color-text-muted)"
                >
                    {formatScannedAt(entry.scannedAt)}
                </time>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                <HistoryField label="Batch" value={entry.batchNumber || entry.query || "Unknown"} />
                <HistoryField
                    label="Source"
                    value={entry.source === "photo" ? "Uploaded photo" : entry.source}
                />
                <HistoryField label="CDSCO" value={entry.cdscoApprovalStatus || "Unknown"} />
            </dl>
        </article>
    );
}

function HistoryField({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-lg bg-(--color-surface-muted) p-3">
            <dt className="text-[11px] font-bold tracking-wider text-(--color-text-muted) uppercase">
                {label}
            </dt>
            <dd className="mt-1 font-semibold break-words text-(--color-text-primary)">{value}</dd>
        </div>
    );
}

function formatScannedAt(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(date);
}
