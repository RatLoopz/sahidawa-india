"use client";

import React, { useEffect, useState, useRef } from "react";
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
    Database,
    ArrowRight,
    ScanLine,
    Stethoscope,
    HeartPulse,
} from "lucide-react";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";

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
    "relative inline-flex items-center pb-1 transition-colors duration-200 ease-out hover:text-blue-600 focus-visible:text-blue-600 after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:origin-center after:scale-x-0 after:rounded-full after:bg-current after:transition-transform after:duration-300 after:ease-out hover:after:scale-x-100 focus-visible:after:scale-x-100 motion-safe:after:will-change-transform";

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

// ── Premium Animated Scanner Component ──
const ScannerIllustration = () => {
    return (
        <div className="relative mx-auto aspect-square w-full max-w-md overflow-hidden rounded-[2.5rem] border border-slate-800/60 bg-slate-900 shadow-2xl shadow-blue-900/20">
            {/* High-tech Background Grid */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)] bg-[size:2rem_2rem] opacity-40"></div>

            <div className="absolute inset-0 bg-gradient-to-tr from-blue-900/20 via-transparent to-emerald-900/20"></div>

            {/* Floating Medicine Box */}
            <motion.div
                animate={{ y: [-8, 8, -8], rotateZ: [-2, 2, -2] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-0 z-10 flex items-center justify-center"
            >
                <div className="perspective-1000 rotateX-12 relative flex h-56 w-40 transform flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_0_50px_rgba(255,255,255,0.1)]">
                    <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-blue-500 to-emerald-500"></div>
                    <div className="flex w-full items-start justify-between">
                        <div className="h-5 w-16 rounded-md bg-gradient-to-r from-blue-500 to-blue-400"></div>
                        <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-emerald-500 text-emerald-500">
                            <ShieldCheck size={14} />
                        </div>
                    </div>

                    <div className="mt-4 space-y-3">
                        <div className="h-2.5 w-full rounded-full bg-slate-100"></div>
                        <div className="h-2.5 w-4/5 rounded-full bg-slate-100"></div>
                        <div className="h-2.5 w-3/5 rounded-full bg-slate-100"></div>
                    </div>

                    <div className="mt-auto border-t border-slate-100 pt-4">
                        {/* Realistic Barcode */}
                        <div className="flex h-10 items-end gap-[3px] opacity-70">
                            {[2, 4, 1, 3, 2, 5, 1, 2, 4, 2, 1, 3, 2, 4, 1, 2].map((h, i) => (
                                <div
                                    key={i}
                                    className="rounded-t-sm bg-slate-800"
                                    style={{
                                        height: `${h * 20}%`,
                                        width: h === 1 ? "2px" : h === 5 ? "4px" : "3px",
                                    }}
                                ></div>
                            ))}
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Glowing Scanning Laser */}
            <motion.div
                animate={{ top: ["15%", "85%", "15%"] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: "linear" }}
                className="absolute right-0 left-0 z-20 h-1 bg-emerald-400 shadow-[0_0_20px_rgba(52,211,153,1)]"
            >
                <div className="absolute top-1/2 left-1/2 h-[150px] w-full -translate-x-1/2 -translate-y-1/2 bg-gradient-to-b from-emerald-500/20 via-emerald-400/5 to-transparent"></div>
            </motion.div>

            {/* Verification Success Badge */}
            <motion.div
                initial={{ scale: 0, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ delay: 1, duration: 0.5, type: "spring", bounce: 0.4 }}
                className="absolute right-6 bottom-6 z-30 flex items-center gap-3 rounded-2xl border border-white/20 bg-white/10 p-3.5 text-emerald-400 shadow-2xl backdrop-blur-md"
            >
                <div className="rounded-full bg-emerald-400/20 p-1.5">
                    <ShieldCheck size={22} className="text-emerald-400" />
                </div>
                <div>
                    <p className="text-[10px] font-medium tracking-wider text-slate-300 uppercase">
                        Status
                    </p>
                    <p className="text-sm font-bold text-white">100% Authentic</p>
                </div>
            </motion.div>
        </div>
    );
};

