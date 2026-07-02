import { ChatMessage } from "@/lib/constants";

export function estimateTokens(text: string): number {
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    return Math.ceil(words * 1.33);
}

export function trimHistoryByTokens(
    messages: ChatMessage[],
    maxTokens: number
): { trimmedMessages: ChatMessage[]; droppedMessages: ChatMessage[] } {
    try {
        const trimmed: ChatMessage[] = [];
        const dropped: ChatMessage[] = [];
        let currentTokens = 0;

        for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i];
            const text = msg.text || msg.content || "";
            const tokens = estimateTokens(text);
            const msgTokens = tokens + 4; // overhead buffer

            if (currentTokens + msgTokens > maxTokens && trimmed.length > 0) {
                dropped.unshift(msg);
                continue;
            }

            currentTokens += msgTokens;
            trimmed.unshift(msg);
        }

        return { trimmedMessages: trimmed, droppedMessages: dropped };
    } catch {
        return { trimmedMessages: messages.slice(-50), droppedMessages: [] };
    }
}
