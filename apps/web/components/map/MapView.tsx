"use client";

import { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import { usePredictivePrefetch } from "@/src/hooks/usePredictivePrefetch";

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
import { CopyButton } from "@/components/ui/CopyButton";
import { greenIcon, blueIcon, orangeIcon } from "./mapIcons";

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

    // Function to load map data
    const loadForCoords = async (lat: number, lng: number) => {
        abortControllerRef.current?.abort();
        const controller = new AbortController();
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

            if (abortControllerRef.current === controller) {
                setPharmacies(normalizedPharmacies);
                setAshaWorkers(normalizedAsha);
            }
        } catch (err) {
            if (!(err instanceof DOMException && err.name === "AbortError")) {
                console.error("[MapView] Error loading nearby map data:", err);
                setError("Unable to load nearby map data.");
            }
        } finally {
            setLoading(false);
        }
    };

    // Use the hook to prefetch data when the map enters the viewport
    const mapContainerRef = usePredictivePrefetch({
        preloadQuery: async () => {
            if (userLocation) await loadForCoords(userLocation[0], userLocation[1]);
        },
        threshold: 0.2,
    });

    useEffect(() => {
        let mounted = true;
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                if (!mounted) return;
                const { latitude: lat, longitude: lng } = pos.coords;
                setUserLocation([lat, lng]);
                void loadForCoords(lat, lng);
            },
            () => {
                if (!mounted) return;
                const fallback: [number, number] = [18.5204, 73.8567];
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
    // Uses textContent instead of innerHTML to prevent XSS via malicious entity payloads
    function decodeHtmlEntities(input: string | null | undefined) {
        if (!input) return "";
        try {
            if (!decodeTextareaRef.current) {
                decodeTextareaRef.current = document.createElement("textarea");
            }
            decodeTextareaRef.current.textContent = input;
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

            <div className="rounded-lg border bg-white p-3 text-sm shadow-sm">
                <div className="mb-2 font-semibold">Map Legend</div>

                <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-green-600"></span>
                    <span>Jan Aushadhi Kendra</span>
                </div>

                <div className="mt-1 flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-orange-500"></span>
                    <span>Private Pharmacy</span>
                </div>

                <div className="mt-1 flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-blue-600"></span>
                    <span>ASHA Worker</span>
                </div>
            </div>

            {/* Map Container with the ref applied */}
            <div ref={mapContainerRef as any}>
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
                            <Marker
                                key={`ph-${p.id}`}
                                position={[p.lat, p.lng]}
                                icon={p.type === "Jan Aushadhi" ? greenIcon : orangeIcon}
                            >
                                <Popup>
                                    <strong>{p.name}</strong>
                                    <br />
                                    <strong>Type:</strong> {p.type}
                                    <br />
                                    <div className="flex items-center gap-1">
                                        <span>Address: {p.address}</span>
                                        <CopyButton text={p.address} className="h-4 w-4" />
                                    </div>
                                    Distance: {p.distance_km} km
                                    <br />
                                    {p.verified && (
                                        <span className="text-green-600">✅ Verified</span>
                                    )}
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
        </div>
    );
}
