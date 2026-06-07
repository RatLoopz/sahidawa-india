"use client";

import { CheckCircle2, ChevronRight, Clock, Lock, Search, ShieldCheck } from "lucide-react";

export default function ReportInfoPanel() {
    return (
        <div className="space-y-6 lg:col-span-5 lg:mt-24">
            {/* Quick Verify */}
            <div className="rounded-3xl border border-(--color-border-muted) bg-(--color-surface-page) p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400">
                        <Search size={20} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h3 className="font-bold text-(--color-text-primary)">Quick Verify</h3>
                        <p className="text-xs font-medium text-(--color-text-secondary)">
                            Check if already reported
                        </p>
                    </div>
                </div>
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Enter batch number..."
                        className="w-full rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted) px-4 py-3 text-sm font-medium text-(--color-text-primary) placeholder-(--color-text-muted) transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                    />
                    <button className="absolute top-2 right-2 bottom-2 flex items-center justify-center rounded-xl bg-slate-900 px-3 text-white transition-colors hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200">
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>

            {/* Trust & Safety Card */}
            <div className="relative overflow-hidden rounded-[2rem] border border-(--color-border-muted) bg-(--color-surface-page) p-8 shadow-sm">
                <div className="absolute top-0 right-0 left-0 h-2 bg-emerald-500"></div>

                <div className="mb-8 flex items-center gap-3">
                    <ShieldCheck className="text-emerald-500" size={28} strokeWidth={2.5} />
                    <h3 className="text-xl font-bold text-(--color-text-primary)">
                        Trust & Safety
                    </h3>
                </div>

                <div className="space-y-6">
                    <div className="flex gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
                            <Lock size={18} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h4 className="font-bold text-(--color-text-primary)">
                                Anonymity Guaranteed
                            </h4>
                            <p className="mt-1 text-sm leading-relaxed font-medium text-(--color-text-secondary)">
                                Your personal details are encrypted and never shared publicly.
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
                            <CheckCircle2 size={18} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h4 className="font-bold text-(--color-text-primary)">
                                Verified by Pharmacovigilance
                            </h4>
                            <p className="mt-1 text-sm leading-relaxed font-medium text-(--color-text-secondary)">
                                Reports are cross-checked with official databases before alerts are
                                issued.
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
                            <Clock size={18} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h4 className="font-bold text-(--color-text-primary)">
                                48h Review Cycle
                            </h4>
                            <p className="mt-1 text-sm leading-relaxed font-medium text-(--color-text-secondary)">
                                Critical reports are prioritized and reviewed within 48 hours.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
