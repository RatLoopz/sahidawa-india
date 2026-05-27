"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { ChatBubble, type Message } from "./components/ChatBubble";
import { ActionCard } from "./components/ActionCard";
import { TypingIndicator } from "./components/TypingIndicator";
import { TrustBar } from "./components/TrustBar";
import { Camera, Pill, MapPin } from "lucide-react";

const genId = () => Math.random().toString(36).slice(2, 10);

const INITIAL_MESSAGES = {
    en: "Namaste, I'm SahiDawa, your trusted health companion. I can help you verify medicines, understand symptoms, or find nearby care. What would you like help with today?",

    bn: "নমস্কার, আমি SahiDawa। আমি ওষুধ যাচাই, উপসর্গ বোঝা এবং নিকটবর্তী স্বাস্থ্যসেবা খুঁজে পেতে সাহায্য করতে পারি। আজ আপনাকে কীভাবে সাহায্য করতে পারি?",

    te: "నమస్కారం, నేను SahiDawa. మందులను ధృవీకరించడం, లక్షణాలను అర్థం చేసుకోవడం మరియు సమీప వైద్య సేవలను కనుగొనడంలో నేను సహాయం చేయగలను. ఈ రోజు మీకు ఎలా సహాయం చేయగలను?",

    ta: "வணக்கம், நான் SahiDawa. மருந்துகளை சரிபார்க்கவும், அறிகுறிகளை புரிந்துகொள்ளவும் மற்றும் அருகிலுள்ள சிகிச்சை சேவைகளை கண்டறியவும் உதவ முடியும். இன்று உங்களுக்கு என்ன உதவி வேண்டும்?",

    mr: "नमस्कार, मी SahiDawa आहे. मी औषध पडताळणी, लक्षणे समजून घेणे आणि जवळील आरोग्यसेवा शोधण्यात मदत करू शकतो. आज मी तुम्हाला कशी मदत करू?",

    gu: "નમસ્તે, હું SahiDawa છું. હું તમને દવાઓ ચકાસવામાં, લક્ષણો સમજવામાં અને નજીકની આરોગ્ય સેવાઓ શોધવામાં મદદ કરી શકું છું. આજે હું તમારી કેવી રીતે મદદ કરી શકું?",

    kn: "ನಮಸ್ಕಾರ, ನಾನು SahiDawa. ಔಷಧಿಗಳನ್ನು ಪರಿಶೀಲಿಸಲು, ಲಕ್ಷಣಗಳನ್ನು ಅರ್ಥಮಾಡಿಕೊಳ್ಳಲು ಮತ್ತು ಸಮೀಪದ ಆರೋಗ್ಯ ಸೇವೆಗಳನ್ನು ಹುಡುಕಲು ನಾನು ಸಹಾಯ ಮಾಡಬಹುದು. ಇಂದು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ?",

    ur: "السلام علیکم، میں SahiDawa ہوں۔ میں ادویات کی تصدیق، علامات کو سمجھنے اور قریبی صحت کی سہولیات تلاش کرنے میں مدد کر سکتا ہوں۔ آج میں آپ کی کیسے مدد کر سکتا ہوں؟",
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
    const lastUserText = useRef("");
    const messagesContainerRef = useRef<HTMLElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const recRef = useRef<any>(null);

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
            const t = text.trim();
            if (!t || isTyping) return;
            lastUserText.current = t;
            setShowWelcome(false);

            const userMsg: Message = {
                id: genId(),
                role: "user",
                content: t,
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, userMsg]);
            setInput("");
            setIsTyping(true);

            try {
                const history = [...messages, userMsg]
                    .filter((m) => !m.isError)
                    .map((m) => ({ role: m.role, content: m.content }));
                const res = await fetch("/api/chat", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ messages: history, locale }),
                });
                if (res.status === 429) {
                    throw new Error("Too many requests. Please try again in a few moments.");
                }
                if (!res.ok) throw new Error();
                const data = await res.json();
                const reply = data.text || "I'm here to help! Could you rephrase that?";
                setMessages((prev) => [
                    ...prev,
                    { id: genId(), role: "assistant", content: reply, timestamp: new Date() },
                ]);
            } catch (err: any) {
                setMessages((prev) => [
                    ...prev,
                    {
                        id: genId(),
                        role: "assistant",
                        content: err.message || "Something went wrong",
                        timestamp: new Date(),
                        isError: true,
                    },
                ]);
            } finally {
                setIsTyping(false);
            }
        },
        [messages, isTyping]
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
        };
        r.lang = speechLocales[locale as keyof typeof speechLocales] || "en-IN";
        r.interimResults = false;
        r.onresult = (e: any) => {
            setInput(e.results[0][0].transcript);
            setIsListening(false);
        };
        r.onerror = r.onend = () => setIsListening(false);
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
        <div className="flex h-screen flex-col bg-slate-50 font-sans">
            {/* Header */}
            <header className="flex-shrink-0 border-b border-slate-200 bg-white px-5 py-4">
                <div className="mx-auto flex max-w-3xl items-center justify-between">
                    <div className="flex items-baseline gap-2">
                        <h1 className="text-xl font-semibold text-slate-800">SahiDawa</h1>
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600">
                            CDSCO
                        </span>
                    </div>
                    <TrustBar />
                </div>
            </header>

            {/* Messages */}
            <main ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 py-5">
                <div className="mx-auto max-w-3xl">
                    {messages.map((msg) => (
                        <ChatBubble key={msg.id} msg={msg} onRetry={handleRetry} />
                    ))}

                    {isTyping && <TypingIndicator />}

                    {showWelcome && !isTyping && messages.length === 1 && (
                        <div className="mt-6">
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

            {/* Input Bar */}
            <footer className="flex-shrink-0 border-t border-slate-200 bg-white">
                <div className="mx-auto max-w-3xl px-4 py-4">
                    {isListening && (
                        <div className="mb-3 flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
                            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                            <span>Listening... speak clearly</span>
                        </div>
                    )}

                    <div className="flex items-center gap-3">
                        <button
                            onClick={toggleVoice}
                            className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl transition-all ${
                                isListening
                                    ? "bg-red-500 text-white"
                                    : "border border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                        >
                            {isListening ? <IconStop /> : <IconMic size={20} />}
                        </button>

                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Type your health concern..."
                            rows={1}
                            className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-transparent focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                            style={{ minHeight: 44, maxHeight: 100 }}
                        />

                        <button
                            onClick={() => sendMessage(input)}
                            disabled={!input.trim() || isTyping}
                            className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl transition-all ${
                                input.trim() && !isTyping
                                    ? "bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95"
                                    : "cursor-not-allowed bg-slate-100 text-slate-400"
                            }`}
                        >
                            <IconSend />
                        </button>
                    </div>

                    <p className="mt-3 text-center text-[10px] text-slate-400">
                        For informational use only • Consult a doctor
                    </p>
                </div>
            </footer>
        </div>
    );
}
