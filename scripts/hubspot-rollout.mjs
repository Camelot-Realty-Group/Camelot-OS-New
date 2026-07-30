#!/usr/bin/env node

const HUBSPOT_BASE_URL = 'https://api.hubapi.com';

const CAMELOT_PIPELINE_LABEL = 'Camelot OS New Management Leads';
const PIPELINE_STAGES = [
  'New Building Lead',
  'Needs Research',
  'Ready to Call',
  'Contacted',
  'Decision Maker Found',
  'Meeting Requested',
  'Meeting Booked',
  'Proposal Needed',
  'Proposal Sent',
  'Negotiation',
  'Won',
  'Lost / Nurture',
];

const COMPANY_PROPERTIES = [
  ['camelot_os_building_id', 'Camelot OS Building ID', 'string'],
  ['property_address', 'Property Address', 'string'],
  ['building_type', 'Building Type', 'string'],
  ['units', 'Units', 'number'],
  ['current_management', 'Current Management', 'string'],
  ['opportunity_score', 'Opportunity Score', 'number'],
  ['opportunity_tier', 'Opportunity Tier', 'string'],
  ['distress_signals', 'Distress Signals', 'string'],
  ['open_violations', 'Open Violations', 'number'],
  ['estimated_management_fee_opportunity', 'Estimated Management Fee Opportunity', 'number'],
  ['camelot_os_report_link', 'Camelot OS Report Link', 'string'],
  ['research_confidence', 'Research Confidence', 'string'],
  ['last_camelot_os_sync', 'Last Camelot OS Sync', 'datetime'],
];

const CONTACT_PROPERTIES = [
  ['building_role', 'Building Role', 'string'],
  ['decision_maker_type', 'Decision Maker Type', 'string'],
  ['contact_confidence', 'Contact Confidence', 'string'],
  ['camelot_contact_source', 'Source', 'string'],
  ['do_not_contact_reason', 'Do Not Contact Reason', 'string'],
];

const DEAL_PROPERTIES = [
  ['property_address', 'Property Address', 'string'],
  ['building_type', 'Building Type', 'string'],
  ['units', 'Units', 'number'],
  ['primary_pain_point', 'Primary Pain Point', 'string'],
  ['next_recommended_angle', 'Next Recommended Angle', 'string'],
  ['camelot_os_report_link', 'Camelot OS Report Link', 'string'],
  ['research_confidence', 'Research Confidence', 'string'],
];

const LISTS = [
  'Intern Cleanup Queue',
  'Ready to Call',
  'Hot Property Management Leads',
  'No Verified Contact',
  'Meeting Targets',
  'Proposal Targets',
  'Nurture - Revisit Later',
];

const args = new Set(process.argv.slice(2));
const mode = process.argv.slice(2).find((arg) => !arg.startsWith('--')) || 'setup';
const dryRun = !args.has('--apply') && String(process.env.HUBSPOT_ROLLOUT_APPLY || '').toLowerCase() !== 'true';
const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN || process.env.HUBSPOT_API_KEY || '';
const pipelineId = process.env.HUBSPOT_PIPELINE_ID || 'default';

function log(message, data) {
  if (data === undefined) {
    console.log(message);
    return;
  }
  console.log(`${message}\n${JSON.stringify(data, null, 2)}`);
}

function requireToken() {
  if (token) return true;
  log('HubSpot token is not configured. Set HUBSPOT_PRIVATE_APP_TOKEN to run live checks.');
  return false;
}

