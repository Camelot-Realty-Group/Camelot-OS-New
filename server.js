import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import costCuttingRoutes from './src/api/cost-cutting-routes.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 10000;

app.disable('x-powered-by');
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// JSON body parser for API proxy routes
app.use(express.json({ limit: '15mb', verify: (req, _res, buf) => { req.rawBody = buf; } }));

function getHubSpotApiKey() {
  return process.env.HUBSPOT_PRIVATE_APP_TOKEN || process.env.HUBSPOT_API_KEY || '';
}

let supabaseAuthClient;
function getSupabaseAuthClient() {
  if (supabaseAuthClient) return supabaseAuthClient;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey || /placeholder/i.test(`${url}${anonKey}`)) return null;
  supabaseAuthClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return supabaseAuthClient;
}

async function requireApiUser(req, res, next) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return res.status(401).json({ error: 'Authentication required.' });
  const authClient = getSupabaseAuthClient();
  if (!authClient) return res.status(503).json({ error: 'Server authentication is not configured.' });
  try {
    const { data, error } = await authClient.auth.getUser(token);
    if (error || !data.user) return res.status(401).json({ error: 'Invalid or expired session.' });
    req.camelotUser = data.user;
    return next();
  } catch {
    return res.status(401).json({ error: 'Could not verify the current session.' });
  }
}

function getScoutConfig() {
  return {
    apiUrl: process.env.SCOUT_API_URL || '',
    apiKey: process.env.SCOUT_API_KEY || '',
    workspaceId: process.env.SCOUT_WORKSPACE_ID || '',
  };
}

const LOCAL_SCOUT_LEADS = [];

function saveLocalScoutLead(payload) {
  const id = `local-scout-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const lead = {
    id,
    ...payload,
    saved_at: new Date().toISOString(),
  };
  LOCAL_SCOUT_LEADS.unshift(lead);
  LOCAL_SCOUT_LEADS.splice(250);
  return lead;
}

function parseContactName(fullName = '') {
  const parts = String(fullName).trim().split(/\s+/).filter(Boolean);
  return {
    firstname: parts[0] || '',
    lastname: parts.length > 1 ? parts.slice(1).join(' ') : '',
  };
}

function normalizePhone(phone = '') {
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return digits;
}

function auditLeadQualitySnapshot(building = {}, contact = {}) {
  const missingFields = [];
  const strengths = [];
  const warnings = [];
  let score = 0;

  if (building.address) score += 15;
  else missingFields.push('property address');

  if (building.units && Number(building.units) > 0) {
    score += Number(building.units) >= 30 ? 15 : 8;
    strengths.push(`${building.units} units identified`);
  } else {
    missingFields.push('unit count');
  }

  if (building.type) score += 8;
  else missingFields.push('asset class');

  if (building.borough || building.region || building.neighborhood || building.zip_code) {
    score += 8;
    strengths.push('geography available for routing');
  } else {
    missingFields.push('borough / region / zip');
  }

  if (contact.email) {
    score += 18;
    strengths.push('email contact available');
  } else {
    missingFields.push('verified email contact');
  }

  if (contact.phone) {
    score += 10;
    strengths.push('phone contact available');
  } else {
    missingFields.push('phone contact');
  }

  if (building.current_management && !/unknown|verify/i.test(building.current_management)) {
    score += 8;
    strengths.push('current management identified');
  } else {
    warnings.push('current management should be verified before a client-facing push');
  }

  if ((Number(building.market_value) || 0) > 0 || (Number(building.assessed_value) || 0) > 0) {
    score += 6;
    strengths.push('valuation or assessment signal available');
  } else {
    warnings.push('market value is missing or zero');
  }

  if ((Number(building.open_violations_count) || 0) > 0 || (Number(building.violations_count) || 0) > 0) {
    score += 6;
    strengths.push('compliance pain point available');
  }

  if (Array.isArray(building.signals) && building.signals.length) {
    score += Math.min(6, building.signals.length * 2);
    strengths.push('Scout signal history present');
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const tier = missingFields.includes('property address') || missingFields.includes('unit count')
    ? 'review'
    : score >= 76
      ? 'hot'
      : score >= 55
        ? 'warm'
        : 'cold';

  return { score, tier, missingFields, strengths, warnings };
}

function routeLeadSnapshot(building = {}, quality = {}) {
  const region = building.borough || building.region || building.neighborhood || building.zip_code || 'Unassigned';
  const tags = new Set([
    `tier:${quality.tier || 'review'}`,
    `region:${region}`,
    `asset:${building.type || 'unknown'}`,
  ]);
  if ((Number(building.units) || 0) >= 100) tags.add('large-building');
  if ((Number(building.open_violations_count) || 0) > 0) tags.add('compliance-pain');
  if (/self/i.test(building.current_management || '')) tags.add('self-managed-review');
  if ((Number(building.market_value) || 0) <= 0) tags.add('valuation-needed');

  return {
    team: quality.tier === 'hot'
      ? 'David / Jackie priority desk'
      : quality.tier === 'warm'
        ? 'Scout outreach team'
        : quality.tier === 'review'
          ? 'Data quality review'
          : 'Nurture queue',
    region,
    priority: quality.tier === 'hot' ? 'same-day' : quality.tier === 'warm' ? '24-48 hours' : 'nurture',
    tags: Array.from(tags),
  };
}

async function hubspotRequest(pathname, payload, method = 'POST') {
  const apiKey = getHubSpotApiKey();
  if (!apiKey) throw new Error('HubSpot API key not configured');

  const resp = await fetch(`https://api.hubapi.com${pathname}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const text = await resp.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { error: text || 'Empty response from HubSpot', status: resp.status }; }
  if (!resp.ok) {
    const error = new Error(data?.message || data?.error || `HubSpot request failed: ${resp.status}`);
    error.status = resp.status;
    error.data = data;
    throw error;
  }
  return data;
}

function cleanProperties(properties = {}) {
  const next = { ...properties };
  Object.keys(next).forEach((key) => {
    if (next[key] === undefined || next[key] === null || next[key] === '') delete next[key];
  });
  return next;
}

function isHubSpotPropertySchemaError(error) {
  const text = [
    error?.message,
    error?.data?.message,
    JSON.stringify(error?.data || {}),
  ].filter(Boolean).join(' ');
  return /property|properties|validation/i.test(text) && /not exist|invalid|was not valid|read-only|readonly/i.test(text);
}

async function hubspotObjectWrite(pathname, properties, method = 'POST') {
  const cleaned = cleanProperties(properties);
  try {
    return await hubspotRequest(pathname, { properties: cleaned }, method);
  } catch (error) {
    const fallback = cleanProperties(
      Object.fromEntries(
        Object.entries(cleaned).filter(([key]) => !/^camelot_|^(property_address|building_type|units|current_management|opportunity_score|opportunity_tier|distress_signals|open_violations|estimated_management_fee_opportunity|research_confidence|last_camelot_os_sync|building_role|decision_maker_type|contact_confidence|camelot_contact_source|do_not_contact_reason|primary_pain_point|next_recommended_angle)$/i.test(key))
      )
    );
    if (!isHubSpotPropertySchemaError(error) || Object.keys(fallback).length === Object.keys(cleaned).length) throw error;
    const result = await hubspotRequest(pathname, { properties: fallback }, method);
    result._camelotWarnings = [`HubSpot custom properties missing or incompatible; retried with standard fields only. Run npm run hubspot:rollout -- --apply. Original: ${error.message}`];
    return result;
  }
}

async function searchHubSpotObject(objectType, propertyName, value) {
  if (!value) return null;
  const data = await hubspotRequest(`/crm/v3/objects/${objectType}/search`, {
    filterGroups: [
      {
        filters: [
          {
            propertyName,
            operator: 'EQ',
            value: String(value),
          },
        ],
      },
    ],
    limit: 1,
  });
  return data?.results?.[0] || null;
}

