"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";

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

const ExportModal = dynamic(() => import("./ExportModal"), {
    loading: () => null,
    ssr: false,
});

export default function HistoryPage() {
    const [history, setHistory] = useState<ScanHistoryEntry[]>([]);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncMessage, setSyncMessage] = useState<string | null>(null);
    const [showClearConfirmation, setShowClearConfirmation] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadHistory();
        void syncHistoryFromCloud();
    }, []);

    const t = useTranslations("ScanHistory");
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);

    async function loadHistory() {
        try {
            const data = await getScanHistory();

            const sorted = data.sort((a, b) => b.timestamp - a.timestamp);

            setHistory(sorted);
        } catch (error) {
            console.error("History load failed:", error);
        } finally {
            setIsLoading(false);
        }
    }

    async function handleDelete(id: string) {
        await deleteScanHistory(id);

        await loadHistory();
    }

    async function syncHistoryFromCloud() {
        try {
            setIsSyncing(true);
            setSyncMessage(null);
            await syncScanHistoryWithCloud();
            await loadHistory();
            setSyncMessage(t("sync_success"));
        } catch (error) {
            console.error("History sync failed:", error);
            setSyncMessage(t("sync_error"));
        } finally {
            setIsSyncing(false);
        }
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

    const verifiedCount = history.filter(
        (item) => item.status?.toLowerCase() === "verified"
    ).length;

    const suspiciousCount = history.filter(
        (item) => item.status?.toLowerCase() === "suspicious"
    ).length;

    const fakeCount = history.filter((item) => item.status?.toLowerCase() === "fake").length;

    const openExportModal = () => setIsExportModalOpen(true);
    const closeExportModal = () => setIsExportModalOpen(false);

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
                <h1 className="mb-6 text-4xl font-black">{t("title")}</h1>
                <div className="mb-6 flex flex-wrap gap-3">
                    {/* Export to CSV button */}
                    {history.length > 0 && (
                        <button
                            onClick={openExportModal}
                            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg transition hover:bg-emerald-700 active:scale-95"
                        >
                            <Download size={16} /> {t("export_csv_button")}
                        </button>
                    )}
                    {/* Sync to Cloud button */}
                    <button
                        onClick={() => void syncHistoryFromCloud()}
                        disabled={isSyncing}
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
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <p className="text-sm opacity-70">{t("stat_total")}</p>

                        <h2 className="mt-2 text-3xl font-bold">{history.length}</h2>
                    </div>

                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                        <p className="text-sm text-emerald-300">{t("stat_verified")}</p>

                        <h2 className="mt-2 text-3xl font-bold text-emerald-400">
                            {verifiedCount}
                        </h2>
                    </div>

                    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
                        <p className="text-sm text-amber-300">{t("stat_suspicious")}</p>

                        <h2 className="mt-2 text-3xl font-bold text-amber-400">
                            {suspiciousCount}
                        </h2>
                    </div>

                    <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
                        <p className="text-sm text-red-300">{t("stat_fake")}</p>

                        <h2 className="mt-2 text-3xl font-bold text-red-400">{fakeCount}</h2>
                    </div>
                </div>

                {history.length === 0 ? (
                    <EmptyState
                        icon={<ClipboardList className="h-10 w-10 text-emerald-500" />}
                        title={t("empty_title")}
                        description={t("empty_description")}
                    />
                ) : (
                    <div className="space-y-4">
                        {history.map((item) => (
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
