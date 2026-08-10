import { useState, useEffect } from "react";
import {
    AlertTriangle,
    Pill,
    Info,
    Building2,
    Zap,
    ShieldAlert,
    User,
    Baby,
    Users,
    Wine,
    Apple,
    Droplets,
    UtensilsCrossed,
    Refrigerator,
    HeartPulse,
    X,
} from "lucide-react";
import { ExpiryBadge } from "../ExpiryBadge";
import { ResultActions } from "./ResultActions";
import {
    lookupIngredientFromOcr,
    extractManufacturer,
    extractDosage,
} from "@/lib/medicineKnowledge";
import { resolveToGeneric } from "@/lib/sync/medicineParser";
import { fetchSafetyProfile } from "@/lib/medicineSafetyService";
import { type MedicineSafetyProfile } from "@/components/medicine/MedicineSafetyData";

type AgeGroupKey = "children" | "adults" | "elderly";

export function UnverifiedResult({
    brandName,
    batchNumber,
    expiryDate,
    ocrText,
    onScanAgain,
    onShare,
    shareLabel,
}: {
    brandName?: string;
    batchNumber?: string;
    expiryDate?: string;
    ocrText?: string;
    onScanAgain: () => void;
    onShare: () => void;
    shareLabel: string;
}) {
    // ── Local states for dynamic LLM profile ──
    const [profile, setProfile] = useState<MedicineSafetyProfile | null>(null);
    const [loading, setLoading] = useState(false);
    const [activeAgeGroup, setActiveAgeGroup] = useState<AgeGroupKey>("adults");

    // ── Static / local lookup fallback ──
    const ingredient = ocrText ? lookupIngredientFromOcr(ocrText) : null;
    const ingredientFromBrand =
        !ingredient && brandName ? lookupIngredientFromOcr(resolveToGeneric(brandName)) : null;
    const staticInfo = ingredient ?? ingredientFromBrand;
    const manufacturer = ocrText ? extractManufacturer(ocrText) : null;
    const dosage = ocrText ? extractDosage(ocrText) : null;

    // Resolve the query search query for the API
    const searchQuery = brandName || (ocrText ? resolveToGeneric(ocrText) : null);

    useEffect(() => {
        if (!searchQuery?.trim()) return;

        let cancelled = false;
        setLoading(true);
        setProfile(null);

        fetchSafetyProfile(searchQuery)
            .then((result) => {
                if (!cancelled && result) {
                    setProfile(result);
                }
            })
            .catch((err) => console.warn("[UnverifiedResult] Safety profile load failed:", err))
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [searchQuery]);

    // Diet icon resolver
    const renderDietIcon = (name: string) => {
        const cls = "h-4 w-4 shrink-0 mt-0.5";
        switch (name) {
            case "Droplets":
                return <Droplets className={`${cls} text-blue-500`} />;
            case "UtensilsCrossed":
                return <UtensilsCrossed className={`${cls} text-emerald-500`} />;
            case "Wine":
                return <Wine className={`${cls} text-red-500`} />;
            case "Apple":
                return <Apple className={`${cls} text-orange-500`} />;
            case "Refrigerator":
                return <Refrigerator className={`${cls} text-indigo-500`} />;
            default:
                return <Info className={`${cls} text-slate-500`} />;
        }
    };

    return (
        <div
            className="relative flex w-[94vw] max-w-[480px] flex-col overflow-hidden rounded-[2.5rem] border border-(--color-border-muted) bg-(--color-surface-page) text-(--color-text-primary) shadow-2xl transition-all duration-300 sm:w-[480px]"
            style={{ maxHeight: "min(90vh, 700px)" }}
            role="region"
            aria-label={`Medicine info — ${brandName || "Unknown medicine"}`}
            aria-live="polite"
            aria-atomic="true"
        >
            {/* Close Button */}
            <button
                onClick={onScanAgain}
                className="dark:bg-slate-850 dark:hover:bg-slate-750 absolute top-5 right-5 z-20 rounded-full bg-slate-100/80 p-2 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                aria-label="Close result"
                title="Close"
            >
                <X size={16} strokeWidth={2.5} />
            </button>

            {/* Top Amber bar */}
            <div className="absolute top-0 right-0 left-0 h-2 flex-none bg-gradient-to-r from-amber-400 to-amber-500" />

            {/* ── Sticky header ── */}
            <div className="flex-none border-b border-(--color-border-muted) bg-(--color-surface-page) px-6 pt-7 pb-5 text-center">
                {/* Icon + title row */}
                <div className="flex flex-col items-center gap-4">
                    <span className="flex h-14 w-14 flex-none items-center justify-center rounded-full bg-amber-50 text-amber-600 ring-4 ring-amber-100/50 dark:bg-amber-950/40 dark:text-amber-400 dark:ring-amber-950/20">
                        <Pill size={28} strokeWidth={2} aria-hidden="true" />
                    </span>
                    <div className="space-y-1">
                        <h3 className="text-xl leading-tight font-black tracking-tight text-amber-700 dark:text-amber-400">
                            {brandName || "Branded Medicine"}
                        </h3>
                        {/* Display resolved generic name */}
                        {(profile?.genericName || staticInfo?.genericName) && (
                            <p className="text-sm font-bold text-(--color-text-secondary)">
                                {profile?.genericName || staticInfo?.genericName}
                                {dosage && (
                                    <span className="text-(--color-text-muted)"> · {dosage}</span>
                                )}
                            </p>
                        )}
                    </div>
                </div>

                {/* "Not in CDSCO" badge */}
                <span className="mt-3.5 inline-flex items-center gap-1.5 rounded-full bg-amber-50/80 px-3.5 py-1 text-[11px] font-black text-amber-700 ring-1 ring-amber-200/60 dark:bg-amber-950/30 dark:text-amber-400 dark:ring-amber-800/40">
                    <AlertTriangle size={11} aria-hidden="true" />
                    Not found in CDSCO Database
                </span>
            </div>

            {/* ── Scrollable body ── */}
            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
                {/* Manufacturer + Batch + Expiry info */}
                <div className="grid grid-cols-2 gap-3">
                    {manufacturer && (
                        <div className="col-span-2 flex items-center gap-3 rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted) px-4 py-3">
                            <Building2
                                size={16}
                                className="shrink-0 text-(--color-text-muted)"
                                aria-hidden="true"
                            />
                            <div>
                                <p className="text-[10px] font-extrabold tracking-wider text-(--color-text-muted) uppercase">
                                    Manufacturer
                                </p>
                                <p className="text-sm font-bold text-(--color-text-primary)">
                                    {manufacturer}
                                </p>
                            </div>
                        </div>
                    )}
                    {batchNumber && (
                        <div className="rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted) px-4 py-3">
                            <p className="text-[10px] font-extrabold tracking-wider text-(--color-text-muted) uppercase">
                                Batch No.
                            </p>
                            <p className="text-sm font-bold text-(--color-text-primary)">
                                {batchNumber}
                            </p>
                        </div>
                    )}
                    {expiryDate && (
                        <div className="overflow-hidden rounded-2xl">
                            <ExpiryBadge expiryDate={expiryDate} />
                        </div>
                    )}
                </div>

                {/* ── CASE 1: Loading State ── */}
                {loading && (
                    <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/10">
                        <div className="flex items-center gap-2">
                            <Zap className="h-4 w-4 animate-pulse text-amber-500" />
                            <span className="text-xs font-semibold text-slate-500">
                                Consulting AI (Gemini/Groq) for safety details...
                            </span>
                        </div>
                        <div className="space-y-2">
                            <div className="h-3 w-3/4 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
                            <div className="h-3 w-1/2 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
                            <div className="h-3 w-2/3 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
                        </div>
                    </div>
                )}

                {/* ── CASE 2: Dynamic LLM safety profile loaded ── */}
                {!loading && profile && (
                    <div className="space-y-4">
                        {/* Dynamic Side Effects */}
                        {profile.sideEffects && profile.sideEffects.length > 0 && (
                            <div className="space-y-3 rounded-2xl border border-red-200 bg-red-50/30 p-4 dark:border-red-900/40 dark:bg-red-950/10">
                                <span className="block text-[10px] font-black tracking-widest text-red-600 uppercase dark:text-red-400">
                                    Side Effects
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                    {profile.sideEffects.slice(0, 6).map((effect, idx) => (
                                        <span
                                            key={idx}
                                            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                                                effect.severity === "severe"
                                                    ? "border-red-200 bg-red-100/70 text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
                                                    : "border-amber-200 bg-amber-100/70 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300"
                                            }`}
                                        >
                                            {effect.name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Dynamic Dosage Tabs */}
                        {profile.ageBasedDosage && profile.ageBasedDosage.length > 0 && (
                            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/10">
                                <span className="block text-[10px] font-black tracking-widest text-slate-600 uppercase dark:text-slate-400">
                                    Dosage Guidelines
                                </span>
                                {/* Tab selector */}
                                <div className="flex rounded-xl bg-slate-200/60 p-1 dark:bg-slate-800/60">
                                    {(["children", "adults", "elderly"] as const).map((g) => (
                                        <button
                                            key={g}
                                            type="button"
                                            onClick={() => setActiveAgeGroup(g)}
                                            className={`flex-1 rounded-lg py-1.5 text-center text-xs font-bold capitalize transition-all ${
                                                activeAgeGroup === g
                                                    ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                                                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                                            }`}
                                        >
                                            {g}
                                        </button>
                                    ))}
                                </div>

                                {/* Active group data */}
                                {(() => {
                                    const doseInfo = profile.ageBasedDosage.find(
                                        (d) => d.group === activeAgeGroup
                                    );
                                    if (!doseInfo) return null;
                                    return (
                                        <div className="space-y-2 pt-1 text-xs">
                                            <p className="font-semibold text-(--color-text-primary)">
                                                Dose:{" "}
                                                <span className="font-normal text-(--color-text-secondary)">
                                                    {doseInfo.dose} ({doseInfo.frequency})
                                                </span>
                                            </p>
                                            {doseInfo.warnings.length > 0 && (
                                                <div className="flex gap-2 rounded-lg bg-red-100/40 p-2.5 text-red-800 dark:bg-red-950/20 dark:text-red-300">
                                                    <ShieldAlert
                                                        size={14}
                                                        className="mt-0.5 shrink-0"
                                                    />
                                                    <p className="leading-snug">
                                                        {doseInfo.warnings[0]}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>
                        )}

                        {/* Dynamic Dietary Cues */}
                        {profile.dietaryCues && profile.dietaryCues.length > 0 && (
                            <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/20 p-4 dark:border-emerald-950/40 dark:bg-emerald-950/10">
                                <span className="block text-[10px] font-black tracking-widest text-emerald-700 uppercase dark:text-emerald-400">
                                    Diet & Food Rules
                                </span>
                                <div className="space-y-2.5">
                                    {profile.dietaryCues.map((cue, idx) => (
                                        <div
                                            key={idx}
                                            className="flex gap-2.5 text-xs text-(--color-text-primary)"
                                        >
                                            {renderDietIcon(cue.icon)}
                                            <div>
                                                <strong className="block font-semibold">
                                                    {cue.label}
                                                </strong>
                                                <span className="leading-snug text-(--color-text-secondary)">
                                                    {cue.instruction}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Dynamic Pregnancy Category */}
                        {profile.pregnancyCategory && (
                            <div className="flex gap-2.5 rounded-2xl border border-purple-200 bg-purple-50/30 p-4 text-xs dark:border-purple-900/40 dark:bg-purple-950/10">
                                <HeartPulse size={16} className="mt-0.5 shrink-0 text-purple-500" />
                                <div>
                                    <span className="block text-[10px] font-black tracking-widest text-purple-700 uppercase dark:text-purple-400">
                                        Pregnancy safety
                                    </span>
                                    <span className="leading-relaxed text-(--color-text-secondary)">
                                        {profile.pregnancyCategory}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Dynamic Storage note */}
                        {profile.storageNote && (
                            <div className="flex gap-2.5 rounded-2xl border border-blue-200 bg-blue-50/30 p-4 text-xs dark:border-blue-900/40 dark:bg-blue-950/10">
                                <Refrigerator size={16} className="mt-0.5 shrink-0 text-blue-500" />
                                <div>
                                    <span className="block text-[10px] font-black tracking-widest text-blue-700 uppercase dark:text-blue-400">
                                        Storage & Shelf note
                                    </span>
                                    <span className="leading-relaxed text-(--color-text-secondary)">
                                        {profile.storageNote}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── CASE 3: Static / local lookup fallback (offline or fail) ── */}
                {!loading && !profile && staticInfo && (
                    <div className="space-y-3.5 rounded-2xl border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900/40 dark:bg-blue-950/10">
                        {/* Category */}
                        <div className="flex items-center gap-1.5">
                            <Zap size={13} className="text-blue-500" aria-hidden="true" />
                            <span className="text-xs font-bold text-blue-700 dark:text-blue-300">
                                {staticInfo.category}
                            </span>
                        </div>

                        {/* Uses */}
                        <div className="space-y-1">
                            <p className="text-[10px] font-black tracking-widest text-blue-600 uppercase dark:text-blue-400">
                                Common Uses
                            </p>
                            <p className="text-sm leading-relaxed font-medium text-blue-800 dark:text-blue-200">
                                {staticInfo.uses}
                            </p>
                        </div>

                        {/* Forms */}
                        <div className="space-y-1">
                            <p className="text-[10px] font-black tracking-widest text-blue-600 uppercase dark:text-blue-400">
                                Available Forms
                            </p>
                            <p className="text-sm leading-relaxed text-blue-700 dark:text-blue-300">
                                {staticInfo.commonForms}
                            </p>
                        </div>

                        {/* Safety */}
                        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/80 p-3 dark:border-amber-800/30 dark:bg-amber-950/20">
                            <ShieldAlert
                                size={16}
                                className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
                                aria-hidden="true"
                            />
                            <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-300">
                                <strong className="font-bold">Safety: </strong>
                                {staticInfo.safetyNote}
                            </p>
                        </div>
                    </div>
                )}

                {/* ── CASE 4: Absolute Fallback (both null) ── */}
                {!loading && !profile && !staticInfo && (
                    <div
                        className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900 dark:bg-amber-950/20"
                        role="alert"
                    >
                        <Info
                            size={18}
                            className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
                            aria-hidden="true"
                        />
                        <p className="text-xs leading-relaxed font-medium text-amber-800 dark:text-amber-300">
                            This appears to be a branded medicine not in the CDSCO database. Please
                            consult a pharmacist or doctor for usage and safety information.
                        </p>
                    </div>
                )}

                {/* Disclaimer */}
                <div className="flex items-start gap-2.5 rounded-xl bg-(--color-surface-muted) p-3">
                    <AlertTriangle
                        size={13}
                        className="mt-0.5 shrink-0 text-(--color-text-muted)"
                        aria-hidden="true"
                    />
                    <p className="text-[10px] leading-snug text-(--color-text-muted)">
                        Info is based on the active ingredient found on the packaging. Always
                        consult a doctor or pharmacist before taking any medicine.
                    </p>
                </div>
            </div>

            {/* ── Sticky footer actions ── */}
            <div className="flex-none border-t border-(--color-border-muted) bg-(--color-surface-page) px-6 py-5">
                <ResultActions
                    onScanAgain={onScanAgain}
                    onShare={onShare}
                    shareLabel={shareLabel}
                />
            </div>
        </div>
    );
}
