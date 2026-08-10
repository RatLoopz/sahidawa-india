import { AlertTriangle, Pill, Info, Building2, Zap, ShieldAlert } from "lucide-react";
import { ExpiryBadge } from "../ExpiryBadge";
import { ResultActions } from "./ResultActions";
import {
    lookupIngredientFromOcr,
    extractManufacturer,
    extractDosage,
} from "@/lib/medicineKnowledge";

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
    const manufacturer = ocrText ? extractManufacturer(ocrText) : null;
    const dosage = ocrText ? extractDosage(ocrText) : null;

    return (
        <div
            className="relative flex w-full max-w-sm flex-col overflow-hidden rounded-3xl border border-(--color-border-muted) bg-(--color-surface-page) text-(--color-text-primary) shadow-2xl"
            style={{ maxHeight: "min(85vh, 600px)" }}
            role="region"
            aria-label={`Medicine info — ${brandName || "Unknown medicine"}`}
            aria-live="polite"
            aria-atomic="true"
        >
            {/* Amber top bar */}
            <div className="absolute top-0 right-0 left-0 h-1.5 flex-none bg-amber-400" />

            {/* ── Sticky header ── */}
            <div className="flex-none border-b border-(--color-border-muted) bg-(--color-surface-page) px-5 pt-6 pb-4 text-center">
                {/* Icon + title row */}
                <div className="flex items-center justify-center gap-3">
                    <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
                        <Pill size={20} strokeWidth={2.2} aria-hidden="true" />
                    </span>
                    <div className="text-left">
                        <h3 className="text-base leading-tight font-black tracking-tight text-amber-700 dark:text-amber-400">
                            {brandName || "Branded Medicine"}
                        </h3>
                        {ingredient && (
                            <p className="text-xs font-semibold text-(--color-text-secondary)">
                                {ingredient.genericName}
                                {dosage && (
                                    <span className="text-(--color-text-muted)"> · {dosage}</span>
                                )}
                            </p>
                        )}
                    </div>
                </div>

                {/* "Not in CDSCO" pill */}
                <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-600 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:ring-amber-800/40">
                    <AlertTriangle size={9} aria-hidden="true" />
                    Not found in CDSCO Database
                </span>
            </div>

            {/* ── Scrollable body ── */}
            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
                {/* Manufacturer + Batch + Expiry */}
                <div className="grid grid-cols-2 gap-2">
                    {manufacturer && (
                        <div className="col-span-2 flex items-center gap-2 rounded-xl border border-(--color-border-muted) bg-(--color-surface-muted) px-3 py-2">
                            <Building2
                                size={13}
                                className="shrink-0 text-(--color-text-muted)"
                                aria-hidden="true"
                            />
                            <div>
                                <p className="text-[9px] font-bold tracking-wider text-(--color-text-muted) uppercase">
                                    Manufacturer
                                </p>
                                <p className="text-xs font-bold text-(--color-text-primary)">
                                    {manufacturer}
                                </p>
                            </div>
                        </div>
                    )}
                    {batchNumber && (
                        <div className="rounded-xl border border-(--color-border-muted) bg-(--color-surface-muted) px-3 py-2">
                            <p className="text-[9px] font-bold tracking-wider text-(--color-text-muted) uppercase">
                                Batch No.
                            </p>
                            <p className="text-xs font-bold text-(--color-text-primary)">
                                {batchNumber}
                            </p>
                        </div>
                    )}
                    {expiryDate && (
                        <div className="overflow-hidden rounded-xl">
                            <ExpiryBadge expiryDate={expiryDate} />
                        </div>
                    )}
                </div>

                {/* Ingredient knowledge card */}
                {ingredient ? (
                    <div className="space-y-2.5 rounded-xl border border-blue-200 bg-blue-50 p-3 dark:border-blue-900/40 dark:bg-blue-950/20">
                        {/* Category */}
                        <div className="flex items-center gap-1.5">
                            <Zap size={11} className="text-blue-500" aria-hidden="true" />
                            <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300">
                                {ingredient.category}
                            </span>
                        </div>

                        {/* Uses */}
                        <div>
                            <p className="mb-0.5 text-[9px] font-black tracking-widest text-blue-600 uppercase dark:text-blue-400">
                                Common Uses
                            </p>
                            <p className="text-xs leading-relaxed text-blue-800 dark:text-blue-200">
                                {ingredient.uses}
                            </p>
                        </div>

                        {/* Forms */}
                        <div>
                            <p className="mb-0.5 text-[9px] font-black tracking-widest text-blue-600 uppercase dark:text-blue-400">
                                Available Forms
                            </p>
                            <p className="text-xs text-blue-700 dark:text-blue-300">
                                {ingredient.commonForms}
                            </p>
                        </div>

                        {/* Safety */}
                        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 dark:border-amber-800/30 dark:bg-amber-950/20">
                            <ShieldAlert
                                size={13}
                                className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
                                aria-hidden="true"
                            />
                            <p className="text-[11px] leading-snug text-amber-800 dark:text-amber-300">
                                <strong className="font-bold">Safety: </strong>
                                {ingredient.safetyNote}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div
                        className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/20"
                        role="alert"
                    >
                        <Info
                            size={15}
                            className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
                            aria-hidden="true"
                        />
                        <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-300">
                            This appears to be a branded medicine not in the CDSCO database. Please
                            consult a pharmacist or doctor for usage and safety information.
                        </p>
                    </div>
                )}

                {/* Disclaimer */}
                <div className="flex items-start gap-2 rounded-lg bg-(--color-surface-muted) p-2.5">
                    <AlertTriangle
                        size={11}
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
            <div className="flex-none border-t border-(--color-border-muted) bg-(--color-surface-page) px-5 py-4">
                <ResultActions
                    onScanAgain={onScanAgain}
                    onShare={onShare}
                    shareLabel={shareLabel}
                />
            </div>
        </div>
    );
}
