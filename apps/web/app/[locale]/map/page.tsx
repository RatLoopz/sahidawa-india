"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  Search,
  Navigation,
  Filter,
  Star,
  Phone,
  Globe,
  Layers,
  Clock,
  Shield,
  Heart,
  AlertCircle,
  X,
  MapPin,
  ChevronUp,
  ChevronDown,
  RefreshCw,
  Loader2,
  Store,
} from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import PharmacyMap, { type Pharmacy, type MapBounds } from "./PharmacyMap";
import {
  fetchPharmacies,
  fetchPharmaciesInBounds,
  type OverpassPharmacy,
} from "./overpassApi";

// ── Constants ────────────────────────────────────────────────────────────────
const DEFAULT_CENTER = { lat: 28.6139, lng: 77.209 }; // New Delhi
const DEFAULT_ZOOM = 13;

// ── Data adapter ─────────────────────────────────────────────────────────────
function toPharmacy(op: OverpassPharmacy & { _distanceFormatted?: string }): Pharmacy {
  return {
    id: op.id,
    name: op.name,
    distance: (op as any)._distanceFormatted || "—",
    rating: 0,
    status: op.type === "govt" ? "Govt. Verified" : "OSM Verified",
    type: op.type,
    coordinates: { lat: op.lat, lng: op.lng },
    address: op.address,
    phone: op.phone,
  };
}

