"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Mic, X } from "lucide-react";
import { useVoiceNavigation } from "@/hooks/useVoiceNavigation";

export function VoiceVisualizer() {
    const { isListeningForIntent, cancelListening, transcript, toggleWakeWord, isWakeWordActive } =
        useVoiceNavigation();

    return (
        <AnimatePresence>
            {isListeningForIntent && (
                <motion.div
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 50 }}
                    className="fixed bottom-24 left-1/2 z-[100] w-11/12 max-w-sm -translate-x-1/2 rounded-2xl border border-slate-700 bg-slate-900/95 p-6 shadow-2xl backdrop-blur-md"
                >
                    <div className="flex flex-col items-center justify-center space-y-4">
                        <button
                            onClick={cancelListening}
                            className="absolute top-3 right-3 text-slate-400 hover:text-white"
                            aria-label="Cancel voice listening"
                        >
                            <X size={20} />
                        </button>

                        <h3 className="text-lg font-semibold text-emerald-400">Listening...</h3>

                        <div className="relative flex h-24 w-24 items-center justify-center">
                            {/* Outer pulsing rings */}
                            <motion.div
                                animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0, 0.3] }}
                                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                className="absolute h-full w-full rounded-full bg-emerald-500/30"
                            />
                            <motion.div
                                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.1, 0.5] }}
                                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                                className="absolute h-16 w-16 rounded-full bg-emerald-500/40"
                            />

                            {/* Center Mic */}
                            <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg">
                                <Mic size={24} />
                            </div>
                        </div>

                        <p className="text-center text-sm text-slate-300 italic">
                            {transcript ? `"${transcript}"` : "Say a command..."}
                        </p>
                    </div>
                </motion.div>
            )}

            {!isListeningForIntent && (
                <button
                    onClick={toggleWakeWord}
                    className={`fixed right-[5.5rem] bottom-[4.5rem] z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-colors md:right-24 md:bottom-6 ${
                        isWakeWordActive
                            ? "animate-pulse bg-emerald-600 text-white"
                            : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"
                    }`}
                    aria-label={
                        isWakeWordActive ? "Deactivate Voice Assistant" : "Activate Voice Assistant"
                    }
                >
                    <Mic size={24} />
                </button>
            )}
        </AnimatePresence>
    );
}
