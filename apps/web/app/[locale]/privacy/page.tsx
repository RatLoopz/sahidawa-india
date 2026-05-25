import { Lock, Cookie, Star, ClipboardList, Search, Link as LinkIcon, Cloud, Database, Map, Bot, ShieldCheck, Users, Mail, Calendar } from "lucide-react";

export default function PrivacyPolicyPage() {
    return (
        <main className="min-h-screen bg-white">
            {/* Hero */}
            <section className="border-b border-gray-100 px-4 py-16 text-center">
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-4 py-1.5 text-sm font-medium text-green-700">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-green-500"></span>
                    GSSoC 2026 Open Source Project
                </div>
                <h1 className="mb-4 text-5xl font-extrabold text-gray-900">
                    Privacy <span className="text-green-500">Policy</span>
                </h1>
                <p className="mx-auto mb-8 max-w-xl text-lg text-gray-500">
                    We believe in transparency. Here is exactly what we collect, why we collect it,
                    and what we never do with it.
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                    <span className="rounded-full border border-gray-200 px-4 py-1.5 text-sm text-gray-600">
                        <Lock className="mr-2 inline h-4 w-4" /> No Data Sold. Ever.
                    </span>
                    <span className="rounded-full border border-gray-200 px-4 py-1.5 text-sm text-gray-600">
                        <Cookie className="mr-2 inline h-4 w-4" /> No Tracking Cookies
                    </span>
                    <span className="rounded-full border border-green-200 bg-green-50 px-4 py-1.5 text-sm text-green-700">
                        <Star className="mr-2 inline h-4 w-4" /> Open Source MIT License
                    </span>
                </div>
            </section>

            {/* Content */}
            <section className="bg-gray-50 px-4 py-16">
                <div className="mx-auto max-w-3xl space-y-6">
                    {/* Card 1 */}
                    <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
                        <div className="mb-4 flex items-center gap-3">
                            <ClipboardList className="h-6 w-6 text-green-500" />
                            <h2 className="text-xl font-bold text-gray-900">
                                1. Information We Collect
                            </h2>
                        </div>
                        <p className="mb-4 text-sm text-gray-500">
                            SahiDawa collects only what is absolutely necessary to verify medicines
                            and keep you safe.
                        </p>
                        <ul className="space-y-3">
                            <li className="flex items-start gap-3">
                                <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-green-400"></span>
                                <span className="text-sm text-gray-600">
                                    Medicine barcode or image scans — used only for verification
                                </span>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-green-400"></span>
                                <span className="text-sm text-gray-600">
                                    Location data — only if you use pharmacy finder, never stored
                                </span>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-green-400"></span>
                                <span className="text-sm text-gray-600">
                                    Voice input — processed locally, never uploaded without consent
                                </span>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-red-400"></span>
                                <span className="text-sm text-gray-600">
                                    We do <strong>not</strong> collect your name, phone number, or
                                    Aadhaar
                                </span>
                            </li>
                        </ul>
                    </div>

                    {/* Card 2 */}
                    <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
                        <div className="mb-4 flex items-center gap-3">
                            <Search className="h-6 w-6 text-green-500" />
                            <h2 className="text-xl font-bold text-gray-900">
                                2. How We Use Your Data
                            </h2>
                        </div>
                        <ul className="space-y-3">
                            <li className="flex items-start gap-3">
                                <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-green-400"></span>
                                <span className="text-sm text-gray-600">
                                    Medicine scans are verified against the CDSCO database only
                                </span>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-green-400"></span>
                                <span className="text-sm text-gray-600">
                                    Anonymous scan reports may build our counterfeit heatmap
                                </span>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-red-400"></span>
                                <span className="text-sm text-gray-600">
                                    No personal data is shared with advertisers or third parties
                                </span>
                            </li>
                        </ul>
                    </div>

                    {/* Card 3 */}
                    <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
                        <div className="mb-4 flex items-center gap-3">
                            <Cookie className="h-6 w-6 text-green-500" />
                            <h2 className="text-xl font-bold text-gray-900">3. Cookies</h2>
                        </div>
                        <p className="text-sm text-gray-600">
                            SahiDawa uses only <strong>essential cookies</strong> such as your
                            language preference. We do not use tracking, advertising, or analytics
                            cookies of any kind.
                        </p>
                    </div>

                    {/* Card 4 */}
                    <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
                        <div className="mb-4 flex items-center gap-3">
                            <LinkIcon className="h-6 w-6 text-green-500" />
                            <h2 className="text-xl font-bold text-gray-900">
                                4. Third-Party Services
                            </h2>
                        </div>
                        <p className="mb-4 text-sm text-gray-500">
                            We use the following trusted services, each with their own privacy
                            policy:
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm font-medium text-gray-600">
                                <Cloud className="mr-2 inline h-4 w-4" /> Cloudinary
                            </div>
                            <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm font-medium text-gray-600">
                                <Database className="mr-2 inline h-4 w-4" /> Supabase
                            </div>
                            <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm font-medium text-gray-600">
                                <Map className="mr-2 inline h-4 w-4" /> OpenStreetMap
                            </div>
                            <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm font-medium text-gray-600">
                                <Bot className="mr-2 inline h-4 w-4" /> Sarvam AI
                            </div>
                        </div>
                    </div>

                    {/* Card 5 */}
                    <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
                        <div className="mb-4 flex items-center gap-3">
                            <ShieldCheck className="h-6 w-6 text-green-500" />
                            <h2 className="text-xl font-bold text-gray-900">5. Data Security</h2>
                        </div>
                        <p className="text-sm text-gray-600">
                            SahiDawa is fully open source — our code is publicly auditable on
                            GitHub. We follow secure coding practices and never store sensitive
                            health data beyond what is needed for verification.
                        </p>
                    </div>

                    {/* Card 6 */}
                    <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
                        <div className="mb-4 flex items-center gap-3">
                            <Users className="h-6 w-6 text-green-500" />
                            <h2 className="text-xl font-bold text-gray-900">
                                6. Children&apos;s Privacy
                            </h2>
                        </div>
                        <p className="text-sm text-gray-600">
                            SahiDawa is built for all citizens of India, including families. We do
                            not knowingly collect personal data from children under 13.
                        </p>
                    </div>

                    {/* Card 7 — Contact */}
                    <div className="rounded-2xl border border-green-100 bg-white p-8 shadow-sm">
                        <div className="mb-4 flex items-center gap-3">
                            <Mail className="h-6 w-6 text-green-500" />
                            <h2 className="text-xl font-bold text-gray-900">7. Contact Us</h2>
                        </div>
                        <p className="mb-3 text-sm text-gray-600">
                            For privacy-related queries, reach us at:
                        </p>
                        <span className="inline-block rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm font-semibold text-green-700">
                            [ADMIN_EMAIL]
                        </span>
                        <p className="mt-4 text-sm text-gray-500">
                            Or join our community on{" "}
                            <a
                                href="https://discord.gg/dvbDuJVwNa"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-green-600 underline hover:text-green-700"
                            >
                                Discord
                            </a>
                        </p>
                    </div>

                    {/* Card 8 */}
                    <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
                        <div className="mb-4 flex items-center gap-3">
                            <Calendar className="h-6 w-6 text-green-500" />
                            <h2 className="text-xl font-bold text-gray-900">
                                8. Changes to This Policy
                            </h2>
                        </div>
                        <p className="text-sm text-gray-600">
                            We may update this policy as SahiDawa grows. Any changes will be posted
                            on this page with a revised date.
                        </p>
                    </div>
                </div>
            </section>

            {/* Bottom */}
            <section className="border-t border-gray-100 px-4 py-10 text-center">
                <p className="text-sm text-gray-400">
                    SahiDawa is free, open-source, and built for 1.4 billion Indians. No ads. No
                    premium. No data sold. Ever.
                </p>
            </section>
        </main>
    );
}
