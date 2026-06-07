import { LocalScanHistoryList } from "@/components/history/LocalScanHistoryList";
import { PageHeader } from "../components/PageHeader";

export default function HistoryPage() {
    return (
        <main className="min-h-[calc(100vh-4rem)] bg-(--color-surface-page) text-(--color-text-primary)">
            <PageHeader
                title="Scan History"
                subtitle="Local device records"
                backHref="/scan"
                variant="light"
            />
            <LocalScanHistoryList />
        </main>
    );
}
