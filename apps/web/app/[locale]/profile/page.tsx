"use client";

import { User, ShieldCheck, Bell, ChevronRight } from "lucide-react";
import { PageHeader } from "../components/PageHeader";

export default function ProfilePage() {
    return (
        <main className="min-h-screen bg-(--color-surface-muted) text-(--color-text-primary)">
            <PageHeader backHref="/" variant="light" showThemeToggle={false} />

            <div className="mx-auto max-w-3xl px-6 py-8">
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
        </main>
    );
}
