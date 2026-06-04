"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
    Search,
    Navigation,
    Filter,
    Star,
    Globe,
    Layers,
    Shield,
    X,
    ChevronUp,
    ChevronDown,
    RefreshCw,
    Loader2,
} from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import PharmacyMap, {
    type HeatmapMode,
    type Pharmacy,
    type MapBounds,
    type RiskHotspot,
} from "./PharmacyMap";
import PharmacyPanels from "./PharmacyPanels";
import { fetchPharmacies, fetchPharmaciesInBounds, type OverpassPharmacy } from "./overpassApi";
import {
    fetchVerifiedPharmacies,
    fetchVerifiedPharmaciesInBounds,
    fetchNearbyAshaWorkers,
    type VerifiedPharmacy,
    type ApiAshaWorker,
} from "../../../lib/api";
import { type AshaWorker } from "./PharmacyMap";

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

// ── Verified pharmacy adapter ────────────────────────────────────────────────
function toVerifiedPharmacy(vp: VerifiedPharmacy, id: number): Pharmacy {
    const verified = vp.is_verified === true;
    return {
        id,
        name: vp.name,
        distance: vp.distance,
        distanceKm: parseFloat(vp.distance) || undefined,
        rating: 0,
        status: verified ? "Verified Safe Store" : "Unverified Partner",
        type: verified ? "govt" : "private",
        coordinates: { lat: vp.lat, lng: vp.lng },
        address: vp.address,
        phone: vp.phone_number || undefined,
        isVerified: verified,
    };
}

function toAshaWorker(aw: ApiAshaWorker): AshaWorker {
    return {
        id: aw.id,
        name: aw.name,
        district: aw.district,
        coordinates: { lat: aw.lat, lng: aw.lng },
        contact: aw.contact,
        distanceKm: aw.distance_km,
    };
}

