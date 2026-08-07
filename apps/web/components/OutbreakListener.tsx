"use client";

import { useOutbreakAlerts } from "@/hooks/useOutbreakAlerts";

export function OutbreakListener() {
    useOutbreakAlerts();

    // This component doesn't render anything visually,
    // it just mounts the WebSocket listener at the layout level.
    return null;
}
