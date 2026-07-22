import type { Building, Contact } from '@/types';

export type LeadTier = 'hot' | 'warm' | 'cold' | 'review';

export interface LeadQualityResult {
  score: number;
  tier: LeadTier;
  missingFields: string[];
  strengths: string[];
  warnings: string[];
}

export interface LeadRoutingResult {
  team: string;
  region: string;
  priority: 'same-day' | '24-48 hours' | 'nurture';
  tags: string[];
}

export interface IntegrationStatus {
  scout: {
    configured: boolean;
    apiUrlSet: boolean;
    workspaceSet: boolean;
    localQueueSize?: number;
  };
  hubspot: {
    configured: boolean;
    dealsEnabled: boolean;
    tasksEnabled?: boolean;
    associationEndpoint: string;
  };
  timestamp: string;
}

export interface IntegrationPushResult {
  status: 'ok' | 'partial' | 'skipped' | 'error';
  quality: LeadQualityResult;
  routing: LeadRoutingResult;
  scout: ServicePushResult;
  hubspot: ServicePushResult;
}

export interface ServicePushResult {
  status: 'ok' | 'skipped' | 'error';
  message: string;
  id?: string;
  url?: string;
  warnings?: string[];
  // Populated by the HubSpot push specifically, so callers can associate a
  // follow-up action (like an email send) with the exact record type
  // rather than guessing what the collapsed `id` field above refers to.
  contactId?: string;
  companyId?: string;
  dealId?: string;
}

const LOCAL_INTEGRATION_QUEUE_KEY = 'camelot:scout-integration-local-queue';

function isStaticRenderClient() {
  if (typeof window === 'undefined') return false;
  return String(import.meta.env.VITE_DISABLE_SERVER_INTEGRATIONS || '').toLowerCase() === 'true';
}

function getLocalQueue(): unknown[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_INTEGRATION_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function queueLocalIntegrationLead(payload: unknown) {
  if (typeof window === 'undefined') return 0;
  const queue = getLocalQueue();
  const next = [...queue, { queuedAt: new Date().toISOString(), payload }];
  try {
    window.localStorage.setItem(LOCAL_INTEGRATION_QUEUE_KEY, JSON.stringify(next.slice(-250)));
  } catch {
    return queue.length;
  }
  return next.length;
}

function clientOnlyIntegrationStatus(): IntegrationStatus {
  return {
    scout: {
      configured: false,
      apiUrlSet: false,
      workspaceSet: false,
      localQueueSize: getLocalQueue().length,
    },
    hubspot: {
      configured: false,
      dealsEnabled: false,
      tasksEnabled: false,
      associationEndpoint: 'client-only mode',
    },
    timestamp: new Date().toISOString(),
  };
}

export function parseContactName(fullName?: string) {
  const parts = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return {
    firstname: parts[0] || '',
    lastname: parts.length > 1 ? parts.slice(1).join(' ') : '',
  };
}

export function normalizePhone(phone?: string) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return digits;
}

export function getPrimaryContact(building: Building): Contact | undefined {
  return (
    building.contacts.find((contact) => contact.email) ||
    building.contacts.find((contact) => contact.phone) ||
    building.contacts[0]
  );
}

