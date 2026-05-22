import { renderToStaticMarkup } from "react-dom/server";

import { VoiceAnimationToggle } from "../app/[locale]/voice/VoiceAnimationToggle";
import { VoiceListeningPanel } from "../app/[locale]/voice/VoicePanels";
import {
    resolveVoiceAnimationPreference,
    stopMediaQueryChangeListener,
    stopMediaStream,
    subscribeToMediaQueryChange,
} from "../app/[locale]/voice/lib/audio";

describe("voice audio visualizer helpers", () => {
    it("defaults animations off when the user prefers reduced motion", () => {
        expect(
            resolveVoiceAnimationPreference({
                storedPreference: null,
                prefersReducedMotion: true,
            })
        ).toBe(false);
    });

    it("lets an explicit stored preference override reduced-motion defaults", () => {
        expect(
            resolveVoiceAnimationPreference({
                storedPreference: "enabled",
                prefersReducedMotion: true,
            })
        ).toBe(true);

        expect(
            resolveVoiceAnimationPreference({
                storedPreference: "disabled",
                prefersReducedMotion: false,
            })
        ).toBe(false);
    });

    it("stops every track on a media stream and tolerates missing streams", () => {
        const firstStop = jest.fn();
        const secondStop = jest.fn();
        const stream = {
            getTracks: () => [{ stop: firstStop }, { stop: secondStop }],
        };

        expect(() => stopMediaStream(null)).not.toThrow();
        stopMediaStream(stream);

        expect(firstStop).toHaveBeenCalledTimes(1);
        expect(secondStop).toHaveBeenCalledTimes(1);
    });

    it("falls back to legacy media query listeners when EventTarget methods are unavailable", () => {
        const listener = jest.fn();
        const addListener = jest.fn();
        const removeListener = jest.fn();
        const legacyQuery = {
            matches: false,
            addListener,
            removeListener,
        };

        const subscription = subscribeToMediaQueryChange(legacyQuery, listener);
        stopMediaQueryChangeListener(subscription);

        expect(addListener).toHaveBeenCalledWith(listener);
        expect(removeListener).toHaveBeenCalledWith(listener);
    });
});

describe("VoiceListeningPanel visualizer fallback", () => {
    it("renders accessible visualizer and volume labels without requiring a DOM canvas", () => {
        const markup = renderToStaticMarkup(
            <VoiceListeningPanel
                transcript="Start speaking about your symptoms..."
                statusLabel="Listening for symptoms"
                stream={null}
                isListening={true}
                isFading={false}
                animationsEnabled={false}
                visualizerLabel="Microphone waveform"
                volumeLabel="Volume level"
                liveVolumeLabel="Live"
                stillVolumeLabel="Still"
                visualizerUnavailableLabel="Live waveform unavailable"
            />
        );

        expect(markup).toContain("Microphone waveform");
        expect(markup).toContain("Volume level");
        expect(markup).toContain("Live waveform unavailable");
        expect(markup).toContain("Start speaking about your symptoms...");
    });

    it("uses localized visualizer state labels", () => {
        const markup = renderToStaticMarkup(
            <VoiceListeningPanel
                transcript="அறிகுறிகளை சொல்லுங்கள்"
                statusLabel="கேட்கிறது"
                stream={null}
                isListening={true}
                isFading={false}
                animationsEnabled={false}
                visualizerLabel="மைக்ரோஃபோன் அலைவடிவம்"
                volumeLabel="ஒலி அளவு"
                liveVolumeLabel="நேரடி"
                stillVolumeLabel="நிலையானது"
                visualizerUnavailableLabel="நேரடி அலைவடிவம் இல்லை"
            />
        );

        expect(markup).toContain("நிலையானது");
        expect(markup).not.toContain("Still");
    });
});

describe("VoiceAnimationToggle", () => {
    it("renders as a polished switch with an active state", () => {
        const markup = renderToStaticMarkup(
            <VoiceAnimationToggle
                label="Voice animations"
                liveLabel="Live waveform"
                reducedMotionLabel="Reduced motion"
                enabled={true}
                onToggle={() => undefined}
            />
        );

        expect(markup).toContain('role="switch"');
        expect(markup).toContain('aria-checked="true"');
        expect(markup).toContain("Voice animations");
        expect(markup).toContain("bg-emerald-600");
        expect(markup).toContain("shadow-emerald-500/25");
    });

    it("renders localized state copy instead of fixed English labels", () => {
        const markup = renderToStaticMarkup(
            <VoiceAnimationToggle
                label="குரல் அசைவுகள்"
                liveLabel="நேரடி அலைவடிவம்"
                reducedMotionLabel="குறைந்த அசைவு"
                enabled={false}
                onToggle={() => undefined}
            />
        );

        expect(markup).toContain("குரல் அசைவுகள்");
        expect(markup).toContain("குறைந்த அசைவு");
        expect(markup).not.toContain("Reduced motion");
    });
});
