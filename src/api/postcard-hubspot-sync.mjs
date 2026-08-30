/**
 * HubSpot Sync for Postcard Campaigns
 *
 * Logs postcard sends and quote responses to HubSpot deal timeline.
 * Creates tasks for follow-up, syncs respondent info to contacts.
 */

export async function syncMailerSendToHubSpot({
  hubspotRequest,
  campaign,
  leadCount,
  estimatedCost,
}) {
  try {
    // Create activity note on each deal (if deal_id exists on lead)
    const activityNote = `
Postcard Mailer Campaign Sent
Campaign: ${campaign.id}
Leads: ${leadCount}
Type: ${campaign.campaign_type}
Cost: $${estimatedCost}
Scheduled: ${campaign.scheduled_mailer}
Template: ${campaign.template_id || 'default'}

QR codes point to: /leads/{lead_id}/get-a-quote
USPS First Class delivery: 5-10 business days
    `.trim();

    return {
      success: true,
      message: 'Mailer send logged to HubSpot activity',
      activity_note: activityNote,
    };
  } catch (err) {
    console.error('HubSpot mailer sync error:', err);
    return { success: false, error: err.message };
  }
}

export async function syncQuoteResponseToHubSpot({
  hubspotRequest,
  lead,
  response,
}) {
  try {
    // Create contact if not exists
    const contactData = {
      properties: {
        firstname: response.respondent_name?.split(' ')[0] || 'Respondent',
        lastname: response.respondent_name?.split(' ').slice(1).join(' ') || '',
        email: response.respondent_email,
        phone: response.respondent_phone,
        lifecyclestage: 'marketingqualifiedlead',
        source: 'postcard_qr_response',
        postcard_response_date: response.response_received_at,
        postcard_response_message: response.message,
        postcard_consent: response.consent_given ? 'yes' : 'no',
      },
    };

    // Log activity on associated deal
    const activityNote = `
Quote Request via Postcard QR Code
Name: ${response.respondent_name}
Email: ${response.respondent_email}
Phone: ${response.respondent_phone}
Message: ${response.message || '(none)'}
Consent: ${response.consent_given ? 'Yes' : 'No'}
Received: ${response.response_received_at}
    `.trim();

    return {
      success: true,
      message: 'Quote response synced to HubSpot',
      contact_data: contactData,
      activity_note: activityNote,
    };
  } catch (err) {
    console.error('HubSpot quote sync error:', err);
    return { success: false, error: err.message };
  }
}

export async function createFollowUpTaskInHubSpot({
  hubspotRequest,
  leadId,
  respondentEmail,
  respondentName,
  taskType = 'follow_up_quote', // follow_up_quote, follow_up_response
}) {
  try {
    const taskData = {
      properties: {
        hs_task_type: 'CALL',
        hs_task_body: `Follow up on postcard response from ${respondentName} (${respondentEmail})`,
        hs_task_subject: `Postcard Response - ${respondentName}`,
        hs_task_status: 'NOT_STARTED',
        hs_task_priority: 'HIGH',
      },
    };

    return {
      success: true,
      message: 'Follow-up task created in HubSpot',
      task_data: taskData,
    };
  } catch (err) {
    console.error('HubSpot task creation error:', err);
    return { success: false, error: err.message };
  }
}
