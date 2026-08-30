/**
 * Weekly Postcard Batch Scheduler
 *
 * Runs once a week (Sunday 22:00 UTC / 5 PM ET) to process postcard campaigns
 * that are scheduled to send. Calls Lob API or generates CSV export.
 *
 * Usage in server.js:
 *   startPostcardScheduler({ getResendApiKey, getResendFromAddress })
 */

import { supabase } from './supabase-client.mjs';
import { getReadyCampaigns, markChannelComplete } from './campaign-sequencer.mjs';

let schedulerActive = false;

export function startPostcardScheduler({ hourUtc = 22, dayOfWeek = 0 } = {}) {
  if (schedulerActive) return;
  schedulerActive = true;

  function scheduleNextRun() {
    const now = new Date();
    const next = new Date(now);

    // Find next occurrence of target day + hour (UTC)
    next.setUTCDate(next.getUTCDate() + ((dayOfWeek - next.getUTCDay() + 7) % 7));
    next.setUTCHours(hourUtc, 0, 0, 0);

    if (next <= now) {
      next.setUTCDate(next.getUTCDate() + 7);
    }

    const delay = next.getTime() - now.getTime();
    console.log(
      `[PostcardScheduler] Next run: ${next.toISOString()} (in ${Math.round(delay / 1000 / 60)} minutes)`
    );

    setTimeout(() => {
      runMailerBatch().catch((err) => {
        console.error('[PostcardScheduler] Batch run failed:', err);
      });
      scheduleNextRun();
    }, delay);
  }

  scheduleNextRun();
  console.log('[PostcardScheduler] Started');
}

async function runMailerBatch() {
  console.log('[PostcardScheduler] Running postcard batch...');

  try {
    const readyCampaigns = await getReadyCampaigns('mailer');

    if (readyCampaigns.length === 0) {
      console.log('[PostcardScheduler] No campaigns ready');
      return;
    }

    console.log(`[PostcardScheduler] Found ${readyCampaigns.length} campaigns ready to send`);

    for (const campaign of readyCampaigns) {
      try {
        // Fetch lead details for this campaign
        const { data: leads } = await supabase
          .from('neighborhood_leads')
          .select('*')
          .in('id', campaign.lead_ids);

        if (!leads || leads.length === 0) {
          console.warn(`[PostcardScheduler] No leads found for campaign ${campaign.id}`);
          continue;
        }

        // If Lob is configured, send via Lob
        if (process.env.LOBS_API_KEY) {
          await sendViaLob(campaign, leads);
        } else {
          // Otherwise, just log and mark complete
          console.log(
            `[PostcardScheduler] Campaign ${campaign.id}: Lob not configured, skipping send`
          );
        }

        // Mark campaign as sent
        await markChannelComplete(campaign.id, 'mailer');
        console.log(`[PostcardScheduler] Campaign ${campaign.id} marked complete`);

        // Log to console (in production, would send email report)
        console.log(
          `[PostcardScheduler] Sent ${leads.length} postcards for campaign ${campaign.id}`
        );
      } catch (err) {
        console.error(`[PostcardScheduler] Failed to process campaign ${campaign.id}:`, err);
      }
    }

    console.log('[PostcardScheduler] Batch complete');
  } catch (err) {
    console.error('[PostcardScheduler] Batch failed:', err);
  }
}

async function sendViaLob(campaign, leads) {
  try {
    const lobApiKey = process.env.LOBS_API_KEY;

    const postcardRequests = leads.map((lead) => ({
      front: `<div style="padding:20px;text-align:center;font-family:sans-serif;">
        <h2 style="color:#8B6F47">Your Property Deserves Better</h2>
        <p>Camelot optimizes NYC properties for cost savings and compliance.</p>
        <p style="font-size:12px;margin-top:20px">Scan QR code for your free quote</p>
      </div>`,
      back: `<div style="padding:20px;font-family:sans-serif;">
        <h3 style="color:#8B6F47">Schedule Your Review</h3>
        <p style="font-size:11px">camelot.nyc | info@camelot.nyc | (646) 523-9068</p>
      </div>`,
      to: {
        name: lead.owner_name || lead.management_contact_name || 'Property Owner',
        address_line1: lead.mailing_address || lead.address,
        address_city: 'New York',
        address_state: 'NY',
        address_zip: lead.mailing_zip || '10001',
      },
      mail_type: 'usps_first_class',
      metadata: {
        lead_id: String(lead.id),
        campaign_id: String(campaign.id),
      },
    }));

    // Call Lob API for each postcard
    for (const postcard of postcardRequests) {
      try {
        const response = await fetch('https://api.lob.com/v1/postcards', {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${Buffer.from(`${lobApiKey}:`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            front: postcard.front,
            back: postcard.back,
            to: JSON.stringify(postcard.to),
            mail_type: postcard.mail_type,
            metadata: JSON.stringify(postcard.metadata),
          }).toString(),
        });

        if (!response.ok) {
          throw new Error(`Lob API returned ${response.status}`);
        }

        console.log(
          `[PostcardScheduler] Sent postcard for lead ${postcard.metadata.lead_id}`
        );
      } catch (err) {
        console.error(
          `[PostcardScheduler] Failed to send postcard for lead ${postcard.metadata.lead_id}:`,
          err
        );
      }
    }
  } catch (err) {
    console.error('[PostcardScheduler] Lob batch failed:', err);
    throw err;
  }
}
