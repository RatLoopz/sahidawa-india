"use client";

import { useState, useEffect } from "react";
import { Search, X } from "lucide-react";

const STORAGE_KEY = "sahidawa_search_history";
const MAX_HISTORY = 5;

interface SearchBarProps {
    onSearch: (query: string) => void;
    placeholder?: string;
}

export function SearchBar({ onSearch, placeholder = "Enter batch number" }: SearchBarProps) {
    const [query, setQuery] = useState("");
    const [history, setHistory] = useState<string[]>([]);

    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) setHistory(JSON.parse(stored));
    }, []);

    const pushToHistory = (value: string) => {
        const updated = [value, ...history.filter((h) => h !== value)].slice(0, MAX_HISTORY);
        setHistory(updated);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;
        pushToHistory(query.trim());
        onSearch(query.trim());
    };

    const handleChipClick = (item: string) => {
        setQuery(item);
        onSearch(item);
    };

    const clearHistory = () => {
        setHistory([]);
        localStorage.removeItem(STORAGE_KEY);
    };

    return (
        <div className="flex w-full max-w-sm flex-col gap-2">
            <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={placeholder}
                    className="flex-1 rounded-full border border-white/20 bg-white/10 px-4 py-3 text-sm font-medium text-white placeholder-white/40 focus:border-transparent focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                <button
                    type="submit"
                    className="flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-3 text-sm font-bold text-white shadow-lg transition-colors hover:bg-emerald-400"
                >
                    <Search size={18} />
                    Verify
                </button>
            </form>

            {history.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                    {history.map((item) => (
                        <button
                            key={item}
                            onClick={() => handleChipClick(item)}
                            className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white/70 transition-colors hover:bg-white/20 hover:text-white"
                        >
                            {item}
                        </button>
                    ))}
                    <button
                        onClick={clearHistory}
                        className="flex items-center gap-1 rounded-full px-2 py-1 text-xs text-white/40 transition-colors hover:text-red-400"
                    >
                        <X size={12} />
                        Clear
                    </button>
                </div>
            )}
        </div>
    );
}