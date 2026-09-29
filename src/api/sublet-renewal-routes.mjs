/**
 * Sublet Renewal Tracker — routes, portfolio scan, and scheduler.
 *
 * Scans every Camelot-managed co-op/condo in Spire MDS for sublet leases that
 * expire soon, stores them in Supabase (sublet_renewals) as a trackable work
 * queue, and emails the team a digest. Business rules live in
 * sublet-renewals-core.mjs.
 *
 * GET   /api/renewals/sublets                 — list (filters: minDays, maxDays, status, urgency, building, q)
 * GET   /api/renewals/sublets/export.csv      — same filters, CSV download
 * GET   /api/renewals/sublets/summary         — counts + fee / brokerage revenue view
 * PATCH /api/renewals/sublets/:id             — update workflow (status, fee_status, assigned_to, sublease_rent, notes, next_follow_up)
 * GET   /api/renewals/sublets/:id/activity    — audit trail for one renewal
 * POST  /api/renewals/sublets/:id/owner-notice — { send?: boolean, to?: string } preview (default) or send the owner notice
 * POST  /api/renewals/sublets/scan            — run a portfolio scan now
 * POST  /api/renewals/sublets/digest          — send the team digest now
 * GET   /api/renewals/sublets/diagnostics     — real category / status codes found in MDS (for calibrating detection)
 * GET   /api/renewals/sublets/scans           — scan history
 *
 * ACCESS: this data includes subtenant names, phones, emails and rents, so
 * every route requires EITHER a verified Supabase user session OR the
 * X-Camelot-Ops-Key header matching CAMELOT_OPS_KEY. With neither
 * configured the routes refuse to serve (fail closed).
 */

import express from 'express';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createSpireClient } from './spire-client.mjs';
import { wrapCamelotEmailHtml } from './camelot-email-branding.mjs';
import {
  DEFAULT_RENEWAL_FEE, DEFAULT_WINDOW, SCAN_HORIZON_DAYS, WORKFLOW_STATUSES, FEE_STATUSES,
  addDays, nyDateString, daysBetween, urgencyBucket, isCoopCondoBuilding, buildRenewalRecord,
  parseSpireDate, inWindow, revenueSummary, toCsv, buildDigestHtml, buildOwnerNotice, subletPattern,
} from './sublet-renewals-core.mjs';

/* global console, process, fetch, setInterval, setTimeout, Buffer */

const EDITABLE_FIELDS = ['status', 'fee_status', 'fee_amount', 'assigned_to', 'sublease_rent', 'notes', 'next_follow_up', 'brokerage_interest'];

