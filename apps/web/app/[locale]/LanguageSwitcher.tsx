"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/routing";
import { Globe, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";

const languages = [
    { code: "en", label: "English", native: "English" },
    { code: "ta", label: "Tamil", native: "தமிழ்" },
    { code: "bn", label: "Bengali", native: "বাংলা" },
    { code: "te", label: "Telugu", native: "తెలుగు" },
];

export default function LanguageSwitcher() {
    const locale = useLocale();
    const router = useRouter();
    const pathname = usePathname();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);

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
        triggerRef.current?.focus();
    };

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === "Escape") {
            setOpen(false);
            triggerRef.current?.focus();
        }
    }, []);

    const current = languages.find((l) => l.code === locale) || languages[0];

    return (
        <div className="relative" ref={ref} onKeyDown={handleKeyDown}>
            <button
                ref={triggerRef}
                onClick={() => setOpen(!open)}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-label={`Language: ${current.native}. Press to change language.`}
                className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-200"
            >
                <Globe size={16} className="text-emerald-600" aria-hidden="true" />
                <span className="hidden sm:inline" aria-hidden="true">
                    {current.native}
                </span>
                <span className="sm:hidden" aria-hidden="true">
                    {locale.toUpperCase()}
                </span>
                <ChevronDown
                    size={14}
                    className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                    aria-hidden="true"
                />
            </button>

            {open && (
                <ul
                    role="listbox"
                    aria-label="Select language"
                    className="absolute right-0 z-50 mt-2 w-40 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg"
                >
                    {languages.map((lang) => (
                        <li
                            key={lang.code}
                            role="option"
                            aria-selected={locale === lang.code}
                            onClick={() => switchLanguage(lang.code)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    switchLanguage(lang.code);
                                }
                            }}
                            tabIndex={0}
                            className={`flex w-full cursor-pointer items-center justify-between px-4 py-3 text-left text-sm font-semibold transition-colors hover:bg-emerald-50 hover:text-emerald-700 ${locale === lang.code ? "bg-emerald-50 text-emerald-700" : "text-slate-700"}`}
                        >
                            <span>{lang.native}</span>
                            {locale === lang.code && (
                                <span
                                    className="h-2 w-2 rounded-full bg-emerald-500"
                                    aria-hidden="true"
                                />
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
