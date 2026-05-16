"use client";

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
import { Link } from "@/i18n/routing";
import { useTranslations } from 'next-intl';
import { useRouter, useParams } from "next/navigation";
import LanguageSwitcher from "./LanguageSwitcher";
import Footer from "./components/Footer";

export default function SahiDawaHome() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale;
  const tHome = useTranslations('Home');
  const tNav = useTranslations('Navigation');

  const handleNavigation = (path: string) => {
    router.push(`/${locale}/${path}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-emerald-200">
      {/* Navigation */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur-lg">
        <div className="container mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-sm"
              aria-label="SahiDawa Logo"
            >
              <ShieldCheck size={24} strokeWidth={2.5} />
            </div>
            <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-slate-800">
              SahiDawa
            </h1>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <nav className="hidden lg:flex items-center gap-6 text-sm font-semibold text-slate-600" aria-label="Main navigation">
              <button className="hover:text-emerald-600 transition-colors">
                {tNav('how_it_works')}
              </button>
              <button className="hover:text-emerald-600 transition-colors">
                {tNav('alerts')}
              </button>
              <Link href="/map" className="hover:text-emerald-600 transition-colors">
                {tNav('pharmacy_map')}
              </Link>
            </nav>
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 pt-8 pb-24 md:pb-12 max-w-6xl">
        {/* Hero Section */}
        <div className="text-center space-y-6 py-12 md:py-20">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 text-emerald-700 text-sm font-bold border border-emerald-100 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            GSSoC 2026 Open Source Project
          </div>
          <h2 className="text-4xl md:text-6xl font-black tracking-tight text-slate-900 leading-[1.1]">
            {tHome('title')}
          </h2>
          <p className="text-slate-500 text-lg md:text-xl font-medium max-w-2xl mx-auto leading-relaxed">
            {tHome('subtitle')}
          </p>
        </div>

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
          {/* Scan Action */}
          <Link 
            href="/scan" 
            className="group p-8 rounded-[2.5rem] bg-slate-900 text-white shadow-xl shadow-slate-900/20 hover:-translate-y-2 transition-all duration-300 relative overflow-hidden"
            aria-label="Scan medicine"
          >
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform">
              <Camera size={120} />
            </div>
            <div className="relative z-10 space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg">
                <Camera size={28} />
              </div>
              <div>
                <h3 className="text-2xl font-black tracking-tight">{tHome('scan_button')}</h3>
                <p className="text-slate-400 font-medium mt-1">{tHome('scan_subtitle')}</p>
              </div>
              <div className="flex items-center gap-2 text-emerald-400 font-bold pt-2">
                Launch Scanner <ChevronRight size={18} />
              </div>
            </div>
          </Link>

          {/* Voice Action */}
          <Link 
            href="/voice" 
            className="group p-8 rounded-[2.5rem] bg-white border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-2 transition-all duration-300 relative overflow-hidden"
            aria-label="Voice triage"
          >
             <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform">
              <Mic size={120} />
            </div>
            <div className="relative z-10 space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center">
                <Mic size={28} />
              </div>
              <div>
                <h3 className="text-2xl font-black tracking-tight text-slate-800">{tHome('voice_triage')}</h3>
                <p className="text-slate-500 font-medium mt-1">{tHome('voice_subtitle')}</p>
              </div>
              <div className="flex items-center gap-2 text-blue-600 font-bold pt-2">
                Start Consultation <ChevronRight size={18} />
              </div>
            </div>
          </Link>

          {/* Map Action */}
          <Link 
            href="/map" 
            className="group p-8 rounded-[2.5rem] bg-white border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-2 transition-all duration-300 relative overflow-hidden"
            aria-label="Find pharmacy map"
          >
             <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform">
              <MapPin size={120} />
            </div>
            <div className="relative z-10 space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center">
                <MapPin size={28} />
              </div>
              <div>
                <h3 className="text-2xl font-black tracking-tight text-slate-800">{tHome('pharmacy_map')}</h3>
                <p className="text-slate-500 font-medium mt-1">{tHome('pharmacy_subtitle')}</p>
              </div>
              <div className="flex items-center gap-2 text-amber-600 font-bold pt-2">
                Open Map <ChevronRight size={18} />
              </div>
            </div>
          </Link>
        </div>

        {/* Global Search */}
        <div className="mt-16 bg-white border border-slate-200 rounded-[3rem] p-4 shadow-sm focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all">
          <div className="flex items-center gap-2 sm:gap-4 px-2">
            <Search className="text-slate-400 ml-2" size={24} />
            <input 
              type="text" 
              placeholder={tHome('search_placeholder')}
              className="w-full bg-transparent border-none outline-none px-4 py-3 text-slate-700 font-medium placeholder:text-slate-400"
              aria-label="Search medicine or batch"
            />
            <button className="bg-slate-900 text-white px-5 sm:px-6 py-3 rounded-2xl font-bold hover:bg-slate-800 transition-colors text-sm sm:text-base">
              {tHome('search_button')}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-12 mb-20">
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
                <div className="bg-white border border-red-100 rounded-2xl p-4 shadow-sm flex items-start gap-4 relative overflow-hidden group hover:shadow-md transition-shadow cursor-pointer">
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-500"></div>
                  <div className="w-10 h-10 rounded-full bg-red-50 text-red-500 flex items-center justify-center shrink-0 group-hover:bg-red-100 transition-colors">
                    <AlertTriangle size={20} strokeWidth={2.5} />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <h4 className="font-bold text-slate-800 leading-tight">Augmentin 625 Duo</h4>
                      <span className="text-[11px] font-medium text-slate-400">2h ago</span>
                    </div>
                    <p className="text-sm text-slate-500 mt-1 font-medium leading-snug">
                      Batch No. <span className="font-bold text-slate-700">B23059</span> reported suspicious by 12 users.
                    </p>
                  </div>
                </div>

                <div className="bg-white border border-orange-100 rounded-2xl p-4 shadow-sm flex items-start gap-4 relative overflow-hidden group hover:shadow-md transition-shadow cursor-pointer">
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-orange-400"></div>
                  <div className="w-10 h-10 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center shrink-0 group-hover:bg-orange-100 transition-colors">
                    <AlertTriangle size={20} strokeWidth={2.5} />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <h4 className="font-bold text-slate-800 leading-tight">Pan 40</h4>
                      <span className="text-[11px] font-medium text-slate-400">5h ago</span>
                    </div>
                    <p className="text-sm text-slate-500 mt-1 font-medium leading-snug">
                      Substandard quality detected in UP region. Batch <span className="font-bold text-slate-700">UP992</span>.
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-white border-t border-slate-100">
                <button className="w-full py-3 bg-slate-50 text-slate-700 font-bold rounded-xl hover:bg-slate-100 transition-colors">
                  View Full Alert Log
                </button>
              </div>
            </div>

            {/* AI Assistant Promo */}
            <div className="bg-emerald-600 rounded-3xl p-8 text-white relative overflow-hidden shadow-xl shadow-emerald-600/20">
               <div className="absolute -bottom-12 -right-12 p-12 bg-emerald-500 rounded-full opacity-50 blur-3xl"></div>
               <div className="relative z-10 space-y-6">
                  <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                    <MessageCircle size={24} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black">AI Health Assistant</h3>
                    <p className="text-emerald-100 font-medium mt-2 leading-relaxed">
                      Have questions about your prescription or symptoms? Chat with our AI assistant for instant, verified health guidance.
                    </p>
                  </div>
                  <button className="px-6 py-3 bg-white text-emerald-600 font-bold rounded-2xl hover:bg-emerald-50 transition-colors">
                    Try Assistant
                  </button>
               </div>
            </div>
        </div>
      </main>

      <div className="h-16 md:hidden"></div>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-slate-200/60 flex justify-around px-2 py-3 items-center z-50 pb-[env(safe-area-inset-bottom)]" aria-label="Mobile navigation">
        <Link href="/" className="flex flex-col items-center gap-1.5 w-16 group" aria-label="Go to home">
          <div className="text-emerald-600 group-hover:-translate-y-1 transition-transform">
            <Home size={24} strokeWidth={2.5} />
          </div>
          <span className="text-[11px] font-bold text-emerald-600">Home</span>
        </Link>
        <Link href="/scan" className="flex flex-col items-center gap-1.5 w-16 group text-slate-400 hover:text-slate-600 transition-colors" aria-label="Go to scan history">
          <div className="group-hover:-translate-y-1 transition-transform">
            <History size={24} strokeWidth={2} />
          </div>
          <span className="text-[11px] font-semibold">Scans</span>
        </Link>
        <Link href="/map" className="flex flex-col items-center gap-1.5 w-16 group text-slate-400 hover:text-amber-600 transition-colors" aria-label="Go to pharmacy map">
          <div className="group-hover:-translate-y-1 transition-transform">
            <MapPin size={24} strokeWidth={2} />
          </div>
          <span className="text-[11px] font-semibold">Map</span>
        </Link>
        <button className="flex flex-col items-center gap-1.5 w-16 group text-slate-400 hover:text-slate-600 transition-colors" aria-label="Go to alerts">
          <div className="relative group-hover:-translate-y-1 transition-transform">
            <Bell size={24} strokeWidth={2} />
            <span className="absolute top-0 right-0.5 w-2 h-2 bg-red-500 border border-white rounded-full"></span>
          </div>
          <span className="text-[11px] font-semibold">Alerts</span>
        </button>
        <button className="flex flex-col items-center gap-1.5 w-16 group text-slate-400 hover:text-slate-600 transition-colors" aria-label="Go to profile">
          <div className="group-hover:-translate-y-1 transition-transform">
            <User size={24} strokeWidth={2} />
          </div>
          <span className="text-[11px] font-semibold">Profile</span>
        </button>
      </nav>
      <Footer />
    </div>
  );
}