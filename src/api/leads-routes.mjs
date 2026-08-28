/**
 * Neighborhood Leads Engine — API routes.
 *
 * GET  /api/leads                          — list/filter leads
 * GET  /api/leads/:id                      — single lead detail + event history
 * POST /api/leads/search                   — run a new city-wide (or borough-scoped) PLUTO+HPD search, upsert results
 * GET  /api/leads/runs                     — recent search-run history
 * POST /api/leads/:id/draft                — generate the intro email draft (+ pitch deck HTML) for staff review
 * PATCH /api/leads/:id/draft                — staff edits the draft before approval
 * POST /api/leads/:id/approve               — staff approves the draft (required before send)
 * POST /api/leads/:id/send                  — send the approved email (Resend) with the deck PDF attached;
 *                                              on success: push to HubSpot "Camelot Neighborhood Leads" pipeline
 *                                              + schedule the 4-day follow-up task
 * POST /api/leads/:id/follow-up/complete    — mark the 4-day follow-up as done
 * POST /api/hubspot/pipelines/ensure-neighborhood-leads — idempotently create the dedicated HubSpot pipeline
 *
 * All routes sit behind requireApiUser (mounted the same way as
 * /api/portfolio in server.js) — HubSpot/Resend/NYC Open Data credentials
 * are server-only.
 *
 * Draft-approval gate (per David, Aug 2026): a lead can only be sent after
 * `approved_at` is set via POST /:id/approve. The send route enforces this
 * server-side, not just in the UI, so the workflow can't be bypassed by a
 * direct API call either.
 */

import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { runCitywideLeadSearch } from './leads-search.mjs';

/* global console, process */

const router = express.Router();

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
  // body: { to: string, attachmentBase64: string, attachmentFilename: string }
  // The PDF attachment is generated client-side (same generatePdfBase64 path
  // used by Partner Pitches / Instant Proposal) and posted here as base64,
  // matching the existing sendCamelotEmail() contract — this route does not
  // render PDFs itself.
  // ---------------------------------------------------------------------
  router.post('/leads/:id/send', async (req, res) => {
    try {
      const supabase = getSupabase();
      const { data: lead, error } = await supabase.from('neighborhood_leads').select('*').eq('id', req.params.id).single();
      if (error || !lead) return res.status(404).json({ error: 'Lead not found.' });

      if (lead.status !== 'approved') {
        return res.status(409).json({ error: `Lead must be approved before sending (current status: ${lead.status}). Approve the draft first.` });
      }

      const { to, attachmentBase64, attachmentFilename } = req.body || {};
      if (!to || !attachmentBase64 || !attachmentFilename) {
        return res.status(400).json({ error: 'to, attachmentBase64, and attachmentFilename are required.' });
      }

      const resendKey = getResendApiKey();
      if (!resendKey) return res.status(400).json({ error: 'Email sending is not configured (RESEND_API_KEY missing).' });

      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}` },
        body: JSON.stringify({
          from: getResendFromAddress(),
          to: [to],
          subject: lead.draft_subject,
          html: lead.draft_body_html,
          reply_to: 'dgoldoff@camelot.nyc',
          attachments: [{ filename: attachmentFilename, content: attachmentBase64 }],
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

  return router;
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
