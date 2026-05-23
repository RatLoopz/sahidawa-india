type VoiceShareReportInput = {
    timestamp: string;
    selectedLanguageLabel: string;
    transcript: string;
    confidenceLabel: string;
    emergency: boolean;
    summary: string;
    recommendations: string[];
    disclaimer: string;
    labels?: {
        title: string;
        timestamp: string;
        language: string;
        transcript: string;
        confidence: string;
        emergency: string;
        yes: string;
        no: string;
        summary: string;
        recommendations: string;
        disclaimer: string;
        defaultRecommendation: string;
    };
};

export function formatVoiceShareReport({
    timestamp,
    selectedLanguageLabel,
    transcript,
    confidenceLabel,
    emergency,
    summary,
    recommendations,
    disclaimer,
    labels,
}: VoiceShareReportInput) {
    const reportLabels = labels ?? {
        title: "SahiDawa Voice Triage Report",
        timestamp: "Timestamp",
        language: "Language",
        transcript: "Transcript",
        confidence: "Confidence",
        emergency: "Emergency Alert",
        yes: "Yes",
        no: "No",
        summary: "Summary",
        recommendations: "Recommendations",
        disclaimer: "Disclaimer",
        defaultRecommendation: "Follow the advice of a doctor or pharmacist.",
    };

    const recommendationLines =
        recommendations.length > 0
            ? recommendations.map((item, index) => `${index + 1}. ${item}`).join("\n")
            : `1. ${reportLabels.defaultRecommendation}`;

    return [
        reportLabels.title,
        `${reportLabels.timestamp}: ${timestamp}`,
        `${reportLabels.language}: ${selectedLanguageLabel}`,
        `${reportLabels.transcript}: ${transcript}`,
        `${reportLabels.confidence}: ${confidenceLabel}`,
        `${reportLabels.emergency}: ${emergency ? reportLabels.yes : reportLabels.no}`,
        `${reportLabels.summary}: ${summary}`,
        `${reportLabels.recommendations}:`,
        recommendationLines,
        `${reportLabels.disclaimer}: ${disclaimer}`,
    ].join("\n");
}