let supabaseInstance = null;
function getSupabase() {
  if (!supabaseInstance) {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    supabaseInstance = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return supabaseInstance;
}

export function renewalFee(env = process.env) {
  const n = Number(env.SUBLET_RENEWAL_FEE);
  return Number.isFinite(n) && n >= 0 && String(env.SUBLET_RENEWAL_FEE ?? '').trim() !== '' ? n : DEFAULT_RENEWAL_FEE;
}

function recipients(env = process.env) {
  return String(env.SUBLET_RENEWAL_RECIPIENTS || 'info@camelot.nyc').split(',').map((s) => s.trim()).filter(Boolean);
}

function appUrl(env = process.env) {
  return String(env.PUBLIC_APP_URL || 'https://camelot-os.onrender.com').replace(/\/+$/, '');
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ---------------------------------------------------------------------------
// Access control (fail closed — this is tenant PII)
// ---------------------------------------------------------------------------
export function createOpsAccessMiddleware({ env = process.env, getAuthClient = getSupabase } = {}) {
  return async function requireOpsAccess(req, res, next) {
    const opsKey = String(env.CAMELOT_OPS_KEY || '').trim();
    const presented = String(req.headers['x-camelot-ops-key'] || '').trim();
    if (opsKey && presented) {
      const a = Buffer.from(opsKey); const b = Buffer.from(presented);
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
        req.opsActor = 'ops-key';
        return next();
      }
      return res.status(401).json({ error: 'Invalid Camelot ops key.', code: 'OPS_KEY_INVALID' });
    }
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (token) {
      const client = getAuthClient();
      if (client) {
        try {
          const { data, error } = await client.auth.getUser(token);
          if (!error && data?.user) {
            req.user = data.user;
            req.opsActor = data.user.email || data.user.id;
            return next();
          }
        } catch { /* fall through */ }
      }
    }
    if (!opsKey) {
      return res.status(503).json({ error: 'Sublet Renewals is locked: set CAMELOT_OPS_KEY in Render → Environment.', code: 'OPS_KEY_NOT_CONFIGURED' });
    }
    return res.status(401).json({ error: 'Enter the Camelot ops key to view sublet renewals.', code: 'OPS_KEY_REQUIRED' });
  };
}

// ---------------------------------------------------------------------------
// Portfolio scan
// ---------------------------------------------------------------------------
/**
 * Pull every co-op/condo building, list units with a lease ending within the
 * scan horizon, classify sublets, enrich with contacts + occupant detail, and
 * upsert into sublet_renewals (workflow fields are never overwritten).
 */
export async function runSubletRenewalScan({
  spire = createSpireClient(), supabase = getSupabase(), env = process.env,
  now = new Date(), horizonDays = SCAN_HORIZON_DAYS, delayMs = 150, trigger = 'manual',
} = {}) {
  const startedAt = Date.now();
  const today = nyDateString(now);
  const summary = { today, buildingsScanned: 0, unitsReturned: 0, subletsFound: 0, inserted: 0, updated: 0, enteredWindow: 0, errors: [] };
  if (!spire.isConfigured) return { status: 'error', error: 'Spire is not configured (SPIRE_MDS_API_KEY / SPIRE_MDS_CLIENT_SECRET).', ...summary };
  if (!supabase) return { status: 'error', error: 'Supabase is not configured.', ...summary };

  const buildingsRes = await spire.listBuildingsRaw();
  if (!buildingsRes.ok) return { status: 'error', error: buildingsRes.error?.message, ...summary };
  const includeRentals = String(env.SUBLET_INCLUDE_RENTALS || '').toLowerCase() === 'true';
  const buildings = (buildingsRes.data.items || []).filter((b) => includeRentals || isCoopCondoBuilding(b));

  // Scan from 30 days in the past so expired-but-unrenewed sublets stay visible.
  const from = addDays(today, -30);
  const to = addDays(today, horizonDays);
  const fee = renewalFee(env);
  const records = [];

  for (const building of buildings) {
    const buildingRcd = building.BuildingRcd ?? building.ID;
    if (!buildingRcd) continue;
    summary.buildingsScanned += 1;
    const unitsRes = await spire.listUnitsFiltered({
      BuildingRcds: buildingRcd, IncludeCurrent: true, IncludeFuture: true,
      IncludePrimaryContacts: true, IncludeSecondaryContacts: true,
      LeaseEndFrom: from, LeaseEndTo: to,
    });
    if (!unitsRes.ok) {
      summary.errors.push({ building: building.BuildingNumber, error: unitsRes.error?.message });
      continue;
    }
    const units = unitsRes.data.items || [];
    summary.unitsReturned += units.length;

    for (const row of units) {
      // Re-filter client-side — never trust a Spire list filter blindly.
      const rowForClass = { ...row, BuildingRcd: row.BuildingRcd ?? buildingRcd };
      const leaseEnd = parseSpireDate(row.LeaseExpireDate);
      if (!leaseEnd || leaseEnd < from || leaseEnd > to) continue;
      // Contacts + occupant detail supply the subtenant/owner split, the
      // authoritative current-lease dates, and the owner's billing address.
      const occupancyRcd = row.OccupancyRcd || row.CurrentOccupancyRcd;

      let contacts = [];
      let occupant = null;
      if (occupancyRcd) {
        const c = await spire.getUnitContacts({ buildingRcd, occupancyRcd });
        if (c.ok) contacts = c.data.items || [];
        const o = await spire.getOccupant({ buildingRcd, occupancyRcd });
        if (o.ok) occupant = o.data;
        if (delayMs) await sleep(delayMs);
      }
      const record = buildRenewalRecord(rowForClass, { building, contacts, occupant, env, today });
      if (record) records.push(record);
    }
    if (delayMs) await sleep(delayMs);
  }
  summary.subletsFound = records.length;

  // Upsert — preserve workflow state on existing rows.
  const keys = records.map((r) => r.renewal_key);
  const existing = new Map();
  for (let i = 0; i < keys.length; i += 200) {
    const { data, error } = await supabase.from('sublet_renewals').select('id, renewal_key, entered_window_at, status').in('renewal_key', keys.slice(i, i + 200));
    if (error) throw new Error(`sublet_renewals read failed: ${error.message}`);
    for (const row of data || []) existing.set(row.renewal_key, row);
  }
  const nowIso = now.toISOString();
  for (const record of records) {
    const prior = existing.get(record.renewal_key);
    const windowNow = inWindow(record, DEFAULT_WINDOW);
    const payload = { ...record, last_seen_at: nowIso, still_in_mds: true };
    if (windowNow && !prior?.entered_window_at) { payload.entered_window_at = nowIso; summary.enteredWindow += 1; }
    if (prior) {
      const { error } = await supabase.from('sublet_renewals').update(payload).eq('id', prior.id);
      if (error) summary.errors.push({ key: record.renewal_key, error: error.message }); else summary.updated += 1;
    } else {
      const { data, error } = await supabase.from('sublet_renewals')
        .insert({ ...payload, status: 'identified', fee_status: 'not_billed', fee_amount: fee, first_seen_at: nowIso })
        .select('id').single();
      if (error) summary.errors.push({ key: record.renewal_key, error: error.message });
      else {
        summary.inserted += 1;
        await supabase.from('sublet_renewal_activity').insert({ renewal_id: data.id, actor: `scan:${trigger}`, action: 'identified', detail: { signals: record.detection_signals, confidence: record.detection_confidence } });
      }
    }
  }

  // Refresh days_to_expiry/urgency on open rows the scan didn't touch
  // (e.g. lease date changed in MDS → new key; old row goes stale).
  const { data: openRows } = await supabase.from('sublet_renewals').select('id, renewal_key, lease_end_date')
    .not('status', 'in', '(closed_renewed,brokerage_leased,dismissed)');
  const seen = new Set(keys);
  for (const row of openRows || []) {
    if (seen.has(row.renewal_key) || !row.lease_end_date) continue;
    const days = daysBetween(today, row.lease_end_date);
    await supabase.from('sublet_renewals').update({ days_to_expiry: days, urgency: urgencyBucket(days), still_in_mds: false }).eq('id', row.id);
  }

  const durationMs = Date.now() - startedAt;
  await supabase.from('sublet_renewal_scans').insert({
    trigger, buildings_scanned: summary.buildingsScanned, units_returned: summary.unitsReturned,
    sublets_found: summary.subletsFound, inserted: summary.inserted, updated: summary.updated,
    entered_window: summary.enteredWindow, errors: summary.errors, duration_ms: durationMs,
  });
  return { status: summary.errors.length ? 'partial' : 'ok', durationMs, ...summary };
}

// ---------------------------------------------------------------------------
// Team digest
// ---------------------------------------------------------------------------
export async function sendSubletDigest({ supabase = getSupabase(), getResendApiKey, getResendFromAddress, env = process.env, onlyIfNew = false } = {}) {
  if (!supabase) return { status: 'error', error: 'Supabase is not configured.' };
  const apiKey = getResendApiKey?.();
  if (!apiKey) return { status: 'skipped', reason: 'RESEND_API_KEY not configured' };

  const { data: open, error } = await supabase.from('sublet_renewals').select('*')
    .gte('days_to_expiry', DEFAULT_WINDOW.minDays).lte('days_to_expiry', DEFAULT_WINDOW.maxDays)
    .not('status', 'in', '(closed_renewed,brokerage_leased,dismissed)')
    .order('days_to_expiry', { ascending: true });
  if (error) return { status: 'error', error: error.message };
  const newly = (open || []).filter((r) => !r.digest_sent_at);
  if (onlyIfNew && newly.length === 0) return { status: 'skipped', reason: 'nothing new in the 60–90 day window' };

  const fee = renewalFee(env);
  const html = wrapCamelotEmailHtml({
    eyebrow: 'Sublet Renewals',
    preheaderText: `${open.length} sublet leases expire in 60–90 days`,
    bodyHtml: buildDigestHtml({ newlyInWindow: newly, openInWindow: open, appUrl: appUrl(env), fee }),
  });
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      from: getResendFromAddress?.() || 'Camelot OS <onboarding@resend.dev>',
      to: recipients(env),
      subject: `Sublet renewals: ${open.length} expiring in 60–90 days${newly.length ? ` (${newly.length} new)` : ''}`,
      html,
      attachments: [{ filename: `Camelot_Sublet_Renewals_${nyDateString()}.csv`, content: Buffer.from(toCsv(open)).toString('base64') }],
    }),
  });
  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) return { status: 'error', error: body?.message || `Resend ${resp.status}` };
  if (newly.length) {
    await supabase.from('sublet_renewals').update({ digest_sent_at: new Date().toISOString() }).in('id', newly.map((r) => r.id));
  }
  return { status: 'sent', id: body.id, to: recipients(env), open: open.length, newly: newly.length };
}

