"use client";

import { useId } from "react";
import {
    AlertTriangle,
    Mic,
    Play,
    RotateCcw,
    Share2,
    Sparkles,
    Square,
    Volume2,
} from "lucide-react";
import type { ConfidenceMeta } from "./lib/confidence";
import { VOICE_FOCUS_RING_CLASS } from "./lib/accessibility";
import type { VoiceErrorState, VoiceTriageResult } from "./types";
import { VoiceAudioVisualizer } from "./VoiceAudioVisualizer";

const CONFIDENCE_STYLES: Record<ConfidenceMeta["tone"], { badge: string; text: string }> = {
    positive: {
        badge: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-250 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-400",
        text: "text-emerald-700 dark:text-emerald-400",
    },
    caution: {
        badge: "bg-amber-50 dark:bg-amber-950/30 border-amber-250 dark:border-amber-900/30 text-amber-700 dark:text-amber-450",
        text: "text-amber-700 dark:text-amber-450",
    },
    critical: {
        badge: "bg-red-50 dark:bg-red-950/30 border-red-250 dark:border-red-900/30 text-red-700 dark:text-red-400",
        text: "text-red-700 dark:text-red-400",
    },
    neutral: {
        badge: "bg-(--color-surface-muted) border-(--color-border-muted) text-(--color-text-secondary)",
        text: "text-(--color-text-secondary)",
    },
};

export function VoiceIntroPanel({
    title,
    subtitle,
    exampleLabel,
    exampleText,
    assistantLabel,
    assistantValue,
}: {
    title: string;
    subtitle: string;
    exampleLabel: string;
    exampleText: string;
    assistantLabel: string;
    assistantValue: string;
}) {
    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 space-y-8 text-center duration-500">
            <div className="space-y-3">
                <h1 className="text-4xl font-black tracking-tight text-(--color-text-primary)">
                    {title}
                </h1>
                <p className="mx-auto max-w-xs font-medium text-(--color-text-secondary)">
                    {subtitle}
                </p>
            </div>

            <div className="mx-auto grid max-w-sm grid-cols-2 gap-4">
                <div className="rounded-3xl border border-(--color-border-muted) bg-(--color-surface-page) p-4 text-left shadow-sm">
                    <Mic size={20} aria-hidden="true" className="mb-2 text-blue-500" />
                    <p className="text-xs font-bold tracking-tighter text-(--color-text-muted) uppercase">
                        {exampleLabel}
                    </p>
                    <p className="mt-1 text-sm font-bold text-(--color-text-primary)">
                        {exampleText}
                    </p>
                </div>
                <div className="rounded-3xl border border-(--color-border-muted) bg-(--color-surface-page) p-4 text-left shadow-sm">
                    <Volume2
                        size={20}
                        aria-hidden="true"
                        className="mb-2 text-emerald-700 dark:text-emerald-400"
                    />
                    <p className="text-xs font-bold tracking-tighter text-(--color-text-muted) uppercase">
                        {assistantLabel}
                    </p>
                    <p className="mt-1 text-sm font-bold text-(--color-text-primary)">
                        {assistantValue}
                    </p>
                </div>
            </div>
        </div>
    );
}

export function VoiceListeningPanel({
    transcript,
    statusLabel,
    helperLabel,
    stream,
    isListening,
    isFading,
    animationsEnabled,
    visualizerLabel,
    volumeLabel,
    liveVolumeLabel,
    stillVolumeLabel,
    visualizerUnavailableLabel,
}: {
    transcript: string;
    statusLabel: string;
    helperLabel?: string;
    stream: MediaStream | null;
    isListening: boolean;
    isFading: boolean;
    animationsEnabled: boolean;
    visualizerLabel: string;
    volumeLabel: string;
    liveVolumeLabel: string;
    stillVolumeLabel: string;
    visualizerUnavailableLabel: string;
}) {
    return (
        <div
            className="animate-in fade-in zoom-in flex w-full max-w-md flex-col items-center space-y-8 duration-300"
            role="status"
            aria-live="polite"
        >
            <VoiceAudioVisualizer
                stream={stream}
                isActive={isListening}
                isFading={isFading}
                animationsEnabled={animationsEnabled}
                visualizerLabel={visualizerLabel}
                volumeLabel={volumeLabel}
                liveVolumeLabel={liveVolumeLabel}
                stillVolumeLabel={stillVolumeLabel}
                visualizerUnavailableLabel={visualizerUnavailableLabel}
            />
            <p className="text-center text-2xl font-bold text-(--color-text-primary) italic">
                {transcript || "…"}
            </p>
            <p className="text-sm font-bold tracking-widest text-emerald-700 uppercase dark:text-emerald-400">
                {statusLabel}
            </p>
            {helperLabel ? (
                <p className="text-center text-sm font-medium text-(--color-text-secondary)">
                    {helperLabel}
                </p>
            ) : null}
        </div>
    );
}

