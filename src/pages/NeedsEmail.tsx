/**
 * NeedsEmail.tsx — "Needs Email" queue for the Neighborhood Leads Engine.
 *
 * NYC's public property records (PLUTO/HPD) almost never include an email
 * address — as of Aug 2026, only 8 of 5,602 leads had one. Rather than
 * block those leads or guess at an address, they land here for a human to
 * look up and enter a contact email (plus optional name/title/phone/
 * company). Once an email is entered, the lead becomes sendable through the
 * normal Neighborhood Leads flow (generate draft -> approve -> send).
 *
 * Backed by:
 *   supabase/migrations/022_neighborhood_leads_send_limits.sql
 *   PATCH /api/leads/:id/contact  (src/api/leads-routes.mjs)
 */

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  UserSearch, RefreshCw, Building2, MapPin, ArrowLeft, Save, Mail, ExternalLink,
} from 'lucide-react';
import { authenticatedApiFetch } from '@/lib/api-auth';

interface Lead {
  id: number;
  bbl: string;
  address: string;
  borough: string | null;
  units_total: number | null;
  building_category: string | null;
  owner_name: string | null;
  management_company: string | null;
  management_contact_name: string | null;
  management_contact_role: string | null;
  mailing_address: string | null;
  contact_email: string | null;
  contact_title: string | null;
  contact_name_manual: string | null;
  contact_phone_manual: string | null;
  contact_company_manual: string | null;
  discovered_at: string | null;
}

interface DraftEntry {
  email: string;
  name: string;
  title: string;
  phone: string;
  company: string;
}

function emptyDraft(lead: Lead): DraftEntry {
  return {
    email: lead.contact_email || '',
    name: lead.contact_name_manual || lead.management_contact_name || '',
    title: lead.contact_title || lead.management_contact_role || '',
    phone: lead.contact_phone_manual || '',
    company: lead.contact_company_manual || lead.management_company || '',
  };
}

