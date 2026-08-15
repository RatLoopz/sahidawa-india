"use client";

import React, { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
    FileText,
    ArrowLeft,
    Upload,
    X,
    Loader2,
    AlertTriangle,
    CheckCircle2,
    ArrowDownCircle,
    ArrowUpCircle,
} from "lucide-react";
import { Link } from "@/i18n/routing";

interface LabTest {
    testName: string;
    userValue: string;
    referenceRange: string;
    status: "Low" | "Normal" | "High";
    simpleExplanation: string;
}

interface LabResult {
    tests: LabTest[];
    summary: string;
}

const ACCEPTED = "image/jpeg, image/png, image/webp, application/pdf";

export default function LabAnalyzerPage() {
    const t = useTranslations("LabAnalyzer");
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [result, setResult] = useState<LabResult | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0];
        if (!selected) return;
        setError(null);
        setFile(selected);
        setResult(null);
        if (selected.type.startsWith("image/")) {
            const reader = new FileReader();
            reader.onloadend = () => setPreview(reader.result as string);
            reader.readAsDataURL(selected);
        } else {
            setPreview(null);
        }
    };

    const handleClear = () => {
        setFile(null);
        setPreview(null);
        setError(null);
        setResult(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleAnalyze = async () => {
        if (!file) {
            setError(t("errors.emptyUpload"));
            return;
        }
        setIsAnalyzing(true);
        setError(null);
        try {
            const formData = new FormData();
            formData.append("file", file);

            const res = await fetch("/api/v1/ai/lab-analyzer", {
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
            setResult(data as LabResult);
        } catch (err) {
            const message = err instanceof Error ? err.message : "network";
            setError(t(`errors.${message}` as never));
        } finally {
            setIsAnalyzing(false);
        }
    };

    const statusStyles = (status: LabTest["status"]) => {
        switch (status) {
            case "High":
                return {
                    icon: ArrowUpCircle,
                    color: "text-red-600 dark:text-red-400",
                    bg: "bg-red-50 dark:bg-red-900/20",
                    border: "border-red-200 dark:border-red-900",
                };
            case "Low":
                return {
                    icon: ArrowDownCircle,
                    color: "text-orange-600 dark:text-orange-400",
                    bg: "bg-orange-50 dark:bg-orange-900/20",
                    border: "border-orange-200 dark:border-orange-900",
                };
            default:
                return {
                    icon: CheckCircle2,
                    color: "text-green-600 dark:text-green-400",
                    bg: "bg-green-50 dark:bg-green-900/20",
                    border: "border-green-200 dark:border-green-900",
                };
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6 lg:px-8 dark:bg-zinc-950">
            <div className="mx-auto max-w-4xl space-y-8">
                <div className="flex items-start gap-4">
                    <Link
                        href="/"
                        className="mt-1 -ml-2 rounded-full p-2 transition-colors hover:bg-gray-200 dark:hover:bg-zinc-800"
                        aria-label="Go back"
                    >
                        <ArrowLeft className="h-6 w-6 text-gray-600 dark:text-gray-300" />
                    </Link>
                    <div>
                        <h1 className="flex items-center gap-3 text-3xl font-bold text-gray-900 dark:text-white">
                            <span className="rounded-lg bg-purple-100 p-2 text-purple-600 dark:bg-purple-900/50 dark:text-purple-400">
                                <FileText className="h-6 w-6" />
                            </span>
                            {t("title")}
                        </h1>
                        <p className="mt-2 max-w-2xl text-gray-600 dark:text-gray-400">
                            {t("description")}
                        </p>
                    </div>
                </div>

                {/* Disclaimer */}
                <div className="flex gap-3 rounded-xl border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900 dark:bg-yellow-900/20">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-yellow-600 dark:text-yellow-400" />
                    <p className="text-sm text-yellow-800 dark:text-yellow-300">
                        {t("disclaimer")}
                    </p>
                </div>

                {!result && (
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
                                        accept={ACCEPTED}
                                        className="hidden"
                                        ref={fileInputRef}
                                        onChange={handleFileChange}
                                    />
                                </div>
                            )}

                            {preview && (
                                <div className="relative w-full overflow-hidden rounded-lg border bg-black/5">
                                    <img
                                        src={preview}
                                        alt="Preview"
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

                            {file && !preview && (
                                <div className="flex w-full items-center justify-between rounded-lg border p-3">
                                    <span className="truncate text-sm">{file.name}</span>
                                    <button
                                        onClick={handleClear}
                                        className="rounded-full p-1 hover:bg-gray-100 dark:hover:bg-zinc-800"
                                        aria-label="Remove"
                                    >
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>
                            )}

                            {error && (
                                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                            )}

                            {file && (
                                <button
                                    onClick={handleAnalyze}
                                    disabled={isAnalyzing}
                                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 px-6 py-2.5 font-medium text-white transition-colors hover:bg-purple-700 disabled:opacity-70"
                                >
                                    {isAnalyzing ? (
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : (
                                        <FileText className="h-5 w-5" />
                                    )}
                                    {isAnalyzing ? t("analyzing") : t("analyzeButton")}
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {result && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 space-y-6 duration-500">
                        <button
                            onClick={handleClear}
                            className="mx-auto flex items-center gap-1 rounded-full bg-purple-50 px-4 py-2 text-sm font-medium text-purple-600 transition-colors hover:text-purple-800 dark:bg-purple-900/20 dark:text-purple-400 dark:hover:text-purple-300"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            {t("analyzeAnother")}
                        </button>

                        {result.summary && (
                            <div className="rounded-xl border border-purple-100 bg-purple-50 p-4 dark:border-purple-900 dark:bg-purple-900/20">
                                <h3 className="mb-1 font-medium text-purple-800 dark:text-purple-300">
                                    {t("summary")}
                                </h3>
                                <p className="text-sm text-gray-700 dark:text-gray-300">
                                    {result.summary}
                                </p>
                            </div>
                        )}

                        <div className="space-y-3">
                            {result.tests.map((test, idx) => {
                                const { icon: Icon, color, bg, border } = statusStyles(test.status);
                                return (
                                    <div
                                        key={idx}
                                        className={`rounded-xl border p-4 ${bg} ${border}`}
                                    >
                                        <div className="mb-2 flex items-center justify-between">
                                            <h3 className="font-bold text-gray-900 dark:text-white">
                                                {test.testName}
                                            </h3>
                                            <span
                                                className={`flex items-center gap-1 text-sm font-medium ${color}`}
                                            >
                                                <Icon className="h-4 w-4" />
                                                {test.status}
                                            </span>
                                        </div>
                                        <div className="mb-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                                            <div>
                                                <span className="block text-xs tracking-wider text-gray-500 uppercase">
                                                    {t("yourValue")}
                                                </span>
                                                <span className="font-medium">
                                                    {test.userValue}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="block text-xs tracking-wider text-gray-500 uppercase">
                                                    {t("referenceRange")}
                                                </span>
                                                <span className="font-medium">
                                                    {test.referenceRange}
                                                </span>
                                            </div>
                                        </div>
                                        <p className="text-sm text-gray-700 dark:text-gray-300">
                                            {test.simpleExplanation}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
