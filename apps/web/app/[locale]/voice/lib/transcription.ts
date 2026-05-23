export type VoiceTranscriptionPayload = {
    transcript: string;
    language: string | null;
    languageConfidence: number | null;
};

type ReviewOptions = {
    selectedLanguage?: string;
    detectedLanguage?: string | null;
};
export function normalizeVoiceTranscriptionResponse(
    payload: VoiceTranscriptionPayload
): VoiceTranscriptionPayload {
    return {
        transcript: payload.transcript.trim(),
        language: payload.language,
        languageConfidence: payload.languageConfidence,
    };
}

function getPrimaryLanguageCode(language: string | null | undefined) {
    if (!language) {
        return null;
    }

    return language.split("-")[0]?.trim().toLowerCase() || null;
}

async function readJsonSafely(response: Response) {
    try {
        return await response.json();
    } catch {
        return null;
    }
}

export async function transcribeRecordedAudio(
    file: File,
    selectedLanguage?: string
): Promise<VoiceTranscriptionPayload> {
    const formData = new FormData();
    formData.append("file", file);
    if (selectedLanguage?.trim()) {
        formData.append("language", selectedLanguage.trim());
    }

    const response = await fetch("/api/voice/transcribe", {
        method: "POST",
        body: formData,
    });

    const data = await readJsonSafely(response);

    if (!response.ok) {
        throw new Error(
            data && typeof data === "object" && typeof data.error === "string" && data.error.trim()
                ? data.error
                : "Transcription failed."
        );
    }

    return normalizeVoiceTranscriptionResponse({
        transcript: String(data && typeof data === "object" ? (data.transcript ?? "") : ""),
        language:
            data && typeof data === "object" && typeof data.language === "string"
                ? data.language
                : null,
        languageConfidence:
            data && typeof data === "object" && typeof data.languageConfidence === "number"
                ? data.languageConfidence
                : null,
    });
}

export function shouldReviewTranscription(transcript: string, options: ReviewOptions = {}) {
    const normalizedTranscript = transcript.trim();
    const wordCount = normalizedTranscript.split(/\s+/).filter(Boolean).length;
    if (wordCount < 3 || normalizedTranscript.length < 12) {
        return true;
    }

    const selectedLanguage = getPrimaryLanguageCode(options.selectedLanguage);
    const detectedLanguage = getPrimaryLanguageCode(options.detectedLanguage);
    if (selectedLanguage && detectedLanguage && selectedLanguage !== detectedLanguage) {
        return true;
    }

    return false;
}
