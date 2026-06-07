"use client";

import { VaccineProfile } from "@/lib/vaccineData";
import { CheckCircle, AlertCircle, Calendar } from "lucide-react";
import { useTranslations, useFormatter } from "next-intl";

interface DoseScheduleProps {
    vaccine: VaccineProfile;
    initialDate: string;
}

export function DoseSchedule({ vaccine, initialDate }: DoseScheduleProps) {
    const t = useTranslations("vaccineHub");
    const format = useFormatter();
    const calculateMilestoneDate = (weeksOffset: number): Date | null => {
        if (!initialDate) return null;

        const reference = new Date(initialDate);
        if (isNaN(reference.getTime())) return null;

        const targetDate = new Date(reference.getTime());
        targetDate.setDate(targetDate.getDate() + weeksOffset * 7);

        return targetDate;
    };

    const getDoseLabel = (weeks: number, index: number): string => {
        if (vaccine.is_relative_to_birth) {
            return weeks === 0 ? t("atBirth") : t("atWeeks", { weeks });
        } else {
            return index === 0 ? t("baseline") : t("doseStep", { index: index + 1, weeks });
        }
    };

    const getDoseStatus = (doseDate: Date | null): "scheduled" | "pending" | "today" => {
        if (!doseDate) return "pending";

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const targetDate = new Date(doseDate.getTime());
        targetDate.setHours(0, 0, 0, 0);

        if (targetDate.getTime() === today.getTime()) return "today";
        if (targetDate.getTime() < today.getTime()) return "scheduled";
        return "pending";
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <Calendar size={20} className="text-emerald-600" aria-hidden="true" />
                <h3 className="text-lg font-bold text-(--color-text-primary)">
                    {t("scheduleLayoutHeading")}
                </h3>
            </div>

            {!initialDate && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-900/20">
                    <p className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-200">
                        <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                        <span>{t("selectDateWarning")}</span>
                    </p>
                </div>
            )}

            <div className="space-y-3">
                {(vaccine.dosing_intervals_weeks || []).map((weeks, index) => {
                    const milestoneDate = calculateMilestoneDate(weeks);
                    const status = getDoseStatus(milestoneDate);
                    const label = getDoseLabel(weeks, index);

                    return (
                        <div
                            key={index}
                            className={`flex gap-4 rounded-lg border p-4 transition-all ${
                                status === "today"
                                    ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20"
                                    : status === "scheduled"
                                      ? "border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-900/20"
                                      : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"
                            }`}
                            role="article"
                            aria-label={`Dose ${index + 1}: ${label}`}
                        >
                            {/* Dose Badge */}
                            <div className="flex shrink-0 items-center justify-center">
                                <div
                                    className={`flex h-10 w-10 items-center justify-center rounded-full font-bold transition-all ${
                                        status === "today"
                                            ? "border-2 border-emerald-500 bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-100"
                                            : status === "scheduled"
                                              ? "border-2 border-sky-400 bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-100"
                                              : "border-2 border-slate-300 bg-slate-100 text-(--color-text-secondary) dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300"
                                    }`}
                                >
                                    {index + 1}
                                </div>
                            </div>

                            {/* Dose Details */}
                            <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                        <p className="font-semibold text-(--color-text-primary)">
                                            {label}
                                        </p>

                                        {milestoneDate ? (
                                            <p className="mt-1 flex items-center gap-2 text-sm font-medium">
                                                <span
                                                    className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold ${
                                                        status === "today"
                                                            ? "bg-emerald-200 text-emerald-800 dark:bg-emerald-800 dark:text-emerald-100"
                                                            : status === "scheduled"
                                                              ? "bg-sky-200 text-sky-800 dark:bg-sky-800 dark:text-sky-100"
                                                              : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                                                    }`}
                                                >
                                                    {status === "today" && (
                                                        <CheckCircle size={14} aria-hidden="true" />
                                                    )}
                                                    {status === "today"
                                                        ? "TODAY"
                                                        : status === "scheduled"
                                                          ? "SCHEDULED"
                                                          : "UPCOMING"}
                                                </span>
                                                <span
                                                    className={`${
                                                        status === "today"
                                                            ? "text-emerald-700 dark:text-emerald-200"
                                                            : status === "scheduled"
                                                              ? "text-sky-700 dark:text-sky-200"
                                                              : "text-slate-700 dark:text-slate-300"
                                                    }`}
                                                >
                                                    {format.dateTime(milestoneDate, {
                                                        day: "numeric",
                                                        month: "short",
                                                        year: "numeric",
                                                    })}
                                                </span>
                                            </p>
                                        ) : (
                                            <p className="mt-1 text-sm text-(--color-text-muted) italic dark:text-slate-400">
                                                {t("selectDateWarning")}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Timeline Summary */}
            <div className="mt-6 rounded-lg border border-slate-200 bg-(--color-surface-muted) p-4 dark:border-slate-700 dark:bg-slate-900">
                <h4 className="text-sm font-semibold text-(--color-text-primary)">Summary</h4>
                <dl className="mt-3 space-y-2 text-sm text-(--color-text-secondary)">
                    <div className="flex justify-between">
                        <dt className="font-medium">{t("totalDoses")}:</dt>
                        <dd className="font-semibold text-(--color-text-primary)">
                            {vaccine.total_doses}
                        </dd>
                    </div>
                    <div className="flex justify-between">
                        <dt className="font-medium">{t("effectiveness")}:</dt>
                        <dd className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {vaccine.effectiveness}
                        </dd>
                    </div>
                    <div className="flex justify-between">
                        <dt className="font-medium">{t("classification")}:</dt>
                        <dd className="font-semibold text-(--color-text-primary)">
                            {vaccine.category}
                        </dd>
                    </div>
                </dl>
            </div>
        </div>
    );
}
