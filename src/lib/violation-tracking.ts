/**
 * Client for the Violation & Resolution Center's internal workflow layer:
 * status/assignment/hearing-outcome tracking, a notes thread, and document/
 * photo attachments \u2014 all keyed by violation_key (see buildViolationKey)
 * and backed by src/api/violation-tracking-routes.mjs + migration 027.
 */

import { authenticatedApiFetch } from '@/lib/api-auth';

export type InternalStatus =
  | 'new' | 'assigned' | 'vendor_scheduled' | 'fix_in_progress'
  | 'certified_pending_city' | 'dismissal_filed' | 'resolved' | 'not_me';

export const INTERNAL_STATUS_LABELS: Record<InternalStatus, string> = {
  new: 'New',
  assigned: 'Assigned',
  vendor_scheduled: 'Vendor Scheduled',
  fix_in_progress: 'Fix In Progress',
  certified_pending_city: 'Certified \u2014 Pending City Confirmation',
  dismissal_filed: 'Dismissal Filed',
  resolved: 'Resolved',
  not_me: 'Not Me (hide)',
};

export type HearingOutcome = 'won' | 'settled' | 'adjourned' | 'default' | 'pending';

export interface ViolationTrackingRow {
  id?: number;
  violation_key: string;
  building_id?: number | null;
  address: string;
  borough?: string | null;
  source: string;
  violation_id: string;
  internal_status: InternalStatus;
  assigned_to?: string | null;
  assigned_to_email?: string | null;
  due_date?: string | null;
  hearing_outcome?: HearingOutcome | null;
  hearing_outcome_notes?: string | null;
  updated_at?: string;
  updated_by?: string | null;
}

export interface ViolationNote {
  id: number;
  violation_key: string;
  author: string;
  body: string;
  created_at: string;
}

export interface ViolationDocument {
  id: number;
  violation_key: string;
  filename: string;
  storage_path: string;
  content_type: string | null;
  size_bytes: number | null;
  doc_type: string;
  uploaded_by: string | null;
  created_at: string;
}

/** Builds the stable key used everywhere to identify a violation: source|violationId|normalizedAddress. */
export function buildViolationKey(source: string, violationId: string, address: string): string {
  const normalized = address.trim().toUpperCase().replace(/\s+/g, ' ');
  return `${source}|${violationId || 'UNKNOWN'}|${normalized}`;
}

async function json<T>(resp: Response): Promise<T> {
  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(body?.error || `HTTP ${resp.status}`);
  return body as T;
}

/** Fetches just the internal_status for a batch of violation keys — used to hide "Not Me" rows from the report table without a per-row round trip. */
export async function getBulkViolationStatuses(keys: string[]): Promise<Record<string, InternalStatus>> {
  if (!keys.length) return {};
  const resp = await authenticatedApiFetch(`/api/violations/tracking/bulk-status?keys=${encodeURIComponent(keys.join(','))}`);
  const body = await json<{ statuses: Record<string, InternalStatus> }>(resp);
  return body.statuses;
}

export async function getViolationTracking(key: string): Promise<{ tracking: ViolationTrackingRow; notes: ViolationNote[]; documents: ViolationDocument[] }> {
  const resp = await authenticatedApiFetch(`/api/violations/tracking?key=${encodeURIComponent(key)}`);
  return json(resp);
}

export async function updateViolationTracking(params: {
  violationKey: string; buildingId?: number | null; address: string; borough?: string; source: string; violationId: string;
  internalStatus?: InternalStatus; assignedTo?: string; assignedToEmail?: string; dueDate?: string | null;
  hearingOutcome?: HearingOutcome | null; hearingOutcomeNotes?: string; updatedBy?: string;
}): Promise<{ tracking: ViolationTrackingRow }> {
  const resp = await authenticatedApiFetch('/api/violations/tracking', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return json(resp);
}

export async function addViolationNote(violationKey: string, author: string, body: string): Promise<{ note: ViolationNote }> {
  const resp = await authenticatedApiFetch('/api/violations/notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ violationKey, author, body }),
  });
  return json(resp);
}

export async function deleteViolationNote(id: number): Promise<void> {
  await authenticatedApiFetch(`/api/violations/notes/${id}`, { method: 'DELETE' });
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1] || '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function uploadViolationDocument(params: {
  violationKey: string; file: File; docType?: string; uploadedBy?: string;
}): Promise<{ document: ViolationDocument; url: string | null }> {
  const fileBase64 = await fileToBase64(params.file);
  const resp = await authenticatedApiFetch('/api/violations/documents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      violationKey: params.violationKey,
      filename: params.file.name,
      contentType: params.file.type,
      fileBase64,
      docType: params.docType || 'other',
      uploadedBy: params.uploadedBy,
    }),
  });
  return json(resp);
}

export async function getViolationDocumentUrl(id: number): Promise<string> {
  const resp = await authenticatedApiFetch(`/api/violations/documents/${id}/url`);
  const body = await json<{ url: string }>(resp);
  return body.url;
}

export async function deleteViolationDocument(id: number): Promise<void> {
  await authenticatedApiFetch(`/api/violations/documents/${id}`, { method: 'DELETE' });
}

// ---------------------------------------------------------------------------
// Portfolio-wide monitoring & alert subscriptions
// ---------------------------------------------------------------------------

export interface AlertSubscription {
  id: number;
  email: string;
  name: string | null;
  scope: 'portfolio' | 'building';
  building_id: number | null;
  notify_new_violations: boolean;
  notify_status_changes: boolean;
  notify_hearings_days_before: number;
  is_active: boolean;
  created_at: string;
}

export interface AlertLogRow {
  id: number;
  run_at: string;
  buildings_scanned: number;
  new_violations_found: number;
  status_changes_found: number;
  hearings_flagged: number;
  emails_sent: number;
  duration_ms: number | null;
  error: string | null;
}

export async function listAlertSubscriptions(): Promise<AlertSubscription[]> {
  const resp = await authenticatedApiFetch('/api/violations/alerts/subscriptions');
  const body = await json<{ subscriptions: AlertSubscription[] }>(resp);
  return body.subscriptions;
}

export async function createAlertSubscription(params: {
  email: string; name?: string; scope: 'portfolio' | 'building'; buildingId?: number;
  notifyNewViolations?: boolean; notifyStatusChanges?: boolean; notifyHearingsDaysBefore?: number;
}): Promise<AlertSubscription> {
  const resp = await authenticatedApiFetch('/api/violations/alerts/subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const body = await json<{ subscription: AlertSubscription }>(resp);
  return body.subscription;
}

export async function deleteAlertSubscription(id: number): Promise<void> {
  await authenticatedApiFetch(`/api/violations/alerts/subscriptions/${id}`, { method: 'DELETE' });
}

export async function runViolationMonitorNow(): Promise<{ status: string; buildingsScanned?: number; newViolationsFound?: number; statusChangesFound?: number; hearingsFlagged?: number; emailsSent?: number; error?: string }> {
  const resp = await authenticatedApiFetch('/api/violations/alerts/run-now', { method: 'POST' });
  return json(resp);
}

export async function getAlertLog(): Promise<AlertLogRow[]> {
  const resp = await authenticatedApiFetch('/api/violations/alerts/log');
  const body = await json<{ log: AlertLogRow[] }>(resp);
  return body.log;
}
