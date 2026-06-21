import React from "react";
import { clsx } from "clsx";

const sizes = {
    sm: "h-4 w-4 border-2",
    md: "h-6 w-6 border-2",
    lg: "h-10 w-10 border-3",
};

const variants = {
    primary: "border-emerald-500 border-t-transparent",
    secondary: "border-slate-300 border-t-slate-600 dark:border-slate-600 dark:border-t-slate-300",
    white: "border-white/30 border-t-white",
};

interface SpinnerProps {
    size?: keyof typeof sizes;
    variant?: keyof typeof variants;
    label?: string;
    className?: string;
}

export function Spinner({ size = "md", variant = "primary", label, className }: SpinnerProps) {
    return (
        <div
            role="status"
            aria-label={label || "Loading"}
            className={clsx(
                "inline-block animate-spin rounded-full",
                sizes[size],
                variants[variant],
                className,
            )}
        >
            <span className="sr-only">{label || "Loading..."}</span>
        </div>
    );
}
