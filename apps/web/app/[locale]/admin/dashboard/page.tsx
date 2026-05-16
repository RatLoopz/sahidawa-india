'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle, Database, History, Search,
  CheckCircle, XCircle, RefreshCw, Loader2,
  ShieldAlert, Plus, Clock, Pill, FileText,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1/admin';

type ReportStatus = 'pending' | 'verified_fake' | 'false_alarm';
type MedicineStatus = 'approved' | 'recalled' | 'banned';
type Tab = 'reports' | 'medicine' | 'logs';

interface Report {
  id: string;
  reported_brand_name: string | null;
  district: string | null;
  status: ReportStatus;
  created_at: string;
  scanned_barcode: string | null;
  medicines?: { brand_name: string; generic_name: string } | null;
}

interface Medicine {
  id: string;
  brand_name: string;
  generic_name: string;
  manufacturer: string;
  barcode_id: string;
  cdsco_approval_status: MedicineStatus;
}

interface AuditEntry {
  id: string;
  action: string;
  target_type: string;
  target_id: string;
  details: string;
  created_at: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(diff / 86_400_000);
  if (h < 1) return 'Just now';
  if (h < 24) return `${h}h ago`;
  return `${d}d ago`;
}

function getToken(): string {
  if (globalThis.window === undefined) return '';
  return localStorage.getItem('sb-access-token') ?? '';
}

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>('reports');
  const [reports, setReports] = useState<Report[]>([]);
  const [resolved, setResolved] = useState<(Report & { resolvedStatus: ReportStatus })[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [auditLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [newMed, setNewMed] = useState<Omit<Medicine, 'id'>>({
    brand_name: '', generic_name: '', manufacturer: '',
    barcode_id: '', cdsco_approval_status: 'approved',
  });
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const notify = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getToken()}`,
  });

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setAuthError(null);
    try {
      const res = await fetch(`${API_BASE}/reports`, { headers: authHeaders() });
      if (res.status === 401) { setAuthError('Not authenticated — please sign in as an admin.'); return; }
      if (res.status === 403) { setAuthError('Access denied — admin or moderator role required.'); return; }
      const json = await res.json();
      setReports(json.reports ?? []);
    } catch {
      setAuthError('Cannot reach the API. Is the backend server running on port 4000?');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMedicines = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/medicines`, { headers: authHeaders() });
      if (res.ok) setMedicines(await res.json());
    } catch { /* silently fail, table will be empty */ }
  }, []);

  useEffect(() => {
    fetchReports();
    fetchMedicines();
  }, [fetchReports, fetchMedicines]);

  const handleReportAction = async (reportId: string, status: ReportStatus) => {
    setActing(reportId + status);
    try {
      const res = await fetch(`${API_BASE}/reports/${reportId}/status`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('API Request Failed');
      const target = reports.find(r => r.id === reportId);
      if (target) setResolved(prev => [...prev, { ...target, resolvedStatus: status }]);
      setReports(prev => prev.filter(r => r.id !== reportId));
      notify(status === 'verified_fake' ? '⚠️ Marked as Verified Fake' : '✅ Marked as False Alarm', status !== 'verified_fake');
    } catch {
      notify('❌ Failed to update report', false);
    } finally {
      setActing(null);
    }
  };

  const handleAddMedicine = async () => {
    if (!newMed.brand_name || !newMed.generic_name) return;
    try {
      const res = await fetch(`${API_BASE}/medicines`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(newMed),
      });
      if (!res.ok) throw new Error('API Request Failed');
      const created = await res.json();
      setMedicines(prev => [...prev, created]);
      setNewMed({ brand_name: '', generic_name: '', manufacturer: '', barcode_id: '', cdsco_approval_status: 'approved' });
      setShowForm(false);
      notify('✅ Medicine added');
    } catch {
      notify('❌ Failed to add medicine', false);
    }
  };

  const pendingCount = reports.length;
  const resolvedCount = resolved.length;
  const districtCount = new Set(reports.map(r => r.district).filter(Boolean)).size;

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-slate-200 flex flex-col p-5 gap-6 shrink-0">
        <div className="flex items-center gap-2 px-1">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xs">S</div>
          <span className="font-bold text-slate-800">SahiDawa <span className="text-blue-600">Admin</span></span>
        </div>
        <nav className="flex-1 flex flex-col gap-0.5">
          <NavItem icon={AlertTriangle} label="Reports"          active={tab === 'reports'}  onClick={() => setTab('reports')} />
          <NavItem icon={Database}      label="Medicine Master"  active={tab === 'medicine'} onClick={() => setTab('medicine')} />
          <NavItem icon={History}       label="Audit Logs"       active={tab === 'logs'}     onClick={() => setTab('logs')} />
        </nav>
        <p className="text-xs text-slate-400 px-1">SahiDawa Admin v1.0</p>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-h-0">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center shrink-0">
          <div>
            <h1 className="text-lg font-bold text-slate-900">Moderation Dashboard</h1>
            <p className="text-slate-400 text-xs">Manage community-reported counterfeit medicines</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search..."
                className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-full text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <button onClick={fetchReports} className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition" title="Refresh">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-6">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="Pending" value={pendingCount} icon={AlertTriangle} color="text-amber-500" bg="bg-amber-50" />
            <StatCard label="Resolved" value={resolvedCount} icon={CheckCircle} color="text-green-500" bg="bg-green-50" />
            <StatCard label="Districts Affected" value={districtCount} icon={ShieldAlert} color="text-purple-500" bg="bg-purple-50" />
          </div>

          {/* Reports Tab */}
          {tab === 'reports' && (
            <>
              <ReportsTable
                reports={reports}
                loading={loading}
                authError={authError}
                acting={acting}
                onAction={handleReportAction}
              />
              {resolved.length > 0 && (
                <ResolvedTable resolved={resolved} />
              )}
            </>
          )}

          {/* Medicine Master Tab */}
          {tab === 'medicine' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                <h2 className="font-semibold text-slate-800">Medicine Master</h2>
                <button
                  onClick={() => setShowForm(v => !v)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Medicine
                </button>
              </div>

              {showForm && (
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-100">
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    {(['brand_name', 'generic_name', 'manufacturer', 'barcode_id'] as const).map(field => (
                      <input
                        key={field}
                        placeholder={field.replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        value={newMed[field]}
                        onChange={e => setNewMed(p => ({ ...p, [field]: e.target.value }))}
                        className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    ))}
                    <select
                      value={newMed.cdsco_approval_status}
                      onChange={e => setNewMed(p => ({ ...p, cdsco_approval_status: e.target.value as MedicineStatus }))}
                      className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                    >
                      <option value="approved">Approved</option>
                      <option value="recalled">Recalled</option>
                      <option value="banned">Banned</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleAddMedicine} className="px-4 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition">Save</button>
                    <button onClick={() => setShowForm(false)} className="px-4 py-1.5 bg-slate-200 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-300 transition">Cancel</button>
                  </div>
                </div>
              )}

              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                    <th className="px-6 py-3">Brand</th>
                    <th className="px-6 py-3">Generic</th>
                    <th className="px-6 py-3">Manufacturer</th>
                    <th className="px-6 py-3">Barcode</th>
                    <th className="px-6 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {medicines.length === 0 && (
                    <tr><td colSpan={5} className="px-6 py-10 text-center text-slate-400 text-sm">No medicines found.</td></tr>
                  )}
                  {medicines.map(m => (
                    <tr key={m.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-3 font-medium text-slate-800 flex items-center gap-2">
                        <Pill className="w-3.5 h-3.5 text-blue-400" />{m.brand_name}
                      </td>
                      <td className="px-6 py-3 text-slate-600 text-sm">{m.generic_name}</td>
                      <td className="px-6 py-3 text-slate-500 text-sm">{m.manufacturer}</td>
                      <td className="px-6 py-3">
                        <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">{m.barcode_id || '—'}</span>
                      </td>
                      <td className="px-6 py-3">
                        <StatusBadge status={m.cdsco_approval_status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Audit Logs Tab */}
          {tab === 'logs' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="font-semibold text-slate-800">Audit Log</h2>
                <p className="text-slate-400 text-xs mt-0.5">Every administrative action is recorded here</p>
              </div>
              {auditLogs.length === 0 ? (
                <div className="py-16 text-center text-slate-400 text-sm">No audit entries yet.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {auditLogs.map(log => {
                    const isVerify = log.action.includes('VERIFIED_FAKE');
                    const isAlarm  = log.action.includes('FALSE_ALARM');
                    const isCreate = log.action.includes('CREATE');
                    const getIconBg = () => {
                      if (isVerify) return 'bg-red-50 text-red-500';
                      if (isAlarm) return 'bg-green-50 text-green-500';
                      if (isCreate) return 'bg-blue-50 text-blue-500';
                      return 'bg-slate-100 text-slate-400';
                    };
                    const getIcon = () => {
                      if (isCreate) return <Database className="w-4 h-4" />;
                      if (isVerify) return <XCircle className="w-4 h-4" />;
                      if (isAlarm) return <CheckCircle className="w-4 h-4" />;
                      return <FileText className="w-4 h-4" />;
                    };
                    return (
                      <div key={log.id} className="px-6 py-4 flex items-start gap-4 hover:bg-slate-50/60 transition-colors">
                        <div className={`mt-0.5 p-2 rounded-xl shrink-0 ${getIconBg()}`}>
                          {getIcon()}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-slate-800">{log.details}</p>
                          <p className="text-xs text-slate-400 font-mono mt-0.5">{log.target_type} · {log.target_id}</p>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-slate-400 shrink-0">
                          <Clock className="w-3 h-3" />{timeAgo(log.created_at)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {toast && (
        <div className={`fixed bottom-6 right-6 px-5 py-3 rounded-2xl shadow-xl text-sm font-medium text-white z-50 ${toast.ok ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function NavItem({ icon: Icon, label, active, onClick }: Readonly<{ icon: any; label: string; active: boolean; onClick: () => void }>) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${active ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
    >
      <Icon className={`w-4 h-4 ${active ? 'text-blue-600' : 'text-slate-400'}`} />
      {label}
    </button>
  );
}

function StatCard({ label, value, icon: Icon, color, bg }: Readonly<{ label: string; value: number; icon: any; color: string; bg: string }>) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <div className={`inline-flex p-2.5 rounded-xl ${bg} ${color} mb-3`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-slate-400 text-xs mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: Readonly<{ status: MedicineStatus }>) {
  const styles: Record<MedicineStatus, string> = {
    approved: 'bg-green-50 text-green-600',
    recalled:  'bg-amber-50 text-amber-600',
    banned:    'bg-red-50 text-red-600',
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${styles[status]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function ReportsTable({ reports, loading, authError, acting, onAction }: Readonly<{
  reports: Report[]; loading: boolean; authError: string | null;
  acting: string | null; onAction: (id: string, s: ReportStatus) => void;
}>) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
        <h2 className="font-semibold text-slate-800">Pending Reports</h2>
        <span className="text-xs text-slate-400">{reports.length} pending</span>
      </div>

      {authError && (
        <div className="mx-6 my-4 bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0" />{authError}
        </div>
      )}

      {loading && !authError && (
        <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading reports…
        </div>
      )}

      {!loading && !authError && reports.length === 0 && (
        <div className="py-16 text-center text-slate-400">
          <CheckCircle className="w-10 h-10 mx-auto mb-2 text-green-400" />
          <p className="text-sm">No pending reports</p>
        </div>
      )}

      {!loading && !authError && reports.length > 0 && (
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <th className="px-6 py-3">Medicine</th>
              <th className="px-6 py-3">District</th>
              <th className="px-6 py-3">Barcode</th>
              <th className="px-6 py-3">Reported</th>
              <th className="px-6 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {reports.map(r => (
              <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                <td className="px-6 py-3 font-medium text-slate-800">{r.reported_brand_name ?? r.medicines?.brand_name ?? '—'}</td>
                <td className="px-6 py-3 text-slate-600 text-sm">{r.district ?? '—'}</td>
                <td className="px-6 py-3"><span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">{r.scanned_barcode ?? 'N/A'}</span></td>
                <td className="px-6 py-3 text-slate-400 text-sm">{timeAgo(r.created_at)}</td>
                <td className="px-6 py-3">
                  <div className="flex gap-2">
                    <ActionBtn label="Mark Fake"   icon={XCircle}     color="red"   loading={acting === r.id + 'verified_fake'} disabled={!!acting?.startsWith(r.id)} onClick={() => onAction(r.id, 'verified_fake')} />
                    <ActionBtn label="False Alarm" icon={CheckCircle} color="green" loading={acting === r.id + 'false_alarm'}   disabled={!!acting?.startsWith(r.id)} onClick={() => onAction(r.id, 'false_alarm')} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ResolvedTable({ resolved }: Readonly<{ resolved: (Report & { resolvedStatus: ReportStatus })[] }>) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
        <h2 className="font-semibold text-slate-800">Resolved</h2>
        <span className="text-xs text-slate-400">{resolved.length} resolved</span>
      </div>
      <table className="w-full text-left">
        <thead>
          <tr className="bg-slate-50 text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <th className="px-6 py-3">Medicine</th>
            <th className="px-6 py-3">District</th>
            <th className="px-6 py-3">Decision</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {resolved.map(r => (
            <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
              <td className="px-6 py-3 text-slate-700 font-medium">{r.reported_brand_name ?? '—'}</td>
              <td className="px-6 py-3 text-slate-600 text-sm">{r.district ?? '—'}</td>
              <td className="px-6 py-3">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${r.resolvedStatus === 'verified_fake' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                  {r.resolvedStatus === 'verified_fake' ? <><XCircle className="w-3.5 h-3.5" /> Verified Fake</> : <><CheckCircle className="w-3.5 h-3.5" /> False Alarm</>}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActionBtn({ label, icon: Icon, color, loading, disabled, onClick }: Readonly<{
  label: string; icon: any; color: 'red' | 'green';
  loading: boolean; disabled: boolean; onClick: () => void;
}>) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 ${color === 'red' ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
      {label}
    </button>
  );
}
