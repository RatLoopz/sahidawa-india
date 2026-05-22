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

export function EmptyState({
    icon,
    title,
    description,
    actionLabel,
    actionHref,
    onAction,
    className = "",
}: EmptyStateProps) {
    return (
        <div
            className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center ${className}`}
        >
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-50 text-slate-500 shadow-sm ring-1 ring-slate-100">
                {icon}
            </div>
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
            <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>

            {actionHref && actionLabel && (
                <Link
                    href={actionHref as any}
                    className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                    {actionLabel}
                </Link>
            )}

            {!actionHref && actionLabel && onAction && (
                <button
                    onClick={onAction}
                    className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                    {actionLabel}
                </button>
            )}
        </div>
    );
}
