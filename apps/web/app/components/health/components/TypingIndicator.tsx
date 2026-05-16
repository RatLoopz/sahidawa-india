"use client";

// ─── TypingIndicator ───────────────────────────────────────────────────────────
// Animated three-dot indicator shown while the assistant is generating a reply.

export function TypingIndicator() {
  return (
    <div
      role="status"
      aria-label="SahiDawa is thinking"
      className="flex items-end gap-2.5 sd-slide-in"
    >
      {/* Bot avatar */}
      <div
        aria-hidden="true"
        className="w-9 h-9 rounded-2xl bg-emerald-600 flex items-center justify-center flex-shrink-0 shadow-sm"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
          <path d="M17 8C8 10 5.9 16.17 3.82 19.71L5.71 21l1-1.71c.19.13.39.26.59.37C9 21.07 11 22 14 22c3.56 0 6.83-1.63 9-4.56V3l-4 2-2-3-4.5 5.5C11.5 8 14 8 17 8z" />
        </svg>
      </div>

      {/* Dots bubble */}
      <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
        <div className="flex gap-1.5 items-center h-5" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-2 h-2 rounded-full bg-emerald-400"
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