import React from "react";
import { clsx } from "clsx";

const variants = {
    default: "bg-emerald-500",
    warning: "bg-amber-500",
    danger: "bg-red-500",
};

const sizes = {
    sm: "h-1.5",
    md: "h-2.5",
};

interface ProgressProps {
    value: number;
    variant?: keyof typeof variants;
    size?: keyof typeof sizes;
    label?: string;
    className?: string;
}

export function Progress({ value, variant = "default", size = "md", label, className }: ProgressProps) {
    const clamped = Math.max(0, Math.min(100, value));

    return (
        <div
            role="progressbar"
            aria-valuenow={clamped}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={label || `Progress: ${clamped}%`}
            className={clsx("w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800", sizes[size], className)}
        >
            <div
                className={clsx(
                    "h-full rounded-full transition-all duration-500 ease-out",
                    variants[variant],
                )}
                style={{ width: `${clamped}%` }}
            />
        </div>
    );
}
