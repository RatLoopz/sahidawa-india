"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { PrescriptionUpload, ScannerResult } from "@/components/scanner/PrescriptionUpload";
import { DecodedResults } from "@/components/scanner/DecodedResults";
import { FileText, ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/routing";

export default function PrescriptionScannerPage() {
    const t = useTranslations("Scanner");
    const [result, setResult] = useState<ScannerResult | null>(null);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto space-y-8">
                
                {/* Header */}
                <div className="flex items-start gap-4">
                    <Link 
                        href="/" 
                        className="p-2 mt-1 -ml-2 rounded-full hover:bg-gray-200 dark:hover:bg-zinc-800 transition-colors"
                        aria-label="Go back"
                    >
                        <ArrowLeft className="w-6 h-6 text-gray-600 dark:text-gray-300" />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                            <span className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg text-blue-600 dark:text-blue-400">
                                <FileText className="w-6 h-6" />
                            </span>
                            {t("title")}
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-2 max-w-2xl">
                            {t("description")}
                        </p>
                    </div>
                </div>

                {/* Content Area */}
                <div className="w-full">
                    {!result ? (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <PrescriptionUpload onScanSuccess={setResult} />
                        </div>
                    ) : (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <button
                                onClick={() => setResult(null)}
                                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium flex items-center gap-1 mx-auto bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-full transition-colors"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Scan another prescription
                            </button>
                            <DecodedResults data={result} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
