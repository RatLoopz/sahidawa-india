"use client";

import { useEffect, useState, useRef } from "react";
import { useTranslations } from "next-intl";
import {
    AlertTriangle,
    Plus,
    Trash2,
    X,
    ShieldAlert,
    Activity,
    BookOpen,
    RefreshCw,
    CheckCircle2,
    WifiOff,
} from "lucide-react";
import { fuzzyMatchBrand } from "@/lib/api";
import { checkInteractions, type InteractionResult } from "@/lib/api/interactions";
import { PageHeader } from "../components/PageHeader";

const STORAGE_KEY = "sahidawa-my-medicines";

function InteractionResultsSkeleton() {
    return (
        <div
            data-testid="interaction-results-skeleton"
            role="status"
            aria-label="Loading interaction results"
            className="space-y-6"
        >
            <div className="h-8 w-48 animate-pulse rounded-lg bg-(--color-surface-page)" />

            <div className="flex flex-col gap-4">
                {[0, 1].map((item) => (
                    <div
                        key={item}
                        data-testid="interaction-result-card-skeleton"
                        className="overflow-hidden rounded-3xl border border-(--color-border-muted) bg-(--color-surface-page) shadow-sm"
                    >
                        <div className="flex items-start justify-between gap-4 border-b border-(--color-border-muted) bg-slate-50/30 px-6 py-4 dark:bg-slate-900/10">
                            <div className="h-5 w-44 animate-pulse rounded-md bg-(--color-surface-muted)" />
                            <div className="h-7 w-24 animate-pulse rounded-full bg-(--color-surface-muted)" />
                        </div>

                        <div className="flex flex-col gap-4 p-6">
                            <div className="space-y-2">
                                <div className="h-4 w-11/12 animate-pulse rounded bg-(--color-surface-muted)" />
                                <div className="h-4 w-8/12 animate-pulse rounded bg-(--color-surface-muted)" />
                            </div>

                            <div className="rounded-xl border border-(--color-border-muted) bg-(--color-surface-muted) p-4">
                                <div className="mb-3 h-3 w-20 animate-pulse rounded bg-(--color-surface-page)" />
                                <div className="space-y-2">
                                    <div className="h-3 w-full animate-pulse rounded bg-(--color-surface-page)" />
                                    <div className="h-3 w-9/12 animate-pulse rounded bg-(--color-surface-page)" />
                                </div>
                            </div>

                            <div className="rounded-xl border border-emerald-100 bg-emerald-50/20 p-4 dark:border-emerald-950/20">
                                <div className="mb-3 h-3 w-36 animate-pulse rounded bg-emerald-200/60 dark:bg-emerald-950/40" />
                                <div className="space-y-2">
                                    <div className="h-3 w-10/12 animate-pulse rounded bg-emerald-200/60 dark:bg-emerald-950/40" />
                                    <div className="h-3 w-7/12 animate-pulse rounded bg-emerald-200/60 dark:bg-emerald-950/40" />
                                </div>
                            </div>

                            <div className="flex justify-end border-t border-(--color-border-muted) pt-2">
                                <div className="h-3 w-28 animate-pulse rounded bg-(--color-surface-muted)" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            <span className="sr-only">Checking drug interactions...</span>
        </div>
    );
}

export default function InteractionCheckerPage() {
    const t = useTranslations("Interactions");

    const [selectedMedicines, setSelectedMedicines] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [suggestions, setSuggestions] = useState<string[]>([]);

    const [isLoading, setIsLoading] = useState(false);
    const [interactions, setInteractions] = useState<InteractionResult[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [hasChecked, setHasChecked] = useState(false);
    const [isOfflineResult, setIsOfflineResult] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Load from LocalStorage
    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored) as string[];
                if (Array.isArray(parsed)) {
                    setSelectedMedicines(parsed);
                }
            } catch (err) {
                console.error("Failed to parse stored medicines list:", err);
            }
        }
    }, []);

    // Debounced autocomplete suggestions
    useEffect(() => {
        const query = searchQuery.trim();
        if (query.length < 2) {
            setSuggestions([]);
            return;
        }

        const delayId = setTimeout(() => {
            fuzzyMatchBrand(query)
                .then((res) => {
                    // Filter duplicates and map names
                    const names = Array.from(new Set(res.map((s) => s.name)));
                    setSuggestions(names);
                })
                .catch((err) => {
                    console.error("Suggestions lookup failed:", err);
                });
        }, 250);

        return () => clearTimeout(delayId);
    }, [searchQuery]);

    // Handle clicks outside suggestions dropdown to close it
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setSuggestions([]);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const saveMedicinesList = (newList: string[]) => {
        setSelectedMedicines(newList);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newList));
        // Reset check status when list modifications occur
        setHasChecked(false);
        setInteractions([]);
        setError(null);
    };

    const handleAddMedicine = (medName: string) => {
        const formatted = medName.trim();
        if (!formatted) return;

        // Prevent duplicates (case-insensitive check)
        const exists = selectedMedicines.some((m) => m.toLowerCase() === formatted.toLowerCase());
        if (!exists) {
            const updated = [...selectedMedicines, formatted];
            saveMedicinesList(updated);
        }

        setSearchQuery("");
        setSuggestions([]);
        inputRef.current?.focus();
    };

    const handleRemoveMedicine = (indexToRemove: number) => {
        const updated = selectedMedicines.filter((_, idx) => idx !== indexToRemove);
        saveMedicinesList(updated);
    };

    const handleClearAll = () => {
        saveMedicinesList([]);
    };

    const handleCheckInteractions = async () => {
        if (selectedMedicines.length < 2) {
            setError("At least two medicines are required to check for interactions.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setInteractions([]);

        try {
            const response = await checkInteractions(selectedMedicines);

            // Sort interactions by severity: critical -> serious -> moderate -> minor
            const severityOrder = { critical: 1, serious: 2, moderate: 3, minor: 4 };
            const sorted = [...response.interactions].sort((a, b) => {
                return (severityOrder[a.severity] || 99) - (severityOrder[b.severity] || 99);
            });

            setInteractions(sorted);
            setIsOfflineResult(response.verified === false);
            setHasChecked(true);
        } catch (err: any) {
            setError(err.message || t("errorMessage"));
        } finally {
            setIsLoading(false);
        }
    };

    const getSeverityBadgeClass = (severity: string) => {
        switch (severity) {
            case "critical":
                return "border-red-200 bg-red-50 text-red-700 dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-400";
            case "serious":
                return "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/30 dark:bg-orange-950/20 dark:text-orange-400";
            case "moderate":
                return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-400";
            case "minor":
                return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/30 dark:bg-blue-950/20 dark:text-blue-400";
            default:
                return "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400";
        }
    };

    const getSeverityTitle = (severity: string) => {
        switch (severity) {
            case "critical":
                return t("severityCritical");
            case "serious":
                return t("severitySerious");
            case "moderate":
                return t("severityModerate");
            case "minor":
                return t("severityMinor");
            default:
                return severity.charAt(0).toUpperCase() + severity.slice(1);
        }
    };

    return (
        <div className="flex-grow bg-(--color-surface-muted) px-6 py-8 text-(--color-text-primary)">
            <div className="mx-auto max-w-3xl">
                <PageHeader backHref="/" variant="light" />

                {/* Header */}
                <div className="mb-8 flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-600 shadow-sm dark:bg-emerald-950/30 dark:text-emerald-400">
                        <ShieldAlert size={30} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-(--color-text-primary) sm:text-3xl">
                            {t("title")}
                        </h1>
                        <p className="mt-1 text-(--color-text-secondary)">{t("subtitle")}</p>
                    </div>
                </div>

                {/* Alert/Error Banner */}
                {error && (
                    <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50/50 p-4 text-red-800 shadow-sm dark:border-red-900/30 dark:bg-red-950/10 dark:text-red-300">
                        <AlertTriangle
                            className="mt-0.5 shrink-0 text-red-600 dark:text-red-400"
                            size={20}
                        />
                        <span className="text-sm font-semibold">{error}</span>
                    </div>
                )}

                {/* Search Card */}
                <div className="mb-6 rounded-3xl border border-(--color-border-muted) bg-(--color-surface-page) p-6 shadow-sm">
                    <div className="relative" ref={dropdownRef}>
                        <label className="mb-2 block text-sm font-bold text-(--color-text-primary)">
                            {t("searchLabel")}
                        </label>
                        <div className="flex gap-2">
                            <input
                                ref={inputRef}
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={t("searchPlaceholder")}
                                className="w-full rounded-xl border border-(--color-border-muted) bg-(--color-surface-muted) px-4 py-3 font-semibold text-(--color-text-primary) placeholder-(--color-text-muted) shadow-inner focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && searchQuery.trim()) {
                                        handleAddMedicine(searchQuery);
                                    }
                                }}
                            />
                            <button
                                onClick={() => handleAddMedicine(searchQuery)}
                                disabled={!searchQuery.trim()}
                                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-5 font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                            >
                                <Plus size={18} />
                                <span>{t("addButton")}</span>
                            </button>
                        </div>

                        {/* Suggestions Dropdown */}
                        {suggestions.length > 0 && (
                            <div className="absolute right-0 left-0 z-50 mt-2 max-h-60 overflow-y-auto rounded-2xl border border-(--color-border-muted) bg-(--color-surface-page) p-2 shadow-lg">
                                {suggestions.map((name, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => handleAddMedicine(name)}
                                        className="w-full rounded-xl px-4 py-2.5 text-left text-sm font-semibold text-(--color-text-primary) hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/20 dark:hover:text-emerald-400"
                                    >
                                        {name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Selected Medicines Chips List */}
                <div className="mb-6 rounded-3xl border border-(--color-border-muted) bg-(--color-surface-page) p-6 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-sm font-bold text-(--color-text-primary)">
                            {t("myMedicines")} ({selectedMedicines.length})
                        </h2>
                        {selectedMedicines.length > 0 && (
                            <button
                                onClick={handleClearAll}
                                className="inline-flex items-center gap-1 text-xs font-bold text-red-600 transition hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                            >
                                <Trash2 size={14} />
                                <span>{t("clearAll")}</span>
                            </button>
                        )}
                    </div>

                    {selectedMedicines.length === 0 ? (
                        <p className="py-4 text-center text-sm font-semibold text-(--color-text-muted)">
                            {t("noMedicines")}
                        </p>
                    ) : (
                        <div className="flex flex-wrap gap-2.5">
                            {selectedMedicines.map((med, idx) => (
                                <div
                                    key={idx}
                                    className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/50 py-1.5 pr-2.5 pl-4 text-sm font-bold text-emerald-800 shadow-sm transition hover:border-emerald-300 dark:border-emerald-950/50 dark:bg-emerald-950/10 dark:text-emerald-300"
                                >
                                    <span>{med}</span>
                                    <button
                                        onClick={() => handleRemoveMedicine(idx)}
                                        className="rounded-full p-0.5 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {selectedMedicines.length >= 2 && (
                        <div className="mt-6 flex justify-end">
                            <button
                                onClick={handleCheckInteractions}
                                disabled={isLoading}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-4 font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                            >
                                {isLoading ? (
                                    <RefreshCw className="animate-spin" size={18} />
                                ) : (
                                    <Activity size={18} />
                                )}
                                <span>{t("checkButton")}</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Interaction Check Results */}
                {isLoading && <InteractionResultsSkeleton />}

                {hasChecked && !isLoading && (
                    <div className="space-y-6">
                        <h2 className="border-b border-(--color-border-muted) pb-2 text-xl font-black text-(--color-text-primary)">
                            {t("resultsHeading")}
                        </h2>

                        {isOfflineResult && (
                            <div
                                role="alert"
                                aria-live="polite"
                                className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/30 dark:bg-amber-950/20"
                            >
                                <WifiOff
                                    size={18}
                                    className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
                                />
                                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                                    {t("offlineBadge")}
                                </p>
                            </div>
                        )}

                        {interactions.length === 0 ? (
                            <div className="flex flex-col items-center gap-4 rounded-3xl border border-emerald-200 bg-emerald-50/30 px-6 py-12 text-center shadow-sm dark:border-emerald-900/30 dark:bg-emerald-950/10">
                                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
                                    <CheckCircle2 size={32} />
                                </div>
                                <div>
                                    <p className="text-lg font-black text-emerald-800 dark:text-emerald-300">
                                        {t("noInteractions")}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4">
                                {interactions.map((item, idx) => (
                                    <div
                                        key={idx}
                                        className={`overflow-hidden rounded-3xl border bg-(--color-surface-page) shadow-sm transition-all hover:shadow-md ${
                                            item.severity === "critical"
                                                ? "border-red-300 dark:border-red-900/50"
                                                : item.severity === "serious"
                                                  ? "border-orange-300 dark:border-orange-900/50"
                                                  : item.severity === "moderate"
                                                    ? "border-amber-300 dark:border-amber-900/50"
                                                    : "border-blue-300 dark:border-blue-900/50"
                                        }`}
                                    >
                                        {/* Card Header with Severity */}
                                        <div className="flex items-start justify-between gap-4 border-b border-(--color-border-muted) bg-slate-50/30 px-6 py-4 dark:bg-slate-900/10">
                                            <h3 className="text-md font-black text-(--color-text-primary)">
                                                {item.drugA} + {item.drugB}
                                            </h3>
                                            <span
                                                className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-black uppercase ${getSeverityBadgeClass(
                                                    item.severity
                                                )}`}
                                            >
                                                {getSeverityTitle(item.severity)}
                                            </span>
                                        </div>

                                        {/* Card Content */}
                                        <div className="flex flex-col gap-4 p-6">
                                            <div>
                                                <p className="text-sm font-bold text-(--color-text-primary)">
                                                    {item.description}
                                                </p>
                                            </div>

                                            {/* Mechanism details */}
                                            <div className="rounded-xl border border-(--color-border-muted) bg-(--color-surface-muted) p-4">
                                                <span className="mb-1 block text-xs font-bold tracking-wide text-(--color-text-secondary) uppercase">
                                                    {t("mechanism")}
                                                </span>
                                                <p className="text-sm leading-relaxed text-(--color-text-secondary)">
                                                    {item.mechanism}
                                                </p>
                                            </div>

                                            {/* Recommendation */}
                                            <div className="rounded-xl border border-emerald-100 bg-emerald-50/20 p-4 dark:border-emerald-950/20">
                                                <span className="mb-1 block text-xs font-bold tracking-wide text-emerald-700 uppercase dark:text-emerald-400">
                                                    {t("clinicalRecommendation")}
                                                </span>
                                                <p className="text-sm leading-relaxed font-semibold text-emerald-900 dark:text-emerald-300">
                                                    {item.clinical_recommendation}
                                                </p>
                                            </div>

                                            {/* Source Metadata */}
                                            <div className="flex items-center justify-end gap-1.5 border-t border-(--color-border-muted) pt-2 text-xs font-semibold text-(--color-text-muted)">
                                                <BookOpen size={12} />
                                                <span>
                                                    {t("source")} {item.source}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
