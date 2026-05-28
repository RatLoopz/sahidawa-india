"use client";

import React, { useEffect, useState } from "react";
import {
    Camera,
    Mic,
    MapPin,
    Bell,
    History,
    Home,
    User,
    ShieldCheck,
    AlertTriangle,
    Globe,
    ChevronRight,
    Activity,
    MessageCircle,
    Search,
    Pill,
    HeartPulse,
    Stethoscope,
    Ambulance,
    Syringe,
    ClipboardCheck,
    FileText,
    PhoneCall,
    Shield,
    CheckCircle,
    ArrowRight,
    Star,
    Clock,
    Award,
    Users,
    TrendingUp,
    BookOpen,
    Smartphone,
    Eye,
    ThumbsUp,
    Zap,
    BarChart3,
    Calendar,
    Mail,
    Facebook,
    Twitter,
    Instagram,
    Linkedin,
    Youtube,
    Menu,
    X,
} from "lucide-react";

import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import LanguageSwitcher from "./LanguageSwitcher";
import { ThemeToggle } from "./components/ThemeToggle";
import SearchBar from "./components/SearchBar";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";

const desktopNavLinkClassName =
    "relative inline-flex items-center pb-1 transition-colors duration-200 ease-out hover:text-emerald-600 focus-visible:text-emerald-600 after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:origin-center after:scale-x-0 after:rounded-full after:bg-current after:transition-transform after:duration-300 after:ease-out hover:after:scale-x-100 focus-visible:after:scale-x-100 motion-safe:after:will-change-transform";

