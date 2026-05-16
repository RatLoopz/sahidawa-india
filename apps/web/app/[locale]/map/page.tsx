"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { 
  Search, Navigation, Filter, Star, Phone, Globe, 
  Layers, Clock, Shield, Heart, 
  AlertCircle, Store, X, MapPin, ChevronUp, ChevronDown
} from "lucide-react";
import { PageHeader } from "../components/PageHeader";

const Map = dynamic(() => import("@/app/components/Map"), { 
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #e8f4f0 0%, #dbeafe 50%, #e8f4f0 100%)' }}
    >
      <div className="relative z-10 text-center">
        <div className="relative w-14 h-14 mx-auto mb-3">
          <div className="absolute inset-0 border-3 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" style={{ borderWidth: 3 }}></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Store size={20} className="text-emerald-600" />
          </div>
        </div>
        <p className="text-slate-600 text-sm font-semibold tracking-tight">Loading map…</p>
      </div>
    </div>
  )
});

const pharmaciesData = [
  { 
    id: 1, name: "Jan Aushadhi Kendra", distance: "0.8 km", rating: 4.8, 
    status: "Govt. Verified", type: "govt",
    coordinates: [28.6139, 77.2090] as [number, number],
    address: "Connaught Place, New Delhi", isOpen: true, emergencyAvailable: true,
    medicinesAvailable: 95, openHours: "8 AM – 10 PM", phone: "+91-11-23456789"
  },
  { 
    id: 2, name: "Apollo Pharmacy", distance: "1.2 km", rating: 4.5, 
    status: "Premium", type: "private",
    coordinates: [19.0760, 72.8777] as [number, number],
    address: "Andheri West, Mumbai", isOpen: true, emergencyAvailable: true,
    medicinesAvailable: 88, openHours: "24 hours", phone: "+91-22-98765432"
  },
  { 
    id: 3, name: "Wellness Forever", distance: "2.5 km", rating: 4.2, 
    status: "Trusted", type: "private",
    coordinates: [12.9716, 77.5946] as [number, number],
    address: "Indiranagar, Bangalore", isOpen: false, emergencyAvailable: false,
    medicinesAvailable: 76, openHours: "9 AM – 9 PM", phone: "+91-80-34567890"
  },
  { 
    id: 4, name: "MedPlus Pharmacy", distance: "1.5 km", rating: 4.6, 
    status: "Verified", type: "private",
    coordinates: [17.3850, 78.4867] as [number, number],
    address: "Jubilee Hills, Hyderabad", isOpen: true, emergencyAvailable: true,
    medicinesAvailable: 92, openHours: "24 hours", phone: "+91-40-45678901"
  },
  { 
    id: 5, name: "Netmeds Express", distance: "3.0 km", rating: 4.4, 
    status: "Trusted", type: "private",
    coordinates: [13.0827, 80.2707] as [number, number],
    address: "T Nagar, Chennai", isOpen: true, emergencyAvailable: false,
    medicinesAvailable: 82, openHours: "8 AM – 11 PM", phone: "+91-44-56789012"
  },
  { 
    id: 6, name: "1mg Pharmacy", distance: "1.8 km", rating: 4.7, 
    status: "Verified", type: "private",
    coordinates: [22.5726, 88.3639] as [number, number],
    address: "Salt Lake, Kolkata", isOpen: true, emergencyAvailable: true,
    medicinesAvailable: 96, openHours: "24 hours", phone: "+91-33-67890123"
  }
];