async function hubspot(pathname, options = {}) {
  if (!requireToken()) return null;
  const response = await fetch(`${HUBSPOT_BASE_URL}${pathname}`, {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const error = new Error(data?.message || `HubSpot request failed: ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

function propertyPayload([name, label, type], objectType) {
  const groupName = objectType === 'contacts'
    ? 'contactinformation'
    : objectType === 'companies'
      ? 'companyinformation'
      : 'dealinformation';
  return {
    name,
    label,
    type: type === 'number' ? 'number' : type === 'datetime' ? 'datetime' : 'string',
    fieldType: type === 'number' ? 'number' : type === 'datetime' ? 'date' : 'text',
    groupName,
    description: `Camelot OS sync field: ${label}`,
    formField: false,
  };
}

async function ensureProperty(objectType, definition) {
  const payload = propertyPayload(definition, objectType);
  if (dryRun || !token) {
    log(`[dry-run] Ensure ${objectType} property ${payload.name}`, payload);
    return;
  }
  try {
    await hubspot(`/crm/v3/properties/${objectType}/${payload.name}`);
    await hubspot(`/crm/v3/properties/${objectType}/${payload.name}`, {
      method: 'PATCH',
      body: {
        label: payload.label,
        description: payload.description,
        groupName: payload.groupName,
        formField: false,
      },
    });
    log(`Updated ${objectType} property ${payload.name}`);
  } catch (error) {
    if (error.status !== 404) throw error;
    await hubspot(`/crm/v3/properties/${objectType}`, {
      method: 'POST',
      body: payload,
    });
    log(`Created ${objectType} property ${payload.name}`);
  }
}

async function setup() {
  log(`HubSpot rollout setup (${dryRun ? 'dry-run' : 'apply'})`);
  log('Recommended Camelot property-management pipeline stages', PIPELINE_STAGES);
  log('Recommended active lists to create or confirm manually', LISTS);

  if (token) {
    try {
      const pipeline = await hubspot(`/crm/v3/pipelines/deals/${pipelineId}`);
      log(`Pipeline check: found deal pipeline "${pipeline.label}" (${pipeline.id})`);
      const missingStages = PIPELINE_STAGES.filter(
        (stage) => !pipeline.stages?.some((existing) => existing.label === stage)
      );
      if (missingStages.length) {
        log('Pipeline stage labels not found. Create or map these before launch.', missingStages);
      } else {
        log('Pipeline stage labels match the rollout plan.');
      }
    } catch (error) {
      log(`Pipeline check failed for HUBSPOT_PIPELINE_ID=${pipelineId}: ${error.message}`);
    }

    // Ensure the named Camelot pipeline exists: "Camelot OS New Management
    // Leads" (per David, July 30 2026). Creates it with the full stage set
    // if no deal pipeline carries that label yet; logs its id so
    // HUBSPOT_PIPELINE_ID can be pinned in the environment.
    try {
      const all = await hubspot('/crm/v3/pipelines/deals');
      const existing = (all.results || []).find((p) => p.label === CAMELOT_PIPELINE_LABEL);
      if (existing) {
        log(`Camelot pipeline exists: "${existing.label}" (${existing.id}) — set HUBSPOT_PIPELINE_ID=${existing.id}`);
      } else if (dryRun) {
        log(`DRY RUN: would create deal pipeline "${CAMELOT_PIPELINE_LABEL}" with ${PIPELINE_STAGES.length} stages`);
      } else {
        const created = await hubspot('/crm/v3/pipelines/deals', {
          method: 'POST',
          body: {
            label: CAMELOT_PIPELINE_LABEL,
            displayOrder: 1,
            stages: PIPELINE_STAGES.map((label, index) => ({
              label,
              displayOrder: index,
              metadata: {
                isClosed: String(label === 'Won' || label === 'Lost / Nurture'),
                probability: label === 'Won' ? '1.0' : label === 'Lost / Nurture' ? '0.0' : String(Math.min(0.9, 0.05 + index * 0.08).toFixed(2)),
              },
            })),
          },
        });
        log(`Created deal pipeline "${created.label}" (${created.id}) — set HUBSPOT_PIPELINE_ID=${created.id}`);
      }
    } catch (error) {
      log(`Camelot pipeline ensure failed: ${error.message}`);
    }
  }

  for (const definition of COMPANY_PROPERTIES) await ensureProperty('companies', definition);
  for (const definition of CONTACT_PROPERTIES) await ensureProperty('contacts', definition);
  for (const definition of DEAL_PROPERTIES) await ensureProperty('deals', definition);

  log('Setup complete. Use --apply only after reviewing the dry-run output.');
}

async function searchDeals(filters, properties = []) {
  if (!token) return [];
  const data = await hubspot('/crm/v3/objects/deals/search', {
    method: 'POST',
    body: {
      filterGroups: [{ filters }],
      properties: [
        'dealname',
        'dealstage',
        'pipeline',
        'hubspot_owner_id',
        'hs_lastmodifieddate',
        'camelot_os_report_link',
        'property_address',
        'research_confidence',
        'next_recommended_angle',
        ...properties,
      ],
      sorts: [{ propertyName: 'hs_lastmodifieddate', direction: 'DESCENDING' }],
      limit: 50,
    },
  });
  return data?.results || [];
}

function summarizeDeal(deal) {
  return {
    id: deal.id,
    name: deal.properties?.dealname,
    stage: deal.properties?.dealstage,
    owner: deal.properties?.hubspot_owner_id || 'unassigned',
    address: deal.properties?.property_address,
    confidence: deal.properties?.research_confidence,
    report: deal.properties?.camelot_os_report_link ? 'yes' : 'missing',
    angle: deal.properties?.next_recommended_angle,
    modified: deal.properties?.hs_lastmodifieddate,
  };
}

async function dailyReview() {
  log(`HubSpot daily review (${dryRun ? 'dry-run' : 'apply'})`);
  log('Manager review rule: clean records contacted with a clear reason to call matter more than raw call volume.');

  if (!token) {
    log('Daily checklist without HubSpot token', {
      review: [
        'Calls made yesterday',
        'Meetings requested and booked',
        'Hot leads not touched',
        'Deals with no owner or next action',
        'Records stuck in Needs Research',
        'Proposal targets and follow-up tasks',
      ],
      command: 'Set HUBSPOT_PRIVATE_APP_TOKEN and run npm run hubspot:daily -- --apply for live review.',
    });
    return;
  }

  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const recent = await searchDeals([
    { propertyName: 'hs_lastmodifieddate', operator: 'GTE', value: since },
  ]);
  const missingReport = recent.filter((deal) => !deal.properties?.camelot_os_report_link);
  const unassigned = recent.filter((deal) => !deal.properties?.hubspot_owner_id);
  const lowConfidence = recent.filter((deal) => /low|missing|unverified/i.test(deal.properties?.research_confidence || ''));

  log('Recent Camelot opportunity snapshot', recent.slice(0, 20).map(summarizeDeal));
  log('Daily manager flags', {
    recentDealsReviewed: recent.length,
    missingReportLinks: missingReport.length,
    unassignedDeals: unassigned.length,
    lowConfidenceRecords: lowConfidence.length,
  });

  if (dryRun) {
    log('[dry-run] No HubSpot tasks were created. Review the flags above, then use --apply once task creation rules are approved.');
  } else {
    log('Live daily review completed. This script currently reports flags only; task creation remains handled by Camelot OS bot activity sync.');
  }
}

try {
  if (mode === 'setup') await setup();
  else if (mode === 'daily') await dailyReview();
  else {
    console.error(`Unknown mode "${mode}". Use "setup" or "daily".`);
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error.message);
  if (error.data) console.error(JSON.stringify(error.data, null, 2));
  process.exitCode = 1;
}
