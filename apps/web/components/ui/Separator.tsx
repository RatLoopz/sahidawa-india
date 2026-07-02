import React from "react";
import { clsx } from "clsx";

interface SeparatorProps {
    orientation?: "horizontal" | "vertical";
    label?: string;
    className?: string;
}

export function Separator({ orientation = "horizontal", label, className }: SeparatorProps) {
    if (orientation === "vertical") {
        return (
            <div
                role="separator"
                aria-orientation="vertical"
                className={clsx(
                    "mx-2 inline-block h-full min-h-4 w-px bg-slate-200 dark:bg-slate-700",
                    className
                )}
            />
        );
    }

    if (label) {
        return (
            <div
                role="separator"
                aria-orientation="horizontal"
                className={clsx("flex items-center gap-3", className)}
            >
                <span className="flex-1 border-t border-slate-200 dark:border-slate-700" />
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {label}
                </span>
                <span className="flex-1 border-t border-slate-200 dark:border-slate-700" />
            </div>
        );
    }

    return (
        <hr
            role="separator"
            aria-orientation="horizontal"
            className={clsx("border-t border-slate-200 dark:border-slate-700", className)}
        />
    );
}
