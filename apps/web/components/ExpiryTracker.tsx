import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { API_BASE } from "@/lib/api";

interface ExpiryTrackerProps {
    medicineId: string;
    medicineName: string;
}

export const ExpiryTracker = ({ medicineId, medicineName }: ExpiryTrackerProps) => {
    const t = useTranslations("Tracking");
    const [batchNumber, setBatchNumber] = useState("");
    const [expiryDate, setExpiryDate] = useState("");
    const [error, setError] = useState<string | null>(null);

    // Returns null when valid, or an error message key/string when invalid.
    const validate = (): string | null => {
        const trimmedBatch = batchNumber.trim();

        if (!trimmedBatch) {
            return t("errorBatchRequired");
        }

        if (!expiryDate) {
            return t("errorExpiryRequired");
        }

        // Compare dates only (ignore time-of-day) so "today" is still valid.
        const selected = new Date(expiryDate);
        if (Number.isNaN(selected.getTime())) {
            return t("errorExpiryInvalid");
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        selected.setHours(0, 0, 0, 0);

        if (selected < today) {
            return t("errorExpiryPast");
        }

        return null;
    };

    const handleTrack = async () => {
        setError(null);

        const validationError = validate();
        if (validationError) {
            setError(validationError);
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/api/v1/medicines/track`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    medicine_id: medicineId,
                    medicine_name: medicineName,
                    batch_number: batchNumber.trim(),
                    expiry_date: expiryDate,
                }),
            });

            if (response.ok) {
                alert(t("success"));
            } else {
                setError(t("error"));
            }
        } catch {
            setError(t("error"));
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
                aria-invalid={!!error}
            />
            <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full border p-2"
                aria-invalid={!!error}
            />
            <button onClick={handleTrack} className="mt-2 w-full bg-green-600 p-2 text-white">
                {t("trackButton")}
            </button>
            {error && (
                <p role="alert" className="mt-2 text-sm text-red-600">
                    {error}
                </p>
            )}
        </div>
    );
};