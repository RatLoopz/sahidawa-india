"use client";

import React from "react";
import { Link } from "@/i18n/routing";
import { Home, Camera, AlertCircle } from "lucide-react";

export default function NotFound() {
    return (
        <div className="relative flex flex-grow flex-col items-center justify-center px-4 py-16 text-center">
            {/* ── Background Soft Glows ── */}
            <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden select-none">
                <div className="absolute top-1/4 left-1/2 h-[350px] w-[350px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/10 blur-[80px] dark:bg-emerald-900/10"></div>
                <div className="absolute bottom-1/4 left-1/3 h-[300px] w-[300px] rounded-full bg-purple-500/5 blur-[90px] dark:bg-purple-900/5"></div>
            </div>

            {/* ── Main Glassmorphic Container ── */}
            <div className="relative z-10 w-full max-w-md overflow-hidden rounded-[2.5rem] border border-(--color-border-muted) bg-white/40 p-8 shadow-2xl backdrop-blur-md sm:p-10 dark:bg-slate-900/40">
                {/* Accent Top Strip */}
                <div className="absolute top-0 right-0 left-0 h-1.5 bg-linear-to-r from-emerald-500 to-teal-500"></div>

                {/* Pulsing Warning Icon */}
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 shadow-inner dark:bg-emerald-950/40 dark:text-emerald-400">
                    <AlertCircle size={44} strokeWidth={2} className="animate-pulse" />
                </div>

                {/* 404 Large Badge */}
                <span className="inline-block rounded-full bg-emerald-500/10 px-4 py-1 text-xs font-extrabold tracking-widest text-emerald-600 uppercase dark:text-emerald-400">
                    Error 404
                </span>

                <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl dark:text-white">
                    Page Not Found
                </h1>

                <p className="mt-3 text-sm leading-relaxed font-semibold text-slate-500 dark:text-slate-400">
                    We couldn't find the medicine or page you were looking for. It might have been
                    moved, or the URL might be incorrect.
                </p>

                {/* ── Contextual Actions ── */}
                <div className="mt-8 flex flex-col gap-3">
                    {/* Primary: Back to Home */}
                    <Link
                        href="/"
                        className="group flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 py-4 font-bold text-white shadow-lg shadow-slate-900/20 transition-all hover:-translate-y-0.5 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                    >
                        <Home size={18} className="transition-transform group-hover:scale-110" />
                        <span>Back to Home</span>
                    </Link>

                    {/* Secondary: Go to Scanner */}
                    <Link
                        href="/scan"
                        className="group flex items-center justify-center gap-2 rounded-2xl border border-(--color-border-muted) bg-white/50 px-6 py-4 font-semibold text-slate-700 backdrop-blur-xs transition-all hover:-translate-y-0.5 hover:bg-white dark:bg-slate-900/50 dark:text-slate-300 dark:hover:bg-slate-900"
                    >
                        <Camera size={18} className="transition-transform group-hover:scale-110" />
                        <span>Scan Medicine</span>
                    </Link>
                </div>
            </div>
        </div>
    );
}
