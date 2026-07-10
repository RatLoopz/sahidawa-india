"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Pill, Plus, Bookmark, Trash2, AlertTriangle, RefreshCw } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Badge } from "@/components/ui/Badge";
import { ConfirmationDialog } from "@/components/ConfirmationDialog";
import { RequestVerificationModal } from "@/components/RequestVerificationModal";
import { API_BASE } from "@/lib/api";
import { useTranslations } from "next-intl";
import { useBookmarksStore } from "@/src/stores/useBookmarksStore";

interface TrackedMedicine {
    id: string;
    medicine_name: string;
    expiry_date: string;
    is_verified: boolean;
}

function getDaysUntilExpiry(expiryDate: string): number {
    const diff = new Date(expiryDate).getTime() - new Date().getTime();
    return Math.ceil(diff / (1000 * 3600 * 24));
}

function getStatusColor(daysLeft: number): string {
    if (daysLeft < 7) return "bg-[var(--color-accent-danger)]";
    if (daysLeft < 14) return "bg-[var(--color-accent-warning)]";
    if (daysLeft < 30) return "bg-[var(--color-brand-secondary)]";
    return "bg-[var(--color-brand-primary)]";
}

type FetchStatus = "loading" | "success" | "error";

export default function MyMedicinesPage() {
    const [medicines, setMedicines] = useState<TrackedMedicine[]>([]);
    const t = useTranslations("MyMedicines");
    const bookmarks = useBookmarksStore((state) => state.bookmarks);
    const removeBookmarkFromStore = useBookmarksStore((state) => state.removeBookmark);

    const [confirmDialog, setConfirmDialog] = useState<{
        isOpen: boolean;
        bookmarkName?: string;
    }>({
        isOpen: false,
    });
    const [isDeleting, setIsDeleting] = useState(false);
    const [verificationModalOpen, setVerificationModalOpen] = useState(false);
    const [selectedMedicine, setSelectedMedicine] = useState<TrackedMedicine | null>(null);
    const verificationTriggerRef = React.useRef<HTMLButtonElement | null>(null);

    const handleUnverifiedClick = (medicine: TrackedMedicine) => {
        setSelectedMedicine(medicine);
        setVerificationModalOpen(true);
    };
    const [status, setStatus] = useState<FetchStatus>("loading");
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        let cancelled = false;

        const fetchTrackedMedicines = async () => {
            setStatus("loading");
            setErrorMessage(null);

            try {
                const res = await fetch(`${API_BASE}/api/v1/medicines/tracked`);

                if (!res.ok) {
                    throw new Error(t("errors.statusError", { status: res.status }));
                }

                const data = await res.json();

                if (cancelled) return;

                setMedicines(Array.isArray(data) ? data : []);
                setStatus("success");
            } catch (err) {
                if (cancelled) return;

                setMedicines([]);
                setStatus("error");
                setErrorMessage(err instanceof Error ? err.message : t("errors.fetchFailed"));
            }
        };

        fetchTrackedMedicines();

        return () => {
            cancelled = true;
        };
    }, [refreshKey]);

    const removeBookmark = (name: string) => {
        setConfirmDialog({
            isOpen: true,
            bookmarkName: name,
        });
    };

    const closeVerificationModal = () => {
        setVerificationModalOpen(false);
        requestAnimationFrame(() => verificationTriggerRef.current?.focus());
    };

    const confirmRemoveBookmark = () => {
        if (!confirmDialog.bookmarkName) return;
        setIsDeleting(true);
        try {
            removeBookmarkFromStore(confirmDialog.bookmarkName);
        } finally {
            setIsDeleting(false);
            setConfirmDialog({ isOpen: false });
        }
    };

    const medicinesWithDays = useMemo(
        () => medicines.map((m) => ({ ...m, daysLeft: getDaysUntilExpiry(m.expiry_date) })),
        [medicines]
    );

    return (
        <div className="mx-auto w-full max-w-4xl space-y-12 p-6">
            {/* Tracked Medicines Section */}
            <section>
                <h1 className="mb-4 text-2xl font-bold">{t("page.title")}</h1>

                {status === "loading" ? (
                    <div className="flex flex-col items-center justify-center space-y-3 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-4 py-16 text-center dark:border-slate-800 dark:bg-slate-900/20">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {t("page.loading")}
                        </p>
                    </div>
                ) : status === "error" ? (
                    /* --- Error State: never conflated with the empty state --- */
                    <div className="flex flex-col items-center justify-center space-y-4 rounded-2xl border-2 border-dashed border-red-200 bg-red-50/50 px-4 py-16 text-center dark:border-red-900 dark:bg-red-950/20">
                        <div className="rounded-full bg-red-100 p-4 text-red-600 dark:bg-red-950/40 dark:text-red-400">
                            <AlertTriangle className="h-8 w-8" />
                        </div>
                        <div className="max-w-sm space-y-1.5">
                            <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200">
                                {t("errors.title")}
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                {errorMessage ?? t("errors.generic")}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setRefreshKey((k) => k + 1)}
                            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-red-700"
                        >
                            <RefreshCw className="h-4 w-4" />
                            {t("errors.tryAgain")}
                        </button>
                    </div>
                ) : medicines.length === 0 ? (
                    /* --- Centered Empty State Wrapper (only shown on a confirmed empty result) --- */
                    <div className="flex flex-col items-center justify-center space-y-4 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-4 py-16 text-center dark:border-slate-800 dark:bg-slate-900/20">
                        <div className="rounded-full bg-emerald-50 p-4 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
                            <Pill className="h-8 w-8" />
                        </div>
                        <div className="max-w-sm space-y-1.5">
                            <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200">
                                {t("emptyState.title")}
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                {t("emptyState.description")}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => (window.location.href = "/scan")}
                            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-emerald-700"
                        >
                            <Plus className="h-4 w-4" />
                            {t("emptyState.addFirst")}
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <AnimatePresence>
                            {medicinesWithDays.map((med) => (
                                <motion.div
                                    key={med.id}
                                    initial={{ opacity: 0, y: 15 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -15 }}
                                    transition={{ duration: 0.25 }}
                                    whileHover={{
                                        y: -4,
                                        scale: 1.02,
                                    }}
                                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:border-emerald-500 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-500"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex min-w-0 items-center gap-3">
                                            <div className="rounded-full bg-[var(--color-brand-primary-soft)] p-2">
                                                <Pill className="h-5 w-5 text-[var(--color-brand-primary-dark)]" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h3 className="leading-5 font-semibold break-words text-slate-900 dark:text-slate-100">
                                                        {med.medicine_name}
                                                    </h3>
                                                    {med.is_verified === true && (
                                                        <Badge
                                                            variant="success"
                                                            aria-label={t(
                                                                "badges.verificationStatus"
                                                            )}
                                                        >
                                                            ✓ {t("badges.verified")}
                                                        </Badge>
                                                    )}
                                                    {med.is_verified === false && (
                                                        <button
                                                            onClick={(event) => {
                                                                verificationTriggerRef.current =
                                                                    event.currentTarget;
                                                                handleUnverifiedClick(med);
                                                            }}
                                                            className="min-h-11 transition-transform hover:scale-105 active:scale-95"
                                                            title={t(
                                                                "badges.requestVerificationTitle"
                                                            )}
                                                        >
                                                            <Badge
                                                                variant="warning"
                                                                aria-label={t(
                                                                    "badges.verificationStatus"
                                                                )}
                                                            >
                                                                ⚠ {t("badges.unverified")}
                                                            </Badge>
                                                        </button>
                                                    )}
                                                </div>
                                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                                    {t("table.expiry")}:{" "}
                                                    {new Date(med.expiry_date).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                        <span
                                            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold text-white ${getStatusColor(
                                                med.daysLeft
                                            )}`}
                                        >
                                            {t("table.daysLeft", { count: med.daysLeft })}
                                        </span>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </section>

            {/* Saved Bookmarks Section */}
            <section>
                <h2 className="mb-4 flex items-center gap-2 text-xl font-bold">
                    <Bookmark className="text-emerald-600" /> {t("bookmarks.savedAlternatives")}
                </h2>
                {bookmarks.length === 0 ? (
                    <p className="text-slate-500 italic">{t("bookmarks.noBookmarks")}</p>
                ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {bookmarks.map((med) => (
                            <div
                                key={med.alternative_name}
                                className="flex items-center justify-between rounded-2xl border bg-white p-4 shadow-sm"
                            >
                                <div>
                                    <h4 className="font-bold text-emerald-800">
                                        {med.alternative_name}
                                    </h4>
                                    <p className="text-xs text-gray-500">
                                        {t("bookmarks.brand", { brand: med.brand_name })}
                                    </p>
                                    <p className="font-bold text-emerald-600">
                                        ₹{med.jan_aushadhi_price}
                                    </p>
                                </div>
                                <button
                                    onClick={() => removeBookmark(med.alternative_name)}
                                    className="text-red-400 hover:text-red-600"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Bookmark deletion confirmation */}
            <ConfirmationDialog
                isOpen={confirmDialog.isOpen}
                title={t("removeDialog.title")}
                description={t("removeDialog.description", {
                    name: confirmDialog.bookmarkName ?? "",
                })}
                confirmText={t("removeDialog.confirm")}
                cancelText={t("removeDialog.cancel")}
                variant="warning"
                isLoading={isDeleting}
                onConfirm={confirmRemoveBookmark}
                onCancel={() => setConfirmDialog({ isOpen: false })}
            />
            {selectedMedicine && (
                <RequestVerificationModal
                    isOpen={verificationModalOpen}
                    onClose={closeVerificationModal}
                    medicineName={selectedMedicine.medicine_name}
                />
            )}
        </div>
    );
}
