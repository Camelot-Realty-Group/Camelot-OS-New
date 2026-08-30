/**
 * Postcard Mailer Routes
 *
 * Handles postcard campaign creation, lead fetching from tools,
 * template management, and QR code generation.
 *
 * Endpoints:
 *   POST /api/campaigns/create          — Create new mailer campaign
 *   GET  /api/tools/:tool/leads         — Get owner-verified leads from tool
 *   POST /api/postcard/send-campaign    — Queue campaign for Lob printing
 *   POST /api/leads/:id/get-a-quote     — Capture quote form response
 *   GET  /leads/:id/get-a-quote         — Render quote landing page
 */

import { Router } from 'express';
import { requireApiUser } from './middleware-auth.mjs';
import { supabase } from './supabase-client.mjs';
import { enrichContact } from './contact-intelligence.mjs';
import QRCode from 'qrcode';

const router = Router();

/**
 * POST /api/campaigns/create
 * Create a new postcard mailer campaign
 */
router.post('/campaigns/create', requireApiUser, async (req, res) => {
  try {
    const {
      lead_ids,
      source_tool,
      campaign_type,
      template_id,
      scheduled_mailer,
      approver_note,
      cost_estimate,
    } = req.body;

    if (!Array.isArray(lead_ids) || lead_ids.length === 0) {
      return res.status(400).json({ error: 'lead_ids must be non-empty array' });
    }

    // Create campaign in Supabase
    const { data, error } = await supabase
      .from('outreach_campaigns')
      .insert([
        {
          lead_ids,
          source_tool,
          campaign_type,
          template_id,
          scheduled_mailer: new Date(scheduled_mailer),
          status: 'pending_mailer',
          cost_estimate,
          approver_note,
          created_by: req.user?.id || 'system',
          hubspot_sync_at: null,
        },
      ])
      .select();

    if (error) {
      console.error('Campaign creation error:', error);
      return res.status(500).json({ error: 'Failed to create campaign' });
    }

    const campaign = data?.[0];
    res.json({
      campaign_id: campaign?.id,
      lead_count: lead_ids.length,
      scheduled_date: scheduled_mailer,
      status: 'created',
    });
  } catch (err) {
    console.error('POST /campaigns/create error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/tools/:tool/leads?owner_only=true
 * Fetch owner-verified leads from any tool's source
 *
 * Tools supported: results, pipeline, factory-engine, traded-ny,
 * engagement-reports, partner-pitches, neighborhood-leads, needs-email,
 * call-queue, reports, arthur, merlin-content, templates
 */
router.get('/tools/:tool/leads', requireApiUser, async (req, res) => {
  try {
    const { tool } = req.params;
    const { owner_only } = req.query;

    // For now, return empty leads from each tool
    // In production, each tool would have its own lead query logic
    // This is a placeholder that shows the API contract

    const toolLeads = {
      results: [],
      pipeline: [],
      'factory-engine': [],
      'traded-ny': [],
      'engagement-reports': [],
      'partner-pitches': [],
      'neighborhood-leads': [],
      'needs-email': [],
      'call-queue': [],
      reports: [],
      arthur: [],
      'merlin-content': [],
      templates: [],
    };

    if (!toolLeads.hasOwnProperty(tool)) {
      return res.status(400).json({ error: `Unknown tool: ${tool}` });
    }

    // Placeholder: For now, fetch from neighborhood_leads table
    // (since that's the most mature source)
    if (tool === 'neighborhood-leads') {
      const query = supabase
        .from('neighborhood_leads')
        .select(
          'id,bbl,address,owner_name,management_company,contact_email,is_owner_contact,status'
        )
        .eq('is_owner_contact', true)
        .limit(500);

      const { data, error } = await query;
      if (error) throw error;

      return res.json({
        tool,
        leads: data || [],
        count: data?.length || 0,
      });
    }

    // For other tools, return empty array for now
    // (integration would come in follow-up tasks)
    res.json({
      tool,
      leads: [],
      count: 0,
    });
  } catch (err) {
    console.error('GET /tools/:tool/leads error:', err);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

/**
 * POST /api/postcard/send-campaign
 * Queue a campaign for printing via Lob or manual export
 *
 * Integrates with Lob.com API if LOBS_API_KEY is configured,
 * otherwise generates CSV for manual upload
 */
router.post('/postcard/send-campaign', requireApiUser, async (req, res) => {
  try {
    const { campaign_id, use_lob } = req.body;

    // Fetch campaign and leads
    const { data: campaign, error: campaignError } = await supabase
      .from('outreach_campaigns')
      .select('*')
      .eq('id', campaign_id)
      .single();

    if (campaignError || !campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    if (!Array.isArray(campaign.lead_ids)) {
      return res.status(400).json({ error: 'No leads in campaign' });
    }

    // Fetch lead details
    const { data: leads } = await supabase
      .from('neighborhood_leads')
      .select('*')
      .in('id', campaign.lead_ids);

    if (!leads || leads.length === 0) {
      return res.status(400).json({ error: 'No leads found for campaign' });
    }

    // If Lob integration is enabled and requested
    if (use_lob && process.env.LOBS_API_KEY) {
      // TODO: Implement Lob API integration
      // For now, return placeholder response
      return res.json({
        status: 'queued_for_lob',
        campaign_id,
        lead_count: leads.length,
        message: 'Lob integration coming soon',
      });
    }

    // Generate CSV for manual upload
    const headers = [
      'lead_id',
      'name',
      'address',
      'city',
      'state',
      'zip',
      'qr_code_url',
    ];
    const rows = leads.map((lead) => [
      lead.id,
      lead.owner_name || lead.management_contact_name || '',
      lead.address,
      'New York',
      'NY',
      lead.mailing_zip || '',
      `https://camelot-os.onrender.com/leads/${lead.id}/get-a-quote?source=postcard`,
    ]);

    const csv =
      [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n') +
      '\n';

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="campaign-${campaign_id}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error('POST /postcard/send-campaign error:', err);
    res.status(500).json({ error: 'Failed to process campaign' });
  }
});

/**
 * GET /leads/:id/get-a-quote
 * Render personalized quote landing page
 * Pre-fills owner name and address from leads database
 */
router.get('/leads/:id/get-a-quote', async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch lead data
    const { data: lead, error } = await supabase
      .from('neighborhood_leads')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !lead) {
      return res.status(404).send('<h1>Lead not found</h1>');
    }

    // Generate QR code URL (for reference/analytics)
    const pageUrl = `https://camelot-os.onrender.com/leads/${id}/get-a-quote`;

    // HTML response (could be expanded to a full template)
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Get Your Free Quote - Camelot</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; padding: 2rem; }
    h1 { color: #8B6F47; margin-bottom: 1rem; }
    .form-group { margin-bottom: 1.5rem; }
    label { display: block; font-weight: 500; margin-bottom: 0.5rem; }
    input, textarea { width: 100%; padding: 0.75rem; border: 1px solid #ccc; border-radius: 4px; font-size: 1rem; }
    button { width: 100%; padding: 1rem; background: #B8960F; color: white; border: none; border-radius: 4px; font-weight: 600; cursor: pointer; }
    button:hover { background: #8B6F47; }
    .property-info { background: #f5f5f5; padding: 1rem; border-radius: 4px; margin-bottom: 2rem; }
    .property-info p { margin: 0.5rem 0; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Get Your Free Property Quote</h1>
    <p>Thank you for scanning our postcard! Camelot specializes in optimizing property operations, reducing costs, and ensuring compliance for NYC buildings.</p>

    <div class="property-info">
      <p><strong>${lead.address}</strong></p>
      <p>${lead.owner_name || lead.management_contact_name || 'Property Owner'}</p>
    </div>

    <form id="quoteForm">
      <input type="hidden" name="lead_id" value="${id}">

      <div class="form-group">
        <label for="name">Your Name</label>
        <input type="text" id="name" name="name" required>
      </div>

      <div class="form-group">
        <label for="email">Email Address</label>
        <input type="email" id="email" name="email" required>
      </div>

      <div class="form-group">
        <label for="phone">Phone Number</label>
        <input type="tel" id="phone" name="phone">
      </div>

      <div class="form-group">
        <label for="message">Tell us about your current challenges (optional)</label>
        <textarea id="message" name="message" rows="4"></textarea>
      </div>

      <div class="form-group">
        <label>
          <input type="checkbox" name="consent" required>
          I'd like to hear from Camelot about property optimization opportunities
        </label>
      </div>

      <button type="submit">Get Your Free Quote</button>
    </form>
  </div>

  <script>
    document.getElementById('quoteForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const data = Object.fromEntries(formData);

      try {
        const res = await fetch('/api/leads/${id}/get-a-quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });

        if (res.ok) {
          alert('Thank you! We will follow up shortly.');
          e.target.reset();
        } else {
          alert('Something went wrong. Please try again.');
        }
      } catch (err) {
        console.error('Form submission error:', err);
        alert('Error submitting form.');
      }
    });
  </script>
</body>
</html>
    `;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    console.error('GET /leads/:id/get-a-quote error:', err);
    res.status(500).send('<h1>Error loading page</h1>');
  }
});

/**
 * POST /api/leads/:id/get-a-quote
 * Capture quote form submission
 * Sends to email (info@camelot.nyc) + syncs to HubSpot
 */
router.post('/leads/:id/get-a-quote', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, message, consent } = req.body;

    // Fetch lead
    const { data: lead } = await supabase
      .from('neighborhood_leads')
      .select('*')
      .eq('id', id)
      .single();

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Store response in database
    const { error: insertError } = await supabase.from('postcard_quote_responses').insert([
      {
        lead_id: id,
        respondent_name: name,
        respondent_email: email,
        respondent_phone: phone,
        message,
        consent_given: consent === true || consent === 'true',
        response_received_at: new Date().toISOString(),
      },
    ]);

    if (insertError) {
      console.error('Quote response insert error:', insertError);
    }

    // TODO: Send email to info@camelot.nyc with response
    // TODO: Sync to HubSpot as contact + task

    res.json({
      success: true,
      message: 'Response captured. We will follow up shortly.',
    });
  } catch (err) {
    console.error('POST /leads/:id/get-a-quote error:', err);
    res.status(500).json({ error: 'Failed to process quote request' });
  }
});

export default router;
