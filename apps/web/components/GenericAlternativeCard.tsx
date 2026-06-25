import React, { useState, useEffect } from "react";
import { TrendingDown, MapPin, Sparkles, ArrowRight, Pill, Bookmark } from "lucide-react";
import { useRouter, useParams } from "next/navigation";

export interface NearestStore {
    name: string;
    lat: number;
    lng: number;
    distance: string;
}

export interface GenericAlternative {
    brand_name: string;
    generic_name: string;
    brand_price: number;
    jan_aushadhi_price: number;
    savings_percentage: number;
    alternative_name: string;
    nearest_store: NearestStore | null;
}

interface GenericAlternativeCardProps {
    alternative: GenericAlternative;
}

export default function GenericAlternativeCard({ alternative }: GenericAlternativeCardProps) {
    const router = useRouter();
    const params = useParams();
    const locale = Array.isArray(params.locale) ? params.locale[0] : params.locale || "en";

    const [isBookmarked, setIsBookmarked] = useState(false);

    useEffect(() => {
        const saved = JSON.parse(localStorage.getItem('medicine-bookmarks') || '[]');
        const exists = saved.some((item: GenericAlternative) => item.alternative_name === alternative.alternative_name);
        setIsBookmarked(exists);
    }, [alternative.alternative_name]);

    const handleBookmark = () => {
        const saved = JSON.parse(localStorage.getItem('medicine-bookmarks') || '[]');
        if (isBookmarked) {
            const filtered = saved.filter((item: GenericAlternative) => item.alternative_name !== alternative.alternative_name);
            localStorage.setItem('medicine-bookmarks', JSON.stringify(filtered));
            setIsBookmarked(false);
        } else {
            saved.push(alternative);
            localStorage.setItem('medicine-bookmarks', JSON.stringify(saved));
            setIsBookmarked(true);
        }
    };

    const brandPrice = alternative.brand_price;
    const genericPrice = alternative.jan_aushadhi_price;
    const savingsAmount = brandPrice - genericPrice;
    const savingsPct = alternative.savings_percentage;

    return (
        <div className="group relative w-full overflow-hidden rounded-[2.5rem] border border-emerald-500/20 bg-linear-to-b from-white to-emerald-50/10 p-6 shadow-xl transition-all duration-300 hover:scale-[1.02]">
            <div className="flex flex-col space-y-5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 rounded-full bg-emerald-100 px-3.5 py-1 text-xs font-black text-emerald-800">
                            <Sparkles size={12} />
                            <span>{savingsAmount > 0 ? "Cheaper Alternative" : "Alternative"}</span>
                        </div>
                        <button 
                            onClick={handleBookmark}
                            className={`rounded-full p-2 transition-all ${isBookmarked ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-400'}`}
                        >
                            <Bookmark size={14} fill={isBookmarked ? "currentColor" : "none"} />
                        </button>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex items-start justify-between gap-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-4">
                        <div>
                            <p className="text-[10px] font-bold uppercase text-slate-500">Prescribed Brand</p>
                            <h4 className="text-base font-extrabold">{alternative.brand_name}</h4>
                        </div>
                        <p className="text-lg font-black text-slate-400 line-through">₹{brandPrice.toFixed(2)}</p>
                    </div>

                    <div className="flex items-start justify-between gap-4 rounded-2xl border border-emerald-500/25 bg-emerald-50/30 p-4">
                        <div>
                            <p className="text-[10px] font-bold uppercase text-emerald-600">Jan Aushadhi Generic</p>
                            <h4 className="flex items-center gap-1.5 text-base font-extrabold text-emerald-800">
                                <Pill size={15} /> {alternative.alternative_name}
                            </h4>
                        </div>
                        <p className="text-2xl font-black text-emerald-700">₹{genericPrice.toFixed(2)}</p>
                    </div>
                </div>

                <button
                    onClick={() => router.push(`/${locale}/map?filter=govt`)}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3.5 text-sm font-black text-white"
                >
                    Find Nearest Store <ArrowRight size={16} />
                </button>
            </div>
        </div>
    );
}