async function upsertHubSpotContact(contact = {}, building = {}) {
  if (!contact.email) return null;
  const parsedName = parseContactName(contact.name);
  const properties = cleanProperties({
    email: contact.email,
    firstname: contact.firstname || parsedName.firstname,
    lastname: contact.lastname || parsedName.lastname,
    phone: normalizePhone(contact.phone),
    company: contact.company || building.name || building.address || '',
    address: building.address || '',
    city: building.borough || building.region || building.neighborhood || '',
    building_role: contact.role,
    decision_maker_type: contact.role,
    contact_confidence: contact.confidence || building.research_confidence || '',
    camelot_contact_source: contact.source || 'Camelot OS',
  });

  const existing = await searchHubSpotObject('contacts', 'email', contact.email);
  if (existing?.id) {
    return hubspotObjectWrite(`/crm/v3/objects/contacts/${existing.id}`, properties, 'PATCH');
  }
  return hubspotObjectWrite('/crm/v3/objects/contacts', properties);
}

async function upsertHubSpotCompany(building = {}, quality = {}, routing = {}) {
  const companyName = building.name || building.address;
  if (!companyName) return null;
  const properties = cleanProperties({
    name: companyName,
    address: building.address,
    city: building.borough || building.region || building.neighborhood,
    description: [
      building.address ? `Property: ${building.address}` : '',
      quality.tier ? `Camelot lead tier: ${quality.tier}` : '',
      routing.team ? `Routing: ${routing.team}` : '',
    ].filter(Boolean).join('\n'),
    camelot_os_building_id: building.id,
    property_address: building.address,
    building_type: building.type,
    units: building.units ? String(building.units) : '',
    current_management: building.current_management,
    opportunity_score: quality.score !== undefined ? String(quality.score) : '',
    opportunity_tier: quality.tier,
    distress_signals: [...(building.signals || []), ...(routing.tags || [])].join('; '),
    open_violations: building.open_violations_count !== undefined ? String(building.open_violations_count) : '',
    estimated_management_fee_opportunity: building.estimated_management_fee_opportunity ? String(building.estimated_management_fee_opportunity) : '',
    camelot_os_report_link: building.report_url || building.camelot_os_report_link || building.enriched_data?.last_report_activity?.url,
    research_confidence: building.research_confidence || (quality.tier === 'review' ? 'Low' : quality.tier ? 'Medium' : ''),
    last_camelot_os_sync: Date.now(),
  });

  const existing = await searchHubSpotObject('companies', 'name', companyName);
  if (existing?.id) {
    return hubspotObjectWrite(`/crm/v3/objects/companies/${existing.id}`, properties, 'PATCH');
  }
  return hubspotObjectWrite('/crm/v3/objects/companies', properties);
}

async function upsertHubSpotDeal(building = {}, quality = {}, routing = {}) {
  const dealStage = process.env.HUBSPOT_DEAL_STAGE_ID;
  if (!dealStage) return null;

  const reportActivity = building.report_activity || building.enriched_data?.hubspot_report_activity;
  const botActivity = building.bot_activity || building.enriched_data?.hubspot_bot_activity;
  const dealname = `${building.name || building.address} - Camelot Management Opportunity`;
  const properties = cleanProperties({
    dealname,
    dealstage: dealStage,
    pipeline: process.env.HUBSPOT_PIPELINE_ID || 'default',
    amount: String(building.market_value || ''),
    property_address: building.address,
    building_type: building.type,
    units: building.units ? String(building.units) : '',
    primary_pain_point: quality.strengths?.[0] || building.signals?.[0] || 'Property management opportunity',
    next_recommended_angle: botActivity?.ctaBody || reportActivity?.packageLabel || routing.team,
    camelot_os_report_link: building.report_url || building.camelot_os_report_link || building.enriched_data?.last_report_activity?.url,
    research_confidence: building.research_confidence || (quality.tier === 'review' ? 'Low' : quality.tier ? 'Medium' : ''),
  });

  const existing = await searchHubSpotObject('deals', 'dealname', dealname);
  const deal = existing?.id
    ? await hubspotObjectWrite(`/crm/v3/objects/deals/${existing.id}`, properties, 'PATCH')
    : await hubspotObjectWrite('/crm/v3/objects/deals', properties);

  if (botActivity) {
    console.log('HubSpot bot activity synced:', {
      dealId: deal.id,
      bot: botActivity.botName || botActivity.botId,
      action: botActivity.action,
      cta: botActivity.ctaLabel || botActivity.primaryCta,
      property: building.address,
    });
  } else if (reportActivity) {
    console.log('HubSpot report activity synced:', {
      dealId: deal.id,
      action: reportActivity.action,
      package: reportActivity.packageLabel,
      property: reportActivity.propertyAddress,
    });
  } else {
    console.log('HubSpot lead synced:', {
      dealId: deal.id,
      property: building.address,
      tier: quality.tier,
      team: routing.team,
    });
  }
  return deal;
}

async function createHubSpotTaskForBotActivity(botActivity = {}, building = {}) {
  if (String(process.env.HUBSPOT_CREATE_TASKS || '').toLowerCase() !== 'true') return null;
  const subject = botActivity.taskTitle || botActivity.ctaSubject || botActivity.primaryCta || `Follow up on ${building.address || 'Camelot OS lead'}`;
  const body = [
    botActivity.ctaBody,
    botActivity.notes,
    building.address ? `Property: ${building.address}` : '',
    building.name && building.name !== building.address ? `Building: ${building.name}` : '',
    botActivity.botName ? `Source bot: ${botActivity.botName}` : '',
    botActivity.action ? `Action: ${botActivity.action}` : '',
    botActivity.ctaScenarioId ? `CTA scenario: ${botActivity.ctaScenarioId}` : '',
  ].filter(Boolean).join('\n\n');
  const dueAt = botActivity.taskDueAt || botActivity.dueAt || new Date(Date.now() + 2 * 86_400_000).toISOString();
  return hubspotRequest('/crm/v3/objects/tasks', {
    properties: {
      hs_task_subject: subject,
      hs_task_body: body,
      hs_task_status: 'NOT_STARTED',
      hs_task_priority: botActivity.priority === 'same-day' ? 'HIGH' : 'MEDIUM',
      hs_timestamp: new Date(dueAt).toISOString(),
    },
  });
}

async function associateHubSpotContactDeal(contactId, dealId) {
  return hubspotRequest('/crm/v3/associations/contacts/deals/batch/create', {
    inputs: [
      {
        from: { id: String(contactId) },
        to: { id: String(dealId) },
        type: 'contact_to_deal',
      },
    ],
  });
}

async function associateHubSpotCompanyDeal(companyId, dealId) {
  return hubspotRequest('/crm/v3/associations/companies/deals/batch/create', {
    inputs: [
      {
        from: { id: String(companyId) },
        to: { id: String(dealId) },
        type: 'company_to_deal',
      },
    ],
  });
}

async function associateHubSpotContactCompany(contactId, companyId) {
  return hubspotRequest('/crm/v3/associations/contacts/companies/batch/create', {
    inputs: [
      {
        from: { id: String(contactId) },
        to: { id: String(companyId) },
        type: 'contact_to_company',
      },
    ],
  });
}

// Log available env vars on startup (keys only, not values)
const envKeys = Object.keys(process.env).filter(k => k.includes('HUBSPOT') || k.includes('APOLLO') || k.includes('SUPABASE') || k.includes('AI_API'));
console.log('Camelot OS server starting. Available API keys:', envKeys.length > 0 ? envKeys.join(', ') : 'NONE — set HUBSPOT_PRIVATE_APP_TOKEN, APOLLO_API_KEY in Render env vars');

// ============================================================
// HubSpot API Proxy — avoids CORS issues with browser-side calls
// ============================================================
console.log('Scout integration config:', {
  scoutApiUrl: Boolean(getScoutConfig().apiUrl),
  scoutApiKey: Boolean(getScoutConfig().apiKey),
  scoutWorkspaceId: Boolean(getScoutConfig().workspaceId),
  hubspotApiKey: Boolean(getHubSpotApiKey()),
});

// Private integration credentials are server-only. Require a verified
// Supabase user before any browser request can consume them.
app.use([
  '/api/hubspot',
  '/api/apollo',
  '/api/prospeo',
  '/api/spire',
  '/api/ai',
  '/api/email/send',
  '/api/email/events',
  '/api/building/brand',
  '/api/scout',
  '/api/core',
  '/api/templates',
  '/api/cost-analysis',
], requireApiUser);

