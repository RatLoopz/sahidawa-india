"use client";

import { useCallback, useState } from "react";
import { Link } from "@/i18n/routing";
import { PageHeader } from "../components/PageHeader";
import ComparisonGrid, { type Medicine } from "@/src/components/ComparisonGrid";
import MedicineSearchSelect from "@/src/components/MedicineSearchSelect";
import { COMPARE_SELECT_FIELDS } from "@/src/lib/compareSelectFields";
import { supabase } from "@/lib/supabase";
import { mapMedicineRow } from "@/src/lib/mapMedicineRow";
import { useTranslations } from "next-intl";

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
    const t = useTranslations("ComparePage");

    return (
        <div className="min-h-screen bg-(--color-surface-muted) text-(--color-text-primary)">
            <PageHeader
                title={t("title")}
                subtitle={t("subtitle")}
                backHref="/"
                variant="light"
            />
            <main className="container mx-auto max-w-4xl space-y-6 px-4 py-8">
                <section className="rounded-xl border border-(--color-border-muted) bg-(--color-surface-page) p-5 transition-all duration-300 hover:border-emerald-500/20 hover:shadow-md">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <MedicineSearchSelect
                            label={t("first_medicine")}
                            value={medicine1}
                            onChange={setMedicine1}
                            onSearch={handleSearch}
                            placeholder={t("search_placeholder")}
                            copy={{
                                clearLabel: t("search.clear_label"),
                                enterAtLeastTwo: t("search.enter_at_least_two"),
                                noResults: t("search.no_results"),
                                searchingLabel: t("search.searching"),
                            }}
                        />
                        <MedicineSearchSelect
                            label={t("second_medicine")}
                            value={medicine2}
                            onChange={setMedicine2}
                            onSearch={handleSearch}
                            placeholder={t("search_placeholder")}
                            copy={{
                                clearLabel: t("search.clear_label"),
                                enterAtLeastTwo: t("search.enter_at_least_two"),
                                noResults: t("search.no_results"),
                                searchingLabel: t("search.searching"),
                            }}
                        />
                    </div>
                </section>
                <ComparisonGrid
                    medicine1={medicine1}
                    medicine2={medicine2}
                    copy={{
                        approved: t("grid.approved"),
                        banned: t("grid.banned"),
                        brand: t("grid.brand"),
                        brandName: t("grid.brand_name"),
                        cdscoStatus: t("grid.cdsco_status"),
                        composition: t("grid.composition"),
                        emptyState: t("grid.empty_state"),
                        expiryDate: t("grid.expiry_date"),
                        field: t("grid.field"),
                        generic: t("grid.generic"),
                        genericName: t("grid.generic_name"),
                        janAushadhiPrice: t("grid.jan_aushadhi_price"),
                        manufacturer: t("grid.manufacturer"),
                        marketPrice: t("grid.market_price"),
                        medicineA: t("grid.medicine_a"),
                        medicineB: t("grid.medicine_b"),
                        noSavings: t("grid.no_savings"),
                        priceUnavailable: t("grid.price_unavailable"),
                        recalled: t("grid.recalled"),
                        savingsVsMrp: t("grid.savings_vs_mrp"),
                        saveAmount: (amount, percent) =>
                            t("grid.save_amount", { amount, percent }),
                        type: t("grid.type"),
                    }}
                />
                <p className="text-center text-sm text-(--color-text-secondary)">
                    <Link
                        href="/map"
                        className="text-emerald-700 hover:underline dark:text-emerald-400"
                    >
                        {t("find_pharmacies")}
                    </Link>
                </p>
            </main>
        </div>
    );
}
