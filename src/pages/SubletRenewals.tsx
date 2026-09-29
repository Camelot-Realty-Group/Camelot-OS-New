/**
 * Sublet Renewals — co-op/condo sublet leases expiring soon across the
 * Camelot-managed portfolio, pulled from Spire MDS.
 *
 * Two revenue paths per row:
 *   1. Owner renews → Camelot files the renewal in MDS and bills the owner the
 *      renewal filing fee (default $150).
 *   2. Owner not renewing → Camelot Brokerage finds the next subtenant.
 *
 * Backed by src/api/sublet-renewal-routes.mjs + migration 028_sublet_renewals.sql.
 * Access: Supabase session or the Camelot ops key (stored in this browser only).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarClock, RefreshCw, Download, Search, AlertCircle, Mail, KeyRound, DollarSign,
  Briefcase, Building2, Loader2, Send, X, CheckCircle2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { authenticatedApiFetch } from '../lib/api-auth';

interface Renewal {
  id: number;
  building_name: string | null;
  building_address: string | null;
  building_number: string | null;
  spire_building_rcd: number | null;
  unit_number: string | null;
  bedrooms: number | null;
  owner_name: string | null;
  owner_email: string | null;
  owner_phone: string | null;
  owner_mailing_address: string | null;
  subtenant_name: string | null;
  subtenant_email: string | null;
  subtenant_phone: string | null;
  lease_start_date: string | null;
  lease_end_date: string | null;
  days_to_expiry: number | null;
  urgency: string | null;
  recorded_rent: number | null;
  sublease_rent: number | null;
  detection_confidence: 'confirmed' | 'likely' | null;
  detection_signals: string[] | null;
  status: string;
  fee_amount: number;
  fee_status: string;
  assigned_to: string | null;
  notes: string | null;
  next_follow_up: string | null;
  owner_notified_at: string | null;
  still_in_mds: boolean | null;
  property_manager: string | null;
}

interface Summary {
  byUrgency: Record<string, number>;
  byStatus: Record<string, number>;
  revenue: { feesPotential: number; feesBilled: number; feesPaid: number; brokerageUpside: number; count: number };
}

const STATUS_LABELS: Record<string, string> = {
  identified: 'Identified',
  owner_notified: 'Owner notified',
  renewal_received: 'Renewal received',
  filed: 'Filed in MDS',
  fee_billed: 'Fee billed',
  closed_renewed: 'Closed — renewed',
  not_renewing: 'Not renewing',
  brokerage_opportunity: 'Brokerage opportunity',
  brokerage_listed: 'Brokerage — listed',
  brokerage_leased: 'Brokerage — leased',
  no_response: 'No response',
  dismissed: 'Dismissed (not a sublet)',
};
const FEE_LABELS: Record<string, string> = { not_billed: 'Not billed', billed: 'Billed', paid: 'Paid', waived: 'Waived' };

const WINDOWS = [
  { label: '60–90 days', min: 60, max: 90 },
  { label: '30–59 days', min: 30, max: 59 },
  { label: 'Under 30 days', min: 0, max: 29 },
  { label: 'Expired (last 30)', min: -30, max: -1 },
  { label: '91–120 days', min: 91, max: 120 },
  { label: 'All (−30 to 120)', min: -30, max: 120 },
];

const URGENCY_STYLE: Record<string, string> = {
  expired: 'bg-red-100 text-red-800',
  critical: 'bg-red-50 text-red-700',
  urgent: 'bg-amber-100 text-amber-800',
  notice_window: 'bg-emerald-50 text-emerald-800',
  upcoming: 'bg-slate-100 text-slate-700',
};

const OPS_KEY_STORAGE = 'camelot.opsKey';

function money(n?: number | null) {
  if (n === null || n === undefined) return '—';
  return `$${Math.round(Number(n)).toLocaleString()}`;
}
function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${m}/${d}/${y}`;
}

export default function SubletRenewals() {
  const [items, setItems] = useState<Renewal[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [fee, setFee] = useState(150);
  const [lastScan, setLastScan] = useState<{ created_at: string; sublets_found: number; buildings_scanned: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [needsKey, setNeedsKey] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [windowIdx, setWindowIdx] = useState(0);
  const [status, setStatus] = useState('open');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Renewal | null>(null);
  const [notice, setNotice] = useState<{ subject: string; text: string; to: string } | null>(null);
  const [sending, setSending] = useState(false);

  const api = useCallback(async (path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers || {});
    const key = localStorage.getItem(OPS_KEY_STORAGE);
    if (key) headers.set('X-Camelot-Ops-Key', key);
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    const res = await authenticatedApiFetch(path, { ...init, headers });
    if (res.status === 401 || res.status === 503) {
      const body = await res.json().catch(() => ({}));
      if (['OPS_KEY_REQUIRED', 'OPS_KEY_INVALID', 'OPS_KEY_NOT_CONFIGURED'].includes(body.code)) {
        setNeedsKey(true);
        throw new Error(body.error || 'Access key required');
      }
      throw new Error(body.error || `Request failed (${res.status})`);
    }
    return res;
  }, []);

  const params = useMemo(() => {
    const w = WINDOWS[windowIdx];
    const p = new URLSearchParams({ minDays: String(w.min), maxDays: String(w.max), status });
    if (query.trim()) p.set('q', query.trim());
    return p.toString();
  }, [windowIdx, status, query]);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [listRes, sumRes] = await Promise.all([
        api(`/api/renewals/sublets?${params}`),
        api('/api/renewals/sublets/summary'),
      ]);
      const list = await listRes.json();
      if (!listRes.ok) throw new Error(list.error || 'Failed to load renewals');
      setItems(list.items || []);
      setFee(list.fee ?? 150);
      setLastScan(list.lastScan);
      setSummary(await sumRes.json());
      setNeedsKey(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [api, params]);

  useEffect(() => { void load(); }, [load]);

  const runScan = async () => {
    setScanning(true);
    try {
      const res = await api('/api/renewals/sublets/scan', { method: 'POST' });
      const body = await res.json();
      if (!res.ok || body.status === 'error') throw new Error(body.error || 'Scan failed');
      toast.success(`Scanned ${body.buildingsScanned} buildings — ${body.subletsFound} sublets (${body.inserted} new)`);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setScanning(false);
    }
  };

  const sendDigest = async () => {
    try {
      const res = await api('/api/renewals/sublets/digest', { method: 'POST' });
      const body = await res.json();
      if (body.status === 'sent') toast.success(`Digest sent to ${body.to.join(', ')}`);
      else toast.error(body.error || body.reason || 'Digest not sent');
    } catch (e) { toast.error((e as Error).message); }
  };

  const exportCsv = async () => {
    try {
      const res = await api(`/api/renewals/sublets/export.csv?${params}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `Camelot_Sublet_Renewals_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { toast.error((e as Error).message); }
  };

  const update = async (id: number, patch: Partial<Renewal>) => {
    try {
      const res = await api(`/api/renewals/sublets/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Update failed');
      setItems((prev) => prev.map((r) => (r.id === id ? body.item : r)));
      if (selected?.id === id) setSelected(body.item);
    } catch (e) { toast.error((e as Error).message); }
  };

  const previewNotice = async (r: Renewal) => {
    try {
      const res = await api(`/api/renewals/sublets/${r.id}/owner-notice`, { method: 'POST', body: JSON.stringify({}) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Could not build notice');
      setNotice({ subject: body.subject, text: body.text, to: body.to || '' });
    } catch (e) { toast.error((e as Error).message); }
  };

  const sendNotice = async () => {
    if (!selected || !notice) return;
    setSending(true);
    try {
      const res = await api(`/api/renewals/sublets/${selected.id}/owner-notice`, { method: 'POST', body: JSON.stringify({ send: true, to: notice.to }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Send failed');
      toast.success(`Renewal notice sent to ${body.to}`);
      setNotice(null);
      await load();
    } catch (e) { toast.error((e as Error).message); } finally { setSending(false); }
  };

  const saveKey = () => {
    if (!keyInput.trim()) return;
    localStorage.setItem(OPS_KEY_STORAGE, keyInput.trim());
    setKeyInput('');
    void load();
  };

  const rev = summary?.revenue;

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <CalendarClock className="w-6 h-6 text-camelot-gold" /> Sublet Renewals
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-3xl">
            Co-op and condo sublet leases expiring across Camelot-managed buildings, pulled from Spire MDS.
            Owners handle the renewal paperwork; Camelot files it and bills a {money(fee)} renewal fee. Owners who
            aren't renewing are brokerage opportunities.
          </p>
          {lastScan && (
            <p className="text-xs text-slate-500 mt-1">
              Last scan {new Date(lastScan.created_at).toLocaleString()} — {lastScan.buildings_scanned} buildings, {lastScan.sublets_found} sublets tracked
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={exportCsv} className="px-3 py-2 text-sm rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 flex items-center gap-2">
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button onClick={sendDigest} className="px-3 py-2 text-sm rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 flex items-center gap-2">
            <Mail className="w-4 h-4" /> Email team digest
          </button>
          <button onClick={runScan} disabled={scanning} className="px-4 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 flex items-center gap-2 font-medium">
            {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Scan MDS now
          </button>
        </div>
      </div>

      {needsKey && (
        <div className="mb-4 p-4 rounded-lg bg-amber-50 border border-amber-200 flex flex-wrap items-center gap-3">
          <KeyRound className="w-5 h-5 text-amber-700" />
          <p className="text-sm text-amber-900 flex-1 min-w-[240px]">
            This page shows subtenant contact details, so it's locked. Enter the Camelot ops key (saved in this browser only).
          </p>
          <input type="password" value={keyInput} onChange={(e) => setKeyInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveKey()}
            placeholder="Ops key" className="px-3 py-2 text-sm border border-amber-300 rounded-lg" />
          <button onClick={saveKey} className="px-3 py-2 text-sm rounded-lg bg-amber-600 text-white">Unlock</button>
        </div>
      )}

      {error && !needsKey && (
        <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <Kpi icon={<CalendarClock className="w-4 h-4" />} label="In 60–90 day window" value={String(summary?.byUrgency?.notice_window ?? 0)} />
        <Kpi icon={<AlertCircle className="w-4 h-4" />} label="Under 60 days / expired" value={String((summary?.byUrgency?.urgent ?? 0) + (summary?.byUrgency?.critical ?? 0) + (summary?.byUrgency?.expired ?? 0))} />
        <Kpi icon={<DollarSign className="w-4 h-4" />} label="Renewal fees in pipeline" value={money(rev?.feesPotential)} />
        <Kpi icon={<CheckCircle2 className="w-4 h-4" />} label="Fees billed / paid" value={`${money(rev?.feesBilled)} / ${money(rev?.feesPaid)}`} />
        <Kpi icon={<Briefcase className="w-4 h-4" />} label="Brokerage upside (1 mo. rent)" value={money(rev?.brokerageUpside)} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {WINDOWS.map((w, i) => (
          <button key={w.label} onClick={() => setWindowIdx(i)}
            className={`px-3 py-1.5 text-xs rounded-full border ${i === windowIdx ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}>
            {w.label}
          </button>
        ))}
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="ml-2 px-3 py-1.5 text-xs border border-slate-300 rounded-lg">
          <option value="open">All open</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <div className="relative ml-auto">
          <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Building, apt, owner, subtenant"
            className="pl-8 pr-3 py-1.5 text-sm border border-slate-300 rounded-lg w-72" />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-3 py-2">Building</th>
              <th className="text-left px-3 py-2">Apt</th>
              <th className="text-left px-3 py-2">Subtenant</th>
              <th className="text-left px-3 py-2">Owner</th>
              <th className="text-right px-3 py-2">Rent</th>
              <th className="text-left px-3 py-2">Lease</th>
              <th className="text-right px-3 py-2">Days</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Fee</th>
              <th className="text-left px-3 py-2">Assigned</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={10} className="px-3 py-8 text-center text-slate-500"><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Loading…</td></tr>
            )}
            {!loading && items.length === 0 && (
              <tr><td colSpan={10} className="px-3 py-8 text-center text-slate-500">No sublet renewals in this window. Run a scan to refresh from MDS.</td></tr>
            )}
            {!loading && items.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => { setSelected(r); setNotice(null); }}>
                <td className="px-3 py-2">
                  <div className="font-medium text-slate-900 flex items-center gap-1"><Building2 className="w-3.5 h-3.5 text-slate-400" />{r.building_name || r.building_address}</div>
                  <div className="text-xs text-slate-500">{r.building_address}</div>
                </td>
                <td className="px-3 py-2 font-medium">{r.unit_number}</td>
                <td className="px-3 py-2">
                  {r.subtenant_name || <span className="text-amber-700 text-xs">verify in MDS</span>}
                  {r.detection_confidence === 'likely' && <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">verify</span>}
                  <div className="text-xs text-slate-500">{r.subtenant_phone || r.subtenant_email}</div>
                </td>
                <td className="px-3 py-2">{r.owner_name || '—'}<div className="text-xs text-slate-500">{r.owner_email}</div></td>
                <td className="px-3 py-2 text-right">{money(r.sublease_rent ?? r.recorded_rent)}</td>
                <td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.lease_start_date)} – {fmtDate(r.lease_end_date)}</td>
                <td className="px-3 py-2 text-right">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${URGENCY_STYLE[r.urgency || ''] || 'bg-slate-100'}`}>{r.days_to_expiry ?? '—'}</span>
                </td>
                <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                  <select value={r.status} onChange={(e) => update(r.id, { status: e.target.value })} className="text-xs border border-slate-200 rounded px-1 py-1">
                    {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                  <select value={r.fee_status} onChange={(e) => update(r.id, { fee_status: e.target.value })} className="text-xs border border-slate-200 rounded px-1 py-1">
                    {Object.entries(FEE_LABELS).map(([k, v]) => <option key={k} value={k}>{v} {money(r.fee_amount)}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2 text-xs">{r.assigned_to || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail drawer */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={() => setSelected(null)}>
          <div className="w-full max-w-xl h-full overflow-y-auto bg-white shadow-xl p-6 pt-14" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{selected.building_name || selected.building_address} — Apt {selected.unit_number}</h2>
                <p className="text-xs text-slate-500">{selected.building_address} · MDS #{selected.building_number} · PM {selected.property_manager || '—'}</p>
              </div>
              <button onClick={() => setSelected(null)}><X className="w-5 h-5 text-slate-500" /></button>
            </div>

            <Section title="Subtenant">
              <Field label="Name" value={selected.subtenant_name} />
              <Field label="Email" value={selected.subtenant_email} />
              <Field label="Phone" value={selected.subtenant_phone} />
            </Section>
            <Section title="Owner">
              <Field label="Name" value={selected.owner_name} />
              <Field label="Email" value={selected.owner_email} />
              <Field label="Phone" value={selected.owner_phone} />
              <Field label="Mailing address" value={selected.owner_mailing_address} />
            </Section>
            <Section title="Lease">
              <Field label="Start" value={fmtDate(selected.lease_start_date)} />
              <Field label="End" value={`${fmtDate(selected.lease_end_date)} (${selected.days_to_expiry ?? '—'} days)`} />
              <Field label="MDS base rent" value={money(selected.recorded_rent)} />
              <label className="block text-xs text-slate-500 mt-2">Confirmed sublease rent</label>
              <input type="number" defaultValue={selected.sublease_rent ?? ''} onBlur={(e) => update(selected.id, { sublease_rent: e.target.value === '' ? null : Number(e.target.value) })}
                className="w-40 px-2 py-1 text-sm border border-slate-300 rounded" />
            </Section>
            <Section title="Workflow">
              <label className="block text-xs text-slate-500">Assigned to</label>
              <input defaultValue={selected.assigned_to ?? ''} onBlur={(e) => update(selected.id, { assigned_to: e.target.value })} className="w-full px-2 py-1 text-sm border border-slate-300 rounded mb-2" />
              <label className="block text-xs text-slate-500">Next follow-up</label>
              <input type="date" defaultValue={selected.next_follow_up ?? ''} onChange={(e) => update(selected.id, { next_follow_up: e.target.value || null })} className="px-2 py-1 text-sm border border-slate-300 rounded mb-2" />
              <label className="block text-xs text-slate-500">Notes</label>
              <textarea defaultValue={selected.notes ?? ''} onBlur={(e) => update(selected.id, { notes: e.target.value })} rows={3} className="w-full px-2 py-1 text-sm border border-slate-300 rounded" />
              {selected.owner_notified_at && <p className="text-xs text-emerald-700 mt-1">Owner notified {new Date(selected.owner_notified_at).toLocaleDateString()}</p>}
              <div className="flex flex-wrap gap-2 mt-3">
                <button onClick={() => previewNotice(selected)} className="px-3 py-2 text-sm rounded-lg bg-slate-900 text-white flex items-center gap-2"><Mail className="w-4 h-4" /> Owner renewal notice</button>
                <button onClick={() => update(selected.id, { status: 'brokerage_opportunity' })} className="px-3 py-2 text-sm rounded-lg border border-slate-300 flex items-center gap-2"><Briefcase className="w-4 h-4" /> Flag for brokerage</button>
                <button onClick={() => update(selected.id, { status: 'dismissed' })} className="px-3 py-2 text-sm rounded-lg border border-slate-300 text-slate-600">Not a sublet</button>
              </div>
            </Section>

            {notice && (
              <Section title="Review before sending">
                <label className="block text-xs text-slate-500">To</label>
                <input value={notice.to} onChange={(e) => setNotice({ ...notice, to: e.target.value })} className="w-full px-2 py-1 text-sm border border-slate-300 rounded mb-2" />
                <p className="text-sm font-medium mb-1">{notice.subject}</p>
                <pre className="whitespace-pre-wrap text-xs bg-slate-50 border border-slate-200 rounded p-3 font-sans">{notice.text}</pre>
                <button onClick={sendNotice} disabled={sending || !notice.to} className="mt-2 px-3 py-2 text-sm rounded-lg bg-emerald-600 text-white disabled:opacity-60 flex items-center gap-2">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send to owner
                </button>
              </Section>
            )}

            {selected.detection_signals?.length ? (
              <p className="text-[11px] text-slate-400 mt-4">Detected by: {selected.detection_signals.join('; ')}</p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-xs text-slate-500 flex items-center gap-1.5">{icon}{label}</div>
      <div className="text-xl font-bold text-slate-900 mt-1">{value}</div>
    </div>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 pb-4 border-b border-slate-100">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-camelot-gold mb-2">{title}</h3>
      {children}
    </div>
  );
}
function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex text-sm py-0.5"><span className="w-32 text-slate-500">{label}</span><span className="text-slate-900">{value || '—'}</span></div>
  );
}