app.post('/api/hubspot/contacts', async (req, res) => {
  const apiKey = getHubSpotApiKey();
  if (!apiKey) {
    console.error('HubSpot: No API key found. Set HUBSPOT_PRIVATE_APP_TOKEN in Render environment.');
    return res.status(400).json({ error: 'HubSpot API key not configured. Go to Render → Environment and add HUBSPOT_PRIVATE_APP_TOKEN.' });
  }
  try {
    console.log('HubSpot: Creating contact...');
    const resp = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(req.body),
    });
    const text = await resp.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { error: text || 'Empty response from HubSpot', status: resp.status }; }
    if (!resp.ok) {
      console.error('HubSpot contact error:', resp.status, data);
      return res.status(resp.status).json(data);
    }
    console.log('HubSpot: Contact created, id:', data.id);
    res.status(resp.ok ? 200 : resp.status).json(data);
  } catch (err) {
    console.error('HubSpot contacts proxy error:', err);
    res.status(500).json({ error: err.message || 'HubSpot proxy error — check server logs' });
  }
});

app.post('/api/hubspot/deals', async (req, res) => {
  const apiKey = getHubSpotApiKey();
  if (!apiKey) {
    return res.status(400).json({ error: 'HubSpot API key not configured. Add HUBSPOT_PRIVATE_APP_TOKEN in Render environment.' });
  }
  try {
    console.log('HubSpot: Creating deal...');
    const resp = await fetch('https://api.hubapi.com/crm/v3/objects/deals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(req.body),
    });
    const text = await resp.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { error: text || 'Empty response from HubSpot', status: resp.status }; }
    if (!resp.ok) {
      console.error('HubSpot deal error:', resp.status, data);
      return res.status(resp.status).json(data);
    }
    console.log('HubSpot: Deal created, id:', data.id);
    res.json(data);
  } catch (err) {
    console.error('HubSpot deals proxy error:', err);
    res.status(500).json({ error: err.message || 'HubSpot proxy error — check server logs' });
  }
});

// ============================================================
// Email sending (Resend) + HubSpot engagement mirroring + tracking
// ============================================================
// Design: Camelot OS sends real email itself via Resend (never routes cold
// outreach silently -- the caller still composes/reviews the report and
// clicks Send). Every successful send is ALSO logged as an "emails"
// engagement in HubSpot, associated to the matching contact/company/deal
// when IDs are supplied, so both systems show the same history even though
// only Camelot OS is doing the actual delivery. This keeps HubSpot as the
// system of record for the team's follow-up (per
// docs/HUBSPOT_CAMELOT_OS_ROLLOUT.md) without depending on HubSpot's own
// Marketing Hub / send infrastructure, which this account doesn't have.
import crypto from 'crypto';

function getResendApiKey() {
  return process.env.RESEND_API_KEY || '';
}

function getResendFromAddress() {
  // Must be a verified sending domain in Resend (SPF/DKIM configured on
  // camelot.nyc) or Resend will reject the send. Defaults to Resend's
  // sandbox address, which only delivers to the account owner's own
  // verified email -- fine for initial testing, not for real outreach.
  return process.env.RESEND_FROM_ADDRESS || 'Camelot Property Management <onboarding@resend.dev>';
}

function getResendWebhookSecret() {
  return process.env.RESEND_WEBHOOK_SECRET || '';
}

// In-memory send/tracking log. Good enough for a single-instance Render
// free/starter service; move to Supabase (already wired for everything
// else in this app) if this needs to survive restarts or scale beyond one
// dyno -- the shape here is intentionally simple to make that swap easy.
const EMAIL_LOG = [];
const EMAIL_LOG_MAX = 500;

function logEmailEvent(resendId, patch) {
  const idx = EMAIL_LOG.findIndex(e => e.resendId === resendId);
  if (idx === -1) return null;
  EMAIL_LOG[idx] = { ...EMAIL_LOG[idx], ...patch, updatedAt: new Date().toISOString() };
  return EMAIL_LOG[idx];
}

async function logHubSpotEmailEngagement({ subject, html, to, hubspot }) {
  const apiKey = getHubSpotApiKey();
  if (!apiKey || !hubspot || (!hubspot.contactId && !hubspot.dealId && !hubspot.companyId)) {
    return { status: 'skipped', message: 'No HubSpot token or no contact/deal/company id supplied — send still succeeded.' };
  }
  try {
    const associations = [];
    if (hubspot.contactId) associations.push({ to: { id: String(hubspot.contactId) }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 198 }] });
    if (hubspot.dealId) associations.push({ to: { id: String(hubspot.dealId) }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 210 }] });
    if (hubspot.companyId) associations.push({ to: { id: String(hubspot.companyId) }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 186 }] });

    const resp = await fetch('https://api.hubapi.com/crm/v3/objects/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        properties: {
          hs_timestamp: String(Date.now()),
          hs_email_direction: 'EMAIL',
          hs_email_status: 'SENT',
          hs_email_subject: subject,
          hs_email_html: html,
          hs_email_to_email: Array.isArray(to) ? to.join(', ') : String(to || ''),
        },
        associations,
      }),
    });
    const text = await resp.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { error: text, status: resp.status }; }
    if (!resp.ok) {
      console.error('HubSpot email engagement error:', resp.status, data);
      return { status: 'error', message: data?.message || `HubSpot returned ${resp.status}` };
    }
    return { status: 'ok', id: data.id };
  } catch (err) {
    console.error('HubSpot email engagement exception:', err);
    return { status: 'error', message: err.message || 'HubSpot engagement logging failed' };
  }
}

