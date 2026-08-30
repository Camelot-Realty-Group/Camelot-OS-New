/**
 * CallQueue.tsx — "Call Queue" for the Neighborhood Leads Engine.
 *
 * Per David, Aug 2026: follow-up calls/texts to owners ONLY — never to a
 * management company (Agent-type HPD contact). This page only ever shows
 * leads where is_owner_contact = true AND an intro email has already been
 * sent (see GET /api/leads/call-queue). It supports both a human rep
 * logging a call they placed themselves, and (only inside Mon-Fri 9am-5pm
 * ET) triggering/logging an AI-voice call attempt.
 *
 * This is a FOLLOW-UP verification call/text, not a sales pitch — see
 * src/api/call-scripts.mjs for the actual script content. The call's three
 * jobs: confirm the email arrived, verify owner/board status, and only then
 * ask about a meeting.
 *
 * Backed by:
 *   supabase/migrations/023_owner_contacts_calls_sms.sql
 *   src/api/leads-routes.mjs (call-queue / :id/calls / :id/ai-call-prompt / sms-consent routes)
 *   src/api/call-scripts.mjs
 */

import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Phone, RefreshCw, Building2, MapPin, ArrowLeft, PhoneCall, Bot, User,
  Clock, ShieldAlert, MessageSquare, ChevronDown, ChevronUp,
  FileText, CheckCircle2, LogIn,
} from 'lucide-react';
import { authenticatedApiFetch } from '@/lib/api-auth';
import { useAuth } from '@/hooks/useAuth';

/** Minimal sign-in bar, same pattern as NeighborhoodLeads.tsx's SessionBar —
 * /api/leads/* routes are gated server-side by requireApiUser. */
function SignInBar() {
  const { isAuthenticated, currentUser, isLoading, signin, signout, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error: signinError } = await signin(email, password);
    setSubmitting(false);
    if (!signinError) { toast.success('Signed in'); setPassword(''); } else { toast.error(signinError); }
  };

  if (isLoading) return null;
  if (isAuthenticated) {
    return (
      <div className="flex items-center gap-3 text-xs bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg px-3 py-2 mb-4">
        <CheckCircle2 size={14} />
        <span>Signed in as <strong>{currentUser?.email}</strong>.</span>
        <button onClick={() => void signout()} className="ml-auto font-semibold hover:underline">Sign out</button>
      </div>
    );
  }
  return (
    <form onSubmit={handleSignIn} className="flex flex-wrap items-center gap-2 text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded-lg px-3 py-2 mb-4">
      <ShieldAlert size={14} className="flex-shrink-0" />
      <span className="font-semibold mr-2">Sign in required to load the call queue</span>
      <input type="email" required placeholder="you@camelot.nyc" value={email} onChange={(e) => setEmail(e.target.value)} className="border rounded px-2 py-1 text-xs w-48" />
      <input type="password" required placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="border rounded px-2 py-1 text-xs w-40" />
      <button type="submit" disabled={submitting} className="flex items-center gap-1 px-3 py-1 rounded bg-amber-800 text-white font-semibold disabled:opacity-50">
        {submitting ? <RefreshCw size={12} className="animate-spin" /> : <LogIn size={12} />} Sign in
      </button>
      {error && <span className="text-red-700">{error}</span>}
    </form>
  );
}

interface CallLog {
  id: number;
  call_type: 'human' | 'ai_voice';
  caller: string | null;
  outcome: string | null;
  notes: string | null;
  called_at: string | null;
  created_at: string;
}

interface QueueLead {
  id: number;
  address: string;
  borough: string | null;
  units_total: number | null;
  management_contact_name: string | null;
  management_contact_role: string | null;
  dob_owner_name: string | null;
  dob_filer_phone: string | null;
  contact_email: string | null;
  contact_phone_manual: string | null;
  sent_at: string | null;
  calls: CallLog[];
}

const OUTCOME_LABELS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Pending', cls: 'bg-slate-100 text-slate-600' },
  no_answer: { label: 'No Answer', cls: 'bg-slate-100 text-slate-600' },
  voicemail: { label: 'Voicemail', cls: 'bg-slate-100 text-slate-600' },
  wrong_number: { label: 'Wrong Number', cls: 'bg-red-100 text-red-700' },
  confirmed_owner_meeting_requested: { label: 'Owner — Meeting Requested', cls: 'bg-emerald-100 text-emerald-700' },
  confirmed_owner_not_interested: { label: 'Owner — Not Interested', cls: 'bg-amber-100 text-amber-700' },
  confirmed_owner_callback_requested: { label: 'Owner — Callback Later', cls: 'bg-blue-100 text-blue-700' },
  not_owner_or_board: { label: 'Not Owner/Board', cls: 'bg-amber-100 text-amber-700' },
  declined_to_verify: { label: 'Declined to Verify', cls: 'bg-amber-100 text-amber-700' },
  do_not_call_requested: { label: 'Do Not Call', cls: 'bg-red-100 text-red-700' },
};

