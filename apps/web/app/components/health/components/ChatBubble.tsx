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
    className="w-9 h-9 rounded-2xl bg-emerald-600 flex items-center justify-center flex-shrink-0 shadow-sm"
  >
    <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
      <path d="M17 8C8 10 5.9 16.17 3.82 19.71L5.71 21l1-1.71c.19.13.39.26.59.37C9 21.07 11 22 14 22c3.56 0 6.83-1.63 9-4.56V3l-4 2-2-3-4.5 5.5C11.5 8 14 8 17 8z" />
    </svg>
  </div>
);

const UserAvatar = () => (
  <div
    aria-hidden="true"
    className="w-9 h-9 rounded-2xl bg-slate-200 flex items-center justify-center flex-shrink-0"
  >
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#475569">
      <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
    </svg>
  </div>
);

const ErrorContent = ({ onRetry, msgId }: { onRetry?: (id: string) => void; msgId: string }) => (
  <div>
    <div className="flex items-start gap-2 mb-3">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="#dc2626" className="flex-shrink-0 mt-0.5" aria-hidden="true">
        <path d="M12 2L1 21h22L12 2zm0 3.5L20.5 19h-17L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z" />
      </svg>
      <div>
        <p className="text-sm font-semibold text-red-700 leading-snug">Connection issue</p>
        <p className="text-sm text-slate-600 mt-0.5 leading-relaxed">
          Unable to reach the health service. Please check your internet and try again.
        </p>
      </div>
    </div>
    <div className="flex items-center gap-2 flex-wrap">
      {onRetry && (
        <button
          onClick={() => onRetry(msgId)}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition-all px-3 py-1.5 rounded-lg min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
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
      className={`flex items-end gap-2.5 sd-slide-in ${isUser ? "flex-row-reverse" : "flex-row"}`}
    >
      {isUser ? <UserAvatar /> : <BotAvatar />}

      <div className={`flex flex-col gap-1 max-w-[78%] ${isUser ? "items-end" : "items-start"}`}>
        <span className="sr-only">{isUser ? "You" : "SahiDawa"} said:</span>

        <div
          className={`px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
            msg.isError
              ? "bg-red-50 border border-red-200 rounded-bl-sm"
              : isUser
              ? "bg-emerald-600 text-white rounded-br-sm"
              : "bg-white border border-slate-200 text-slate-700 rounded-bl-sm"
          }`}
        >
          {msg.isError ? <ErrorContent onRetry={onRetry} msgId={msg.id} /> : msg.content}
        </div>

        <time
          className="text-[11px] text-slate-400 px-1"
          dateTime={msg.timestamp.toISOString()}
        >
          {formatTime(msg.timestamp)}
        </time>
      </div>
    </div>
  );
}