/**
 * Daily at ~6 AM ET: scan, then email the digest if anything newly entered
 * the window. Mondays: always send the full list. Guarded to once per NY day.
 */
export function startSubletRenewalScheduler({ getResendApiKey, getResendFromAddress, hourNy = 6 } = {}) {
  if (String(process.env.SUBLET_RENEWALS_SCHEDULER || 'on').toLowerCase() === 'off') {
    console.log('[SubletRenewals] scheduler disabled by SUBLET_RENEWALS_SCHEDULER=off');
    return;
  }
  let lastRunDay = '';
  const tick = async () => {
    const now = new Date();
    const day = nyDateString(now);
    const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false }).format(now));
    if (day === lastRunDay || hour < hourNy) return;
    lastRunDay = day;
    try {
      const scan = await runSubletRenewalScan({ trigger: 'scheduled' });
      console.log('[SubletRenewals] scan:', JSON.stringify({ ...scan, errors: scan.errors?.length }));
      const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short' }).format(now);
      const digest = await sendSubletDigest({ getResendApiKey, getResendFromAddress, onlyIfNew: weekday !== 'Mon' });
      console.log('[SubletRenewals] digest:', JSON.stringify(digest));
    } catch (err) {
      console.error('[SubletRenewals] scheduled run failed:', err.message);
    }
  };
  setInterval(() => { void tick(); }, 15 * 60 * 1000);
  setTimeout(() => { void tick(); }, 120_000);
  console.log(`[SubletRenewals] scheduler started (daily after ${hourNy}:00 ET; full digest Mondays).`);
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
function applyFilters(query, q) {
  const minDays = q.minDays !== undefined && q.minDays !== '' ? Number(q.minDays) : DEFAULT_WINDOW.minDays;
  const maxDays = q.maxDays !== undefined && q.maxDays !== '' ? Number(q.maxDays) : DEFAULT_WINDOW.maxDays;
  if (Number.isFinite(minDays)) query = query.gte('days_to_expiry', minDays);
  if (Number.isFinite(maxDays)) query = query.lte('days_to_expiry', maxDays);
  if (q.status && q.status !== 'open') query = query.eq('status', q.status);
  if (!q.status || q.status === 'open') query = query.not('status', 'in', '(closed_renewed,brokerage_leased,dismissed)');
  if (q.urgency) query = query.eq('urgency', q.urgency);
  if (q.building) query = query.eq('spire_building_rcd', Number(q.building));
  if (q.confidence) query = query.eq('detection_confidence', q.confidence);
  if (q.q) {
    const term = String(q.q).replace(/[%,()]/g, ' ').trim();
    if (term) query = query.or(`building_name.ilike.%${term}%,building_address.ilike.%${term}%,unit_number.ilike.%${term}%,subtenant_name.ilike.%${term}%,owner_name.ilike.%${term}%`);
  }
  return query.order('days_to_expiry', { ascending: true });
}

