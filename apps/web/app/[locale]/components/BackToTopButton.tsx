"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, KeyboardEvent } from "react";
import { motion, useSpring, useTransform } from "framer-motion";

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

    // Spring-driven progress (0–100) that powers the SVG ring
    const isScrollingBackRef = useRef(false);
    const springProgress = useSpring(0, { stiffness: 120, damping: 30, mass: 0.5 });

    /**
     * SVG ring geometry — sized for the desktop 56×56 px button.
     * viewBox="0 0 56 56" with cx/cy=28 and r=22.
     * On mobile the SVG scales down proportionally via h-full w-full.
     */
    const radius = 22;
    const circumference = 2 * Math.PI * radius; // ≈ 138.23
    const strokeDashoffset = useTransform(
        springProgress,
        [0, 100],
        [circumference, 0]
    );

    useEffect(() => {
        const handleScroll = () => {
            const y = window.scrollY;

            // Hysteresis: two separate thresholds stop flicker at the edge
            if (y > SHOW_THRESHOLD) setIsVisible(true);
            else if (y <= HIDE_THRESHOLD) setIsVisible(false);

            const docH =
                document.documentElement.scrollHeight - window.innerHeight;
            
            // Sync the progress ring with scroll ONLY when NOT scrolling back!
            if (docH > 0 && !isScrollingBackRef.current) {
                springProgress.set(
                    Math.min(100, Math.max(0, (y / docH) * 100))
                );
            }
        };

        handleScroll(); // sync on mount
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
    }, [springProgress]);

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
        if (isScrollingBackRef.current) return;

        if (prefersReducedMotion) {
            window.scrollTo({ top: 0, behavior: "auto" });
            springProgress.set(0);
            shiftFocus();
        } else {
            isScrollingBackRef.current = true;
            setIsScrollingBack(true);
            springProgress.set(0);

            const start = window.scrollY;
            const startTime = performance.now();
            const duration = 750; // Perfectly-tuned duration for SahiDawa

            const animateScroll = (currentTime: number) => {
                const elapsedTime = currentTime - startTime;
                const progress = Math.min(elapsedTime / duration, 1);

                // Premium cubic ease-out easing for an extremely elegant, organic deceleration
                const ease = 1 - Math.pow(1 - progress, 3);
                window.scrollTo(0, start * (1 - ease));

                if (progress < 1) {
                    requestAnimationFrame(animateScroll);
                } else {
                    isScrollingBackRef.current = false;
                    setIsScrollingBack(false);
                    shiftFocus();
                }
            };

            requestAnimationFrame(animateScroll);
        }
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
     * Animation variants.
     *
     * Entry  → springs up from below (opacity 0→1, translateY 20→0, scale 0.9→1)
     * Exit   → falls back down      (opacity 1→0, translateY 0→20, scale 1→0.9)
     *
     * The button is always mounted so static tests can assert on its classes.
     * pointer-events is disabled while hidden to keep keyboard nav clean.
     */
    const variants = {
        hidden: {
            opacity: 0,
            y: prefersReducedMotion ? 0 : 20,
            scale: prefersReducedMotion ? 1 : 0.9,
            pointerEvents: "none" as const,
        },
        visible: {
            opacity: 1,
            y: 0,
            scale: 1,
            pointerEvents: "auto" as const,
        },
    };

    return (
        <>
            {/* Sleek top-of-viewport scroll progress bar (bonus feature matching GSSoC issue suggestions) */}
            <motion.div
                className="fixed top-0 left-0 right-0 z-50 h-[3px] origin-left bg-linear-to-r from-green-400 to-green-600 pointer-events-none"
                style={{ scaleX: useTransform(springProgress, [0, 100], [0, 1]) }}
            />

            <motion.button
                type="button"
                aria-label={label}
                aria-hidden={!isVisible}
                tabIndex={isVisible ? 0 : -1}
                title={label}
                onClick={handleScrollToTop}
                onKeyDown={handleKeyDown}
                initial="hidden"
                animate={isVisible ? "visible" : "hidden"}
                variants={variants}
                transition={
                    prefersReducedMotion
                        ? { duration: 0 }
                        : { type: "spring", stiffness: 300, damping: 24, mass: 0.9 }
                }
                whileHover={prefersReducedMotion ? {} : { scale: 1.08, y: -2 }}
                whileTap={prefersReducedMotion ? {} : { scale: 0.92 }}
                /**
                 * Positioning — perfectly center-aligned with the chatbot launcher on all viewports.
                 *
                 * Chatbot: h-14 (56 px) at bottom-20 (80 px) mobile / md:bottom-6 (24 px) desktop
                 * Both buttons share right-6 (24 px) to sit in the same column on desktop.
                 *
                 * Mobile sizes  : Scroll-to-top is h-12 w-12 (48 px). Chatbot is h-14 w-14 (56 px).
                 *   To center-align them perfectly on mobile, the 48 px scroll-to-top button is positioned
                 *   at right-[28px] (24px default + 4px offset to compensate for the 8px width difference).
                 *   Mobile bottom offset: 80 + 56 + 16 = 152 px → bottom-[152px]
                 *
                 * Desktop sizes : Scroll-to-top is md:h-14 md:w-14 (56 px). Chatbot is h-14 w-14 (56 px).
                 *   Since both buttons are 56 px wide, we use md:right-6 (24 px) for perfect alignment.
                 *   Desktop bottom offset: 24 + 56 + 16 = 96 px → md:bottom-24
                 */
                className="fixed bottom-[152px] right-[28px] md:right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950 md:bottom-24 md:h-14 md:w-14"
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
                    {/* Progress arc — spring-driven; reverses smoothly on click */}
                    <motion.circle
                        cx="28"
                        cy="28"
                        r={radius}
                        strokeWidth="2.5"
                        fill="transparent"
                        stroke="rgba(255,255,255,0.78)"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        style={{ strokeDashoffset }}
                    />
                </svg>

                {/* Custom arrow made of capsules, matching the premium UI/UX theme */}
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
            </motion.button>
        </>
    );
}