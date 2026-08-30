/**
 * Neighborhood Leads Engine — API routes.
 *
 * GET  /api/leads                          — list/filter leads
 * GET  /api/leads/:id                      — single lead detail + event history
 * POST /api/leads/search                   — run a new city-wide (or borough-scoped) PLUTO+HPD search, upsert results
 * GET  /api/leads/runs                     — recent search-run history
 * POST /api/leads/:id/draft                — generate the intro email draft (+ pitch deck HTML) for staff review
 * PATCH /api/leads/:id/draft                — staff edits the draft before approval
 * PATCH /api/leads/:id/contact              — staff manually enters email/name/title/phone/company (Needs Email queue)
 * POST /api/leads/:id/approve               — staff approves the draft (required before send)
 * POST /api/leads/:id/send                  — send the approved email (Resend) with the deck PDF attached;
 *                                              on success: push to HubSpot "Camelot Neighborhood Leads" pipeline
 *                                              + schedule the 4-day follow-up task
 *                                              Enforces the daily send cap (see DAILY_SEND_CAP below) server-side.
 * GET  /api/leads/send-limit               — today's send count + cap, for the UI banner
 * POST /api/leads/:id/follow-up/complete    — mark the 4-day follow-up as done
 * POST /api/hubspot/pipelines/ensure-neighborhood-leads — idempotently create the dedicated HubSpot pipeline
 * POST /api/leads/daily-report/run          — manually trigger today's daily report email (also runs automatically, see startDailyReportScheduler)
 *
 * Call Queue + SMS consent (per David, Aug 2026 — see call-scripts.mjs):
 * GET  /api/leads/call-queue                — owner-verified (is_owner_contact=true), already-sent leads ready for a follow-up call
 * POST /api/leads/:id/calls                 — log a call attempt (human or ai_voice); AI attempts are hard-refused outside Mon-Fri 9am-5pm ET
 * GET  /api/leads/:id/ai-call-prompt        — fully-built AI voice-agent system prompt for one lead (for an external calling connection)
 * POST /api/leads/:id/sms-consent/request   — mark that an opt-in was requested for a phone number
 * POST /api/leads/:id/sms-consent/opt-in    — record affirmative SMS opt-in (required before any text send — no cold texting)
 * POST /api/leads/:id/sms-consent/opt-out   — record STOP/opt-out
 *
 * All routes sit behind requireApiUser (mounted the same way as
 * /api/portfolio in server.js) — HubSpot/Resend/NYC Open Data credentials
 * are server-only.
 *
 * Draft-approval gate (per David, Aug 2026): a lead can only be sent after
 * `approved_at` is set via POST /:id/approve. The send route enforces this
 * server-side, not just in the UI, so the workflow can't be bypassed by a
 * direct API call either.
 *
 * Daily send cap + reporting (per David, Aug 2026): a young sending domain
 * gets flagged for spam if it suddenly blasts out hundreds of cold emails a
 * day. DAILY_SEND_CAP keeps outbound volume conservative (20-30/day) while
 * the domain builds reputation; raise it gradually as deliverability proves
 * out (check Resend's domain health dashboard before increasing). The cap
 * is enforced here, server-side, via neighborhood_send_daily_counter — not
 * just disabled in the UI — so it can't be bypassed by a direct API call.
 * Every night, a report of what was sent (and what's still waiting on a
 * human to add an email) goes to info@camelot.nyc automatically.
 */

import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { runCitywideLeadSearch } from './leads-search.mjs';
import { HUMAN_CALL_SCRIPT, buildAiVoiceCallPrompt, buildSmsOptInConfirmation } from './call-scripts.mjs';

/* global console, process, setInterval, setTimeout, Buffer */

const router = express.Router();

// Conservative daily cap for cold outbound intro emails (per David, Aug
// 2026) — keeps a young sending domain from tripping spam filters. Revisit
// upward only after checking Resend's domain deliverability metrics.
const DAILY_SEND_CAP = 25;
const DAILY_REPORT_RECIPIENT = 'info@camelot.nyc';

let supabaseInstance = null;
function getSupabase() {
  if (!supabaseInstance) {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      || process.env.SUPABASE_ANON_KEY
      || process.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Leads database is not configured (SUPABASE_URL / key missing).');
    }
    supabaseInstance = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return supabaseInstance;
}

/** Today's date key (UTC calendar day) used for the daily send cap + report log. */
function todayDateKey() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Business-hours gate for AI-voice calls (per David, Aug 2026): Mon-Fri,
 * 9:00 AM-5:00 PM ONLY. Human-placed calls are not gated here — a staff
 * member exercises their own judgment on timing; this specifically
 * constrains the AI-initiated call path, where there is no human in the
 * loop to catch a bad-timing mistake.
 *
 * Uses `tz` (IANA zone, e.g. 'America/New_York') as the reference clock —
 * defaults to Eastern (Camelot's own business hours) when the recipient's
 * local time zone isn't known, since NYC property records don't carry one.
 * This is a conservative default, not a guarantee of the recipient's actual
 * local time — see dataGaps-style disclosure in the Call Queue UI.
 */
function isWithinAiCallingHours(date = new Date(), tz = 'America/New_York') {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    hour12: false,
    weekday: 'short',
  }).formatToParts(date);
  const weekday = parts.find((p) => p.type === 'weekday')?.value;
  const hour = Number(parts.find((p) => p.type === 'hour')?.value);
  const isWeekday = !['Sat', 'Sun'].includes(weekday);
  const isBusinessHour = hour >= 9 && hour < 17;
  return isWeekday && isBusinessHour;
}

/**
 * Atomically claims one "send slot" for today against DAILY_SEND_CAP.
 * Returns { allowed, sentToday, cap }. Uses a Postgres upsert + conditional
 * update rather than read-then-write so two near-simultaneous sends can't
 * both slip through past the cap (classic check-then-act race).
 */
