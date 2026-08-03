"use client";

import React, { useState } from "react";
import { useAshaDashboard } from "../../hooks/useAshaDashboard";
import { PointsProgressBar } from "./PointsProgressBar";
import { LeaderboardWidget } from "./LeaderboardWidget";
import { BadgeUnlockModal } from "./BadgeUnlockModal";
import { motion } from "framer-motion";

export function AshaGamifiedDashboard() {
    const { stats, leaderboard, loading, error, unlockedBadges, awardPoints, clearUnlockedBadges } =
        useAshaDashboard();
    const [isAwarding, setIsAwarding] = useState(false);

    if (loading) {
        return (
            <div className="flex min-h-[400px] items-center justify-center">
                <div className="h-12 w-12 animate-spin rounded-full border-t-2 border-b-2 border-emerald-500"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-2xl bg-red-50 p-6 text-center text-red-600">
                <p>Failed to load dashboard data.</p>
                <p className="mt-2 text-sm">{error}</p>
            </div>
        );
    }

    const currentPoints = stats?.points || 0;

    // Calculate next milestone (every 100 points, then every 500)
    let nextMilestone = 100;
    if (currentPoints >= 100) nextMilestone = 500;
    if (currentPoints >= 500) nextMilestone = 1000;
    if (currentPoints >= 1000) nextMilestone = currentPoints + 500;

    const handleSimulateAction = async (points: number, actionName: string) => {
        setIsAwarding(true);
        try {
            await awardPoints(points, actionName);
        } catch (err) {
            console.error(err);
        } finally {
            setIsAwarding(false);
        }
    };

    return (
        <div className="mx-auto max-w-4xl space-y-8">
            <header className="mb-8">
                <h1 className="text-3xl font-extrabold text-slate-800">ASHA Worker Dashboard</h1>
                <p className="mt-2 text-slate-500">
                    Track your progress, earn tokens, and climb the leaderboard!
                </p>
            </header>

            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
                {/* Main Progress Section */}
                <div className="space-y-8 md:col-span-2">
                    <PointsProgressBar points={currentPoints} targetPoints={nextMilestone} />

                    {/* Action Cards (Gamification loop triggers) */}
                    <div>
                        <h2 className="mb-4 text-xl font-bold text-slate-800">Available Tasks</h2>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() =>
                                    handleSimulateAction(10, "Verified Pharmacy Location")
                                }
                                disabled={isAwarding}
                                className="flex flex-col items-start rounded-2xl border border-slate-100 bg-white p-5 text-left shadow-sm transition-shadow hover:shadow-md disabled:opacity-50"
                            >
                                <span className="mb-3 rounded-lg bg-blue-100 p-2 text-blue-700">
                                    📍
                                </span>
                                <h3 className="font-semibold text-slate-700">Verify Pharmacy</h3>
                                <p className="mt-1 mb-3 text-sm text-slate-500">
                                    Confirm a newly added Jan Aushadhi store.
                                </p>
                                <span className="text-sm font-bold text-emerald-600">
                                    +10 Tokens
                                </span>
                            </motion.button>

                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => handleSimulateAction(25, "Reported Fake Medicine")}
                                disabled={isAwarding}
                                className="flex flex-col items-start rounded-2xl border border-slate-100 bg-white p-5 text-left shadow-sm transition-shadow hover:shadow-md disabled:opacity-50"
                            >
                                <span className="mb-3 rounded-lg bg-red-100 p-2 text-red-700">
                                    🚨
                                </span>
                                <h3 className="font-semibold text-slate-700">Report Counterfeit</h3>
                                <p className="mt-1 mb-3 text-sm text-slate-500">
                                    Submit a verified report for a fake drug.
                                </p>
                                <span className="text-sm font-bold text-emerald-600">
                                    +25 Tokens
                                </span>
                            </motion.button>
                        </div>
                    </div>

                    {/* Badges Inventory */}
                    <div>
                        <h2 className="mb-4 text-xl font-bold text-slate-800">Your Badges</h2>
                        {stats?.badges && stats.badges.length > 0 ? (
                            <div className="flex flex-wrap gap-4">
                                {stats.badges.map((badge) => (
                                    <div
                                        key={badge}
                                        className="flex flex-col items-center rounded-2xl border border-amber-100 bg-amber-50 p-4"
                                    >
                                        <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-amber-200 text-2xl shadow-inner">
                                            🏆
                                        </div>
                                        <span className="text-center text-sm font-semibold text-amber-800">
                                            {badge}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-6 text-center text-slate-500">
                                Complete tasks to earn your first badge!
                            </div>
                        )}
                    </div>
                </div>

                {/* Leaderboard Sidebar */}
                <div className="md:col-span-1">
                    <LeaderboardWidget leaderboard={leaderboard} />
                </div>
            </div>

            <BadgeUnlockModal unlockedBadges={unlockedBadges} onClose={clearUnlockedBadges} />
        </div>
    );
}
