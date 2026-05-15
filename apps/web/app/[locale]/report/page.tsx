import { ShieldCheck, Search, Lock, CheckCircle2, Clock, ChevronRight } from "lucide-react";
import ReportWizard from "@/components/reports/ReportWizard";
import { PageHeader } from "../components/PageHeader";

export const metadata = {
  title: "Report Fake Medicine — MedWatch",
  description:
    "Report suspicious or counterfeit medicines found at pharmacies. Help protect your community.",
};

export default function ReportPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-emerald-200 flex flex-col">
      {/* Header component */}
      <PageHeader 
        title="Report Incident" 
        subtitle="Public Safety Initiative" 
        backHref="/" 
        variant="light" 
      />

      <main className="container mx-auto px-4 md:px-6 pt-8 pb-20 flex-1 relative z-10">
        
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-100/40 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-teal-100/40 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none"></div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 relative z-10">
          
          {/* Left Column: Hero & Form */}
          <div className="lg:col-span-7 space-y-8">
            {/* Hero Section */}
            <div className="space-y-4 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm font-bold tracking-wide">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Active Surveillance
              </div>
              <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight leading-[1.1]">
                Report a <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500">
                  Suspicious Medicine
                </span>
              </h1>
              <p className="text-lg text-slate-500 font-medium leading-relaxed max-w-xl">
                Your vigilance protects public health. Report suspected counterfeit, expired, or substandard medicines. All reports are investigated by India's Pharmacovigilance authorities.
              </p>
            </div>

            {/* Wizard Component */}
            <div className="mt-8">
              <ReportWizard />
            </div>
          </div>

          {/* Right Column: Dashboard & Info */}
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
        </div>
      </main>
    </div>
  );
}
