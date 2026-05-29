import { BadgeCheck, Mail } from "lucide-react";
import { FaGithub, FaLinkedin, FaXTwitter } from "react-icons/fa6";
import { Link } from "@/i18n/routing";

export default function Footer() {
    return (
        <footer className="no-print mt-auto border-t border-teal-100 bg-gradient-to-b from-teal-50 to-cyan-50 transition-colors duration-300 dark:border-slate-800 dark:from-slate-900 dark:to-slate-950">
            <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-10">
                <div className="grid grid-cols-1 gap-12 md:grid-cols-5">
                    {/* Brand — spans 2 */}
                    <div className="md:col-span-2">
                        <Link href="/" className="mb-5 flex items-center gap-2.5">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shadow-sm sm:h-10 sm:w-10 dark:bg-blue-900/30 dark:text-blue-400">
                                <img
                                    src="/favicon.ico"
                                    alt=""
                                    aria-hidden="true"
                                    className="h-7 w-7 object-contain"
                                    width={28}
                                    height={28}
                                />
                            </div>
                            <span className="text-[20px] font-extrabold tracking-tight text-slate-900 dark:text-white">
                                Sahi<span className="text-teal-600 dark:text-teal-400">Dawa</span>
                            </span>
                        </Link>
                        <p className="mb-6 max-w-xs text-[14px] leading-relaxed text-slate-600 dark:text-slate-400">
                            India's most trusted medicine verification platform — protecting
                            patients with AI-powered authenticity checks and real-time CDSCO data.
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

                {/* Bottom bar */}
                <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-teal-200 pt-8 sm:flex-row dark:border-slate-800">
                    <p className="text-[12px] font-medium text-slate-500 dark:text-slate-500">
                        © {new Date().getFullYear()} SahiDawa. Open Source under MIT License.
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
