import React, { useState } from "react";
import { useTranslations } from "next-intl";

interface ExpiryTrackerProps {
    medicineId: string;
    medicineName: string;
}

export const ExpiryTracker = ({ medicineId, medicineName }: ExpiryTrackerProps) => {
    const t = useTranslations("Tracking");
    const [batchNumber, setBatchNumber] = useState("");
    const [expiryDate, setExpiryDate] = useState("");

    const handleTrack = async () => {
        const response = await fetch("/api/v1/medicines/track", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                medicine_id: medicineId,
                medicine_name: medicineName,
                batch_number: batchNumber,
                expiry_date: expiryDate,
            }),
        });

        if (response.ok) {
            alert(t("success"));
        }
    };

    return (
        <div className="rounded border p-4 shadow-sm">
            <h3 className="font-bold">{medicineName}</h3>
            <input
                placeholder="Batch Number"
                value={batchNumber}
                onChange={(e) => setBatchNumber(e.target.value)}
                className="my-2 w-full border p-2"
            />
            <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full border p-2"
            />
            <button onClick={handleTrack} className="mt-2 w-full bg-green-600 p-2 text-white">
                {t("trackButton")}
            </button>
        </div>
    );
};
