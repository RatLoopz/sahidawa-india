/**
 * useExpiryIO.ts
 * Custom hook that encapsulates all JSON export / import logic for the
 * expiry-tracker feature.
 *
 * Responsibilities:
 *  - handleExport  → creates a JSON blob and triggers a browser download
 *  - handleImport  → reads a user-selected .json file, validates its contents,
 *                    deduplicates against the current list, and calls onMerge
 *  - importError   → surfaces validation/parse errors to the UI
 *  - fileInputRef  → ref for the hidden <input type="file"> element
 */
"use client";
import React, { useState, useRef, useCallback } from "react";
import { Medicine } from "./useMedicineTracker";
import { isValidDateString } from "../app/[locale]/expiry-tracker/components/expiryUtils";

export interface UseExpiryIOReturn {
    importError: string | null;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    handleExport: () => void;
    handleImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

/**
 * @param medicines      Current medicine list (read-only; used for export and deduplication).
 * @param onMerge        Called with the merged list after a successful import.
 * @param errorMessages  Localised error strings so the hook stays i18n-agnostic.
 */
export function useExpiryIO(
    medicines: Medicine[],
    onMerge: (merged: Medicine[]) => void,
    errorMessages: { importError: string; importDateError: string }
): UseExpiryIOReturn {
    const [importError, setImportError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ── Export ────────────────────────────────────────────────────────────────
    const handleExport = useCallback(() => {
        const blob = new Blob([JSON.stringify(medicines, null, 2)], {
            type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "sahidawa_expiry_backup.json";
        a.click();
        URL.revokeObjectURL(url);
    }, [medicines]);

    // ── Import ────────────────────────────────────────────────────────────────
    const handleImport = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            setImportError(null);
            const file = e.target.files?.[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const parsed = JSON.parse(event.target?.result as string);
                    if (!Array.isArray(parsed)) throw new Error("Not an array");

                    const valid = parsed.filter(
                        (item) =>
                            typeof item.id === "string" &&
                            typeof item.name === "string" &&
                            typeof item.expiryDate === "string" &&
                            isValidDateString(item.expiryDate)
                    );

                    if (valid.length !== parsed.length) {
                        setImportError(errorMessages.importDateError);
                        return;
                    }

                    const existingIds = new Set(medicines.map((m) => m.id));
                    const merged = [...medicines, ...valid.filter((m) => !existingIds.has(m.id))];
                    onMerge(merged);
                } catch {
                    setImportError(errorMessages.importError);
                }
            };
            reader.readAsText(file);

            // Reset so the same file can be re-imported if needed
            e.target.value = "";
        },
        [medicines, onMerge, errorMessages]
    );

    return { importError, fileInputRef, handleExport, handleImport };
}
