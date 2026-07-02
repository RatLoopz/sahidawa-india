"use client";

import React, { useState, useRef, useEffect } from "react";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { User, History, Clock, Settings, LogOut, LogIn, ChevronDown } from "lucide-react";
import { Session } from "@supabase/supabase-js";

interface UserDropdownProps {
    session: Session | null;
    authLoading: boolean;
    handleSignOut: () => void;
}

export default function UserDropdown({ session, authLoading, handleSignOut }: UserDropdownProps) {
    const tHome = useTranslations("Home");
    const tNav = useTranslations("Navigation");
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const profileRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Element;
            const isOutsideProfile = profileRef.current && !profileRef.current.contains(target);
            const isInsideDropdown =
                target.closest("[data-radix-popper-content]") ||
                target.closest('[role="menu"]') ||
                target.closest('[role="dialog"]') ||
                target.closest('[id^="radix-"]');

            if (isOutsideProfile && !isInsideDropdown) {
                setIsProfileOpen(false);
            }
        };
        if (isProfileOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isProfileOpen]);

    if (authLoading) {
        return (
            <div className="hidden h-9 w-24 animate-pulse rounded-full bg-slate-200 sm:block sm:h-10 dark:bg-slate-800" />
        );
    }

    if (!session) {
        return (
            <Link
                href="/login"
                className="hidden h-9 items-center justify-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-50/50 px-4 py-1.5 text-sm font-bold text-emerald-700 transition-all duration-200 hover:scale-105 hover:border-emerald-500/50 hover:bg-emerald-100 sm:flex sm:h-10 sm:px-5 sm:py-2 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20"
                aria-label={tHome("sign_in")}
            >
                <LogIn size={16} />
                <span>{tHome("sign_in")}</span>
            </Link>
        );
    }

    return (
        <div className="relative hidden sm:block" ref={profileRef}>
            <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex h-9 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 sm:h-10 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                    <User size={14} />
                </div>
                <span className="max-w-[100px] truncate">
                    {session.user?.user_metadata?.full_name ||
                        session.user?.email?.split("@")[0] ||
                        "Profile"}
                </span>
                <ChevronDown size={14} className="text-slate-400" />
            </button>

            {isProfileOpen && (
                <div className="animate-in fade-in slide-in-from-top-2 absolute top-full right-0 z-[100] mt-2 w-56 origin-top-right rounded-xl border border-slate-200 bg-white p-2 shadow-xl duration-150 dark:border-slate-800 dark:bg-slate-950">
                    <div className="mb-2 border-b border-slate-100 px-2 pt-1 pb-2 dark:border-slate-900">
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {session.user?.user_metadata?.full_name || "Signed-in User"}
                        </p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                            {session.user?.email}
                        </p>
                    </div>
                    <div className="flex flex-col gap-1">
                        <Link
                            href="/profile"
                            onClick={() => setIsProfileOpen(false)}
                            className="flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                            <User size={16} />
                            Profile Dashboard
                        </Link>
                        <Link
                            href="/reports/me"
                            onClick={() => setIsProfileOpen(false)}
                            className="flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                            <History size={16} />
                            {tNav("my_reports")}
                        </Link>
                        <Link
                            href="/schedule"
                            onClick={() => setIsProfileOpen(false)}
                            className="flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                            <Clock size={16} />
                            {tNav("schedule")}
                        </Link>
                        <Link
                            href="/settings"
                            onClick={() => setIsProfileOpen(false)}
                            className="flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                            <Settings size={16} />
                            Settings
                        </Link>
                        <div className="my-1 border-t border-slate-100 dark:border-slate-900" />
                        <button
                            onClick={handleSignOut}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                        >
                            <LogOut size={16} />
                            Sign Out
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
