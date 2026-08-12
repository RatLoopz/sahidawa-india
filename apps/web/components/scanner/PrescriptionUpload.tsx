"use client";

import React, { useState, useRef } from "react";
import { Upload, X, Loader2, Camera } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

export interface ScannerResult {
    medicines: {
        name: string;
        dosage: string;
        timing: string;
        instructions: string;
        purpose: string;
        side_effects: string;
        simpleTiming: string;
    }[];
    patientVitals?: {
        bloodPressure: string;
        temperature: string;
    };
}

interface PrescriptionUploadProps {
    onScanSuccess: (data: ScannerResult) => void;
}

export const PrescriptionUpload: React.FC<PrescriptionUploadProps> = ({ onScanSuccess }) => {
    const t = useTranslations("Scanner");
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0];
        if (!selected) return;

        if (!["image/jpeg", "image/png"].includes(selected.type)) {
            setError(t("errors.unsupportedFile"));
            setFile(null);
            setPreview(null);
            return;
        }

        setError(null);
        setFile(selected);
        const reader = new FileReader();
        reader.onloadend = () => {
            setPreview(reader.result as string);
        };
        reader.readAsDataURL(selected);
    };

    const handleClear = () => {
        setFile(null);
        setPreview(null);
        setError(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleSubmit = async () => {
        if (!file) {
            setError(t("errors.emptyUpload"));
            return;
        }

        setIsScanning(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append("image", file);

            const res = await fetch("/api/v1/ai/prescription-scanner", {
                method: "POST",
                body: formData,
            });

            const data = await res.json();

            if (!res.ok) {
                const errorKey = data.error || "apiFailure";
                throw new Error(errorKey);
            }

            onScanSuccess(data as ScannerResult);
        } catch (err: any) {
            console.error("Scan error:", err);
            
            // For known errors like 'blurry', map to the locale key, else fallback to 'apiFailure'
            const errorKeys = ["unsupportedFile", "emptyUpload", "apiFailure", "blurry", "network"];
            const errorKey = errorKeys.includes(err.message) ? err.message : "network";
            
            setError(t(`errors.${errorKey}`));
        } finally {
            setIsScanning(false);
        }
    };

    return (
        <div className="w-full max-w-2xl mx-auto p-6 border rounded-xl shadow-sm bg-white dark:bg-zinc-900">
            <h2 className="text-xl font-semibold mb-2">{t("uploadTitle")}</h2>
            <p className="text-sm text-gray-500 mb-6">{t("uploadDescription")}</p>

            <div className="flex flex-col items-center justify-center space-y-4">
                {!preview && (
                    <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full h-48 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                    >
                        <Upload className="w-10 h-10 text-gray-400 mb-2" />
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                            {t("uploadButton")}
                        </span>
                        <input
                            type="file"
                            accept="image/jpeg, image/png"
                            className="hidden"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            capture="environment"
                        />
                    </div>
                )}

                {preview && (
                    <div className="relative w-full rounded-lg overflow-hidden border bg-black/5">
                        <img 
                            src={preview} 
                            alt="Prescription preview" 
                            className="w-full h-auto object-contain max-h-[500px]"
                        />
                        {!isScanning && (
                            <button
                                onClick={handleClear}
                                className="absolute top-2 right-2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors"
                                aria-label="Remove image"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        )}
                        {isScanning && (
                            <div className="absolute inset-0 bg-white/70 dark:bg-black/70 flex flex-col items-center justify-center backdrop-blur-sm">
                                <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
                                <p className="font-medium text-lg">{t("analyzing")}</p>
                            </div>
                        )}
                    </div>
                )}

                {error && (
                    <div className="w-full p-4 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-sm rounded-lg flex items-center gap-2 border border-red-200 dark:border-red-900">
                        <X className="w-5 h-5 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                {preview && !isScanning && (
                    <button
                        onClick={handleSubmit}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                        <Camera className="w-5 h-5" />
                        {t("analyzing")}
                    </button>
                )}
            </div>
        </div>
    );
};
