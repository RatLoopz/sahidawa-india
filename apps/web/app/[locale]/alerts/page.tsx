import Link from "next/link";
import { Bell, AlertTriangle, ArrowLeft } from "lucide-react";

export default function AlertsPage() {
  return (
    <div className="min-h-screen bg-slate-50 px-6 py-8">
      <div className="max-w-3xl mx-auto">

        <Link
          href="/"
          className="inline-flex items-center gap-2 text-slate-500 hover:text-emerald-600 transition-colors mb-6"
        >
          <ArrowLeft size={18} />

          <span className="font-medium">
            Back to Home
          </span>
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-500 flex items-center justify-center">
            <Bell size={24} />
          </div>

          <div>
            <h1 className="text-3xl font-black text-slate-800">
              Medicine Alerts
            </h1>

            <p className="text-slate-500 mt-1">
              Safety notices and suspicious medicine reports.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white border border-red-100 rounded-3xl p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start gap-4">

              <div className="w-10 h-10 rounded-full bg-red-100 text-red-500 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </div>

              <div>
                <h2 className="font-bold text-slate-800">
                  Augmentin 625 Duo
                </h2>

                <p className="text-slate-500 text-sm mt-1">
                  Batch B23059 reported suspicious by multiple users.
                </p>

                <span className="inline-block mt-3 text-xs font-bold text-red-500 bg-red-50 px-3 py-1 rounded-full">
                  High Priority
                </span>
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
}