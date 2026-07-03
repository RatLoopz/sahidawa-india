"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { MessageSquare, X, Send, Bot, Home, Trash2, Check } from "lucide-react";
import { Link } from "@/i18n/routing";
import { getChatbotPanelClasses, getChatbotPositionClasses } from "./chatbotPosition";
import { ChatMarkdown } from "@/app/components/ChatMarkdown";
import { isAbortError, readChatErrorMessage, readTextResponseStream } from "@/lib/chatStream";

type Message = {
    text: string;
    isBot: boolean;
    isTranslationKey?: boolean;
    isTyping?: boolean;
};

const MessageContent = ({ msg }: { msg: Message }) => {
    const t = useTranslations("chatbot");

    const content = msg.isTranslationKey ? t(msg.text) : msg.text;

    return msg.isBot ? (
        <ChatMarkdown content={content} />
    ) : (
        <span className="text-sm leading-relaxed whitespace-pre-wrap">{content}</span>
    );
};

const ChatSkeleton = () => {
    return (
        <div className="max-w-[85%] animate-pulse self-start rounded-2xl rounded-tl-sm border border-(--color-border-muted) bg-(--color-surface-page) p-3 shadow-sm">
            <div className="mb-2 h-3 w-32 rounded bg-gray-300"></div>
            <div className="mb-2 h-3 w-48 rounded bg-gray-300"></div>
            <div className="h-3 w-24 rounded bg-gray-300"></div>
        </div>
    );
};

