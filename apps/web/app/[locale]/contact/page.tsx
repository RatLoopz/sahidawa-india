import Link from "next/link";
import { useTranslations } from "next-intl";

const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "contact@sahidawa.in";
const DISCORD_URL = "https://discord.gg/dvbDuJVwNa";
const GITHUB_ISSUES_URL =
    "https://github.com/RatLoopz/sahidawa-india/issues/new?template=bug_report.md";
const CONTRIBUTING_URL = "https://github.com/RatLoopz/sahidawa-india/blob/main/CONTRIBUTING.md";

export default function ContactPage() {
    const t = useTranslations("contact");

    return (
        <main className="min-h-screen bg-white">
            {/* Hero */}
            <section className="border-b border-gray-100 px-4 py-16 text-center">
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-4 py-1.5 text-sm font-medium text-green-700">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-green-500"></span>
                    {t("badge")}
                </div>
                <h1 className="mb-4 text-5xl font-extrabold text-gray-900">
                    {t("heroTitle.prefix")}{" "}
                    <span className="text-green-500">{t("heroTitle.highlight")}</span>
                </h1>
                <p className="mx-auto max-w-xl text-lg text-gray-500">{t("heroSubtitle")}</p>
            </section>

            {/* Contact Cards */}
            <section className="bg-gray-50 px-4 py-16">
                <div className="mx-auto grid max-w-3xl gap-6 sm:grid-cols-2">
                    {/* Email — whole card is clickable */}
                    <a
                        href={"mailto:" + CONTACT_EMAIL}
                        className="group rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
                    >
                        <div className="mb-3 text-3xl">✉️</div>
                        <h3 className="mb-1 text-lg font-bold text-gray-900">
                            {t("cards.email.title")}
                        </h3>
                        <p className="mb-4 text-sm text-gray-500">{t("cards.email.description")}</p>
                        <span className="inline-block rounded-lg bg-green-500 px-4 py-2 text-sm font-medium text-white transition-colors group-hover:bg-green-600">
                            {CONTACT_EMAIL}
                        </span>
                    </a>

                    {/* Discord — whole card is clickable */}
                    <a
                        href={DISCORD_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
                    >
                        <div className="mb-3 text-3xl">💬</div>
                        <h3 className="mb-1 text-lg font-bold text-gray-900">
                            {t("cards.discord.title")}
                        </h3>
                        <p className="mb-4 text-sm text-gray-500">
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
                        className="group rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
                    >
                        <div className="mb-3 text-3xl">🐛</div>
                        <h3 className="mb-1 text-lg font-bold text-gray-900">
                            {t("cards.bug.title")}
                        </h3>
                        <p className="mb-4 text-sm text-gray-500">{t("cards.bug.description")}</p>
                        <span className="inline-block rounded-lg bg-green-500 px-4 py-2 text-sm font-medium text-white transition-colors group-hover:bg-green-600">
                            {t("cards.bug.cta")}
                        </span>
                    </a>

                    {/* Contribute — whole card is clickable */}
                    <a
                        href={CONTRIBUTING_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
                    >
                        <div className="mb-3 text-3xl">🤝</div>
                        <h3 className="mb-1 text-lg font-bold text-gray-900">
                            {t("cards.contribute.title")}
                        </h3>
                        <p className="mb-4 text-sm text-gray-500">
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
                    <h2 className="mb-6 text-xl font-bold text-gray-900">
                        {t("quickLinks.title")}
                    </h2>
                    <div className="flex flex-wrap justify-center gap-3">
                        <Link
                            href="/about"
                            className="rounded-full border border-gray-200 px-5 py-2 text-sm text-gray-600 transition-colors hover:border-green-400 hover:text-green-600"
                        >
                            {t("quickLinks.about")}
                        </Link>
                        <Link
                            href="/privacy"
                            className="rounded-full border border-gray-200 px-5 py-2 text-sm text-gray-600 transition-colors hover:border-green-400 hover:text-green-600"
                        >
                            {t("quickLinks.privacy")}
                        </Link>
                        <Link
                            href="/faq"
                            className="rounded-full border border-gray-200 px-5 py-2 text-sm text-gray-600 transition-colors hover:border-green-400 hover:text-green-600"
                        >
                            {t("quickLinks.faq")}
                        </Link>
                    </div>
                </div>
            </section>

            {/* Bottom Note */}
            <section className="border-t border-gray-100 px-4 py-10 text-center">
                <p className="text-sm text-gray-400">{t("footer")}</p>
            </section>
        </main>
    );
}
