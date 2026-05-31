"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, KeyboardEvent } from "react";

/**
 * Scroll thresholds with hysteresis to prevent rapid show/hide flickering
 * at the boundary:
 *   - show  when scrollY > 300 px
 *   - hide  when scrollY ≤ 200 px
 */
const SHOW_THRESHOLD = 300;
const HIDE_THRESHOLD = 200;

export default function BackToTopButton() {
    const [isVisible, setIsVisible] = useState(false);
    const [isScrollingBack, setIsScrollingBack] = useState(false);
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
    const t = useTranslations("BackToTopButton");
    const label = t("label");

    const buttonRef = useRef<HTMLButtonElement>(null);
    const progressBarRef = useRef<HTMLDivElement>(null);

    /**
     * SVG ring geometry — sized for the desktop 56×56 px button.
     * viewBox="0 0 56 56" with cx/cy=28 and r=22.
     * On mobile the SVG scales down proportionally via h-full w-full.
     */
    const radius = 22;
    const circumference = 2 * Math.PI * radius; // ≈ 138.23

    useEffect(() => {
        let ticking = false;

        const handleScroll = () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    const y = window.scrollY;

                    // Hysteresis: two separate thresholds stop flicker at the edge
                    if (y > SHOW_THRESHOLD) {
                        setIsVisible(true);
                    } else if (y <= HIDE_THRESHOLD) {
                        setIsVisible(false);
                    }

                    if (y === 0) {
                        setIsScrollingBack(false);
                    }

                    const docH = document.documentElement.scrollHeight - window.innerHeight;
                    
                    // Sync the progress ring with scroll directly via CSS variable on refs
                    const progress = docH > 0 ? Math.min(100, Math.max(0, (y / docH) * 100)) : 0;
                    const progressStr = progress.toFixed(2);

                    if (buttonRef.current) {
                        buttonRef.current.style.setProperty("--scroll-progress", progressStr);
                    }
                    if (progressBarRef.current) {
                        progressBarRef.current.style.setProperty("--scroll-progress", progressStr);
                    }

                    ticking = false;
                });
                ticking = true;
            }
        };

        // Sync initial state on mount
        handleScroll();
        window.addEventListener("scroll", handleScroll, { passive: true });

        const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
        setPrefersReducedMotion(mq.matches);
        const mqListener = (e: MediaQueryListEvent) =>
            setPrefersReducedMotion(e.matches);
        mq.addEventListener("change", mqListener);

        return () => {
            window.removeEventListener("scroll", handleScroll);
            mq.removeEventListener("change", mqListener);
        };
    }, []);

    const shiftFocus = () => {
        // Programmatic a11y focus shift — prevents screen-reader stranding
        const focusTarget =
            document.getElementById("main-content") ||
            document.querySelector("main") ||
            document.body;

        if (focusTarget) {
            const hadTabindex = focusTarget.hasAttribute("tabindex");
            if (!hadTabindex) focusTarget.setAttribute("tabindex", "-1");
            focusTarget.focus({ preventScroll: true });
            if (!hadTabindex) {
                const cleanup = () => {
                    focusTarget.removeAttribute("tabindex");
                    focusTarget.removeEventListener("blur", cleanup);
                };
                focusTarget.addEventListener("blur", cleanup);
            }
        }
    };

    const handleScrollToTop = () => {
        if (isScrollingBack) return;

        if (window.scrollY === 0) {
            setIsScrollingBack(false);
            return;
        }

        setIsScrollingBack(true);
        window.scrollTo({
            top: 0,
            behavior: prefersReducedMotion ? "auto" : "smooth",
        });
        shiftFocus();
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
        if (e.key === "Escape") {
            const target =
                document.getElementById("main-content") ||
                document.querySelector("main") ||
                document.body;
            target?.focus({ preventScroll: true });
        }
    };

    /**
     * Entry, exit, and hover/active animations using standard Tailwind CSS classes.
     * This achieves native high performance transitions.
     */
    const baseClasses =
        "fixed bottom-[152px] right-[28px] md:right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950 md:bottom-24 md:h-14 md:w-14 transition-all duration-300 ease-out";

    const motionClasses = prefersReducedMotion
        ? (isVisible
            ? "opacity-100 translate-y-0 scale-100 pointer-events-auto"
            : "opacity-0 translate-y-0 scale-100 pointer-events-none")
        : (isVisible
            ? "opacity-100 translate-y-0 scale-100 pointer-events-auto hover:scale-108 hover:-translate-y-0.5 active:scale-92"
            : "opacity-0 translate-y-5 scale-90 pointer-events-none");

    return (
        <>
            {/* Sleek top-of-viewport scroll progress bar */}
            <div
                ref={progressBarRef}
                className="fixed top-0 left-0 right-0 z-50 h-[3px] origin-left bg-linear-to-r from-green-400 to-green-600 pointer-events-none"
                style={{
                    transform: "scaleX(calc(var(--scroll-progress, 0) / 100))",
                }}
            />

            <button
                ref={buttonRef}
                type="button"
                aria-label={label}
                aria-hidden={!isVisible}
                tabIndex={isVisible ? 0 : -1}
                title={label}
                onClick={handleScrollToTop}
                onKeyDown={handleKeyDown}
                className={`${baseClasses} ${motionClasses}`}
                style={{
                    /* Spec gradient: #22C55E top → #16A34A bottom */
                    background: "linear-gradient(180deg, #22C55E 0%, #16A34A 100%)",
                    /* Spec shadow: 0 8px 24px rgba(34,197,94,0.25) */
                    boxShadow: isScrollingBack
                        ? "0 4px 12px rgba(34,197,94,0.18)"
                        : "0 8px 24px rgba(34,197,94,0.25), 0 2px 8px rgba(0,0,0,0.10)",
                }}
            >
                {/* Scroll progress ring */}
                <svg
                    className="absolute inset-0 -rotate-90 h-full w-full"
                    viewBox="0 0 56 56"
                    aria-hidden="true"
                >
                    {/* Track */}
                    <circle
                        cx="28"
                        cy="28"
                        r={radius}
                        strokeWidth="2.5"
                        fill="transparent"
                        stroke="rgba(255,255,255,0.18)"
                    />
                    {/* Progress arc — updated smoothly on scroll via CSS variable */}
                    <circle
                        cx="28"
                        cy="28"
                        r={radius}
                        strokeWidth="2.5"
                        fill="transparent"
                        stroke="rgba(255,255,255,0.78)"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        style={{
                            strokeDashoffset: `calc(${circumference}px - (${circumference}px * var(--scroll-progress, 0) / 100))`,
                            transition: "stroke-dashoffset 80ms ease-out",
                        }}
                    />
                </svg>

                {/* Custom arrow made of capsules */}
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="relative z-10 h-5 w-5 text-white md:h-6 md:w-6 transition-transform duration-300"
                    aria-hidden="true"
                >
                    <path d="M12 19V5" />
                    <path d="M5 12l7-7 7 7" />
                </svg>
            </button>
        </>
    );
}