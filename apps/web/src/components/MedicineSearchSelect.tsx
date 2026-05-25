"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, Search, X, AlertCircle, RotateCcw } from "lucide-react";
import type { Medicine } from "./ComparisonGrid";

type Props = {
  label: string;
  value: Medicine | null;
  onChange: (medicine: Medicine | null) => void;
  onSearch: (query: string) => Promise<Medicine[]>;
  placeholder?: string;
};

function labelFor(m: Medicine): string {
  return m.brand_name?.trim()
    ? `${m.brand_name} · ${m.generic_name}`
    : m.generic_name;
}

export default function MedicineSearchSelect({
  label,
  value,
  onChange,
  onSearch,
  placeholder = "Search brand or generic name",
}: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [lastQuery, setLastQuery] = useState<string>("");

  const handleSearch = async (q: string) => {
    // Abort any previous ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError("");
    setLastQuery(q);

    try {
      // Create a promise that rejects if aborted
      const searchPromise = onSearch(q);
      const results = await Promise.race([
        searchPromise,
        new Promise<Medicine[]>((_, reject) =>
          controller.signal.addEventListener("abort", () =>
            reject(new Error("Request cancelled"))
          )
        ),
      ]);
      setResults(results);
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "Request cancelled") {
        // Request was cancelled, don't show error
        return;
      }
      const errorMessage =
        err instanceof Error ? err.message : "Failed to search medicines";
      setError(errorMessage);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    if (lastQuery) {
      handleSearch(lastQuery);
    }
  };

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setError("");
      return;
    }
    const t = setTimeout(() => {
      handleSearch(q);
    }, 300);
    return () => {
      clearTimeout(t);
    };
  }, [query, open]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setOpen(true);
  };

  const handleSelectMedicine = (m: Medicine) => {
    onChange(m);
    setQuery("");
    setOpen(false);
    setError("");
  };

  return (
    <div ref={rootRef} className="relative w-full">
      <label className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>

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
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
            size={16}
          />
          <input
            type="search"
            value={query}
            onChange={handleInputChange}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
            aria-expanded={open}
            aria-controls={listId}
            autoComplete="off"
          />
        </div>
      )}

      {open && !value && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-52 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {loading && (
            <li className="flex items-center gap-2 px-3 py-3 text-sm text-slate-500">
              <Loader2 size={14} className="animate-spin" />
              Searching medicines...
            </li>
          )}

          {!loading && error && (
            <li className="px-3 py-3">
              <div className="flex items-start gap-2 rounded-md bg-red-50 p-3">
                <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-900">{error}</p>
                  <button
                    type="button"
                    onClick={handleRetry}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-red-700 hover:text-red-900 transition-colors"
                  >
                    <RotateCcw size={12} />
                    Try again
                  </button>
                </div>
              </div>
            </li>
          )}

          {!loading && query.trim().length < 2 && !error && (
            <li className="px-3 py-2 text-sm text-slate-500">
              Enter at least 2 characters
            </li>
          )}

          {!loading && query.trim().length >= 2 && results.length === 0 && !error && (
            <li className="px-3 py-3">
              <div className="rounded-md bg-slate-50 p-3 text-center">
                <p className="text-sm font-medium text-slate-700">
                  No medicines found
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Try a different brand or generic name
                </p>
              </div>
            </li>
          )}

          {!loading &&
            results.map((m) => (
              <li key={m.id} role="option">
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 transition-colors"
                  onClick={() => handleSelectMedicine(m)}
                >
                  <span className="font-medium text-slate-900">{labelFor(m)}</span>
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