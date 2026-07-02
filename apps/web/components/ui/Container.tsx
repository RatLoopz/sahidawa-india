import React from "react";
import { clsx } from "clsx";

type ContainerElement = "div" | "section" | "article" | "main" | "header" | "footer";

interface ContainerProps {
    as?: ContainerElement;
    narrow?: boolean;
    className?: string;
    children: React.ReactNode;
}

export function Container({
    as: Component = "div",
    narrow = false,
    className,
    children,
}: ContainerProps) {
    return (
        <Component
            className={clsx("mx-auto w-full px-4", narrow ? "max-w-3xl" : "max-w-6xl", className)}
        >
            {children}
        </Component>
    );
}
