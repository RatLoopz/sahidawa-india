import React from "react";
import { clsx } from "clsx";

interface KbdProps {
    children: React.ReactNode;
    className?: string;
}

export function Kbd({ children, className }: KbdProps) {
    return (
        <kbd
            className={clsx(
                "inline-flex items-center justify-center rounded-md border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-mono text-xs font-medium text-slate-600 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300",
                className,
            )}
        >
            {children}
        </kbd>
    );
}
