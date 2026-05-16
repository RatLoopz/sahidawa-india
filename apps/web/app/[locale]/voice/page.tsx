"use client";

import { useState, useEffect, useRef } from "react";
import { Mic, X, Globe, MessageSquare, Volume2, Sparkles, ChevronLeft, Send } from "lucide-react";
import { Link } from "@/i18n/routing";
import { PageHeader } from "../components/PageHeader";

export default function VoiceTriagePage() {
  const [isListening, setIsListening] = useState(false);
  const [step, setStep] = useState<"initial" | "listening" | "processing" | "result">("initial");
  const [language, setLanguage] = useState("Hindi");
  const timerRefs = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Cleanup all timers on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      timerRefs.current.forEach(clearTimeout);
    };
  }, []);

  const startListening = () => {
    setIsListening(true);
    setStep("listening");
    // Simulate processing after 3 seconds
    const outerTimer = setTimeout(() => {
      setStep("processing");
      setIsListening(false);
      const innerTimer = setTimeout(() => {
        setStep("result");
      }, 2000);
      timerRefs.current.push(innerTimer);
    }, 3000);
    timerRefs.current.push(outerTimer);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-100/40 rounded-full blur-3xl -mr-20 -mt-20" aria-hidden="true"></div>
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-100/40 rounded-full blur-3xl -ml-20 -mb-20" aria-hidden="true"></div>

      {/* Header */}
      <PageHeader 
        title="Voice Search" 
        subtitle="Speak medicine name" 
        backHref="/" 
        variant="light"
        showLanguage={true}
      />

      {/* Main Content Area */}
      <main className="flex-1 relative z-10 flex flex-col items-center justify-center px-6">
        
        {step === "initial" && (
          <div className="text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-3">
              <h1 className="text-4xl font-black text-slate-900 tracking-tight">AI Voice Triage</h1>
              <p className="text-slate-500 font-medium max-w-xs mx-auto">
                Speak your symptoms in your local language. SahiDawa AI will help you understand next steps.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
                <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm text-left">
                    <MessageSquare size={20} aria-hidden="true" className="text-blue-500 mb-2" />
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter">Try saying</p>
                    <p className="text-sm font-bold text-slate-700 mt-1">&quot;Mujhe sardi hai&quot;</p>
                </div>
                <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm text-left">
                    <Volume2 size={20} aria-hidden="true" className="text-emerald-500 mb-2" />
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter">AI Assistant</p>
                    <p className="text-sm font-bold text-slate-700 mt-1">Listening 24/7</p>
                </div>
            </div>
          </div>
        )}

        {step === "listening" && (
          <div className="flex flex-col items-center space-y-12 animate-in fade-in zoom-in duration-300" role="status" aria-live="polite">
             <div className="flex items-end gap-1.5 h-16" aria-hidden="true">
                {[...Array(8)].map((_, i) => (
                  <div 
                    key={i} 
                    className="w-2 bg-emerald-500 rounded-full animate-bounce" 
                    style={{ 
                        height: `${Math.random() * 100 + 20}%`,
                        animationDelay: `${i * 0.1}s`,
                        animationDuration: '0.8s'
                    }}
                  ></div>
                ))}
             </div>
             <p className="text-2xl font-bold text-slate-800 italic">&quot;Mujhe sardi aur bukhar hai...&quot;</p>
             <p className="text-sm font-bold text-emerald-600 uppercase tracking-widest">Listening for symptoms</p>
          </div>
        )}

        {step === "processing" && (
          <div className="flex flex-col items-center space-y-6 animate-in fade-in duration-300" role="status" aria-live="polite" aria-label="Analysing your symptoms">
             <div className="relative" aria-hidden="true">
                <div className="w-24 h-24 rounded-full border-4 border-slate-200 border-t-emerald-500 animate-spin"></div>
                <Sparkles className="absolute inset-0 m-auto text-emerald-500 animate-pulse" size={32} aria-hidden="true" />
             </div>
             <div className="text-center">
                <p className="text-xl font-bold text-slate-800">Analysing symptoms</p>
                <p className="text-slate-400 text-sm font-medium">Connecting to Sarvam AI...</p>
             </div>
          </div>
        )}

        {step === "result" && (
          <div className="w-full max-w-md bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-100 animate-in fade-in slide-in-from-bottom-8 duration-500" role="region" aria-labelledby="ai-analysis-heading">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Sparkles size={24} aria-hidden="true" />
                </div>
                <div>
                    <h2 id="ai-analysis-heading" className="font-black text-slate-900">AI Analysis</h2>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter">Medical Triage</p>
                </div>
            </div>

            <div className="space-y-6">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-sm text-slate-700 leading-relaxed">
                        Based on your voice input, you mentioned symptoms of <span className="font-bold text-blue-600">Common Cold and Mild Fever</span>.
                    </p>
                </div>

                <div className="space-y-3">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Recommended Action</h3>
                    <div className="grid grid-cols-1 gap-3">
                        <div className="flex items-center gap-4 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                            <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                                <span className="font-bold">1</span>
                            </div>
                            <p className="text-sm font-bold text-emerald-900">Consult a Pharmacist for Paracetamol</p>
                        </div>
                        <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-2xl border border-blue-100">
                            <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center shrink-0">
                                <span className="font-bold">2</span>
                            </div>
                            <p className="text-sm font-bold text-blue-900">Stay hydrated and rest for 24h</p>
                        </div>
                    </div>
                </div>

                <button 
                  onClick={() => setStep("initial")}
                  className="w-full py-4 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                >
                    <Mic size={20} aria-hidden="true" />
                    Try Again
                </button>
            </div>
          </div>
        )}
      </main>

      {/* Mic Footer Section */}
      {step !== "result" && (
        <div className="relative z-10 p-12 flex flex-col items-center">
           <button 
             onClick={startListening}
             disabled={step !== "initial"}
             aria-label={step === "listening" ? "Listening for symptoms — tap to stop" : "Tap to speak your symptoms"}
             className={`
                relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500
                ${step === "listening" ? "bg-red-500 scale-125" : "bg-emerald-500 hover:scale-110 shadow-xl shadow-emerald-500/30"}
                ${step === "processing" ? "opacity-50 grayscale" : ""}
             `}
           >
             {step === "listening" ? (
               <div className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-30" aria-hidden="true"></div>
             ) : (
               <div className="absolute inset-0 rounded-full bg-emerald-500 animate-pulse opacity-20" aria-hidden="true"></div>
             )}
             <Mic size={40} aria-hidden="true" className="text-white relative z-10" strokeWidth={2.5} />
             <span className="sr-only">{step === "listening" ? "Stop listening" : "Start voice input"}</span>
           </button>
           <p className="mt-6 text-sm font-bold text-slate-400 uppercase tracking-widest" aria-hidden="true">
             {step === "listening" ? "Stop Speaking" : "Tap to speak"}
           </p>
        </div>
      )}

      {/* Language Toggle Modal Placeholder */}
      <footer className="p-8 text-center">
         <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest max-w-xs mx-auto">
            SahiDawa AI supports 22 Indian Languages using Whisper &amp; Sarvam AI Models
         </p>
      </footer>
    </div>
  );
}
