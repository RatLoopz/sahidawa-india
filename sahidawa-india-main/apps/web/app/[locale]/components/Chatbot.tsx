"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { MessageSquare, X, Send, Bot } from "lucide-react";
import { getChatbotPanelClasses, getChatbotPositionClasses } from "./chatbotPosition";

type Message = {
    text: string;
    isBot: boolean;
    isTyping?: boolean;
};

export default function Chatbot() {
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            text: "Hi! I am the SahiDawa AI Assistant. How can I help you with your medicines today?",
            isBot: true,
        },
    ]);
    const [input, setInput] = useState("");
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim()) return;

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
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to fetch response");
            }

            setMessages((prev) => {
                const withoutTyping = prev.filter((msg) => !msg.isTyping);
                return [
                    ...withoutTyping,
                    { text: data.text || "Sorry, I received an empty response.", isBot: true },
                ];
            });
        } catch (error: any) {
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
        }
    };

    return (
        <div className={getChatbotPositionClasses({ pathname, isOpen })}>
            {isOpen && (
                <div className={getChatbotPanelClasses({ pathname })}>
                    {/* Header */}
                    <div className="z-10 flex items-center justify-between bg-green-600 p-4 text-white shadow-md">
                        <div className="flex items-center gap-3">
                            <div className="rounded-full bg-white/20 p-2">
                                <Bot size={20} />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold">SahiDawa AI</h3>
                                <p className="text-xs text-white/80">Online</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="rounded-full p-2 text-white transition-colors hover:bg-white/20"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Messages */}
                    <div className="flex flex-1 flex-col gap-4 overflow-y-auto bg-gray-50 p-4">
                        {messages.map((msg, idx) => (
                            <div
                                key={idx}
                                className={`max-w-[85%] rounded-2xl p-3 shadow-sm ${
                                    msg.isBot
                                        ? "self-start rounded-tl-sm border border-gray-100 bg-white text-gray-800"
                                        : "self-end rounded-tr-sm bg-green-600 text-white"
                                }`}
                            >
                                <p className="text-sm leading-relaxed">{msg.text}</p>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="flex items-center gap-2 border-t border-gray-100 bg-white p-3">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSend()}
                            placeholder="Ask me about a medicine..."
                            className="flex-1 rounded-full bg-gray-100 px-4 py-3 text-sm text-gray-800 transition-all placeholder:text-gray-400 focus:ring-2 focus:ring-green-500/50 focus:outline-none"
                        />
                        <button
                            onClick={handleSend}
                            disabled={!input.trim()}
                            className="flex h-11 w-11 items-center justify-center rounded-full bg-green-600 p-3 text-white shadow-md transition-colors hover:bg-green-700 disabled:opacity-50"
                        >
                            <Send size={18} className="relative right-[1px] bottom-[1px]" />
                        </button>
                    </div>
                </div>
            )}

            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative z-50 flex h-14 w-14 items-center justify-center rounded-full bg-green-600 text-white shadow-[0_8px_20px_rgba(22,163,74,0.3)] transition-all hover:scale-105 hover:shadow-[0_8px_25px_rgba(22,163,74,0.4)] active:scale-95"
            >
                {isOpen ? <X size={28} /> : <MessageSquare size={28} />}
            </button>
        </div>
    );
}
