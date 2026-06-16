"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
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
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [activeIndex, setActiveIndex] = useState<number>(-1);

    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    // Search History State
    const [history, setHistory] = useState<HistoryItem[]>([]);

    useEffect(() => {
        const stored = localStorage.getItem("sahidawa_search_history");
        if (stored) {
            try {
                setHistory(JSON.parse(stored));
            } catch (e) {
                console.error("Failed to parse search history:", e);
            }
        }
    }, []);

    const addToHistory = useCallback((searchQuery: string) => {
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
                .slice(0, 10); // Limit to 10 items

            localStorage.setItem("sahidawa_search_history", JSON.stringify(sortedFinal));
            return sortedFinal;
        });
    }, []);

    const togglePin = useCallback((searchQuery: string) => {
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

            localStorage.setItem("sahidawa_search_history", JSON.stringify(sortedFinal));
            return sortedFinal;
        });
    }, []);

    const clearHistory = useCallback(() => {
        setHistory([]);
        localStorage.removeItem("sahidawa_search_history");
    }, []);

    // ── Refs ───────────────────────────────────────────────────────────────────
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

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
                    // If the table doesn't exist, Supabase returns a 42P01 error code or a specific message string
                    if (
                        response.error.message?.includes("Could not find the table") ||
                        response.error.code === "42P01"
                    ) {
                        console.warn(
                            "[SearchBar] Table missing. Dropping into local data fallback matrix."
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
                // Catch hard network failures or uncaught errors
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
                    { brand_name: "Peracetamol (Fuzzy Match)", batch_number: "BATCH-PR750" }, // Added typo insurance
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
        const trimmed = query.trim();

        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }

        if (!trimmed) {
            setSuggestions([]);
            setIsLoading(false);
            setNoResults(false);
            setError(null);
            onSearchChange?.("");
            return;
        }

        debounceTimer.current = setTimeout(() => {
            fetchSuggestions(trimmed);
        }, DEBOUNCE_MS);

        return () => {
            if (debounceTimer.current) {
                clearTimeout(debounceTimer.current);
            }
            abortControllerRef.current?.abort();
        };
    }, [query, fetchSuggestions, onSearchChange]);

    // ── Select a suggestion ────────────────────────────────────────────────────
    const selectSuggestion = useCallback(
        (value: string) => {
            setQuery(value);
            setIsOpen(false);
            setActiveIndex(-1);
            addToHistory(value);
            if (onSearchChange) onSearchChange(value); // Sync query to safety panel
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
            if (onSearchChange) onSearchChange(trimmed); // Sync query to safety panel
        },
        [onSearchChange, addToHistory]
    );

    const isHistoryMode = query.trim() === "";
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
        setActiveIndex(-1);
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
                        onFocus={() => {
                            setIsOpen(true);
                        }}
                        placeholder={tHome("search_placeholder")}
                        className={`w-full border-none bg-transparent py-1 text-sm font-medium outline-none sm:text-base ${
                            dark
                                ? "text-slate-100 placeholder:text-slate-500"
                                : "text-slate-800 placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
                        }`}
                        aria-label="Search medicine or batch"
                    />
                    <button
                        onClick={() => performSearch(query)}
                        className="flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl bg-linear-to-r from-emerald-500 to-teal-500 p-2.5 text-sm font-bold text-white shadow-md shadow-emerald-500/25 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-xl hover:shadow-emerald-500/30 active:scale-95 sm:px-5 sm:py-2.5"
                        aria-label="Submit search"
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
                isHistory={query.trim() === ""}
                historyItems={history}
                onPinToggle={togglePin}
                onClearHistory={clearHistory}
                query={query.trim()}
            />
        </div>
    );
}