export function createSubletRenewalRouter({ getResendApiKey, getResendFromAddress, requireOpsAccess = createOpsAccessMiddleware() } = {}) {
  const router = express.Router();
  router.use('/renewals/sublets', requireOpsAccess);

  const db = (res) => {
    const s = getSupabase();
    if (!s) res.status(503).json({ error: 'Database not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).' });
    return s;
  };

  router.get('/renewals/sublets', async (req, res) => {
    const s = db(res); if (!s) return;
    const { data, error } = await applyFilters(s.from('sublet_renewals').select('*'), req.query);
    if (error) return res.status(500).json({ error: error.message });
    const { data: lastScan } = await s.from('sublet_renewal_scans').select('*').order('created_at', { ascending: false }).limit(1);
    res.json({ items: data || [], fee: renewalFee(), lastScan: lastScan?.[0] || null, statuses: WORKFLOW_STATUSES, feeStatuses: FEE_STATUSES });
  });

  router.get('/renewals/sublets/export.csv', async (req, res) => {
    const s = db(res); if (!s) return;
    const { data, error } = await applyFilters(s.from('sublet_renewals').select('*'), req.query);
    if (error) return res.status(500).json({ error: error.message });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="Camelot_Sublet_Renewals_${nyDateString()}.csv"`);
    res.send(toCsv(data || []));
  });

  router.get('/renewals/sublets/summary', async (_req, res) => {
    const s = db(res); if (!s) return;
    const { data, error } = await s.from('sublet_renewals').select('status, fee_status, fee_amount, sublease_rent, recorded_rent, urgency, days_to_expiry')
      .gte('days_to_expiry', -30);
    if (error) return res.status(500).json({ error: error.message });
    const byUrgency = {}; const byStatus = {};
    for (const r of data || []) {
      byUrgency[r.urgency] = (byUrgency[r.urgency] || 0) + 1;
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    }
    res.json({ byUrgency, byStatus, revenue: revenueSummary(data || [], { fee: renewalFee() }) });
  });

  router.patch('/renewals/sublets/:id', express.json(), async (req, res) => {
    const s = db(res); if (!s) return;
    const patch = {};
    for (const f of EDITABLE_FIELDS) if (f in (req.body || {})) patch[f] = req.body[f];
    if (patch.status && !WORKFLOW_STATUSES.includes(patch.status)) return res.status(400).json({ error: `Unknown status ${patch.status}` });
    if (patch.fee_status && !FEE_STATUSES.includes(patch.fee_status)) return res.status(400).json({ error: `Unknown fee_status ${patch.fee_status}` });
    if ('fee_amount' in patch) patch.fee_amount = Number(patch.fee_amount);
    if ('sublease_rent' in patch) patch.sublease_rent = patch.sublease_rent === '' || patch.sublease_rent === null ? null : Number(patch.sublease_rent);
    if (!Object.keys(patch).length) return res.status(400).json({ error: 'Nothing to update.' });
    patch.updated_at = new Date().toISOString();
    const { data, error } = await s.from('sublet_renewals').update(patch).eq('id', req.params.id).select('*').single();
    if (error) return res.status(500).json({ error: error.message });
    await s.from('sublet_renewal_activity').insert({ renewal_id: data.id, actor: req.opsActor || 'unknown', action: 'updated', detail: patch });
    res.json({ item: data });
  });

  router.get('/renewals/sublets/:id/activity', async (req, res) => {
    const s = db(res); if (!s) return;
    const { data, error } = await s.from('sublet_renewal_activity').select('*').eq('renewal_id', req.params.id).order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ items: data || [] });
  });

  router.post('/renewals/sublets/:id/owner-notice', express.json(), async (req, res) => {
    const s = db(res); if (!s) return;
    const { data: record, error } = await s.from('sublet_renewals').select('*').eq('id', req.params.id).single();
    if (error || !record) return res.status(404).json({ error: 'Renewal not found.' });
    const notice = buildOwnerNotice(record, { fee: record.fee_amount ?? renewalFee() });
    const to = String(req.body?.to || record.owner_email || '').trim();
    if (!req.body?.send) return res.json({ preview: true, to, ...notice });
    if (!to) return res.status(400).json({ error: 'No owner email on file — add one before sending.' });
    const apiKey = getResendApiKey?.();
    if (!apiKey) return res.status(400).json({ error: 'Email sending is not configured (RESEND_API_KEY).' });
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        from: getResendFromAddress?.(), to: [to], reply_to: 'info@camelot.nyc', subject: notice.subject, text: notice.text,
        html: wrapCamelotEmailHtml({ eyebrow: 'Lease Renewal Notice', preheaderText: notice.subject, bodyHtml: notice.html }),
      }),
    });
    const body = await resp.json().catch(() => ({}));
    if (!resp.ok) return res.status(502).json({ error: body?.message || `Resend ${resp.status}` });
    const nowIso = new Date().toISOString();
    const update = { owner_notified_at: nowIso, updated_at: nowIso };
    if (record.status === 'identified') update.status = 'owner_notified';
    await s.from('sublet_renewals').update(update).eq('id', record.id);
    await s.from('sublet_renewal_activity').insert({ renewal_id: record.id, actor: req.opsActor || 'unknown', action: 'owner_notice_sent', detail: { to, resendId: body.id, subject: notice.subject } });
    res.json({ sent: true, id: body.id, to });
  });

  router.post('/renewals/sublets/scan', async (_req, res) => {
    try { res.json(await runSubletRenewalScan({ trigger: 'manual' })); } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.post('/renewals/sublets/digest', async (_req, res) => {
    try { res.json(await sendSubletDigest({ getResendApiKey, getResendFromAddress })); } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.get('/renewals/sublets/scans', async (_req, res) => {
    const s = db(res); if (!s) return;
    const { data, error } = await s.from('sublet_renewal_scans').select('*').order('created_at', { ascending: false }).limit(30);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ items: data || [] });
  });

  // Calibration: what category/status values does Camelot's MDS actually use?
  router.get('/renewals/sublets/diagnostics', async (req, res) => {
    const spire = createSpireClient();
    if (!spire.isConfigured) return res.status(503).json({ error: 'Spire is not configured.' });
    const buildingsRes = await spire.listBuildingsRaw();
    if (!buildingsRes.ok) return res.status(502).json({ error: buildingsRes.error?.message });
    const limit = Math.min(Number(req.query.buildings) || 5, 50);
    const coop = (buildingsRes.data.items || []).filter(isCoopCondoBuilding);
    const tallies = { ContactCategories: {}, CategoryCode: {}, StatusCodes: {} };
    let unitsWithLease = 0; let units = 0;
    const rx = subletPattern(process.env);
    let matchedPattern = 0;
    for (const b of coop.slice(0, limit)) {
      const r = await spire.listUnitsFiltered({ BuildingRcds: b.BuildingRcd ?? b.ID, IncludeCurrent: true, IncludePrimaryContacts: true, IncludeSecondaryContacts: true });
      if (!r.ok) continue;
      for (const row of r.data.items || []) {
        units += 1;
        if (row.LeaseExpireDate) unitsWithLease += 1;
        for (const k of Object.keys(tallies)) {
          for (const v of String(row[k] || '').split(/[,;|]/).map((x) => x.trim()).filter(Boolean)) tallies[k][v] = (tallies[k][v] || 0) + 1;
        }
        if (rx.test(`${row.ContactCategories || ''} ${row.CategoryCode || ''} ${row.StatusCodes || ''}`)) matchedPattern += 1;
      }
    }
    const categories = await spire.listContactCategories();
    res.json({
      buildingsTotal: buildingsRes.data.items.length, coopCondoBuildings: coop.length, sampled: Math.min(limit, coop.length),
      units, unitsWithLease, matchedPattern, pattern: rx.source, tallies,
      contactCategories: categories.ok ? categories.data.items : categories.error,
    });
  });

  return router;
}

export default createSubletRenewalRouter;
