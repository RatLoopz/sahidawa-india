import { AlertTriangle, Pill, Info, Building2, Zap, ShieldAlert } from "lucide-react";
import { ExpiryBadge } from "../ExpiryBadge";
import { ResultActions } from "./ResultActions";
import {
    lookupIngredientFromOcr,
    extractManufacturer,
    extractDosage,
} from "@/lib/medicineKnowledge";
import { resolveToGeneric } from "@/lib/sync/medicineParser";

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
    const ingredient = ocrText ? lookupIngredientFromOcr(ocrText) : null;
    // Second-pass: resolve brand name → generic → look up in knowledge base
    const ingredientFromBrand =
        !ingredient && brandName ? lookupIngredientFromOcr(resolveToGeneric(brandName)) : null;
    const info = ingredient ?? ingredientFromBrand;
    const manufacturer = ocrText ? extractManufacturer(ocrText) : null;
    const dosage = ocrText ? extractDosage(ocrText) : null;

    return (
        <div
            className="relative flex w-[94vw] max-w-[480px] flex-col overflow-hidden rounded-[2.5rem] border border-(--color-border-muted) bg-(--color-surface-page) text-(--color-text-primary) shadow-2xl transition-all duration-300 sm:w-[480px]"
            style={{ maxHeight: "min(90vh, 700px)" }}
            role="region"
            aria-label={`Medicine info — ${brandName || "Unknown medicine"}`}
            aria-live="polite"
            aria-atomic="true"
        >
            {/* Amber top bar */}
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
                        {info && (
                            <p className="text-sm font-bold text-(--color-text-secondary)">
                                {info.genericName}
                                {dosage && (
                                    <span className="text-(--color-text-muted)"> · {dosage}</span>
                                )}
                            </p>
                        )}
                    </div>
                </div>

                {/* "Not in CDSCO" pill */}
                <span className="mt-3.5 inline-flex items-center gap-1.5 rounded-full bg-amber-50/80 px-3.5 py-1 text-[11px] font-black text-amber-700 ring-1 ring-amber-200/60 dark:bg-amber-950/30 dark:text-amber-400 dark:ring-amber-800/40">
                    <AlertTriangle size={11} aria-hidden="true" />
                    Not found in CDSCO Database
                </span>
            </div>

            {/* ── Scrollable body ── */}
            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
                {/* Manufacturer + Batch + Expiry */}
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

                {/* Ingredient knowledge card */}
                {info ? (
                    <div className="space-y-3.5 rounded-2xl border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900/40 dark:bg-blue-950/10">
                        {/* Category */}
                        <div className="flex items-center gap-1.5">
                            <Zap size={13} className="text-blue-500" aria-hidden="true" />
                            <span className="text-xs font-bold text-blue-700 dark:text-blue-300">
                                {info.category}
                            </span>
                        </div>

                        {/* Uses */}
                        <div className="space-y-1">
                            <p className="text-[10px] font-black tracking-widest text-blue-600 uppercase dark:text-blue-400">
                                Common Uses
                            </p>
                            <p className="text-sm leading-relaxed font-medium text-blue-800 dark:text-blue-200">
                                {info.uses}
                            </p>
                        </div>

                        {/* Forms */}
                        <div className="space-y-1">
                            <p className="text-[10px] font-black tracking-widest text-blue-600 uppercase dark:text-blue-400">
                                Available Forms
                            </p>
                            <p className="text-sm leading-relaxed text-blue-700 dark:text-blue-300">
                                {info.commonForms}
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
                                {info.safetyNote}
                            </p>
                        </div>
                    </div>
                ) : (
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