export function auditLeadQuality(building: Building): LeadQualityResult {
  const missingFields: string[] = [];
  const strengths: string[] = [];
  const warnings: string[] = [];
  let score = 0;

  if (building.address) score += 15;
  else missingFields.push('property address');

  if (building.units && building.units > 0) {
    score += building.units >= 30 ? 15 : 8;
    strengths.push(`${building.units} units identified`);
  } else {
    missingFields.push('unit count');
  }

  if (building.type) score += 8;
  else missingFields.push('asset class');

  if (building.borough || building.region || building.neighborhood || building.zip_code) {
    score += 8;
    strengths.push('geography available for routing');
  } else {
    missingFields.push('borough / region / zip');
  }

  const primaryContact = getPrimaryContact(building);
  if (primaryContact?.email) {
    score += 18;
    strengths.push('email contact available');
  } else {
    missingFields.push('verified email contact');
  }

  if (primaryContact?.phone || building.contacts.some((contact) => contact.phone)) {
    score += 10;
    strengths.push('phone contact available');
  } else {
    missingFields.push('phone contact');
  }

  if (building.current_management && !/unknown|verify/i.test(building.current_management)) {
    score += 8;
    strengths.push('current management identified');
  } else {
    warnings.push('current management should be verified before a board-facing push');
  }

  if ((building.market_value || 0) > 0 || (building.assessed_value || 0) > 0) {
    score += 6;
    strengths.push('valuation or assessment signal available');
  } else {
    warnings.push('market value is missing or zero');
  }

  if ((building.open_violations_count || 0) > 0 || (building.violations_count || 0) > 0) {
    score += 6;
    strengths.push('compliance pain point available');
  }

  if (building.signals?.length) {
    score += Math.min(6, building.signals.length * 2);
    strengths.push('Scout signal history present');
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  const tier: LeadTier =
    missingFields.includes('property address') || missingFields.includes('unit count')
      ? 'review'
      : score >= 76
        ? 'hot'
        : score >= 55
          ? 'warm'
          : 'cold';

  return { score, tier, missingFields, strengths, warnings };
}

export function routeLead(building: Building, quality = auditLeadQuality(building)): LeadRoutingResult {
  const region = building.borough || building.region || building.neighborhood || building.zip_code || 'Unassigned';
  const units = building.units || 0;
  const tags = new Set<string>([
    `tier:${quality.tier}`,
    `region:${region}`,
    `asset:${building.type || 'unknown'}`,
  ]);

  if (units >= 100) tags.add('large-building');
  if ((building.open_violations_count || 0) > 0) tags.add('compliance-pain');
  if (/self/i.test(building.current_management || '')) tags.add('self-managed-review');
  if ((building.market_value || 0) <= 0) tags.add('valuation-needed');

  const team =
    quality.tier === 'hot'
      ? 'David / Jackie priority desk'
      : quality.tier === 'warm'
        ? 'Scout outreach team'
        : quality.tier === 'review'
          ? 'Data quality review'
          : 'Nurture queue';

  const priority =
    quality.tier === 'hot' ? 'same-day' : quality.tier === 'warm' ? '24-48 hours' : 'nurture';

  return { team, region, priority, tags: [...tags] };
}

export function buildIntegrationLeadPayload(building: Building) {
  const contact = getPrimaryContact(building);
  const quality = auditLeadQuality(building);
  const routing = routeLead(building, quality);
  const nameParts = parseContactName(contact?.name);

  return {
    building: {
      id: building.id,
      name: building.name || building.address,
      address: building.address,
      borough: building.borough,
      region: building.region,
      neighborhood: building.neighborhood,
      zip_code: building.zip_code,
      units: building.units,
      type: building.type,
      score: building.score,
      grade: building.grade,
      current_management: building.current_management,
      market_value: building.market_value,
      assessed_value: building.assessed_value,
      violations_count: building.violations_count,
      open_violations_count: building.open_violations_count,
      signals: building.signals || [],
      tags: building.tags || [],
      report_activity: building.enriched_data?.hubspot_report_activity,
      bot_activity: building.enriched_data?.hubspot_bot_activity,
      last_report_activity: building.enriched_data?.last_report_activity,
    },
    contact: contact
      ? {
          name: contact.name,
          firstname: nameParts.firstname,
          lastname: nameParts.lastname,
          email: contact.email,
          phone: normalizePhone(contact.phone),
          role: contact.role,
          company: contact.company,
        }
      : undefined,
    quality,
    routing,
  };
}

export async function getIntegrationStatus(): Promise<IntegrationStatus> {
  try {
    const response = await fetch('/api/integrations/status');
    if (!response.ok) {
      if (response.status === 404 || response.status === 405) return clientOnlyIntegrationStatus();
      throw new Error(`Integration status failed: ${response.status}`);
    }
    return response.json();
  } catch (err) {
    if (err instanceof TypeError) return clientOnlyIntegrationStatus();
    throw err;
  }
}

export async function pushBuildingToIntegrations(building: Building): Promise<IntegrationPushResult> {
  const payload = buildIntegrationLeadPayload(building);

  if (isStaticRenderClient()) {
    const localQueueSize = queueLocalIntegrationLead(payload);
    return {
      status: 'partial',
      quality: payload.quality,
      routing: payload.routing,
      scout: {
        status: 'skipped',
        message: `Scout API is not available on this static Render site. Lead saved to local queue (${localQueueSize}).`,
      },
      hubspot: {
        status: 'skipped',
        message: 'HubSpot server endpoint is not available on this static Render site. Export CSV or deploy API server to sync.',
      },
    };
  }

  try {
    const response = await fetch('/api/integrations/push-building', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok && !data?.quality) {
      if (response.status === 404 || response.status === 405) {
        const localQueueSize = queueLocalIntegrationLead(payload);
        return {
          status: 'partial',
          quality: payload.quality,
          routing: payload.routing,
          scout: {
            status: 'skipped',
            message: `Scout API is not available on the static Render site. Lead saved to local queue (${localQueueSize}).`,
          },
          hubspot: {
            status: 'skipped',
            message: 'HubSpot server endpoint is not available on the static Render site. Export CSV or deploy API server to sync.',
          },
        };
      }
      throw new Error(data?.error || `Integration push failed: ${response.status}`);
    }
    return data;
  } catch (err) {
    if (err instanceof TypeError) {
      const localQueueSize = queueLocalIntegrationLead(payload);
      return {
        status: 'partial',
        quality: payload.quality,
        routing: payload.routing,
        scout: {
          status: 'skipped',
          message: `Network/API unavailable. Lead saved to local queue (${localQueueSize}).`,
        },
        hubspot: {
          status: 'skipped',
          message: 'HubSpot sync unavailable from this static client session.',
        },
      };
    }
    throw err;
  }
}
