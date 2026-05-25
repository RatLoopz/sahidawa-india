import type { ReactNode } from "react";

type LiveMessageTone = "critical" | "polite";
type LiveMessageElement = "div" | "p" | "span";

interface LiveMessageProps {
    as?: LiveMessageElement;
    children: ReactNode;
    className?: string;
    describedBy?: string;
    id?: string;
    tone?: LiveMessageTone;
}

export function LiveMessage({
    as: Component = "div",
    children,
    className,
    describedBy,
    id,
    tone = "critical",
}: LiveMessageProps) {
    const liveProps =
        tone === "critical"
            ? { role: "alert" as const, "aria-live": "assertive" as const }
            : { role: "status" as const, "aria-live": "polite" as const };

    return (
        <Component
            id={id}
            className={className}
            aria-atomic="true"
            aria-describedby={describedBy}
            {...liveProps}
        >
            {children}
        </Component>
    );
}
