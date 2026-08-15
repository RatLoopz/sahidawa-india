"use client";

import { FaGithub, FaLinkedin, FaXTwitter } from "react-icons/fa6";
import { Heart, Mail, ExternalLink, CalendarRange } from "lucide-react";
import { Link } from "@/i18n/routing";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

export default function Footer() {
    const pathname = usePathname();
    const isHome = pathname ? /^\/[a-z]{2}$|^\/$/.test(pathname) : false;
    const isMap = pathname ? pathname.includes("/map") : false;
    const t = useTranslations("Footer");

    if (isMap) return null;

    return (
        <footer
            className={`no-print relative mt-auto border-t border-slate-200/50 bg-white dark:border-slate-800/50 dark:bg-slate-950 ${isHome ? "mb-16 md:mb-0" : ""}`}
        >
            <div className="relative z-10 mx-auto max-w-6xl px-4 py-8 md:px-6">
                {/* Main Footer Grid */}
                <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:grid-cols-5 lg:gap-8">
                    {/* Brand Section */}
                    <div className="col-span-2 lg:col-span-2">
                        <h2 className="mb-3 text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                            SahiDawa
                        </h2>
                        <p className="max-w-sm text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                            {t("brandSubtitle")}
                        </p>
                    </div>

                    {/* Product */}
                    <div>
                        <h3 className="mb-3 text-xs font-bold tracking-wider text-slate-900 uppercase dark:text-white">
                            Product
                        </h3>
                        <ul className="space-y-2">
                            <li>
                                <Link href="/scan" className="text-sm text-slate-600 transition-colors hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400">
                                    Scan Medicine
                                </Link>
                            </li>
                            <li>
                                <Link href="/alerts" className="text-sm text-slate-600 transition-colors hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400">
                                    Safety Alerts
                                </Link>
                            </li>
                            <li>
                                <Link href="/map" className="text-sm text-slate-600 transition-colors hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400">
                                    Find Pharmacy
                                </Link>
                            </li>
                            <li>
                                <Link href="/health" className="text-sm text-slate-600 transition-colors hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400">
                                    AI Assistant
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Resources */}
                    <div>
                        <h3 className="mb-3 text-xs font-bold tracking-wider text-slate-900 uppercase dark:text-white">
                            {t("resources.title")}
                        </h3>
                        <ul className="space-y-2">
                            {resourceLinks.map((link) => (
                                <li key={link.href}>
                                    <a
                                        href={link.href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-sm text-slate-600 transition-colors hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400"
                                    >
                                        {t(link.key)}
                                        <ExternalLink className="h-3 w-3 opacity-50" />
                                    </a>
                                </li>
                            ))}
                            <li>
                                <Link href="/faq" className="text-sm text-slate-600 transition-colors hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400">
                                    {t("quickLinks.faq")}
                                </Link>
                            </li>
                            <li>
                                <Link href="/privacy" className="text-sm text-slate-600 transition-colors hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400">
                                    {t("quickLinks.privacy")}
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Community */}
                    <div>
                        <h3 className="mb-3 text-xs font-bold tracking-wider text-slate-900 uppercase dark:text-white">
                            Community
                        </h3>
                        <ul className="space-y-2">
                            {socialLinks.map((social) => (
                                <li key={social.key}>
                                    <a
                                        href={social.href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 text-sm text-slate-600 transition-colors hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400"
                                    >
                                        <social.icon size={14} />
                                        {t(social.key)}
                                    </a>
                                </li>
                            ))}
                            <li>
                                <a
                                    href="mailto:ratloopzcommunity@gmail.com"
                                    className="inline-flex items-center gap-2 text-sm text-slate-600 transition-colors hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400"
                                >
                                    <Mail className="h-3.5 w-3.5" />
                                    Contact
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-slate-200/50 pt-6 text-xs text-slate-700 md:flex-row dark:border-slate-800/50 dark:text-slate-400">
                    <p>{t("copyright")}</p>
                    <p className="flex items-center gap-1.5">
                        {t("builtWith")}
                        <Heart className="h-3 w-3 text-red-500" fill="currentColor" />
                        {t("builtWithSuffix")}
                    </p>
                </div>
            </div>
        </footer>
    );
}
