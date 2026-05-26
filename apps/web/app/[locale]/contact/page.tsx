import Link from "next/link";
import { useTranslations } from "next-intl";
import { Mail, MessageCircle, Bug, Handshake } from "lucide-react";

const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "contact@sahidawa.in";
const DISCORD_URL = "https://discord.gg/dvbDuJVwNa";
const GITHUB_ISSUES_URL =
    "https://github.com/RatLoopz/sahidawa-india/issues/new?template=bug_report.md";
const CONTRIBUTING_URL = "https://github.com/RatLoopz/sahidawa-india/blob/main/CONTRIBUTING.md";

export default function ContactPage() {
    const t = useTranslations("contact");

    return (
        <main className="min-h-screen bg-(--color-surface-page) text-(--color-text-primary)">
            {/* Hero */}
            <section className="border-b border-(--color-border-muted) px-4 py-16 text-center">
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-sm font-medium text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-400">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500"></span>
                    {t("badge")}
                </div>
                <h1 className="mb-4 text-5xl font-extrabold text-(--color-text-primary)">
                    {t("heroTitle.prefix")}{" "}
                    <span className="text-emerald-600 dark:text-emerald-400">
                        {t("heroTitle.highlight")}
                    </span>
                </h1>
                <p className="mx-auto max-w-xl text-lg text-(--color-text-secondary)">
                    {t("heroSubtitle")}
                </p>
            </section>

            {/* Contact Cards */}
            <section className="bg-(--color-surface-muted) px-4 py-16">
                <div className="mx-auto grid max-w-3xl gap-6 sm:grid-cols-2">
                    {/* Email — whole card is clickable */}
                    <a
                        href={"mailto:" + CONTACT_EMAIL}
                        className="group rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/40 hover:shadow-md active:scale-[0.99] dark:border-slate-800 dark:bg-slate-900"
                    >
                        <div className="mb-3 text-green-500">
                            <Mail className="h-8 w-8" />
                        </div>
                        <h3 className="mb-1 text-lg font-bold text-gray-900 dark:text-white">
                            {t("cards.email.title")}
                        </h3>
                        <p className="mb-4 text-sm text-gray-500 dark:text-slate-400">
                            {t("cards.email.description")}
                        </p>
                        <span className="inline-block rounded-lg bg-green-500 px-4 py-2 text-sm font-medium text-white transition-colors group-hover:bg-green-600">
                            {CONTACT_EMAIL}
                        </span>
                    </a>

                    {/* Discord — whole card is clickable */}
                    <a
                        href={DISCORD_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/40 hover:shadow-md active:scale-[0.99] dark:border-slate-800 dark:bg-slate-900"
                    >
                        <div className="mb-3 text-green-500">
                            <MessageCircle className="h-8 w-8" />
                        </div>
                        <h3 className="mb-1 text-lg font-bold text-gray-900 dark:text-white">
                            {t("cards.discord.title")}
                        </h3>
                        <p className="mb-4 text-sm text-gray-500 dark:text-slate-400">
                            {t("cards.discord.description")}
                        </p>
                        <span className="inline-block rounded-lg bg-green-500 px-4 py-2 text-sm font-medium text-white transition-colors group-hover:bg-green-600">
                            {t("cards.discord.cta")}
                        </span>
                    </a>

                    {/* Bug Report — whole card is clickable */}
                    <a
                        href={GITHUB_ISSUES_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/40 hover:shadow-md active:scale-[0.99] dark:border-slate-800 dark:bg-slate-900"
                    >
                        <div className="mb-3 text-green-500">
                            <Bug className="h-8 w-8" />
                        </div>
                        <h3 className="mb-1 text-lg font-bold text-gray-900 dark:text-white">
                            {t("cards.bug.title")}
                        </h3>
                        <p className="mb-4 text-sm text-gray-500 dark:text-slate-400">
                            {t("cards.bug.description")}
                        </p>
                        <span className="inline-block rounded-lg bg-green-500 px-4 py-2 text-sm font-medium text-white transition-colors group-hover:bg-green-600">
                            {t("cards.bug.cta")}
                        </span>
                    </a>

                    {/* Contribute — whole card is clickable */}
                    <a
                        href={CONTRIBUTING_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/40 hover:shadow-md active:scale-[0.99] dark:border-slate-800 dark:bg-slate-900"
                    >
                        <div className="mb-3 text-green-500">
                            <Handshake className="h-8 w-8" />
                        </div>
                        <h3 className="mb-1 text-lg font-bold text-gray-900 dark:text-white">
                            {t("cards.contribute.title")}
                        </h3>
                        <p className="mb-4 text-sm text-gray-500 dark:text-slate-400">
                            {t("cards.contribute.description")}
                        </p>
                        <span className="inline-block rounded-lg bg-green-500 px-4 py-2 text-sm font-medium text-white transition-colors group-hover:bg-green-600">
                            {t("cards.contribute.cta")}
                        </span>
                    </a>
                </div>
            </section>

            {/* Quick Links */}
            <section className="px-4 py-12">
                <div className="mx-auto max-w-3xl text-center">
                    <h2 className="mb-6 text-xl font-bold text-(--color-text-primary)">
                        {t("quickLinks.title")}
                    </h2>
                    <div className="flex flex-wrap justify-center gap-3">
                        <Link
                            href="/about"
                            className="rounded-full border border-(--color-border-muted) px-5 py-2 text-sm text-(--color-text-secondary) transition-colors hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400"
                        >
                            {t("quickLinks.about")}
                        </Link>
                        <Link
                            href="/privacy"
                            className="rounded-full border border-(--color-border-muted) px-5 py-2 text-sm text-(--color-text-secondary) transition-colors hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400"
                        >
                            {t("quickLinks.privacy")}
                        </Link>
                        <Link
                            href="/faq"
                            className="rounded-full border border-(--color-border-muted) px-5 py-2 text-sm text-(--color-text-secondary) transition-colors hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400"
                        >
                            {t("quickLinks.faq")}
                        </Link>
                    </div>
                </div>
            </section>

            {/* Bottom Note */}
            <section className="border-t border-(--color-border-muted) px-4 py-10 text-center">
                <p className="text-sm text-(--color-text-muted)">{t("footer")}</p>
            </section>
        </main>
    );
}
