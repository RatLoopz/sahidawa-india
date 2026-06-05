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
import { useTranslations } from "next-intl";
import { PageHeader } from "../components/PageHeader";

const CONTACT_EMAIL = "contact@sahidawa.in";

export default function PrivacyPolicyPage() {
    const t = useTranslations("PrivacyPolicy");
    const richText = {
        strong: (chunks: React.ReactNode) => <strong>{chunks}</strong>,
    };

    return (
        <main className="min-h-screen bg-(--color-surface-page) text-(--color-text-primary)">
            <PageHeader backHref="/" variant="light" />

            {/* Hero */}
            <section className="border-b border-(--color-border-muted) px-4 py-16 text-center">
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-sm font-medium text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-400">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500"></span>
                    {t("badge")}
                </div>
                <h1 className="mb-4 text-5xl font-extrabold text-(--color-text-primary)">
                    {t("hero.title")}{" "}
                    <span className="text-emerald-600 dark:text-emerald-400">
                        {t("hero.titleHighlight")}
                    </span>
                </h1>
                <p className="mx-auto mb-8 max-w-xl text-lg text-(--color-text-secondary)">
                    {t("hero.description")}
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                    <span className="rounded-full border border-(--color-border-muted) px-4 py-1.5 text-sm text-(--color-text-secondary)">
                        <Lock className="dark:text-emerald-450 mr-2 inline h-4 w-4 text-emerald-600" />
                        {t("pills.noDataSold")}
                    </span>
                    <span className="rounded-full border border-(--color-border-muted) px-4 py-1.5 text-sm text-(--color-text-secondary)">
                        <Cookie className="dark:text-emerald-450 mr-2 inline h-4 w-4 text-emerald-600" />
                        {t("pills.noTrackingCookies")}
                    </span>
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-sm text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-400">
                        <Star className="mr-2 inline h-4 w-4" />
                        {t("pills.openSource")}
                    </span>
                </div>
            </section>

            {/* Content */}
            <section className="bg-(--color-surface-muted) px-4 py-16">
                <div className="mx-auto max-w-3xl space-y-6">

                    {/* Card 1 — Information We Collect */}
                    <div className="rounded-2xl border border-(--color-border-muted) bg-(--color-surface-page) p-8 shadow-sm">
                        <div className="mb-4 flex items-center gap-3">
                            <ClipboardList className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                            <h2 className="text-xl font-bold text-(--color-text-primary)">
                                {t("sections.informationWeCollect.title")}
                            </h2>
                        </div>
                        <p className="mb-4 text-sm text-(--color-text-secondary)">
                            {t("sections.informationWeCollect.description")}
                        </p>
                        <ul className="space-y-3">
                            <li className="flex items-start gap-3">
                                <span className="bg-emerald-450 mt-1 h-2 w-2 shrink-0 rounded-full"></span>
                                <span className="text-sm text-(--color-text-secondary)">
                                    {t("sections.informationWeCollect.items.barcodeScans")}
                                </span>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="bg-emerald-450 mt-1 h-2 w-2 shrink-0 rounded-full"></span>
                                <span className="text-sm text-(--color-text-secondary)">
                                    {t("sections.informationWeCollect.items.locationData")}
                                </span>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="bg-emerald-450 mt-1 h-2 w-2 shrink-0 rounded-full"></span>
                                <span className="text-sm text-(--color-text-secondary)">
                                    {t("sections.informationWeCollect.items.voiceInput")}
                                </span>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-red-400"></span>
                                <span className="text-sm text-(--color-text-secondary)">
                                    {t.rich("sections.informationWeCollect.items.noPersonalData", richText)}
                                </span>
                            </li>
                        </ul>
                    </div>

                    {/* Card 2 — How We Use Your Data */}
                    <div className="rounded-2xl border border-(--color-border-muted) bg-(--color-surface-page) p-8 shadow-sm">
                        <div className="mb-4 flex items-center gap-3">
                            <Search className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                            <h2 className="text-xl font-bold text-(--color-text-primary)">
                                {t("sections.howWeUseData.title")}
                            </h2>
                        </div>
                        <ul className="space-y-3">
                            <li className="flex items-start gap-3">
                                <span className="bg-emerald-450 mt-1 h-2 w-2 shrink-0 rounded-full"></span>
                                <span className="text-sm text-(--color-text-secondary)">
                                    {t("sections.howWeUseData.items.cdscoVerification")}
                                </span>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="bg-emerald-450 mt-1 h-2 w-2 shrink-0 rounded-full"></span>
                                <span className="text-sm text-(--color-text-secondary)">
                                    {t("sections.howWeUseData.items.anonymousReports")}
                                </span>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-red-400"></span>
                                <span className="text-sm text-(--color-text-secondary)">
                                    {t("sections.howWeUseData.items.noSharing")}
                                </span>
                            </li>
                        </ul>
                    </div>

                    {/* Card 3 — Cookies */}
                    <div className="rounded-2xl border border-(--color-border-muted) bg-(--color-surface-page) p-8 shadow-sm">
                        <div className="mb-4 flex items-center gap-3">
                            <Cookie className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                            <h2 className="text-xl font-bold text-(--color-text-primary)">
                                {t("sections.cookies.title")}
                            </h2>
                        </div>
                        <p className="text-sm text-(--color-text-secondary)">
                            {t.rich("sections.cookies.description", richText)}
                        </p>
                    </div>

                    {/* Card 4 — Third-Party Services */}
                    <div className="rounded-2xl border border-(--color-border-muted) bg-(--color-surface-page) p-8 shadow-sm">
                        <div className="mb-4 flex items-center gap-3">
                            <LinkIcon className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                            <h2 className="text-xl font-bold text-(--color-text-primary)">
                                {t("sections.thirdPartyServices.title")}
                            </h2>
                        </div>
                        <p className="mb-4 text-sm text-(--color-text-secondary)">
                            {t("sections.thirdPartyServices.description")}
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-xl bg-(--color-surface-muted) px-4 py-3 text-sm font-medium text-(--color-text-secondary)">
                                <Cloud className="mr-2 inline h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                {t("sections.thirdPartyServices.services.cloudinary")}
                            </div>
                            <div className="rounded-xl bg-(--color-surface-muted) px-4 py-3 text-sm font-medium text-(--color-text-secondary)">
                                <Database className="mr-2 inline h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                {t("sections.thirdPartyServices.services.supabase")}
                            </div>
                            <div className="rounded-xl bg-(--color-surface-muted) px-4 py-3 text-sm font-medium text-(--color-text-secondary)">
                                <Map className="mr-2 inline h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                {t("sections.thirdPartyServices.services.openStreetMap")}
                            </div>
                            <div className="rounded-xl bg-(--color-surface-muted) px-4 py-3 text-sm font-medium text-(--color-text-secondary)">
                                <Bot className="mr-2 inline h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                {t("sections.thirdPartyServices.services.sarvamAI")}
                            </div>
                        </div>
                    </div>

                    {/* Card 5 — Data Security */}
                    <div className="rounded-2xl border border-(--color-border-muted) bg-(--color-surface-page) p-8 shadow-sm">
                        <div className="mb-4 flex items-center gap-3">
                            <ShieldCheck className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                            <h2 className="text-xl font-bold text-(--color-text-primary)">
                                {t("sections.dataSecurity.title")}
                            </h2>
                        </div>
                        <p className="text-sm text-(--color-text-secondary)">
                            {t("sections.dataSecurity.description")}
                        </p>
                    </div>

                    {/* Card 6 — Children's Privacy */}
                    <div className="rounded-2xl border border-(--color-border-muted) bg-(--color-surface-page) p-8 shadow-sm">
                        <div className="mb-4 flex items-center gap-3">
                            <Users className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                            <h2 className="text-xl font-bold text-(--color-text-primary)">
                                {t("sections.childrensPrivacy.title")}
                            </h2>
                        </div>
                        <p className="text-sm text-(--color-text-secondary)">
                            {t("sections.childrensPrivacy.description")}
                        </p>
                    </div>

                    {/* Card 7 — Contact */}
                    <div className="rounded-2xl border border-emerald-100 bg-(--color-surface-page) p-8 shadow-sm dark:border-emerald-900/30">
                        <div className="mb-4 flex items-center gap-3">
                            <Mail className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                            <h2 className="text-xl font-bold text-(--color-text-primary)">
                                {t("sections.contactUs.title")}
                            </h2>
                        </div>
                        <p className="mb-3 text-sm text-(--color-text-secondary)">
                            {t("sections.contactUs.description")}
                        </p>
                        <a
                            href={`mailto:${CONTACT_EMAIL}`}
                            className="inline-block rounded-lg border border-emerald-200 dark:border-emerald-900/30 bg-emerald-50 dark:bg-emerald-950/20 px-4 py-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
                        >
                            {CONTACT_EMAIL}
                        </a>
                        <p className="mt-4 text-sm text-(--color-text-secondary)">
                            {t("sections.contactUs.discordText")} {" "}
                            <a
                                href="https://discord.gg/dvbDuJVwNa"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-emerald-600 underline hover:text-emerald-700 dark:text-emerald-400"
                            >
                                {t("sections.contactUs.discordLabel")}
                            </a>
                        </p>
                    </div>

                    {/* Card 8 — Changes to Policy */}
                    <div className="rounded-2xl border border-(--color-border-muted) bg-(--color-surface-page) p-8 shadow-sm">
                        <div className="mb-4 flex items-center gap-3">
                            <Calendar className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                            <h2 className="text-xl font-bold text-(--color-text-primary)">
                                {t("sections.changesToPolicy.title")}
                            </h2>
                        </div>
                        <p className="text-sm text-(--color-text-secondary)">
                            {t("sections.changesToPolicy.description")}
                        </p>
                    </div>

                </div>
            </section>

            {/* Bottom */}
            <section className="border-t border-(--color-border-muted) px-4 py-10 text-center">
                <p className="text-sm text-(--color-text-muted)">
                    {t("footer")}
                </p>
            </section>
        </main>
    );
}
