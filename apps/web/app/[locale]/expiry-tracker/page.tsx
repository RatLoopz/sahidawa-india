"use client"; 
import React, { useState, useEffect } from 'react';
import { PageHeader } from "../components/PageHeader";
import { Calendar, Trash2, Package, XCircle, AlertTriangle, CheckCircle2 } from "lucide-react";

interface Medicine {
  id: string;
  name: string;
  expiryDate: string;
  batchNumber?: string;
}

export default function ExpiryTrackerPage() {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [name, setName] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('sahidawa_expiry_tracker');
    if (saved) {
      setMedicines(JSON.parse(saved));
    }
    setIsLoaded(true);
  }, []);

  const saveToLocalStorage = (updatedList: Medicine[]) => {
    setMedicines(updatedList);
    localStorage.setItem('sahidawa_expiry_tracker', JSON.stringify(updatedList));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !expiryDate) return;

    const newMedicine: Medicine = {
      id: Date.now().toString(),
      name,
      expiryDate,
      batchNumber
    };

    const updated = [...medicines, newMedicine];
    saveToLocalStorage(updated);
    setName(''); setExpiryDate(''); setBatchNumber('');
  };

  const handleDelete = (id: string) => {
    const updated = medicines.filter(med => med.id !== id);
    saveToLocalStorage(updated);
  };

  const getExpiryStatus = (dateStr: string) => {
    const expiry = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { icon: <XCircle size={14} />, text: "Expired", color: "text-red-600 bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-900/30" };
    if (diffDays <= 30) return { icon: <AlertTriangle size={14} />, text: `Expiring soon (${diffDays}d)`, color: "text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-900/30" };
    return { icon: <CheckCircle2 size={14} />, text: "Safe", color: "text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-900/30" };
  };

  return (
    <div className="min-h-screen bg-(--color-surface-page) text-(--color-text-primary) transition-colors duration-300">
      <PageHeader 
        title="Medicine Expiry Tracker" 
        subtitle="Manage and track your medicine stock locally" 
        backHref="/" 
        variant="light" 
      />

      <main className="p-6 pt-32 md:pt-40 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-4">
          <div className="md:col-span-1 bg-(--color-surface-muted) p-6 rounded-2xl border border-(--color-border-muted) shadow-sm h-fit sticky top-32">
            <h2 className="text-lg font-bold mb-4 uppercase tracking-tight">Add Medicine</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold opacity-60 uppercase tracking-wider mb-1">Name</label>
                <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full p-3 bg-(--color-surface-page) border border-(--color-border-muted) rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition text-(--color-text-primary)" placeholder="e.g. Paracetamol" />
              </div>
              <div>
                <label className="block text-xs font-bold opacity-60 uppercase tracking-wider mb-1">Expiry Date</label>
                <input type="date" required value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="w-full p-3 bg-(--color-surface-page) border border-(--color-border-muted) rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition text-(--color-text-primary) [color-scheme:light] dark:[color-scheme:dark]" />
              </div>
              <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-900/20 transition-all active:scale-95">Add to Tracker</button>
            </form>
          </div>

          <div className="md:col-span-2 space-y-4">
            <div className="flex justify-between items-center px-2">
              <h2 className="text-xl font-bold">Tracked Medicines</h2>
              <span className="bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-full text-xs font-bold border border-emerald-500/20">Total: {medicines.length}</span>
            </div>
            
            {!isLoaded ? <div className="text-center py-20 opacity-50"><p className="animate-pulse">Loading tracker data...</p></div> : 
             medicines.length === 0 ? <div className="text-center py-20 bg-(--color-surface-muted) border-2 border-dashed border-(--color-border-muted) rounded-3xl opacity-50"><Package size={48} className="mx-auto mb-2 opacity-50" /><p>No medicines added yet.</p></div> : 
             <div className="grid grid-cols-1 gap-4">
               {medicines.map((med) => {
                 const status = getExpiryStatus(med.expiryDate);
                 return (
                   <div key={med.id} className="p-5 bg-(--color-surface-muted) border border-(--color-border-muted) rounded-2xl shadow-sm flex justify-between items-center hover:border-emerald-500/50 transition-all">
                     <div className="space-y-1">
                       <h3 className="font-bold text-lg leading-tight">{med.name}</h3>
                       <div className="flex items-center gap-3 text-sm opacity-70">
                         <span className="flex items-center gap-1"><Calendar size={14} /> {new Date(med.expiryDate).toLocaleDateString()}</span>
                       </div>
                     </div>
                     <div className="flex items-center gap-4">
                       <span className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[11px] font-bold border ${status.color}`}>{status.icon} {status.text}</span>
                       <button onClick={() => handleDelete(med.id)} className="hover:bg-red-500/10 p-2 rounded-full transition-colors"><Trash2 size={18} className="text-red-500" /></button>
                     </div>
                   </div>
                 );
               })}
             </div>
            }
          </div>
        </div>
      </main>
    </div>
  );
}