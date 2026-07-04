import { ReactNode } from "react";
import { AlertTriangle, CheckCircle, XCircle } from "lucide-react";

import { ExpiryBadge } from "../ExpiryBadge";
import { ResultActions } from "./ResultActions";

type VerificationStatus = "real" | "suspicious" | "fake";

interface MedicineVerificationResultCardProps {
    status: VerificationStatus;

    title: string;
    subtitle: string;

    manufacturer?: string;
    batchNumber?: string;
    expiryDate?: string;

    infoMessage?: ReactNode;
    children?: ReactNode;

    onScanAgain: () => void;
    onShare: () => void;
    shareLabel: string;
}

const STATUS_CONFIG = {
    real: {
        icon: CheckCircle,
        topBar: "bg-emerald-500",
        iconClass: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/30",
    },
    suspicious: {
        icon: AlertTriangle,
        topBar: "bg-amber-500",
        iconClass: "bg-amber-100 text-amber-600 dark:bg-amber-950/30",
    },
    fake: {
        icon: XCircle,
        topBar: "bg-red-500",
        iconClass: "bg-red-100 text-red-600 dark:bg-red-950/30",
    },
};

export function MedicineVerificationResultCard({
    status,
    title,
    subtitle,
    manufacturer,
    batchNumber,
    expiryDate,
    infoMessage,
    children,
    onScanAgain,
    onShare,
    shareLabel,
}: MedicineVerificationResultCardProps) {
    const config = STATUS_CONFIG[status];
    const Icon = config.icon;

    return (
        <div
            role="status"
            aria-live="polite"
            className="relative w-full max-w-sm overflow-hidden rounded-[2.5rem] border border-(--color-border-muted) bg-(--color-surface-page) p-8 text-(--color-text-primary) shadow-2xl"
        >
            <div className={`absolute top-0 right-0 left-0 h-2 ${config.topBar}`} />

            <div className="flex flex-col items-center space-y-4 text-center">
                <div
                    className={`flex h-20 w-20 items-center justify-center rounded-full shadow-inner ${config.iconClass}`}
                >
                    <Icon size={40} strokeWidth={2.5} />
                </div>

                <div>
                    <h3 className="text-2xl font-black tracking-tight">{title}</h3>

                    <p className="font-medium text-(--color-text-secondary)">{subtitle}</p>
                </div>

                {(batchNumber || manufacturer) && (
                    <div className="grid w-full grid-cols-2 gap-3 pt-2">
                        {batchNumber && (
                            <div className="rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted) p-3">
                                <span className="block text-[10px] font-bold tracking-wider text-(--color-text-muted) uppercase">
                                    Batch No.
                                </span>

                                <span className="font-bold text-(--color-text-primary)">
                                    {batchNumber}
                                </span>
                            </div>
                        )}

                        {expiryDate ? (
                            <ExpiryBadge expiryDate={expiryDate} />
                        ) : manufacturer ? (
                            <div className="rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted) p-3">
                                <span className="block text-[10px] font-bold tracking-wider text-(--color-text-muted) uppercase">
                                    Manufacturer
                                </span>

                                <span className="text-sm font-bold text-(--color-text-primary)">
                                    {manufacturer}
                                </span>
                            </div>
                        ) : null}
                    </div>
                )}

                {manufacturer && expiryDate && (
                    <div className="w-full rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted) p-3">
                        <span className="block text-[10px] font-bold tracking-wider text-(--color-text-muted) uppercase">
                            Manufacturer
                        </span>

                        <span className="text-sm font-bold text-(--color-text-primary)">
                            {manufacturer}
                        </span>
                    </div>
                )}

                {infoMessage && <div className="w-full">{infoMessage}</div>}

                {children}

                <ResultActions
                    onScanAgain={onScanAgain}
                    onShare={onShare}
                    shareLabel={shareLabel}
                />
            </div>
        </div>
    );
}
