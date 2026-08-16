/**
 * Portfolio API Routes — Camelot's unified managed-building list.
 *
 * GET  /api/portfolio            — list all synced buildings (portfolio_overview)
 * POST /api/portfolio/sync       — pull live from Spire MDS into Supabase
 * GET  /api/portfolio/sync-log   — recent sync history
 * GET  /api/portfolio/:id/financials — Spire budget + GL actuals for one building
 *
 * All routes sit behind requireApiUser (see server.js) — Spire credentials are
 * server-only and must never be exposed to the browser.
 */

import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { runPortfolioSync } from './portfolio-sync.mjs';
import { createSpireClient } from './spire-client.mjs';

/* global console, process */

const router = express.Router();

let supabaseInstance = null;
function getSupabase() {
  if (!supabaseInstance) {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    // Prefer the service-role key: the sync writes to `buildings`, which is
    // RLS-protected (migration 018). An anon key will be rejected on write.
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      || process.env.SUPABASE_ANON_KEY
      || process.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Portfolio database is not configured (SUPABASE_URL / key missing).');
    }
    supabaseInstance = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return supabaseInstance;
}

function hasServiceRoleKey() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// ---------------------------------------------------------------------------
// GET /api/portfolio
// ---------------------------------------------------------------------------
router.get('/portfolio', async (req, res) => {
  try {
    const supabase = getSupabase();
    const { search = '', includeInactive = 'false' } = req.query;

    let query = supabase.from('portfolio_overview').select('*');
    if (String(includeInactive) !== 'true') query = query.eq('is_active', true);

    const { data, error } = await query.order('building_name', { ascending: true });
    if (error) {
      // View missing => migration 018 hasn't been run.
      if (/portfolio_overview/i.test(error.message)) {
        return res.status(503).json({
          error: 'Portfolio schema not deployed.',
          code: 'MIGRATION_REQUIRED',
          message: 'Run supabase/migrations/018_portfolio_sync.sql in Supabase, then reload.',
        });
      }
      throw error;
    }

    let rows = data || [];
    const term = String(search).trim().toLowerCase();
    if (term) {
      rows = rows.filter((r) =>
        [r.building_name, r.address, r.mds_code, r.city, r.zip_code, r.property_manager, r.company_name]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(term)));
    }

    const totals = rows.reduce((acc, r) => {
      acc.buildings += 1;
      acc.units += Number(r.units_total || 0);
      acc.residential += Number(r.units_residential || 0);
      acc.commercial += Number(r.units_commercial || 0);
      if (Number(r.analysis_count || 0) > 0) acc.analyzed += 1;
      acc.identifiedSavings += Number(r.total_identified_savings || 0);
      return acc;
    }, { buildings: 0, units: 0, residential: 0, commercial: 0, analyzed: 0, identifiedSavings: 0 });

    const lastSynced = rows.reduce((max, r) => {
      if (!r.spire_synced_at) return max;
      return !max || r.spire_synced_at > max ? r.spire_synced_at : max;
    }, null);

    res.json({ buildings: rows, totals, lastSynced });
  } catch (error) {
    console.error('[Portfolio] list error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/portfolio/sync
// ---------------------------------------------------------------------------
router.post('/portfolio/sync', async (req, res) => {
  try {
    if (!hasServiceRoleKey()) {
      console.warn('[Portfolio] SUPABASE_SERVICE_ROLE_KEY not set — writes to RLS-protected buildings will likely fail.');
    }

    const supabase = getSupabase();
    const triggeredBy = req.camelotUser?.email || req.camelotUser?.id || 'api';
    const enrichWithRealtyMx = req.body?.enrichWithRealtyMx !== false;

    console.log(`[Portfolio] Sync started by ${triggeredBy}`);
    const result = await runPortfolioSync({ supabase, triggeredBy, enrichWithRealtyMx });

    if (!result.ok) {
      const code = result.error?.code;
      const httpStatus = code === 'SPIRE_NOT_CONFIGURED' ? 503 : 500;
      return res.status(httpStatus).json({
        error: result.error?.message || 'Portfolio sync failed.',
        code,
        counts: result.counts,
        errors: result.errors,
      });
    }

    console.log('[Portfolio] Sync complete:', result.counts);
    res.json({
      status: result.status || 'success',
      counts: result.counts,
      warnings: result.warnings || [],
      errors: result.errors || [],
      // Buildings in Spire with no RealtyMX counterpart — the real sync gap,
      // and the list to hand to RealtyMX for manual import.
      missingFromRealtyMx: result.missingFromRealtyMx || [],
      // Spire vs RealtyMX unit-count conflicts. Unit counts drive every
      // per-unit benchmark, so a wrong one silently corrupts a cost report.
      unitDiscrepancies: result.unitDiscrepancies || [],
      syncedAt: result.syncedAt,
      serviceRoleKeyConfigured: hasServiceRoleKey(),
    });
  } catch (error) {
    console.error('[Portfolio] sync error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/portfolio/sync-log
// ---------------------------------------------------------------------------
router.get('/portfolio/sync-log', async (req, res) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('portfolio_sync_log')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(20);
    if (error) throw error;
    res.json({ runs: data || [] });
  } catch (error) {
    console.error('[Portfolio] sync-log error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/portfolio/:buildingId/financials?year=2026
// Pulls the Spire budget (and optionally GL actuals) for one building. This is
// the data the Cost-Beat report and quarterly savings verification run on.
// ---------------------------------------------------------------------------
router.get('/portfolio/:buildingId/financials', async (req, res) => {
  try {
    const { buildingId } = req.params;
    const year = Number(req.query.year) || new Date().getFullYear();
    const includeActuals = String(req.query.includeActuals || 'false') === 'true';

    const supabase = getSupabase();
    const { data: building, error: bErr } = await supabase
      .from('buildings')
      .select('id, building_name, address, mds_code, spire_building_rcd, spire_company_rcd')
      .eq('id', buildingId)
      .single();

    if (bErr || !building) return res.status(404).json({ error: 'Building not found.' });
    if (!building.spire_building_rcd) {
      return res.status(409).json({
        error: 'This building has no Spire link. Run a portfolio sync first.',
        code: 'NO_SPIRE_LINK',
      });
    }
    if (!building.spire_company_rcd) {
      return res.status(409).json({
        error: 'This building has no Spire CompanyRcd, so financials cannot be retrieved.',
        code: 'NO_COMPANY_RCD',
      });
    }

    const spire = createSpireClient();
    if (!spire.isConfigured) {
      return res.status(503).json({ error: 'Spire is not configured on the server.', code: 'SPIRE_NOT_CONFIGURED' });
    }

    const budget = await spire.getBudget({
      buildingId: building.spire_building_rcd,
      companyRcd: building.spire_company_rcd,
      year,
    });
    if (!budget.ok) return res.status(502).json({ error: budget.error.message, code: budget.error.code });

    const response = {
      building: {
        id: building.id,
        name: building.building_name,
        address: building.address,
        mdsCode: building.mds_code,
      },
      year,
      budget: budget.data.items,
      budgetTotal: budget.data.items.reduce((sum, i) => sum + (Number(i.amount) || 0), 0),
    };

    if (includeActuals) {
      const actuals = await spire.getGlActuals({
        buildingId: building.spire_building_rcd,
        companyRcd: building.spire_company_rcd,
        periodFrom: `${year}-01`,
        periodTo: `${year}-12`,
        fiscalYear: year,
      });
      if (actuals.ok) {
        response.actuals = actuals.data.items;
        response.actualsTotal = actuals.data.items.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
      } else {
        response.actualsError = actuals.error.message;
      }
    }

    res.json(response);
  } catch (error) {
    console.error('[Portfolio] financials error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
