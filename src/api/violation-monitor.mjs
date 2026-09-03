/**
 * Portfolio-wide Violation Monitor — scheduled background scan of every
 * active Camelot managed building against live NYC Open Data (HPD/DOB/ECB),
 * diffed against the last-seen snapshot to detect brand-new violations,
 * status changes, and hearings coming up soon, then emailed to whoever has
 * subscribed to alerts (see violation_alert_subscriptions).
 *
 * This is a lightweight, server-side (Node/.mjs) re-implementation of just
 * the fetch + parse logic in src/lib/nyc-violations.ts (which is TypeScript
 * and can't be imported directly by the plain-JS server) — only what's
 * needed for change detection, not the full cost/resolution-guide logic
 * used by the interactive report on the Violations page.
 *
 * GET  /api/violations/alerts/subscriptions        — list subscriptions
 * POST /api/violations/alerts/subscriptions        — create a subscription
 * DELETE /api/violations/alerts/subscriptions/:id  — remove a subscription
 * POST /api/violations/alerts/run-now              — manually trigger a scan
 * GET  /api/violations/alerts/log                  — recent scan history
 */

import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { wrapCamelotEmailHtml } from './camelot-email-branding.mjs';

/* global console, process, fetch, setInterval, setTimeout */

const router = express.Router();

