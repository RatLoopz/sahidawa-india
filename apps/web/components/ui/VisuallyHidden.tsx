import React from "react";
import { clsx } from "clsx";

interface VisuallyHiddenProps {
    as?: "span" | "div" | "label";
    children: React.ReactNode;
    className?: string;
}

export function VisuallyHidden({
    as: Component = "span",
    children,
    className,
}: VisuallyHiddenProps) {
    return (
        <Component
            className={clsx(
                "absolute -m-px h-px w-px overflow-hidden border-0 p-0 whitespace-nowrap",
                "clip-[rect(0,0,0,0)]",
                className
            )}
            style={{ clip: "rect(0,0,0,0)" }}
        >
            {children}
        </Component>
    );
}
