import React from "react";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Skeleton({ className = "", ...props }: SkeletonProps) {
    return (
        <div
            className={`relative overflow-hidden rounded-md bg-slate-200 dark:bg-slate-800 before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent ${className}`}
            {...props}
        />
    );
}