async function claimDailySendSlot(supabase) {
  const dateKey = todayDateKey();

  // Ensure today's row exists (no-op if it already does).
  await supabase
    .from('neighborhood_send_daily_counter')
    .upsert({ send_date: dateKey }, { onConflict: 'send_date', ignoreDuplicates: true });

  const { data: row, error: readError } = await supabase
    .from('neighborhood_send_daily_counter')
    .select('sent_count')
    .eq('send_date', dateKey)
    .single();
  if (readError) throw readError;

  if ((row?.sent_count || 0) >= DAILY_SEND_CAP) {
    return { allowed: false, sentToday: row.sent_count, cap: DAILY_SEND_CAP };
  }

  // Conditional increment: only succeeds if sent_count hasn't moved past the
  // cap since the read above (still narrows but doesn't eliminate the race
  // under extreme concurrency — acceptable here since sends are a manual,
  // one-at-a-time staff action, not a bulk-fire path).
  const { data: updated, error: updateError } = await supabase
    .from('neighborhood_send_daily_counter')
    .update({ sent_count: (row?.sent_count || 0) + 1, updated_at: new Date().toISOString() })
    .eq('send_date', dateKey)
    .lt('sent_count', DAILY_SEND_CAP)
    .select('sent_count')
    .single();
  if (updateError || !updated) {
    return { allowed: false, sentToday: row?.sent_count || DAILY_SEND_CAP, cap: DAILY_SEND_CAP };
  }
  return { allowed: true, sentToday: updated.sent_count, cap: DAILY_SEND_CAP };
}

async function logEvent(supabase, leadId, eventType, actor, detail) {
  try {
    await supabase.from('neighborhood_lead_events').insert({
      lead_id: leadId,
      event_type: eventType,
      actor: actor || 'system',
      detail: detail || null,
    });
  } catch (err) {
    console.error('[Leads] event log failed:', err.message);
  }
}

/**
 * Factory: leads-routes needs several HubSpot/email helpers that already
 * live in server.js (getHubSpotApiKey, hubspotRequest, hubspotObjectWrite,
 * cleanProperties, searchHubSpotObject, getResendApiKey, getResendFromAddress).
 * Rather than duplicate ~150 lines of proxy/auth logic, server.js passes
 * them in here so there is exactly one HubSpot/Resend client implementation
 * in the app.
 */
