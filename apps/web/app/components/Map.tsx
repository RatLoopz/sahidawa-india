
"use client";

import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

interface Pharmacy {
  id: number;
  name: string;
  coordinates: [number, number];
  address: string;
  rating: number;
  type: string;
  isOpen: boolean;
  emergencyAvailable: boolean;
}

function MapController({
  center,
}: {
  center: [number, number] | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (center) {
      map.flyTo(center, 15, {
        duration: 1.2,
      });
    }
  }, [center, map]);

  return null;
}

const createCustomIcon = (
  type: string,
  isSelected: boolean = false
) => {
  const color = type === "govt" ? "#059669" : "#2563eb";

  return L.divIcon({
    className: "custom-marker",
    html: `
      <div
        style="
          background:${color};
          width:${isSelected ? 32 : 26}px;
          height:${isSelected ? 32 : 26}px;
          border-radius:50%;
          border:3px solid white;
          display:flex;
          align-items:center;
          justify-content:center;
          box-shadow:0 4px 10px rgba(0,0,0,0.25);
          font-size:14px;
        "
      >
        🏥
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

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



  return (
    <MapContainer
      center={[20.5937, 78.9629]}
      zoom={5}
      style={{ height: "100%", width: "100%" }}
      zoomControl={false}
      scrollWheelZoom
      className="z-0"
    >
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <MapController center={selectedPharmacy} />

      {pharmacies.map((pharmacy) => (
        <Marker
          key={pharmacy.id}
          position={pharmacy.coordinates}
          icon={createCustomIcon(
            pharmacy.type,
            selectedPharmacyId === pharmacy.id
          )}
          eventHandlers={{
            click: () => onMarkerClick(pharmacy.id),
          }}
        >
          <Popup>
            <div className="space-y-1">
              <h3 className="font-semibold text-sm">
                {pharmacy.name}
              </h3>

              <p className="text-xs text-slate-500">
                {pharmacy.address}
              </p>

              <p className="text-xs">
                ⭐ {pharmacy.rating}
              </p>

              <p
                className={`text-xs font-medium ${
                  pharmacy.isOpen
                    ? "text-green-600"
                    : "text-red-500"
                }`}
              >
                {pharmacy.isOpen ? "Open" : "Closed"}
              </p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

