"use client";

import {
    Lock,
    Cookie,
    Star,
    ClipboardList,
    Search,
    Link as LinkIcon,
    Cloud,
    Database,
    Map,
    Bot,
    ShieldCheck,
    Users,
    Mail,
    Calendar,
} from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { useTranslations } from "next-intl";

export default function PrivacyPolicyPage() {
    const t = useTranslations("Privacy");

    return (
        <main className="min-h-screen bg-(--color-surface-page) text-(--color-text-primary)">
            <PageHeader backHref="/" variant="light" hideBackButton />
            {/* Hero */}
            <section className="border-b border-(--color-border-muted) px-4 py-16 text-center">
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-sm font-medium text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-400">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500"></span>
                    {t("hero.badge")}
                </div>
                <h1 className="mb-4 text-5xl font-extrabold text-(--color-text-primary)">
                    {t("hero.title")}{" "}
                    <span className="text-emerald-600 dark:text-emerald-400">
                        {t("hero.titleHighlight")}
                    </span>
                </h1>
                <p className="mx-auto mb-8 max-w-xl text-lg text-(--color-text-secondary)">
                    {t("hero.subtitle")}
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                    <span className="rounded-full border border-(--color-border-muted) px-4 py-1.5 text-sm text-(--color-text-secondary)">
                        <Lock className="dark:text-emerald-450 mr-2 inline h-4 w-4 text-emerald-600" />{" "}
                        {t("hero.noDataSold")}
                    </span>
                    <span className="rounded-full border border-(--color-border-muted) px-4 py-1.5 text-sm text-(--color-text-secondary)">
                        <Cookie className="dark:text-emerald-450 mr-2 inline h-4 w-4 text-emerald-600" />{" "}
                        {t("hero.noTrackingCookies")}
                    </span>
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-sm text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-400">
                        <Star className="mr-2 inline h-4 w-4" /> {t("hero.openSource")}
                    </span>
                </div>
            </section>

            {/* Content */}
            <section className="bg-(--color-surface-muted) px-4 py-16">
                <div className="mx-auto max-w-3xl space-y-6">
                    {/* Card 1 */}
                    <div className="rounded-2xl border border-(--color-border-muted) bg-(--color-surface-page) p-8 shadow-sm">
                        <div className="mb-4 flex items-center gap-3">
                            <ClipboardList className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                            <h2 className="text-xl font-bold text-(--color-text-primary)">
                                {t("sections.section1.title")}
                            </h2>
                        </div>
                        <p className="mb-4 text-sm text-(--color-text-secondary)">
                            {t("sections.section1.description")}
                        </p>
                        <ul className="space-y-3">
                            <li className="flex items-start gap-3">
                                <span className="bg-emerald-450 mt-1 h-2 w-2 flex-shrink-0 rounded-full"></span>
                                <span className="text-sm text-(--color-text-secondary)">
                                    {t("sections.section1.items.0")}
                                </span>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="bg-emerald-450 mt-1 h-2 w-2 flex-shrink-0 rounded-full"></span>
                                <span className="text-sm text-(--color-text-secondary)">
                                    {t("sections.section1.items.1")}
                                </span>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="bg-emerald-450 mt-1 h-2 w-2 flex-shrink-0 rounded-full"></span>
                                <span className="text-sm text-(--color-text-secondary)">
                                    {t("sections.section1.items.2")}
                                </span>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-red-400"></span>
                                <span className="text-sm text-(--color-text-secondary)">
                                    {t.rich("sections.section1.items.3", {
                                        strongTag: (chunks) => <strong>{chunks}</strong>,
                                    })}
                                </span>
                            </li>
                        </ul>
                    </div>

                    {/* Card 2 */}
                    <div className="rounded-2xl border border-(--color-border-muted) bg-(--color-surface-page) p-8 shadow-sm">
                        <div className="mb-4 flex items-center gap-3">
                            <Search className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                            <h2 className="text-xl font-bold text-(--color-text-primary)">
                                {t("sections.section2.title")}
                            </h2>
                        </div>
                        <ul className="space-y-3">
                            <li className="flex items-start gap-3">
                                <span className="bg-emerald-450 mt-1 h-2 w-2 flex-shrink-0 rounded-full"></span>
                                <span className="text-sm text-(--color-text-secondary)">
                                    {t("sections.section2.items.0")}
                                </span>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="bg-emerald-450 mt-1 h-2 w-2 flex-shrink-0 rounded-full"></span>
                                <span className="text-sm text-(--color-text-secondary)">
                                    {t("sections.section2.items.1")}
                                </span>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-red-400"></span>
                                <span className="text-sm text-(--color-text-secondary)">
                                    {t("sections.section2.items.2")}
                                </span>
                            </li>
                        </ul>
                    </div>

                    {/* Card 3 */}
                    <div className="rounded-2xl border border-(--color-border-muted) bg-(--color-surface-page) p-8 shadow-sm">
                        <div className="mb-4 flex items-center gap-3">
                            <Cookie className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                            <h2 className="text-xl font-bold text-(--color-text-primary)">
                                {t("sections.section3.title")}
                            </h2>
                        </div>
                        <p className="text-sm text-(--color-text-secondary)">
                            {t.rich("sections.section3.description", {
                                strongTag: (chunks) => <strong>{chunks}</strong>,
                            })}
                        </p>
                    </div>

                    {/* Card 4 */}
                    <div className="rounded-2xl border border-(--color-border-muted) bg-(--color-surface-page) p-8 shadow-sm">
                        <div className="mb-4 flex items-center gap-3">
                            <LinkIcon className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                            <h2 className="text-xl font-bold text-(--color-text-primary)">
                                {t("sections.section4.title")}
                            </h2>
                        </div>
                        <p className="mb-4 text-sm text-(--color-text-secondary)">
                            {t("sections.section4.description")}
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-xl bg-(--color-surface-muted) px-4 py-3 text-sm font-medium text-(--color-text-secondary)">
                                <Cloud className="mr-2 inline h-4 w-4 text-emerald-600 dark:text-emerald-400" />{" "}
                                {t("sections.section4.services.cloudinary")}
                            </div>
                            <div className="rounded-xl bg-(--color-surface-muted) px-4 py-3 text-sm font-medium text-(--color-text-secondary)">
                                <Database className="mr-2 inline h-4 w-4 text-emerald-600 dark:text-emerald-400" />{" "}
                                {t("sections.section4.services.supabase")}
                            </div>
                            <div className="rounded-xl bg-(--color-surface-muted) px-4 py-3 text-sm font-medium text-(--color-text-secondary)">
                                <Map className="mr-2 inline h-4 w-4 text-emerald-600 dark:text-emerald-400" />{" "}
                                {t("sections.section4.services.openstreetmap")}
                            </div>
                            <div className="rounded-xl bg-(--color-surface-muted) px-4 py-3 text-sm font-medium text-(--color-text-secondary)">
                                <Bot className="mr-2 inline h-4 w-4 text-emerald-600 dark:text-emerald-400" />{" "}
                                {t("sections.section4.services.sarvamai")}
                            </div>
                        </div>
                    </div>

                    {/* Card 5 */}
                    <div className="rounded-2xl border border-(--color-border-muted) bg-(--color-surface-page) p-8 shadow-sm">
                        <div className="mb-4 flex items-center gap-3">
                            <ShieldCheck className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                            <h2 className="text-xl font-bold text-(--color-text-primary)">
                                {t("sections.section5.title")}
                            </h2>
                        </div>
                        <p className="text-sm text-(--color-text-secondary)">
                            {t("sections.section5.description")}
                        </p>
                    </div>

                    {/* Card 6 */}
                    <div className="rounded-2xl border border-(--color-border-muted) bg-(--color-surface-page) p-8 shadow-sm">
                        <div className="mb-4 flex items-center gap-3">
                            <Users className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                            <h2 className="text-xl font-bold text-(--color-text-primary)">
                                {t("sections.section6.title")}
                            </h2>
                        </div>
                        <p className="text-sm text-(--color-text-secondary)">
                            {t("sections.section6.description")}
                        </p>
                    </div>

                    {/* Card 7 — Contact */}
                    <div className="rounded-2xl border border-emerald-100 bg-(--color-surface-page) p-8 shadow-sm dark:border-emerald-900/30">
                        <div className="mb-4 flex items-center gap-3">
                            <Mail className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                            <h2 className="text-xl font-bold text-(--color-text-primary)">
                                {t("sections.section7.title")}
                            </h2>
                        </div>
                        <p className="mb-3 text-sm text-(--color-text-secondary)">
                            {t("sections.section7.description")}
                        </p>
                        <a
                            href={`mailto:${t("sections.section7.email")}`}
                            className="inline-block rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-400 dark:hover:bg-emerald-900/40"
                        >
                            {t("sections.section7.email")}
                        </a>
                        <p className="mt-4 text-sm text-(--color-text-secondary)">
                            {t.rich("sections.section7.discordText", {
                                discordLink: (chunks) => (
                                    <a
                                        href="https://discord.gg/dvbDuJVwNa"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-emerald-600 underline hover:text-emerald-700 dark:text-emerald-400"
                                    >
                                        {chunks}
                                    </a>
                                ),
                            })}
                        </p>
                    </div>

                    {/* Card 8 */}
                    <div className="rounded-2xl border border-(--color-border-muted) bg-(--color-surface-page) p-8 shadow-sm">
                        <div className="mb-4 flex items-center gap-3">
                            <Calendar className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                            <h2 className="text-xl font-bold text-(--color-text-primary)">
                                {t("sections.section8.title")}
                            </h2>
                        </div>
                        <p className="text-sm text-(--color-text-secondary)">
                            {t("sections.section8.description")}
                        </p>
                    </div>
                </div>
            </section>

            {/* Bottom */}
            <section className="border-t border-(--color-border-muted) px-4 py-10 text-center">
                <p className="text-sm text-(--color-text-muted)">{t("footer")}</p>
            </section>
        </main>
    );
}
