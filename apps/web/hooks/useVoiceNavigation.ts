"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

// Extend window object for webkitSpeechRecognition
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export function useVoiceNavigation() {
  const [isListeningForIntent, setIsListeningForIntent] = useState(false);
  const [isWakeWordActive, setIsWakeWordActive] = useState(false);
  const [transcript, setTranscript] = useState("");
  
  const recognitionRef = useRef<any>(null);
  const router = useRouter();

  // Initialize Speech Recognition
  const initSpeechRecognition = useCallback(() => {
    if (typeof window === "undefined") return null;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech Recognition API is not supported in this browser.");
      return null;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "hi-IN"; // Hindi language for "Suno SahiDawa"

    return recognition;
  }, []);

  const routeIntent = useCallback((command: string) => {
    const lowerCmd = command.toLowerCase();
    
    // Simulate Sarvam AI intent mapping locally
    if (lowerCmd.includes("pharmacy") || lowerCmd.includes("map") || lowerCmd.includes("aas paas")) {
      router.push("/hi/map");
      toast.success("Navigating to Pharmacy Map");
    } else if (lowerCmd.includes("check") || lowerCmd.includes("scan") || lowerCmd.includes("dawai")) {
      router.push("/hi/scan");
      toast.success("Navigating to Scanner");
    } else if (lowerCmd.includes("alert") || lowerCmd.includes("khatra") || lowerCmd.includes("fake")) {
      router.push("/hi/alerts");
      toast.success("Navigating to Alerts");
    } else if (lowerCmd.includes("home") || lowerCmd.includes("wapas")) {
      router.push("/hi");
      toast.success("Navigating Home");
    } else {
      toast.error("Command not recognized. Try 'scan dawai' or 'pharmacy map'.");
    }
  }, [router]);

  useEffect(() => {
    const recognition = initSpeechRecognition();
    if (!recognition) return;

    recognitionRef.current = recognition;

    recognition.onresult = (event: any) => {
      let interimTranscript = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      const currentTranscript = (finalTranscript || interimTranscript).toLowerCase();
      setTranscript(currentTranscript);

      // Wake word detection
      if (!isListeningForIntent && (currentTranscript.includes("suno") || currentTranscript.includes("sahi dawa"))) {
        setIsListeningForIntent(true);
        // Play a short beep to indicate listening (optional)
        try {
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
            oscillator.connect(audioCtx.destination);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.1);
        } catch(e) {}
      }

      // Intent detection
      if (isListeningForIntent && finalTranscript) {
        // We received a final phrase after the wake word
        routeIntent(finalTranscript);
        setIsListeningForIntent(false); // Reset
      }
    };

    recognition.onend = () => {
      // Auto-restart for continuous listening
      if (isWakeWordActive) {
        try {
          recognition.start();
        } catch (e) {
          // ignore already started errors
        }
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error !== 'no-speech') {
         console.warn("Speech recognition error", event.error);
      }
    };

    // Start listening if active
    if (isWakeWordActive) {
      try {
        recognition.start();
      } catch (e) {}
    }

    return () => {
      recognition.stop();
    };
  }, [isWakeWordActive, isListeningForIntent, initSpeechRecognition, routeIntent]);

  const toggleWakeWord = () => {
    setIsWakeWordActive(prev => !prev);
  };

  const cancelListening = () => {
    setIsListeningForIntent(false);
  };

  return {
    isWakeWordActive,
    isListeningForIntent,
    transcript,
    toggleWakeWord,
    cancelListening
  };
}
