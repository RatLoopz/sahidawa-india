"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Pill, Plus, Bookmark, Trash2 } from "lucide-react";

interface TrackedMedicine {
    id: string;
    medicine_name: string;
    expiry_date: string;
}

interface SavedMedicine {
    alternative_name: string;
    brand_name: string;
    jan_aushadhi_price: number;
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
    const [savedMedicines, setSavedMedicines] = useState<SavedMedicine[]>([]);
    const [error, setError] = useState<string | null>(null);

    // Fetch tracked medicines from API
    useEffect(() => {
        fetch("/api/v1/medicines/tracked")
            .then((res) => {
                if (!res.ok) throw new Error(`Request failed: ${res.status}`);
                return res.json();
            })
            .then((data) => setMedicines(Array.isArray(data) ? data : []))
            .catch((err: Error) => {
                setError("Failed to load medicines. Please try again.");
            });
    }, []);

    // Load bookmarked medicines from localStorage
    useEffect(() => {
        const saved = JSON.parse(localStorage.getItem('medicine-bookmarks') || '[]');
        setSavedMedicines(saved);
    }, []);

    const removeBookmark = (name: string) => {
        const updated = savedMedicines.filter(item => item.alternative_name !== name);
        localStorage.setItem('medicine-bookmarks', JSON.stringify(updated));
        setSavedMedicines(updated);
    };

    const medicinesWithDays = useMemo(
        () => medicines.map((m) => ({
            ...m,
            daysLeft: getDaysUntilExpiry(m.expiry_date),
        })), [medicines]
    );

    return (
        <div className="mx-auto w-full max-w-4xl min-w-[320px] p-6 space-y-12">
            
            {/* Section 1: Tracked Medicines */}
            <section>
                <h1 className="mb-4 text-2xl font-bold">My Tracked Medicines</h1>
                {error && <p className="mb-4 text-red-600">{error}</p>}
                
                {medicines.length === 0 && !error ? (
                    <div className="flex flex-col items-center justify-center space-y-4 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-4 py-16 text-center">
                        <Pill className="h-8 w-8 text-emerald-600" />
                        <h3 className="text-xl font-semibold">No Medicines Tracked Yet</h3>
                        <button onClick={() => window.location.href = "/scan"} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700">
                            <Plus className="inline mr-2 h-4 w-4" /> Add your first medicine
                        </button>
                    </div>
                ) : (
                    <table className="w-full border-collapse border border-slate-200">
                        <thead>
                            <tr className="bg-slate-100">
                                <th className="border p-2">Name</th>
                                <th className="border p-2">Expiry</th>
                                <th className="border p-2">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {medicinesWithDays.map((m) => (
                                <tr key={m.id}>
                                    <td className="border p-2">{m.medicine_name}</td>
                                    <td className="border p-2">{new Date(m.expiry_date).toLocaleDateString()}</td>
                                    <td className={`border p-2 text-white ${getStatusColor(m.daysLeft)}`}>
                                        {m.daysLeft} days left
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </section>

            {/* Section 2: Bookmarked Medicines */}
            <section>
                <div className="flex items-center gap-2 mb-4">
                    <Bookmark className="text-emerald-600" />
                    <h2 className="text-xl font-bold">Saved Generic Alternatives</h2>
                </div>
                
                {savedMedicines.length === 0 ? (
                    <p className="text-slate-500 italic">No medicines bookmarked yet.</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {savedMedicines.map((med, index) => (
                            <div key={index} className="flex justify-between items-center p-4 border border-emerald-200 rounded-2xl bg-white shadow-sm">
                                <div>
                                    <h4 className="font-bold text-emerald-800">{med.alternative_name}</h4>
                                    <p className="text-xs text-gray-500">Brand: {med.brand_name}</p>
                                    <p className="text-emerald-600 font-bold">₹{med.jan_aushadhi_price}</p>
                                </div>
                                <button onClick={() => removeBookmark(med.alternative_name)} className="text-red-400 hover:text-red-600">
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