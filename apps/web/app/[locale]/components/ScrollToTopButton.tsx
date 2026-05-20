"use client";

import { useEffect, useState } from "react";

export default function ScrollToTopButton() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > 120);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Scroll to top"
      className={`fixed right-4 bottom-24 z-60 inline-flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-900 shadow-xl shadow-slate-200/70 transition duration-200 hover:-translate-y-0.5 hover:bg-slate-50 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-white dark:border-slate-700 dark:bg-slate-950 dark:shadow-slate-950/30 dark:text-slate-100 dark:hover:bg-slate-900 dark:focus:ring-sky-400 md:right-6 md:bottom-6 ${isVisible ? "opacity-100 visible" : "pointer-events-none opacity-0 invisible"}`}
    >
      <span className="sr-only">Scroll to top</span>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
        <path fillRule="evenodd" d="M3.22 10.22a.75.75 0 011.06 0L10 15.94l5.72-5.72a.75.75 0 111.06 1.06l-6.25 6.25a.75.75 0 01-1.06 0l-6.25-6.25a.75.75 0 010-1.06z" clipRule="evenodd" />
        <path fillRule="evenodd" d="M10 4.25a.75.75 0 01.75.75v10.69a.75.75 0 01-1.5 0V5a.75.75 0 01.75-.75z" clipRule="evenodd" />
      </svg>
    </button>
  );
}
