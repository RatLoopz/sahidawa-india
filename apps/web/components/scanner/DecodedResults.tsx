"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Plus, AlertCircle, Clock, Heart, ShieldAlert, FileText, Info } from "lucide-react";
import { ScannerResult } from "./PrescriptionUpload";
import { useMedicineTracker } from "@/hooks/useMedicineTracker";
import { toast } from "sonner";
import { useRouter } from "@/i18n/routing";

interface DecodedResultsProps {
    data: ScannerResult;
}

export const DecodedResults: React.FC<DecodedResultsProps> = ({ data }) => {
    const t = useTranslations("Scanner");
    const { addMedicine } = useMedicineTracker();
    const router = useRouter();
    const [isAdding, setIsAdding] = useState(false);
    const [added, setAdded] = useState(false);

    const handleAddAll = async () => {
        setIsAdding(true);
        try {
            // Default expiry date: 1 year from now as a placeholder
            const placeholderExpiry = new Date();
            placeholderExpiry.setFullYear(placeholderExpiry.getFullYear() + 1);
            const expiryString = placeholderExpiry.toISOString().split("T")[0];

            for (const med of data.medicines) {
                // Compile all the AI extracted data into the notes field
                const notesParts = [];
                if (med.dosage) notesParts.push(`Dosage: ${med.dosage}`);
                if (med.timing || med.simpleTiming) notesParts.push(`Timing: ${med.simpleTiming || med.timing}`);
                if (med.instructions) notesParts.push(`Instructions: ${med.instructions}`);
                if (med.purpose) notesParts.push(`Purpose: ${med.purpose}`);
                if (med.side_effects) notesParts.push(`Side Effects: ${med.side_effects}`);

                await addMedicine({
                    name: med.name,
                    expiryDate: expiryString,
                    notes: notesParts.join("\n")
                });
            }

            setAdded(true);
            toast.success(t("addedSuccess"));
            
            // Optionally redirect to tracker after a short delay
            setTimeout(() => {
                router.push("/expiry-tracker");
            }, 1500);
            
        } catch (error) {
            console.error("Failed to add medicines:", error);
            toast.error(t("errors.apiFailure"));
        } finally {
            setIsAdding(false);
        }
    };

    if (!data.medicines || data.medicines.length === 0) {
        return (
            <div className="w-full max-w-2xl mx-auto p-6 border rounded-xl shadow-sm bg-white dark:bg-zinc-900 text-center">
                <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium">No medicines detected</h3>
                <p className="text-gray-500 mt-2">We couldn't confidently identify any medicines in this image.</p>
            </div>
        );
    }

    return (
        <div className="w-full max-w-2xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-zinc-900 p-4 border rounded-xl shadow-sm">
                <div>
                    <h2 className="text-xl font-bold">{data.medicines.length} Medicines Found</h2>
                    <p className="text-sm text-gray-500">Review the extracted details below</p>
                </div>
                <button
                    onClick={handleAddAll}
                    disabled={isAdding || added}
                    className="w-full sm:w-auto px-6 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-800 disabled:opacity-70 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                    {added ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                    {added ? "Added!" : t("addAll")}
                </button>
            </div>

            {data.patientVitals && (data.patientVitals.bloodPressure || data.patientVitals.temperature) && (
                <div className="p-4 border rounded-xl bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-900">
                    <h3 className="font-medium text-blue-800 dark:text-blue-300 flex items-center gap-2 mb-3">
                        <Heart className="w-5 h-5" />
                        {t("vitals")}
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        {data.patientVitals.bloodPressure && (
                            <div>
                                <span className="text-sm text-blue-600 dark:text-blue-400 block">Blood Pressure</span>
                                <span className="font-medium">{data.patientVitals.bloodPressure}</span>
                            </div>
                        )}
                        {data.patientVitals.temperature && (
                            <div>
                                <span className="text-sm text-blue-600 dark:text-blue-400 block">Temperature</span>
                                <span className="font-medium">{data.patientVitals.temperature}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="space-y-4">
                {data.medicines.map((med, idx) => (
                    <div key={idx} className="p-5 border rounded-xl bg-white dark:bg-zinc-900 shadow-sm transition-all hover:shadow-md">
                        <div className="border-b pb-3 mb-3">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <span className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 w-6 h-6 rounded-full flex items-center justify-center text-xs">
                                    {idx + 1}
                                </span>
                                {med.name}
                            </h3>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {med.dosage && (
                                <div className="flex gap-2 text-sm">
                                    <FileText className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                                    <div>
                                        <span className="text-gray-500 block text-xs uppercase tracking-wider">{t("dosage")}</span>
                                        <span className="font-medium">{med.dosage}</span>
                                    </div>
                                </div>
                            )}

                            {(med.simpleTiming || med.timing) && (
                                <div className="flex gap-2 text-sm">
                                    <Clock className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                                    <div>
                                        <span className="text-gray-500 block text-xs uppercase tracking-wider">{t("timing")}</span>
                                        <span className="font-medium text-blue-700 dark:text-blue-300">
                                            {med.simpleTiming || med.timing}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {med.instructions && (
                                <div className="flex gap-2 text-sm sm:col-span-2">
                                    <Info className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                                    <div>
                                        <span className="text-gray-500 block text-xs uppercase tracking-wider">{t("instructions")}</span>
                                        <span className="font-medium text-gray-800 dark:text-gray-200">{med.instructions}</span>
                                    </div>
                                </div>
                            )}

                            {med.purpose && (
                                <div className="flex gap-2 text-sm">
                                    <Heart className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                                    <div>
                                        <span className="text-gray-500 block text-xs uppercase tracking-wider">{t("purpose")}</span>
                                        <span>{med.purpose}</span>
                                    </div>
                                </div>
                            )}

                            {med.side_effects && (
                                <div className="flex gap-2 text-sm">
                                    <ShieldAlert className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                                    <div>
                                        <span className="text-gray-500 block text-xs uppercase tracking-wider">{t("sideEffects")}</span>
                                        <span>{med.side_effects}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
