"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Link } from "@/i18n/routing";
import { ADMIN_API_BASE } from "@/lib/adminApi";
import {
    Loader2,
    RefreshCw,
    ShieldAlert,
    Store,
    Trash2,
    Search,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";

type PharmacyStatus = "pending" | "approved" | "rejected";

type Pharmacy = {
    id: string;
    name: string;
    license_id: string | null;
    address: string;
    district: string | null;
    state: string | null;
    phone_number: string | null;
    status: PharmacyStatus;
    created_at: string;
    is_active: boolean;
    deleted_at: string | null;
};

function getToken(): string {
    if (typeof window === "undefined") return "";
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

export default function PharmaciesRegistryPage() {
    const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [acting, setActing] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const limit = 10;

    const authHeaders = () => ({
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
    });

    const fetchPharmacies = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch(`${ADMIN_API_BASE}/pharmacies?page=${page}&limit=${limit}`, {
                cache: "no-store",
                headers: authHeaders(),
            });

            if (res.status === 401) {
                setError(
                    "Sign in with an admin or moderator account to view the pharmacy registry."
                );
                return;
            }

            if (res.status === 403) {
                setError("Your account does not have access to pharmacy management.");
                return;
            }

            if (!res.ok) {
                throw new Error("Failed to fetch pharmacy registry");
            }

            const data = await res.json();
            setPharmacies(data.pharmacies ?? []);
            if (data.meta) {
                setTotalPages(data.meta.totalPages || 1);
                setTotalItems(data.meta.total || 0);
            }
        } catch {
            setError("Pharmacy registry is currently unavailable. Please try again.");
        } finally {
            setLoading(false);
        }
    }, [page]);

    useEffect(() => {
        fetchPharmacies();
    }, [fetchPharmacies]);

    const handleSoftDelete = async (pharmacyId: string) => {
        if (
            !confirm(
                "Are you sure you want to deactivate/delete this pharmacy? It will be hidden from all public searches and the map."
            )
        ) {
            return;
        }

        setActing(`${pharmacyId}:delete`);
        setError(null);

        try {
            const res = await fetch(`${ADMIN_API_BASE}/pharmacies/${pharmacyId}`, {
                method: "DELETE",
                headers: authHeaders(),
            });

            if (!res.ok) {
                throw new Error("Failed to delete pharmacy");
            }

            // Update state locally
            setPharmacies((current) =>
                current.map((p) =>
                    p.id === pharmacyId
                        ? { ...p, is_active: false, deleted_at: new Date().toISOString() }
                        : p
                )
            );
        } catch {
            setError("Could not delete this pharmacy. Please try again.");
        } finally {
            setActing(null);
        }
    };

    const handleRestore = async (pharmacyId: string) => {
        setActing(`${pharmacyId}:restore`);
        setError(null);

        try {
            const res = await fetch(`${ADMIN_API_BASE}/pharmacies/${pharmacyId}/restore`, {
                method: "POST",
                headers: authHeaders(),
            });

            if (!res.ok) {
                throw new Error("Failed to restore pharmacy");
            }

            // Update state locally
            setPharmacies((current) =>
                current.map((p) =>
                    p.id === pharmacyId ? { ...p, is_active: true, deleted_at: null } : p
                )
            );
        } catch {
            setError("Could not restore this pharmacy. Please try again.");
        } finally {
            setActing(null);
        }
    };

    // Client-side search filtering (fallback / interactive)
    const filteredPharmacies = pharmacies.filter((p) => {
        const query = searchQuery.toLowerCase();
        return (
            p.name.toLowerCase().includes(query) ||
            (p.district && p.district.toLowerCase().includes(query)) ||
            (p.state && p.state.toLowerCase().includes(query)) ||
            (p.license_id && p.license_id.toLowerCase().includes(query))
        );
    });

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
                    <div className="flex w-full items-center gap-3 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-600">
                        <Store className="h-4 w-4" />
                        Pharmacies
                    </div>
                </nav>
                <p className="px-1 text-xs text-slate-400">SahiDawa Admin v1.0</p>
            </aside>

            <main className="flex min-h-0 flex-1 flex-col">
                <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-8 py-4">
                    <div>
                        <h1 className="text-lg font-bold text-slate-900">Pharmacies Registry</h1>
                        <p className="text-xs text-slate-400">
                            Manage registered pharmacies, review states, and handle soft-deleted
                            records.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search registry..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-56 rounded-full border border-slate-200 bg-slate-50 py-2 pr-4 pl-9 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                            />
                        </div>
                        <button
                            onClick={fetchPharmacies}
                            className="rounded-full bg-slate-100 p-2 text-slate-500 transition hover:bg-slate-200"
                            title="Refresh"
                        >
                            <RefreshCw className="h-4 w-4" />
                        </button>
                    </div>
                </header>

                <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-8">
                    {/* Sub-nav tabs */}
                    <div className="border-b border-slate-200">
                        <nav className="flex gap-6" aria-label="Tabs">
                            <div className="border-b-2 border-emerald-500 px-1 pb-4 text-sm font-semibold text-emerald-600">
                                All Pharmacies ({totalItems})
                            </div>
                            <Link
                                href="/admin/pharmacies/pending"
                                className="border-b-2 border-transparent px-1 pb-4 text-sm font-medium text-slate-500 hover:border-slate-300 hover:text-slate-700"
                            >
                                Pending Approval
                            </Link>
                        </nav>
                    </div>

                    {error && (
                        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-600">
                            <ShieldAlert className="mr-2 inline h-4 w-4" />
                            {error}
                        </div>
                    )}

                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                            <h2 className="font-semibold text-slate-800">Pharmacy listings</h2>
                            <span className="text-xs text-slate-400">
                                Page {page} of {totalPages}
                            </span>
                        </div>

                        {loading ? (
                            <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
                                <Loader2 className="h-5 w-5 animate-spin" />
                                Loading registry...
                            </div>
                        ) : filteredPharmacies.length === 0 ? (
                            <div className="py-16 text-center text-slate-400">
                                <Store className="mx-auto mb-2 h-10 w-10 text-slate-300" />
                                <p className="text-sm">No pharmacies found matching your filters</p>
                            </div>
                        ) : (
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-slate-50 text-xs font-semibold tracking-wider text-slate-400 uppercase">
                                        <th className="px-6 py-3">Pharmacy</th>
                                        <th className="px-6 py-3">Location</th>
                                        <th className="px-6 py-3">License</th>
                                        <th className="px-6 py-3">Status</th>
                                        <th className="px-6 py-3">Deactivation</th>
                                        <th className="px-6 py-3">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredPharmacies.map((pharmacy) => (
                                        <tr
                                            key={pharmacy.id}
                                            className={`transition-colors ${
                                                !pharmacy.is_active
                                                    ? "bg-slate-50/60 opacity-80"
                                                    : "hover:bg-slate-50/60"
                                            }`}
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
                                            <td className="px-6 py-4">
                                                <span
                                                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                                        pharmacy.status === "approved"
                                                            ? "bg-green-50 text-green-700"
                                                            : pharmacy.status === "rejected"
                                                              ? "bg-red-50 text-red-700"
                                                              : "bg-amber-50 text-amber-700"
                                                    }`}
                                                >
                                                    {pharmacy.status.charAt(0).toUpperCase() +
                                                        pharmacy.status.slice(1)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                {pharmacy.is_active ? (
                                                    <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                                                        Active
                                                    </span>
                                                ) : (
                                                    <div>
                                                        <span className="rounded-full border border-rose-100 bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
                                                            Deleted
                                                        </span>
                                                        {pharmacy.deleted_at && (
                                                            <span className="mt-1 block text-[10px] text-slate-400">
                                                                {timeAgo(pharmacy.deleted_at)}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex gap-2">
                                                    {pharmacy.is_active ? (
                                                        <button
                                                            disabled={Boolean(acting)}
                                                            onClick={() =>
                                                                handleSoftDelete(pharmacy.id)
                                                            }
                                                            className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100 disabled:opacity-40"
                                                        >
                                                            {acting === `${pharmacy.id}:delete` ? (
                                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                            ) : (
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            )}
                                                            Delete
                                                        </button>
                                                    ) : (
                                                        <button
                                                            disabled={Boolean(acting)}
                                                            onClick={() =>
                                                                handleRestore(pharmacy.id)
                                                            }
                                                            className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-600 transition-colors hover:bg-emerald-100 disabled:opacity-40"
                                                        >
                                                            {acting === `${pharmacy.id}:restore` ? (
                                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                            ) : (
                                                                <RefreshCw className="h-3.5 w-3.5" />
                                                            )}
                                                            Restore
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}

                        {/* Pagination footer */}
                        {!loading && totalPages > 1 && (
                            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-6 py-4">
                                <span className="text-sm text-slate-500">
                                    Showing {(page - 1) * limit + 1} to{" "}
                                    {Math.min(page * limit, totalItems)} of {totalItems} entries
                                </span>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setPage((p) => Math.max(p - 1, 1))}
                                        disabled={page === 1}
                                        className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-45 disabled:hover:bg-white"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                                        disabled={page === totalPages}
                                        className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-45 disabled:hover:bg-white"
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
