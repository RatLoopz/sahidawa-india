import React from "react";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info";
    children: React.ReactNode;
}

export function Badge({ variant = "default", className = "", children, ...props }: BadgeProps) {
    const baseStyles = "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold";

    const variantStyles = {
        default:
            "bg-emerald-100 text-emerald-700 border border-emerald-300 dark:bg-emerald-900 dark:text-emerald-100 dark:border-emerald-700",
        secondary:
            "bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600",
        destructive:
            "bg-red-100 text-red-700 border border-red-300 dark:bg-red-900 dark:text-red-100 dark:border-red-700",
        outline: "border border-slate-300 text-slate-700 dark:border-slate-600 dark:text-slate-200",
        success:
            "bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
        warning:
            "bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
        info:
            "bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
    };

    return (
        <span className={`${baseStyles} ${variantStyles[variant]} ${className}`} {...props}>
            {children}
        </span>
    );
}
