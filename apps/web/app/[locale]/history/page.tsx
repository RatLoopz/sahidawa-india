"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";

import {
    getScanHistory,
    deleteScanHistory,
    clearScanHistory,
    ScanHistoryEntry,
} from "@/lib/db/scanHistory";
import { CopyButton } from "@/components/ui/CopyButton";
import { ClipboardList, Download, RefreshCw, Trash2 } from "lucide-react";
import { syncScanHistoryWithCloud } from "@/lib/scanHistoryCloudSync";
import { EmptyState } from "@/components/ui/EmptyState";

const ExportModal = dynamic(() => import("./ExportModal"));

type StatusFilter = "all" | "verified" | "suspicious" | "fake";
type SortOrder = "newest" | "oldest";

export default function HistoryPage() {
    const exportButtonRef = useRef<HTMLButtonElement | null>(null);
    const [history, setHistory] = useState<ScanHistoryEntry[]>([]);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncMessage, setSyncMessage] = useState<string | null>(null);
    const [showClearConfirmation, setShowClearConfirmation] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
    const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
    const [isOnline, setIsOnline] = useState<boolean>(() =>
        typeof window !== "undefined" ? window.navigator.onLine : true
    );
    const [syncStatus, setSyncStatus] = useState<"synced" | "pending" | "syncing" | "error">(
        "synced"
    );

    const t = useTranslations("ScanHistory");
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);

    const loadHistory = useCallback(async () => {
        try {
            const data = await getScanHistory();

            const sorted = data.sort((a, b) => b.timestamp - a.timestamp);

            setHistory(sorted);
        } catch (error) {
            console.error("History load failed:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const syncHistoryFromCloud = useCallback(async () => {
        if (typeof window !== "undefined" && !window.navigator.onLine) {
            setSyncStatus("pending");
            return;
        }
        try {
            setIsSyncing(true);
            setSyncStatus("syncing");
            setSyncMessage(null);
            await syncScanHistoryWithCloud();
            await loadHistory();
            setSyncMessage(t("sync_success"));
            setSyncStatus("synced");
        } catch (error) {
            console.error("History sync failed:", error);
            setSyncMessage(t("sync_error"));
            setSyncStatus("error");
        } finally {
            setIsSyncing(false);
        }
    }, [loadHistory, t]);

    useEffect(() => {
        loadHistory();
    }, [loadHistory]);

    useEffect(() => {
        if (isOnline) {
            void syncHistoryFromCloud();
        } else {
            setSyncStatus("pending");
        }
    }, [isOnline, syncHistoryFromCloud]);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, []);

    async function handleDelete(id: string) {
        await deleteScanHistory(id);

        await loadHistory();
    }

    const handleClearAllHistory = async () => {
        try {
            await clearScanHistory();
            await loadHistory(); // Reload to show empty state
            setShowClearConfirmation(false); // Hide confirmation
            // Optional: Show a success toast
            // toast.success(t("clear_all_success"));
        } catch (error) {
            console.error("Failed to clear all history:", error);
            // Optional: Show an error toast
            // toast.error(t("clear_all_error"));
        }
    };

    const handleCancelClear = () => setShowClearConfirmation(false);

    const filteredHistory = history
        .filter((item) => item.medicineName.toLowerCase().includes(search.toLowerCase()))
        .filter((item) => statusFilter === "all" || item.status?.toLowerCase() === statusFilter)
        .sort((a, b) =>
            sortOrder === "newest" ? b.timestamp - a.timestamp : a.timestamp - b.timestamp
        );

    const verifiedCount = history.filter(
        (item) => item.status?.toLowerCase() === "verified"
    ).length;

    const suspiciousCount = history.filter(
        (item) => item.status?.toLowerCase() === "suspicious"
    ).length;

    const fakeCount = history.filter((item) => item.status?.toLowerCase() === "fake").length;

    // Clicking an already-active stat card clears the filter back to "all",
    // so the cards double as a toggleable shortcut rather than a one-way filter.
    const handleStatCardClick = (status: StatusFilter) => {
        setStatusFilter((current) => (current === status ? "all" : status));
    };

    const openExportModal = () => {
        exportButtonRef.current?.focus();
        setIsExportModalOpen(true);
    };
    const closeExportModal = () => {
        setIsExportModalOpen(false);
        requestAnimationFrame(() => exportButtonRef.current?.focus());
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-(--color-surface-page) p-6 text-(--color-text-primary)">
                <div className="mx-auto max-w-3xl">
                    <div className="mb-6 h-10 w-64 animate-pulse rounded-xl bg-white/5" />
                    <div className="mb-6 flex flex-wrap gap-3">
                        <div className="h-10 w-36 animate-pulse rounded-xl bg-white/5" />
                        <div className="h-10 w-36 animate-pulse rounded-xl bg-white/5" />
                    </div>
                    <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-4">
                        {[...Array(4)].map((_, i) => (
                            <div
                                key={i}
                                className="h-24 animate-pulse rounded-2xl border border-white/10 bg-white/5"
                            />
                        ))}
                    </div>
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

    return (
        <div className="min-h-screen bg-(--color-surface-page) p-6 text-(--color-text-primary)">
            <div className="mx-auto max-w-3xl">
                <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                    <h1 className="text-4xl font-black">{t("title")}</h1>
                    {/* Connection Status Badge */}
                    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold shadow-md backdrop-blur-sm transition-all duration-300">
                        {syncStatus === "synced" && (
                            <>
                                <span className="relative flex h-2 w-2">
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                                </span>
                                <span className="text-emerald-400">{t("sync_status_synced")}</span>
                            </>
                        )}
                        {syncStatus === "pending" && (
                            <>
                                <span className="relative flex h-2 w-2">
                                    <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500"></span>
                                </span>
                                <span className="text-amber-400">{t("sync_status_offline")}</span>
                            </>
                        )}
                        {syncStatus === "syncing" && (
                            <>
                                <span className="relative flex h-2 w-2">
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75"></span>
                                    <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-500"></span>
                                </span>
                                <span className="text-sky-400">{t("sync_status_syncing")}</span>
                            </>
                        )}
                        {syncStatus === "error" && (
                            <>
                                <span className="relative flex h-2 w-2">
                                    <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500"></span>
                                </span>
                                <span className="text-red-400">{t("sync_status_error")}</span>
                            </>
                        )}
                    </div>
                </div>
                <div className="mb-6 flex flex-wrap gap-3">
                    {/* Export to CSV button */}
                    {history.length > 0 && (
                        <button
                            ref={exportButtonRef}
                            onClick={openExportModal}
                            className="flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg transition hover:bg-emerald-700 active:scale-95"
                        >
                            <Download size={16} /> {t("export_csv_button")}
                        </button>
                    )}
                    {/* Sync to Cloud button */}
                    <button
                        onClick={() => void syncHistoryFromCloud()}
                        disabled={isSyncing || !isOnline}
                        className="flex items-center gap-2 rounded-xl border border-(--color-border-muted) bg-(--color-surface-muted) px-5 py-2.5 text-sm font-bold transition hover:bg-(--color-surface-page) disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <RefreshCw size={16} className={isSyncing ? "animate-spin" : ""} />
                        {t("sync_cloud_button")}
                    </button>
                    {/* Clear All History Button */}
                    {history.length > 0 && (
                        <button
                            onClick={() => setShowClearConfirmation(true)}
                            aria-label={t("clear_all_button_aria_label")}
                            className="flex items-center gap-2 rounded-xl bg-red-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg transition hover:bg-red-600 active:scale-95"
                        >
                            <Trash2 size={16} /> {t("clear_all_button")}
                        </button>
                    )}
                </div>
                {showClearConfirmation && (
                    <div className="animate-in fade-in slide-in-from-top-2 z-20 mb-4 rounded-xl border border-red-400/30 bg-red-950/50 p-4 text-sm font-medium backdrop-blur-sm">
                        <p className="mb-3 text-red-100">{t("clear_confirm_message")}</p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={handleCancelClear}
                                className="rounded-md px-4 py-2 text-white transition-colors hover:bg-white/10"
                            >
                                {t("clear_cancel_button")}
                            </button>
                            <button
                                onClick={handleClearAllHistory}
                                className="rounded-md bg-red-600 px-4 py-2 font-bold text-white transition-colors hover:bg-red-700"
                            >
                                {t("clear_confirm_button")}
                            </button>
                        </div>
                    </div>
                )}
                {syncMessage && <p className="mb-4 text-sm opacity-70">{syncMessage}</p>}
                <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-4">
                    <button
                        type="button"
                        onClick={() => handleStatCardClick("all")}
                        aria-pressed={statusFilter === "all"}
                        className={`rounded-2xl border p-4 text-left transition ${
                            statusFilter === "all"
                                ? "border-white/40 bg-white/10 ring-1 ring-white/40"
                                : "border-white/10 bg-white/5 hover:bg-white/10"
                        }`}
                    >
                        <p className="text-sm opacity-70">{t("stat_total")}</p>

                        <h2 className="mt-2 text-3xl font-bold">{history.length}</h2>
                    </button>

                    <button
                        type="button"
                        onClick={() => handleStatCardClick("verified")}
                        aria-pressed={statusFilter === "verified"}
                        className={`rounded-2xl border p-4 text-left transition ${
                            statusFilter === "verified"
                                ? "border-emerald-500/60 bg-emerald-500/20 ring-1 ring-emerald-500/60"
                                : "border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/15"
                        }`}
                    >
                        <p className="text-sm text-emerald-300">{t("stat_verified")}</p>

                        <h2 className="mt-2 text-3xl font-bold text-emerald-400">
                            {verifiedCount}
                        </h2>
                    </button>

                    <button
                        type="button"
                        onClick={() => handleStatCardClick("suspicious")}
                        aria-pressed={statusFilter === "suspicious"}
                        className={`rounded-2xl border p-4 text-left transition ${
                            statusFilter === "suspicious"
                                ? "border-amber-500/60 bg-amber-500/20 ring-1 ring-amber-500/60"
                                : "border-amber-500/20 bg-amber-500/10 hover:bg-amber-500/15"
                        }`}
                    >
                        <p className="text-sm text-amber-300">{t("stat_suspicious")}</p>

                        <h2 className="mt-2 text-3xl font-bold text-amber-400">
                            {suspiciousCount}
                        </h2>
                    </button>

                    <button
                        type="button"
                        onClick={() => handleStatCardClick("fake")}
                        aria-pressed={statusFilter === "fake"}
                        className={`rounded-2xl border p-4 text-left transition ${
                            statusFilter === "fake"
                                ? "border-red-500/60 bg-red-500/20 ring-1 ring-red-500/60"
                                : "border-red-500/20 bg-red-500/10 hover:bg-red-500/15"
                        }`}
                    >
                        <p className="text-sm text-red-300">{t("stat_fake")}</p>

                        <h2 className="mt-2 text-3xl font-bold text-red-400">{fakeCount}</h2>
                    </button>
                </div>

                {history.length > 0 && (
                    <div className="mb-4 flex flex-wrap gap-3">
                        <input
                            id="history-search"
                            type="text"
                            placeholder={t("search_placeholder")}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="min-w-[200px] flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-(--color-text-primary) placeholder-white/40 outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/40"
                        />
                        <select
                            id="history-status-filter"
                            aria-label={t("filter_status_label")}
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-(--color-text-primary) outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/40"
                        >
                            <option value="all">{t("status_all")}</option>
                            <option value="verified">{t("status_verified")}</option>
                            <option value="suspicious">{t("status_suspicious")}</option>
                            <option value="fake">{t("status_fake")}</option>
                        </select>
                        <select
                            id="history-sort-order"
                            aria-label={t("sort_label")}
                            value={sortOrder}
                            onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-(--color-text-primary) outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/40"
                        >
                            <option value="newest">{t("sort_newest")}</option>
                            <option value="oldest">{t("sort_oldest")}</option>
                        </select>
                    </div>
                )}
                {history.length === 0 ? (
                    <EmptyState
                        icon={<ClipboardList className="h-10 w-10 text-emerald-500" />}
                        title={t("empty_title")}
                        description={t("empty_description")}
                    />
                ) : filteredHistory.length === 0 ? (
                    <p className="text-center text-sm opacity-50">{t("no_filtered_results")}</p>
                ) : (
                    <div className="space-y-4">
                        {filteredHistory.map((item) => (
                            <div
                                key={item.id}
                                className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg backdrop-blur-sm"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <div className="flex items-center gap-1">
                                            <h2 className="text-xl font-bold">
                                                {item.medicineName}
                                            </h2>
                                            <CopyButton
                                                text={item.medicineName}
                                                toastMessage={t("item_copy_success")}
                                            />
                                        </div>

                                        <p className="mt-2">
                                            {t("item_status_label")}
                                            <span
                                                className={`ml-2 font-semibold ${
                                                    item.status?.toLowerCase() === "verified"
                                                        ? "text-emerald-400"
                                                        : item.status?.toLowerCase() === "fake"
                                                          ? "text-red-400"
                                                          : "text-amber-400"
                                                }`}
                                            >
                                                {item.status}
                                            </span>
                                        </p>

                                        <p className="mt-2 text-sm opacity-70">
                                            {new Date(item.timestamp).toLocaleString()}
                                        </p>
                                    </div>

                                    <button
                                        onClick={() => handleDelete(item.id)}
                                        aria-label={`Delete ${item.medicineName} from history`}
                                        className="rounded-lg bg-red-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-400"
                                    >
                                        {t("item_delete_button")}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <ExportModal
                    isOpen={isExportModalOpen}
                    onClose={closeExportModal}
                    history={history}
                    t={t}
                />
            </div>
        </div>
    );
}
