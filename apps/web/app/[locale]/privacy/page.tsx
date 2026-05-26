import { Lock, Cookie, Star, ClipboardList, Search, Link as LinkIcon, Cloud, Database, Map, Bot, ShieldCheck, Users, Mail, Calendar } from "lucide-react";

export default function PrivacyPolicyPage() {
    return (
        <main className="min-h-screen bg-(--color-surface-page) text-(--color-text-primary)">
            {/* Hero */}
            <section className="border-b border-(--color-border-muted) px-4 py-16 text-center">
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 dark:border-emerald-900/30 dark:bg-emerald-950/20 px-4 py-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500"></span>
                    GSSoC 2026 Open Source Project
                </div>
                <h1 className="mb-4 text-5xl font-extrabold text-(--color-text-primary)">
                    Privacy <span className="text-emerald-600 dark:text-emerald-400">Policy</span>
                </h1>
                <p className="mx-auto mb-8 max-w-xl text-lg text-(--color-text-secondary)">
                    We believe in transparency. Here is exactly what we collect, why we collect it,
                    and what we never do with it.
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                    <span className="rounded-full border border-(--color-border-muted) px-4 py-1.5 text-sm text-(--color-text-secondary)">
                        <Lock className="mr-2 inline h-4 w-4 text-emerald-600 dark:text-emerald-450" /> No Data Sold. Ever.
                    </span>
                    <span className="rounded-full border border-(--color-border-muted) px-4 py-1.5 text-sm text-(--color-text-secondary)">
                        <Cookie className="mr-2 inline h-4 w-4 text-emerald-600 dark:text-emerald-450" /> No Tracking Cookies
                    </span>
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 dark:border-emerald-900/30 dark:bg-emerald-950/20 px-4 py-1.5 text-sm text-emerald-700 dark:text-emerald-400">
                        <Star className="mr-2 inline h-4 w-4" /> Open Source MIT License
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
                                1. Information We Collect
                            </h2>
                        </div>
                        <p className="mb-4 text-sm text-(--color-text-secondary)">
                            SahiDawa collects only what is absolutely necessary to verify medicines
                            and keep you safe.
                        </p>
                        <ul className="space-y-3">
                            <li className="flex items-start gap-3">
                                <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-emerald-450"></span>
                                <span className="text-sm text-(--color-text-secondary)">
                                    Medicine barcode or image scans — used only for verification
                                </span>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-emerald-450"></span>
                                <span className="text-sm text-(--color-text-secondary)">
                                    Location data — only if you use pharmacy finder, never stored
                                </span>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-emerald-450"></span>
                                <span className="text-sm text-(--color-text-secondary)">
                                    Voice input — processed locally, never uploaded without consent
                                </span>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-red-400"></span>
                                <span className="text-sm text-(--color-text-secondary)">
                                    We do <strong>not</strong> collect your name, phone number, or
                                    Aadhaar
                                </span>
                            </li>
                        </ul>
                    </div>

                    {/* Card 2 */}
                    <div className="rounded-2xl border border-(--color-border-muted) bg-(--color-surface-page) p-8 shadow-sm">
                        <div className="mb-4 flex items-center gap-3">
                            <Search className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                            <h2 className="text-xl font-bold text-(--color-text-primary)">
                                2. How We Use Your Data
                            </h2>
                        </div>
                        <ul className="space-y-3">
                            <li className="flex items-start gap-3">
                                <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-emerald-450"></span>
                                <span className="text-sm text-(--color-text-secondary)">
                                    Medicine scans are verified against the CDSCO database only
                                </span>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-emerald-450"></span>
                                <span className="text-sm text-(--color-text-secondary)">
                                    Anonymous scan reports may build our counterfeit heatmap
                                </span>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-red-400"></span>
                                <span className="text-sm text-(--color-text-secondary)">
                                    No personal data is shared with advertisers or third parties
                                </span>
                            </li>
                        </ul>
                    </div>

                    {/* Card 3 */}
                    <div className="rounded-2xl border border-(--color-border-muted) bg-(--color-surface-page) p-8 shadow-sm">
                        <div className="mb-4 flex items-center gap-3">
                            <Cookie className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                            <h2 className="text-xl font-bold text-(--color-text-primary)">3. Cookies</h2>
                        </div>
                        <p className="text-sm text-(--color-text-secondary)">
                            SahiDawa uses only <strong>essential cookies</strong> such as your
                            language preference. We do not use tracking, advertising, or analytics
                            cookies of any kind.
                        </p>
                    </div>

                    {/* Card 4 */}
                    <div className="rounded-2xl border border-(--color-border-muted) bg-(--color-surface-page) p-8 shadow-sm">
                        <div className="mb-4 flex items-center gap-3">
                            <LinkIcon className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                            <h2 className="text-xl font-bold text-(--color-text-primary)">
                                4. Third-Party Services
                            </h2>
                        </div>
                        <p className="mb-4 text-sm text-(--color-text-secondary)">
                            We use the following trusted services, each with their own privacy
                            policy:
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-xl bg-(--color-surface-muted) px-4 py-3 text-sm font-medium text-(--color-text-secondary)">
                                <Cloud className="mr-2 inline h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Cloudinary
                            </div>
                            <div className="rounded-xl bg-(--color-surface-muted) px-4 py-3 text-sm font-medium text-(--color-text-secondary)">
                                <Database className="mr-2 inline h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Supabase
                            </div>
                            <div className="rounded-xl bg-(--color-surface-muted) px-4 py-3 text-sm font-medium text-(--color-text-secondary)">
                                <Map className="mr-2 inline h-4 w-4 text-emerald-600 dark:text-emerald-400" /> OpenStreetMap
                            </div>
                            <div className="rounded-xl bg-(--color-surface-muted) px-4 py-3 text-sm font-medium text-(--color-text-secondary)">
                                <Bot className="mr-2 inline h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Sarvam AI
                            </div>
                        </div>
                    </div>

                    {/* Card 5 */}
                    <div className="rounded-2xl border border-(--color-border-muted) bg-(--color-surface-page) p-8 shadow-sm">
                        <div className="mb-4 flex items-center gap-3">
                            <ShieldCheck className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                            <h2 className="text-xl font-bold text-(--color-text-primary)">5. Data Security</h2>
                        </div>
                        <p className="text-sm text-(--color-text-secondary)">
                            SahiDawa is fully open source — our code is publicly auditable on
                            GitHub. We follow secure coding practices and never store sensitive
                            health data beyond what is needed for verification.
                        </p>
                    </div>

                    {/* Card 6 */}
                    <div className="rounded-2xl border border-(--color-border-muted) bg-(--color-surface-page) p-8 shadow-sm">
                        <div className="mb-4 flex items-center gap-3">
                            <Users className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                            <h2 className="text-xl font-bold text-(--color-text-primary)">
                                6. Children&apos;s Privacy
                            </h2>
                        </div>
                        <p className="text-sm text-(--color-text-secondary)">
                            SahiDawa is built for all citizens of India, including families. We do
                            not knowingly collect personal data from children under 13.
                        </p>
                    </div>

                    {/* Card 7 — Contact */}
                    <div className="rounded-2xl border border-emerald-100 dark:border-emerald-900/30 bg-(--color-surface-page) p-8 shadow-sm">
                        <div className="mb-4 flex items-center gap-3">
                            <Mail className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                            <h2 className="text-xl font-bold text-(--color-text-primary)">7. Contact Us</h2>
                        </div>
                        <p className="mb-3 text-sm text-(--color-text-secondary)">
                            For privacy-related queries, reach us at:
                        </p>
                        <span className="inline-block rounded-lg border border-emerald-200 dark:border-emerald-900/30 bg-emerald-50 dark:bg-emerald-950/20 px-4 py-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                            [ADMIN_EMAIL]
                        </span>
                        <p className="mt-4 text-sm text-(--color-text-secondary)">
                            Or join our community on{" "}
                            <a
                                href="https://discord.gg/dvbDuJVwNa"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-emerald-600 dark:text-emerald-400 underline hover:text-emerald-700"
                            >
                                Discord
                            </a>
                        </p>
                    </div>

                    {/* Card 8 */}
                    <div className="rounded-2xl border border-(--color-border-muted) bg-(--color-surface-page) p-8 shadow-sm">
                        <div className="mb-4 flex items-center gap-3">
                            <Calendar className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                            <h2 className="text-xl font-bold text-(--color-text-primary)">
                                8. Changes to This Policy
                            </h2>
                        </div>
                        <p className="text-sm text-(--color-text-secondary)">
                            We may update this policy as SahiDawa grows. Any changes will be posted
                            on this page with a revised date.
                        </p>
                    </div>
                </div>
            </section>

            {/* Bottom */}
            <section className="border-t border-(--color-border-muted) px-4 py-10 text-center">
                <p className="text-sm text-(--color-text-muted)">
                    SahiDawa is free, open-source, and built for 1.4 billion Indians. No ads. No
                    premium. No data sold. Ever.
                </p>
            </section>
        </main>
    );
}
