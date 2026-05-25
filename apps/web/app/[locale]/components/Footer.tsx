import { FaGithub, FaLinkedin, FaXTwitter } from "react-icons/fa6";
import { GitBranch, Sparkles, Heart } from "lucide-react";
import { Link } from "@/i18n/routing";
import { ThemeToggle } from "./ThemeToggle"; // <-- ADD THIS IMPORT

export default function Footer() {
    return (
        <footer className="no-print mt-auto border-t border-slate-800 bg-slate-950 text-slate-400">
            <div className="container mx-auto px-4 py-10 md:px-6">
                <div className="grid grid-cols-1 gap-8 border-b border-slate-800 pb-8 md:grid-cols-3">
                    {/* Brand Section */}
                    <div>
                        <h2 className="mb-3 text-lg font-semibold text-white">SahiDawa</h2>

                        <p className="text-sm leading-relaxed text-slate-500">
                            An open-source healthcare platform built with community collaboration
                            and innovation in mind.
                        </p>

                        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
                            <Sparkles className="h-3 w-3" /> Made for GSSoC 2026
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h3 className="mb-4 text-sm font-semibold tracking-wide text-white uppercase">
                            Quick Links
                        </h3>

                        <div className="flex flex-col gap-3 text-sm">
                            <a
                                href="https://github.com/RatLoopz/sahidawa-india"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 transition-all duration-200 hover:translate-x-1 hover:text-white"
                            >
                                <GitBranch size={16} />
                                GitHub Repository
                            </a>

                            <a
                                href="https://github.com/RatLoopz/sahidawa-india/blob/main/CONTRIBUTING.md"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="transition-all duration-200 hover:translate-x-1 hover:text-white"
                            >
                                Contributing Guide
                            </a>
                            <Link
                                href="/faq"
                                className="transition-all duration-200 hover:translate-x-1 hover:text-white"
                            >
                                FAQ
                            </Link>
                            <Link
                                href="/about"
                                className="transition-all duration-200 hover:translate-x-1 hover:text-white"
                            >
                                About Us
                            </Link>
                            <Link
                                href="/privacy"
                                className="transition-all duration-200 hover:translate-x-1 hover:text-white"
                            >
                                Privacy Policy
                            </Link>
                            <Link
                                href="/contact"
                                className="transition-all duration-200 hover:translate-x-1 hover:text-white"
                            >
                                Contact Us
                            </Link>
                        </div>
                    </div>

                    {/* Social Links */}
                    <div>
                        <h3 className="mb-4 text-sm font-semibold tracking-wide text-white uppercase">
                            Connect
                        </h3>

                        <div className="flex items-center gap-4">
                            <a
                                href="https://github.com/RatLoopz/sahidawa-india"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-lg border border-slate-800 bg-slate-900 p-2 transition-all duration-300 hover:border-slate-600 hover:text-white"
                            >
                                <FaGithub size={18} />
                            </a>

                            <a
                                href="https://linkedin.com/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-lg border border-slate-800 bg-slate-900 p-2 transition-all duration-300 hover:border-slate-600 hover:text-white"
                            >
                                <FaLinkedin size={18} />
                            </a>

                            <a
                                href="https://twitter.com/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-lg border border-slate-800 bg-slate-900 p-2 transition-all duration-300 hover:border-slate-600 hover:text-white"
                            >
                                <FaXTwitter size={18} />
                            </a>
                        </div>
                    </div>
                </div>

                {/* Bottom Footer */}
                <div className="flex flex-col items-center justify-between gap-4 pt-6 text-xs text-slate-500 md:flex-row">
                    <div className="flex items-center gap-4">
                        <p>© 2026 SahiDawa. Open Source under MIT License.</p>
                        {/* THEME TOGGLE ADDED HERE */}
                        <ThemeToggle />
                    </div>

                    <p className="text-center md:text-right">
                        Built with <Heart className="inline h-3 w-3 text-red-500" /> for the open-source community.
                    </p>
                </div>
            </div>
        </footer>
    );
}
