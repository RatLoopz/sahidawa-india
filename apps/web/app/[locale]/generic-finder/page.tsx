"use client";

import { useState } from "react";
import { AlternativeCard } from "@/components/medicines/AlternativeCard";

interface Alternative {
    name: string;
    manufacturer: string;
    price: number;
    savingsPercent: number | null;
}

export default function GenericFinderPage() {
    const [query, setQuery] = useState("");
    const [salt, setSalt] = useState<string | null>(null);
    const [alternatives, setAlternatives] = useState<Alternative[]>([]);
    const [loading, setLoading] = useState(false);

    async function handleSearch(e: React.FormEvent) {
        e.preventDefault();
        if (!query.trim()) return;
        setLoading(true);
        try {
            const res = await fetch(
                `/api/v1/medicines/alternatives?query=${encodeURIComponent(query)}`
            );
            const data = await res.json();
            setSalt(data.salt);
            setAlternatives(data.alternatives ?? []);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="mx-auto max-w-xl p-6">
            <h1 className="mb-4 text-2xl font-semibold">Generic Alternative & Cost Saver</h1>
            <form onSubmit={handleSearch} className="mb-6 flex gap-2">
                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Enter branded medicine name (e.g. Augmentin)"
                    className="flex-1 rounded-md border px-3 py-2"
                />
                <button type="submit" className="bg-primary rounded-md px-4 py-2 text-white">
                    Search
                </button>
            </form>

            {loading && <p>Searching...</p>}

            {!loading && salt && (
                <p className="text-muted-foreground mb-3 text-sm">Salt composition: {salt}</p>
            )}

            {!loading && salt && alternatives.length === 0 && (
                <p className="text-muted-foreground text-sm">No generic alternatives found yet.</p>
            )}

            <div className="space-y-3">
                {alternatives.map((alt) => (
                    <AlternativeCard key={alt.name} {...alt} />
                ))}
            </div>

            {alternatives.length > 0 && (
                <p className="text-muted-foreground mt-6 text-xs">
                    ⚠️ Please consult your doctor before switching medications.
                </p>
            )}
        </div>
    );
}
