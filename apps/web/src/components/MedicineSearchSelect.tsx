"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Clock, Loader2, Search, X } from "lucide-react";
import type { Medicine } from "./ComparisonGrid";

// ─── constants ────────────────────────────────────────────────────────────────
const HISTORY_KEY = "sahidawa_search_history";
const MAX_HISTORY = 5;

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
    const [history, setHistory] = useState<HistoryEntry[]>([]);

    // Load history once on mount
    useEffect(() => {
        setHistory(loadHistory());
    }, []);

    // Debounced search
    useEffect(() => {
        if (!open) return;
        const q = query.trim();
        if (q.length < 2) {
            setResults([]);
            return;
        }
        const t = setTimeout(async () => {
            setLoading(true);
            try {
                const res = await onSearch(q);
                setResults(res);

                // Only persist to history when we actually got results back
                if (res.length > 0) {
                    setHistory((prev) => pushToHistory(q, prev));
                }
            } finally {
                setLoading(false);
            }
        }, 300);
        return () => clearTimeout(t);
    }, [query, open, onSearch]);

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

    const showHistory = !value && history.length > 0;

    return (
        <div ref={rootRef} className="relative w-full">
            <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>

            {/* ── selected state ── */}
            {value ? (
                <div className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">
                            {labelFor(value)}
                        </p>
                        <p className="truncate text-xs text-slate-500">{value.manufacturer}</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => onChange(null)}
                        className="rounded p-1 text-slate-400 hover:bg-white hover:text-slate-700"
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
                            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
                            size={16}
                        />
                        <input
                            ref={inputRef}
                            type="search"
                            value={query}
                            onChange={(e) => {
                                setQuery(e.target.value);
                                setOpen(true);
                            }}
                            onFocus={() => setOpen(true)}
                            placeholder={placeholder}
                            className="w-full rounded-lg border border-slate-300 bg-white py-2 pr-3 pl-9 text-sm outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                            aria-expanded={open}
                            aria-controls={open ? listId : undefined}
                            autoComplete="off"
                        />
                    </div>

                    {/* ── recent searches chips ── */}
                    {showHistory && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <span className="flex items-center gap-1 text-xs text-slate-400">
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
                                    className="chip-btn inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs text-slate-600 transition-all duration-150 hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 focus:outline-none"
                                >
                                    {entry.query}
                                </button>
                            ))}

                            <button
                                type="button"
                                onClick={handleClearHistory}
                                className="ml-auto rounded text-xs text-slate-400 underline-offset-2 transition-colors duration-150 hover:text-rose-500 hover:underline focus:ring-1 focus:ring-rose-400 focus:outline-none"
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
                    className="absolute z-50 mt-1 max-h-52 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
                >
                    {loading && (
                        <li className="flex items-center gap-2 px-3 py-2 text-sm text-slate-500">
                            <Loader2 size={14} className="animate-spin" />
                            Searching
                        </li>
                    )}
                    {!loading && query.trim().length < 2 && (
                        <li className="px-3 py-2 text-sm text-slate-500">
                            Enter at least 2 characters
                        </li>
                    )}
                    {!loading && query.trim().length >= 2 && results.length === 0 && (
                        <li className="px-3 py-2 text-sm text-slate-500">No results</li>
                    )}
                    {!loading &&
                        results.map((m) => (
                            <li key={m.id} role="option" aria-selected={false}>
                                <button
                                    type="button"
                                    className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                                    onClick={() => {
                                        onChange(m);
                                        setQuery("");
                                        setOpen(false);
                                    }}
                                >
                                    <span className="font-medium text-slate-900">
                                        {labelFor(m)}
                                    </span>
                                    <span className="block text-xs text-slate-500">
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
