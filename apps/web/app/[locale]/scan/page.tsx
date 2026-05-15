"use client";

import { useState, useEffect } from "react";
import { ShieldCheck, Info, AlertCircle, Layers } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { Camera, ShieldCheck, Info, AlertCircle, Layers, Copy, Check } from "lucide-react";
import { Link } from "@/i18n/routing";
import { PageHeader } from "../components/PageHeader";
import { Home, Share2 } from "lucide-react";
import { toast } from "sonner";

// Simple Skeleton component
function LoadingSkeleton() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
      <div className="bg-white text-slate-900 w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-2 bg-emerald-500 animate-pulse"></div>
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-gray-300 animate-pulse"></div>
          <div className="space-y-2 w-full">
            <div className="h-7 bg-gray-300 rounded-lg animate-pulse w-3/4 mx-auto"></div>
            <div className="h-4 bg-gray-300 rounded-lg animate-pulse w-1/2 mx-auto"></div>
          </div>
          <div className="w-full grid grid-cols-2 gap-3 pt-2">
            <div className="bg-gray-100 p-3 rounded-2xl space-y-2">
              <div className="h-3 bg-gray-300 rounded animate-pulse w-3/4 mx-auto"></div>
              <div className="h-5 bg-gray-300 rounded animate-pulse w-1/2 mx-auto"></div>
            </div>
            <div className="bg-gray-100 p-3 rounded-2xl space-y-2">
              <div className="h-3 bg-gray-300 rounded animate-pulse w-3/4 mx-auto"></div>
              <div className="h-5 bg-gray-300 rounded animate-pulse w-1/2 mx-auto"></div>
            </div>
          </div>
          <div className="w-full bg-gray-100 p-4 rounded-2xl space-y-2">
            <div className="h-4 bg-gray-300 rounded animate-pulse w-full"></div>
            <div className="h-4 bg-gray-300 rounded animate-pulse w-5/6"></div>
          </div>
          <div className="w-full py-4 bg-gray-300 rounded-2xl animate-pulse h-12"></div>
          <div className="h-4 bg-gray-300 rounded animate-pulse w-24 mx-auto"></div>
        </div>
        <div className="text-center mt-4 text-sm text-gray-500 animate-pulse">
          Verifying medicine...
        </div>
      </div>
    </div>
  );
}

