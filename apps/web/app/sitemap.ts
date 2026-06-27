import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/env";

export default function sitemap(): MetadataRoute.Sitemap {
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

    const sitemapEntries: MetadataRoute.Sitemap = [];

    locales.forEach((locale) => {
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
    });

    return sitemapEntries;
}