async function updateHubSpotEmailEngagementStatus(hubspotEngagementId, status) {
  const apiKey = getHubSpotApiKey();
  if (!apiKey || !hubspotEngagementId) return;
  try {
    await fetch(`https://api.hubapi.com/crm/v3/objects/emails/${hubspotEngagementId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ properties: { hs_email_status: status } }),
    });
  } catch (err) {
    console.error('HubSpot engagement status update failed:', err);
  }
}

app.get('/api/email/config-status', (_req, res) => {
  res.json({
    resendConfigured: Boolean(getResendApiKey()),
    resendFromAddress: getResendFromAddress(),
    hubspotConfigured: Boolean(getHubSpotApiKey()),
    webhookConfigured: Boolean(getResendWebhookSecret()),
  });
});

app.post('/api/email/send', async (req, res) => {
  const apiKey = getResendApiKey();
  if (!apiKey) {
    return res.status(400).json({ error: 'Email sending is not configured yet. Add RESEND_API_KEY in Render → Environment.' });
  }
  const { to, subject, html, text, replyTo, attachmentBase64, attachmentFilename, hubspot } = req.body || {};
  if (!to || !subject || !html) {
    return res.status(400).json({ error: 'to, subject, and html are required' });
  }
  try {
    const payload = {
      from: getResendFromAddress(),
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      ...(text ? { text } : {}),
      ...(replyTo ? { reply_to: replyTo } : {}),
      ...(attachmentBase64 && attachmentFilename
        ? { attachments: [{ filename: attachmentFilename, content: attachmentBase64 }] }
        : {}),
    };
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(payload),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      console.error('Resend send error:', resp.status, data);
      return res.status(resp.status).json({ error: data?.message || `Resend returned ${resp.status}`, details: data });
    }

    const hubspotResult = await logHubSpotEmailEngagement({ subject, html, to, hubspot });

    EMAIL_LOG.unshift({
      resendId: data.id,
      to: Array.isArray(to) ? to : [to],
      subject,
      status: 'sent',
      sentAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      hubspotEngagementId: hubspotResult.status === 'ok' ? hubspotResult.id : null,
    });
    EMAIL_LOG.splice(EMAIL_LOG_MAX);

    res.json({ ok: true, id: data.id, hubspot: hubspotResult });
  } catch (err) {
    console.error('Email send error:', err);
    res.status(500).json({ error: err.message || 'Email send failed — check server logs' });
  }
});

// Resend signs webhooks using the Svix scheme: HMAC-SHA256 over
// "{id}.{timestamp}.{body}" using the base64 portion of the signing
// secret, compared (constant-time) against the v1 signature(s) in the
// webhook-signature header. Reference: https://resend.com/docs/dashboard/webhooks/verify-webhooks-requests
function verifyResendWebhookSignature(req, rawBody) {
  const secret = getResendWebhookSecret();
  if (!secret) return true; // not configured yet — accept but log, don't block setup
  try {
    const id = req.headers['webhook-id'];
    const timestamp = req.headers['webhook-timestamp'];
    const signatureHeader = req.headers['webhook-signature'];
    if (!id || !timestamp || !signatureHeader) return false;
    const secretBytes = Buffer.from(secret.split('_').pop() || secret, 'base64');
    const signedContent = `${id}.${timestamp}.${rawBody}`;
    const expected = crypto.createHmac('sha256', secretBytes).update(signedContent).digest('base64');
    return String(signatureHeader)
      .split(' ')
      .map(part => part.split(',')[1])
      .filter(Boolean)
      .some(sig => {
        try {
          return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
        } catch {
          return false;
        }
      });
  } catch (err) {
    console.error('Webhook signature verification error:', err);
    return false;
  }
}

app.post('/api/webhooks/resend', async (req, res) => {
  const rawBody = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body || {});
  if (!verifyResendWebhookSignature(req, rawBody)) {
    console.warn('Resend webhook: signature verification failed, rejecting.');
    return res.status(401).json({ error: 'Invalid signature' });
  }
  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const resendId = event?.data?.email_id;
  const type = event?.type; // e.g. 'email.delivered', 'email.opened', 'email.clicked', 'email.bounced', 'email.complained'
  const statusMap = {
    'email.sent': 'sent',
    'email.delivered': 'delivered',
    'email.delivery_delayed': 'delayed',
    'email.opened': 'opened',
    'email.clicked': 'clicked',
    'email.bounced': 'bounced',
    'email.complained': 'complained',
  };
  const status = statusMap[type];
  if (resendId && status) {
    const updated = logEmailEvent(resendId, { status });
    if (updated?.hubspotEngagementId) {
      const hsStatusMap = { delivered: 'SENT', opened: 'OPENED', clicked: 'CLICKED', bounced: 'BOUNCED' };
      if (hsStatusMap[status]) await updateHubSpotEmailEngagementStatus(updated.hubspotEngagementId, hsStatusMap[status]);
    }
  }
  res.json({ received: true });
});

app.get('/api/email/events', (_req, res) => {
  res.json({ events: EMAIL_LOG.slice(0, 100) });
});

// ============================================================
// Apollo API Proxy — contact enrichment
// ============================================================
// ============================================================
// Scout + HubSpot Integration Orchestration
// ============================================================
app.get('/api/integrations/status', (_req, res) => {
  const scout = getScoutConfig();
  const hubspotKey = getHubSpotApiKey();
  res.json({
    scout: {
      configured: Boolean(scout.apiUrl && scout.apiKey && scout.workspaceId),
      apiUrlSet: Boolean(scout.apiUrl),
      workspaceSet: Boolean(scout.workspaceId),
      localQueueSize: LOCAL_SCOUT_LEADS.length,
    },
    hubspot: {
      configured: Boolean(hubspotKey),
      dealsEnabled: Boolean(process.env.HUBSPOT_DEAL_STAGE_ID),
      tasksEnabled: String(process.env.HUBSPOT_CREATE_TASKS || '').toLowerCase() === 'true',
      associationEndpoint: '/crm/v3/associations contacts-companies, companies-deals, contacts-deals batch/create',
    },
    enrichment: {
      apolloConfigured: Boolean(process.env.APOLLO_API_KEY),
      prospeoConfigured: Boolean(process.env.PROSPEO_API_KEY),
    },
    ai: {
      configured: Boolean(process.env.OPENAI_API_KEY || process.env.AI_API_KEY),
      model: process.env.AI_MODEL || process.env.VITE_AI_MODEL || 'gpt-4o-mini',
    },
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/integrations/local-leads', requireApiUser, (_req, res) => {
  res.json({
    leads: LOCAL_SCOUT_LEADS,
    count: LOCAL_SCOUT_LEADS.length,
    timestamp: new Date().toISOString(),
  });
});

app.post('/api/daily-hunt/run', requireApiUser, async (req, res) => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const functionUrl = supabaseUrl && !/placeholder/i.test(supabaseUrl)
    ? `${supabaseUrl.replace(/\/$/, '')}/functions/v1/daily-hunt-run`
    : '';

  if (!functionUrl || !supabaseKey || /placeholder/i.test(supabaseKey)) {
    return res.status(202).json({
      status: 'fallback',
      mode: 'seed-export',
      message: 'Daily Hunt function is not configured on Render yet. Showing the imported Claude/Twin lead queue.',
      run: {
        id: `fallback-${Date.now()}`,
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
        triggered_by: req.body?.triggered_by || 'manual_ui',
        sources_queried: ['Claude/Twin export'],
        candidates_found: 0,
        new_leads_inserted: 0,
        duplicates_skipped: 0,
        rejected_count: 0,
        corrected_count: 0,
      },
    });
  }

  try {
    const upstream = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        triggered_by: req.body?.triggered_by || 'manual_ui',
        source: 'render-server',
      }),
    });
    const text = await upstream.text();
    let payload = {};
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = { raw: text };
    }

    if (!upstream.ok) {
      return res.status(202).json({
        status: 'fallback',
        mode: 'seed-export',
        message: `Daily Hunt function responded ${upstream.status}. Showing the imported Claude/Twin lead queue until the function is deployed cleanly.`,
        upstream: payload,
      });
    }

    return res.json({
      status: 'ok',
      mode: 'supabase-function',
      message: 'Daily Hunt function run started.',
      upstream: payload,
    });
  } catch (error) {
    return res.status(202).json({
      status: 'fallback',
      mode: 'seed-export',
      message: 'Daily Hunt function could not be reached from Render. Showing the imported Claude/Twin lead queue.',
      error: error.message,
    });
  }
});

app.post('/api/integrations/push-building', requireApiUser, async (req, res) => {
  const body = req.body || {};
  const building = body.building || {};
  const contact = body.contact || {};
  const quality = body.quality || auditLeadQualitySnapshot(building, contact);
  const routing = body.routing || routeLeadSnapshot(building, quality);
  const result = {
    status: 'ok',
    quality,
    routing,
    scout: { status: 'skipped', message: 'Scout lead not saved yet.' },
    hubspot: { status: 'skipped', message: 'HubSpot API key not configured.' },
  };

  if (!building.address) {
    result.status = 'error';
    result.scout = { status: 'error', message: 'Property address is required before export.' };
    result.hubspot = { status: 'error', message: 'Property address is required before export.' };
    return res.status(400).json(result);
  }

  const botActivity = building.bot_activity || building.enriched_data?.hubspot_bot_activity;
  const localLead = saveLocalScoutLead({
    source: botActivity
      ? 'Camelot OS Bot Activity'
      : building.report_activity || building.enriched_data?.hubspot_report_activity
        ? 'Camelot OS Report Workflow'
        : 'Camelot OS Lead Sync',
    building,
    contact,
    quality,
    routing,
    botActivity,
  });
  result.scout = {
    status: 'ok',
    message: 'Saved to Scout local lead queue.',
    id: localLead.id,
    url: '/api/integrations/local-leads',
  };

  const hubspotKey = getHubSpotApiKey();
  if (hubspotKey) {
    try {
      const warnings = [];
      let companyRecord = null;
      let contactRecord = null;
      let dealRecord = null;

      companyRecord = await upsertHubSpotCompany(building, quality, routing);
      if (companyRecord?._camelotWarnings?.length) warnings.push(...companyRecord._camelotWarnings);

      if (contact.email) {
        contactRecord = await upsertHubSpotContact(contact, building);
        if (contactRecord?._camelotWarnings?.length) warnings.push(...contactRecord._camelotWarnings);
        if (contactRecord?.id && companyRecord?.id) {
          try {
            await associateHubSpotContactCompany(contactRecord.id, companyRecord.id);
          } catch (associationErr) {
            warnings.push(associationErr.message || 'HubSpot contact/company association failed.');
          }
        }
      } else {
        warnings.push('No verified contact email was available; property deal sync can still proceed when HUBSPOT_DEAL_STAGE_ID is configured.');
      }

      if (process.env.HUBSPOT_DEAL_STAGE_ID) {
        dealRecord = await upsertHubSpotDeal(building, quality, routing);
        if (dealRecord?._camelotWarnings?.length) warnings.push(...dealRecord._camelotWarnings);
        if (companyRecord?.id && dealRecord?.id) {
          try {
            await associateHubSpotCompanyDeal(companyRecord.id, dealRecord.id);
          } catch (associationErr) {
            warnings.push(associationErr.message || 'HubSpot company/deal association failed.');
          }
        }
        if (contactRecord?.id && dealRecord?.id) {
          try {
            await associateHubSpotContactDeal(contactRecord.id, dealRecord.id);
          } catch (associationErr) {
            warnings.push(associationErr.message || 'HubSpot contact/deal association failed.');
          }
        }
      } else {
        warnings.push('Deal creation skipped; set HUBSPOT_DEAL_STAGE_ID and HUBSPOT_PIPELINE_ID to sync opportunities into the pipeline.');
      }

      if (botActivity) {
        try {
          const taskRecord = await createHubSpotTaskForBotActivity(botActivity, building);
          if (taskRecord?.id) warnings.push(`HubSpot follow-up task created: ${taskRecord.id}`);
        } catch (taskErr) {
          warnings.push(taskErr.message || 'HubSpot follow-up task creation failed.');
        }
      }

      if (companyRecord || contactRecord || dealRecord) {
        result.hubspot = {
          status: 'ok',
          message: companyRecord && contactRecord && dealRecord
            ? 'HubSpot company, contact, and opportunity synced.'
            : dealRecord
              ? 'HubSpot company/opportunity synced; add a verified email for contact sync.'
              : contactRecord
                ? 'HubSpot company/contact synced; add HUBSPOT_DEAL_STAGE_ID for pipeline opportunity sync.'
                : 'HubSpot company synced; add a verified email and HUBSPOT_DEAL_STAGE_ID for full pipeline sync.',
          id: dealRecord?.id || companyRecord?.id || contactRecord?.id,
          // Exposed separately (not just the collapsed `id` above) so callers
          // like the email-send flow can associate a send with the exact
          // right record type instead of guessing which kind `id` is.
          contactId: contactRecord?.id,
          companyId: companyRecord?.id,
          dealId: dealRecord?.id,
          url: dealRecord?.id && process.env.HUBSPOT_PORTAL_ID
            ? `https://app.hubspot.com/contacts/${process.env.HUBSPOT_PORTAL_ID}/deal/${dealRecord.id}`
            : undefined,
          warnings,
        };
      } else {
        result.hubspot = {
          status: 'skipped',
          message: 'HubSpot skipped: add a verified email or configure HUBSPOT_DEAL_STAGE_ID for opportunity sync.',
          warnings,
        };
      }
    } catch (err) {
      result.hubspot = {
        status: 'error',
        message: err.message || 'HubSpot sync failed.',
      };
    }
  }

  const scout = getScoutConfig();
  if (scout.apiUrl && scout.apiKey && scout.workspaceId) {
    try {
      const base = scout.apiUrl.replace(/\/+$/, '');
      const resp = await fetch(`${base}/leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${scout.apiKey}`,
          'X-Scout-Workspace-Id': scout.workspaceId,
        },
        body: JSON.stringify({
          workspace_id: scout.workspaceId,
          source: 'Camelot Scout OS',
          building,
          contact,
          quality,
          routing,
          pushed_at: new Date().toISOString(),
        }),
      });
      const text = await resp.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { message: text }; }
      if (!resp.ok) throw new Error(data?.message || data?.error || `Scout API failed: ${resp.status}`);
      result.scout = {
        status: 'ok',
        message: 'Scout lead pushed to external Scout API and saved locally.',
        id: data.id || data.lead_id || data.uuid,
        url: data.url,
      };
    } catch (err) {
      result.scout = {
        status: 'ok',
        message: `Saved locally. External Scout API push failed: ${err.message || 'Scout API push failed.'}`,
        id: localLead.id,
        url: '/api/integrations/local-leads',
        warnings: [err.message || 'Scout API push failed.'],
      };
    }
  } else {
    result.scout = {
      status: 'ok',
      message: 'Saved locally. External Scout API not configured.',
      id: localLead.id,
      url: '/api/integrations/local-leads',
      warnings: ['Set SCOUT_API_URL, SCOUT_API_KEY, and SCOUT_WORKSPACE_ID for external Scout push.'],
    };
  }

  const hasError = result.scout.status === 'error' || result.hubspot.status === 'error';
  const hasOk = result.scout.status === 'ok' || result.hubspot.status === 'ok';
  result.status = hasError && hasOk ? 'partial' : hasError ? 'error' : hasOk ? 'ok' : 'skipped';
  const statusCode = result.status === 'error' ? 502 : 200;
  res.status(statusCode).json(result);
});

