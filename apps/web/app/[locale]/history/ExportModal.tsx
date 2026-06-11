"use client";

import { useRef, useState } from "react";
import { useOnClickOutside } from "@/hooks/useOnClickOutside";
import { ScanHistoryEntry } from "@/lib/db/scanHistory";
import { Download, X } from "lucide-react";

interface ExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    history: ScanHistoryEntry[];
    t: (key: string) => string;
}

export default function ExportModal({ isOpen, onClose, history, t }: ExportModalProps) {
    const [dateRange, setDateRange] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");
    const modalRef = useRef<HTMLDivElement>(null);

    // Reuse our custom hook for modal dismissal
    useOnClickOutside(modalRef, onClose, isOpen);

    if (!isOpen) return null;

    const handleExport = () => {
        const now = Date.now();
        const rangeMs: Record<string, number> = {
            "7d": 7 * 24 * 60 * 60 * 1000,
            "30d": 30 * 24 * 60 * 60 * 1000,
            all: Infinity,
        };

        const filtered = history.filter((entry) => {
            const matchesDate = now - entry.timestamp <= (rangeMs[dateRange] || Infinity);
            const matchesStatus =
                statusFilter === "all" ||
                entry.status?.toUpperCase() === statusFilter.toUpperCase();
            return matchesDate && matchesStatus;
        });

        // Generate CSV Content
        const headers = ["ID", "Date", "Medicine Name", "Status"];
        const rows = filtered.map((e) => [
            e.id,
            new Date(e.timestamp).toISOString(),
            `"${e.medicineName}"`, // Escape commas in medicine names
            e.status,
        ]);

        const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

        // Trigger Download
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        const filename = `sahidawa_history_${statusFilter.toLowerCase()}_${dateRange}.csv`;

        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.click();
        URL.revokeObjectURL(url);
        onClose();
    };

    return (
        <div className="animate-in fade-in fixed inset-0 z-[150] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm duration-200">
            <div
                ref={modalRef}
                className="w-full max-w-md overflow-hidden rounded-3xl border border-(--color-border-muted) bg-(--color-surface-page) shadow-2xl"
            >
                <div className="flex items-center justify-between border-b border-(--color-border-muted) px-6 py-4">
                    <h3 className="text-lg font-bold text-(--color-text-primary)">
                        {t("export_modal_title")}
                    </h3>
                    <button
                        onClick={onClose}
                        className="rounded-full p-1 transition-colors hover:bg-(--color-surface-muted)"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="space-y-6 p-6">
                    <div className="space-y-3">
                        <label className="text-sm font-semibold text-(--color-text-secondary)">
                            {t("export_range_label")}
                        </label>
                        <select
                            value={dateRange}
                            onChange={(e) => setDateRange(e.target.value)}
                            className="w-full rounded-xl border border-(--color-border-muted) bg-(--color-surface-muted) px-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500/40"
                        >
                            <option value="7d">{t("range_7d")}</option>
                            <option value="30d">{t("range_30d")}</option>
                            <option value="all">{t("range_all")}</option>
                        </select>
                    </div>

                    <div className="space-y-3">
                        <label className="text-sm font-semibold text-(--color-text-secondary)">
                            {t("export_status_label")}
                        </label>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full rounded-xl border border-(--color-border-muted) bg-(--color-surface-muted) px-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500/40"
                        >
                            <option value="all">{t("status_all")}</option>
                            <option value="VERIFIED">{t("status_verified")}</option>
                            <option value="SUSPICIOUS">{t("status_suspicious")}</option>
                            <option value="FAKE">{t("status_fake")}</option>
                        </select>
                    </div>

                    <button
                        onClick={handleExport}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 font-bold text-white transition-colors hover:bg-emerald-700"
                    >
                        <Download size={18} />
                        {t("export_button")}
                    </button>
                </div>
            </div>
        </div>
    );
}
