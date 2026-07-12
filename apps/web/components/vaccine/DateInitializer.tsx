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

/**
 * Checks whether day/month/year form a real calendar date
 * (rejects things like 31/02/2026, 00/12/2026, month 13, etc.)
 */
function isValidCalendarDate(day: number, month: number, year: number): boolean {
    if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) {
        return false;
    }
    if (year < 1000 || year > 9999) return false;
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;

    // Date's constructor rolls over out-of-range values (e.g. Feb 31 → Mar 3).
    // Building the date and reading the components back out catches that rollover.
    const date = new Date(year, month - 1, day);
    return (
        date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day
    );
}

/** Convert dd/mm/yyyy → ISO yyyy-mm-dd for storage, or null if the date isn't real */
function dmyToIso(dmy: string): string | null {
    const parts = dmy.split("/");
    if (parts.length !== 3) return null;
    const [dStr, mStr, yStr] = parts;
    if (!dStr || !mStr || !yStr || yStr.length !== 4) return null;

    const day = Number(dStr);
    const month = Number(mStr);
    const year = Number(yStr);

    if (!isValidCalendarDate(day, month, year)) return null;

    return `${yStr}-${mStr.padStart(2, "0")}-${dStr.padStart(2, "0")}`;
}

/** Parse ISO date string without UTC offset to avoid off-by-one day bugs */
function parseIsoLocal(iso: string): Date | null {
    const parts = iso.split("-");
    if (parts.length !== 3) return null;
    const [y, m, d] = parts.map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d); // Local timezone — no UTC shift
}

function formatLocalDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

export function DateInitializer({ vaccine, value, onChange }: DateInitializerProps) {
    const t = useTranslations("vaccineHub");

    // Display state in dd/mm/yyyy; synced from ISO `value` prop
    const [displayValue, setDisplayValue] = useState(isoToDmy(value));
    const [hasInvalidDate, setHasInvalidDate] = useState(false);

    useEffect(() => {
        setDisplayValue(isoToDmy(value));
        setHasInvalidDate(false);
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

        if (raw === "") {
            setHasInvalidDate(false);
            onChange("");
            return;
        }

        // Only validate/propagate once a full dd/mm/yyyy has been entered
        if (raw.length === 10) {
            const iso = dmyToIso(raw);
            if (iso) {
                setHasInvalidDate(false);
                onChange(iso);
            } else {
                // Impossible date (e.g. 31/02/2026, 00/12/2026) — don't save it
                setHasInvalidDate(true);
            }
        } else {
            setHasInvalidDate(false);
        }
    };

    const parsedDate = value ? parseIsoLocal(value) : null;

    const todayIso = formatLocalDate(new Date());

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
                    aria-invalid={hasInvalidDate}
                    aria-describedby={hasInvalidDate ? "date-initializer-error" : undefined}
                    className={`w-full rounded-lg border bg-white px-4 py-3 font-medium text-(--color-text-primary) shadow-sm transition-all outline-none hover:bg-(--color-surface-muted) focus:ring-2 focus:ring-offset-2 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700 ${
                        hasInvalidDate
                            ? "border-red-400 focus:ring-red-500 dark:border-red-500"
                            : "border-slate-200 focus:ring-emerald-500 dark:border-slate-700"
                    }`}
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
                    onChange={(e) => {
                        setHasInvalidDate(false);
                        onChange(e.target.value);
                    }}
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

            {hasInvalidDate && (
                <p id="date-initializer-error" role="alert" className="text-xs text-red-600 dark:text-red-400">
                    Please enter a valid date.
                </p>
            )}

            {!hasInvalidDate && parsedDate && (
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