function deduplicateOsm(verified: Pharmacy[], osm: Pharmacy[]): Pharmacy[] {
    if (verified.length === 0) return osm;
    return osm.filter((osmP) => {
        return !verified.some((vP) => {
            const dlat = osmP.coordinates.lat - vP.coordinates.lat;
            const dlng = osmP.coordinates.lng - vP.coordinates.lng;
            const latScale = 111320;
            const lngScale = 111320 * Math.cos((osmP.coordinates.lat * Math.PI) / 180);
            const dist = Math.sqrt((dlat * latScale) ** 2 + (dlng * lngScale) ** 2);
            return dist < 100;
        });
    });
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

    useEffect(() => {
        if (!isOpen) {
            setIsExpanded(true);
        }
    }, [isOpen]);

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
                data-testid="mobile-pharmacy-pill"
                className="pointer-events-auto absolute right-4 bottom-5 z-1000 flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-xl transition-all hover:bg-slate-800 active:scale-95 md:hidden dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                aria-label={`Show nearby pharmacies list with ${count} results`}
            >
                <ChevronUp size={14} />
                {isLoading ? "Finding pharmacies..." : `${count} Pharmacies`}
            </button>
        );
    }

    return (
        <div
            data-testid="mobile-pharmacy-drawer"
            className="pointer-events-none absolute right-4 bottom-4 left-20 z-1000 md:hidden"
        >
            <div className="pointer-events-auto max-h-[68vh] rounded-[30px] border border-(--color-border-muted) bg-(--color-surface-page)/85 p-2 shadow-2xl backdrop-blur-xl">
                <div className="flex max-h-[calc(68vh-1rem)] flex-col overflow-hidden">
                    <div className="shrink-0 pb-2">
                        <div className="flex justify-center pt-2">
                            <div className="h-1.5 w-10 rounded-full bg-(--color-border-muted)" />
                        </div>
                        <div className="mt-2 flex items-center justify-end gap-1 px-2">
                            <button
                                onClick={collapseDrawer}
                                className="rounded-full p-1.5 transition-colors hover:bg-(--color-surface-muted)"
                                aria-label="Collapse nearby pharmacies list"
                            >
                                <ChevronDown size={15} className="text-(--color-text-secondary)" />
                            </button>
                            <button
                                onClick={onClose}
                                className="rounded-full p-1.5 transition-colors hover:bg-(--color-surface-muted)"
                                aria-label="Hide nearby pharmacies list"
                            >
                                <X size={13} className="text-(--color-text-secondary)" />
                            </button>
                        </div>
                    </div>

                    <div className="min-h-0 flex-1">{children}</div>
                </div>
            </div>
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
    const [activeFilter, setActiveFilter] = useState<"all" | "verified" | "govt" | "named">("all");
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
    const [ashaWorkers, setAshaWorkers] = useState<AshaWorker[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [showSearchArea, setShowSearchArea] = useState(false);
    const [pharmacyCount, setPharmacyCount] = useState(0);
    const [heatmapMode, setHeatmapMode] = useState<HeatmapMode>("none");

    const pendingBoundsRef = useRef<MapBounds | null>(null);
    const initialFetchDone = useRef(false);

    const fetchNearby = useCallback(async (lat: number, lng: number, radius = 10000) => {
        setIsLoading(true);
        setFetchError(null);
        setShowSearchArea(false);
        try {
            const radiusKm = Math.round(radius / 1000);
            const [verifiedResult, osmResult, ashaResult] = await Promise.allSettled([
                fetchVerifiedPharmacies(lat, lng, radiusKm),
                fetchPharmacies(lat, lng, radius),
                fetchNearbyAshaWorkers(lat, lng, radiusKm),
            ]);

            const verified =
                verifiedResult.status === "fulfilled"
                    ? verifiedResult.value.map((vp, i) => toVerifiedPharmacy(vp, -(i + 1)))
                    : [];
            const osm = osmResult.status === "fulfilled" ? osmResult.value.map(toPharmacy) : [];
            const asha =
                ashaResult.status === "fulfilled" ? ashaResult.value.map(toAshaWorker) : [];

            const dedupedOsm = deduplicateOsm(verified, osm);
            const merged = [...verified, ...dedupedOsm].sort((a, b) => {
                if (a.isVerified !== b.isVerified) return a.isVerified ? -1 : 1;
                return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity);
            });

            if (osmResult.status === "rejected") {
                setFetchError("Live search temporarily offline. Showing verified partners only.");
                setTimeout(() => setFetchError(null), 6000);
            } else if (merged.length === 0) {
                setFetchError("No pharmacies found in this area. Try searching a wider region.");
                setTimeout(() => setFetchError(null), 5000);
            }

            setPharmacies(merged);
            setAshaWorkers(asha);
            setPharmacyCount(merged.length);
            initialFetchDone.current = true;
        } catch (err) {
            console.error("Critical error in pharmacy rendering:", err);
            setFetchError("Could not load pharmacies. Try again.");
            setTimeout(() => setFetchError(null), 5000);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                    setUserLocation(loc);
                    fetchNearby(loc.lat, loc.lng);
                },
                () => {
                    fetchNearby(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng);
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
            );
        } else {
            fetchNearby(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng);
        }
    }, [fetchNearby]);

    const fetchInBounds = useCallback(async (bounds: MapBounds) => {
        setIsLoading(true);
        setFetchError(null);
        setShowSearchArea(false);
        try {
            const centerLat = bounds.center.lat;
            const centerLng = bounds.center.lng;
            const radiusKm = 15;
            const [verifiedResult, osmResult, ashaResult] = await Promise.allSettled([
                fetchVerifiedPharmaciesInBounds(
                    bounds.south,
                    bounds.west,
                    bounds.north,
                    bounds.east
                ),
                fetchPharmaciesInBounds(bounds.south, bounds.west, bounds.north, bounds.east),
                fetchNearbyAshaWorkers(centerLat, centerLng, radiusKm),
            ]);

            const verified =
                verifiedResult.status === "fulfilled"
                    ? verifiedResult.value.map((vp, i) => toVerifiedPharmacy(vp, -(i + 1)))
                    : [];
            const osm = osmResult.status === "fulfilled" ? osmResult.value.map(toPharmacy) : [];
            const asha =
                ashaResult.status === "fulfilled" ? ashaResult.value.map(toAshaWorker) : [];

            const dedupedOsm = deduplicateOsm(verified, osm);
            const merged = [...verified, ...dedupedOsm].sort((a, b) => {
                if (a.isVerified !== b.isVerified) return a.isVerified ? -1 : 1;
                return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity);
            });

            if (osmResult.status === "rejected") {
                setFetchError("Live search temporarily offline. Showing verified partners only.");
                setTimeout(() => setFetchError(null), 6000);
            } else if (merged.length === 0) {
                setFetchError("No pharmacies found in this area. Try searching a wider region.");
                setTimeout(() => setFetchError(null), 5000);
            }

            setPharmacies(merged);
            setAshaWorkers(asha);
            setPharmacyCount(merged.length);
        } catch (err) {
            console.error("Critical error in bound pharmacy rendering:", err);
            setFetchError("Could not load pharmacies. Try again.");
            setTimeout(() => setFetchError(null), 5000);
        } finally {
            setIsLoading(false);
        }
    }, []);

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

    const handleMapReady = useCallback(() => {
        if (!initialFetchDone.current) {
            fetchNearby(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng);
        }
    }, [fetchNearby]);

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
        if (activeFilter === "verified") list = list.filter((p) => p.isVerified === true);
        else if (activeFilter === "govt") list = list.filter((p) => p.type === "govt");
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

    const filters = [
        {
            id: "all",
            label: "All Stores",
            activeClass: "bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white shadow-md",
        },
        {
            id: "verified",
            label: "Verified Partners",
            icon: <Shield size={11} className="text-current" />,
            activeClass:
                "bg-emerald-600 text-white shadow-md shadow-emerald-200 dark:shadow-emerald-950/20",
        },
        {
            id: "govt",
            label: "Jan Aushadhi",
            icon: <Globe size={11} />,
            activeClass:
                "bg-emerald-600 text-white shadow-md shadow-emerald-200 dark:shadow-emerald-950/20",
        },
        {
            id: "named",
            label: "Named Only",
            icon: <Star size={11} className="fill-current" />,
            activeClass:
                "bg-amber-500 text-white shadow-md shadow-amber-200 dark:shadow-amber-950/20",
        },
        {
            id: "more",
            label: "Filters",
            icon: <Filter size={11} />,
            activeClass: "bg-(--color-surface-muted) text-(--color-text-secondary)",
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

    const riskSummaryText =
        heatmapMode === "counterfeit"
            ? `${COUNTERFEIT_REPORT_HOTSPOTS.length} report clusters`
            : heatmapMode === "density"
              ? `${densityHotspots.length} density clusters`
              : heatmapMode === "combined"
                ? `${riskHotspots.length} total clusters`
                : "Markers only. Turn on a layer to inspect density or counterfeit-report signals.";

    const handleSelectPharmacy = useCallback((pharmacyId: number) => {
        setSelectedPharmacyId(pharmacyId);
    }, []);

    const pharmacyPanelProps = {
        pharmacies: filteredPharmacies,
        isLoading,
        selectedPharmacyId,
        heatmapMode,
        heatmapOptions,
        riskSummaryText,
        onSelectPharmacy: handleSelectPharmacy,
        onHeatmapModeChange: setHeatmapMode,
    };

    return (
        <div className="flex h-screen flex-col overflow-hidden bg-(--color-surface-muted) font-sans dark:bg-[#0d1117]">
            <h1 className="sr-only">Pharmacy Map — Find Verified Pharmacies Near You</h1>

            {/* ── Header with search ── */}
            <PageHeader backHref="/" variant="light" showThemeToggle={false}>
                <div
                    className="flex flex-1 items-center rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted) px-4 py-2 transition-all focus-within:border-emerald-500 focus-within:bg-(--color-surface-page)"
                    role="search"
                >
                    <Search size={17} className="shrink-0 text-(--color-text-muted)" aria-hidden />
                    <input
                        type="text"
                        placeholder="Search verified pharmacies..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full border-none bg-transparent px-3 py-1.5 text-sm font-medium text-(--color-text-primary) outline-none placeholder:text-(--color-text-muted)"
                        aria-label="Search verified pharmacies"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery("")}
                            className="shrink-0 text-(--color-text-muted) transition-colors hover:text-(--color-text-primary)"
                        >
                            <X size={15} />
                        </button>
                    )}
                </div>
            </PageHeader>

            {/* ── Filter chips ── */}
            <div className="relative z-20 border-b border-(--color-border-muted) bg-(--color-surface-page) p-4 pt-0 pb-4 shadow-sm">
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
                                    : "bg-(--color-surface-muted) text-(--color-text-secondary) hover:bg-(--color-border-muted)"
                            }`}
                        >
                            {"icon" in f && f.icon}
                            {f.label}
                            {f.id === "more" && activeAdvancedFilterCount > 0 && (
                                <span className="ml-0.5 rounded-full bg-(--color-text-primary) px-1.5 py-0.5 text-[9px] text-(--color-surface-page)">
                                    {activeAdvancedFilterCount}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {showFilterPanel && (
                    <div className="absolute top-[calc(100%-0.5rem)] right-4 left-4 z-30 rounded-2xl border border-(--color-border-muted) bg-(--color-surface-page) p-3 shadow-xl md:right-auto md:w-80">
                        <div className="mb-2 flex items-center justify-between">
                            <p className="text-xs font-bold text-(--color-text-primary)">Filters</p>
                            <button
                                onClick={() =>
                                    setAdvancedFilters({
                                        hasAddress: false,
                                        hasPhone: false,
                                        withinFiveKm: false,
                                    })
                                }
                                className="text-[11px] font-semibold text-(--color-text-secondary) transition-colors hover:text-(--color-text-primary)"
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
                                    className="flex cursor-pointer items-center justify-between rounded-xl bg-(--color-surface-muted) px-3 py-2 text-xs font-semibold text-(--color-text-secondary) hover:bg-(--color-border-muted)"
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
                    <p className="text-[11px] font-medium text-(--color-text-muted)">
                        {isLoading ? (
                            <span className="flex items-center gap-1.5">
                                <Loader2 size={10} className="animate-spin" />
                                Fetching pharmacies…
                            </span>
                        ) : (
                            <>
                                {filteredPharmacies.length} pharmacies found
                                {searchQuery && <> for &ldquo;{searchQuery}&rdquo;</>}
                                {pharmacyCount > 0 && (
                                    <span className="text-emerald-600">
                                        {pharmacies.some((p) => p.isVerified)
                                            ? " • Verified + OSM"
                                            : " • Live from OSM"}
                                    </span>
                                )}
                            </>
                        )}
                    </p>
                </div>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden bg-(--color-surface-muted) md:p-4 md:pb-0">
                <div
                    data-testid="pharmacy-map-layout"
                    className="relative flex h-full min-h-0 flex-col overflow-hidden md:grid md:grid-cols-[minmax(22rem,30rem)_minmax(0,1fr)] md:gap-4"
                >
                    <aside
                        data-testid="desktop-pharmacy-sidebar"
                        className="hidden min-h-0 md:block"
                    >
                        <PharmacyPanels
                            {...pharmacyPanelProps}
                            className="h-full border border-(--color-border-muted) bg-(--color-surface-page) shadow-[0_24px_80px_-40px_rgba(15,23,42,0.45)]"
                        />
                    </aside>

                    <div
                        data-testid="pharmacy-map-pane"
                        className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden md:rounded-[32px] md:border md:border-(--color-border-muted) md:bg-(--color-surface-page) md:shadow-[0_28px_80px_-40px_rgba(15,23,42,0.55)]"
                    >
                        <PharmacyMap
                            pharmacies={filteredPharmacies}
                            ashaWorkers={ashaWorkers}
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

                        {showSearchArea && !isLoading && (
                            <div className="absolute top-4 left-1/2 z-1000 -translate-x-1/2">
                                <button
                                    onClick={handleSearchThisArea}
                                    className="flex items-center gap-2 rounded-full border border-(--color-border-muted) bg-(--color-surface-page) px-5 py-2.5 text-xs font-bold text-(--color-text-primary) shadow-xl transition-all hover:bg-(--color-surface-muted) hover:shadow-2xl active:scale-95"
                                >
                                    <RefreshCw size={13} className="text-emerald-600" />
                                    Search this area
                                </button>
                            </div>
                        )}

                        {isLoading && (
                            <div className="absolute top-4 left-1/2 z-1000 -translate-x-1/2">
                                <div className="flex items-center gap-2 rounded-full border border-(--color-border-muted) bg-(--color-surface-page) px-5 py-2.5 text-xs font-bold text-(--color-text-secondary) shadow-xl">
                                    <Loader2 size={13} className="animate-spin text-emerald-600" />
                                    Fetching pharmacies…
                                </div>
                            </div>
                        )}

                        <div className="absolute top-4 right-4 z-1000 flex flex-col gap-2">
                            <button
                                data-testid="mobile-pharmacy-list-toggle"
                                className="flex h-10 w-10 items-center justify-center rounded-xl border border-(--color-border-muted) bg-(--color-surface-page) text-(--color-text-secondary) shadow-lg transition-all hover:text-(--color-text-primary) hover:shadow-xl md:hidden"
                                aria-label="Toggle pharmacy list"
                                title="Toggle pharmacy list"
                                onClick={() => setShowBottomSheet((open) => !open)}
                            >
                                <Layers size={20} />
                            </button>
                            <button
                                onClick={handleLocateUser}
                                disabled={isLocating}
                                className={`flex h-10 w-10 items-center justify-center rounded-xl border border-(--color-border-muted) shadow-lg transition-all ${
                                    isLocating
                                        ? "animate-pulse bg-emerald-500/10 text-emerald-600"
                                        : userLocation
                                          ? "bg-emerald-600 text-white hover:bg-emerald-700"
                                          : "bg-(--color-surface-page) text-emerald-600 hover:text-emerald-500 hover:shadow-xl dark:hover:text-emerald-400"
                                }`}
                                aria-label="Find my location"
                                title="Find my location"
                            >
                                <Navigation size={20} />
                            </button>
                        </div>

                        {(locationError || fetchError) && (
                            <div className="animate-in slide-in-from-top-2 absolute top-4 right-16 left-4 z-1000 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700 shadow-lg duration-300 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400">
                                {locationError || fetchError}
                            </div>
                        )}

                        <BottomDrawer
                            isOpen={showBottomSheet}
                            onClose={() => setShowBottomSheet(false)}
                            count={filteredPharmacies.length}
                            isLoading={isLoading}
                        >
                            <PharmacyPanels
                                {...pharmacyPanelProps}
                                className="h-full border border-(--color-border-muted) bg-(--color-surface-page)"
                            />
                        </BottomDrawer>
                    </div>
                </div>
            </div>

            {/* Safe-area footer */}
            <div className="bg-transparent md:hidden" aria-hidden="true" />
        </div>
    );
}
