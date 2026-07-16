"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Clock, Loader2, Search, X } from "lucide-react";
import type { Medicine } from "./ComparisonGrid";

// ─── constants ────────────────────────────────────────────────────────────────
const HISTORY_KEY = "sahidawa_search_history";
const MAX_HISTORY = 5;
const SEARCH_ERROR_MESSAGE = "Search failed. Please try again.";

// ─── types ────────────────────────────────────────────────────────────────────
interface HistoryEntry {
    query: string;
    savedAt: number; // epoch ms — used for the hover tooltip
}

type Props = {
    label: string;
    value: Medicine | null;
    onChange: (medicine: Medicine | null) => void;
    onSearch: (query: string) => Promise<Medicine[]>;
    placeholder?: string;
};

// ─── helpers ──────────────────────────────────────────────────────────────────
function labelFor(m: Medicine): string {
    return m.brand_name?.trim() ? `${m.brand_name} · ${m.generic_name}` : m.generic_name;
}

function loadHistory(): HistoryEntry[] {
    try {
        const raw = localStorage.getItem(HISTORY_KEY);
        return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
    } catch {
        return [];
    }
}

function pushToHistory(query: string, prev: HistoryEntry[]): HistoryEntry[] {
    const trimmed = query.trim();
    if (!trimmed) return prev;

    // Drop duplicates (case-insensitive), keep most recent at front
    const deduped = prev.filter((e) => e.query.toLowerCase() !== trimmed.toLowerCase());

    const updated: HistoryEntry[] = [{ query: trimmed, savedAt: Date.now() }, ...deduped].slice(
        0,
        MAX_HISTORY
    );

    try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    } catch {
        // storage full or private mode — fail silently
    }

    return updated;
}

function clearHistory(): void {
    localStorage.removeItem(HISTORY_KEY);
}

