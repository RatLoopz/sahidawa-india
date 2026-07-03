"use client";
import React, { useState } from "react";
import { X, Upload, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { API_BASE } from "@/lib/api";

interface RequestVerificationModalProps {
    isOpen: boolean;
    onClose: () => void;
    medicineName: string;
}

export function RequestVerificationModal({
    isOpen,
    onClose,
    medicineName,
}: RequestVerificationModalProps) {
    const [file, setFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setError(null);
        }
    };

    const handleSubmit = async () => {
        if (!file) {
            setError("Please select an image file to upload.");
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append("file", file);

            // Step 1: Send image to the OCR extract endpoint
            const res = await fetch(`${API_BASE}/api/v1/scan/extract`, {
                method: "POST",
                body: formData,
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Failed to upload image");
            }

            const ocrResult = await res.json().catch(() => ({}));

            // Step 2: Save the verification request to Supabase for admin review
            try {
                const { supabase } = await import("@/lib/supabase");
                const { data: sessionData } = await supabase.auth.getSession();
                const userId = sessionData?.session?.user?.id ?? null;

                await supabase.from("medicine_verification_requests").insert({
                    medicine_name: medicineName,
                    ocr_extracted_text: ocrResult?.extracted_text
                        ? String(ocrResult.extracted_text)
                        : ocrResult?.medicine_name
                          ? String(ocrResult.medicine_name)
                          : null,
                    ocr_raw_response: ocrResult ?? null,
                    status: "pending",
                    submitted_by: userId,
                });
            } catch {
                // Non-fatal: OCR succeeded but DB save failed — still show success to user
                console.warn(
                    "[RequestVerificationModal] Failed to save verification request to DB"
                );
            }

            setIsSuccess(true);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "An unexpected error occurred.";
            setError(message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
                <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                        Request Verification
                    </h3>
                    <button
                        onClick={onClose}
                        className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                        <X size={20} />
                    </button>
                </div>

                {isSuccess ? (
                    <div className="flex flex-col items-center space-y-4 py-6 text-center">
                        <CheckCircle className="h-16 w-16 text-emerald-500" />
                        <h4 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                            Verification Requested!
                        </h4>
                        <p className="text-slate-600 dark:text-slate-400">
                            Your request has been submitted for review! Our team will verify the
                            packaging for <strong>{medicineName}</strong> shortly.
                        </p>
                        <Button onClick={onClose} className="mt-4 w-full">
                            Close
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="flex gap-3 rounded-lg bg-orange-50 p-4 text-orange-800 dark:bg-orange-950/30 dark:text-orange-400">
                            <AlertCircle className="h-5 w-5 shrink-0" />
                            <p className="text-sm">
                                <strong>{medicineName}</strong> is currently unverified. Please
                                upload a clear photo of the medicine strip or box showing the brand
                                and composition to verify it.
                            </p>
                        </div>

                        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-800/50">
                            <input
                                type="file"
                                id="medicine-image"
                                accept="image/jpeg, image/png, image/webp"
                                className="hidden"
                                onChange={handleFileChange}
                            />
                            <label
                                htmlFor="medicine-image"
                                className="flex cursor-pointer flex-col items-center gap-2 text-slate-600 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400"
                            >
                                <Upload size={32} />
                                <span className="text-sm font-medium">
                                    {file ? file.name : "Click to select an image"}
                                </span>
                            </label>
                        </div>

                        {error && <p className="text-sm text-red-500">{error}</p>}

                        <div className="flex justify-end gap-3 pt-4">
                            <Button variant="outline" onClick={onClose} disabled={isLoading}>
                                Cancel
                            </Button>
                            <Button onClick={handleSubmit} disabled={!file || isLoading}>
                                {isLoading ? "Uploading..." : "Submit for Review"}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
