"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { createClient } from "@supabase/supabase-js";

// Initialize a separate client strictly for Realtime subscriptions
// to avoid mutating the main authenticated client if not needed.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

interface OutbreakPayload {
    medicine_name: string;
    batch_number: string;
    district: string;
    alert_level: string;
    lat: number | null;
    lng: number | null;
}

// Haversine formula to calculate distance in km
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) *
            Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

export function useOutbreakAlerts() {
    useEffect(() => {
        if (!supabaseUrl || !supabaseKey) return;

        const channel = supabase
            .channel("public:outbreaks")
            .on("broadcast", { event: "outbreak" }, (event) => {
                const payload = event.payload as OutbreakPayload;

                // Attempt to get user's current location
                if ("geolocation" in navigator) {
                    navigator.geolocation.getCurrentPosition(
                        (position) => {
                            const userLat = position.coords.latitude;
                            const userLng = position.coords.longitude;

                            if (payload.lat && payload.lng) {
                                const distance = calculateDistance(
                                    userLat,
                                    userLng,
                                    payload.lat,
                                    payload.lng
                                );

                                // If within 50km, trigger the urgent toast
                                if (distance <= 50) {
                                    toast.error(
                                        `🚨 URGENT: Counterfeit Outbreak near you (${Math.round(distance)}km away)`,
                                        {
                                            description: `Avoid ${payload.medicine_name} (Batch: ${payload.batch_number}). Verified fake reports in ${payload.district}.`,
                                            duration: 15000,
                                            action: {
                                                label: "View Map",
                                                onClick: () => (window.location.href = "/map"),
                                            },
                                        }
                                    );
                                }
                            }
                        },
                        (error) => {
                            console.warn("Could not get geolocation for outbreak alert:", error);
                        },
                        { enableHighAccuracy: false, maximumAge: 60000 }
                    );
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);
}
