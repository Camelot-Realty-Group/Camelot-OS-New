import { useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowUpRight, CheckCircle2, Crown, Newspaper, Plus, Search, Share2, ShieldOff, Target, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTradedDeals, type NewTradedDealInput } from '@/hooks/useTradedDeals';

const BOROUGHS = ['Manhattan', 'Brooklyn', 'Queens', 'The Bronx', 'Staten Island', 'Westchester', 'Long Island', 'New Jersey', 'Connecticut'];
const DEAL_TYPES = ['Sold', 'In Contract', 'Loan / Refi', '1031 Exchange', 'Foreign Buyer', 'Receivership / Distress', 'New Development'];
const emptyForm = {
  address: '', borough: 'Manhattan', dealType: 'Sold', price: '', units: '',
  buyerName: '', buyerCompany: '', sellerName: '', sellerCompany: '',
  broker: '', sourceUrl: '', notes: '',
};

export default function TradedNY() {
  const { deals, loading, error, busyId, addDeal, removeDeal, setEligibility, enrichDeal, syncHubSpot } = useTradedDeals();
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const stats = {
    total: deals.length,
    hot: deals.filter((deal) => deal.score >= 60).length,
    ready: deals.filter((deal) => deal.outreachEligible && Boolean(deal.buyerEmail || deal.sellerEmail)).length,
    synced: deals.filter((deal) => deal.campaignStatus === 'synced').length,
  };

  const submit = async () => {
    setSubmitting(true);
    const input: NewTradedDealInput = {
      address: form.address, borough: form.borough, dealType: form.dealType,
      price: form.price, units: parseInt(form.units, 10) || 0,
      buyerName: form.buyerName, buyerCompany: form.buyerCompany,
      sellerName: form.sellerName, sellerCompany: form.sellerCompany,
      broker: form.broker, sourceUrl: form.sourceUrl, notes: form.notes,
    };
    const saved = await addDeal(input);
    setSubmitting(false);
    if (saved) setForm((current) => ({ ...emptyForm, borough: current.borough, dealType: current.dealType }));
  };

  return (
    <div className="min-h-screen bg-[#F7F4ED]">
      <div className="bg-white border-b border-slate-200 px-8 py-7">
        <div className="flex items-center gap-3">
          <span className="w-12 h-12 rounded-2xl bg-camelot-gold/15 text-camelot-gold flex items-center justify-center"><Newspaper size={24} /></span>
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-camelot-gold font-bold">Scout — Deal Flow</div>
            <h1 className="font-heading text-3xl text-slate-950">Traded NY</h1>
          </div>
        </div>
        <p className="text-slate-600 mt-4 max-w-4xl leading-relaxed">
          Capture transactions from the <a href="https://traded.co/new-york/" target="_blank" rel="noopener" className="text-camelot-gold font-semibold underline">Traded NY feed</a>,
          qualify the new owner, enrich verified business contact data, approve outreach, and hand the opportunity to HubSpot without losing source attribution.
        </p>
        <div className="mt-3 text-xs text-slate-500 max-w-4xl">
          Contact discovery does not imply permission to send. Review source, business relevance, suppression status, and applicable outreach requirements before approval.
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-camelot-gold/30 bg-camelot-gold/5 px-4 py-3 text-sm">
          <span className="font-semibold text-slate-800">Approved prospect response:</span>
          <a href="mailto:info@camelot.nyc" className="font-semibold text-camelot-gold underline underline-offset-2">
            info@camelot.nyc
          </a>
          <span className="text-slate-400">or</span>
          <a href="https://www.camelot.nyc/get-a-quote/" target="_blank" rel="noopener" className="inline-flex items-center gap-1 font-semibold text-camelot-gold underline underline-offset-2">
            Get a Quote <ArrowUpRight size={13} />
          </a>
        </div>
        {error && <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">{error}</div>}
      </div>

      <main className="px-8 py-8 space-y-6">
        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: 'Deals Tracked', value: stats.total, note: 'Shared Supabase pipeline' },
            { label: 'Qualified (60+)', value: stats.hot, note: 'Priority management prospects' },
            { label: 'Outreach Ready', value: stats.ready, note: 'Verified contact + approval' },
            { label: 'HubSpot Synced', value: stats.synced, note: 'CRM handoff complete' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <div className="text-3xl font-bold text-camelot-gold">{loading ? '—' : stat.value}</div>
              <div className="text-sm font-bold text-slate-900 mt-1">{stat.label}</div>
              <div className="text-xs text-slate-500">{stat.note}</div>
            </div>
          ))}
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-950 mb-1 flex items-center gap-2"><Plus size={18} className="text-camelot-gold" /> Track a Traded Deal</h2>
          <p className="text-xs text-slate-500 mb-4">Address is required. A Traded NY source URL is strongly recommended for deduplication and audit history.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input value={form.address} onChange={(event) => setForm((value) => ({ ...value, address: event.target.value }))} placeholder="Property address *" className="border rounded-lg px-3 py-2 text-sm md:col-span-2" />
            <select value={form.borough} onChange={(event) => setForm((value) => ({ ...value, borough: event.target.value }))} className="border rounded-lg px-3 py-2 text-sm">{BOROUGHS.map((borough) => <option key={borough}>{borough}</option>)}</select>
            <select value={form.dealType} onChange={(event) => setForm((value) => ({ ...value, dealType: event.target.value }))} className="border rounded-lg px-3 py-2 text-sm">{DEAL_TYPES.map((type) => <option key={type}>{type}</option>)}</select>
            <input value={form.price} onChange={(event) => setForm((value) => ({ ...value, price: event.target.value }))} placeholder="Price (e.g., $14.5M)" className="border rounded-lg px-3 py-2 text-sm" />
            <input value={form.units} onChange={(event) => setForm((value) => ({ ...value, units: event.target.value }))} placeholder="Units" inputMode="numeric" className="border rounded-lg px-3 py-2 text-sm" />
            <input value={form.buyerName} onChange={(event) => setForm((value) => ({ ...value, buyerName: event.target.value }))} placeholder="Buyer / new owner name" className="border rounded-lg px-3 py-2 text-sm" />
            <input value={form.buyerCompany} onChange={(event) => setForm((value) => ({ ...value, buyerCompany: event.target.value }))} placeholder="Buyer company / entity" className="border rounded-lg px-3 py-2 text-sm" />
            <input value={form.broker} onChange={(event) => setForm((value) => ({ ...value, broker: event.target.value }))} placeholder="Broker / relationship" className="border rounded-lg px-3 py-2 text-sm" />
            <input value={form.sellerName} onChange={(event) => setForm((value) => ({ ...value, sellerName: event.target.value }))} placeholder="Seller / prior owner name" className="border rounded-lg px-3 py-2 text-sm" />
            <input value={form.sellerCompany} onChange={(event) => setForm((value) => ({ ...value, sellerCompany: event.target.value }))} placeholder="Seller company / entity" className="border rounded-lg px-3 py-2 text-sm" />
            <input value={form.sourceUrl} onChange={(event) => setForm((value) => ({ ...value, sourceUrl: event.target.value }))} placeholder="Traded NY source link" className="border rounded-lg px-3 py-2 text-sm" />
            <input value={form.notes} onChange={(event) => setForm((value) => ({ ...value, notes: event.target.value }))} placeholder="Notes (1031, distress, timing, fit...)" className="border rounded-lg px-3 py-2 text-sm md:col-span-2" />
            <button onClick={() => void submit()} disabled={submitting} className="px-4 py-2 bg-camelot-navy text-white rounded-lg text-sm font-semibold hover:bg-camelot-navy/90 disabled:opacity-50">{submitting ? 'Saving…' : 'Track Deal'}</button>
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-950 mb-4 flex items-center gap-2"><Target size={18} className="text-camelot-gold" /> Tracked Deals → Sales Funnel</h2>
          {loading ? <p className="text-sm text-slate-500">Loading deals…</p> : deals.length === 0 ? (
            <p className="text-sm text-slate-500">No deals tracked yet. Add only relevant transactions with a verifiable source.</p>
          ) : (
            <div className="space-y-3">
              {deals.map((deal) => {
                const busy = busyId === deal.id;
                const contact = deal.buyerEmail || deal.sellerEmail;
                return (
                  <div key={deal.id} className="border border-slate-200 rounded-xl px-4 py-4">
                    <div className="flex flex-wrap items-start gap-3">
                      <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center text-white font-bold ${deal.score >= 60 ? 'bg-emerald-600' : deal.score >= 40 ? 'bg-amber-500' : 'bg-slate-400'}`}>
                        <span className="text-base leading-none">{deal.score}</span><span className="text-[8px] uppercase">score</span>
                      </div>
                      <div className="flex-1 min-w-[240px]">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-slate-950">{deal.address}</span>
                          <span className="text-[10px] uppercase tracking-wide rounded-full bg-slate-100 text-slate-600 px-2 py-0.5">{deal.campaignStatus}</span>
                          {deal.hubspotSyncedAt && <span className="text-[10px] text-emerald-700 flex items-center gap-1"><CheckCircle2 size={11} /> HubSpot</span>}
                        </div>
                        <div className="text-xs text-slate-500">{deal.borough} · {deal.dealType}{deal.price ? ` @ ${deal.price}` : ''}{deal.units ? ` · ${deal.units} units` : ''}</div>
                        {(deal.buyerName || deal.sellerName) && <div className="text-xs text-slate-600 mt-1">
                          {deal.buyerName && <>Buyer: <strong>{deal.buyerName}</strong>{deal.buyerCompany ? ` (${deal.buyerCompany})` : ''}{deal.buyerEmail ? ` · ${deal.buyerEmail}` : ''}</>}
                          {deal.buyerName && deal.sellerName && <span className="mx-1">|</span>}
                          {deal.sellerName && <>Seller: <strong>{deal.sellerName}</strong>{deal.sellerCompany ? ` (${deal.sellerCompany})` : ''}{deal.sellerEmail ? ` · ${deal.sellerEmail}` : ''}</>}
                        </div>}
                        {deal.notes && <div className="text-xs text-slate-400 mt-1">{deal.notes}</div>}
                        {deal.hubspotSyncError && <div className="text-xs text-red-600 mt-1">Last integration error: {deal.hubspotSyncError}</div>}
                      </div>
                      {deal.sourceUrl && <a href={deal.sourceUrl} target="_blank" rel="noopener" className="text-xs text-camelot-gold font-semibold flex items-center gap-1">Source <ArrowUpRight size={12} /></a>}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-3 md:pl-[60px]">
                      <button onClick={() => void enrichDeal(deal.id, 'buyer')} disabled={busy} className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1"><Search size={12} /> Enrich buyer</button>
                      {deal.sellerName && <button onClick={() => void enrichDeal(deal.id, 'seller')} disabled={busy} className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1"><Search size={12} /> Enrich seller</button>}
                      <button onClick={() => void setEligibility(deal.id, !deal.outreachEligible)} disabled={busy} className={`text-xs rounded-lg px-3 py-1.5 font-semibold flex items-center gap-1 border ${deal.outreachEligible ? 'border-emerald-200 text-emerald-700 bg-emerald-50' : 'border-red-200 text-red-700 bg-red-50'}`}>
                        {deal.outreachEligible ? <CheckCircle2 size={12} /> : <ShieldOff size={12} />}{deal.outreachEligible ? 'Outreach approved' : 'Suppressed'}
                      </button>
                      <button onClick={() => void syncHubSpot(deal.id, 'buyer')} disabled={busy || deal.doNotContact} className="text-xs border border-orange-200 text-orange-700 rounded-lg px-3 py-1.5 font-semibold hover:bg-orange-50 disabled:opacity-50 flex items-center gap-1"><Share2 size={12} /> {busy ? 'Working…' : 'Save to HubSpot'}</button>
                      <button onClick={() => { void navigator.clipboard.writeText(contact || deal.address); toast.success(contact ? 'Contact copied' : 'Address copied'); }} className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 font-semibold text-slate-600 hover:bg-slate-50">Copy {contact ? 'contact' : 'address'}</button>
                      <Link to="/report-center" className="text-xs bg-[#5B4A1F] text-white rounded-lg px-3 py-1.5 font-semibold hover:bg-[#473916] flex items-center gap-1"><Crown size={12} /> Run Report</Link>
                      <button onClick={() => void removeDeal(deal.id)} disabled={busy} aria-label={`Delete ${deal.address}`} className="text-slate-300 hover:text-red-500 disabled:opacity-50"><Trash2 size={15} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
