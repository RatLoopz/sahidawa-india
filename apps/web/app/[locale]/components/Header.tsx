"use client";

import { ShieldCheck } from "lucide-react";
import { Link, usePathname } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import LanguageSwitcher from "../LanguageSwitcher";

export default function Header() {
  const tNav = useTranslations("Navigation");
  const pathname = usePathname();

  const navLinks = [
    { href: "/", label: tNav("home") },
    { href: "/how-it-works", label: tNav("how_it_works") },
    { href: "/about", label: tNav("about") },
    { href: "/map", label: tNav("pharmacy_map") },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur-lg">
      <div className="container mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3 text-slate-900">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-sm">
            <ShieldCheck size={24} strokeWidth={2.5} />
          </div>
          <span className="text-lg font-black tracking-tight">SahiDawa</span>
        </Link>

        <nav className="flex flex-wrap items-center gap-3 text-sm font-semibold text-slate-600 overflow-x-auto" aria-label="Main navigation">
          {navLinks.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`whitespace-nowrap transition-colors ${active ? "text-emerald-700" : "hover:text-emerald-600"}`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <LanguageSwitcher />
      </div>
    </header>
  );
}
