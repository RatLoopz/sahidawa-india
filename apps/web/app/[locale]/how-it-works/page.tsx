import { ArrowLeft, Camera, MapPin, ShieldCheck, Sparkles } from "lucide-react";
import { Link } from "@/i18n/routing";

const steps = [
  {
    title: "Scan medicine packaging or barcode",
    description:
      "Use the mobile scanner to capture the medicine packaging or barcode, and SahiDawa instantly checks authenticity signals.",
    icon: Camera,
  },
  {
    title: "Verify against trusted sources",
    description:
      "SahiDawa compares the scanned data with verified drug records, safety alerts, and counterfeit patterns.",
    icon: ShieldCheck,
  },
  {
    title: "Find safe pharmacies nearby",
    description:
      "If the medicine is safe, the app helps you locate verified pharmacies and trusted health support in your area.",
    icon: MapPin,
  },
];

export default function HowItWorksPage() {
  return (
    <main className="container mx-auto px-4 py-10 md:py-14 max-w-6xl">
      <div className="mb-6 text-sm text-slate-500 flex flex-wrap items-center gap-2">
        <Link href="/" className="hover:text-emerald-600 transition-colors">
          Home
        </Link>
        <span>/</span>
        <span className="font-semibold text-slate-900">How it Works</span>
      </div>

      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between mb-12">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:border-emerald-300 hover:text-emerald-700 transition-colors"
        >
          <ArrowLeft size={18} />
          Back to Home
        </Link>

        <div className="space-y-4 md:text-right">
          <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
            How it Works
          </span>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900">
            See how SahiDawa protects your health.
          </h1>
          <p className="max-w-3xl text-slate-600 text-lg leading-8 mx-auto md:mx-0">
            SahiDawa brings together medicine scanning, verified pharmacy mapping, and local health guidance so citizens can trust every pill.
          </p>
        </div>
      </div>

      <section className="grid gap-6 md:grid-cols-3">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <article key={step.title} className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm hover:border-emerald-200 transition-all">
              <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-700">
                <Icon size={24} />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-3">{step.title}</h2>
              <p className="text-slate-600 leading-7">{step.description}</p>
            </article>
          );
        })}
      </section>

      <section className="mt-14 rounded-[2rem] border border-slate-200 bg-slate-950 p-10 text-white shadow-lg">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-3xl bg-emerald-500 text-white">
              <Sparkles size={24} />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-emerald-300">Why it matters</p>
              <h2 className="text-3xl font-bold">Safe medicine verification for every community.</h2>
            </div>
          </div>
        </div>
        <p className="max-w-3xl leading-8 text-slate-300">
          Every year, millions in India are exposed to counterfeit or substandard medication. SahiDawa was built to give people a simple way to verify medicines, access trusted pharmacy locations, and stay informed with local health alerts.
        </p>
      </section>
    </main>
  );
}
