"use client";

import { VaccineProfile } from "@/lib/vaccineData";
import { Calendar } from "lucide-react";
import { useTranslations } from "next-intl";

interface DateInitializerProps {
    vaccine: VaccineProfile;
    value: string; // ISO format: yyyy-mm-dd
    onChange: (date: string) => void;
}

/** Parse ISO date string without UTC offset to avoid off-by-one day bugs */
function parseIsoLocal(iso: string): Date | null {
    const parts = iso.split("-");
    if (parts.length !== 3) return null;
    const [y, m, d] = parts.map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d); // Local timezone, no UTC shift
}

function formatLocalDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

export function DateInitializer({ vaccine, value, onChange }: DateInitializerProps) {
    const t = useTranslations("vaccineHub");
    const parsedDate = value ? parseIsoLocal(value) : null;
    const todayIso = formatLocalDate(new Date());
    const inputDescriptionId = "date-initializer-hint";
    const labelText = vaccine.is_relative_to_birth ? t("childBirthDate") : t("milestoneBaseDate");

    return (
        <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-bold tracking-wider text-emerald-800 uppercase">
                <Calendar size={14} aria-hidden="true" />
                {labelText}
            </label>

            <div className="relative">
                <input
                    type="date"
                    value={value}
                    max={todayIso}
                    onChange={(e) => onChange(e.target.value)}
                    aria-label={
                        vaccine.is_relative_to_birth
                            ? "Select child's birth date"
                            : "Select first dose date"
                    }
                    aria-describedby={inputDescriptionId}
                    title={
                        vaccine.is_relative_to_birth
                            ? "Select child's birth date"
                            : "Select first dose date"
                    }
                    className="w-full cursor-pointer rounded-lg border border-slate-200 bg-white px-4 py-3 pr-11 font-medium text-(--color-text-primary) shadow-sm transition-all outline-none hover:bg-(--color-surface-muted) focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
                />

                <Calendar
                    size={18}
                    className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                />
            </div>

            <p id={inputDescriptionId} className="text-xs text-(--color-text-muted)">
                Use the native date picker. If your browser shows a plain field, enter the date as
                yyyy-mm-dd.
            </p>

            {parsedDate && (
                <p className="text-xs text-(--color-text-muted)">
                    Date selected:{" "}
                    {parsedDate.toLocaleDateString("en-IN", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                    })}
                </p>
            )}
        </div>
    );
}
