"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  MapPin,
  Search,
  Navigation,
  Filter,
  Star,
  Phone,
  Globe,
  Map as MapIcon,
  Layers,
  ChevronUp,
  ChevronDown,
  X,
  RefreshCw,
  Loader2,
  Clock,
} from "lucide-react";
import { Link } from "@/i18n/routing";
import { PageHeader } from "../components/PageHeader";
import PharmacyMap, { type Pharmacy, type MapBounds } from "./PharmacyMap";
import {
  fetchPharmacies,
  fetchPharmaciesInBounds,
  type OverpassPharmacy,
} from "./overpassApi";

// Default city for initial load (New Delhi)
const DEFAULT_CENTER = { lat: 28.6139, lng: 77.209 };
const DEFAULT_ZOOM = 13;

// Convert Overpass result to our Pharmacy interface
function toPharmacy(op: OverpassPharmacy & { _distanceFormatted?: string }): Pharmacy {
  return {
    id: op.id,
    name: op.name,
    distance: (op as any)._distanceFormatted || "—",
    rating: 0, // OSM doesn't have ratings
    status: op.type === "govt" ? "Govt. Verified" : "OSM Verified",
    type: op.type,
    coordinates: { lat: op.lat, lng: op.lng },
    address: op.address,
    phone: op.phone,
  };
}

