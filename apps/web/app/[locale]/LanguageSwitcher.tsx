"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/routing";
import { Globe, ChevronDown } from "lucide-react";
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
  { code: "od", label: "Odia", native: "ଓଡ଼ିଆ" }
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
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const switchLanguage = (code: string) => {
    router.replace(pathname, { locale: code });
    setOpen(false);
  };

  const current = languages.find((l) => l.code === locale) || languages[0];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex h-9 items-center gap-1.5 text-sm font-semibold px-3 py-1.5 bg-(--color-surface-muted) border border-(--color-border-muted) text-(--color-text-primary) rounded-full hover:bg-(--color-border-muted) transition-colors shadow-sm sm:h-10 sm:px-4 sm:py-2"
      >
        <Globe size={16} className="text-emerald-600" />
        <span className="hidden sm:inline">{current.native}</span>
        <span className="sm:hidden">{locale.toUpperCase()}</span>
        <ChevronDown
          size={14}
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
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