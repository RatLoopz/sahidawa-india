"use client";

import { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
interface Pharmacy {
    id: number;
    name: string;
    type: "Jan Aushadhi" | "private";
    lat: number;
    lng: number;
    address: string;
    district: string;
    state: string;
    verified: boolean;
    distance_km: number;
}

interface AshaWorker {
    id: number;
    name: string;
    district: string;
    lat: number;
    lng: number;
    contact: string;
    distance_km: number;
}

// Leaflet must be loaded client-side only in Next.js
const MapContainer = dynamic(() => import("react-leaflet").then((m) => m.MapContainer), {
    ssr: false,
});
const TileLayer = dynamic(() => import("react-leaflet").then((m) => m.TileLayer), { ssr: false });
const Marker = dynamic(() => import("react-leaflet").then((m) => m.Marker), { ssr: false });
const Popup = dynamic(() => import("react-leaflet").then((m) => m.Popup), { ssr: false });

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { CopyButton } from "@/components/ui/CopyButton";

// Fix default marker icon broken in webpack
const greenIcon = L.icon({
    iconUrl:
        "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
});
const blueIcon = L.icon({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
});

export default function MapView() {
    const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
    const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
    const [ashaWorkers, setAshaWorkers] = useState<AshaWorker[]>([]);
    const [showPharmacies, setShowPharmacies] = useState(true);
    const [showAsha, setShowAsha] = useState(true);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const abortControllerRef = useRef<AbortController | null>(null);
    const decodeTextareaRef = useRef<HTMLTextAreaElement | null>(null);

    useEffect(() => {
        let mounted = true;

        async function loadForCoords(lat: number, lng: number) {
            // abort previous
            abortControllerRef.current?.abort();
            const controller = new AbortController();
            // store controller on the ref
            abortControllerRef.current = controller;

            setLoading(true);
            setError(null);

            try {
                const res = await fetch(`/api/map/nearby?lat=${lat}&lng=${lng}&radius_km=10`, {
                    signal: controller.signal,
                });

                if (!res.ok) {
                    const text = await res.text().catch(() => "");
                    throw new Error(`Map API error: ${res.status} ${text}`);
                }

                const data = await res.json();

                if (!mounted) return;

                // Normalize and decode incoming data once to avoid per-render DOM decoding
                const normalizedPharmacies: Pharmacy[] = Array.isArray(data.pharmacies)
                    ? data.pharmacies.map((p: Pharmacy) => ({
                          ...p,
                          name: decodeHtmlEntities(p.name),
                          address: decodeHtmlEntities(p.address),
                      }))
                    : [];

                const normalizedAsha: AshaWorker[] = Array.isArray(data.asha_workers)
                    ? data.asha_workers.map((a: AshaWorker) => ({
                          ...a,
                          name: decodeHtmlEntities(a.name),
                      }))
                    : [];

                // Only apply results if this controller is still the latest
                if (abortControllerRef.current === controller) {
                    setPharmacies(normalizedPharmacies);
                    setAshaWorkers(normalizedAsha);
                }
            } catch (err: unknown) {
                if (err instanceof DOMException && err.name === "AbortError") return;
                console.error("[MapView] Error loading nearby map data:", err);
                if (mounted && abortControllerRef.current === controller) {
                    setError("Unable to load nearby map data.");
                }
            } finally {
                if (mounted && abortControllerRef.current === controller) {
                    setLoading(false);
                }
            }
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const { latitude: lat, longitude: lng } = pos.coords;
                if (!mounted) return;
                setUserLocation([lat, lng]);
                void loadForCoords(lat, lng);
            },
            () => {
                // fallback: default to Pune
                const fallback: [number, number] = [18.5204, 73.8567];
                if (!mounted) return;
                setUserLocation(fallback);
                void loadForCoords(fallback[0], fallback[1]);
            }
        );

        return () => {
            mounted = false;
            abortControllerRef.current?.abort();
        };
    }, []);

    // decode simple HTML entities to reduce broken encoding artifacts in popups
    function decodeHtmlEntities(input: string | null | undefined) {
        if (!input) return "";
        try {
            if (!decodeTextareaRef.current) {
                decodeTextareaRef.current = document.createElement("textarea");
            }
            decodeTextareaRef.current.innerHTML = input;
            return decodeTextareaRef.current.value;
        } catch {
            return input;
        }
    }

    if (!userLocation || loading || error)
        return (
            <div className="p-8 text-center">
                {error ? (
                    <div className="text-sm text-red-600">{error}</div>
                ) : loading ? (
                    <span>Loading map…</span>
                ) : (
                    <span>Initializing map…</span>
                )}
            </div>
        );

    return (
        <div className="flex flex-col gap-3">
            {/* Filter toggles */}
            <div className="flex gap-3">
                <button
                    onClick={() => setShowPharmacies((p) => !p)}
                    className={`rounded-full border px-4 py-2 text-sm font-medium ${showPharmacies ? "bg-green-600 text-white" : "border-green-600 bg-white text-green-600"}`}
                >
                    🟢 Pharmacies
                </button>
                <button
                    onClick={() => setShowAsha((a) => !a)}
                    className={`rounded-full border px-4 py-2 text-sm font-medium ${showAsha ? "bg-blue-600 text-white" : "border-blue-600 bg-white text-blue-600"}`}
                >
                    🔵 ASHA Workers
                </button>
            </div>

            {/* Map */}
            <MapContainer
                center={userLocation}
                zoom={13}
                style={{ height: "500px", width: "100%" }}
            >
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
                />

                {showPharmacies &&
                    pharmacies.map((p) => (
                        <Marker key={`ph-${p.id}`} position={[p.lat, p.lng]} icon={greenIcon}>
                            <Popup>
                                <strong>{p.name}</strong>
                                <br />
                                Type: {p.type}
                                <br />
                                <div className="flex items-center gap-1">
                                    <span>Address: {p.address}</span>
                                    <CopyButton text={p.address} className="h-4 w-4" />
                                </div>
                                Distance: {p.distance_km} km
                                <br />
                                {p.verified && <span className="text-green-600">✅ Verified</span>}
                            </Popup>
                        </Marker>
                    ))}

                {showAsha &&
                    ashaWorkers.map((a) => (
                        <Marker key={`asha-${a.id}`} position={[a.lat, a.lng]} icon={blueIcon}>
                            <Popup>
                                <strong>{a.name}</strong>
                                <br />
                                District: {a.district}
                                <br />
                                <div className="flex items-center gap-1">
                                    <span>Contact: {a.contact}</span>
                                    <CopyButton text={a.contact} className="h-4 w-4" />
                                </div>
                                Distance: {a.distance_km} km
                            </Popup>
                        </Marker>
                    ))}
            </MapContainer>
        </div>
    );
}