export default function PharmacyMapPage() {
  const [activeFilter, setActiveFilter] = useState<"all" | "govt" | "named">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPharmacyId, setSelectedPharmacyId] = useState<number | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isListExpanded, setIsListExpanded] = useState(true);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Live data state
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showSearchArea, setShowSearchArea] = useState(false);
  const [pharmacyCount, setPharmacyCount] = useState(0);
  const [lastFetchCenter, setLastFetchCenter] = useState<{ lat: number; lng: number } | null>(null);

  // Track pending map bounds for "Search this area"
  const pendingBoundsRef = useRef<MapBounds | null>(null);
  const initialFetchDone = useRef(false);

  // Fetch pharmacies from Overpass API
  const fetchNearby = useCallback(
    async (lat: number, lng: number, radius: number = 10000) => {
      setIsLoading(true);
      setFetchError(null);
      setShowSearchArea(false);

      try {
        const results = await fetchPharmacies(lat, lng, radius);
        const mapped = results.map(toPharmacy);
        setPharmacies(mapped);
        setPharmacyCount(mapped.length);
        setLastFetchCenter({ lat, lng });
        initialFetchDone.current = true;
      } catch (err: any) {
        console.error("Failed to fetch pharmacies:", err);
        setFetchError("Could not load pharmacies. Try again.");
        setTimeout(() => setFetchError(null), 5000);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Fetch by bounding box (for "Search this area")
  const fetchInBounds = useCallback(async (bounds: MapBounds) => {
    setIsLoading(true);
    setFetchError(null);
    setShowSearchArea(false);

    try {
      const results = await fetchPharmaciesInBounds(
        bounds.south,
        bounds.west,
        bounds.north,
        bounds.east
      );
      const mapped = results.map(toPharmacy);
      setPharmacies(mapped);
      setPharmacyCount(mapped.length);
      setLastFetchCenter(bounds.center);
      initialFetchDone.current = true;
    } catch (err: any) {
      console.error("Failed to fetch pharmacies:", err);
      setFetchError("Could not load pharmacies. Try again.");
      setTimeout(() => setFetchError(null), 5000);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load: try geolocation, fallback to Delhi
  useEffect(() => {
    if (initialFetchDone.current) return;

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setUserLocation(loc);
          fetchNearby(loc.lat, loc.lng);
        },
        () => {
          // Permission denied or error — use Delhi
          fetchNearby(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng);
        },
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 }
      );
    } else {
      fetchNearby(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng);
    }
  }, [fetchNearby]);

  // When map moves, show "Search this area" button
  const handleMapMoveEnd = useCallback(
    (bounds: MapBounds) => {
      if (!initialFetchDone.current) return;
      if (!lastFetchCenter) return;

      // Check if user panned significantly (>2km from last fetch center)
      const dlat = bounds.center.lat - lastFetchCenter.lat;
      const dlng = bounds.center.lng - lastFetchCenter.lng;
      const dist = Math.sqrt(dlat * dlat + dlng * dlng) * 111; // rough km
      if (dist > 2) {
        pendingBoundsRef.current = bounds;
        setShowSearchArea(true);
      }
    },
    [lastFetchCenter]
  );

  // Handle "Search this area" click
  const handleSearchThisArea = useCallback(() => {
    if (pendingBoundsRef.current) {
      fetchInBounds(pendingBoundsRef.current);
    }
  }, [fetchInBounds]);

  // Handle map ready
  const handleMapReady = useCallback(
    (bounds: MapBounds) => {
      // If we already fetched via geolocation, don't double-fetch
    },
    []
  );

  // Filter pharmacies based on search + filter
  const filteredPharmacies = useMemo(() => {
    let result = pharmacies;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.address && p.address.toLowerCase().includes(q))
      );
    }

    if (activeFilter === "govt") {
      result = result.filter((p) => p.type === "govt");
    } else if (activeFilter === "named") {
      result = result.filter((p) => p.name !== "Pharmacy");
    }

    return result;
  }, [searchQuery, activeFilter, pharmacies]);

  // Handle geolocation
  const handleLocateUser = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser");
      setTimeout(() => setLocationError(null), 3000);
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const loc = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserLocation(loc);
        setIsLocating(false);
        // Fetch pharmacies around user's actual location
        fetchNearby(loc.lat, loc.lng);
      },
      (error) => {
        setIsLocating(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError(
              "Location access denied. Please enable it in your browser settings."
            );
            break;
          case error.POSITION_UNAVAILABLE:
            setLocationError("Location information unavailable.");
            break;
          case error.TIMEOUT:
            setLocationError("Location request timed out.");
            break;
          default:
            setLocationError("Unable to get your location.");
        }
        setTimeout(() => setLocationError(null), 4000);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, [fetchNearby]);

  return (
    <div className="h-screen bg-slate-50 font-sans flex flex-col overflow-hidden">
      {/* Header with Search */}
      <PageHeader backHref="/" variant="light">
        <div className="flex-1 bg-slate-100 rounded-2xl flex items-center px-4 py-2 border border-slate-200 focus-within:bg-white focus-within:border-emerald-500 transition-all">
          <Search size={18} className="text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Search verified pharmacies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none outline-none px-3 py-1.5 w-full text-sm font-medium text-slate-700"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="shrink-0 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </PageHeader>

      {/* Filter Chips */}
      <div className="bg-white p-4 pt-0 pb-4 shadow-sm z-20 border-b border-slate-100">
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => setActiveFilter("all")}
            className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold transition-all ${
              activeFilter === "all"
                ? "bg-slate-900 text-white shadow-md"
                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}
          >
            All Stores
          </button>
          <button
            onClick={() => setActiveFilter("govt")}
            className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeFilter === "govt"
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-200"
                : "bg-emerald-50 text-emerald-700 border border-emerald-100"
            }`}
          >
            <Globe size={12} />
            Jan Aushadhi
          </button>
          <button
            onClick={() => setActiveFilter("named")}
            className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeFilter === "named"
                ? "bg-amber-500 text-white shadow-md shadow-amber-200"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            <Star size={12} />
            Named Only
          </button>
          <button className="whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold bg-slate-100 text-slate-500 flex items-center gap-1.5 hover:bg-slate-200 transition-all">
            <Filter size={12} />
            Filters
          </button>
        </div>
        {/* Results count */}
        <div className="flex items-center gap-2 mt-2 px-1">
          <p className="text-[11px] font-medium text-slate-400">
            {isLoading ? (
              <span className="flex items-center gap-1.5">
                <Loader2 size={10} className="animate-spin" />
                Fetching pharmacies from OpenStreetMap...
              </span>
            ) : (
              <>
                {filteredPharmacies.length} pharmacies found
                {searchQuery && (
                  <>
                    {" "}
                    for &ldquo;{searchQuery}&rdquo;
                  </>
                )}
                {pharmacyCount > 0 && (
                  <span className="text-emerald-600"> • Live from OSM</span>
                )}
              </>
            )}
          </p>
        </div>
      </div>

      {/* Map View Area */}
      <div className="flex-1 relative overflow-hidden">
        {/* Real Leaflet Map */}
        <PharmacyMap
          pharmacies={filteredPharmacies}
          selectedPharmacyId={selectedPharmacyId}
          userLocation={userLocation}
          onMapMoveEnd={handleMapMoveEnd}
          onMapReady={handleMapReady}
          autoFitBounds={!isLoading && filteredPharmacies.length > 0}
          initialCenter={userLocation || DEFAULT_CENTER}
          initialZoom={DEFAULT_ZOOM}
        />

        {/* "Search this area" floating button */}
        {showSearchArea && !isLoading && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000]">
            <button
              onClick={handleSearchThisArea}
              className="flex items-center gap-2 px-5 py-2.5 bg-white text-slate-700 rounded-full shadow-xl border border-slate-200 text-xs font-bold hover:bg-slate-50 hover:shadow-2xl transition-all active:scale-95"
            >
              <RefreshCw size={14} className="text-emerald-600" />
              Search this area
            </button>
          </div>
        )}

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000]">
            <div className="flex items-center gap-2 px-5 py-2.5 bg-white text-slate-600 rounded-full shadow-xl border border-slate-200 text-xs font-bold">
              <Loader2 size={14} className="animate-spin text-emerald-600" />
              Fetching pharmacies...
            </div>
          </div>
        )}

        {/* Map Controls (top-right) */}
        <div className="absolute right-4 top-4 flex flex-col gap-2 z-[1000]">
          <button
            className="w-10 h-10 bg-white rounded-xl shadow-lg flex items-center justify-center text-slate-600 hover:text-slate-900 hover:shadow-xl transition-all border border-slate-100"
            title="Map layers"
          >
            <Layers size={20} />
          </button>
          <button
            onClick={handleLocateUser}
            disabled={isLocating}
            className={`w-10 h-10 rounded-xl shadow-lg flex items-center justify-center font-bold transition-all border border-slate-100 ${
              isLocating
                ? "bg-emerald-50 text-emerald-600 animate-pulse"
                : userLocation
                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                  : "bg-white text-emerald-600 hover:text-emerald-900 hover:shadow-xl"
            }`}
            title="Find my location"
          >
            <Navigation size={20} />
          </button>
        </div>

        {/* Error Toasts */}
        {(locationError || fetchError) && (
          <div className="absolute top-4 left-4 right-16 z-[1000] bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl shadow-lg text-xs font-semibold animate-in slide-in-from-top-2 duration-300">
            {locationError || fetchError}
          </div>
        )}

        {/* Bottom Pharmacy List Sheet */}
        <div
          className={`absolute bottom-0 left-0 right-0 z-[1000] transition-all duration-300 ${
            isListExpanded ? "max-h-[45%]" : "max-h-16"
          }`}
        >
          {/* Toggle Handle */}
          <button
            onClick={() => setIsListExpanded(!isListExpanded)}
            className="w-full flex items-center justify-center py-2 bg-white/95 backdrop-blur-md rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.08)] border-t border-slate-100"
          >
            <div className="flex items-center gap-2 text-slate-400">
              {isListExpanded ? (
                <>
                  <ChevronDown size={16} />
                  <span className="text-[11px] font-bold uppercase tracking-wider">
                    Collapse List
                  </span>
                  <ChevronDown size={16} />
                </>
              ) : (
                <>
                  <ChevronUp size={16} />
                  <span className="text-[11px] font-bold uppercase tracking-wider">
                    {filteredPharmacies.length} Pharmacies
                  </span>
                  <ChevronUp size={16} />
                </>
              )}
            </div>
          </button>

          {/* Scrollable List */}
          {isListExpanded && (
            <div className="bg-white/95 backdrop-blur-md p-4 pt-1 space-y-3 overflow-y-auto max-h-[calc(100%-40px)] no-scrollbar">
              {isLoading ? (
                <div className="text-center py-8">
                  <Loader2
                    size={28}
                    className="mx-auto text-emerald-600 animate-spin mb-3"
                  />
                  <p className="text-sm font-bold text-slate-400">
                    Finding nearby pharmacies...
                  </p>
                  <p className="text-xs text-slate-300 mt-1">
                    Powered by OpenStreetMap
                  </p>
                </div>
              ) : filteredPharmacies.length === 0 ? (
                <div className="text-center py-8">
                  <MapPin size={32} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-sm font-bold text-slate-400">
                    No pharmacies found
                  </p>
                  <p className="text-xs text-slate-300 mt-1">
                    Try panning the map and pressing &ldquo;Search this area&rdquo;
                  </p>
                </div>
              ) : (
                filteredPharmacies.map((pharmacy) => (
                  <div
                    key={pharmacy.id}
                    onClick={() => setSelectedPharmacyId(pharmacy.id)}
                    className={`rounded-3xl p-5 shadow-sm border flex items-center justify-between group hover:scale-[1.01] transition-all cursor-pointer ${
                      selectedPharmacyId === pharmacy.id
                        ? "bg-emerald-50 border-emerald-200 shadow-emerald-100 shadow-md"
                        : "bg-white border-slate-100 hover:shadow-md"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
                          pharmacy.type === "govt"
                            ? "bg-emerald-50 text-emerald-600"
                            : "bg-blue-50 text-blue-600"
                        }`}
                      >
                        <MapIcon size={24} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-slate-800 text-sm truncate max-w-[200px] sm:max-w-none">
                            {pharmacy.name}
                          </h4>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${
                              pharmacy.type === "govt"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {pharmacy.status}
                          </span>
                        </div>
                        {pharmacy.address && (
                          <p className="text-[11px] text-slate-400 mt-0.5 font-medium truncate max-w-[280px]">
                            {pharmacy.address}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          {pharmacy.distance !== "—" && (
                            <span className="text-xs text-slate-400 font-medium">
                              {pharmacy.distance} away
                            </span>
                          )}
                          {pharmacy.phone && (
                            <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                              <Phone size={10} />
                              {pharmacy.phone}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {pharmacy.phone && (
                      <a
                        href={`tel:${pharmacy.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center hover:bg-slate-800 shadow-md shrink-0 transition-colors"
                      >
                        <Phone size={18} />
                      </a>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Safe Area Footer */}
      <div className="h-4 bg-white md:hidden" aria-hidden="true"></div>
    </div>
  );
}