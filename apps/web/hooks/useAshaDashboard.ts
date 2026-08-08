import { useState, useCallback, useEffect } from "react";
import { fetchWithCsrf } from "../lib/api";

export interface AshaStats {
    points: number;
    badges: string[];
    role: string;
}

export interface LeaderboardEntry {
    id: string;
    full_name: string;
    points: number;
    badges: string[];
    avatar_url: string;
    role: string;
}

export function useAshaDashboard() {
    const [stats, setStats] = useState<AshaStats | null>(null);
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [unlockedBadges, setUnlockedBadges] = useState<string[]>([]);

    const fetchDashboardData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [statsData, leaderboardData] = await Promise.all([
                fetchWithCsrf<AshaStats>("/api/v1/asha/dashboard/stats", { method: "GET" }),
                fetchWithCsrf<{ leaderboard: LeaderboardEntry[] }>("/api/v1/asha/leaderboard", {
                    method: "GET",
                }),
            ]);

            setStats(statsData);
            setLeaderboard(leaderboardData.leaderboard);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setLoading(false);
        }
    }, []);

    const awardPoints = useCallback(async (points: number, reason: string) => {
        try {
            const data = await fetchWithCsrf<any>("/api/v1/asha/award-points", {
                method: "POST",
                body: JSON.stringify({ points, reason }),
            });

            setStats((prev) =>
                prev ? { ...prev, points: data.points, badges: data.badges } : null
            );

            if (data.unlockedBadges && data.unlockedBadges.length > 0) {
                setUnlockedBadges((prev) => [...prev, ...data.unlockedBadges]);
            }

            // Refresh leaderboard
            const leaderboardData = await fetchWithCsrf<{ leaderboard: LeaderboardEntry[] }>(
                "/api/v1/asha/leaderboard",
                { method: "GET" }
            );
            setLeaderboard(leaderboardData.leaderboard);

            return data;
        } catch (err: unknown) {
            console.error(err);
            throw err;
        }
    }, []);

    const clearUnlockedBadges = useCallback(() => {
        setUnlockedBadges([]);
    }, []);

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    return {
        stats,
        leaderboard,
        loading,
        error,
        unlockedBadges,
        awardPoints,
        clearUnlockedBadges,
        refresh: fetchDashboardData,
    };
}
