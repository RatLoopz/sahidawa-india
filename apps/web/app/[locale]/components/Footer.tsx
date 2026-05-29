"use client";

import { FaGithub, FaLinkedin, FaXTwitter } from "react-icons/fa6";
import { GitBranch, Sparkles, Heart } from "lucide-react";
import { Link } from "@/i18n/routing";
import { usePathname } from "next/navigation";

export default function Footer() {
    const pathname = usePathname();
    // Matches localized homepages like /en, /hi, /mr, or /
    const isHome = pathname ? /^\/[a-z]{2}$|^\/$/.test(pathname) : false;

    return (
        <footer
            className={`no-print mt-auto border-t border-slate-800 bg-slate-950 text-slate-400 ${isHome ? "mb-16 md:mb-0" : ""}`}
        >
            <div className="container mx-auto px-4 py-10 md:px-6">
                <div className="grid grid-cols-1 gap-8 border-b border-slate-800 pb-8 md:grid-cols-3">
                    {/* Brand Section */}
                    <div>
                        <h2 className="mb-3 text-lg font-semibold text-white">SahiDawa</h2>

                        <p className="text-sm leading-relaxed text-slate-500">
                            An open-source healthcare platform built with community collaboration
                            and innovation in mind.
                        </p>
                        <div className="mb-6 flex items-center gap-2 text-[12px] font-bold text-teal-700 dark:text-teal-400">
                            <BadgeCheck size={15} className="text-teal-500" />
                            CDSCO Verified Data Partner
                        </div>
                        <div className="flex gap-3">
                            <a
                                href="https://twitter.com"
                                target="_blank"
                                rel="noreferrer"
                                aria-label="Twitter"
                                className="flex h-9 w-9 items-center justify-center rounded-xl border border-teal-100 bg-white/80 text-slate-500 backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:text-teal-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-teal-400"
                            >
                                <FaXTwitter size={16} />
                            </a>
                            <a
                                href="https://linkedin.com"
                                target="_blank"
                                rel="noreferrer"
                                aria-label="LinkedIn"
                                className="flex h-9 w-9 items-center justify-center rounded-xl border border-teal-100 bg-white/80 text-slate-500 backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:text-teal-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-teal-400"
                            >
                                <FaLinkedin size={16} />
                            </a>
                            <a
                                href="mailto:contact@sahidawa.in"
                                aria-label="Email"
                                className="flex h-9 w-9 items-center justify-center rounded-xl border border-teal-100 bg-white/80 text-slate-500 backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:text-teal-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-teal-400"
                            >
                                <Mail size={16} />
                            </a>
                            <a
                                href="https://github.com/RatLoopz/sahidawa-india"
                                target="_blank"
                                rel="noreferrer"
                                aria-label="GitHub"
                                className="flex h-9 w-9 items-center justify-center rounded-xl border border-teal-100 bg-white/80 text-slate-500 backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:text-teal-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-teal-400"
                            >
                                <FaGithub size={16} />
                            </a>
                        </div>
                    </div>

                    {/* Links */}
                    {[
                        {
                            title: "Platform",
                            items: [
                                { label: "Scan Medicine", link: "/scan" },
                                { label: "Pharmacy Map", link: "/map" },
                                { label: "Alert Feed", link: "/alerts" },
                                { label: "AI Triage", link: "/health" },
                                { label: "Health Records", link: "/reports/me" },
                            ],
                        },
                        {
                            title: "Company",
                            items: [
                                { label: "About Us", link: "/about" },
                                { label: "How It Works", link: "/how-it-works" },
                                { label: "Blog", link: "#" },
                                { label: "Careers", link: "#" },
                                { label: "Press", link: "#" },
                            ],
                        },
                        {
                            title: "Legal",
                            items: [
                                { label: "Privacy Policy", link: "/privacy" },
                                { label: "Terms of Service", link: "/terms" },
                                { label: "Cookie Policy", link: "/cookie-policy" },
                                { label: "CDSCO Compliance", link: "/compliance" },
                                { label: "Contact Us", link: "/contact" },
                            ],
                        },
                    ].map(({ title, items }) => (
                        <div key={title}>
                            <h4 className="mb-5 text-[11px] font-extrabold tracking-[0.2em] text-slate-400 uppercase dark:text-slate-500">
                                {title}
                            </h4>
                            <ul className="space-y-3">
                                {items.map((item) => (
                                    <li key={item.label}>
                                        <Link
                                            href={item.link}
                                            className="text-[13.5px] font-medium text-slate-600 decoration-teal-500 underline-offset-4 transition-colors duration-200 hover:text-teal-700 hover:underline dark:text-slate-400 dark:hover:text-teal-400"
                                        >
                                            {item.label}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                {/* Bottom Footer */}
                <div className="flex flex-col items-center justify-between gap-4 pt-6 text-xs text-slate-500 md:flex-row">
                    <div className="flex items-center gap-4">
                        <p className="text-xs md:text-sm">
                            © 2026 SahiDawa. Open Source under MIT License.
                        </p>
                    </div>

                    <p className="text-center text-xs md:text-right md:text-sm">
                        Built with <Heart className="inline h-[1em] w-[1em] text-red-500" /> for the
                        open-source community.
                    </p>
                    <div className="flex items-center gap-2 text-[12px] font-semibold text-slate-500 dark:text-slate-500">
                        <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                        </span>
                        All systems operational
                    </div>
                </div>
            </div>
        </footer>
    );
}