app.post('/api/apollo/enrich', async (req, res) => {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) {
    return res.status(400).json({ error: 'Apollo API key not configured. Add APOLLO_API_KEY in Render environment.' });
  }
  try {
    const resp = await fetch('https://api.apollo.io/v1/people/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first_name: String(req.body?.first_name || '').slice(0, 100),
        last_name: String(req.body?.last_name || '').slice(0, 100),
        organization_name: String(req.body?.organization_name || '').slice(0, 200),
        domain: String(req.body?.domain || '').slice(0, 255),
        api_key: apiKey,
      }),
    });
    const text = await resp.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { error: text || 'Empty response' }; }
    res.status(resp.ok ? 200 : resp.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Apollo proxy error' });
  }
});

// Generic Apollo API proxy for org/people search — lets the frontend run
// contact enrichment with the SERVER-side APOLLO_API_KEY (set in Render),
// so no key ever needs to be baked into the browser bundle. Only two
// whitelisted Apollo paths are allowed through.
const APOLLO_PROXY_PATHS = {
  'org-search': 'https://api.apollo.io/v1/organizations/search',
  'people-search': 'https://api.apollo.io/v1/people/search',
};
app.post('/api/apollo/:proxyPath(org-search|people-search)', async (req, res) => {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) {
    return res.status(400).json({ error: 'Apollo API key not configured. Add APOLLO_API_KEY in Render environment.' });
  }
  try {
    const resp = await fetch(APOLLO_PROXY_PATHS[req.params.proxyPath], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      body: JSON.stringify(req.body || {}),
    });
    const text = await resp.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { error: text || 'Empty response' }; }
    res.status(resp.ok ? 200 : resp.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Apollo proxy error' });
  }
});

app.post('/api/prospeo/find-email', async (req, res) => {
  const apiKey = process.env.PROSPEO_API_KEY;
  if (!apiKey) return res.status(400).json({ error: 'Prospeo API key not configured.' });
  try {
    const upstream = await fetch('https://api.prospeo.io/api/v1/email-finder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-KEY': apiKey },
      body: JSON.stringify({
        first_name: String(req.body?.first_name || '').slice(0, 100),
        last_name: String(req.body?.last_name || '').slice(0, 100),
        company_name: String(req.body?.company_name || '').slice(0, 200),
        domain: String(req.body?.domain || '').slice(0, 255),
      }),
    });
    const text = await upstream.text();
    let payload;
    try { payload = JSON.parse(text); } catch { payload = { error: text || 'Empty response' }; }
    return res.status(upstream.ok ? 200 : upstream.status).json(payload);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Prospeo proxy error' });
  }
});

