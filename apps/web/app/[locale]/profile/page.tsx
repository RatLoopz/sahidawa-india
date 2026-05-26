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
    <div className="min-h-screen bg-(--color-surface-muted) text-(--color-text-primary) px-6 py-8">
      <div className="max-w-3xl mx-auto">

        {/* Back Button */}
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 rounded-xl px-3 py-2 font-medium text-(--color-text-secondary) transition-all hover:bg-(--color-surface-page) hover:text-emerald-600 dark:hover:text-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
          <ArrowLeft size={18} />

          <span className="font-medium">
            Back to Home
          </span>
        </Link>

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-16 h-16 rounded-3xl bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-sm">
            <User size={30} />
          </div>

          <div>
            <h1 className="text-2xl font-black text-(--color-text-primary) sm:text-3xl">
              Your Profile
            </h1>

            <p className="text-(--color-text-secondary) mt-1">
              Manage your account and medicine activity.
            </p>
          </div>
        </div>

        {/* Profile Card */}
        <div className="bg-(--color-surface-page) rounded-3xl border border-(--color-border-muted) shadow-sm overflow-hidden">

          {/* User Info */}
          <div className="p-6 flex items-center justify-between border-b border-(--color-border-muted)">
            <div>
              <h2 className="font-bold text-(--color-text-primary)">
                Guest User
              </h2>

              <p className="text-sm text-(--color-text-secondary) mt-1">
                No account connected
              </p>
            </div>

            <div className="w-12 h-12 rounded-2xl bg-(--color-surface-muted) flex items-center justify-center">
              <ShieldCheck
                className="text-emerald-600 dark:text-emerald-400"
                size={24}
              />
            </div>
          </div>

          {/* Menu Items */}
          <div className="divide-y divide-(--color-border-muted)">

            <button className="w-full flex items-center justify-between p-5 hover:bg-(--color-surface-muted) transition-colors">
              <div className="flex items-center gap-3">
                <Bell
                  size={20}
                  className="text-red-500"
                />

                <span className="font-semibold text-(--color-text-primary)">
                  Notification Settings
                </span>
              </div>

              <ChevronRight
                size={18}
                className="text-(--color-text-muted)"
              />
            </button>

            <button className="w-full flex items-center justify-between p-5 hover:bg-(--color-surface-muted) transition-colors">
              <div className="flex items-center gap-3">
                <ShieldCheck
                  size={20}
                  className="text-emerald-600 dark:text-emerald-400"
                />

                <span className="font-semibold text-(--color-text-primary)">
                  Privacy & Security
                </span>
              </div>

              <ChevronRight
                size={18}
                className="text-(--color-text-muted)"
              />
            </button>

          </div>
        </div>
      </div>
    </div>
  );
}