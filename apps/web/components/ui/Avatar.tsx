import React from "react";
import { clsx } from "clsx";

const sizes = {
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-16 w-16 text-lg",
};

interface AvatarProps {
    src?: string;
    alt?: string;
    fallback?: string;
    size?: keyof typeof sizes;
    showStatus?: boolean;
    status?: "online" | "offline" | "away";
    className?: string;
}

function getInitials(name: string): string {
    return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
}

export function Avatar({
    src,
    alt = "",
    fallback,
    size = "md",
    showStatus,
    status = "online",
    className,
}: AvatarProps) {
    const [imgError, setImgError] = React.useState(false);
    const initials = fallback ? getInitials(fallback) : "?";

    return (
        <span className={clsx("relative inline-flex shrink-0", className)}>
            {src && !imgError ? (
                <img
                    src={src}
                    alt={alt}
                    onError={() => setImgError(true)}
                    className={clsx("rounded-full object-cover", sizes[size])}
                />
            ) : (
                <span
                    className={clsx(
                        "inline-flex items-center justify-center rounded-full bg-slate-200 font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300",
                        sizes[size]
                    )}
                    aria-hidden="true"
                >
                    {initials}
                </span>
            )}
            {showStatus && (
                <span
                    className={clsx(
                        "absolute right-0 bottom-0 block h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-slate-900",
                        status === "online" && "bg-emerald-500",
                        status === "away" && "bg-amber-500",
                        status === "offline" && "bg-slate-400"
                    )}
                    aria-label={`${status}`}
                />
            )}
        </span>
    );
}
