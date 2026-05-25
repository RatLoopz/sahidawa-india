"use client";

import { useTranslations } from "next-intl";
import { useRouter, useParams } from "next/navigation";
import { ShieldCheck, Clock, Users } from "lucide-react";

export default function HeroSection() {
    const tHome = useTranslations("Home");
    const router = useRouter();
    const params = useParams();
    const locale = Array.isArray(params.locale) ? params.locale[0] : params.locale;

    const handleNavigation = (path: string) => {
        router.push(`/${locale}/${path}`);
    };

    return (
        <div className="relative overflow-hidden rounded-3xl bg-emerald-50 px-6 py-10 dark:bg-emerald-950/20 md:px-10 md:py-14">
            {/* Decorative background blobs */}
            <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-16 -right-16 h-64 w-64 rounded-full bg-emerald-200/40 blur-3xl dark:bg-emerald-500/10"
            />
            <div
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-12 -left-12 h-48 w-48 rounded-full bg-teal-200/40 blur-3xl dark:bg-teal-500/10"
            />

            <div className="relative z-10 flex flex-col items-stretch gap-10 md:flex-row md:items-center md:gap-8">
                {/* ── Left: Text content ── */}
                <div className="flex flex-1 flex-col items-start text-left">
                    {/* Badge */}
                    <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-4 py-1.5 text-sm font-semibold text-emerald-700 shadow-sm dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                        <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                        </span>
                        Trusted Healthcare Platform
                    </span>

                    {/* Heading — full green */}
                    <h2 className="text-4xl font-black leading-[1.1] tracking-tight text-emerald-600 dark:text-emerald-400 md:text-5xl">
                        {tHome("title")}
                    </h2>

                    {/* Subtitle */}
                    <p className="mt-4 max-w-lg text-base leading-relaxed text-gray-600 dark:text-gray-400 md:text-lg">
                        {tHome("subtitle")}
                    </p>

                    {/* CTA Buttons */}
                    <div className="mt-8 flex flex-wrap gap-3">
                        <button
                            onClick={() => handleNavigation("scan")}
                            className="rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-md shadow-emerald-500/30 transition-all hover:bg-emerald-700 hover:shadow-lg hover:shadow-emerald-500/40 active:scale-[0.98]"
                        >
                            {tHome("scan_button")} →
                        </button>
                        <button
                            onClick={() => handleNavigation("map")}
                            className="rounded-2xl border border-emerald-300 bg-white px-6 py-3 text-sm font-bold text-emerald-700 shadow-sm transition-all hover:border-emerald-400 hover:bg-emerald-50 active:scale-[0.98] dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
                        >
                            {tHome("pharmacy_map")}
                        </button>
                    </div>

                    {/* Stats */}
                    <div className="mt-6 flex flex-wrap gap-4">
                        {[
                            { icon: Users, value: "2M+", label: "Verified users" },
                            { icon: ShieldCheck, value: "98%", label: "Genuine meds" },
                            { icon: Clock, value: "30 min", label: "Express delivery" },
                        ].map(({ icon: Icon, value, label }) => (
                            <div
                                key={label}
                                className="flex items-center gap-2.5 rounded-2xl border border-emerald-100 bg-white px-4 py-2.5 shadow-sm dark:border-emerald-800/60 dark:bg-emerald-950/40"
                            >
                                <Icon size={16} className="shrink-0 text-emerald-500" />
                                <span className="text-base font-black text-gray-900 dark:text-white">
                                    {value}
                                </span>
                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                    {label}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Right: SVG Illustration — bigger ── */}
                <div
                    className="flex shrink-0 items-end justify-center md:w-96"
                    aria-hidden="true"
                >
                    <svg
                        viewBox="0 0 360 420"
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-72 sm:w-80 md:w-96"
                        role="img"
                        aria-label="Pharmacist handing medicine to a patient"
                    >
                        <title>Pharmacist handing medicine to a patient</title>

                        <style>{`
                            @keyframes sd-float {
                                0%, 100% { transform: translateY(0px); }
                                50% { transform: translateY(-12px); }
                            }
                            @keyframes sd-pulse {
                                0%, 100% { opacity: 1; transform: scale(1); }
                                50% { opacity: 0.4; transform: scale(0.88); }
                            }
                            @keyframes sd-bob {
                                0%, 100% { transform: translateY(0px) rotate(0deg); }
                                50% { transform: translateY(-6px) rotate(3deg); }
                            }
                            .sd-float { animation: sd-float 3.2s ease-in-out infinite; transform-box: fill-box; transform-origin: center bottom; }
                            .sd-pulse { animation: sd-pulse 1.8s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
                            .sd-pulse-delay { animation: sd-pulse 1.8s ease-in-out infinite 0.9s; transform-box: fill-box; transform-origin: center; }
                            .sd-bob { animation: sd-bob 2.6s ease-in-out infinite 0.4s; transform-box: fill-box; transform-origin: center bottom; }
                        `}</style>

                        {/* Floor shadow */}
                        <ellipse cx="180" cy="396" rx="150" ry="20" fill="#d1fae5" opacity="0.7" />

                        {/* ── Medicine shelf (back wall) ── */}
                        <rect x="10" y="130" width="155" height="9" rx="3" fill="#6ee7b7" />
                        <rect x="10" y="182" width="155" height="9" rx="3" fill="#6ee7b7" />

                        {/* Shelf back panel */}
                        <rect x="10" y="60" width="155" height="130" rx="4" fill="#f0fdf4" opacity="0.6" />

                        {/* Shelf bottles row 1 */}
                        <rect x="20" y="104" width="18" height="26" rx="4" fill="#34d399" />
                        <rect x="20" y="100" width="18" height="7" rx="2" fill="#059669" />
                        <rect x="46" y="108" width="22" height="22" rx="4" fill="#10b981" />
                        <rect x="46" y="104" width="22" height="7" rx="2" fill="#065f46" />
                        <rect x="76" y="102" width="16" height="28" rx="4" fill="#6ee7b7" />
                        <rect x="76" y="98"  width="16" height="7" rx="2" fill="#34d399" />
                        <rect x="100" y="106" width="20" height="24" rx="4" fill="#34d399" />
                        <rect x="100" y="102" width="20" height="7" rx="2" fill="#059669" />
                        <rect x="128" y="104" width="18" height="26" rx="4" fill="#10b981" />
                        <rect x="128" y="100" width="18" height="7" rx="2" fill="#065f46" />

                        {/* Shelf bottles row 2 */}
                        <rect x="20"  y="154" width="20" height="28" rx="4" fill="#10b981" />
                        <rect x="20"  y="150" width="20" height="7"  rx="2" fill="#065f46" />
                        <rect x="48"  y="158" width="18" height="24" rx="4" fill="#6ee7b7" />
                        <rect x="48"  y="154" width="18" height="7"  rx="2" fill="#34d399" />
                        <rect x="74"  y="152" width="24" height="30" rx="4" fill="#34d399" />
                        <rect x="74"  y="148" width="24" height="7"  rx="2" fill="#059669" />
                        <rect x="106" y="155" width="22" height="27" rx="4" fill="#10b981" />
                        <rect x="106" y="151" width="22" height="7"  rx="2" fill="#065f46" />
                        <rect x="136" y="153" width="18" height="29" rx="4" fill="#6ee7b7" />

                        {/* ── Counter ── */}
                        <rect x="20"  y="284" width="320" height="14" rx="5" fill="#10b981" />
                        <rect x="24"  y="284" width="312" height="6"  rx="3" fill="#34d399" opacity="0.5" />
                        <rect x="28"  y="298" width="304" height="88" rx="6" fill="#ecfdf5" />

                        {/* ── PHARMACIST (big, floating) ── */}
                        <g className="sd-float">
                            {/* White coat body */}
                            <rect x="54" y="206" width="72" height="94" rx="12" fill="white" stroke="#a7f3d0" strokeWidth="1.5" />
                            {/* Coat center line */}
                            <line x1="90" y1="206" x2="90" y2="248" stroke="#a7f3d0" strokeWidth="2" />
                            {/* Pocket */}
                            <rect x="96" y="230" width="22" height="14" rx="3" fill="#ecfdf5" stroke="#a7f3d0" strokeWidth="0.8" />
                            <line x1="100" y1="235" x2="114" y2="235" stroke="#34d399" strokeWidth="1" />
                            <line x1="100" y1="239" x2="111" y2="239" stroke="#a7f3d0" strokeWidth="1" />
                            {/* Stethoscope */}
                            <path d="M70 220 Q67 234 73 242" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" />
                            <circle cx="73" cy="244" r="4" fill="none" stroke="#34d399" strokeWidth="1.5" />

                            {/* Head */}
                            <ellipse cx="90" cy="184" rx="28" ry="30" fill="#fcd9bd" />
                            {/* Hair */}
                            <path d="M62 178 Q65 152 90 150 Q115 152 118 178" fill="#3d2b1f" />
                            {/* Ears */}
                            <ellipse cx="62" cy="186" rx="4" ry="5" fill="#fbc8a4" />
                            <ellipse cx="118" cy="186" rx="4" ry="5" fill="#fbc8a4" />
                            {/* Eyes */}
                            <ellipse cx="81" cy="182" rx="3.5" ry="3.5" fill="#1f1206" />
                            <ellipse cx="99" cy="182" rx="3.5" ry="3.5" fill="#1f1206" />
                            <circle cx="82.4" cy="180.8" r="1.2" fill="white" />
                            <circle cx="100.4" cy="180.8" r="1.2" fill="white" />
                            {/* Smile */}
                            <path d="M80 194 Q90 203 100 194" fill="none" stroke="#c87941" strokeWidth="2" strokeLinecap="round" />
                            {/* Cheeks */}
                            <ellipse cx="74" cy="196" rx="6" ry="4" fill="#f9a8a8" opacity="0.5" />
                            <ellipse cx="106" cy="196" rx="6" ry="4" fill="#f9a8a8" opacity="0.5" />

                            {/* Cap */}
                            <rect x="66" y="156" width="48" height="12" rx="6" fill="#059669" />
                            <rect x="60" y="163" width="60" height="6"  rx="3" fill="#34d399" />
                            <rect x="84" y="150" width="12" height="10" rx="3" fill="#059669" />
                            {/* Cross on cap */}
                            <line x1="90" y1="151" x2="90" y2="160" stroke="white" strokeWidth="2" />
                            <line x1="86" y1="155.5" x2="94" y2="155.5" stroke="white" strokeWidth="2" />

                            {/* Arm extending medicine */}
                            <line x1="126" y1="240" x2="174" y2="260" stroke="#fcd9bd" strokeWidth="16" strokeLinecap="round" />
                            {/* Hand */}
                            <ellipse cx="177" cy="262" rx="12" ry="9" fill="#fcd9bd" />

                            {/* Medicine box being handed */}
                            <rect x="166" y="250" width="40" height="28" rx="5" fill="#059669" />
                            <rect x="169" y="253" width="34" height="10" rx="3" fill="#34d399" />
                            {/* Rx cross */}
                            <line x1="186" y1="264" x2="186" y2="276" stroke="white" strokeWidth="1.8" />
                            <line x1="180" y1="270" x2="192" y2="270" stroke="white" strokeWidth="1.8" />
                        </g>

                        {/* ── PATIENT (bobbing slightly) ── */}
                        <g className="sd-bob">
                            {/* Body */}
                            <rect x="214" y="212" width="68" height="86" rx="12" fill="#a78bfa" />
                            {/* Collar */}
                            <path d="M232 212 L248 232 L264 212" fill="none" stroke="#7c3aed" strokeWidth="1.5" opacity="0.5" />

                            {/* Head */}
                            <ellipse cx="248" cy="188" rx="26" ry="28" fill="#fed7aa" />
                            {/* Hair */}
                            <path d="M222 180 Q224 158 248 156 Q272 158 274 180" fill="#7c3a1a" />
                            {/* Ears */}
                            <ellipse cx="222" cy="190" rx="4" ry="5" fill="#fbbf7c" />
                            <ellipse cx="274" cy="190" rx="4" ry="5" fill="#fbbf7c" />
                            {/* Happy squint eyes */}
                            <path d="M239 186 Q242 182 245 186" fill="none" stroke="#1f1206" strokeWidth="2.2" strokeLinecap="round" />
                            <path d="M251 186 Q254 182 257 186" fill="none" stroke="#1f1206" strokeWidth="2.2" strokeLinecap="round" />
                            {/* Big smile */}
                            <path d="M237 198 Q248 210 259 198" fill="none" stroke="#c2410c" strokeWidth="2.2" strokeLinecap="round" />
                            {/* Cheeks */}
                            <ellipse cx="232" cy="200" rx="7" ry="4" fill="#fca5a5" opacity="0.5" />
                            <ellipse cx="264" cy="200" rx="7" ry="4" fill="#fca5a5" opacity="0.5" />

                            {/* Patient arm reaching for box */}
                            <line x1="214" y1="242" x2="204" y2="264" stroke="#fed7aa" strokeWidth="14" strokeLinecap="round" />
                            <ellipse cx="200" cy="270" rx="12" ry="8" fill="#fed7aa" />
                        </g>

                        {/* ── Pulsing health cross icons ── */}
                        <g className="sd-pulse">
                            <circle cx="306" cy="134" r="22" fill="#ecfdf5" stroke="#a7f3d0" strokeWidth="1" />
                            <line x1="306" y1="122" x2="306" y2="146" stroke="#10b981" strokeWidth="3" strokeLinecap="round" />
                            <line x1="294" y1="134" x2="318" y2="134" stroke="#10b981" strokeWidth="3" strokeLinecap="round" />
                        </g>

                        <g className="sd-pulse-delay">
                            <circle cx="40" cy="72" r="16" fill="#ecfdf5" stroke="#a7f3d0" strokeWidth="1" />
                            <line x1="40" y1="62" x2="40" y2="82" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" />
                            <line x1="30" y1="72" x2="50" y2="72" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" />
                        </g>

                        {/* ── Verified tag ── */}
                        <rect x="226" y="92" width="118" height="34" rx="10" fill="#ecfdf5" stroke="#a7f3d0" strokeWidth="0.8" />
                        <circle cx="246" cy="109" r="10" fill="#10b981" />
                        <path d="M242 109 L245.5 112.5 L252 105" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <text x="262" y="114" fontFamily="sans-serif" fontSize="13" fontWeight="700" fill="#065f46">
                            Verified
                        </text>
                    </svg>
                </div>
            </div>
        </div>
    );
}