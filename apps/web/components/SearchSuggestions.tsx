"use client";

import React from "react";
import { Search } from "lucide-react";

export interface SearchSuggestionsProps {
  /** The list of suggestion strings to display */
  suggestions: string[];
  /** The index of the currently keyboard-highlighted suggestion (-1 = none) */
  activeIndex: number;
  /** Called when a suggestion is clicked or selected via keyboard */
  onSelect: (value: string) => void;
  /** Whether the dropdown should be visible */
  visible: boolean;
}

/**
 * SearchSuggestions
 *
 * A purely presentational dropdown list that appears below a search input.
 * It renders nothing when `visible` is false or `suggestions` is empty.
 *
 * Accessibility notes:
 *  - role="listbox" on the `<ul>` and role="option" on each `<li>`
 *  - aria-selected marks the active (keyboard-highlighted) item
 *  - id attributes are referenced by the parent input via aria-controls /
 *    aria-activedescendant (wired up in SearchBar)
 */
export default function SearchSuggestions({
  suggestions,
  activeIndex,
  onSelect,
  visible,
}: SearchSuggestionsProps) {
  if (!visible || suggestions.length === 0) return null;

  return (
    <ul
      id="search-suggestions-listbox"
      role="listbox"
      aria-label="Search suggestions"
      className="
        absolute left-0 right-0 top-full z-50
        mt-2 overflow-hidden rounded-2xl
        border border-slate-200 bg-white
        shadow-xl shadow-slate-200/60
        animate-in fade-in slide-in-from-top-2 duration-150
      "
    >
      {suggestions.map((suggestion, index) => {
        const isActive = index === activeIndex;
        return (
          <li
            key={`${suggestion}-${index}`}
            id={`search-suggestion-${index}`}
            role="option"
            aria-selected={isActive}
            onMouseDown={(e) => {
              // Use mousedown instead of click to fire before the input's
              // onBlur, which would otherwise close the list first.
              e.preventDefault();
              onSelect(suggestion);
            }}
            className={`
              flex cursor-pointer items-center gap-3 px-5 py-3
              text-sm font-medium transition-colors duration-100
              ${
                isActive
                  ? "bg-emerald-50 text-emerald-700"
                  : "text-slate-700 hover:bg-slate-50"
              }
              first:rounded-t-2xl last:rounded-b-2xl
            `}
          >
            <Search
              size={14}
              className={`shrink-0 ${isActive ? "text-emerald-500" : "text-slate-400"}`}
              aria-hidden="true"
            />
            {/* Preserve exact string; parent can highlight matched portion if needed */}
            <span className="truncate">{suggestion}</span>
          </li>
        );
      })}
    </ul>
  );
}
