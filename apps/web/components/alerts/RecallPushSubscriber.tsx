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
        <section className="relative mb-8 overflow-hidden rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50/60 via-white to-emerald-50/20 p-6 shadow-md backdrop-blur-md transition-all hover:shadow-lg dark:border-emerald-500/15 dark:bg-gradient-to-br dark:from-slate-900/80 dark:via-slate-900/40 dark:to-slate-950/80">
            {/* Background glowing shapes for premium aesthetic */}
            <div className="pointer-events-none absolute -right-8 -bottom-8 h-32 w-32 rounded-full bg-emerald-500/10 blur-2xl"></div>
            <div className="pointer-events-none absolute -top-8 -left-8 h-28 w-28 rounded-full bg-teal-500/5 blur-2xl"></div>

            <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 shadow-sm dark:bg-emerald-500/20 dark:text-emerald-400">
                        {isSubscribed ? (
                            <Bell size={22} className="animate-bounce" />
                        ) : (
                            <BellOff size={22} className="opacity-80" />
                        )}
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-slate-900 dark:text-(--color-text-primary)">
                            Recall push alerts
                        </h2>
                        <p className="mt-1 max-w-2xl text-sm leading-relaxed font-semibold text-slate-500 dark:text-(--color-text-secondary)">
                            Get notified when the mock CDSCO recall feed flags a medicine you should
                            avoid. Stay protected with real-time push alerts.
                        </p>
                        {message && (
                            <LiveMessage
                                as="p"
                                tone={isSubscribed ? "polite" : "critical"}
                                className={`mt-2.5 text-xs font-bold ${
                                    isSubscribed
                                        ? "dark:text-emerald-450 text-emerald-600"
                                        : "text-red-500 dark:text-red-400"
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
                    className="relative shrink-0 overflow-hidden rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-sm shadow-emerald-500/10 transition-all duration-300 hover:scale-[1.03] hover:bg-emerald-500 hover:shadow-md hover:shadow-emerald-500/20 active:scale-95 disabled:scale-100 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-800 dark:disabled:text-slate-600"
                >
                    {state === "subscribing" ? (
                        <span className="flex items-center gap-2">
                            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                            Enabling...
                        </span>
                    ) : isSubscribed ? (
                        "Enabled"
                    ) : (
                        "Enable alerts"
                    )}
                </button>
            </div>
        </section>
    );
}
