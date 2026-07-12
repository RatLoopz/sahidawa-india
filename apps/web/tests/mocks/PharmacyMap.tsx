import React from "react";

export interface Pharmacy {
    id: number;
    name: string;
    distance: string;
    distanceKm?: number;
    rating: number;
    status: string;
    type: "govt" | "private";
    coordinates: { lat: number; lng: number };
    address?: string;
    phone?: string;
    website?: string;
    isVerified?: boolean;
    operatingHours?: string;
    timezone?: string;
}

export interface MapBounds {
    south: number;
    west: number;
    north: number;
    east: number;
    center: { lat: number; lng: number };
}

export type HeatmapMode = "none" | "density" | "counterfeit" | "combined";

export interface RiskHotspot {
    id: string;
    label: string;
    coordinates: { lat: number; lng: number };
    intensity: number;
    category: "density" | "counterfeit";
    details?: string;
}

export interface AshaWorker {
    id: number;
    name: string;
    district: string;
    coordinates: { lat: number; lng: number };
    contact: string;
    distanceKm?: number;
}

export default function MockPharmacyMap({
    pharmacies = [],
    onMapMoveEnd,
    onMapReady,
}: {
    pharmacies?: Pharmacy[];
    onMapMoveEnd?: (bounds: MapBounds, zoom?: number) => void;
    onMapReady?: (bounds: MapBounds) => void;
}) {
    const mockBounds: MapBounds = {
        south: 28.5,
        west: 77.1,
        north: 28.7,
        east: 77.3,
        center: { lat: 28.6139, lng: 77.209 },
    };

    return (
        <div data-testid="mock-pharmacy-map">
            <button type="button" onClick={() => onMapReady?.(mockBounds)}>
                Mock map ready
            </button>
            <button
                type="button"
                onClick={() => {
                    onMapMoveEnd?.(mockBounds, 14);
                }}
            >
                Mock map moved
            </button>
            {pharmacies.map((pharmacy) => (
                <span key={pharmacy.id}>{pharmacy.name}</span>
            ))}
        </div>
    );
}