export function VoiceProcessingPanel({ title, subtitle }: { title: string; subtitle: string }) {
    return (
        <div
            className="animate-in fade-in flex flex-col items-center space-y-6 duration-300 motion-reduce:animate-none"
            role="status"
            aria-live="polite"
            aria-label={title}
        >
            <div className="relative" aria-hidden="true">
                <div className="h-24 w-24 animate-spin rounded-full border-4 border-(--color-surface-muted) border-t-emerald-600 motion-reduce:animate-none"></div>
                <Sparkles
                    className="absolute inset-0 m-auto animate-pulse text-emerald-700 motion-reduce:animate-none dark:text-emerald-400"
                    size={32}
                    aria-hidden="true"
                />
            </div>
            <div className="text-center">
                <p className="text-xl font-bold text-(--color-text-primary)">{title}</p>
                <p className="text-sm font-medium text-(--color-text-muted)">{subtitle}</p>
            </div>
        </div>
    );
}

export function ConfidenceBadge({
    confidence,
    labelPrefix,
    valueLabel,
}: {
    confidence: ConfidenceMeta;
    labelPrefix: string;
    valueLabel: string;
}) {
    const style = CONFIDENCE_STYLES[confidence.tone];

    return (
        <span
            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${style.badge}`}
        >
            {labelPrefix}: {valueLabel}
        </span>
    );
}

export function VoiceReviewPanel({
    title,
    message,
    transcript,
    confidence,
    confidenceLabelPrefix,
    confidenceValueLabel,
    retryLabel,
    analyseLabel,
    onRetry,
    onAnalyse,
    emergencyTitle,
    emergencyBody,
    showEmergency,
}: {
    title: string;
    message: string;
    transcript: string;
    confidence: ConfidenceMeta;
    confidenceLabelPrefix: string;
    confidenceValueLabel: string;
    retryLabel: string;
    analyseLabel: string;
    onRetry: () => void;
    onAnalyse: () => void;
    emergencyTitle: string;
    emergencyBody: string;
    showEmergency: boolean;
}) {
    return (
        <div className="animate-in fade-in slide-in-from-bottom-8 w-full max-w-md rounded-[2.5rem] border border-(--color-border-muted) bg-(--color-surface-page) p-8 shadow-xl duration-500 motion-reduce:animate-none">
            {showEmergency && (
                <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-left dark:border-red-900 dark:bg-red-950/20">
                    <div className="flex items-start gap-3">
                        <AlertTriangle
                            className="mt-0.5 shrink-0 text-red-600 dark:text-red-400"
                            size={18}
                            aria-hidden="true"
                        />
                        <div>
                            <p className="font-bold text-red-900 dark:text-red-200">
                                {emergencyTitle}
                            </p>
                            <p className="mt-1 text-sm leading-relaxed text-red-800 dark:text-red-400">
                                {emergencyBody}
                            </p>
                        </div>
                    </div>
                </div>
            )}
            <div className="mb-6 flex items-start gap-3">
                <div className="dark:text-amber-450 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/30">
                    <AlertTriangle size={24} aria-hidden="true" />
                </div>
                <div className="space-y-2">
                    <h2 className="font-black text-(--color-text-primary)">{title}</h2>
                    <p className="text-sm leading-relaxed text-(--color-text-secondary)">
                        {message}
                    </p>
                    <ConfidenceBadge
                        confidence={confidence}
                        labelPrefix={confidenceLabelPrefix}
                        valueLabel={confidenceValueLabel}
                    />
                </div>
            </div>

            <div className="rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted) p-4 text-sm leading-relaxed text-(--color-text-primary)">
                {transcript}
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                    onClick={onRetry}
                    className={`w-full rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted) py-3 font-bold text-(--color-text-primary) transition-colors hover:bg-(--color-border-muted) ${VOICE_FOCUS_RING_CLASS}`}
                >
                    {retryLabel}
                </button>
                <button
                    onClick={onAnalyse}
                    className={`w-full rounded-2xl bg-emerald-600 py-3 font-bold text-white transition-colors hover:bg-emerald-700 ${VOICE_FOCUS_RING_CLASS}`}
                >
                    {analyseLabel}
                </button>
            </div>
        </div>
    );
}

export function VoiceErrorPanel({
    error,
    retryLabel,
    switchToTextLabel,
    onRetry,
    onSwitchToText,
}: {
    error: VoiceErrorState;
    retryLabel: string;
    switchToTextLabel: string;
    onRetry: () => void;
    onSwitchToText: () => void;
}) {
    const showTextFallback = error.type === "timeout" || error.type === "service-unavailable";
    return (
        <div
            className="animate-in fade-in slide-in-from-bottom-8 w-full max-w-md rounded-[2.5rem] border border-red-100 bg-(--color-surface-page) p-8 shadow-xl duration-500 motion-reduce:animate-none dark:border-red-950/40"
            role="alert"
            aria-live="assertive"
            aria-describedby="voice-error-message"
        >
            <div className="mb-6 flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400">
                    <AlertTriangle size={24} aria-hidden="true" />
                </div>
                <div>
                    <h2 className="font-black text-(--color-text-primary)">{error.title}</h2>
                    <p
                        id="voice-error-message"
                        className="mt-2 text-sm leading-relaxed text-(--color-text-secondary)"
                    >
                        {error.message}
                    </p>
                </div>
            </div>

            <div className="flex flex-col gap-3">
                <button
                    onClick={onRetry}
                    className={`w-full rounded-2xl bg-slate-900 py-4 font-bold text-white transition-all hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 ${VOICE_FOCUS_RING_CLASS}`}
                >
                    {retryLabel}
                </button>

                {showTextFallback ? (
                    <button
                        onClick={onSwitchToText}
                        className={`w-full rounded-2xl border border-(--color-border-muted) bg-(--color-surface-page) py-4 font-bold text-(--color-text-primary) transition-all hover:bg-(--color-surface-muted) ${VOICE_FOCUS_RING_CLASS}`}
                    >
                        {switchToTextLabel}
                    </button>
                ) : null}
            </div>
        </div>
    );
}

export function VoiceResultPanel({
    heading,
    subheading,
    transcriptLabel,
    transcript,
    confidence,
    confidenceLabelPrefix,
    confidenceValueLabel,
    result,
    emergencyTitle,
    emergencyBody,
    recommendationsLabel,
    shareLabel,
    speakLabel,
    stopSpeakingLabel,
    tryAgainLabel,
    isSpeaking,
    onReplay,
    onStopSpeaking,
    onShare,
    onTryAgain,
}: {
    heading: string;
    subheading: string;
    transcriptLabel: string;
    transcript: string;
    confidence: ConfidenceMeta;
    confidenceLabelPrefix: string;
    confidenceValueLabel: string;
    result: VoiceTriageResult;
    emergencyTitle: string;
    emergencyBody: string;
    recommendationsLabel: string;
    shareLabel: string;
    speakLabel: string;
    stopSpeakingLabel: string;
    tryAgainLabel: string;
    isSpeaking: boolean;
    onReplay: () => void;
    onStopSpeaking: () => void;
    onShare: () => void;
    onTryAgain: () => void;
}) {
    return (
        <div
            className="animate-in fade-in slide-in-from-bottom-8 w-full max-w-md rounded-[2.5rem] border border-(--color-border-muted) bg-(--color-surface-page) p-8 shadow-xl duration-500 motion-reduce:animate-none"
            role="region"
            aria-labelledby="voice-ai-analysis-heading"
        >
            <div className="mb-6 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400">
                    <Sparkles size={24} aria-hidden="true" />
                </div>
                <div>
                    <h2
                        id="voice-ai-analysis-heading"
                        className="font-black text-(--color-text-primary)"
                    >
                        {heading}
                    </h2>
                    <p className="text-xs font-bold tracking-tighter text-(--color-text-muted) uppercase">
                        {subheading}
                    </p>
                </div>
            </div>

            <div className="space-y-4">
                {result.emergency && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-left dark:border-red-900 dark:bg-red-950/20">
                        <div className="flex items-start gap-3">
                            <AlertTriangle
                                className="mt-0.5 shrink-0 text-red-600 dark:text-red-400"
                                size={18}
                                aria-hidden="true"
                            />
                            <div>
                                <p className="font-bold text-red-900 dark:text-red-200">
                                    {emergencyTitle}
                                </p>
                                <p className="mt-1 text-sm leading-relaxed text-red-800 dark:text-red-400">
                                    {emergencyBody}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                <div className="space-y-3 rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted) p-4">
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-bold tracking-widest text-(--color-text-muted) uppercase">
                            {transcriptLabel}
                        </p>
                        <ConfidenceBadge
                            confidence={confidence}
                            labelPrefix={confidenceLabelPrefix}
                            valueLabel={confidenceValueLabel}
                        />
                    </div>
                    <p className="text-sm leading-relaxed text-(--color-text-primary)">
                        {transcript}
                    </p>
                </div>

                <div className="rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted) p-4">
                    <p className="text-sm leading-relaxed text-(--color-text-primary)">
                        {result.summary}
                    </p>
                </div>

                {result.recommendations.length > 0 && (
                    <div className="space-y-3">
                        <h3 className="px-1 text-xs font-bold tracking-widest text-(--color-text-muted) uppercase">
                            {recommendationsLabel}
                        </h3>
                        <div className="grid grid-cols-1 gap-3">
                            {result.recommendations.map((recommendation, index) => (
                                <div
                                    key={`${recommendation}-${index}`}
                                    className="flex items-center gap-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 dark:border-emerald-900/30 dark:bg-emerald-950/20"
                                >
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                                        <span className="font-bold">{index + 1}</span>
                                    </div>
                                    <p className="text-sm font-bold text-emerald-900 dark:text-emerald-400">
                                        {recommendation}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted) px-4 py-3">
                    <p className="text-xs leading-relaxed text-(--color-text-secondary)">
                        {result.disclaimer}
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <button
                        onClick={onShare}
                        className={`flex w-full items-center justify-center gap-2 rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted) py-3 font-bold text-(--color-text-primary) transition-colors hover:bg-(--color-border-muted) ${VOICE_FOCUS_RING_CLASS}`}
                    >
                        <Share2 size={18} aria-hidden="true" />
                        {shareLabel}
                    </button>
                    {isSpeaking ? (
                        <button
                            onClick={onStopSpeaking}
                            className={`flex w-full items-center justify-center gap-2 rounded-2xl bg-red-50 py-3 font-bold text-red-700 transition-colors hover:bg-red-100 dark:bg-red-950/20 dark:text-red-400 dark:hover:bg-red-900/30 ${VOICE_FOCUS_RING_CLASS}`}
                        >
                            <Square size={18} aria-hidden="true" />
                            {stopSpeakingLabel}
                        </button>
                    ) : (
                        <button
                            onClick={onReplay}
                            className={`dark:text-blue-450 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-50 py-3 font-bold text-blue-700 transition-colors hover:bg-blue-100 dark:bg-blue-950/20 dark:hover:bg-blue-900/30 ${VOICE_FOCUS_RING_CLASS}`}
                        >
                            <Play size={18} aria-hidden="true" />
                            {speakLabel}
                        </button>
                    )}
                </div>

                <button
                    onClick={onTryAgain}
                    className={`flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-4 font-bold text-white transition-all hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 ${VOICE_FOCUS_RING_CLASS}`}
                >
                    <RotateCcw size={20} aria-hidden="true" />
                    {tryAgainLabel}
                </button>
            </div>
        </div>
    );
}
