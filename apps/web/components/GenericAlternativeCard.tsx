import React from "react";
import { TrendingDown, MapPin, Sparkles, ArrowRight, Pill } from "lucide-react";
import { useRouter, useParams } from "next/navigation";

export interface NearestStore {
    name: string;
    lat: number;
    lng: number;
    distance: string;
}

export interface GenericAlternative {
    brand_name: string;
    generic_name: string;
    brand_price: number;
    jan_aushadhi_price: number;
    savings_percentage: number;
    alternative_name: string;
    nearest_store: NearestStore | null;
}

interface GenericAlternativeCardProps {
    alternative: GenericAlternative;
}

export default function GenericAlternativeCard({ alternative }: GenericAlternativeCardProps) {
    const router = useRouter();
    const params = useParams();
    const locale = Array.isArray(params.locale) ? params.locale[0] : params.locale || "en";

    const brandPrice = alternative.brand_price;
    const genericPrice = alternative.jan_aushadhi_price;
    const savingsAmount = brandPrice - genericPrice;
    const savingsPct = alternative.savings_percentage;

    const handleNavigateToMap = () => {
        // Navigate to the map page with pre-filtered settings
        router.push(`/${locale}/map?filter=govt`);
    };

    return (
        <div className="group relative w-full overflow-hidden rounded-[2.5rem] border border-emerald-500/20 bg-linear-to-b from-white to-emerald-50/10 p-6 text-(--color-text-primary) shadow-xl transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl dark:border-emerald-500/10 dark:from-slate-900 dark:to-emerald-950/10">
            {/* Ambient Background Glow */}
            <div className="pointer-events-none absolute -top-16 -right-16 h-32 w-32 rounded-full bg-emerald-500/10 blur-2xl transition-all duration-500 group-hover:scale-150 dark:bg-emerald-500/5"></div>

            <div className="flex flex-col space-y-5">
                {/* Header Badge */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 rounded-full bg-emerald-100 px-3.5 py-1 text-xs font-black text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400">
                        <Sparkles size={12} className="animate-pulse" />
                        <span>Cheaper Alternative Available</span>
                    </div>
                    {savingsPct > 0 && (
                        <div className="flex items-center gap-1 text-sm font-black text-emerald-600 dark:text-emerald-400">
                            <TrendingDown size={16} />
                            <span>Save {savingsPct}%</span>
                        </div>
                    )}
                </div>

                {/* Brand vs Generic Comparison */}
                <div className="space-y-4">
                    {/* Brand Prescribed */}
                    <div className="flex items-start justify-between gap-4 rounded-2xl border border-dashed border-(--color-border-muted) bg-slate-50/50 p-4 dark:bg-slate-800/10">
                        <div className="space-y-1">
                            <span className="text-[10px] font-bold tracking-wider text-(--color-text-muted) uppercase">
                                Prescribed Brand
                            </span>
                            <h4 className="text-base font-extrabold tracking-tight text-(--color-text-primary)">
                                {alternative.brand_name}
                            </h4>
                            <p className="text-xs text-(--color-text-secondary)">
                                {alternative.generic_name}
                            </p>
                        </div>
                        <div className="text-right">
                            <span className="text-xs font-medium text-(--color-text-muted)">
                                MRP
                            </span>
                            <p className="text-lg font-black text-(--color-text-secondary) line-through">
                                ₹{brandPrice.toFixed(2)}
                            </p>
                        </div>
                    </div>

                    {/* Generic Alternative */}
                    <div className="flex items-start justify-between gap-4 rounded-2xl border border-emerald-500/25 bg-emerald-50/30 p-4 dark:border-emerald-500/15 dark:bg-emerald-950/10">
                        <div className="space-y-1">
                            <span className="text-[10px] font-bold tracking-wider text-emerald-600 uppercase dark:text-emerald-400">
                                Jan Aushadhi Generic
                            </span>
                            <h4 className="flex items-center gap-1.5 text-base font-extrabold tracking-tight text-emerald-800 dark:text-emerald-300">
                                <Pill
                                    size={15}
                                    className="text-emerald-600 dark:text-emerald-400"
                                />
                                {alternative.alternative_name}
                            </h4>
                            <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80">
                                Equal strength & composition
                            </p>
                        </div>
                        <div className="text-right">
                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                Price
                            </span>
                            <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400">
                                ₹{genericPrice.toFixed(2)}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Savings Summary Banner */}
                {savingsAmount > 0 && (
                    <div className="rounded-2xl bg-linear-to-r from-emerald-500 to-teal-600 p-4 text-center text-white shadow-md shadow-emerald-500/10">
                        <p className="text-xs font-medium opacity-90">
                            Estimated Savings per Strip
                        </p>
                        <p className="text-xl font-extrabold tracking-tight">
                            You Save ₹{savingsAmount.toFixed(2)} ({savingsPct}%)
                        </p>
                    </div>
                )}

                {/* Nearest Store Info */}
                {alternative.nearest_store && (
                    <div className="flex items-start gap-3 rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted) p-4">
                        <div className="mt-1 rounded-xl bg-emerald-100 p-2 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                            <MapPin size={18} />
                        </div>
                        <div className="flex-1 space-y-1">
                            <h5 className="text-xs font-bold tracking-wider text-(--color-text-muted) uppercase">
                                Nearest Jan Aushadhi Kendra
                            </h5>
                            <p className="text-sm font-extrabold text-(--color-text-primary)">
                                {alternative.nearest_store.name}
                            </p>
                            <p className="text-xs font-medium text-(--color-text-secondary)">
                                Distance:{" "}
                                <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                                    {alternative.nearest_store.distance}
                                </span>
                            </p>
                        </div>
                    </div>
                )}

                {/* Call to Action Button */}
                <button
                    onClick={handleNavigateToMap}
                    className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3.5 text-sm font-black text-white shadow-lg shadow-emerald-600/15 transition-all duration-200 hover:bg-emerald-500 hover:shadow-emerald-500/25 active:scale-98"
                >
                    <span>Find Nearest Jan Aushadhi Store</span>
                    <ArrowRight size={16} />
                </button>
            </div>
        </div>
    );
}
