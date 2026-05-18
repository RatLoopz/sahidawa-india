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
import PharmacyMap, {
    type HeatmapMode,
    type Pharmacy,
    type MapBounds,
    type RiskHotspot,
} from "./PharmacyMap";
import { fetchPharmacies, fetchPharmaciesInBounds, type OverpassPharmacy } from "./overpassApi";

// ── Constants ────────────────────────────────────────────────────────────────
const DEFAULT_CENTER = { lat: 28.6139, lng: 77.209 }; // New Delhi
const DEFAULT_ZOOM = 13;

const COUNTERFEIT_REPORT_HOTSPOTS: RiskHotspot[] = [
    {
        id: "counterfeit-delhi",
        label: "Delhi NCR report cluster",
        coordinates: { lat: 28.6139, lng: 77.209 },
        intensity: 0.92,
        category: "counterfeit",
        details: "Higher citizen reports around high-volume pharmacy corridors.",
    },
    {
        id: "counterfeit-mumbai",
        label: "Mumbai metro report cluster",
        coordinates: { lat: 19.076, lng: 72.8777 },
        intensity: 0.78,
        category: "counterfeit",
        details: "Clustered reports near dense retail medicine markets.",
    },
    {
        id: "counterfeit-kolkata",
        label: "Kolkata report cluster",
        coordinates: { lat: 22.5726, lng: 88.3639 },
        intensity: 0.64,
        category: "counterfeit",
        details: "Moderate counterfeit-report signal from public submissions.",
    },
    {
        id: "counterfeit-hyderabad",
        label: "Hyderabad report cluster",
        coordinates: { lat: 17.385, lng: 78.4867 },
        intensity: 0.58,
        category: "counterfeit",
        details: "Emerging report cluster for suspicious medicine listings.",
    },
];

function buildDensityHotspots(pharmacies: Pharmacy[]): RiskHotspot[] {
    const buckets = new Map<string, { count: number; lat: number; lng: number; named: number }>();

    pharmacies.forEach((pharmacy) => {
        const latBucket = Math.round(pharmacy.coordinates.lat * 20) / 20;
        const lngBucket = Math.round(pharmacy.coordinates.lng * 20) / 20;
        const key = `${latBucket}:${lngBucket}`;
        const current = buckets.get(key) || { count: 0, lat: 0, lng: 0, named: 0 };

        buckets.set(key, {
            count: current.count + 1,
            lat: current.lat + pharmacy.coordinates.lat,
            lng: current.lng + pharmacy.coordinates.lng,
            named: current.named + (pharmacy.name && pharmacy.name !== "Pharmacy" ? 1 : 0),
        });
    });

    const maxCount = Math.max(1, ...Array.from(buckets.values()).map((bucket) => bucket.count));

    return Array.from(buckets.entries())
        .filter(([, bucket]) => bucket.count >= 2)
        .map(([key, bucket]) => ({
            id: `density-${key}`,
            label: `${bucket.count} pharmacies nearby`,
            coordinates: {
                lat: bucket.lat / bucket.count,
                lng: bucket.lng / bucket.count,
            },
            intensity: bucket.count / maxCount,
            category: "density" as const,
            details: `${bucket.named} named stores in this local density cluster.`,
        }));
}

