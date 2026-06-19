import type React from "react";
import { Bell, BellOff, Download, FileText, Printer, ScanLine, Upload, X } from "lucide-react";

import { parseLocalDate } from "./dateUtils";

interface ExpiryFormProps {
    t: (key: string) => string;
    editingId: string | null;
    name: string;
    expiryDate: string;
    batchNumber: string;
    notes: string;
    dateError: string;
    isExpired: boolean;
    importError: string | null;
    medicinesCount: number;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    notificationPermission: string;
    onNameChange: (value: string) => void;
    onExpiryDateChange: (value: string) => void;
    onBatchNumberChange: (value: string) => void;
    onNotesChange: (value: string) => void;
    onExpiredChange: (value: boolean) => void;
    onDateErrorChange: (value: string) => void;
    onSubmit: (event: React.FormEvent) => void;
    onCancelEdit: () => void;
    onOpenScanner: () => void;
    onExportPDF: () => void;
    onPrint: () => void;
    onExport: () => void;
    onImport: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onRequestNotificationPermission: () => void;
}

export function ExpiryForm({
    t,
    editingId,
    name,
    expiryDate,
    batchNumber,
    notes,
    dateError,
    isExpired,
    importError,
    medicinesCount,
    fileInputRef,
    notificationPermission,
    onNameChange,
    onExpiryDateChange,
    onBatchNumberChange,
    onNotesChange,
    onExpiredChange,
    onDateErrorChange,
    onSubmit,
    onCancelEdit,
    onOpenScanner,
    onExportPDF,
    onPrint,
    onExport,
    onImport,
    onRequestNotificationPermission,
}: ExpiryFormProps) {
    const hasNotifications = typeof window !== "undefined" && "Notification" in window;

    return (
        <div className="h-fit rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted) p-6 shadow-sm md:sticky md:top-32 md:col-span-1">
            {hasNotifications && notificationPermission !== "granted" && (
                <div className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm">
                    <h3 className="flex items-center gap-1.5 text-[11px] font-bold tracking-tight text-amber-600 uppercase dark:text-amber-400">
                        <BellOff size={14} /> Enable Expiry Alerts
                    </h3>
                    <p className="mt-2 text-xs leading-relaxed text-(--color-text-secondary)">
                        Get notified 7 days and 1 day before your medicines expire.
                    </p>
                    <button
                        type="button"
                        onClick={onRequestNotificationPermission}
                        className="mt-3 w-full rounded-lg bg-amber-600 py-2 text-xs font-bold text-white shadow transition hover:bg-amber-700 active:scale-95"
                    >
                        Enable Notifications
                    </button>
                </div>
            )}

            <h2 className="mb-4 text-lg font-bold tracking-tight uppercase">
                {editingId ? t("editMedicine") : t("addMedicine")}
            </h2>
            <form onSubmit={onSubmit} className="space-y-4">
                <div>
                    <label className="mb-1 block text-xs font-bold tracking-wider uppercase opacity-60">
                        {t("name")}
                    </label>
                    <input
                        type="text"
                        required
                        value={name}
                        onChange={(event) => onNameChange(event.target.value)}
                        className="w-full rounded-xl border border-(--color-border-muted) bg-(--color-surface-page) p-3 text-(--color-text-primary) transition outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder={t("namePlaceholder")}
                    />
                </div>
                <div>
                    <label className="mb-1 block text-xs font-bold tracking-wider uppercase opacity-60">
                        {t("expiryDate")}
                    </label>

                    <input
                        type="date"
                        required
                        value={expiryDate}
                        onChange={(event) => {
                            const value = event.target.value;

                            onExpiryDateChange(value);
                            onDateErrorChange("");

                            if (value) {
                                const selected = parseLocalDate(value);
                                const today = new Date();

                                today.setHours(0, 0, 0, 0);
                                selected.setHours(0, 0, 0, 0);

                                onExpiredChange(selected < today);
                            } else {
                                onExpiredChange(false);
                            }
                        }}
                        className="w-full rounded-xl border border-(--color-border-muted) bg-(--color-surface-page) p-3 text-(--color-text-primary) [color-scheme:light] transition outline-none focus:ring-2 focus:ring-emerald-500 dark:[color-scheme:dark]"
                    />

                    {isExpired && (
                        <p className="mt-1 text-sm text-amber-600">
                            Warning: This medicine has already expired.
                        </p>
                    )}

                    {dateError && <p className="mt-1 text-sm text-red-600">{dateError}</p>}
                </div>
                <div>
                    <label className="mb-1 block text-xs font-bold tracking-wider uppercase opacity-60">
                        {t("batchNumber")}
                    </label>
                    <input
                        type="text"
                        value={batchNumber}
                        onChange={(event) => onBatchNumberChange(event.target.value)}
                        className="w-full rounded-xl border border-(--color-border-muted) bg-(--color-surface-page) p-3 text-(--color-text-primary) transition outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder={t("batchPlaceholder")}
                    />
                </div>
                <div>
                    <label className="mb-1 block text-xs font-bold tracking-wider uppercase opacity-60">
                        {t("notesLabel")}
                    </label>
                    <textarea
                        value={notes}
                        onChange={(event) => onNotesChange(event.target.value)}
                        rows={3}
                        className="w-full resize-none rounded-xl border border-(--color-border-muted) bg-(--color-surface-page) p-3 text-(--color-text-primary) transition outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder={t("notesPlaceholder")}
                    />
                </div>
                <button
                    type="button"
                    onClick={onOpenScanner}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-600/30 bg-emerald-600/10 py-3 text-sm font-semibold text-emerald-600 transition hover:bg-emerald-600/20 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-400"
                >
                    <ScanLine size={16} />
                    Scan Barcode
                </button>
                <button
                    type="submit"
                    className="w-full rounded-xl bg-emerald-600 py-3 font-bold text-white shadow-lg shadow-emerald-900/20 transition-all hover:bg-emerald-700 active:scale-95"
                >
                    {editingId ? t("saveChanges") : t("addToTracker")}
                </button>
                {editingId && (
                    <button
                        type="button"
                        onClick={onCancelEdit}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-(--color-border-muted) py-3 font-bold transition hover:bg-(--color-surface-page)"
                    >
                        <X size={18} /> {t("cancel")}
                    </button>
                )}
            </form>

            <div className="mt-6 flex flex-col gap-2">
                <button
                    onClick={onExportPDF}
                    disabled={medicinesCount === 0}
                    aria-label={t("exportPDF")}
                    className="flex items-center justify-center gap-2 rounded-xl border border-(--color-border-muted) py-2.5 text-sm font-semibold transition hover:bg-(--color-surface-page) disabled:opacity-40"
                >
                    <FileText size={15} /> {t("exportPDF")}
                </button>
                <button
                    onClick={onPrint}
                    disabled={medicinesCount === 0}
                    aria-label={t("print")}
                    className="flex items-center justify-center gap-2 rounded-xl border border-(--color-border-muted) py-2.5 text-sm font-semibold transition hover:bg-(--color-surface-page) disabled:opacity-40"
                >
                    <Printer size={15} /> {t("print")}
                </button>
                <button
                    onClick={onExport}
                    disabled={medicinesCount === 0}
                    className="flex items-center justify-center gap-2 rounded-xl border border-(--color-border-muted) py-2.5 text-sm font-semibold transition hover:bg-(--color-surface-page) disabled:opacity-40"
                >
                    <Download size={15} /> {t("exportBackup")}
                </button>
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center justify-center gap-2 rounded-xl border border-(--color-border-muted) py-2.5 text-sm font-semibold transition hover:bg-(--color-surface-page)"
                >
                    <Upload size={15} /> {t("importBackup")}
                </button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={onImport}
                    className="hidden"
                />
                {importError && <p className="text-xs text-red-500">{importError}</p>}
            </div>

            {hasNotifications && notificationPermission === "granted" && (
                <div className="mt-4 flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <Bell size={13} /> Expiry Alerts Enabled (7d & 1d)
                </div>
            )}
        </div>
    );
}
