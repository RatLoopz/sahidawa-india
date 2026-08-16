"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { Pill, ArrowLeft, AlertTriangle, ShieldAlert, ArrowRight } from "lucide-react";
import { Link } from "@/i18n/routing";
import { PillScanner, type PillResult } from "@/components/camera/PillScanner";

const confidenceStyles = (confidence: PillResult["confidence"]) => {
    switch (confidence) {
        case "High":
            return "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300";
        case "Medium":
            return "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300";
        default:
            return "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300";
    }
};

export default function PillIdentifierPage() {
    const t = useTranslations("PillIdentifier");
    const [result, setResult] = useState<PillResult | null>(null);

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
                            <span className="rounded-lg bg-teal-100 p-2 text-teal-600 dark:bg-teal-900/50 dark:text-teal-400">
                                <Pill className="h-6 w-6" />
                            </span>
                            {t("title")}
                        </h1>
                        <p className="mt-2 max-w-2xl text-gray-600 dark:text-gray-400">
                            {t("description")}
                        </p>
                    </div>
                </div>

                {/* Safety disclaimer */}
                <div className="flex gap-3 rounded-xl border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900 dark:bg-yellow-900/20">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-yellow-600 dark:text-yellow-400" />
                    <p className="text-sm text-yellow-800 dark:text-yellow-300">
                        {t("disclaimer")}
                    </p>
                </div>

                {!result ? (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <PillScanner onScanSuccess={setResult} />
                    </div>
                ) : (
                    <div className="animate-in fade-in slide-in-from-bottom-4 space-y-6 duration-500">
                        <button
                            onClick={() => setResult(null)}
                            className="mx-auto flex items-center gap-1 rounded-full bg-teal-50 px-4 py-2 text-sm font-medium text-teal-600 transition-colors hover:text-teal-800 dark:bg-teal-900/20 dark:text-teal-400 dark:hover:text-teal-300"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            {t("scanAnother")}
                        </button>

                        <div className="rounded-xl border bg-white p-5 shadow-sm dark:bg-zinc-900">
                            <div className="mb-4 flex items-center justify-between">
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                    {result.medicineName || t("unknown")}
                                </h2>
                                <span
                                    className={`rounded-full px-3 py-1 text-sm font-medium ${confidenceStyles(result.confidence)}`}
                                >
                                    {t("confidence")}: {result.confidence}
                                </span>
                            </div>

                            {result.genericName && (
                                <div className="mb-3">
                                    <span className="block text-xs tracking-wider text-gray-500 uppercase">
                                        {t("genericName")}
                                    </span>
                                    <span className="font-medium">{result.genericName}</span>
                                </div>
                            )}

                            {result.observedFeatures && (
                                <div className="mb-3">
                                    <span className="block text-xs tracking-wider text-gray-500 uppercase">
                                        {t("observedFeatures")}
                                    </span>
                                    <span className="text-sm">{result.observedFeatures}</span>
                                </div>
                            )}

                            {result.possibleUses && (
                                <div className="mb-3">
                                    <span className="block text-xs tracking-wider text-gray-500 uppercase">
                                        {t("possibleUses")}
                                    </span>
                                    <span className="text-sm">{result.possibleUses}</span>
                                </div>
                            )}
                        </div>

                        {/* Safety note */}
                        <div className="flex gap-3 rounded-xl border border-orange-200 bg-orange-50 p-4 dark:border-orange-900 dark:bg-orange-900/20">
                            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-orange-600 dark:text-orange-400" />
                            <p className="text-sm text-orange-800 dark:text-orange-300">
                                {result.safetyNote || t("defaultSafetyNote")}
                            </p>
                        </div>

                        {/* Push to interaction checker */}
                        {result.medicineName && (
                            <Link
                                href="/interaction-checker"
                                className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 px-6 py-2.5 font-medium text-white transition-colors hover:bg-teal-700"
                            >
                                {t("checkInteractions")}
                                <ArrowRight className="h-5 w-5" />
                            </Link>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
