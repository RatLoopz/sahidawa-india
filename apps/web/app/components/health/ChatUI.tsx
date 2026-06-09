"use client";

import Link from "next/link";
import { ThemeToggle } from "../../[locale]/components/ThemeToggle";
import { useState, useRef, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { ChatBubble, type Message } from "./components/ChatBubble";
import { ActionCard } from "./components/ActionCard";
import { TypingIndicator } from "./components/TypingIndicator";
import { TrustBar } from "./components/TrustBar";
import { Camera, Pill, MapPin, Home } from "lucide-react";
import { isAbortError, readChatErrorMessage, readTextResponseStream } from "@/lib/chatStream";

const genId = () => Math.random().toString(36).slice(2, 10);
const EMPTY_ASSISTANT_REPLY = "I'm here to help! Could you rephrase that?";

const INITIAL_MESSAGES = {
    en: "Namaste, I'm SahiDawa, your trusted health companion. I can help you verify medicines, understand symptoms, or find nearby care. What would you like help with today?",

    bn: "নমস্কার, আমি SahiDawa। আমি ওষুধ যাচাই, উপসর্গ বোঝা এবং নিকটবর্তী স্বাস্থ্যসেবা খুঁজে পেতে সাহায্য করতে পারি। আজ আপনাকে কীভাবে সাহায্য করতে পারি?",

    te: "నమస్కారం, నేను SahiDawa. మందులను ధృవీకరించడం, లక్షణాలను అర్థం చేసుకోవడం మరియు సమీప వైద్య సేవలను కనుగొనడంలో నేను సహాయం చేయగలను. ఈ రోజు మీకు ఎలా సహాయం చేయగలను?",

    ta: "வணக்கம், நான் SahiDawa. மருந்துகளை சரிபார்க்கவும், அறிகுறிகளை புரிந்துகொள்ளவும் மற்றும் அருகிலுள்ள சிகிச்சை சேவைகளை கண்டறியவும் உதவ முடியும். இன்று உங்களுக்கு என்ன உதவி வேண்டும்?",

    mr: "नमस्कार, मी SahiDawa आहे. मी औषध पडताळणी, लक्षणे समजून घेणे आणि जवळील आरोग्यसेवा शोधण्यात मदत करू शकतो. आज मी तुम्हाला कशी मदत करू?",

    gu: "નમસ્તે, હું SahiDawa છું. હું તમને દવાઓ ચકાસવામાં, લક્ષણો સમજવામાં અને નજીકની આરોગ્ય સેવાઓ શોધવામાં મદદ કરી શકું છું. આજે હું તમારી કેવી રીતે મદદ કરી શકું?",

    kn: "ನಮಸ್ಕಾರ, ನಾನು SahiDawa. ಔಷಧಿಗಳನ್ನು ಪರಿಶೀಲಿಸಲು, ಲಕ್ಷಣಗಳನ್ನು ಅರ್ಥಮಾಡಿಕೊಳ್ಳಲು ಮತ್ತು ಸಮೀಪದ ಆರೋಗ್ಯ ಸೇವೆಗಳನ್ನು ಹುಡುಕಲು ನಾನು ಸಹಾಯ ಮಾಡಬಹುದು. ಇಂದು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ?",

    ur: "السلام علیکم، میں SahiDawa ہوں۔ میں ادویات کی تصدیق، علامات کو سمجھنے اور قریبی صحت کی سہولیات تلاش کرنے میں مدد کر سکتا ہوں۔ آج میں آپ کی کیسے مدد کر سکتا ہوں؟",

    hi: "नमस्ते, मैं SahiDawa हूँ, आपका भरोसेमंद स्वास्थ्य साथी। मैं दवाइयों की पुष्टि करने, लक्षणों को समझने और आपके नज़दीकी स्वास्थ्य सेवाओं को खोजने में मदद कर सकता हूँ। आज मैं आपकी कैसे मदद कर सकता हूँ?",

    pa: "ਸਤ ਸ੍ਰੀ ਅਕਾਲ, ਮੈਂ SahiDawa ਹਾਂ, ਤੁਹਾਡਾ ਭਰੋਸੇਯੋਗ ਸਿਹਤ ਸਾਥੀ। ਮੈਂ ਦਵਾਈਆਂ ਦੀ ਪੁਸ਼ਟੀ ਕਰਨ, ਲੱਛਣਾਂ ਨੂੰ ਸਮਝਣ ਅਤੇ ਤੁਹਾਡੇ ਨੇੜੇ ਸਿਹਤ ਸੇਵਾਵਾਂ ਲੱਭਣ ਵਿੱਚ ਮਦਦ ਕਰ ਸਕਦਾ ਹਾਂ। ਅੱਜ ਮੈਂ ਤੁਹਾਡੀ ਕਿਵੇਂ ਮਦਦ ਕਰ ਸਕਦਾ ਹਾਂ?",

    or: "ନମସ୍କାର, ମୁଁ SahiDawa, ଆପଣଙ୍କର ଭରସାଯୋଗ୍ୟ ସ୍ୱାସ୍ଥ୍ୟ ସହଚର। ମୁଁ ଔଷଧ ଯାଞ୍ଚ କରିବା, ଲକ୍ଷଣ ବୁଝିବା ଏବଂ ନିକଟସ୍ଥ ସ୍ୱାସ୍ଥ୍ୟ ସେବା ଖୋଜିବାରେ ସହାୟତା କରିପାରିବି। ଆଜି ମୁଁ ଆପଣଙ୍କୁ କିପରି ସହାୟତା କରିପାରିବି?",
};

// Icons
const IconMic = ({ size = 20 }: { size?: number }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="22" />
        <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
);

const IconSend = () => (
    <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <line x1="22" y1="2" x2="11" y2="13" />
        <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
);

const IconStop = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
);

