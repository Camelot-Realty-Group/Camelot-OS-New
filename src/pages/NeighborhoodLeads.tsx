/**
 * NeighborhoodLeads.tsx — Neighborhood Leads Engine.
 *
 * City-wide lead-generation tool: run a PLUTO+HPD search for multifamily /
 * mixed-use / condo / co-op / boutique-office buildings with 10+ units,
 * review each lead's ownership/management/super/board contact info,
 * generate an intro email + attached Camelot pitch deck, get it approved,
 * send it, and track follow-up through the "Camelot Neighborhood Leads"
 * HubSpot pipeline (4-day follow-up task auto-created on send).
 *
 * Draft-approval gate (per David, Aug 2026): the Send action is disabled
 * client-side until a draft exists and has been approved, AND the server
 * enforces the same rule independently (POST /:id/send checks status ===
 * 'approved') — see src/api/leads-routes.mjs.
 *
 * Backed by:
 *   supabase/migrations/021_neighborhood_leads.sql
 *   src/api/leads-search.mjs
 *   src/api/leads-routes.mjs
 */

import { useState, useEffect, useCallback, useMemo, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import {
  Search, RefreshCw, Users, Building2, Mail, CheckCircle2, Send,
  Clock, Link2, Filter, ChevronDown, ChevronUp, Edit3, MapPin, LogIn, LogOut, ShieldAlert,
} from 'lucide-react';
import { authenticatedApiFetch } from '@/lib/api-auth';
import { generateNeighborProspectReport } from '@/lib/neighbor-prospect-report';
import { generatePdfBase64 } from '@/lib/pdf-generator';
import { useAuth } from '@/hooks/useAuth';

interface Lead {
  id: number;
  bbl: string;
  address: string;
  borough: string | null;
  zip_code: string | null;
  bldg_class: string | null;
  units_total: number | null;
  num_floors: number | null;
  year_built: number | null;
  building_category: string | null;
  owner_name: string | null;
  management_company: string | null;
  management_contact_name: string | null;
  management_contact_role: string | null;
  super_name: string | null;
  board_contact_name: string | null;
  mailing_address: string | null;
  mailing_zip: string | null;
  contact_email: string | null;
  contact_confidence: string | null;
  relationship: 'same_block' | 'across_street' | null;
  nearest_camelot_buildings: string[] | null;
  status: string;
  draft_subject: string | null;
  draft_body_html: string | null;
  approved_at: string | null;
  sent_at: string | null;
  follow_up_due_at: string | null;
  follow_up_completed_at: string | null;
  hubspot_deal_id: string | null;
}

interface RunSummary {
  runId: string;
  summary: {
    totalFound: number;
    minUnits: number;
    borough: string;
    confidenceBreakdown: Record<string, number>;
    relationshipBreakdown: Record<string, number>;
  };
  anchorResolution: { attempted: number; resolved: number; unresolved: Array<{ name: string; reason: string }> } | null;
  dataGaps: string[];
  leadsNew: number;
  leadsUpdated: number;
}

const BOROUGHS = [
  { key: '', label: 'All Boroughs' },
  { key: 'MN', label: 'Manhattan' },
  { key: 'BK', label: 'Brooklyn' },
  { key: 'QN', label: 'Queens' },
  { key: 'BX', label: 'Bronx' },
  { key: 'SI', label: 'Staten Island' },
];

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  new: { label: 'New', cls: 'bg-slate-100 text-slate-700' },
  draft_ready: { label: 'Draft Ready', cls: 'bg-blue-100 text-blue-700' },
  approved: { label: 'Approved', cls: 'bg-emerald-100 text-emerald-700' },
  sent: { label: 'Sent', cls: 'bg-amber-100 text-amber-700' },
  follow_up_scheduled: { label: 'Follow-Up Scheduled', cls: 'bg-purple-100 text-purple-700' },
  responded: { label: 'Responded', cls: 'bg-cyan-100 text-cyan-700' },
  won: { label: 'Won', cls: 'bg-green-100 text-green-700' },
  lost: { label: 'Lost', cls: 'bg-red-100 text-red-700' },
};

