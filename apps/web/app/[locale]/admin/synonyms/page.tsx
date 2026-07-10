"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { createBrowserClient } from "@supabase/ssr";
import { ADMIN_API_BASE } from "@/lib/adminApi";
import { getSupabaseUrl, getSupabaseAnonKey } from "@/lib/env";
import { Loader2, RefreshCw, Trash2, Plus, AlertCircle, FileText, Upload } from "lucide-react";
import { toast } from "sonner";
import Card from "@/components/Card";
import { Skeleton } from "@/components/ui/Skeleton";

interface OcrSynonym {
    id: string;
    original_term: string;
    normalized_term: string;
    type: "misread" | "synonym";
    created_at: string;
}

function getToken(): string {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("sb-access-token") ?? "";
}

/**
 * Parses a single CSV line into fields, respecting double-quoted values.
 * Handles:
 *  - Commas inside quoted fields, e.g. "Paracetamol, 500mg" stays one field
 *  - Escaped quotes inside quoted fields, e.g. "She said ""hi""" -> She said "hi"
 *  - Unquoted fields (no special handling needed)
 * Note: does not handle newlines embedded inside a quoted field, since the
 * caller splits the file into lines first — out of scope for this fix.
 */
function parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (inQuotes) {
            if (char === '"') {
                if (line[i + 1] === '"') {
                    // Escaped quote inside a quoted field
                    current += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                current += char;
            }
        } else {
            if (char === '"') {
                inQuotes = true;
            } else if (char === ",") {
                result.push(current.trim());
                current = "";
            } else {
                current += char;
            }
        }
    }

    result.push(current.trim());
    return result;
}

