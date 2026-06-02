"use client";

import React, { useEffect, useState } from "react";
import {
    Camera,
    Mic,
    MapPin,
    ShieldCheck,
    AlertTriangle,
    Globe,
    ChevronRight,
    Activity,
    MessageCircle,
    Syringe,
    ArrowRight,
} from "lucide-react";

import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import SearchBar from "./components/SearchBar";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import SafetyStatsBanner from "@/components/SafetyStatsBanner";

function formatRelativeTime(dateString: string | null): string {
    if (!dateString) return "Recent";

    const now = new Date();
    const past = new Date(dateString);
    const msPerMinute = 60 * 1000;
    const msPerHour = msPerMinute * 60;
    const msPerDay = msPerHour * 24;

    const elapsed = now.getTime() - past.getTime();

    if (elapsed < msPerMinute) {
        return "Just now";
    } else if (elapsed < msPerHour) {
        return `${Math.round(elapsed / msPerMinute)}m ago`;
    } else if (elapsed < msPerDay) {
        return `${Math.round(elapsed / msPerHour)}h ago`;
    } else {
        return past.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    }
}

export default function SahiDawaHome() {
    const router = useRouter();
    const params = useParams();
    const locale = Array.isArray(params.locale) ? params.locale[0] : params.locale;
    const tHome = useTranslations("Home");

    const [homepageAlerts, setHomepageAlerts] = useState<any[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        async function fetchAlerts() {
            try {
                const { data } = await supabase
                    .from("medicines")
                    .select("*")
                    .or(
                        "is_counterfeit_alert.eq.true,cdsco_approval_status.eq.recalled,cdsco_approval_status.eq.banned, brand_name.eq.SYSTEM_UPDATE"
                    )
                    .order("created_at", { ascending: false })
                    .limit(4);

                if (data) {
                    setHomepageAlerts(data);
                }
            } catch (err) {
                console.error("Failed to query alerts matrix:", err);
            } finally {
                setLoading(false);
            }
        }

        fetchAlerts();
    }, []);

    const handleNavigation = (path: string) => {
        router.push(`/${locale}/${path}`);
    };

    return (
        <div className="relative min-h-screen bg-(--color-surface-page) font-sans text-(--color-text-primary) transition-colors duration-300">
            {/* ── Background Mesh (Static & High Performance) ── */}
            <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none">
                <div className="absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full bg-purple-500/10 blur-[130px] dark:bg-purple-900/10"></div>
                <div className="absolute -top-40 -right-40 h-[600px] w-[600px] rounded-full bg-emerald-500/10 blur-[130px] dark:bg-emerald-900/10"></div>
                <div className="absolute bottom-10 left-1/4 h-[600px] w-[600px] rounded-full bg-blue-500/10 blur-[130px] dark:bg-blue-900/10"></div>
            </div>

            {/* ── Main ── */}
            <main className="pb-24 md:pb-12">
                {/* ── Sleek Integrated Console Header ── */}
                <section className="relative z-10 mx-auto max-w-4xl space-y-6 px-4 pt-10 pb-6 text-center">
                    {/* Badge */}
                    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 text-[10px] font-extrabold tracking-widest text-emerald-600 uppercase dark:border-emerald-400/20 dark:text-emerald-400">
                        <span className="relative flex h-1.5 w-1.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                        </span>
                        GSSoC 2026 Open Source Project
                    </div>

                    {/* Split-color title */}
                    <h1 className="text-4xl leading-tight font-black tracking-tight text-slate-900 sm:text-5xl md:text-6xl dark:text-white">
                        {tHome("heroTitle.prefix")}
                        <span className="ml-1 block bg-linear-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent sm:inline dark:from-emerald-400 dark:to-teal-400">
                            {tHome("heroTitle.highlight")}
                        </span>
                    </h1>

                    {/* Subtitle */}
                    <p className="mx-auto max-w-2xl text-sm leading-relaxed font-semibold text-slate-500 md:text-base dark:text-slate-400">
                        {tHome("subtitle")}
                    </p>
                    {/*Safety Stats Banner*/}
                    <SafetyStatsBanner />

                    {/* Search Bar */}
                    <div className="mx-auto w-full max-w-2xl pt-2">
                        <SearchBar />
                    </div>
                </section>

                <div className="container mx-auto max-w-6xl px-4">
                    {/* ── Primary Action: Scan Medicine ── */}
                    <section className="mt-4 mb-10">
                        <button
                            onClick={() => handleNavigation("scan")}
                            className="group relative flex w-full transform-gpu cursor-pointer flex-col justify-center overflow-hidden rounded-3xl border border-emerald-400/30 p-8 text-left text-white shadow-xl shadow-emerald-500/10 transition-all duration-300 select-none hover:scale-[1.01] hover:shadow-emerald-500/20 active:scale-[0.99] md:p-10"
                            aria-label="Scan medicine"
                        >
                            <div className="absolute inset-0 z-0 bg-linear-to-tr from-emerald-700 via-emerald-600 to-emerald-500"></div>
                            <div className="absolute -top-10 -right-10 h-64 w-64 rounded-full bg-white/10 blur-2xl"></div>
                            <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
                                <div className="flex items-center gap-6 md:gap-8">
                                    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-white/15 shadow-sm transition-all duration-300 group-hover:scale-105 group-hover:rotate-2 md:h-24 md:w-24">
                                        <Camera
                                            className="h-10 w-10 text-white drop-shadow-md md:h-12 md:w-12"
                                            strokeWidth={2}
                                        />
                                    </div>
                                    <div>
                                        <span className="block text-3xl font-bold tracking-wide drop-shadow-sm md:text-4xl">
                                            {tHome("scan_button")}
                                        </span>
                                        <span className="mt-2 block text-sm font-medium text-emerald-100 opacity-90 md:text-lg">
                                            {tHome("scan_subtitle")}
                                        </span>
                                    </div>
                                </div>
                                <ChevronRight
                                    size={36}
                                    className="hidden shrink-0 text-emerald-100 opacity-70 transition-all group-hover:translate-x-2 group-hover:opacity-100 md:block"
                                />
                            </div>
                        </button>
                    </section>

                    {/* ── Vaccine Hub & Tracker ── */}
                    <section className="mb-6">
                        <h2 className="sr-only">Featured Services</h2>
                        <Link
                            href="/vaccine-hub"
                            className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-md focus-visible:-translate-y-1 focus-visible:scale-[1.01] focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white focus-visible:outline-none dark:border-slate-800/50 dark:bg-slate-900/55 dark:hover:border-emerald-400/30 dark:hover:shadow-emerald-400/5 dark:focus-visible:ring-offset-slate-900"
                        >
                            <div>
                                {/* Icon Container */}
                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 transition-colors group-hover:bg-emerald-600 group-hover:text-white">
                                    <Syringe size={24} />
                                </div>

                                {/* Text Context */}
                                <h3 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">
                                    Vaccine Hub & Tracker
                                </h3>
                                <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                                    Check customized national immunization schedules, view critical
                                    side effects, and track milestone execution timelines.
                                </p>
                            </div>

                            {/* Action Footer Indicator */}
                            <div className="mt-6 flex items-center gap-1.5 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                                <span>Open Tracker</span>
                                <ArrowRight
                                    size={16}
                                    className="transition-transform group-hover:translate-x-1"
                                    aria-hidden="true"
                                />
                            </div>
                        </Link>
                    </section>

                    {/* ── Explore Features Section ── */}
                    <section className="relative mb-20">
                        {/* Decorative Background for Section */}
                        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-500/10 via-transparent to-transparent opacity-50 dark:from-emerald-900/20"></div>

                        <div className="mb-12 flex flex-col items-center justify-center space-y-4">
                            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/50 bg-white/50 px-4 py-2 text-sm font-bold shadow-sm backdrop-blur-md dark:border-slate-800/50 dark:bg-slate-900/50">
                                <span className="flex h-2 w-2 animate-pulse rounded-full bg-emerald-500"></span>
                                <span className="text-slate-700 dark:text-slate-300">
                                    Powerful Capabilities
                                </span>
                            </div>
                            <h2 className="bg-linear-to-r from-slate-900 via-slate-700 to-slate-900 bg-clip-text text-center text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl dark:from-white dark:via-slate-200 dark:to-slate-400">
                                Explore Features
                            </h2>
                            <p className="max-w-2xl text-center font-medium text-slate-500 dark:text-slate-400">
                                Discover all the ways SahiDawa can help you verify your medicines
                                and stay safe.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                            {/* Upload Photo */}
                            <button
                                onClick={() => handleNavigation("scan")}
                                className="group relative flex h-[220px] w-full transform-gpu cursor-pointer flex-col justify-between overflow-hidden rounded-[2rem] border border-slate-200/50 bg-white/60 p-6 text-left shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl transition-all duration-500 select-none hover:-translate-y-2 hover:scale-[1.02] hover:border-emerald-400/50 hover:bg-white/90 hover:shadow-[0_20px_40px_-15px_rgba(16,185,129,0.3)] focus-visible:-translate-y-2 focus-visible:scale-[1.02] focus-visible:border-emerald-400/50 focus-visible:ring-emerald-500/50 focus-visible:outline-none active:scale-[0.98] dark:border-slate-800/60 dark:bg-slate-900/40 dark:hover:border-emerald-500/50 dark:hover:bg-slate-800/80"
                                aria-label="Upload photo"
                            >
                                <div className="absolute inset-0 -z-10 bg-linear-to-br from-emerald-500/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100 dark:from-emerald-500/20"></div>

                                <div className="relative z-10 flex items-start justify-between gap-4">
                                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-emerald-100 to-emerald-50 text-emerald-600 shadow-inner transition-all duration-500 group-hover:scale-110 group-hover:rotate-6 group-hover:from-emerald-500 group-hover:to-teal-400 group-hover:text-white group-hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] dark:from-emerald-950/60 dark:to-emerald-900/40 dark:text-emerald-400">
                                        <Camera
                                            size={26}
                                            strokeWidth={2.5}
                                            className="transition-transform duration-500"
                                        />
                                    </div>
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100/50 opacity-0 backdrop-blur-md transition-all duration-300 group-hover:opacity-100 dark:bg-slate-800/50">
                                        <ChevronRight
                                            className="h-5 w-5 text-emerald-600 dark:text-emerald-400"
                                            aria-hidden="true"
                                        />
                                    </div>
                                </div>

                                <div className="relative z-10 pt-4">
                                    <h3 className="text-xl font-bold tracking-tight text-slate-900 transition-colors group-hover:text-emerald-700 dark:text-white dark:group-hover:text-emerald-300">
                                        {tHome("upload_photo")}
                                    </h3>
                                    <p className="mt-2 text-sm leading-snug font-medium text-slate-500 transition-colors group-hover:text-slate-600 dark:text-slate-400 dark:group-hover:text-slate-300">
                                        {tHome("upload_subtitle")}
                                    </p>
                                </div>
                            </button>

                            {/* Voice Triage */}
                            <button
                                onClick={() => handleNavigation("voice")}
                                className="group relative flex h-[220px] w-full transform-gpu cursor-pointer flex-col justify-between overflow-hidden rounded-[2rem] border border-slate-200/50 bg-white/60 p-6 text-left shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl transition-all duration-500 select-none hover:-translate-y-2 hover:scale-[1.02] hover:border-blue-400/50 hover:bg-white/90 hover:shadow-[0_20px_40px_-15px_rgba(59,130,246,0.3)] focus-visible:-translate-y-2 focus-visible:scale-[1.02] focus-visible:border-blue-400/50 focus-visible:ring-blue-500/50 focus-visible:outline-none active:scale-[0.98] dark:border-slate-800/60 dark:bg-slate-900/40 dark:hover:border-blue-500/50 dark:hover:bg-slate-800/80"
                                aria-label="Voice triage"
                            >
                                <div className="absolute inset-0 -z-10 bg-linear-to-br from-blue-500/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100 dark:from-blue-500/20"></div>

                                <div className="absolute right-6 bottom-8 flex h-10 items-end gap-1.5 opacity-30 transition-opacity duration-300 group-hover:opacity-100">
                                    <div className="h-4 w-1.5 animate-pulse rounded-full bg-blue-400/60 transition-all duration-300 group-hover:h-8 group-hover:bg-blue-500"></div>
                                    <div className="h-6 w-1.5 animate-pulse rounded-full bg-blue-400/60 transition-all duration-300 [animation-delay:0.2s] group-hover:h-6 group-hover:bg-blue-500"></div>
                                    <div className="h-3 w-1.5 animate-pulse rounded-full bg-blue-400/60 transition-all duration-300 [animation-delay:0.4s] group-hover:h-10 group-hover:bg-blue-500"></div>
                                    <div className="h-7 w-1.5 animate-pulse rounded-full bg-blue-400/60 transition-all duration-300 [animation-delay:0.1s] group-hover:h-5 group-hover:bg-blue-500"></div>
                                </div>

                                <div className="relative z-10 flex items-start justify-between gap-4">
                                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-blue-100 to-blue-50 text-blue-600 shadow-inner transition-all duration-500 group-hover:scale-110 group-hover:-rotate-6 group-hover:from-blue-500 group-hover:to-cyan-400 group-hover:text-white group-hover:shadow-[0_0_20px_rgba(59,130,246,0.4)] dark:from-blue-950/60 dark:to-blue-900/40 dark:text-blue-400">
                                        <Mic
                                            size={26}
                                            strokeWidth={2.5}
                                            className="transition-transform duration-500"
                                        />
                                    </div>
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100/50 opacity-0 backdrop-blur-md transition-all duration-300 group-hover:opacity-100 dark:bg-slate-800/50">
                                        <ChevronRight
                                            className="h-5 w-5 text-blue-600 dark:text-blue-400"
                                            aria-hidden="true"
                                        />
                                    </div>
                                </div>

                                <div className="relative z-10 pt-4">
                                    <h3 className="text-xl font-bold tracking-tight text-slate-900 transition-colors group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-300">
                                        {tHome("voice_triage")}
                                    </h3>
                                    <p className="mt-2 text-sm leading-snug font-medium text-slate-500 transition-colors group-hover:text-slate-600 dark:text-slate-400 dark:group-hover:text-slate-300">
                                        {tHome("voice_subtitle")}
                                    </p>
                                </div>
                            </button>

                            {/* Pharmacy Map */}
                            <button
                                onClick={() => handleNavigation("map")}
                                className="group relative flex h-[220px] w-full transform-gpu cursor-pointer flex-col justify-between overflow-hidden rounded-[2rem] border border-slate-200/50 bg-white/60 p-6 text-left shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl transition-all duration-500 select-none hover:-translate-y-2 hover:scale-[1.02] hover:border-amber-400/50 hover:bg-white/90 hover:shadow-[0_20px_40px_-15px_rgba(245,158,11,0.3)] focus-visible:-translate-y-2 focus-visible:scale-[1.02] focus-visible:border-amber-400/50 focus-visible:ring-amber-500/50 focus-visible:outline-none active:scale-[0.98] dark:border-slate-800/60 dark:bg-slate-900/40 dark:hover:border-amber-500/50 dark:hover:bg-slate-800/80"
                                aria-label="Pharmacy map"
                            >
                                <div className="absolute inset-0 -z-10 bg-linear-to-br from-amber-500/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100 dark:from-amber-500/20"></div>

                                <svg
                                    className="absolute right-0 bottom-0 h-24 w-24 translate-x-4 translate-y-4 text-amber-500/5 transition-all duration-700 group-hover:-translate-x-2 group-hover:-translate-y-2 group-hover:scale-125 group-hover:rotate-45 group-hover:text-amber-500/20 dark:text-amber-400/5"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={0.5}
                                >
                                    <circle cx="12" cy="12" r="9" />
                                    <circle cx="12" cy="12" r="5" />
                                </svg>

                                <div className="relative z-10 flex items-start justify-between gap-4">
                                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-amber-100 to-amber-50 text-amber-600 shadow-inner transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 group-hover:from-amber-500 group-hover:to-orange-400 group-hover:text-white group-hover:shadow-[0_0_20px_rgba(245,158,11,0.4)] dark:from-amber-950/60 dark:to-amber-900/40 dark:text-amber-400">
                                        <MapPin
                                            size={26}
                                            strokeWidth={2.5}
                                            className="transition-transform duration-500 group-hover:-translate-y-1"
                                        />
                                    </div>
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100/50 opacity-0 backdrop-blur-md transition-all duration-300 group-hover:opacity-100 dark:bg-slate-800/50">
                                        <ChevronRight
                                            className="h-5 w-5 text-amber-600 dark:text-amber-400"
                                            aria-hidden="true"
                                        />
                                    </div>
                                </div>

                                <div className="relative z-10 pt-4">
                                    <h3 className="text-xl font-bold tracking-tight text-slate-900 transition-colors group-hover:text-amber-700 dark:text-white dark:group-hover:text-amber-300">
                                        {tHome("pharmacy_map")}
                                    </h3>
                                    <p className="mt-2 text-sm leading-snug font-medium text-slate-500 transition-colors group-hover:text-slate-600 dark:text-slate-400 dark:group-hover:text-slate-300">
                                        {tHome("pharmacy_subtitle")}
                                    </p>
                                </div>
                            </button>

                            {/* Report Fake Medicine */}
                            <button
                                onClick={() => handleNavigation("report")}
                                className="group relative flex h-[220px] w-full transform-gpu cursor-pointer flex-col justify-between overflow-hidden rounded-[2rem] border border-slate-200/50 bg-white/60 p-6 text-left shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl transition-all duration-500 select-none hover:-translate-y-2 hover:scale-[1.02] hover:border-red-400/50 hover:bg-white/90 hover:shadow-[0_20px_40px_-15px_rgba(239,68,68,0.3)] focus-visible:-translate-y-2 focus-visible:scale-[1.02] focus-visible:border-red-400/50 focus-visible:ring-red-500/50 focus-visible:outline-none active:scale-[0.98] dark:border-slate-800/60 dark:bg-slate-900/40 dark:hover:border-red-500/50 dark:hover:bg-slate-800/80"
                                aria-label="Report fake medicine"
                            >
                                <div className="absolute inset-0 -z-10 bg-linear-to-br from-red-500/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100 dark:from-red-500/20"></div>

                                <div className="absolute right-0 bottom-0 h-24 w-24 translate-x-8 translate-y-8 rounded-full bg-red-500/5 blur-2xl transition-all duration-500 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:bg-red-500/20"></div>

                                <div className="relative z-10 flex items-start justify-between gap-4">
                                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-red-100 to-red-50 text-red-600 shadow-inner transition-all duration-500 group-hover:scale-110 group-hover:rotate-12 group-hover:from-red-500 group-hover:to-rose-400 group-hover:text-white group-hover:shadow-[0_0_20px_rgba(239,68,68,0.4)] dark:from-red-950/60 dark:to-red-900/40 dark:text-red-400">
                                        <AlertTriangle
                                            size={26}
                                            strokeWidth={2.5}
                                            className="transition-transform duration-500"
                                        />
                                    </div>
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100/50 opacity-0 backdrop-blur-md transition-all duration-300 group-hover:opacity-100 dark:bg-slate-800/50">
                                        <ChevronRight
                                            className="h-5 w-5 text-red-600 dark:text-red-400"
                                            aria-hidden="true"
                                        />
                                    </div>
                                </div>

                                <div className="relative z-10 pt-4">
                                    <h3 className="text-xl font-bold tracking-tight text-slate-900 transition-colors group-hover:text-red-700 dark:text-white dark:group-hover:text-red-300">
                                        {tHome("report_fake")}
                                    </h3>
                                    <p className="mt-2 text-sm leading-snug font-medium text-slate-500 transition-colors group-hover:text-slate-600 dark:text-slate-400 dark:group-hover:text-slate-300">
                                        {tHome("report_fake_subtitle")}
                                    </p>
                                </div>
                            </button>
                        </div>
                    </section>

                    {/* ── Health Assistant CTA Banner ── */}
                    <div
                        className="group relative mt-4 transform-gpu overflow-hidden rounded-3xl transition-all duration-300 select-none hover:scale-[1.01] hover:shadow-xl hover:shadow-purple-500/10"
                        style={{
                            background:
                                "linear-gradient(135deg, #6d5ce7 0%, #7c3aed 50%, #5b21b6 100%)",
                        }}
                    >
                        {/* Subtle inner highlight */}
                        <div className="pointer-events-none absolute inset-0 bg-linear-to-r from-white/10 to-transparent" />

                        <div className="relative z-10 flex flex-col items-start gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-8">
                            <div className="flex items-center gap-4">
                                {/* Icon */}
                                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm transition-all duration-300 group-hover:scale-105 group-hover:bg-white/25">
                                    <MessageCircle size={26} className="text-white" />
                                </div>
                                <div className="space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h3 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">
                                            {tHome("ai_health_assistant")}
                                        </h3>
                                        {/* AI CHAT badge */}
                                        <span className="inline-flex items-center rounded-md bg-white/20 px-2.5 py-0.5 text-[11px] font-bold tracking-widest text-white uppercase">
                                            {tHome("ai_chat")}
                                        </span>
                                    </div>
                                    <p className="text-sm leading-relaxed font-medium text-purple-100 sm:text-base">
                                        {tHome("ai_health_assistant_description")}
                                    </p>
                                </div>
                            </div>

                            {/* Chat Now button — white outlined */}
                            <button
                                onClick={() => handleNavigation("health")}
                                className="group/btn flex w-full shrink-0 items-center justify-center gap-2.5 rounded-xl border-2 border-white/80 bg-white/15 px-7 py-3 text-base font-bold text-white backdrop-blur-sm transition-all duration-300 hover:bg-white hover:text-purple-700 sm:w-auto"
                            >
                                <MessageCircle size={18} />
                                {tHome("chat_now")}
                                <ChevronRight
                                    size={18}
                                    className="transition-transform duration-200 group-hover/btn:translate-x-1"
                                />
                            </button>
                        </div>
                    </div>

                    {/* Global Search moved to Hero */}

                    {/* ── Live Alerts Panel (full-width) ── */}
                    <div className="mt-10 mb-16">
                        <div className="flex flex-col overflow-hidden rounded-3xl border border-slate-200/50 bg-white/70 shadow-sm backdrop-blur-md dark:border-slate-800/50 dark:bg-slate-900/50">
                            <div className="flex items-center justify-between border-b border-white/30 bg-white/20 px-6 py-5 dark:border-white/10 dark:bg-slate-800/20">
                                <div className="flex items-center gap-2">
                                    <Activity size={20} className="text-red-500" />
                                    <h3 className="text-lg font-bold text-(--color-text-primary)">
                                        {tHome("live_cdsco_alerts")}
                                    </h3>
                                </div>
                                <span className="hidden rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-bold tracking-wider text-red-500 uppercase sm:block">
                                    {tHome("india_region")}
                                </span>
                            </div>

                            <div className="flex-1 overflow-y-auto bg-(--color-surface-muted)/30 p-4">
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    {loading ? (
                                        <>
                                            {[1, 2, 3, 4].map((i) => (
                                                <div
                                                    key={i}
                                                    className="relative flex items-start gap-4 overflow-hidden rounded-2xl border border-(--color-border-muted) bg-(--color-surface-page) p-4 shadow-sm"
                                                >
                                                    <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-(--color-border-muted)" />
                                                    <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                                                    <div className="flex-1 space-y-2">
                                                        <div className="flex items-start justify-between">
                                                            <Skeleton className="h-4 w-1/2" />
                                                            <Skeleton className="h-3 w-12" />
                                                        </div>
                                                        <Skeleton className="h-3 w-3/4" />
                                                    </div>
                                                </div>
                                            ))}
                                        </>
                                    ) : homepageAlerts && homepageAlerts.length > 0 ? (
                                        homepageAlerts.map((alert) => (
                                            <div
                                                key={alert.id}
                                                className="group relative flex cursor-pointer items-start gap-4 overflow-hidden rounded-2xl border border-(--color-border-muted) bg-(--color-surface-page) p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-400/30 hover:shadow-md"
                                            >
                                                {/* Left edge colored strip */}
                                                <div
                                                    className={`absolute top-0 bottom-0 left-0 w-1.5 ${
                                                        alert.brand_name === "SYSTEM_UPDATE"
                                                            ? "bg-blue-500"
                                                            : alert.cdsco_approval_status ===
                                                                    "banned" ||
                                                                alert.is_counterfeit_alert
                                                              ? "bg-red-500"
                                                              : "bg-orange-500"
                                                    }`}
                                                />

                                                <div
                                                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${
                                                        alert.brand_name === "SYSTEM_UPDATE"
                                                            ? "bg-blue-500/10 text-blue-500 group-hover:bg-blue-500/20"
                                                            : alert.cdsco_approval_status ===
                                                                    "banned" ||
                                                                alert.is_counterfeit_alert
                                                              ? "bg-red-500/10 text-red-500 group-hover:bg-red-500/20"
                                                              : "bg-orange-500/10 text-orange-500 group-hover:bg-orange-500/20"
                                                    }`}
                                                >
                                                    {alert.brand_name === "SYSTEM_UPDATE" ? (
                                                        <Globe size={20} strokeWidth={2.5} />
                                                    ) : (
                                                        <AlertTriangle
                                                            size={20}
                                                            strokeWidth={2.5}
                                                        />
                                                    )}
                                                </div>

                                                <div className="flex-1">
                                                    <div className="flex items-start justify-between">
                                                        <h4 className="leading-tight font-bold text-(--color-text-primary)">
                                                            {alert.brand_name}
                                                        </h4>
                                                        <span className="text-[11px] font-medium text-(--color-text-muted)">
                                                            {formatRelativeTime(alert.created_at)}
                                                        </span>
                                                    </div>
                                                    <p className="mt-1 text-sm leading-snug font-medium text-(--color-text-secondary)">
                                                        {alert.composition} Batch{" "}
                                                        <span className="font-bold text-(--color-text-primary)">
                                                            {alert.batch_number}
                                                        </span>
                                                    </p>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="sm:col-span-2">
                                            <EmptyState
                                                icon={
                                                    <ShieldCheck
                                                        size={26}
                                                        strokeWidth={2}
                                                        className="text-emerald-500"
                                                    />
                                                }
                                                title={tHome("alerts_empty_title")}
                                                description={tHome("alerts_empty_description")}
                                                className="border-none bg-transparent! p-6"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* ── Alert Log CTA ── */}
                            <div className="border-t border-(--color-border-muted) bg-(--color-surface-page) p-4">
                                <Link href="/alerts" className="block w-full">
                                    <button className="group/log flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-(--color-border-muted) bg-(--color-surface-muted) py-3 font-bold text-(--color-text-primary) transition-all duration-200 hover:border-slate-500/30 hover:shadow-sm">
                                        <Activity
                                            size={15}
                                            className="text-(--color-text-muted) transition-colors duration-200 group-hover/log:text-red-500"
                                        />
                                        {tHome("view_full_alert_log")}
                                        <ChevronRight
                                            size={16}
                                            className="text-(--color-text-muted) transition-transform duration-200 group-hover/log:translate-x-1"
                                        />
                                    </button>
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Spacer for mobile nav */}
            <div className="h-16 md:hidden"></div>
        </div>
    );
}