export default function Chatbot() {
    const pathname = usePathname();
    const t = useTranslations("chatbot");
    const tHome = useTranslations("Home");
    const tA11y = useTranslations("A11y");
    const [isOpen, setIsOpen] = useState(false);
    const [isLoadingWelcome, setIsLoadingWelcome] = useState(true);
    const [messages, setMessages] = useState<Message[]>([
        {
            text: "welcome",
            isBot: true,
            isTranslationKey: true,
        },
    ]);
    const [input, setInput] = useState("");
    const [isConfirmingClear, setIsConfirmingClear] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chatbotRef = useRef<HTMLDivElement>(null);
    const activeRequestRef = useRef<AbortController | null>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const handleClear = () => {
        activeRequestRef.current?.abort();
        setMessages([
            {
                text: "welcome",
                isBot: true,
                isTranslationKey: true,
            },
        ]);
        setInput("");
        setIsConfirmingClear(false);
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsLoadingWelcome(false);
        }, 600);

        return () => clearTimeout(timer);
    }, []);
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (chatbotRef.current && !chatbotRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen]);

    useEffect(() => {
        return () => {
            activeRequestRef.current?.abort();
        };
    }, []);

    // Securely check route-based visibility after hook declarations to satisfy React Rules of Hooks
    if (pathname && pathname.includes("/health")) {
        return null;
    }

    const handleSend = async () => {
        if (!input.trim() || messages.some((message) => message.isTyping)) return;

        activeRequestRef.current?.abort();
        const requestController = new AbortController();
        activeRequestRef.current = requestController;
        const userMessage = { text: input, isBot: false };
        const currentMessages = [...messages, userMessage];
        setMessages(currentMessages);
        setInput("");

        setMessages((prev) => [...prev, { text: "Thinking...", isBot: true, isTyping: true }]);

        try {
            const response = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ messages: currentMessages }),
                signal: requestController.signal,
            });

            if (!response.ok) {
                throw new Error(await readChatErrorMessage(response, "Failed to fetch response"));
            }

            let streamedReply = "";
            const reply = await readTextResponseStream(
                response,
                (chunk) => {
                    streamedReply += chunk;
                    setMessages((prev) =>
                        prev.map((msg) =>
                            msg.isTyping ? { ...msg, text: streamedReply || "Thinking..." } : msg
                        )
                    );
                },
                { signal: requestController.signal }
            );

            setMessages((prev) => {
                const finalText = reply || "Sorry, I received an empty response.";
                return prev.map((msg) => (msg.isTyping ? { text: finalText, isBot: true } : msg));
            });
        } catch (error: any) {
            if (isAbortError(error)) return;

            console.error("Chatbot API Error:", error);
            setMessages((prev) => {
                const withoutTyping = prev.filter((msg) => !msg.isTyping);
                return [
                    ...withoutTyping,
                    {
                        text:
                            error.message ||
                            "Sorry, I am having trouble connecting to the AI. Please make sure the GEMINI_API_KEY environment variable is set.",
                        isBot: true,
                    },
                ];
            });
        } finally {
            if (activeRequestRef.current === requestController) {
                activeRequestRef.current = null;
            }
        }
    };

    return (
        <div className={getChatbotPositionClasses({ pathname, isOpen })}>
            <div
            ref={chatbotRef}
                className={`${getChatbotPanelClasses({ pathname })} ${
                    isOpen
                        ? "pointer-events-auto scale-100 opacity-100"
                        : "pointer-events-none scale-95 opacity-0"
                } origin-bottom-right transition-all duration-300 ease-out`}
            >
                {/* Header */}
                <div className="z-10 flex items-center justify-between bg-green-600 p-4 text-white shadow-md dark:bg-green-700">
                    <div className="flex items-center gap-3">
                        <div className="rounded-full bg-white/20 p-2">
                            <Bot size={20} />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold">{t("title")}</h3>
                            <p className="text-xs text-white/95">{t("status")}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        {isConfirmingClear ? (
                            <div className="flex items-center gap-1 rounded-full bg-white/10 px-1 py-0.5">
                                <button
                                    onClick={handleClear}
                                    className="rounded-full p-1.5 text-green-300 transition-colors hover:bg-white/20 hover:text-green-200"
                                    aria-label={tA11y("confirmClearConversation")}
                                    title={tA11y("confirmClearConversation")}
                                >
                                    <Check size={16} />
                                </button>
                                <button
                                    onClick={() => setIsConfirmingClear(false)}
                                    className="rounded-full p-1.5 text-red-300 transition-colors hover:bg-white/20 hover:text-red-200"
                                    aria-label={tA11y("cancelClearConversation")}
                                    title={tA11y("cancelClearConversation")}
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setIsConfirmingClear(true)}
                                className="rounded-full p-2 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
                                aria-label={t("clear")}
                                title={t("clear")}
                            >
                                <Trash2 size={18} />
                            </button>
                        )}
                        <Link
                            href="/"
                            className="rounded-full p-2 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
                            aria-label={tA11y("goToHomepage")}
                        >
                            <Home size={18} />
                        </Link>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="rounded-full p-2 text-white transition-colors hover:bg-white/20"
                            aria-label={tA11y("closeChat")}
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex flex-1 flex-col gap-4 overflow-y-auto bg-(--color-surface-muted) p-4">
                    {isLoadingWelcome ? (
                        <ChatSkeleton />
                    ) : (
                        messages.map((msg, idx) => (
                            <div
                                key={idx}
                                className={`max-w-[85%] rounded-2xl p-3 shadow-sm ${
                                    msg.isBot
                                        ? "self-start rounded-tl-sm border border-(--color-border-muted) bg-(--color-surface-page) text-(--color-text-primary)"
                                        : "self-end rounded-tr-sm bg-green-600 text-white dark:bg-green-700"
                                }`}
                            >
                                <MessageContent msg={msg} />
                            </div>
                        ))
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="flex items-center gap-2 border-t border-(--color-border-muted) bg-(--color-surface-page) p-3">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSend()}
                        placeholder={t("placeholder")}
                        className="flex-1 rounded-full bg-(--color-surface-muted) px-4 py-3 text-sm text-(--color-text-primary) transition-all placeholder:text-(--color-text-muted) focus:ring-2 focus:ring-green-500/50 focus:outline-none"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim()}
                        className="flex h-11 w-11 items-center justify-center rounded-full bg-green-600 p-3 text-white shadow-md transition-colors hover:bg-green-700 disabled:opacity-50 dark:bg-green-700 dark:hover:bg-green-800"
                        aria-label={tA11y("sendMessage")}
                    >
                        <Send size={18} className="relative right-[1px] bottom-[1px]" />
                    </button>
                </div>
            </div>

            <div className="group relative flex items-center">
                {!isOpen && (
                    <div className="absolute right-16 rounded-lg bg-slate-900 px-3 py-2 text-sm whitespace-nowrap text-white opacity-0 transition-all duration-300 group-hover:opacity-100">
                        {tHome("ai_health_assistant")}
                    </div>
                )}

                <button
                    onClick={(e) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
}}
                    className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full bg-green-600 text-white shadow-[0_8px_20px_rgba(22,163,74,0.3)] transition-all hover:scale-105 hover:shadow-[0_8px_25px_rgba(22,163,74,0.4)] active:scale-95 dark:bg-green-700 dark:hover:bg-green-800"
                    aria-label={isOpen ? tA11y("closeAiChat") : tA11y("openAiChat")}
                >
                    {isOpen ? <X size={28} /> : <MessageSquare size={28} />}
                </button>
            </div>
        </div>
    );
}
