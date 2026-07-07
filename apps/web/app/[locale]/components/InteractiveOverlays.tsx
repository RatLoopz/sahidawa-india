"use client";

import dynamic from "next/dynamic";

const BackToTopButton = dynamic(() => import("./BackToTopButton"), {
    ssr: false,
    loading: () => null,
});

const Chatbot = dynamic(() => import("./Chatbot"), {
    ssr: false,
    loading: () => null,
});

const CommandPalette = dynamic(() => import("./CommandPalette"), {
    ssr: false,
    loading: () => null,
});

export function InteractiveOverlays() {
    return (
        <div className="no-print">
            <BackToTopButton />
            <Chatbot />
            <CommandPalette />
        </div>
    );
}
