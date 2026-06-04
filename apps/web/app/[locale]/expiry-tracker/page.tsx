"use client";
import React, { useState, useEffect } from "react";
import { PageHeader } from "../components/PageHeader";
import { Calendar, Trash2, Package, XCircle, AlertTriangle, CheckCircle2 } from "lucide-react";

interface Medicine {
    id: string;
    name: string;
    expiryDate: string;
    batchNumber?: string;
}

export default function ExpiryTrackerPage() {
    const [medicines, setMedicines] = useState<Medicine[]>([]);
    const [name, setName] = useState("");
    const [expiryDate, setExpiryDate] = useState("");
    const [batchNumber, setBatchNumber] = useState("");
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        try {
            if (typeof window !== "undefined" && window.localStorage) {
                const saved = window.localStorage.getItem("sahidawa_expiry_tracker");
                if (saved) {
                    setMedicines(JSON.parse(saved));
                }
            }
        } catch (e) {
            console.error("Failed to load medicines from localStorage:", e);
        } finally {
            setIsLoaded(true);
        }
    }, []);

    const saveToLocalStorage = (updatedList: Medicine[]) => {
        setMedicines(updatedList);
        try {
            if (typeof window !== "undefined" && window.localStorage) {
                window.localStorage.setItem("sahidawa_expiry_tracker", JSON.stringify(updatedList));
            }
        } catch (e) {
            console.error("Failed to save medicines to localStorage:", e);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !expiryDate) return;

        const newMedicine: Medicine = {
            id: Date.now().toString(),
            name,
            expiryDate,
            batchNumber,
        };

        const updated = [...medicines, newMedicine];
        saveToLocalStorage(updated);
        setName("");
        setExpiryDate("");
        setBatchNumber("");
    };

    const handleDelete = (id: string) => {
        const updated = medicines.filter((med) => med.id !== id);
        saveToLocalStorage(updated);
    };

    const parseLocalDate = (dateStr: string) => {
        const [year, month, day] = dateStr.split("-").map(Number);
        return new Date(year, month - 1, day);
    };

    const getExpiryStatus = (dateStr: string) => {
        const expiry = parseLocalDate(dateStr);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays < 0)
            return {
                icon: <XCircle size={14} />,
                text: "Expired",
                color: "text-red-600 bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-900/30",
            };
        if (diffDays <= 30)
            return {
                icon: <AlertTriangle size={14} />,
                text: `Expiring soon (${diffDays}d)`,
                color: "text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-900/30",
            };
        return {
            icon: <CheckCircle2 size={14} />,
            text: "Safe",
            color: "text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-900/30",
        };
    };

    return (
        <div className="min-h-screen bg-(--color-surface-page) text-(--color-text-primary) transition-colors duration-300">
            <PageHeader
                title="Medicine Expiry Tracker"
                subtitle="Manage and track your medicine stock locally"
                backHref="/"
                variant="light"
            />

            <main className="mx-auto max-w-6xl p-6 pt-32 md:pt-40">
                <div className="mt-4 grid grid-cols-1 gap-8 md:grid-cols-3">
                    <div className="sticky top-32 h-fit rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted) p-6 shadow-sm md:col-span-1">
                        <h2 className="mb-4 text-lg font-bold tracking-tight uppercase">
                            Add Medicine
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="mb-1 block text-xs font-bold tracking-wider uppercase opacity-60">
                                    Name
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full rounded-xl border border-(--color-border-muted) bg-(--color-surface-page) p-3 text-(--color-text-primary) transition outline-none focus:ring-2 focus:ring-emerald-500"
                                    placeholder="e.g. Paracetamol"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-bold tracking-wider uppercase opacity-60">
                                    Expiry Date
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={expiryDate}
                                    onChange={(e) => setExpiryDate(e.target.value)}
                                    className="w-full rounded-xl border border-(--color-border-muted) bg-(--color-surface-page) p-3 text-(--color-text-primary) [color-scheme:light] transition outline-none focus:ring-2 focus:ring-emerald-500 dark:[color-scheme:dark]"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-bold tracking-wider uppercase opacity-60">
                                    Batch Number (Optional)
                                </label>
                                <input
                                    type="text"
                                    value={batchNumber}
                                    onChange={(e) => setBatchNumber(e.target.value)}
                                    className="w-full rounded-xl border border-(--color-border-muted) bg-(--color-surface-page) p-3 text-(--color-text-primary) transition outline-none focus:ring-2 focus:ring-emerald-500"
                                    placeholder="e.g. B12345"
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full rounded-xl bg-emerald-600 py-3 font-bold text-white shadow-lg shadow-emerald-900/20 transition-all hover:bg-emerald-700 active:scale-95"
                            >
                                Add to Tracker
                            </button>
                        </form>
                    </div>

                    <div className="space-y-4 md:col-span-2">
                        <div className="flex items-center justify-between px-2">
                            <h2 className="text-xl font-bold">Tracked Medicines</h2>
                            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-500">
                                Total: {medicines.length}
                            </span>
                        </div>

                        {!isLoaded ? (
                            <div className="py-20 text-center opacity-50">
                                <p className="animate-pulse">Loading tracker data...</p>
                            </div>
                        ) : medicines.length === 0 ? (
                            <div className="rounded-3xl border-2 border-dashed border-(--color-border-muted) bg-(--color-surface-muted) py-20 text-center opacity-50">
                                <Package size={48} className="mx-auto mb-2 opacity-50" />
                                <p>No medicines added yet.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4">
                                {medicines.map((med) => {
                                    const status = getExpiryStatus(med.expiryDate);
                                    return (
                                        <div
                                            key={med.id}
                                            className="flex items-center justify-between rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted) p-5 shadow-sm transition-all hover:border-emerald-500/50"
                                        >
                                            <div className="space-y-1">
                                                <h3 className="text-lg leading-tight font-bold">
                                                    {med.name}
                                                </h3>
                                                <div className="flex items-center gap-3 text-sm opacity-70">
                                                    <span className="flex items-center gap-1">
                                                        <Calendar size={14} />{" "}
                                                        {parseLocalDate(
                                                            med.expiryDate
                                                        ).toLocaleDateString()}
                                                    </span>
                                                    {med.batchNumber && (
                                                        <span className="flex items-center gap-1">
                                                            <Package size={14} />{" "}
                                                            {med.batchNumber}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span
                                                    className={`flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-[11px] font-bold ${status.color}`}
                                                >
                                                    {status.icon} {status.text}
                                                </span>
                                                <button
                                                    onClick={() => handleDelete(med.id)}
                                                    className="rounded-full p-2 transition-colors hover:bg-red-500/10"
                                                >
                                                    <Trash2 size={18} className="text-red-500" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