export default function CallQueue() {
  const [queue, setQueue] = useState<QueueLead[]>([]);
  const [loading, setLoading] = useState(false);
  // Defaults to false (safe/conservative) until the server confirms
  // otherwise — never show "AI calls allowed" before we actually know.
  const [withinHours, setWithinHours] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<number, string>>({});
  const [scriptOpen, setScriptOpen] = useState(false);
  const [humanScript, setHumanScript] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await authenticatedApiFetch('/api/leads/call-queue');
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || 'Failed to load call queue');
      setQueue(data.queue || []);
      setWithinHours(!!data.aiCallingWithinHoursNow);
      setHumanScript(data.humanScript || '');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load call queue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const logCall = async (lead: QueueLead, callType: 'human' | 'ai_voice', outcome: string) => {
    setBusyId(lead.id);
    try {
      const resp = await authenticatedApiFetch(`/api/leads/${lead.id}/calls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ call_type: callType, outcome, notes: notesDraft[lead.id] || '' }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        if (data?.code === 'OUTSIDE_CALLING_HOURS') {
          toast.error('AI calls only run Mon–Fri, 9am–5pm ET. Try a human call instead, or wait.');
        } else {
          throw new Error(data?.error || 'Failed to log call');
        }
        return;
      }
      toast.success('Call outcome logged');
      setNotesDraft((prev) => ({ ...prev, [lead.id]: '' }));
      await load();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to log call');
    } finally {
      setBusyId(null);
    }
  };

  const requestAiPrompt = async (lead: QueueLead) => {
    setBusyId(lead.id);
    try {
      const resp = await authenticatedApiFetch(`/api/leads/${lead.id}/ai-call-prompt`);
      const data = await resp.json();
      if (!resp.ok) {
        if (data?.code === 'OUTSIDE_CALLING_HOURS') {
          toast.error('AI calls only run Mon–Fri, 9am–5pm ET.');
        } else {
          throw new Error(data?.error || 'Failed to build AI call prompt');
        }
        return;
      }
      await navigator.clipboard.writeText(data.prompt);
      toast.success('AI call prompt copied — paste into your calling connection (e.g. Wing) to place the call, then log the outcome here.');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to build AI call prompt');
    } finally {
      setBusyId(null);
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
            <Phone size={24} />
          </span>
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-camelot-gold font-bold">Business Development</div>
            <h1 className="font-heading text-3xl text-slate-950">Call Queue</h1>
          </div>
        </div>
        <p className="text-slate-600 mt-4 max-w-4xl leading-relaxed">
          Owner-verified follow-up calls only — every lead here has an already-sent intro email and a contact
          confirmed to be the actual property owner or board member (never a management company). This is a
          short verification call, not a sales pitch: confirm the email arrived, confirm they're the owner/board
          member, and only then ask about a meeting with a Camelot executive.
        </p>
      </div>

      <main className="px-8 py-8">
        <SignInBar />
        <div className={`flex items-center gap-2 text-xs font-semibold rounded-lg px-3 py-2 border mb-6 ${
          withinHours ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'
        }`}>
          <Clock size={14} />
          {withinHours
            ? 'Within AI calling hours right now (Mon–Fri, 9am–5pm ET) — AI call attempts are allowed.'
            : 'Outside AI calling hours (Mon–Fri, 9am–5pm ET only) — AI call attempts are blocked until then. Human calls use your own judgment.'}
        </div>

        <div className="bg-white rounded-2xl border border-[#A89035]/40 mb-6 overflow-hidden">
          <button onClick={() => setScriptOpen((v) => !v)} className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-slate-50">
            <span className="w-9 h-9 rounded-xl bg-camelot-gold/15 text-camelot-gold flex items-center justify-center shrink-0"><FileText size={18} /></span>
            <span className="flex-1">
              <span className="text-sm font-bold text-slate-900">Verification call script</span>
              <span className="text-xs text-slate-500 block">Confirm email → verify owner/board → qualify for a meeting. Click to {scriptOpen ? 'hide' : 'read'}.</span>
            </span>
            {scriptOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
          </button>
          {scriptOpen && (
            <pre className="px-5 pb-5 pt-1 border-t border-slate-100 text-xs text-slate-700 whitespace-pre-wrap font-mono leading-relaxed max-h-96 overflow-y-auto">{humanScript}</pre>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="text-sm font-bold text-slate-700">{queue.length} owner-verified lead{queue.length === 1 ? '' : 's'} ready to call</div>
            <button onClick={() => void load()} disabled={loading} className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1">
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>

          {queue.length === 0 ? (
            <div className="p-10 text-center text-slate-400 text-sm">
              {loading ? 'Loading…' : 'Nothing here yet — leads appear once an intro email has been sent to a verified owner/board contact.'}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {queue.map((lead) => {
                const isExpanded = expandedId === lead.id;
                const lastCall = lead.calls[0];
                const phone = lead.contact_phone_manual || lead.dob_filer_phone || null;
                return (
                  <div key={lead.id}>
                    <button onClick={() => setExpandedId(isExpanded ? null : lead.id)} className="w-full flex items-center gap-4 px-5 py-3.5 text-left hover:bg-slate-50">
                      <Building2 size={16} className="text-camelot-gold shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-slate-900 truncate">{lead.address}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                          <span className="flex items-center gap-1"><MapPin size={11} />{lead.borough}</span>
                          <span>{lead.units_total || '?'} units</span>
                          <span>· {lead.management_contact_name || lead.dob_owner_name} ({lead.management_contact_role || 'Owner'})</span>
                        </div>
                      </div>
                      {lastCall && (
                        <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full ${OUTCOME_LABELS[lastCall.outcome || 'pending']?.cls || 'bg-slate-100 text-slate-600'}`}>
                          {OUTCOME_LABELS[lastCall.outcome || 'pending']?.label || lastCall.outcome}
                        </span>
                      )}
                      {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                    </button>

                    {isExpanded && (
                      <div className="px-5 pb-5 bg-slate-50/60 space-y-4">
                        <div className="bg-white rounded-xl border border-slate-200 p-4 text-sm space-y-1.5">
                          <div className="font-bold text-slate-700 text-xs uppercase tracking-wide mb-2">Verified Owner Contact</div>
                          <div><span className="text-slate-500">Name:</span> {lead.management_contact_name || lead.dob_owner_name || '—'}</div>
                          <div><span className="text-slate-500">Email:</span> {lead.contact_email || '—'} <span className="text-emerald-700 text-xs">(intro sent {lead.sent_at ? new Date(lead.sent_at).toLocaleDateString() : ''})</span></div>
                          <div><span className="text-slate-500">Phone:</span> {phone || '— (not on file — look up before calling)'} {lead.dob_filer_phone && !lead.contact_phone_manual && <span className="text-amber-600 text-xs">(DOB filer's phone — verify this reaches the owner before relying on it)</span>}</div>
                        </div>

                        {lead.calls.length > 0 && (
                          <div className="bg-white rounded-xl border border-slate-200 p-4 text-xs space-y-2">
                            <div className="font-bold text-slate-700 uppercase tracking-wide mb-1">Call History</div>
                            {lead.calls.map((c) => (
                              <div key={c.id} className="flex items-center gap-2 text-slate-600">
                                {c.call_type === 'ai_voice' ? <Bot size={12} /> : <User size={12} />}
                                <span className={`font-semibold px-1.5 py-0.5 rounded ${OUTCOME_LABELS[c.outcome || 'pending']?.cls || 'bg-slate-100'}`}>{OUTCOME_LABELS[c.outcome || 'pending']?.label || c.outcome}</span>
                                <span className="text-slate-400">{new Date(c.created_at).toLocaleString()}</span>
                                {c.notes && <span className="text-slate-500 italic">— {c.notes}</span>}
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                          <div className="font-bold text-slate-700 text-xs uppercase tracking-wide">Log a Call</div>
                          <textarea
                            value={notesDraft[lead.id] || ''}
                            onChange={(e) => setNotesDraft((prev) => ({ ...prev, [lead.id]: e.target.value }))}
                            placeholder="Notes (what they said, any callback number, etc.)"
                            rows={2}
                            className="w-full border rounded-lg px-3 py-2 text-xs"
                          />
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1"><User size={11} /> Human call —</span>
                            {Object.entries(OUTCOME_LABELS).filter(([k]) => k !== 'pending').map(([k, v]) => (
                              <button
                                key={k}
                                onClick={() => void logCall(lead, 'human', k)}
                                disabled={busyId === lead.id}
                                className={`text-[10px] font-bold px-2 py-1 rounded-lg border hover:opacity-80 disabled:opacity-50 ${v.cls}`}
                              >
                                {v.label}
                              </button>
                            ))}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1"><Bot size={11} /> AI voice call —</span>
                            <button
                              onClick={() => void requestAiPrompt(lead)}
                              disabled={busyId === lead.id || !withinHours}
                              title={!withinHours ? 'Only available Mon-Fri 9am-5pm ET' : 'Copies the AI call prompt for your calling connection'}
                              className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-[#1a2744] text-white hover:bg-[#26375c] disabled:opacity-50"
                            >
                              <PhoneCall size={11} /> Get AI Call Prompt
                            </button>
                            {!withinHours && <span className="text-[10px] text-amber-700 flex items-center gap-1"><ShieldAlert size={11} /> Blocked outside calling hours</span>}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-6 bg-white rounded-2xl border border-slate-200 p-5 text-xs text-slate-500 flex items-start gap-2">
          <MessageSquare size={14} className="shrink-0 mt-0.5" />
          <span>
            Texting is opt-in only — a lead only receives SMS after replying &ldquo;YES&rdquo; to the intro email or
            texting START. No cold texts are ever sent. Anyone who says &ldquo;do not call&rdquo; is permanently
            removed from calls, texts, and future emails.
          </span>
        </div>
      </main>
    </div>
  );
}