// ── Draggable Bottom Drawer (PR #144 signature component) ────────────────────
function BottomDrawer({
  children,
  isOpen,
  onClose,
  onHeightChange,
  count,
  isLoading,
}: {
  children: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  onHeightChange?: (h: number) => void;
  count: number;
  isLoading: boolean;
}) {
  const [drawerHeight, setDrawerHeight] = useState(0.38);
  const drawerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const startHeight = useRef(0);

  const expandDrawer = () => {
    setDrawerHeight(0.7);
    onHeightChange?.(0.7);
  };

  const collapseDrawer = () => {
    setDrawerHeight(0.38);
    onHeightChange?.(0.38);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    startHeight.current = drawerHeight;
    if (drawerRef.current) drawerRef.current.style.transition = "none";
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const delta = (startY.current - e.touches[0].clientY) / window.innerHeight;
    const newHeight = Math.min(0.85, Math.max(0.18, startHeight.current + delta));
    setDrawerHeight(newHeight);
    if (drawerRef.current) {
      drawerRef.current.style.transform = `translateY(${(1 - newHeight) * 100}%)`;
    }
    onHeightChange?.(newHeight);
  };

  const handleTouchEnd = () => {
    const snapPoint = drawerHeight > 0.55 ? 0.7 : 0.38;
    setDrawerHeight(snapPoint);
    if (drawerRef.current) {
      drawerRef.current.style.transform = `translateY(${(1 - snapPoint) * 100}%)`;
      drawerRef.current.style.transition = "transform 0.3s cubic-bezier(0.32,0.72,0,1)";
      setTimeout(() => {
        if (drawerRef.current) drawerRef.current.style.transition = "";
      }, 300);
    }
    onHeightChange?.(snapPoint);
  };

  useEffect(() => {
    if (isOpen && drawerRef.current) {
      drawerRef.current.style.transform = `translateY(${(1 - drawerHeight) * 100}%)`;
    }
  }, [isOpen, drawerHeight]);

  if (!isOpen) return null;

  return (
    <>
      {/* Dim overlay */}
      <div
        className="absolute inset-0 bg-black/20 transition-opacity duration-300 z-[900]"
        style={{ opacity: drawerHeight > 0.55 ? 0.4 : 0.1 }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className="absolute bottom-0 left-0 right-0 z-[1000] pointer-events-auto"
        style={{ height: "80vh" }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="max-w-lg mx-auto h-full flex flex-col">
          <div className="bg-white/96 backdrop-blur-xl rounded-t-3xl shadow-2xl flex flex-col h-full overflow-hidden border-t border-white/20">
            {/* Handle + Header */}
            <div className="flex-shrink-0 pt-3 pb-2">
              <div className="flex justify-center">
                <div className="w-10 h-1.5 bg-slate-300 rounded-full cursor-grab active:cursor-grabbing" />
              </div>
              <div className="flex items-center justify-between px-5 mt-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-emerald-100 rounded-full flex items-center justify-center">
                    <Store size={13} className="text-emerald-600" />
                  </div>
                  <h3 className="font-semibold text-slate-800 text-sm">
                    Nearby Pharmacies
                    <span className="text-xs font-normal text-slate-400 ml-1.5">
                      {isLoading ? "…" : `(${count})`}
                    </span>
                  </h3>
                </div>
                <div className="flex items-center gap-1">
                  {drawerHeight < 0.55 ? (
                    <button
                      onClick={expandDrawer}
                      className="p-1.5 rounded-full hover:bg-slate-100 transition-colors"
                    >
                      <ChevronUp size={15} className="text-slate-500" />
                    </button>
                  ) : (
                    <button
                      onClick={collapseDrawer}
                      className="p-1.5 rounded-full hover:bg-slate-100 transition-colors"
                    >
                      <ChevronDown size={15} className="text-slate-500" />
                    </button>
                  )}
                  <button
                    onClick={onClose}
                    className="p-1.5 rounded-full hover:bg-slate-100 transition-colors"
                  >
                    <X size={13} className="text-slate-500" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-2">
              {children}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Compact Pharmacy Card (PR #144 design) ───────────────────────────────────
function PharmacyCard({
  pharmacy,
  isSelected,
  onClick,
}: {
  pharmacy: Pharmacy;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`rounded-xl p-3 cursor-pointer transition-all duration-200 border ${
        isSelected
          ? "border-emerald-300 bg-emerald-50/60 shadow-md shadow-emerald-100/30"
          : "border-slate-100 bg-white hover:border-slate-200 hover:shadow-sm"
      }`}
    >
      <div className="flex items-start gap-2.5">
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-sm ${
            pharmacy.type === "govt" ? "bg-emerald-100" : "bg-blue-50"
          }`}
        >
          {pharmacy.type === "govt" ? "🏥" : "💊"}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-slate-800 truncate">{pharmacy.name}</h4>
            {pharmacy.rating > 0 && (
              <div className="flex items-center gap-0.5 shrink-0">
                <Star size={10} className="text-amber-400 fill-amber-400" />
                <span className="text-[11px] font-bold text-slate-700">{pharmacy.rating}</span>
              </div>
            )}
          </div>

          {pharmacy.address && (
            <div className="flex items-center gap-1 mt-0.5">
              <MapPin size={8} className="text-slate-300 shrink-0" />
              <p className="text-[10px] text-slate-400 truncate">{pharmacy.address}</p>
            </div>
          )}
        </div>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-2 mt-2 ml-11 flex-wrap">
        <span
          className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
            pharmacy.distance !== "—"
              ? "bg-slate-50 text-slate-600"
              : "bg-slate-50 text-slate-400"
          }`}
        >
          {pharmacy.distance !== "—" ? `${pharmacy.distance} away` : "Distance —"}
        </span>
      </div>

      {/* Badge row */}
      <div className="flex flex-wrap gap-1 mt-1.5 ml-11">
        <span className="inline-flex items-center gap-0.5 text-[9px] font-medium bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">
          <Shield size={6} />
          {pharmacy.status}
        </span>
        <span
          className={`inline-flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
            pharmacy.type === "govt"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-blue-50 text-blue-700"
          }`}
        >
          <Heart size={6} />
          {pharmacy.type === "govt" ? "Jan Aushadhi" : "Private"}
        </span>
      </div>

      {/* Call button */}
      {pharmacy.phone && (
        <div className="mt-2 ml-11">
          <a
            href={`tel:${pharmacy.phone}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 active:bg-slate-200 px-2.5 py-1 rounded-lg transition-colors"
          >
            <Phone size={9} className="text-emerald-600" />
            Call
          </a>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PharmacyMapPage() {
  const [activeFilter, setActiveFilter] = useState<"all" | "govt" | "named">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPharmacyId, setSelectedPharmacyId] = useState<number | null>(null);
  const [showBottomSheet, setShowBottomSheet] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Live data state (PR #147 engine)
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showSearchArea, setShowSearchArea] = useState(false);
  const [pharmacyCount, setPharmacyCount] = useState(0);

  const pendingBoundsRef = useRef<MapBounds | null>(null);
  const initialFetchDone = useRef(false);

  // Fetch from Overpass API
  const fetchNearby = useCallback(async (lat: number, lng: number, radius = 10000) => {
    setIsLoading(true);
    setFetchError(null);
    setShowSearchArea(false);
    try {
      const results = await fetchPharmacies(lat, lng, radius);
      const mapped = results.map(toPharmacy);
      setPharmacies(mapped);
      setPharmacyCount(mapped.length);
      initialFetchDone.current = true;
    } catch {
      setFetchError("Could not load pharmacies. Try again.");
      setTimeout(() => setFetchError(null), 5000);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchInBounds = useCallback(async (bounds: MapBounds) => {
    setIsLoading(true);
    setFetchError(null);
    setShowSearchArea(false);
    try {
      const results = await fetchPharmaciesInBounds(bounds);
      const mapped = results.map(toPharmacy);
      setPharmacies(mapped);
      setPharmacyCount(mapped.length);
    } catch {
      setFetchError("Could not load pharmacies. Try again.");
      setTimeout(() => setFetchError(null), 5000);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleMapReady = useCallback(
    (bounds: MapBounds) => {
      if (!initialFetchDone.current && !userLocation) {
        fetchNearby(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng);
      }
    },
    [fetchNearby, userLocation]
  );

  const handleMapMoveEnd = useCallback((bounds: MapBounds) => {
    if (initialFetchDone.current) {
      pendingBoundsRef.current = bounds;
      setShowSearchArea(true);
    }
  }, []);

  const handleSearchThisArea = useCallback(() => {
    if (pendingBoundsRef.current) fetchInBounds(pendingBoundsRef.current);
  }, [fetchInBounds]);

  // Filtered list
  const filteredPharmacies = useMemo(() => {
    let list = pharmacies;
    if (activeFilter === "govt") list = list.filter((p) => p.type === "govt");
    else if (activeFilter === "named") list = list.filter((p) => p.name && p.name !== "Pharmacy");
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.address || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [pharmacies, activeFilter, searchQuery]);

  // Geolocation
  const handleLocateUser = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser");
      setTimeout(() => setLocationError(null), 3000);
      return;
    }
    setIsLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);
        setIsLocating(false);
        fetchNearby(loc.lat, loc.lng);
      },
      (err) => {
        setIsLocating(false);
        const messages: Record<number, string> = {
          1: "Location access denied. Please enable it in browser settings.",
          2: "Location information unavailable.",
          3: "Location request timed out.",
        };
        setLocationError(messages[err.code] || "Unable to get your location.");
        setTimeout(() => setLocationError(null), 4000);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, [fetchNearby]);

  const filters = [
    { id: "all", label: "All Stores", activeClass: "bg-slate-900 text-white shadow-md" },
    { id: "govt", label: "Jan Aushadhi", icon: <Globe size={11} />, activeClass: "bg-emerald-600 text-white shadow-md shadow-emerald-200" },
    { id: "named", label: "Named Only", icon: <Star size={11} className="fill-current" />, activeClass: "bg-amber-500 text-white shadow-md shadow-amber-200" },
    { id: "more", label: "Filters", icon: <Filter size={11} />, activeClass: "bg-slate-100 text-slate-500" },
  ] as const;

  return (
    <div className="h-screen bg-slate-50 font-sans flex flex-col overflow-hidden">
      <h1 className="sr-only">Pharmacy Map — Find Verified Pharmacies Near You</h1>

      {/* ── Header with search ── */}
      <PageHeader backHref="/" variant="light">
        <div
          className="flex-1 bg-slate-100 rounded-2xl flex items-center px-4 py-2 border border-slate-200 focus-within:bg-white focus-within:border-emerald-500 transition-all"
          role="search"
        >
          <Search size={17} className="text-slate-400 shrink-0" aria-hidden />
          <input
            type="text"
            placeholder="Search verified pharmacies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none outline-none px-3 py-1.5 w-full text-sm font-medium text-slate-700 placeholder:text-slate-400"
            aria-label="Search verified pharmacies"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="text-slate-400 hover:text-slate-600 transition-colors shrink-0"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </PageHeader>

      {/* ── Filter chips ── */}
      <div className="bg-white p-4 pt-0 pb-4 shadow-sm z-20 border-b border-slate-100">
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar" role="group" aria-label="Filter pharmacies">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => f.id !== "more" && setActiveFilter(f.id as any)}
              aria-pressed={activeFilter === f.id}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeFilter === f.id
                  ? f.activeClass
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}
            >
              {("icon" in f) && f.icon}
              {f.label}
            </button>
          ))}
        </div>

        {/* Results count bar */}
        <div className="flex items-center gap-2 mt-2 px-1">
          <p className="text-[11px] font-medium text-slate-400">
            {isLoading ? (
              <span className="flex items-center gap-1.5">
                <Loader2 size={10} className="animate-spin" />
                Fetching pharmacies from OpenStreetMap…
              </span>
            ) : (
              <>
                {filteredPharmacies.length} pharmacies found
                {searchQuery && <> for &ldquo;{searchQuery}&rdquo;</>}
                {pharmacyCount > 0 && (
                  <span className="text-emerald-600"> • Live from OSM</span>
                )}
              </>
            )}
          </p>
        </div>
      </div>

      {/* ── Map + overlays ── */}
      <div className="flex-1 relative overflow-hidden">
        {/* Real Leaflet Map (PR #147) */}
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

        {/* "Search this area" pill */}
        {showSearchArea && !isLoading && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000]">
            <button
              onClick={handleSearchThisArea}
              className="flex items-center gap-2 px-5 py-2.5 bg-white text-slate-700 rounded-full shadow-xl border border-slate-200 text-xs font-bold hover:bg-slate-50 hover:shadow-2xl transition-all active:scale-95"
            >
              <RefreshCw size={13} className="text-emerald-600" />
              Search this area
            </button>
          </div>
        )}

        {/* Loading pill */}
        {isLoading && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000]">
            <div className="flex items-center gap-2 px-5 py-2.5 bg-white text-slate-600 rounded-full shadow-xl border border-slate-200 text-xs font-bold">
              <Loader2 size={13} className="animate-spin text-emerald-600" />
              Fetching pharmacies…
            </div>
          </div>
        )}

        {/* Map Controls */}
        <div className="absolute right-4 top-4 flex flex-col gap-2 z-[1000]">
          <button
            className="w-10 h-10 bg-white rounded-xl shadow-lg flex items-center justify-center text-slate-600 hover:text-slate-900 hover:shadow-xl transition-all border border-slate-100"
            title="Toggle pharmacy list"
            onClick={() => setShowBottomSheet((b) => !b)}
          >
            <Layers size={20} />
          </button>
          <button
            onClick={handleLocateUser}
            disabled={isLocating}
            className={`w-10 h-10 rounded-xl shadow-lg flex items-center justify-center transition-all border border-slate-100 ${
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

        {/* Error toast */}
        {(locationError || fetchError) && (
          <div className="absolute top-4 left-4 right-16 z-[1000] bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl shadow-lg text-xs font-semibold animate-in slide-in-from-top-2 duration-300">
            {locationError || fetchError}
          </div>
        )}

        {/* ── PR #144 Draggable Bottom Sheet ── */}
        <BottomDrawer
          isOpen={showBottomSheet}
          onClose={() => setShowBottomSheet(false)}
          count={filteredPharmacies.length}
          isLoading={isLoading}
        >
          {isLoading ? (
            <div className="text-center py-10">
              <Loader2 size={26} className="mx-auto text-emerald-600 animate-spin mb-3" />
              <p className="text-sm font-bold text-slate-400">Finding nearby pharmacies…</p>
              <p className="text-xs text-slate-300 mt-1">Powered by OpenStreetMap</p>
            </div>
          ) : filteredPharmacies.length === 0 ? (
            <div className="text-center py-10">
              <MapPin size={30} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-bold text-slate-400">No pharmacies found</p>
              <p className="text-xs text-slate-300 mt-1">
                Try panning the map and pressing &ldquo;Search this area&rdquo;
              </p>
            </div>
          ) : (
            filteredPharmacies.map((pharmacy) => (
              <PharmacyCard
                key={pharmacy.id}
                pharmacy={pharmacy}
                isSelected={selectedPharmacyId === pharmacy.id}
                onClick={() => {
                  setSelectedPharmacyId(pharmacy.id);
                  setShowBottomSheet(true);
                }}
              />
            ))
          )}
        </BottomDrawer>

        {/* Floating toggle when sheet is closed */}
        {!showBottomSheet && (
          <button
            onClick={() => setShowBottomSheet(true)}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-full shadow-xl text-xs font-bold hover:bg-slate-800 transition-all active:scale-95"
          >
            <ChevronUp size={14} />
            {filteredPharmacies.length} Pharmacies
          </button>
        )}
      </div>

      {/* Safe-area footer */}
      <div className="h-4 bg-white md:hidden" aria-hidden="true" />
    </div>
  );
}