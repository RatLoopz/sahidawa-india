"use client";

import { vaccineDatabase, VaccineKey } from "@/lib/vaccineData";
import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, Search } from "lucide-react";

interface VaccineSelectorProps {
    value: VaccineKey | "";
    onChange: (vaccine: VaccineKey | "") => void;
    onVaccineChange?: () => void;
    disabled?: boolean;
}

export function VaccineSelector({
    value,
    onChange,
    onVaccineChange,
    disabled = false,
}: VaccineSelectorProps) {
    const t = useTranslations("vaccineHub");
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    // Group vaccines by target groups for better organization
    const groupedVaccines = useMemo(() => {
        const groups: Record<string, (VaccineKey | string)[]> = {
            "Newborn & Infant": [],
            "Child & Adolescent": [],
            "Adult & Pregnancy": [],
        };

        Object.entries(vaccineDatabase).forEach(([key, vaccine]) => {
            const targets = vaccine.target_groups.join(" ");
            if (targets.includes("Newborn") || targets.includes("Infant")) {
                groups["Newborn & Infant"].push(key);
            } else if (targets.includes("Child") || targets.includes("Adolescent")) {
                groups["Child & Adolescent"].push(key);
            } else {
                groups["Adult & Pregnancy"].push(key);
            }
        });

        return groups;
    }, []);

    // Filter based on search query
    const filteredVaccines = useMemo(() => {
        const query = searchQuery.toLowerCase();
        const filtered: Record<string, (VaccineKey | string)[]> = {};

        Object.entries(groupedVaccines).forEach(([group, vaccines]) => {
            const matches = vaccines.filter((key) => {
                const vaccine = vaccineDatabase[key as VaccineKey];
                return (
                    vaccine.disease_name.toLowerCase().includes(query) ||
                    vaccine.vaccine_name.toLowerCase().includes(query)
                );
            });
            if (matches.length > 0) {
                filtered[group] = matches;
            }
        });

        return filtered;
    }, [searchQuery, groupedVaccines]);

    const selectedVaccine = value ? vaccineDatabase[value] : null;

    const handleSelect = (vaccineKey: VaccineKey | string) => {
        onChange(vaccineKey as VaccineKey);
        setIsOpen(false);
        setSearchQuery("");
        onVaccineChange?.();
    };

    return (
        <div className="relative">
            <label className="mb-2 block text-xs font-bold tracking-wider text-emerald-800 uppercase">
                🔎 {t("selectLabel")}
            </label>

            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                disabled={disabled}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-left font-medium text-(--color-text-primary) shadow-sm transition-all hover:bg-(--color-surface-muted) focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                aria-label="Select a vaccine"
            >
                <span className="flex items-center gap-2">
                    {selectedVaccine ? (
                        <>
                            <span className="text-lg">💉</span>
                            <div className="text-left">
                                <p className="text-sm font-semibold">
                                    {selectedVaccine.disease_name}
                                </p>
                                <p className="text-xs text-(--color-text-muted)">
                                    {selectedVaccine.vaccine_name}
                                </p>
                            </div>
                        </>
                    ) : (
                        t("placeholder")
                    )}
                </span>
                <ChevronDown
                    size={20}
                    className={`shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    aria-hidden="true"
                />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute top-full right-0 left-0 z-50 mt-2 rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
                    {/* Search Input */}
                    <div className="border-b border-slate-200 p-3 dark:border-slate-700">
                        <div className="relative">
                            <Search
                                size={16}
                                className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
                                aria-hidden="true"
                            />
                            <input
                                type="text"
                                placeholder="Search vaccines or diseases..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full rounded-md border border-slate-300 bg-(--color-surface-muted) py-2 pr-3 pl-9 text-sm placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:placeholder-slate-400"
                                aria-label="Search vaccines"
                            />
                        </div>
                    </div>

                    {/* Vaccine Groups */}
                    <div role="listbox" className="max-h-64 overflow-y-auto">
                        {Object.entries(filteredVaccines).length > 0 ? (
                            Object.entries(filteredVaccines).map(([group, vaccines]) => (
                                <div key={group}>
                                    <div className="border-t border-slate-200 px-3 py-2 text-xs font-bold tracking-wider text-emerald-700 uppercase dark:border-slate-700 dark:text-emerald-400">
                                        {group}
                                    </div>
                                    {vaccines.map((key) => {
                                        const vaccine = vaccineDatabase[key as VaccineKey];
                                        return (
                                            <button
                                                key={key}
                                                onClick={() => handleSelect(key as VaccineKey)}
                                                role="option"
                                                aria-selected={value === key}
                                                className={`w-full px-4 py-3 text-left text-sm transition-colors hover:bg-emerald-50 focus:bg-emerald-50 focus:outline-none dark:hover:bg-slate-700 dark:focus:bg-slate-700 ${
                                                    value === key
                                                        ? "bg-emerald-100 font-semibold text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100"
                                                        : "text-slate-700 dark:text-slate-200"
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0 flex-1">
                                                        <p className="font-medium">
                                                            {vaccine.disease_name}
                                                        </p>
                                                        <p className="text-xs opacity-75">
                                                            {vaccine.vaccine_name}
                                                        </p>
                                                    </div>
                                                    {value === key && (
                                                        <span className="mt-1 shrink-0 text-lg">
                                                            ✓
                                                        </span>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            ))
                        ) : (
                            <div className="px-4 py-6 text-center text-sm text-(--color-text-muted)">
                                No vaccines found matching "{searchQuery}"
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Close dropdown when clicking outside */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsOpen(false)}
                    aria-hidden="true"
                />
            )}
        </div>
    );
}
