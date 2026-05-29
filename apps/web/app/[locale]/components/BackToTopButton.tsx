"use client";

import clsx from "clsx";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { ChevronUp } from "lucide-react";

const SCROLL_THRESHOLD = 400;

export default function BackToTopButton() {
    const [isVisible, setIsVisible] = useState(false);
    const t = useTranslations("BackToTopButton");
    const label = t("label");

    useEffect(() => {
        const handleScroll = () => {
            setIsVisible(window.scrollY > SCROLL_THRESHOLD);
        };

        handleScroll();
        window.addEventListener("scroll", handleScroll, { passive: true });

        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <button
            type="button"
            aria-label={label}
            aria-hidden={!isVisible}
            tabIndex={isVisible ? 0 : -1}
            title={label}
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className={clsx(
                "fixed bottom-36 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-600 text-white shadow-[0_10px_25px_rgba(16,185,129,0.28)] transition-all duration-300 hover:-translate-y-1 hover:bg-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 md:bottom-24",
                isVisible
                    ? "opacity-100 translate-y-0"
                    : "pointer-events-none opacity-0 translate-y-4"
            )}
        >
            <ChevronUp size={22} aria-hidden="true" />
        </button>
    );
}