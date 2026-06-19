"use client";

import { VaccineProfile } from "@/lib/vaccineData";
import { Badge } from "@/components/ui/Badge";
import { Info } from "lucide-react";
import { useTranslations } from "next-intl";

interface VaccineDetailsProps {
    vaccine: VaccineProfile;
}

export function VaccineDetails({ vaccine }: VaccineDetailsProps) {
    const t = useTranslations("vaccineHub");
    const categoryColors: Record<string, { bg: string; text: string; border: string }> = {
        Viral: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
        Bacterial: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
        Combination: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
    };

    const colors = categoryColors[vaccine.category] || categoryColors.Viral;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-(--color-text-primary)">
                    {vaccine.disease_name}
                </h2>
                <div className="mt-3 flex flex-wrap gap-2">
                    <span
                        className={`inline-block rounded-full border px-3 py-1 text-xs font-bold ${colors.bg} ${colors.text} ${colors.border}`}
                    >
                        {vaccine.vaccine_name}
                    </span>
                    <span className="inline-block rounded-full border border-emerald-200 bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900 dark:text-emerald-100">
                        {vaccine.category}
                    </span>
                </div>
            </div>

            {/* Target Groups */}
            <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
                <h3 className="flex items-center gap-2 text-sm font-bold tracking-wide text-(--color-text-primary) uppercase dark:text-white">
                    <span className="text-lg" aria-hidden="true">
                        👥
                    </span>
                    {t("targetGroups")}
                </h3>
                <div className="mt-3 flex flex-wrap gap-2">
                    {vaccine.target_groups.map((group) => (
                        <Badge key={group} variant="secondary">
                            {group}
                        </Badge>
                    ))}
                </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20">
                    <p className="text-xs font-bold tracking-wide text-emerald-700 uppercase dark:text-emerald-300">
                        {t("totalDoses")}
                    </p>
                    <p className="mt-1 text-2xl font-bold text-emerald-900 dark:text-emerald-100">
                        {vaccine.total_doses}
                    </p>
                </div>
                <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 dark:border-sky-800 dark:bg-sky-900/20">
                    <p className="text-xs font-bold tracking-wide text-sky-700 uppercase dark:text-sky-300">
                        {t("effectiveness")}
                    </p>
                    <p className="mt-1 text-2xl font-bold text-sky-900 dark:text-sky-100">
                        {vaccine.effectiveness}
                    </p>
                </div>
            </div>

            {/* Disease Summary */}
            <div className="rounded-lg border border-slate-200 bg-(--color-surface-muted) p-4 dark:border-slate-700 dark:bg-slate-800">
                <h3 className="flex items-center gap-2 text-sm font-bold tracking-wide text-(--color-text-primary) uppercase dark:text-white">
                    <Info size={16} aria-hidden="true" />
                    {t("aboutDisease")}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                    {vaccine.disease_summary}
                </p>
            </div>

            {/* Key Information Card */}
            <div className="rounded-lg border border-l-4 border-slate-200 border-l-emerald-500 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
                <p className="text-xs font-bold tracking-wide text-(--color-text-secondary) uppercase dark:text-slate-400">
                    📌 Quick Fact
                </p>
                <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                    {vaccine.is_relative_to_birth
                        ? "Vaccination schedule is based on the child's age from birth"
                        : "Vaccination schedule is based on the first dose administration date"}
                </p>
            </div>
        </div>
    );
}