// Quick actions configuration
const ACTIONS = [
    {
        id: "scan",
        label: "Scan Medicine",
        description: "Verify authenticity",
        icon: <Camera className="h-5 w-5 text-emerald-500" />,
        prompt: "I'd like to verify a medicine.",
        accent: "emerald" as const,
    },
    {
        id: "symptoms",
        label: "Check Symptoms",
        description: "AI-assisted guidance",
        icon: <Pill className="h-5 w-5 text-sky-500" />,
        prompt: "I want to describe my symptoms.",
        accent: "sky" as const,
    },
    {
        id: "pharmacy",
        label: "Find Pharmacy",
        description: "Locate verified stores",
        icon: <MapPin className="h-5 w-5 text-amber-500" />,
        prompt: "Help me find a verified pharmacy nearby.",
        accent: "amber" as const,
    },
];

function upsertAssistantMessage(
    messages: Message[],
    id: string,
    content: string,
    options: { isError?: boolean } = {}
) {
    const existingMessage = messages.find((message) => message.id === id);

    if (!existingMessage) {
        return [
            ...messages,
            {
                id,
                role: "assistant" as const,
                content,
                timestamp: new Date(),
                isError: options.isError || undefined,
            },
        ];
    }

    return messages.map((message) =>
        message.id === id
            ? {
                  ...message,
                  content,
                  isError: options.isError || undefined,
              }
            : message
    );
}

