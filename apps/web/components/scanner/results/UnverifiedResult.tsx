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
    /** Raw OCR text extracted from the medicine image — used to look up ingredient info */
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
            className="relative w-full max-w-sm overflow-hidden rounded-[2.5rem] border border-(--color-border-muted) bg-(--color-surface-page) p-8 text-(--color-text-primary) shadow-2xl"
            role="region"
            aria-label={`Medicine info — ${brandName || "Unknown medicine"} not found in CDSCO database`}
            aria-live="polite"
            aria-atomic="true"
        >
            {/* Top accent bar — amber for "not verified", still informative */}
            <div className="absolute top-0 right-0 left-0 h-2 bg-amber-400" />

            <div className="flex flex-col items-center space-y-5 text-center">
                {/* Icon */}
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 text-amber-600 shadow-inner dark:bg-amber-950/30 dark:text-amber-400">
                    <Pill size={38} strokeWidth={2} aria-hidden="true" />
                </div>

                {/* Title */}
                <div className="space-y-1">
                    <h3 className="text-2xl font-black tracking-tight text-amber-700 dark:text-amber-400">
                        {brandName || "Branded Medicine"}
                    </h3>
                    {ingredient && (
                        <p className="text-sm font-semibold text-(--color-text-secondary)">
                            {ingredient.genericName}
                            {dosage && (
                                <span className="text-(--color-text-muted)"> · {dosage}</span>
                            )}
                        </p>
                    )}
                    <p className="text-xs font-medium text-(--color-text-muted)">
                        Not found in CDSCO Database
                    </p>
                </div>

                {/* Batch + Expiry */}
                {(batchNumber || expiryDate) && (
                    <div className="grid w-full grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted) p-3 text-left">
                            <span className="block text-[10px] font-bold tracking-wider text-(--color-text-muted) uppercase">
                                Batch No.
                            </span>
                            <span className="font-bold text-(--color-text-primary)">
                                {batchNumber || "Unknown"}
                            </span>
                        </div>
                        <ExpiryBadge expiryDate={expiryDate} />
                    </div>
                )}

                {/* Manufacturer */}
                {manufacturer && (
                    <div className="flex w-full items-center gap-3 rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted) p-3 text-left">
                        <Building2
                            size={16}
                            className="shrink-0 text-(--color-text-muted)"
                            aria-hidden="true"
                        />
                        <div>
                            <p className="text-[10px] font-bold tracking-wider text-(--color-text-muted) uppercase">
                                Manufacturer
                            </p>
                            <p className="font-semibold text-(--color-text-primary)">
                                {manufacturer}
                            </p>
                        </div>
                    </div>
                )}

                {/* Ingredient Knowledge Card */}
                {ingredient ? (
                    <div className="w-full space-y-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-left dark:border-blue-900/40 dark:bg-blue-950/20">
                        {/* Category badge */}
                        <div className="flex items-center gap-2">
                            <Zap
                                size={14}
                                className="shrink-0 text-blue-600 dark:text-blue-400"
                                aria-hidden="true"
                            />
                            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                                {ingredient.category}
                            </span>
                        </div>

                        {/* Uses */}
                        <div>
                            <p className="mb-1 text-[10px] font-bold tracking-wider text-blue-600 uppercase dark:text-blue-400">
                                Common Uses
                            </p>
                            <p className="text-xs leading-relaxed font-medium text-blue-800 dark:text-blue-200">
                                {ingredient.uses}
                            </p>
                        </div>

                        {/* Common forms */}
                        <div>
                            <p className="mb-1 text-[10px] font-bold tracking-wider text-blue-600 uppercase dark:text-blue-400">
                                Available Forms
                            </p>
                            <p className="text-xs leading-relaxed text-blue-700 dark:text-blue-300">
                                {ingredient.commonForms}
                            </p>
                        </div>

                        {/* Safety note */}
                        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-800/30 dark:bg-amber-950/20">
                            <ShieldAlert
                                size={14}
                                className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
                                aria-hidden="true"
                            />
                            <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-300">
                                <strong>Safety: </strong>
                                {ingredient.safetyNote}
                            </p>
                        </div>
                    </div>
                ) : (
                    /* Fallback when no ingredient match */
                    <div
                        className="flex w-full items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left dark:border-amber-900 dark:bg-amber-950/20"
                        role="alert"
                    >
                        <Info
                            size={18}
                            className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
                            aria-hidden="true"
                        />
                        <p className="text-xs leading-relaxed font-medium text-amber-800 dark:text-amber-300">
                            This appears to be a branded medicine. It was not found in the CDSCO
                            database. Please consult a pharmacist or doctor for information about
                            its uses and safety.
                        </p>
                    </div>
                )}

                {/* CDSCO not found disclaimer */}
                <div
                    className="flex w-full items-start gap-2 rounded-xl bg-(--color-surface-muted) p-3 text-left"
                    role="note"
                >
                    <AlertTriangle
                        size={13}
                        className="mt-0.5 shrink-0 text-(--color-text-muted)"
                        aria-hidden="true"
                    />
                    <p className="text-[10px] leading-relaxed text-(--color-text-muted)">
                        Medicine info above is based on the active ingredient found on the
                        packaging. Always consult a doctor or pharmacist before taking any medicine.
                        If you suspect this medicine is fake, report it.
                    </p>
                </div>

                <ResultActions
                    onScanAgain={onScanAgain}
                    onShare={onShare}
                    shareLabel={shareLabel}
                />
            </div>
        </div>
    );
}
