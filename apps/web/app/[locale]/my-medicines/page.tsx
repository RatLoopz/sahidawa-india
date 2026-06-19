"use client";
import React, { useEffect, useState } from "react";

export default function MyMedicinesPage() {
    const [medicines, setMedicines] = useState<any[]>([]);

    useEffect(() => {
        fetch("/api/v1/medicines/tracked")
            .then((res) => res.json())
            .then((data) => setMedicines(data));
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
        <div className="p-6">
            <h1 className="mb-4 text-2xl font-bold">My Tracked Medicines</h1>
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
                            <td className={`border p-2 ${getStatusColor(m.expiry_date)}`}>
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
        </div>
    );
}
