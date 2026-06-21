"use client";

import React, { useEffect, useState } from "react";
import { Pill, Plus } from "lucide-react";

export default function MyMedicinesPage() {
    const [medicines, setMedicines] = useState<any[]>([]);

    useEffect(() => {
        fetch("/api/v1/medicines/tracked")
            .then((res) => res.json())
            .then((data) => setMedicines(Array.isArray(data) ? data : []))
            .catch(() => setMedicines([]));
    }, []);

    const getStatusColor = (expiryDate: string) => {
        const diff = new Date(expiryDate).getTime() - new Date().getTime();
        const days = Math.ceil(diff / (1000 * 3600 * 24));
        if (days < 7) return "bg-red-500";
        if (days < 14) return "bg-orange-500";
        if (days < 30) return "bg-yellow-500";
        return "bg-green-500";
    };

    return (
        <div className="mx-auto w-full max-w-4xl min-w-[320px] p-6">
            <h1 className="mb-4 text-2xl font-bold">My Tracked Medicines</h1>

            {medicines.length === 0 ? (
                /* --- Centered Empty State Wrapper --- */
                <div className="flex flex-col items-center justify-center space-y-4 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-4 py-16 text-center dark:border-slate-800 dark:bg-slate-900/20">
                    <div className="rounded-full bg-emerald-50 p-4 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
                        <Pill className="h-8 w-8" />
                    </div>
                    <div className="max-w-sm space-y-1.5">
                        <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200">
                            No Medicines Tracked Yet
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Add your current prescriptions to track active schedules, safety
                            updates, and expiry windows automatically.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => (window.location.href = "/scan")}
                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-emerald-700"
                    >
                        <Plus className="h-4 w-4" />
                        Add your first medicine
                    </button>
                </div>
            ) : (
                /* --- Existing Table View --- */
                <table className="w-full border-collapse">
                    <thead>
                        <tr>
                            <th className="border p-2">Name</th>
                            <th className="border p-2">Expiry</th>
                            <th className="border p-2">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {medicines.map((m: any) => (
                            <tr key={m.id}>
                                <td className="border p-2">{m.medicine_name}</td>
                                <td className="border p-2">
                                    {new Date(m.expiry_date).toLocaleDateString()}
                                </td>
                                <td
                                    className={`border p-2 text-white ${getStatusColor(m.expiry_date)}`}
                                >
                                    {Math.ceil(
                                        (new Date(m.expiry_date).getTime() - new Date().getTime()) /
                                            (1000 * 3600 * 24)
                                    )}{" "}
                                    days left
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}
