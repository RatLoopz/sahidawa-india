import { Home, Share2 } from "lucide-react";
import { Link } from "@/i18n/routing";

export function ResultActions({
    onScanAgain,
    onShare,
    shareLabel,
}: {
    onScanAgain: () => void;
    onShare: () => void;
    shareLabel: string;
}) {
    return (
        <div className="no-print grid w-full grid-cols-1 gap-3">
            <button
                onClick={onScanAgain}
                className="w-full rounded-2xl bg-slate-900 py-4 font-bold text-white shadow-lg shadow-slate-900/20 transition-all hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
            >
                Scan Another
            </button>
            <div className="grid grid-cols-2 gap-3">
                <Link
                    href="/"
                    className="flex items-center justify-center gap-2 rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted) py-3.5 font-semibold text-(--color-text-primary) transition-all hover:bg-(--color-border-muted)"
                >
                    <Home size={18} />
                    <span>Home</span>
                </Link>
                <button
                    onClick={onShare}
                    className="flex items-center justify-center gap-2 rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted) py-3.5 font-semibold text-(--color-text-primary) transition-all hover:bg-(--color-border-muted)"
                >
                    <Share2 size={18} />
                    <span>{shareLabel}</span>
                </button>
            </div>
        </div>
    );
}
