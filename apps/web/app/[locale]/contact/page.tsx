import Link from "next/link";

const CONTACT_EMAIL = "[ADMIN_EMAIL]";
const DISCORD_URL = "https://discord.gg/dvbDuJVwNa";
const GITHUB_ISSUES_URL =
    "https://github.com/RatLoopz/sahidawa-india/issues/new?template=bug_report.md";
const CONTRIBUTING_URL = "https://github.com/RatLoopz/sahidawa-india/blob/main/CONTRIBUTING.md";

export default function ContactPage() {
    return (
        <main className="min-h-screen bg-white">
            {/* Hero */}
            <section className="border-b border-gray-100 px-4 py-16 text-center">
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-4 py-1.5 text-sm font-medium text-green-700">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-green-500"></span>
                    GSSoC 2026 Open Source Project
                </div>
                <h1 className="mb-4 text-5xl font-extrabold text-gray-900">
                    Get In <span className="text-green-500">Touch</span>
                </h1>
                <p className="mx-auto max-w-xl text-lg text-gray-500">
                    Have questions, ideas, or want to contribute? We would love to hear from you.
                </p>
            </section>

            {/* Contact Cards */}
            <section className="bg-gray-50 px-4 py-16">
                <div className="mx-auto grid max-w-3xl gap-6 sm:grid-cols-2">
                    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                        <div className="mb-3 text-3xl">✉️</div>
                        <h3 className="mb-1 text-lg font-bold text-gray-900">Email Us</h3>
                        <p className="mb-4 text-sm text-gray-500">
                            For privacy queries, partnerships, or serious concerns.
                        </p>
                        <a
                            href={"mailto:" + CONTACT_EMAIL}
                            className="inline-block rounded-lg bg-green-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-600"
                        >
                            {CONTACT_EMAIL}
                        </a>
                    </div>

                    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                        <div className="mb-3 text-3xl">💬</div>
                        <h3 className="mb-1 text-lg font-bold text-gray-900">Discord Community</h3>
                        <p className="mb-4 text-sm text-gray-500">
                            Join contributors, ask questions, and get announcements.
                        </p>
                        <a
                            href={DISCORD_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block rounded-lg bg-green-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-600"
                        >
                            Join Discord
                        </a>
                    </div>

                    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                        <div className="mb-3 text-3xl">🐛</div>
                        <h3 className="mb-1 text-lg font-bold text-gray-900">Report a Bug</h3>
                        <p className="mb-4 text-sm text-gray-500">
                            Found an issue? Open a GitHub issue and we will fix it fast.
                        </p>
                        <a
                            href={GITHUB_ISSUES_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block rounded-lg bg-green-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-600"
                        >
                            Open Issue
                        </a>
                    </div>

                    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                        <div className="mb-3 text-3xl">🤝</div>
                        <h3 className="mb-1 text-lg font-bold text-gray-900">Contribute</h3>
                        <p className="mb-4 text-sm text-gray-500">
                            Want to help build SahiDawa? Read our contributing guide.
                        </p>
                        <a
                            href={CONTRIBUTING_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block rounded-lg bg-green-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-600"
                        >
                            Read Guide
                        </a>
                    </div>
                </div>
            </section>

            {/* Quick Links */}
            <section className="px-4 py-12">
                <div className="mx-auto max-w-3xl text-center">
                    <h2 className="mb-6 text-xl font-bold text-gray-900">Helpful Links</h2>
                    <div className="flex flex-wrap justify-center gap-3">
                        <Link
                            href="/about"
                            className="rounded-full border border-gray-200 px-5 py-2 text-sm text-gray-600 transition-colors hover:border-green-400 hover:text-green-600"
                        >
                            About SahiDawa
                        </Link>
                        <Link
                            href="/privacy"
                            className="rounded-full border border-gray-200 px-5 py-2 text-sm text-gray-600 transition-colors hover:border-green-400 hover:text-green-600"
                        >
                            Privacy Policy
                        </Link>
                        <Link
                            href="/faq"
                            className="rounded-full border border-gray-200 px-5 py-2 text-sm text-gray-600 transition-colors hover:border-green-400 hover:text-green-600"
                        >
                            FAQ
                        </Link>
                    </div>
                </div>
            </section>

            {/* Bottom Note */}
            <section className="border-t border-gray-100 px-4 py-10 text-center">
                <p className="text-sm text-gray-400">
                    SahiDawa is free, open-source, and built for 1.4 billion Indians. No ads. No
                    premium. No data sold. Ever.
                </p>
            </section>
        </main>
    );
}
