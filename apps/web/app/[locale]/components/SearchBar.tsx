"use client";
import React, {
    useCallback,
    useDeferredValue,
    useEffect,
    useRef,
    useState,
    useTransition,
} from "react";
import { Search, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useTranslations } from "next-intl";
import { fuzzyMatchBrand } from "@/lib/api";
import SearchSuggestions, { HistoryItem } from "@/components/SearchSuggestions";
import { escapePostgrest } from "@/lib/supabase/utils";

/** Maximum number of suggestions shown at once */
const MAX_SUGGESTIONS = 8;
/** Debounce delay in milliseconds */
const DEBOUNCE_MS = 250;

interface SearchBarProps {
    dark?: boolean;
    /** Optional callback to notify parent homepage of the active selected search keyword */
    onSearchChange?: (query: string) => void;
}

/**
 * SearchBar
 *
 * Self-contained search input with:
 * - 250 ms debounced Supabase suggestions (brand_name + batch_number)
 * - Keyboard navigation (↑ ↓ Enter Escape)
 * - Click-outside to close
 * - Selecting a suggestion navigates to the scan/verify flow & triggers home safety view
 */
export default function SearchBar({ dark = false, onSearchChange }: SearchBarProps) {
    const tHome = useTranslations("Home");

    // ── State ──────────────────────────────────────────────────────────────────
    const [error, setError] = useState<string | null>(null);
    const [noResults, setNoResults] = useState(false);
    const [query, setQuery] = useState<string>("");
    const deferredQuery = useDeferredValue(query);
    const trimmedQuery = query.trim();
    const deferredTrimmedQuery = deferredQuery.trim();
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [activeIndex, setActiveIndex] = useState<number>(-1);

    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [, startTransition] = useTransition();

    // Search History State
    const [history, setHistory] = useState<HistoryItem[]>([]);

    useEffect(() => {
        try {
            const stored = localStorage.getItem("sahidawa_search_history");
            if (stored) {
                setHistory(JSON.parse(stored));
            }
        } catch (e) {
            console.error("Failed to access or parse search history:", e);
        }
    }, []);

    const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const persistHistory = useCallback((newHistory: HistoryItem[]) => {
        if (persistTimeoutRef.current) {
            clearTimeout(persistTimeoutRef.current);
        }
        persistTimeoutRef.current = setTimeout(() => {
            try {
                localStorage.setItem("sahidawa_search_history", JSON.stringify(newHistory));
            } catch (e) {
                console.warn("Failed to persist search history:", e);
            }
        }, 300);
    }, []);

    const addToHistory = useCallback(
        (searchQuery: string) => {
            const trimmed = searchQuery.trim();
            if (!trimmed) return;

            setHistory((prev) => {
                const filtered = prev.filter(
                    (item) => item.query.toLowerCase() !== trimmed.toLowerCase()
                );
                const existingItem = prev.find(
                    (item) => item.query.toLowerCase() === trimmed.toLowerCase()
                );
                const newItem: HistoryItem = {
                    query: existingItem ? existingItem.query : trimmed,
                    pinned: existingItem ? existingItem.pinned : false,
                    timestamp: Date.now(),
                };
                const sorted = [newItem, ...filtered];
                // Sort: pinned first, then by timestamp descending
                const sortedFinal = [...sorted]
                    .sort((a, b) => {
                        if (a.pinned && !b.pinned) return -1;
                        if (!a.pinned && b.pinned) return 1;
                        return b.timestamp - a.timestamp;
                    })
                    .slice(0, 20); // Limit to 20 items

                persistHistory(sortedFinal);
                return sortedFinal;
            });
        },
        [persistHistory]
    );

    const togglePin = useCallback(
        (searchQuery: string) => {
            setHistory((prev) => {
                const updated = prev.map((item) => {
                    if (item.query.toLowerCase() === searchQuery.toLowerCase()) {
                        return { ...item, pinned: !item.pinned };
                    }
                    return item;
                });
                const sortedFinal = [...updated].sort((a, b) => {
                    if (a.pinned && !b.pinned) return -1;
                    if (!a.pinned && b.pinned) return 1;
                    return b.timestamp - a.timestamp;
                });

                persistHistory(sortedFinal);
                return sortedFinal;
            });
        },
        [persistHistory]
    );

    const clearHistory = useCallback(() => {
        setHistory([]);
        localStorage.removeItem("sahidawa_search_history");
    }, []);

    // ── Delete a single history entry ──────────────────────────────────────────
    const deleteFromHistory = useCallback(
        (searchQuery: string) => {
            setHistory((prev) => {
                const updated = prev.filter(
                    (item) => item.query.toLowerCase() !== searchQuery.toLowerCase()
                );
                persistHistory(updated);
                return updated;
            });
        },
        [persistHistory]
    );

    // ── Refs ───────────────────────────────────────────────────────────────────
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    // ── Global keyboard shortcut (/) ──────────────────────────────────────────
    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if (
                e.key === "/" &&
                document.activeElement?.tagName !== "INPUT" &&
                document.activeElement?.tagName !== "TEXTAREA"
            ) {
                e.preventDefault();
                inputRef.current?.focus();
            }
        };

        window.addEventListener("keydown", handleGlobalKeyDown);
        return () => {
            window.removeEventListener("keydown", handleGlobalKeyDown);
        };
    }, []);

    // ── Close on click-outside ─────────────────────────────────────────────────
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setActiveIndex(-1);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // ── Fetch suggestions from Supabase (debounced) ────────────────────────────
    const fetchSuggestions = useCallback(async (trimmed: string) => {
        setError(null);
        setNoResults(false);

        if (!trimmed) {
            setSuggestions([]);
            setIsOpen(false);
            setIsLoading(false);
            return;
        }

        if (typeof window !== "undefined" && !window.navigator.onLine) {
            setSuggestions([]);
            setIsOpen(false);
            setIsLoading(false);
            return;
        }

        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        const controller = new AbortController();
        abortControllerRef.current = controller;
        setIsLoading(true);

        try {
            let useFallback = false;
            let data: { brand_name: string | null; batch_number: string | null }[] | null = null;

            try {
                const response = await supabase
                    .from("medicines")
                    .select("brand_name, batch_number")
                    .or(
                        `brand_name.ilike."%${escapePostgrest(trimmed)}%",batch_number.ilike."%${escapePostgrest(trimmed)}%"`
                    )
                    .abortSignal(controller.signal)
                    .limit(MAX_SUGGESTIONS);

                if (response.error) {
                    if (
                        response.error.message?.includes("Could not find the table") ||
                        response.error.code === "42P01"
                    ) {
                        console.warn(
                            "[SearchBar] Table missing. Dropping into local data fallback matrix."
                        );
                        useFallback = true;
                    } else if (
                        response.error.message?.includes("AbortError") ||
                        response.error.message?.includes("aborted")
                    ) {
                        // Request was cancelled by a newer keystroke — safe to ignore
                        return;
                    }
                    // Network errors — silently fall through to fuzzy matcher
                    if (
                        response.error.message?.includes("Failed to fetch") ||
                        response.error.message?.includes("NetworkError") ||
                        response.error.message?.includes("fetch")
                    ) {
                        console.warn(
                            "[SearchBar] Network error, trying fuzzy fallback:",
                            response.error.message
                        );
                        useFallback = true;
                    } else {
                        console.error("[SearchBar] Supabase error:", response.error.message);
                        setSuggestions([]);
                        setIsOpen(false);
                        return;
                    }
                } else {
                    data = response.data;
                }
            } catch (dbErr: any) {
                if (dbErr?.name === "AbortError" || dbErr?.message?.includes("aborted")) return;
                if (dbErr?.message?.includes("Could not find the table")) {
                    useFallback = true;
                } else {
                    throw dbErr;
                }
            }

            if (controller.signal.aborted) return;

            const seen = new Set<string>();
            const results: string[] = [];

            // ── CASE A: Database Operational ─────────────────────────────────────
            if (!useFallback && data && data.length > 0) {
                for (const row of data) {
                    const candidates = [row.brand_name, row.batch_number];
                    for (const c of candidates) {
                        if (c && c.toLowerCase().includes(trimmed.toLowerCase()) && !seen.has(c)) {
                            seen.add(c);
                            results.push(c);
                            if (results.length >= MAX_SUGGESTIONS) break;
                        }
                    }
                    if (results.length >= MAX_SUGGESTIONS) break;
                }
            }
            // ── CASE B: Failover to UI Validation Testing Pool ────────────────────
            else if (useFallback) {
                const mockMedicinesPool = [
                    { brand_name: "Paracetamol", batch_number: "BATCH-PR750" },
                    { brand_name: "Peracetamol (Fuzzy Match)", batch_number: "BATCH-PR750" },
                    { brand_name: "Crocin Advance", batch_number: "BATCH-CR100" },
                    { brand_name: "Amoxicillin", batch_number: "BATCH-AM250" },
                    { brand_name: "Calpol 650", batch_number: "BATCH-CP650" },
                    { brand_name: "Dolo 650", batch_number: "BATCH-DL650" },
                    { brand_name: "Ibuprofen", batch_number: "BATCH-IB400" },
                    { brand_name: "Cetirizine", batch_number: "BATCH-CT10" },
                    { brand_name: "Azithromycin", batch_number: "BATCH-AZ500" },
                ];

                for (const item of mockMedicinesPool) {
                    const candidates = [item.brand_name, item.batch_number];
                    for (const c of candidates) {
                        if (c && c.toLowerCase().includes(trimmed.toLowerCase()) && !seen.has(c)) {
                            seen.add(c);
                            results.push(c);
                            if (results.length >= MAX_SUGGESTIONS) break;
                        }
                    }
                    if (results.length >= MAX_SUGGESTIONS) break;
                }
            }

            // Run local fuzzy matcher if database is working but returns no rows
            if (!useFallback && results.length < 3) {
                try {
                    const fuzzyResults = await fuzzyMatchBrand(trimmed, controller.signal);
                    for (const match of fuzzyResults) {
                        if (match.name && !seen.has(match.name) && match.score >= 50) {
                            seen.add(match.name);
                            results.push(match.name);
                            if (results.length >= MAX_SUGGESTIONS) break;
                        }
                    }
                } catch (fuzzyErr) {
                    console.warn("[SearchBar] Fuzzy matching fallback error:", fuzzyErr);
                }
            }

            setSuggestions(results);
            setNoResults(results.length === 0);
            setIsOpen(true);
            setActiveIndex(-1);
        } catch (err) {
            if (err instanceof Error && err.name === "AbortError") return;
            console.error("[SearchBar] Unexpected error fetching suggestions:", err);
            setSuggestions([]);
            setError("Unable to fetch medicine suggestions.");
            setIsOpen(true);
        } finally {
            if (!controller.signal.aborted) {
                setIsLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }

        if (!trimmedQuery) {
            setSuggestions([]);
            setIsLoading(false);
            setNoResults(false);
            setError(null);
            onSearchChange?.("");
            return;
        }

        debounceTimer.current = setTimeout(() => {
            fetchSuggestions(deferredTrimmedQuery);
        }, DEBOUNCE_MS);

        return () => {
            if (debounceTimer.current) {
                clearTimeout(debounceTimer.current);
            }
            abortControllerRef.current?.abort();
        };
    }, [trimmedQuery, deferredTrimmedQuery, fetchSuggestions, onSearchChange]);

    // ── Select a suggestion ────────────────────────────────────────────────────
    const selectSuggestion = useCallback(
        (value: string) => {
            setQuery(value);
            setIsOpen(false);
            setActiveIndex(-1);
            addToHistory(value);
            if (onSearchChange) onSearchChange(value);
        },
        [onSearchChange, addToHistory]
    );

    // ── Perform search (Enter without active suggestion, or Search button) ─────
    const performSearch = useCallback(
        (value: string) => {
            const trimmed = value.trim();
            if (!trimmed) return;
            setIsOpen(false);
            setActiveIndex(-1);
            addToHistory(trimmed);
            if (onSearchChange) onSearchChange(trimmed);
        },
        [onSearchChange, addToHistory]
    );

    const isHistoryMode = deferredTrimmedQuery === "";
    const listLength = isHistoryMode ? history.length : suggestions.length;

    // ── Keyboard navigation ────────────────────────────────────────────────────
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!isOpen && e.key !== "Enter") return;
        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                setActiveIndex((prev) => (prev < listLength - 1 ? prev + 1 : 0));
                break;
            case "ArrowUp":
                e.preventDefault();
                setActiveIndex((prev) => (prev > 0 ? prev - 1 : listLength - 1));
                break;
            case "Enter":
                e.preventDefault();
                if (activeIndex >= 0 && activeIndex < listLength) {
                    if (isHistoryMode) {
                        selectSuggestion(history[activeIndex].query);
                    } else {
                        selectSuggestion(suggestions[activeIndex]);
                    }
                } else {
                    performSearch(query);
                }
                break;
            case "Escape":
                e.preventDefault();
                setIsOpen(false);
                setActiveIndex(-1);
                inputRef.current?.blur();
                break;
            default:
                break;
        }
    };

    // ── Input change ───────────────────────────────────────────────────────────
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setQuery(e.target.value);
        startTransition(() => setActiveIndex(-1));
    };

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <div ref={containerRef} className="relative w-full">
            <div
                className={`relative rounded-2xl border transition-all duration-300 ease-out ${
                    dark
                        ? isOpen
                            ? "border-emerald-500 bg-[#16222f] shadow-md ring-1 shadow-emerald-950/20 ring-emerald-500"
                            : "border-slate-800 bg-[#16222f] hover:border-slate-700"
                        : isOpen
                          ? "border-emerald-500 bg-white shadow-md ring-1 shadow-emerald-50/50 ring-emerald-500 dark:border-emerald-500 dark:bg-slate-900 dark:shadow-none dark:ring-emerald-500"
                          : "border-slate-200 bg-white shadow-sm hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
                }`}
            >
                <div className="flex items-center gap-2 p-1.5 pl-3 sm:gap-3 sm:p-2 sm:pl-4">
                    <Search
                        className={`shrink-0 transition-all duration-300 ${
                            isLoading
                                ? "scale-110 animate-pulse text-emerald-400"
                                : dark
                                  ? "text-slate-500"
                                  : "text-slate-400 dark:text-slate-500"
                        }`}
                        size={20}
                        aria-hidden="true"
                    />
                    <input
                        ref={inputRef}
                        id="global-search-input"
                        type="text"
                        role="combobox"
                        aria-autocomplete="list"
                        aria-controls="search-suggestions-listbox"
                        aria-activedescendant={
                            activeIndex >= 0 ? `search-suggestion-${activeIndex}` : undefined
                        }
                        aria-expanded={isOpen}
                        autoComplete="off"
                        value={query}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        onFocus={() => setIsOpen(true)}
                        placeholder={tHome("search_placeholder")}
                        className={`w-full border-none bg-transparent py-1 text-sm font-medium outline-none sm:text-base ${
                            dark
                                ? "text-slate-100 placeholder:text-slate-500"
                                : "text-slate-800 placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
                        }`}
                        aria-label={tHome("search_input_aria")}
                    />

                    {/* ── Clear (X) button — only when input has text ── */}
                    {query.length > 0 && (
                        <button
                            type="button"
                            onClick={() => {
                                setQuery("");
                                setActiveIndex(-1);
                                setSuggestions([]);
                                setIsOpen(false);
                                onSearchChange?.("");
                                inputRef.current?.focus();
                            }}
                            aria-label={tHome("clear_search")}
                            className={`shrink-0 rounded-full p-1 transition-colors duration-150 ${
                                dark
                                    ? "text-slate-500 hover:bg-slate-700 hover:text-slate-300"
                                    : "text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                            }`}
                        >
                            <X size={16} aria-hidden="true" />
                        </button>
                    )}

                    {/* / shortcut hint — only when input is empty and dropdown closed */}
                    {!isOpen && !query && (
                        <div className="hidden items-center pr-2 sm:flex">
                            <kbd className="pointer-events-none inline-flex h-5 items-center rounded border border-slate-200 bg-slate-50 px-1.5 font-sans text-xs font-medium text-slate-400 select-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500">
                                /
                            </kbd>
                        </div>
                    )}

                    <button
                        onClick={() => performSearch(query)}
                        className="flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl bg-linear-to-r from-emerald-500 to-teal-500 p-2.5 text-sm font-bold text-white shadow-md shadow-emerald-500/25 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-xl hover:shadow-emerald-500/30 active:scale-95 sm:px-5 sm:py-2.5"
                        aria-label={tHome("submit_search")}
                    >
                        <Search size={16} aria-hidden="true" />
                        <span className="hidden sm:inline">{tHome("search_button")}</span>
                    </button>
                </div>
            </div>

            {/* Suggestions dropdown */}
            <SearchSuggestions
                suggestions={suggestions}
                activeIndex={activeIndex}
                onSelect={selectSuggestion}
                visible={isOpen}
                isLoading={isLoading}
                error={error}
                noResults={noResults}
                onRetry={() => fetchSuggestions(query.trim())}
                isHistory={isHistoryMode}
                historyItems={history}
                onPinToggle={togglePin}
                onClearHistory={clearHistory}
                onDeleteItem={deleteFromHistory}
                query={deferredTrimmedQuery}
            />
        </div>
    );
}
