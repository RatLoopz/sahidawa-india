"use client";

import React from "react";

interface ComparisonItem {
    label: string;
    value: string;
}

interface ComparisonGridProps {
    items: ComparisonItem[];
}

export function ComparisonGrid({ items }: ComparisonGridProps) {
    return (
        <div className="comparison-grid flex flex-wrap gap-4">
            {items.map((item, index) => (
                <div
                    key={index}
                    className="comparison-grid-cell min-h-0 min-w-0 flex-auto overflow-hidden rounded-2xl border border-slate-100 bg-slate-50 p-3"
                    style={{
                        WebkitFlex: "1 1 auto",
                        flex: "1 1 auto",
                        minHeight: 0,
                    }}
                >
                    <span className="block text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                        {item.label}
                    </span>
                    <span className="mt-1 block text-sm font-bold text-slate-700">
                        {item.value}
                    </span>
                </div>
            ))}
        </div>
    );
}