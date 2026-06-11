"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { PageHeader } from "../components/PageHeader";
import ComparisonGrid, {
    type ComparisonGridLabels,
    type Medicine,
} from "@/src/components/ComparisonGrid";
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
        .or(`brand_name.ilike."${pattern}",generic_name.ilike."${pattern}"`)
        .limit(25);

    if (error) {
        console.error(error.message);
        return [];
    }
    return (data ?? []).map((row) => mapMedicineRow(row as Record<string, unknown>));
}

export default function ComparePage() {
    const t = useTranslations("Compare");
    const [medicine1, setMedicine1] = useState<Medicine | null>(null);
    const [medicine2, setMedicine2] = useState<Medicine | null>(null);
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);

        const m1 = params.get("m1");
        const m2 = params.get("m2");

        if (!m1 || !m2) return;

        const loadMedicines = async () => {
            const { data, error } = await supabase
                .from("medicines")
                .select(COMPARE_SELECT_FIELDS)
                .in("id", [m1, m2]);

            if (error || !data) return;

            const medicines = data.map((row) => mapMedicineRow(row as Record<string, unknown>));

            const first = medicines.find((m) => m.id === m1);
            const second = medicines.find((m) => m.id === m2);

            if (first) setMedicine1(first);
            if (second) setMedicine2(second);
        };

        loadMedicines();
    }, []);
    const handleSearch = useCallback((q: string) => searchMedicines(q), []);
    const comparisonLabels: ComparisonGridLabels = {
        emptyComparison: t("emptyComparison"),
        fieldHeader: t("fieldHeader"),
        medicineA: t("medicineA"),
        medicineB: t("medicineB"),
        priceUnavailable: t("priceUnavailable"),
        noSavings: t("noSavings"),
        saveAmount: (amount, percent) => t("saveAmount", { amount, percent }),
        rows: {
            brandName: t("rows.brandName"),
            genericName: t("rows.genericName"),
            composition: t("rows.composition"),
            manufacturer: t("rows.manufacturer"),
            type: t("rows.type"),
            cdscoStatus: t("rows.cdscoStatus"),
            expiryDate: t("rows.expiryDate"),
            marketPrice: t("rows.marketPrice"),
            janAushadhiPrice: t("rows.janAushadhiPrice"),
            savings: t("rows.savings"),
        },
        medicineTypes: {
            brand: t("medicineTypes.brand"),
            generic: t("medicineTypes.generic"),
        },
        status: {
            approved: t("status.approved"),
            recalled: t("status.recalled"),
            banned: t("status.banned"),
        },
    };

    return (
        <div className="min-h-screen bg-(--color-surface-muted) text-(--color-text-primary)">
            <div className="print:hidden">
                <PageHeader
                    title={t("pageTitle")}
                    subtitle={t("pageSubtitle")}
                    backHref="/"
                    variant="light"
                />
            </div>
            <div className="mb-6 hidden text-center print:block">
                <h1 className="text-2xl font-bold">{t("reportTitle")}</h1>

                <p className="text-sm">
                    {t("generatedOn", { date: new Date().toLocaleDateString() })}
                </p>
            </div>
            <main className="container mx-auto max-w-4xl space-y-6 px-4 py-8">
                <section className="rounded-xl border border-(--color-border-muted) bg-(--color-surface-page) p-5 transition-all duration-300 hover:border-emerald-500/20 hover:shadow-md print:hidden">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <MedicineSearchSelect
                            label={t("firstMedicine")}
                            value={medicine1}
                            onChange={setMedicine1}
                            onSearch={handleSearch}
                            placeholder={t("searchPlaceholder")}
                        />
                        <MedicineSearchSelect
                            label={t("secondMedicine")}
                            value={medicine2}
                            onChange={setMedicine2}
                            onSearch={handleSearch}
                            placeholder={t("searchPlaceholder")}
                        />
                    </div>
                </section>
                {medicine1 && medicine2 && (
                    <div className="flex justify-end">
                        <button
                            type="button"
                            onClick={() => window.print()}
                            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 print:hidden"
                        >
                            {t("printExport")}
                        </button>
                    </div>
                )}
                <ComparisonGrid
                    medicine1={medicine1}
                    medicine2={medicine2}
                    labels={comparisonLabels}
                />
                <p className="text-center text-sm text-(--color-text-secondary) print:hidden">
                    <Link
                        href="/map"
                        className="text-emerald-700 hover:underline dark:text-emerald-400"
                    >
                        {t("findPharmacies")}
                    </Link>
                </p>
            </main>
        </div>
    );
}
