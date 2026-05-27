"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useTranslations } from "next-intl";
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
export default function SearchBar() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const tHome = useTranslations("Home");
  // ── State ──────────────────────────────────────────────────────────────────
  const [query, setQuery] = useState<string>("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  // ── Refs ───────────────────────────────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  // ── Close on click-outside ─────────────────────────────────────────────────
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  // ── Fetch suggestions from Supabase (debounced) ────────────────────────────
  const fetchSuggestions = useCallback(async (trimmed: string) => {
    if (!trimmed) {
      setSuggestions([]);
      setIsOpen(false);
      setIsLoading(false);
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
        .or(
          `brand_name.ilike.%${trimmed}%,batch_number.ilike.%${trimmed}%`
        )
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
      if (!data || data.length === 0) {
        setSuggestions([]);
        setIsOpen(false);
        return;
      }
      // Deduplicate and build a flat list of relevant strings.
      const seen = new Set<string>();
      const results: string[] = [];
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
      setSuggestions(results);
      setActiveIndex(-1);
      setIsOpen(results.length > 0);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        // Silently ignore aborted suggestions queries
        return;
      }
      console.error("[SearchBar] Unexpected error fetching suggestions:", err);
      setSuggestions([]);
      setIsOpen(false);
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
        setActiveIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
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
    <div
      ref={containerRef}
      className="relative mt-8 rounded-[3rem] border border-slate-200 bg-white p-4 shadow-sm transition-all duration-300 focus-within:scale-[1.005] focus-within:border-emerald-500/30 focus-within:shadow-md focus-within:ring-4 focus-within:ring-emerald-500/10"
    >
      <div className="flex items-center gap-2 px-2 sm:gap-4">
        {/* Search icon — shows a subtle spinner while fetching */}
        <Search
          className={`ml-2 shrink-0 transition-colors ${
            isLoading ? "animate-pulse text-emerald-400" : "text-slate-400"
          }`}
          size={24}
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
            if (suggestions.length > 0) setIsOpen(true);
          }}
          placeholder={tHome("search_placeholder")}
          className="w-full border-none bg-transparent px-4 py-3 font-medium text-slate-700 outline-none placeholder:text-slate-400"
          aria-label="Search medicine or batch"
        />
        <button
          onClick={() => performSearch(query)}
          className="shrink-0 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-slate-800 active:scale-95 sm:px-6 sm:text-base"
          aria-label="Submit search"
        >
          {tHome("search_button")}
        </button>
      </div>
      {/* Suggestions dropdown */}
      <SearchSuggestions
        suggestions={suggestions}
        activeIndex={activeIndex}
        onSelect={selectSuggestion}
        visible={isOpen}
      />
    </div>
  );
}
