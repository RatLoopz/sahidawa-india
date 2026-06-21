import React from "react";
import { clsx } from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
    current: number;
    total: number;
    onChange: (page: number) => void;
    className?: string;
}

function getPages(current: number, total: number): (number | "...")[] {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: (number | "...")[] = [1];
    if (current > 3) pages.push("...");
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (current < total - 2) pages.push("...");
    pages.push(total);
    return pages;
}

export function Pagination({ current, total, onChange, className }: PaginationProps) {
    if (total <= 1) return null;
    const pages = getPages(current, total);

    const btnBase = "inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium transition";
    const btnActive = "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-100";
    const btnInactive = "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800";
    const btnDisabled = "cursor-not-allowed opacity-40";

    return (
        <nav aria-label="Pagination" className={clsx("flex items-center gap-1", className)}>
            <button
                onClick={() => onChange(current - 1)}
                disabled={current <= 1}
                className={clsx(btnBase, btnInactive, current <= 1 && btnDisabled)}
                aria-label="Previous page"
            >
                <ChevronLeft className="h-4 w-4" />
            </button>
            {pages.map((page, i) =>
                page === "..." ? (
                    <span key={`ellipsis-${i}`} className="px-2 text-slate-400">...</span>
                ) : (
                    <button
                        key={page}
                        onClick={() => onChange(page)}
                        className={clsx(btnBase, page === current ? btnActive : btnInactive)}
                        aria-current={page === current ? "page" : undefined}
                    >
                        {page}
                    </button>
                ),
            )}
            <button
                onClick={() => onChange(current + 1)}
                disabled={current >= total}
                className={clsx(btnBase, btnInactive, current >= total && btnDisabled)}
                aria-label="Next page"
            >
                <ChevronRight className="h-4 w-4" />
            </button>
        </nav>
    );
}
