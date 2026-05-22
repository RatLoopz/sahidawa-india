"use client";

import {
    ShieldCheck, Heart, Globe, MapPin,
    Mic, ChevronRight, Star, Zap, Lock,
    AlertTriangle, Users,
} from "lucide-react";
import { Link } from "@/i18n/routing";

export default function AboutPage() {
    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900">

            {/* Hero */}
            <section className="bg-white border-b border-slate-200">
                <div className="container mx-auto max-w-6xl px-4 py-16 md:py-24 text-center space-y-6">
                    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700">
                        <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                        </span>
                        GSSoC 2026 Open Source Project
                    </div>
                    <h1 className="text-4xl md:text-6xl font-black tracking-tight text-slate-900 leading-[1.1]">
                        About <span className="text-emerald-600">SahiDawa</span>
                    </h1>
                    <p className="mx-auto max-w-2xl text-lg md:text-xl text-slate-500 font-medium leading-relaxed">
                        India's first open-source citizen medicine verifier & rural health bridge. Built for Bharat. Not just India.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                        <span className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-600">
                            <Lock size={14} /> 100% Free. Forever.
                        </span>
                        <span className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-600">
                            <Globe size={14} /> 22 Indian Languages
                        </span>
                        <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-semibold text-emerald-700">
                            <Star size={14} /> Open Source MIT License
                        </span>
                    </div>
                </div>
            </section>

            {/* Problem */}
            <section className="container mx-auto max-w-6xl px-4 py-16">
                <div className="text-center mb-12">
                    <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4">🚨 The Problem We're Solving</h2>
                    <p className="text-slate-500 font-medium max-w-2xl mx-auto">India has a three-layer healthcare crisis that no existing platform solves simultaneously.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                        { icon: <AlertTriangle size={28} strokeWidth={2.5} />, color: "red", title: "Fake Medicines", desc: "12–25% of medicines in India are fake or substandard — putting 1.4 billion people at risk with zero citizen-facing verification tool." },
                        { icon: <MapPin size={28} strokeWidth={2.5} />, color: "amber", title: "Rural Healthcare Gap", desc: "65% of India's population lives in rural areas with almost no qualified doctors — over 900 million people without accessible healthcare." },
                        { icon: <Mic size={28} strokeWidth={2.5} />, color: "blue", title: "Language Barrier", desc: "22 official languages — but health information is mostly in English or Hindi, leaving 500M+ non-Hindi speakers behind." },
                    ].map((item, i) => (
                        <div key={i} className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-lg transition-all duration-300">
                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 mb-4 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-300">
                                {item.icon}
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 mb-2">{item.title}</h3>
                            <p className="text-slate-500 text-sm leading-relaxed font-medium">{item.desc}</p>
                        </div>
                    ))}
                </div>

                {/* Incident box */}
                <div className="mt-8 rounded-3xl border border-orange-200 bg-orange-50 p-6 md:p-8">
                    <div className="flex items-start gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-500">
                            <AlertTriangle size={20} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-800 mb-1">Real Incident — July 2025</h4>
                            <p className="text-slate-600 text-sm leading-relaxed font-medium">
                                Delhi Police busted a counterfeit medicine ring supplying fake Johnson & Johnson and GSK medicines — made of chalk powder and starch — all the way into government hospitals. Patients had <span className="font-bold text-orange-600">zero way to verify</span> these medicines before consuming them.
                            </p>
                            <p className="mt-2 text-sm font-bold text-emerald-600">SahiDawa fixes this. For free. Forever. Open source.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Mission & Vision */}
            <section className="bg-white border-y border-slate-200">
                <div className="container mx-auto max-w-6xl px-4 py-16">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="rounded-3xl bg-emerald-50 border border-emerald-100 p-8">
                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500 text-white mb-6 shadow-lg shadow-emerald-500/25">
                                <ShieldCheck size={28} strokeWidth={2.5} />
                            </div>
                            <h3 className="text-2xl font-black text-slate-900 mb-3">Our Mission</h3>
                            <p className="text-slate-600 leading-relaxed font-medium">
                                To empower every Indian citizen — regardless of language, location, or literacy — with the ability to instantly verify medicines, access qualified health guidance, and report counterfeit drugs in their community.
                            </p>
                        </div>
                        <div className="rounded-3xl bg-slate-900 p-8">
                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-white mb-6">
                                <Zap size={28} strokeWidth={2.5} />
                            </div>
                            <h3 className="text-2xl font-black text-white mb-3">Our Vision</h3>
                            <p className="text-slate-300 leading-relaxed font-medium">
                                A Bharat where no child dies from a fake medicine, no farmer's family is misdiagnosed for lack of a doctor, and no language is a barrier to healthcare. Free. Open. Forever.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Core Values */}
            <section className="container mx-auto max-w-6xl px-4 py-16">
                <div className="text-center mb-12">
                    <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4">Our Core Values</h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                    {[
                        { emoji: "🔓", title: "Open Source", desc: "MIT Licensed. Always." },
                        { emoji: "🆓", title: "Free Forever", desc: "No hidden costs. Ever." },
                        { emoji: "🌍", title: "Inclusive", desc: "22 languages. All of Bharat." },
                        { emoji: "🔒", title: "Privacy First", desc: "No data sold. No ads." },
                    ].map((v, i) => (
                        <div key={i} className="rounded-3xl bg-slate-50 border border-slate-200 p-6">
                            <div className="text-4xl mb-3">{v.emoji}</div>
                            <h3 className="font-bold text-slate-800 mb-1">{v.title}</h3>
                            <p className="text-sm text-slate-500 font-medium">{v.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Contact CTA */}
            <section className="container mx-auto max-w-6xl px-4 pb-16">
                <div className="rounded-3xl bg-emerald-600 p-8 md:p-12 text-center text-white relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-tr from-emerald-700 to-emerald-500 z-0" />
                    <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
                    <div className="relative z-10 space-y-4">
                        <div className="flex justify-center">
                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur-md">
                                <Users size={32} strokeWidth={2} />
                            </div>
                        </div>
                        <h2 className="text-3xl md:text-4xl font-black">Get In Touch</h2>
                        <p className="text-emerald-100 font-medium max-w-xl mx-auto">
                            Have questions, ideas, or want to contribute? We'd love to hear from you.
                        </p>
                        <div className="pt-2">
                            <Link href="/contact">
                                <button className="inline-flex items-center gap-2 rounded-2xl bg-white px-8 py-3.5 text-base font-bold text-emerald-600 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200">
                                    Contact Us <ChevronRight size={18} />
                                </button>
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

        </div>
    );
}
