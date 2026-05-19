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
    Search,
    MessageCircle,
} from "lucide-react";

import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import LanguageSwitcher from "./LanguageSwitcher";
import Footer from "./components/Footer";

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
        // Fall back to a standard date view if it's older than 24 hours
        return past.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    }
}

export default function SahiDawaHome() {
    const router = useRouter();
    const params = useParams();
    const locale = params.locale;
    const tHome = useTranslations("Home");
    const tNav = useTranslations("Navigation");

    const [homepageAlerts, setHomepageAlerts] = useState<any[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        async function fetchAlerts() {
            try {
                const { data, error } = await supabase
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
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-emerald-200">
            {/* ── Top Navigation ── */}
            <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur-lg">
                <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
                    <div className="flex items-center gap-2">
                        <div
                            className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 shadow-sm"
                            aria-label="SahiDawa Logo"
                        >
                            <ShieldCheck size={24} strokeWidth={2.5} />
                        </div>
                        <h1 className="text-xl font-extrabold tracking-tight text-slate-800 md:text-2xl">
                            SahiDawa
                        </h1>
                    </div>

          <div className="flex items-center gap-2 md:gap-4">
            <nav className="hidden lg:flex items-center gap-6 text-sm font-semibold text-slate-600" aria-label="Main navigation">
              <Link href="/how-it-works" className="hover:text-emerald-600 transition-colors">
                {tNav("how_it_works")}
              </Link>
              <Link href="/alerts" className="hover:text-emerald-600 transition-colors">
                {tNav("alerts")}
              </Link>
              <Link href="/map" className="hover:text-emerald-600 transition-colors">
                {tNav("pharmacy_map")}
              </Link>
              <Link href="/reports/me" className="hover:text-emerald-600 transition-colors flex items-center gap-1">
                <History size={14} /> My Reports
              </Link>
            </nav>

                        <button
                            onClick={() => handleNavigation("health")}
                            className="flex items-center gap-2 rounded-full bg-linear-to-r from-blue-500 to-purple-500 px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:scale-105 hover:shadow-lg"
                            aria-label="Open AI Health Assistant"
                        >
                            <MessageCircle size={16} />
                            <span className="hidden sm:inline">AI Health Assistant</span>
                            <span className="sm:hidden">AI Chat</span>
                        </button>

                        <LanguageSwitcher />
                    </div>
                </div>
            </header>

            {/* ── Main ── */}
            <main className="container mx-auto max-w-6xl px-4 pt-8 pb-24 md:pb-12">
                {/* Hero */}
                <div className="space-y-6 py-12 text-center md:py-20">
                    <div className="animate-in fade-in slide-in-from-bottom-4 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 duration-700">
                        <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                        </span>
                        GSSoC 2026 Open Source Project
                    </div>
                    <h2 className="text-4xl leading-[1.1] font-black tracking-tight text-slate-900 md:text-6xl">
                        {tHome("title")}
                    </h2>
                    <p className="mx-auto max-w-2xl text-lg leading-relaxed font-medium text-slate-500 md:text-xl">
                        {tHome("subtitle")}
                    </p>
                </div>

                {/* ── Primary CTA — Full-width Scan Button ── */}
                <button
                    onClick={() => handleNavigation("scan")}
                    className="group relative flex w-full items-center justify-between overflow-hidden rounded-3xl border border-emerald-500 bg-emerald-600 p-7 text-left text-white shadow-xl shadow-emerald-600/20 transition-all hover:shadow-emerald-600/40 active:scale-[0.99] md:p-8"
                    aria-label="Scan medicine"
                >
                    <div className="absolute inset-0 z-0 bg-linear-to-tr from-emerald-700 to-emerald-500"></div>
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

                {/* ── Secondary Action Cards ── */}
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {/* Upload Photo */}
                    <button
                        onClick={() => handleNavigation("scan")}
                        className="group flex w-full items-center gap-5 rounded-3xl border border-slate-200 bg-white p-6 text-left transition-all hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-100/50 active:scale-95"
                        aria-label="Upload photo"
                    >
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 transition-colors duration-300 group-hover:bg-emerald-500 group-hover:text-white">
                            <Globe size={28} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-800">
                                {tHome("upload_photo")}
                            </h3>
                            <p className="mt-0.5 text-sm leading-snug font-medium text-slate-500">
                                {tHome("upload_subtitle")}
                            </p>
                        </div>
                    </button>

                    {/* Voice Triage */}
                    <button
                        onClick={() => handleNavigation("voice")}
                        className="group flex w-full items-center gap-5 rounded-3xl border border-slate-200 bg-white p-6 text-left transition-all hover:border-blue-200 hover:shadow-lg hover:shadow-blue-100/50 active:scale-95"
                        aria-label="Voice triage"
                    >
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 transition-colors duration-300 group-hover:bg-blue-500 group-hover:text-white">
                            <Mic size={28} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-800">
                                {tHome("voice_triage")}
                            </h3>
                            <p className="mt-0.5 text-sm leading-snug font-medium text-slate-500">
                                {tHome("voice_subtitle")}
                            </p>
                        </div>
                    </button>

                    {/* Pharmacy Map */}
                    <button
                        onClick={() => handleNavigation("map")}
                        className="group flex w-full items-center gap-5 rounded-3xl border border-slate-200 bg-white p-6 text-left transition-all hover:border-amber-200 hover:shadow-lg hover:shadow-amber-100/50 active:scale-95"
                        aria-label="Pharmacy map"
                    >
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 transition-colors duration-300 group-hover:bg-amber-500 group-hover:text-white">
                            <MapPin size={28} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-800">
                                {tHome("pharmacy_map")}
                            </h3>
                            <p className="mt-0.5 text-sm leading-snug font-medium text-slate-500">
                                {tHome("pharmacy_subtitle")}
                            </p>
                        </div>
                    </button>

                    {/* Report Fake Medicine */}
                    <button
                        onClick={() => handleNavigation("report")}
                        className="group flex w-full items-center gap-5 rounded-3xl border border-slate-200 bg-white p-6 text-left transition-all hover:border-red-200 hover:shadow-lg hover:shadow-red-100/50 active:scale-95"
                        aria-label="Report fake medicine"
                    >
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600 transition-colors duration-300 group-hover:bg-red-500 group-hover:text-white">
                            <AlertTriangle size={28} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-800">Report Fake</h3>
                            <p className="mt-0.5 text-sm leading-snug font-medium text-slate-500">
                                Report suspicious medicine
                            </p>
                        </div>
                    </button>
                </div>

                {/* ── AI Health Assistant CTA Banner ── */}
                <div className="mt-6 rounded-3xl border border-blue-100 bg-linear-to-r from-blue-50 to-purple-50 p-6">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-linear-to-r from-blue-500 to-purple-500 shadow-lg">
                                <MessageCircle size={28} className="text-white" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">
                                    AI Health Assistant
                                </h3>
                                <p className="text-sm text-slate-600">
                                    Get instant health advice and symptom checking
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => handleNavigation("health")}
                            className="rounded-xl bg-linear-to-r from-blue-500 to-purple-500 px-6 py-2.5 font-bold text-white transition-all duration-200 hover:scale-105 hover:shadow-lg"
                        >
                            Chat Now →
                        </button>
                    </div>
                </div>

                {/* ── Global Search ── */}
                <div className="mt-8 rounded-[3rem] border border-slate-200 bg-white p-4 shadow-sm transition-all focus-within:ring-2 focus-within:ring-emerald-500/20">
                    <div className="flex items-center gap-2 px-2 sm:gap-4">
                        <Search className="ml-2 shrink-0 text-slate-400" size={24} />
                        <input
                            type="text"
                            placeholder={tHome("search_placeholder")}
                            className="w-full border-none bg-transparent px-4 py-3 font-medium text-slate-700 outline-none placeholder:text-slate-400"
                            aria-label="Search medicine or batch"
                        />
                        <button className="shrink-0 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-slate-800 sm:px-6 sm:text-base">
                            {tHome("search_button")}
                        </button>
                    </div>
                </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8 mb-20">
          {/* Live Alerts Panel */}
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden flex flex-col h-[400px]">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Activity size={20} className="text-red-500" />
                <h3 className="text-lg font-bold text-slate-800">
                  Live CDSCO Alerts
                </h3>
              </div>
              <span className="text-xs font-bold bg-red-100 text-red-600 px-2.5 py-1 rounded-full uppercase tracking-wider hidden sm:block">
                India Region
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/30">
              {/* Alert Item */}
              {homepageAlerts && homepageAlerts.length > 0 ? (
                homepageAlerts.map((alert) => (
                  <div 
                    key={alert.id} 
                    className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex items-start gap-4 relative overflow-hidden group hover:shadow-md transition-shadow cursor-pointer"
                  >
                    {/* Left edge colored strip */}
                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                      alert.brand_name === 'SYSTEM_UPDATE' 
                        ? 'bg-blue-500' 
                        : (alert.cdsco_approval_status === 'banned' || alert.is_counterfeit_alert) 
                        ? 'bg-red-500' : 'bg-orange-400'        
                    }`}>
                    </div>

                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                      alert.brand_name === 'SYSTEM_UPDATE' 
                        ? 'bg-blue-50 text-blue-500 group-hover:bg-blue-100' 
                        : (alert.cdsco_approval_status === 'banned' || alert.is_counterfeit_alert) 
                          ? 'bg-red-50 text-red-500 group-hover:bg-red-100' 
                          : 'bg-orange-50 text-orange-500 group-hover:bg-orange-100'
                    }`}>
                      {alert.brand_name === 'SYSTEM_UPDATE' ? (
                        <Globe size={20} strokeWidth={2.5} />
                      ) : (
                        <AlertTriangle size={20} strokeWidth={2.5} />
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <h4 className="font-bold text-slate-800 leading-tight">{alert.brand_name}</h4>
                        <span className="text-[11px] font-medium text-slate-400">{formatRelativeTime(alert.created_at)}</span>
                      </div>
                      <p className="text-sm text-slate-500 mt-1 font-medium leading-snug">
                        {alert.composition} Batch <span className="font-bold text-slate-700">{alert.batch_number}</span>
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-sm text-slate-400 py-12">No current regulatory alerts recorded.</p>
              )}
            </div>
            <div className="p-4 bg-white border-t border-slate-100">
              <Link href="/alerts" className="block w-full">
                <button className="w-full py-3 bg-slate-50 text-slate-700 font-bold rounded-xl hover:bg-slate-100 transition-colors cursor-pointer">
                  View Full Alert Log
                </button>
              </Link>
            </div>
          </div>

                    {/* AI Assistant Promo */}
                    <div className="relative overflow-hidden rounded-3xl bg-emerald-600 p-8 text-white shadow-xl shadow-emerald-600/20">
                        <div className="absolute -right-12 -bottom-12 rounded-full bg-emerald-500 p-12 opacity-50 blur-3xl"></div>
                        <div className="relative z-10 space-y-6">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-md">
                                <MessageCircle size={24} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black">AI Health Assistant</h3>
                                <p className="mt-2 leading-relaxed font-medium text-emerald-100">
                                    Have questions about your prescription or symptoms? Chat with
                                    our AI assistant for instant, verified health guidance.
                                </p>
                            </div>
                            <button
                                onClick={() => handleNavigation("health")}
                                className="rounded-2xl bg-white px-6 py-3 font-bold text-emerald-600 transition-colors hover:bg-emerald-50"
                            >
                                Try Assistant
                            </button>
                        </div>
                    </div>
                </div>
            </main>

            {/* Spacer for mobile nav */}
            <div className="h-16 md:hidden"></div>

      {/* ── Mobile Bottom Navigation ── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-slate-200/60 flex justify-around px-2 py-3 items-center z-50 pb-[env(safe-area-inset-bottom)]"
        aria-label="Mobile navigation"
      >
        <Link
          href="/"
          className="flex flex-col items-center gap-1.5 w-16 group"
          aria-label="Home"
        >
          <div className="text-emerald-600 group-hover:-translate-y-1 transition-transform">
            <Home size={24} strokeWidth={2.5} />
          </div>

          <span className="text-[11px] font-bold text-emerald-600">
            Home
          </span>
        </Link>

        <Link
          href="/scan"
          className="flex flex-col items-center gap-1.5 w-16 group text-slate-400 hover:text-slate-600 transition-colors"
          aria-label="Scans"
        >
          <div className="group-hover:-translate-y-1 transition-transform">
            <History size={24} strokeWidth={2} />
          </div>

          <span className="text-[11px] font-semibold">
            Scans
          </span>
        </Link>

        <Link
          href="/map"
          className="flex flex-col items-center gap-1.5 w-16 group text-slate-400 hover:text-amber-600 transition-colors"
          aria-label="Map"
        >
          <div className="group-hover:-translate-y-1 transition-transform">
            <MapPin size={24} strokeWidth={2} />
          </div>

          <span className="text-[11px] font-semibold">
            Map
          </span>
        </Link>

        <Link
          href="/alerts"
          className="flex flex-col items-center gap-1.5 w-16 group text-slate-400 hover:text-red-500 transition-colors"
          aria-label="Alerts"
        >
          <div className="relative group-hover:-translate-y-1 transition-transform">
            <Bell size={24} strokeWidth={2} />
            <span className="absolute top-0 right-0.5 w-2 h-2 bg-red-500 border border-white rounded-full animate-pulse"></span>
          </div>

          <span className="text-[11px] font-semibold">
            Alerts
          </span>
        </Link>

        <Link
          href="/profile"
          className="flex flex-col items-center gap-1.5 w-16 group text-slate-400 hover:text-emerald-600 transition-colors"
          aria-label="Profile"
        >
          <div className="group-hover:-translate-y-1 transition-transform">
            <User size={24} strokeWidth={2} />
          </div>

          <span className="text-[11px] font-semibold">
            Profile
          </span>
        </Link>
      </nav>
      <Footer />
    </div>
  );
}