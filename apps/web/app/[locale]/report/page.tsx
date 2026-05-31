"use client";

import ReportWizard from "@/components/reports/ReportWizard";
import { PageHeader } from "../components/PageHeader";
import ReportInfoPanel from "./ReportInfoPanel";

export default function ReportPage() {
    return (
        <div className="flex min-h-screen flex-col overflow-x-hidden bg-(--color-surface-muted) font-sans text-(--color-text-primary) selection:bg-emerald-200">
            {/* Header component */}
            <PageHeader
                title="Report Incident"
                subtitle="Public Safety Initiative"
                backHref="/"
                variant="light"
            />

            <main className="relative z-10 container mx-auto flex-1 px-4 pt-8 pb-20 md:px-6">
                {/* Decorative elements */}
                <div className="pointer-events-none absolute top-0 right-0 -mt-20 -mr-20 h-96 w-96 rounded-full bg-emerald-100/40 blur-3xl dark:bg-emerald-950/10"></div>
                <div className="pointer-events-none absolute bottom-0 left-0 -mb-20 -ml-20 h-80 w-80 rounded-full bg-teal-100/40 blur-3xl dark:bg-teal-950/10"></div>

                <div className="relative z-10 grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12">
                    {/* Left Column: Hero & Form */}
                    <div className="space-y-8 lg:col-span-7">
                        {/* Hero Section */}
                        <div className="max-w-2xl space-y-4">
                            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-sm font-bold tracking-wide text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-950/30 dark:text-emerald-400">
                                <span className="relative flex h-2 w-2">
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                                </span>
                                Active Surveillance
                            </div>
                            <h1 className="text-4xl leading-[1.1] font-extrabold tracking-tight text-(--color-text-primary) md:text-5xl">
                                Report a <br />
                                <span className="bg-linear-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent dark:from-emerald-400 dark:to-teal-400">
                                    Suspicious Medicine
                                </span>
                            </h1>
                            <p className="max-w-xl text-lg leading-relaxed font-medium text-(--color-text-secondary)">
                                Your vigilance protects public health. Report suspected counterfeit,
                                expired, or substandard medicines. All reports are investigated by
                                India's Pharmacovigilance authorities.
                            </p>
                        </div>

                        {/* Wizard Component */}
                        <div className="mt-8">
                            <ReportWizard />
                        </div>
                    </div>

                    {/* Right Column: Dashboard & Info */}
                    <ReportInfoPanel />
                </div>
            </main>
        </div>
    );
}
