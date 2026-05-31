"use client";

// ─── TypingIndicator ───────────────────────────────────────────────────────────
// Animated three-dot indicator shown while the assistant is generating a reply.

export function TypingIndicator() {
    return (
        <div
            role="status"
            aria-label="SahiDawa is thinking"
            className="sd-slide-in flex items-end gap-2.5"
        >
            {/* Bot avatar */}
            <div
                aria-hidden="true"
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl bg-emerald-600 shadow-sm"
            >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                    <path d="M17 8C8 10 5.9 16.17 3.82 19.71L5.71 21l1-1.71c.19.13.39.26.59.37C9 21.07 11 22 14 22c3.56 0 6.83-1.63 9-4.56V3l-4 2-2-3-4.5 5.5C11.5 8 14 8 17 8z" />
                </svg>
            </div>

            {/* Dots bubble */}
            <div className="rounded-2xl rounded-bl-sm border border-white/40 bg-white/50 px-4 py-3 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-slate-800/50">
                <div className="flex h-5 items-center gap-1.5" aria-hidden="true">
                    {[0, 1, 2].map((i) => (
                        <span
                            key={i}
                            className="h-2 w-2 rounded-full bg-emerald-400"
                            style={{
                                animation: "sd-typing-dot 1.4s ease-in-out infinite",
                                animationDelay: `${i * 0.18}s`,
                            }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