// ============================================================
// Spire MDS — Camelot's own property-management/accounting backend
// (Resident Management, AP, GL, Work Orders — SPIREAPI). Server-side
// only: the API key/client secret must never reach the browser bundle.
// Covers only buildings Camelot actively manages (not prospects), but
// for that subset its recorded unit counts are a stronger source of
// truth than NYC DOF/PLUTO estimates, so this is used to cross-check
// and override unit counts when a managed building matches by address.
// ============================================================
const SPIRE_BASE = 'https://camelot.spiremds.com/api';
let spireTokenCache = { token: '', expiresAt: 0 };
let spireBuildingsCache = { data: null, fetchedAt: 0 };
const SPIRE_BUILDINGS_CACHE_MS = 10 * 60 * 1000; // 10 minutes

function getSpireConfig() {
  return {
    apiKey: process.env.SPIRE_MDS_API_KEY || '',
    clientSecret: process.env.SPIRE_MDS_CLIENT_SECRET || '',
  };
}

async function getSpireToken() {
  const now = Date.now();
  if (spireTokenCache.token && spireTokenCache.expiresAt > now + 30000) {
    return spireTokenCache.token;
  }
  const { apiKey, clientSecret } = getSpireConfig();
  if (!apiKey || !clientSecret) throw new Error('Spire MDS credentials not configured');
  const resp = await fetch(`${SPIRE_BASE}/Authorize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ APIKey: apiKey, ClientSecret: clientSecret }),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Spire auth failed (${resp.status}): ${text.slice(0, 200)}`);
  }
  const raw = await resp.text();
  const token = raw.trim().replace(/^"|"$/g, ''); // endpoint returns the raw JWT as a JSON string
  // Token is valid for 15 minutes per Spire's docs; cache for 14 to stay safe.
  spireTokenCache = { token, expiresAt: now + 14 * 60 * 1000 };
  return token;
}