const mobileNavLabelClassName =
    "relative inline-flex items-center pb-1 transition-colors duration-200 ease-out after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:origin-center after:scale-x-0 after:rounded-full after:bg-current after:transition-transform after:duration-300 after:ease-out group-hover:after:scale-x-100 group-active:after:scale-x-100 group-focus-visible:after:scale-x-100 motion-safe:after:will-change-transform";

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
    const tNav = useTranslations("Navigation");

    const [homepageAlerts, setHomepageAlerts] = useState<any[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white font-sans text-slate-800 transition-colors duration-300 dark:from-slate-950 dark:to-slate-900 dark:text-slate-100">
            {/* a??a?? Top Navigation a??a?? */}
            <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/90 backdrop-blur-lg dark:border-slate-800 dark:bg-slate-950/90">
                <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
                    <div className="flex items-center gap-2">
                        <div
                            className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 shadow-sm sm:h-10 sm:w-10 dark:bg-emerald-950/30 dark:text-emerald-400"
                            aria-label="SahiDawa Logo"
                        >
                            <img
                                src="/favicon.ico"
                                alt=""
                                aria-hidden="true"
                                className="h-7 w-7 object-contain"
                                width={28}
                                height={28}
                            />
                        </div>
                        <h1 className="text-xl font-extrabold tracking-tight text-slate-900 md:text-2xl dark:text-white">
                            SahiDawa
                        </h1>
                    </div>

                    {/* Desktop Navigation */}
                    <div className="hidden items-center gap-3 sm:gap-4 md:gap-4 lg:flex">
                        <nav
                            className="flex items-center gap-6 text-sm font-semibold text-slate-600 dark:text-slate-400"
                            aria-label="Main navigation"
                        >
                            <Link href="/how-it-works" className={desktopNavLinkClassName}>
                                {tNav("how_it_works")}
                            </Link>
                            <Link href="/alerts" className={desktopNavLinkClassName}>
                                {tNav("alerts")}
                            </Link>
                            <Link href="/map" className={desktopNavLinkClassName}>
                                {tNav("pharmacy_map")}
                            </Link>
                            <Link
                                href="/reports/me"
                                className={`${desktopNavLinkClassName} flex items-center gap-1`}
                            >
                                <History size={14} /> {tNav("my_reports")}
                            </Link>
                        </nav>

                        <button
                            onClick={() => handleNavigation("login")}
                            className="hidden h-9 items-center justify-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-50/50 px-4 py-1.5 text-sm font-bold text-emerald-700 transition-all duration-200 hover:scale-105 hover:border-emerald-500/50 hover:bg-emerald-100 sm:h-10 sm:px-5 sm:py-2 md:flex dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20"
                            aria-label={tHome("sign_in")}
                        >
                            <User size={16} />
                            <span>{tHome("sign_in")}</span>
                        </button>

                        <button
                            onClick={() => handleNavigation("health")}
                            className="flex h-9 w-9 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 px-3 py-1.5 text-sm font-semibold text-white transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-purple-500/25 sm:h-10 sm:w-auto sm:px-4 sm:py-2"
                            aria-label={tHome("open_ai_health_assistant")}
                        >
                            <MessageCircle size={16} />
                            <span className="hidden sm:inline">{tHome("ai_health_assistant")}</span>
                        </button>

                        <LanguageSwitcher />
                        <ThemeToggle />
                    </div>

                    {/* Mobile Menu Button */}
                    <div className="flex items-center gap-2 lg:hidden">
                        <LanguageSwitcher />
                        <ThemeToggle />
                        <button
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                            aria-label="Toggle mobile menu"
                        >
                            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                        </button>
                    </div>
                </div>

                {/* Mobile Navigation */}
                {mobileMenuOpen && (
                    <div className="border-t border-slate-200 bg-white px-4 pb-4 pt-2 lg:hidden dark:border-slate-800 dark:bg-slate-950">
                        <nav className="flex flex-col gap-2" aria-label="Mobile navigation">
                            <Link href="/how-it-works" className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">
                                {tNav("how_it_works")}
                            </Link>
                            <Link href="/alerts" className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">
                                {tNav("alerts")}
                            </Link>
                            <Link href="/map" className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">
                                {tNav("pharmacy_map")}
                            </Link>
                            <Link href="/reports/me" className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">
                                <History size={14} className="inline mr-1" /> {tNav("my_reports")}
                            </Link>
                            <div className="mt-2 flex gap-2">
                                <button
                                    onClick={() => handleNavigation("login")}
                                    className="flex-1 rounded-full border border-emerald-500/30 bg-emerald-50/50 px-4 py-2 text-sm font-bold text-emerald-700 transition-all hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20"
                                >
                                    <User size={16} className="inline mr-1" />
                                    {tHome("sign_in")}
                                </button>
                                <button
                                    onClick={() => handleNavigation("health")}
                                    className="flex-1 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 px-4 py-2 text-sm font-semibold text-white transition-all hover:shadow-lg hover:shadow-purple-500/25"
                                >
                                    <MessageCircle size={16} className="inline mr-1" />
                                    {tHome("ai_health_assistant")}
                                </button>
                            </div>
                        </nav>
                    </div>
                )}
            </header>

            {/* a??a?? Main a??a?? */}
            <main className="container mx-auto max-w-6xl px-4 pt-8 pb-24 md:pb-12">
                {/* Hero Section */}
                <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-50 via-white to-blue-50 p-8 md:p-12 lg:p-16 dark:from-emerald-950/20 dark:via-slate-950 dark:to-blue-950/20">
                    <div className="absolute top-0 right-0 -mt-20 -mr-20 h-64 w-64 rounded-full bg-emerald-200/30 blur-3xl dark:bg-emerald-500/10"></div>
                    <div className="absolute bottom-0 left-0 -mb-20 -ml-20 h-64 w-64 rounded-full bg-blue-200/30 blur-3xl dark:bg-blue-500/10"></div>
                    
                    <div className="relative z-10 space-y-6 text-center">
                        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-100/80 px-4 py-2 text-sm font-bold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400">
                            <span className="relative flex h-2 w-2">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                            </span>
                            GSSoC 2026 Open Source Project
                        </div>
                        
                        <h2 className="text-4xl leading-[1.1] font-black tracking-tight text-slate-900 md:text-6xl lg:text-7xl dark:text-white">
                            {tHome("title")}
                        </h2>
                        
                        <p className="mx-auto max-w-2xl text-lg leading-relaxed font-medium text-slate-600 md:text-xl dark:text-slate-400">
                            {tHome("subtitle")}
                        </p>

                        <div className="flex flex-col items-center justify-center gap-4 pt-4 sm:flex-row">
                            <button
                                onClick={() => handleNavigation("login")}
                                className="group flex w-[220px] items-center justify-center gap-2 rounded-full bg-emerald-600 px-8 py-3.5 text-base font-bold text-white shadow-lg shadow-emerald-500/25 transition-all duration-300 hover:-translate-y-0.5 hover:bg-emerald-700 hover:shadow-xl hover:shadow-emerald-500/40 active:scale-95"
                            >
                                <User size={20} />
                                {tHome("get_started")}
                            </button>
                            <button
                                onClick={() => handleNavigation("how-it-works")}
                                className="group flex w-[220px] items-center justify-center gap-2 rounded-full border-2 border-emerald-200 bg-white px-8 py-3.5 text-base font-bold text-emerald-700 transition-all duration-300 hover:-translate-y-0.5 hover:border-emerald-400 hover:bg-emerald-50 active:scale-95 dark:border-emerald-800 dark:bg-transparent dark:text-emerald-400 dark:hover:border-emerald-600 dark:hover:bg-emerald-950/30"
                            >
                                <BookOpen size={20} />
                                Learn More
                            </button>
                        </div>
                    </div>
                </section>

                {/* Trust Badges */}
                <section className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
                    {[
                        { icon: ShieldCheck, label: "Verified Medicines", color: "emerald" },
                        { icon: Users, label: "10K+ Active Users", color: "blue" },
                        { icon: Clock, label: "Real-time Alerts", color: "amber" },
                        { icon: Award, label: "Trusted Platform", color: "purple" },
                    ].map((badge, index) => (
                        <div
                            key={index}
                            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
                        >
                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-${badge.color}-100 text-${badge.color}-600 dark:bg-${badge.color}-950/30 dark:text-${badge.color}-400`}>
                                <badge.icon size={20} />
                            </div>
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{badge.label}</span>
                        </div>
                    ))}
                </section>

                {/* a??a?? Primary CTA a?? Full-width Scan Button a??a?? */}
                <section className="mt-8">
                    <button
                        onClick={() => handleNavigation("scan")}
                        className="group relative flex w-full items-center justify-between overflow-hidden rounded-3xl border border-emerald-500 bg-gradient-to-r from-emerald-600 to-emerald-500 p-7 text-left text-white shadow-xl shadow-emerald-600/20 transition-all hover:shadow-emerald-600/40 active:scale-[0.99] md:p-8"
                        aria-label="Scan medicine"
                    >
                        <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/10 blur-3xl"></div>
                        <div className="relative z-10 flex items-center gap-6">
                            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white/20 shadow-inner backdrop-blur-md transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 md:h-20 md:w-20">
                                <Camera
                                    className="h-8 w-8 text-white drop-shadow-md md:h-10 md:w-10"
                                    strokeWidth={2}
                                />
                            </div>
                            <div>
                                <span className="block text-2xl font-bold tracking-wide drop-shadow-sm md:text-3xl">
                                    {tHome("scan_button")}
                                </span>
                                <span className="mt-1 block text-sm font-medium text-emerald-100 opacity-90 md:text-base">
                                    {tHome("scan_subtitle")}
                                </span>
                            </div>
                        </div>
                        <ChevronRight
                            size={32}
                            className="relative z-10 hidden shrink-0 text-emerald-200 opacity-50 transition-all group-hover:translate-x-2 group-hover:opacity-100 sm:block"
                        />
                    </button>
                </section>

                {/* a??a?? Secondary Action Cards a??a?? */}
                <section className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {/* Upload Photo */}
                    <button
                        onClick={() => handleNavigation("scan")}
                        className="group flex min-h-[170px] w-full flex-col justify-between overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-emerald-400/50 hover:shadow-xl active:scale-[0.99] dark:border-slate-800 dark:bg-slate-900"
                        aria-label="Upload photo"
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-white/60 transition-colors duration-300 ring-inset group-hover:bg-emerald-500 group-hover:text-white dark:bg-emerald-950/30 dark:text-emerald-400 dark:ring-white/10">
                                <Camera size={28} strokeWidth={2.5} />
                            </div>
                            <ChevronRight className="mt-1 h-5 w-5 text-slate-300 transition-all duration-300 group-hover:translate-x-1 group-hover:text-emerald-400" />
                        </div>

                        <div className="pt-4">
                            <h3 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                                {tHome("upload_photo")}
                            </h3>
                            <p className="mt-1 text-sm leading-snug font-medium text-slate-500 dark:text-slate-400">
                                {tHome("upload_subtitle")}
                            </p>
                        </div>
                    </button>

                    {/* Voice Triage */}
                    <button
                        onClick={() => handleNavigation("voice")}
                        className="group flex min-h-[170px] w-full flex-col justify-between overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-blue-400/50 hover:shadow-xl active:scale-[0.99] dark:border-slate-800 dark:bg-slate-900"
                        aria-label="Voice triage"
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-white/60 transition-colors duration-300 ring-inset group-hover:bg-blue-500 group-hover:text-white dark:bg-blue-950/30 dark:text-blue-400 dark:ring-white/10">
                                <Mic size={28} strokeWidth={2.5} />
                            </div>
                            <ChevronRight className="mt-1 h-5 w-5 text-slate-300 transition-all duration-300 group-hover:translate-x-1 group-hover:text-blue-400" />
                        </div>

                        <div className="pt-4">
                            <h3 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                                {tHome("voice_triage")}
                            </h3>
                            <p className="mt-1 text-sm leading-snug font-medium text-slate-500 dark:text-slate-400">
                                {tHome("voice_subtitle")}
                            </p>
                        </div>
                    </button>

                    {/* Pharmacy Map */}
                    <button
                        onClick={() => handleNavigation("map")}
                        className="group flex min-h-[170px] w-full flex-col justify-between overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-amber-400/50 hover:shadow-xl active:scale-[0.99] dark:border-slate-800 dark:bg-slate-900"
                        aria-label="Pharmacy map"
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-white/60 transition-colors duration-300 ring-inset group-hover:bg-amber-500 group-hover:text-white dark:bg-amber-950/30 dark:text-amber-400 dark:ring-white/10">
                                <MapPin size={28} strokeWidth={2.5} />
                            </div>
                            <ChevronRight className="mt-1 h-5 w-5 text-slate-300 transition-all duration-300 group-hover:translate-x-1 group-hover:text-amber-400" />
                        </div>

                        <div className="pt-4">
                            <h3 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                                {tHome("pharmacy_map")}
                            </h3>
                            <p className="mt-1 text-sm leading-snug font-medium text-slate-500 dark:text-slate-400">
                                {tHome("pharmacy_subtitle")}
                            </p>
                        </div>
                    </button>

                    {/* Report Fake Medicine */}
                    <button
                        onClick={() => handleNavigation("report")}
                        className="group flex min-h-[170px] w-full flex-col justify-between overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-red-400/50 hover:shadow-xl active:scale-[0.99] dark:border-slate-800 dark:bg-slate-900"
                        aria-label="Report fake medicine"
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600 ring-1 ring-white/60 transition-colors duration-300 ring-inset group-hover:bg-red-500 group-hover:text-white dark:bg-red-950/30 dark:text-red-400 dark:ring-white/10">
                                <AlertTriangle size={28} strokeWidth={2.5} />
                            </div>
                            <ChevronRight className="mt-1 h-5 w-5 text-slate-300 transition-all duration-300 group-hover:translate-x-1 group-hover:text-red-400" />
                        </div>

                        <div className="pt-4">
                            <h3 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                                {tHome("report_fake")}
                            </h3>
                            <p className="mt-1 text-sm leading-snug font-medium text-slate-500 dark:text-slate-400">
                                {tHome("report_fake_subtitle")}
                            </p>
                        </div>
                    </button>
                </section>

                {/* a??a?? How It Works Section a??a?? */}
                <section className="mt-12">
                    <div className="text-center mb-8">
                        <h2 className="text-3xl font-black tracking-tight text-slate-900 md:text-4xl dark:text-white">
                            How It Works
                        </h2>
                        <p className="mt-2 text-lg text-slate-600 dark:text-slate-400">
                            Three simple steps to verify your medicines
                        </p>
                    </div>
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                        {[
                            { step: "01", icon: Camera, title: "Scan", description: "Take a photo of the medicine packaging or barcode using our app", color: "emerald" },
                            { step: "02", icon: Search, title: "Verify", description: "Our AI instantly checks the medicine against our database of verified products", color: "blue" },
                            { step: "03", icon: ShieldCheck, title: "Stay Safe", description: "Get instant results and alerts about counterfeit or recalled medicines", color: "purple" },
                        ].map((item, index) => (
                            <div
                                key={index}
                                className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900"
                            >
                                <div className={`absolute top-0 right-0 h-24 w-24 rounded-bl-3xl bg-${item.color}-50 dark:bg-${item.color}-950/20`}></div>
                                <div className="relative z-10">
                                    <div className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-${item.color}-100 text-${item.color}-600 dark:bg-${item.color}-950/30 dark:text-${item.color}-400`}>
                                        <item.icon size={32} />
                                    </div>
                                    <div className="mt-4">
                                        <span className={`text-sm font-bold text-${item.color}-600 dark:text-${item.color}-400`}>{item.step}</span>
                                        <h3 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{item.title}</h3>
                                        <p className="mt-2 text-slate-600 dark:text-slate-400">{item.description}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* a??a?? Features Section a??a?? */}
                <section className="mt-12">
                    <div className="text-center mb-8">
                        <h2 className="text-3xl font-black tracking-tight text-slate-900 md:text-4xl dark:text-white">
                            Why Choose SahiDawa?
                        </h2>
                        <p className="mt-2 text-lg text-slate-600 dark:text-slate-400">
                            Comprehensive features for your medicine safety
                        </p>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {[
                            { icon: Zap, title: "Instant Verification", description: "Get results in seconds with our advanced AI technology" },
                            { icon: Bell, title: "Real-time Alerts", description: "Stay informed about medicine recalls and counterfeit alerts" },
                            { icon: MapPin, title: "Pharmacy Locator", description: "Find verified pharmacies near you with our interactive map" },
                            { icon: Mic, title: "Voice Search", description: "Search for medicines using voice commands in multiple languages" },
                            { icon: History, title: "Report History", description: "Track all your medicine verification reports in one place" },
                            { icon: Globe, title: "Multi-language Support", description: "Available in multiple languages for wider accessibility" },
                        ].map((feature, index) => (
                            <div
                                key={index}
                                className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
                            >
                                <div className="flex items-start gap-4">
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
                                        <feature.icon size={24} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-900 dark:text-white">{feature.title}</h3>
                                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{feature.description}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* a??a?? Statistics Section a??a?? */}
                <section className="mt-12 rounded-3xl bg-gradient-to-br from-emerald-600 to-emerald-800 p-8 text-white shadow-xl md:p-12">
                    <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
                        {[
                            { icon: BarChart3, value: "10K+", label: "Medicines Verified" },
                            { icon: Users, value: "5K+", label: "Active Users" },
                            { icon: Shield, value: "99.9%", label: "Accuracy Rate" },
                            { icon: Clock, value: "24/7", label: "Support Available" },
                        ].map((stat, index) => (
                            <div key={index} className="text-center">
                                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
                                    <stat.icon size={24} />
                                </div>
                                <p className="mt-3 text-2xl font-black">{stat.value}</p>
                                <p className="mt-1 text-sm font-medium text-emerald-100">{stat.label}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* a??a?? Testimonials Section a??a?? */}
                <section className="mt-12">
                    <div className="text-center mb-8">
                        <h2 className="text-3xl font-black tracking-tight text-slate-900 md:text-4xl dark:text-white">
                            What Our Users Say
                        </h2>
                        <p className="mt-2 text-lg text-slate-600 dark:text-slate-400">
                            Trusted by thousands of users worldwide
                        </p>
                    </div>
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                        {[
                            { name: "Dr. Priya Sharma", role: "Pharmacist", content: "SahiDawa has revolutionized how we verify medicines. It's an essential tool for every pharmacy.", rating: 5 },
                            { name: "Rahul Verma", role: "Regular User", content: "I use it every time I buy medicine. It gives me peace of mind knowing my medications are genuine.", rating: 5 },
                            { name: "Anita Patel", role: "Healthcare Professional", content: "The real-time alerts feature is invaluable. It helps us stay updated on medicine recalls instantly.", rating: 5 },
                        ].map((testimonial, index) => (
                            <div
                                key={index}
                                className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900"
                            >
                                <div className="flex items-center gap-1 mb-3">
                                    {[...Array(testimonial.rating)].map((_, i) => (
                                        <Star key={i} size={16} className="fill-amber-400 text-amber-400" />
                                    ))}
                                </div>
                                <p className="text-slate-600 dark:text-slate-400 italic">"{testimonial.content}"</p>
                                <div className="mt-4 flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 font-bold dark:bg-emerald-950/30 dark:text-emerald-400">
                                        {testimonial.name.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-900 dark:text-white">{testimonial.name}</p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">{testimonial.role}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* a??a?? Health Assistant CTA Banner a??a?? */}
                <section className="mt-12">
                    <div className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-md transition-all hover:shadow-xl sm:p-8 md:p-10 dark:border-slate-800 dark:bg-slate-900">
                        <div className="pointer-events-none absolute -top-16 -right-16 h-64 w-64 rounded-full bg-purple-500/10 blur-3xl transition-transform duration-700 group-hover:scale-110" />
                        <div className="pointer-events-none absolute -bottom-12 -left-12 h-48 w-48 rounded-full bg-blue-500/10 blur-3xl transition-transform duration-700 group-hover:scale-110" />

                        <div className="relative z-10 flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                            <div className="flex items-center gap-4">
                                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-blue-500 text-white shadow-lg">
                                    <MessageCircle size={32} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                                        {tHome("ai_health_assistant")}
                                    </h3>
                                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                        Get instant answers to your health questions
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => handleNavigation("health")}
                                className="group/btn flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-500/25 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-purple-500/40 active:scale-95"
                            >
                                <MessageCircle size={18} />
                                <span>Ask Now</span>
                                <ArrowRight size={16} className="transition-transform group-hover/btn:translate-x-1" />
                            </button>
                        </div>
                    </div>
                </section