export default function ChatUI() {
    const params = useParams();
    const locale = (params.locale as string) || "en";
    const initialMessage: Message = {
        id: "init",
        role: "assistant",
        content: INITIAL_MESSAGES[locale as keyof typeof INITIAL_MESSAGES] || INITIAL_MESSAGES.en,
        timestamp: new Date(),
    };
    const [messages, setMessages] = useState<Message[]>([initialMessage]);
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [showWelcome, setShowWelcome] = useState(true);
    const [streamingAssistantId, setStreamingAssistantId] = useState<string | null>(null);
    const lastUserText = useRef("");
    const messagesContainerRef = useRef<HTMLElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const recRef = useRef<any>(null);
    const activeRequestRef = useRef<AbortController | null>(null);
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;

        return () => {
            isMountedRef.current = false;
            activeRequestRef.current?.abort();
            recRef.current?.stop?.();
        };
    }, []);

    useEffect(() => {
        const container = messagesContainerRef.current;
        if (!container) return;

        container.scrollTo({
            top: container.scrollHeight,
            behavior: "smooth",
        });
    }, [messages, isTyping]);

    useEffect(() => {
        const ta = inputRef.current;
        if (!ta) return;
        ta.style.height = "auto";
        ta.style.height = Math.min(ta.scrollHeight, 100) + "px";
    }, [input]);

    const sendMessage = useCallback(
        async (text: string) => {
            const trimmed = text.trim();
            if (!trimmed || isTyping) return;
            lastUserText.current = trimmed;
            setShowWelcome(false);
            const userMsg: Message = {
                id: genId(),
                role: "user",
                content: trimmed,
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, userMsg]);
            setInput("");
            setIsTyping(true);

            activeRequestRef.current?.abort();
            const requestController = new AbortController();
            activeRequestRef.current = requestController;
            const isActiveRequest = () =>
                isMountedRef.current &&
                activeRequestRef.current === requestController &&
                !requestController.signal.aborted;

            let assistantMessageId: string | null = null;
            let streamedReply = "";

            try {
                const history = [...messages, userMsg]
                    .filter((m) => !m.isError)
                    .map((m) => ({ role: m.role, content: m.content }));
                const res = await fetch("/api/chat", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ messages: history, locale }),
                    signal: requestController.signal,
                });
                if (res.status === 429) {
                    throw new Error("Too many requests. Please try again in a few moments.");
                }
                if (!res.ok) {
                    throw new Error(
                        await readChatErrorMessage(res, "Failed to generate AI response")
                    );
                }

                const reply = await readTextResponseStream(
                    res,
                    (chunk) => {
                        if (!isActiveRequest()) return;

                        streamedReply += chunk;

                        if (!assistantMessageId) {
                            assistantMessageId = genId();
                            setStreamingAssistantId(assistantMessageId);
                        }

                        setMessages((prev) =>
                            upsertAssistantMessage(
                                prev,
                                assistantMessageId as string,
                                streamedReply
                            )
                        );
                    },
                    { signal: requestController.signal }
                );

                if (!isActiveRequest()) return;

                const finalReply = reply || EMPTY_ASSISTANT_REPLY;
                if (!assistantMessageId) {
                    assistantMessageId = genId();
                }

                setMessages((prev) =>
                    upsertAssistantMessage(prev, assistantMessageId as string, finalReply)
                );
            } catch (err: any) {
                if (isAbortError(err)) return;
                if (!isActiveRequest()) return;

                const errorMessage = err.message || "Something went wrong";
                const messageId = assistantMessageId || genId();

                setMessages((prev) =>
                    upsertAssistantMessage(prev, messageId, errorMessage, { isError: true })
                );
            } finally {
                if (activeRequestRef.current === requestController) {
                    activeRequestRef.current = null;
                    if (isMountedRef.current) {
                        setIsTyping(false);
                        setStreamingAssistantId(null);
                    }
                }
            }
        },
        [messages, isTyping, locale]
    );

    const handleRetry = useCallback(
        (id: string) => {
            setMessages((prev) => prev.filter((m) => m.id !== id));
            if (lastUserText.current) sendMessage(lastUserText.current);
        },
        [sendMessage]
    );

    const toggleVoice = useCallback(() => {
        if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
            alert("Voice input requires Chrome or Edge.");
            return;
        }
        if (isListening) {
            recRef.current?.stop();
            setIsListening(false);
            return;
        }
        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const r = new SR();
        const speechLocales = {
            en: "en-IN",
            hi: "hi-IN",
            bn: "bn-IN",
            gu: "gu-IN",
            te: "te-IN",
            ta: "ta-IN",
            kn: "kn-IN",
            ur: "ur-IN",
            mr: "mr-IN",
            pa: "pa-IN",
            or: "or-IN",
        };
        r.lang = speechLocales[locale as keyof typeof speechLocales] || "en-IN";
        r.interimResults = false;
        r.onresult = (e: any) => {
            if (!isMountedRef.current) return;
            setInput(e.results[0][0].transcript);
            setIsListening(false);
        };
        r.onerror = r.onend = () => {
            if (isMountedRef.current) {
                setIsListening(false);
            }
        };
        recRef.current = r;
        r.start();
        setIsListening(true);
    }, [isListening]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage(input);
        }
    };

    const handleAction = (prompt: string) => {
        sendMessage(prompt);
    };

    return (
        <div className="relative flex h-screen w-full flex-col overflow-hidden bg-transparent font-sans">
            {/* Floating Header */}
            <header className="absolute top-4 right-4 left-4 z-20 mx-auto max-w-3xl rounded-3xl border border-white/30 bg-white/60 px-5 py-4 shadow-[0_8px_30px_rgb(0,0,0,0.08)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-900/60 dark:shadow-black/50">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link
                            href={`/${locale}`}
                            className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                            aria-label="Go to homepage"
                        >
                            <Home size={18} />
                        </Link>

                        <div className="flex items-baseline gap-2">
                            <Link
                                href={`/${locale}`}
                                className="text-xl font-semibold text-slate-800 no-underline transition-colors hover:text-emerald-600 dark:text-white dark:hover:text-emerald-400"
                            >
                                SahiDawa
                            </Link>

                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600">
                                CDSCO
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <TrustBar />
                        <ThemeToggle />
                    </div>
                </div>
            </header>

            {/* Messages */}
            <main
                ref={messagesContainerRef}
                role="log"
                aria-live="polite"
                aria-label="Chat conversation"
                className="absolute inset-0 z-0 overflow-y-auto px-4 pt-28 pb-36"
            >
                <div className="mx-auto flex max-w-3xl flex-col gap-6">
                    {messages.map((msg) => (
                        <ChatBubble key={msg.id} msg={msg} onRetry={handleRetry} />
                    ))}

                    {isTyping && !streamingAssistantId && <TypingIndicator />}

                    {showWelcome && !isTyping && messages.length === 1 && (
                        <div>
                            <p className="mb-3 text-xs font-medium tracking-wide text-slate-400 uppercase">
                                Quick actions
                            </p>
                            <div className="space-y-3">
                                {ACTIONS.map((action) => (
                                    <ActionCard
                                        key={action.id}
                                        icon={action.icon}
                                        label={action.label}
                                        description={action.description}
                                        onClick={() => handleAction(action.prompt)}
                                        accentColor={action.accent}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="h-2" />
                </div>
            </main>

            {/* Floating Input Pill */}
            <footer className="absolute right-4 bottom-6 left-4 z-20 mx-auto max-w-3xl rounded-[2rem] border border-white/30 bg-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.12)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-900/60 dark:shadow-black/50">
                <div className="px-4 py-3">
                    {isListening && (
                        <div className="mb-3 flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400">
                            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                            <span>Listening... speak clearly</span>
                        </div>
                    )}

                    <div className="flex items-center gap-3">
                        <button
                            onClick={toggleVoice}
                            aria-label={isListening ? "Stop voice input" : "Start voice input"}
                            aria-pressed={isListening}
                            className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl transition-all ${
                                isListening
                                    ? "bg-red-500 text-white shadow-md shadow-red-500/20"
                                    : "border border-white/40 bg-white/50 text-slate-600 hover:bg-white/80 dark:border-white/10 dark:bg-slate-800/50 dark:text-slate-300 dark:hover:bg-slate-700/50"
                            }`}
                        >
                            {isListening ? <IconStop /> : <IconMic size={20} />}
                        </button>

                        <label htmlFor="chat-input" className="sr-only">
                            Type your health question
                        </label>
                        <textarea
                            id="chat-input"
                            ref={inputRef}
                            aria-label="Type your health question"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Type your health concern..."
                            rows={1}
                            className="flex-1 resize-none rounded-xl border border-white/40 bg-white/50 px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500 focus:outline-none dark:border-white/10 dark:bg-slate-800/50 dark:text-white dark:placeholder-slate-500"
                            style={{ minHeight: 44, maxHeight: 100 }}
                        />

                        <button
                            onClick={() => sendMessage(input)}
                            disabled={!input.trim() || isTyping}
                            aria-label="Send message"
                            className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl transition-all ${
                                input.trim() && !isTyping
                                    ? "bg-linear-to-r from-emerald-500 to-teal-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)] hover:from-emerald-600 hover:to-teal-600 active:scale-95"
                                    : "cursor-not-allowed border border-white/20 bg-white/40 text-slate-400 dark:border-white/5 dark:bg-slate-800/40 dark:text-slate-500"
                            }`}
                        >
                            <IconSend />
                        </button>
                    </div>

                    {/* Minimal Footer Text */}
                    <div className="mt-2 text-center">
                        <p className="text-[10px] font-medium text-slate-400/80">
                            For informational use only • Consult a doctor
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
