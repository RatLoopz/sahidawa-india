import ReportWizard from "@/components/reports/ReportWizard";
import { PageHeader } from "../components/PageHeader";
import ReportInfoPanel from "./ReportInfoPanel";

export const metadata = {
  title: "Report Fake Medicine — MedWatch",
  description:
    "Report suspicious or counterfeit medicines found at pharmacies. Help protect your community.",
};

export default function ReportPage() {
  return (
    <div className="min-h-screen bg-(--color-surface-muted) text-(--color-text-primary) font-sans selection:bg-emerald-200 flex flex-col overflow-x-hidden">
      {/* Header component */}
      <PageHeader 
        title="Report Incident" 
        subtitle="Public Safety Initiative" 
        backHref="/" 
        variant="light" 
      />

      <main className="container mx-auto px-4 md:px-6 pt-8 pb-20 flex-1 relative z-10">
        
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-100/40 dark:bg-emerald-950/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-teal-100/40 dark:bg-teal-950/10 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none"></div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 relative z-10">
          
          {/* Left Column: Hero & Form */}
          <div className="lg:col-span-7 space-y-8">
            {/* Hero Section */}
            <div className="space-y-4 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-sm font-bold tracking-wide">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Active Surveillance
              </div>
              <h1 className="text-4xl md:text-5xl font-extrabold text-(--color-text-primary) tracking-tight leading-[1.1]">
                Report a <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500 dark:from-emerald-400 dark:to-teal-400">
                  Suspicious Medicine
                </span>
              </h1>
              <p className="text-lg text-(--color-text-secondary) font-medium leading-relaxed max-w-xl">
                Your vigilance protects public health. Report suspected counterfeit, expired, or substandard medicines. All reports are investigated by India's Pharmacovigilance authorities.
              </p>
            </div>

            {/* Wizard Component */}
            <div className="mt-8">
              <ReportWizard />
            </div>
          </div>

          {/* Right Column: Dashboard & Info */}
          <ReportInfoPanel />
        </div>
      </main>
    </div>
  );
}
