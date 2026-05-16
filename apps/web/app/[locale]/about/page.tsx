import { Link } from "@/i18n/routing";
import { ArrowLeft, HeartHandshake, ShieldCheck, Sparkles } from "lucide-react";
import { ContactSection } from "../components/ContactSection";

const values = [
  {
    title: "Open source for trust",
    description:
      "SahiDawa is free to use, free to inspect, and built for communities rather than profit.",
    icon: Sparkles,
  },
  {
    title: "Built for Bharat",
    description:
      "The platform supports local health needs with medicine verification, pharmacy discovery, and multilingual access.",
    icon: HeartHandshake,
  },
  {
    title: "Safety-first design",
    description:
      "Every interaction focuses on trusted information, accessible guidance, and verified pharmacy locations.",
    icon: ShieldCheck,
  },
];

export default function AboutPage() {
  return (
    <main className="container mx-auto px-4 py-10 md:py-14 max-w-6xl">
      <div className="mb-6 text-sm text-slate-500 flex flex-wrap items-center gap-2">
        <Link href="/" className="hover:text-emerald-600 transition-colors">
          Home
        </Link>
        <span>/</span>
        <span className="font-semibold text-slate-900">About</span>
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
            About SahiDawa
          </span>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900">
            Built to make medicine verification easy for everyone.
          </h1>
          <p className="max-w-3xl text-slate-600 text-lg leading-8 mx-auto md:mx-0">
            SahiDawa brings together drug verification, safe pharmacy mapping, and local health support in one open-source platform.
          </p>
        </div>
      </div>

      <section className="grid gap-6 md:grid-cols-3 mb-14">
        {values.map((value) => {
          const Icon = value.icon;
          return (
            <article key={value.title} className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm hover:border-emerald-200 transition-all">
              <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-700">
                <Icon size={24} />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-3">{value.title}</h2>
              <p className="text-slate-600 leading-7">{value.description}</p>
            </article>
          );
        })}
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-slate-50 p-10 shadow-sm">
        <h2 className="text-3xl font-bold text-slate-900 mb-4">Our mission</h2>
        <p className="text-slate-600 leading-8 max-w-3xl">
          SahiDawa exists to help citizens verify medicine authenticity and access safe health services without depending on expensive or inaccessible tools. This project is designed for Indian communities, local languages, and real-world field use.
        </p>
      </section>

      <ContactSection />
    </main>
  );
}
