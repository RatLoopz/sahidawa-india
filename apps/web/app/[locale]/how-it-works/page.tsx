"use client";

import React from "react";
import { Link } from "@/i18n/routing";
import { 
    ShieldCheck, 
    Camera, 
    Bell, 
    MapPin, 
    ArrowLeft,
    CheckCircle2,
    Activity,
    Smartphone
} from "lucide-react";
import Footer from "../components/Footer";

export default function HowItWorksPage() {
    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-emerald-200 flex flex-col">
            <main className="container mx-auto max-w-5xl px-4 py-8 flex-1">
                {/* Header */}
                <div className="mb-8 flex flex-col items-start gap-4">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition-colors hover:text-slate-800"
                    >
                        <ArrowLeft size={16} />
                        Back to Home Page
                    </Link>

                    <div className="animate-in fade-in slide-in-from-bottom-4 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 duration-700">
                        <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                        </span>
                        About SahiDawa
                    </div>
                </div>

                <div className="mb-12 border-b border-slate-100 pb-8">
                    <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 md:text-5xl mb-4">
                        How <span className="text-emerald-600">SahiDawa</span> Works
                    </h1>
                    <p className="max-w-2xl text-lg font-medium text-slate-500">
                        Your trusted open-source platform for medicine verification, safety alerts, and finding verified pharmacies across India.
                    </p>
                </div>

                {/* Steps Section */}
                <div className="space-y-16 mb-20">
                    {/* Step 1 */}
                    <section className="flex flex-col md:flex-row gap-8 items-center bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex-1 space-y-4">
                            <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-emerald-100 text-emerald-600">
                                <span className="text-xl font-bold">1</span>
                            </div>
                            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                                <Camera className="text-emerald-500" />
                                Scan & Verify Medicines
                            </h2>
                            <p className="text-slate-600 leading-relaxed font-medium">
                                Use your smartphone camera to scan the barcode or medicine packaging. SahiDawa instantly cross-references the batch number with the official CDSCO database to ensure authenticity.
                            </p>
                            <ul className="space-y-2 text-sm text-slate-500 font-medium">
                                <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-500" /> Detects counterfeit drugs</li>
                                <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-500" /> Checks expiry dates</li>
                                <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-500" /> Verifies manufacturer details</li>
                            </ul>
                        </div>
                        <div className="w-full md:w-1/3 flex justify-center">
                            <div className="w-48 h-48 bg-slate-50 rounded-full border-4 border-emerald-100 flex items-center justify-center relative shadow-inner">
                                <Smartphone size={64} className="text-slate-300" strokeWidth={1} />
                                <div className="absolute inset-0 bg-emerald-500/10 rounded-full animate-pulse"></div>
                                <ShieldCheck size={32} className="absolute text-emerald-500 -bottom-2 -right-2 bg-white rounded-full p-1" />
                            </div>
                        </div>
                    </section>

                    {/* Step 2 */}
                    <section className="flex flex-col md:flex-row-reverse gap-8 items-center bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex-1 space-y-4">
                            <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-amber-100 text-amber-600">
                                <span className="text-xl font-bold">2</span>
                            </div>
                            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                                <MapPin className="text-amber-500" />
                                Find Verified Pharmacies
                            </h2>
                            <p className="text-slate-600 leading-relaxed font-medium">
                                Locate licensed and verified pharmacies near you. SahiDawa maps registered stores to ensure you purchase your medicines from trusted sources only.
                            </p>
                            <ul className="space-y-2 text-sm text-slate-500 font-medium">
                                <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-amber-500" /> Interactive map interface</li>
                                <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-amber-500" /> Distance calculations</li>
                                <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-amber-500" /> Jan Aushadhi Kendras included</li>
                            </ul>
                        </div>
                        <div className="w-full md:w-1/3 flex justify-center">
                            <div className="w-48 h-48 bg-slate-50 rounded-full border-4 border-amber-100 flex items-center justify-center relative shadow-inner">
                                <MapPin size={64} className="text-slate-300" strokeWidth={1} />
                                <div className="absolute inset-0 bg-amber-500/10 rounded-full animate-pulse"></div>
                            </div>
                        </div>
                    </section>

                    {/* Step 3 */}
                    <section className="flex flex-col md:flex-row gap-8 items-center bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex-1 space-y-4">
                            <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-red-100 text-red-600">
                                <span className="text-xl font-bold">3</span>
                            </div>
                            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                                <Bell className="text-red-500" />
                                Stay Updated with Alerts
                            </h2>
                            <p className="text-slate-600 leading-relaxed font-medium">
                                Receive real-time alerts about recalled, banned, or substandard medicines directly from the CDSCO registry. Protect your family by staying informed.
                            </p>
                            <ul className="space-y-2 text-sm text-slate-500 font-medium">
                                <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-red-500" /> Push notifications</li>
                                <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-red-500" /> Live region-based alerts</li>
                                <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-red-500" /> Historical safety logs</li>
                            </ul>
                        </div>
                        <div className="w-full md:w-1/3 flex justify-center">
                            <div className="w-48 h-48 bg-slate-50 rounded-full border-4 border-red-100 flex items-center justify-center relative shadow-inner">
                                <Activity size={64} className="text-slate-300" strokeWidth={1} />
                                <div className="absolute inset-0 bg-red-500/10 rounded-full animate-pulse"></div>
                            </div>
                        </div>
                    </section>
                </div>
                
                {/* CTA */}
                <div className="bg-slate-900 rounded-3xl p-8 md:p-12 text-center text-white shadow-2xl mb-12">
                    <h2 className="text-3xl font-bold mb-4">Ready to verify your medicine?</h2>
                    <p className="text-slate-400 mb-8 max-w-xl mx-auto">
                        Don't take chances with your health. Use SahiDawa to verify the authenticity of your medicine right now.
                    </p>
                    <Link href="/scan">
                        <button className="bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-4 px-8 rounded-full transition-all hover:scale-105 shadow-lg shadow-emerald-500/30">
                            Start Scanning
                        </button>
                    </Link>
                </div>

            </main>
            <Footer />
        </div>
    );
}
