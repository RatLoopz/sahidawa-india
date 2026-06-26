"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/routing";
import { Globe, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useOnClickOutside } from "@/hooks/useOnClickOutside";

const languages = [
    { code: "en", label: "English", native: "English" },

    { code: "ta", label: "Tamil", native: "தமிழ்" },
    { code: "bn", label: "Bengali", native: "বাংলা" },
    { code: "te", label: "Telugu", native: "తెలుగు" },
    { code: "mr", label: "Marathi", native: "मराठी" },
    { code: "hi", label: "Hindi", native: "हिन्दी" },
    { code: "gu", label: "Gujarati", native: "ગુજરાતી" },
    { code: "ur", label: "Urdu", native: "اردو" },
    { code: "or", label: "Odia", native: "ଓଡ଼ିଆ" },
    { code: "kn", label: "Kannada", native: "ಕನ್ನಡ" },
    { code: "kok", label: "Konkani", native: "कोंकणी" },
    { code: "pa", label: "Punjabi", native: "ਪੰਜਾਬੀ" },
    { code: "as", label: "Assamese", native: "অসমীয়া" },
];

export default function LanguageSwitcher() {
    const locale = useLocale();
    const tA11y = useTranslations("Accessibility");
    const router = useRouter();
    const pathname = usePathname();
    const [open, setOpen] = useState(false);
    const [focusedIndex, setFocusedIndex] = useState(0);

    const ref = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const listboxRef = useRef<HTMLDivElement>(null);

    // Focus management: when dropdown opens, select current language and focus listbox
    useEffect(() => {
        if (open) {
            const currentIndex = languages.findIndex((l) => l.code === locale);
            setFocusedIndex(currentIndex >= 0 ? currentIndex : 0);
            listboxRef.current?.focus();
        }
    }, [open, locale]);

    const switchLanguage = (code: string) => {
        router.replace(pathname, { locale: code });
        setOpen(false);
        triggerRef.current?.focus();
    };

    const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setOpen(true);
        }
    };

    const handleListKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                setFocusedIndex((i) => Math.min(i + 1, languages.length - 1));
                break;
            case "ArrowUp":
                e.preventDefault();
                setFocusedIndex((i) => Math.max(i - 1, 0));
                break;
            case "Home":
                e.preventDefault();
                setFocusedIndex(0);
                break;
            case "End":
                e.preventDefault();
                setFocusedIndex(languages.length - 1);
                break;
            case "Enter":
            case " ":
                e.preventDefault();
                if (focusedIndex >= 0 && focusedIndex < languages.length) {
                    switchLanguage(languages[focusedIndex].code);
                }
                break;
            case "Escape":
                e.preventDefault();
                setOpen(false);
                triggerRef.current?.focus();
                break;
            case "Tab":
                setOpen(false);
                break;
            default:
                break;
        }
    };

    useOnClickOutside(
        ref,
        (e) => {
            setOpen(false);
            if (e instanceof KeyboardEvent && e.key === "Escape") {
                triggerRef.current?.focus();
            }
        },
        open
    );

    const current = languages.find((l) => l.code === locale) || languages[0];

    return (
        <div className="relative" ref={ref}>
            <button
                ref={triggerRef}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-label={tA11y("select_language")}
                onClick={() => setOpen(!open)}
                onKeyDown={handleTriggerKeyDown}
                className="flex h-9 items-center gap-1.5 rounded-full border border-(--color-border-muted) bg-(--color-surface-muted) px-3 py-1.5 text-sm font-semibold text-(--color-text-primary) shadow-sm transition-colors hover:bg-(--color-border-muted) sm:h-10 sm:px-4 sm:py-2"
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
                <div
                    ref={listboxRef}
                    role="listbox"
                    aria-label={tA11y("language_options")}
                    aria-activedescendant={`lang-option-${focusedIndex}`}
                    onKeyDown={handleListKeyDown}
                    tabIndex={-1}
                    className="absolute right-0 bottom-full z-[100] mb-2 max-h-60 w-40 overflow-y-auto rounded-2xl border border-(--color-border-muted) bg-(--color-surface-page) shadow-lg outline-none sm:top-full sm:bottom-auto sm:mt-2 sm:max-h-[400px]"
                >
                    {languages.map((lang, index) => {
                        const isSelected = locale === lang.code;
                        const isFocused = focusedIndex === index;
                        return (
                            <div
                                key={lang.code}
                                id={`lang-option-${index}`}
                                role="option"
                                aria-selected={isSelected}
                                onClick={() => switchLanguage(lang.code)}
                                className={`flex w-full cursor-pointer items-center justify-between px-3 py-1.5 text-left text-sm font-semibold transition-colors sm:px-4 sm:py-2 ${
                                    isSelected || isFocused
                                        ? "dark:text-emerald-450 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20"
                                        : "text-(--color-text-primary)"
                                } ${isFocused ? "ring-2 ring-emerald-500/50 ring-inset" : ""} `}
                            >
                                <span>{lang.native}</span>
                                {isSelected && (
                                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
