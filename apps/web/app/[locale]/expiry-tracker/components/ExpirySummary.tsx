import { Search, Trash2 } from "lucide-react";

import type { FilterStatus, SortOption } from "./types";

interface ExpirySummaryProps {
    t: (key: string) => string;
    totalMedicines: number;
    selectedCount: number;
    searchQuery: string;
    sortBy: SortOption;
    filterStatus: FilterStatus;
    filterOptions: { key: FilterStatus; label: string }[];
    onBulkDelete: () => void;
    onSearchChange: (value: string) => void;
    onSortChange: (value: SortOption) => void;
    onFilterChange: (value: FilterStatus) => void;
}

export function ExpirySummary({
    t,
    totalMedicines,
    selectedCount,
    searchQuery,
    sortBy,
    filterStatus,
    filterOptions,
    onBulkDelete,
    onSearchChange,
    onSortChange,
    onFilterChange,
}: ExpirySummaryProps) {
    return (
        <>
            <div className="flex items-center justify-between px-2">
                <h2 className="text-xl font-bold">{t("trackedMedicines")}</h2>
                <div className="flex items-center gap-2">
                    {selectedCount > 0 && (
                        <button
                            onClick={onBulkDelete}
                            className="flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-4 py-1.5 text-xs font-bold text-red-500 transition hover:bg-red-500/20"
                        >
                            <Trash2 size={14} /> {t("deleteSelected")} ({selectedCount})
                        </button>
                    )}
                    <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-500">
                        {t("total")}: {totalMedicines}
                    </span>
                </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                    <Search
                        size={15}
                        className="absolute top-1/2 left-3 -translate-y-1/2 opacity-40"
                    />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(event) => onSearchChange(event.target.value)}
                        placeholder={t("searchPlaceholder")}
                        className="w-full rounded-xl border border-(--color-border-muted) bg-(--color-surface-muted) py-2.5 pr-3 pl-9 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                </div>
                <select
                    value={sortBy}
                    onChange={(event) => onSortChange(event.target.value as SortOption)}
                    className="rounded-xl border border-(--color-border-muted) bg-(--color-surface-muted) px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                >
                    <option value="expirySoonest">{t("sortExpirySoonest")}</option>
                    <option value="expiryLatest">{t("sortExpiryLatest")}</option>
                    <option value="alpha">{t("sortAlpha")}</option>
                </select>
            </div>

            <div className="flex flex-wrap gap-2">
                {filterOptions.map((filter) => (
                    <button
                        key={filter.key}
                        onClick={() => onFilterChange(filter.key)}
                        className={`rounded-full border px-4 py-1.5 text-xs font-bold transition-all ${
                            filterStatus === filter.key
                                ? "border-emerald-600 bg-emerald-600 text-white"
                                : "border-(--color-border-muted) text-(--color-text-secondary) hover:border-emerald-500"
                        }`}
                    >
                        {filter.label}
                    </button>
                ))}
            </div>
        </>
    );
}
