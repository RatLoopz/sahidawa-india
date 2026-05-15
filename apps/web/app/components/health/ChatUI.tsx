"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ChatBubble, type Message } from "./components/ChatBubble";
import { ActionCard } from "./components/ActionCard";
import { TypingIndicator } from "./components/TypingIndicator";
import { TrustBar } from "./components/TrustBar";

const genId = () => Math.random().toString(36).slice(2, 10);

const SYSTEM_PROMPT = `You are SahiDawa, India's trusted open-source health assistant and medicine verifier.
Help citizens verify medicines, understand symptoms, find appropriate care, and make informed health decisions.
Respond warmly, empathetically, and clearly. Keep responses concise (2–4 sentences) and actionable.
Understand Hindi/Hinglish but respond in simple English unless asked otherwise.
Never diagnose. Help people understand when to seek professional care.
For medicine queries, describe common use and always recommend a doctor or pharmacist.`;

const INITIAL_MESSAGE: Message = {
  id: "init",
  role: "assistant",
  content: "Namaste, I'm SahiDawa, your trusted health companion. I can help you verify medicines, understand symptoms, or find nearby care. What would you like help with today?",
  timestamp: new Date(),
};

// Icons
const IconMic = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" y1="19" x2="12" y2="22"/>
    <line x1="8" y1="22" x2="16" y2="22"/>
  </svg>
);

const IconSend = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/>
    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);

const IconStop = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="6" width="12" height="12" rx="2"/>
  </svg>
);

// Quick actions configuration
const ACTIONS = [
  { id: "scan", label: "Scan Medicine", description: "Verify authenticity", icon: "📷", prompt: "I'd like to verify a medicine.", accent: "emerald" as const },
  { id: "symptoms", label: "Check Symptoms", description: "AI-assisted guidance", icon: "💊", prompt: "I want to describe my symptoms.", accent: "sky" as const },
  { id: "pharmacy", label: "Find Pharmacy", description: "Locate verified stores", icon: "📍", prompt: "Help me find a verified pharmacy nearby.", accent: "amber" as const },
];

export default function ChatUI() {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const lastUserText = useRef("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recRef = useRef<any>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    const ta = inputRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 100) + "px";
  }, [input]);

  const sendMessage = useCallback(async (text: string) => {
    const t = text.trim();
    if (!t || isTyping) return;
    lastUserText.current = t;
    setShowWelcome(false);
    
    const userMsg: Message = { id: genId(), role: "user", content: t, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);
    
    try {
      const history = [...messages, userMsg].filter(m => !m.isError).map(m => ({ role: m.role, content: m.content }));
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, system: SYSTEM_PROMPT, messages: history }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const reply = data.content?.find((b: any) => b.type === "text")?.text || "I'm here to help! Could you rephrase that?";
      setMessages(prev => [...prev, { id: genId(), role: "assistant", content: reply, timestamp: new Date() }]);
    } catch {
      setMessages(prev => [...prev, { id: genId(), role: "assistant", content: "", timestamp: new Date(), isError: true }]);
    } finally {
      setIsTyping(false);
    }
  }, [messages, isTyping]);

  const handleRetry = useCallback((id: string) => {
    setMessages(prev => prev.filter(m => m.id !== id));
    if (lastUserText.current) sendMessage(lastUserText.current);
  }, [sendMessage]);

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
    r.lang = "en-IN";
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
    <div className="flex flex-col h-screen bg-slate-50 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-5 py-4 flex-shrink-0">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <h1 className="text-xl font-semibold text-slate-800">SahiDawa</h1>
            <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              CDSCO
            </span>
          </div>
          <TrustBar />
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-4 py-5">
        <div className="max-w-3xl mx-auto">
          {messages.map((msg) => (
            <ChatBubble key={msg.id} msg={msg} onRetry={handleRetry} />
          ))}
          
          {isTyping && <TypingIndicator />}
          
          {showWelcome && !isTyping && messages.length === 1 && (
            <div className="mt-6">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">
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
          
          <div ref={bottomRef} className="h-2" />
        </div>
      </main>

      {/* Input Bar */}
      <footer className="bg-white border-t border-slate-200 flex-shrink-0">
        <div className="max-w-3xl mx-auto px-4 py-4">
          {isListening && (
            <div className="flex items-center gap-2 bg-emerald-50 rounded-full px-4 py-2 mb-3 text-sm text-emerald-800">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span>Listening... speak clearly</span>
            </div>
          )}
          
          <div className="flex items-center gap-3">
            <button
              onClick={toggleVoice}
              className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all flex-shrink-0 ${
                isListening
                  ? "bg-red-500 text-white"
                  : "bg-slate-100 border border-slate-200 text-slate-600 hover:bg-slate-200"
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
              className="flex-1 bg-slate-100 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
              style={{ minHeight: 44, maxHeight: 100 }}
            />
            
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isTyping}
              className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all flex-shrink-0 ${
                input.trim() && !isTyping
                  ? "bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed"
              }`}
            >
              <IconSend />
            </button>
          </div>
          
          <p className="text-center text-[10px] text-slate-400 mt-3">
            For informational use only • Consult a doctor
          </p>
        </div>
      </footer>
    </div>
  );
}