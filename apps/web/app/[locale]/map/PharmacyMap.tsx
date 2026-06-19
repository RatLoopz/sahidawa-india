"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";

/**
 * PharmacyMap Component
 * Real Leaflet.js + OpenStreetMap integration for SahiDawa
 * - Displays India map with clickable pharmacy markers
 * - Custom styled markers (emerald for govt, blue for private)
 * - Rich popups with pharmacy details
 * - Geolocation support
 * - Zero API keys required (free CARTO tiles)
 */

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

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

interface PharmacyMapProps {
    pharmacies: Pharmacy[];
    ashaWorkers?: AshaWorker[];
    selectedPharmacyId?: number | null;
    onSelectPharmacy?: (pharmacyId: number) => void;
    onLocateUser?: () => void;
    userLocation?: { lat: number; lng: number } | null;
    onMapMoveEnd?: (bounds: MapBounds) => void;
    onMapReady?: (bounds: MapBounds) => void;
    autoFitBounds?: boolean;
    initialCenter?: { lat: number; lng: number };
    initialZoom?: number;
    heatmapMode?: HeatmapMode;
    riskHotspots?: RiskHotspot[];
}

export default function PharmacyMap({
    pharmacies,
    ashaWorkers = [],
    selectedPharmacyId,
    onSelectPharmacy,
    userLocation,
    onMapMoveEnd,
    onMapReady,
    autoFitBounds = true,
    initialCenter,
    initialZoom,
    heatmapMode = "none",
    riskHotspots = [],
}: PharmacyMapProps) {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<any>(null);
    const layerGroup = useRef<any>(null);
    const ashaLayerGroup = useRef<any>(null);
    const heatLayerGroup = useRef<any>(null);
    const userMarker = useRef<any>(null);
    const markersRef = useRef<Map<number, any>>(new Map());
    const [mapError, setMapError] = useState(false);
    const [isMapReady, setIsMapReady] = useState(false);

    // Initialize the map
    useEffect(() => {
        let mounted = true;

        const initMap = async () => {
            try {
                // Load Leaflet CSS and JS dynamically if not already present
                if (!(window as any).L) {
                    const link = document.createElement("link");
                    link.rel = "stylesheet";
                    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
                    link.crossOrigin = "";
                    document.head.appendChild(link);

                    await new Promise<void>((resolve, reject) => {
                        const script = document.createElement("script");
                        script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
                        script.onload = () => resolve();
                        script.onerror = () => reject(new Error("Failed to load Leaflet"));
                        document.head.appendChild(script);
                    });

                    // Small delay to let Leaflet fully initialize
                    await new Promise((r) => setTimeout(r, 100));
                }

                if (!mounted || !mapContainer.current) return;

                const L = (window as any).L;

                // Initialize Map (centered on India)
                if (!map.current) {
                    const center = initialCenter || { lat: 22.5937, lng: 78.9629 };
                    const zoom = initialZoom || 5;

                    map.current = L.map(mapContainer.current, {
                        zoomControl: false,
                    }).setView([center.lat, center.lng], zoom);

                    // CARTO Voyager tiles — clean, free, no API key
                    L.tileLayer(
                        "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
                        {
                            attribution:
                                '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>',
                            maxZoom: 19,
                        }
                    ).addTo(map.current);

                    // Add zoom control to bottom-right (away from our controls)
                    L.control.zoom({ position: "bottomright" }).addTo(map.current);

                    // Inject verified marker glow animation
                    if (!document.getElementById("sahidawa-verified-styles")) {
                        const style = document.createElement("style");
                        style.id = "sahidawa-verified-styles";
                        style.textContent = `
                          @keyframes sahidawa-verified-glow {
                            0%, 100% { box-shadow: 0 0 8px 3px rgba(5,150,105,0.35); }
                            50% { box-shadow: 0 0 18px 7px rgba(5,150,105,0.6); }
                          }
                          @keyframes sahidawa-pulse {
                            0% { transform: scale(0.95); opacity: 0.5; }
                            50% { transform: scale(1.2); opacity: 0.2; }
                            100% { transform: scale(0.95); opacity: 0.5; }
                          }
                        `;
                        document.head.appendChild(style);
                    }

                    layerGroup.current = L.layerGroup().addTo(map.current);
                    ashaLayerGroup.current = L.layerGroup().addTo(map.current);
                    heatLayerGroup.current = L.layerGroup().addTo(map.current);

                    // Fire moveend callback so the page can fetch initial data
                    const getBounds = () => {
                        const b = map.current.getBounds();
                        const c = map.current.getCenter();
                        return {
                            south: b.getSouth(),
                            west: b.getWest(),
                            north: b.getNorth(),
                            east: b.getEast(),
                            center: { lat: c.lat, lng: c.lng },
                        };
                    };

                    map.current.on("moveend", () => {
                        if (onMapMoveEnd) onMapMoveEnd(getBounds());
                    });

                    // Notify parent that map is ready
                    if (onMapReady) {
                        setTimeout(() => onMapReady(getBounds()), 200);
                    }
                }

                if (mounted) {
                    setIsMapReady(true);
                }
            } catch (error) {
                console.error("Error initializing Leaflet map:", error);
                if (mounted) setMapError(true);
            }
        };

        initMap();

        return () => {
            mounted = false;
        };
    }, [initialCenter, initialZoom, onMapMoveEnd, onMapReady]);

    // Update heatmap circles when risk layer changes
    useEffect(() => {
        if (!isMapReady || !map.current || !heatLayerGroup.current) return;

        const L = (window as any).L;
        if (!L) return;

        heatLayerGroup.current.clearLayers();
        if (heatmapMode === "none") return;

        riskHotspots
            .filter((hotspot) => heatmapMode === "combined" || hotspot.category === heatmapMode)
            .forEach((hotspot) => {
                const normalizedIntensity = Math.max(0.15, Math.min(1, hotspot.intensity));
                const isCounterfeit = hotspot.category === "counterfeit";
                const color = isCounterfeit
                    ? "var(--color-accent-danger)"
                    : "var(--color-accent-cyan)";
                const fillColor = isCounterfeit
                    ? "var(--color-accent-danger-bright)"
                    : "var(--color-accent-cyan-soft)";
                const radius = isCounterfeit
                    ? 1800 + normalizedIntensity * 4200
                    : 900 + normalizedIntensity * 2600;

                const circle = L.circle([hotspot.coordinates.lat, hotspot.coordinates.lng], {
                    radius,
                    color,
                    weight: 1,
                    opacity: 0.42,
                    fillColor,
                    fillOpacity: isCounterfeit ? 0.2 : 0.16,
                    interactive: true,
                }).addTo(heatLayerGroup.current);

                circle.bindTooltip(
                    `<strong>${hotspot.label}</strong><br/>${hotspot.details || ""}`,
                    {
                        direction: "top",
                        sticky: true,
                        opacity: 0.92,
                    }
                );
            });
    }, [heatmapMode, riskHotspots, isMapReady]);

    // Update markers when ASHA workers change
    useEffect(() => {
        if (!isMapReady || !map.current || !ashaLayerGroup.current) return;

        const L = (window as any).L;
        if (!L) return;

        // Clear existing ASHA markers
        ashaLayerGroup.current.clearLayers();

        if (!ashaWorkers || ashaWorkers.length === 0) {
            return;
        }

        ashaWorkers.forEach((worker) => {
            const customIcon = L.divIcon({
                className: "asha-worker-marker",
                html: `
          <div style="position:relative;width:36px;height:36px;">
            <div style="
              width: 36px;
              height: 36px;
              background: linear-gradient(135deg, #3b82f6, #1d4ed8);
              border-radius: 50% 50% 50% 4px;
              transform: rotate(-45deg);
              border: 3px solid #93c5fd;
              box-shadow: 0 4px 12px rgba(59,130,246,0.4), 0 2px 4px rgba(0,0,0,0.1);
              display: flex;
              align-items: center;
              justify-content: center;
            ">
              <svg style="transform: rotate(45deg); width: 18px; height: 18px; color: white;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
          </div>`,
                iconSize: [36, 36],
                iconAnchor: [18, 36],
                popupAnchor: [0, -36],
            });

            const marker = L.marker([worker.coordinates.lat, worker.coordinates.lng], {
                icon: customIcon,
            }).addTo(ashaLayerGroup.current);

            const popupContent = `
        <div style="
          padding: 12px;
          min-width: 220px;
          max-width: 280px;
          font-family: ui-sans-serif, system-ui, sans-serif;
          color: #1e293b;
        ">
          <div style="
            background: linear-gradient(90deg, #3b82f6, #1d4ed8);
            color: white;
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 10px;
            font-weight: 800;
            display: flex;
            align-items: center;
            gap: 4px;
            margin-bottom: 8px;
          ">
            🩺 Certified ASHA Worker
          </div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <div style="flex:1;min-width:0;">
              <div style="font-weight:800;color:#1e293b;font-size:13px;line-height:1.3;">${escapeHtml(worker.name)}</div>
              <span style="
                font-size:10px;
                font-weight:700;
                padding:2px 6px;
                border-radius:4px;
                background:#eff6ff;color:#1e40af;
                display:inline-block;
                margin-top:2px;
              ">District: ${escapeHtml(worker.district || "N/A")}</span>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:12px;font-size:12px;color:#94a3b8;margin-bottom:12px;">
            ${worker.distanceKm ? `<span style="font-weight:600;color:#64748b;">${worker.distanceKm.toFixed(1)} km away</span>` : ""}
          </div>
          <div style="display:flex; flex-direction:column; gap:6px;">
            ${
                worker.contact
                    ? `<a href="tel:${escapeHtml(worker.contact)}" style="
                display:flex;
                align-items:center;
                justify-content:center;
                gap:6px;
                width:100%;
                padding:8px;
                background:#1d4ed8;
                color:white;
                border-radius:10px;
                text-decoration:none;
                font-size:12px;
                font-weight:700;
              ">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                Call ASHA Worker
              </a>`
                    : ""
            }
          </div>
        </div>
      `;

            marker.bindPopup(popupContent, {
                className: "sahidawa-popup",
                closeButton: true,
                maxWidth: 300,
            });

            if (window.matchMedia("(pointer: fine)").matches) {
                marker.on("mouseover", () => {
                    marker.openPopup();
                });
            }
        });
    }, [ashaWorkers, isMapReady]);

    // Update markers when pharmacies change
    useEffect(() => {
        if (!isMapReady || !map.current || !layerGroup.current) return;

        const L = (window as any).L;
        if (!L) return;

        // Clear existing markers
        layerGroup.current.clearLayers();
        markersRef.current.clear();

        if (pharmacies.length === 0) {
            return;
        }

        const bounds = L.latLngBounds([]);

        pharmacies.forEach((pharmacy) => {
            bounds.extend([pharmacy.coordinates.lat, pharmacy.coordinates.lng]);

            const isVerified = pharmacy.isVerified === true;
            const isGovt = pharmacy.type === "govt";
            const markerColor = isVerified
                ? "var(--color-brand-primary-hover)"
                : "var(--color-brand-primary-hover)";
            const markerShadowColor =
                isVerified || isGovt ? "rgba(5,150,105,0.25)" : "rgba(59,130,246,0.25)";

            let customMarker;

            if (isVerified) {
                // Glowing green shield marker for verified pharmacies
                customMarker = L.divIcon({
                    className: "sahidawa-verified-marker",
                    html: `
          <div style="position:relative;width:40px;height:40px;">
            <div style="
              width: 40px;
              height: 40px;
              background: linear-gradient(135deg, var(--color-brand-primary-hover), var(--color-brand-primary-dark));
              border-radius: 6px 6px 50% 50%;
              border: 3px solid var(--color-brand-primary-soft);
              display: flex;
              align-items: center;
              justify-content: center;
              animation: sahidawa-verified-glow 2s ease-in-out infinite;
            ">
              <svg style="width:20px;height:20px;color:white;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <path d="M9 12l2 2 4-4"/>
              </svg>
            </div>
          </div>`,
                    iconSize: [40, 40],
                    iconAnchor: [20, 40],
                    popupAnchor: [0, -40],
                });
            } else {
                // Standard teardrop marker (green for govt, blue for private)
                const markerBorder = isGovt
                    ? "var(--color-brand-primary-soft)"
                    : "var(--color-brand-secondary-soft)";

                customMarker = L.divIcon({
                    className: "sahidawa-marker",
                    html: `
          <div class="sahidawa-marker-shell" style="
            position: relative;
            width: 36px;
            height: 36px;
          ">
            <div style="
              width: 36px;
              height: 36px;
              background: ${markerColor};
              border-radius: 50% 50% 50% 4px;
              transform: rotate(-45deg);
              border: 3px solid ${markerBorder};
              box-shadow: 0 4px 12px ${markerShadowColor}, 0 2px 4px rgba(0,0,0,0.1);
              display: flex;
              align-items: center;
              justify-content: center;
            ">
              <svg style="transform: rotate(45deg); width: 16px; height: 16px; color: white;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                ${
                    isGovt
                        ? '<path d="M3 21h18"/><path d="M9 8h1"/><path d="M14 8h1"/><path d="M9 12h1"/><path d="M14 12h1"/><path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"/>'
                        : '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>'
                }
              </svg>
            </div>
          </div>`,
                    iconSize: [36, 36],
                    iconAnchor: [18, 36],
                    popupAnchor: [0, -36],
                });
            }

            const marker = L.marker([pharmacy.coordinates.lat, pharmacy.coordinates.lng], {
                icon: customMarker,
            }).addTo(layerGroup.current);

            // Store reference for programmatic access
            markersRef.current.set(pharmacy.id, marker);

            // Rich popup matching SahiDawa's design
            const statusColor = isVerified
                ? "background:#d1fae5;color:#065f46"
                : pharmacy.status === "Verified" || pharmacy.status === "Govt. Verified"
                  ? "background:#d1fae5;color:#065f46"
                  : "background:#fef3c7;color:#92400e";

            const verifiedBanner = isVerified
                ? `<div style="
                    background: linear-gradient(90deg, var(--color-brand-primary-hover), var(--color-brand-primary-dark));
                    color: white;
                    padding: 4px 10px;
                    border-radius: 6px;
                    font-size: 10px;
                    font-weight: 800;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    margin-bottom: 8px;
                  ">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>
                    Verified Safe Store
                  </div>`
                : "";

            // Directions setup (Fixed interpolation template string issue here)
            const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${pharmacy.coordinates.lat},${pharmacy.coordinates.lng}`;

            const popupContent = `
        <div style="
          padding: 12px;
          min-width: 220px;
          max-width: 280px;
          font-family: ui-sans-serif, system-ui, sans-serif;
          color: #1e293b;
        ">
          ${verifiedBanner}
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <div style="
              width: 36px;
              height: 36px;
              border-radius: 10px;
              background: ${isGovt ? "#ecfdf5" : "#eff6ff"};
              color: ${markerColor};
              display: flex;
              align-items: center;
              justify-content: center;
              flex-shrink: 0;
            ">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                ${
                    isGovt
                        ? '<path d="M3 21h18"/><path d="M9 8h1"/><path d="M14 8h1"/><path d="M9 12h1"/><path d="M14 12h1"/><path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"/>'
                        : '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>'
                }
              </svg>
            </div>
            <div style="flex:1;min-width:0;">
              <div style="font-weight:800;color:#1e293b;font-size:13px;line-height:1.3;">${escapeHtml(pharmacy.name)}</div>
              <span style="
                font-size:10px;
                font-weight:700;
                padding:2px 6px;
                border-radius:4px;
                ${statusColor};
                display:inline-block;
                margin-top:2px;
              ">${escapeHtml(pharmacy.status || "Status unknown")}</span>
            </div>
          </div>
          <p style="font-size:12px;color:#64748b;margin:0 0 8px 0;line-height:1.4;">
              ${escapeHtml(pharmacy.address || "No precise address listed in OSM")}
          </p>
          <div style="display:flex;align-items:center;gap:12px;font-size:12px;color:#94a3b8;margin-bottom:12px;">
            ${pharmacy.distance && pharmacy.distance !== "—" ? `<span style="font-weight:600;color:#64748b;">${escapeHtml(pharmacy.distance)} away</span>` : ""}
            ${
                pharmacy.rating > 0
                    ? `<span style="display:flex;align-items:center;gap:2px;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="#fbbf24" stroke="#fbbf24" stroke-width="0"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></polygon></svg>
              <span style="font-weight:700;color:#1f2937;">${pharmacy.rating}</span>
            </span>`
                    : `<span style="font-weight:500;font-size:11px;color:#cbd5e1;">Live from OSM</span>`
            }
          </div>
          
          <div style="display:flex; flex-direction:column; gap:6px;">
            <a href="${directionsUrl}" target="_blank" rel="noopener noreferrer" style="
              display:flex;
              align-items:center;
              justify-content:center;
              gap:6px;
              width:100%;
              padding:8px;
              background:#059669;
              color:white;
              border-radius:10px;
              text-decoration:none;
              font-size:12px;
              font-weight:700;
            ">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="white" stroke="currentColor" stroke-width="1"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
              Directions
            </a>
            ${
                pharmacy.phone
                    ? `<a href="tel:${escapeHtml(pharmacy.phone)}" style="
                display:flex;
                align-items:center;
                justify-content:center;
                gap:6px;
                width:100%;
                padding:8px;
                background:#1e293b;
                color:white;
                border-radius:10px;
                text-decoration:none;
                font-size:12px;
                font-weight:700;
              ">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                Call Store
              </a>`
                    : ""
            }
          </div>
        </div>
      `;

            marker.bindPopup(popupContent, {
                className: "sahidawa-popup",
                closeButton: true,
                maxWidth: 300,
            });

            // Bidirectional trigger: Select card panel row when a marker is clicked
            marker.on("click", () => {
                if (onSelectPharmacy) {
                    onSelectPharmacy(pharmacy.id);
                }
            });

            if (window.matchMedia("(pointer: fine)").matches) {
                marker.on("mouseover", () => {
                    marker.openPopup();
                    marker.getElement()?.classList.add("sahidawa-marker-hover");
                });
                marker.on("mouseout", () => {
                    // Slight delay to allow moving cursor into the popup if needed
                    setTimeout(() => {
                        if (!marker.isPopupOpen()) {
                            marker.getElement()?.classList.remove("sahidawa-marker-hover");
                        }
                    }, 100);
                });
            }
        });

        // Fit map to show all pharmacies (only if autoFitBounds is enabled)
        if (autoFitBounds && pharmacies.length > 0) {
            map.current.fitBounds(bounds, {
                padding: [50, 50],
                maxZoom: 15,
            });
        }
    }, [pharmacies, isMapReady, autoFitBounds, onSelectPharmacy]);

    // Handle selected pharmacy changes (Panels -> Map flight)
    useEffect(() => {
        if (!isMapReady || !map.current || selectedPharmacyId == null) return;

        const marker = markersRef.current.get(selectedPharmacyId);
        if (marker) {
            const pharmacy = pharmacies.find((p) => p.id === selectedPharmacyId);
            if (pharmacy) {
                map.current.flyTo([pharmacy.coordinates.lat, pharmacy.coordinates.lng], 15, {
                    duration: 0.8,
                });
                // Small delay to let flyTo start before opening popup safely
                setTimeout(() => {
                    marker.openPopup();
                }, 400);
            }
        }
    }, [selectedPharmacyId, isMapReady, pharmacies]);

    // Handle user location marker
    useEffect(() => {
        if (!isMapReady || !map.current || !userLocation) return;

        const L = (window as any).L;
        if (!L) return;

        // Remove old user marker
        if (userMarker.current) {
            map.current.removeLayer(userMarker.current);
        }

        // Create pulsing blue dot for user location
        const userIcon = L.divIcon({
            className: "user-location-marker",
            html: `
        <div style="position:relative;width:20px;height:20px;">
          <div style="
            position:absolute;
            inset:0;
            background:rgba(59,130,246,0.2);
            border-radius:50%;
            animation: sahidawa-pulse 2s ease-in-out infinite;
          "></div>
          <div style="
            position:absolute;
            top:4px;left:4px;
            width:12px;height:12px;
            background:var(--color-brand-secondary-bright);
            border-radius:50%;
            border:3px solid white;
            box-shadow:0 2px 8px rgba(59,130,246,0.5);
          "></div>
        </div>
      `,
            iconSize: [20, 20],
            iconAnchor: [10, 10],
        });

        userMarker.current = L.marker([userLocation.lat, userLocation.lng], {
            icon: userIcon,
            zIndexOffset: 1000,
        }).addTo(map.current);

        map.current.flyTo([userLocation.lat, userLocation.lng], 14, {
            duration: 1,
        });
    }, [userLocation, isMapReady]);

    // Error state
    if (mapError) {
        return (
            <div className="flex h-full min-h-[400px] w-full items-center justify-center rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted) dark:bg-[#0d1117]">
                <div className="space-y-3 p-6 text-center">
                    <AlertCircle className="mx-auto text-(--color-text-muted)" size={48} />
                    <p className="text-lg font-bold text-(--color-text-primary)">
                        Map could not be loaded
                    </p>
                    <p className="text-sm font-medium text-(--color-text-secondary)">
                        Please refresh the page or check your internet connection.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="relative h-full min-h-[400px] w-full overflow-hidden rounded-2xl bg-(--color-surface-muted) dark:bg-[#0d1117]">
            {/* Loading Skeleton */}
            {!isMapReady && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted) dark:bg-[#0d1117]">
                    <div className="space-y-3 text-center">
                        <Loader2 className="mx-auto animate-spin text-emerald-600" size={32} />
                        <p className="animate-pulse text-sm font-semibold text-(--color-text-secondary)">
                            Loading pharmacy map...
                        </p>
                    </div>
                </div>
            )}
            {/* Map Container */}
            <div ref={mapContainer} className="z-0 h-full min-h-[400px] w-full" />
        </div>
    );
}
