"use client";

import { Link } from "@/i18n/routing";
import { User, ShieldCheck, Bell, ChevronRight, ArrowLeft } from "lucide-react";

export default function ProfilePage() {
    return (
        <div className="flex-grow bg-(--color-surface-muted) px-6 py-8 text-(--color-text-primary)">
            <div className="mx-auto max-w-3xl">
                {/* Back Button */}
                <Link
                    href="/"
                    className="mb-6 inline-flex items-center gap-2 rounded-xl px-3 py-2 font-medium text-(--color-text-secondary) transition-all hover:bg-(--color-surface-page) hover:text-emerald-600 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none dark:hover:text-emerald-400"
                >
                    <ArrowLeft size={18} />

                    <span className="font-medium">Back to Home</span>
                </Link>

                {/* Header */}
                <div className="mb-8 flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-600 shadow-sm dark:bg-emerald-950/30 dark:text-emerald-400">
                        <User size={30} />
                    </div>

                    <div>
                        <h1 className="text-2xl font-black text-(--color-text-primary) sm:text-3xl">
                            Your Profile
                        </h1>

                        <p className="mt-1 text-(--color-text-secondary)">
                            Manage your account and medicine activity.
                        </p>
                    </div>
                </div>

                {/* Profile Card */}
                <div className="overflow-hidden rounded-3xl border border-(--color-border-muted) bg-(--color-surface-page) shadow-sm">
                    {/* User Info */}
                    <div className="flex items-center justify-between border-b border-(--color-border-muted) p-6">
                        <div>
                            <h2 className="font-bold text-(--color-text-primary)">Guest User</h2>

                            <p className="mt-1 text-sm text-(--color-text-secondary)">
                                No account connected
                            </p>
                        </div>

                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-(--color-surface-muted)">
                            <ShieldCheck
                                className="text-emerald-600 dark:text-emerald-400"
                                size={24}
                            />
                        </div>
                    </div>

                    {/* Menu Items */}
                    <div className="divide-y divide-(--color-border-muted)">
                        <button className="flex w-full items-center justify-between p-5 transition-colors hover:bg-(--color-surface-muted)">
                            <div className="flex items-center gap-3">
                                <Bell size={20} className="text-red-500" />

                                <span className="font-semibold text-(--color-text-primary)">
                                    Notification Settings
                                </span>
                            </div>

                            <ChevronRight size={18} className="text-(--color-text-muted)" />
                        </button>

                        <button className="flex w-full items-center justify-between p-5 transition-colors hover:bg-(--color-surface-muted)">
                            <div className="flex items-center gap-3">
                                <ShieldCheck
                                    size={20}
                                    className="text-emerald-600 dark:text-emerald-400"
                                />

                                <span className="font-semibold text-(--color-text-primary)">
                                    Privacy & Security
                                </span>
                            </div>

                            <ChevronRight size={18} className="text-(--color-text-muted)" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
