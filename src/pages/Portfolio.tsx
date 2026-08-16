/**
 * Portfolio — Camelot's unified managed-building list.
 *
 * Single source of truth pulled live from Spire MDS (41 buildings as of the
 * 2026-08-15 verification) into Supabase, so Cost Optimization, Cost-Beat
 * reports, and proposals all read the same canonical portfolio instead of
 * hand-entered data.
 *
 * Backed by:
 *   supabase/migrations/018_portfolio_sync.sql
 *   src/api/portfolio-routes.mjs
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Building2, RefreshCw, Search, AlertCircle, CheckCircle2, Users,
  MapPin, TrendingDown, Database, Clock, DollarSign, Download,
} from 'lucide-react';
import { authenticatedApiFetch } from '../lib/api-auth';

interface PortfolioBuilding {
  id: number;
  mds_code: string | null;
  spire_building_rcd: number | null;
  spire_company_rcd: number | null;
  building_name: string | null;
  company_name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  building_type: string | null;
  units_residential: number | null;
  units_commercial: number | null;
  units_total: number | null;
  occupant_count: number | null;
  property_manager: string | null;
  property_manager_email: string | null;
  superintendent_name: string | null;
  realtymx_building_id: number | null;
  neighborhood: string | null;
  spire_synced_at: string | null;
  is_active: boolean | null;
  analysis_count: number | null;
  last_analysis_date: string | null;
  total_identified_savings: number | null;
}

interface PortfolioTotals {
  buildings: number;
  units: number;
  residential: number;
  commercial: number;
  analyzed: number;
  identifiedSavings: number;
}

interface SyncCounts {
  fetched: number;
  inserted: number;
  updated: number;
  unchanged: number;
  realtymxMatched: number;
  realtymxMatchKinds?: Record<string, number>;
}

interface MissingBuilding {
  mds_code: string | null;
  building: string | null;
  address: string | null;
}

interface UnitDiscrepancy {
  mds_code: string | null;
  building: string | null;
  address: string | null;
  spireUnits: number | null;
  realtyMxUnits: number | null;
  realtyMxId: number | null;
}

function fmtMoney(n?: number | null) {
  if (n === null || n === undefined) return '—';
  return `$${Math.round(n).toLocaleString()}`;
}

function fmtNum(n?: number | null) {
  if (n === null || n === undefined) return '—';
  return Number(n).toLocaleString();
}

function fmtDate(iso?: string | null) {
  if (!iso) return 'Never';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Never';
  return d.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export default function Portfolio() {
  const [buildings, setBuildings] = useState<PortfolioBuilding[]>([]);
  const [totals, setTotals] = useState<PortfolioTotals | null>(null);
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [migrationNeeded, setMigrationNeeded] = useState(false);
  const [notice, setNotice] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [missingFromRealtyMx, setMissingFromRealtyMx] = useState<MissingBuilding[]>([]);
  const [unitDiscrepancies, setUnitDiscrepancies] = useState<UnitDiscrepancy[]>([]);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'Rental' | 'Condo/Co-op' | 'Unknown'>('all');
  const [onlyUnanalyzed, setOnlyUnanalyzed] = useState(false);

  const loadPortfolio = useCallback(async () => {
    setLoading(true);
    setError('');
    setMigrationNeeded(false);
    try {
      const res = await authenticatedApiFetch('/api/portfolio');
      const body = await res.json();
      if (!res.ok) {
        if (body?.code === 'MIGRATION_REQUIRED') {
          setMigrationNeeded(true);
          setError(body.message || 'Portfolio schema not deployed.');
        } else {
          setError(body?.error || `Failed to load portfolio (HTTP ${res.status}).`);
        }
        setBuildings([]);
        setTotals(null);
        return;
      }
      setBuildings(body.buildings || []);
      setTotals(body.totals || null);
      setLastSynced(body.lastSynced || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load portfolio.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPortfolio(); }, [loadPortfolio]);

  async function handleSync() {
    setSyncing(true);
    setError('');
    setNotice('');
    setWarnings([]);
    try {
      const res = await authenticatedApiFetch('/api/portfolio/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enrichWithRealtyMx: true }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error || `Sync failed (HTTP ${res.status}).`);
        return;
      }
      const c: SyncCounts = body.counts || {};
      setNotice(
        `Synced ${c.fetched ?? 0} buildings from Spire — ${c.inserted ?? 0} new, ${c.updated ?? 0} updated.`
        + (c.realtymxMatched ? ` ${c.realtymxMatched} matched to RealtyMX.` : '')
      );
      setWarnings(body.warnings || []);
      setMissingFromRealtyMx(body.missingFromRealtyMx || []);
      setUnitDiscrepancies(body.unitDiscrepancies || []);
      await loadPortfolio();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed.');
    } finally {
      setSyncing(false);
    }
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return buildings.filter((b) => {
      if (typeFilter !== 'all' && b.building_type !== typeFilter) return false;
      if (onlyUnanalyzed && Number(b.analysis_count || 0) > 0) return false;
      if (!term) return true;
      return [b.building_name, b.address, b.mds_code, b.city, b.zip_code, b.property_manager, b.company_name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term));
    });
  }, [buildings, search, typeFilter, onlyUnanalyzed]);

  function exportCsv() {
    const headers = [
      'MDS Code', 'Building Name', 'Address', 'City', 'State', 'Zip', 'Type',
      'Residential Units', 'Commercial Units', 'Total Units',
      'Property Manager', 'PM Email', 'Superintendent',
      'Spire Building Rcd', 'Spire Company Rcd', 'Analyses Run', 'Identified Savings',
    ];
    const rows = filtered.map((b) => [
      b.mds_code, b.building_name, b.address, b.city, b.state, b.zip_code, b.building_type,
      b.units_residential, b.units_commercial, b.units_total,
      b.property_manager, b.property_manager_email, b.superintendent_name,
      b.spire_building_rcd, b.spire_company_rcd, b.analysis_count, b.total_identified_savings,
    ]);
    const esc = (v: unknown) => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headers, ...rows].map((r) => r.map(esc).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Camelot-Portfolio-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const missingCompanyRcd = useMemo(
    () => buildings.filter((b) => !b.spire_company_rcd).length,
    [buildings]
  );

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-camelot-gold" />
            Portfolio
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Every Camelot-managed building, pulled live from Spire MDS. One source of truth for
            cost analysis, reports, and proposals.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCsv}
            disabled={filtered.length === 0}
            className="px-3 py-2 text-sm rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40 flex items-center gap-2"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-4 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 flex items-center gap-2 font-medium"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing from Spire…' : 'Sync from Spire'}
          </button>
        </div>
      </div>

      {/* Alerts */}
      {migrationNeeded && (
        <div className="mb-4 p-4 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            <p className="font-semibold">Portfolio schema not deployed yet.</p>
            <p className="mt-1">
              Run <code className="px-1 py-0.5 bg-amber-100 rounded font-mono text-xs">
                supabase/migrations/018_portfolio_sync.sql
              </code> in the Supabase SQL editor, then reload this page.
            </p>
          </div>
        </div>
      )}

      {error && !migrationNeeded && (
        <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {notice && (
        <div className="mb-4 p-4 rounded-lg bg-emerald-50 border border-emerald-200 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-emerald-800">{notice}</p>
        </div>
      )}

      {warnings.map((w, i) => (
        <div key={i} className="mb-4 p-4 rounded-lg bg-slate-50 border border-slate-200 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-slate-700">{w}</p>
        </div>
      ))}

      {/* Unit-count conflicts — these silently corrupt per-unit benchmarks */}
      {unitDiscrepancies.length > 0 && (
        <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-amber-200 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-900">
                {unitDiscrepancies.length} unit-count conflict{unitDiscrepancies.length === 1 ? '' : 's'} between Spire and RealtyMX
              </p>
              <p className="text-xs text-amber-800 mt-0.5">
                Unit counts drive every cost-per-unit benchmark. Spire is stored as
                authoritative — verify these before using them in a client cost report.
              </p>
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-amber-100/60">
                <tr>
                  <th className="text-left px-4 py-2 font-semibold text-amber-900">Building</th>
                  <th className="text-left px-4 py-2 font-semibold text-amber-900">Address</th>
                  <th className="text-right px-4 py-2 font-semibold text-amber-900">Spire</th>
                  <th className="text-right px-4 py-2 font-semibold text-amber-900">RealtyMX</th>
                  <th className="text-right px-4 py-2 font-semibold text-amber-900">Δ</th>
                </tr>
              </thead>
              <tbody>
                {unitDiscrepancies.map((d, i) => {
                  const delta = (d.realtyMxUnits ?? 0) - (d.spireUnits ?? 0);
                  return (
                    <tr key={i} className="border-t border-amber-200/60">
                      <td className="px-4 py-2 text-amber-900">{d.building || '—'}</td>
                      <td className="px-4 py-2 text-amber-800">{d.address || '—'}</td>
                      <td className="px-4 py-2 text-right font-semibold text-amber-900">{fmtNum(d.spireUnits)}</td>
                      <td className="px-4 py-2 text-right text-amber-800">{fmtNum(d.realtyMxUnits)}</td>
                      <td className={`px-4 py-2 text-right font-semibold ${Math.abs(delta) > 10 ? 'text-red-700' : 'text-amber-700'}`}>
                        {delta > 0 ? `+${delta}` : delta}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Buildings absent from RealtyMX — the list to hand RealtyMX for import */}
      {missingFromRealtyMx.length > 0 && (
        <div className="mb-4 p-4 rounded-lg bg-sky-50 border border-sky-200">
          <div className="flex items-start gap-2">
            <Database className="w-5 h-5 text-sky-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-sky-900">
                {missingFromRealtyMx.length} building{missingFromRealtyMx.length === 1 ? '' : 's'} in Spire with no RealtyMX record
              </p>
              <p className="text-xs text-sky-800 mt-0.5 mb-2">
                RealtyMX's API is read-only for buildings, so these can't be pushed
                automatically — send this list to RealtyMX for import.
              </p>
              <ul className="text-xs text-sky-900 space-y-1">
                {missingFromRealtyMx.map((m, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="font-mono text-sky-600">{m.mds_code || '—'}</span>
                    <span className="font-medium">{m.building || '—'}</span>
                    <span className="text-sky-700">· {m.address || 'no address in Spire'}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
            <Building2 className="w-3 h-3" /> Buildings
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{loading ? '…' : fmtNum(totals?.buildings)}</p>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
            <Users className="w-3 h-3" /> Total Units
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{loading ? '…' : fmtNum(totals?.units)}</p>
          <p className="text-[10px] text-slate-500 mt-1">
            {fmtNum(totals?.residential)} res · {fmtNum(totals?.commercial)} comm
          </p>
        </div>
        <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide flex items-center gap-1">
            <TrendingDown className="w-3 h-3" /> Cost-Analyzed
          </p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">
            {loading ? '…' : `${totals?.analyzed ?? 0} / ${totals?.buildings ?? 0}`}
          </p>
          <p className="text-[10px] text-emerald-600 mt-1">
            {loading ? '' : `${(totals?.buildings ?? 0) - (totals?.analyzed ?? 0)} not yet analyzed`}
          </p>
        </div>
        <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide flex items-center gap-1">
            <DollarSign className="w-3 h-3" /> Savings Identified
          </p>
          <p className="text-2xl font-bold text-blue-700 mt-1">
            {loading ? '…' : fmtMoney(totals?.identifiedSavings)}
          </p>
        </div>
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
            <Clock className="w-3 h-3" /> Last Spire Sync
          </p>
          <p className="text-sm font-bold text-slate-800 mt-2">{loading ? '…' : fmtDate(lastSynced)}</p>
        </div>
      </div>

      {/* Data-quality callout: buildings with no CompanyRcd can't have financials pulled */}
      {!loading && missingCompanyRcd > 0 && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-900">
            <span className="font-semibold">{missingCompanyRcd} building{missingCompanyRcd === 1 ? '' : 's'}</span>{' '}
            have no Spire CompanyRcd. Spire keys budgets and GL actuals by company, so no financial
            data (and therefore no cost-savings analysis) can be pulled for these until they're
            linked to a company record in Spire.
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, address, MDS code, manager…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-camelot-gold/40"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
          className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
        >
          <option value="all">All types</option>
          <option value="Rental">Rental</option>
          <option value="Condo/Co-op">Condo / Co-op</option>
          <option value="Unknown">Unknown</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={onlyUnanalyzed}
            onChange={(e) => setOnlyUnanalyzed(e.target.checked)}
            className="rounded border-slate-300"
          />
          Only never-analyzed
        </label>
        <span className="text-xs text-slate-500 ml-auto">
          Showing {filtered.length} of {buildings.length}
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">MDS</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Building</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Address</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Type</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Units</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Manager</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Cost Analysis</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">Loading portfolio…</td></tr>
              )}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <Database className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                    {buildings.length === 0 ? (
                      <>
                        <p className="text-slate-700 font-medium">No buildings synced yet.</p>
                        <p className="text-sm text-slate-500 mt-1">
                          Click <span className="font-semibold">Sync from Spire</span> to pull the
                          Camelot portfolio.
                        </p>
                      </>
                    ) : (
                      <p className="text-slate-500">No buildings match these filters.</p>
                    )}
                  </td>
                </tr>
              )}

              {!loading && filtered.map((b) => {
                const analyzed = Number(b.analysis_count || 0) > 0;
                return (
                  <tr key={b.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{b.mds_code || '—'}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{b.building_name || '—'}</p>
                      {b.company_name && b.company_name !== b.building_name && (
                        <p className="text-xs text-slate-500">{b.company_name}</p>
                      )}
                      {!b.spire_company_rcd && (
                        <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-medium">
                          No CompanyRcd — financials unavailable
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <span className="flex items-start gap-1">
                        <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0 mt-1" />
                        <span>
                          {b.address || '—'}
                          {(b.city || b.zip_code) && (
                            <span className="block text-xs text-slate-500">
                              {[b.city, b.state, b.zip_code].filter(Boolean).join(', ')}
                            </span>
                          )}
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        b.building_type === 'Condo/Co-op'
                          ? 'bg-indigo-50 text-indigo-700'
                          : b.building_type === 'Rental'
                            ? 'bg-sky-50 text-sky-700'
                            : 'bg-slate-100 text-slate-600'
                      }`}>
                        {b.building_type || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold text-slate-900">{fmtNum(b.units_total)}</span>
                      {(b.units_commercial ?? 0) > 0 && (
                        <span className="block text-[10px] text-slate-500">
                          {fmtNum(b.units_residential)} res + {fmtNum(b.units_commercial)} comm
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {b.property_manager || <span className="text-slate-400">—</span>}
                      {b.property_manager_email && (
                        <span className="block text-xs text-slate-500">{b.property_manager_email}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {analyzed ? (
                        <span className="inline-flex flex-col items-center">
                          <span className="text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 font-medium">
                            {b.analysis_count} run{Number(b.analysis_count) === 1 ? '' : 's'}
                          </span>
                          {Number(b.total_identified_savings || 0) > 0 && (
                            <span className="text-[10px] text-emerald-600 mt-1">
                              {fmtMoney(b.total_identified_savings)} found
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-500">
                          Not analyzed
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11px] text-slate-400 mt-4">
        Source: Spire MDS (<span className="font-mono">RM/BuildingsList</span>). Financial data comes
        exclusively from Spire — RealtyMX supplies market/listing context only and never expense data.
      </p>
    </div>
  );
}
