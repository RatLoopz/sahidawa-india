"use client";

import { useEffect, useState } from "react";
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

    useEffect(() => {
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const { latitude: lat, longitude: lng } = pos.coords;
                setUserLocation([lat, lng]);

                const res = await fetch(`/api/map/nearby?lat=${lat}&lng=${lng}&radius_km=10`);
                const data = await res.json();
                setPharmacies(data.pharmacies);
                setAshaWorkers(data.asha_workers);
                setLoading(false);
            },
            () => {
                // fallback: default to Pune
                const fallback: [number, number] = [18.5204, 73.8567];
                setUserLocation(fallback);
                fetch(`/api/map/nearby?lat=${fallback[0]}&lng=${fallback[1]}&radius_km=10`)
                    .then((r) => r.json())
                    .then((data) => {
                        setPharmacies(data.pharmacies);
                        setAshaWorkers(data.asha_workers);
                        setLoading(false);
                    });
            }
        );
    }, []);

    if (!userLocation || loading) return <div className="p-8 text-center">Loading map...</div>;

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
