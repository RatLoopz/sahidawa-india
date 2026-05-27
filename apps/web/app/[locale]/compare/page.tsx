"use client";

import { useCallback, useState } from "react";
import { Link } from "@/i18n/routing";
import { PageHeader } from "../components/PageHeader";
import ComparisonGrid, { type Medicine } from "@/src/components/ComparisonGrid";
import MedicineSearchSelect from "@/src/components/MedicineSearchSelect";
import { COMPARE_SELECT_FIELDS } from "@/src/lib/compareSelectFields";
import { supabase } from "@/lib/supabase";
import { mapMedicineRow } from "@/src/lib/mapMedicineRow";

async function searchMedicines(query: string): Promise<Medicine[]> {
    const q = query.trim();
    if (q.length < 2) return [];

    const pattern = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
    const { data, error } = await supabase
        .from("medicines")
        .select(COMPARE_SELECT_FIELDS)
        .or(`brand_name.ilike.${pattern},generic_name.ilike.${pattern}`)
        .limit(25);

    if (error) {
        console.error(error.message);
        return [];
    }
    return (data ?? []).map((row) => mapMedicineRow(row as Record<string, unknown>));
}

export default function ComparePage() {
    const [medicine1, setMedicine1] = useState<Medicine | null>(null);
    const [medicine2, setMedicine2] = useState<Medicine | null>(null);
    const handleSearch = useCallback((q: string) => searchMedicines(q), []);

    return (
        <div className="min-h-screen bg-(--color-surface-muted) text-(--color-text-primary)">
            <PageHeader
                title="Compare medicines"
                subtitle="Brand vs generic side by side"
                backHref="/"
                variant="light"
            />
            <main className="container mx-auto max-w-4xl space-y-6 px-4 py-8">
                <section className="rounded-xl border border-(--color-border-muted) bg-(--color-surface-page) p-5 transition-all duration-300 hover:border-emerald-500/20 hover:shadow-md">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <MedicineSearchSelect
                            label="First medicine"
                            value={medicine1}
                            onChange={setMedicine1}
                            onSearch={handleSearch}
                        />
                        <MedicineSearchSelect
                            label="Second medicine"
                            value={medicine2}
                            onChange={setMedicine2}
                            onSearch={handleSearch}
                        />
                    </div>
                </section>
                <ComparisonGrid medicine1={medicine1} medicine2={medicine2} />
                <p className="text-center text-sm text-(--color-text-secondary)">
                    <Link
                        href="/map"
                        className="text-emerald-700 hover:underline dark:text-emerald-400"
                    >
                        Find pharmacies
                    </Link>
                </p>
            </main>
        </div>
    );
}
