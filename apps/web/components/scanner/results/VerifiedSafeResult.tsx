import { VerifiedMedicine } from "@/lib/api";
import { ShieldCheck } from "@/components/ui/Icons";
import { CdscoStatusBadge } from "./CdscoStatusBadge";
import { AlertTriangle, Check, Copy, Info, ArrowRight } from "lucide-react";
import { ExpiryBadge } from "../ExpiryBadge";
import { ResultActions } from "./ResultActions";
import { formatExpiryForBadge } from "@/lib/medicineDateUtils";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { ExpandableDetails } from "../../ExpandableDetails";

export function VerifiedSafeResult({
    medicine,
    scanMeta,
    onScanAgain,
    onShare,
    onCopyMedicineDetails,
    shareLabel,
    copied,
}: {
    medicine: VerifiedMedicine;
    scanMeta?: {
        recentScanCount24h: number;
        recentScanCount7d: number;
        suspicious: boolean;
        suspicionReasons: string[];
    };
    onScanAgain: () => void;
    onShare: () => void;
    onCopyMedicineDetails: () => void;
    shareLabel: string;
    copied: boolean;
}) {
    const tScan = useTranslations("Scan");
    return (
        <div
            className="relative w-full max-w-sm overflow-hidden rounded-[2.5rem] border border-(--color-border-muted) bg-(--color-surface-page) p-8 text-(--color-text-primary) shadow-2xl"
            role="region"
            aria-label="Verification result - Medicine is verified and safe"
            aria-live="polite"
            aria-atomic="true"
        >
            <div className="absolute top-0 right-0 left-0 h-2 bg-emerald-500"></div>
            <div className="flex flex-col items-center space-y-4 text-center">
                <div className="dark:text-emerald-450 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-inner dark:bg-emerald-950/30">
                    <ShieldCheck size={40} strokeWidth={2.5} />
                </div>
                <div>
                    <h3 className="text-2xl font-black tracking-tight">{medicine.brand_name}</h3>
                    <p className="font-medium text-(--color-text-secondary)">
                        Verified by CDSCO Database
                    </p>
                </div>

                <CdscoStatusBadge status={medicine.cdsco_approval_status} />

                {scanMeta?.suspicious && (
                    <div
                        className="border-amber-250 flex w-full items-start gap-3 rounded-2xl border bg-amber-50 p-4 text-left dark:border-amber-900 dark:bg-amber-950/20"
                        role="alert"
                        aria-live="polite"
                    >
                        <AlertTriangle
                            size={18}
                            className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
                        />
                        <p className="text-xs leading-relaxed font-medium text-amber-800 dark:text-amber-400">
                            {scanMeta.suspicionReasons.join(" ")}
                        </p>
                    </div>
                )}

                <div className="grid w-full grid-cols-2 gap-3 pt-2">
                    <div className="rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted) p-3">
                        <span className="block text-[10px] font-bold tracking-wider text-(--color-text-muted) uppercase">
                            Batch No.
                        </span>
                        <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-(--color-text-primary)">
                                {medicine.batch_number}
                            </span>
                            <button
                                onClick={onCopyMedicineDetails}
                                aria-label={
                                    copied
                                        ? "Medicine details copied to clipboard"
                                        : "Copy medicine details to clipboard"
                                }
                                title={copied ? "Copied!" : "Copy medicine details"}
                                className={`shrink-0 rounded-lg p-1.5 transition-all duration-200 ${
                                    copied
                                        ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400"
                                        : "bg-(--color-surface-muted) text-(--color-text-muted) hover:bg-(--color-border-muted) hover:text-(--color-text-primary)"
                                }`}
                            >
                                {copied ? <Check size={14} strokeWidth={3} /> : <Copy size={14} />}
                            </button>
                        </div>
                    </div>
                    <ExpiryBadge expiryDate={formatExpiryForBadge(medicine.expiry_date)} />
                </div>

                <div className="w-full">
                    <div className="rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted) p-3">
                        <span className="block text-[10px] font-bold tracking-wider text-(--color-text-muted) uppercase">
                            Manufacturer
                        </span>
                        <span className="text-sm font-bold text-(--color-text-primary)">
                            {medicine.manufacturer}
                        </span>
                    </div>
                </div>

                {(medicine.cdsco_approval_status === "recalled" ||
                    medicine.cdsco_approval_status === "banned") && (
                    <div className="border-amber-250 flex w-full items-start gap-3 rounded-2xl border bg-amber-50 p-4 text-left dark:border-amber-900 dark:bg-amber-950/20">
                        <AlertTriangle
                            size={18}
                            className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
                        />
                        <p className="text-xs leading-relaxed font-medium text-amber-800 dark:text-amber-400">
                            This medicine has been <strong>{medicine.cdsco_approval_status}</strong>{" "}
                            by CDSCO. Consult your pharmacist before use.
                        </p>
                    </div>
                )}

                {medicine.cdsco_approval_status === "approved" && (
                    <div className="border-emerald-250 flex w-full items-start gap-3 rounded-2xl border bg-emerald-50 p-4 text-left dark:border-emerald-900 dark:bg-emerald-950/20">
                        <Info
                            size={18}
                            className="dark:text-emerald-450 mt-0.5 shrink-0 text-emerald-600"
                        />
                        <p className="text-xs leading-relaxed font-medium text-emerald-800 dark:text-amber-400">
                            This medicine matches the official records. Always check the physical
                            seal before use.
                        </p>
                    </div>
                )}
                <ExpandableDetails medicine={medicine} />

                {medicine.id && (
                    <Link
                        href={`/calculator?medicineId=${medicine.id}`}
                        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-4 text-sm font-black text-white shadow-lg shadow-emerald-600/15 transition-all duration-200 hover:bg-emerald-500 hover:shadow-emerald-500/25 active:scale-98"
                        aria-label={`Calculate savings for ${medicine.brand_name}`}
                    >
                        <span>{tScan("calculateSavings")}</span>
                        <ArrowRight size={16} />
                    </Link>
                )}

                <ResultActions
                    onScanAgain={onScanAgain}
                    onShare={onShare}
                    shareLabel={shareLabel}
                />
            </div>
        </div>
    );
}