async function fetchSpireBuildings() {
  const now = Date.now();
  if (spireBuildingsCache.data && now - spireBuildingsCache.fetchedAt < SPIRE_BUILDINGS_CACHE_MS) {
    return spireBuildingsCache.data;
  }
  const token = await getSpireToken();
  const resp = await fetch(`${SPIRE_BASE}/RM/BuildingsList`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Spire buildings fetch failed (${resp.status}): ${text.slice(0, 200)}`);
  }
  const data = await resp.json();
  spireBuildingsCache = { data, fetchedAt: now };
  return data;
}

// Spire's building records carry no BBL, so address text is the only
// reliable join key against a Scout/Jackie lookup address.
function normalizeAddressForSpireMatch(addr) {
  return String(addr || '')
    .toLowerCase()
    .replace(/[.,]/g, '')
    .replace(/\bstreet\b/g, 'st').replace(/\bavenue\b/g, 'ave')
    .replace(/\bboulevard\b/g, 'blvd').replace(/\bplace\b/g, 'pl')
    .replace(/\broad\b/g, 'rd').replace(/\bdrive\b/g, 'dr')
    .replace(/\s+/g, ' ')
    .trim();
}

app.get('/api/spire/building-lookup', async (req, res) => {
  const { apiKey, clientSecret } = getSpireConfig();
  if (!apiKey || !clientSecret) {
    return res.status(400).json({ error: 'Spire MDS not configured. Add SPIRE_MDS_API_KEY and SPIRE_MDS_CLIENT_SECRET in Render environment.' });
  }
  const address = String(req.query.address || '').trim();
  if (!address) return res.status(400).json({ error: 'address query param required' });
  try {
    const buildings = await fetchSpireBuildings();
    const target = normalizeAddressForSpireMatch(address);
    const match = buildings.find((b) => {
      const candidate = normalizeAddressForSpireMatch(b.Address1);
      return candidate && (candidate === target || target.startsWith(candidate) || candidate.startsWith(target));
    });
    if (!match) return res.json({ matched: false });
    return res.json({
      matched: true,
      buildingName: match.RentalBuildingName || match.CoopCondoCompanyName || '',
      address: match.Address1,
      unitsResidential: match.NumberOfResidentialUnits || 0,
      unitsCommercial: match.NumberOfCommercialUnits || 0,
      unitsTotal: match.TotalUnits || match.NumberOfUnits || 0,
      block: match.Block || '',
      lot: match.Lot || '',
      propertyManagerName: match.PropertyManagerName || '',
      propertyManagerEmail: match.PropertyManagerEmail || '',
    });
  } catch (err) {
    res.status(502).json({ error: err.message || 'Spire lookup error' });
  }
});

// ============================================================
// Health check
// ============================================================
// ---------------------------------------------------------------------------
// AI chat proxy — the Merlin bot agent's brain lives server-side so the key
// never ships in the public bundle (the old static site leaked keys that way).
// Configure with OPENAI_API_KEY (or AI_API_KEY) in Render → Environment.
// ---------------------------------------------------------------------------
const getAiKey = () => process.env.OPENAI_API_KEY || process.env.AI_API_KEY || '';
const getAiUrl = () => process.env.AI_API_URL || 'https://api.openai.com/v1/chat/completions';
const getAiModel = () => process.env.AI_MODEL || process.env.VITE_AI_MODEL || 'gpt-4o-mini';

app.post('/api/ai/chat', async (req, res) => {
  const key = getAiKey();
  if (!key) {
    return res.status(400).json({ error: 'AI is not configured. Add OPENAI_API_KEY in Render → Environment and redeploy.' });
  }
  const { messages, temperature, max_tokens } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages[] required' });
  }
  try {
    const upstream = await fetch(getAiUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: getAiModel(),
        messages: messages.slice(-40),
        temperature: typeof temperature === 'number' ? temperature : 0.7,
        max_tokens: typeof max_tokens === 'number' ? Math.min(max_tokens, 4096) : 2048,
        stream: false,
      }),
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const msg = data?.error?.message || `AI upstream error ${upstream.status}`;
      return res.status(upstream.status === 401 ? 401 : 502).json({ error: msg });
    }
    return res.json({ content: data.choices?.[0]?.message?.content || '' });
  } catch (err) {
    return res.status(502).json({ error: `AI upstream unreachable: ${err?.message || 'unknown error'}` });
  }
});

// ============================================================
// Document text extraction (Agreements page uploads)
// Accepts a base64 PDF or Word file and returns its plain text so the
// client can parse PropertyShark exports, rent rolls, offering docs, etc.
// PDFs run through pdf-parse; .docx runs through pizzip (raw XML → text).
// ============================================================
app.post('/api/documents/extract-text', async (req, res) => {
  const { filename = '', base64 = '' } = req.body || {};
  if (!base64 || typeof base64 !== 'string') {
    return res.status(400).json({ error: 'base64 file content required' });
  }
  let buffer;
  try {
    buffer = Buffer.from(base64.replace(/^data:[^;]+;base64,/, ''), 'base64');
  } catch {
    return res.status(400).json({ error: 'Invalid base64 payload' });
  }
  if (buffer.length > 20 * 1024 * 1024) {
    return res.status(413).json({ error: 'File too large (20MB max)' });
  }
  const lower = String(filename).toLowerCase();
  try {
    if (lower.endsWith('.docx') || lower.endsWith('.docm') || lower.endsWith('.dotx')) {
      const { default: PizZip } = await import('pizzip');
      const zip = new PizZip(buffer);
      const docXml = zip.file('word/document.xml')?.asText() || '';
      const text = docXml
        .replace(/<w:p[ >]/g, '\n<w:p ')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      return res.json({ text, kind: 'docx' });
    }
    // Default: treat as PDF. Import the parser lazily so the server still
    // boots even if the dependency is missing in an old deploy.
    const { default: pdfParse } = await import('pdf-parse/lib/pdf-parse.js');
    const parsed = await pdfParse(buffer);
    return res.json({ text: (parsed.text || '').trim(), kind: 'pdf', pages: parsed.numpages });
  } catch (err) {
    console.error('Document extract failed:', err?.message || err);
    return res.status(422).json({ error: `Could not read ${filename || 'file'}: ${err?.message || 'unsupported or corrupted file'}` });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '10.0.0',
    hubspot: !!getHubSpotApiKey(),
    apollo: !!process.env.APOLLO_API_KEY,
    ai: !!getAiKey(),
    spire: !!(process.env.SPIRE_MDS_API_KEY && process.env.SPIRE_MDS_CLIENT_SECRET),
    timestamp: new Date().toISOString()
  });
});

// ============================================================
// Jackie Building Branding / Website Research
// Searches for an official building website, then scrapes visible text,
// images, amenities, and commercial-use signals server-side to avoid CORS.
// ============================================================
const BLOCKED_BRAND_DOMAINS = [
  'streeteasy.com', 'zillow.com', 'trulia.com', 'realtor.com', 'redfin.com',
  'propertyshark.com', 'apartments.com', 'renthop.com', 'compass.com',
  'elliman.com', 'corcoran.com', 'brownharrisstevens.com', 'cityrealty.com',
  'google.com', 'bing.com', 'duckduckgo.com', 'facebook.com', 'instagram.com',
  'linkedin.com', 'wikipedia.org', 'nyc.gov',
];

function cleanText(value) {
  return String(value || '').replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
}

function absoluteUrl(src, base) {
  try { return new URL(src, base).href; } catch { return null; }
}

function scoreOfficialCandidate(url, address, name) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '').toLowerCase();
    if (BLOCKED_BRAND_DOMAINS.some(d => host.includes(d))) return -100;
    const hay = `${host} ${u.pathname}`.toLowerCase();
    const addrNum = (address || '').match(/\d+/)?.[0] || '';
    let score = 0;
    if (addrNum && hay.includes(addrNum)) score += 30;
    for (const token of String(address || '').toLowerCase().split(/\s+/).filter(t => t.length > 3).slice(0, 5)) {
      if (hay.includes(token.replace(/[^a-z0-9]/g, ''))) score += 8;
    }
    for (const token of String(name || '').toLowerCase().split(/\s+/).filter(t => t.length > 3).slice(0, 6)) {
      if (hay.includes(token.replace(/[^a-z0-9]/g, ''))) score += 8;
    }
    if (/\b(condo|coop|co-op|residence|residences|building|tower|property|amenities)\b/.test(hay)) score += 10;
    return score;
  } catch {
    return -100;
  }
}

function classifyCommercialSource(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    if (host.includes('loopnet.com')) return 'LoopNet';
    if (host.includes('costar.com')) return 'CoStar';
    if (host.includes('propertyshark.com')) return 'PropertyShark';
    if (host.includes('nyc.gov') || host.includes('opendata.cityofnewyork.us') || host.includes('data.cityofnewyork.us')) return 'NYC records';
    if (/iconparking|ipark|lazparking|spplus|parking\.com|edisonparkfast|quikpark|propark|championparking|cityparking|manhattanparking|littlemanparking/i.test(host)) return 'NYC parking operator';
    return null;
  } catch {
    return null;
  }
}

function classifyCommercialSignal(text, source) {
  const hay = `${source || ''} ${text || ''}`.toLowerCase();
  const signals = [];
  if (/\b(retail|storefront|restaurant|cafe|market|salon|commercial condo|commercial unit)\b/i.test(hay)) signals.push('Retail / storefront signal from commercial source');
  if (/\b(office|professional suite|coworking|commercial office)\b/i.test(hay)) signals.push('Office signal from commercial source');
  if (/\b(doctor|medical|clinic|physician|dental|healthcare)\b/i.test(hay)) signals.push('Medical / doctor-office signal from commercial source');
  if (/\b(storage cage|storage locker|private storage|storage unit|storage available)\b/i.test(hay)) signals.push('Storage cage / storage-unit signal from commercial source');
  if (/\b(parking garage|garage|monthly parking|indoor parking|parking operator|valet|parking available)\b/i.test(hay)) signals.push('Parking garage / operator signal from commercial source');
  if (/\b(billboard|signage|advertising sign|wallscape)\b/i.test(hay)) signals.push('Billboard / signage signal from commercial source');
  return signals;
}

async function searchCommercialSources(address, name) {
  const base = `"${address}" "${name || ''}"`;
  const queries = [
    `${base} site:loopnet.com retail office medical parking storage`,
    `${base} site:costar.com commercial tenant retail office garage`,
    `${base} site:propertyshark.com commercial condo parking garage`,
    `${base} "parking garage" "New York"`,
    `${base} "Icon Parking" OR "iPark" OR "LAZ Parking" OR "SP+" OR "Edison ParkFast" OR "Quik Park"`,
    `${base} site:nyc.gov garage parking curb cut certificate of occupancy`,
    `${base} site:data.cityofnewyork.us parking garage`,
  ];
  const sourceHits = [];
  const signals = [];

  for (const query of queries) {
    try {
      const searchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const resp = await fetch(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0 CamelotJackie/1.0' }, signal: AbortSignal.timeout(9000) });
      if (!resp.ok) continue;
      const html = await resp.text();
      const matches = [...html.matchAll(/class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)]
        .slice(0, 5);
      for (const m of matches) {
        const rawHref = m[1].replace(/&amp;/g, '&');
        let url = rawHref;
        try {
          const u = new URL(rawHref, 'https://duckduckgo.com');
          const uddg = u.searchParams.get('uddg');
          url = uddg ? decodeURIComponent(uddg) : rawHref;
        } catch {}
        const source = classifyCommercialSource(url);
        if (!source) continue;
        const title = cleanText(m[2]);
        const after = html.slice(m.index || 0, (m.index || 0) + 1200);
        const snippet = cleanText((after.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/[^>]+>/i) || [])[1] || '');
        if (sourceHits.some(h => h.url === url)) continue;
        sourceHits.push({ source, url, title, snippet });
        signals.push(...classifyCommercialSignal(`${title} ${snippet}`, source));
      }
    } catch (err) {
      console.warn('Commercial source search failed:', query, err.message);
    }
  }

  return {
    sourceHits: sourceHits.slice(0, 12),
    signals: [...new Set(signals)],
    searchedSources: ['LoopNet', 'CoStar', 'PropertyShark', 'NYC records', 'NYC parking operators'],
    searchedAt: new Date().toISOString(),
  };
}

app.get('/api/building/brand', async (req, res) => {
  try {
    const address = String(req.query.address || '').trim();
    const name = String(req.query.name || '').trim();
    if (!address && !name) return res.status(400).json({ error: 'address or name is required' });

    const rawQuery = `"${name || address}" "${address}" official building amenities`;
    const searchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(rawQuery)}`;
    const searchResp = await fetch(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0 CamelotJackie/1.0' } });
    const searchHtml = await searchResp.text();
    const links = [...searchHtml.matchAll(/class="result__a"[^>]+href="([^"]+)"/g)]
      .map(m => m[1].replace(/&amp;/g, '&'))
      .map(href => {
        try {
          const u = new URL(href, 'https://duckduckgo.com');
          const uddg = u.searchParams.get('uddg');
          return uddg ? decodeURIComponent(uddg) : href;
        } catch {
          return href;
        }
      })
      .filter(Boolean);

    const candidates = [...new Set(links)]
      .map(url => ({ url, score: scoreOfficialCandidate(url, address, name) }))
      .filter(c => c.score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    let official = null;
    for (const c of candidates) {
      try {
        const pageResp = await fetch(c.url, { headers: { 'User-Agent': 'Mozilla/5.0 CamelotJackie/1.0' }, signal: AbortSignal.timeout(9000) });
        if (!pageResp.ok) continue;
        const html = await pageResp.text();
        const text = cleanText(html);
        const title = cleanText((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '');
        const meta = cleanText((html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i) || [])[1] || '');
        const imageMatches = [...html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)]
          .map(m => absoluteUrl(m[1], c.url))
          .filter(Boolean)
          .filter(src => !/logo|icon|sprite|tracking|pixel/i.test(src))
          .slice(0, 8);
        const amenityKeywords = ['storage', 'storage cage', 'parking', 'garage', 'bike room', 'library', 'pool', 'gym', 'fitness', 'lounge', 'roof deck', 'terrace', 'garden', 'courtyard', 'playroom', 'concierge', 'doorman', 'package room', 'valet', 'spa', 'sauna'];
        const commercialKeywords = ['retail', 'office', 'doctor', 'medical', 'restaurant', 'storefront', 'commercial', 'billboard', 'signage', 'garage', 'parking'];
        official = {
          url: c.url,
          title,
          description: meta || text.slice(0, 260),
          images: imageMatches,
          amenities: amenityKeywords.filter(k => new RegExp(`\\b${k.replace(/\s+/g, '\\s+')}\\b`, 'i').test(text)),
          commercialSignals: commercialKeywords.filter(k => new RegExp(`\\b${k.replace(/\s+/g, '\\s+')}\\b`, 'i').test(text)),
          textSample: text.slice(0, 1200),
          searchedAt: new Date().toISOString(),
        };
        break;
      } catch (err) {
        console.warn('Brand candidate scrape failed:', c.url, err.message);
      }
    }

    const commercialResearch = await searchCommercialSources(address, name).catch(err => ({
      sourceHits: [],
      signals: [],
      searchedSources: ['LoopNet', 'CoStar', 'PropertyShark', 'NYC records', 'NYC parking operators'],
      error: err.message,
      searchedAt: new Date().toISOString(),
    }));

    res.json({ official, candidates, commercialResearch, query: rawQuery, searchedAt: new Date().toISOString() });
  } catch (err) {
    console.error('Building branding research error:', err);
    res.status(500).json({ error: err.message || 'Building branding research failed' });
  }
});
// ============================================================
// Scout Intelligence Engine — property scan/report
// ============================================================
app.post('/api/scout/scan', async (req, res) => {
  try {
    const { address, propertyType, borough, units } = req.body || {};

    if (!address) {
      return res.status(400).json({ error: 'Address is required' });
    }

    const result = {
      address,
      propertyType: propertyType || 'unknown',
      borough: borough || 'unknown',
      units: units || null,
      building_score: 68,
      risk_level: 'moderate',
      opportunity_level: 'high',
      flags: [
        'Potential compliance exposure',
        'Possible revenue leakage',
        'Management takeover opportunity'
      ],
      recommended_action: 'Generate Camelot Property Intelligence & Opportunity Report'
    };

    res.json(result);
  } catch (err) {
    console.error('Scout scan error:', err);
    res.status(500).json({ error: err.message || 'Scout scan failed' });
  }
});

