"use client";

import React from "react";
import { Search, Clock, Pin } from "lucide-react";

export interface HistoryItem {
    query: string;
    pinned: boolean;
    timestamp: number;
}

export interface SearchSuggestionsProps {
    suggestions: string[];
    activeIndex: number;
    onSelect: (value: string) => void;
    visible: boolean;
    isLoading?: boolean;
    error?: string | null;
    noResults?: boolean;
    onRetry?: () => void;
    isHistory?: boolean;
    historyItems?: HistoryItem[];
    onPinToggle?: (query: string) => void;
    onClearHistory?: () => void;
    query?: string;
}

export default function SearchSuggestions({
    suggestions,
    activeIndex,
    onSelect,
    visible,
    isLoading = false,
    error = null,
    noResults = false,
    onRetry,
    isHistory = false,
    historyItems = [],
    onPinToggle,
    onClearHistory,
    query = "",
}: SearchSuggestionsProps) {
    function highlightMatch(text: string, query: string) {
        if (!query) return text;
        const lowerText = text.toLowerCase();
        const lowerQuery = query.toLowerCase();
        const matchIndex = lowerText.indexOf(lowerQuery);
        if (matchIndex === -1) return text;

        const before = text.slice(0, matchIndex);
        const match = text.slice(matchIndex, matchIndex + query.length);
        const after = text.slice(matchIndex + query.length);

        return (
            <>
                {before}
                <strong className="font-bold text-emerald-600 dark:text-emerald-400">
                    {match}
                </strong>
                {after}
            </>
        );
    }

    if (!visible && !isLoading && !error && !noResults) {
        return null;
    }
    if (isHistory && (!historyItems || historyItems.length === 0)) {
        return null;
    }
    if (isLoading) {
        return (
            <div className="absolute top-full right-0 left-0 z-50 mt-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                    Searching medicines...
                </div>
            </div>
        );
    }
    if (error) {
        return (
            <div className="absolute top-full right-0 left-0 z-50 mt-2 rounded-2xl border border-red-200 bg-white p-4 shadow-xl">
                <p className="mb-3 text-sm text-red-600">{error}</p>
                {onRetry && (
                    <button
                        type="button"
                        onClick={onRetry}
                        className="rounded-lg bg-red-500 px-3 py-2 text-sm text-white"
                    >
                        Retry
                    </button>
                )}
            </div>
        );
    }
    if (noResults) {
        return (
            <div className="absolute top-full right-0 left-0 z-50 mt-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
                <p className="text-sm text-slate-600">
                    No medicines found. Try another medicine name or batch number.
                </p>
            </div>
        );
    }

    return (
        <ul
            id="search-suggestions-listbox"
            role="listbox"
            aria-label="Search suggestions"
            className="animate-in fade-in slide-in-from-top-2 absolute top-full right-0 left-0 z-50 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60 duration-150"
        >
            {isHistory ? (
                <>
                    <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-5 py-2.5 text-[11px] font-bold tracking-wider text-slate-400 uppercase select-none">
                        <span>Recent Searches</span>
                        <button
                            type="button"
                            onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onClearHistory?.();
                            }}
                            className="text-red-500 transition-colors hover:text-red-600 focus:outline-none"
                        >
                            Clear All
                        </button>
                    </div>
                    {historyItems.map((item, index) => {
                        const isActive = index === activeIndex;
                        return (
                            <li
                                key={`${item.query}-${index}`}
                                id={`search-suggestion-${index}`}
                                role="option"
                                aria-selected={isActive}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    onSelect(item.query);
                                }}
                                className={`group flex cursor-pointer items-center justify-between px-5 py-3 text-sm font-medium transition-colors duration-100 ${
                                    isActive
                                        ? "bg-emerald-50 text-emerald-700"
                                        : "text-slate-700 hover:bg-slate-50"
                                } last:rounded-b-2xl`}
                            >
                                <div className="flex items-center gap-3 truncate">
                                    <Clock
                                        size={14}
                                        className={`shrink-0 ${isActive ? "text-emerald-500" : "text-slate-400"}`}
                                        aria-hidden="true"
                                    />
                                    <span className="truncate">{item.query}</span>
                                </div>
                                <button
                                    type="button"
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        onPinToggle?.(item.query);
                                    }}
                                    className={`ml-2 shrink-0 rounded p-1 transition-colors hover:bg-slate-200/50 ${
                                        item.pinned
                                            ? "text-emerald-500"
                                            : "text-slate-300 opacity-0 group-hover:opacity-100"
                                    }`}
                                    aria-label={
                                        item.pinned ? "Unpin search query" : "Pin search query"
                                    }
                                >
                                    <Pin
                                        size={14}
                                        className={item.pinned ? "fill-emerald-500" : ""}
                                    />
                                </button>
                            </li>
                        );
                    })}
                </>
            ) : (
                suggestions.map((suggestion, index) => {
                    const isActive = index === activeIndex;
                    return (
                        <li
                            key={`${suggestion}-${index}`}
                            id={`search-suggestion-${index}`}
                            role="option"
                            aria-selected={isActive}
                            onMouseDown={(e) => {
                                e.preventDefault();
                                onSelect(suggestion);
                            }}
                            className={`flex cursor-pointer items-center gap-3 px-5 py-3 text-sm font-medium transition-colors duration-100 ${
                                isActive
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "text-slate-700 hover:bg-slate-50"
                            } first:rounded-t-2xl last:rounded-b-2xl`}
                        >
                            <Search
                                size={14}
                                className={`shrink-0 ${isActive ? "text-emerald-500" : "text-slate-400"}`}
                                aria-hidden="true"
                            />
                            <span className="truncate">{highlightMatch(suggestion, query)}</span>
                        </li>
                    );
                })
            )}
        </ul>
    );
}
