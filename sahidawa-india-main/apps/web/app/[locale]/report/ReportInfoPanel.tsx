"use client";

import {
  CheckCircle2,
  ChevronRight,
  Clock,
  Lock,
  Search,
  ShieldCheck,
} from "lucide-react";

export default function ReportInfoPanel() {
  return (
    <div className="lg:col-span-5 space-y-6 lg:mt-24">
      {/* Quick Verify */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Search size={20} strokeWidth={2.5} />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">Quick Verify</h3>
            <p className="text-xs text-slate-500 font-medium">Check if already reported</p>
          </div>
        </div>
        <div className="relative">
          <input
            type="text"
            placeholder="Enter batch number..."
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
          />
          <button className="absolute right-2 top-2 bottom-2 bg-slate-900 text-white px-3 rounded-xl hover:bg-slate-800 transition-colors flex items-center justify-center">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Trust & Safety Card */}
      <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-200 overflow-hidden relative">
        <div className="absolute top-0 left-0 right-0 h-2 bg-emerald-500"></div>

        <div className="flex items-center gap-3 mb-8">
          <ShieldCheck className="text-emerald-500" size={28} strokeWidth={2.5} />
          <h3 className="text-xl font-bold text-slate-800">Trust & Safety</h3>
        </div>

        <div className="space-y-6">
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Lock size={18} strokeWidth={2.5} />
            </div>
            <div>
              <h4 className="font-bold text-slate-800">Anonymity Guaranteed</h4>
              <p className="text-sm text-slate-500 font-medium leading-relaxed mt-1">
                Your personal details are encrypted and never shared publicly.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 size={18} strokeWidth={2.5} />
            </div>
            <div>
              <h4 className="font-bold text-slate-800">Verified by Pharmacovigilance</h4>
              <p className="text-sm text-slate-500 font-medium leading-relaxed mt-1">
                Reports are cross-checked with official databases before alerts are issued.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Clock size={18} strokeWidth={2.5} />
            </div>
            <div>
              <h4 className="font-bold text-slate-800">48h Review Cycle</h4>
              <p className="text-sm text-slate-500 font-medium leading-relaxed mt-1">
                Critical reports are prioritized and reviewed within 48 hours.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