export default function createLeadsRouter(deps) {
  const {
    getHubSpotApiKey,
    hubspotRequest,
    hubspotObjectWrite,
    searchHubSpotObject,
    cleanProperties,
    getResendApiKey,
    getResendFromAddress,
  } = deps;

  // ---------------------------------------------------------------------
  // GET /api/leads
  // ---------------------------------------------------------------------
  router.get('/leads', async (req, res) => {
    try {
      const supabase = getSupabase();
      const { status, borough, minUnits, search, limit = '200', offset = '0' } = req.query;

      let query = supabase.from('neighborhood_leads').select('*', { count: 'exact' });
      if (status) query = query.eq('status', status);
      if (borough) query = query.eq('borough', borough);
      if (minUnits) query = query.gte('units_total', Number(minUnits));
      if (search) {
        const term = String(search).trim();
        query = query.or(`address.ilike.%${term}%,owner_name.ilike.%${term}%,management_company.ilike.%${term}%`);
      }
      query = query
        .order('discovered_at', { ascending: false })
        .range(Number(offset), Number(offset) + Number(limit) - 1);

      const { data, error, count } = await query;
      if (error) {
        if (/relation .* does not exist/i.test(error.message)) {
          return res.status(503).json({ error: 'Leads schema not deployed.', code: 'MIGRATION_REQUIRED', message: 'Run supabase/migrations/021_neighborhood_leads.sql, then reload.' });
        }
        throw error;
      }
      res.json({ leads: data || [], total: count || 0 });
    } catch (error) {
      console.error('[Leads] list error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ---------------------------------------------------------------------
  // GET /api/leads/runs
  // ---------------------------------------------------------------------
  router.get('/leads/runs', async (_req, res) => {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('neighborhood_lead_runs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(25);
      if (error) throw error;
      res.json({ runs: data || [] });
    } catch (error) {
      console.error('[Leads] runs error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ---------------------------------------------------------------------
  // GET /api/leads/send-limit — today's send count vs. the daily cap, for
  // the "X of Y sent today" banner in the UI.
  // ---------------------------------------------------------------------
  router.get('/leads/send-limit', async (_req, res) => {
    try {
      const supabase = getSupabase();
      const dateKey = todayDateKey();
      const { data, error } = await supabase
        .from('neighborhood_send_daily_counter')
        .select('sent_count')
        .eq('send_date', dateKey)
        .maybeSingle();
      if (error) throw error;
      res.json({ date: dateKey, sentToday: data?.sent_count || 0, cap: DAILY_SEND_CAP, remaining: Math.max(0, DAILY_SEND_CAP - (data?.sent_count || 0)) });
    } catch (error) {
      console.error('[Leads] send-limit error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ---------------------------------------------------------------------
  // GET /api/leads/:id
  // ---------------------------------------------------------------------
  router.get('/leads/:id', async (req, res) => {
    try {
      const supabase = getSupabase();
      const { data: lead, error } = await supabase.from('neighborhood_leads').select('*').eq('id', req.params.id).single();
      if (error || !lead) return res.status(404).json({ error: 'Lead not found.' });
      const { data: events } = await supabase
        .from('neighborhood_lead_events')
        .select('*')
        .eq('lead_id', req.params.id)
        .order('created_at', { ascending: false });
      res.json({ lead, events: events || [] });
    } catch (error) {
      console.error('[Leads] detail error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ---------------------------------------------------------------------
  // POST /api/leads/search
  // body: { minUnits?: number, borough?: 'MN'|'BK'|'QN'|'BX'|'SI', limit?: number }
  // ---------------------------------------------------------------------
  router.post('/leads/search', async (req, res) => {
    const supabase = getSupabase();
    const { minUnits = 10, borough = null, limit = 5000 } = req.body || {};
    const triggeredBy = req.camelotUser?.email || req.camelotUser?.id || 'api';

    let runRow;
    try {
      const scope = borough ? `borough:${borough}` : 'citywide_10plus_units';
      const { data, error } = await supabase
        .from('neighborhood_lead_runs')
        .insert({
          id: `run_${new Date().toISOString().replace(/[:.]/g, '-')}`,
          scope,
          criteria: { minUnits, borough, limit },
          status: 'running',
        })
        .select()
        .single();
      if (error) throw error;
      runRow = data;
    } catch (error) {
      console.error('[Leads] run-row create failed:', error);
      return res.status(500).json({ error: error.message });
    }

    try {
      console.log(`[Leads] search started by ${triggeredBy}: minUnits=${minUnits} borough=${borough || 'ALL'}`);

      // Pull Camelot's live managed portfolio (synced from Spire MDS + RealtyMX
      // — see portfolio-sync.mjs) as the anchor set for same-block/across-street
      // matching. A search still runs even if this fails (falls back to a bare
      // city-wide list with relationship left null on every lead) rather than
      // blocking the whole search on the portfolio table being reachable.
      let anchorBuildings = [];
      try {
        const { data: anchors, error: anchorsError } = await supabase
          .from('buildings')
          .select('id, building_name, address, city, is_active')
          .eq('is_active', true);
        if (anchorsError) throw anchorsError;
        anchorBuildings = (anchors || []).filter((a) => a.address);
      } catch (anchorErr) {
        console.error('[Leads] failed to load anchor buildings, continuing without neighbor tagging:', anchorErr.message);
      }

      const result = await runCitywideLeadSearch({ minUnits, borough, limit, anchorBuildings });

      let leadsNew = 0;
      let leadsUpdated = 0;
      // Upsert in chunks to keep individual requests small.
      const CHUNK = 200;
      for (let i = 0; i < result.leads.length; i += CHUNK) {
        const chunk = result.leads.slice(i, i + CHUNK).map((l) => ({ ...l, source_run_id: runRow.id }));
        const { data: upserted, error: upsertError } = await supabase
          .from('neighborhood_leads')
          .upsert(chunk, { onConflict: 'bbl', ignoreDuplicates: false })
          .select('id, bbl, created_at, updated_at');
        if (upsertError) {
          console.error('[Leads] upsert chunk failed:', upsertError.message);
          continue;
        }
        for (const row of upserted || []) {
          if (row.created_at === row.updated_at) leadsNew += 1;
          else leadsUpdated += 1;
        }
      }

      await supabase
        .from('neighborhood_lead_runs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          leads_found: result.leads.length,
          leads_new: leadsNew,
          leads_updated: leadsUpdated,
          notes: result.dataGaps.join(' | '),
        })
        .eq('id', runRow.id);

      res.json({ runId: runRow.id, summary: result.summary, anchorResolution: result.anchorResolution, dataGaps: result.dataGaps, leadsNew, leadsUpdated });
    } catch (error) {
      console.error('[Leads] search error:', error);
      await supabase.from('neighborhood_lead_runs').update({ status: 'failed', completed_at: new Date().toISOString(), error_message: error.message }).eq('id', runRow.id);
      res.status(500).json({ error: error.message, runId: runRow.id });
    }
  });

  // ---------------------------------------------------------------------
  // POST /api/leads/:id/draft — generate (or regenerate) the intro email draft
  // body: { pitchDeckHtml: string, pitchDeckFilename: string, senderName?: string, bookingLink?: string }
  // The caller (frontend) builds the actual deck HTML via generatePartnerPitchDeck('neighbor', ...)
  // and passes it here so this route stays presentation-agnostic and doesn't
  // duplicate the deck template in two languages (TS on the client, JS here).
  // ---------------------------------------------------------------------
  router.post('/leads/:id/draft', async (req, res) => {
    try {
      const supabase = getSupabase();
      const { data: lead, error } = await supabase.from('neighborhood_leads').select('*').eq('id', req.params.id).single();
      if (error || !lead) return res.status(404).json({ error: 'Lead not found.' });

      const { subject, bodyHtml } = req.body || {};
      if (!subject || !bodyHtml) return res.status(400).json({ error: 'subject and bodyHtml are required (generate them client-side and pass in for storage).' });

      const { data: updated, error: updateError } = await supabase
        .from('neighborhood_leads')
        .update({
          draft_subject: subject,
          draft_body_html: bodyHtml,
          draft_generated_at: new Date().toISOString(),
          status: lead.status === 'new' ? 'draft_ready' : lead.status,
        })
        .eq('id', req.params.id)
        .select()
        .single();
      if (updateError) throw updateError;

      await logEvent(supabase, req.params.id, 'draft_generated', req.camelotUser?.email, { subject });
      res.json({ lead: updated });
    } catch (error) {
      console.error('[Leads] draft generate error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ---------------------------------------------------------------------
  // PATCH /api/leads/:id/draft — staff edits the draft before approval
  // ---------------------------------------------------------------------
  router.patch('/leads/:id/draft', async (req, res) => {
    try {
      const supabase = getSupabase();
      const { subject, bodyHtml } = req.body || {};
      const patch = {};
      if (subject !== undefined) patch.draft_subject = subject;
      if (bodyHtml !== undefined) patch.draft_body_html = bodyHtml;
      if (Object.keys(patch).length === 0) return res.status(400).json({ error: 'Nothing to update.' });

      const { data: updated, error } = await supabase.from('neighborhood_leads').update(patch).eq('id', req.params.id).select().single();
      if (error) throw error;

      await logEvent(supabase, req.params.id, 'draft_edited', req.camelotUser?.email, patch);
      res.json({ lead: updated });
    } catch (error) {
      console.error('[Leads] draft edit error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ---------------------------------------------------------------------
  // PATCH /api/leads/:id/contact — staff manually fills in send-to contact
  // info from the "Needs Email" queue page: email (required to unblock a
  // send), plus optional name/title/phone/company when NYC Open Data didn't
  // have them. Writes to the *_manual columns (contact_title,
  // contact_name_manual, contact_phone_manual, contact_company_manual) so
  // the automated PLUTO/HPD-sourced fields are never overwritten — the
  // manual entry is layered on top, and the UI/report prefer it when set.
  // ---------------------------------------------------------------------
  router.patch('/leads/:id/contact', async (req, res) => {
    try {
      const supabase = getSupabase();
      const { email, name, title, phone, company } = req.body || {};
      if (email !== undefined && email !== null && email !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
        return res.status(400).json({ error: 'That does not look like a valid email address.' });
      }

      const patch = {
        contact_entered_by: req.camelotUser?.email || req.camelotUser?.id || 'unknown',
        contact_entered_at: new Date().toISOString(),
      };
      if (email !== undefined) patch.contact_email = String(email).trim() || null;
      if (name !== undefined) patch.contact_name_manual = String(name).trim() || null;
      if (title !== undefined) patch.contact_title = String(title).trim() || null;
      if (phone !== undefined) patch.contact_phone_manual = String(phone).trim() || null;
      if (company !== undefined) patch.contact_company_manual = String(company).trim() || null;

      const { data: updated, error } = await supabase.from('neighborhood_leads').update(patch).eq('id', req.params.id).select().single();
      if (error) throw error;

      await logEvent(supabase, req.params.id, 'contact_entered_manually', patch.contact_entered_by, { email: patch.contact_email, name, title, phone, company });
      res.json({ lead: updated });
    } catch (error) {
      console.error('[Leads] manual contact entry error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ---------------------------------------------------------------------
  // POST /api/leads/:id/approve — required before /send will work
  // ---------------------------------------------------------------------
  router.post('/leads/:id/approve', async (req, res) => {
    try {
      const supabase = getSupabase();
      const { data: lead, error } = await supabase.from('neighborhood_leads').select('*').eq('id', req.params.id).single();
      if (error || !lead) return res.status(404).json({ error: 'Lead not found.' });
      if (!lead.draft_subject || !lead.draft_body_html) {
        return res.status(400).json({ error: 'Generate a draft before approving.' });
      }

      const approver = req.camelotUser?.email || req.camelotUser?.id || 'unknown';
      const { data: updated, error: updateError } = await supabase
        .from('neighborhood_leads')
        .update({ status: 'approved', approved_by: approver, approved_at: new Date().toISOString() })
        .eq('id', req.params.id)
        .select()
        .single();
      if (updateError) throw updateError;

      await logEvent(supabase, req.params.id, 'approved', approver, null);
      res.json({ lead: updated });
    } catch (error) {
      console.error('[Leads] approve error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ---------------------------------------------------------------------
  // POST /api/leads/:id/send
  // body: { to: string, attachmentBase64: string, attachmentFilename: string,
  //         attachment2Base64?: string, attachment2Filename?: string }
  // The PDF attachment(s) are generated client-side (same generatePdfBase64
  // path used by Partner Pitches / Instant Proposal) and posted here as
  // base64, matching the existing sendCamelotEmail() contract — this route
  // does not render PDFs itself. The optional second attachment is a PDF
  // copy of the email body itself (added per David's request, Aug 2026) so
  // the branded letter is also available as a standalone file, alongside
  // the full pitch-deck attachment.
  // ---------------------------------------------------------------------
  router.post('/leads/:id/send', async (req, res) => {
    try {
      const supabase = getSupabase();
      const { data: lead, error } = await supabase.from('neighborhood_leads').select('*').eq('id', req.params.id).single();
      if (error || !lead) return res.status(404).json({ error: 'Lead not found.' });

      if (lead.status !== 'approved') {
        return res.status(409).json({ error: `Lead must be approved before sending (current status: ${lead.status}). Approve the draft first.` });
      }

      const { to, attachmentBase64, attachmentFilename, attachment2Base64, attachment2Filename } = req.body || {};
      if (!to || !attachmentBase64 || !attachmentFilename) {
        return res.status(400).json({ error: 'to, attachmentBase64, and attachmentFilename are required.' });
      }

      const resendKey = getResendApiKey();
      if (!resendKey) return res.status(400).json({ error: 'Email sending is not configured (RESEND_API_KEY missing).' });

      // Daily send cap (per David, Aug 2026) — claimed BEFORE calling Resend
      // so we never send an email we then fail to count. If Resend itself
      // fails after the slot is claimed, that's one slot "spent" on a
      // failed attempt, which is the safer failure mode for a compliance
      // cap (undercounting real sends is the risk to avoid, not overcounting).
      const slot = await claimDailySendSlot(supabase);
      if (!slot.allowed) {
        return res.status(429).json({
          error: `Daily send limit reached (${slot.sentToday}/${slot.cap} sent today). This keeps our sending domain's reputation healthy — more sends will unlock tomorrow.`,
          code: 'DAILY_SEND_CAP_REACHED',
          sentToday: slot.sentToday,
          cap: slot.cap,
        });
      }

      const attachments = [{ filename: attachmentFilename, content: attachmentBase64 }];
      if (attachment2Base64 && attachment2Filename) {
        attachments.push({ filename: attachment2Filename, content: attachment2Base64 });
      }

      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}` },
        body: JSON.stringify({
          from: getResendFromAddress(),
          to: [to],
          subject: lead.draft_subject,
          html: lead.draft_body_html,
          reply_to: 'dgoldoff@camelot.nyc',
          attachments,
        }),
      });
      const sendData = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        return res.status(resp.status).json({ error: sendData?.message || `Resend returned ${resp.status}` });
      }

      const sentAt = new Date().toISOString();
      const followUpDueAt = new Date(Date.now() + 4 * 86_400_000).toISOString();
      const sentBy = req.camelotUser?.email || req.camelotUser?.id || 'unknown';

      const { data: updated, error: updateError } = await supabase
        .from('neighborhood_leads')
        .update({
          status: 'sent',
          sent_at: sentAt,
          sent_by: sentBy,
          resend_message_id: sendData.id,
          contact_email: to,
          follow_up_due_at: followUpDueAt,
        })
        .eq('id', req.params.id)
        .select()
        .single();
      if (updateError) throw updateError;

      await logEvent(supabase, req.params.id, 'sent', sentBy, { to, resendMessageId: sendData.id });

      // --- HubSpot: push Company + Contact + Deal into the dedicated
      // "Camelot Neighborhood Leads" pipeline, then create the 4-day follow-up task.
      let hubspotResult = { status: 'skipped', message: 'HubSpot API key not configured.' };
      const hubspotKey = getHubSpotApiKey();
      if (hubspotKey) {
        try {
          hubspotResult = await pushLeadToHubSpotPipeline(updated, { hubspotRequest, hubspotObjectWrite, searchHubSpotObject, cleanProperties });
          if (hubspotResult.status === 'ok') {
            await supabase
              .from('neighborhood_leads')
              .update({
                status: 'follow_up_scheduled',
                hubspot_company_id: hubspotResult.companyId,
                hubspot_contact_id: hubspotResult.contactId,
                hubspot_deal_id: hubspotResult.dealId,
                hubspot_task_id: hubspotResult.taskId,
                hubspot_synced_at: new Date().toISOString(),
              })
              .eq('id', req.params.id);
            await logEvent(supabase, req.params.id, 'hubspot_synced', 'system', hubspotResult);
            await logEvent(supabase, req.params.id, 'follow_up_created', 'system', { dueAt: followUpDueAt, taskId: hubspotResult.taskId });
          }
        } catch (hsErr) {
          console.error('[Leads] HubSpot sync error:', hsErr);
          hubspotResult = { status: 'error', message: hsErr.message };
        }
      }

      res.json({ lead: updated, resend: { id: sendData.id }, hubspot: hubspotResult, followUpDueAt });
    } catch (error) {
      console.error('[Leads] send error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ---------------------------------------------------------------------
  // POST /api/leads/:id/follow-up/complete
  // ---------------------------------------------------------------------
  router.post('/leads/:id/follow-up/complete', async (req, res) => {
    try {
      const supabase = getSupabase();
      const actor = req.camelotUser?.email || req.camelotUser?.id || 'unknown';
      const { data: updated, error } = await supabase
        .from('neighborhood_leads')
        .update({ follow_up_completed_at: new Date().toISOString() })
        .eq('id', req.params.id)
        .select()
        .single();
      if (error) throw error;
      await logEvent(supabase, req.params.id, 'follow_up_completed', actor, null);
      res.json({ lead: updated });
    } catch (error) {
      console.error('[Leads] follow-up complete error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ---------------------------------------------------------------------
  // POST /api/hubspot/pipelines/ensure-neighborhood-leads
  // Idempotent: creates the "Camelot Neighborhood Leads" deal pipeline with
  // its stages if it doesn't already exist, and returns the IDs either way.
  // ---------------------------------------------------------------------
  router.post('/hubspot/pipelines/ensure-neighborhood-leads', async (_req, res) => {
    try {
      if (!getHubSpotApiKey()) return res.status(400).json({ error: 'HubSpot API key not configured.' });
      const result = await ensureNeighborhoodPipeline(hubspotRequest);
      res.json(result);
    } catch (error) {
      console.error('[Leads] pipeline ensure error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ---------------------------------------------------------------------
  // POST /api/leads/daily-report/run — manually trigger today's daily
  // report email (the same job also runs automatically once a day — see
  // startDailyReportScheduler at the bottom of this file). Safe to call
  // more than once in a day: it's idempotent per calendar date via the
  // neighborhood_daily_reports.report_date unique constraint, so re-running
  // it just re-sends today's report rather than double-counting anything.
  // ---------------------------------------------------------------------
  router.post('/leads/daily-report/run', async (_req, res) => {
    try {
      const result = await runDailyReport({ getResendApiKey, getResendFromAddress, force: true });
      res.json(result);
    } catch (error) {
      console.error('[Leads] manual daily report run error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ---------------------------------------------------------------------
  // GET /api/leads/call-queue — owner-verified leads ready for a follow-up
  // call: intro email already sent, is_owner_contact = true, and no
  // do_not_call_requested outcome on file. This is the ONLY population the
  // Call Queue page and any AI-calling connection may draw from — never a
  // cold, unsent, or non-owner lead.
  // ---------------------------------------------------------------------
  router.get('/leads/call-queue', async (_req, res) => {
    try {
      const supabase = getSupabase();
      const { data: leads, error } = await supabase
        .from('neighborhood_leads')
        .select('*')
        .eq('is_owner_contact', true)
        .not('sent_at', 'is', null)
        .order('sent_at', { ascending: true })
        .limit(500);
      if (error) throw error;

      const leadIds = (leads || []).map((l) => l.id);
      let callsByLead = new Map();
      if (leadIds.length > 0) {
        const { data: calls } = await supabase
          .from('neighborhood_lead_calls')
          .select('*')
          .in('lead_id', leadIds)
          .order('created_at', { ascending: false });
        callsByLead = new Map();
        for (const c of calls || []) {
          if (!callsByLead.has(c.lead_id)) callsByLead.set(c.lead_id, []);
          callsByLead.get(c.lead_id).push(c);
        }
      }

      const queue = (leads || [])
        .map((lead) => ({ ...lead, calls: callsByLead.get(lead.id) || [] }))
        // Exclude anyone who has ever asked not to be contacted again.
        .filter((lead) => !lead.calls.some((c) => c.outcome === 'do_not_call_requested'));

      res.json({
        queue,
        total: queue.length,
        aiCallingWithinHoursNow: isWithinAiCallingHours(),
        humanScript: HUMAN_CALL_SCRIPT,
      });
    } catch (error) {
      console.error('[Leads] call-queue error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ---------------------------------------------------------------------
  // POST /api/leads/:id/calls — log a call attempt (human or AI). Human
  // calls may be logged any time (a rep's own judgment). AI-initiated calls
  // are hard-blocked outside Mon-Fri 9am-5pm — the server refuses to log a
  // *new* ai_voice call attempt (status: 'pending'/'scheduled') outside that
  // window, since that's also the trigger point an external AI-calling
  // connection (e.g. Wing) would hit before actually placing the call.
  // ---------------------------------------------------------------------
  router.post('/leads/:id/calls', async (req, res) => {
    try {
      const supabase = getSupabase();
      const { data: lead, error: leadError } = await supabase.from('neighborhood_leads').select('*').eq('id', req.params.id).single();
      if (leadError || !lead) return res.status(404).json({ error: 'Lead not found.' });
      if (!lead.is_owner_contact) {
        return res.status(409).json({ error: 'This lead is not a verified owner/board contact (is_owner_contact=false) — calls may only be logged for verified owner contacts.' });
      }

      const { call_type, outcome, notes, scheduled_for } = req.body || {};
      if (!call_type || !['human', 'ai_voice'].includes(call_type)) {
        return res.status(400).json({ error: "call_type must be 'human' or 'ai_voice'." });
      }

      const isNewAiAttempt = call_type === 'ai_voice' && (!outcome || outcome === 'pending');
      if (isNewAiAttempt && !isWithinAiCallingHours()) {
        return res.status(409).json({
          error: 'AI voice calls may only be placed Monday-Friday, 9:00 AM-5:00 PM (Eastern). This request falls outside that window and has been refused.',
          code: 'OUTSIDE_CALLING_HOURS',
        });
      }

      const caller = req.camelotUser?.email || req.camelotUser?.id || (call_type === 'ai_voice' ? 'ai_voice_agent' : 'unknown');
      const { data: callRow, error: insertError } = await supabase
        .from('neighborhood_lead_calls')
        .insert({
          lead_id: req.params.id,
          call_type,
          caller,
          scheduled_for: scheduled_for || null,
          called_at: outcome && outcome !== 'pending' ? new Date().toISOString() : null,
          outcome: outcome || 'pending',
          notes: notes || null,
        })
        .select()
        .single();
      if (insertError) throw insertError;

      await logEvent(supabase, req.params.id, 'call_logged', caller, { call_type, outcome: callRow.outcome });

      // do_not_call_requested must immediately and permanently suppress
      // future contact — reflected on the lead itself, not just the call log,
      // so every other surface (Needs Email, send flow, SMS) can check one flag.
      if (outcome === 'do_not_call_requested') {
        await supabase.from('neighborhood_leads').update({ status: 'lost' }).eq('id', req.params.id);
        await logEvent(supabase, req.params.id, 'do_not_call_requested', caller, null);
      }

      res.json({ call: callRow });
    } catch (error) {
      console.error('[Leads] call log error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ---------------------------------------------------------------------
  // GET /api/leads/:id/ai-call-prompt — the fully-built AI voice-agent
  // system prompt for this specific lead (used by an AI-calling connection,
  // e.g. Wing/Emergent, to actually place the call). Refuses outside
  // calling hours for the same reason POST /calls does.
  // ---------------------------------------------------------------------
  router.get('/leads/:id/ai-call-prompt', async (req, res) => {
    try {
      const supabase = getSupabase();
      const { data: lead, error } = await supabase.from('neighborhood_leads').select('*').eq('id', req.params.id).single();
      if (error || !lead) return res.status(404).json({ error: 'Lead not found.' });
      if (!lead.is_owner_contact) {
        return res.status(409).json({ error: 'This lead is not a verified owner/board contact — refusing to generate a call prompt.' });
      }
      if (!isWithinAiCallingHours()) {
        return res.status(409).json({ error: 'Outside AI calling hours (Mon-Fri 9am-5pm ET).', code: 'OUTSIDE_CALLING_HOURS' });
      }
      const prompt = buildAiVoiceCallPrompt({
        leadAddress: lead.address,
        ownerOrContactName: lead.management_contact_name || lead.dob_owner_name || lead.owner_name,
      });
      res.json({ prompt, leadId: lead.id, address: lead.address });
    } catch (error) {
      console.error('[Leads] ai-call-prompt error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ---------------------------------------------------------------------
  // SMS consent — no cold texting. A text may only be sent once
  // consent_status = 'opted_in' for that (lead, phone) pair.
  // ---------------------------------------------------------------------
  router.post('/leads/:id/sms-consent/request', async (req, res) => {
    try {
      const supabase = getSupabase();
      const { phone } = req.body || {};
      if (!phone) return res.status(400).json({ error: 'phone is required.' });
      const { data: row, error } = await supabase
        .from('neighborhood_lead_sms_consent')
        .upsert({ lead_id: req.params.id, phone, consent_status: 'requested', requested_at: new Date().toISOString() }, { onConflict: 'lead_id,phone' })
        .select()
        .single();
      if (error) throw error;
      res.json({ consent: row });
    } catch (error) {
      console.error('[Leads] sms-consent request error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/leads/:id/sms-consent/opt-in', async (req, res) => {
    try {
      const supabase = getSupabase();
      const { phone, source } = req.body || {};
      if (!phone) return res.status(400).json({ error: 'phone is required.' });
      const { data: row, error } = await supabase
        .from('neighborhood_lead_sms_consent')
        .upsert({
          lead_id: req.params.id,
          phone,
          consent_status: 'opted_in',
          consent_source: source || 'unspecified',
          consented_at: new Date().toISOString(),
        }, { onConflict: 'lead_id,phone' })
        .select()
        .single();
      if (error) throw error;
      await logEvent(supabase, req.params.id, 'sms_opted_in', 'system', { phone, source });
      res.json({ consent: row, confirmationMessage: buildSmsOptInConfirmation({ leadAddress: '' }) });
    } catch (error) {
      console.error('[Leads] sms-consent opt-in error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/leads/:id/sms-consent/opt-out', async (req, res) => {
    try {
      const supabase = getSupabase();
      const { phone } = req.body || {};
      if (!phone) return res.status(400).json({ error: 'phone is required.' });
      const { data: row, error } = await supabase
        .from('neighborhood_lead_sms_consent')
        .update({ consent_status: 'opted_out', opted_out_at: new Date().toISOString() })
        .eq('lead_id', req.params.id)
        .eq('phone', phone)
        .select()
        .single();
      if (error) throw error;
      await logEvent(supabase, req.params.id, 'sms_opted_out', 'system', { phone });
      res.json({ consent: row });
    } catch (error) {
      console.error('[Leads] sms-consent opt-out error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

// ---------------------------------------------------------------------------
// Daily report — once a day, email info@camelot.nyc (a) which intro emails
// went out today and to whom, and (b) a CSV of leads still waiting on a
// human to add a contact email (the "Needs Email" queue). Per David, Aug
// 2026. Runs automatically (see startDailyReportScheduler) and can also be
// triggered manually via POST /api/leads/daily-report/run.
// ---------------------------------------------------------------------------

function csvEscape(value) {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function buildNeedsEmailCsv(rows) {
  const header = ['Address', 'Borough', 'Units', 'Owner', 'Management Company', 'Contact Name', 'Title', 'Discovered', 'BBL'];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push([
      r.address, r.borough, r.units_total, r.owner_name,
      r.contact_company_manual || r.management_company,
      r.contact_name_manual || r.management_contact_name,
      r.contact_title || r.management_contact_role,
      r.discovered_at ? new Date(r.discovered_at).toISOString().slice(0, 10) : '',
      r.bbl,
    ].map(csvEscape).join(','));
  }
  return lines.join('\n');
}

async function runDailyReport({ getResendApiKey, getResendFromAddress, force = false }) {
  const supabase = getSupabase();
  const dateKey = todayDateKey();
  const dayStart = `${dateKey}T00:00:00.000Z`;
  const dayEnd = `${dateKey}T23:59:59.999Z`;

  // Idempotency: skip (unless force=true, i.e. a manual re-run) if today's
  // report already went out — protects against double-sends if the server
  // restarts mid-day and the scheduler's setInterval fires again.
  if (!force) {
    const { data: existing } = await supabase
      .from('neighborhood_daily_reports')
      .select('id, status')
      .eq('report_date', dateKey)
      .maybeSingle();
    if (existing) {
      return { status: 'skipped', reason: 'already_sent_today', reportDate: dateKey };
    }
  }

  const [{ data: sentToday, error: sentError }, { data: needsEmail, error: needsError }] = await Promise.all([
    supabase
      .from('neighborhood_leads')
      .select('address, borough, units_total, contact_email, management_contact_name, sent_at, sent_by')
      .gte('sent_at', dayStart)
      .lte('sent_at', dayEnd)
      .order('sent_at', { ascending: true }),
    supabase
      .from('neighborhood_leads')
      .select('address, borough, units_total, owner_name, management_company, management_contact_name, management_contact_role, contact_title, contact_name_manual, contact_company_manual, discovered_at, bbl')
      .or('contact_email.is.null,contact_email.eq.')
      .order('discovered_at', { ascending: false })
      .limit(2000),
  ]);
  if (sentError) throw sentError;
  if (needsError) throw needsError;

  const sentRows = sentToday || [];
  const needsRows = needsEmail || [];

  const sentCount = sentRows.length;
  const needsEmailCount = needsRows.length;

  const sentTableRows = sentRows.length
    ? sentRows.map((r) => `<tr>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${r.address || ''}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${r.contact_email || ''}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${r.management_contact_name || ''}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${r.sent_by || ''}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${r.sent_at ? new Date(r.sent_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''}</td>
      </tr>`).join('')
    : `<tr><td colspan="5" style="padding:10px;color:#888;">No intro emails were sent today.</td></tr>`;

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:680px;margin:0 auto;color:#1a1a1a;">
    <h2 style="font-size:18px;margin:0 0 4px;">Neighborhood Leads — Daily Report</h2>
    <p style="font-size:13px;color:#555;margin:0 0 20px;">${new Date(dateKey).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>

    <h3 style="font-size:14px;margin:0 0 8px;">Sent today: ${sentCount}</h3>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:12px;border-collapse:collapse;margin-bottom:24px;">
      <thead>
        <tr style="background:#f5f0e5;text-align:left;">
          <th style="padding:6px 10px;">Address</th>
          <th style="padding:6px 10px;">Sent To</th>
          <th style="padding:6px 10px;">Contact</th>
          <th style="padding:6px 10px;">Sent By</th>
          <th style="padding:6px 10px;">Time</th>
        </tr>
      </thead>
      <tbody>${sentTableRows}</tbody>
    </table>

    <h3 style="font-size:14px;margin:0 0 8px;">Needs a human to add an email: ${needsEmailCount}</h3>
    <p style="font-size:12px;color:#555;margin:0 0 12px;">
      Full list attached as a CSV. Enter emails (and name/title/phone/company where known) on the
      <strong>Needs Email</strong> page in Camelot OS, then approve and send from there like any other lead.
    </p>
  </div>`;

  let resendMessageId = null;
  let sendStatus = 'sent';
  let errorMessage = null;
  try {
    const resendKey = getResendApiKey();
    if (!resendKey) throw new Error('RESEND_API_KEY not configured — cannot send daily report.');
    const csv = buildNeedsEmailCsv(needsRows);
    const csvBase64 = Buffer.from(csv, 'utf8').toString('base64');
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}` },
      body: JSON.stringify({
        from: getResendFromAddress(),
        to: [DAILY_REPORT_RECIPIENT],
        subject: `Neighborhood Leads Daily Report — ${sentCount} sent, ${needsEmailCount} need an email (${dateKey})`,
        html,
        attachments: [{ filename: `Needs-Email-Queue_${dateKey}.csv`, content: csvBase64 }],
      }),
    });
    const sendData = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(sendData?.message || `Resend returned ${resp.status}`);
    resendMessageId = sendData.id;
  } catch (err) {
    sendStatus = 'failed';
    errorMessage = err.message;
    console.error('[Leads] daily report send failed:', err);
  }

  // Log the run (upsert so a forced manual re-run updates today's row
  // instead of violating the report_date unique constraint).
  await supabase.from('neighborhood_daily_reports').upsert({
    report_date: dateKey,
    sent_count: sentCount,
    needs_email_count: needsEmailCount,
    recipient: DAILY_REPORT_RECIPIENT,
    resend_message_id: resendMessageId,
    status: sendStatus,
    error_message: errorMessage,
  }, { onConflict: 'report_date' });

  if (sendStatus === 'failed') throw new Error(errorMessage);
  return { status: 'sent', reportDate: dateKey, sentCount, needsEmailCount, resendMessageId };
}

/**
 * Starts the once-a-day report job. This is a single Render web service
 * with no separate worker/cron dyno, so rather than add new infra this uses
 * an in-process interval that wakes up every 30 minutes and fires the
 * report once local server time crosses the target hour — guarded by the
 * neighborhood_daily_reports.report_date unique constraint (via the
 * "already sent today" check in runDailyReport) so it can't double-send
 * even if the check interval overlaps a restart. Call once from server.js
 * after the leads router is mounted.
 */
export function startDailyReportScheduler({ getResendApiKey, getResendFromAddress, hourUtc = 21 }) {
  const CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
  const tick = async () => {
    try {
      if (new Date().getUTCHours() !== hourUtc) return;
      const result = await runDailyReport({ getResendApiKey, getResendFromAddress });
      if (result.status === 'sent') {
        console.log(`[Leads] daily report sent: ${result.sentCount} sent, ${result.needsEmailCount} need email.`);
      }
    } catch (err) {
      console.error('[Leads] daily report scheduler tick failed:', err.message);
    }
  };
  setInterval(() => { void tick(); }, CHECK_INTERVAL_MS);
  // Also check shortly after boot in case the server restarts near the
  // target hour and would otherwise miss that day's window.
  setTimeout(() => { void tick(); }, 60_000);
  console.log(`[Leads] daily report scheduler started (target hour: ${hourUtc}:00 UTC, checks every 30 min).`);
}

// ---------------------------------------------------------------------------
// HubSpot pipeline management — dedicated "Camelot Neighborhood Leads"
// pipeline, separate from whatever HUBSPOT_PIPELINE_ID/HUBSPOT_DEAL_STAGE_ID
// are configured for on the existing lead-routing flow (integrations.ts /
// push-building), so this campaign doesn't collide with or repurpose that
// pipeline's stages.
// ---------------------------------------------------------------------------

const NEIGHBORHOOD_PIPELINE_LABEL = 'Camelot Neighborhood Leads';
const NEIGHBORHOOD_STAGES = [
  { label: 'Not Contacted', probability: 0.05 },
  { label: 'Intro Email Sent', probability: 0.15 },
  { label: 'Follow-Up Due', probability: 0.2 },
  { label: 'Opened / Responded', probability: 0.35 },
  { label: 'Meeting Booked', probability: 0.55 },
  { label: 'Proposal Sent', probability: 0.75 },
  { label: 'Won', probability: 1, closed: 'won' },
  { label: 'Lost', probability: 0, closed: 'lost' },
];

let cachedPipeline = null;

async function ensureNeighborhoodPipeline(hubspotRequest) {
  if (cachedPipeline) return cachedPipeline;

  const existing = await hubspotRequest('/crm/v3/pipelines/deals', null, 'GET');
  const found = (existing?.results || []).find((p) => p.label === NEIGHBORHOOD_PIPELINE_LABEL);
  if (found) {
    cachedPipeline = {
      pipelineId: found.id,
      stages: Object.fromEntries(found.stages.map((s) => [s.label, s.id])),
    };
    return cachedPipeline;
  }

  const created = await hubspotRequest('/crm/v3/pipelines/deals', {
    label: NEIGHBORHOOD_PIPELINE_LABEL,
    displayOrder: 99,
    stages: NEIGHBORHOOD_STAGES.map((s, i) => ({
      label: s.label,
      displayOrder: i,
      metadata: {
        probability: String(s.probability),
        ...(s.closed ? { isClosed: 'true', ...(s.closed === 'won' ? { probability: '1' } : {}) } : {}),
      },
    })),
  });

  cachedPipeline = {
    pipelineId: created.id,
    stages: Object.fromEntries(created.stages.map((s) => [s.label, s.id])),
  };
  return cachedPipeline;
}

async function pushLeadToHubSpotPipeline(lead, { hubspotRequest, hubspotObjectWrite, searchHubSpotObject, cleanProperties }) {
  const pipeline = await ensureNeighborhoodPipeline(hubspotRequest);
  const stageId = pipeline.stages['Intro Email Sent'] || Object.values(pipeline.stages)[0];

  const companyName = lead.management_company || lead.owner_name || lead.address;
  const companyProps = cleanProperties({
    name: companyName,
    address: lead.address,
    city: lead.borough,
    zip: lead.zip_code,
    description: `Neighborhood Leads prospect — ${lead.building_category || 'multifamily'}, ${lead.units_total || '?'} units, built ${lead.year_built || '?'}.`,
    camelot_os_lead_id: String(lead.id),
    property_address: lead.address,
    building_type: lead.building_category,
    units: lead.units_total ? String(lead.units_total) : '',
  });
  const existingCompany = await searchHubSpotObject('companies', 'name', companyName);
  const company = existingCompany?.id
    ? await hubspotObjectWrite(`/crm/v3/objects/companies/${existingCompany.id}`, companyProps, 'PATCH')
    : await hubspotObjectWrite('/crm/v3/objects/companies', companyProps);

  let contact = null;
  if (lead.contact_email) {
    const nameParts = String(lead.management_contact_name || '').trim().split(/\s+/);
    const contactProps = cleanProperties({
      email: lead.contact_email,
      firstname: nameParts[0] || '',
      lastname: nameParts.slice(1).join(' ') || '',
      company: companyName,
      address: lead.mailing_address || lead.address,
      building_role: lead.management_contact_role,
      camelot_contact_source: 'Camelot OS Neighborhood Leads',
    });
    const existingContact = await searchHubSpotObject('contacts', 'email', lead.contact_email);
    contact = existingContact?.id
      ? await hubspotObjectWrite(`/crm/v3/objects/contacts/${existingContact.id}`, contactProps, 'PATCH')
      : await hubspotObjectWrite('/crm/v3/objects/contacts', contactProps);
    if (contact?.id && company?.id) {
      try {
        await hubspotRequest('/crm/v3/associations/contacts/companies/batch/create', {
          inputs: [{ from: { id: String(contact.id) }, to: { id: String(company.id) }, type: 'contact_to_company' }],
        });
      } catch (err) {
        console.error('[Leads] contact/company association failed:', err.message);
      }
    }
  }

  const dealName = `${lead.address} — Camelot Management Opportunity`;
  const dealProps = cleanProperties({
    dealname: dealName,
    dealstage: stageId,
    pipeline: pipeline.pipelineId,
    property_address: lead.address,
    building_type: lead.building_category,
    units: lead.units_total ? String(lead.units_total) : '',
    camelot_os_lead_id: String(lead.id),
  });
  const existingDeal = await searchHubSpotObject('deals', 'dealname', dealName);
  const deal = existingDeal?.id
    ? await hubspotObjectWrite(`/crm/v3/objects/deals/${existingDeal.id}`, dealProps, 'PATCH')
    : await hubspotObjectWrite('/crm/v3/objects/deals', dealProps);

  if (deal?.id && company?.id) {
    try {
      await hubspotRequest('/crm/v3/associations/companies/deals/batch/create', {
        inputs: [{ from: { id: String(company.id) }, to: { id: String(deal.id) }, type: 'company_to_deal' }],
      });
    } catch (err) {
      console.error('[Leads] company/deal association failed:', err.message);
    }
  }
  if (deal?.id && contact?.id) {
    try {
      await hubspotRequest('/crm/v3/associations/contacts/deals/batch/create', {
        inputs: [{ from: { id: String(contact.id) }, to: { id: String(deal.id) }, type: 'contact_to_deal' }],
      });
    } catch (err) {
      console.error('[Leads] contact/deal association failed:', err.message);
    }
  }

  // 4-day follow-up task, associated to the deal.
  let task = null;
  try {
    const dueAt = new Date(Date.now() + 4 * 86_400_000).toISOString();
    task = await hubspotRequest('/crm/v3/objects/tasks', {
      properties: {
        hs_task_subject: `Follow up: intro email to ${lead.address}`,
        hs_task_body: `4-day follow-up on the Camelot Neighborhood Leads intro email sent to ${lead.management_contact_name || lead.owner_name || 'the owner/agent'} at ${lead.address}. Check for a reply; if none, call or send a short follow-up note.`,
        hs_task_status: 'NOT_STARTED',
        hs_task_priority: 'MEDIUM',
        hs_timestamp: new Date(dueAt).toISOString(),
      },
    });
    if (task?.id && deal?.id) {
      await hubspotRequest('/crm/v3/associations/tasks/deals/batch/create', {
        inputs: [{ from: { id: String(task.id) }, to: { id: String(deal.id) }, type: 'task_to_deal' }],
      }).catch((err) => console.error('[Leads] task/deal association failed:', err.message));
    }
  } catch (err) {
    console.error('[Leads] follow-up task creation failed:', err.message);
  }

  return {
    status: 'ok',
    companyId: company?.id,
    contactId: contact?.id,
    dealId: deal?.id,
    taskId: task?.id,
    pipelineId: pipeline.pipelineId,
  };
}
