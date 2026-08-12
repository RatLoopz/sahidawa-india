import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/env";
import { supabase } from "@/lib/supabase";
import { slugify } from "@/lib/slugify";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const locales = routing.locales;
    const baseUrl = getSiteUrl();

    const routes = [
        "",
        "/about",
        "/contact",
        "/faq",
        "/how-it-works",
        "/privacy",
        "/scan",
        "/map",
        "/voice",
        "/compare",
        "/vaccine-hub",
        "/expiry-tracker",
        "/health",
    ];

    let medicineSlugs: string[] = [];
    try {
        const { data } = await supabase.from("medicines").select("brand_name").limit(1000);
        if (data) {
            // Clean up name variants and make sure slugs are unique
            const uniqueSlugs = new Set(
                data
                    .map((med) => (med.brand_name ? slugify(med.brand_name) : ""))
                    .filter((slug) => slug !== "")
            );
            medicineSlugs = Array.from(uniqueSlugs);
        }
    } catch (e) {
        console.error("Failed to query medicines for sitemap generation:", e);
    }

    const sitemapEntries: MetadataRoute.Sitemap = [];

    locales.forEach((locale) => {
        // 1. Add static pages
        routes.forEach((route) => {
            const url =
                locale === routing.defaultLocale
                    ? `${baseUrl}${route || "/"}`
                    : `${baseUrl}/${locale}${route || ""}`;

            sitemapEntries.push({
                url,
                changeFrequency: "weekly",
                priority: route === "" ? 1 : 0.8,
                lastModified: new Date().toISOString(),
            });
        });

        // 2. Add dynamic medicine pages
        medicineSlugs.forEach((slug) => {
            const url =
                locale === routing.defaultLocale
                    ? `${baseUrl}/medicine/${slug}`
                    : `${baseUrl}/${locale}/medicine/${slug}`;

            sitemapEntries.push({
                url,
                changeFrequency: "weekly",
                priority: 0.7,
                lastModified: new Date().toISOString(),
            });
        });
    });

    return sitemapEntries;
}
