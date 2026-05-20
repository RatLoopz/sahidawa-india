"use client";

import { useEffect, useRef, useState } from "react";
import { Mic } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { PageHeader } from "../components/PageHeader";
import {
    findBestVoice,
    getSpeechRecognitionConstructor,
    stopSpeaking,
    supportsSpeechSynthesis,
    type SpeechRecognitionLike,
} from "./lib/browser";
import { getConfidenceMeta, type ConfidenceMeta } from "./lib/confidence";
import { detectEmergencyKeywords } from "./lib/emergency";
import {
    DEFAULT_VOICE_LANGUAGE,
    getVoiceLanguageOption,
    VOICE_LANGUAGE_OPTIONS,
} from "./lib/languages";
import { formatVoiceShareReport } from "./lib/report";
import {
    VoiceErrorPanel,
    VoiceIntroPanel,
    VoiceListeningPanel,
    VoiceProcessingPanel,
    VoiceResultPanel,
    VoiceReviewPanel,
} from "./VoicePanels";
import { VoiceAnimationToggle } from "./VoiceAnimationToggle";
import {
    resolveVoiceAnimationPreference,
    stopMediaQueryChangeListener,
    stopMediaStream,
    subscribeToMediaQueryChange,
    type StoredVoiceAnimationPreference,
} from "./lib/audio";
import type { VoiceErrorState, VoiceStep, VoiceTriageResult } from "./types";

const DEFAULT_FLOW_CONFIDENCE = getConfidenceMeta(undefined);
const VOICE_ANIMATION_STORAGE_KEY = "sahidawa.voice.animations";

function getRecognitionErrorState(
    errorCode: string,
    t: ReturnType<typeof useTranslations>
): VoiceErrorState {
    switch (errorCode) {
        case "unsupported":
            return {
                title: t("errors.unsupported_title"),
                message: t("errors.unsupported_message"),
            };
        case "not-allowed":
        case "service-not-allowed":
            return {
                title: t("errors.permission_title"),
                message: t("errors.permission_message"),
            };
        case "audio-capture":
            return {
                title: t("errors.microphone_title"),
                message: t("errors.microphone_message"),
            };
        case "network":
            return {
                title: t("errors.network_title"),
                message: t("errors.network_message"),
            };
        case "no-speech":
            return {
                title: t("errors.no_speech_title"),
                message: t("errors.no_speech_message"),
            };
        default:
            return {
                title: t("errors.generic_title"),
                message: t("errors.generic_message"),
            };
    }
}

function getConfidenceValueLabel(
    confidence: ConfidenceMeta,
    t: ReturnType<typeof useTranslations>
) {
    const keyMap: Record<ConfidenceMeta["id"], string> = {
        high: "confidence_values.high",
        medium: "confidence_values.medium",
        low: "confidence_values.low",
        unavailable: "confidence_values.unavailable",
    };

    return t(keyMap[confidence.id] as any);
}

