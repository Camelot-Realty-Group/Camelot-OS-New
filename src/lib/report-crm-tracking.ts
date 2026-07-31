import { pushBuildingToIntegrations, type IntegrationPushResult } from '@/lib/integrations';
import { renderCtaTemplate, selectCtaScenario } from '@/lib/cta-scenarios';
import { useBuildingsStore } from '@/lib/store';
import type { MasterReportData } from '@/lib/camelot-report';
import type { JackieReportPackage } from '@/lib/pitch-report';
import type { Building, Contact, PipelineStage } from '@/types';

export type ReportWorkflowPackage = JackieReportPackage | 'proposal_of_services' | 'quick_email_intro' | 'partner_pitch';

export type ReportWorkflowAction =
  | 'generated'
  | 'previewed'
  | 'downloaded'
  | 'printed'
  | 'email_draft_opened'
  | 'email_sent'
  | 'hubspot_push';

export interface ReportWorkflowContact {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  company?: string;
  source?: string;
}

export interface ReportWorkflowRecord {
  id: string;
  propertyId: string;
  propertyName: string;
  propertyAddress: string;
  packageType: ReportWorkflowPackage;
  packageLabel: string;
  action: ReportWorkflowAction;
  filename?: string;
  reportNumber?: string;
  generatedAt: string;
  marketingRound: 'first_round' | 'follow_up' | 'internal';
  pipelineStage: PipelineStage;
  contacts: ReportWorkflowContact[];
  emailSubject?: string;
  emailBodyPreview?: string;
  recipients?: string[];
  htmlLength?: number;
  hubspotStatus?: IntegrationPushResult['status'];
  hubspotMessage?: string;
  hubspotQueued: boolean;
  metadata?: Record<string, unknown>;
}

const REPORT_WORKFLOW_KEY = 'camelot_report_crm_activity_v1';
const HUBSPOT_REPORT_QUEUE_KEY = 'camelot_hubspot_report_activity_queue_v1';
const MAX_RECORDS = 250;

function safeParseArray<T>(raw: string | null): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function loadReportWorkflowRecords(): ReportWorkflowRecord[] {
  if (typeof window === 'undefined') return [];
  return safeParseArray<ReportWorkflowRecord>(window.localStorage.getItem(REPORT_WORKFLOW_KEY));
}

export function loadHubSpotReportQueue(): ReportWorkflowRecord[] {
  if (typeof window === 'undefined') return [];
  return safeParseArray<ReportWorkflowRecord>(window.localStorage.getItem(HUBSPOT_REPORT_QUEUE_KEY));
}

function writeReportWorkflowRecords(records: ReportWorkflowRecord[]) {
  if (typeof window === 'undefined') return records;
  const trimmed = records.slice(0, MAX_RECORDS);
  try {
    window.localStorage.setItem(REPORT_WORKFLOW_KEY, JSON.stringify(trimmed));
  } catch {
    // Keep the latest activity in memory even if browser storage is full.
  }
  return trimmed;
}

function writeHubSpotReportQueue(records: ReportWorkflowRecord[]) {
  if (typeof window === 'undefined') return records;
  const trimmed = records.slice(0, MAX_RECORDS);
  try {
    window.localStorage.setItem(HUBSPOT_REPORT_QUEUE_KEY, JSON.stringify(trimmed));
  } catch {
    // A failed CRM queue write should not block report generation.
  }
  return trimmed;
}

function normalizeEmail(email?: string) {
  return String(email || '').trim().toLowerCase();
}

function compactBody(text?: string) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 1200);
}

