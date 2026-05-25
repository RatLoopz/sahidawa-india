import { renderToStaticMarkup } from "react-dom/server";

import { VoiceAudioVisualizer } from "../app/[locale]/voice/VoiceAudioVisualizer";
import {
    VoiceErrorPanel,
    VoiceProcessingPanel,
    VoiceResultPanel,
    VoiceReviewPanel,
} from "../app/[locale]/voice/VoicePanels";

describe("Voice Triage accessibility semantics", () => {
    it("renders VoiceProcessingPanel with status semantics and reduced-motion classes", () => {
        const markup = renderToStaticMarkup(
            <VoiceProcessingPanel
                title="Checking symptoms"
                subtitle="Analyzing with SahiDawa AI..."
            />
        );

        expect(markup).toContain('role="status"');
        expect(markup).toContain('aria-live="polite"');
        expect(markup).toContain('aria-label="Checking symptoms"');
        expect(markup).toContain("motion-reduce:animate-none");
    });

    it("renders VoiceReviewPanel with visible focus styles and reduced-motion support", () => {
        const markup = renderToStaticMarkup(
            <VoiceReviewPanel
                title="Please review your transcript"
                message="The microphone picked up low confidence audio."
                transcript="I have cold and headache"
                confidence={{
                    id: "low",
                    label: "Low",
                    value: 0.2,
                    tone: "critical",
                    shouldReview: true,
                }}
                confidenceLabelPrefix="Confidence"
                confidenceValueLabel="Low"
                retryLabel="Try Again"
                analyseLabel="Analyse Anyway"
                onRetry={() => undefined}
                onAnalyse={() => undefined}
                emergencyTitle="Urgent Care Needed"
                emergencyBody="Please seek clinical attention"
                showEmergency={true}
            />
        );

        expect(markup).toContain("motion-reduce:animate-none");
        expect(markup).toContain("focus-visible:outline-[3px]");
        expect(markup).toContain("focus-visible:outline-emerald-600");
        expect(markup).toContain("focus-visible:outline-offset-2");
        expect(markup).toContain("focus-visible:ring-[3px]");
        expect(markup).toContain("focus-visible:ring-emerald-600");
        expect(markup).toContain("focus-visible:ring-offset-2");
    });

    it("renders VoiceErrorPanel with retry focus styles and reduced-motion support", () => {
        const markup = renderToStaticMarkup(
            <VoiceErrorPanel
                error={{
                    title: "Access Denied",
                    message: "Microphone blocked",
                }}
                retryLabel="Try Again"
                switchToTextLabel="Type Instead"
                onRetry={() => undefined}
                onSwitchToText={() => undefined}
            />
        );

        const describedByMatch = markup.match(/aria-describedby="([^"]+)"/);
        const messageIdMatch = markup.match(
            /<p id="([^"]+)" class="mt-2 text-sm leading-relaxed text-slate-600">/
        );

        expect(markup).toContain("motion-reduce:animate-none");
        expect(describedByMatch?.[1]).toBeTruthy();
        expect(messageIdMatch?.[1]).toBe(describedByMatch?.[1]);
        expect(markup).toContain("focus-visible:outline-[3px]");
        expect(markup).toContain("focus-visible:outline-emerald-600");
        expect(markup).toContain("focus-visible:ring-[3px]");
        expect(markup).toContain("focus-visible:ring-emerald-600");
    });

    it("renders VoiceResultPanel with landmark semantics and focus states", () => {
        const markup = renderToStaticMarkup(
            <VoiceResultPanel
                heading="AI Triage Result"
                subheading="Clinical Assessment"
                transcriptLabel="Transcript"
                transcript="I have high fever"
                confidence={{
                    id: "high",
                    label: "High",
                    value: 0.95,
                    tone: "positive",
                    shouldReview: false,
                }}
                confidenceLabelPrefix="Confidence"
                confidenceValueLabel="High"
                result={{
                    text: "I have high fever",
                    summary: "Fever needs monitoring.",
                    recommendations: ["Rest well", "Drink water"],
                    emergency: false,
                    disclaimer: "Informational use only.",
                }}
                emergencyTitle="Urgent Care"
                emergencyBody="Seek help"
                recommendationsLabel="Recommended Actions"
                shareLabel="Share"
                speakLabel="Read Aloud"
                stopSpeakingLabel="Stop"
                tryAgainLabel="New Check"
                isSpeaking={false}
                onReplay={() => undefined}
                onStopSpeaking={() => undefined}
                onShare={() => undefined}
                onTryAgain={() => undefined}
            />
        );

        expect(markup).toContain('role="region"');
        expect(markup).toContain('aria-labelledby="voice-ai-analysis-heading"');
        expect(markup).toContain("focus-visible:outline-[3px]");
        expect(markup).toContain("focus-visible:outline-emerald-600");
        expect(markup).toContain("focus-visible:outline-offset-2");
        expect(markup).toContain("focus-visible:ring-[3px]");
        expect(markup).toContain("focus-visible:ring-emerald-600");
        expect(markup).toContain("focus-visible:ring-offset-2");
    });

    it("renders VoiceAudioVisualizer volume progressbar semantics", () => {
        const markup = renderToStaticMarkup(
            <VoiceAudioVisualizer
                stream={null}
                isActive={true}
                isFading={false}
                animationsEnabled={false}
                visualizerLabel="Audio Wave"
                volumeLabel="Volume"
                liveVolumeLabel="Live"
                stillVolumeLabel="Still"
                visualizerUnavailableLabel="Wave unavailable"
            />
        );

        expect(markup).toContain('role="progressbar"');
        expect(markup).toContain('aria-label="Volume"');
        expect(markup).toContain('aria-valuemin="0"');
        expect(markup).toContain('aria-valuemax="100"');
        expect(markup).toContain('aria-valuenow="0"');
    });
});
