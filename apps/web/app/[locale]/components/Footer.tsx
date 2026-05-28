import { FaGithub, FaLinkedin, FaXTwitter } from "react-icons/fa6";
import { GitBranch, Sparkles, Heart } from "lucide-react";
import { Link } from "@/i18n/routing";

export default function Footer() {
    return (
        <footer className="no-print mt-auto border-t border-slate-200 bg-white text-slate-600 transition-colors duration-300 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
            <div className="container mx-auto px-4 py-10 md:px-6">
                <div className="grid grid-cols-1 gap-8 border-b border-slate-200 pb-8 md:grid-cols-3 dark:border-slate-800">
                    {/* Brand Section */}
                    <div>
                        <h2 className="mb-3 text-lg font-bold text-slate-900 dark:text-white">
                            SahiDawa
                        </h2>

                        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-500">
                            An open-source healthcare platform built with community collaboration
                            and innovation in mind.
                        </p>

                        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-400">
                            <Sparkles className="h-3 w-3" /> Made for GSSoC 2026
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h3 className="mb-4 text-sm font-semibold tracking-wide text-slate-900 uppercase dark:text-white">
                            Quick Links
                        </h3>

                        <div className="flex flex-col gap-3 text-sm">
                            <a
                                href="https://github.com/RatLoopz/sahidawa-india"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 transition-all duration-200 hover:translate-x-1 hover:text-blue-600 dark:hover:text-white"
                            >
                                <GitBranch size={16} />
                                GitHub Repository
                            </a>

                            <a
                                href="https://github.com/RatLoopz/sahidawa-india/blob/main/CONTRIBUTING.md"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="transition-all duration-200 hover:translate-x-1 hover:text-blue-600 dark:hover:text-white"
                            >
                                Contributing Guide
                            </a>
                            <Link
                                href="/faq"
                                className="transition-all duration-200 hover:translate-x-1 hover:text-blue-600 dark:hover:text-white"
                            >
                                FAQ
                            </Link>
                            <Link
                                href="/about"
                                className="transition-all duration-200 hover:translate-x-1 hover:text-blue-600 dark:hover:text-white"
                            >
                                About Us
                            </Link>
                            <Link
                                href="/privacy"
                                className="transition-all duration-200 hover:translate-x-1 hover:text-blue-600 dark:hover:text-white"
                            >
                                Privacy Policy
                            </Link>
                            <Link
                                href="/contact"
                                className="transition-all duration-200 hover:translate-x-1 hover:text-blue-600 dark:hover:text-white"
                            >
                                Contact Us
                            </Link>
                        </div>
                    </div>

                    {/* Social Links */}
                    <div>
                        <h3 className="mb-4 text-sm font-semibold tracking-wide text-slate-900 uppercase dark:text-white">
                            Connect
                        </h3>

                        <div className="flex items-center gap-4">
                            <a
                                href="https://github.com/RatLoopz/sahidawa-india"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-600 transition-all duration-300 hover:-translate-y-0.5 hover:border-slate-400 hover:text-slate-900 hover:shadow-sm active:scale-95 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-white dark:hover:shadow-[0_4px_12px_rgba(255,255,255,0.1)]"
                            >
                                <FaGithub size={18} />
                            </a>

                            <a
                                href="https://linkedin.com/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-600 transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-500 hover:text-blue-600 hover:shadow-sm active:scale-95 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:text-blue-400 dark:hover:shadow-[0_4px_12px_rgba(37,99,235,0.2)]"
                            >
                                <FaLinkedin size={18} />
                            </a>

                            <a
                                href="https://twitter.com/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-600 transition-all duration-300 hover:-translate-y-0.5 hover:border-slate-400 hover:text-slate-900 hover:shadow-sm active:scale-95 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-slate-500 dark:hover:text-white dark:hover:shadow-[0_4px_12px_rgba(255,255,255,0.1)]"
                            >
                                <FaXTwitter size={18} />
                            </a>
                        </div>
                    </div>
                </div>

                {/* Bottom Footer */}
                <div className="flex flex-col items-center justify-between gap-4 pt-6 text-xs text-slate-500 md:flex-row">
                    <div className="flex items-center gap-4">
                        <p className="text-xs md:text-sm">
                            © {new Date().getFullYear()} SahiDawa. Open Source under MIT License.
                        </p>
                    </div>

                    <p className="text-center text-xs md:text-right md:text-sm">
                        Built with <Heart className="inline h-[1em] w-[1em] text-rose-500" /> for
                        the open-source community.
                    </p>
                </div>
            </div>
        </footer>
    );
}
