"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Mic } from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { PageHeader } from "../components/PageHeader";
import {
    getSpeechRecognitionConstructor,
    resolveSpeechSynthesisVoice,
    stopSpeaking,
    supportsSpeechSynthesis,
    type SpeechRecognitionLike,
} from "./lib/browser";
import { getConfidenceMeta, type ConfidenceMeta } from "./lib/confidence";
import { detectEmergencyKeywords } from "./lib/emergency";
import {
    getVoiceStepAnnouncement,
    shouldHandleVoiceEscape,
    shouldAutoFocusVoicePanel,
    VOICE_FOCUS_RING_CLASS,
} from "./lib/accessibility";
import {
    DEFAULT_VOICE_LANGUAGE,
    getVoiceLanguageOption,
    resolveVoiceWorkflowLanguage,
    VOICE_LANGUAGE_OPTIONS,
} from "./lib/languages";
import { formatVoiceShareReport } from "./lib/report";
import { getPreferredRecordingMimeType, supportsAudioRecording } from "./lib/recording";
import {
    shouldReviewTranscription,
    transcribeRecordedAudio,
    type VoiceTranscriptionPayload,
} from "./lib/transcription";
import { createVoiceStreamingSession } from "./lib/streaming";
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
import type { VoiceErrorState, VoiceStep, VoiceStreamingStatus, VoiceTriageResult } from "./types";

const DEFAULT_FLOW_CONFIDENCE = getConfidenceMeta(undefined);
const VOICE_ANIMATION_STORAGE_KEY = "sahidawa.voice.animations";

