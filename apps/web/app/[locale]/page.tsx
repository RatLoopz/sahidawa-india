"use client";

import { Header } from "./components/landing/Header";
import { HeroSection } from "./components/landing/HeroSection";
import { TickerBar } from "./components/landing/TickerBar";
import { TrustCards } from "./components/landing/TrustCards";
import { HowItWorks } from "./components/landing/HowItWorks";
import { FeaturesBento } from "./components/landing/FeaturesBento";
import { CTABanner } from "./components/landing/CTABanner";
import { MobileBottomNav } from "./components/landing/MobileBottomNav";

export default function SahiDawaHome() {
    return (
        <div className="min-h-screen overflow-x-hidden bg-white text-slate-900 antialiased selection:bg-teal-100 selection:text-teal-900 dark:bg-slate-950 dark:text-slate-100 dark:selection:bg-teal-900 dark:selection:text-teal-100">
            <Header />

            <main>
                <HeroSection />
                <TickerBar />
                <TrustCards />
                <HowItWorks />
                <FeaturesBento />
                <CTABanner />
            </main>

            <MobileBottomNav />
        </div>
    );
}
