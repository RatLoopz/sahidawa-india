"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useTranslations } from "next-intl";
import { fuzzyMatchBrand } from "@/lib/api";
import SearchSuggestions from "@/components/SearchSuggestions";
/** Maximum number of suggestions shown at once */
const MAX_SUGGESTIONS = 8;
/** Debounce delay in milliseconds */
const DEBOUNCE_MS = 250;
/**
 * SearchBar
 *
 * Self-contained search input with:
 *  - 250 ms debounced Supabase suggestions (brand_name + batch_number)
 *  - Keyboard navigation (↑ ↓ Enter Escape)
 *  - Click-outside to close
 *  - Selecting a suggestion navigates to the scan/verify flow
 */
export default function SearchBar({ dark = false }: { dark?: boolean }) {
    const router = useRouter();
    const params = useParams();
    const locale = params.locale as string;
    const tHome = useTranslations("Home");
    // ── State ──────────────────────────────────────────────────────────────────
    const [error, setError] = useState<string | null>(null);
    const [noResults, setNoResults] = useState(false);
    const [query, setQuery] = useState<string>("");
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [activeIndex, setActiveIndex] = useState<number>(-1);

    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    // ── Refs ───────────────────────────────────────────────────────────────────D
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
            setError(null);
            setNoResults(false);
            return;
        }
        // Check if offline
        if (typeof window !== "undefined" && !window.navigator.onLine) {
            setSuggestions([]);
            setIsOpen(false);
            setIsLoading(false);
            return;
        }
        // Abort previous suggestions request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        const controller = new AbortController();
        abortControllerRef.current = controller;
        setIsLoading(true);
        try {
            // Query both brand_name and batch_number columns for partial matches.
            const { data, error } = await supabase
                .from("medicines")
                .select("brand_name, batch_number")
                .or(`brand_name.ilike.%${trimmed}%,batch_number.ilike.%${trimmed}%`)
                .abortSignal(controller.signal)
                .limit(MAX_SUGGESTIONS);
            if (controller.signal.aborted) {
                return;
            }
            if (error) {
                console.error("[SearchBar] Supabase suggestion error:", error.message);
                setSuggestions([]);
                setIsOpen(false);
                return;
            }

            const seen = new Set<string>();
            const results: string[] = [];
            if (data && data.length > 0) {
                // Deduplicate and build a flat list of relevant strings.
                for (const row of data) {
                    const candidates = [
                        row.brand_name as string | null,
                        row.batch_number as string | null,
                    ];
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

            // Typo-tolerance: if we got few or no exact results, query fuzzy matching from the backend!
            if (results.length < 3) {
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
                    // Ignore fuzzy errors and stick with what we have
                    console.warn("[SearchBar] Fuzzy matching fallback error:", fuzzyErr);
                }
            }

            setSuggestions(results);
            if (results.length === 0) {
                setNoResults(true);
                setIsOpen(true);
            } else {
                setNoResults(false);
                setIsOpen(true);
            }
            setActiveIndex(-1);
        } catch (err) {
            if (err instanceof Error && err.name === "AbortError") {
                // Silently ignore aborted suggestions queries
                return;
            }
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
    // ── Debounce query changes ─────────────────────────────────────────────────
    useEffect(() => {
        const trimmed = query.trim();
        // Cancel any pending debounce
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        if (!trimmed) {
            setSuggestions([]);
            setIsOpen(false);
            setIsLoading(false);
            return;
        }
        debounceTimer.current = setTimeout(() => {
            fetchSuggestions(trimmed);
        }, DEBOUNCE_MS);
        // Cleanup on unmount or next effect run
        return () => {
            if (debounceTimer.current) clearTimeout(debounceTimer.current);
            if (abortControllerRef.current) abortControllerRef.current.abort();
        };
    }, [query, fetchSuggestions]);
    // ── Select a suggestion ────────────────────────────────────────────────────
    const selectSuggestion = useCallback(
        (value: string) => {
            setQuery(value);
            setIsOpen(false);
            setActiveIndex(-1);
            // Navigate to scan/verify page with the selected value as a query param.
            router.push(`/${locale}/scan?q=${encodeURIComponent(value)}`);
        },
        [locale, router]
    );
    // ── Perform search (Enter without active suggestion, or Search button) ─────
    const performSearch = useCallback(
        (value: string) => {
            const trimmed = value.trim();
            if (!trimmed) return;
            setIsOpen(false);
            setActiveIndex(-1);
            router.push(`/${locale}/scan?q=${encodeURIComponent(trimmed)}`);
        },
        [locale, router]
    );
    // ── Keyboard navigation ────────────────────────────────────────────────────
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!isOpen && e.key !== "Enter") return;
        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                setActiveIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
                break;
            case "ArrowUp":
                e.preventDefault();
                setActiveIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
                break;
            case "Enter":
                e.preventDefault();
                if (activeIndex >= 0 && activeIndex < suggestions.length) {
                    selectSuggestion(suggestions[activeIndex]);
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
        // Reset active index on every keystroke
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
            />
        </div>
    );
}
