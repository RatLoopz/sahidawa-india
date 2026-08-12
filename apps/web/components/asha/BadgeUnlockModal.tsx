"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";

interface BadgeUnlockModalProps {
    unlockedBadges: string[];
    onClose: () => void;
}

const BADGE_IMAGES: Record<string, string> = {
    "Village Guardian": "https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg", // Replace with actual Cloudinary URL
    "Health Champion": "https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg", // Replace with actual Cloudinary URL
};

export function BadgeUnlockModal({ unlockedBadges, onClose }: BadgeUnlockModalProps) {
    if (unlockedBadges.length === 0) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
                <motion.div
                    className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-white p-8 text-center shadow-2xl"
                    initial={{ opacity: 0, scale: 0.8, y: 50 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8, y: 50 }}
                    transition={{ type: "spring", bounce: 0.5, duration: 0.6 }}
                >
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-amber-100/50 to-transparent" />

                    <motion.div
                        initial={{ rotate: -180, scale: 0 }}
                        animate={{ rotate: 0, scale: 1 }}
                        transition={{ type: "spring", delay: 0.2, duration: 0.8 }}
                        className="relative mx-auto mb-6 h-32 w-32"
                    >
                        <div className="absolute inset-0 animate-ping rounded-full bg-amber-400 opacity-20" />
                        <img
                            src={
                                BADGE_IMAGES[unlockedBadges[0]] || BADGE_IMAGES["Village Guardian"]
                            }
                            alt={unlockedBadges[0]}
                            className="relative z-10 h-full w-full rounded-full border-4 border-amber-400 object-cover shadow-lg"
                        />
                    </motion.div>

                    <h2 className="mb-2 text-2xl font-bold text-slate-800">
                        Achievement Unlocked!
                    </h2>
                    <p className="mb-4 text-xl font-bold text-emerald-600">{unlockedBadges[0]}</p>
                    <p className="mb-8 text-slate-600">
                        Congratulations! Your dedication is making a real difference in the
                        community.
                    </p>

                    <button
                        onClick={onClose}
                        className="w-full rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white shadow-md transition-colors hover:bg-slate-800"
                    >
                        Awesome!
                    </button>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
