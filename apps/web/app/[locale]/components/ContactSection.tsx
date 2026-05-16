import { Mail, Phone, MapPin } from "lucide-react";

export function ContactSection() {
  return (
    <section className="mt-16 rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
            Contact
          </span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
            Need help or want to partner with us?
          </h2>
          <p className="max-w-2xl text-slate-600 leading-7 mt-3">
            Reach out to the SahiDawa team for product help, feedback, or collaboration on trusted healthcare services.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 mb-4">
              <Mail size={20} />
            </div>
            <p className="text-sm font-semibold text-slate-900">Email</p>
            <a href="mailto:hello@sahidawa.in" className="mt-2 block text-slate-600 hover:text-emerald-700 transition-colors">
              hello@sahidawa.in
            </a>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 mb-4">
              <Phone size={20} />
            </div>
            <p className="text-sm font-semibold text-slate-900">Phone</p>
            <a href="tel:+911234567890" className="mt-2 block text-slate-600 hover:text-emerald-700 transition-colors">
              +91 12345 67890
            </a>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 mb-4">
              <MapPin size={20} />
            </div>
            <p className="text-sm font-semibold text-slate-900">Location</p>
            <p className="mt-2 text-slate-600">Bangalore, Karnataka, India</p>
          </div>
        </div>
      </div>

      <div className="mt-8 text-slate-500 text-sm">
        Want us to get back to you? Send a message and we’ll respond within one business day.
      </div>
    </section>
  );
}
