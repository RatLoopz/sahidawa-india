"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
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
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(false);

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
        setResults(await onSearch(q));
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, open, onSearch]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

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
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
            aria-expanded={open}
            aria-controls={open && !value ? listId : undefined}
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
              <li key={m.id} role="option">
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                  onClick={() => {
                    onChange(m);
                    setQuery("");
                    setOpen(false);
                  }}
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