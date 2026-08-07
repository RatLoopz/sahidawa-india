import React from "react";
import { LeaderboardEntry } from "../../hooks/useAshaDashboard";

interface LeaderboardWidgetProps {
    leaderboard: LeaderboardEntry[];
}

export function LeaderboardWidget({ leaderboard }: LeaderboardWidgetProps) {
    if (!leaderboard || leaderboard.length === 0) {
        return (
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-lg font-bold text-slate-800">Top Performers</h3>
                <p className="py-4 text-center text-sm text-slate-500">No data available yet.</p>
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-800">Top Performers</h3>
                <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-600">
                    Global Rank
                </span>
            </div>

            <div className="space-y-4">
                {leaderboard.map((entry, index) => (
                    <div
                        key={entry.id}
                        className={`flex items-center justify-between rounded-xl p-3 transition-colors ${index < 3 ? "bg-slate-50" : "hover:bg-slate-50"}`}
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-6 text-center font-bold text-slate-400">
                                {index + 1}
                            </div>
                            <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-full border-2 border-white bg-slate-200 shadow-sm">
                                {entry.avatar_url ? (
                                    <img
                                        src={entry.avatar_url}
                                        alt={entry.full_name}
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center bg-emerald-100 font-bold text-emerald-700">
                                        {(entry.full_name || "A")[0].toUpperCase()}
                                    </div>
                                )}
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-slate-700">
                                    {entry.full_name || "Anonymous Worker"}
                                </p>
                                {entry.badges && entry.badges.length > 0 && (
                                    <p className="text-xs font-medium text-amber-600">
                                        🏆 {entry.badges[0]}
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="font-bold text-emerald-600">{entry.points}</p>
                            <p className="text-xs text-slate-400">Tokens</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