function lastName(name?: string | null): string {
  const parts = (name || '').trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

/**
 * Formal salutation per David's Aug 2026 direction: "Mr./Mrs. Lastname"
 * instead of a first-name greeting, wherever we can tell. We don't have a
 * reliable gender signal in the lead data (NYC HPD/PLUTO records don't
 * carry one), so this defaults to "Mr./Ms." only when a title is already
 * present in the source name (e.g. HPD officer records sometimes carry
 * "Mrs. Jane Smith"); otherwise it falls back to the full name, which reads
 * naturally either way ("Dear Jane Smith,") without guessing someone's
 * gender from a first name — a guess that's wrong often enough in a contact
 * list this size to be worse than not guessing at all.
 */
function formalSalutation(contactName: string): string {
  const trimmed = contactName.trim();
  if (!trimmed) return 'Hello';
  const titleMatch = trimmed.match(/^(Mr|Mrs|Ms|Mx)\.?\s+(.+)$/i);
  if (titleMatch) {
    const title = titleMatch[1][0].toUpperCase() + titleMatch[1].slice(1).toLowerCase();
    return `${title}. ${lastName(titleMatch[2]) || titleMatch[2]}`;
  }
  const ln = lastName(trimmed);
  return ln ? `Mr./Mrs. ${ln}` : trimmed;
}

function relationshipPhrase(rel: Lead['relationship']): string {
  return rel === 'same_block' ? 'on your block' : rel === 'across_street' ? 'directly across the street' : 'in your neighborhood';
}

/** Good morning / afternoon / evening, based on the sender's local send time. */
function timeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const EMAIL_SENDER_NAME = 'David Goldoff';
const EMAIL_GOLD = '#B8960F';
const EMAIL_DARK_GOLD = '#8B6F47';
const EMAIL_INK = '#1a1a1a';
const EMAIL_LOGO_URL = 'https://camelot-os.onrender.com/images/camelot-gold-logo.png';
const DAVID_BIO_URL = 'https://david-goldoff-camelot-president.netlify.app/#author';
const DAVID_CREDENTIALS_URL = 'https://david-goldoff-camelot-president.netlify.app/#credentials';
const CAMELOT_SITE_URL = 'https://www.camelot.nyc';

const SOCIAL_LINKS: Array<{ label: string; url: string; icon: string }> = [
  { label: 'LinkedIn', url: 'https://www.linkedin.com/company/camelot-realty-group/', icon: 'https://cdn-icons-png.flaticon.com/24/174/174857.png' },
  { label: 'Instagram', url: 'https://www.instagram.com/camelotrealtygroup/', icon: 'https://cdn-icons-png.flaticon.com/24/2111/2111463.png' },
  { label: 'Facebook', url: 'https://www.facebook.com/camelotrealty/', icon: 'https://cdn-icons-png.flaticon.com/24/733/733547.png' },
  { label: 'X', url: 'https://x.com/camelot_realty', icon: 'https://cdn-icons-png.flaticon.com/24/5968/5968958.png' },
  { label: 'TikTok', url: 'https://www.tiktok.com/@camelotrealtygroup', icon: 'https://cdn-icons-png.flaticon.com/24/3046/3046120.png' },
];

/**
 * Branded HTML email template — David Goldoff outreach letter, Aug 2026
 * rebuild. Uses the corporate gold wordmark (public/images/camelot-gold-logo.png,
 * the same asset used in the app header and proposal covers) rather than a
 * text lockup, a formal Mr./Mrs.-Lastname salutation, the full long-form body
 * copy David supplied verbatim, and his complete signature block + firm
 * affiliations/social footer — replacing the shorter placeholder copy this
 * template shipped with originally.
 *
 * Email clients (Gmail, Outlook, Apple Mail) strip <style> blocks
 * unreliably, so every rule here is inlined directly on each element
 * rather than living in a <head><style> block. Layout uses <table> instead
 * of flex/grid for the same reason — table-based layout is the only thing
 * guaranteed to render consistently across email clients.
 */
function buildIntroDraft(lead: Lead): { subject: string; bodyHtml: string } {
  const contactName = lead.management_contact_name || lead.owner_name || '';
  const salutation = formalSalutation(contactName);
  const nearest = (lead.nearest_camelot_buildings || []).slice(0, 2);
  const hasNamedNeighbor = nearest.length > 0;
  const relPhrase = relationshipPhrase(lead.relationship);
  const greeting = timeOfDayGreeting();

  const subject = hasNamedNeighbor
    ? `We manage ${nearest.length > 1 ? 'buildings' : 'a building'} ${relPhrase} — quick intro`
    : `Camelot Realty Group — introducing ourselves`;

  const neighborLine = hasNamedNeighbor
    ? `We actually manage <strong>${nearest.map(escapeHtml).join(' and ')}</strong>, ${relPhrase} from ${escapeHtml(lead.address)}, and are looking to grow our network by servicing properties like yours.`
    : `We actually manage buildings in your neighborhood and are looking to grow our network by servicing properties like yours.`;

  const p = (inner: string) =>
    `<p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.65;color:${EMAIL_INK};">${inner}</p>`;

  const socialIcons = SOCIAL_LINKS.map(
    (s) => `<a href="${s.url}" style="text-decoration:none;display:inline-block;margin:0 6px;" title="${s.label}"><img src="${s.icon}" width="18" height="18" alt="${s.label}" style="vertical-align:middle;border:0;"/></a>`
  ).join('');

  const bodyHtml = `<div style="background:#f5f0e5;padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:6px;overflow:hidden;">
  <tr>
    <td style="padding:0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${EMAIL_GOLD};">
        <tr>
          <td style="padding:18px 24px;width:180px;">
            <img src="${EMAIL_LOGO_URL}" alt="Camelot Realty Group" height="52" style="display:block;height:52px;width:auto;"/>
          </td>
          <td align="right" style="padding:18px 24px;font-family:Georgia,'Times New Roman',serif;font-size:13px;font-style:italic;color:#ffffff;letter-spacing:0.3px;">
            New Yorkers Servicing New Yorkers&hellip;
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:28px 32px 8px;">
      ${p(`${greeting}, <strong>${escapeHtml(salutation)}</strong>,`)}
      ${p(`I hope this email finds you well. My name is <a href="${DAVID_BIO_URL}" style="color:${EMAIL_DARK_GOLD};font-weight:bold;text-decoration:none;">${EMAIL_SENDER_NAME}</a>, and I am the President of <a href="${CAMELOT_SITE_URL}" style="color:${EMAIL_DARK_GOLD};text-decoration:none;">Camelot Realty Group</a>. Independently owned since 2006, we have been a licensed property management and brokerage company serving NYC, Brooklyn, Queens, the Bronx, Westchester, Southern CT, Southern NJ, and now Southeast Florida. We manage all types of residential and mixed-use asset classes.`)}
      ${p(neighborLine)}
      ${p(`Our approach goes beyond traditional property management. Beyond day-to-day operations, accounting, compliance, maintenance oversight, and resident services, we focus on helping owners and boards control expenses, benchmark vendor pricing, identify operating efficiencies, and uncover opportunities to create additional value and increase cash flow.`)}
      ${p(`We&rsquo;ve also developed our own technology platform, Camelot OS, which gives ownership and board members greater visibility into building operations, financial performance, compliance, projects, and outstanding issues. The goal is to provide a much clearer picture of what is happening at the property than the traditional monthly management report.`)}
      ${p(`I&rsquo;ve attached a brief overview of Camelot, our experience, and the platform.`)}
      ${p(`There&rsquo;s absolutely no pressure to make a change. Even if you&rsquo;re simply interested in comparing management approaches, reviewing vendor costs, or understanding what a transition to another management company might look like, I&rsquo;d be happy to spend 20 minutes with you.`)}
      ${p(`We can meet in person or by Zoom, whichever is easiest.`)}
      ${p(`Best,`)}
    </td>
  </tr>
  <tr>
    <td style="padding:4px 32px 24px;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#faf7f0;border:1px solid ${EMAIL_GOLD};border-radius:6px;">
        <tr>
          <td style="padding:16px 20px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.55;color:${EMAIL_INK};">
            <a href="${DAVID_CREDENTIALS_URL}" style="color:${EMAIL_DARK_GOLD};font-weight:bold;font-size:15px;text-decoration:none;">David A. Goldoff</a><br/>
            President/Owner<br/>
            Camelot Realty Group<br/>
            <br/>
            <strong>Executive Office:</strong><br/>
            501 Madison Avenue, 4th Floor, New York, NY 10022<br/>
            <br/>
            <strong>Main Office:</strong><br/>
            57 West 57th Street, Suite 410 &middot; New York, NY 10019<br/>
            CP: (646) 523-9068 &nbsp;|&nbsp; P: (212) 206-9939 x701<br/>
            Email: <a href="mailto:dgoldoff@camelot.nyc" style="color:${EMAIL_DARK_GOLD};text-decoration:none;">dgoldoff@camelot.nyc</a> &nbsp;&nbsp; Web: <a href="${CAMELOT_SITE_URL}" style="color:${EMAIL_DARK_GOLD};text-decoration:none;">www.camelot.nyc</a><br/>
            <br/>
            <strong>Members of:</strong><br/>
            REBNY, NYARM, HGAR, ONEKEY, SPONY, NY Apartment Association, QBBA, QCOC, CNYC, RSA<br/>
            REBNY Community Service Award &middot; RED Property Management Company of the Year &middot; AMRF Golf Tournament Chief Sponsor<br/>
            <a href="${DAVID_CREDENTIALS_URL}" style="color:${EMAIL_DARK_GOLD};text-decoration:none;font-style:italic;">learn about David here&hellip;</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:16px 32px;background:#2a2a2a;text-align:center;">
      ${socialIcons}
    </td>
  </tr>
  <tr>
    <td style="padding:16px 32px 20px;background:#2a2a2a;font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:1.6;color:#bbb;text-align:center;">
      Camelot Affiliations: Camelot Brokerage Services Corp. &middot; Camelot Living Solutions &middot; Camelot Property Management Services Corp.<br/>
      Members of REBNY, NYARM, SPONY, CHIP, IREM &middot; Manhattan, Queens, Brooklyn &amp; Bronx Chambers of Commerce
    </td>
  </tr>
</table>
</div>`;
  return { subject, bodyHtml };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

/**
 * SessionBar — minimal sign-in widget scoped to this page.
 *
 * The app has no global login screen (useAuth.signin() existed but was never
 * wired to any UI before this) yet /api/leads/* is gated server-side by
 * requireApiUser, which needs a real Supabase Auth session. Rather than
 * build app-wide auth here, this gives staff a way to actually sign in so
 * Run Search / Send work, without touching every other page's routing.
 * (Per David, Aug 2026 — see requireApiUser in server.js.)
 */
function SessionBar() {
  const { isAuthenticated, currentUser, isLoading, signin, signout, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error: signinError } = await signin(email, password);
    setSubmitting(false);
    if (!signinError) {
      toast.success('Signed in');
      setPassword('');
    } else {
      toast.error(signinError);
    }
  };

  if (isLoading) return null;

  if (isAuthenticated) {
    return (
      <div className="flex items-center gap-3 text-xs bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg px-3 py-2 mb-4">
        <CheckCircle2 size={14} />
        <span>Signed in as <strong>{currentUser?.email}</strong> — Run Search and Send are enabled.</span>
        <button onClick={() => void signout()} className="ml-auto flex items-center gap-1 font-semibold hover:underline">
          <LogOut size={12} /> Sign out
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSignIn} className="flex flex-wrap items-center gap-2 text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded-lg px-3 py-2 mb-4">
      <ShieldAlert size={14} className="flex-shrink-0" />
      <span className="font-semibold mr-2">Sign in required to search or send</span>
      <input
        type="email"
        required
        placeholder="you@camelot.nyc"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="border rounded px-2 py-1 text-xs w-48"
      />
      <input
        type="password"
        required
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="border rounded px-2 py-1 text-xs w-40"
      />
      <button
        type="submit"
        disabled={submitting}
        className="flex items-center gap-1 px-3 py-1 rounded bg-amber-800 text-white font-semibold disabled:opacity-50"
      >
        {submitting ? <RefreshCw size={12} className="animate-spin" /> : <LogIn size={12} />}
        Sign in
      </button>
      {error && <span className="text-red-700">{error}</span>}
    </form>
  );
}

export default function NeighborhoodLeads() {
  const { isAuthenticated } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [boroughFilter, setBoroughFilter] = useState('');
  const [minUnits, setMinUnits] = useState('10');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [editingDraft, setEditingDraft] = useState<{ subject: string; bodyHtml: string } | null>(null);
  const [sendEmailOverride, setSendEmailOverride] = useState<Record<number, string>>({});
  const [lastRun, setLastRun] = useState<RunSummary | null>(null);
  const [migrationMissing, setMigrationMissing] = useState(false);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (boroughFilter) params.set('borough', boroughFilter);
      if (minUnits) params.set('minUnits', minUnits);
      if (searchTerm.trim()) params.set('search', searchTerm.trim());
      const resp = await authenticatedApiFetch(`/api/leads?${params.toString()}`);
      const data = await resp.json();
      if (!resp.ok) {
        if (data?.code === 'MIGRATION_REQUIRED') setMigrationMissing(true);
        throw new Error(data?.error || 'Failed to load leads');
      }
      setMigrationMissing(false);
      setLeads(data.leads || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, boroughFilter, minUnits, searchTerm]);

  useEffect(() => { void loadLeads(); }, [loadLeads]);

  const runSearch = async () => {
    setSearching(true);
    try {
      toast.loading('Searching NYC PLUTO + HPD for 10+ unit multifamily/mixed-use/condo/co-op/boutique-office buildings…', { id: 'leads-search' });
      const resp = await authenticatedApiFetch('/api/leads/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minUnits: Number(minUnits) || 10, borough: boroughFilter || null }),
      });
      const data = await resp.json();
      toast.dismiss('leads-search');
      if (!resp.ok) throw new Error(data?.error || 'Search failed');
      setLastRun(data);
      toast.success(`Found ${data.summary.totalFound} buildings — ${data.leadsNew} new, ${data.leadsUpdated} updated`);
      await loadLeads();
    } catch (err: any) {
      toast.dismiss('leads-search');
      toast.error(err?.message || 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const toggleExpand = (lead: Lead) => {
    if (expandedId === lead.id) {
      setExpandedId(null);
      setEditingDraft(null);
    } else {
      setExpandedId(lead.id);
      setEditingDraft(lead.draft_subject ? { subject: lead.draft_subject, bodyHtml: lead.draft_body_html || '' } : null);
    }
  };

  const generateDraft = async (lead: Lead) => {
    setBusyId(lead.id);
    try {
      const draft = buildIntroDraft(lead);
      const resp = await authenticatedApiFetch(`/api/leads/${lead.id}/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: draft.subject, bodyHtml: draft.bodyHtml }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || 'Draft generation failed');
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? data.lead : l)));
      setEditingDraft({ subject: data.lead.draft_subject, bodyHtml: data.lead.draft_body_html });
      toast.success('Draft generated — review before approving');
    } catch (err: any) {
      toast.error(err?.message || 'Draft generation failed');
    } finally {
      setBusyId(null);
    }
  };

  const saveDraftEdits = async (lead: Lead) => {
    if (!editingDraft) return;
    setBusyId(lead.id);
    try {
      const resp = await authenticatedApiFetch(`/api/leads/${lead.id}/draft`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingDraft),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || 'Save failed');
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? data.lead : l)));
      toast.success('Draft saved');
    } catch (err: any) {
      toast.error(err?.message || 'Save failed');
    } finally {
      setBusyId(null);
    }
  };

  const approveDraft = async (lead: Lead) => {
    setBusyId(lead.id);
    try {
      const resp = await authenticatedApiFetch(`/api/leads/${lead.id}/approve`, { method: 'POST' });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || 'Approval failed');
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? data.lead : l)));
      toast.success('Draft approved — ready to send');
    } catch (err: any) {
      toast.error(err?.message || 'Approval failed');
    } finally {
      setBusyId(null);
    }
  };

  const sendIntro = async (lead: Lead) => {
    if (lead.status !== 'approved') {
      toast.error('Approve the draft before sending.');
      return;
    }
    const to = lead.contact_email || sendEmailOverride[lead.id]?.trim();
    if (!to) {
      toast.error('Enter a recipient email below before sending.');
      return;
    }
    setBusyId(lead.id);
    try {
      toast.loading('Rendering report PDF…', { id: `send-${lead.id}` });
      const nearest = lead.nearest_camelot_buildings && lead.nearest_camelot_buildings.length > 0
        ? lead.nearest_camelot_buildings
        : ['a nearby Camelot-managed building']; // report still needs to render even for a lead found via pure city-wide search with no anchor match
      const reportHtml = generateNeighborProspectReport({
        prospectAddress: lead.address,
        prospectBorough: lead.borough || '',
        prospectBbl: lead.bbl,
        bldgClass: lead.bldg_class || undefined,
        unitsTotal: lead.units_total || undefined,
        numFloors: lead.num_floors || undefined,
        yearBuilt: lead.year_built || undefined,
        zipCode: lead.zip_code || undefined,
        ownerName: lead.owner_name || undefined,
        relationship: lead.relationship || 'same_block',
        nearestCamelotBuildings: nearest,
        contactName: lead.management_contact_name || lead.owner_name || undefined,
        contactCompany: lead.management_company || undefined,
        mailingAddress: lead.mailing_address || undefined,
        mailingZip: lead.mailing_zip || undefined,
      });
      const addressSlug = lead.address.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
      const filename = `Camelot-Neighbor-Report_${addressSlug}_${new Date().toISOString().slice(0, 10)}.pdf`;
      // Outer safety-net timeout: generatePdfBase64() already races its own
      // internal html2pdf.js capture against a 45s deadline, but that guard
      // can only fire between JS ticks — if the underlying library call
      // never yields back to the event loop (observed live: button stuck on
      // "Rendering report PDF…" well past 45s with zero network activity),
      // the inner timeout literally cannot preempt it. This outer race
      // guarantees the Send button always recovers within ~60s regardless.
      const attachmentBase64 = await Promise.race([
        generatePdfBase64(reportHtml, filename),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('PDF generation is taking unusually long. Please try again — if this keeps happening, use a shorter report or contact support.')), 60000)
        ),
      ]);

      // Also render a PDF copy of the branded email letter itself (per
      // David's request, Aug 2026), so the recipient — and our own records
      // — has a standalone file of exactly what was sent, not just the
      // pitch-deck attachment. Uses the same draft HTML that's actually
      // emailed (editingDraft override if the user hand-edited it in the
      // UI, otherwise the freshly-built intro draft) so the PDF always
      // matches what's really sent.
      toast.loading('Rendering letter PDF…', { id: `send-${lead.id}` });
      const letterHtmlSource =
        editingDraft && expandedId === lead.id ? editingDraft.bodyHtml : (lead.draft_body_html || buildIntroDraft(lead).bodyHtml);
      const letterFullHtml = `<!doctype html><html><head><meta charset="utf-8"/><title>Camelot Realty Group — Letter</title></head>
<body style="margin:0;background:#f5f0e5;">${letterHtmlSource}</body></html>`;
      const letterFilename = `Camelot-Neighbor-Letter_${addressSlug}_${new Date().toISOString().slice(0, 10)}.pdf`;
      let attachment2Base64: string | undefined;
      try {
        attachment2Base64 = await Promise.race([
          generatePdfBase64(letterFullHtml, letterFilename),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Letter PDF render timed out')), 30000)
          ),
        ]);
      } catch (letterErr) {
        // Non-fatal — the pitch-deck attachment and the styled email body
        // itself are the essential deliverables; a failed letter-PDF render
        // shouldn't block the send.
        console.warn('[NeighborhoodLeads] letter PDF render failed, sending without it:', letterErr);
      }

      toast.loading('Sending…', { id: `send-${lead.id}` });
      const resp = await authenticatedApiFetch(`/api/leads/${lead.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          attachmentBase64,
          attachmentFilename: filename,
          ...(attachment2Base64 ? { attachment2Base64, attachment2Filename: letterFilename } : {}),
        }),
      });
      const data = await resp.json();
      toast.dismiss(`send-${lead.id}`);
      if (!resp.ok) throw new Error(data?.error || 'Send failed');
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? data.lead : l)));
      const hsNote = data.hubspot?.status === 'ok' ? ' — pushed to HubSpot, 4-day follow-up scheduled' : '';
      toast.success(`Sent to ${to}${hsNote}`);
    } catch (err: any) {
      toast.dismiss(`send-${lead.id}`);
      toast.error(err?.message || 'Send failed');
    } finally {
      setBusyId(null);
    }
  };

  const completeFollowUp = async (lead: Lead) => {
    setBusyId(lead.id);
    try {
      const resp = await authenticatedApiFetch(`/api/leads/${lead.id}/follow-up/complete`, { method: 'POST' });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || 'Failed');
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? data.lead : l)));
      toast.success('Follow-up marked complete');
    } catch (err: any) {
      toast.error(err?.message || 'Failed');
    } finally {
      setBusyId(null);
    }
  };

  const filteredLeads = leads;

  const overdueFollowUps = useMemo(
    () => leads.filter((l) => l.follow_up_due_at && !l.follow_up_completed_at && new Date(l.follow_up_due_at) <= new Date()).length,
    [leads]
  );

  if (migrationMissing) {
    return (
      <div className="min-h-screen bg-[#F7F4ED] flex items-center justify-center p-8">
        <div className="bg-white rounded-2xl border border-red-200 p-8 max-w-lg text-center">
          <h2 className="font-heading text-xl text-slate-950 mb-2">Leads schema not deployed</h2>
          <p className="text-slate-600 text-sm">Run <code className="bg-slate-100 px-1.5 py-0.5 rounded">supabase/migrations/021_neighborhood_leads.sql</code> in Supabase, then reload this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F4ED]">
      <div className="bg-white border-b border-slate-200 px-8 py-7">
        <div className="flex items-center gap-3">
          <span className="w-12 h-12 rounded-2xl bg-camelot-gold/15 text-camelot-gold flex items-center justify-center">
            <Users size={24} />
          </span>
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-camelot-gold font-bold">Business Development</div>
            <h1 className="font-heading text-3xl text-slate-950">Neighborhood Leads Engine</h1>
          </div>
        </div>
        <p className="text-slate-600 mt-4 max-w-4xl leading-relaxed">
          Searches NYC PLUTO + HPD city-wide for multifamily, mixed-use, condo, co-op, and boutique-office buildings
          with 10+ units. Review ownership/management/super/board contact info, generate an intro email with the
          Camelot pitch deck attached, get it approved, then send — every send pushes to the{' '}
          <strong>Camelot Neighborhood Leads</strong> HubSpot pipeline with a 4-day follow-up task created automatically.
        </p>
      </div>

      <main className="px-8 py-8">
        <SessionBar />
        {/* Search controls */}
        <div className="bg-white rounded-2xl border border-[#A89035]/40 p-5 shadow-sm mb-6">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Borough</label>
              <select value={boroughFilter} onChange={(e) => setBoroughFilter(e.target.value)} className="block mt-1 border rounded-lg px-3 py-2 text-sm">
                {BOROUGHS.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Min Units</label>
              <input value={minUnits} onChange={(e) => setMinUnits(e.target.value)} type="number" min={1} className="block mt-1 w-24 border rounded-lg px-3 py-2 text-sm" />
            </div>
            <button
              onClick={() => void runSearch()}
              disabled={searching || !isAuthenticated}
              title={!isAuthenticated ? 'Sign in above to run a search' : undefined}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold bg-[#5B4A1F] text-white hover:bg-[#473916] disabled:opacity-50"
            >
              {searching ? <RefreshCw size={15} className="animate-spin" /> : <Search size={15} />}
              Run Search
            </button>
            <div className="flex-1" />
            <div className="relative">
              <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border rounded-lg pl-8 pr-3 py-2 text-sm">
                <option value="">All Statuses</option>
                {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search address / owner / mgmt co."
                className="border rounded-lg pl-8 pr-3 py-2 text-sm w-64"
              />
            </div>
          </div>
          {lastRun && (
            <div className="mt-4 text-xs text-slate-500 bg-slate-50 rounded-lg p-3">
              Last run found {lastRun.summary.totalFound} buildings ({lastRun.leadsNew} new, {lastRun.leadsUpdated} updated).
              {lastRun.anchorResolution && (
                <> Matched against {lastRun.anchorResolution.resolved}/{lastRun.anchorResolution.attempted} Camelot-managed buildings (geocoded from your live MDS/RealtyMX-synced portfolio).</>
              )}
              {' '}Neighbor relationship: {Object.entries(lastRun.summary.relationshipBreakdown).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`).join(', ')}.
              {' '}Contact confidence: {Object.entries(lastRun.summary.confidenceBreakdown).map(([k, v]) => `${k}: ${v}`).join(', ')}.
              {lastRun.dataGaps.length > 0 && (
                <details className="mt-1"><summary className="cursor-pointer font-semibold">Known data gaps</summary>
                  <ul className="list-disc pl-5 mt-1 space-y-0.5">{lastRun.dataGaps.map((g, i) => <li key={i}>{g}</li>)}</ul>
                </details>
              )}
            </div>
          )}
        </div>

        {overdueFollowUps > 0 && (
          <div className="mb-6 bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 flex items-center gap-2 text-amber-800 text-sm font-semibold">
            <Clock size={16} /> {overdueFollowUps} lead{overdueFollowUps === 1 ? '' : 's'} with a follow-up due — filter by status "Follow-Up Scheduled" to review.
          </div>
        )}

        {/* Leads table */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="text-sm font-bold text-slate-700">{total} lead{total === 1 ? '' : 's'}</div>
            <button onClick={() => void loadLeads()} disabled={loading} className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1">
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
          {filteredLeads.length === 0 ? (
            <div className="p-10 text-center text-slate-400 text-sm">
              {loading ? 'Loading…' : 'No leads yet — run a search above.'}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredLeads.map((lead) => {
                const statusMeta = STATUS_LABELS[lead.status] || { label: lead.status, cls: 'bg-slate-100 text-slate-700' };
                const isExpanded = expandedId === lead.id;
                const followUpOverdue = lead.follow_up_due_at && !lead.follow_up_completed_at && new Date(lead.follow_up_due_at) <= new Date();
                return (
                  <div key={lead.id}>
                    <button onClick={() => toggleExpand(lead)} className="w-full flex items-center gap-4 px-5 py-3.5 text-left hover:bg-slate-50">
                      <Building2 size={16} className="text-camelot-gold shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-slate-900 truncate">{lead.address}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                          <span className="flex items-center gap-1"><MapPin size={11} />{lead.borough}</span>
                          <span>{lead.units_total || '?'} units</span>
                          <span className="capitalize">{(lead.building_category || '').replace(/_/g, ' ')}</span>
                          {lead.management_contact_name && <span>· {lead.management_contact_name}</span>}
                        </div>
                      </div>
                      {followUpOverdue && <Clock size={14} className="text-amber-600" />}
                      {lead.hubspot_deal_id && <span title="Synced to HubSpot"><Link2 size={14} className="text-orange-500" /></span>}
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full ${statusMeta.cls}`}>{statusMeta.label}</span>
                      {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                    </button>

                    {isExpanded && (
                      <div className="px-5 pb-5 bg-slate-50/60">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3">
                          <div className="bg-white rounded-xl border border-slate-200 p-4 text-sm space-y-1.5">
                            <div className="font-bold text-slate-700 text-xs uppercase tracking-wide mb-2">Property</div>
                            <div><span className="text-slate-500">BBL:</span> {lead.bbl}</div>
                            <div><span className="text-slate-500">Class:</span> {lead.bldg_class || '—'}</div>
                            <div><span className="text-slate-500">Floors:</span> {lead.num_floors || '—'}</div>
                            <div><span className="text-slate-500">Year Built:</span> {lead.year_built || '—'}</div>
                            <div><span className="text-slate-500">ZIP:</span> {lead.zip_code || '—'}</div>
                            <div className="pt-1 border-t border-slate-100 mt-1">
                              <span className="text-slate-500">Camelot Neighbor:</span>{' '}
                              {lead.nearest_camelot_buildings && lead.nearest_camelot_buildings.length > 0
                                ? <span className="font-semibold text-emerald-700">{lead.nearest_camelot_buildings.join(', ')} ({lead.relationship === 'same_block' ? 'same block' : 'across the street'})</span>
                                : <span className="text-slate-400">no Camelot-managed anchor nearby (found via city-wide search)</span>}
                            </div>
                          </div>
                          <div className="bg-white rounded-xl border border-slate-200 p-4 text-sm space-y-1.5">
                            <div className="font-bold text-slate-700 text-xs uppercase tracking-wide mb-2">Ownership &amp; Contacts</div>
                            <div><span className="text-slate-500">Owner:</span> {lead.owner_name || '—'}</div>
                            <div><span className="text-slate-500">Mgmt Co:</span> {lead.management_company || '—'}</div>
                            <div><span className="text-slate-500">Mgmt Contact:</span> {lead.management_contact_name || '—'} {lead.management_contact_role ? `(${lead.management_contact_role})` : ''}</div>
                            <div><span className="text-slate-500">Super:</span> {lead.super_name || '— (not on file)'}</div>
                            <div><span className="text-slate-500">Board Contact:</span> {lead.board_contact_name || '— (not published by NYC Open Data)'}</div>
                            <div><span className="text-slate-500">Mailing Address:</span> {lead.mailing_address || '—'}</div>
                            <div>
                              <span className="text-slate-500">Email:</span>{' '}
                              {lead.contact_email ? (
                                lead.contact_email
                              ) : (
                                <input
                                  type="email"
                                  placeholder="Enter recipient email to send…"
                                  value={sendEmailOverride[lead.id] || ''}
                                  onChange={(e) => setSendEmailOverride((prev) => ({ ...prev, [lead.id]: e.target.value }))}
                                  className="border rounded px-2 py-0.5 text-xs w-56 align-middle"
                                />
                              )}
                            </div>
                            <div className="text-xs text-slate-400 pt-1">Confidence: {lead.contact_confidence}</div>
                          </div>
                        </div>

                        {/* Draft / approve / send workflow */}
                        <div className="bg-white rounded-xl border border-slate-200 p-4 mt-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="font-bold text-slate-700 text-xs uppercase tracking-wide">Intro Email Draft</div>
                            {!lead.draft_subject && (
                              <button
                                onClick={() => void generateDraft(lead)}
                                disabled={busyId === lead.id}
                                className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-[#1a2744] text-white hover:bg-[#26375c] disabled:opacity-50"
                              >
                                <Mail size={12} /> Generate Draft
                              </button>
                            )}
                          </div>

                          {lead.draft_subject && editingDraft && (
                            <div className="space-y-2">
                              <input
                                value={editingDraft.subject}
                                onChange={(e) => setEditingDraft({ ...editingDraft, subject: e.target.value })}
                                disabled={lead.status !== 'draft_ready' && lead.status !== 'new'}
                                className="w-full border rounded-lg px-3 py-2 text-sm font-semibold disabled:bg-slate-50"
                              />
                              <textarea
                                value={editingDraft.bodyHtml}
                                onChange={(e) => setEditingDraft({ ...editingDraft, bodyHtml: e.target.value })}
                                disabled={lead.status !== 'draft_ready' && lead.status !== 'new'}
                                rows={8}
                                className="w-full border rounded-lg px-3 py-2 text-xs font-mono disabled:bg-slate-50"
                              />
                              <div className="flex items-center gap-2 flex-wrap">
                                {(lead.status === 'draft_ready' || lead.status === 'new') && (
                                  <>
                                    <button onClick={() => void saveDraftEdits(lead)} disabled={busyId === lead.id} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-50">
                                      <Edit3 size={12} /> Save Edits
                                    </button>
                                    <button onClick={() => void approveDraft(lead)} disabled={busyId === lead.id} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-50">
                                      <CheckCircle2 size={12} /> Approve Draft
                                    </button>
                                  </>
                                )}
                                {lead.status === 'approved' && (
                                  <>
                                    <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1"><CheckCircle2 size={12} /> Approved — ready to send</span>
                                    <button
                                      onClick={() => void sendIntro(lead)}
                                      disabled={busyId === lead.id || !(lead.contact_email || sendEmailOverride[lead.id]?.trim())}
                                      title={!(lead.contact_email || sendEmailOverride[lead.id]?.trim()) ? 'Enter a recipient email above first' : undefined}
                                      className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-camelot-gold text-white hover:opacity-90 disabled:opacity-50"
                                    >
                                      <Send size={12} /> Send Intro Email + Deck
                                    </button>
                                  </>
                                )}
                                {['sent', 'follow_up_scheduled', 'responded', 'won', 'lost'].includes(lead.status) && (
                                  <span className="text-xs text-slate-500">
                                    Sent {lead.sent_at ? new Date(lead.sent_at).toLocaleDateString() : ''}.
                                    {lead.follow_up_due_at && !lead.follow_up_completed_at && (
                                      <>
                                        {' '}Follow-up due {new Date(lead.follow_up_due_at).toLocaleDateString()}.{' '}
                                        <button onClick={() => void completeFollowUp(lead)} className="underline font-semibold">Mark complete</button>
                                      </>
                                    )}
                                    {lead.follow_up_completed_at && ' Follow-up completed.'}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
