import React from "react";
import { Link } from "@/i18n/routing";

export interface EmptyStateProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    actionLabel?: string;
    actionHref?: string;
    onAction?: () => void;
    className?: string;
}

export const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
    (
        {
            icon,
            title,
            description,
            actionLabel,
            actionHref,
            onAction,
            className = "",
        },
        ref
    ) => {
        return (
            <div
                ref={ref}
                role="status"
                aria-live="polite"
                className={`animate-in fade-in slide-in-from-bottom-2 flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center duration-300 dark:border-slate-800 dark:bg-slate-900 ${className}`}
            >
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-50 text-slate-500 shadow-sm ring-1 ring-slate-100 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-800">
                    {icon}
                </div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    {title}
                </h2>
                <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
                    {description}
                </p>

                {actionHref && actionLabel && (
                    <Link
                        href={actionHref as any}
                        className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-800 focus:ring-offset-2 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 dark:focus:ring-slate-100"
                    >
                        {actionLabel}
                    </Link>
                )}

                {!actionHref && actionLabel && onAction && (
                    <button
                        onClick={onAction}
                        className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-800 focus:ring-offset-2 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 dark:focus:ring-slate-100"
                    >
                        {actionLabel}
                    </button>
                )}
            </div>
        );
    }
);

EmptyState.displayName = "EmptyState";
