"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/routing";
import { Globe, ChevronDown, Check } from "lucide-react";
import { useState, useRef, useEffect } from "react";

const languages = [
  { code: "en", label: "English", native: "English" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "ta", label: "Tamil", native: "தமிழ்" },
  { code: "bn", label: "Bengali", native: "বাংলা" },
  { code: "te", label: "Telugu", native: "తెలుగు" },
  { code: "mr", label: "Marathi", native: "मराठी" },
  { code: "gu", label: "Gujarati", native: "ગુજરાતી" },
  { code: "ur", label: "Urdu", native: "اردو" },
  { code: "od", label: "Odia", native: "ଓଡ଼ିଆ" },
  { code: "kn", label: "Kannada", native: "ಕನ್ನಡ" },
  { code: "pa", label: "Punjabi", native: "ਪੰਜਾਬੀ" }
];

export default function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const [open, setOpen] = useState(false);

  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Close dropdown on Escape key
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const switchLanguage = (code: string) => {
    router.replace(pathname, { locale: code });
    setOpen(false);
  };

  const current =
    languages.find((l) => l.code === locale) || languages[0];

  return (
    <div className="relative" ref={ref}>
      {/* Trigger Button */}
      <button
        onClick={() => setOpen(!open)}
        aria-label="Select language"
        aria-expanded={open}
        aria-haspopup="listbox"
        className="
          language-switcher-btn
          flex items-center gap-2
          rounded-full
          border border-slate-200
          bg-slate-100
          px-3 py-2
          text-sm font-semibold
          text-slate-700
          shadow-sm
          transition-all duration-200
          hover:bg-slate-200
          hover:shadow-md
          dark:border-slate-700
          dark:bg-slate-800
          dark:text-slate-200
          dark:hover:bg-slate-700
        "
        className="flex h-9 items-center gap-1.5 text-sm font-semibold px-3 py-1.5 bg-(--color-surface-muted) border border-(--color-border-muted) text-(--color-text-primary) rounded-full hover:bg-(--color-border-muted) transition-colors shadow-sm sm:h-10 sm:px-4 sm:py-2"
      >
        <Globe
          size={16}
          className="text-emerald-600 dark:text-emerald-400"
        />

        <span className="hidden sm:inline">
          {current.native}
        </span>

        <span className="sm:hidden">
          {locale.toUpperCase()}
        </span>

        <ChevronDown
          size={15}
          className={`
            transition-transform duration-200
            ${open ? "rotate-180" : ""}
          `}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="listbox"
          className="
            language-dropdown
            absolute right-0 z-50 mt-2
            w-44 overflow-hidden
            rounded-2xl
            border border-slate-200
            bg-white
            shadow-xl
            dark:border-slate-700
            dark:bg-slate-900
          "
        >
          {languages.map((lang) => {
            const isActive = locale === lang.code;

            return (
              <button
                key={lang.code}
                onClick={() => switchLanguage(lang.code)}
                aria-label={`Switch language to ${lang.label}`}
                className={`
                  language-option
                  flex w-full items-center justify-between
                  px-4 py-3
                  text-left text-sm font-medium
                  transition-all duration-200
                  ${
                    isActive
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                      : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  }
                `}
              >
                <div className="flex flex-col">
                  <span>{lang.native}</span>

                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {lang.label}
                  </span>
                </div>

                {isActive && (
                  <Check
                    size={16}
                    className="text-emerald-600 dark:text-emerald-400"
                  />
                )}
              </button>
            );
          })}
        <div className="absolute right-0 mt-2 w-40 bg-(--color-surface-page) border border-(--color-border-muted) rounded-2xl shadow-lg overflow-hidden z-50">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => switchLanguage(lang.code)}
              className={`w-full text-left px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-950/20 hover:text-emerald-700 dark:hover:text-emerald-450 flex items-center justify-between sm:px-4 sm:py-2
                ${locale === lang.code ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-450" : "text-(--color-text-primary)"}`}
            >
              <span>{lang.native}</span>
              {locale === lang.code && (
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
