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
import {
    Pill,
    AlertCircle,
    Loader2,
    DollarSign,
    Calendar,
    Sparkles,
    MapPin,
    ArrowRight,
} from "lucide-react";

async function searchMedicines(query: string): Promise<Medicine[]> {
    const q = query.trim();
    if (q.length < 2) return [];

    const escaped = escapePostgrest(q);
    const { data, error } = await supabase
        .from("medicines")
        .select(
            "id, brand_name, generic_name, manufacturer, mrp, jan_aushadhi_price, composition, cdsco_approval_status"
        )
        .or(`brand_name.ilike."%${escaped}%",generic_name.ilike."%${escaped}%"`)
        .limit(20);

    if (error) {
        console.error(error.message);
        return [];
    }
    return (data ?? []).map((row) => ({
        id: row.id,
        brand_name: row.brand_name,
        generic_name: row.generic_name,
        manufacturer: row.manufacturer,
        mrp: row.mrp,
        jan_aushadhi_price: row.jan_aushadhi_price,
        composition: row.composition,
        cdsco_approval_status: row.cdsco_approval_status || "approved",
    }));
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

                {loading && (
                    <div className="flex items-center justify-center gap-3 py-12 text-emerald-600 dark:text-emerald-400">
                        <Loader2 className="animate-spin" size={24} />
                        <span className="text-sm font-bold">{translate("loading")}</span>
                    </div>
                )}

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

                        {/* Substitutions & Comparisons Panel */}
                        <section className="space-y-4 rounded-2xl border border-(--color-border-muted) bg-(--color-surface-page) p-6 shadow-sm">
                            <h3 className="flex items-center gap-2 text-base font-bold text-emerald-700 dark:text-emerald-400">
                                <Pill size={18} />
                                {translate("alternativeTitle")}
                            </h3>

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                {/* Brand Details Card */}
                                <div className="flex flex-col justify-between rounded-2xl border border-(--color-border-muted) bg-slate-50/50 p-5 dark:bg-slate-800/10">
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="block text-[10px] font-bold tracking-wider text-(--color-text-muted) uppercase">
                                                {translate("brandTierTitle")}
                                            </span>
                                            <span className="dark:text-slate-350 rounded-full bg-slate-200/60 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-700">
                                                {translate("mrpLabel")}
                                            </span>
                                        </div>
                                        <h4 className="mt-1 block text-sm font-bold text-(--color-text-primary)">
                                            {alternativeData.brand_name}
                                        </h4>
                                        <p className="truncate text-xs text-(--color-text-secondary)">
                                            {selectedMedicine.manufacturer || "Commercial Lab"}
                                        </p>
                                        <p className="text-[11px] text-(--color-text-muted) italic">
                                            {translate("brandTierDesc")}
                                        </p>
                                    </div>
                                    <div className="mt-4 flex items-baseline justify-between border-t border-(--color-border-muted) pt-3">
                                        <span className="text-xs font-medium text-slate-500">
                                            {translate("brandPriceLabel")}
                                        </span>
                                        <span className="text-base font-bold text-slate-700 dark:text-slate-300">
                                            ₹{brandPrice.toFixed(2)}
                                        </span>
                                    </div>
                                </div>

                                {/* Generic Alternative Card */}
                                <div className="flex flex-col justify-between rounded-2xl border border-sky-500/20 bg-sky-50/20 p-5 dark:bg-sky-950/5">
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sky-650 dark:text-sky-450 block text-[10px] font-bold tracking-wider uppercase">
                                                {translate("genericTierTitle")}
                                            </span>
                                            {genericAlternative?.isEstimated && (
                                                <span className="text-sky-850 rounded bg-sky-100/80 px-1.5 py-0.5 text-[9px] font-bold dark:bg-sky-950 dark:text-sky-300">
                                                    {translate("estimatedLabel")}
                                                </span>
                                            )}
                                        </div>
                                        <h4 className="mt-1 block text-sm font-bold text-sky-800 dark:text-sky-300">
                                            {genericAlternative?.brand_name ||
                                                `${selectedMedicine.generic_name}`}
                                        </h4>
                                        <p className="truncate text-xs text-sky-700/80 dark:text-sky-400/80">
                                            {genericAlternative?.manufacturer || "Generic Lab"}
                                        </p>
                                        <p className="text-sky-650 text-[11px] italic dark:text-sky-400/60">
                                            {translate("genericTierDesc")}
                                        </p>
                                    </div>
                                    <div className="mt-4 border-t border-sky-500/10 pt-3">
                                        <div className="mb-1 flex items-baseline justify-between">
                                            <span className="text-sky-750 text-xs font-medium dark:text-sky-400">
                                                Price
                                            </span>
                                            <span className="text-sky-850 text-base font-bold dark:text-sky-300">
                                                ₹{genericPrice.toFixed(2)}
                                            </span>
                                        </div>
                                        {brandPrice > genericPrice && (
                                            <div className="text-sky-750 dark:text-sky-450 flex items-center justify-between text-[10px] font-bold">
                                                <span>Save per strip:</span>
                                                <span>
                                                    ₹{(brandPrice - genericPrice).toFixed(2)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Jan Aushadhi Generic Card */}
                                <div className="flex flex-col justify-between rounded-2xl border border-emerald-500/25 bg-emerald-50/40 p-5 dark:bg-emerald-950/10">
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="block flex items-center gap-1 text-[10px] font-bold tracking-wider text-emerald-600 uppercase dark:text-emerald-400">
                                                <Sparkles size={10} className="text-emerald-500" />
                                                {translate("janAushadhiTierTitle")}
                                            </span>
                                            <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[9px] font-extrabold tracking-wide text-white uppercase">
                                                {translate("bestValue")}
                                            </span>
                                        </div>
                                        <h4 className="mt-1 block text-sm font-bold text-emerald-800 dark:text-emerald-300">
                                            {alternativeData.alternative_name}
                                        </h4>
                                        <p className="text-emerald-750 truncate text-xs dark:text-emerald-400/80">
                                            Jan Aushadhi (PMBJP)
                                        </p>
                                        <p className="text-[11px] text-emerald-700 italic dark:text-emerald-400/60">
                                            {translate("janAushadhiTierDesc")}
                                        </p>
                                    </div>
                                    <div className="mt-4 border-t border-emerald-500/10 pt-3">
                                        <div className="mb-1 flex items-baseline justify-between">
                                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                                {translate("genericPriceLabel")}
                                            </span>
                                            <span className="text-lg font-black text-emerald-700 dark:text-emerald-400">
                                                ₹{janAushadhiPrice.toFixed(2)}
                                            </span>
                                        </div>
                                        {brandPrice > janAushadhiPrice && (
                                            <div className="dark:text-emerald-450 flex items-center justify-between text-[10px] font-black text-emerald-700">
                                                <span>Save per strip:</span>
                                                <span>₹{savingsPerPurchase.toFixed(2)}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
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
                                        ₹{savingsPerPurchase.toFixed(2)}
                                    </span>
                                </div>

                                <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/5 p-4 text-center shadow-md shadow-emerald-500/5 sm:scale-105">
                                    <span className="block flex items-center justify-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                        <DollarSign size={12} />
                                        {translate("monthlySavings")}
                                    </span>
                                    <span className="mt-1 block text-xl font-extrabold text-emerald-700 dark:text-emerald-400">
                                        ₹{monthlySavings.toFixed(2)}
                                    </span>
                                </div>

                                <div className="rounded-xl border border-teal-500/15 bg-teal-500/5 p-4 text-center">
                                    <span className="block flex items-center justify-center gap-1 text-xs font-bold text-teal-600 dark:text-teal-400">
                                        <Calendar size={12} />
                                        {translate("yearlySavings")}
                                    </span>
                                    <span className="mt-1 block text-xl font-extrabold text-teal-700 dark:text-teal-400">
                                        ₹{yearlySavings.toFixed(2)}
                                    </span>
                                </div>
                            </div>

                            {/* Cost Comparison Progress Meters */}
                            <div className="space-y-4 border-t border-slate-100 pt-4 dark:border-slate-800/60">
                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
                                        <span>{translate("costPerMonthBrand")}</span>
                                        <span className="font-extrabold text-slate-800 dark:text-slate-200">
                                            ₹{brandMonthlyCost.toFixed(2)}
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
                                            ₹{genericMonthlyCost.toFixed(2)}
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
                                            ₹{janAushadhiMonthlyCost.toFixed(2)}
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
