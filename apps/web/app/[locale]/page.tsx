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
  LogOut,
  Rocket,
} from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import { useSession, signOut } from "next-auth/react";

export default function SahiDawaHome() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale;
  const { data: session, status } = useSession();

  const handleNavigation = (path: string) => {
    router.push(`/${locale}/${path}`);
  };

  const handleProtectedNavigation = (path: string) => {
    if (!session) {
      router.push(`/${locale}/login`);
    } else {
      router.push(`/${locale}/${path}`);
    }
  };

  const handleLogout = async () => {
    await signOut({ callbackUrl: `/${locale}` });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-emerald-200">
      {/* Navigation */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur-lg">
        <div className="container mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-sm">
              <ShieldCheck size={24} strokeWidth={2.5} />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-800">
              SahiDawa
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-600">
              <button className="hover:text-emerald-600 transition-colors">
                How it Works
              </button>
              <button className="hover:text-emerald-600 transition-colors">
                Alerts
              </button>
              <button className="hover:text-emerald-600 transition-colors">
                Pharmacy Map
              </button>
            </nav>
            
            {/* AI Health Assistant Button */}
            <button
              onClick={() => handleNavigation('health')}
              className="flex items-center gap-2 text-sm font-semibold px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-full hover:shadow-lg hover:scale-105 transition-all duration-200"
            >
              <MessageCircle size={16} />
              <span className="hidden sm:inline">AI Health Assistant</span>
              <span className="sm:hidden">AI Chat</span>
            </button>
            
            {/* Language Button */}
            <button className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 bg-slate-100 border border-slate-200 text-slate-700 rounded-full hover:bg-slate-200 transition-colors shadow-sm">
              <Globe size={16} className="text-emerald-600" />
              <span className="hidden sm:inline">English</span>
              <span className="sm:hidden">EN</span>
            </button>

            {/* Auth Section */}
            {status === "loading" ? (
              <div className="w-24 h-9 bg-slate-100 rounded-full animate-pulse"></div>
            ) : session ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleNavigation('profile')}
                  className="flex items-center gap-2 text-sm font-semibold px-4 py-2 bg-emerald-100 text-emerald-700 rounded-full hover:bg-emerald-200 transition-colors cursor-pointer"
                >
                  <User size={16} />
                  <span className="hidden sm:inline">
                    {session.user?.name?.split(' ')[0] || 'Account'}
                  </span>
                </button>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 bg-red-50 text-red-600 rounded-full hover:bg-red-100 transition-colors"
                >
                  <LogOut size={16} />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleNavigation('signup')}
                className="flex items-center gap-2 text-sm font-semibold px-5 py-2 bg-emerald-600 text-white rounded-full hover:bg-emerald-700 transition-colors shadow-md hover:shadow-lg"
              >
                <Rocket size={16} />
                <span>Get Started</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Rest of your original homepage content - keep the design you had before */}
      <main className="container mx-auto px-4 md:px-6 pt-8 pb-20">
        {/* Add your original hero section and other content here */}
        <div className="text-center py-12">
          <h1 className="text-4xl font-bold">Welcome to SahiDawa</h1>
          <p className="mt-4 text-slate-600">Your health verification platform</p>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-slate-200/60 flex justify-around px-2 py-3 items-center z-50 pb-safe">
        <button 
          onClick={() => handleNavigation('/')}
          className="flex flex-col items-center gap-1.5 w-16 group"
        >
          <div className="text-emerald-600 group-hover:-translate-y-1 transition-transform">
            <Home size={24} strokeWidth={2.5} />
          </div>
          <span className="text-[11px] font-bold text-emerald-600">Home</span>
        </button>

        <button 
          onClick={() => handleProtectedNavigation('history')}
          className="flex flex-col items-center gap-1.5 w-16 group text-slate-400 hover:text-slate-600 transition-colors"
        >
          <div className="group-hover:-translate-y-1 transition-transform">
            <History size={24} strokeWidth={2} />
          </div>
          <span className="text-[11px] font-semibold">Scans</span>
        </button>

        <button 
          onClick={() => handleProtectedNavigation('alerts')}
          className="flex flex-col items-center gap-1.5 w-16 group text-slate-400 hover:text-slate-600 transition-colors"
        >
          <div className="relative group-hover:-translate-y-1 transition-transform">
            <Bell size={24} strokeWidth={2} />
            <span className="absolute top-0 right-0.5 w-2 h-2 bg-red-500 border border-white rounded-full"></span>
          </div>
          <span className="text-[11px] font-semibold">Alerts</span>
        </button>

        <button 
          onClick={() => handleProtectedNavigation('profile')}
          className="flex flex-col items-center gap-1.5 w-16 group text-slate-400 hover:text-slate-600 transition-colors"
        >
          <div className="group-hover:-translate-y-1 transition-transform">
            <User size={24} strokeWidth={2} />
          </div>
          <span className="text-[11px] font-semibold">Profile</span>
        </button>
      </nav>
    </div>
  );
}