// Floating Bottom Drawer Component
function BottomDrawer({ children, isOpen, onClose, onHeightChange, count, selectedId }: {
  children: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  onHeightChange?: (h: number) => void;
  count: number;
  selectedId: number | null;
}) {
  const [drawerHeight, setDrawerHeight] = useState(0.35);
  const drawerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const startHeight = useRef(0);

  const expandDrawer = () => setDrawerHeight(0.7);
  const collapseDrawer = () => setDrawerHeight(0.35);

  const handleTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    startHeight.current = drawerHeight;
    if (drawerRef.current) drawerRef.current.style.transition = 'none';
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const delta = (startY.current - e.touches[0].clientY) / window.innerHeight;
    const newHeight = Math.min(0.85, Math.max(0.2, startHeight.current + delta));
    setDrawerHeight(newHeight);
    if (drawerRef.current) {
      drawerRef.current.style.transform = `translateY(${(1 - newHeight) * 100}%)`;
    }
    onHeightChange?.(newHeight);
  };

  const handleTouchEnd = () => {
    const snapPoint = drawerHeight > 0.55 ? 0.7 : 0.35;
    setDrawerHeight(snapPoint);
    if (drawerRef.current) {
      drawerRef.current.style.transform = `translateY(${(1 - snapPoint) * 100}%)`;
      drawerRef.current.style.transition = 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)';
      setTimeout(() => {
        if (drawerRef.current) drawerRef.current.style.transition = '';
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
      <div 
        className="absolute inset-0 bg-black/30 transition-opacity duration-300 z-[900]"
        style={{ opacity: drawerHeight > 0.5 ? 0.5 : 0.2 }}
        onClick={onClose}
      />
      
      <div
        ref={drawerRef}
        className="absolute bottom-0 left-0 right-0 z-[1000] pointer-events-auto"
        style={{ height: '75vh' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="max-w-lg mx-auto h-full flex flex-col">
          <div className="bg-white/95 backdrop-blur-xl rounded-t-3xl shadow-2xl flex flex-col h-full overflow-hidden border-t border-white/20">
            <div className="flex-shrink-0 pt-3 pb-2">
              <div className="flex justify-center">
                <div className="w-12 h-1.5 bg-slate-300 rounded-full" />
              </div>
              
              <div className="flex items-center justify-between px-5 mt-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                    <Store size={14} className="text-emerald-600" />
                  </div>
                  <h3 className="font-semibold text-slate-800 text-base">
                    Nearby Pharmacies
                    <span className="text-xs font-normal text-slate-400 ml-1.5">({count})</span>
                  </h3>
                </div>
                <div className="flex items-center gap-1">
                  {drawerHeight === 0.35 && (
                    <button 
                      onClick={expandDrawer}
                      className="p-1.5 rounded-full hover:bg-slate-100 transition-colors"
                    >
                      <ChevronUp size={16} className="text-slate-500" />
                    </button>
                  )}
                  {drawerHeight === 0.7 && (
                    <button 
                      onClick={collapseDrawer}
                      className="p-1.5 rounded-full hover:bg-slate-100 transition-colors"
                    >
                      <ChevronDown size={16} className="text-slate-500" />
                    </button>
                  )}
                  <button 
                    onClick={onClose}
                    className="p-1.5 rounded-full hover:bg-slate-100 transition-colors"
                  >
                    <X size={14} className="text-slate-500" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
              {children}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// Compact Pharmacy Card
function PharmacyCard({ pharmacy, isSelected, onClick }: {
  pharmacy: typeof pharmaciesData[0];
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`
        rounded-xl p-3 cursor-pointer transition-all duration-200
        border
        ${isSelected 
          ? 'border-emerald-300 bg-emerald-50/60 shadow-md shadow-emerald-100/30' 
          : 'border-slate-100 bg-white hover:border-slate-200 hover:shadow-sm'
        }
      `}
    >
      <div className="flex items-start gap-2.5">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
          pharmacy.type === 'govt' ? 'bg-emerald-100' : 'bg-blue-50'
        }`}>
          <span className="text-sm">{pharmacy.type === 'govt' ? '🏥' : '💊'}</span>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-slate-800 truncate">
              {pharmacy.name}
            </h4>
            <div className="flex items-center gap-0.5 shrink-0">
              <Star size={10} className="text-amber-400 fill-amber-400" />
              <span className="text-[11px] font-bold text-slate-700">{pharmacy.rating}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-1 mt-0.5">
            <MapPin size={8} className="text-slate-300 shrink-0" />
            <p className="text-[10px] text-slate-400 truncate">{pharmacy.address}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-2 ml-11">
        <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
          pharmacy.isOpen ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
        }`}>
          <span className={`w-1 h-1 rounded-full ${pharmacy.isOpen ? 'bg-green-500' : 'bg-red-400'}`} />
          {pharmacy.isOpen ? pharmacy.openHours : 'Closed'}
        </span>
        <span className="text-[10px] text-slate-300">•</span>
        <span className="text-[10px] text-slate-400">{pharmacy.distance}</span>
      </div>

      <div className="flex flex-wrap gap-1 mt-1.5 ml-11">
        <span className="inline-flex items-center gap-0.5 text-[9px] font-medium bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">
          <Shield size={6} />
          {pharmacy.status}
        </span>
        {pharmacy.emergencyAvailable && (
          <span className="inline-flex items-center gap-0.5 text-[9px] font-medium bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-full">
            <AlertCircle size={6} />
            24/7
          </span>
        )}
        <span className="inline-flex items-center gap-0.5 text-[9px] font-medium bg-violet-50 text-violet-700 px-1.5 py-0.5 rounded-full">
          <Heart size={6} />
          {pharmacy.medicinesAvailable}%
        </span>
      </div>

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
    </div>
  );
}

// Main Page
export default function PharmacyMapPage() {
  const [activeFilter, setActiveFilter] = useState("all");
  const [selectedPharmacyId, setSelectedPharmacyId] = useState<number | null>(null);
  const [showBottomSheet, setShowBottomSheet] = useState(true);
  const [drawerHeight, setDrawerHeight] = useState(0.35);
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => { setMounted(true); }, []);

  const getFilteredPharmacies = () => {
    let f = pharmaciesData;
    if (activeFilter === "govt") f = f.filter(p => p.type === "govt");
    else if (activeFilter === "top-rated") f = f.filter(p => p.rating >= 4.5);
    else if (activeFilter === "open") f = f.filter(p => p.isOpen);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      f = f.filter(p => p.name.toLowerCase().includes(q) || p.address.toLowerCase().includes(q));
    }
    return f;
  };

  const filteredPharmacies = getFilteredPharmacies();
  const selectedPharmacyCoords = selectedPharmacyId !== null
    ? pharmaciesData.find(p => p.id === selectedPharmacyId)?.coordinates ?? null
    : null;

  const handlePharmacyClick = (id: number) => {
    setSelectedPharmacyId(id);
    setShowBottomSheet(true);
  };

  const filters = [
    { id: "all", label: "All", icon: null, activeClass: "bg-slate-900 text-white" },
    { id: "govt", label: "Jan Aushadhi", icon: <Globe size={11} />, activeClass: "bg-emerald-600 text-white" },
    { id: "top-rated", label: "Top Rated", icon: <Star size={11} className="fill-current" />, activeClass: "bg-amber-500 text-white" },
    { id: "open", label: "Open Now", icon: <Clock size={11} />, activeClass: "bg-emerald-600 text-white" },
  ];

  return (

    <div className="h-screen bg-slate-50 flex flex-col overflow-hidden">

      {/* Header */}
      <PageHeader backHref="/" variant="light">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search pharmacy..."
            className="w-full bg-slate-100 rounded-xl pl-9 pr-8 py-2 text-[13px] font-medium placeholder:text-slate-400 focus:bg-white focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-all"

    <div className="h-screen bg-slate-50 font-sans flex flex-col overflow-hidden">
      <h1 className="sr-only">Pharmacy Map — Find Verified Pharmacies Near You</h1>
      
      <PageHeader backHref="/" variant="light">
        <div className="flex-1 bg-slate-100 rounded-2xl flex items-center px-4 py-2 border border-slate-200 focus-within:bg-white focus-within:border-emerald-500 transition-all" role="search">
          <Search size={18} aria-hidden="true" className="text-slate-400" />
          <label htmlFor="pharmacy-search" className="sr-only">Search verified pharmacies</label>
          <input 
              id="pharmacy-search"
              type="text" 
              placeholder="Search verified pharmacies..." 
              aria-label="Search verified pharmacies"
              className="bg-transparent border-none outline-none px-3 py-1.5 w-full text-sm font-medium text-slate-700"

          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X size={12} className="text-slate-400" />
            </button>
          )}
        </div>
      </PageHeader>


      {/* Filter Chips */}
      <div className="bg-white/95 backdrop-blur-sm border-b border-slate-100 z-20">
        <div className="px-3 py-2">
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {filters.map(f => (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id)}
                className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-medium transition-all ${
                  activeFilter === f.id
                    ? f.activeClass + ' shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f.icon}
                {f.label}
              </button>
            ))}
            <button className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600">
              <Filter size={11} />
              More

      <div className="bg-white p-4 pt-0 pb-6 shadow-sm z-20 border-b border-slate-100">
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar" role="group" aria-label="Filter pharmacies by type">
            <button 
              onClick={() => setActiveFilter("all")}
              aria-pressed={activeFilter === "all"}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold transition-all ${activeFilter === "all" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
            >
                All Stores
            </button>
            <button 
              onClick={() => setActiveFilter("govt")}
              aria-pressed={activeFilter === "govt"}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${activeFilter === "govt" ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-700 border border-emerald-100"}`}
            >
                <Globe size={12} aria-hidden="true" />
                Jan Aushadhi
            </button>
            <button aria-label="Filter by top rated pharmacies" className="whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold bg-slate-100 text-slate-500 flex items-center gap-1.5">
                <Star size={12} aria-hidden="true" />
                Top Rated
            </button>
            <button aria-label="Open additional pharmacy filters" className="whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold bg-slate-100 text-slate-500 flex items-center gap-1.5">
                <Filter size={12} aria-hidden="true" />
                Filters

            </button>
          </div>
        </div>
      </div>


      {/* Map Container - FIXED: Map fills remaining space properly */}
      <div className="relative flex-1 min-h-0">
        {mounted && (
          <div className="absolute inset-0">
            <Map
              pharmacies={filteredPharmacies}
              selectedPharmacy={selectedPharmacyCoords}
              selectedPharmacyId={selectedPharmacyId}
              onMarkerClick={handlePharmacyClick}
            />
          </div>
        )}

        {/* Floating Controls */}
        <div className="absolute right-3 top-3 z-[400]">
          <div className="bg-white/95 backdrop-blur-md rounded-xl shadow-lg overflow-hidden">
            <button
              onClick={() => setShowBottomSheet(!showBottomSheet)}
              className="w-9 h-9 flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <Layers size={16} />
            </button>
            <div className="h-px bg-slate-200 mx-2" />
            <button
              onClick={() => {
                if ("geolocation" in navigator) {
                  navigator.geolocation.getCurrentPosition(
                    () => alert("📍 Location found!"),
                    () => alert("Please enable location services")
                  );
                }
              }}
              className="w-9 h-9 flex items-center justify-center text-emerald-600 hover:bg-slate-100 transition-colors"
            >
              <Navigation size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Drawer */}
      <BottomDrawer
        isOpen={showBottomSheet}
        onClose={() => setShowBottomSheet(false)}
        onHeightChange={setDrawerHeight}
        count={filteredPharmacies.length}
        selectedId={selectedPharmacyId}
      >
        {filteredPharmacies.length > 0 ? (
          filteredPharmacies.map(pharmacy => (
            <PharmacyCard
              key={pharmacy.id}
              pharmacy={pharmacy}
              isSelected={selectedPharmacyId === pharmacy.id}
              onClick={() => handlePharmacyClick(pharmacy.id)}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3 text-xl">
              🔍
            </div>
            <p className="text-sm font-medium text-slate-700">No pharmacies found</p>
            <p className="text-xs text-slate-400 mt-1">Try adjusting your filters</p>
          </div>
        )}
      </BottomDrawer>

      {/* Map View Area (Mock) */}
      <main className="flex-1 relative bg-slate-200 overflow-hidden" aria-label="Pharmacy map view">
        {/* Mock Map Background */}
        <div className="absolute inset-0 bg-[#e5e7eb] overflow-hidden" role="img" aria-label="Map showing nearby verified pharmacies">
            {/* Simulated map grid lines */}
            <div className="absolute inset-0 opacity-10 bg-[linear-gradient(rgba(0,0,0,.1)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,.1)_1px,transparent_1px)] bg-size-[40px_40px]" aria-hidden="true"></div>
            
            {/* Simulated Pins */}
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-bounce" aria-hidden="true">
                <div className="relative">
                    <div className="w-12 h-12 bg-emerald-600 rounded-full flex items-center justify-center text-white shadow-xl shadow-emerald-600/40 border-4 border-white">
                        <MapPin size={24} aria-hidden="true" />
                    </div>
                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-white px-3 py-1 rounded-full shadow-lg border border-slate-100 whitespace-nowrap">
                        <span className="text-[10px] font-black text-slate-800">PM Jan Aushadhi</span>
                    </div>
                </div>
            </div>

            <div className="absolute top-1/2 right-1/4 animate-pulse" aria-hidden="true">
                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white shadow-lg border-4 border-white">
                    <MapPin size={20} aria-hidden="true" />
                </div>
            </div>

            <div className="absolute bottom-1/4 left-1/4" aria-hidden="true">
                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white shadow-lg border-4 border-white">
                    <MapPin size={20} aria-hidden="true" />
                </div>
            </div>
        </div>

        {/* Map Controls */}
        <div className="absolute right-4 top-4 flex flex-col gap-2">
            <button aria-label="Toggle map layers" className="w-10 h-10 bg-white rounded-xl shadow-md flex items-center justify-center text-slate-600 hover:text-slate-900">
                <Layers size={20} aria-hidden="true" />
                <span className="sr-only">Toggle map layers</span>
            </button>
            <button aria-label="Center map on my location" className="w-10 h-10 bg-white rounded-xl shadow-md flex items-center justify-center text-emerald-600 hover:text-emerald-900 font-bold">
                <Navigation size={20} aria-hidden="true" />
                <span className="sr-only">Center map on my location</span>
            </button>
        </div>

        {/* Bottom List Sheet (Mock) */}
        <div className="absolute bottom-0 left-0 right-0 p-4 space-y-3 max-h-80 overflow-y-auto no-scrollbar" role="list" aria-label="Nearby pharmacies">
            {pharmacies.map((pharmacy) => (
                <div key={pharmacy.id} role="listitem" className="bg-white rounded-3xl p-5 shadow-xl border border-slate-100 flex items-center justify-between group hover:scale-[1.02] transition-all">
                    <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${pharmacy.type === 'govt' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                            <MapIcon size={24} aria-hidden="true" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">

                                <h2 className="font-bold text-slate-800 text-sm">{pharmacy.name}</h2>
                                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-md">Verified</span>

                                <h4 className="font-bold text-slate-800 text-sm">{pharmacy.name}</h4>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${pharmacy.status === 'Verified' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>{pharmacy.status}</span>

                            </div>
                            <div className="flex items-center gap-3 mt-1">
                                <span className="text-xs text-slate-400 font-medium">{pharmacy.distance} away</span>
                                <div className="flex items-center gap-1">
                                    <Star size={10} aria-hidden="true" className="text-amber-400 fill-amber-400" />
                                    <span className="text-xs text-slate-600 font-bold" aria-label={`Rating: ${pharmacy.rating} out of 5`}>{pharmacy.rating}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <button aria-label={`Call ${pharmacy.name}`} className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center hover:bg-slate-800 shadow-md">
                        <Phone size={18} aria-hidden="true" />
                        <span className="sr-only">Call {pharmacy.name}</span>
                    </button>
                </div>
            ))}
        </div>
      </main>
      
      {/* Safe Area Footer */}
      <div className="h-4 bg-white md:hidden" aria-hidden="true"></div>

    </div>
  );
}