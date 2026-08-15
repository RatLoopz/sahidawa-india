"use client";

import React, { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
    Check,
    Plus,
    AlertCircle,
    Clock,
    Heart,
    ShieldAlert,
    FileText,
    Info,
    Volume2,
    Square,
    Loader2,
} from "lucide-react";
import { ScannerResult } from "./PrescriptionUpload";
import { useMedicineTracker } from "@/hooks/useMedicineTracker";
import { toast } from "sonner";
import { useRouter } from "@/i18n/routing";
import { useCloudTTS } from "@/app/[locale]/voice/lib/useCloudTTS";
import { getVoiceLanguageForLocale } from "@/app/[locale]/voice/lib/languages";

interface DecodedResultsProps {
    data: ScannerResult;
}

/**
 * Strip markdown / bullet formatting so the TTS engine reads the text
 * naturally instead of spelling out asterisks and dashes.
 */
function cleanTextForSpeech(text: string): string {
    return text
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/[*_`#>]/g, "")
        .replace(/^\s*[-•]\s+/gm, "")
        .replace(/\n{2,}/g, ". ")
        .replace(/\s+/g, " ")
        .trim();
}

/** Build a single, naturally-worded sentence for each decoded medicine. */
function buildSpeechScript(data: ScannerResult): string {
    return data.medicines
        .map((med, idx) => {
            const parts: string[] = [`Medicine ${idx + 1}: ${med.name}.`];
            if (med.dosage) parts.push(`Dosage: ${med.dosage}.`);
            if (med.simpleTiming || med.timing) {
                parts.push(`Timing: ${med.simpleTiming || med.timing}.`);
            }
            if (med.instructions) parts.push(med.instructions);
            if (med.purpose) parts.push(`Purpose: ${med.purpose}.`);
            return parts.join(" ");
        })
        .join(". ");
}

const PlayAudioButton: React.FC<{ data: ScannerResult }> = ({ data }) => {
    const t = useTranslations("Scanner");
    const locale = useLocale();
    const { playTTS, stopTTS, isLoading, isPlaying } = useCloudTTS();
    const [hasError, setHasError] = useState(false);

    const languageCode = useMemo(() => getVoiceLanguageForLocale(locale), [locale]);
    const script = useMemo(() => cleanTextForSpeech(buildSpeechScript(data)), [data]);

    if (!script) {
        return (
            <span className="text-xs text-gray-400" role="note">
                {t("audioUnavailable")}
            </span>
        );
    }

    const handleClick = async () => {
        if (isPlaying) {
            stopTTS();
            return;
        }

        setHasError(false);
        try {
            await playTTS(script, languageCode);
        } catch {
            // Cloud TTS failed — fall back to the browser's native speech
            // synthesis so the feature still works offline / without keys.
            if (typeof window !== "undefined" && "speechSynthesis" in window) {
                try {
                    window.speechSynthesis.cancel();
                    const utterance = new SpeechSynthesisUtterance(script);
                    utterance.lang = languageCode;
                    window.speechSynthesis.speak(utterance);
                } catch {
                    setHasError(true);
                    toast.error(t("audioError"));
                }
            } else {
                setHasError(true);
                toast.error(t("audioError"));
            }
        }
    };

    const label = isLoading ? t("loadingAudio") : isPlaying ? t("stopAudio") : t("playAudio");

    return (
        <button
            type="button"
            onClick={handleClick}
            disabled={isLoading}
            aria-live="polite"
            aria-label={label}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-70 sm:w-auto"
        >
            {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
            ) : isPlaying ? (
                <Square className="h-5 w-5" />
            ) : (
                <Volume2 className="h-5 w-5" />
            )}
            {label}
            {hasError && !isLoading && !isPlaying && (
                <span className="sr-only">{t("audioError")}</span>
            )}
        </button>
    );
};

export const DecodedResults: React.FC<DecodedResultsProps> = ({ data }) => {
    const t = useTranslations("Scanner");
    const { addMedicine } = useMedicineTracker();
    const router = useRouter();
    const [isAdding, setIsAdding] = useState(false);
    const [added, setAdded] = useState(false);

    const handleAddAll = async () => {
        setIsAdding(true);
        try {
            // Default expiry date: 1 year from now as a placeholder
            const placeholderExpiry = new Date();
            placeholderExpiry.setFullYear(placeholderExpiry.getFullYear() + 1);
            const expiryString = placeholderExpiry.toISOString().split("T")[0];

            for (const med of data.medicines) {
                // Compile all the AI extracted data into the notes field
                const notesParts = [];
                if (med.dosage) notesParts.push(`Dosage: ${med.dosage}`);
                if (med.timing || med.simpleTiming)
                    notesParts.push(`Timing: ${med.simpleTiming || med.timing}`);
                if (med.instructions) notesParts.push(`Instructions: ${med.instructions}`);
                if (med.purpose) notesParts.push(`Purpose: ${med.purpose}`);
                if (med.side_effects) notesParts.push(`Side Effects: ${med.side_effects}`);

                await addMedicine({
                    name: med.name,
                    expiryDate: expiryString,
                    notes: notesParts.join("\n"),
                });
            }

            setAdded(true);
            toast.success(t("addedSuccess"));

            // Optionally redirect to tracker after a short delay
            setTimeout(() => {
                router.push("/expiry-tracker");
            }, 1500);
        } catch (error) {
            console.error("Failed to add medicines:", error);
            toast.error(t("errors.apiFailure"));
        } finally {
            setIsAdding(false);
        }
    };

    if (!data.medicines || data.medicines.length === 0) {
        return (
            <div className="mx-auto w-full max-w-2xl rounded-xl border bg-white p-6 text-center shadow-sm dark:bg-zinc-900">
                <AlertCircle className="mx-auto mb-4 h-12 w-12 text-yellow-500" />
                <h3 className="text-lg font-medium">No medicines detected</h3>
                <p className="mt-2 text-gray-500">
                    We couldn't confidently identify any medicines in this image.
                </p>
            </div>
        );
    }

    return (
        <div className="mx-auto w-full max-w-2xl space-y-6">
            <div className="flex flex-col items-start justify-between gap-4 rounded-xl border bg-white p-4 shadow-sm sm:flex-row sm:items-center dark:bg-zinc-900">
                <div>
                    <h2 className="text-xl font-bold">{data.medicines.length} Medicines Found</h2>
                    <p className="text-sm text-gray-500">Review the extracted details below</p>
                </div>
                <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                    <PlayAudioButton data={data} />
                    <button
                        onClick={handleAddAll}
                        disabled={isAdding || added}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-6 py-2.5 font-medium text-white transition-colors hover:bg-green-700 disabled:bg-green-800 disabled:opacity-70 sm:w-auto"
                    >
                        {added ? <Check className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                        {added ? "Added!" : t("addAll")}
                    </button>
                </div>
            </div>

            {data.patientVitals &&
                (data.patientVitals.bloodPressure || data.patientVitals.temperature) && (
                    <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-900/20">
                        <h3 className="mb-3 flex items-center gap-2 font-medium text-blue-800 dark:text-blue-300">
                            <Heart className="h-5 w-5" />
                            {t("vitals")}
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            {data.patientVitals.bloodPressure && (
                                <div>
                                    <span className="block text-sm text-blue-600 dark:text-blue-400">
                                        Blood Pressure
                                    </span>
                                    <span className="font-medium">
                                        {data.patientVitals.bloodPressure}
                                    </span>
                                </div>
                            )}
                            {data.patientVitals.temperature && (
                                <div>
                                    <span className="block text-sm text-blue-600 dark:text-blue-400">
                                        Temperature
                                    </span>
                                    <span className="font-medium">
                                        {data.patientVitals.temperature}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

            <div className="space-y-4">
                {data.medicines.map((med, idx) => (
                    <div
                        key={idx}
                        className="rounded-xl border bg-white p-5 shadow-sm transition-all hover:shadow-md dark:bg-zinc-900"
                    >
                        <div className="mb-3 border-b pb-3">
                            <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                                    {idx + 1}
                                </span>
                                {med.name}
                            </h3>
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            {med.dosage && (
                                <div className="flex gap-2 text-sm">
                                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                                    <div>
                                        <span className="block text-xs tracking-wider text-gray-500 uppercase">
                                            {t("dosage")}
                                        </span>
                                        <span className="font-medium">{med.dosage}</span>
                                    </div>
                                </div>
                            )}

                            {(med.simpleTiming || med.timing) && (
                                <div className="flex gap-2 text-sm">
                                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
                                    <div>
                                        <span className="block text-xs tracking-wider text-gray-500 uppercase">
                                            {t("timing")}
                                        </span>
                                        <span className="font-medium text-blue-700 dark:text-blue-300">
                                            {med.simpleTiming || med.timing}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {med.instructions && (
                                <div className="flex gap-2 text-sm sm:col-span-2">
                                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                                    <div>
                                        <span className="block text-xs tracking-wider text-gray-500 uppercase">
                                            {t("instructions")}
                                        </span>
                                        <span className="font-medium text-gray-800 dark:text-gray-200">
                                            {med.instructions}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {med.purpose && (
                                <div className="flex gap-2 text-sm">
                                    <Heart className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                                    <div>
                                        <span className="block text-xs tracking-wider text-gray-500 uppercase">
                                            {t("purpose")}
                                        </span>
                                        <span>{med.purpose}</span>
                                    </div>
                                </div>
                            )}

                            {med.side_effects && (
                                <div className="flex gap-2 text-sm">
                                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" />
                                    <div>
                                        <span className="block text-xs tracking-wider text-gray-500 uppercase">
                                            {t("sideEffects")}
                                        </span>
                                        <span>{med.side_effects}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
