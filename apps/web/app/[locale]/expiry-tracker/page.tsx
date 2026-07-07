"use client";
import React, { useCallback, useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "../components/PageHeader";
import { verifyMedicine } from "@/lib/api";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { ExpiryForm } from "./components/ExpiryForm";
import { ExpiryModal } from "./components/ExpiryModal";
import { ExpirySummary } from "./components/ExpirySummary";
import { ExpiryTable } from "./components/ExpiryTable";
import { ConfirmationDialog } from "@/components/ConfirmationDialog";
import { formatDateInputValue, isValidDateString, parseLocalDate } from "./components/dateUtils";
import type { FilterStatus, SortOption } from "./components/types";
import {
    requestNotificationPermission as requestNotificationPermissionHelper,
    checkAndTriggerLocalNotifications as checkAndTriggerNotificationsHelper,
} from "@/lib/expiry-notifications";
import { useMedicineTracker, Medicine } from "@/hooks/useMedicineTracker";

export default function ExpiryTrackerPage() {
    const t = useTranslations("ExpiryTracker");
    const {
        medicines,
        isLoaded,
        addMedicine,
        editMedicine,
        deleteMedicine,
        bulkDeleteMedicines,
        importMedicines,
        snoozeMedicine,
    } = useMedicineTracker();

    // Form state
    const [name, setName] = useState("");
    const [expiryDate, setExpiryDate] = useState("");
    const [batchNumber, setBatchNumber] = useState("");
    const [notes, setNotes] = useState("");
    const [dateError, setDateError] = useState("");
    const [isExpired, setIsExpired] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // List state
    const [searchQuery, setSearchQuery] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<SortOption>("expirySoonest");
    const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Confirmation dialog state
    const [confirmDialog, setConfirmDialog] = useState<{
        isOpen: boolean;
        type: "single" | "bulk";
        medicineId?: string;
        medicineName?: string;
        count?: number;
    }>({
        isOpen: false,
        type: "single",
    });
    const [isDeleting, setIsDeleting] = useState(false);

    // IO / System state
    const [importError, setImportError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const scannerTriggerRef = useRef<HTMLButtonElement | null>(null);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [apiError, setApiError] = useState<string | null>(null);
    const [notificationPermission, setNotificationPermission] = useState<string>("default");

    useEffect(() => {
        if (typeof window !== "undefined" && "Notification" in window) {
            setNotificationPermission(Notification.permission);
        }
    }, []);

    const requestNotificationPermission = async () => {
        const permission = await requestNotificationPermissionHelper();
        setNotificationPermission(permission);
        if (permission === "granted") {
            toast.success("Notifications enabled! You will be alerted before medicines expire.");
            await checkAndTriggerNotificationsHelper(medicines);
        } else if (permission === "denied") {
            toast.error(
                "Notification permission denied. Please enable alerts in your browser settings."
            );
        }
        return permission;
    };

    const handleScannerClose = useCallback(() => {
        setIsScannerOpen(false);
        setApiError(null);
        requestAnimationFrame(() => scannerTriggerRef.current?.focus());
    }, []);

    const updateExpiryState = useCallback((dateInputValue: string) => {
        setExpiryDate(dateInputValue);
        setDateError("");

        const selected = parseLocalDate(dateInputValue);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        selected.setHours(0, 0, 0, 0);
        setIsExpired(selected < today);
    }, []);

    const handleBarcodeScan = useCallback(
        async (scannedText: string) => {
            setIsVerifying(true);
            setApiError(null);
            try {
                const result = await verifyMedicine(scannedText);
                if (result.verified) {
                    const medicine = result.medicine;
                    const scannedName = medicine.brand_name || medicine.generic_name;
                    if (scannedName) setName(scannedName);
                    setBatchNumber(medicine.batch_number || scannedText);

                    const scannedExpiryDate = formatDateInputValue(medicine.expiry_date);
                    if (scannedExpiryDate) updateExpiryState(scannedExpiryDate);

                    const scannedDetails = [
                        medicine.generic_name ? `Generic: ${medicine.generic_name}` : null,
                        medicine.manufacturer ? `Manufacturer: ${medicine.manufacturer}` : null,
                        medicine.cdsco_approval_status
                            ? `CDSCO status: ${medicine.cdsco_approval_status}`
                            : null,
                    ]
                        .filter(Boolean)
                        .join("\n");

                    if (scannedDetails) {
                        setNotes((currentNotes) =>
                            currentNotes.trim() ? currentNotes : scannedDetails
                        );
                    }

                    toast.success("Medicine details auto-filled!");
                    setIsScannerOpen(false);
                } else {
                    setBatchNumber(scannedText);
                    toast.warning("Medicine not found in database. Batch number filled.");
                    setIsScannerOpen(false);
                }
            } catch (error: unknown) {
                console.error("Scan error:", error);
                const message =
                    error instanceof Error ? error.message : "Failed to fetch medicine details.";
                setBatchNumber(scannedText);
                setApiError(message);
                toast.error("Failed to fetch medicine details. Batch number filled.");
            } finally {
                setIsVerifying(false);
            }
        },
        [updateExpiryState]
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            if (!name || !expiryDate) {
                setIsSubmitting(false);
                return;
            }

            if (!isValidDateString(expiryDate)) {
                setDateError("Invalid expiry date");
                setIsSubmitting(false);
                return;
            }

            const selected = parseLocalDate(expiryDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            selected.setHours(0, 0, 0, 0);

            if (selected < today) {
                setDateError("This medicine has already expired");
                setIsSubmitting(false);
                return;
            }

            setDateError("");

            if (editingId) {
                try {
                    await editMedicine(editingId, { name, expiryDate, batchNumber, notes });
                    cancelEdit();
                } catch (error) {
                    console.error("Failed to update medicine:", error);
                    toast.error("Failed to save changes. Please try again.");
                }
            } else {
                await addMedicine({ name, expiryDate, batchNumber, notes });
                setName("");
                setExpiryDate("");
                setBatchNumber("");
                setNotes("");
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = (id: string) => {
        const medicine = medicines.find((m) => m.id === id);
        setConfirmDialog({
            isOpen: true,
            type: "single",
            medicineId: id,
            medicineName: medicine?.name || "this medicine",
        });
    };

    const confirmDeleteMedicine = async () => {
        if (confirmDialog.medicineId) {
            setIsDeleting(true);
            try {
                await deleteMedicine(confirmDialog.medicineId);
                if (editingId === confirmDialog.medicineId) cancelEdit();
                setSelectedIds((prev) => {
                    if (!prev.has(confirmDialog.medicineId!)) return prev;
                    const next = new Set(prev);
                    next.delete(confirmDialog.medicineId!);
                    return next;
                });
                toast.success("Medicine deleted successfully");
            } catch (error) {
                console.error("Failed to delete medicine:", error);
                toast.error("Failed to delete medicine. Please try again.");
            } finally {
                setIsDeleting(false);
                setConfirmDialog({ isOpen: false, type: "single" });
            }
        }
    };

    const handleBulkDelete = () => {
        if (selectedIds.size === 0) return;
        setConfirmDialog({
            isOpen: true,
            type: "bulk",
            count: selectedIds.size,
        });
    };

    const confirmBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        setIsDeleting(true);
        try {
            await bulkDeleteMedicines(Array.from(selectedIds));
            setSelectedIds(new Set());
            toast.success(`${selectedIds.size} medicines deleted successfully`);
        } catch (error) {
            console.error("Failed to delete medicines:", error);
            toast.error("Failed to delete medicines. Please try again.");
        } finally {
            setIsDeleting(false);
            setConfirmDialog({ isOpen: false, type: "single" });
        }
    };

    const startEdit = (med: Medicine) => {
        setEditingId(med.id);
        setName(med.name);
        setExpiryDate(med.expiryDate);
        setBatchNumber(med.batchNumber ?? "");
        setNotes(med.notes ?? "");
        setDateError("");
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setName("");
        setExpiryDate("");
        setBatchNumber("");
        setNotes("");
        setDateError("");
        setIsExpired(false);
    };

    const toggleSelect = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const getDiffDays = (dateStr: string) => {
        const expiry = parseLocalDate(dateStr);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    };

    const getExpiryStatus = (med: Medicine) => {
        if (med.snoozedUntil && new Date(med.snoozedUntil) > new Date()) {
            return {
                icon: <CheckCircle2 size={14} />,
                text: t("statusSafe"),
                color: "text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-900/30",
                key: "safe" as FilterStatus,
            };
        }
        const diffDays = getDiffDays(med.expiryDate);
        if (diffDays < 0)
            return {
                icon: <XCircle size={14} />,
                text: t("statusExpired"),
                color: "text-red-600 bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-900/30",
                key: "expired" as FilterStatus,
            };
        if (diffDays <= 30)
            return {
                icon: <AlertTriangle size={14} />,
                text: t("statusExpiringSoon", { days: diffDays }),
                color: "text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-900/30",
                key: "expiringSoon" as FilterStatus,
            };
        return {
            icon: <CheckCircle2 size={14} />,
            text: t("statusSafe"),
            color: "text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-900/30",
            key: "safe" as FilterStatus,
        };
    };

    const handleExport = () => {
        const blob = new Blob([JSON.stringify(medicines, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "sahidawa_expiry_backup.json";
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleExportPDF = async () => {
        if (processedMedicines.length === 0) return;

        const [{ jsPDF }, { default: autoTable }] = await Promise.all([
            import("jspdf"),
            import("jspdf-autotable"),
        ]);

        const doc = new jsPDF();
        doc.setFontSize(16);
        doc.text("SahiDawa — Medicine Expiry Tracker", 14, 18);
        doc.setFontSize(10);
        doc.text(`${t("generatedOn")}: ${new Date().toLocaleDateString()}`, 14, 26);

        const headers = ["Medicine Name", "Expiry Date", "Batch No.", "Status"];
        const rows = processedMedicines.map((med) => [
            med.name,
            parseLocalDate(med.expiryDate).toLocaleDateString(),
            med.batchNumber ?? "—",
            getExpiryStatus(med).text,
        ]);

        try {
            autoTable(doc, {
                head: [headers],
                body: rows,
                startY: 32,
                styles: { fontSize: 9, cellPadding: 4 },
                headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: "bold" },
                alternateRowStyles: { fillColor: [245, 250, 248] },
                columnStyles: { 0: { cellWidth: 70 } },
            });
        } catch {
            let y = 36;
            const colWidths = [70, 40, 35, 40];
            const colX = [14, 84, 124, 159];

            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");
            headers.forEach((h, i) => doc.text(h, colX[i], y));
            y += 2;
            doc.line(14, y, 196, y);
            y += 5;

            doc.setFont("helvetica", "normal");
            rows.forEach((row) => {
                if (y > 275) {
                    doc.addPage();
                    y = 20;
                }
                row.forEach((cell, i) => {
                    const text = doc.splitTextToSize(String(cell), colWidths[i] - 2);
                    doc.text(text, colX[i], y);
                });
                y += 8;
            });
        }

        doc.save("sahidawa_expiry_tracker.pdf");
        toast.success(t("pdfExportSuccess") || "PDF Exported Successfully!");
    };

    const handlePrint = () => {
        window.print();
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        setImportError(null);
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const parsed = JSON.parse(event.target?.result as string);
                if (!Array.isArray(parsed)) throw new Error("Not an array");
                const valid = parsed.filter(
                    (item) =>
                        typeof item.id === "string" &&
                        typeof item.name === "string" &&
                        typeof item.expiryDate === "string" &&
                        isValidDateString(item.expiryDate)
                );
                if (valid.length !== parsed.length) {
                    setImportError(t("importDateError"));
                    return;
                }

                const existingIds = new Set(medicines.map((m) => m.id));
                const newItems = valid.filter((m) => !existingIds.has(m.id));
                if (newItems.length === 0) return;

                await importMedicines(newItems);
            } catch {
                setImportError(t("importError"));
            }
        };
        reader.readAsText(file);
        e.target.value = "";
    };

    const processedMedicines = medicines
        .filter((med) => {
            if (filterStatus === "all") return true;
            return getExpiryStatus(med).key === filterStatus;
        })
        .filter((med) => med.name.toLowerCase().includes(searchQuery.toLowerCase()))
        .sort((a, b) => {
            if (sortBy === "expirySoonest")
                return getDiffDays(a.expiryDate) - getDiffDays(b.expiryDate);
            if (sortBy === "expiryLatest")
                return getDiffDays(b.expiryDate) - getDiffDays(a.expiryDate);
            return a.name.localeCompare(b.name);
        });

    const filterOptions: { key: FilterStatus; label: string }[] = [
        { key: "all", label: t("filterAll") },
        { key: "expired", label: t("filterExpired") },
        { key: "expiringSoon", label: t("filterExpiringSoon") },
        { key: "safe", label: t("filterSafe") },
    ];

    return (
        <div className="min-h-screen bg-(--color-surface-page) text-(--color-text-primary) transition-colors duration-300">
            <PageHeader title={t("title")} subtitle={t("subtitle")} backHref="/" variant="light" />

            <main className="mx-auto max-w-6xl p-6 pt-32 md:pt-40">
                <div className="mt-4 grid grid-cols-1 gap-8 md:grid-cols-3">
                    <ExpiryForm
                        t={t}
                        editingId={editingId}
                        name={name}
                        expiryDate={expiryDate}
                        batchNumber={batchNumber}
                        notes={notes}
                        dateError={dateError}
                        isExpired={isExpired}
                        isSubmitting={isSubmitting}
                        importError={importError}
                        medicinesCount={medicines.length}
                        fileInputRef={fileInputRef}
                        notificationPermission={notificationPermission}
                        onNameChange={setName}
                        onExpiryDateChange={setExpiryDate}
                        onBatchNumberChange={setBatchNumber}
                        onNotesChange={setNotes}
                        onExpiredChange={setIsExpired}
                        onDateErrorChange={setDateError}
                        onSubmit={handleSubmit}
                        onCancelEdit={cancelEdit}
                        onOpenScanner={() => {
                            scannerTriggerRef.current = document.activeElement as HTMLButtonElement;
                            setIsScannerOpen(true);
                        }}
                        onExportPDF={handleExportPDF}
                        onPrint={handlePrint}
                        onExport={handleExport}
                        onImport={handleImport}
                        onRequestNotificationPermission={requestNotificationPermission}
                    />

                    <div className="space-y-4 md:col-span-2">
                        <ExpirySummary
                            t={t}
                            totalMedicines={medicines.length}
                            selectedCount={selectedIds.size}
                            searchQuery={searchQuery}
                            sortBy={sortBy}
                            filterStatus={filterStatus}
                            filterOptions={filterOptions}
                            onBulkDelete={handleBulkDelete}
                            onSearchChange={setSearchQuery}
                            onSortChange={setSortBy}
                            onFilterChange={setFilterStatus}
                        />
                        <ExpiryTable
                            t={t}
                            medicines={processedMedicines}
                            isLoaded={isLoaded}
                            selectedIds={selectedIds}
                            getExpiryStatus={getExpiryStatus}
                            onToggleSelect={toggleSelect}
                            onStartEdit={startEdit}
                            onDelete={handleDelete}
                            onSnooze={snoozeMedicine}
                        />
                    </div>
                </div>
            </main>

            <ExpiryModal
                isOpen={isScannerOpen}
                isVerifying={isVerifying}
                apiError={apiError}
                onClose={handleScannerClose}
                onScan={handleBarcodeScan}
                onRetry={() => {
                    setApiError(null);
                }}
            />

            {/* Single delete confirmation */}
            <ConfirmationDialog
                isOpen={confirmDialog.isOpen && confirmDialog.type === "single"}
                title={t("deleteConfirmTitle") || "Delete Medicine?"}
                description={
                    t("deleteConfirmMessage", { medicine: confirmDialog.medicineName ?? "" }) ||
                    `This will permanently remove "${confirmDialog.medicineName}" from your tracked medicines. This action cannot be undone.`
                }
                confirmText={t("deleteMedicine") || "Delete"}
                cancelText={t("cancelButton") || "Cancel"}
                variant="danger"
                isLoading={isDeleting}
                onConfirm={confirmDeleteMedicine}
                onCancel={() => setConfirmDialog({ isOpen: false, type: "single" })}
            />

            {/* Bulk delete confirmation */}
            <ConfirmationDialog
                isOpen={confirmDialog.isOpen && confirmDialog.type === "bulk"}
                title={t("bulkDeleteConfirmTitle") || "Delete Multiple Medicines?"}
                description={
                    t("bulkDeleteConfirmMessage", { count: confirmDialog.count ?? 0 }) ||
                    `This will permanently remove ${confirmDialog.count} medicine(s) from your tracked list. This action cannot be undone.`
                }
                confirmText={t("deleteMedicine") || "Delete All"}
                cancelText={t("cancelButton") || "Cancel"}
                variant="danger"
                isLoading={isDeleting}
                onConfirm={confirmBulkDelete}
                onCancel={() => setConfirmDialog({ isOpen: false, type: "single" })}
            />
        </div>
    );
}