function getRecognitionErrorState(
    errorCode: string,
    t: ReturnType<typeof useTranslations>,
    languageLabel?: string
): VoiceErrorState {
    switch (errorCode) {
        case "unsupported":
            return {
                title: t("errors.unsupported_title"),
                message: t("errors.unsupported_message"),
            };
        case "language-not-supported":
            return {
                title: t("errors.language_not_supported_title"),
                message: t("errors.language_not_supported_message", {
                    language: languageLabel ?? t("language_selector"),
                }),
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
function getServerErrorState(
    status: number,
    t: ReturnType<typeof useTranslations>
): VoiceErrorState {
    switch (status) {
        case 503:
            return {
                type: "service-unavailable",
                title: t("errors.service_unavailable_title"),
                message: t("errors.service_unavailable_message"),
            };

        case 504:
            return {
                type: "timeout",
                title: t("errors.timeout_title"),
                message: t("errors.timeout_message"),
            };

        default:
            return {
                type: "generic",
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
    const router = useRouter();
    const params = useParams();
    const locale = Array.isArray(params.locale) ? params.locale[0] : params.locale;
    const t = useTranslations("VoicePage");
    const [step, setStep] = useState<VoiceStep>("initial");
    const [selectedLanguage, setSelectedLanguage] = useState(DEFAULT_VOICE_LANGUAGE);
    const [activeLanguageCode, setActiveLanguageCode] = useState<string | null>(null);
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
    const [srAnnouncement, setSrAnnouncement] = useState("");
    const [streamingStatus, setStreamingStatus] = useState<VoiceStreamingStatus>("idle");

    const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const streamingSessionRef = useRef<ReturnType<typeof createVoiceStreamingSession> | null>(null);
    const audioStreamRef = useRef<MediaStream | null>(null);
    const recordingChunksRef = useRef<Blob[]>([]);
    const pendingRecordedBlobRef = useRef<Blob | null>(null);
    const latestTranscriptRef = useRef("");
    const latestDisplayedTranscriptRef = useRef("");
    const latestConfidenceRef = useRef<number | undefined>(undefined);
    const didHandleRecognitionEndRef = useRef(false);
    const manualStopRef = useRef(false);
    const streamingStatusRef = useRef<VoiceStreamingStatus>("idle");
    const isStreamingStopRequestedRef = useRef(false);
    const sessionLanguageRef = useRef<string | null>(null);
    const startSessionIdRef = useRef(0);
    const autoSpokenKeyRef = useRef("");
    const mainRef = useRef<HTMLElement | null>(null);
    const ttsFallbackNoticeKeyRef = useRef("");
    const panelRef = useRef<HTMLDivElement | null>(null);

    const workflowLanguageCode = resolveVoiceWorkflowLanguage(
        sessionLanguageRef.current,
        activeLanguageCode,
        selectedLanguage
    );
    const workflowLanguageOption = getVoiceLanguageOption(workflowLanguageCode);
    const resultLanguageOption = getVoiceLanguageOption(resultLanguageCode ?? workflowLanguageCode);
    const isLanguageSelectionLocked =
        step === "listening" || step === "processing" || step === "review" || step === "result";

    function getWorkflowLanguageCode() {
        return resolveVoiceWorkflowLanguage(
            sessionLanguageRef.current,
            activeLanguageCode,
            selectedLanguage
        );
    }

    function setStreamingStatusValue(nextStatus: VoiceStreamingStatus) {
        streamingStatusRef.current = nextStatus;
        setStreamingStatus(nextStatus);
    }

    function closeStreamingSession() {
        const session = streamingSessionRef.current;
        streamingSessionRef.current = null;
        session?.close();
    }

    function detachRecognitionHandlers(recognition: SpeechRecognitionLike | null) {
        if (!recognition) {
            return;
        }

        recognition.onstart = null;
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
    }

    function detachMediaRecorderHandlers(mediaRecorder: MediaRecorder | null) {
        if (!mediaRecorder) {
            return;
        }

        mediaRecorder.onstart = null;
        mediaRecorder.ondataavailable = null;
        mediaRecorder.onerror = null;
        mediaRecorder.onstop = null;
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
            const mediaRecorder = mediaRecorderRef.current;
            mediaRecorderRef.current = null;
            detachMediaRecorderHandlers(mediaRecorder);
            closeStreamingSession();
            if (mediaRecorder && mediaRecorder.state !== "inactive") {
                mediaRecorder.stop();
            }
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

    useEffect(() => {
        if (step === "initial") {
            setSrAnnouncement("");
            return;
        }

        const announcement = getVoiceStepAnnouncement({
            copy: {
                emergencyTitle: t("emergency_title"),
                errorPrefix: t("errors.generic_title"),
                listeningStatus: t("listening_status"),
                processingStarted: t("announcements.processing_started"),
                processingSubtitle: t("processing_subtitle"),
                recordingStarted: t("announcements.recording_started"),
                resultHeading: t("result_heading"),
                resultSubheading: t("result_subheading"),
                resultsReady: t("announcements.results_ready"),
                reviewMessage: t("review_message"),
                reviewTitle: t("review_title"),
            },
            error,
            hasResult: Boolean(result),
            isEmergency: Boolean(result?.emergency),
            step,
        });

        if (announcement) {
            setSrAnnouncement(announcement);
        }

        if (!shouldAutoFocusVoicePanel(step)) {
            return;
        }

        const focusTimer = window.setTimeout(() => {
            panelRef.current?.focus();
        }, 100);

        return () => window.clearTimeout(focusTimer);
    }, [error, result, step, t]);

    const handleEscapeShortcut = useEffectEvent((event: KeyboardEvent) => {
        if (event.key !== "Escape") {
            return;
        }

        const activeElement =
            typeof document !== "undefined" ? (document.activeElement as HTMLElement | null) : null;
        const activeWithinVoiceRegion = Boolean(
            activeElement && mainRef.current?.contains(activeElement)
        );

        if (
            !shouldHandleVoiceEscape({
                activeElementTagName: activeElement?.tagName,
                activeWithinVoiceRegion,
                isSpeaking,
                step,
            })
        ) {
            return;
        }

        if (isSpeaking) {
            event.preventDefault();
            handleStopSpeaking();
            return;
        }

        if (step === "listening") {
            event.preventDefault();
            stopListening();
            return;
        }

        if (step === "review" || step === "error" || step === "result") {
            event.preventDefault();
            resetFlow();
        }
    });

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        function handleKeyDown(event: KeyboardEvent) {
            handleEscapeShortcut(event);
        }

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [handleEscapeShortcut]);

    function resetFlow(nextStep: VoiceStep = "initial") {
        startSessionIdRef.current += 1;
        const recognition = recognitionRef.current;
        recognitionRef.current = null;
        detachRecognitionHandlers(recognition);
        recognition?.stop();
        const mediaRecorder = mediaRecorderRef.current;
        mediaRecorderRef.current = null;
        detachMediaRecorderHandlers(mediaRecorder);
        if (mediaRecorder && mediaRecorder.state !== "inactive") {
            mediaRecorder.stop();
        }
        clearAudioStream();
        if (typeof window !== "undefined") {
            stopSpeaking(window);
        }

        recordingChunksRef.current = [];
        pendingRecordedBlobRef.current = null;
        latestTranscriptRef.current = "";
        latestDisplayedTranscriptRef.current = "";
        latestConfidenceRef.current = undefined;
        didHandleRecognitionEndRef.current = false;
        manualStopRef.current = false;
        isStreamingStopRequestedRef.current = false;
        autoSpokenKeyRef.current = "";
        closeStreamingSession();
        ttsFallbackNoticeKeyRef.current = "";

        sessionLanguageRef.current = null;
        setActiveLanguageCode(null);
        setIsListening(false);
        setIsSpeaking(false);
        setIsVisualizerFading(false);
        setTranscript("");
        setConfidence(DEFAULT_FLOW_CONFIDENCE);
        setStreamingStatusValue("idle");
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

    async function consumeTranscription(transcription: VoiceTranscriptionPayload) {
        const normalizedTranscript = transcription.transcript.trim();

        pendingRecordedBlobRef.current = null;
        closeStreamingSession();
        setStreamingStatusValue("idle");

        if (!normalizedTranscript) {
            setError(getRecognitionErrorState("no-speech", t));
            setStep("error");
            return;
        }

        const confidenceMeta = getConfidenceMeta(undefined);
        const emergencyResult = detectEmergencyKeywords(normalizedTranscript);

        setTranscript(normalizedTranscript);
        setConfidence(confidenceMeta);
        setEmergencyMatches(emergencyResult.matches);
        setError(null);

        if (
            shouldReviewTranscription(normalizedTranscript, {
                selectedLanguage: getWorkflowLanguageCode(),
                detectedLanguage: transcription.language,
            })
        ) {
            setStep("review");
            return;
        }

        await analyseTranscript(normalizedTranscript, confidenceMeta, emergencyResult.matches);
    }

    async function fallbackToRecordedUpload() {
        const pendingRecordedBlob = pendingRecordedBlobRef.current;
        if (!pendingRecordedBlob) {
            return;
        }

        pendingRecordedBlobRef.current = null;
        await handleRecordedAudioStop(pendingRecordedBlob);
    }

    async function handleRecordedAudioStop(mediaBlob: Blob) {
        if (!mediaBlob.size) {
            pendingRecordedBlobRef.current = null;
            closeStreamingSession();
            setStreamingStatusValue("idle");
            setError(getRecognitionErrorState("no-speech", t));
            setStep("error");
            return;
        }

        pendingRecordedBlobRef.current = null;
        setStep("processing");
        setError(null);

        try {
            const file = new File([mediaBlob], "voice-triage.webm", {
                type: mediaBlob.type || "audio/webm",
            });
            const activeWorkflowLanguage = getWorkflowLanguageCode();
            const transcription = await transcribeRecordedAudio(file, activeWorkflowLanguage);
            await consumeTranscription(transcription);
        } catch (transcriptionError) {
            closeStreamingSession();
            setStreamingStatusValue("idle");

            const errorStatus =
                transcriptionError instanceof Error && "status" in transcriptionError
                    ? Number(transcriptionError.status)
                    : undefined;

            if (errorStatus === 503 || errorStatus === 504) {
                setError(getServerErrorState(errorStatus, t));
            } else {
                setError({
                    type: "generic",
                    title: t("errors.generic_title"),
                    message:
                        transcriptionError instanceof Error && transcriptionError.message
                            ? transcriptionError.message
                            : t("errors.generic_message"),
                });
            }

            setStep("error");
        }
    }

    async function analyseTranscript(
        nextTranscript: string,
        nextConfidence: ConfidenceMeta,
        localEmergencyMatches: string[]
    ) {
        const activeLanguageOption = getVoiceLanguageOption(getWorkflowLanguageCode());
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
        const voiceMatch = resolveSpeechSynthesisVoice(
            window,
            resultLanguageOption.speechSynthesisLang
        );

        if (voiceMatch.voice) {
            utterance.voice = voiceMatch.voice;
        }

        if (voiceMatch.supportLevel === "fallback") {
            const fallbackNoticeKey = `${resultLanguageOption.value}:${result.summary}`;
            if (ttsFallbackNoticeKeyRef.current !== fallbackNoticeKey) {
                ttsFallbackNoticeKeyRef.current = fallbackNoticeKey;
                toast.warning(
                    t("tts_fallback_message", {
                        language: resultLanguageOption.label,
                    })
                );
            }
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
        isStreamingStopRequestedRef.current = true;
        setIsListening(false);
        setIsVisualizerFading(true);

        if (mediaRecorderRef.current) {
            if (mediaRecorderRef.current.state !== "inactive") {
                mediaRecorderRef.current.stop();
                return;
            }

            mediaRecorderRef.current = null;
        }

        if (!recognitionRef.current) {
            startSessionIdRef.current += 1;
            closeStreamingSession();
            setStreamingStatusValue("idle");
            clearAudioStream();
            setIsVisualizerFading(false);
            setStep("initial");
            return;
        }

        recognitionRef.current?.stop();
    }

    function startSpeechRecognitionFallback() {
        closeStreamingSession();
        setStreamingStatusValue("idle");
        const fallbackWorkflowLanguageOption = getVoiceLanguageOption(getWorkflowLanguageCode());
        const SpeechRecognition = getSpeechRecognitionConstructor(window);
        if (!SpeechRecognition) {
            setError(
                getRecognitionErrorState("unsupported", t, fallbackWorkflowLanguageOption.label)
            );
            setStep("error");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = fallbackWorkflowLanguageOption.speechRecognition;
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
            setError(
                getRecognitionErrorState(
                    event.error || "generic",
                    t,
                    fallbackWorkflowLanguageOption.label
                )
            );
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

    async function startListening() {
        if (typeof window === "undefined") {
            return;
        }

        handleStopSpeaking();

        const sessionId = startSessionIdRef.current + 1;
        startSessionIdRef.current = sessionId;
        clearAudioStream();

        const recognition = recognitionRef.current;
        recognitionRef.current = null;
        detachRecognitionHandlers(recognition);
        recognition?.stop();

        const mediaRecorder = mediaRecorderRef.current;
        mediaRecorderRef.current = null;
        detachMediaRecorderHandlers(mediaRecorder);
        closeStreamingSession();
        if (mediaRecorder && mediaRecorder.state !== "inactive") {
            mediaRecorder.stop();
        }

        recordingChunksRef.current = [];
        pendingRecordedBlobRef.current = null;
        latestTranscriptRef.current = "";
        latestDisplayedTranscriptRef.current = "";
        latestConfidenceRef.current = undefined;
        didHandleRecognitionEndRef.current = false;
        manualStopRef.current = false;
        isStreamingStopRequestedRef.current = false;
        ttsFallbackNoticeKeyRef.current = "";

        sessionLanguageRef.current = selectedLanguage;
        setActiveLanguageCode(selectedLanguage);
        setTranscript("");
        setConfidence(DEFAULT_FLOW_CONFIDENCE);
        setStreamingStatusValue("idle");
        setResult(null);
        setError(null);
        setEmergencyMatches([]);
        setIsVisualizerFading(false);

        const canRecordAudio =
            typeof navigator !== "undefined" &&
            Boolean(navigator.mediaDevices?.getUserMedia) &&
            supportsAudioRecording(window);

        if (!canRecordAudio) {
            startSpeechRecognitionFallback();
            return;
        }

        let nextAudioStream: MediaStream;
        try {
            nextAudioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (captureError) {
            const errorName =
                captureError instanceof DOMException ? captureError.name : "audio-capture";

            if (errorName === "NotAllowedError" || errorName === "PermissionDeniedError") {
                setError(getRecognitionErrorState("not-allowed", t));
            } else if (errorName === "NotFoundError" || errorName === "DevicesNotFoundError") {
                setError(getRecognitionErrorState("audio-capture", t));
            } else {
                setError(getRecognitionErrorState("generic", t));
            }
            setStep("error");
            return;
        }

        if (startSessionIdRef.current !== sessionId) {
            stopMediaStream(nextAudioStream);
            return;
        }

        let mediaRecorderInstance: MediaRecorder;

        try {
            const mimeType = getPreferredRecordingMimeType(window.MediaRecorder);
            mediaRecorderInstance = new MediaRecorder(
                nextAudioStream,
                mimeType ? { mimeType } : undefined
            );
        } catch {
            stopMediaStream(nextAudioStream);
            startSpeechRecognitionFallback();
            return;
        }

        mediaRecorderRef.current = mediaRecorderInstance;
        setActiveAudioStream(nextAudioStream);
        setStep("listening");

        if (typeof window.WebSocket === "function") {
            try {
                streamingSessionRef.current = createVoiceStreamingSession({
                    language: selectedLanguage,
                    mimeType: mediaRecorderInstance.mimeType || "audio/webm",
                    onPartial: (payload) => {
                        setStreamingStatusValue("streaming");
                        setTranscript(payload.transcript);
                    },
                    onFinal: (payload) => {
                        void consumeTranscription(payload);
                    },
                    onFallback: () => {
                        closeStreamingSession();
                        setStreamingStatusValue("fallback");
                        if (isStreamingStopRequestedRef.current) {
                            void fallbackToRecordedUpload();
                        }
                    },
                });
                setStreamingStatusValue("connecting");
            } catch {
                closeStreamingSession();
                setStreamingStatusValue("fallback");
            }
        } else {
            setStreamingStatusValue("fallback");
        }

        mediaRecorderInstance.onstart = () => {
            setIsListening(true);
            setIsVisualizerFading(false);
            setStep("listening");
        };

        mediaRecorderInstance.ondataavailable = async (event) => {
            if (event.data.size > 0) {
                recordingChunksRef.current.push(event.data);
            }

            if (event.data.size > 0 && streamingSessionRef.current) {
                try {
                    await streamingSessionRef.current.sendChunk(event.data);
                } catch {
                    closeStreamingSession();
                    setStreamingStatusValue("fallback");
                }
            }
        };

        mediaRecorderInstance.onerror = () => {
            if (mediaRecorderRef.current === mediaRecorderInstance) {
                mediaRecorderRef.current = null;
            }
            detachMediaRecorderHandlers(mediaRecorderInstance);
            closeStreamingSession();
            setStreamingStatusValue("idle");
            pendingRecordedBlobRef.current = null;
            clearAudioStream();
            setIsListening(false);
            setIsVisualizerFading(false);
            setError(getRecognitionErrorState("generic", t));
            setStep("error");
        };

        mediaRecorderInstance.onstop = async () => {
            if (mediaRecorderRef.current === mediaRecorderInstance) {
                mediaRecorderRef.current = null;
            }

            const mediaBlob = new Blob(recordingChunksRef.current, {
                type: mediaRecorderInstance.mimeType || "audio/webm",
            });

            recordingChunksRef.current = [];
            detachMediaRecorderHandlers(mediaRecorderInstance);
            clearAudioStream();
            setIsListening(false);
            setIsVisualizerFading(false);
            pendingRecordedBlobRef.current = mediaBlob;

            if (streamingSessionRef.current && streamingStatusRef.current !== "fallback") {
                setStep("processing");
                setError(null);
                streamingSessionRef.current.finish();
                return;
            }

            await handleRecordedAudioStop(mediaBlob);
        };

        try {
            mediaRecorderInstance.start(750);
        } catch {
            if (mediaRecorderRef.current === mediaRecorderInstance) {
                mediaRecorderRef.current = null;
            }
            detachMediaRecorderHandlers(mediaRecorderInstance);
            closeStreamingSession();
            setStreamingStatusValue("idle");
            stopMediaStream(nextAudioStream);
            setActiveAudioStream(null);
            startSpeechRecognitionFallback();
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
    const listeningHelperLabel =
        step !== "listening"
            ? undefined
            : streamingStatus === "connecting"
              ? t("streaming_connecting_hint")
              : streamingStatus === "streaming"
                ? t("streaming_live_hint")
                : streamingStatus === "fallback"
                  ? t("streaming_fallback_hint")
                  : undefined;

    return (
        <div className="relative flex min-h-screen flex-col overflow-hidden bg-(--color-surface-muted) text-(--color-text-primary) font-sans">
            <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
                {srAnnouncement}
            </div>

            <div
                className="absolute top-0 right-0 -mt-20 -mr-20 h-96 w-96 rounded-full bg-emerald-100/40 dark:bg-emerald-950/15 blur-3xl"
                aria-hidden="true"
            ></div>
            <div
                className="absolute bottom-0 left-0 -mb-20 -ml-20 h-80 w-80 rounded-full bg-blue-100/40 dark:bg-blue-950/15 blur-3xl"
                aria-hidden="true"
            ></div>

            <PageHeader
                title={t("header_title")}
                subtitle={t("header_subtitle")}
                backHref="/"
                variant="light"
                showLanguage={true}
                languageName={
                    isLanguageSelectionLocked
                        ? step === "result" && resultLanguageCode
                            ? resultLanguageOption.label
                            : workflowLanguageOption.label
                        : getVoiceLanguageOption(selectedLanguage).label
                }
            />

            <main
                id="main-content"
                ref={mainRef}
                tabIndex={-1}
                className="relative z-10 flex flex-1 flex-col items-center justify-center gap-6 px-6 py-8"
            >
                <div className="w-full max-w-md">
                    <label
                        htmlFor="voice-language"
                        className="mb-2 block text-xs font-bold tracking-widest text-(--color-text-secondary) uppercase"
                    >
                        {t("language_selector")}
                    </label>
                    <select
                        id="voice-language"
                        value={selectedLanguage}
                        onChange={(event) => setSelectedLanguage(event.target.value)}
                        disabled={isLanguageSelectionLocked}
                        className={`w-full rounded-2xl border border-(--color-border-muted) bg-(--color-surface-page) px-4 py-3 text-sm font-semibold text-(--color-text-primary) shadow-sm disabled:cursor-not-allowed disabled:bg-(--color-surface-muted) ${VOICE_FOCUS_RING_CLASS}`}
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

                <div
                    ref={panelRef}
                    tabIndex={-1}
                    className="w-full max-w-md rounded-[2.5rem] focus-visible:ring-[3px] focus-visible:ring-emerald-600 focus-visible:ring-offset-2 focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                >
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
                            helperLabel={listeningHelperLabel}
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
                            switchToTextLabel={t("switch_to_text_button")}
                            onRetry={() => resetFlow()}
                            onSwitchToText={() => router.push(`/${locale}/health`)}
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
                </div>
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
                        className={`relative flex h-24 w-24 items-center justify-center rounded-full transition-all duration-500 focus-visible:ring-[3px] focus-visible:ring-emerald-600 focus-visible:ring-offset-4 focus-visible:outline-[3px] focus-visible:outline-offset-4 focus-visible:outline-emerald-600 ${
                            step === "listening"
                                ? "scale-125 bg-red-500"
                                : "bg-emerald-600 shadow-xl shadow-emerald-600/30 hover:scale-110"
                        } `}
                    >
                        {step === "listening" ? (
                            <div
                                className="absolute inset-0 animate-ping rounded-full bg-red-500 opacity-30"
                                aria-hidden="true"
                            ></div>
                        ) : (
                            <div
                                className="absolute inset-0 animate-pulse rounded-full bg-emerald-600 opacity-20"
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
                        className="mt-6 text-sm font-bold tracking-widest text-(--color-text-muted) uppercase"
                        aria-hidden="true"
                    >
                        {step === "listening" ? t("stop_listening_label") : t("tap_to_speak")}
                    </p>
                </div>
            )}

            <footer className="p-8 text-center">
                <p className="mx-auto max-w-xs text-[10px] font-bold tracking-widest text-(--color-text-muted) uppercase">
                    {t("footer_note")}
                </p>
            </footer>
        </div>
    );
}
