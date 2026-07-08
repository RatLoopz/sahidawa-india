"use client";

import { useTranslations } from "next-intl";
import PendingReportsDashboard from "./pending-reports";

export default function DashboardPage() {
    const t = useTranslations();

    return (
        <main className="mx-auto max-w-4xl space-y-8 py-8 px-4">
            {/* Header */}
            <div>
                <h1 className="text-4xl font-bold tracking-tight text-(--color-text-primary)">
                    {t("dashboard.title")}
                </h1>
                <p className="mt-2 text-lg text-(--color-text-secondary)">
                    {t("dashboard.subtitle")}
                </p>
            </div>

            {/* Pending Reports Section */}
            <section className="space-y-4">
                <div>
                    <h2 className="text-2xl font-semibold tracking-tight text-(--color-text-primary)">
                        {t("dashboard.pending_reports")}
                    </h2>
                    <p className="mt-1 text-sm text-(--color-text-muted)">
                        {t("dashboard.pending_reports_description")}
                    </p>
                </div>
                <PendingReportsDashboard />
            </section>
        </main>
    );
}
