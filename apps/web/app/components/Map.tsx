"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { Hospital } from "lucide-react";
import { renderToString } from "react-dom/server";
import L, { Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix marker icons - do this once globally
if (typeof window !== "undefined") {
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
        iconRetinaUrl:
            "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
    });
}

const createCustomIcon = (type: string, isSelected: boolean = false) => {
    const color =
        type === "govt" ? "var(--color-brand-primary-hover)" : "var(--color-brand-secondary)";
    const ringColor = type === "govt" ? "rgba(5,150,105,0.2)" : "rgba(37,99,235,0.2)";
    const size = isSelected ? 32 : 26;
    const ring = isSelected
        ? `box-shadow: 0 0 0 4px ${ringColor}, 0 3px 12px rgba(0,0,0,0.25);`
        : "box-shadow: 0 2px 8px rgba(0,0,0,0.2);";
    return L.divIcon({
        className: "custom-marker",
        html: `<div style="
      background-color: ${color};
      width: ${size}px;
      height: ${size}px;
      border-radius: 50% 50% 50% 4px;
      transform: rotate(-45deg);
      border: 2.5px solid white;
      ${ring}
      transition: all 0.2s ease;
    "><div style="
      transform: rotate(45deg);
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    ">${renderToString(<Hospital size={isSelected ? 16 : 14} color="white" />)}</div></div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size],
        popupAnchor: [0, -size - 4],
    });
};

function MapController({ center }: { center: [number, number] | null }) {
    const map = useMap();
    useEffect(() => {
        if (center) {
            map.flyTo(center, 15, { duration: 1.2, easeLinearity: 0.4 });
        }
    }, [center, map]);
    return null;
}

interface Pharmacy {
    id: number;
    name: string;
    distance: string;
    rating: number;
    status: string;
    type: string;
    coordinates: [number, number];
    address: string;
    isOpen: boolean;
    emergencyAvailable: boolean;
    medicinesAvailable: number;
    openHours: string;
    phone: string;
}

export default function Map({
    pharmacies,
    selectedPharmacy,
    selectedPharmacyId,
    onMarkerClick,
}: {
    pharmacies: Pharmacy[];
    selectedPharmacy: [number, number] | null;
    selectedPharmacyId: number | null;
    onMarkerClick: (id: number) => void;
}) {
    const [isClient, setIsClient] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const mapRef = useRef<LeafletMap | null>(null);
    const containerId = useRef(`map-${Date.now()}-${Math.random()}`);

    useEffect(() => {
        setIsClient(true);
        const checkMobile = () => {
            setIsMobile(window.innerWidth <= 768);
        };

        checkMobile();

        window.addEventListener("resize", checkMobile);
        return () => {
            window.removeEventListener("resize", checkMobile);
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, []);
    const selectedMarker = pharmacies.find((p) => p.id === selectedPharmacyId);
    if (!isClient) {
        return (
            <div className="flex h-full w-full items-center justify-center bg-slate-100">
                <div className="text-center">
                    <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent"></div>
                    <p className="text-xs text-slate-500">Initializing map...</p>
                </div>
            </div>
        );
    }

    return (
        <>
            <MapContainer
                key={containerId.current}
                center={[20.5937, 78.9629]}
                zoom={5}
                style={{ height: "100%", width: "100%" }}
                zoomControl={false}
                scrollWheelZoom={true}
                className="z-0"
                ref={(map: LeafletMap | null) => {
                    if (map) {
                        mapRef.current = map;
                    }
                }}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                    maxZoom={19}
                />
                <MapController center={selectedPharmacy} />

                {pharmacies.map((pharmacy) => (
                    <Marker
                        key={pharmacy.id}
                        position={pharmacy.coordinates}
                        icon={createCustomIcon(pharmacy.type, selectedPharmacyId === pharmacy.id)}
                        eventHandlers={{ click: () => onMarkerClick(pharmacy.id) }}
                        zIndexOffset={selectedPharmacyId === pharmacy.id ? 1000 : 0}
                    >
                        {!isMobile && (
                            <Popup className="pharmacy-popup" maxWidth={240}>
                                <div style={{ minWidth: 210, padding: "4px 2px" }}>
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "flex-start",
                                            gap: 8,
                                            marginBottom: 8,
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: 36,
                                                height: 36,
                                                borderRadius: 8,
                                                background:
                                                    pharmacy.type === "govt"
                                                        ? "var(--color-brand-primary-soft)"
                                                        : "var(--color-brand-secondary-soft)",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                flexShrink: 0,
                                            }}
                                        >
                                            <Hospital size={18} className="text-emerald-700" />
                                        </div>
                                        <div>
                                            <p
                                                style={{
                                                    fontWeight: 700,
                                                    fontSize: 12,
                                                    color: "var(--color-text-primary)",
                                                    lineHeight: 1.3,
                                                    margin: 0,
                                                }}
                                            >
                                                {pharmacy.name}
                                            </p>
                                            <p
                                                style={{
                                                    fontSize: 10,
                                                    color: "var(--color-text-secondary)",
                                                    margin: "2px 0 0",
                                                }}
                                            >
                                                {pharmacy.address}
                                            </p>
                                        </div>
                                    </div>
                                    <div
                                        style={{
                                            display: "flex",
                                            gap: 4,
                                            flexWrap: "wrap",
                                            marginBottom: 8,
                                        }}
                                    >
                                        <span
                                            style={{
                                                fontSize: 10,
                                                background: "var(--color-accent-warning-soft)",
                                                color: "var(--color-accent-warning-text)",
                                                padding: "2px 6px",
                                                borderRadius: 99,
                                                fontWeight: 600,
                                            }}
                                        >
                                            ★ {pharmacy.rating}
                                        </span>
                                        <span
                                            style={{
                                                fontSize: 10,
                                                background: pharmacy.isOpen
                                                    ? "var(--color-brand-primary-subtle)"
                                                    : "var(--color-accent-danger-soft)",
                                                color: pharmacy.isOpen
                                                    ? "var(--color-brand-primary-strong-text)"
                                                    : "var(--color-accent-danger-text)",
                                                padding: "2px 6px",
                                                borderRadius: 99,
                                                fontWeight: 600,
                                            }}
                                        >
                                            {pharmacy.isOpen ? "● Open" : "● Closed"}
                                        </span>
                                        {pharmacy.emergencyAvailable && (
                                            <span
                                                style={{
                                                    fontSize: 10,
                                                    background: "var(--color-accent-warning-soft)",
                                                    color: "var(--color-accent-warning-strong-text)",
                                                    padding: "2px 6px",
                                                    borderRadius: 99,
                                                    fontWeight: 600,
                                                }}
                                            >
                                                24/7
                                            </span>
                                        )}
                                    </div>
                                    <button
                                        onClick={() =>
                                            window.open(
                                                `https://maps.google.com?q=${pharmacy.coordinates[0]},${pharmacy.coordinates[1]}`,
                                                "_blank"
                                            )
                                        }
                                        style={{
                                            width: "100%",
                                            background: "var(--color-dark-surface)",
                                            color: "white",
                                            fontSize: 11,
                                            fontWeight: 600,
                                            padding: "7px 12px",
                                            borderRadius: 8,
                                            border: "none",
                                            cursor: "pointer",
                                        }}
                                    >
                                        Get Directions →
                                    </button>
                                </div>
                            </Popup>
                        )}
                    </Marker>
                ))}
            </MapContainer>
            <AnimatePresence>
                {isMobile && selectedMarker && (
                    <motion.div
                        drag="y"
                        dragConstraints={{ top: 0, bottom: 300 }}
                        onDragEnd={(_, info) => {
                            if (info.offset.y > 100) {
                                onMarkerClick(-1);
                            }
                        }}
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ duration: 0.25 }}
                        className="fixed right-0 bottom-0 left-0 z-[9999] rounded-t-2xl bg-white p-4 shadow-2xl"
                    >
                        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-gray-300" />
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold">{selectedMarker.name}</h3>
                            <button onClick={() => onMarkerClick(-1)} className="text-xl font-bold">
                                ✕
                            </button>
                        </div>
                        <p className="text-sm text-gray-600">{selectedMarker.address}</p>

                        <p className="mt-2 text-sm">Distance: {selectedMarker.distance}</p>

                        <p className="text-sm">Status: {selectedMarker.status}</p>

                        <button
                            onClick={() =>
                                window.open(
                                    `https://maps.google.com?q=${selectedMarker.coordinates[0]},${selectedMarker.coordinates[1]}`,
                                    "_blank"
                                )
                            }
                            className="mt-3 w-full rounded-lg bg-black py-2 text-white"
                        >
                            Get Directions
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
