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
    { code: "pa", label: "Punjabi", native: "ਪੰਜਾਬੀ" },
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

    // Close dropdown on Escape key
    useEffect(() => {
        function handleEscape(e: KeyboardEvent) {
            if (e.key === "Escape") {
                setOpen(false);
            }
        }
        document.addEventListener("keydown", handleEscape);
        return () => document.removeEventListener("keydown", handleEscape);
    }, []);

    const switchLanguage = (code: string) => {
        router.replace(pathname, { locale: code });
        setTimeout(() => {
            setOpen(false);
        }, 100);
    };

    const current = languages.find((l) => l.code === locale) || languages[0];

    return (
        <div className="relative" ref={ref}>
            {/* Trigger Button - Compact Globe Icon Only */}
            <button
                type="button"
                onClick={() => setOpen(!open)}
                aria-label="Select language"
                aria-expanded={open}
                aria-haspopup="listbox"
                aria-controls="language-dropdown"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-(--color-border-muted) bg-(--color-surface-muted) text-(--color-text-primary) shadow-sm transition-colors hover:bg-(--color-border-muted) sm:h-10 sm:w-10"
            >
                <Globe size={18} className="text-emerald-600 dark:text-emerald-400" />
                <span className="sr-only">{current.native}</span>
            </button>

            {/* Dropdown */}
            {open && (
                <div
                    id="language-dropdown"
                    role="listbox"
                    className="absolute right-0 z-50 mt-2 w-44 rounded-2xl border border-(--color-border-muted) bg-(--color-surface-page) shadow-lg max-h-60 overflow-y-auto"
                >
                    {languages.map((lang) => {
                        const isActive = locale === lang.code;
                        return (
                            <button
                                type="button"
                                key={lang.code}
                                onClick={() => switchLanguage(lang.code)}
                                aria-label={`Switch language to ${lang.label}`}
                                className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium transition-colors duration-200 ${
                                    isActive
                                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400"
                                        : "text-(--color-text-primary) hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/20 dark:hover:text-emerald-400"
                                }`}
                            >
                                <div className="flex flex-col">
                                    <span>{lang.native}</span>
                                    <span className="text-xs opacity-70">{lang.label}</span>
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
                </div>
            )}
        </div>
    );
}
