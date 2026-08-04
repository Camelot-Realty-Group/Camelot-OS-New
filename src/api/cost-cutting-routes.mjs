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
import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const router = express.Router();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

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

    console.log(`[Cost Analysis] Starting analysis for building: ${buildingCode}`);

    // Option 1: Run async (background job)
    if (runAsync) {
      // Spawn Python process in background
      const pythonScript = path.join(__dirname, '../../cost-cutting-engine.py');
      exec(`python3 ${pythonScript} ${buildingCode}`, { detached: true }, (err) => {
        if (err) console.error(`[Cost Analysis] Background error: ${err}`);
      });

      return res.json({
        status: 'queued',
        message: `Analysis for ${buildingCode} queued. You'll receive an email when complete.`,
        buildingCode,
      });
    }

    // Option 2: Run synchronously (wait for completion)
    const pythonScript = path.join(__dirname, '../../cost-cutting-engine.py');

    const analysis = await new Promise((resolve, reject) => {
      exec(`python3 ${pythonScript} ${buildingCode}`, (err, stdout, stderr) => {
        if (err) {
          console.error(`[Cost Analysis] Error: ${stderr}`);
          reject(new Error(stderr || err.message));
        } else {
          // Parse JSON output from Python script
          try {
            const result = JSON.parse(stdout);
            resolve(result);
          } catch (parseErr) {
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
  try {
    const { analysisId } = req.params;
    const { recipientEmail, recipientName = 'Property Manager' } = req.body;

    if (!recipientEmail) {
      return res.status(400).json({ error: 'recipientEmail is required' });
    }

    // Fetch analysis
    const { data: analysis, error } = await supabase
      .from('cost_savings_analysis')
      .select(`
        *,
        buildings (*)
      `)
      .eq('id', analysisId)
      .single();

    if (error || !analysis) {
      return res.status(404).json({ error: 'Analysis not found' });
    }

    // Send email (placeholder - integrate with Resend or SendGrid)
    const proposalUrl = analysis.proposal_url;
    const emailBody = `
Hi ${recipientName},

Camelot Property Management has completed a comprehensive cost analysis for ${analysis.buildings.building_name}.

We've identified potential annual savings of $${analysis.identified_savings.toLocaleString()} (${analysis.savings_percentage.toFixed(1)}% reduction).

Attached is our detailed proposal outlining:
- Specific cost-cutting opportunities
- Implementation timeline
- Fee structure (35% of first-year savings)

View the full proposal: ${proposalUrl}

Please review and let us know if you'd like to discuss next steps.

Best regards,
Camelot Property Management
    `.trim();

    // TODO: Send via Resend API
    console.log(`[Cost Analysis] Would send email to ${recipientEmail}`);

    // Log to Supabase
    const { error: updateError } = await supabase
      .from('proposals')
      .insert([{
        analysis_id: analysisId,
        sent_to: recipientEmail,
        sent_at: new Date().toISOString(),
      }]);

    if (updateError) console.error('[Cost Analysis] Proposal log error:', updateError);

    // Update analysis status
    await supabase
      .from('cost_savings_analysis')
      .update({ proposal_status: 'sent' })
      .eq('id', analysisId);

    res.json({
      status: 'sent',
      message: `Proposal sent to ${recipientEmail}`,
      analysisId,
    });

  } catch (error) {
    console.error('[Cost Analysis] Route error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// POST /api/cost-analysis/:analysisId/accept
// Accept proposal and generate QuickBooks invoice
// ============================================================================

router.post('/cost-analysis/:analysisId/accept', async (req, res) => {
  try {
    const { analysisId } = req.params;
    const { acceptedFeeType = 'one_time' } = req.body; // "one_time" or "annual_3yr"

    // Fetch analysis
    const { data: analysis, error } = await supabase
      .from('cost_savings_analysis')
      .select('*')
      .eq('id', analysisId)
      .single();

    if (error || !analysis) {
      return res.status(404).json({ error: 'Analysis not found' });
    }

    const invoiceAmount = acceptedFeeType === 'one_time'
      ? analysis.fee_one_time
      : analysis.fee_annual_3yr;

    // Create QB invoice (placeholder)
    // TODO: Integrate with QuickBooks API
    const qbInvoiceId = `QBI-${analysisId}-${Date.now()}`;

    // Log to Supabase
    const { data: invoice, error: invoiceError } = await supabase
      .from('cost_cutting_invoices')
      .insert([{
        analysis_id: analysisId,
        qb_invoice_id: qbInvoiceId,
        invoice_amount: invoiceAmount,
        invoice_date: new Date().toISOString().split('T')[0],
        payment_status: 'sent',
      }])
      .select()
      .single();

    if (invoiceError) console.error('[Cost Analysis] Invoice creation error:', invoiceError);

    // Update analysis status
    await supabase
      .from('cost_savings_analysis')
      .update({
        proposal_status: 'accepted',
      })
      .eq('id', analysisId);

    res.json({
      status: 'accepted',
      message: 'Proposal accepted',
      invoice: {
        qb_invoice_id: qbInvoiceId,
        amount: invoiceAmount,
        type: acceptedFeeType,
      },
    });

  } catch (error) {
    console.error('[Cost Analysis] Route error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// GET /api/cost-analysis/building/:buildingCode
// List all analyses for a building
// ============================================================================

router.get('/cost-analysis/building/:buildingCode', async (req, res) => {
  try {
    const { buildingCode } = req.params;

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
    // Total opportunities identified
    const { data: totalSavings, error: savingsError } = await supabase
      .from('cost_savings_analysis')
      .select('identified_savings')
      .not('identified_savings', 'is', null);

    // Proposals sent and accepted
    const { data: proposals, error: proposalError } = await supabase
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
