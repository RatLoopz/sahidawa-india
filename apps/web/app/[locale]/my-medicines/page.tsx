"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Pill, Bookmark, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

interface TrackedMedicine {
    id: string;
    medicine_name: string;
    expiry_date: string;
}

// Updated interface to include bookmark data structure
interface BookmarkedMedicine {
    alternative_name: string;
    brand_name: string;
    jan_aushadhi_price: number;
}

function getSavedMedicineBookmarks(): BookmarkedMedicine[] {
    if (typeof window === "undefined") return [];

    try {
        const stored = localStorage.getItem("medicine-bookmarks");
        if (!stored) return [];

        const parsed = JSON.parse(stored);
        if (!Array.isArray(parsed)) {
            localStorage.setItem("medicine-bookmarks", "[]");
            return [];
        }

        return parsed;
    } catch {
        localStorage.setItem("medicine-bookmarks", "[]");
        return [];
    }
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

export default function MyMedicinesPage() {
    const [medicines, setMedicines] = useState<TrackedMedicine[]>([]);
    const [savedMedicines, setSavedMedicines] = useState<BookmarkedMedicine[]>([]);
    const [, setError] = useState<string | null>(null);

    useEffect(() => {
        // Fetch tracked medicines from API
        fetch("/api/v1/medicines/tracked")
            .then((res) => (res.ok ? res.json() : []))
            .then((data) => setMedicines(Array.isArray(data) ? data : []))
            .catch(() => setError("Failed to load tracked medicines."));

        // Load bookmarks from localStorage
        const bookmarks = getSavedMedicineBookmarks();
        setSavedMedicines(bookmarks);
    }, []);

    const removeBookmark = (name: string) => {
        const updated = savedMedicines.filter((item) => item.alternative_name !== name);
        localStorage.setItem("medicine-bookmarks", JSON.stringify(updated));
        setSavedMedicines(updated);
    };

    const medicinesWithDays = useMemo(
        () => medicines.map((m) => ({ ...m, daysLeft: getDaysUntilExpiry(m.expiry_date) })),
        [medicines]
    );

    return (
        <div className="mx-auto w-full max-w-4xl space-y-12 p-6">
            {/* Tracked Medicines Section */}
            <section>
                <h1 className="mb-4 text-2xl font-bold">My Tracked Medicines</h1>
                {medicines.length === 0 ? (
                    <div className="flex flex-col items-center justify-center space-y-4 rounded-2xl border-2 border-dashed border-slate-200 p-16 text-center">
                        <Pill className="h-8 w-8 text-[var(--color-brand-primary-dark)]" />
                        <h3 className="text-xl font-semibold">No Medicines Tracked</h3>
                        <button
                            onClick={() => (window.location.href = "/scan")}
                            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700"
                        >
                            Add First Medicine
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
                                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:border-emerald-500 hover:shadow-lg"
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex min-w-0 items-center gap-3">
                                            <div className="rounded-full bg-[var(--color-brand-primary-soft)] p-2">
                                                <Pill className="h-5 w-5 text-[var(--color-brand-primary-dark)]" />
                                            </div>
                                            <div>
                                                <h3 className="leading-5 font-semibold break-words text-slate-900">
                                                    {med.medicine_name}
                                                </h3>
                                                <p className="mt-1 text-sm text-slate-500">
                                                    Expires:{" "}
                                                    {new Date(med.expiry_date).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                        <span
                                            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold text-white ${getStatusColor(
                                                med.daysLeft
                                            )}`}
                                        >
                                            {med.daysLeft} days left
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
                    <Bookmark className="text-emerald-600" /> Saved Alternatives
                </h2>
                {savedMedicines.length === 0 ? (
                    <p className="text-slate-500 italic">No bookmarks yet.</p>
                ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {savedMedicines.map((med) => (
                            <div
                                key={med.alternative_name}
                                className="flex items-center justify-between rounded-2xl border bg-white p-4 shadow-sm"
                            >
                                <div>
                                    <h4 className="font-bold text-emerald-800">
                                        {med.alternative_name}
                                    </h4>
                                    <p className="text-xs text-gray-500">Brand: {med.brand_name}</p>
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
        </div>
    );
}
