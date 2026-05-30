"use client";

// ─── ChatBubble ────────────────────────────────────────────────────────────────
// Single chat message: avatar · bubble · timestamp · optional error state.

export interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
    isError?: boolean;
}

interface ChatBubbleProps {
    msg: Message;
    onRetry?: (id: string) => void;
}

const formatTime = (d: Date) =>
    d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

const BotAvatar = () => (
    <div
        aria-hidden="true"
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl bg-emerald-600 shadow-sm"
    >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
            <path d="M17 8C8 10 5.9 16.17 3.82 19.71L5.71 21l1-1.71c.19.13.39.26.59.37C9 21.07 11 22 14 22c3.56 0 6.83-1.63 9-4.56V3l-4 2-2-3-4.5 5.5C11.5 8 14 8 17 8z" />
        </svg>
    </div>
);

const UserAvatar = () => (
    <div
        aria-hidden="true"
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl bg-slate-200"
    >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--color-dark-scrollbar)">
            <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
        </svg>
    </div>
);

const ErrorContent = ({ onRetry, msgId }: { onRetry?: (id: string) => void; msgId: string }) => (
    <div>
        <div className="mb-3 flex items-start gap-2">
            <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="var(--color-accent-danger)"
                className="mt-0.5 flex-shrink-0"
                aria-hidden="true"
            >
                <path d="M12 2L1 21h22L12 2zm0 3.5L20.5 19h-17L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z" />
            </svg>
            <div>
                <p className="text-sm leading-snug font-semibold text-red-700">
                    AI Assistant Under Development
                </p>
                <p className="mt-0.5 text-sm leading-relaxed text-slate-600">
                    This feature is currently under development. Please check back soon!
                </p>
            </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
            {onRetry && (
                <button
                    onClick={() => onRetry(msgId)}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white transition-all hover:bg-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none active:scale-95"
                    aria-label="Retry last message"
                >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="white" aria-hidden="true">
                        <path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
                    </svg>
                    Retry
                </button>
            )}
            <span className="text-xs text-slate-400">or wait a moment</span>
        </div>
    </div>
);

export function ChatBubble({ msg, onRetry }: ChatBubbleProps) {
    const isUser = msg.role === "user";

    return (
        <div
            role="listitem"
            className={`sd-slide-in flex items-start gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}
        >
            {isUser ? <UserAvatar /> : <BotAvatar />}

            <div
                className={`flex max-w-[78%] flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}
            >
                <span className="sr-only">{isUser ? "You" : "SahiDawa"} said:</span>

                <div
                    className={`rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                        msg.isError
                            ? "rounded-bl-sm border border-red-200/50 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30"
                            : isUser
                              ? "rounded-br-sm bg-linear-to-r from-emerald-500 to-teal-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                              : "rounded-bl-sm border border-white/40 bg-white/50 text-slate-800 backdrop-blur-xl dark:border-white/10 dark:bg-slate-800/50 dark:text-slate-200"
                    }`}
                >
                    {msg.isError ? <ErrorContent onRetry={onRetry} msgId={msg.id} /> : msg.content}
                </div>

                <time
                    className="px-1 text-[11px] text-slate-400"
                    dateTime={msg.timestamp.toISOString()}
                >
                    {formatTime(msg.timestamp)}
                </time>
            </div>
        </div>
    );
}