app.post('/api/scout/report', async (req, res) => {
  try {
    const { address, ownerName, propertyType, units } = req.body || {};

    if (!address) {
      return res.status(400).json({ error: 'Address is required' });
    }

    const report = {
      title: 'Camelot Property Intelligence & Opportunity Report',
      address,
      ownerName: ownerName || 'Ownership not provided',
      executive_summary:
        'Camelot identified potential opportunities to reduce compliance exposure, improve lease administration, increase revenue, and modernize building operations through Camelot OS.',
      property_snapshot: {
        propertyType: propertyType || 'unknown',
        units: units || null
      },
      findings: [
        'Lease renewal and rider compliance should be audited',
        'HPD/DOB/DOF compliance status should be reviewed',
        'Rent roll should be benchmarked against market',
        'Vendor and operating expense structure should be reviewed'
      ],
      camelot_advantage: [
        'Guardian lease and compliance enforcement',
        'Scout property intelligence and opportunity scoring',
        'Camelot Core routing and workflow automation',
        'HubSpot deal creation and business development follow-up'
      ],
      next_steps: [
        'Complete operating audit',
        'Review rent roll and lease files',
        'Review violations and agency filings',
        'Prepare management transition plan'
      ]
    };

    res.json(report);
  } catch (err) {
    console.error('Scout report error:', err);
    res.status(500).json({ error: err.message || 'Scout report failed' });
  }
});

// ============================================================
// Camelot Core — master router
// ============================================================
app.post('/api/core/route', async (req, res) => {
  try {
    const { source, message, address, intent } = req.body || {};

    let routed_to = 'core';

    if (intent?.includes('lease') || message?.toLowerCase().includes('lease')) {
      routed_to = 'guardian';
    } else if (intent?.includes('property') || address) {
      routed_to = 'scout';
    } else if (intent?.includes('marketing') || message?.toLowerCase().includes('post')) {
      routed_to = 'guinevere';
    }

    res.json({
      status: 'routed',
      source: source || 'unknown',
      routed_to,
      message_received: message || null,
      address: address || null
    });
  } catch (err) {
    console.error('Core route error:', err);
    res.status(500).json({ error: err.message || 'Core routing failed' });
  }
});
// ============================================================
// Template Concierge — fills branded Camelot document templates
// ============================================================
// Master .docx files live in server/doc-templates/<id>.docx with
// {merge_tag} placeholders. Field schemas for what to ask the user live
// in src/lib/document-templates.ts (kept in sync manually for now — a
// template is only wired here once its master .docx exists).
const DOC_TEMPLATES_DIR = path.join(__dirname, 'server', 'doc-templates');

// id -> master docx filename (must match a file in server/doc-templates/)
const READY_TEMPLATE_FILES = {
  'work-order-request-form': 'work-order-request.docx',
  'coi-tracking-form': 'coi-tracking-form.docx',
  'w9-request-cover-sheet': 'w9-request-cover-sheet.docx',
  'bank-questionnaire-cover-sheet': 'bank-questionnaire-cover-sheet.docx',
  'rpie-abatement-filing-tracker': 'rpie-abatement-filing-tracker.docx',
  'sales-package-cover-sheet': 'sales-package-cover-sheet.docx',
  'rental-package-cover-sheet': 'rental-package-cover-sheet.docx',
  'unit-alteration-agreement': 'unit-alteration-agreement.docx',
  'board-meeting-proxy-form': 'board-meeting-proxy-form.docx',
  'annual-special-meeting-notice': 'annual-special-meeting-notice.docx',
  'board-meeting-minutes': 'board-meeting-minutes.docx',
  'monthly-management-report-cover-sheet': 'monthly-management-report-cover-sheet.docx',
  'purchase-order-form': 'purchase-order-form.docx',
  'amenity-reservation-request-form': 'amenity-reservation-request-form.docx',
  'capital-project-status-report': 'capital-project-status-report.docx',
  'vendor-work-authorization': 'vendor-work-authorization.docx',
};

app.get('/api/templates/list', async (_req, res) => {
  try {
    const fs = await import('fs');
    const ids = Object.keys(READY_TEMPLATE_FILES).filter((id) =>
      fs.existsSync(path.join(DOC_TEMPLATES_DIR, READY_TEMPLATE_FILES[id]))
    );
    res.json({ ready_ids: ids });
  } catch (err) {
    console.error('Templates list error:', err);
    res.status(500).json({ error: 'Could not list templates' });
  }
});

app.post('/api/templates/generate', async (req, res) => {
  try {
    const { templateId, answers } = req.body || {};
    if (!templateId || typeof templateId !== 'string') {
      return res.status(400).json({ error: 'templateId is required' });
    }
    const filename = READY_TEMPLATE_FILES[templateId];
    if (!filename) {
      return res.status(404).json({ error: `No generator wired for template "${templateId}" yet` });
    }
    const fs = await import('fs');
    const masterPath = path.join(DOC_TEMPLATES_DIR, filename);
    if (!fs.existsSync(masterPath)) {
      return res.status(500).json({ error: 'Master template file missing on server' });
    }
    const { default: Docxtemplater } = await import('docxtemplater');
    const { default: PizZip } = await import('pizzip');

    const content = fs.readFileSync(masterPath, 'binary');
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true, nullGetter: () => '' });
    doc.render(answers || {});

    const buf = doc.getZip().generate({ type: 'nodebuffer' });
    const safeName = templateId.replace(/[^a-z0-9-]/gi, '_');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="Camelot_${safeName}.docx"`);
    res.send(buf);
  } catch (err) {
    console.error('Template generate error:', err);
    res.status(500).json({ error: err.message || 'Document generation failed' });
  }
});

// Cost-Cutting Analysis Routes
app.use(costCuttingRoutes);

// Serve fingerprinted assets with long-lived caching, but never cache the SPA
// document itself. This prevents an obsolete dashboard shell from surviving a
// production deploy while keeping hashed JS/CSS assets efficient.
app.use(express.static(path.join(__dirname, 'dist'), {
  fallthrough: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store');
    } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  },
}));

// SPA fallback — serve index.html for all non-file routes
app.get('*', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => console.log(`Camelot OS running on port ${PORT}`));
