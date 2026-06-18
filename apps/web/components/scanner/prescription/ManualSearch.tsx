import React from "react";
import { Search, Loader2, Plus } from "lucide-react";

interface ManualSearchProps {
    manualSearchQuery: string;
    searchLoading: boolean;
    searchResults: Array<{ name: string; score: number }>;
    onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onAddMedicine: (name: string) => void;
}

export function ManualSearch({
    manualSearchQuery,
    searchLoading,
    searchResults,
    onSearchChange,
    onAddMedicine,
}: ManualSearchProps) {
    return (
        <div className="relative max-w-md">
            <label htmlFor="manual-med-search" className="sr-only">
                Search and add another medicine
            </label>
            <div className="flex items-center gap-2 rounded-2xl border border-(--color-border-muted) bg-(--color-surface-page) px-3 py-1.5 shadow-xs focus-within:ring-2 focus-within:ring-emerald-500/50">
                <Search size={18} className="text-(--color-text-muted)" />
                <input
                    id="manual-med-search"
                    type="text"
                    value={manualSearchQuery}
                    onChange={onSearchChange}
                    placeholder="Search and add another medicine manually..."
                    className="flex-1 bg-transparent text-sm text-(--color-text-primary) placeholder-(--color-text-muted) outline-none"
                />
                {searchLoading && <Loader2 className="animate-spin text-emerald-500" size={16} />}
            </div>

            {searchResults.length > 0 && (
                <ul className="animate-in fade-in absolute right-0 left-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-2xl border border-(--color-border-muted) bg-(--color-surface-page) p-1.5 shadow-2xl duration-150">
                    {searchResults.map((r, i) => (
                        <li key={i}>
                            <button
                                type="button"
                                onClick={() => onAddMedicine(r.name)}
                                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-semibold text-(--color-text-primary) hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20"
                            >
                                <span>{r.name}</span>
                                <span className="flex items-center gap-1 text-xs font-bold text-emerald-500">
                                    <Plus size={14} /> Add
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
