import React, { useState } from "react";
import {
    Check,
    Copy,
    Trash2,
    BookOpen,
    ShieldAlert,
    AlertTriangle,
    Clock,
    TrendingDown,
    Loader2,
} from "lucide-react";
import { CdscoStatusBadge } from "../results/CdscoStatusBadge";
import type { DashboardMedicine } from "./types"; // I will create types.ts next

interface MedicineExplanationCardProps {
    med: DashboardMedicine;
    onDelete: () => void;
    onCopy: () => void;
    copied: boolean;
    onRetry: () => void;
}

export function MedicineExplanationCard({
    med,
    onDelete,
    onCopy,
    copied,
    onRetry,
}: MedicineExplanationCardProps) {
    const [activeTab, setActiveTab] = useState<"purpose" | "safety" | "sideEffects" | "usage">(
        "purpose"
    );

    const renderTabContent = () => {
        if (med.explanationLoading) {
            return (
                <div className="flex flex-col items-center justify-center space-y-2 py-8">
                    <Loader2 className="animate-spin text-emerald-500" size={24} />
                    <span className="text-xs font-semibold text-(--color-text-muted)">
                        Generating AI clinical guide...
                    </span>
                </div>
            );
        }

        if (med.explanationError) {
            return (
                <div className="border-red-250 rounded-2xl border bg-red-50/30 p-4 text-center dark:border-red-900/30 dark:bg-red-950/10">
                    <p className="text-xs font-semibold text-red-800 dark:text-red-400">
                        {med.explanationError}
                    </p>
                    <button
                        onClick={onRetry}
                        className="mt-2 text-xs font-bold text-emerald-500 underline hover:text-emerald-600"
                    >
                        Retry explanation
                    </button>
                </div>
            );
        }

        if (!med.explanation) {
            return (
                <p className="py-6 text-center text-xs text-(--color-text-muted) italic">
                    Explanation currently unavailable.
                </p>
            );
        }

        switch (activeTab) {
            case "purpose":
                return (
                    <div className="animate-in fade-in space-y-1.5 duration-200">
                        <h5 className="flex items-center gap-1 text-xs font-bold tracking-wider text-emerald-500 uppercase">
                            <BookOpen size={12} /> What it is for
                        </h5>
                        <p className="text-xs leading-relaxed font-semibold text-(--color-text-primary)">
                            {med.explanation.purpose}
                        </p>
                    </div>
                );
            case "safety":
                return (
                    <div className="animate-in fade-in space-y-1.5 duration-200">
                        <h5 className="flex items-center gap-1 text-xs font-bold tracking-wider text-amber-500 uppercase">
                            <ShieldAlert size={12} /> Warnings & Precautions
                        </h5>
                        <p className="text-xs leading-relaxed font-semibold text-(--color-text-primary)">
                            {med.explanation.precautions}
                        </p>
                    </div>
                );
            case "sideEffects":
                return (
                    <div className="animate-in fade-in space-y-1.5 duration-200">
                        <h5 className="flex items-center gap-1 text-xs font-bold tracking-wider text-red-500 uppercase">
                            <AlertTriangle size={12} /> Potential Side Effects
                        </h5>
                        <p className="text-xs leading-relaxed font-semibold text-(--color-text-primary)">
                            {med.explanation.sideEffects}
                        </p>
                    </div>
                );
            case "usage":
                return (
                    <div className="animate-in fade-in space-y-1.5 duration-200">
                        <h5 className="flex items-center gap-1 text-xs font-bold tracking-wider text-blue-500 uppercase">
                            <Clock size={12} /> Usage & Dosage Guidance
                        </h5>
                        <p className="text-xs leading-relaxed font-semibold text-(--color-text-primary)">
                            {med.explanation.usageGuidance}
                        </p>
                    </div>
                );
        }
    };

    const hasSavings = med.mrp && med.jan_aushadhi_price && med.mrp > med.jan_aushadhi_price;
    const savingsPercent = hasSavings
        ? Math.round(((med.mrp! - med.jan_aushadhi_price!) / med.mrp!) * 100)
        : 0;

    return (
        <div className="relative flex flex-col justify-between rounded-[2.2rem] border border-(--color-border-muted) bg-(--color-surface-page) p-6 shadow-md transition-all duration-300 hover:scale-[1.01] hover:shadow-xl">
            <div className="absolute top-0 right-0 left-0 h-1.5 rounded-t-full bg-emerald-500"></div>

            <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <h3 className="text-lg font-black tracking-tight text-(--color-text-primary)">
                            {med.brand_name}
                        </h3>
                        <p className="mt-0.5 text-xs font-bold text-(--color-text-secondary)">
                            {med.generic_name}
                        </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                        <button
                            onClick={onCopy}
                            title="Copy clinical details"
                            className={`rounded-lg p-1.5 transition-all ${
                                copied
                                    ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                                    : "bg-(--color-surface-muted) text-(--color-text-muted) hover:bg-(--color-border-muted) hover:text-(--color-text-primary)"
                            }`}
                        >
                            {copied ? <Check size={14} strokeWidth={2.5} /> : <Copy size={14} />}
                        </button>

                        <button
                            onClick={onDelete}
                            title="Delete medicine card"
                            className="rounded-lg bg-red-50 p-1.5 text-red-600 transition-all hover:bg-red-100 focus:outline-none dark:bg-red-950/20 dark:text-red-400 dark:hover:bg-red-950/40"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <CdscoStatusBadge status={med.cdsco_approval_status} />
                    <span className="rounded border border-(--color-border-muted) bg-(--color-surface-muted) px-2 py-0.5 text-[10px] font-bold text-(--color-text-muted)">
                        {med.manufacturer}
                    </span>
                </div>

                {med.composition && (
                    <div className="rounded-xl border border-(--color-border-muted) bg-(--color-surface-muted) px-3 py-2 text-[11px] font-medium text-(--color-text-secondary)">
                        <span className="font-bold text-(--color-text-primary)">Composition: </span>
                        {med.composition}
                    </div>
                )}

                {hasSavings && (
                    <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2">
                        <TrendingDown size={14} className="shrink-0 text-emerald-500" />
                        <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                            Generic Alternative (Jan Aushadhi) saves {savingsPercent}% cost! (₹
                            {med.jan_aushadhi_price} vs MRP ₹{med.mrp})
                        </span>
                    </div>
                )}

                <div className="flex border-b border-(--color-border-muted) pt-2">
                    {(["purpose", "safety", "sideEffects", "usage"] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`flex-1 border-b-2 pb-1.5 text-center text-[10px] font-extrabold tracking-wider uppercase transition-colors outline-none ${
                                activeTab === tab
                                    ? "border-emerald-500 text-emerald-500"
                                    : "border-transparent text-(--color-text-muted) hover:text-(--color-text-secondary)"
                            }`}
                        >
                            {tab === "purpose"
                                ? "Use"
                                : tab === "safety"
                                  ? "Safety"
                                  : tab === "sideEffects"
                                    ? "Effects"
                                    : "Dose"}
                        </button>
                    ))}
                </div>

                <div className="min-h-24 pt-2">{renderTabContent()}</div>
            </div>
        </div>
    );
}
