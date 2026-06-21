"use client";
import React, { useState } from "react";
import { clsx } from "clsx";
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from "lucide-react";

const variants = {
    info: { container: "bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800", icon: "text-blue-500", Icon: Info },
    success: { container: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950 dark:border-emerald-800", icon: "text-emerald-500", Icon: CheckCircle2 },
    warning: { container: "bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800", icon: "text-amber-500", Icon: AlertTriangle },
    error: { container: "bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800", icon: "text-red-500", Icon: AlertCircle },
};

interface AlertProps {
    variant?: keyof typeof variants;
    title?: string;
    children: React.ReactNode;
    dismissible?: boolean;
    className?: string;
}

export function Alert({ variant = "info", title, children, dismissible, className }: AlertProps) {
    const [dismissed, setDismissed] = useState(false);
    const { container, icon, Icon } = variants[variant];

    if (dismissed) return null;

    return (
        <div role="alert" className={clsx("relative flex gap-3 rounded-lg border p-4", container, className)}>
            <Icon className={clsx("mt-0.5 h-5 w-5 shrink-0", icon)} aria-hidden="true" />
            <div className="flex-1">
                {title && <p className="font-semibold text-slate-900 dark:text-white">{title}</p>}
                <div className="text-sm text-slate-700 dark:text-slate-300">{children}</div>
            </div>
            {dismissible && (
                <button onClick={() => setDismissed(true)} className="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" aria-label="Dismiss">
                    <X className="h-4 w-4" />
                </button>
            )}
        </div>
    );
}
