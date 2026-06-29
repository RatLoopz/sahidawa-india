"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Pill, Bookmark, Trash2 } from "lucide-react";

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
    if (daysLeft < 7) return "bg-red-500";
    if (daysLeft < 14) return "bg-orange-500";
    if (daysLeft < 30) return "bg-yellow-500";
    return "bg-green-500";
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
                        <Pill className="h-8 w-8 text-emerald-600" />
                        <h3 className="text-xl font-semibold">No Medicines Tracked</h3>
                        <button
                            onClick={() => (window.location.href = "/scan")}
                            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700"
                        >
                            Add First Medicine
                        </button>
                    </div>
                ) : (
                    <table className="w-full border-collapse">
                        <thead>
                            <tr>
                                <th className="border p-2">Name</th>
                                <th className="border p-2">Expiry</th>
                                <th className="border p-2">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {medicinesWithDays.map((m) => (
                                <tr key={m.id}>
                                    <td className="border p-2">{m.medicine_name}</td>
                                    <td className="border p-2">
                                        {new Date(m.expiry_date).toLocaleDateString()}
                                    </td>
                                    <td
                                        className={`border p-2 text-white ${getStatusColor(m.daysLeft)}`}
                                    >
                                        {m.daysLeft} days left
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
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
