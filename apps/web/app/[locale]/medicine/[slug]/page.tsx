import React from "react";
import type { Metadata } from "next";
import { Link } from "@/i18n/routing";
import {
    ArrowLeft,
    Pill,
    ArrowRight,
    ShieldCheck,
    MapPin,
    BadgePercent,
    Info,
    Search,
} from "lucide-react";
import { fetchGenericAlternatives } from "@/lib/api/alternatives";
import { deslugify, slugify } from "@/lib/slugify";
import DrugStructuredData from "@/components/seo/DrugStructuredData";
import { getSiteUrl } from "@/lib/env";

interface Props {
    params: Promise<{ locale: string; slug: string }>;
}

// Generate dynamic meta tags for the search engines
export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { locale, slug } = await params;
    const searchString = deslugify(slug);
    const baseUrl = getSiteUrl();

    try {
        const data = await fetchGenericAlternatives(searchString);
        if (!data) {
            return {
                title: `Medicine Alternatives Not Found | SahiDawa`,
                description: "Find cheaper, verified generic equivalent medicines in India.",
            };
        }

        const formattedBrand = data.brand_name;
        const formattedGeneric = data.generic_name;

        return {
            title: `Cheaper Generic Alternative to ${formattedBrand} (${formattedGeneric}) | SahiDawa`,
            description: `Save ${data.savings_percentage}% on ${formattedBrand} by swapping to Jan Aushadhi generic alternatives. Compare MRP (₹${data.brand_price.toFixed(2)}) vs Generic (₹${data.jan_aushadhi_price.toFixed(2)}), composition & local stores.`,
            alternates: {
                canonical: `${baseUrl}/${locale}/medicine/${slugify(formattedBrand)}`,
            },
            openGraph: {
                title: `Save ${data.savings_percentage}% on ${formattedBrand} | SahiDawa`,
                description: `Find verified generic alternatives for ${formattedBrand}. Compare prices, check chemical composition, and locate nearby stores.`,
                type: "website",
            },
        };
    } catch {
        return {
            title: `${searchString} Alternatives & Price Check | SahiDawa`,
            description: `Check generic alternatives and price details for ${searchString}.`,
        };
    }
}

export async function generateStaticParams() {
    try {
        const { supabase } = await import("@/lib/supabase");
        // Fetch a list of top popular medicines for static generation at build time
        const { data } = await supabase.from("generic_alternatives").select("brand_name").limit(50);

        if (!data || data.length === 0) {
            return [];
        }

        const { routing } = await import("@/i18n/routing");
        const locales = routing.locales;

        const params: { locale: string; slug: string }[] = [];
        for (const row of data) {
            if (row.brand_name) {
                const slug = slugify(row.brand_name);
                for (const locale of locales) {
                    params.push({ locale, slug });
                }
            }
        }

        return params;
    } catch (e) {
        console.error("Failed to generate static params for medicine pages:", e);
        return [];
    }
}