function uniqueContacts(contacts: ReportWorkflowContact[]) {
  const seen = new Set<string>();
  return contacts
    .filter((contact) => contact.name || contact.email || contact.phone)
    .map((contact) => ({ ...contact, email: normalizeEmail(contact.email) || undefined }))
    .filter((contact) => {
      const key = `${normalizeEmail(contact.email)}|${contact.phone || ''}|${contact.name || ''}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function decisionMakerContactsFromBuilding(building?: Partial<Building>): ReportWorkflowContact[] {
  const contacts = building?.contacts || [];
  const preferred = contacts.filter((contact) =>
    /board|owner|landlord|developer|investor|president|treasurer|secretary|asset|decision/i.test(
      `${contact.role || ''} ${contact.notes || ''}`,
    ) || contact.email || contact.phone
  );
  return preferred.map((contact) => ({
    name: contact.name,
    role: contact.role,
    email: contact.email,
    phone: contact.phone,
    company: contact.company,
    source: contact.source || 'Property card contact',
  }));
}

function decisionMakerContactsFromReport(reportData?: Partial<MasterReportData>): ReportWorkflowContact[] {
  const contacts: ReportWorkflowContact[] = [];
  const focus = reportData?.reportFocus;
  if (focus?.inquiryContact || focus?.inquiryEmail || focus?.inquiryPhone) {
    contacts.push({
      name: focus.inquiryContact || 'Inquiry contact',
      role: focus.inquiryRole || 'Inquiry contact',
      email: focus.inquiryEmail,
      phone: focus.inquiryPhone,
      company: focus.inquiryOrganization,
      source: 'Jackie report inquiry fields',
    });
  }
  (reportData?.boardMembers || []).forEach((member: any) => {
    contacts.push({
      name: member.name || 'Board contact',
      role: member.title || member.role || 'Board member',
      email: member.email,
      phone: member.phone,
      company: reportData?.buildingName || reportData?.dofOwner || undefined,
      source: 'Jackie report board/contact research',
    });
  });
  return contacts;
}

export function extractDecisionMakerContacts(
  building?: Partial<Building>,
  reportData?: Partial<MasterReportData>,
  extraContacts: ReportWorkflowContact[] = [],
) {
  return uniqueContacts([
    ...decisionMakerContactsFromBuilding(building),
    ...decisionMakerContactsFromReport(reportData),
    ...extraContacts,
  ]);
}

export function buildingFromReportData(reportData: MasterReportData, contacts: Contact[] = []): Building {
  return {
    id: `jackie-${(reportData.bbl || reportData.address).replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
    address: reportData.address,
    name: reportData.buildingName || reportData.address,
    borough: reportData.borough,
    neighborhood: reportData.neighborhoodName,
    zip_code: reportData.zipCode,
    units: reportData.units,
    type: /coop|co-op|cooperative|tenancy/i.test(reportData.propertyType)
      ? 'co-op'
      : /condo|hoa/i.test(reportData.propertyType)
        ? 'condo'
        : /mixed/i.test(reportData.propertyType)
          ? 'mixed-use'
          : /commercial|retail|office/i.test(reportData.propertyType)
            ? 'commercial'
            : 'rental',
    year_built: reportData.yearBuilt,
    lot_area: reportData.lotArea,
    building_area: reportData.buildingArea,
    stories: reportData.stories,
    building_class: reportData.buildingClass,
    grade: (['A', 'B', 'C'].includes(reportData.scoutGrade) ? reportData.scoutGrade : 'C') as Building['grade'],
    score: reportData.scoutScore,
    signals: (reportData.distressSignals || []).map((signal) => signal.description),
    contacts,
    enriched_data: { source: 'Jackie Report Center', reportFocus: reportData.reportFocus, bbl: reportData.bbl },
    current_management: reportData.managementCompany || undefined,
    source: 'Jackie Report Center',
    status: 'proposal',
    tags: ['jackie-report', `focus:${reportData.reportFocus?.selectedFocus?.join('-') || 'general'}`],
    pipeline_stage: 'proposal',
    bbl: reportData.bbl,
    violations_count: reportData.violationsTotal,
    open_violations_count: reportData.violationsOpen,
    last_violation_date: reportData.lastViolationDate || undefined,
    market_value: reportData.marketValue,
    assessed_value: reportData.assessedValue,
    land_value: reportData.landValue,
    tax_class: reportData.taxClass,
    dof_owner: reportData.dofOwner,
    energy_star_score: reportData.energyStarScore || undefined,
    site_eui: reportData.siteEUI || undefined,
    ghg_emissions: reportData.ghgEmissions || undefined,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function upsertPipelineBuilding(building: Building, stage: PipelineStage, record: ReportWorkflowRecord) {
  const now = new Date().toISOString();
  const existing = useBuildingsStore.getState().buildings.find((item) => item.id === building.id);
  const nextBuilding: Building = {
    ...building,
    status: building.status || 'proposal',
    pipeline_stage: stage,
    pipeline_moved_at: now,
    updated_at: now,
    enriched_data: {
      ...(building.enriched_data || {}),
      last_report_activity: {
        id: record.id,
        packageType: record.packageType,
        packageLabel: record.packageLabel,
        action: record.action,
        filename: record.filename,
        generatedAt: record.generatedAt,
        marketingRound: record.marketingRound,
      },
    },
    tags: Array.from(new Set([...(building.tags || []), 'report-generated', `package:${record.packageType}`])),
  };

  if (existing) {
    useBuildingsStore.getState().updateBuilding(existing.id, nextBuilding);
  } else {
    useBuildingsStore.getState().addBuildings([nextBuilding]);
  }
  return nextBuilding;
}

function queueHubSpotActivity(record: ReportWorkflowRecord) {
  const next = [record, ...loadHubSpotReportQueue().filter((item) => item.id !== record.id)];
  writeHubSpotReportQueue(next);
  return next.length;
}

function appendReportActivity(record: ReportWorkflowRecord) {
  const next = [record, ...loadReportWorkflowRecords().filter((item) => item.id !== record.id)];
  writeReportWorkflowRecords(next);
  return next;
}

export async function trackReportWorkflowEvent({
  building,
  reportData,
  packageType,
  packageLabel,
  action,
  filename,
  reportNumber,
  html,
  emailSubject,
  emailBody,
  recipients = [],
  extraContacts = [],
  metadata,
}: {
  building: Building;
  reportData?: Partial<MasterReportData>;
  packageType: ReportWorkflowPackage;
  packageLabel: string;
  action: ReportWorkflowAction;
  filename?: string;
  reportNumber?: string;
  html?: string;
  emailSubject?: string;
  emailBody?: string;
  recipients?: string[];
  extraContacts?: ReportWorkflowContact[];
  metadata?: Record<string, unknown>;
}) {
  const generatedAt = new Date().toISOString();
  const pipelineStage: PipelineStage = action === 'email_draft_opened' ? 'contacted' : 'proposal';
  const marketingRound = action === 'email_draft_opened' ? 'first_round' : 'internal';
  const contacts = extractDecisionMakerContacts(building, reportData, extraContacts);
  const propertyName = reportData?.buildingName || building.name || building.address;
  const propertyAddress = reportData?.address || building.address;
  const ctaScenario = selectCtaScenario(building, {
    action,
    packageType,
    packageLabel,
    reportFocus: reportData?.reportFocus?.selectedFocus,
    notes: `${emailSubject || ''} ${emailBody || ''}`,
  });
  const id = `${propertyAddress}-${packageType}-${action}-${generatedAt}`.replace(/[^a-z0-9]+/gi, '-').toLowerCase();

  let record: ReportWorkflowRecord = {
    id,
    propertyId: building.id,
    propertyName,
    propertyAddress,
    packageType,
    packageLabel,
    action,
    filename,
    reportNumber,
    generatedAt,
    marketingRound,
    pipelineStage,
    contacts,
    emailSubject,
    emailBodyPreview: compactBody(emailBody),
    recipients: Array.from(new Set(recipients.map(normalizeEmail).filter(Boolean))),
    htmlLength: html?.length,
    hubspotQueued: true,
    metadata: {
      ...(metadata || {}),
      // Who sent it + when, so every HubSpot activity reads like a complete
      // sales log entry: sender, report, recipients, property, date, and the
      // follow-up task that keeps the lead from going cold (David, July 31 2026).
      sentBy: 'Camelot OS — David Goldoff <merlin@camelot.nyc>',
      sentAt: generatedAt,
      reportAbout: `${packageLabel} for ${propertyName} (${propertyAddress})`,
      ctaScenarioId: ctaScenario.id,
      ctaLabel: ctaScenario.label,
      primaryCta: ctaScenario.primaryCta,
      secondaryCta: ctaScenario.secondaryCta,
      hubspotTaskTitle: ctaScenario.taskTitle,
      hubspotTaskDueAt: new Date(Date.now() + ctaScenario.taskDueDays * 86_400_000).toISOString(),
    },
  };

  const buildingForCrm = upsertPipelineBuilding(
    {
      ...building,
      name: propertyName,
      address: propertyAddress,
      contacts: uniqueContacts([
        ...contacts,
        ...(building.contacts || []).map((contact) => ({
          name: contact.name,
          role: contact.role,
          email: contact.email,
          phone: contact.phone,
          company: contact.company,
          source: contact.source,
        })),
      ]).map((contact) => ({
        name: contact.name,
        role: contact.role || 'decision_maker',
        email: contact.email,
        phone: contact.phone,
        company: contact.company,
        source: contact.source,
      })),
    },
    pipelineStage,
    record,
  );

  queueHubSpotActivity(record);

  try {
    const hubspotResult = await pushBuildingToIntegrations({
      ...buildingForCrm,
      enriched_data: {
        ...(buildingForCrm.enriched_data || {}),
        hubspot_report_activity: record,
        hubspot_bot_activity: {
          id: record.id,
          botId: 'jackie',
          botName: 'Jackie Reports',
          action: action === 'generated' ? 'report_generated' : action,
          packageType,
          packageLabel,
          ctaScenarioId: ctaScenario.id,
          ctaLabel: ctaScenario.label,
          primaryCta: ctaScenario.primaryCta,
          secondaryCta: ctaScenario.secondaryCta,
          taskTitle: ctaScenario.taskTitle,
          taskDueAt: new Date(Date.now() + ctaScenario.taskDueDays * 86_400_000).toISOString(),
          emailSubject: renderCtaTemplate(ctaScenario.emailSubject, buildingForCrm),
          emailBody: renderCtaTemplate(ctaScenario.emailBody, buildingForCrm),
          priority: ctaScenario.priority,
          createdAt: record.generatedAt,
        },
      },
    });
    record = {
      ...record,
      hubspotStatus: hubspotResult.status,
      hubspotMessage: hubspotResult.hubspot?.message || hubspotResult.scout?.message,
      hubspotQueued: hubspotResult.hubspot?.status !== 'ok',
    };
  } catch (err: any) {
    record = {
      ...record,
      hubspotStatus: 'error',
      hubspotMessage: err?.message || 'HubSpot tracking failed; record remains queued locally.',
      hubspotQueued: true,
    };
  }

  appendReportActivity(record);
  queueHubSpotActivity(record);
  return record;
}
