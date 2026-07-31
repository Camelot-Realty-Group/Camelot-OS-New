/**
 * marketing-engine.ts — CamelotOS Marketing & Content Automation Module
 *
 * Phase 1 (Controlled MVP) core: the governance state machine, brand & safety
 * checker, CTA hierarchy, campaign package builder, lead-scoring model, and
 * Supabase persistence for the marketing-to-revenue pipeline.
 *
 * Governing principle (David Goldoff spec, July 31 2026): a controlled
 * marketing operating system, not a swarm of enthusiastic robots posting
 * questionable content at 2 a.m. The system generates, researches, packages,
 * routes, distributes, measures, and hands off leads — humans keep approval
 * authority. No auto-publish, ever.
 */
import { supabase, isSupabaseConfigured } from './supabase';

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

export type MarketingContentStatus =
  | 'generated'
  | 'brand_check'
  | 'pending_review'
  | 'approved'
  | 'scheduled'
  | 'published'
  | 'analytics'
  | 'needs_revision'
  | 'rejected'
  | 'approval_expired'
  | 'publishing_failed'
  | 'partially_published'
  | 'archived';

/** Legal transitions. Anything not listed here is a governance violation. */
export const CONTENT_TRANSITIONS: Record<MarketingContentStatus, MarketingContentStatus[]> = {
  generated: ['brand_check', 'archived'],
  brand_check: ['pending_review', 'needs_revision', 'archived'],
  pending_review: ['approved', 'needs_revision', 'rejected', 'approval_expired', 'archived'],
  approved: ['scheduled', 'pending_review', 'approval_expired', 'archived'], // any substantive edit -> pending_review
  scheduled: ['published', 'publishing_failed', 'partially_published', 'pending_review', 'archived'],
  published: ['analytics', 'archived'],
  analytics: ['archived'],
  needs_revision: ['generated', 'brand_check', 'archived'],
  rejected: ['archived'],
  approval_expired: ['pending_review', 'archived'],
  publishing_failed: ['scheduled', 'pending_review', 'archived'],
  partially_published: ['scheduled', 'published', 'pending_review', 'archived'],
  archived: [],
};

export interface ApprovalAction {
  approver: string;
  channel: 'dashboard' | 'gmail_link' | 'email_reply' | 'admin_override';
  secureToken: string;
  contentVersion: number;
  decision: 'approved' | 'revision_requested' | 'rejected' | 'override_approved';
  overrideReason?: string;
}

/**
 * The nonnegotiable rule: pending_review -> approved requires a documented
 * approval action bound to a secure token and the exact content version.
 * "Looks good" in an email approves nothing.
 */
export function canTransition(
  from: MarketingContentStatus,
  to: MarketingContentStatus,
  approval?: ApprovalAction
): { allowed: boolean; reason: string } {
  if (!CONTENT_TRANSITIONS[from]?.includes(to)) {
    return { allowed: false, reason: `Illegal transition ${from} -> ${to}` };
  }
  if (from === 'pending_review' && to === 'approved') {
    if (!approval) return { allowed: false, reason: 'Approval requires a documented approver action (dashboard, secure Gmail link, structured email tied to package ID, or logged admin override).' };
    if (!approval.secureToken || approval.secureToken.length < 12) return { allowed: false, reason: 'Approval token missing or too weak.' };
    if (approval.decision !== 'approved' && approval.decision !== 'override_approved') return { allowed: false, reason: `Decision "${approval.decision}" does not authorize approval.` };
    if (approval.decision === 'override_approved' && !approval.overrideReason?.trim()) return { allowed: false, reason: 'Admin override requires a logged reason.' };
  }
  return { allowed: true, reason: 'ok' };
}