export default function ScanPage() {
  const [isScanning, setIsScanning] = useState(true);
  const [showResult, setShowResult] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopyBatch = useCallback(async () => {
    try {
      await navigator.clipboard.writeText("AUG625D");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = "AUG625D";
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, []);

  useEffect(() => {
    if (isScanning) {
      const timer = setTimeout(() => {
        setIsScanning(false);
        setShowResult(true);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [isScanning]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImage(reader.result as string);
        setIsScanning(true);
        setShowResult(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleScanAgain = () => {
    setIsScanning(true);
    setShowResult(false);
    setUploadedImage(null);
  };
  const handleShare = async () => {
    if(!result) return;

    const shareText = `
    Medicine: Authentic Medicine
    Batch No: AUG625D
    Expiry: 12/2027
    Status: Verified by CDSCO Database
    `.trim();

    const shareData = {
      title: "Medicine Verification Result",
      text: `${shareText}\n\n`,
      url: window.location.href,
    };

    try {
      if (
      typeof navigator !== "undefined" &&
      navigator.share &&
      (!navigator.canShare || navigator.canShare(shareData))) {
        
        await navigator.share(shareData);

        toast.success("Verification result shared successfully");
      } else {

        await navigator.clipboard.writeText(
          `${shareText}\n\n${window.location.href}`);

        toast.success("Verification result copied to clipboard");
      }
    } catch (error: any) {
      if (
        error?.name === "AbortError" || 
        String(error).includes("Share canceled") || 
        String(error).includes("AbortError")
      ) {
        return; 
      }
      toast.error("Failed to share result");
    }
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans relative flex flex-col">
      <input 
        type="file" 
        id="medicine-upload" 
        className="hidden" 
        accept="image/*" 
        onChange={handleFileUpload}
      />

      <PageHeader 
        title="Scanner Mode" 
        subtitle="Position the Barcode" 
        backHref="/" 
        variant="dark" 
      />

      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-slate-900 overflow-hidden">
          {uploadedImage ? (
            <img src={uploadedImage} alt="Uploaded" className="w-full h-full object-cover opacity-60" />
          ) : (
            <>
              <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
              <div className="absolute inset-0 animate-pulse bg-emerald-500/5"></div>
            </>
          )}
        </div>

        <div className="relative w-72 h-72 md:w-96 md:h-96 z-10">
          <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-emerald-500 rounded-tl-2xl"></div>
          <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-emerald-500 rounded-tr-2xl"></div>
          <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-emerald-500 rounded-bl-2xl"></div>
          <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-emerald-500 rounded-br-2xl"></div>

          {isScanning && (
            <div className="absolute left-4 right-4 h-[2px] bg-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.8)] animate-scan z-20"></div>
          )}
        </div>

        {/* Loading Skeleton */}
        {isScanning && <LoadingSkeleton />}

        {/* Result */}
        {showResult && (
          <div className="absolute inset-0 z-30 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-in fade-in zoom-in duration-300">
            <div className="bg-white text-slate-900 w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-2 bg-emerald-500"></div>
              
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-inner">
                  <ShieldCheck size={40} strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="text-2xl font-black tracking-tight">Authentic Medicine</h3>
                  <p className="text-slate-500 font-medium">Verified by CDSCO Database</p>
                </div>

                <div className="w-full grid grid-cols-2 gap-3 pt-2">
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Batch No.</span>
                    <span className="font-bold text-slate-700">AUG625D</span>
               <div className="absolute top-0 left-0 right-0 h-2 bg-emerald-500"></div>
               
               <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-inner">
                    <ShieldCheck size={40} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black tracking-tight">Authentic Medicine</h3>
                    <p className="text-slate-500 font-medium">Verified by CDSCO Database</p>
                  </div>

                  <div className="w-full grid grid-cols-2 gap-3 pt-2">
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 relative">
                       <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Batch No.</span>
                       <div className="flex items-center justify-between gap-1">
                         <span className="font-bold text-slate-700">AUG625D</span>
                         <button
                           onClick={handleCopyBatch}
                           aria-label="Copy batch number"
                           className={`p-1 rounded-lg transition-all duration-200 shrink-0 ${
                             copied
                               ? "bg-emerald-100 text-emerald-600"
                               : "bg-slate-200/60 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                           }`}
                         >
                           {copied ? <Check size={14} strokeWidth={3} /> : <Copy size={14} />}
                         </button>
                       </div>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                       <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Expiry</span>
                       <span className="font-bold text-slate-700">12/2027</span>
                    </div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Expiry</span>
                    <span className="font-bold text-slate-700">12/2027</span>
                  </div>
                </div>

                <div className="w-full bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-start gap-3 text-left">
                  <Info size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-emerald-800 font-medium leading-relaxed">
                    This medicine matches the official records. Always check the physical seal before use.
                  </p>
                </div>

                <button 
                  onClick={handleScanAgain}
                  className="w-full py-4 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20"
                >
                  Scan Another
                </button>
                <Link href="/" className="text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors">
                  Back to Home
                </Link>
              </div>

                  <button 
                    onClick={() => {setScanning(true); setResult(null);}}
                    className="w-full py-4 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20"
                  >
                    Scan Another
                  </button>
                  <div className="w-full grid grid-cols-2 gap-3 pt-1">
                    <Link
                      href="/"
                      className="group flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-slate-100 border border-slate-200 text-slate-700 font-semibold hover:bg-slate-200 hover:border-slate-300 active:scale-[0.98] transition-all duration-200"
                    >
                       <Home
                        size={19}
                        className="transition-transform duration-200 group-hover:-translate-x-0.5"
                      />
                      <span>Home</span>
                     
                    </Link>

                    <button
                      type="button"
                      onClick={handleShare}
                      className="group flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-slate-100 border border-slate-200 text-slate-700 font-semibold hover:bg-slate-200 hover:border-slate-300 active:scale-[0.98] transition-all duration-200"
                    >
                      <Share2
                        size={19}
                        className="transition-transform duration-200 group-hover:-translate-x-0.5"
                      />
                      <span>Share</span>
                      
                    </button>
                  </div>
               </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-8 bg-linear-to-t from-black to-transparent flex flex-col items-center gap-6">
        <p className="text-slate-400 text-sm font-medium text-center max-w-xs">
          Hold the medicine strip steady inside the frame or upload a photo from your gallery.
        </p>
        <div className="flex gap-4">
          <label 
            htmlFor="medicine-upload" 
            className="px-6 py-3 rounded-full bg-white text-black font-bold text-sm flex items-center gap-2 cursor-pointer hover:bg-slate-200 transition-colors shadow-lg"
          >
            <Layers size={18} />
            Upload Photo
          </label>
          <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
            <AlertCircle size={20} className="text-white/50" />
          </div>
        </div>
      </div>
    </div>
  );
}