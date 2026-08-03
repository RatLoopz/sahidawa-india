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
            const [statsRes, leaderboardRes] = await Promise.all([
                fetchWithCsrf("/api/v1/asha/dashboard/stats"),
                fetchWithCsrf("/api/v1/asha/leaderboard"),
            ]);

            if (!statsRes.ok || !leaderboardRes.ok) {
                throw new Error("Failed to fetch dashboard data");
            }

            const statsData = await statsRes.json();
            const leaderboardData = await leaderboardRes.json();

            setStats(statsData);
            setLeaderboard(leaderboardData.leaderboard);
        } catch (err: any) {
            setError(err.message || "An error occurred");
        } finally {
            setLoading(false);
        }
    }, []);

    const awardPoints = useCallback(async (points: number, reason: string) => {
        try {
            const res = await fetchWithCsrf("/api/v1/asha/award-points", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ points, reason }),
            });

            if (!res.ok) {
                throw new Error("Failed to award points");
            }

            const data = await res.json();
            setStats((prev) =>
                prev ? { ...prev, points: data.points, badges: data.badges } : null
            );

            if (data.unlockedBadges && data.unlockedBadges.length > 0) {
                setUnlockedBadges((prev) => [...prev, ...data.unlockedBadges]);
            }

            // Refresh leaderboard
            const leaderboardRes = await fetchWithCsrf("/api/v1/asha/leaderboard");
            if (leaderboardRes.ok) {
                const leaderboardData = await leaderboardRes.json();
                setLeaderboard(leaderboardData.leaderboard);
            }

            return data;
        } catch (err: any) {
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