// ── Medical Heartbeat Background Animation ──
const ECGBackground = () => (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden opacity-[0.03] dark:opacity-[0.05]">
        <svg
            viewBox="0 0 1000 200"
            className="h-full w-full stroke-blue-600 dark:stroke-blue-400"
            strokeWidth="2"
            fill="none"
            preserveAspectRatio="none"
        >
            <motion.path
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                d="M 0 100 L 200 100 L 220 50 L 250 150 L 280 20 L 310 120 L 330 100 L 600 100 L 620 50 L 650 150 L 680 20 L 710 120 L 730 100 L 1000 100"
            />
        </svg>
    </div>
);

export default function SahiDawaHome() {
    const router = useRouter();
    const params = useParams();
    const locale = Array.isArray(params.locale) ? params.locale[0] : params.locale;
    const tHome = useTranslations("Home");
    const tNav = useTranslations("Navigation");

    const [homepageAlerts, setHomepageAlerts] = useState<any[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const containerRef = useRef(null);

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

                if (data) setHomepageAlerts(data);
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
        <div
            ref={containerRef}
            className="min-h-screen bg-[#fafcff] font-sans text-slate-900 transition-colors duration-300 selection:bg-blue-500/30 dark:bg-[#020617] dark:text-slate-50"
        >
            {/* ── Precision Top Navigation ── */}
            <header className="sticky top-0 z-50 w-full border-b border-slate-200/50 bg-white/70 backdrop-blur-xl dark:border-slate-800/50 dark:bg-[#020617]/70">
                <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex cursor-pointer items-center gap-2.5"
                        onClick={() => handleNavigation("")}
                    >
                        <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-blue-600 to-emerald-500 text-white shadow-md shadow-blue-500/20">
                            <div className="absolute inset-0 bg-white/20 mix-blend-overlay"></div>
                            <ShieldCheck size={22} strokeWidth={2.5} />
                        </div>
                        <h1 className="bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-xl font-bold tracking-tight text-transparent md:text-2xl dark:from-white dark:to-slate-300">
                            SahiDawa
                        </h1>
                    </motion.div>

                    <div className="flex items-center gap-3 sm:gap-4 md:gap-5">
                        <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 lg:flex dark:text-slate-300">
                            <Link href="/how-it-works" className={desktopNavLinkClassName}>
                                {tNav("how_it_works")}
                            </Link>
                            <Link href="/alerts" className={desktopNavLinkClassName}>
                                <span className="relative">
                                    {tNav("alerts")}
                                    <span className="absolute -top-1 -right-2 flex h-2 w-2">
                                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75"></span>
                                        <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500"></span>
                                    </span>
                                </span>
                            </Link>
                            <Link href="/map" className={desktopNavLinkClassName}>
                                {tNav("pharmacy_map")}
                            </Link>
                            <Link
                                href="/reports/me"
                                className={`${desktopNavLinkClassName} flex items-center gap-1.5`}
                            >
                                <History size={14} /> {tNav("my_reports")}
                            </Link>
                        </nav>

                        <div className="hidden h-6 w-px bg-slate-200 md:block dark:bg-slate-800"></div>

                        <button
                            onClick={() => handleNavigation("login")}
                            className="hidden h-9 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-1.5 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-50 hover:shadow-sm sm:h-10 md:flex dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                            <User size={16} />
                            <span>{tHome("sign_in")}</span>
                        </button>

                        <LanguageSwitcher />
                        <ThemeToggle />
                    </div>
                </div>
            </header>

            <main className="overflow-hidden">
                {/* ── Premium Hero Section ── */}
                <section className="relative pt-20 pb-24 lg:pt-32 lg:pb-36">
                    <ECGBackground />

                    <div className="absolute top-0 right-0 -z-10 h-[600px] w-[600px] rounded-full bg-gradient-to-br from-blue-400/20 via-emerald-300/10 to-transparent blur-[100px] dark:from-blue-600/10 dark:via-emerald-900/10"></div>
                    <div className="absolute bottom-0 left-0 -z-10 h-[400px] w-[400px] rounded-full bg-gradient-to-tr from-indigo-400/10 to-transparent blur-[80px] dark:from-indigo-600/10"></div>

                    <div className="container mx-auto max-w-7xl px-4 md:px-6">
                        <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-2 lg:gap-12">
                            {/* Left Copy */}
                            <motion.div
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.8, ease: "easeOut" }}
                                className="z-10 flex flex-col items-start space-y-8"
                            >
                                <div className="inline-flex items-center gap-2.5 rounded-full border border-blue-200/60 bg-blue-50/50 px-4 py-1.5 text-sm font-medium text-blue-700 shadow-sm backdrop-blur-sm dark:border-blue-800/50 dark:bg-blue-900/20 dark:text-blue-300">
                                    <span className="relative flex h-2 w-2">
                                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75"></span>
                                        <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500"></span>
                                    </span>
                                    Enterprise-Grade Medical Verification
                                </div>

                                <h1 className="text-5xl leading-[1.1] font-extrabold tracking-tight text-slate-900 md:text-6xl lg:text-[4.5rem] dark:text-white">
                                    Secure your health with{" "}
                                    <span className="relative inline-block">
                                        <span className="relative z-10 bg-gradient-to-r from-blue-600 to-emerald-500 bg-clip-text text-transparent dark:from-blue-400 dark:to-emerald-400">
                                            absolute truth.
                                        </span>
                                        <span className="absolute right-0 bottom-2 left-0 -z-0 h-3 -rotate-1 bg-emerald-200/50 dark:bg-emerald-900/50"></span>
                                    </span>
                                </h1>

                                <p className="max-w-xl text-lg leading-relaxed text-slate-600 dark:text-slate-400">
                                    Empowering patients and professionals with real-time counterfeit
                                    detection, CDSCO recall alerts, and verified pharmacy mapping.
                                    Your safety, computationally guaranteed.
                                </p>

                                <div className="flex w-full flex-col gap-4 pt-2 sm:flex-row sm:items-center">
                                    <button
                                        onClick={() => handleNavigation("scan")}
                                        className="group relative flex items-center justify-center gap-3 rounded-2xl bg-slate-900 px-8 py-4 text-base font-bold text-white shadow-xl shadow-slate-900/20 transition-all hover:-translate-y-0.5 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:shadow-white/10 dark:hover:bg-slate-100"
                                    >
                                        <ScanLine
                                            size={20}
                                            className="text-emerald-400 dark:text-emerald-600"
                                        />
                                        Scan Medication
                                        <ArrowRight
                                            size={18}
                                            className="opacity-70 transition-transform group-hover:translate-x-1"
                                        />
                                    </button>
                                    <button
                                        onClick={() => handleNavigation("health")}
                                        className="group flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white/50 px-8 py-4 text-base font-bold text-slate-700 shadow-sm backdrop-blur-sm transition-all hover:border-blue-300 hover:bg-white dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-200 dark:hover:border-blue-700 dark:hover:bg-slate-800"
                                    >
                                        <Stethoscope size={20} className="text-blue-500" />
                                        AI Voice Triage
                                    </button>
                                </div>

                                <div className="flex items-center gap-4 pt-6 opacity-80">
                                    <div className="flex -space-x-3">
                                        {[1, 2, 3, 4].map((i) => (
                                            <div
                                                key={i}
                                                className={`flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-slate-200 bg-gradient-to-br from-blue-100 to-slate-200 dark:border-[#020617] dark:from-slate-700 dark:to-slate-800`}
                                            >
                                                <User
                                                    size={14}
                                                    className="text-slate-500 dark:text-slate-400"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                    <div className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                        Trusted by{" "}
                                        <span className="font-bold text-slate-900 dark:text-white">
                                            10,000+
                                        </span>{" "}
                                        healthcare users
                                    </div>
                                </div>
                            </motion.div>

                            {/* Right Scanner Animation */}
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 1, delay: 0.2 }}
                                className="relative lg:pl-10"
                            >
                                <ScannerIllustration />
                            </motion.div>
                        </div>
                    </div>
                </section>

                {/* ── Modern Bento Grid Services ── */}
                <section className="border-t border-slate-100 bg-white py-24 dark:border-slate-800/50 dark:bg-[#0b1120]">
                    <div className="container mx-auto max-w-7xl px-4 md:px-6">
                        <div className="mb-16 flex flex-col items-end justify-between gap-6 md:flex-row">
                            <div className="max-w-2xl">
                                <h2 className="mb-3 text-sm font-bold tracking-widest text-blue-600 uppercase dark:text-blue-400">
                                    Core Infrastructure
                                </h2>
                                <h3 className="text-3xl font-extrabold text-slate-900 md:text-4xl dark:text-white">
                                    A complete ecosystem for medical truth.
                                </h3>
                            </div>
                            <p className="max-w-sm text-slate-600 md:text-right dark:text-slate-400">
                                We provide the technical layer between patients and authentic
                                healthcare.
                            </p>
                        </div>

                        <div className="grid auto-rows-[320px] grid-cols-1 gap-6 md:grid-cols-3">
                            {/* Feature 1: Large Visual Scan */}
                            <motion.div
                                whileHover={{ y: -5 }}
                                onClick={() => handleNavigation("scan")}
                                className="group relative cursor-pointer overflow-hidden rounded-[2rem] border border-slate-200/50 bg-gradient-to-br from-slate-50 to-slate-100 md:col-span-2 dark:border-slate-800 dark:from-slate-900 dark:to-slate-800/50"
                            >
                                <div className="absolute top-0 right-0 h-[300px] w-[300px] translate-x-1/3 -translate-y-1/2 rounded-full bg-blue-500/10 blur-3xl transition-colors group-hover:bg-blue-500/20"></div>
                                <div className="relative z-10 flex h-full flex-col justify-between p-10">
                                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white text-blue-600 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-blue-400">
                                        <ScanLine size={28} />
                                    </div>
                                    <div>
                                        <h4 className="mb-2 text-2xl font-bold text-slate-900 transition-colors group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
                                            Visual Counterfeit Detection
                                        </h4>
                                        <p className="max-w-md text-slate-600 dark:text-slate-400">
                                            Utilize advanced computer vision to analyze packaging,
                                            barcodes, and pill structures against known authentic
                                            signatures.
                                        </p>
                                    </div>
                                </div>
                                <ArrowRight
                                    className="absolute right-10 bottom-10 text-slate-300 transition-all group-hover:translate-x-2 group-hover:text-blue-600 dark:text-slate-600 dark:group-hover:text-blue-400"
                                    size={28}
                                />
                            </motion.div>

                            {/* Feature 2: Voice Triage (Accent Color) */}
                            <motion.div
                                whileHover={{ y: -5 }}
                                onClick={() => handleNavigation("voice")}
                                className="group relative cursor-pointer overflow-hidden rounded-[2rem] bg-gradient-to-b from-indigo-600 to-blue-700 p-10 shadow-lg shadow-indigo-900/20"
                            >
                                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
                                <div className="relative z-10 flex h-full flex-col justify-between text-white">
                                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-white/20 backdrop-blur-md">
                                        <Mic size={28} className="text-white" />
                                    </div>
                                    <div>
                                        <h4 className="mb-2 text-2xl font-bold">AI Voice Triage</h4>
                                        <p className="text-sm text-indigo-100">
                                            Speak your symptoms natively. Our AI maps them to
                                            clinical urgency.
                                        </p>
                                    </div>
                                </div>
                            </motion.div>

                            {/* Feature 3: Safe Pharmacy */}
                            <motion.div
                                whileHover={{ y: -5 }}
                                onClick={() => handleNavigation("map")}
                                className="group relative cursor-pointer overflow-hidden rounded-[2rem] bg-slate-900 p-10 dark:bg-slate-800"
                            >
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 to-transparent opacity-80"></div>
                                <div className="relative z-10 flex h-full flex-col justify-between">
                                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-700 bg-slate-800 text-emerald-400 dark:border-slate-600 dark:bg-slate-700">
                                        <MapPin size={28} />
                                    </div>
                                    <div>
                                        <h4 className="mb-2 text-2xl font-bold text-white">
                                            Verified Map
                                        </h4>
                                        <p className="text-sm text-slate-400">
                                            Locate geo-fenced pharmacies with zero counterfeit
                                            history.
                                        </p>
                                    </div>
                                </div>
                            </motion.div>

                            {/* Feature 4: Alert Network */}
                            <motion.div
                                whileHover={{ y: -5 }}
                                onClick={() => handleNavigation("alerts")}
                                className="group relative cursor-pointer overflow-hidden rounded-[2rem] border border-rose-100 bg-gradient-to-br from-rose-50 to-orange-50 md:col-span-2 dark:border-rose-900/30 dark:from-rose-950/30 dark:to-orange-950/20"
                            >
                                <div className="relative z-10 flex h-full flex-col justify-between p-10">
                                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-200 bg-white text-rose-600 shadow-sm dark:border-rose-800 dark:bg-slate-800 dark:text-rose-400">
                                        <AlertTriangle size={28} />
                                    </div>
                                    <div className="flex items-end justify-between">
                                        <div>
                                            <h4 className="mb-2 text-2xl font-bold text-slate-900 transition-colors group-hover:text-rose-600 dark:text-white dark:group-hover:text-rose-400">
                                                National Alert Network
                                            </h4>
                                            <p className="max-w-md text-slate-600 dark:text-slate-400">
                                                Direct pipeline to CDSCO recalls, banned drug
                                                notifications, and community-reported suspicious
                                                batches.
                                            </p>
                                        </div>
                                        <button className="hidden items-center gap-2 rounded-full border border-rose-100 bg-white px-5 py-2.5 text-sm font-semibold text-rose-600 shadow-sm transition-colors group-hover:bg-rose-600 group-hover:text-white md:flex dark:border-rose-900/50 dark:bg-slate-800 dark:text-rose-400">
                                            View Logs <ArrowRight size={16} />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    </div>
                </section>

                {/* ── Search & Live Clinical Data ── */}
                <section className="border-t border-slate-100 bg-[#fafcff] py-24 dark:border-slate-800/50 dark:bg-[#020617]">
                    <div className="container mx-auto max-w-5xl px-4">
                        <div className="mb-10 text-center">
                            <h2 className="mb-4 text-2xl font-bold text-slate-900 dark:text-white">
                                Query The Database
                            </h2>
                            <div className="mx-auto max-w-2xl rounded-2xl shadow-xl shadow-blue-900/5">
                                <SearchBar />
                            </div>
                        </div>

                        {/* High-End Glass Data Table */}
                        <div className="mt-16 overflow-hidden rounded-[2rem] border border-slate-200/60 bg-white/60 shadow-xl shadow-slate-200/20 backdrop-blur-2xl dark:border-slate-800/60 dark:bg-slate-900/40 dark:shadow-none">
                            <div className="flex items-center justify-between border-b border-slate-200/50 bg-slate-50/50 px-8 py-5 dark:border-slate-800/50 dark:bg-slate-900/50">
                                <div className="flex items-center gap-3">
                                    <div className="relative flex h-3 w-3">
                                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75"></span>
                                        <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-500"></span>
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                        Live Intelligence Feed
                                    </h3>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                        <Database size={12} /> CDSCO Sync
                                    </span>
                                </div>
                            </div>

                            <div className="bg-gradient-to-b from-transparent to-slate-50/30 p-6 sm:p-8 dark:to-slate-950/30">
                                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                    {loading ? (
                                        <>
                                            {[1, 2, 3, 4].map((i) => (
                                                <div
                                                    key={i}
                                                    className="flex items-start gap-5 rounded-2xl border border-slate-100 bg-white/50 p-5 dark:border-slate-800/60 dark:bg-slate-900/50"
                                                >
                                                    <Skeleton className="h-12 w-12 shrink-0 rounded-xl" />
                                                    <div className="flex-1 space-y-3">
                                                        <div className="flex justify-between">
                                                            <Skeleton className="h-5 w-1/2" />
                                                            <Skeleton className="h-4 w-12" />
                                                        </div>
                                                        <Skeleton className="h-4 w-3/4" />
                                                    </div>
                                                </div>
                                            ))}
                                        </>
                                    ) : homepageAlerts && homepageAlerts.length > 0 ? (
                                        homepageAlerts.map((alert) => (
                                            <motion.div
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                key={alert.id}
                                                className="group flex items-start gap-5 rounded-2xl border border-slate-200/50 bg-white p-5 transition-all hover:border-slate-300 hover:shadow-md dark:border-slate-700/50 dark:bg-slate-800/40 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                                            >
                                                <div
                                                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors ${
                                                        alert.brand_name === "SYSTEM_UPDATE"
                                                            ? "bg-blue-50 text-blue-600 group-hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400"
                                                            : alert.cdsco_approval_status ===
                                                                    "banned" ||
                                                                alert.is_counterfeit_alert
                                                              ? "bg-rose-50 text-rose-600 group-hover:bg-rose-100 dark:bg-rose-900/20 dark:text-rose-400"
                                                              : "bg-amber-50 text-amber-600 group-hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400"
                                                    }`}
                                                >
                                                    {alert.brand_name === "SYSTEM_UPDATE" ? (
                                                        <Globe size={24} strokeWidth={2} />
                                                    ) : (
                                                        <AlertTriangle size={24} strokeWidth={2} />
                                                    )}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="mb-1 flex items-start justify-between gap-2">
                                                        <h4 className="truncate text-base font-bold text-slate-900 dark:text-slate-50">
                                                            {alert.brand_name}
                                                        </h4>
                                                        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-slate-800">
                                                            {formatRelativeTime(alert.created_at)}
                                                        </span>
                                                    </div>
                                                    <p className="line-clamp-1 text-sm font-medium text-slate-600 dark:text-slate-400">
                                                        {alert.composition}
                                                        {alert.batch_number && (
                                                            <>
                                                                <span className="mx-2 inline-block h-3 w-px bg-slate-300 align-middle dark:bg-slate-700"></span>
                                                                <span className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-800 dark:bg-slate-800 dark:text-slate-300">
                                                                    B.No {alert.batch_number}
                                                                </span>
                                                            </>
                                                        )}
                                                    </p>
                                                </div>
                                            </motion.div>
                                        ))
                                    ) : (
                                        <div className="col-span-1 lg:col-span-2">
                                            <EmptyState
                                                icon={
                                                    <ShieldCheck
                                                        size={32}
                                                        className="text-emerald-500"
                                                    />
                                                }
                                                title="All Clear"
                                                description="No critical alerts in your region at the moment."
                                                className="border border-dashed border-emerald-200 bg-emerald-50/30 p-8 shadow-none dark:border-emerald-900/30 dark:bg-emerald-900/10"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="border-t border-slate-200/50 bg-white/50 p-5 text-center dark:border-slate-800/50 dark:bg-slate-900/50">
                                <Link
                                    href="/alerts"
                                    className="inline-flex items-center gap-2 text-sm font-bold text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                                >
                                    Access Full Security Log
                                    <ChevronRight size={16} />
                                </Link>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            {/* Spacer for mobile nav */}
            <div className="h-16 md:hidden"></div>

            {/* ── Mobile Bottom Navigation ── */}
            <nav className="fixed right-0 bottom-0 left-0 z-50 flex items-center justify-around border-t border-slate-200/80 bg-white/80 px-2 py-3 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden dark:border-slate-800/80 dark:bg-slate-950/80">
                <Link href="/" className="group flex flex-col items-center gap-1">
                    <Home size={22} className="text-blue-600 dark:text-blue-400" />
                    <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                        {tNav("home")}
                    </span>
                </Link>
                <Link
                    href="/scan"
                    className="group flex flex-col items-center gap-1 text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-50"
                >
                    <ScanLine size={22} />
                    <span className="text-[10px] font-medium">{tNav("scans")}</span>
                </Link>
                <Link
                    href="/map"
                    className="group flex flex-col items-center gap-1 text-slate-500 transition-colors hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400"
                >
                    <MapPin size={22} />
                    <span className="text-[10px] font-medium">{tNav("map")}</span>
                </Link>
                <Link
                    href="/alerts"
                    className="group flex flex-col items-center gap-1 text-slate-500 transition-colors hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400"
                >
                    <div className="relative">
                        <Bell size={22} />
                        <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-950"></span>
                    </div>
                    <span className="text-[10px] font-medium">{tNav("alerts")}</span>
                </Link>
                <Link
                    href="/profile"
                    className="group flex flex-col items-center gap-1 text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-50"
                >
                    <User size={22} />
                    <span className="text-[10px] font-medium">{tNav("profile")}</span>
                </Link>
            </nav>
        </div>
    );
}
