"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { getScanHistory, deleteScanHistory, ScanHistoryEntry } from "@/lib/db/scanHistory";
import { CopyButton } from "@/components/ui/CopyButton";
import { Download } from "lucide-react";
import ExportModal from "./ExportModal";

export default function HistoryPage() {
    const [history, setHistory] = useState<ScanHistoryEntry[]>([]);

    useEffect(() => {
        loadHistory();
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
        }
    }

    async function handleDelete(id: string) {
        await deleteScanHistory(id);

        await loadHistory();
    }

    const verifiedCount = history.filter(
        (item) => item.status?.toLowerCase() === "verified"
    ).length;

    const suspiciousCount = history.filter(
        (item) => item.status?.toLowerCase() === "suspicious"
    ).length;

    const fakeCount = history.filter((item) => item.status?.toLowerCase() === "fake").length;

    const openExportModal = () => setIsExportModalOpen(true);
    const closeExportModal = () => setIsExportModalOpen(false);

    return (
        <div className="min-h-screen bg-(--color-surface-page) p-6 text-(--color-text-primary)">
            <div className="mx-auto max-w-3xl">
                <h1 className="mb-6 text-4xl font-black">Scan History</h1>
                {history.length > 0 && (
                    <button
                        onClick={openExportModal}
                        className="mb-6 flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg transition hover:bg-emerald-700 active:scale-95"
                    >
                        <Download size={16} /> Export to CSV
                    </button>
                )}
                <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-4">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <p className="text-sm opacity-70">Total</p>

                        <h2 className="mt-2 text-3xl font-bold">{history.length}</h2>
                    </div>

                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                        <p className="text-sm text-emerald-300">Verified</p>

                        <h2 className="mt-2 text-3xl font-bold text-emerald-400">
                            {verifiedCount}
                        </h2>
                    </div>

                    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
                        <p className="text-sm text-amber-300">Suspicious</p>

                        <h2 className="mt-2 text-3xl font-bold text-amber-400">
                            {suspiciousCount}
                        </h2>
                    </div>

                    <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
                        <p className="text-sm text-red-300">Fake</p>

                        <h2 className="mt-2 text-3xl font-bold text-red-400">{fakeCount}</h2>
                    </div>
                </div>

                {history.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
                        <h2 className="text-2xl font-bold">No Scan History Yet</h2>

                        <p className="mt-2 opacity-70">Your verified medicines will appear here.</p>
                    </div>
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
                                                toastMessage="Medicine name copied!"
                                            />
                                        </div>

                                        <p className="mt-2">
                                            Status:
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
                                        className="rounded-lg bg-red-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-400"
                                    >
                                        Delete
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
