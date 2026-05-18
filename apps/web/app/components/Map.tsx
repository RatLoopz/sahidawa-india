"use client";

import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L, { Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix marker icons - do this once globally
if (typeof window !== 'undefined') {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  });
}

const createCustomIcon = (type: string, isSelected: boolean = false) => {
  const color = type === 'govt' ? '#059669' : '#2563eb';
  const size = isSelected ? 32 : 26;
  const ring = isSelected ? `box-shadow: 0 0 0 4px ${color}33, 0 3px 12px rgba(0,0,0,0.25);` : 'box-shadow: 0 2px 8px rgba(0,0,0,0.2);';
  return L.divIcon({
    className: 'custom-marker',
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
      font-size: ${isSelected ? 14 : 11}px;
    ">🏥</div></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size - 4]
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

export default function Map({ pharmacies, selectedPharmacy, selectedPharmacyId, onMarkerClick }: { 
  pharmacies: Pharmacy[]; 
  selectedPharmacy: [number, number] | null;
  selectedPharmacyId: number | null;
  onMarkerClick: (id: number) => void;
}) {
  const [isClient, setIsClient] = useState(false);
  const mapRef = useRef<LeafletMap | null>(null);
  const containerId = useRef(`map-${Date.now()}-${Math.random()}`);

  useEffect(() => {
    setIsClient(true);
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  if (!isClient) {
    return (
      <div className="w-full h-full bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-xs text-slate-500">Initializing map...</p>
        </div>
      </div>
    );
  }

  return (
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
          <Popup className="pharmacy-popup" maxWidth={240}>
            <div style={{ minWidth: 210, padding: '4px 2px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: pharmacy.type === 'govt' ? '#d1fae5' : '#dbeafe',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, flexShrink: 0
                }}>🏥</div>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 12, color: '#1e293b', lineHeight: 1.3, margin: 0 }}>{pharmacy.name}</p>
                  <p style={{ fontSize: 10, color: '#64748b', margin: '2px 0 0' }}>{pharmacy.address}</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                <span style={{ fontSize: 10, background: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: 99, fontWeight: 600 }}>
                  ★ {pharmacy.rating}
                </span>
                <span style={{ 
                  fontSize: 10, 
                  background: pharmacy.isOpen ? '#dcfce7' : '#fee2e2', 
                  color: pharmacy.isOpen ? '#166534' : '#991b1b', 
                  padding: '2px 6px', borderRadius: 99, fontWeight: 600 
                }}>
                  {pharmacy.isOpen ? '● Open' : '● Closed'}
                </span>
                {pharmacy.emergencyAvailable && (
                  <span style={{ fontSize: 10, background: '#fef3c7', color: '#b45309', padding: '2px 6px', borderRadius: 99, fontWeight: 600 }}>
                    24/7
                  </span>
                )}
              </div>
              <button 
                onClick={() => window.open(`https://maps.google.com?q=${pharmacy.coordinates[0]},${pharmacy.coordinates[1]}`, '_blank')}
                style={{
                  width: '100%', background: '#0f172a', color: 'white',
                  fontSize: 11, fontWeight: 600, padding: '7px 12px',
                  borderRadius: 8, border: 'none', cursor: 'pointer'
                }}
              >
                Get Directions →
              </button>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}