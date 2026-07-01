"use client";

import { AlertTriangle, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";

interface ConfirmationDialogProps {
    isOpen: boolean;
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    variant?: "danger" | "warning";
    onConfirm: () => void | Promise<void>;
    onCancel: () => void;
    isLoading?: boolean;
}

export function ConfirmationDialog({
    isOpen,
    title,
    description,
    confirmText = "Delete",
    cancelText = "Cancel",
    variant = "danger",
    onConfirm,
    onCancel,
    isLoading = false,
}: ConfirmationDialogProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isButtonEnabled, setIsButtonEnabled] = useState(false);
    useFocusTrap(containerRef, isOpen);

    // Enable confirm button after 500ms delay to prevent accidental clicks
    useEffect(() => {
        if (!isOpen) {
            setIsButtonEnabled(false);
            return;
        }

        const timer = setTimeout(() => {
            setIsButtonEnabled(true);
        }, 500);

        return () => clearTimeout(timer);
    }, [isOpen]);

    if (!isOpen) return null;

    const handleConfirm = async () => {
        if (isButtonEnabled && !isLoading) {
            await onConfirm();
        }
    };

    const handleEscape = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === "Escape" && !isLoading) {
            onCancel();
        }
    };

    const accentBg =
        variant === "danger"
            ? "bg-red-50 dark:bg-red-950/20"
            : "bg-orange-50 dark:bg-orange-950/20";
    const accentBorder =
        variant === "danger"
            ? "border-red-200 dark:border-red-900"
            : "border-orange-200 dark:border-orange-900";
    const accentText =
        variant === "danger"
            ? "text-red-700 dark:text-red-300"
            : "text-orange-700 dark:text-orange-300";
    const accentIcon =
        variant === "danger"
            ? "text-red-600 dark:text-red-400"
            : "text-orange-600 dark:text-orange-400";
    const confirmButtonBg =
        variant === "danger"
            ? "bg-red-600 hover:bg-red-700 disabled:bg-red-400"
            : "bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400";

    return (
        <div
            ref={containerRef}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirmation-title"
            aria-describedby="confirmation-description"
            onKeyDown={handleEscape}
        >
            <div
                className={`relative w-full max-w-sm rounded-2xl border ${accentBorder} ${accentBg} p-6 shadow-2xl`}
            >
                {/* Close button */}
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={isLoading}
                    className="absolute top-4 right-4 rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-200/50 disabled:cursor-not-allowed dark:hover:bg-slate-700/50"
                    aria-label="Close dialog"
                >
                    <X size={20} />
                </button>

                {/* Header with icon */}
                <div className="mb-4 flex items-start gap-3">
                    <div className={`mt-0.5 flex-shrink-0 ${accentIcon}`}>
                        <AlertTriangle size={24} />
                    </div>
                    <div className="flex-1 pr-8">
                        <h2
                            id="confirmation-title"
                            className={`text-lg font-bold ${accentText}`}
                        >
                            {title}
                        </h2>
                    </div>
                </div>

                {/* Description */}
                <p
                    id="confirmation-description"
                    className="mb-6 text-sm text-slate-600 dark:text-slate-300"
                >
                    {description}
                </p>

                {/* Action buttons */}
                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={isLoading}
                        className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                    >
                        {cancelText}
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={!isButtonEnabled || isLoading}
                        className={`flex-1 rounded-lg px-4 py-2.5 font-medium text-white transition-all ${confirmButtonBg} disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                        {isLoading ? "Deleting..." : confirmText}
                    </button>
                </div>

                {/* Accessibility hint */}
                {!isButtonEnabled && (
                    <p className="sr-only" role="status" aria-live="polite">
                        Delete button will be available in a moment
                    </p>
                )}
            </div>
        </div>
    );
}
