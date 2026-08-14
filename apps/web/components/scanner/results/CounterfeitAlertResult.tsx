import { VerifiedMedicine } from "@/lib/api";
import { AlertTriangle, Check, Copy, MessageCircle, X } from "lucide-react";
import { ResultActions } from "./ResultActions";
export function CounterfeitAlertResult({
    medicine,
    onScanAgain,
    onShare,
    onShareToWhatsApp,
    onCopyMedicineDetails,
    shareLabel,
    whatsappLabel,
    copied,
}: {
    medicine: VerifiedMedicine;
    onScanAgain: () => void;
    onShare: () => void;
    onShareToWhatsApp: () => void;
    onCopyMedicineDetails: () => void;
    shareLabel: string;
    whatsappLabel: string;
    copied: boolean;
}) {
    return (
        <div
            className="relative w-full max-w-[640px] overflow-hidden rounded-[2.5rem] border border-(--color-border-muted) bg-(--color-surface-page) p-10 text-(--color-text-primary) shadow-2xl"
            role="region"
            aria-label="Counterfeit alert - Medicine flagged as counterfeit"
            aria-live="assertive"
            aria-atomic="true"
        >
            {/* Close Button */}
            <button
                onClick={onScanAgain}
                className="absolute top-5 right-5 z-20 rounded-full bg-slate-100/80 p-2 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-800 dark:bg-slate-800/80 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                aria-label="Close result"
                title="Close"
            >
                <X size={16} strokeWidth={2.5} />
            </button>
            <div className="absolute top-0 right-0 left-0 h-2 bg-red-500"></div>
            <div className="flex flex-col items-center space-y-4 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-100 text-red-600 shadow-inner dark:bg-red-950/30 dark:text-red-400">
                    <AlertTriangle size={40} strokeWidth={2.5} />
                </div>
                <div>
                    <h3 className="text-2xl font-black tracking-tight text-red-700 dark:text-red-400">
                        Counterfeit Alert
                    </h3>
                    <p className="font-medium text-(--color-text-secondary)">
                        {medicine.brand_name}
                    </p>
                </div>

                <div className="grid w-full grid-cols-2 gap-3 pt-2">
                    <div className="border-red-250/30 rounded-2xl border bg-red-500/10 p-3 dark:border-red-900/30">
                        <span className="block text-[10px] font-bold tracking-wider text-red-400 uppercase dark:text-red-500/80">
                            Batch No.
                        </span>
                        <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-red-700 dark:text-red-400">
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
                                        ? "bg-red-100 text-red-600 dark:bg-red-950/30 dark:text-red-400"
                                        : "bg-(--color-surface-muted) text-(--color-text-muted) hover:bg-(--color-border-muted) hover:text-(--color-text-primary)"
                                }`}
                            >
                                {copied ? <Check size={14} strokeWidth={3} /> : <Copy size={14} />}
                            </button>
                        </div>
                    </div>
                    <div className="border-red-250/30 rounded-2xl border bg-red-500/10 p-3 dark:border-red-900/30">
                        <span className="block text-[10px] font-bold tracking-wider text-red-400 uppercase dark:text-red-500/80">
                            Manufacturer
                        </span>
                        <span className="text-sm font-bold text-red-700 dark:text-red-400">
                            {medicine.manufacturer}
                        </span>
                    </div>
                </div>

                <div
                    className="border-red-250 flex w-full items-start gap-3 rounded-2xl border bg-red-50 p-4 text-left dark:border-red-900 dark:bg-red-950/20"
                    role="alert"
                    aria-live="assertive"
                >
                    <AlertTriangle
                        size={18}
                        className="mt-0.5 shrink-0 text-red-600 dark:text-red-400"
                        aria-hidden="true"
                    />
                    <p className="text-xs leading-relaxed font-bold text-red-800 dark:text-red-400">
                        WARNING: This medicine has been flagged as counterfeit. Do NOT consume.
                        Report to your nearest pharmacy or call the CDSCO helpline immediately.
                    </p>
                </div>

                {/* WhatsApp is the primary channel for sharing health alerts in
                    India, so surface a dedicated one-tap action (works on desktop
                    too, where the OS share sheet is usually unavailable). */}
                <button
                    type="button"
                    onClick={onShareToWhatsApp}
                    aria-label={whatsappLabel}
                    className="no-print flex w-full items-center justify-center gap-2 rounded-2xl bg-green-600 py-3.5 font-bold text-white shadow-lg shadow-green-600/20 transition-all hover:bg-green-700 focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                    <MessageCircle size={18} aria-hidden="true" />
                    <span>{whatsappLabel}</span>
                </button>

                <ResultActions
                    onScanAgain={onScanAgain}
                    onShare={onShare}
                    shareLabel={shareLabel}
                />
            </div>
        </div>
    );
}