export default function NeedsEmail() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<number, DraftEntry>>({});
  const [searchTerm, setSearchTerm] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '500');
      if (searchTerm.trim()) params.set('search', searchTerm.trim());
      const resp = await authenticatedApiFetch(`/api/leads?${params.toString()}`);
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || 'Failed to load leads');
      const missingEmail: Lead[] = (data.leads || []).filter((l: Lead) => !l.contact_email);
      setLeads(missingEmail);
      setTotal(missingEmail.length);
      setDrafts((prev) => {
        const next = { ...prev };
        for (const lead of missingEmail) {
          if (!next[lead.id]) next[lead.id] = emptyDraft(lead);
        }
        return next;
      });
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  useEffect(() => { void load(); }, [load]);

  const updateDraft = (leadId: number, field: keyof DraftEntry, value: string) => {
    setDrafts((prev) => ({ ...prev, [leadId]: { ...(prev[leadId] || { email: '', name: '', title: '', phone: '', company: '' }), [field]: value } }));
  };

  const saveContact = async (lead: Lead) => {
    const draft = drafts[lead.id];
    if (!draft?.email.trim()) {
      toast.error('Enter an email address first.');
      return;
    }
    setSavingId(lead.id);
    try {
      const resp = await authenticatedApiFetch(`/api/leads/${lead.id}/contact`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: draft.email.trim(),
          name: draft.name.trim(),
          title: draft.title.trim(),
          phone: draft.phone.trim(),
          company: draft.company.trim(),
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || 'Save failed');
      toast.success(`Email added for ${lead.address} — ready to draft & send on the Neighborhood Leads page`);
      // This lead now has an email, so it drops out of the queue.
      setLeads((prev) => prev.filter((l) => l.id !== lead.id));
      setTotal((prev) => Math.max(0, prev - 1));
    } catch (err: any) {
      toast.error(err?.message || 'Save failed');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F4ED]">
      <div className="bg-white border-b border-slate-200 px-8 py-7">
        <Link to="/neighborhood-leads" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 mb-3">
          <ArrowLeft size={13} /> Back to Neighborhood Leads Engine
        </Link>
        <div className="flex items-center gap-3">
          <span className="w-12 h-12 rounded-2xl bg-camelot-gold/15 text-camelot-gold flex items-center justify-center">
            <UserSearch size={24} />
          </span>
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-camelot-gold font-bold">Business Development</div>
            <h1 className="font-heading text-3xl text-slate-950">Needs Email Queue</h1>
          </div>
        </div>
        <p className="text-slate-600 mt-4 max-w-4xl leading-relaxed">
          NYC&rsquo;s public property records almost never include an email address — only a name and sometimes a
          title. These buildings are ready to contact in every other way, but need a human to look up and enter a
          send-to email before an intro email can go out. Look up the contact (LinkedIn, the company website, or a
          phone call work well), fill in what you find, and click Save — the lead will then show up as sendable on
          the <Link to="/neighborhood-leads" className="underline font-semibold">Neighborhood Leads Engine</Link> page.
        </p>
      </div>

      <main className="px-8 py-8">
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm font-bold text-slate-700">{total} lead{total === 1 ? '' : 's'} waiting for an email</div>
            <div className="flex items-center gap-2">
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search address / owner / mgmt co."
                className="border rounded-lg px-3 py-1.5 text-xs w-56"
              />
              <button onClick={() => void load()} disabled={loading} className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1">
                <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
              </button>
            </div>
          </div>

          {leads.length === 0 ? (
            <div className="p-10 text-center text-slate-400 text-sm">
              {loading ? 'Loading…' : 'Nothing here — every lead currently has an email on file.'}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {leads.map((lead) => {
                const draft = drafts[lead.id] || emptyDraft(lead);
                return (
                  <div key={lead.id} className="px-5 py-4">
                    <div className="flex items-start gap-3 mb-3">
                      <Building2 size={16} className="text-camelot-gold shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-slate-900">{lead.address}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap mt-0.5">
                          <span className="flex items-center gap-1"><MapPin size={11} />{lead.borough}</span>
                          <span>{lead.units_total || '?'} units</span>
                          <span className="capitalize">{(lead.building_category || '').replace(/_/g, ' ')}</span>
                          {lead.owner_name && <span>· Owner: {lead.owner_name}</span>}
                        </div>
                      </div>
                      <a
                        href={`https://www.google.com/search?q=${encodeURIComponent(`${lead.management_company || lead.owner_name || ''} ${lead.address} property management contact`)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-slate-400 hover:text-camelot-gold flex items-center gap-1 shrink-0"
                        title="Search the web for a contact"
                      >
                        <ExternalLink size={12} /> Look up
                      </a>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                      <div className="md:col-span-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Email *</label>
                        <input
                          type="email"
                          value={draft.email}
                          onChange={(e) => updateDraft(lead.id, 'email', e.target.value)}
                          placeholder="name@company.com"
                          className="block w-full border rounded-lg px-2.5 py-1.5 text-xs mt-0.5"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Name</label>
                        <input
                          value={draft.name}
                          onChange={(e) => updateDraft(lead.id, 'name', e.target.value)}
                          placeholder="Contact name"
                          className="block w-full border rounded-lg px-2.5 py-1.5 text-xs mt-0.5"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Title</label>
                        <input
                          value={draft.title}
                          onChange={(e) => updateDraft(lead.id, 'title', e.target.value)}
                          placeholder="Title"
                          className="block w-full border rounded-lg px-2.5 py-1.5 text-xs mt-0.5"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Phone</label>
                        <input
                          value={draft.phone}
                          onChange={(e) => updateDraft(lead.id, 'phone', e.target.value)}
                          placeholder="(555) 555-5555"
                          className="block w-full border rounded-lg px-2.5 py-1.5 text-xs mt-0.5"
                        />
                      </div>
                      <div className="md:col-span-4">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Company</label>
                        <input
                          value={draft.company}
                          onChange={(e) => updateDraft(lead.id, 'company', e.target.value)}
                          placeholder="Management company"
                          className="block w-full border rounded-lg px-2.5 py-1.5 text-xs mt-0.5"
                        />
                      </div>
                      <div className="flex items-end">
                        <button
                          onClick={() => void saveContact(lead)}
                          disabled={savingId === lead.id || !draft.email.trim()}
                          className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-camelot-gold text-white hover:opacity-90 disabled:opacity-50 w-full justify-center"
                        >
                          {savingId === lead.id ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
                          Save
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-6 bg-white rounded-2xl border border-slate-200 p-5 text-xs text-slate-500 flex items-start gap-2">
          <Mail size={14} className="shrink-0 mt-0.5" />
          <span>
            Every evening, a report of what got sent (and what&rsquo;s still waiting here) goes automatically to
            info@camelot.nyc — including a spreadsheet of everything still on this page.
          </span>
        </div>
      </main>
    </div>
  );
}