let supabaseInstance = null;
function getSupabase() {
  if (!supabaseInstance) {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      || process.env.SUPABASE_ANON_KEY
      || process.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return null;
    supabaseInstance = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return supabaseInstance;
}

const NYC_BOROUGHS = new Set(['MANHATTAN', 'BROOKLYN', 'QUEENS', 'BRONX', 'STATEN ISLAND']);
// USPS mailing city -> NYC borough for the neighborhoods most common in the
// Camelot portfolio (Spire's `city` field is the mailing city, not always the
// borough — e.g. Queens buildings show as "Astoria", "Flushing", etc.).
const NEIGHBORHOOD_TO_BOROUGH = {
  ASTORIA: 'QUEENS', 'LONG ISLAND CITY': 'QUEENS', FLUSHING: 'QUEENS', 'JACKSON HEIGHTS': 'QUEENS',
  'FOREST HILLS': 'QUEENS', ELMHURST: 'QUEENS', 'REGO PARK': 'QUEENS', JAMAICA: 'QUEENS',
  'KEW GARDENS': 'QUEENS', BAYSIDE: 'QUEENS', WOODSIDE: 'QUEENS', SUNNYSIDE: 'QUEENS',
  RIDGEWOOD: 'QUEENS', MASPETH: 'QUEENS', 'RICHMOND HILL': 'QUEENS',
  RIVERDALE: 'BRONX', 'PELHAM BAY': 'BRONX', FORDHAM: 'BRONX', 'MOTT HAVEN': 'BRONX',
  CONCOURSE: 'BRONX', KINGSBRIDGE: 'BRONX', 'THROGS NECK': 'BRONX', 'MORRIS PARK': 'BRONX',
  WILLIAMSBURG: 'BROOKLYN', 'PARK SLOPE': 'BROOKLYN', DUMBO: 'BROOKLYN', 'BROOKLYN HEIGHTS': 'BROOKLYN',
  BUSHWICK: 'BROOKLYN', 'BED-STUY': 'BROOKLYN', 'BEDFORD-STUYVESANT': 'BROOKLYN', 'CROWN HEIGHTS': 'BROOKLYN',
  'FORT GREENE': 'BROOKLYN', 'CARROLL GARDENS': 'BROOKLYN', 'COBBLE HILL': 'BROOKLYN', 'BAY RIDGE': 'BROOKLYN',
  'SUNSET PARK': 'BROOKLYN', 'PROSPECT HEIGHTS': 'BROOKLYN', GREENPOINT: 'BROOKLYN',
  HARLEM: 'MANHATTAN', TRIBECA: 'MANHATTAN', SOHO: 'MANHATTAN', CHELSEA: 'MANHATTAN',
  'WASHINGTON HEIGHTS': 'MANHATTAN', INWOOD: 'MANHATTAN', 'UPPER EAST SIDE': 'MANHATTAN',
  'UPPER WEST SIDE': 'MANHATTAN', 'EAST VILLAGE': 'MANHATTAN', 'WEST VILLAGE': 'MANHATTAN',
  'GREENWICH VILLAGE': 'MANHATTAN', 'MURRAY HILL': 'MANHATTAN', 'GRAMERCY PARK': 'MANHATTAN',
  'FINANCIAL DISTRICT': 'MANHATTAN', 'LOWER EAST SIDE': 'MANHATTAN', 'MIDTOWN': 'MANHATTAN',
  'ST GEORGE': 'STATEN ISLAND', 'ST. GEORGE': 'STATEN ISLAND', 'TODT HILL': 'STATEN ISLAND',
  'GREAT KILLS': 'STATEN ISLAND', 'NEW DORP': 'STATEN ISLAND', STAPLETON: 'STATEN ISLAND', TOTTENVILLE: 'STATEN ISLAND',
};

function cityToBoroughLite(city) {
  const c = String(city || '').trim().toUpperCase();
  if (!c) return null;
  if (c === 'NEW YORK' || c === 'NEW YORK CITY' || c === 'NYC') return 'MANHATTAN';
  if (NYC_BOROUGHS.has(c)) return c;
  return NEIGHBORHOOD_TO_BOROUGH[c] || null;
}

const BORO_CODES = { MANHATTAN: '1', BRONX: '2', BROOKLYN: '3', QUEENS: '4', 'STATEN ISLAND': '5' };

function parseAddressLite(address) {
  let clean = String(address || '').toUpperCase().split(',')[0].trim();
  clean = clean.replace(/\bAVE\b/g, 'AVENUE').replace(/\bST\b/g, 'STREET')
    .replace(/\bBLVD\b/g, 'BOULEVARD').replace(/\bPL\b/g, 'PLACE').replace(/\bRD\b/g, 'ROAD').replace(/\bDR\b/g, 'DRIVE');
  clean = clean.replace(/(\d+)\s*(ST|ND|RD|TH)\b/g, '$1').replace(/\s{2,}/g, ' ').trim();
  const match = clean.match(/\b(\d+[-\d]*)\s+(.+)$/);
  const houseNum = match?.[1] || '';
  const street = (match?.[2] || clean).trim();
  return { houseNum, street };
}

function streetLikeClauseLite(field, street) {
  const tokens = street
    .replace(/\b(STREET|AVENUE|PLACE|ROAD|DRIVE|BOULEVARD|COURT|LANE|TERRACE)\b/g, '')
    .split(/\s+/).map(t => t.trim()).filter(Boolean);
  return tokens.map(t => `upper(${field}) like '%${t.replace(/'/g, "''")}%'`).join(' AND ');
}

async function fetchNYCDataLite(url, params) {
  const query = new URLSearchParams({ ...params, '$limit': '2000' });
  try {
    const resp = await fetch(`${url}?${query}`, { headers: { Accept: 'application/json' } });
    if (!resp.ok) return [];
    return await resp.json();
  } catch {
    return [];
  }
}

/** Fetches just enough (id, status, hearing date) from HPD/DOB/ECB to do change detection for one address. */
async function fetchOpenViolationsLite(address, borough) {
  const boroId = BORO_CODES[borough] || borough;
  const { houseNum, street } = parseAddressLite(address);
  const hpdWhere = streetLikeClauseLite('streetname', street);
  const dobWhere = streetLikeClauseLite('street', street);
  const ecbWhere = streetLikeClauseLite('respondent_street', street);

  const [hpd, dob, ecb] = await Promise.all([
    fetchNYCDataLite('https://data.cityofnewyork.us/resource/wvxf-dwi5.json', {
      '$where': [houseNum ? `housenumber='${houseNum.replace(/'/g, "''")}'` : '', `boroid='${boroId}'`, hpdWhere].filter(Boolean).join(' AND '),
    }),
    fetchNYCDataLite('https://data.cityofnewyork.us/resource/3h2n-5cm9.json', {
      '$where': [houseNum ? `house_number='${houseNum.replace(/'/g, "''")}'` : '', `boro='${boroId}'`, dobWhere].filter(Boolean).join(' AND '),
    }),
    fetchNYCDataLite('https://data.cityofnewyork.us/resource/6bgk-3dad.json', {
      '$where': [houseNum ? `respondent_house_number='${houseNum.replace(/'/g, "''")}'` : '', ecbWhere].filter(Boolean).join(' AND '),
    }),
  ]);

  const out = [];
  for (const v of hpd) {
    const status = (v.violationstatus || v.currentstatus || '').toUpperCase();
    const isOpen = ['OPEN', 'NOTICE SENT', 'CIV PENALTY', ''].includes(status) || !status.includes('CLOSE');
    if (!isOpen) continue;
    out.push({ source: 'HPD', violationId: v.violationid || v.novid || '', status: status || 'OPEN', hearingDate: null, description: v.novdescription || v.violationdescription || '' });
  }
  for (const v of dob) {
    const category = (v.violation_category || '').toUpperCase();
    const isOpen = category.includes('ACTIVE') || (!category.includes('DISMISS') && !category.includes('RESOLVE') && !category.includes('V*'));
    if (!isOpen) continue;
    out.push({ source: 'DOB', violationId: v.isn_dob_bis_viol || v.violation_number || '', status: 'ACTIVE', hearingDate: null, description: v.violation_type || '' });
  }
  for (const v of ecb) {
    const status = (v.ecb_violation_status || v.violation_status || v.status || '').toUpperCase();
    const isOpen = !status.includes('RESOLVE') && !status.includes('DISMISS') && !status.includes('PAID');
    if (!isOpen) continue;
    const hd = v.hearing_date && v.hearing_date.length >= 8
      ? `${v.hearing_date.slice(0, 4)}-${v.hearing_date.slice(4, 6)}-${v.hearing_date.slice(6, 8)}`
      : null;
    out.push({ source: 'ECB', violationId: v.ecb_violation_number || v.isn_dob_bis_viol || '', status: v.hearing_status || status || 'OPEN', hearingDate: hd, description: v.violation_description || '' });
  }
  return out.filter(v => v.violationId);
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

/**
 * Runs one full portfolio scan: for every active building, fetches open
 * violations, diffs against violation_watch_snapshot, and emails a digest
 * to matching alert subscriptions. Returns a summary object.
 */
export async function runViolationMonitor({ getResendApiKey, getResendFromAddress }) {
  const startedAt = Date.now();
  const supabase = getSupabase();
  if (!supabase) return { status: 'skipped', reason: 'Supabase not configured' };

  const summary = { buildingsScanned: 0, newViolationsFound: 0, statusChangesFound: 0, hearingsFlagged: 0, emailsSent: 0, error: null };
  const newByBuilding = new Map(); // building_id|address -> { address, borough, newV: [], changedV: [], hearings: [] }

  try {
    const { data: buildings, error: buildingsErr } = await supabase
      .from('buildings').select('id, address, city, building_name').eq('is_active', true);
    if (buildingsErr) throw buildingsErr;

    for (const b of (buildings || [])) {
      const borough = cityToBoroughLite(b.city);
      if (!borough || !b.address) continue; // not an NYC address we can query — skip (e.g. Westchester/CT/NJ)
      summary.buildingsScanned += 1;

      const live = await fetchOpenViolationsLite(b.address, borough);
      const { data: snapshotRows } = await supabase
        .from('violation_watch_snapshot').select('*').eq('building_id', b.id);
      const snapshotByKey = new Map((snapshotRows || []).map(r => [`${r.source}|${r.violation_id}`, r]));
      const bucket = { address: b.address, borough, buildingName: b.building_name, newV: [], changedV: [], hearings: [] };

      for (const v of live) {
        const skey = `${v.source}|${v.violationId}`;
        const existing = snapshotByKey.get(skey);
        if (!existing) {
          summary.newViolationsFound += 1;
          bucket.newV.push(v);
          await supabase.from('violation_watch_snapshot').upsert({
            building_id: b.id, address: b.address, source: v.source, violation_id: v.violationId,
            last_status: v.status, last_seen_at: new Date().toISOString(), hearing_date: v.hearingDate,
          }, { onConflict: 'address,source,violation_id' });
        } else {
          if (existing.last_status !== v.status) {
            summary.statusChangesFound += 1;
            bucket.changedV.push({ ...v, previousStatus: existing.last_status });
          }
          const patch = { last_status: v.status, last_seen_at: new Date().toISOString() };
          if (v.hearingDate) patch.hearing_date = v.hearingDate;
          await supabase.from('violation_watch_snapshot').update(patch).eq('id', existing.id);

          if (v.hearingDate) {
            const daysOut = Math.ceil((new Date(v.hearingDate).getTime() - Date.now()) / 86400000);
            const alreadyAlerted = existing.hearing_alerted_at
              && existing.hearing_date === v.hearingDate; // re-alert if hearing date itself changed
            if (daysOut >= 0 && daysOut <= 14 && !alreadyAlerted) {
              summary.hearingsFlagged += 1;
              bucket.hearings.push({ ...v, daysOut });
              await supabase.from('violation_watch_snapshot').update({ hearing_alerted_at: new Date().toISOString() }).eq('id', existing.id);
            }
          }
        }
      }

      if (bucket.newV.length || bucket.changedV.length || bucket.hearings.length) {
        newByBuilding.set(b.id, bucket);
      }
      await sleep(150); // be polite to NYC Open Data across ~40 buildings x 3 datasets
    }

    // Send digests to matching subscriptions.
    if (newByBuilding.size > 0) {
      const resendApiKey = getResendApiKey?.();
      const fromAddress = getResendFromAddress?.() || 'Camelot OS <onboarding@resend.dev>';
      const { data: subs } = await supabase
        .from('violation_alert_subscriptions').select('*').eq('is_active', true);

      for (const sub of (subs || [])) {
        const relevant = sub.scope === 'building'
          ? (newByBuilding.has(sub.building_id) ? [newByBuilding.get(sub.building_id)] : [])
          : Array.from(newByBuilding.values());
        const filtered = relevant.filter(b =>
          (sub.notify_new_violations && b.newV.length) ||
          (sub.notify_status_changes && b.changedV.length) ||
          b.hearings.length
        );
        if (!filtered.length || !resendApiKey) continue;

        const bodyHtml = filtered.map(b => {
          const lines = [];
          if (sub.notify_new_violations && b.newV.length) {
            lines.push(`<p style="margin:0 0 6px;font-weight:700;color:#dc3545;">${b.newV.length} new violation(s)</p>`
              + `<ul style="margin:0 0 14px;padding-left:18px;font-size:13px;">${b.newV.map(v => `<li>${v.source} #${v.violationId} \u2014 ${(v.description || '').slice(0, 90)}</li>`).join('')}</ul>`);
          }
          if (sub.notify_status_changes && b.changedV.length) {
            lines.push(`<p style="margin:0 0 6px;font-weight:700;color:#fd7e14;">${b.changedV.length} status change(s)</p>`
              + `<ul style="margin:0 0 14px;padding-left:18px;font-size:13px;">${b.changedV.map(v => `<li>${v.source} #${v.violationId}: ${v.previousStatus || 'unknown'} \u2192 ${v.status}</li>`).join('')}</ul>`);
          }
          if (b.hearings.length) {
            lines.push(`<p style="margin:0 0 6px;font-weight:700;color:#0d6efd;">${b.hearings.length} hearing(s) within 14 days</p>`
              + `<ul style="margin:0 0 14px;padding-left:18px;font-size:13px;">${b.hearings.map(v => `<li>${v.source} #${v.violationId} \u2014 ${v.hearingDate} (${v.daysOut} day${v.daysOut === 1 ? '' : 's'} away)</li>`).join('')}</ul>`);
          }
          return `<div style="margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid #eee;"><p style="margin:0 0 8px;font-weight:700;font-size:15px;">${b.buildingName || b.address}</p><p style="margin:0 0 10px;font-size:12px;color:#666;">${b.address}, ${b.borough}</p>${lines.join('')}</div>`;
        }).join('');

        const html = wrapCamelotEmailHtml({
          bodyHtml: `<p style="margin:0 0 16px;">Portfolio compliance scan results for ${filtered.length} building(s):</p>${bodyHtml}<p style="margin:16px 0 0;font-size:12px;color:#888;">Open the Violation &amp; Resolution Center in Camelot OS to review full details, add notes, or generate a report.</p>`,
          eyebrow: 'Portfolio Compliance Alert',
        });
        try {
          const resp = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendApiKey}` },
            body: JSON.stringify({
              from: fromAddress,
              to: [sub.email],
              subject: `Camelot OS \u2014 Compliance Alert: ${filtered.length} building(s) need attention`,
              html,
            }),
          });
          if (resp.ok) summary.emailsSent += 1;
        } catch (err) {
          console.error('[ViolationMonitor] alert email failed for', sub.email, err.message);
        }
      }
    }

    await supabase.from('violation_alert_log').insert({
      buildings_scanned: summary.buildingsScanned,
      new_violations_found: summary.newViolationsFound,
      status_changes_found: summary.statusChangesFound,
      hearings_flagged: summary.hearingsFlagged,
      emails_sent: summary.emailsSent,
      duration_ms: Date.now() - startedAt,
    });

    return { status: 'ok', ...summary };
  } catch (err) {
    console.error('[ViolationMonitor] run failed:', err);
    await supabase.from('violation_alert_log').insert({
      buildings_scanned: summary.buildingsScanned, error: err.message, duration_ms: Date.now() - startedAt,
    }).catch(() => {});
    return { status: 'error', error: err.message, ...summary };
  }
}

/** Every 6 hours, scan the whole portfolio for new/changed violations and upcoming hearings. */
export function startViolationMonitorScheduler({ getResendApiKey, getResendFromAddress }) {
  const INTERVAL_MS = 6 * 60 * 60 * 1000;
  const tick = async () => {
    try {
      const result = await runViolationMonitor({ getResendApiKey, getResendFromAddress });
      console.log('[ViolationMonitor] scan complete:', JSON.stringify(result));
    } catch (err) {
      console.error('[ViolationMonitor] scheduler tick failed:', err.message);
    }
  };
  setInterval(() => { void tick(); }, INTERVAL_MS);
  setTimeout(() => { void tick(); }, 90_000); // give the server a minute to finish booting first
  console.log('[ViolationMonitor] scheduler started (every 6 hours).');
}

// ---------------------------------------------------------------------------
// Alert subscription CRUD + manual trigger + log
// ---------------------------------------------------------------------------

router.get('/violations/alerts/subscriptions', async (_req, res) => {
  try {
    const supabase = getSupabase();
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });
    const { data, error } = await supabase.from('violation_alert_subscriptions').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ subscriptions: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/violations/alerts/subscriptions', async (req, res) => {
  try {
    const { email, name, scope, buildingId, notifyNewViolations, notifyStatusChanges, notifyHearingsDaysBefore } = req.body || {};
    if (!email) return res.status(400).json({ error: 'email is required' });
    const supabase = getSupabase();
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });
    const { data, error } = await supabase.from('violation_alert_subscriptions').insert({
      email, name: name || null,
      scope: scope === 'building' ? 'building' : 'portfolio',
      building_id: scope === 'building' ? (buildingId || null) : null,
      notify_new_violations: notifyNewViolations !== false,
      notify_status_changes: notifyStatusChanges !== false,
      notify_hearings_days_before: notifyHearingsDaysBefore ?? 7,
    }).select().single();
    if (error) throw error;
    res.json({ subscription: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/violations/alerts/subscriptions/:id', async (req, res) => {
  try {
    const supabase = getSupabase();
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });
    const { error } = await supabase.from('violation_alert_subscriptions').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/violations/alerts/run-now', async (req, res) => {
  try {
    const result = await req.app.locals.runViolationMonitorNow();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/violations/alerts/log', async (_req, res) => {
  try {
    const supabase = getSupabase();
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });
    const { data, error } = await supabase.from('violation_alert_log').select('*').order('run_at', { ascending: false }).limit(20);
    if (error) throw error;
    res.json({ log: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
