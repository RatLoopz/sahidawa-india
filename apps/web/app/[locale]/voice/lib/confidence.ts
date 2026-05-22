export type ConfidenceTone = "positive" | "caution" | "critical" | "neutral";

export type ConfidenceMeta = {
    id: "high" | "medium" | "low" | "unavailable";
    label: "High" | "Medium" | "Low" | "Unavailable";
    tone: ConfidenceTone;
    shouldReview: boolean;
    value?: number;
};

const LOW_CONFIDENCE_THRESHOLD = 0.65;
const HIGH_CONFIDENCE_THRESHOLD = 0.85;

export function getConfidenceMeta(confidence?: number): ConfidenceMeta {
    if (typeof confidence !== "number" || Number.isNaN(confidence)) {
        return {
            id: "unavailable",
            label: "Unavailable",
            tone: "neutral",
            shouldReview: false,
        };
    }

    if (confidence < LOW_CONFIDENCE_THRESHOLD) {
        return {
            id: "low",
            label: "Low",
            tone: "critical",
            shouldReview: true,
            value: confidence,
        };
    }

    if (confidence < HIGH_CONFIDENCE_THRESHOLD) {
        return {
            id: "medium",
            label: "Medium",
            tone: "caution",
            shouldReview: false,
            value: confidence,
        };
    }

    return {
        id: "high",
        label: "High",
        tone: "positive",
        shouldReview: false,
        value: confidence,
    };
}
