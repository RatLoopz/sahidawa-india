import { AlertCircle, X } from "lucide-react";

export function ErrorResult({
    message,
    onRetry,
    onClose,
    isOffline,
}: {
    message: string;
    onRetry: () => void;
    onClose?: () => void;
    isOffline?: boolean;
}) {
    return (
        <div
            className="relative w-full max-w-[640px] overflow-hidden rounded-[2.5rem] border border-(--color-border-muted) bg-(--color-surface-page) p-10 text-(--color-text-primary) shadow-2xl"
            role="region"
            aria-label={isOffline ? "Connection lost error" : "Verification failed error"}
            aria-live="assertive"
            aria-atomic="true"
        >
            {/* Close Button */}
            {onClose && (
                <button
                    onClick={onClose}
                    className="absolute top-5 right-5 z-20 rounded-full bg-slate-100/80 p-2 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-800 dark:bg-slate-800/80 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                    aria-label="Close error result"
                    title="Close"
                >
                    <X size={16} strokeWidth={2.5} />
                </button>
            )}
            <div className="absolute top-0 right-0 left-0 h-2 bg-slate-400"></div>
            <div className="flex flex-col items-center space-y-4 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-(--color-surface-muted) text-(--color-text-secondary) shadow-inner">
                    <AlertCircle size={40} strokeWidth={2.5} />
                </div>
                <div>
                    <h3 className="text-2xl font-black tracking-tight text-(--color-text-primary)">
                        {isOffline ? "Connection Lost" : "Verification Failed"}
                    </h3>
                    <p className="text-sm font-medium whitespace-pre-wrap text-slate-500">
                        {message}
                    </p>
                </div>

                <button
                    onClick={onRetry}
                    disabled={isOffline}
                    className="w-full rounded-2xl bg-slate-900 py-4 font-bold text-white shadow-lg shadow-slate-900/20 transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                    aria-label={
                        isOffline
                            ? "Waiting for internet connection to retry"
                            : "Retry medicine verification"
                    }
                >
                    {isOffline ? "Waiting for connection..." : "Try Again"}
                </button>
            </div>
        </div>
    );
}
