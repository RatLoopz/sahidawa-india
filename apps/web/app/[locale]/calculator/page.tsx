"use client";

import { useState, useCallback, useEffect, Suspense, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "../components/PageHeader";
import MedicineSearchSelect from "@/src/components/MedicineSearchSelect";
import { fetchGenericAlternatives, type GenericAlternative } from "@/lib/api/alternatives";
import { supabase } from "@/lib/supabase";
import { escapePostgrest } from "@/lib/supabase/utils";
import type { Medicine } from "@/src/components/ComparisonGrid";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { Pill, AlertCircle, DollarSign, Calendar, MapPin, ArrowRight } from "lucide-react";
// NEW: Import the card and skeleton
import GenericAlternativeCard from "@/components/GenericAlternativeCard";
import GenericAlternativeCardSkeleton from "@/components/GenericAlternativeCardSkeleton";

async function searchMedicines(query: string): Promise<Medicine[]> {
    const q = query.trim();
    if (q.length < 2) return [];

    try {
        const res = await fetch(`/api/medicines/search?q=${encodeURIComponent(q)}`);
        if (!res.ok) {
            throw new Error("Failed to fetch medicines from API");
        }

        const data = await res.json();

        return (data ?? []).map((row: any) => ({
            id: row.id,
            brand_name: row.brand_name,
            generic_name: row.generic_name,
            manufacturer: row.manufacturer,
            mrp: row.mrp,
            jan_aushadhi_price: row.jan_aushadhi_price,
            composition: row.composition,
            cdsco_approval_status: row.cdsco_approval_status || "approved",
        }));
    } catch (error: any) {
        console.error(error.message || error);
        return [];
    }
}

function CalculatorPageContent() {
    const translate = useTranslations("Calculator");
    const router = useRouter();
    const params = useParams();
    const locale = Array.isArray(params.locale) ? params.locale[0] : params.locale || "en";

    const [selectedMedicine, setSelectedMedicine] = useState<Medicine | null>(null);
    const [alternativeData, setAlternativeData] = useState<GenericAlternative | null>(null);
    const [genericAlternative, setGenericAlternative] = useState<{
        brand_name: string;
        manufacturer: string;
        mrp: number;
        isEstimated: boolean;
    } | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [quantity, setQuantity] = useState<number>(1);

    const searchParams = useSearchParams();
    const medicineId = searchParams?.get("medicineId");

    const handleFindStore = useCallback(() => {
        if (alternativeData?.nearest_store) {
            const { name, lat, lng } = alternativeData.nearest_store;
            router.push(
                `/${locale}/map?filter=govt&lat=${lat}&lng=${lng}&query=${encodeURIComponent(name)}`
            );
        }
    }, [alternativeData, locale, router]);

    const handleButtonKeyDown = useCallback(
        (event: KeyboardEvent<HTMLButtonElement>, action: () => void) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                action();
            }
        },
        []
    );

    const handleSearch = useCallback((q: string) => searchMedicines(q), []);

    const handleMedicineChange = useCallback(
        async (medicine: Medicine | null) => {
            setSelectedMedicine(medicine);
            setAlternativeData(null);
            setGenericAlternative(null);
            setError(null);
            setQuantity(1);

            if (!medicine) return;

            setLoading(true);
            try {
                let lat: number | undefined;
                let lng: number | undefined;

                if (navigator.geolocation) {
                    await new Promise<void>((resolve) => {
                        navigator.geolocation.getCurrentPosition(
                            (position) => {
                                lat = position.coords.latitude;
                                lng = position.coords.longitude;
                                resolve();
                            },
                            () => {
                                resolve();
                            },
                            { timeout: 3000 }
                        );
                    });
                }

                const data = await fetchGenericAlternatives(medicine.id, lat, lng);
                setAlternativeData(data);

                // Fetch related generic alternatives (same generic composition, not current brand, not Jan Aushadhi)
                const { data: genericAlts } = await supabase
                    .from("medicines")
                    .select("id, brand_name, generic_name, manufacturer, mrp")
                    .eq("generic_name", medicine.generic_name)
                    .neq("id", medicine.id)
                    .not("manufacturer", "ilike", "Jan Aushadhi")
                    .not("brand_name", "ilike", "%generic%")
                    .not("mrp", "is", null)
                    .order("mrp", { ascending: true })
                    .limit(1);

                if (genericAlts && genericAlts.length > 0) {
                    setGenericAlternative({
                        brand_name: genericAlts[0].brand_name || medicine.generic_name,
                        manufacturer: genericAlts[0].manufacturer || "Alternative Manufacturer",
                        mrp: Number(genericAlts[0].mrp),
                        isEstimated: false,
                    });
                } else {
                    setGenericAlternative({
                        brand_name: `${medicine.generic_name} (Commercial)`,
                        manufacturer: "Commercial Generic",
                        mrp: Number((medicine.mrp || 120.0) * 0.6),
                        isEstimated: true,
                    });
                }
            } catch (err) {
                console.error("Failed to fetch alternatives:", err);
                setError(translate("error"));
            } finally {
                setLoading(false);
            }
        },
        [translate]
    );

    useEffect(() => {
        if (!medicineId) return;

        let active = true;
        setLoading(true);
        setError(null);

        const loadMedicine = async () => {
            try {
                const { data, error: dbError } = await supabase
                    .from("medicines")
                    .select(
                        "id, brand_name, generic_name, manufacturer, mrp, jan_aushadhi_price, composition, cdsco_approval_status"
                    )
                    .eq("id", medicineId)
                    .limit(1)
                    .maybeSingle();

                if (!active) return;

                if (dbError) {
                    console.error("Database query failed:", dbError);
                    setError(translate("error"));
                    setLoading(false);
                    return;
                }
                if (!data) {
                    setError("Medicine not found.");
                    setLoading(false);
                    return;
                }
                const med: Medicine = {
                    id: data.id,
                    brand_name: data.brand_name || "",
                    generic_name: data.generic_name || "",
                    manufacturer: data.manufacturer || "",
                    mrp: data.mrp ? Number(data.mrp) : 0,
                    jan_aushadhi_price: data.jan_aushadhi_price
                        ? Number(data.jan_aushadhi_price)
                        : 0,
                    composition: data.composition || "",
                    cdsco_approval_status: data.cdsco_approval_status || "approved",
                };
                handleMedicineChange(med);
            } catch (err) {
                if (!active) return;
                console.error("Unexpected error loading medicine:", err);
                setError(translate("error"));
                setLoading(false);
            }
        };

        loadMedicine();

        return () => {
            active = false;
        };
    }, [medicineId, handleMedicineChange, translate]);

    // Savings calculations
    const brandPrice = alternativeData?.brand_price ?? selectedMedicine?.mrp ?? 0;
    const janAushadhiPrice =
        alternativeData?.jan_aushadhi_price ?? selectedMedicine?.jan_aushadhi_price ?? 0;
    const genericPrice = genericAlternative?.mrp ?? brandPrice * 0.6;

    const savingsPerPurchase = brandPrice > janAushadhiPrice ? brandPrice - janAushadhiPrice : 0;
    const brandMonthlyCost = brandPrice * quantity;
    const genericMonthlyCost = genericPrice * quantity;
    const janAushadhiMonthlyCost = janAushadhiPrice * quantity;
    const monthlySavings = savingsPerPurchase * quantity;
    const yearlySavings = monthlySavings * 12;

    return (
        <div className="min-h-screen bg-(--color-surface-muted) text-(--color-text-primary)">
            <PageHeader
                title={translate("pageTitle")}
                subtitle={translate("pageSubtitle")}
                backHref="/"
                variant="light"
            />
            <main className="container mx-auto max-w-2xl space-y-6 px-4 py-8">
                {/* Search Panel */}
                <section className="rounded-2xl border border-(--color-border-muted) bg-(--color-surface-page) p-6 shadow-sm">
                    <MedicineSearchSelect
                        label={translate("searchLabel")}
                        value={selectedMedicine}
                        onChange={handleMedicineChange}
                        onSearch={handleSearch}
                        placeholder={translate("searchPlaceholder")}
                    />
                </section>

                {error && (
                    <div className="flex items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-red-700 dark:text-red-400">
                        <AlertCircle size={20} className="shrink-0" />
                        <p className="text-sm font-semibold">{error}</p>
                    </div>
                )}

                {!loading && selectedMedicine && alternativeData && (
                    <div className="animate-in fade-in space-y-6 duration-200">
                        {/* Phase 2: Quantity Selection Panel */}
                        <section className="space-y-4 rounded-2xl border border-(--color-border-muted) bg-(--color-surface-page) p-6 shadow-sm">
                            <h3 className="text-sm font-bold tracking-wider text-slate-800 uppercase dark:text-slate-200">
                                {translate("dosageSectionTitle")}
                            </h3>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between text-sm font-semibold">
                                    <label
                                        htmlFor="quantity-input"
                                        className="text-slate-600 dark:text-slate-300"
                                    >
                                        {translate("quantityLabel")}
                                    </label>
                                    <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                                        {quantity}{" "}
                                        {quantity === 1
                                            ? translate("packUnit")
                                            : translate("packsUnit")}
                                    </span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <input
                                        id="quantity-slider"
                                        type="range"
                                        min="1"
                                        max="30"
                                        value={quantity}
                                        onChange={(e) =>
                                            setQuantity(parseInt(e.target.value, 10) || 1)
                                        }
                                        className="h-2 flex-1 cursor-pointer appearance-none rounded-lg bg-slate-200 accent-emerald-600 dark:bg-slate-700"
                                    />
                                    <input
                                        id="quantity-input"
                                        type="number"
                                        min="1"
                                        max="100"
                                        value={quantity}
                                        onChange={(e) =>
                                            setQuantity(
                                                Math.max(1, parseInt(e.target.value, 10) || 1)
                                            )
                                        }
                                        className="w-16 rounded-lg border border-slate-300 py-1.5 text-center text-sm font-bold focus:border-emerald-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
                                    />
                                </div>
                            </div>
                        </section>

                        {/* Substitutions & Comparisons Panel - UPDATED with GenericAlternativeCard */}
                        <section className="space-y-4 rounded-2xl border border-(--color-border-muted) bg-(--color-surface-page) p-6 shadow-sm">
                            <h3 className="flex items-center gap-2 text-base font-bold text-emerald-700 dark:text-emerald-400">
                                <Pill size={18} />
                                {translate("alternativeTitle")}
                            </h3>

                            {/* NEW: Use GenericAlternativeCard with skeleton loader */}
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {loading
                                    ? // Show 6 skeleton cards while loading
                                      Array.from({ length: 6 }).map((_, index) => (
                                          <GenericAlternativeCardSkeleton
                                              key={`skeleton-${index}`}
                                          />
                                      ))
                                    : // Show the actual card
                                      alternativeData && (
                                          <GenericAlternativeCard alternative={alternativeData} />
                                      )}
                            </div>
                        </section>

                        {/* Phase 2: Savings Dashboard / Projections Panel */}
                        <section className="space-y-4 rounded-2xl border border-(--color-border-muted) bg-(--color-surface-page) p-6 shadow-sm">
                            <h3 className="text-sm font-bold tracking-wider text-slate-800 uppercase dark:text-slate-200">
                                {translate("projectionsTitle")}
                            </h3>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-center dark:border-slate-800 dark:bg-slate-800/40">
                                    <span className="block text-xs font-semibold text-slate-500">
                                        {translate("perPurchaseSavings")}
                                    </span>
                                    <span className="mt-1 block text-lg font-black text-slate-800 dark:text-slate-200">
                                        Γé╣{savingsPerPurchase.toFixed(2)}
                                    </span>
                                </div>

                                <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/5 p-4 text-center shadow-md shadow-emerald-500/5 sm:scale-105">
                                    <span className="block flex items-center justify-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                        <DollarSign size={12} />
                                        {translate("monthlySavings")}
                                    </span>
                                    <span className="mt-1 block text-xl font-extrabold text-emerald-700 dark:text-emerald-400">
                                        Γé╣{monthlySavings.toFixed(2)}
                                    </span>
                                </div>

                                <div className="rounded-xl border border-teal-500/15 bg-teal-500/5 p-4 text-center">
                                    <span className="block flex items-center justify-center gap-1 text-xs font-bold text-teal-600 dark:text-teal-400">
                                        <Calendar size={12} />
                                        {translate("yearlySavings")}
                                    </span>
                                    <span className="mt-1 block text-xl font-extrabold text-teal-700 dark:text-teal-400">
                                        Γé╣{yearlySavings.toFixed(2)}
                                    </span>
                                </div>
                            </div>

                            {/* Cost Comparison Progress Meters */}
                            <div className="space-y-4 border-t border-slate-100 pt-4 dark:border-slate-800/60">
                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
                                        <span>{translate("costPerMonthBrand")}</span>
                                        <span className="font-extrabold text-slate-800 dark:text-slate-200">
                                            Γé╣{brandMonthlyCost.toFixed(2)}
                                        </span>
                                    </div>
                                    <div className="h-3 w-full rounded-full bg-slate-100 dark:bg-slate-800">
                                        <div
                                            className="h-3 rounded-full bg-rose-500 transition-all duration-300"
                                            style={{ width: brandMonthlyCost > 0 ? "100%" : "0%" }}
                                        ></div>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
                                        <span>{translate("costPerMonthGeneric")}</span>
                                        <span className="font-extrabold text-slate-800 dark:text-slate-200">
                                            Γé╣{genericMonthlyCost.toFixed(2)}
                                        </span>
                                    </div>
                                    <div className="h-3 w-full rounded-full bg-slate-100 dark:bg-slate-800">
                                        <div
                                            className="h-3 rounded-full bg-sky-500 transition-all duration-300"
                                            style={{
                                                width:
                                                    brandMonthlyCost > 0
                                                        ? `${(genericMonthlyCost / brandMonthlyCost) * 100}%`
                                                        : "0%",
                                            }}
                                        ></div>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
                                        <span>{translate("costPerMonthJanAushadhi")}</span>
                                        <span className="font-extrabold text-slate-800 dark:text-slate-200">
                                            Γé╣{janAushadhiMonthlyCost.toFixed(2)}
                                        </span>
                                    </div>
                                    <div className="h-3 w-full rounded-full bg-slate-100 dark:bg-slate-800">
                                        <div
                                            className="h-3 rounded-full bg-emerald-500 transition-all duration-300"
                                            style={{
                                                width:
                                                    brandMonthlyCost > 0
                                                        ? `${(janAushadhiMonthlyCost / brandMonthlyCost) * 100}%`
                                                        : "0%",
                                            }}
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Nearest Jan Aushadhi Store Details */}
                        {alternativeData.nearest_store && (
                            <section className="animate-in fade-in space-y-4 rounded-2xl border border-(--color-border-muted) bg-(--color-surface-page) p-6 shadow-sm duration-200">
                                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                                    <MapPin size={18} />
                                    <span className="text-xs font-bold tracking-wider uppercase">
                                        Nearest Jan Aushadhi Kendra
                                    </span>
                                </div>
                                <div className="flex flex-col gap-1.5 rounded-xl border border-(--color-border-muted) bg-(--color-surface-muted) p-4">
                                    <span className="text-sm font-extrabold text-slate-800 dark:text-slate-200">
                                        {alternativeData.nearest_store.name}
                                    </span>
                                    <span className="text-xs text-(--color-text-secondary)">
                                        Distance:{" "}
                                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                            {alternativeData.nearest_store.distance}
                                        </span>
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleFindStore}
                                    onKeyDown={(event) =>
                                        handleButtonKeyDown(event, handleFindStore)
                                    }
                                    className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3.5 text-sm font-black text-white shadow-lg shadow-emerald-600/15 transition-all duration-200 hover:bg-emerald-500 hover:shadow-emerald-500/25 active:scale-98"
                                >
                                    <span>Find Nearest Jan Aushadhi Store</span>
                                    <ArrowRight size={16} />
                                </button>
                            </section>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}

export default function CalculatorPage() {
    return (
        <Suspense fallback={null}>
            <CalculatorPageContent />
        </Suspense>
    );
}
