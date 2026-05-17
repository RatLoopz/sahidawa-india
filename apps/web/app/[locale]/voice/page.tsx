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
        <div className="relative flex min-h-screen flex-col overflow-hidden bg-slate-50 font-sans">
            {/* Decorative Background Elements */}
            <div
                className="absolute top-0 right-0 -mt-20 -mr-20 h-96 w-96 rounded-full bg-emerald-100/40 blur-3xl"
                aria-hidden="true"
            ></div>
            <div
                className="absolute bottom-0 left-0 -mb-20 -ml-20 h-80 w-80 rounded-full bg-blue-100/40 blur-3xl"
                aria-hidden="true"
            ></div>

            {/* Header */}
            <PageHeader
                title="Voice Search"
                subtitle="Speak medicine name"
                backHref="/"
                variant="light"
                showLanguage={true}
            />

            {/* Main Content Area */}
            <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6">
                {step === "initial" && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 space-y-8 text-center duration-500">
                        <div className="space-y-3">
                            <h1 className="mt-12 text-4xl font-black tracking-tight text-slate-900">
                                AI Voice Triage
                            </h1>
                            <p className="mx-auto max-w-xs font-medium text-slate-500">
                                Speak your symptoms in your local language. SahiDawa AI will help
                                you understand next steps.
                            </p>
                        </div>

                        <div className="mx-auto grid max-w-sm grid-cols-2 gap-4">
                            <div className="rounded-3xl border border-slate-100 bg-white p-4 text-left shadow-sm">
                                <MessageSquare
                                    size={20}
                                    aria-hidden="true"
                                    className="mb-2 text-blue-500"
                                />
                                <p className="text-xs font-bold tracking-tighter text-slate-400 uppercase">
                                    Try saying
                                </p>
                                <p className="mt-1 text-sm font-bold text-slate-700">
                                    &quot;Mujhe sardi hai&quot;
                                </p>
                            </div>
                            <div className="rounded-3xl border border-slate-100 bg-white p-4 text-left shadow-sm">
                                <Volume2
                                    size={20}
                                    aria-hidden="true"
                                    className="mb-2 text-emerald-500"
                                />
                                <p className="text-xs font-bold tracking-tighter text-slate-400 uppercase">
                                    AI Assistant
                                </p>
                                <p className="mt-1 text-sm font-bold text-slate-700">
                                    Listening 24/7
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {step === "listening" && (
                    <div
                        className="animate-in fade-in zoom-in flex flex-col items-center space-y-12 duration-300"
                        role="status"
                        aria-live="polite"
                    >
                        <div className="flex h-16 items-end gap-1.5" aria-hidden="true">
                            {[...Array(8)].map((_, i) => (
                                <div
                                    key={i}
                                    className="w-2 animate-bounce rounded-full bg-emerald-500"
                                    style={{
                                        height: `${Math.random() * 100 + 20}%`,
                                        animationDelay: `${i * 0.1}s`,
                                        animationDuration: "0.8s",
                                    }}
                                ></div>
                            ))}
                        </div>
                        <p className="text-2xl font-bold text-slate-800 italic">
                            &quot;Mujhe sardi aur bukhar hai...&quot;
                        </p>
                        <p className="text-sm font-bold tracking-widest text-emerald-600 uppercase">
                            Listening for symptoms
                        </p>
                    </div>
                )}

                {step === "processing" && (
                    <div
                        className="animate-in fade-in flex flex-col items-center space-y-6 duration-300"
                        role="status"
                        aria-live="polite"
                        aria-label="Analysing your symptoms"
                    >
                        <div className="relative" aria-hidden="true">
                            <div className="h-24 w-24 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-500"></div>
                            <Sparkles
                                className="absolute inset-0 m-auto animate-pulse text-emerald-500"
                                size={32}
                                aria-hidden="true"
                            />
                        </div>
                        <div className="text-center">
                            <p className="text-xl font-bold text-slate-800">Analysing symptoms</p>
                            <p className="text-sm font-medium text-slate-400">
                                Connecting to Sarvam AI...
                            </p>
                        </div>
                    </div>
                )}

                {step === "result" && (
                    <div
                        className="animate-in fade-in slide-in-from-bottom-8 w-full max-w-md rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-xl duration-500"
                        role="region"
                        aria-labelledby="ai-analysis-heading"
                    >
                        <div className="mb-6 flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                                <Sparkles size={24} aria-hidden="true" />
                            </div>
                            <div>
                                <h2 id="ai-analysis-heading" className="font-black text-slate-900">
                                    AI Analysis
                                </h2>
                                <p className="text-xs font-bold tracking-tighter text-slate-400 uppercase">
                                    Medical Triage
                                </p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                                <p className="text-sm leading-relaxed text-slate-700">
                                    Based on your voice input, you mentioned symptoms of{" "}
                                    <span className="font-bold text-blue-600">
                                        Common Cold and Mild Fever
                                    </span>
                                    .
                                </p>
                            </div>

                            <div className="space-y-3">
                                <h3 className="px-1 text-xs font-bold tracking-widest text-slate-400 uppercase">
                                    Recommended Action
                                </h3>
                                <div className="grid grid-cols-1 gap-3">
                                    <div className="flex items-center gap-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                                            <span className="font-bold">1</span>
                                        </div>
                                        <p className="text-sm font-bold text-emerald-900">
                                            Consult a Pharmacist for Paracetamol
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-4 rounded-2xl border border-blue-100 bg-blue-50 p-4">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white">
                                            <span className="font-bold">2</span>
                                        </div>
                                        <p className="text-sm font-bold text-blue-900">
                                            Stay hydrated and rest for 24h
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => setStep("initial")}
                                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-4 font-bold text-white transition-all hover:bg-slate-800"
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
                <div className="relative z-10 flex flex-col items-center p-12">
                    <button
                        onClick={startListening}
                        disabled={step !== "initial"}
                        aria-label={
                            step === "listening"
                                ? "Listening for symptoms — tap to stop"
                                : "Tap to speak your symptoms"
                        }
                        className={`relative flex h-24 w-24 items-center justify-center rounded-full transition-all duration-500 ${step === "listening" ? "scale-125 bg-red-500" : "bg-emerald-500 shadow-xl shadow-emerald-500/30 hover:scale-110"} ${step === "processing" ? "opacity-50 grayscale" : ""} `}
                    >
                        {step === "listening" ? (
                            <div
                                className="absolute inset-0 animate-ping rounded-full bg-red-500 opacity-30"
                                aria-hidden="true"
                            ></div>
                        ) : (
                            <div
                                className="absolute inset-0 animate-pulse rounded-full bg-emerald-500 opacity-20"
                                aria-hidden="true"
                            ></div>
                        )}
                        <Mic
                            size={40}
                            aria-hidden="true"
                            className="relative z-10 text-white"
                            strokeWidth={2.5}
                        />
                        <span className="sr-only">
                            {step === "listening" ? "Stop listening" : "Start voice input"}
                        </span>
                    </button>
                    <p
                        className="mt-6 text-sm font-bold tracking-widest text-slate-400 uppercase"
                        aria-hidden="true"
                    >
                        {step === "listening" ? "Stop Speaking" : "Tap to speak"}
                    </p>
                </div>
            )}

            {/* Language Toggle Modal Placeholder */}
            <footer className="p-8 text-center">
                <p className="mx-auto max-w-md text-xs leading-relaxed font-semibold tracking-wide text-slate-500">
                    Powered by advanced multilingual AI models with support for 22+ Indian languages
                    for accurate voice-based health assistance.
                </p>
            </footer>
        </div>
    );
}
