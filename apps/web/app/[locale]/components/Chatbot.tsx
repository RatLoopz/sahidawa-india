"use client";

import { useState, useRef, useEffect } from "react";
import { MessageSquare, X, Send, Bot } from "lucide-react";

type Message = {
  text: string;
  isBot: boolean;
  isTyping?: boolean;
};

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { text: "Hi! I am the SahiDawa AI Assistant. How can I help you with your medicines today?", isBot: true },
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
        return [...withoutTyping, { text: data.text || "Sorry, I received an empty response.", isBot: true }];
      });
    } catch (error: any) {
      console.error("Chatbot API Error:", error);
      setMessages((prev) => {
        const withoutTyping = prev.filter((msg) => !msg.isTyping);
        return [...withoutTyping, { text: error.message || "Sorry, I am having trouble connecting to the AI. Please make sure the GEMINI_API_KEY environment variable is set.", isBot: true }];
      });
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans">
      {isOpen && (
        <div className="absolute bottom-16 right-0 w-[350px] h-[450px] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200 text-gray-800 transition-all duration-300">
          {/* Header */}
          <div className="bg-green-600 p-4 text-white flex justify-between items-center shadow-md z-10">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-full">
                <Bot size={20} />
              </div>
              <div>
                <h3 className="font-bold text-sm">SahiDawa AI</h3>
                <p className="text-xs text-white/80">Online</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white hover:bg-white/20 p-2 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4 bg-gray-50">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`max-w-[85%] p-3 rounded-2xl shadow-sm ${
                  msg.isBot
                    ? "bg-white text-gray-800 self-start rounded-tl-sm border border-gray-100"
                    : "bg-green-600 text-white self-end rounded-tr-sm"
                }`}
              >
                <p className="text-sm leading-relaxed">{msg.text}</p>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 bg-white border-t border-gray-100 flex gap-2 items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Ask me about a medicine..."
              className="flex-1 bg-gray-100 text-sm text-gray-800 rounded-full px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all placeholder:text-gray-400"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="bg-green-600 text-white p-3 rounded-full hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center w-11 h-11 shadow-md"
            >
              <Send size={18} className="relative right-[1px] bottom-[1px]" />
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 bg-green-600 rounded-full flex items-center justify-center text-white shadow-[0_8px_20px_rgba(22,163,74,0.3)] hover:shadow-[0_8px_25px_rgba(22,163,74,0.4)] transition-all z-50 relative hover:scale-105 active:scale-95"
      >
        {isOpen ? <X size={28} /> : <MessageSquare size={28} />}
      </button>
    </div>
  );
}
