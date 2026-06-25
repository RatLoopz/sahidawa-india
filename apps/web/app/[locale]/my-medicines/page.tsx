"use client";

import React, { useEffect, useState } from "react";
import { Bookmark, Trash2 } from "lucide-react";

export default function MyMedicinesPage() {
    const [savedMedicines, setSavedMedicines] = useState<any[]>([]);

    useEffect(() => {
        const saved = JSON.parse(localStorage.getItem('medicine-bookmarks') || '[]');
        setSavedMedicines(saved);
    }, []);

    const removeBookmark = (name: string) => {
        const updated = savedMedicines.filter((item: any) => item.alternative_name !== name);
        localStorage.setItem('medicine-bookmarks', JSON.stringify(updated));
        setSavedMedicines(updated);
    };

    return (
        <div className="mx-auto w-full max-w-4xl p-6">
            <h1 className="mb-8 text-2xl font-bold">Saved Generic Alternatives</h1>
            
            {savedMedicines.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed rounded-2xl">
                    <p className="text-slate-500">No medicines bookmarked yet.</p>
                </div>
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
        </div>
    );
}