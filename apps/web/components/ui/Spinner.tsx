import React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const spinnerVariants = cva("inline-block animate-spin rounded-full", {
    variants: {
        size: {
            sm: "h-4 w-4 border-2",
            md: "h-6 w-6 border-2",
            lg: "h-10 w-10 border-3",
        },
        variant: {
            primary: "border-emerald-500 border-t-transparent",
            secondary:
                "border-slate-300 border-t-slate-600 dark:border-slate-600 dark:border-t-slate-300",
            white: "border-white/30 border-t-white",
        },
    },
    defaultVariants: {
        size: "md",
        variant: "primary",
    },
});

interface SpinnerProps
    extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof spinnerVariants> {
    label?: string;
}

export function Spinner({
    size = "md",
    variant = "primary",
    label,
    className,
    ...props
}: SpinnerProps) {
    return (
        <div
            role="status"
            aria-label={label || "Loading"}
            className={cn(spinnerVariants({ size, variant }), className)}
            {...props}
        >
            <span className="sr-only">{label || "Loading..."}</span>
        </div>
    );
}
