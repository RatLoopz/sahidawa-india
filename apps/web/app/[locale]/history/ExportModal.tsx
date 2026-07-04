"use client";

import { useRef, useState } from "react";
import { useOnClickOutside } from "@/hooks/useOnClickOutside";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { ScanHistoryEntry } from "@/lib/db/scanHistory";
import { Download, Loader, X } from "lucide-react";

interface ExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    history: ScanHistoryEntry[];
    t: (key: string) => string;
}

// Characters that spreadsheet apps (Excel, Google Sheets, LibreOffice) treat
// as the start of a formula when they appear as the first character of a cell.
const FORMULA_TRIGGER_CHARS = ["=", "+", "-", "@", "\t", "\r"];

/**
 * Safely prepares a value for inclusion in a CSV file.
 *
 * 1. Formula-injection guard: if the stringified value starts with a
 *    character a spreadsheet app would interpret as the start of a formula
 *    (=, +, -, @, or leading tab/carriage-return tricks), prefix it with a
 *    single quote. Spreadsheet apps then render the cell as plain text
 *    instead of evaluating it.
 * 2. Standard CSV escaping: if the value contains a comma, double quote,
 *    or newline, wrap it in double quotes and escape any internal double
 *    quotes by doubling them, per RFC 4180.
 */
function sanitizeCsvField(value: unknown): string {
    let str = value === null || value === undefined ? "" : String(value);

    if (FORMULA_TRIGGER_CHARS.some((char) => str.startsWith(char))) {
        str = `'${str}`;
    }

    if (/[",\n\r]/.test(str)) {
        str = `"${str.replace(/"/g, '""')}"`;
    }

    return str;
}

export default function ExportModal({ isOpen, onClose, history, t }: ExportModalProps) {
    const [dateRange, setDateRange] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");
    const [isExporting, setIsExporting] = useState(false);
    const modalRef = useRef<HTMLDivElement>(null);

    useOnClickOutside(modalRef, onClose, isOpen);
    useFocusTrap(modalRef, isOpen);

    if (!isOpen) return null;

    const handleExport = async () => {
        try {
            setIsExporting(true);

            // Allow React to render the loading state first
            await new Promise((resolve) => setTimeout(resolve, 0));

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

            const headers = ["ID", "Date", "Medicine Name", "Status"];

            const rows = filtered.map((e) => [
                sanitizeCsvField(e.id),
                sanitizeCsvField(new Date(e.timestamp).toISOString()),
                sanitizeCsvField(e.medicineName),
                sanitizeCsvField(e.status),
            ]);

            const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

            const blob = new Blob([csvContent], {
                type: "text/csv;charset=utf-8;",
            });

            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");

            const filename = `sahidawa_history_${statusFilter.toLowerCase()}_${dateRange}.csv`;

            link.setAttribute("href", url);
            link.setAttribute("download", filename);
            link.click();

            URL.revokeObjectURL(url);
            onClose();
        } finally {
            setIsExporting(false);
        }
    };

    const handleEscape = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === "Escape") {
            onClose();
        }
    };

    return (
        <div
            className="animate-in fade-in fixed inset-0 z-[150] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm duration-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-history-title"
            onKeyDown={handleEscape}
            tabIndex={-1}
        >
            <div
                ref={modalRef}
                className="w-full max-w-md overflow-hidden rounded-3xl border border-(--color-border-muted) bg-(--color-surface-page) shadow-2xl"
            >
                <div className="flex items-center justify-between border-b border-(--color-border-muted) px-6 py-4">
                    <h3
                        id="export-history-title"
                        className="text-lg font-bold text-(--color-text-primary)"
                    >
                        {t("export_modal_title")}
                    </h3>

                    <button
                        onClick={onClose}
                        disabled={isExporting}
                        className="rounded-full p-1 transition-colors hover:bg-(--color-surface-muted) disabled:cursor-not-allowed disabled:opacity-50"
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
                            disabled={isExporting}
                            className="w-full rounded-xl border border-(--color-border-muted) bg-(--color-surface-muted) px-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-60"
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
                            disabled={isExporting}
                            className="w-full rounded-xl border border-(--color-border-muted) bg-(--color-surface-muted) px-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <option value="all">{t("status_all")}</option>
                            <option value="VERIFIED">{t("status_verified")}</option>
                            <option value="SUSPICIOUS">{t("status_suspicious")}</option>
                            <option value="FAKE">{t("status_fake")}</option>
                        </select>
                    </div>

                    <button
                        onClick={handleExport}
                        disabled={isExporting}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 font-bold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {isExporting ? (
                            <Loader size={18} className="animate-spin" />
                        ) : (
                            <Download size={18} />
                        )}

                        {isExporting ? "Exporting..." : t("export_button")}
                    </button>
                </div>
            </div>
        </div>
    );
}