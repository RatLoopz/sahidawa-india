"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface PointsProgressBarProps {
    points: number;
    targetPoints: number;
}

export function PointsProgressBar({ points, targetPoints }: PointsProgressBarProps) {
    const [displayPoints, setDisplayPoints] = useState(points);

    // Micro-animation for counting numbers
    useEffect(() => {
        const start = displayPoints;
        const end = points;
        if (start === end) return;

        const duration = 1000;
        const startTime = performance.now();

        const animate = (time: number) => {
            const elapsed = time - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const current = Math.floor(start + (end - start) * progress);
            setDisplayPoints(current);

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }, [points]);

    const progressPercentage = Math.min((points / targetPoints) * 100, 100);

    return (
        <div className="w-full rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-end justify-between">
                <div>
                    <p className="text-sm font-medium tracking-wider text-slate-500 uppercase">
                        Health Tokens
                    </p>
                    <div className="flex items-center gap-2 text-4xl font-bold text-emerald-600">
                        <motion.span
                            key={points}
                            initial={{ scale: 1.2, color: "#10b981" }}
                            animate={{ scale: 1, color: "#059669" }}
                            transition={{ type: "spring", stiffness: 300 }}
                        >
                            {displayPoints}
                        </motion.span>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-sm text-slate-400">Next Milestone</p>
                    <p className="font-semibold text-slate-700">{targetPoints} Tokens</p>
                </div>
            </div>

            {/* Progress Bar Container */}
            <div className="relative h-4 overflow-hidden rounded-full bg-slate-100">
                <motion.div
                    className="absolute top-0 left-0 h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercentage}%` }}
                    transition={{ type: "spring", stiffness: 50, damping: 15 }}
                />
            </div>

            <p className="mt-3 text-center text-sm text-slate-500">
                Earn{" "}
                <span className="font-semibold text-emerald-600">
                    {targetPoints - points > 0 ? targetPoints - points : 0}
                </span>{" "}
                more tokens to unlock the next rank!
            </p>
        </div>
    );
}
