"use client";
import React, { useState } from "react";
import { clsx } from "clsx";

type TooltipPosition = "top" | "bottom" | "left" | "right";

interface TooltipProps {
    content: string;
    position?: TooltipPosition;
    delay?: number;
    children: React.ReactNode;
    className?: string;
}

const positionStyles: Record<TooltipPosition, string> = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
};

export function Tooltip({ content, position = "top", delay = 300, children, className }: TooltipProps) {
    const [visible, setVisible] = useState(false);
    let timer: ReturnType<typeof setTimeout>;

    const show = () => {
        timer = setTimeout(() => setVisible(true), delay);
    };
    const hide = () => {
        clearTimeout(timer);
        setVisible(false);
    };

    return (
        <span
            className={clsx("relative inline-flex", className)}
            onMouseEnter={show}
            onMouseLeave={hide}
            onFocus={show}
            onBlur={hide}
        >
            {children}
            <span
                role="tooltip"
                className={clsx(
                    "pointer-events-none absolute z-50 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs text-white opacity-0 shadow-lg transition-opacity dark:bg-slate-100 dark:text-slate-900",
                    positionStyles[position],
                    visible && "opacity-100",
                )}
            >
                {content}
            </span>
        </span>
    );
}
