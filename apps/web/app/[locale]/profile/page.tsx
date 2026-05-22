import Link from "next/link";
import {
  User,
  ShieldCheck,
  Bell,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";

export default function ProfilePage() {
  return (
    <div className="min-h-screen bg-slate-50 px-6 py-8">
      <div className="max-w-3xl mx-auto">

        {/* Back Button */}
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 rounded-xl px-3 py-2 font-medium text-slate-700 transition-all hover:bg-white hover:text-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
          <ArrowLeft size={18} />

          <span className="font-medium">
            Back to Home
          </span>
        </Link>

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-sm">
            <User size={30} />
          </div>

          <div>
            <h1 className="text-2xl font-black text-slate-800 sm:text-3xl">
              Your Profile
            </h1>

            <p className="text-slate-500 mt-1">
              Manage your account and medicine activity.
            </p>
          </div>
        </div>

        {/* Profile Card */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">

          {/* User Info */}
          <div className="p-6 flex items-center justify-between border-b border-slate-100">
            <div>
              <h2 className="font-bold text-slate-800">
                Guest User
              </h2>

              <p className="text-sm text-slate-500 mt-1">
                No account connected
              </p>
            </div>

            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
              <ShieldCheck
                className="text-emerald-600"
                size={24}
              />
            </div>
          </div>

          {/* Menu Items */}
          <div className="divide-y divide-slate-100">

            <button className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3">
                <Bell
                  size={20}
                  className="text-red-500"
                />

                <span className="font-semibold text-slate-700">
                  Notification Settings
                </span>
              </div>

              <ChevronRight
                size={18}
                className="text-slate-400"
              />
            </button>

            <button className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3">
                <ShieldCheck
                  size={20}
                  className="text-emerald-600"
                />

                <span className="font-semibold text-slate-700">
                  Privacy & Security
                </span>
              </div>

              <ChevronRight
                size={18}
                className="text-slate-400"
              />
            </button>

          </div>
        </div>
      </div>
    </div>
  );
}