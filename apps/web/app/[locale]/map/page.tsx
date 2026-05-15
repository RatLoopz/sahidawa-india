"use client";

import { useState } from "react";
import { MapPin, Search, Navigation, Filter, Star, Phone, Globe, Map as MapIcon, Layers } from "lucide-react";
import { Link } from "@/i18n/routing";
import { PageHeader } from "../components/PageHeader";

export default function PharmacyMapPage() {
  const [activeFilter, setActiveFilter] = useState("all");

  const pharmacies = [
    { id: 1, name: "Pradhan Mantri Jan Aushadhi Kendra", distance: "0.8 km", rating: 4.8, status: "Verified", type: "govt" },
    { id: 2, name: "Apollo Pharmacy", distance: "1.2 km", rating: 4.5, status: "Verified", type: "private" },
    { id: 3, name: "Wellness Forever", distance: "2.5 km", rating: 4.2, status: "Trusted", type: "private" },
  ];

  return (
    <div className="h-screen bg-slate-50 font-sans flex flex-col overflow-hidden">
      
      <PageHeader backHref="/" variant="light">
        <div className="flex-1 bg-slate-100 rounded-2xl flex items-center px-4 py-2 border border-slate-200 focus-within:bg-white focus-within:border-emerald-500 transition-all">
          <Search size={18} className="text-slate-400" />
          <input 
              type="text" 
              placeholder="Search verified pharmacies..." 
              className="bg-transparent border-none outline-none px-3 py-1.5 w-full text-sm font-medium text-slate-700"
          />
        </div>
      </PageHeader>

      <div className="bg-white p-4 pt-0 pb-6 shadow-sm z-20 border-b border-slate-100">
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            <button 
              onClick={() => setActiveFilter("all")}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold transition-all ${activeFilter === "all" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
            >
                All Stores
            </button>
            <button 
              onClick={() => setActiveFilter("govt")}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${activeFilter === "govt" ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-700 border border-emerald-100"}`}
            >
                <Globe size={12} />
                Jan Aushadhi
            </button>
            <button className="whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold bg-slate-100 text-slate-500 flex items-center gap-1.5">
                <Star size={12} />
                Top Rated
            </button>
            <button className="whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold bg-slate-100 text-slate-500 flex items-center gap-1.5">
                <Filter size={12} />
                Filters
            </button>
        </div>
      </div>

      {/* Map View Area (Mock) */}
      <div className="flex-1 relative bg-slate-200 overflow-hidden">
        {/* Mock Map Background */}
        <div className="absolute inset-0 bg-[#e5e7eb] overflow-hidden">
            {/* Simulated map grid lines */}
            <div className="absolute inset-0 opacity-10 bg-[linear-gradient(rgba(0,0,0,.1)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,.1)_1px,transparent_1px)] bg-size-[40px_40px]"></div>
            
            {/* Simulated Pins */}
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-bounce">
                <div className="relative">
                    <div className="w-12 h-12 bg-emerald-600 rounded-full flex items-center justify-center text-white shadow-xl shadow-emerald-600/40 border-4 border-white">
                        <MapPin size={24} />
                    </div>
                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-white px-3 py-1 rounded-full shadow-lg border border-slate-100 whitespace-nowrap">
                        <span className="text-[10px] font-black text-slate-800">PM Jan Aushadhi</span>
                    </div>
                </div>
            </div>

            <div className="absolute top-1/2 right-1/4 animate-pulse">
                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white shadow-lg border-4 border-white">
                    <MapPin size={20} />
                </div>
            </div>

            <div className="absolute bottom-1/4 left-1/4">
                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white shadow-lg border-4 border-white">
                    <MapPin size={20} />
                </div>
            </div>
        </div>

        {/* Map Controls */}
        <div className="absolute right-4 top-4 flex flex-col gap-2">
            <button className="w-10 h-10 bg-white rounded-xl shadow-md flex items-center justify-center text-slate-600 hover:text-slate-900">
                <Layers size={20} />
            </button>
            <button className="w-10 h-10 bg-white rounded-xl shadow-md flex items-center justify-center text-emerald-600 hover:text-emerald-900 font-bold">
                <Navigation size={20} />
            </button>
        </div>

        {/* Bottom List Sheet (Mock) */}
        <div className="absolute bottom-0 left-0 right-0 p-4 space-y-3 max-h-80 overflow-y-auto no-scrollbar">
            {pharmacies.map((pharmacy) => (
                <div key={pharmacy.id} className="bg-white rounded-3xl p-5 shadow-xl border border-slate-100 flex items-center justify-between group hover:scale-[1.02] transition-all cursor-pointer">
                    <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${pharmacy.type === 'govt' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                            <MapIcon size={24} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h4 className="font-bold text-slate-800 text-sm">{pharmacy.name}</h4>
                                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-md">Verified</span>
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                                <span className="text-xs text-slate-400 font-medium">{pharmacy.distance} away</span>
                                <div className="flex items-center gap-1">
                                    <Star size={10} className="text-amber-400 fill-amber-400" />
                                    <span className="text-xs text-slate-600 font-bold">{pharmacy.rating}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <button className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center hover:bg-slate-800 shadow-md">
                        <Phone size={18} />
                    </button>
                </div>
            ))}
        </div>
      </div>
      
      {/* Safe Area Footer */}
      <div className="h-4 bg-white md:hidden"></div>
    </div>
  );
}