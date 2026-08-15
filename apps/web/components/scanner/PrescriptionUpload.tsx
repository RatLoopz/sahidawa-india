"use client";

import React, { useState, useRef } from "react";
import { Upload, X, Loader2, Camera } from "lucide-react";
import { useTranslations } from "next-intl";

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
        <div className="mx-auto w-full max-w-2xl rounded-xl border bg-white p-6 shadow-sm dark:bg-zinc-900">
            <h2 className="mb-2 text-xl font-semibold">{t("uploadTitle")}</h2>
            <p className="mb-6 text-sm text-gray-500">{t("uploadDescription")}</p>

            <div className="flex flex-col items-center justify-center space-y-4">
                {!preview && (
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        className="flex h-48 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 transition-colors hover:bg-gray-50 dark:hover:bg-zinc-800"
                    >
                        <Upload className="mb-2 h-10 w-10 text-gray-400" />
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
                    <div className="relative w-full overflow-hidden rounded-lg border bg-black/5">
                        <img
                            src={preview}
                            alt="Prescription preview"
                            className="h-auto max-h-[500px] w-full object-contain"
                        />
                        {!isScanning && (
                            <button
                                onClick={handleClear}
                                className="absolute top-2 right-2 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70"
                                aria-label="Remove image"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        )}
                        {isScanning && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70 backdrop-blur-sm dark:bg-black/70">
                                <Loader2 className="mb-4 h-10 w-10 animate-spin text-blue-600" />
                                <p className="text-lg font-medium">{t("analyzing")}</p>
                            </div>
                        )}
                    </div>
                )}

                {error && (
                    <div className="flex w-full items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
                        <X className="h-5 w-5 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                {preview && !isScanning && (
                    <button
                        onClick={handleSubmit}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 font-medium text-white transition-colors hover:bg-blue-700"
                    >
                        <Camera className="h-5 w-5" />
                        {t("analyzing")}
                    </button>
                )}
            </div>
        </div>
    );
};
