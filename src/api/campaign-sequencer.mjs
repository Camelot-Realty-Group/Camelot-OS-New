/**
 * Campaign Sequencer — orchestrates multi-channel outreach campaigns
 *
 * Enforces campaign playbook: email → call → mailer with timing gates.
 * Prevents channels from firing out of order or too close together.
 *
 * Playbook types:
 *   postcard_only    — send mailer immediately
 *   email_first      — send email first, then mailer 1 week later
 *   call_first       — send call first, then mailer only if no response
 *
 * Database: outreach_campaigns table tracks scheduled_email, scheduled_call,
 * scheduled_mailer dates + current status.
 */

import { supabase } from './supabase-client.mjs';

/**
 * Check if a campaign can proceed with a given channel.
 * Returns { canProceed, reason, nextRetry }
 */
export async function canProceedWithChannel(campaignId, channel) {
  const { data: campaign, error } = await supabase
    .from('outreach_campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();

  if (error || !campaign) {
    return { canProceed: false, reason: 'Campaign not found' };
  }

  const now = new Date();

  if (channel === 'email') {
    // Email can fire anytime if scheduled
    if (!campaign.scheduled_email) {
      return { canProceed: false, reason: 'Email not scheduled' };
    }
    if (new Date(campaign.scheduled_email) > now) {
      return {
        canProceed: false,
        reason: 'Email not yet due',
        nextRetry: campaign.scheduled_email,
      };
    }
    return { canProceed: true };
  }

  if (channel === 'call') {
    // Call can only fire if email_first playbook AND email already sent
    if (campaign.campaign_type !== 'email_first' && campaign.campaign_type !== 'call_first') {
      return { canProceed: false, reason: `Playbook ${campaign.campaign_type} does not include calls` };
    }

    if (campaign.campaign_type === 'email_first') {
      // Email must have been sent first
      if (!campaign.scheduled_email) {
        return { canProceed: false, reason: 'Email not scheduled' };
      }
      const emailTime = new Date(campaign.scheduled_email);
      if (emailTime > now) {
        return {
          canProceed: false,
          reason: 'Email not yet due',
          nextRetry: campaign.scheduled_email,
        };
      }
      // Wait at least 2 days after email before calling
      const minCallTime = new Date(emailTime.getTime() + 2 * 24 * 60 * 60 * 1000);
      if (minCallTime > now) {
        return {
          canProceed: false,
          reason: 'Wait 2 days after email before calling',
          nextRetry: minCallTime.toISOString(),
        };
      }
    }

    if (!campaign.scheduled_call) {
      return { canProceed: false, reason: 'Call not scheduled' };
    }
    if (new Date(campaign.scheduled_call) > now) {
      return {
        canProceed: false,
        reason: 'Call not yet due',
        nextRetry: campaign.scheduled_call,
      };
    }
    return { canProceed: true };
  }

  if (channel === 'mailer') {
    // Mailer depends on playbook
    if (campaign.campaign_type === 'postcard_only') {
      // Can fire immediately
      if (!campaign.scheduled_mailer) {
        return { canProceed: false, reason: 'Mailer not scheduled' };
      }
      if (new Date(campaign.scheduled_mailer) > now) {
        return {
          canProceed: false,
          reason: 'Mailer not yet due',
          nextRetry: campaign.scheduled_mailer,
        };
      }
      return { canProceed: true };
    }

    if (campaign.campaign_type === 'email_first') {
      // Email must have been sent first
      if (!campaign.scheduled_email) {
        return { canProceed: false, reason: 'Email not scheduled' };
      }
      const emailTime = new Date(campaign.scheduled_email);
      if (emailTime > now) {
        return { canProceed: false, reason: 'Email not yet sent', nextRetry: emailTime };
      }
      // Wait 1 week after email before mailer
      const minMailerTime = new Date(emailTime.getTime() + 7 * 24 * 60 * 60 * 1000);
      if (minMailerTime > now) {
        return {
          canProceed: false,
          reason: 'Wait 1 week after email before mailer',
          nextRetry: minMailerTime.toISOString(),
        };
      }
    }

    if (campaign.campaign_type === 'call_first') {
      // Call must have been attempted first
      if (!campaign.scheduled_call) {
        return { canProceed: false, reason: 'Call not scheduled' };
      }
      const callTime = new Date(campaign.scheduled_call);
      if (callTime > now) {
        return { canProceed: false, reason: 'Call not yet due', nextRetry: callTime };
      }
      // Wait 3 days after call before mailer (gives time to gauge response)
      const minMailerTime = new Date(callTime.getTime() + 3 * 24 * 60 * 60 * 1000);
      if (minMailerTime > now) {
        return {
          canProceed: false,
          reason: 'Wait 3 days after call before mailer',
          nextRetry: minMailerTime.toISOString(),
        };
      }
    }

    if (!campaign.scheduled_mailer) {
      return { canProceed: false, reason: 'Mailer not scheduled' };
    }
    if (new Date(campaign.scheduled_mailer) > now) {
      return {
        canProceed: false,
        reason: 'Mailer not yet due',
        nextRetry: campaign.scheduled_mailer,
      };
    }
    return { canProceed: true };
  }

  return { canProceed: false, reason: `Unknown channel: ${channel}` };
}

/**
 * Get all campaigns ready to proceed with a given channel
 */
export async function getReadyCampaigns(channel) {
  const { data: campaigns, error } = await supabase
    .from('outreach_campaigns')
    .select('*')
    .eq('status', 'pending_mailer') // Only pending campaigns
    .not('scheduled_mailer', 'is', null);

  if (error) {
    console.error('Failed to fetch campaigns:', error);
    return [];
  }

  const ready = [];
  for (const campaign of campaigns || []) {
    const check = await canProceedWithChannel(campaign.id, channel);
    if (check.canProceed) {
      ready.push(campaign);
    }
  }
  return ready;
}

/**
 * Mark a campaign channel as completed
 */
export async function markChannelComplete(campaignId, channel) {
  const updateData = {};
  if (channel === 'email') updateData.scheduled_email = new Date().toISOString();
  if (channel === 'call') updateData.scheduled_call = new Date().toISOString();
  if (channel === 'mailer') {
    updateData.status = 'completed';
    updateData.scheduled_mailer = new Date().toISOString();
  }

  const { error } = await supabase
    .from('outreach_campaigns')
    .update(updateData)
    .eq('id', campaignId);

  if (error) {
    console.error(`Failed to mark ${channel} complete for campaign ${campaignId}:`, error);
    throw error;
  }
}

/**
 * Get campaign details with human-readable playbook description
 */
export async function getCampaignWithPlaybook(campaignId) {
  const { data: campaign, error } = await supabase
    .from('outreach_campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();

  if (error || !campaign) return null;

  const playbookDescriptions = {
    postcard_only: 'Send postcard immediately',
    email_first: 'Send email first, then postcard 1 week later',
    call_first: 'Call first, then postcard 3 days later if no response',
  };

  return {
    ...campaign,
    playbook_description: playbookDescriptions[campaign.campaign_type] || 'Unknown',
  };
}
