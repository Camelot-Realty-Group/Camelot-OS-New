/**
 * Cost-Cutting Analysis API Routes
 *
 * POST /api/cost-analysis/run — Start analysis for a building
 * GET /api/cost-analysis/:id — Get analysis results
 * POST /api/cost-analysis/:id/accept — Accept proposal terms
 * GET /api/cost-analysis/building/:buildingId — List all analyses for a building
 */

import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/* global console, process */

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const router = express.Router();
// Lazy Supabase initialization (only when needed, not at module load)
let supabaseInstance = null;
function getSupabase() {
  if (!supabaseInstance) {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      || process.env.SUPABASE_ANON_KEY
      || process.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Cost analysis database is not configured');
    }
    supabaseInstance = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return supabaseInstance;
}

// ============================================================================
// POST /api/cost-analysis/run
// Start a cost-cutting analysis for a building
// ============================================================================

router.post('/cost-analysis/run', async (req, res) => {
  try {
    const { buildingCode, runAsync = false } = req.body;

    if (!buildingCode) {
      return res.status(400).json({ error: 'buildingCode is required' });
    }
    if (typeof buildingCode !== 'string' || !/^[a-z0-9._ -]{1,80}$/i.test(buildingCode)) {
      return res.status(400).json({ error: 'buildingCode contains unsupported characters' });
    }

    console.log(`[Cost Analysis] Starting analysis for building: ${buildingCode}`);

    const pythonScript = path.join(__dirname, '../../cost-cutting-engine.py');
    if (!fs.existsSync(pythonScript)) {
      return res.status(503).json({
        error: 'Cost analysis engine is not installed',
        code: 'COST_ENGINE_UNAVAILABLE',
      });
    }

    const pythonExecutable = process.env.PYTHON_EXECUTABLE || 'python3';

    // Option 1: Run async (background job)
    if (runAsync) {
      execFile(pythonExecutable, [pythonScript, buildingCode], { detached: true }, (err) => {
        if (err) console.error(`[Cost Analysis] Background error: ${err}`);
      });

      return res.json({
        status: 'queued',
        message: `Analysis for ${buildingCode} queued. You'll receive an email when complete.`,
        buildingCode,
      });
    }

    // Option 2: Run synchronously (wait for completion)
    const analysis = await new Promise((resolve, reject) => {
      execFile(pythonExecutable, [pythonScript, buildingCode], (err, stdout, stderr) => {
        if (err) {
          console.error(`[Cost Analysis] Error: ${stderr}`);
          reject(new Error(stderr || err.message));
        } else {
          // Parse JSON output from Python script
          try {
            const result = JSON.parse(stdout);
            resolve(result);
          } catch {
            reject(new Error('Invalid Python output: ' + stdout));
          }
        }
      });
    });

    res.json({
      status: 'completed',
      analysis,
    });

  } catch (error) {
    console.error('[Cost Analysis] Route error:', error);
    res.status(500).json({
      error: 'Analysis failed',
      message: error.message,
    });
  }
});

// ============================================================================
// GET /api/cost-analysis/:analysisId
// Retrieve analysis results and proposal
// ============================================================================

router.get('/cost-analysis/:analysisId', async (req, res) => {
  try {
    const { analysisId } = req.params;
    const supabase = getSupabase();

    // Fetch from Supabase
    const { data: analysis, error: analysisError } = await supabase
      .from('cost_savings_analysis')
      .select('*')
      .eq('id', analysisId)
      .single();

    if (analysisError || !analysis) {
      return res.status(404).json({ error: 'Analysis not found' });
    }

    // Fetch associated opportunities
    const { data: opportunities, error: oppError } = await supabase
      .from('savings_opportunities')
      .select('*')
      .eq('analysis_id', analysisId);

    if (oppError) console.error('[Cost Analysis] Opportunities fetch error:', oppError);

    // Fetch proposal
    const { data: proposal, error: propError } = await supabase
      .from('proposals')
      .select('*')
      .eq('analysis_id', analysisId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (propError && propError.code !== 'PGRST116') { // PGRST116 = no rows
      console.error('[Cost Analysis] Proposal fetch error:', propError);
    }

    res.json({
      analysis,
      opportunities: opportunities || [],
      proposal: proposal || null,
    });

  } catch (error) {
    console.error('[Cost Analysis] Route error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// POST /api/cost-analysis/:analysisId/send-proposal
// Send proposal to property manager via email (with HubSpot tracking)
// ============================================================================

router.post('/cost-analysis/:analysisId/send-proposal', async (req, res) => {
  res.status(501).json({
    error: 'Cost proposal delivery is not configured',
    code: 'PROPOSAL_DELIVERY_UNAVAILABLE',
  });
});

// ============================================================================
// POST /api/cost-analysis/:analysisId/accept
// Accept proposal and generate QuickBooks invoice
// ============================================================================

router.post('/cost-analysis/:analysisId/accept', async (req, res) => {
  res.status(501).json({
    error: 'QuickBooks acceptance and invoicing are not configured',
    code: 'QUICKBOOKS_UNAVAILABLE',
  });
});

// ============================================================================
// GET /api/cost-analysis/building/:buildingCode
// List all analyses for a building
// ============================================================================

router.get('/cost-analysis/building/:buildingCode', async (req, res) => {
  try {
    const { buildingCode } = req.params;
    const supabase = getSupabase();

    const { data: analyses, error } = await supabase
      .from('cost_savings_analysis')
      .select(`
        *,
        buildings (building_name, address)
      `)
      .eq('buildings.mds_code', buildingCode)
      .order('analysis_date', { ascending: false });

    if (error) {
      console.error('[Cost Analysis] Fetch error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({
      buildingCode,
      analysisCount: analyses?.length || 0,
      analyses: analyses || [],
    });

  } catch (error) {
    console.error('[Cost Analysis] Route error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// GET /api/cost-analysis/stats
// Dashboard stats (total opportunities, revenue potential, etc.)
// ============================================================================

router.get('/cost-analysis/stats', async (req, res) => {
  try {
    const supabase = getSupabase();
    // Total opportunities identified
    const { data: totalSavings } = await supabase
      .from('cost_savings_analysis')
      .select('identified_savings')
      .not('identified_savings', 'is', null);

    // Proposals sent and accepted
    const { data: proposals } = await supabase
      .from('proposals')
      .select('response_status')
      .not('response_status', 'is', null);

    const totalIdentifiedSavings = (totalSavings || []).reduce((sum, r) => sum + (r.identified_savings || 0), 0);
    const accepted = (proposals || []).filter(p => p.response_status === 'accepted').length;
    const potentialRevenue = totalIdentifiedSavings * 0.35; // 35% fee

    res.json({
      stats: {
        totalAnalyses: totalSavings?.length || 0,
        totalIdentifiedSavings,
        totalPotentialRevenue: potentialRevenue,
        proposalsAccepted: accepted,
        successRate: totalSavings?.length > 0 ? (accepted / totalSavings.length * 100).toFixed(1) + '%' : '0%',
      },
    });

  } catch (error) {
    console.error('[Cost Analysis] Stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
