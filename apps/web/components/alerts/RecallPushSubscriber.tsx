"use client";

import { useState, useEffect } from "react";
import { Bell, BellOff } from "lucide-react";
import { API_BASE } from "@/lib/api";
import { LiveMessage } from "@/components/ui/LiveMessage";
import { useSession } from "@/src/components/AuthProvider";

type SubscribeState =
    | "idle"
    | "subscribing"
    | "subscribed"
    | "unsupported"
    | "error"
    | "unsubscribing";

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
    const { token } = useSession();
    const [state, setState] = useState<SubscribeState>("idle");
    const [message, setMessage] = useState<string | null>(null);

    useEffect(() => {
        async function checkExistingSubscription() {
            if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
                setState("unsupported");
                return;
            }
            try {
                const registration = await navigator.serviceWorker.getRegistration("/sw.js");
                if (!registration) return;
                const existing = await registration.pushManager.getSubscription();
                if (existing) {
                    setState("subscribed");
                    setMessage("Recall notifications are active for this device.");
                }
            } catch {
                // silently ignore
            }
        }
        void checkExistingSubscription();
    }, []);

    async function unsubscribe() {
        setState("unsubscribing");
        setMessage(null);
        try {
            const registration = await navigator.serviceWorker.getRegistration("/sw.js");
            const existing = await registration?.pushManager.getSubscription();
            if (existing) {
                await existing.unsubscribe();
                if (token) {
                    await fetch(`${API_BASE}/api/notifications/subscriptions`, {
                        method: "DELETE",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${token}`,
                        },
                        body: JSON.stringify({ endpoint: existing.endpoint }),
                    });
                }
            }
            setState("idle");
            setMessage(null);
        } catch {
            setState("subscribed");
            setMessage("Unable to disable alerts. Please try again.");
        }
    }

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
                    onClick={isSubscribed ? unsubscribe : subscribe}
                    disabled={state === "subscribing" || state === "unsubscribing"}
                    className={`relative shrink-0 overflow-hidden rounded-2xl px-6 py-3 text-sm font-bold shadow-sm transition-all duration-300 hover:scale-[1.03] hover:shadow-md active:scale-95 disabled:scale-100 disabled:cursor-not-allowed ${
                        isSubscribed || state === "unsubscribing"
                            ? "bg-rose-100 text-rose-700 shadow-rose-500/10 hover:bg-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:hover:bg-rose-900/60"
                            : "bg-emerald-600 text-white shadow-emerald-500/10 hover:bg-emerald-500 disabled:bg-slate-300 dark:disabled:bg-slate-800 dark:disabled:text-slate-600"
                    }`}
                >
                    {state === "subscribing" || state === "unsubscribing" ? (
                        <span className="flex items-center gap-2">
                            <span
                                className={`h-3.5 w-3.5 animate-spin rounded-full border-2 border-t-transparent ${state === "unsubscribing" ? "border-rose-700 dark:border-rose-400" : "border-white"}`}
                            ></span>
                            {state === "unsubscribing" ? "Disabling..." : "Enabling..."}
                        </span>
                    ) : isSubscribed ? (
                        "Disable alerts"
                    ) : (
                        "Enable alerts"
                    )}
                </button>
            </div>
        </section>
    );
}
