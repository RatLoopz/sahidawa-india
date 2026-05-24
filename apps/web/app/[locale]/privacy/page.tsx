export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-white">

      {/* Hero */}
      <section className="text-center py-16 px-4 border-b border-gray-100">
        <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm font-medium px-4 py-1.5 rounded-full mb-6">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          GSSoC 2026 Open Source Project
        </div>
        <h1 className="text-5xl font-extrabold text-gray-900 mb-4">
          Privacy <span className="text-green-500">Policy</span>
        </h1>
        <p className="text-gray-500 text-lg max-w-xl mx-auto mb-8">
          We believe in transparency. Here is exactly what we collect,
          why we collect it, and what we never do with it.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <span className="border border-gray-200 text-gray-600 text-sm px-4 py-1.5 rounded-full">
            🔒 No Data Sold. Ever.
          </span>
          <span className="border border-gray-200 text-gray-600 text-sm px-4 py-1.5 rounded-full">
            🍪 No Tracking Cookies
          </span>
          <span className="border border-green-200 text-green-700 text-sm px-4 py-1.5 rounded-full bg-green-50">
            ⭐ Open Source MIT License
          </span>
        </div>
      </section>

      {/* Content */}
      <section className="bg-gray-50 py-16 px-4">
        <div className="max-w-3xl mx-auto space-y-6">

          {/* Card 1 */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">📋</span>
              <h2 className="text-xl font-bold text-gray-900">1. Information We Collect</h2>
            </div>
            <p className="text-gray-500 text-sm mb-4">
              SahiDawa collects only what is absolutely necessary to verify medicines and keep you safe.
            </p>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <span className="mt-1 w-2 h-2 rounded-full bg-green-400 flex-shrink-0"></span>
                <span className="text-gray-600 text-sm">Medicine barcode or image scans — used only for verification</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 w-2 h-2 rounded-full bg-green-400 flex-shrink-0"></span>
                <span className="text-gray-600 text-sm">Location data — only if you use pharmacy finder, never stored</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 w-2 h-2 rounded-full bg-green-400 flex-shrink-0"></span>
                <span className="text-gray-600 text-sm">Voice input — processed locally, never uploaded without consent</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 w-2 h-2 rounded-full bg-red-400 flex-shrink-0"></span>
                <span className="text-gray-600 text-sm">We do <strong>not</strong> collect your name, phone number, or Aadhaar</span>
              </li>
            </ul>
          </div>

          {/* Card 2 */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">🔍</span>
              <h2 className="text-xl font-bold text-gray-900">2. How We Use Your Data</h2>
            </div>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <span className="mt-1 w-2 h-2 rounded-full bg-green-400 flex-shrink-0"></span>
                <span className="text-gray-600 text-sm">Medicine scans are verified against the CDSCO database only</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 w-2 h-2 rounded-full bg-green-400 flex-shrink-0"></span>
                <span className="text-gray-600 text-sm">Anonymous scan reports may build our counterfeit heatmap</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 w-2 h-2 rounded-full bg-red-400 flex-shrink-0"></span>
                <span className="text-gray-600 text-sm">No personal data is shared with advertisers or third parties</span>
              </li>
            </ul>
          </div>

          {/* Card 3 */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">🍪</span>
              <h2 className="text-xl font-bold text-gray-900">3. Cookies</h2>
            </div>
            <p className="text-gray-600 text-sm">
              SahiDawa uses only <strong>essential cookies</strong> such as your language preference.
              We do not use tracking, advertising, or analytics cookies of any kind.
            </p>
          </div>

          {/* Card 4 */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">🔗</span>
              <h2 className="text-xl font-bold text-gray-900">4. Third-Party Services</h2>
            </div>
            <p className="text-gray-500 text-sm mb-4">
              We use the following trusted services, each with their own privacy policy:
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-600 font-medium">☁️ Cloudinary</div>
              <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-600 font-medium">🗄️ Supabase</div>
              <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-600 font-medium">🗺️ OpenStreetMap</div>
              <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-600 font-medium">🤖 Sarvam AI</div>
            </div>
          </div>

          {/* Card 5 */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">🔐</span>
              <h2 className="text-xl font-bold text-gray-900">5. Data Security</h2>
            </div>
            <p className="text-gray-600 text-sm">
              SahiDawa is fully open source — our code is publicly auditable on GitHub.
              We follow secure coding practices and never store sensitive health data
              beyond what is needed for verification.
            </p>
          </div>

          {/* Card 6 */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">👨‍👩‍👧</span>
              <h2 className="text-xl font-bold text-gray-900">6. Children&apos;s Privacy</h2>
            </div>
            <p className="text-gray-600 text-sm">
              SahiDawa is built for all citizens of India, including families.
              We do not knowingly collect personal data from children under 13.
            </p>
          </div>

          {/* Card 7 — Contact */}
          <div className="bg-white rounded-2xl border border-green-100 shadow-sm p-8">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">✉️</span>
              <h2 className="text-xl font-bold text-gray-900">7. Contact Us</h2>
            </div>
            <p className="text-gray-600 text-sm mb-3">
              For privacy-related queries, reach us at:
            </p>
            <span className="inline-block bg-green-50 border border-green-200 text-green-700 text-sm font-semibold px-4 py-2 rounded-lg">
              [ADMIN_EMAIL]
            </span>
            <p className="text-gray-500 text-sm mt-4">
              Or join our community on{" "}
              <a href="https://discord.gg/dvbDuJVwNa" target="_blank" rel="noopener noreferrer" className="text-green-600 underline hover:text-green-700">Discord</a>
            </p>
          </div>

          {/* Card 8 */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">📅</span>
              <h2 className="text-xl font-bold text-gray-900">8. Changes to This Policy</h2>
            </div>
            <p className="text-gray-600 text-sm">
              We may update this policy as SahiDawa grows. Any changes will be
              posted on this page with a revised date.
            </p>
          </div>

        </div>
      </section>

      {/* Bottom */}
      <section className="text-center py-10 px-4 border-t border-gray-100">
        <p className="text-gray-400 text-sm">
          SahiDawa is free, open-source, and built for 1.4 billion Indians. No ads. No premium. No data sold. Ever.
        </p>
      </section>

    </main>
  );
}