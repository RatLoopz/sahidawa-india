import React from "react";
import { clsx } from "clsx";
import { ChevronRight } from "lucide-react";

interface BreadcrumbItem {
    label: string;
    href?: string;
}

interface BreadcrumbsProps {
    items: BreadcrumbItem[];
    className?: string;
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
    return (
        <nav aria-label="Breadcrumb" className={clsx("mb-4", className)}>
            <ol className="flex flex-wrap items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
                {items.map((item, index) => {
                    const isLast = index === items.length - 1;
                    return (
                        <li key={index} className="flex items-center gap-1">
                            {index > 0 && (
                                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                            )}
                            {isLast ? (
                                <span
                                    className="font-medium text-slate-900 dark:text-white"
                                    aria-current="page"
                                >
                                    {item.label}
                                </span>
                            ) : (
                                <a
                                    href={item.href || "#"}
                                    className="transition hover:text-slate-700 dark:hover:text-slate-200"
                                >
                                    {item.label}
                                </a>
                            )}
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}
