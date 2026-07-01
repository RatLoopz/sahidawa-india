"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Link } from "@/i18n/routing";
import { ADMIN_API_BASE } from "@/lib/adminApi";
import {
    CheckCircle,
    Clock,
    Loader2,
    MapPin,
    RefreshCw,
    ShieldAlert,
    Store,
    XCircle,
} from "lucide-react";

type PharmacyStatus = "pending" | "approved" | "rejected";

type PendingPharmacy = {
    id: string;
    name: string;
    license_id: string | null;
    address: string;
    district: string | null;
    state: string | null;
    phone_number: string | null;
    status: PharmacyStatus;
    created_at: string;
};

function getToken(): string {
    if (globalThis.window === undefined) return "";
    return localStorage.getItem("sb-access-token") ?? "";
}

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const h = Math.floor(diff / 3_600_000);
    const d = Math.floor(diff / 86_400_000);
    if (h < 1) return "Just now";
    if (h < 24) return `${h}h ago`;
    return `${d}d ago`;
}

export default function PendingPharmaciesPage() {
    const [pharmacies, setPharmacies] = useState<PendingPharmacy[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [acting, setActing] = useState<string | null>(null);

    const authHeaders = () => ({
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
    });

    const fetchPendingPharmacies = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch(`${ADMIN_API_BASE}/pharmacies/pending`, {
                cache: "no-store",
                headers: authHeaders(),
            });

            if (res.status === 401) {
                setError("Sign in with an admin or moderator account to review pharmacies.");
                return;
            }

            if (res.status === 403) {
                setError("Your account does not have access to pharmacy moderation.");
                return;
            }

            if (!res.ok) {
                throw new Error("Failed to fetch pending pharmacies");
            }

            const data = await res.json();
            setPharmacies(data.pharmacies ?? []);
        } catch {
            setError("Pending pharmacies are unavailable. Please try again.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPendingPharmacies();
    }, [fetchPendingPharmacies]);

    const updateStatus = async (pharmacyId: string, status: Exclude<PharmacyStatus, "pending">) => {
        setActing(`${pharmacyId}:${status}`);
        setError(null);

        try {
            const res = await fetch(`${ADMIN_API_BASE}/pharmacies/${pharmacyId}/status`, {
                method: "PATCH",
                headers: authHeaders(),
                body: JSON.stringify({ status }),
            });

            if (!res.ok) {
                throw new Error("Failed to update pharmacy status");
            }

            setPharmacies((current) => current.filter((pharmacy) => pharmacy.id !== pharmacyId));
        } catch {
            setError("Could not update this pharmacy. Please try again.");
        } finally {
            setActing(null);
        }
    };

    return (
        <div className="flex min-h-screen bg-slate-50 font-sans">
            <aside className="flex w-60 shrink-0 flex-col gap-6 border-r border-slate-200 bg-white p-5">
                <div className="flex items-center gap-2 px-1">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-xs font-bold text-white">
                        S
                    </div>
                    <span className="font-bold text-slate-800">
                        SahiDawa <span className="text-emerald-600">Admin</span>
                    </span>
                </div>
                <nav className="flex flex-1 flex-col gap-0.5">
                    <Link
                        href="/admin/dashboard"
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-500 transition-all hover:bg-slate-50 hover:text-slate-800"
                    >
                        <ShieldAlert className="h-4 w-4 text-slate-400" />
                        Reports
                    </Link>
                    <Link
                        href="/admin/pharmacies"
                        className="flex w-full items-center gap-3 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-600"
                    >
                        <Store className="h-4 w-4" />
                        Pharmacies
                    </Link>
                </nav>
                <p className="px-1 text-xs text-slate-400">SahiDawa Admin v1.0</p>
            </aside>

            <main className="flex min-h-0 flex-1 flex-col">
                <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-8 py-4">
                    <div>
                        <h1 className="text-lg font-bold text-slate-900">Pending Pharmacies</h1>
                        <p className="text-xs text-slate-400">
                            Review new Jan Aushadhi Kendra registrations before they appear on the
                            map
                        </p>
                    </div>
                    <button
                        onClick={fetchPendingPharmacies}
                        className="rounded-full bg-slate-100 p-2 text-slate-500 transition hover:bg-slate-200"
                        title="Refresh"
                    >
                        <RefreshCw className="h-4 w-4" />
                    </button>
                </header>

                <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-8">
                    {/* Sub-nav tabs */}
                    <div className="border-b border-slate-200">
                        <nav className="flex gap-6" aria-label="Tabs">
                            <Link
                                href="/admin/pharmacies"
                                className="border-b-2 border-transparent px-1 pb-4 text-sm font-medium text-slate-500 hover:border-slate-300 hover:text-slate-700"
                            >
                                All Pharmacies
                            </Link>
                            <div className="border-b-2 border-emerald-500 px-1 pb-4 text-sm font-semibold text-emerald-600">
                                Pending Approval ({pharmacies.length})
                            </div>
                        </nav>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <MetricCard
                            label="Awaiting review"
                            value={pharmacies.length}
                            icon={Clock}
                            color="text-amber-500"
                            bg="bg-amber-50"
                        />
                        <MetricCard
                            label="Districts"
                            value={new Set(pharmacies.map((p) => p.district).filter(Boolean)).size}
                            icon={MapPin}
                            color="text-blue-500"
                            bg="bg-blue-50"
                        />
                        <MetricCard
                            label="Queue status"
                            value={loading ? "..." : pharmacies.length === 0 ? "Clear" : "Open"}
                            icon={Store}
                            color="text-emerald-500"
                            bg="bg-emerald-50"
                        />
                    </div>

                    {error && (
                        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-600">
                            <ShieldAlert className="mr-2 inline h-4 w-4" />
                            {error}
                        </div>
                    )}

                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                            <h2 className="font-semibold text-slate-800">Registration queue</h2>
                            <span className="text-xs text-slate-400">
                                {pharmacies.length} pending
                            </span>
                        </div>

                        {loading ? (
                            <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
                                <Loader2 className="h-5 w-5 animate-spin" />
                                Loading pharmacies...
                            </div>
                        ) : pharmacies.length === 0 ? (
                            <div className="py-16 text-center text-slate-400">
                                <CheckCircle className="mx-auto mb-2 h-10 w-10 text-emerald-400" />
                                <p className="text-sm">No pending pharmacies</p>
                            </div>
                        ) : (
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-slate-50 text-xs font-semibold tracking-wider text-slate-400 uppercase">
                                        <th className="px-6 py-3">Pharmacy</th>
                                        <th className="px-6 py-3">Location</th>
                                        <th className="px-6 py-3">License</th>
                                        <th className="px-6 py-3">Submitted</th>
                                        <th className="px-6 py-3">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {pharmacies.map((pharmacy) => (
                                        <tr
                                            key={pharmacy.id}
                                            className="transition-colors hover:bg-slate-50/60"
                                        >
                                            <td className="px-6 py-4">
                                                <p className="font-medium text-slate-800">
                                                    {pharmacy.name}
                                                </p>
                                                <p className="mt-1 max-w-md text-sm text-slate-500">
                                                    {pharmacy.address}
                                                </p>
                                                {pharmacy.phone_number && (
                                                    <p className="mt-1 text-xs text-slate-400">
                                                        {pharmacy.phone_number}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600">
                                                {pharmacy.district ?? "Unknown district"}
                                                <span className="block text-xs text-slate-400">
                                                    {pharmacy.state ?? "Unknown state"}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600">
                                                    {pharmacy.license_id ?? "N/A"}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-400">
                                                {timeAgo(pharmacy.created_at)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex gap-2">
                                                    <ActionButton
                                                        label="Approve"
                                                        icon={CheckCircle}
                                                        color="green"
                                                        loading={
                                                            acting === `${pharmacy.id}:approved`
                                                        }
                                                        disabled={Boolean(acting)}
                                                        onClick={() =>
                                                            updateStatus(pharmacy.id, "approved")
                                                        }
                                                    />
                                                    <ActionButton
                                                        label="Reject"
                                                        icon={XCircle}
                                                        color="red"
                                                        loading={
                                                            acting === `${pharmacy.id}:rejected`
                                                        }
                                                        disabled={Boolean(acting)}
                                                        onClick={() =>
                                                            updateStatus(pharmacy.id, "rejected")
                                                        }
                                                    />
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}

function MetricCard({
    label,
    value,
    icon: Icon,
    color,
    bg,
}: Readonly<{
    label: string;
    value: number | string;
    icon: React.ElementType;
    color: string;
    bg: string;
}>) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className={`mb-3 inline-flex rounded-xl p-2.5 ${bg} ${color}`}>
                <Icon className="h-5 w-5" />
            </div>
            <p className="mb-1 text-xs text-slate-400">{label}</p>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
        </div>
    );
}

function ActionButton({
    label,
    icon: Icon,
    color,
    loading,
    disabled,
    onClick,
}: Readonly<{
    label: string;
    icon: React.ElementType;
    color: "green" | "red";
    loading: boolean;
    disabled: boolean;
    onClick: () => void;
}>) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 ${
                color === "green"
                    ? "bg-green-50 text-green-600 hover:bg-green-100"
                    : "bg-red-50 text-red-600 hover:bg-red-100"
            }`}
        >
            {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
                <Icon className="h-3.5 w-3.5" />
            )}
            {label}
        </button>
    );
}
