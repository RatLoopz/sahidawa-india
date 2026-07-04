"use client";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import React from "react";
import { clsx } from "clsx";

type TooltipPosition = "top" | "bottom" | "left" | "right";

interface TooltipProps {
    content: string;
    position?: TooltipPosition;
    delay?: number;
    children: React.ReactElement<{ className?: string }>;
    className?: string;
}

export function Tooltip({
    content,
    position = "top",
    delay = 300,
    children,
    className,
}: TooltipProps) {
    const trigger = React.Children.only(children);

    return (
        <TooltipPrimitive.Provider delayDuration={delay} skipDelayDuration={delay}>
            <TooltipPrimitive.Root delayDuration={delay}>
                <TooltipPrimitive.Trigger asChild>
                    {React.cloneElement(trigger, {
                        className: clsx(trigger.props.className, className),
                    })}
                </TooltipPrimitive.Trigger>
                <TooltipPrimitive.Portal>
                    <TooltipPrimitive.Content
                        side={position}
                        align="center"
                        sideOffset={8}
                        className="pointer-events-none z-50 rounded-md bg-slate-900 px-2 py-1 text-xs whitespace-nowrap text-white shadow-lg transition-opacity dark:bg-slate-100 dark:text-slate-900"
                    >
                        {content}
                    </TooltipPrimitive.Content>
                </TooltipPrimitive.Portal>
            </TooltipPrimitive.Root>
        </TooltipPrimitive.Provider>
    );
}
