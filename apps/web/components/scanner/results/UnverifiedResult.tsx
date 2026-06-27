import { XCircle, Info } from "lucide-react";
import { ExpiryBadge } from "../ExpiryBadge";
import { ResultActions } from "./ResultActions";

export function UnverifiedResult({
    brandName,
    batchNumber,
    expiryDate,
    onScanAgain,
    onShare,
    shareLabel,
}: {
    brandName?: string;
    batchNumber?: string;
    expiryDate?: string;
    onScanAgain: () => void;
    onShare: () => void;
    shareLabel: string;
}) {
    return (
        <div
            className="relative w-full max-w-sm overflow-hidden rounded-[2.5rem] border border-(--color-border-muted) bg-(--color-surface-page) p-8 text-(--color-text-primary) shadow-2xl"
            role="region"
            aria-label={`Unverified result - ${brandName || "Unknown medicine"} not found in CDSCO database`}
            aria-live="polite"
            aria-atomic="true"
        >
            <div className="absolute top-0 right-0 left-0 h-2 bg-amber-500"></div>
            <div className="flex flex-col items-center space-y-4 text-center">
                <div className="dark:text-amber-450 flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 text-amber-600 shadow-inner dark:bg-amber-950/30">
                    <XCircle size={40} strokeWidth={2.5} />
                </div>
                <div>
                    <h3 className="dark:text-amber-450 text-2xl font-black tracking-tight text-amber-700">
                        {brandName || "Unverified Medicine"}
                    </h3>
                    <p className="font-medium text-(--color-text-secondary)">
                        No match found in CDSCO Database
                    </p>
                </div>

                {(batchNumber || expiryDate) && (
                    <div className="grid w-full grid-cols-2 gap-3 pt-2">
                        <div className="rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted) p-3">
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

                <div
                    className="border-amber-250 flex w-full items-start gap-3 rounded-2xl border bg-amber-50 p-4 text-left dark:border-amber-900 dark:bg-amber-950/20"
                    role="alert"
                    aria-live="polite"
                >
                    <Info
                        size={18}
                        className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
                        aria-hidden="true"
                    />
                    <p className="dark:text-amber-450 text-xs leading-relaxed font-medium text-amber-800">
                        No matching record was found for this medicine batch in the CDSCO database.
                        Please verify the spelling or report it if suspicious.
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
