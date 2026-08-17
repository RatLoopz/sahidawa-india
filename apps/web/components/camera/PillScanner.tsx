"use client";

import React, { useRef, useState } from "react";
import { Upload, X, Loader2, Camera } from "lucide-react";
import { useTranslations } from "next-intl";

export interface PillResult {
    medicineName: string;
    genericName: string;
    confidence: "High" | "Medium" | "Low";
    observedFeatures: string;
    possibleUses: string;
    safetyNote: string;
}

interface PillScannerProps {
    onScanSuccess: (data: PillResult) => void;
}

export const PillScanner: React.FC<PillScannerProps> = ({ onScanSuccess }) => {
    const t = useTranslations("PillIdentifier");
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0];
        if (!selected) return;

        if (!["image/jpeg", "image/png", "image/webp"].includes(selected.type)) {
            setError(t("errors.unsupportedFile"));
            setFile(null);
            setPreview(null);
            return;
        }

        setError(null);
        setFile(selected);
        const reader = new FileReader();
        reader.onloadend = () => setPreview(reader.result as string);
        reader.readAsDataURL(selected);
    };

    const handleClear = () => {
        setFile(null);
        setPreview(null);
        setError(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
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

            const res = await fetch("/api/v1/ai/pill-identifier", {
                method: "POST",
                body: formData,
            });
            const data = await res.json();

            if (!res.ok) {
                const errorKeys = [
                    "emptyUpload",
                    "unsupportedFile",
                    "fileTooLarge",
                    "apiFailure",
                    "unreadable",
                    "network",
                ];
                const errorKey = errorKeys.includes(data.error) ? data.error : "network";
                throw new Error(errorKey);
            }
            onScanSuccess(data as PillResult);
        } catch (err) {
            const message = err instanceof Error ? err.message : "network";
            setError(t(`errors.${message}` as never));
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
                        <Camera className="mb-2 h-10 w-10 text-gray-400" />
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                            {t("uploadButton")}
                        </span>
                        <input
                            type="file"
                            accept="image/jpeg, image/png, image/webp"
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
                            alt="Pill preview"
                            className="max-h-64 w-full object-contain"
                        />
                        <button
                            onClick={handleClear}
                            className="absolute top-2 right-2 rounded-full bg-black/50 p-1 text-white hover:bg-black/70"
                            aria-label="Remove"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                )}

                {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

                {file && (
                    <button
                        onClick={handleSubmit}
                        disabled={isScanning}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 px-6 py-2.5 font-medium text-white transition-colors hover:bg-teal-700 disabled:opacity-70"
                    >
                        {isScanning ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            <Upload className="h-5 w-5" />
                        )}
                        {isScanning ? t("analyzing") : t("identifyButton")}
                    </button>
                )}
            </div>
        </div>
    );
};