export default async function MedicinePage({ params }: Props) {
    const { locale, slug } = await params;
    const searchString = deslugify(slug);
    const baseUrl = getSiteUrl();
    const pageUrl = `${baseUrl}/${locale}/medicine/${slug}`;

    let data = null;
    try {
        data = await fetchGenericAlternatives(searchString);
    } catch (error) {
        console.error("Failed to load alternatives for SEO page:", error);
    }

    if (!data) {
        // Return a beautifully styled "Medicine Not Found" page so crawlers index it as clean content or suggest search
        return (
            <div className="container mx-auto max-w-xl px-4 py-24 text-center">
                <div className="mb-6 flex justify-center">
                    <div className="rounded-full bg-slate-100 p-6 text-slate-400 dark:bg-slate-900">
                        <Pill className="h-16 w-16 animate-bounce" />
                    </div>
                </div>
                <h1 className="mb-3 text-3xl font-black text-(--color-text-primary)">
                    Medicine Not Mapped
                </h1>
                <p className="mb-8 text-(--color-text-secondary)">
                    We couldn't find a direct Jan Aushadhi generic alternative for "
                    <strong>{searchString}</strong>" in our database yet.
                </p>
                <div className="space-y-4">
                    <Link href="/">
                        <button className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-4 font-bold text-white shadow-lg transition hover:scale-105 hover:bg-emerald-700">
                            <Search className="h-5 w-5" /> Search Another Medicine
                        </button>
                    </Link>
                </div>
            </div>
        );
    }

    const {
        brand_name,
        generic_name,
        brand_price,
        jan_aushadhi_price,
        savings_percentage,
        alternative_name,
        nearest_store,
        usage,
    } = data;

    return (
        <div className="min-h-screen bg-slate-50/50 py-12 font-sans dark:bg-slate-950/20">
            {/* Structured Schema for Search Crawlers */}
            <DrugStructuredData
                brandName={brand_name}
                genericName={generic_name}
                mrp={brand_price}
                janAushadhiPrice={jan_aushadhi_price}
                url={pageUrl}
                description={`Find generic alternatives for ${brand_name}. Save ${savings_percentage}% on your monthly healthcare bills.`}
            />

            <div className="container mx-auto max-w-4xl px-4">
                {/* Back Link */}
                <div className="mb-8">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 transition hover:text-emerald-700 dark:text-emerald-400"
                    >
                        <ArrowLeft className="h-4 w-4" /> Back to Home
                    </Link>
                </div>

                {/* Hero / Main Info Header */}
                <div className="mb-10 overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8 dark:border-slate-800 dark:bg-slate-900/60">
                    <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-2">
                            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
                                <ShieldCheck className="h-3.5 w-3.5" /> Checked & Verified
                                Substituted Salt
                            </div>
                            <h1 className="text-3xl font-black text-slate-800 md:text-4xl dark:text-white">
                                {brand_name} Generic Alternative
                            </h1>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                                Chemical Composition:{" "}
                                <strong className="font-bold text-slate-800 dark:text-slate-200">
                                    {generic_name}
                                </strong>
                            </p>
                        </div>

                        {/* Large Saving Badge */}
                        <div className="flex shrink-0 items-center gap-3 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 p-5 text-white shadow-md">
                            <BadgePercent className="h-10 w-10 shrink-0" />
                            <div>
                                <div className="text-2xl font-black">{savings_percentage}%</div>
                                <div className="text-xs font-semibold opacity-90">
                                    Total Cost Saved
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Comparison Grid */}
                <div className="mb-10 grid grid-cols-1 gap-6 md:grid-cols-2">
                    {/* Branded Medicine Card */}
                    <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900/60">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-lg font-bold text-slate-800 dark:text-white">
                                Prescribed Brand
                            </h2>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                Brand Name
                            </span>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <h3 className="text-2xl font-black text-slate-800 dark:text-white">
                                    {brand_name}
                                </h3>
                                <p className="text-xs font-medium text-slate-400">
                                    Market Price (MRP)
                                </p>
                            </div>
                            <div className="text-3xl font-black text-slate-700 dark:text-slate-300">
                                ₹{brand_price.toFixed(2)}
                            </div>
                            <div className="text-xs text-slate-400">
                                Typical pricing across commercial chemist shops.
                            </div>
                        </div>
                    </div>

                    {/* Jan Aushadhi Alternative Card */}
                    <div className="relative overflow-hidden rounded-3xl border-2 border-emerald-500 bg-gradient-to-br from-emerald-50/50 to-teal-50/50 p-6 shadow-md transition hover:shadow-lg dark:from-emerald-950/20 dark:to-teal-950/20">
                        <div className="absolute top-0 right-0 rounded-bl-2xl bg-emerald-500 px-3 py-1 text-xs font-bold text-white">
                            BEST VALUE
                        </div>
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-lg font-bold text-emerald-800 dark:text-emerald-300">
                                Subsidized Swap
                            </h2>
                            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                Generic salt
                            </span>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <h3 className="text-2xl font-black text-slate-800 dark:text-white">
                                    {alternative_name}
                                </h3>
                                <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                    Jan Aushadhi Price
                                </p>
                            </div>
                            <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                                ₹{jan_aushadhi_price.toFixed(2)}
                            </div>
                            <div className="text-xs font-medium text-emerald-700/80 dark:text-emerald-300/80">
                                Identical chemical formula. Priced lower by Govt of India
                                regulation.
                            </div>
                        </div>
                    </div>
                </div>

                {/* Salt Usage & Composition Details */}
                <div className="mb-10 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8 dark:border-slate-800 dark:bg-slate-900/60">
                    <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-slate-800 dark:text-white">
                        <Info className="h-5 w-5 text-emerald-600" /> Usage & Description
                    </h2>
                    <div className="space-y-4 text-sm leading-relaxed font-medium text-slate-600 dark:text-slate-300">
                        <p>
                            The active salt in <strong>{brand_name}</strong> is{" "}
                            <strong>{generic_name}</strong>. Generic substitutes like{" "}
                            <strong>{alternative_name}</strong> contain the exact same chemical
                            formulation and active salts, meaning they produce identical therapeutic
                            results.
                        </p>
                        <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/40">
                            <h4 className="mb-1 font-bold text-slate-800 dark:text-white">
                                Indication & Medical Usage:
                            </h4>
                            <p className="text-xs">{usage}</p>
                        </div>
                    </div>
                </div>

                {/* Nearest Jan Aushadhi Store Locator */}
                {nearest_store && (
                    <div className="mb-10 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8 dark:border-slate-800 dark:bg-slate-900/60">
                        <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-slate-800 dark:text-white">
                            <MapPin className="h-5 w-5 text-emerald-600" /> Nearest Verified Store
                        </h2>
                        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-white">
                                    {nearest_store.name}
                                </h3>
                                <p className="text-xs text-slate-400">
                                    Estimated Distance: {nearest_store.distance}
                                </p>
                            </div>
                            <Link href="/map">
                                <button className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700/80">
                                    Open Store Map <ArrowRight className="h-3 w-3" />
                                </button>
                            </Link>
                        </div>
                    </div>
                )}

                {/* Safety / Scan CTA */}
                <div className="rounded-3xl bg-emerald-600 p-8 text-center text-white shadow-lg md:p-10">
                    <h2 className="mb-2 text-2xl font-black">
                        Is your medicine packet real or fake?
                    </h2>
                    <p className="mx-auto mb-6 max-w-md text-sm font-medium text-emerald-100">
                        Counterfeit medicines are a serious risk. Verify your medicine batch now
                        using our free scanner tool.
                    </p>
                    <Link href="/scan">
                        <button className="inline-flex items-center gap-2 rounded-2xl bg-white px-8 py-3.5 text-sm font-bold text-emerald-600 shadow-md transition hover:scale-105 hover:shadow-lg dark:bg-slate-950 dark:text-emerald-400">
                            Launch SahiDawa Scanner
                        </button>
                    </Link>
                </div>
            </div>
        </div>
    );
}
