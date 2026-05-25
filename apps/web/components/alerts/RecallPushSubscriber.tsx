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

            const res = await fetch(`${API_BASE}/api/notifications/subscriptions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
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
        <section className="mb-6 rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                    <div className="rounded-full bg-emerald-50 p-2 text-emerald-600">
                        {isSubscribed ? <Bell size={18} /> : <BellOff size={18} />}
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-slate-900">Recall push alerts</h2>
                        <p className="mt-1 max-w-2xl text-sm font-medium text-slate-500">
                            Get notified when the mock CDSCO recall feed flags a medicine you should
                            avoid.
                        </p>
                        {message && (
                            <LiveMessage
                                as="p"
                                tone={isSubscribed ? "polite" : "critical"}
                                className={`mt-2 text-xs font-semibold ${
                                    isSubscribed ? "text-emerald-600" : "text-slate-500"
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
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
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
