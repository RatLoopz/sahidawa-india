"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";

interface UseCopyToClipboardOptions {
    successMessage?: string;
    errorMessage?: string;
    resetDelay?: number;
}

type CopyFn = (text: string) => Promise<boolean>;

/**
 * Centralized clipboard hook.
 * - Tries navigator.clipboard.writeText() first.
 * - Falls back to a temporary <textarea> + document.execCommand("copy")
 *   if the Clipboard API is unavailable or rejects (non-HTTPS, permissions, etc).
 * - Shows a toast on success/failure and never throws (no unhandled rejections).
 */
export function useCopyToClipboard(options: UseCopyToClipboardOptions = {}): [boolean, CopyFn] {
    const {
        successMessage = "Copied to clipboard!",
        errorMessage = "Failed to copy",
        resetDelay = 2000,
    } = options;

    const [copied, setCopied] = useState(false);

    const fallbackCopy = (value: string): boolean => {
        const textarea = document.createElement("textarea");
        textarea.value = value;
        // Keep it out of view/viewport so it doesn't cause a scroll/flicker
        textarea.style.position = "fixed";
        textarea.style.top = "-9999px";
        textarea.style.left = "-9999px";
        textarea.setAttribute("readonly", "");

        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();

        let success = false;
        try {
            success = document.execCommand("copy");
        } catch {
            success = false;
        } finally {
            document.body.removeChild(textarea);
        }
        return success;
    };

    const copy: CopyFn = useCallback(
        async (text: string) => {
            if (!text) return false;

            let success = false;

            try {
                if (navigator?.clipboard?.writeText) {
                    await navigator.clipboard.writeText(text);
                    success = true;
                } else {
                    success = fallbackCopy(text);
                }
            } catch {
                // Clipboard API unavailable / permission denied / non-secure context
                success = fallbackCopy(text);
            }

            setCopied(success);

            if (success) {
                toast.success(successMessage);
                window.setTimeout(() => setCopied(false), resetDelay);
            } else {
                toast.error(errorMessage);
            }

            return success;
        },
        [successMessage, errorMessage, resetDelay]
    );

    return [copied, copy];
}
