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
    const [remindMe, setRemindMe] = useState(false);

    // Checks if the expiry date is within 30 days
    const isExpiringWithin30Days = (dateStr: string): boolean => {
        const selected = new Date(dateStr);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        selected.setHours(0, 0, 0, 0);

        const diffTime = selected.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        return diffDays >= 0 && diffDays <= 30;
    };

    // Helper to trigger standard browser push notification
    const triggerNotification = () => {
        if (!("Notification" in window)) return;

        if (Notification.permission === "granted") {
            new Notification(t("notificationTitle", { defaultValue: "Medicine Expiry Reminder" }), {
                body: t("notificationBody", {
                    defaultValue: `${medicineName} is expiring within 30 days! Please check.`,
                    name: medicineName,
                }),
                icon: "/icon.png",
            });
        }
    };

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

                if (remindMe && isExpiringWithin30Days(expiryDate)) {
                    if (Notification.permission === "default") {
                        const permission = await Notification.requestPermission();
                        if (permission === "granted") {
                            triggerNotification();
                        }
                    } else if (Notification.permission === "granted") {
                        triggerNotification();
                    }
                }
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
            <div className="my-2 flex items-center gap-2">
                <input
                    type="checkbox"
                    id={`remind-${medicineId}`}
                    checked={remindMe}
                    onChange={async (e) => {
                        const checked = e.target.checked;
                        setRemindMe(checked);
                        if (
                            checked &&
                            "Notification" in window &&
                            Notification.permission === "default"
                        ) {
                            await Notification.requestPermission();
                        }
                    }}
                />
                <label
                    htmlFor={`remind-${medicineId}`}
                    className="cursor-pointer text-sm select-none"
                >
                    {t("remindMeLabel", {
                        defaultValue: "Remind me when this expires (within 30 days)",
                    })}
                </label>
            </div>
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
