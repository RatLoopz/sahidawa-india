"use client";

import {
  CheckCircle2,
  ChevronRight,
  Clock,
  Lock,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useTranslations } from "next-intl";

export default function ReportInfoPanel() {
  const t = useTranslations("ReportInfoPanel");

  return (
    <div className="lg:col-span-5 space-y-6 lg:mt-24">
      {/* Quick Verify */}
      <div className="bg-(--color-surface-page) rounded-3xl p-6 shadow-sm border border-(--color-border-muted)">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Search size={20} strokeWidth={2.5} />
          </div>
          <div>
            <h3 className="font-bold text-(--color-text-primary)">{t("quick_verify")}</h3>
            <p className="text-xs text-(--color-text-secondary) font-medium">{t("check_if_reported")}</p>
          </div>
        </div>
        <div className="relative">
          <input
            type="text"
            placeholder={t("batch_placeholder")}
            className="w-full bg-(--color-surface-muted) border border-(--color-border-muted) text-(--color-text-primary) placeholder-(--color-text-muted) rounded-2xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
          />
          <button className="absolute right-2 top-2 bottom-2 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 px-3 rounded-xl hover:bg-slate-800 transition-colors flex items-center justify-center">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Trust & Safety Card */}
      <div className="bg-(--color-surface-page) rounded-[2rem] p-8 shadow-sm border border-(--color-border-muted) overflow-hidden relative">
        <div className="absolute top-0 left-0 right-0 h-2 bg-emerald-500"></div>

        <div className="flex items-center gap-3 mb-8">
          <ShieldCheck className="text-emerald-500" size={28} strokeWidth={2.5} />
          <h3 className="text-xl font-bold text-(--color-text-primary)">{t("trust_safety")}</h3>
        </div>

        <div className="space-y-6">
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Lock size={18} strokeWidth={2.5} />
            </div>
            <div>
              <h4 className="font-bold text-(--color-text-primary)">{t("anonymity_title")}</h4>
              <p className="text-sm text-(--color-text-secondary) font-medium leading-relaxed mt-1">
                {t("anonymity_desc")}
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 size={18} strokeWidth={2.5} />
            </div>
            <div>
              <h4 className="font-bold text-(--color-text-primary)">{t("verified_title")}</h4>
              <p className="text-sm text-(--color-text-secondary) font-medium leading-relaxed mt-1">
                {t("verified_desc")}
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Clock size={18} strokeWidth={2.5} />
            </div>
            <div>
              <h4 className="font-bold text-(--color-text-primary)">{t("review_title")}</h4>
              <p className="text-sm text-(--color-text-secondary) font-medium leading-relaxed mt-1">
                {t("review_desc")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
