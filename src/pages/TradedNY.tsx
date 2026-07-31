/**
 * TradedNY.tsx — dedicated Traded NY deal-flow tracker.
 *
 * David (July 31 2026): TradedNY had a database behind it but no face on the
 * site. This page is the face. It tracks sales, dispositions, 1031 exchanges,
 * and foreign-investor acquisitions of rental/multifamily property surfaced
 * on the Traded NY feed — every closed deal is a new owner who needs a
 * manager, and every new owner is a Camelot pitch.
 *
 * Phase 1: manual/paste tracking with lead scoring + report handoff.
 * Phase 2 (roadmap): automated feed ingestion from traded.co.
 */
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowUpRight, Crown, Newspaper, Plus, Target, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { scoreLead } from '@/lib/marketing-engine';

interface TradedDeal {
  id: string;
  address: string;
  borough: string;
  dealType: string;
  price: string;
  units: number;
  buyer: string;
  broker: string;
  sourceUrl: string;
  notes: string;
  score: number;
  createdAt: string;
}

const STORAGE_KEY = 'camelot_tradedny_deals_v1';
const BOROUGHS = ['Manhattan', 'Brooklyn', 'Queens', 'The Bronx', 'Staten Island', 'Westchester', 'Long Island', 'New Jersey', 'Connecticut'];
const DEAL_TYPES = ['Sold', 'In Contract', 'Loan / Refi', '1031 Exchange', 'Foreign Buyer', 'Receivership / Distress', 'New Development'];

function loadDeals(): TradedDeal[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}

