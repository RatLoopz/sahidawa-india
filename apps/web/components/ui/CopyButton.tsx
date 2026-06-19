"use client";

import React, { useState } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { clsx } from "clsx";

interface CopyButtonProps {
    text: string;
    className?: string;
    toastMessage?: string;
}

export const CopyButton = ({
    text,
    className,
    toastMessage = "Copied to clipboard!",
}: CopyButtonProps) => {
    const [isCopied, setIsCopied] = useState(false);

    const handleCopy = async (e: React.MouseEvent) => {
        // Stop propagation to prevent parent card click handlers (like map centering) from triggering
        e.stopPropagation();
        e.preventDefault();

        try {
            await navigator.clipboard.writeText(text);
            setIsCopied(true);
            toast.success(toastMessage);

            // Revert icon back to Copy after 2 seconds
            setTimeout(() => setIsCopied(false), 2000);
        } catch {
            toast.error("Failed to copy");
        }
    };

    return (
        <button
            onClick={handleCopy}
            className={clsx(
                "inline-flex items-center justify-center rounded-md p-1.5 transition-all hover:bg-slate-100 active:scale-95 dark:hover:bg-slate-800",
                className
            )}
            aria-label="Copy to clipboard"
        >
            {isCopied ? (
                <Check className="h-4 w-4 text-emerald-600" />
            ) : (
                <Copy className="h-4 w-4 text-slate-400" />
            )}
        </button>
    );
};