export default function VoiceTriagePage() {
    const t = useTranslations("VoicePage");
    const [step, setStep] = useState<VoiceStep>("initial");
    const [selectedLanguage, setSelectedLanguage] = useState(DEFAULT_VOICE_LANGUAGE);
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [transcript, setTranscript] = useState("");
    const [confidence, setConfidence] = useState<ConfidenceMeta>(DEFAULT_FLOW_CONFIDENCE);
    const [result, setResult] = useState<VoiceTriageResult | null>(null);
    const [resultLanguageCode, setResultLanguageCode] = useState<string | null>(null);
    const [error, setError] = useState<VoiceErrorState | null>(null);
    const [emergencyMatches, setEmergencyMatches] = useState<string[]>([]);
    const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
    const [animationsEnabled, setAnimationsEnabled] = useState(true);
    const [isVisualizerFading, setIsVisualizerFading] = useState(false);

    const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
    const audioStreamRef = useRef<MediaStream | null>(null);
    const latestTranscriptRef = useRef("");
    const latestDisplayedTranscriptRef = useRef("");
    const latestConfidenceRef = useRef<number | undefined>(undefined);
    const didHandleRecognitionEndRef = useRef(false);
    const manualStopRef = useRef(false);
    const startSessionIdRef = useRef(0);
    const autoSpokenKeyRef = useRef("");

    const selectedLanguageOption = getVoiceLanguageOption(selectedLanguage);
    const resultLanguageOption = getVoiceLanguageOption(resultLanguageCode ?? selectedLanguage);

    function detachRecognitionHandlers(recognition: SpeechRecognitionLike | null) {
        if (!recognition) {
            return;
        }

        recognition.onstart = null;
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
    }

    function setActiveAudioStream(stream: MediaStream | null) {
        audioStreamRef.current = stream;
        setAudioStream(stream);
    }

    function clearAudioStream() {
        stopMediaStream(audioStreamRef.current);
        setActiveAudioStream(null);
    }

    function readStoredAnimationPreference(): StoredVoiceAnimationPreference {
        if (typeof window === "undefined") {
            return null;
        }

        try {
            const storedPreference = window.localStorage.getItem(VOICE_ANIMATION_STORAGE_KEY);
            return storedPreference === "enabled" || storedPreference === "disabled"
                ? storedPreference
                : null;
        } catch {
            return null;
        }
    }

    useEffect(() => {
        return () => {
            startSessionIdRef.current += 1;
            const recognition = recognitionRef.current;
            recognitionRef.current = null;
            detachRecognitionHandlers(recognition);
            recognition?.stop();
            clearAudioStream();
            if (typeof window !== "undefined") {
                stopSpeaking(window);
            }
        };
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

        function applyMotionPreference() {
            setAnimationsEnabled(
                resolveVoiceAnimationPreference({
                    storedPreference: readStoredAnimationPreference(),
                    prefersReducedMotion: motionQuery.matches,
                })
            );
        }

        applyMotionPreference();
        const subscription = subscribeToMediaQueryChange(motionQuery, applyMotionPreference);

        return () => {
            stopMediaQueryChangeListener(subscription);
        };
    }, []);

    useEffect(() => {
        if (typeof window === "undefined" || !result?.summary || step !== "result") {
            return;
        }

        const autoSpokenKey = `${resultLanguageOption.speechSynthesisLang}:${result.summary}`;
        if (autoSpokenKeyRef.current === autoSpokenKey) {
            return;
        }

        autoSpokenKeyRef.current = autoSpokenKey;
        handleReplaySummary();
    }, [result, resultLanguageOption.speechSynthesisLang, step]);

    function resetFlow(nextStep: VoiceStep = "initial") {
        startSessionIdRef.current += 1;
        const recognition = recognitionRef.current;
        recognitionRef.current = null;
        detachRecognitionHandlers(recognition);
        recognition?.stop();
        clearAudioStream();
        if (typeof window !== "undefined") {
            stopSpeaking(window);
        }

        latestTranscriptRef.current = "";
        latestDisplayedTranscriptRef.current = "";
        latestConfidenceRef.current = undefined;
        didHandleRecognitionEndRef.current = false;
        manualStopRef.current = false;
        autoSpokenKeyRef.current = "";

        setIsListening(false);
        setIsSpeaking(false);
        setIsVisualizerFading(false);
        setTranscript("");
        setConfidence(DEFAULT_FLOW_CONFIDENCE);
        setResult(null);
        setResultLanguageCode(null);
        setError(null);
        setEmergencyMatches([]);
        setStep(nextStep);
    }

    function finalizeTranscript(nextTranscript: string, nextConfidence?: number) {
        if (didHandleRecognitionEndRef.current) {
            return;
        }

        didHandleRecognitionEndRef.current = true;
        setIsListening(false);
        setIsVisualizerFading(false);
        clearAudioStream();

        const normalizedTranscript = nextTranscript.trim();
        if (!normalizedTranscript) {
            setError(getRecognitionErrorState("no-speech", t));
            setStep("error");
            return;
        }

        const confidenceMeta = getConfidenceMeta(nextConfidence);
        const emergencyResult = detectEmergencyKeywords(normalizedTranscript);

        setTranscript(normalizedTranscript);
        setConfidence(confidenceMeta);
        setEmergencyMatches(emergencyResult.matches);
        setError(null);

        if (confidenceMeta.shouldReview) {
            setStep("review");
            return;
        }

        void analyseTranscript(normalizedTranscript, confidenceMeta, emergencyResult.matches);
    }

    async function analyseTranscript(
        nextTranscript: string,
        nextConfidence: ConfidenceMeta,
        localEmergencyMatches: string[]
    ) {
        const activeLanguageOption = getVoiceLanguageOption(selectedLanguage);
        setStep("processing");
        setError(null);

        try {
            const response = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    mode: "voice-triage",
                    responseLanguage: activeLanguageOption.responseLanguage,
                    messages: [{ text: nextTranscript }],
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || t("errors.api_message"));
            }

            const nextResult: VoiceTriageResult = {
                text:
                    typeof data.text === "string" && data.text.trim()
                        ? data.text.trim()
                        : data.summary,
                summary:
                    typeof data.summary === "string" && data.summary.trim()
                        ? data.summary.trim()
                        : t("fallback_summary"),
                recommendations: Array.isArray(data.recommendations)
                    ? data.recommendations.filter(
                          (item: unknown): item is string => typeof item === "string"
                      )
                    : [],
                disclaimer:
                    typeof data.disclaimer === "string" && data.disclaimer.trim()
                        ? data.disclaimer.trim()
                        : t("disclaimer"),
                emergency: Boolean(data.emergency) || localEmergencyMatches.length > 0,
            };

            setTranscript(nextTranscript);
            setConfidence(nextConfidence);
            setResult(nextResult);
            setResultLanguageCode(activeLanguageOption.value);
            setStep("result");
        } catch (requestError) {
            const message =
                requestError instanceof Error && requestError.message
                    ? requestError.message
                    : t("errors.api_message");

            setError({
                title: t("errors.api_title"),
                message,
            });
            setStep("error");
        }
    }

    function handleReplaySummary() {
        if (typeof window === "undefined" || !result?.summary) {
            return;
        }

        if (!supportsSpeechSynthesis(window)) {
            toast.error(t("tts_not_supported"));
            return;
        }

        stopSpeaking(window);

        const utterance = new SpeechSynthesisUtterance(result.summary);
        utterance.lang = resultLanguageOption.speechSynthesisLang;
        const bestVoice = findBestVoice(window, resultLanguageOption.speechSynthesisLang);

        if (bestVoice) {
            utterance.voice = bestVoice;
        }

        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);

        window.speechSynthesis.speak(utterance);
    }

    function handleStopSpeaking() {
        if (typeof window !== "undefined") {
            stopSpeaking(window);
        }
        setIsSpeaking(false);
    }

    async function handleShare() {
        if (typeof window === "undefined" || !result) {
            return;
        }

        const reportText = formatVoiceShareReport({
            timestamp: new Date().toISOString(),
            selectedLanguageLabel: resultLanguageOption.label,
            transcript,
            confidenceLabel: getConfidenceValueLabel(confidence, t),
            emergency: result.emergency,
            summary: result.summary,
            recommendations: result.recommendations,
            disclaimer: result.disclaimer,
            labels: {
                title: t("share_report.title"),
                timestamp: t("share_report.timestamp"),
                language: t("share_report.language"),
                transcript: t("share_report.transcript"),
                confidence: t("share_report.confidence"),
                emergency: t("share_report.emergency"),
                yes: t("share_report.yes"),
                no: t("share_report.no"),
                summary: t("share_report.summary"),
                recommendations: t("share_report.recommendations"),
                disclaimer: t("share_report.disclaimer"),
                defaultRecommendation: t("share_report.default_recommendation"),
            },
        });

        const shareData = {
            title: t("share_title"),
            text: reportText,
            url: window.location.href,
        };

        try {
            const canUseNativeShare =
                typeof navigator.share === "function" &&
                (typeof navigator.canShare !== "function" || navigator.canShare(shareData));

            if (canUseNativeShare) {
                await navigator.share(shareData);
                toast.success(t("share_success"));
                return;
            }

            await navigator.clipboard.writeText(`${reportText}\n\n${window.location.href}`);
            toast.success(t("copy_success"));
        } catch (shareError) {
            if (shareError instanceof Error && shareError.name === "AbortError") {
                return;
            }

            try {
                await navigator.clipboard.writeText(`${reportText}\n\n${window.location.href}`);
                toast.success(t("copy_success"));
            } catch {
                toast.error(t("share_failure"));
            }
        }
    }

    function stopListening() {
        manualStopRef.current = true;
        setIsListening(false);
        setIsVisualizerFading(true);

        if (!recognitionRef.current) {
            startSessionIdRef.current += 1;
            clearAudioStream();
            setIsVisualizerFading(false);
            setStep("initial");
            return;
        }

        recognitionRef.current?.stop();
    }

    async function startListening() {
        if (typeof window === "undefined") {
            return;
        }

        const SpeechRecognition = getSpeechRecognitionConstructor(window);
        if (!SpeechRecognition) {
            setError(getRecognitionErrorState("unsupported", t));
            setStep("error");
            return;
        }

        handleStopSpeaking();

        const sessionId = startSessionIdRef.current + 1;
        startSessionIdRef.current = sessionId;
        clearAudioStream();

        latestTranscriptRef.current = "";
        latestDisplayedTranscriptRef.current = "";
        latestConfidenceRef.current = undefined;
        didHandleRecognitionEndRef.current = false;
        manualStopRef.current = false;

        setTranscript("");
        setConfidence(DEFAULT_FLOW_CONFIDENCE);
        setResult(null);
        setError(null);
        setEmergencyMatches([]);
        setIsVisualizerFading(false);
        setStep("listening");

        if (navigator.mediaDevices?.getUserMedia) {
            try {
                const nextAudioStream = await navigator.mediaDevices.getUserMedia({ audio: true });

                if (startSessionIdRef.current !== sessionId) {
                    stopMediaStream(nextAudioStream);
                    return;
                }

                setActiveAudioStream(nextAudioStream);
            } catch {
                setActiveAudioStream(null);
            }
        }

        if (startSessionIdRef.current !== sessionId) {
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = selectedLanguageOption.speechRecognition;
        recognition.interimResults = true;
        recognition.continuous = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            setIsListening(true);
            setIsVisualizerFading(false);
            setStep("listening");
        };

        recognition.onresult = (event: any) => {
            let nextInterim = "";
            let nextFinal = latestTranscriptRef.current;
            let nextConfidenceValue = latestConfidenceRef.current;

            for (let index = event.resultIndex; index < event.results.length; index += 1) {
                const speechResult = event.results[index];
                const transcriptChunk = speechResult[0]?.transcript?.trim();

                if (!transcriptChunk) {
                    continue;
                }

                if (speechResult.isFinal) {
                    nextFinal = `${nextFinal} ${transcriptChunk}`.trim();
                    if (typeof speechResult[0]?.confidence === "number") {
                        nextConfidenceValue = speechResult[0].confidence;
                    }
                } else {
                    nextInterim = `${nextInterim} ${transcriptChunk}`.trim();
                }
            }

            latestTranscriptRef.current = nextFinal;
            latestDisplayedTranscriptRef.current = `${nextFinal} ${nextInterim}`.trim();
            latestConfidenceRef.current = nextConfidenceValue;
            setTranscript(latestDisplayedTranscriptRef.current);
        };

        recognition.onerror = (event: any) => {
            if (manualStopRef.current && event.error === "aborted") {
                return;
            }

            didHandleRecognitionEndRef.current = true;
            setIsListening(false);
            setIsVisualizerFading(false);
            clearAudioStream();
            if (recognitionRef.current === recognition) {
                recognitionRef.current = null;
            }
            detachRecognitionHandlers(recognition);
            setError(getRecognitionErrorState(event.error || "generic", t));
            setStep("error");
        };

        recognition.onend = () => {
            setIsListening(false);
            setIsVisualizerFading(false);
            clearAudioStream();

            if (recognitionRef.current === recognition) {
                recognitionRef.current = null;
            }
            detachRecognitionHandlers(recognition);

            if (didHandleRecognitionEndRef.current) {
                return;
            }

            finalizeTranscript(
                latestTranscriptRef.current || latestDisplayedTranscriptRef.current,
                latestConfidenceRef.current
            );
        };

        recognitionRef.current = recognition;

        try {
            recognition.start();
        } catch {
            detachRecognitionHandlers(recognition);
            if (recognitionRef.current === recognition) {
                recognitionRef.current = null;
            }
            clearAudioStream();
            setError(getRecognitionErrorState("generic", t));
            setStep("error");
        }
    }

    function handleMicAction() {
        if (step === "listening") {
            stopListening();
            return;
        }

        void startListening();
    }

    const showMicFooter = step === "initial" || step === "listening";

    return (
        <div className="relative flex min-h-screen flex-col overflow-hidden bg-slate-50 font-sans">
            <div
                className="absolute top-0 right-0 -mt-20 -mr-20 h-96 w-96 rounded-full bg-emerald-100/40 blur-3xl"
                aria-hidden="true"
            ></div>
            <div
                className="absolute bottom-0 left-0 -mb-20 -ml-20 h-80 w-80 rounded-full bg-blue-100/40 blur-3xl"
                aria-hidden="true"
            ></div>

            <PageHeader
                title={t("header_title")}
                subtitle={t("header_subtitle")}
                backHref="/"
                variant="light"
                showLanguage={true}
                languageName={
                    step === "result" && resultLanguageCode
                        ? resultLanguageOption.label
                        : selectedLanguageOption.label
                }
            />

            <main className="relative z-10 flex flex-1 flex-col items-center justify-center gap-6 px-6 py-8">
                <div className="w-full max-w-md">
                    <label
                        htmlFor="voice-language"
                        className="mb-2 block text-xs font-bold tracking-widest text-slate-500 uppercase"
                    >
                        {t("language_selector")}
                    </label>
                    <select
                        id="voice-language"
                        value={selectedLanguage}
                        onChange={(event) => setSelectedLanguage(event.target.value)}
                        disabled={
                            step === "listening" || step === "processing" || step === "result"
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
                    >
                        {VOICE_LANGUAGE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                    <VoiceAnimationToggle
                        label={t("animation_toggle_label")}
                        liveLabel={t("animation_live_label")}
                        reducedMotionLabel={t("animation_reduced_motion_label")}
                        enabled={animationsEnabled}
                        onToggle={(nextPreference) => {
                            setAnimationsEnabled(nextPreference);
                            try {
                                window.localStorage.setItem(
                                    VOICE_ANIMATION_STORAGE_KEY,
                                    nextPreference ? "enabled" : "disabled"
                                );
                            } catch {
                                // Local storage is optional; the toggle still works for this session.
                            }
                        }}
                    />
                </div>

                {step === "initial" && (
                    <VoiceIntroPanel
                        title={t("title")}
                        subtitle={t("subtitle")}
                        exampleLabel={t("example_label")}
                        exampleText={t("example_text")}
                        assistantLabel={t("assistant_label")}
                        assistantValue={t("assistant_value")}
                    />
                )}

                {step === "listening" && (
                    <VoiceListeningPanel
                        transcript={transcript || t("listening_placeholder")}
                        statusLabel={t("listening_status")}
                        stream={audioStream}
                        isListening={isListening}
                        isFading={isVisualizerFading}
                        animationsEnabled={animationsEnabled}
                        visualizerLabel={t("visualizer_label")}
                        volumeLabel={t("volume_label")}
                        liveVolumeLabel={t("volume_live_label")}
                        stillVolumeLabel={t("volume_still_label")}
                        visualizerUnavailableLabel={t("visualizer_unavailable")}
                    />
                )}

                {step === "processing" && (
                    <VoiceProcessingPanel
                        title={t("processing_title")}
                        subtitle={t("processing_subtitle")}
                    />
                )}

                {step === "review" && (
                    <VoiceReviewPanel
                        title={t("review_title")}
                        message={t("review_message")}
                        transcript={transcript}
                        confidence={confidence}
                        confidenceLabelPrefix={t("confidence_label")}
                        confidenceValueLabel={getConfidenceValueLabel(confidence, t)}
                        retryLabel={t("retry_button")}
                        analyseLabel={t("analyse_anyway_button")}
                        onRetry={() => resetFlow()}
                        onAnalyse={() =>
                            void analyseTranscript(transcript, confidence, emergencyMatches)
                        }
                        emergencyTitle={t("emergency_title")}
                        emergencyBody={t("emergency_body")}
                        showEmergency={emergencyMatches.length > 0}
                    />
                )}

                {step === "error" && error && (
                    <VoiceErrorPanel
                        error={error}
                        retryLabel={t("retry_button")}
                        onRetry={() => resetFlow()}
                    />
                )}

                {step === "result" && result && (
                    <VoiceResultPanel
                        heading={t("result_heading")}
                        subheading={t("result_subheading")}
                        transcriptLabel={t("transcript_label")}
                        transcript={transcript}
                        confidence={confidence}
                        confidenceLabelPrefix={t("confidence_label")}
                        confidenceValueLabel={getConfidenceValueLabel(confidence, t)}
                        result={result}
                        emergencyTitle={t("emergency_title")}
                        emergencyBody={t("emergency_body")}
                        recommendationsLabel={t("recommendations_label")}
                        shareLabel={t("share_button")}
                        speakLabel={t("speak_button")}
                        stopSpeakingLabel={t("stop_speaking_button")}
                        tryAgainLabel={t("try_again_button")}
                        isSpeaking={isSpeaking}
                        onReplay={handleReplaySummary}
                        onStopSpeaking={handleStopSpeaking}
                        onShare={handleShare}
                        onTryAgain={() => resetFlow()}
                    />
                )}
            </main>

            {showMicFooter && (
                <div className="relative z-10 flex flex-col items-center p-12">
                    <button
                        onClick={handleMicAction}
                        aria-label={
                            step === "listening"
                                ? t("stop_listening_aria")
                                : t("start_listening_aria")
                        }
                        className={`relative flex h-24 w-24 items-center justify-center rounded-full transition-all duration-500 ${step === "listening" ? "scale-125 bg-red-500" : "bg-emerald-500 shadow-xl shadow-emerald-500/30 hover:scale-110"} `}
                    >
                        {step === "listening" ? (
                            <div
                                className="absolute inset-0 animate-ping rounded-full bg-red-500 opacity-30"
                                aria-hidden="true"
                            ></div>
                        ) : (
                            <div
                                className="absolute inset-0 animate-pulse rounded-full bg-emerald-500 opacity-20"
                                aria-hidden="true"
                            ></div>
                        )}
                        <Mic
                            size={40}
                            aria-hidden="true"
                            className="relative z-10 text-white"
                            strokeWidth={2.5}
                        />
                        <span className="sr-only">
                            {step === "listening"
                                ? t("stop_listening_sr")
                                : t("start_listening_sr")}
                        </span>
                    </button>
                    <p
                        className="mt-6 text-sm font-bold tracking-widest text-slate-400 uppercase"
                        aria-hidden="true"
                    >
                        {step === "listening" ? t("stop_listening_label") : t("tap_to_speak")}
                    </p>
                </div>
            )}

            <footer className="p-8 text-center">
                <p className="mx-auto max-w-xs text-[10px] font-bold tracking-widest text-slate-300 uppercase">
                    {t("footer_note")}
                </p>
            </footer>
        </div>
    );
}