export default function TradedNY() {
  const [deals, setDeals] = useState<TradedDeal[]>(() => loadDeals());
  const [form, setForm] = useState({ address: '', borough: 'Manhattan', dealType: 'Sold', price: '', units: '', buyer: '', broker: '', sourceUrl: '', notes: '' });

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(deals)); }, [deals]);

  const stats = useMemo(() => ({
    total: deals.length,
    hot: deals.filter(d => d.score >= 60).length,
    withContact: deals.filter(d => d.buyer.trim()).length,
  }), [deals]);

  const addDeal = () => {
    if (!form.address.trim()) { toast.error('Property address required'); return; }
    const units = parseInt(form.units, 10) || 0;
    const { score } = scoreLead({
      hasComplianceTrigger: /receivership|distress/i.test(form.dealType),
      hasDecisionMakerContact: !!form.buyer.trim(),
      unitCount: units,
      inCoverageArea: true,
      serviceFit: units >= 5,
      hasTimingSignal: /sold|contract|1031|foreign/i.test(form.dealType),
      hasReferralOrRelationship: !!form.broker.trim(),
    });
    const deal: TradedDeal = {
      id: crypto.randomUUID(),
      address: form.address.trim(),
      borough: form.borough,
      dealType: form.dealType,
      price: form.price.trim(),
      units,
      buyer: form.buyer.trim(),
      broker: form.broker.trim(),
      sourceUrl: form.sourceUrl.trim(),
      notes: form.notes.trim(),
      score,
      createdAt: new Date().toISOString(),
    };
    setDeals(prev => [deal, ...prev]);
    setForm({ address: '', borough: form.borough, dealType: form.dealType, price: '', units: '', buyer: '', broker: '', sourceUrl: '', notes: '' });
    toast.success(`Tracked — lead score ${score}/100`);
    if (isSupabaseConfigured()) {
      void supabase.from('content_leads').insert({
        building_address: deal.address,
        borough: deal.borough,
        unit_count: deal.units || null,
        trigger_event: `Traded NY: ${deal.dealType}${deal.price ? ` @ ${deal.price}` : ''}`,
        lead_score: deal.score,
        contact_name: deal.buyer || null,
        contact_source: deal.sourceUrl || 'Traded NY (manual)',
        status: deal.score >= 60 ? 'qualified' : 'new',
      }).then(() => undefined, () => undefined);
    }
  };

  const removeDeal = (id: string) => setDeals(prev => prev.filter(d => d.id !== id));

  return (
    <div className="min-h-screen bg-[#F7F4ED]">
      <div className="bg-white border-b border-slate-200 px-8 py-7">
        <div className="flex items-center gap-3">
          <span className="w-12 h-12 rounded-2xl bg-camelot-gold/15 text-camelot-gold flex items-center justify-center">
            <Newspaper size={24} />
          </span>
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-camelot-gold font-bold">Scout — Deal Flow</div>
            <h1 className="font-heading text-3xl text-slate-950">Traded NY</h1>
          </div>
        </div>
        <p className="text-slate-600 mt-4 max-w-4xl leading-relaxed">
          Every building that trades needs a manager — and the new owner hasn&rsquo;t signed with one yet.
          Track sales, dispositions, 1031 exchanges, and foreign-investor acquisitions from the
          {' '}<a href="https://traded.co/new-york/" target="_blank" rel="noopener" className="text-camelot-gold font-semibold underline">Traded NY feed</a>{' '}
          here: each deal gets a lead score, lands in the database as a qualified lead, and hands off to the
          report packager with one click. Automated feed ingestion is the next phase — today, paste deals as you spot them.
        </p>
      </div>

      <main className="px-8 py-8 space-y-6">
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: 'Deals Tracked', value: stats.total, note: 'From the Traded NY feed' },
            { label: 'Hot Leads (60+)', value: stats.hot, note: 'Scored on the weighted model' },
            { label: 'With Buyer Contact', value: stats.withContact, note: 'Ready for outreach' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <div className="text-3xl font-bold text-camelot-gold">{s.value}</div>
              <div className="text-sm font-bold text-slate-900 mt-1">{s.label}</div>
              <div className="text-xs text-slate-500">{s.note}</div>
            </div>
          ))}
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-950 mb-1 flex items-center gap-2"><Plus size={18} className="text-camelot-gold" /> Track a Traded Deal</h2>
          <p className="text-xs text-slate-500 mb-4">Paste the deal from traded.co — address is the only required field.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Property address *" className="border rounded-lg px-3 py-2 text-sm md:col-span-2" />
            <select value={form.borough} onChange={e => setForm(f => ({ ...f, borough: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm">
              {BOROUGHS.map(b => <option key={b}>{b}</option>)}
            </select>
            <select value={form.dealType} onChange={e => setForm(f => ({ ...f, dealType: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm">
              {DEAL_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
            <input value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="Price (e.g., $14.5M)" className="border rounded-lg px-3 py-2 text-sm" />
            <input value={form.units} onChange={e => setForm(f => ({ ...f, units: e.target.value }))} placeholder="Units" className="border rounded-lg px-3 py-2 text-sm" />
            <input value={form.buyer} onChange={e => setForm(f => ({ ...f, buyer: e.target.value }))} placeholder="Buyer / new owner" className="border rounded-lg px-3 py-2 text-sm" />
            <input value={form.broker} onChange={e => setForm(f => ({ ...f, broker: e.target.value }))} placeholder="Broker (relationship = +10 score)" className="border rounded-lg px-3 py-2 text-sm" />
            <input value={form.sourceUrl} onChange={e => setForm(f => ({ ...f, sourceUrl: e.target.value }))} placeholder="Traded NY link" className="border rounded-lg px-3 py-2 text-sm" />
            <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes (1031, foreign buyer, distress...)" className="border rounded-lg px-3 py-2 text-sm md:col-span-2" />
            <button onClick={addDeal} className="px-4 py-2 bg-camelot-navy text-white rounded-lg text-sm font-semibold hover:bg-camelot-navy/90">Track Deal</button>
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-950 mb-4 flex items-center gap-2"><Target size={18} className="text-camelot-gold" /> Tracked Deals &rarr; Pitch Pipeline</h2>
          {deals.length === 0 ? (
            <p className="text-sm text-slate-500">No deals tracked yet. Watch the <a href="https://traded.co/new-york/" target="_blank" rel="noopener" className="text-camelot-gold underline">Traded NY feed</a> and add the rental/multifamily trades worth chasing.</p>
          ) : (
            <div className="space-y-2">
              {deals.map(d => (
                <div key={d.id} className="flex flex-wrap items-center gap-3 border border-slate-200 rounded-xl px-4 py-3">
                  <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center text-white font-bold ${d.score >= 60 ? 'bg-emerald-600' : d.score >= 40 ? 'bg-amber-500' : 'bg-slate-400'}`}>
                    <span className="text-base leading-none">{d.score}</span>
                    <span className="text-[8px] uppercase">score</span>
                  </div>
                  <div className="flex-1 min-w-[220px]">
                    <div className="text-sm font-bold text-slate-950">{d.address}</div>
                    <div className="text-xs text-slate-500">
                      {d.borough} &middot; {d.dealType}{d.price ? ` @ ${d.price}` : ''}{d.units ? ` · ${d.units} units` : ''}{d.buyer ? ` · Buyer: ${d.buyer}` : ''}
                    </div>
                    {d.notes && <div className="text-xs text-slate-400 mt-0.5">{d.notes}</div>}
                  </div>
                  {d.sourceUrl && (
                    <a href={d.sourceUrl} target="_blank" rel="noopener" className="text-xs text-camelot-gold font-semibold flex items-center gap-1">Traded <ArrowUpRight size={12} /></a>
                  )}
                  <button
                    onClick={() => { void navigator.clipboard.writeText(d.address); toast.success('Address copied — paste into the packager'); }}
                    className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Copy address
                  </button>
                  <Link to="/report-center" className="text-xs bg-[#5B4A1F] text-white rounded-lg px-3 py-1.5 font-semibold hover:bg-[#473916] flex items-center gap-1">
                    <Crown size={12} /> Run Report
                  </Link>
                  <button onClick={() => removeDeal(d.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