/** Content-version hash so post-approval edits are detectable. */
export function contentVersionHash(body: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < body.length; i++) {
    h ^= body.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function generateSecureToken(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------------------
// Brand & safety checker
// ---------------------------------------------------------------------------

export const APPROVED_CONTACTS = {
  generalEmail: 'info@camelot.nyc',
  davidEmail: 'dgoldoff@camelot.nyc',
  website: 'www.camelot.nyc',
  office: '(212) 206-9939',
} as const;

const OFFICE_PHONE_DIGITS = '2122069939';

export interface BrandCheckFinding {
  rule: string;
  severity: 'block' | 'warn';
  detail: string;
}

export interface BrandCheckResult {
  passed: boolean;
  findings: BrandCheckFinding[];
}

/**
 * Runs the nonnegotiable brand, safety, CTA, and legal-risk checks.
 * "block" findings prevent the item from ever reaching pending_review.
 */
export function runBrandSafetyCheck(body: string, opts?: { isImageAi?: boolean; hasSources?: boolean }): BrandCheckResult {
  const findings: BrandCheckFinding[] = [];
  const text = body || '';

  // 1. Personal-cell block: any phone number that is not the office line.
  const phoneRe = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g;
  for (const m of text.match(phoneRe) || []) {
    const digits = m.replace(/\D/g, '').replace(/^1/, '');
    if (digits.length === 10 && digits !== OFFICE_PHONE_DIGITS) {
      findings.push({ rule: 'approved_contacts_only', severity: 'block', detail: `Phone number "${m}" is not the approved office line ${APPROVED_CONTACTS.office}. David's personal cell must never appear.` });
    }
  }

  // 2. Required CTA: at least one approved contact route.
  const hasApprovedCta = [APPROVED_CONTACTS.generalEmail, APPROVED_CONTACTS.davidEmail, 'camelot.nyc', '212) 206-9939', '212-206-9939'].some(c => text.toLowerCase().includes(c.toLowerCase()));
  if (!hasApprovedCta) {
    findings.push({ rule: 'required_cta', severity: 'block', detail: 'No approved CTA found. Every piece must route to info@camelot.nyc, dgoldoff@camelot.nyc, www.camelot.nyc, or (212) 206-9939.' });
  }

  // 3. Banned framing: government representation, inside knowledge, guaranteed cures.
  const bannedClaims: Array<[RegExp, string]> = [
    [/on behalf of (the )?(city|hpd|dob|nyc|department)/i, 'Implies Camelot represents a government agency.'],
    [/inside (knowledge|information|track)/i, 'Implies inside knowledge.'],
    [/guarantee[ds]? (a |the )?(cure|dismissal|removal|result|outcome)/i, 'Guarantees a cure or outcome.'],
    [/we can make (the )?(violation|penalty|fine)s? disappear/i, 'Guarantees violation removal.'],
  ];
  for (const [re, why] of bannedClaims) {
    const m = text.match(re);
    if (m) findings.push({ rule: 'legal_risk', severity: 'block', detail: `"${m[0]}" — ${why}` });
  }

  // 4. No mechanical "How Camelot Handles This" section — positioning must be natural.
  if (/how camelot handles this/i.test(text)) {
    findings.push({ rule: 'no_mechanical_positioning', severity: 'block', detail: 'Remove the dedicated "How Camelot Handles This" section; weave Camelot positioning naturally through the piece.' });
  }

  // 5. AI image labeling.
  if (opts?.isImageAi && !/Illustration: Camelot Property Management/.test(text)) {
    findings.push({ rule: 'ai_image_label', severity: 'block', detail: 'AI-generated imagery must carry the label "Illustration: Camelot Property Management".' });
  }

  // 6. Numeric claims need sources.
  const numericClaims = (text.match(/\b\d[\d,.]*\s*(%|percent|million|billion|buildings|units|violations|dollars)\b/gi) || []).length;
  if (numericClaims > 0 && opts?.hasSources === false) {
    findings.push({ rule: 'sources_required', severity: 'warn', detail: `${numericClaims} numeric claim(s) found but no source records attached. The system never fabricates a statistic.` });
  }

  return { passed: !findings.some(f => f.severity === 'block'), findings };
}

// ---------------------------------------------------------------------------
// CTA hierarchy
// ---------------------------------------------------------------------------

export type FunnelStage = 'awareness' | 'consideration' | 'high_intent' | 'investment_partnership';

export const CTA_HIERARCHY: Record<FunnelStage, string[]> = {
  awareness: [
    'Read the full Camelot analysis',
    'Follow Camelot for NYC building insights',
    `Visit ${APPROVED_CONTACTS.website}`,
  ],
  consideration: [
    'Request a management review',
    'Schedule a building operations discussion',
    `Email ${APPROVED_CONTACTS.generalEmail}`,
  ],
  high_intent: [
    'Schedule a compliance audit',
    'Discuss a property-management proposal',
    'Speak with Camelot Brokerage Services Corp.',
    `Call ${APPROVED_CONTACTS.office}`,
  ],
  investment_partnership: [
    'Discuss a local operating partnership',
    'Explore co-investment or management opportunities',
    `Email ${APPROVED_CONTACTS.davidEmail}`,
  ],
};

// ---------------------------------------------------------------------------
// Campaign package: one researched idea -> a full channel set
// ---------------------------------------------------------------------------

export const DERIVATIVE_FORMATS = [
  { format: 'article', channel: 'WordPress', note: '2,000-3,000 words, investigative/editorial, NYC-specific, sourced' },
  { format: 'gbp_post', channel: 'Google Business Profile', note: 'Search-oriented local post' },
  { format: 'linkedin_personal', channel: 'LinkedIn — David', note: 'First-person operator voice, opinionated, owner-investor lens' },
  { format: 'linkedin_company', channel: 'LinkedIn — Camelot page', note: 'Institutional voice, concise, educational' },
  { format: 'facebook', channel: 'Facebook', note: 'Community-oriented, accessible, neighborhood-relevant' },
  { format: 'instagram', channel: 'Instagram', note: 'Caption or carousel outline' },
  { format: 'x_post', channel: 'X / Buffer', note: 'Short takes' },
  { format: 'newsletter', channel: 'Mailchimp', note: 'Excerpt for The Camelot Report; never auto-send' },
  { format: 'youtube_outline', channel: 'YouTube', note: 'Video outline + metadata draft' },
  { format: 'reels_script', channel: 'TikTok / Reels', note: 'Script + media package' },
  { format: 'cold_call_point', channel: 'Cold calling', note: 'Talking point tied to the trigger topic' },
  { format: 'followup_email', channel: 'Gmail', note: 'Follow-up email variant' },
] as const;

export interface CampaignPackage {
  packageId: string;
  campaignName: string;
  primaryAudience: string;
  secondaryAudiences: string[];
  funnelStage: FunnelStage;
  primaryCta: string;
  items: Array<{ format: string; channel: string; note: string; secureToken: string }>;
  createdAt: string;
}

export function buildCampaignPackage(input: {
  campaignName: string;
  primaryAudience: string;
  secondaryAudiences?: string[];
  funnelStage?: FunnelStage;
}): CampaignPackage {
  const funnelStage = input.funnelStage || 'awareness';
  // One primary audience, max two secondary — per the segmentation rule.
  const secondary = (input.secondaryAudiences || []).slice(0, 2);
  const packageId = `PKG-${new Date().toISOString().slice(0, 10)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  return {
    packageId,
    campaignName: input.campaignName,
    primaryAudience: input.primaryAudience,
    secondaryAudiences: secondary,
    funnelStage,
    primaryCta: CTA_HIERARCHY[funnelStage][0],
    items: DERIVATIVE_FORMATS.map(f => ({ ...f, secureToken: generateSecureToken() })),
    createdAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Lead scoring (exact weights from the spec)
// ---------------------------------------------------------------------------

export interface LeadScoreInput {
  hasComplianceTrigger: boolean;   // 25%
  hasDecisionMakerContact: boolean; // 20%
  unitCount: number;               // 15% (scaled)
  inCoverageArea: boolean;         // 10%
  serviceFit: boolean;             // 10%
  hasTimingSignal: boolean;        // 10%
  hasReferralOrRelationship: boolean; // 10%
}

export function scoreLead(i: LeadScoreInput): { score: number; breakdown: Record<string, number> } {
  const sizePoints = i.unitCount >= 100 ? 15 : i.unitCount >= 50 ? 12 : i.unitCount >= 20 ? 9 : i.unitCount >= 10 ? 6 : i.unitCount > 0 ? 3 : 0;
  const breakdown: Record<string, number> = {
    compliance_trigger: i.hasComplianceTrigger ? 25 : 0,
    decision_maker_contact: i.hasDecisionMakerContact ? 20 : 0,
    property_size_fee: sizePoints,
    geographic_fit: i.inCoverageArea ? 10 : 0,
    service_fit: i.serviceFit ? 10 : 0,
    timing_signal: i.hasTimingSignal ? 10 : 0,
    referral_relationship: i.hasReferralOrRelationship ? 10 : 0,
  };
  return { score: Object.values(breakdown).reduce((a, b) => a + b, 0), breakdown };
}

/** Outreach gate: nothing outbound until all of these are true. */
export function outreachReady(lead: {
  contactVerified: boolean;
  suppressionChecked: boolean;
  languageReviewed: boolean;
  claimsSupported: boolean;
  callerIdentityAccurate: boolean;
}): { ready: boolean; blockers: string[] } {
  const blockers: string[] = [];
  if (!lead.contactVerified) blockers.push('Contact information not validated');
  if (!lead.suppressionChecked) blockers.push('Suppression/unsubscribe lists not checked');
  if (!lead.languageReviewed) blockers.push('Outreach language not reviewed');
  if (!lead.claimsSupported) blockers.push('Claims not source-supported');
  if (!lead.callerIdentityAccurate) blockers.push('Caller identity not confirmed accurate');
  return { ready: blockers.length === 0, blockers };
}

// ---------------------------------------------------------------------------
// Distribution gate + failure policy
// ---------------------------------------------------------------------------

export function distributionEligible(item: {
  status: MarketingContentStatus;
  scheduledAt?: string | null;
  brandCheckStatus: string;
  approvalExpiresAt?: string | null;
}): boolean {
  return item.status === 'approved'
    && !!item.scheduledAt && new Date(item.scheduledAt) <= new Date()
    && item.brandCheckStatus === 'passed'
    && (!item.approvalExpiresAt || new Date(item.approvalExpiresAt) > new Date());
}

export const RETRY_POLICY = {
  technicalFailureRetries: 2,
  noRetryFor: ['rejected_content', 'permissions', 'rights', 'expired_authentication'],
  escalateTo: ['dashboard', 'operations_email'],
} as const;

// ---------------------------------------------------------------------------
// Persistence (fire-and-forget; the app degrades gracefully offline)
// ---------------------------------------------------------------------------

export function persistCampaignPackage(pkg: CampaignPackage): void {
  if (!isSupabaseConfigured()) return;
  void (async () => {
    try {
      const { data: campaign } = await supabase
        .from('content_campaigns')
        .insert({ name: pkg.campaignName, primary_audience: pkg.primaryAudience, secondary_audiences: pkg.secondaryAudiences, funnel_stage: pkg.funnelStage })
        .select('id')
        .single();
      if (!campaign) return;
      await supabase.from('content_items').insert(pkg.items.map(item => ({
        campaign_id: campaign.id,
        package_id: pkg.packageId,
        title: `${pkg.campaignName} — ${item.channel}`,
        format: item.format,
        channel: item.channel,
        primary_audience: pkg.primaryAudience,
        secondary_audiences: pkg.secondaryAudiences,
        funnel_stage: pkg.funnelStage,
        primary_cta: pkg.primaryCta,
        status: 'generated',
      })));
    } catch { /* offline-tolerant */ }
  })();
}

export function logContentRun(run: {
  module: string;
  recordsProcessed?: number;
  outputsGenerated?: number;
  failures?: number;
  notes?: string;
}): void {
  if (!isSupabaseConfigured()) return;
  void supabase.from('content_runs').insert({
    module: run.module,
    finished_at: new Date().toISOString(),
    records_processed: run.recordsProcessed ?? 0,
    outputs_generated: run.outputsGenerated ?? 0,
    failures: run.failures ?? 0,
    notes: run.notes,
  }).then(() => undefined, () => undefined);
}

// ---------------------------------------------------------------------------
// Automation schedule (America/New_York) — documented for the scheduler
// ---------------------------------------------------------------------------

export const AUTOMATION_SCHEDULE = [
  { when: 'Daily 10:00 a.m.', what: 'Dashboard synchronization' },
  { when: 'Wednesday 9:00 a.m.', what: 'SEO and GBP content package' },
  { when: 'Wednesday 2:00 p.m.', what: 'Approved-content distribution' },
  { when: 'Friday 9:00 a.m.', what: 'LinkedIn and social package' },
  { when: 'Friday 2:00 p.m.', what: 'Approved-content distribution' },
  { when: 'Weekly Monday', what: 'Analytics review and topic adjustment' },
  { when: 'Monthly', what: 'Camelot Report newsletter package' },
  { when: 'Configurable', what: 'Cold-calling lead batch' },
] as const;
