"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Trash2,
    Download,
    Clock,
    ShieldCheck,
    AlertTriangle,
    XCircle,
    RotateCcw,
} from "lucide-react";
import { Link } from "@/i18n/routing";
import {
    getAllScans,
    deleteScan,
    clearAllScans,
    type ScanHistoryEntry,
    type ScanStatus,
} from "@/lib/db/scanHistory";
import { toast } from "sonner";
import { PageHeader } from "../components/PageHeader";

function StatusBadge({ status }: { status: ScanStatus }) {
    const config = {
        verified: {
            label: "Verified",
            icon: <ShieldCheck size={12} />,
            cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
        },
        counterfeit: {
            label: "Counterfeit",
            icon: <AlertTriangle size={12} />,
            cls: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
        },
        "not-found": {
            label: "Not Found",
            icon: <XCircle size={12} />,
            cls: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
        },
    };
    const c = config[status];
    return (
        <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${c.cls}`}
        >
            {c.icon} {c.label}
        </span>
    );
}

function HistoryCard({
    entry,
    onDelete,
}: {
    entry: ScanHistoryEntry;
    onDelete: (id: string) => void;
}) {
    const date = new Date(entry.timestamp);
    const borderColor =
        entry.status === "verified"
            ? "border-l-emerald-500"
            : entry.status === "counterfeit"
              ? "border-l-red-500"
              : "border-l-amber-500";

    return (
        <div
            className={`rounded-2xl border border-l-4 border-(--color-border-muted) ${borderColor} bg-(--color-surface-page) p-4 shadow-sm transition-all hover:shadow-md`}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                        <h3 className="truncate font-bold text-(--color-text-primary)">
                            {entry.medicineName || "Unknown Medicine"}
                        </h3>
                        <StatusBadge status={entry.status} />
                    </div>
                    {entry.genericName && (
                        <p className="mb-2 text-xs text-(--color-text-muted)">
                            {entry.genericName}
                        </p>
                    )}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-(--color-text-secondary)">
                        {entry.batchNumber && (
                            <span>
                                <span className="font-semibold">Batch:</span> {entry.batchNumber}
                            </span>
                        )}
                        {entry.manufacturer && (
                            <span className="max-w-[160px] truncate">
                                <span className="font-semibold">Mfr:</span> {entry.manufacturer}
                            </span>
                        )}
                        {entry.cdscoStatus && (
                            <span>
                                <span className="font-semibold">CDSCO:</span> {entry.cdscoStatus}
                            </span>
                        )}
                    </div>
                </div>
                <button
                    onClick={() => onDelete(entry.id)}
                    aria-label="Delete scan record"
                    className="shrink-0 rounded-xl p-2 text-(--color-text-muted) transition-colors hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950/30"
                >
                    <Trash2 size={16} />
                </button>
            </div>
            <div className="mt-3 flex items-center gap-1 text-[11px] text-(--color-text-muted)">
                <Clock size={11} />
                <time dateTime={date.toISOString()}>
                    {date.toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                    })}{" "}
                    at{" "}
                    {date.toLocaleTimeString(undefined, {
                        hour: "2-digit",
                        minute: "2-digit",
                    })}
                </time>
            </div>
        </div>
    );
}

function SummaryStats({ scans }: { scans: ScanHistoryEntry[] }) {
    const verified = scans.filter((s) => s.status === "verified").length;
    const counterfeit = scans.filter((s) => s.status === "counterfeit").length;
    const notFound = scans.filter((s) => s.status === "not-found").length;

    const stats = [
        { label: "Verified", count: verified, cls: "text-emerald-600 dark:text-emerald-400" },
        { label: "Counterfeit", count: counterfeit, cls: "text-red-600 dark:text-red-400" },
        { label: "Not Found", count: notFound, cls: "text-amber-600 dark:text-amber-400" },
    ];

    return (
        <div className="mb-6 grid grid-cols-3 gap-3">
            {stats.map((s) => (
                <div
                    key={s.label}
                    className="rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted) p-3 text-center"
                >
                    <p className={`text-2xl font-black ${s.cls}`}>{s.count}</p>
                    <p className="text-[11px] font-medium text-(--color-text-muted)">{s.label}</p>
                </div>
            ))}
        </div>
    );
}

export default function HistoryPage() {
    const [scans, setScans] = useState<ScanHistoryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);

    const loadScans = useCallback(async () => {
        try {
            const data = await getAllScans();
            setScans(data);
        } catch {
            toast.error("Failed to load scan history.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadScans();
    }, [loadScans]);

    const handleDelete = async (id: string) => {
        await deleteScan(id);
        setScans((prev) => prev.filter((s) => s.id !== id));
        toast.success("Record deleted.");
    };

    const handleClearAll = async () => {
        if (!confirm("Delete all scan history? This cannot be undone.")) return;
        await clearAllScans();
        setScans([]);
        toast.success("All history cleared.");
    };

    const handleExportPDF = async () => {
        if (scans.length === 0) {
            toast.error("No scans to export.");
            return;
        }
        setExporting(true);
        try {
            const { jsPDF } = await import("jspdf");
            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.getWidth();

            doc.setFillColor(16, 185, 129); // emerald-500
            doc.rect(0, 0, pageWidth, 20, "F");
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(14);
            doc.setFont("helvetica", "bold");
            doc.text("SahiDawa — Scan History Report", 14, 13);

            doc.setTextColor(100, 100, 100);
            doc.setFontSize(9);
            doc.setFont("helvetica", "normal");
            doc.text(
                `Generated: ${new Date().toLocaleString()}  |  Total scans: ${scans.length}`,
                14,
                27
            );

            let y = 36;
            const statusColors: Record<ScanStatus, [number, number, number]> = {
                verified: [16, 185, 129],
                counterfeit: [239, 68, 68],
                "not-found": [245, 158, 11],
            };

            scans.forEach((scan, i) => {
                if (y > 260) {
                    doc.addPage();
                    y = 20;
                }

                const color = statusColors[scan.status];
                doc.setDrawColor(...color);
                doc.setLineWidth(0.8);
                doc.line(14, y, 14, y + 20);

                doc.setTextColor(30, 30, 30);
                doc.setFontSize(11);
                doc.setFont("helvetica", "bold");
                doc.text(`${i + 1}. ${scan.medicineName || "Unknown"}`, 18, y + 5);

                doc.setFontSize(8);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(80, 80, 80);
                const details = [
                    scan.genericName && `Generic: ${scan.genericName}`,
                    scan.batchNumber && `Batch: ${scan.batchNumber}`,
                    scan.manufacturer && `Manufacturer: ${scan.manufacturer}`,
                    `CDSCO: ${scan.cdscoStatus || "—"}`,
                    `Status: ${scan.status.toUpperCase()}`,
                    `Date: ${new Date(scan.timestamp).toLocaleString()}`,
                ]
                    .filter(Boolean)
                    .join("   |   ");
                const lines = doc.splitTextToSize(details, pageWidth - 30);
                doc.text(lines, 18, y + 12);

                y += 26;
                doc.setDrawColor(220, 220, 220);
                doc.setLineWidth(0.2);
                doc.line(14, y, pageWidth - 14, y);
                y += 5;
            });

            doc.save(`sahidawa-scan-history-${Date.now()}.pdf`);
            toast.success("PDF exported!");
        } catch {
            toast.error("Export failed. Please try again.");
        } finally {
            setExporting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-(--color-surface-page)">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/10 border-t-emerald-500" />
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-(--color-surface-page) pb-20">
            <PageHeader
                backHref="/"
                variant="light"
                title="SCAN HISTORY"
                subtitle={`${scans.length} total records`}
            />

            <div className="mx-auto max-w-lg px-4 pt-6">
                {/* Action bar */}
                {scans.length > 0 && (
                    <div className="mb-5 flex items-center justify-between gap-2">
                        <Link
                            href="/scan"
                            className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-white shadow-md shadow-emerald-500/20 transition-all hover:bg-emerald-600"
                        >
                            + Scan Medicine
                        </Link>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleExportPDF}
                                disabled={exporting}
                                className="flex items-center gap-1.5 rounded-xl border border-(--color-border-muted) bg-(--color-surface-muted) px-3 py-2 text-xs font-semibold text-(--color-text-primary) transition-colors hover:bg-(--color-border-muted) disabled:opacity-40"
                                aria-label="Export as PDF"
                            >
                                <Download size={14} />
                                {exporting ? "Exporting…" : "Export PDF"}
                            </button>
                            <button
                                onClick={handleClearAll}
                                className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-100 dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-400"
                                aria-label="Clear all history"
                            >
                                <RotateCcw size={14} />
                                Clear All
                            </button>
                        </div>
                    </div>
                )}

                {scans.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-(--color-surface-muted)">
                            <Clock size={36} className="text-(--color-text-muted)" />
                        </div>
                        <h2 className="mb-2 text-xl font-bold text-(--color-text-primary)">
                            No scans yet
                        </h2>
                        <p className="mb-6 max-w-xs text-sm text-(--color-text-muted)">
                            Your medicine scan history will appear here. Start by scanning a
                            medicine.
                        </p>
                        <Link
                            href="/scan"
                            className="rounded-2xl bg-emerald-500 px-6 py-3 font-bold text-white shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-600"
                        >
                            Scan a Medicine
                        </Link>
                    </div>
                ) : (
                    <>
                        <SummaryStats scans={scans} />
                        <div className="space-y-3">
                            {scans.map((scan) => (
                                <HistoryCard key={scan.id} entry={scan} onDelete={handleDelete} />
                            ))}
                        </div>
                    </>
                )}
            </div>
        </main>
    );
}
