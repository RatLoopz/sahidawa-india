"use client";

export const TickerBar = () => {
    const items = [
        "\u2726 CDSCO Database Synced",
        "\u2726 2M+ Medicines Verified",
        "\u2726 5,000+ Safe Pharmacies",
        "\u2726 Real-time Recall Alerts",
        "\u2726 AI-Powered Detection",
        "\u2726 Trusted by 10,000+ Users",
        "\u2726 99.9% Accuracy Rate",
        "\u2726 Zero Counterfeit Tolerance",
    ];
    const doubled = [...items, ...items];
    return (
        <div className="ticker-wrap w-full overflow-hidden border-y border-teal-100/80 bg-gradient-to-r from-teal-50 via-cyan-50 to-teal-50 py-3 dark:border-teal-900/30 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900">
            <div className="ticker anim-marquee gap-12">
                {doubled.map((item, i) => (
                    <span
                        key={i}
                        className="px-6 text-xs font-bold tracking-wide whitespace-nowrap text-teal-700 dark:text-teal-400"
                    >
                        {item}
                    </span>
                ))}
            </div>
        </div>
    );
};