export default function AdminSynonymsPage() {
    const t = useTranslations("AdminSynonyms");
    const [synonyms, setSynonyms] = useState<OcrSynonym[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Form state
    const [originalTerm, setOriginalTerm] = useState("");
    const [normalizedTerm, setNormalizedTerm] = useState("");
    const [type, setType] = useState<"misread" | "synonym">("synonym");
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const supabase = useMemo(() => createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey()), []);

    const fetchSynonyms = async () => {
        setLoading(true);
        setError(null);
        try {
            const { data, error } = await supabase
                .from("ocr_synonyms")
                .select("*")
                .order("created_at", { ascending: false });

            if (error) throw error;
            setSynonyms(data as OcrSynonym[]);
        } catch (err: any) {
            setError(err.message || t("fetchError"));
        } finally {
            setLoading(false);
        }
    };

    const invalidateCache = async () => {
        try {
            await fetch(`${ADMIN_API_BASE}/cache/invalidate-synonyms`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${getToken()}`,
                },
            });
        } catch (err) {
            console.error("Failed to invalidate cache", err);
        }
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!originalTerm || !normalizedTerm) return;

        setActionLoading("add");
        setError(null);
        try {
            const { error } = await supabase.from("ocr_synonyms").insert([
                {
                    original_term: originalTerm.trim(),
                    normalized_term: normalizedTerm.trim(),
                    type,
                },
            ]);

            if (error) throw error;

            setOriginalTerm("");
            setNormalizedTerm("");
            await fetchSynonyms();
            await invalidateCache();
        } catch (err: any) {
            setError(err.message || t("addError"));
        } finally {
            setActionLoading(null);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm(t("confirmDelete"))) return;

        setActionLoading(id);
        setError(null);
        try {
            const { error } = await supabase.from("ocr_synonyms").delete().eq("id", id);
            if (error) throw error;

            await fetchSynonyms();
            await invalidateCache();
        } catch (err: any) {
            setError(err.message || t("deleteError"));
        } finally {
            setActionLoading(null);
        }
    };

    useEffect(() => {
        fetchSynonyms();
    }, []);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setActionLoading("upload");
        setError(null);

        try {
            const text = await file.text();
            const lines = text
                .split("\n")
                .map((l) => l.trim())
                .filter(Boolean);
            if (lines.length < 2) throw new Error(t("invalidCsv"));

            const headerCols = parseCsvLine(lines[0]).map((c) => c.toLowerCase());
            if (
                !headerCols.includes("original_term") ||
                !headerCols.includes("normalized_term") ||
                !headerCols.includes("type")
            ) {
                throw new Error(t("invalidCsv"));
            }

            const payload = [];
            for (let i = 1; i < lines.length; i++) {
                const cols = parseCsvLine(lines[i]);
                if (cols.length >= 3) {
                    payload.push({
                        original_term: cols[0],
                        normalized_term: cols[1],
                        type: cols[2] === "misread" ? "misread" : "synonym",
                    });
                }
            }

            if (payload.length === 0) throw new Error(t("invalidCsv"));

            const res = await fetch(`${ADMIN_API_BASE}/synonyms/bulk`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${getToken()}`,
                },
                body: JSON.stringify(payload),
            });

            const result = await res.json();
            if (!res.ok) throw new Error(result.error || t("uploadError"));

            if (fileInputRef.current) fileInputRef.current.value = "";

            await fetchSynonyms();
            await invalidateCache();
            toast.success(t("uploadSuccess", { count: payload.length }));
        } catch (err: any) {
            setError(err.message || t("uploadError"));
            if (fileInputRef.current) fileInputRef.current.value = "";
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-(--color-text-primary)">{t("title")}</h1>
                    <p className="mt-1 text-sm text-(--color-text-secondary)">{t("subtitle")}</p>
                </div>
                <div className="flex items-center gap-3">
                    <input
                        type="file"
                        accept=".csv"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={actionLoading === "upload"}
                        className="flex items-center gap-2 rounded-lg border border-(--color-border-muted) bg-(--color-surface-page) px-3 py-2 text-sm text-(--color-text-secondary) transition hover:bg-(--color-surface-muted) disabled:opacity-50"
                    >
                        {actionLoading === "upload" ? (
                            <Loader2 size={16} className="animate-spin" />
                        ) : (
                            <Upload size={16} />
                        )}
                        {t("uploadCsv")}
                    </button>
                    <button
                        onClick={fetchSynonyms}
                        disabled={loading}
                        className="flex items-center gap-2 rounded-lg border border-(--color-border-muted) bg-(--color-surface-page) px-3 py-2 text-sm text-(--color-text-secondary) transition hover:bg-(--color-surface-muted) disabled:opacity-50"
                    >
                        <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                        {t("refresh")}
                    </button>
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-400">
                    <AlertCircle size={20} />
                    <p>{error}</p>
                </div>
            )}

            <div className="grid gap-6 md:grid-cols-3">
                <div className="md:col-span-1">
                    <Card className="border-(--color-border-muted) bg-(--color-surface-page)">
                        <h2 className="mb-4 text-lg font-semibold text-(--color-text-primary)">
                            {t("addNew")}
                        </h2>
                        <form onSubmit={handleAdd} className="space-y-4">
                            <div>
                                <label className="mb-1 block text-sm font-medium text-(--color-text-secondary)">
                                    {t("originalTerm")}
                                </label>
                                <input
                                    type="text"
                                    value={originalTerm}
                                    onChange={(e) => setOriginalTerm(e.target.value)}
                                    className="w-full rounded-lg border border-(--color-border-muted) bg-(--color-surface-muted) p-2.5 text-(--color-text-primary) focus:border-(--color-brand-primary) focus:outline-none"
                                    placeholder={t("originalPlaceholder")}
                                    required
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-medium text-(--color-text-secondary)">
                                    {t("normalizedTerm")}
                                </label>
                                <input
                                    type="text"
                                    value={normalizedTerm}
                                    onChange={(e) => setNormalizedTerm(e.target.value)}
                                    className="w-full rounded-lg border border-(--color-border-muted) bg-(--color-surface-muted) p-2.5 text-(--color-text-primary) focus:border-(--color-brand-primary) focus:outline-none"
                                    placeholder={t("normalizedPlaceholder")}
                                    required
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-medium text-(--color-text-secondary)">
                                    {t("typeLabel")}
                                </label>
                                <select
                                    value={type}
                                    onChange={(e) =>
                                        setType(e.target.value as "misread" | "synonym")
                                    }
                                    className="w-full rounded-lg border border-(--color-border-muted) bg-(--color-surface-muted) p-2.5 text-(--color-text-primary) focus:border-(--color-brand-primary) focus:outline-none"
                                >
                                    <option value="synonym">{t("typeSynonym")}</option>
                                    <option value="misread">{t("typeMisread")}</option>
                                </select>
                            </div>
                            <button
                                type="submit"
                                disabled={
                                    actionLoading === "add" || !originalTerm || !normalizedTerm
                                }
                                className="flex w-full items-center justify-center gap-2 rounded-lg bg-(--color-brand-primary) px-4 py-2.5 font-semibold text-white transition hover:bg-(--color-brand-primary-hover) disabled:opacity-50"
                            >
                                {actionLoading === "add" ? (
                                    <Loader2 size={18} className="animate-spin" />
                                ) : (
                                    <Plus size={18} />
                                )}
                                {t("addButton")}
                            </button>
                        </form>
                    </Card>
                </div>

                <div className="md:col-span-2">
                    <Card className="h-full border-(--color-border-muted) bg-(--color-surface-page)">
                        <h2 className="mb-4 text-lg font-semibold text-(--color-text-primary)">
                            {t("listTitle")} ({synonyms.length})
                        </h2>

                        {loading ? (
                            <div className="space-y-4">
                                <Skeleton className="h-12 w-full rounded-lg" />
                                <Skeleton className="h-12 w-full rounded-lg" />
                                <Skeleton className="h-12 w-full rounded-lg" />
                            </div>
                        ) : synonyms.length === 0 ? (
                            <div className="flex h-48 flex-col items-center justify-center text-(--color-text-secondary)">
                                <FileText size={48} className="mb-4 opacity-20" />
                                <p>{t("emptyList")}</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto rounded-lg border border-(--color-border-muted)">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-(--color-surface-muted) text-(--color-text-secondary)">
                                        <tr>
                                            <th className="p-4 font-medium">{t("originalTerm")}</th>
                                            <th className="p-4 font-medium">
                                                {t("normalizedTerm")}
                                            </th>
                                            <th className="p-4 font-medium">{t("typeLabel")}</th>
                                            <th className="p-4 text-right font-medium">
                                                {t("actions")}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-(--color-border-muted)">
                                        {synonyms.map((syn) => (
                                            <tr
                                                key={syn.id}
                                                className="transition hover:bg-(--color-surface-muted)/50"
                                            >
                                                <td className="p-4 font-medium text-(--color-text-primary)">
                                                    {syn.original_term}
                                                </td>
                                                <td className="p-4 text-(--color-text-secondary)">
                                                    {syn.normalized_term}
                                                </td>
                                                <td className="p-4">
                                                    <span
                                                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                                            syn.type === "misread"
                                                                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                                                : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                                        }`}
                                                    >
                                                        {syn.type === "misread"
                                                            ? t("typeMisread")
                                                            : t("typeSynonym")}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <button
                                                        onClick={() => handleDelete(syn.id)}
                                                        disabled={actionLoading === syn.id}
                                                        className="inline-flex items-center justify-center rounded-lg p-2 text-red-500 transition hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950/30"
                                                        title={t("delete")}
                                                    >
                                                        {actionLoading === syn.id ? (
                                                            <Loader2
                                                                size={16}
                                                                className="animate-spin"
                                                            />
                                                        ) : (
                                                            <Trash2 size={16} />
                                                        )}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </div>
    );
}