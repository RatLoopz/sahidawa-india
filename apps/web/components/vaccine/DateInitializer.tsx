"use client";

import { VaccineProfile } from "@/lib/vaccineData";
import { Calendar } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";

interface DateInitializerProps {
    vaccine: VaccineProfile;
    value: string; // ISO format: yyyy-mm-dd
    onChange: (date: string) => void;
}

/** Convert ISO yyyy-mm-dd → dd/mm/yyyy for display */
function isoToDmy(iso: string): string {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    if (!y || !m || !d) return "";
    return `${d}/${m}/${y}`;
}

/** Convert dd/mm/yyyy → ISO yyyy-mm-dd for storage */
function dmyToIso(dmy: string): string {
    const parts = dmy.split("/");
    if (parts.length !== 3) return "";
    const [d, m, y] = parts;
    if (!d || !m || !y || y.length !== 4) return "";
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

/** Parse ISO date string without UTC offset to avoid off-by-one day bugs */
function parseIsoLocal(iso: string): Date | null {
    const parts = iso.split("-");
    if (parts.length !== 3) return null;
    const [y, m, d] = parts.map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d); // Local timezone — no UTC shift
}

export function DateInitializer({ vaccine, value, onChange }: DateInitializerProps) {
    const t = useTranslations("vaccineHub");

    // Display state in dd/mm/yyyy; synced from ISO `value` prop
    const [displayValue, setDisplayValue] = useState(isoToDmy(value));

    useEffect(() => {
        setDisplayValue(isoToDmy(value));
    }, [value]);

    const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let raw = e.target.value;

        // Auto-insert slashes as user types (e.g. "12" → "12/")
        const digits = raw.replace(/\D/g, "");
        if (digits.length <= 2) {
            raw = digits;
        } else if (digits.length <= 4) {
            raw = `${digits.slice(0, 2)}/${digits.slice(2)}`;
        } else {
            raw = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
        }

        setDisplayValue(raw);

        // Only propagate when a full dd/mm/yyyy is entered
        if (raw.length === 10) {
            const iso = dmyToIso(raw);
            if (iso) onChange(iso);
        } else if (raw === "") {
            onChange("");
        }
    };

    const parsedDate = value ? parseIsoLocal(value) : null;

    const todayIso = new Date().toISOString().split("T")[0];

    return (
        <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-bold tracking-wider text-emerald-800 uppercase">
                <Calendar size={14} aria-hidden="true" />
                {vaccine.is_relative_to_birth ? t("childBirthDate") : t("milestoneBaseDate")}
            </label>

            <div className="relative">
                {/* Visible dd/mm/yyyy text input */}
                <input
                    type="text"
                    inputMode="numeric"
                    placeholder="dd/mm/yyyy"
                    value={displayValue}
                    onChange={handleTextChange}
                    maxLength={10}
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 font-medium text-(--color-text-primary) shadow-sm transition-all outline-none hover:bg-(--color-surface-muted) focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
                    aria-label={
                        vaccine.is_relative_to_birth
                            ? "Enter child's birth date (dd/mm/yyyy)"
                            : "Enter first dose date (dd/mm/yyyy)"
                    }
                />

                {/* Hidden native date picker — triggered by the calendar icon */}
                <input
                    type="date"
                    value={value}
                    max={todayIso}
                    onChange={(e) => onChange(e.target.value)}
                    className="absolute inset-0 w-full cursor-pointer opacity-0"
                    tabIndex={-1}
                    aria-hidden="true"
                />

                <Calendar
                    size={18}
                    className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                />
            </div>

            {parsedDate && (
                <p className="text-xs text-(--color-text-muted)">
                    📅{" "}
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
