"use client";

import { FaGithub, FaLinkedin, FaXTwitter } from "react-icons/fa6";
import { Sparkles, Heart, Mail, ExternalLink, CalendarRange } from "lucide-react";
import { Link } from "@/i18n/routing";
import { usePathname } from "next/navigation";

export default function Footer() {
    const pathname = usePathname();
    const isHome = pathname ? /^\/[a-z]{2}$|^\/$/.test(pathname) : false;

    const quickLinks = [
        { href: "/expiry-tracker", label: "Expiry Tracker", icon: CalendarRange, highlight: true },
        { href: "/faq", label: "FAQ" },
        { href: "/about", label: "About" },
        { href: "/privacy", label: "Privacy" },
        { href: "/contact", label: "Contact" },
    ];

    const resourceLinks = [
        {
            href: "https://github.com/RatLoopz/sahidawa-india",
            label: "GitHub",
            external: true,
        },
        {
            href: "https://github.com/RatLoopz/sahidawa-india/blob/main/CONTRIBUTING.md",
            label: "Contributing",
            external: true,
        },
    ];

    const socialLinks = [
        {
            href: "https://github.com/RatLoopz/sahidawa-india",
            icon: FaGithub,
            label: "GitHub",
            hoverColor: "hover:text-white hover:border-slate-600",
        },
        {
            href: "https://linkedin.com/",
            icon: FaLinkedin,
            label: "LinkedIn",
            hoverColor: "hover:text-blue-400 hover:border-blue-500",
        },
        {
            href: "https://twitter.com/",
            icon: FaXTwitter,
            label: "Twitter",
            hoverColor: "hover:text-white hover:border-slate-600",
        },
    ];

    return (
        <footer
            className={`no-print relative mt-auto border-t border-slate-200/50 bg-white/70 backdrop-blur-md dark:border-slate-800/50 dark:bg-slate-900/50 ${isHome ? "mb-16 md:mb-0" : ""}`}
        >
            {/* Decorative gradient blobs */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-emerald-500/5 blur-3xl dark:bg-emerald-500/10" />
                <div className="absolute -right-20 -bottom-20 h-64 w-64 rounded-full bg-purple-500/5 blur-3xl dark:bg-purple-500/10" />
            </div>

            <div className="relative z-10 mx-auto max-w-6xl px-4 py-8 md:px-6">
                {/* Main Footer Grid */}
                <div className="grid grid-cols-1 gap-8 md:grid-cols-12 md:gap-6">
                    {/* Brand Section - Takes more space */}
                    <div className="md:col-span-5">
                        <h2 className="mb-3 text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                            SahiDawa
                        </h2>
                        <p className="mb-4 max-w-sm text-sm leading-relaxed text-slate-700 dark:text-slate-400">
                            India's first open-source medicine verification platform. Scan, verify,
                            and trust your medicines with community-powered transparency.
                        </p>
                        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-600 dark:border-emerald-400/20 dark:text-emerald-400">
                            <Sparkles className="h-3 w-3" />
                            Made for GSSoC 2026
                        </div>
                    </div>

                    {/* Quick Links */}
                    <nav className="md:col-span-2">
                        <h3 className="mb-3 text-xs font-bold tracking-wider text-slate-900 uppercase dark:text-white">
                            Quick Links
                        </h3>
                        <ul className="space-y-2">
                            {quickLinks.map((link) => (
                                <li key={link.href}>
                                    <Link
                                        href={link.href}
                                        className={`inline-flex items-center gap-1.5 text-sm transition-colors ${
                                            link.highlight
                                                ? "font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                                                : "text-slate-700 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400"
                                        }`}
                                    >
                                        {link.icon && <link.icon className="h-3.5 w-3.5" />}
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </nav>

                    {/* Resources */}
                    <nav className="md:col-span-2">
                        <h3 className="mb-3 text-xs font-bold tracking-wider text-slate-900 uppercase dark:text-white">
                            Resources
                        </h3>
                        <ul className="space-y-2">
                            {resourceLinks.map((link) => (
                                <li key={link.href}>
                                    <a
                                        href={link.href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-sm text-slate-700 transition-colors hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400"
                                    >
                                        {link.label}
                                        <ExternalLink className="h-3 w-3" />
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </nav>

                    {/* Connect Section */}
                    <div className="md:col-span-3">
                        <h3 className="mb-3 text-xs font-bold tracking-wider text-slate-900 uppercase dark:text-white">
                            Connect With Us
                        </h3>
                        <div className="mb-4 flex items-center gap-2">
                            {socialLinks.map((social) => {
                                const IconComponent = social.icon;
                                return (
                                    <a
                                        key={social.label}
                                        href={social.href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        aria-label={social.label}
                                        className={`group flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white/50 text-slate-600 transition-all hover:scale-105 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400 ${social.hoverColor}`}
                                    >
                                        <IconComponent size={16} />
                                    </a>
                                );
                            })}
                        </div>
                        <a
                            href="mailto:contact@sahidawa.in"
                            className="inline-flex items-center gap-2 text-sm text-slate-700 transition-colors hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400"
                        >
                            <Mail className="h-4 w-4" />
                            contact@sahidawa.in
                        </a>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-slate-200/50 pt-6 text-xs text-slate-700 md:flex-row dark:border-slate-800/50 dark:text-slate-400">
                    <p>© 2026 SahiDawa. Open Source under MIT License.</p>
                    <p className="flex items-center gap-1.5">
                        Built with
                        <Heart className="h-3 w-3 text-red-500" fill="currentColor" />
                        for the open-source community
                    </p>
                </div>
            </div>
        </footer>
    );
}
