import { Metadata } from "next";
import { AshaGamifiedDashboard } from "../../../../components/asha/AshaGamifiedDashboard";

export const metadata: Metadata = {
    title: "ASHA Worker Dashboard | SahiDawa",
    description: "Track your progress and earn Health Tokens for your contributions.",
};

export default function AshaDashboardPage() {
    return (
        <main className="min-h-screen bg-slate-50/50 px-4 py-12 sm:px-6 lg:px-8">
            <AshaGamifiedDashboard />
        </main>
    );
}
