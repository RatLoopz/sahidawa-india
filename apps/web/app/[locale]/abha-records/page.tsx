"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/routing";
import { ArrowLeft, FileText } from "lucide-react";
import { getABHAPrescriptions, ABHAPrescription } from "@/lib/api/abha";
import { useTranslations } from "next-intl";

export default function ABHARecordsPage() {
    const t = useTranslations("AbhaRecords");
    const [records, setRecords] = useState<ABHAPrescription[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const loadRecords = async () => {
            try {
                const data = await getABHAPrescriptions();
                setRecords(data);
            } catch (error) {
                setError(error instanceof Error ? error.message : t("failedToLoad"));
            } finally {
                setLoading(false);
            }
        };

        loadRecords();
    }, [t]);

    return (
        <div className="flex-grow bg-(--color-surface-muted) px-6 py-8">
            <div className="mx-auto max-w-3xl">
                <Link href="/profile" className="mb-6 inline-flex items-center gap-2">
                    <ArrowLeft size={18} />
                    {t("backToProfile")}
                </Link>

                <div className="rounded-3xl border border-(--color-border-muted) bg-(--color-surface-page) p-6">
                    <div className="mb-6 flex items-center gap-3">
                        <FileText className="text-emerald-600" />
                        <h1 className="text-2xl font-bold">{t("title")}</h1>
                    </div>

                    {error && (
                        <div className="mb-4 rounded-xl bg-red-100 p-4 text-red-700">{error}</div>
                    )}

                    {loading && <p>{t("loading")}</p>}

                    {!loading && !error && records.length === 0 && (
                        <div className="rounded-xl border p-4">{t("noPrescriptions")}</div>
                    )}

                    <div className="space-y-4">
                        {records.map((record) => (
                            <div key={record.id} className="rounded-xl border p-4">
                                <h3 className="font-semibold">{record.title}</h3>
                                <p className="text-sm text-gray-500">{record.issuedAt}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
