"use client";

import { useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { API_BASE } from "@/lib/api";
import { LiveMessage } from "@/components/ui/LiveMessage";

type SubscribeState = "idle" | "subscribing" | "subscribed" | "unsupported" | "error";

function urlBase64ToUint8Array(value: string) {
    const padding = "=".repeat((4 - (value.length % 4)) % 4);
    const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
    const raw = window.atob(base64);
    return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

async function getVapidPublicKey() {
    const res = await fetch(`${API_BASE}/api/notifications/vapid-public-key`, {
        cache: "no-store",
    });

    if (!res.ok) {
        throw new Error("Failed to load push configuration");
    }

    const data = (await res.json()) as { publicKey: string | null; configured: boolean };
    if (!data.configured || !data.publicKey) {
        throw new Error("Push notifications are not configured yet");
    }

    return data.publicKey;
}

export default function RecallPushSubscriber() {
    const [state, setState] = useState<SubscribeState>("idle");
    const [message, setMessage] = useState<string | null>(null);

    async function subscribe() {
        if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
            setState("unsupported");
            setMessage("Push notifications are not supported in this browser.");
            return;
        }

        setState("subscribing");
        setMessage(null);

        try {
            const permission = await Notification.requestPermission();
            if (permission !== "granted") {
                setState("error");
                setMessage("Notification permission was not granted.");
                return;
            }

            const publicKey = await getVapidPublicKey();
            const registration = await navigator.serviceWorker.register("/sw.js");
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicKey),
            });

            const token = localStorage.getItem("sb-access-token");
            if (!token) {
                setState("error");
                setMessage("Please sign in to enable push alerts.");
                return;
            }

            const res = await fetch(`${API_BASE}/api/notifications/subscriptions`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(subscription),
            });

            if (!res.ok) {
                throw new Error("Failed to save push subscription");
            }

            setState("subscribed");
            setMessage("Recall notifications are active for this device.");
        } catch (error) {
            setState("error");
            setMessage(error instanceof Error ? error.message : "Unable to enable recall alerts.");
        }
    }

    const isSubscribed = state === "subscribed";

    return (
        <section className="relative mb-6 overflow-hidden rounded-2xl border border-emerald-500/30 bg-linear-to-r from-emerald-50/60 to-teal-50/40 p-5 shadow-md backdrop-blur-md dark:border-emerald-500/20 dark:from-emerald-950/20 dark:to-slate-900/40">
            {/* Subtle glow effect */}
            <div className="pointer-events-none absolute -top-12 -left-12 h-24 w-24 rounded-full bg-emerald-400/20 blur-xl dark:bg-emerald-500/10"></div>

            <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3.5">
                    <div className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-600 shadow-inner dark:text-emerald-400">
                        {isSubscribed ? <Bell size={20} /> : <BellOff size={20} />}
                    </div>
                    <div>
                        <h2 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
                            Recall push alerts
                        </h2>
                        <p className="dark:text-slate-350 mt-1 max-w-2xl text-sm font-medium text-slate-600">
                            Get notified when the mock CDSCO recall feed flags a medicine you should
                            avoid.
                        </p>
                        {message && (
                            <LiveMessage
                                as="p"
                                tone={isSubscribed ? "polite" : "critical"}
                                className={`mt-2 text-xs font-semibold ${
                                    isSubscribed
                                        ? "text-emerald-600 dark:text-emerald-400"
                                        : "dark:text-rose-450 text-rose-500"
                                }`}
                            >
                                {message}
                            </LiveMessage>
                        )}
                    </div>
                </div>
                <button
                    type="button"
                    onClick={subscribe}
                    disabled={state === "subscribing" || isSubscribed}
                    className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white transition-all duration-300 hover:scale-102 hover:bg-emerald-500 hover:shadow-lg hover:shadow-emerald-500/20 active:scale-98 disabled:scale-100 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
                >
                    {state === "subscribing"
                        ? "Enabling..."
                        : isSubscribed
                          ? "Enabled"
                          : "Enable alerts"}
                </button>
            </div>
        </section>
    );
}
