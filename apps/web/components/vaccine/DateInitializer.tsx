"use client";

import { VaccineProfile } from "@/lib/vaccineData";
import { Calendar } from "lucide-react";
import { useTranslations } from "next-intl";

interface DateInitializerProps {
    vaccine: VaccineProfile;
    value: string;
    onChange: (date: string) => void;
}

export function DateInitializer({ vaccine, value, onChange }: DateInitializerProps) {
    const t = useTranslations("vaccineHub");
    return (
        <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-bold tracking-wider text-emerald-800 uppercase">
                <Calendar size={14} aria-hidden="true" />
                {vaccine.is_relative_to_birth ? t("childBirthDate") : t("milestoneBaseDate")}
            </label>

            <input
                type="date"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 font-medium text-(--color-text-primary) shadow-sm transition-all outline-none hover:bg-(--color-surface-muted) focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
                aria-label={
                    vaccine.is_relative_to_birth
                        ? "Enter child's birth date"
                        : "Enter first dose date"
                }
                max={new Date().toISOString().split("T")[0]}
            />

            {value && (
                <p className="text-xs text-(--color-text-muted)">
                    📅{" "}
                    {new Date(value).toLocaleDateString("en-IN", {
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
