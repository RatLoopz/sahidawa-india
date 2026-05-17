import React from 'react';
import { Activity, ArrowLeft, Filter, AlertTriangle, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '../../../../api/src/db/client';
import {Globe} from 'lucide-react';

export const revalidate = 0;

function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return 'Recent';
  
  const now = new Date();
  const past = new Date(dateString);
  const msPerMinute = 60 * 1000;
  const msPerHour = msPerMinute * 60;
  const msPerDay = msPerHour * 24;
  
  const elapsed = now.getTime() - past.getTime();
  
  if (elapsed < msPerMinute) {
    return 'Just now';
  } else if (elapsed < msPerHour) {
    return `${Math.round(elapsed / msPerMinute)}m ago`;
  } else if (elapsed < msPerDay) {
    return `${Math.round(elapsed / msPerHour)}h ago`;
  } else {
    // Fall back to a standard date view if it's older than 24 hours
    return past.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
}

export default async function FullAlertsLogPage() {;

  // Fetch ALL rows from medicines that fit alert criteria
  const { data: allAlerts, error } = await supabase
    .from('medicines')
    .select('*')
    .or('is_counterfeit_alert.eq.true,cdsco_approval_status.eq.recalled,cdsco_approval_status.eq.banned, brand_name.eq.SYSTEM_UPDATE')
    .order('created_at', { ascending: false });

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex flex-col items-start gap-4 mb-6">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors">
            <ArrowLeft size={16} />
            Back to Home Page
          </Link>

          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 text-emerald-700 text-sm font-bold border border-emerald-100 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Live Alerts
          </div>
        </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <Activity className="text-red-500" size={28} />
            Live CDSCO Alerts
          </h1>
          <p className="text-slate-500 mt-1 font-medium">
            Complete historical safety logging stream directly mapped to the master CDSCO registry.
          </p>
          
        </div>
        <span className="text-xs font-bold bg-red-100 text-red-600 px-2.5 py-1 rounded-full uppercase tracking-wider hidden sm:block">
                  India Region
                </span>
        <div className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 bg-white shadow-sm self-start md:self-auto">
          <Filter size={16} />
          Total Count: {allAlerts?.length || 0}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl font-medium text-sm mb-6">
          Database synchronization error encountered while fetching active logs.
        </div>
      )}

      <div className="space-y-4">
  {allAlerts && allAlerts.length > 0 ? (
    allAlerts.map((alert) => {
      const isSystem = alert.brand_name === 'SYSTEM_UPDATE';
      const isCritical = alert.cdsco_approval_status === 'banned' || alert.is_counterfeit_alert;

      return (
        <div 
          key={alert.id} 
          className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex items-start gap-4 relative overflow-hidden group hover:shadow-md transition-shadow cursor-pointer"
        >
          {/* Left edge colored strip */}
          <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
            isSystem ? 'bg-blue-500' : isCritical ? 'bg-red-500' : 'bg-orange-400'
          }`}></div>

          {/* Dynamic Alert Icon Wrapper */}
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors ${
            isSystem
              ? 'bg-blue-50 text-blue-500 group-hover:bg-blue-100'
              : isCritical 
                ? 'bg-red-50 text-red-500 group-hover:bg-red-100' 
                : 'bg-orange-50 text-orange-500 group-hover:bg-orange-100'
          }`}>
            {isSystem ? (
              <Globe size={20} strokeWidth={2.5} />
            ) : (
              <AlertTriangle size={20} strokeWidth={2.5} />
            )}
          </div>

          {/* Text Content */}
          <div className="flex-1">
            <div className="flex justify-between items-start gap-2">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <h4 className="font-bold text-slate-800 leading-tight">
                  {isSystem ? 'System Update' : alert.brand_name}
                </h4>
                {!isSystem && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider w-fit ${
                    isCritical ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'
                  }`}>
                    {alert.cdsco_approval_status}
                  </span>
                )}
              </div>
              <span className="text-[11px] font-medium text-slate-400 shrink-0">
                {formatRelativeTime(alert.created_at)}
              </span>
            </div>

            <p className="text-sm text-slate-500 mt-1 font-medium leading-snug">
              {alert.composition}
            </p>

            {/* Render metadata bottom line layout only if it's not a system update card */}
            {!isSystem && (
              <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400 font-semibold">
                <span>Batch: <span className="text-slate-600 font-bold">{alert.batch_number}</span></span>
                <span>•</span>
                <span>Manufacturer: <span className="text-slate-600 font-bold">{alert.manufacturer}</span></span>
              </div>
            )}
          </div>
        </div>
      );
    })
  ) : (
    <div className="bg-white border border-slate-200 rounded-2xl text-center py-16 text-slate-400 font-medium">
      No health alerts currently flagged inside the registry database.
    </div>
  )}
</div>
    </div>
  );
}