function timeAgo(ms: number): string {
    const diff = Math.floor((Date.now() - ms) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

// ─── component ────────────────────────────────────────────────────────────────
export default function MedicineSearchSelect({
    label,
    value,
    onChange,
    onSearch,
    placeholder = "Search brand or generic name",
}: Props) {
    const listId = useId();
    const rootRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<Medicine[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [activeIndex, setActiveIndex] = useState(-1);
    const requestIdRef = useRef(0);

    // Load history once on mount
    useEffect(() => {
        setHistory(loadHistory());
    }, []);

    const runSearch = useCallback(
        async (normalizedQuery: string, requestId: number) => {
            setLoading(true);
            setSearchError(null);
            setResults([]);
            setActiveIndex(-1);

            try {
                const nextResults = await onSearch(normalizedQuery);
                if (requestIdRef.current !== requestId) return;

                setResults(nextResults);
                setSearchError(null);
                setActiveIndex(nextResults.length ? 0 : -1);
                // Only persist successful searches that returned results.
                if (nextResults.length > 0) {
                    setHistory((previous) => pushToHistory(normalizedQuery, previous));
                }
            } catch {
                if (requestIdRef.current !== requestId) return;

                setResults([]);
                setActiveIndex(-1);
                setSearchError(SEARCH_ERROR_MESSAGE);
            } finally {
                if (requestIdRef.current === requestId) {
                    setLoading(false);
                }
            }
        },
        [onSearch]
    );

    // Debounced search. Incrementing the request id immediately invalidates any
    // in-flight request before the next debounce timer starts.
    useEffect(() => {
        const requestId = ++requestIdRef.current;
        const q = query.trim();

        setLoading(false);
        setSearchError(null);
        setResults([]);
        setActiveIndex(-1);

        if (!open) return;
        if (q.length < 2) {
            return;
        }

        const t = setTimeout(() => {
            void runSearch(q, requestId);
        }, 300);
        return () => clearTimeout(t);
    }, [query, open, runSearch]);

    useEffect(
        () => () => {
            requestIdRef.current += 1;
        },
        []
    );

    // Close dropdown on outside click
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    // Populate input from a history chip click
    function handleChipClick(entry: HistoryEntry) {
        setQuery(entry.query);
        setOpen(true);
        inputRef.current?.focus();
    }

    function handleClearHistory() {
        clearHistory();
        setHistory([]);
    }

    // Clear the search input and refocus
    function handleClearQuery() {
        setQuery("");
        setResults([]);
        setSearchError(null);
        setActiveIndex(-1);
        inputRef.current?.focus();
    }

    function handleRetry() {
        const normalizedQuery = query.trim();
        if (normalizedQuery.length < 2) return;

        const requestId = ++requestIdRef.current;
        void runSearch(normalizedQuery, requestId);
    }

    const showHistory = !value && history.length > 0;

    return (
        <div ref={rootRef} className="relative w-full">
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                {label}
            </label>

            {/* ── selected state ── */}
            {value ? (
                <div className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
                    <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                            {labelFor(value)}
                        </p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                            {value.manufacturer}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            onChange(null);
                            setSearchError(null);
                            setOpen(true);
                            inputRef.current?.focus();
                        }}
                        className="rounded p-1 text-slate-400 hover:bg-white hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                        aria-label={`Clear ${label}`}
                    >
                        <X size={16} />
                    </button>
                </div>
            ) : (
                <>
                    {/* ── search input ── */}
                    <div className="relative">
                        <Search
                            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                            size={16}
                        />
                        <input
                            ref={inputRef}
                            role="combobox"
                            aria-autocomplete="list"
                            aria-expanded={open}
                            aria-controls={open ? listId : undefined}
                            aria-activedescendant={
                                activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined
                            }
                            type="search"
                            value={query}
                            onChange={(e) => {
                                setQuery(e.target.value);
                                setSearchError(null);
                                setOpen(true);
                            }}
                            onFocus={() => {
                                setOpen(true);
                                window.setTimeout(() => {
                                    inputRef.current?.scrollIntoView({
                                        block: "nearest",
                                        inline: "nearest",
                                    });
                                }, 150);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Escape") {
                                    // Stop the key from bubbling up and
                                    // accidentally closing a parent modal.
                                    e.preventDefault();
                                    e.stopPropagation();

                                    setQuery("");
                                    setResults([]);
                                    setSearchError(null);
                                    setActiveIndex(-1);
                                    setOpen(false);
                                    e.currentTarget.blur();
                                    return;
                                }

                                if (!results.length) return;

                                switch (e.key) {
                                    case "ArrowDown":
                                        e.preventDefault();
                                        setActiveIndex((prev) =>
                                            prev < results.length - 1 ? prev + 1 : 0
                                        );
                                        break;

                                    case "ArrowUp":
                                        e.preventDefault();
                                        setActiveIndex((prev) =>
                                            prev > 0 ? prev - 1 : results.length - 1
                                        );
                                        break;

                                    case "Enter":
                                        e.preventDefault();

                                        if (activeIndex >= 0) {
                                            const selected = results[activeIndex];

                                            onChange(selected);
                                            setQuery("");
                                            setOpen(false);
                                            setActiveIndex(-1);
                                        }
                                        break;
                                }
                            }}
                            placeholder={placeholder}
                            className="w-full rounded-lg border border-slate-300 bg-white py-2 pr-8 pl-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-emerald-500 dark:focus:ring-emerald-500"
                            autoComplete="off"
                        />

                        {/* ── Clear (X) button — only when there is input text ── */}
                        {query.length > 0 && (
                            <button
                                type="button"
                                onClick={handleClearQuery}
                                aria-label="Clear search"
                                className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:ring-2 focus:ring-emerald-500 focus:outline-none dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    {/* ── recent searches chips ── */}
                    {showHistory && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <span className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                                <Clock size={11} />
                                Recent:
                            </span>

                            {history.map((entry) => (
                                <button
                                    key={entry.query}
                                    type="button"
                                    title={`Searched ${timeAgo(entry.savedAt)}`}
                                    onClick={() => handleChipClick(entry)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                            e.preventDefault();
                                            handleChipClick(entry);
                                        }
                                    }}
                                    className="chip-btn inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs text-slate-600 transition-all duration-150 hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-emerald-500 dark:hover:bg-emerald-900/30 dark:hover:text-emerald-400 dark:focus:ring-offset-slate-900"
                                >
                                    {entry.query}
                                </button>
                            ))}

                            <button
                                type="button"
                                onClick={handleClearHistory}
                                className="ml-auto rounded text-xs text-slate-400 underline-offset-2 transition-colors duration-150 hover:text-rose-500 hover:underline focus:ring-1 focus:ring-rose-400 focus:outline-none dark:text-slate-500 dark:hover:text-rose-400"
                            >
                                Clear history
                            </button>
                        </div>
                    )}
                </>
            )}

            {/* ── results dropdown ── */}
            {open && !value && (
                <ul
                    id={listId}
                    role="listbox"
                    className="absolute z-50 mt-1 max-h-[40vh] w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-900/50"
                >
                    {loading && (
                        <li
                            aria-live="polite"
                            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-500 dark:text-slate-400"
                        >
                            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                            Searching
                        </li>
                    )}
                    {!loading && query.trim().length < 2 && (
                        <li className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">
                            Enter at least 2 characters
                        </li>
                    )}
                    {!loading && searchError && (
                        <li
                            role="alert"
                            className="flex items-center justify-between gap-3 px-3 py-2 text-sm text-rose-700 dark:text-rose-400"
                        >
                            <span>{searchError}</span>
                            <button
                                type="button"
                                onClick={handleRetry}
                                className="shrink-0 rounded-md border border-rose-300 px-2.5 py-1 font-medium hover:bg-rose-50 focus:ring-2 focus:ring-rose-500 focus:ring-offset-1 focus:outline-none dark:border-rose-700 dark:hover:bg-rose-950/40 dark:focus:ring-offset-slate-900"
                            >
                                Retry
                            </button>
                        </li>
                    )}
                    {!loading &&
                        !searchError &&
                        query.trim().length >= 2 &&
                        results.length === 0 && (
                            <li className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">
                                No results
                            </li>
                        )}
                    {!loading &&
                        results.map((m, index) => (
                            <li
                                key={m.id}
                                id={`${listId}-option-${index}`}
                                role="option"
                                aria-selected={activeIndex === index}
                            >
                                <button
                                    type="button"
                                    onMouseEnter={() => setActiveIndex(index)}
                                    className={`w-full px-3 py-2 text-left text-sm focus:outline-none ${
                                        activeIndex === index
                                            ? "bg-emerald-100 dark:bg-emerald-900/40"
                                            : "hover:bg-slate-50 dark:hover:bg-slate-800"
                                    }`}
                                    onClick={() => {
                                        onChange(m);
                                        setQuery("");
                                        setSearchError(null);
                                        setOpen(false);
                                        setActiveIndex(-1);
                                    }}
                                >
                                    <span className="font-medium text-slate-900 dark:text-slate-100">
                                        {labelFor(m)}
                                    </span>
                                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                                        {m.manufacturer}
                                    </span>
                                </button>
                            </li>
                        ))}
                </ul>
            )}
        </div>
    );
}
