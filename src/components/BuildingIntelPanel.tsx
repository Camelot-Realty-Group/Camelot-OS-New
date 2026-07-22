/**
 * BuildingIntelPanel — fills the Overview tab's left column (previously
 * white space below Building Details) with the intel a manager wants at
 * a glance: neighborhood market + leasing comps, recent ACRIS sales and
 * financing records, and a Local Law obligation radar derived from the
 * building's own attributes.
 */
import { Building } from '@/types';
import { detectNeighborhood, lookupNeighborhoodData } from '@/lib/camelot-report';
import { formatCurrency } from '@/lib/utils';
import { TrendingUp, Landmark, ScrollText } from 'lucide-react';

interface BuildingIntelPanelProps {
  building: Building;
  nycData: any;
}

function fmtDate(value?: string): string {
  if (!value) return '—';
  const d = new Date(value);
  return isNaN(d.getTime()) ? value.slice(0, 10) : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function BuildingIntelPanel({ building, nycData }: BuildingIntelPanelProps) {
  const hood = building.region || detectNeighborhood(building.address, building.borough || '');
  const market = lookupNeighborhoodData(hood);

  const acris = nycData?.acris;
  const recentDeeds = (acris?.deeds || []).filter((r: any) => r.amount > 10000).slice(0, 3);
  const recentMortgage = (acris?.mortgages || [])[0];

  const sqft = nycData?.dof?.buildingArea || 0;
  const stories = building.stories || nycData?.dof?.stories || 0;
  const energyScore = nycData?.energy?.energyStarScore ?? null;
  const facadeCount = nycData?.facade?.count || 0;
  const facadeIssues = nycData?.facade?.issueCount || 0;

  // Local Law radar — applicability derived from the building itself.
  const laws: Array<{ law: string; applies: boolean; status: string; tone: 'ok' | 'warn' | 'due' }> = [
    {
      law: 'LL97 — Carbon emissions',
      applies: sqft >= 25000,
      status: sqft >= 25000
        ? (energyScore !== null && energyScore < 50
            ? `Energy Star ${energyScore} — elevated 2030-limit risk; model penalties`
            : 'Applies (≥25k sqft) — stricter limits hit in 2030; verify emissions path')
        : 'Under 25k sqft — not covered',
      tone: sqft >= 25000 ? (energyScore !== null && energyScore < 50 ? 'due' : 'warn') : 'ok',
    },
    {
      law: 'LL11/FISP — Facade',
      applies: stories > 6,
      status: stories > 6
        ? (facadeIssues > 0
            ? `${facadeIssues} filing(s) show SWARMP/unsafe — remediation clock running`
            : facadeCount > 0
              ? `${facadeCount} filing(s) on record — confirm current sub-cycle due date`
              : 'Over 6 stories — filing required each cycle; no filing found, verify')
        : '6 stories or under — exempt',
      tone: stories > 6 ? (facadeIssues > 0 ? 'due' : 'warn') : 'ok',
    },
    {
      law: 'LL84/LL133 — Benchmarking',
      applies: sqft >= 25000,
      status: sqft >= 25000 ? 'Annual energy/water filing due May 1' : 'Under 25k sqft — not covered',
      tone: sqft >= 25000 ? 'warn' : 'ok',
    },
    {
      law: 'LL152 — Gas piping',
      applies: true,
      status: 'Inspection due every 4 years by community district — confirm district window',
      tone: 'warn',
    },
  ];

  const toneClass = { ok: 'bg-green-50 text-green-700', warn: 'bg-amber-50 text-amber-700', due: 'bg-red-50 text-red-700' };

  return (
    <div className="space-y-4 mt-6">
      {/* Neighborhood market + leasing comps */}
      <div>
        <h3 className="font-semibold text-sm text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <TrendingUp size={14} /> {hood || 'Neighborhood'} Market
        </h3>
        {market ? (
          <div className="bg-gray-50 rounded-xl p-3">
            <div className="grid grid-cols-2 gap-2 text-center">
              {[
                ['Condo $/SF', `$${market.condoPSF.toLocaleString()}`],
                ['Co-op $/SF', `$${market.coopPSF.toLocaleString()}`],
                ['Median 1BR', `$${market.median1BR.toLocaleString()}/mo`],
                ['Median 2BR', `$${market.median2BR.toLocaleString()}/mo`],
              ].map(([label, value]) => (
                <div key={label} className="bg-white rounded-lg p-2">
                  <div className="text-sm font-bold text-gray-900">{value}</div>
                  <div className="text-[10px] text-gray-500 uppercase">{label}</div>
                </div>
              ))}
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-2 px-1">
              <span>Days on market: <b className="text-gray-700">{market.daysOnMarket}</b></span>
              <span>Momentum: <b className="text-gray-700">{market.momentum}</b></span>
              <span>Opex: <b className="text-gray-700">{market.opexRange}</b></span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-400 bg-gray-50 rounded-xl p-3">
            No benchmark set for this neighborhood yet — comps are pulled into the full Jackie report.
          </p>
        )}
      </div>

      {/* Recent sales + financing (ACRIS public record) */}
      <div>
        <h3 className="font-semibold text-sm text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Landmark size={14} /> Sales & Financing (ACRIS)
        </h3>
        <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
          {acris?.lastSalePrice ? (
            <div className="flex justify-between text-xs py-1 border-b border-gray-200">
              <span className="text-gray-500">Last recorded sale</span>
              <span className="font-medium">{formatCurrency(acris.lastSalePrice)} · {fmtDate(acris.lastSaleDate)}</span>
            </div>
          ) : null}
          {recentDeeds.map((r: any) => (
            <div key={r.documentId} className="flex justify-between text-xs py-1 border-b border-gray-100 last:border-0">
              <span className="text-gray-500">{r.documentTypeLabel || 'Deed'} · {fmtDate(r.date)}</span>
              <span className="font-medium">{formatCurrency(r.amount)}</span>
            </div>
          ))}
          {recentMortgage ? (
            <div className="flex justify-between text-xs py-1">
              <span className="text-gray-500">Latest mortgage · {fmtDate(recentMortgage.date)}</span>
              <span className="font-medium">{recentMortgage.amount ? formatCurrency(recentMortgage.amount) : 'On record'}</span>
            </div>
          ) : null}
          {!acris?.lastSalePrice && recentDeeds.length === 0 && !recentMortgage && (
            <p className="text-xs text-gray-400">No ACRIS transfer/financing records loaded — refresh NYC data or open the Ownership tab.</p>
          )}
          <p className="text-[10px] text-gray-400 pt-1">
            Public record only. Rate environment and refinancing options reviewed with Camelot's lending partners at onboarding.
          </p>
        </div>
      </div>

      {/* Local Law radar */}
      <div>
        <h3 className="font-semibold text-sm text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <ScrollText size={14} /> Local Law Radar
        </h3>
        <div className="space-y-1.5">
          {laws.map((l) => (
            <div key={l.law} className={`rounded-lg px-3 py-2 text-xs ${toneClass[l.tone]}`}>
              <div className="font-semibold">{l.law}</div>
              <div className="opacity-90">{l.status}</div>
            </div>
          ))}
          <p className="text-[10px] text-gray-400">
            Derived from building records — informational, not legal advice; deadlines confirmed at onboarding.
          </p>
        </div>
      </div>
    </div>
  );
}