// ── Data adapter ─────────────────────────────────────────────────────────────
function toPharmacy(op: OverpassPharmacy & { _distanceFormatted?: string }): Pharmacy {
    return {
        id: op.id,
        name: op.name,
        distance: (op as any)._distanceFormatted || "—",
        distanceKm: (op as any)._distance,
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
    count,
    isLoading,
}: {
    children: React.ReactNode;
    isOpen: boolean;
    onClose: () => void;
    count: number;
    isLoading: boolean;
}) {
    const [isExpanded, setIsExpanded] = useState(true);

    const expandDrawer = () => {
        setIsExpanded(true);
    };

    const collapseDrawer = () => {
        setIsExpanded(false);
    };

    if (!isOpen) return null;

    if (!isExpanded) {
        return (
            <button
                onClick={expandDrawer}
                className="pointer-events-auto absolute right-4 bottom-5 z-1000 flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-xl transition-all hover:bg-slate-800 active:scale-95"
                aria-label={`Show nearby pharmacies list with ${count} results`}
            >
                <ChevronUp size={14} />
                {isLoading ? "Finding pharmacies..." : `${count} Pharmacies`}
            </button>
        );
    }

    return (
        <div className="pointer-events-none absolute right-4 bottom-4 left-4 z-1000 md:left-auto md:max-w-sm">
            <div className="pointer-events-auto max-h-[60vh] rounded-2xl border border-white/70 bg-white/96 shadow-2xl backdrop-blur-xl">
                <div className="flex max-h-[60vh] flex-col overflow-hidden">
                    {/* Handle + Header */}
                    <div className="shrink-0 pt-3 pb-2">
                        <div className="flex justify-center">
                            <div className="h-1.5 w-10 rounded-full bg-slate-300" />
                        </div>
                        <div className="mt-2 flex items-center justify-between px-5">
                            <div className="flex items-center gap-2">
                                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100">
                                    <Store size={13} className="text-emerald-600" />
                                </div>
                                <h3 className="text-sm font-semibold text-slate-800">
                                    Nearby Pharmacies
                                    <span className="ml-1.5 text-xs font-normal text-slate-400">
                                        {isLoading ? "…" : `(${count})`}
                                    </span>
                                </h3>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={collapseDrawer}
                                    className="rounded-full p-1.5 transition-colors hover:bg-slate-100"
                                    aria-label="Collapse nearby pharmacies list"
                                >
                                    <ChevronDown size={15} className="text-slate-500" />
                                </button>
                                <button
                                    onClick={onClose}
                                    className="rounded-full p-1.5 transition-colors hover:bg-slate-100"
                                    aria-label="Hide nearby pharmacies list"
                                >
                                    <X size={13} className="text-slate-500" />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 space-y-2 overflow-y-auto px-4 pb-4">{children}</div>
                </div>
            </div>
        </div>
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
            className={`cursor-pointer rounded-xl border p-3 transition-all duration-200 ${
                isSelected
                    ? "border-emerald-300 bg-emerald-50/60 shadow-md shadow-emerald-100/30"
                    : "border-slate-100 bg-white hover:border-slate-200 hover:shadow-sm"
            }`}
        >
            <div className="flex items-start gap-2.5">
                <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm ${
                        pharmacy.type === "govt" ? "bg-emerald-100" : "bg-blue-50"
                    }`}
                >
                    {pharmacy.type === "govt" ? "🏥" : "💊"}
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                        <h4 className="truncate text-sm font-semibold text-slate-800">
                            {pharmacy.name}
                        </h4>
                        {pharmacy.rating > 0 && (
                            <div className="flex shrink-0 items-center gap-0.5">
                                <Star size={10} className="fill-amber-400 text-amber-400" />
                                <span className="text-[11px] font-bold text-slate-700">
                                    {pharmacy.rating}
                                </span>
                            </div>
                        )}
                    </div>

                    {pharmacy.address && (
                        <div className="mt-0.5 flex items-center gap-1">
                            <MapPin size={8} className="shrink-0 text-slate-300" />
                            <p className="truncate text-[10px] text-slate-400">
                                {pharmacy.address}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Meta row */}
            <div className="mt-2 ml-11 flex flex-wrap items-center gap-2">
                <span
                    className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                        pharmacy.distance !== "—"
                            ? "bg-slate-50 text-slate-600"
                            : "bg-slate-50 text-slate-400"
                    }`}
                >
                    {pharmacy.distance !== "—" ? `${pharmacy.distance} away` : "Distance —"}
                </span>
            </div>

            {/* Badge row */}
            <div className="mt-1.5 ml-11 flex flex-wrap gap-1">
                <span className="inline-flex items-center gap-0.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-600">
                    <Shield size={6} />
                    {pharmacy.status}
                </span>
                <span
                    className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
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
                        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-200 active:bg-slate-200"
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
type AdvancedFilters = {
    hasAddress: boolean;
    hasPhone: boolean;
    withinFiveKm: boolean;
};

export default function PharmacyMapPage() {
    const [activeFilter, setActiveFilter] = useState<"all" | "govt" | "named">("all");
    const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({
        hasAddress: false,
        hasPhone: false,
        withinFiveKm: false,
    });
    const [showFilterPanel, setShowFilterPanel] = useState(false);
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
    const [heatmapMode, setHeatmapMode] = useState<HeatmapMode>("none");

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
            const results = await fetchPharmaciesInBounds(
                bounds.south,
                bounds.west,
                bounds.north,
                bounds.east
            );
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
        else if (activeFilter === "named")
            list = list.filter((p) => p.name && p.name !== "Pharmacy");
        if (advancedFilters.hasAddress) list = list.filter((p) => Boolean(p.address));
        if (advancedFilters.hasPhone) list = list.filter((p) => Boolean(p.phone));
        if (advancedFilters.withinFiveKm) {
            list = list.filter((p) => typeof p.distanceKm === "number" && p.distanceKm <= 5);
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter(
                (p) =>
                    p.name.toLowerCase().includes(q) || (p.address || "").toLowerCase().includes(q)
            );
        }
        return list;
    }, [pharmacies, activeFilter, advancedFilters, searchQuery]);

    const activeAdvancedFilterCount = Object.values(advancedFilters).filter(Boolean).length;
    const densityHotspots = useMemo(
        () => buildDensityHotspots(filteredPharmacies),
        [filteredPharmacies]
    );
    const riskHotspots = useMemo(
        () => [...densityHotspots, ...COUNTERFEIT_REPORT_HOTSPOTS],
        [densityHotspots]
    );

    const updateAdvancedFilter = (key: keyof AdvancedFilters) => {
        setAdvancedFilters((current) => ({ ...current, [key]: !current[key] }));
    };

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
        {
            id: "govt",
            label: "Jan Aushadhi",
            icon: <Globe size={11} />,
            activeClass: "bg-emerald-600 text-white shadow-md shadow-emerald-200",
        },
        {
            id: "named",
            label: "Named Only",
            icon: <Star size={11} className="fill-current" />,
            activeClass: "bg-amber-500 text-white shadow-md shadow-amber-200",
        },
        {
            id: "more",
            label: "Filters",
            icon: <Filter size={11} />,
            activeClass: "bg-slate-100 text-slate-500",
        },
    ] as const;

    const heatmapOptions: Array<{
        id: HeatmapMode;
        label: string;
        description: string;
    }> = [
        { id: "none", label: "Markers", description: "Show pharmacy markers only" },
        { id: "density", label: "Density", description: "Highlight pharmacy-dense areas" },
        { id: "counterfeit", label: "Counterfeit", description: "Show report-risk clusters" },
        { id: "combined", label: "Combined", description: "Show density and report risk together" },
    ];

    return (
        <div className="flex h-screen flex-col overflow-hidden bg-slate-50 font-sans">
            <h1 className="sr-only">Pharmacy Map — Find Verified Pharmacies Near You</h1>

            {/* ── Header with search ── */}
            <PageHeader backHref="/" variant="light">
                <div
                    className="flex flex-1 items-center rounded-2xl border border-slate-200 bg-slate-100 px-4 py-2 transition-all focus-within:border-emerald-500 focus-within:bg-white"
                    role="search"
                >
                    <Search size={17} className="shrink-0 text-slate-400" aria-hidden />
                    <input
                        type="text"
                        placeholder="Search verified pharmacies..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full border-none bg-transparent px-3 py-1.5 text-sm font-medium text-slate-700 outline-none placeholder:text-slate-400"
                        aria-label="Search verified pharmacies"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery("")}
                            className="shrink-0 text-slate-400 transition-colors hover:text-slate-600"
                        >
                            <X size={15} />
                        </button>
                    )}
                </div>
            </PageHeader>

            {/* ── Filter chips ── */}
            <div className="relative z-20 border-b border-slate-100 bg-white p-4 pt-0 pb-4 shadow-sm">
                <div
                    className="no-scrollbar flex gap-2 overflow-x-auto pb-1"
                    role="group"
                    aria-label="Filter pharmacies"
                >
                    {filters.map((f) => (
                        <button
                            key={f.id}
                            onClick={() => {
                                if (f.id === "more") setShowFilterPanel((open) => !open);
                                else setActiveFilter(f.id as any);
                            }}
                            aria-pressed={
                                f.id === "more"
                                    ? showFilterPanel || activeAdvancedFilterCount > 0
                                    : activeFilter === f.id
                            }
                            aria-expanded={f.id === "more" ? showFilterPanel : undefined}
                            className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold whitespace-nowrap transition-all ${
                                (
                                    f.id === "more"
                                        ? activeAdvancedFilterCount > 0
                                        : activeFilter === f.id
                                )
                                    ? f.activeClass
                                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                            }`}
                        >
                            {"icon" in f && f.icon}
                            {f.label}
                            {f.id === "more" && activeAdvancedFilterCount > 0 && (
                                <span className="ml-0.5 rounded-full bg-slate-900 px-1.5 py-0.5 text-[9px] text-white">
                                    {activeAdvancedFilterCount}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {showFilterPanel && (
                    <div className="absolute top-[calc(100%-0.5rem)] right-4 left-4 z-30 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl md:right-auto md:w-80">
                        <div className="mb-2 flex items-center justify-between">
                            <p className="text-xs font-bold text-slate-700">Filters</p>
                            <button
                                onClick={() =>
                                    setAdvancedFilters({
                                        hasAddress: false,
                                        hasPhone: false,
                                        withinFiveKm: false,
                                    })
                                }
                                className="text-[11px] font-semibold text-slate-400 transition-colors hover:text-slate-600"
                            >
                                Clear
                            </button>
                        </div>
                        <div className="space-y-2">
                            {[
                                ["hasAddress", "Has address details"],
                                ["hasPhone", "Has phone number"],
                                ["withinFiveKm", "Within 5 km"],
                            ].map(([key, label]) => (
                                <label
                                    key={key}
                                    className="flex cursor-pointer items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                                >
                                    <span>{label}</span>
                                    <input
                                        type="checkbox"
                                        checked={advancedFilters[key as keyof AdvancedFilters]}
                                        onChange={() =>
                                            updateAdvancedFilter(key as keyof AdvancedFilters)
                                        }
                                        className="h-4 w-4 accent-emerald-600"
                                    />
                                </label>
                            ))}
                        </div>
                    </div>
                )}

                {/* Results count bar */}
                <div className="mt-2 flex items-center gap-2 px-1">
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
            <div className="relative flex-1 overflow-hidden">
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
                    heatmapMode={heatmapMode}
                    riskHotspots={riskHotspots}
                />

                {/* "Search this area" pill */}
                {showSearchArea && !isLoading && (
                    <div className="absolute top-4 left-1/2 z-1000 -translate-x-1/2">
                        <button
                            onClick={handleSearchThisArea}
                            className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 shadow-xl transition-all hover:bg-slate-50 hover:shadow-2xl active:scale-95"
                        >
                            <RefreshCw size={13} className="text-emerald-600" />
                            Search this area
                        </button>
                    </div>
                )}

                {/* Loading pill */}
                {isLoading && (
                    <div className="absolute top-4 left-1/2 z-1000 -translate-x-1/2">
                        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-600 shadow-xl">
                            <Loader2 size={13} className="animate-spin text-emerald-600" />
                            Fetching pharmacies…
                        </div>
                    </div>
                )}

                {/* Map Controls */}
                <div className="absolute top-4 right-4 z-1000 flex flex-col gap-2">
                    <button
                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-100 bg-white text-slate-600 shadow-lg transition-all hover:text-slate-900 hover:shadow-xl"
                        title="Toggle pharmacy list"
                        onClick={() => setShowBottomSheet((b) => !b)}
                    >
                        <Layers size={20} />
                    </button>
                    <button
                        onClick={handleLocateUser}
                        disabled={isLocating}
                        className={`flex h-10 w-10 items-center justify-center rounded-xl border border-slate-100 shadow-lg transition-all ${
                            isLocating
                                ? "animate-pulse bg-emerald-50 text-emerald-600"
                                : userLocation
                                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                                  : "bg-white text-emerald-600 hover:text-emerald-900 hover:shadow-xl"
                        }`}
                        title="Find my location"
                    >
                        <Navigation size={20} />
                    </button>
                </div>

                {/* Heatmap layer control */}
                <div className="absolute top-28 right-4 z-1000 w-44 rounded-2xl border border-slate-100 bg-white/95 p-2 shadow-xl backdrop-blur">
                    <div className="mb-1 flex items-center gap-1.5 px-1 text-[11px] font-bold text-slate-500">
                        <AlertCircle size={12} className="text-red-500" />
                        Risk layers
                    </div>
                    <div className="grid gap-1">
                        {heatmapOptions.map((option) => (
                            <button
                                key={option.id}
                                onClick={() => setHeatmapMode(option.id)}
                                title={option.description}
                                className={`rounded-xl px-3 py-2 text-left text-[11px] font-bold transition-all ${
                                    heatmapMode === option.id
                                        ? "bg-slate-900 text-white shadow-md"
                                        : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                                }`}
                                aria-pressed={heatmapMode === option.id}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                    {heatmapMode !== "none" && (
                        <p className="mt-2 px-1 text-[10px] leading-snug text-slate-400">
                            {heatmapMode === "counterfeit"
                                ? `${COUNTERFEIT_REPORT_HOTSPOTS.length} report clusters`
                                : heatmapMode === "density"
                                  ? `${densityHotspots.length} density clusters`
                                  : `${riskHotspots.length} total clusters`}
                        </p>
                    )}
                </div>

                {/* Error toast */}
                {(locationError || fetchError) && (
                    <div className="animate-in slide-in-from-top-2 absolute top-4 right-16 left-4 z-1000 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700 shadow-lg duration-300">
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
                        <div className="py-10 text-center">
                            <Loader2
                                size={26}
                                className="mx-auto mb-3 animate-spin text-emerald-600"
                            />
                            <p className="text-sm font-bold text-slate-400">
                                Finding nearby pharmacies…
                            </p>
                            <p className="mt-1 text-xs text-slate-300">Powered by OpenStreetMap</p>
                        </div>
                    ) : filteredPharmacies.length === 0 ? (
                        <div className="py-10 text-center">
                            <MapPin size={30} className="mx-auto mb-2 text-slate-300" />
                            <p className="text-sm font-bold text-slate-400">No pharmacies found</p>
                            <p className="mt-1 text-xs text-slate-300">
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
                        className="absolute right-4 bottom-5 z-1000 flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-xl transition-all hover:bg-slate-800 active:scale-95"
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
