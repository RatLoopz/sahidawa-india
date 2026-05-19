"use client";

import { ArrowLeft, Globe, Zap } from "lucide-react";
import { Link } from "@/i18n/routing";

interface PageHeaderProps {
  title?: string;
  subtitle?: string;
  backHref: string;
  variant?: "dark" | "light";
  showLanguage?: boolean;
  languageName?: string;
  children?: React.ReactNode;
}

export const PageHeader = ({ 
  title, 
  subtitle, 
  backHref, 
  variant = "dark", 
  showLanguage = false,
  languageName,
  children 
}: PageHeaderProps) => {
  
  const isDark = variant === "dark";
  
  return (
    <header className={`no-print ${isDark ? "absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent text-white" : "relative bg-white border-b border-slate-100 shadow-sm text-slate-900"} z-50 p-4 flex flex-col gap-4`}>
      <div className="flex items-center justify-between gap-2">
        <Link 
          href={backHref} 
          aria-label="Go back to previous page"
          className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center transition-colors ${
            isDark ? "bg-white/10 backdrop-blur-md hover:bg-white/20" : "bg-slate-100 hover:bg-slate-200"
          }`}
        >
          <ArrowLeft size={24} aria-hidden="true" className={isDark ? "text-white" : "text-slate-600"} />
          <span className="sr-only">Go back</span>
        </Link>

        {children ? (
          <div className="flex-1 min-w-0">{children}</div>
        ) : (
          <div className="flex-1 flex flex-col items-center text-center min-w-0 px-2">
            <span className={`text-[10px] sm:text-xs font-bold uppercase tracking-widest truncate w-full ${isDark ? "text-emerald-400" : "text-emerald-600"}`}>
              {title}
            </span>
            <span className="text-xs sm:text-sm font-medium truncate w-full">
              {subtitle}
            </span>
          </div>
        )}

        <div className="flex items-center justify-end shrink-0">
          {showLanguage ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-full border border-slate-200 shadow-sm" role="status" aria-label={`Current language: ${languageName || "English"}`}>
              <Globe size={14} aria-hidden="true" className="text-emerald-600" />
             <span className="text-xs font-bold text-slate-700">
              {languageName || "English"}
            </span>
            </div>
          ) : isDark ? (
            <button 
              onClick={() => console.log("Quick actions menu triggered!")}
              aria-label="Quick actions" 
              className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center hover:bg-white/20 transition-colors"
            >
              <Zap size={20} aria-hidden="true" className="text-amber-400" />
              <span className="sr-only">Quick actions</span>
            </button>
          ) : (
            <div className="w-10" />
          )}
        </div>
      </div>
    </header>
  );
};
