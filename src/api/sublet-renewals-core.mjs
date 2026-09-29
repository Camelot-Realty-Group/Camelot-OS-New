/**
 * Sublet Renewal Tracker — pure logic (no I/O), so every rule is unit-tested.
 *
 * Business model (per David, Sept 2026):
 *   - Co-op / condo owners who sublet their unit handle the renewal paperwork
 *     themselves (and any board approval the building requires).
 *   - Camelot then files the renewal into the building record in MDS/Spire and
 *     charges the OWNER a renewal filing fee (default $150 — same model
 *     FirstService uses to "re-register the rental and collect the new lease").
 *   - If the owner is NOT renewing, the unit becomes a brokerage opportunity
 *     for Camelot (find the next subtenant / list it).
 *
 * The tracker surfaces sublets whose lease expires 60–90 days out (the
 * "notice window") early enough for both outcomes.
 *
 * ⚠️ How sublets are identified in Spire — CALIBRATE ON FIRST LIVE RUN:
 * Spire has no explicit "is sublet" flag. We combine two signals:
 *   1. STRONG — a Spire contact category / category code / status code on the
 *      occupancy or one of its contacts matching SUBLET_PATTERN
 *      (e.g. "Subtenant", "Sublet", "Sublessee").
 *   2. MEDIUM — a lease expiration date recorded on a unit in a co-op/condo
 *      building. Owners/shareholders don't have leases, so a lease there almost
 *      always means a rental/sublet. Flagged "verify" for a human to confirm.
 * GET /api/renewals/sublets/diagnostics lists the real category values in
 * Camelot's MDS so the pattern can be tightened (env SUBLET_CATEGORY_PATTERN).
 */

export const DEFAULT_RENEWAL_FEE = 150;
export const DEFAULT_WINDOW = { minDays: 60, maxDays: 90 };
export const SCAN_HORIZON_DAYS = 120; // scan a bit past 90 so items are "coming up" before they enter the window

const DEFAULT_SUBLET_PATTERN = '\\bsub[\\s-]?(let|lease|lessee|lessor|tenant|tenancy)s?\\b|\\bsublt\\b|\\bsubten\\b|\\bsub-?t\\b';

export const WORKFLOW_STATUSES = [
  'identified',            // found by the scan, nobody has acted yet
  'owner_notified',        // renewal notice sent to the owner
  'renewal_received',      // owner sent the signed renewal / new sublease
  'filed',                 // Camelot recorded the renewal in MDS
  'fee_billed',            // $150 filing fee billed to the owner
  'closed_renewed',        // done — renewed, filed, fee collected
  'not_renewing',          // owner/subtenant not renewing
  'brokerage_opportunity', // Camelot Brokerage pitched to find the next subtenant
  'brokerage_listed',      // listing live
  'brokerage_leased',      // new subtenant placed
  'no_response',           // owner unresponsive after follow-ups
  'dismissed',             // false positive / not a sublet
];

export const FEE_STATUSES = ['not_billed', 'billed', 'paid', 'waived'];

export function subletPattern(env = {}) {
  const source = String(env.SUBLET_CATEGORY_PATTERN || '').trim() || DEFAULT_SUBLET_PATTERN;
  try {
    return new RegExp(source, 'i');
  } catch {
    return new RegExp(DEFAULT_SUBLET_PATTERN, 'i');
  }
}

/** Calendar date (YYYY-MM-DD) in New York for a given instant. */
export function nyDateString(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

/** Parse Spire dates ("2026-12-31T00:00:00", "12/31/2026", "") into YYYY-MM-DD or null. */
export function parseSpireDate(value) {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  let m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    if (m[1] === '0001' || m[1] === '1900') return null; // .NET "empty" dates
    return `${m[1]}-${m[2]}-${m[3]}`;
  }
  m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export function addDays(isoDate, days) {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(fromIso, toIso) {
  const a = Date.parse(`${fromIso}T12:00:00Z`);
  const b = Date.parse(`${toIso}T12:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/** Urgency bucket for a lease that expires `days` from today. */
export function urgencyBucket(days) {
  if (days === null || days === undefined || Number.isNaN(days)) return 'unknown';
  if (days < 0) return 'expired';
  if (days < 30) return 'critical';
  if (days < 60) return 'urgent';
  if (days <= 90) return 'notice_window';
  return 'upcoming';
}

export const BUCKET_LABELS = {
  expired: 'Expired — not yet renewed',
  critical: 'Under 30 days',
  urgent: '30–59 days',
  notice_window: '60–90 days (notice window)',
  upcoming: '91–120 days (coming up)',
  unknown: 'No lease date',
};

export function isCoopCondoBuilding(building = {}) {
  return Number(building.CoopCondoCompanyRcd || 0) > 0
    || Number(building.CoopCondoSubsidiaryRcd || 0) > 0
    || Boolean(String(building.CoopCondoCompanyName || building.CoopCompanyName || '').trim());
}

function joinName(first, last) {
  return [first, last].map((v) => String(v || '').trim()).filter(Boolean).join(' ');
}

function firstNonEmpty(...values) {
  for (const v of values) {
    const s = String(v ?? '').trim();
    if (s) return s;
  }
  return '';
}

function normalizeContact(c = {}) {
  return {
    contactRcd: c.ContactRcd ?? null,
    name: joinName(c.FirstName, c.LastName),
    email: firstNonEmpty(c.EmailAddress),
    phone: firstNonEmpty(c.CellPhone, c.DaytimePhone, c.EveningPhone),
    type: firstNonEmpty(c.ContactType),
    categories: firstNonEmpty(c.ContactCategoryDescriptions),
  };
}

/**
 * Classify one Spire UnitsList row (plus optional /RM/Contacts rows).
 * Returns { isSublet, confidence: 'confirmed'|'likely'|null, signals[], occupancyIsSubtenant }
 */
export function classifySublet(row = {}, { building = {}, contacts = [], env = {} } = {}) {
  const rx = subletPattern(env);
  const signals = [];
  const rowText = [row.ContactCategories, row.CategoryCode, row.StatusCodes].filter(Boolean).join(' | ');
  const occupancyIsSubtenant = rx.test(rowText);
  if (occupancyIsSubtenant) signals.push(`occupancy category: ${rowText}`);

  const subletContacts = contacts.filter((c) => rx.test(`${c.ContactCategoryDescriptions || ''} ${c.ContactType || ''}`));
  if (subletContacts.length) signals.push(`contact category: ${subletContacts.map((c) => c.ContactCategoryDescriptions || c.ContactType).join(', ')}`);

  const hasLease = Boolean(parseSpireDate(row.LeaseExpireDate));
  const coopCondo = isCoopCondoBuilding(building);
  if (coopCondo && hasLease) signals.push('lease recorded on a co-op/condo unit');

  const strong = occupancyIsSubtenant || subletContacts.length > 0;
  const medium = coopCondo && hasLease;
  return {
    isSublet: strong || medium,
    confidence: strong ? 'confirmed' : medium ? 'likely' : null,
    signals,
    occupancyIsSubtenant,
  };
}

/**
 * Split people on the unit into owner(s) vs subtenant(s).
 * - If the occupancy record itself is categorised as a sublet, the occupant is
 *   the subtenant and non-sublet contacts are the owner side.
 * - Otherwise the occupant is the owner/shareholder and sublet-categorised
 *   contacts are the subtenants.
 */
export function splitParties(row = {}, contacts = [], { env = {}, occupancyIsSubtenant = false } = {}) {
  const rx = subletPattern(env);
  const occupant = {
    name: firstNonEmpty(row.OccupantName),
    email: firstNonEmpty(row.OccupantEmail),
    phone: firstNonEmpty(row.OccupantMobilePhone, row.OccupantDayPhone, row.OccupantEveningPhone),
  };
  const normalized = contacts.map(normalizeContact);
  const isSub = (c) => rx.test(`${c.categories} ${c.type}`);
  const subContacts = normalized.filter(isSub);
  const otherContacts = normalized.filter((c) => !isSub(c) && c.name);

  if (occupancyIsSubtenant) {
    return {
      owner: otherContacts[0] || { name: '', email: '', phone: '' },
      ownerContacts: otherContacts,
      subtenants: [occupant, ...subContacts].filter((p) => p.name),
    };
  }
  return {
    owner: occupant,
    ownerContacts: [occupant, ...otherContacts.filter((c) => c.name !== occupant.name)].filter((p) => p.name),
    subtenants: subContacts,
  };
}

export function renewalKey({ buildingRcd, unitRcd, leaseExpireDate }) {
  return `${buildingRcd || 0}:${unitRcd || 0}:${leaseExpireDate || 'none'}`;
}

/** Build the canonical renewal record persisted to sublet_renewals. */
export function buildRenewalRecord(row, { building = {}, contacts = [], occupant = null, env = {}, today = nyDateString() } = {}) {
  const cls = classifySublet(row, { building, contacts, env });
  if (!cls.isSublet) return null;
  const leaseExpire = parseSpireDate(occupant?.CurrentLeaseExpireDate) || parseSpireDate(row.LeaseExpireDate);
  const leaseStart = parseSpireDate(occupant?.CurrentLeaseStartDate) || parseSpireDate(row.LeaseStartDate);
  const days = leaseExpire ? daysBetween(today, leaseExpire) : null;
  const parties = splitParties(row, contacts, { env, occupancyIsSubtenant: cls.occupancyIsSubtenant });
  const sub = parties.subtenants[0] || { name: '', email: '', phone: '' };
  const buildingRcd = row.BuildingRcd ?? building.BuildingRcd ?? null;
  const unitRcd = row.UnitRcd ?? null;
  const ownerBilling = occupant
    ? [occupant.BillingAddress1, occupant.BillingAddress2, occupant.BillingCity, occupant.BillingState, occupant.BillingZipCode]
    : [row.AlternateBillingAddress1, row.AlternateBillingAddress2, row.AlternateBillingCity, row.AlternateBillingState, row.AlternateBillingZipCode];
  const rent = Number(row.BaseRent);
  return {
    renewal_key: renewalKey({ buildingRcd, unitRcd, leaseExpireDate: leaseExpire }),
    spire_building_rcd: buildingRcd,
    spire_unit_rcd: unitRcd,
    spire_occupancy_rcd: row.OccupancyRcd ?? row.CurrentOccupancyRcd ?? null,
    building_number: firstNonEmpty(row.BuildingNumber, building.BuildingNumber),
    building_name: firstNonEmpty(building.CoopCondoCompanyName, building.CoopCompanyName, building.RentalBuildingName),
    building_address: firstNonEmpty(row.BuildingAddress, building.Address1, building.Address),
    building_type: isCoopCondoBuilding(building) ? 'coop_condo' : 'rental',
    unit_number: firstNonEmpty(row.UnitNumber),
    bedrooms: Number.isFinite(Number(row.Bedrooms)) ? Number(row.Bedrooms) : null,
    bathrooms: Number.isFinite(Number(row.Bathrooms)) ? Number(row.Bathrooms) : null,
    square_feet: Number(row.SquareFeet) > 0 ? Number(row.SquareFeet) : null,
    owner_name: parties.owner.name || null,
    owner_email: parties.owner.email || null,
    owner_phone: parties.owner.phone || null,
    owner_mailing_address: ownerBilling.map((v) => String(v || '').trim()).filter(Boolean).join(', ') || null,
    subtenant_name: sub.name || null,
    subtenant_email: sub.email || null,
    subtenant_phone: sub.phone || null,
    additional_subtenants: parties.subtenants.slice(1),
    lease_start_date: leaseStart,
    lease_end_date: leaseExpire,
    move_in_date: parseSpireDate(row.MoveInDate),
    days_to_expiry: days,
    urgency: urgencyBucket(days),
    recorded_rent: Number.isFinite(rent) && rent > 0 ? rent : null,
    monthly_charges: Number(row.MonthlyCharges) > 0 ? Number(row.MonthlyCharges) : null,
    security_deposit: Number(row.SecurityDeposit) > 0 ? Number(row.SecurityDeposit) : null,
    balance_due: Number.isFinite(Number(row.Balance)) ? Number(row.Balance) : null,
    in_legal: Boolean(Number(row.InLegal || 0)),
    detection_confidence: cls.confidence,
    detection_signals: cls.signals,
    property_manager: firstNonEmpty(building.PropertyManagerName) || null,
    property_manager_email: firstNonEmpty(building.PropertyManagerEmail) || null,
  };
}

export function inWindow(record, { minDays = DEFAULT_WINDOW.minDays, maxDays = DEFAULT_WINDOW.maxDays } = {}) {
  return record.days_to_expiry !== null && record.days_to_expiry >= minDays && record.days_to_expiry <= maxDays;
}

/** Revenue view: filing fees + brokerage upside (1 month's rent is the NYC norm). */
export function revenueSummary(records = [], { fee = DEFAULT_RENEWAL_FEE } = {}) {
  let feesPotential = 0; let feesBilled = 0; let feesPaid = 0; let brokerageUpside = 0;
  for (const r of records) {
    if (r.status === 'dismissed') continue;
    const amount = Number(r.fee_amount ?? fee) || 0;
    const brokeragePath = ['not_renewing', 'brokerage_opportunity', 'brokerage_listed', 'brokerage_leased'].includes(r.status);
    if (!brokeragePath && r.fee_status !== 'waived') feesPotential += amount;
    if (r.fee_status === 'billed') feesBilled += amount;
    if (r.fee_status === 'paid') { feesBilled += amount; feesPaid += amount; }
    const rent = Number(r.sublease_rent ?? r.recorded_rent) || 0;
    if (brokeragePath && rent > 0) brokerageUpside += rent;
  }
  return { feesPotential, feesBilled, feesPaid, brokerageUpside, count: records.length };
}

// ---------------------------------------------------------------------------
// Export / email templates
// ---------------------------------------------------------------------------

export const CSV_COLUMNS = [
  ['building_name', 'Building'], ['building_address', 'Address'], ['building_number', 'MDS Bldg #'],
  ['unit_number', 'Apt'], ['subtenant_name', 'Subtenant'], ['subtenant_email', 'Subtenant Email'],
  ['subtenant_phone', 'Subtenant Phone'], ['owner_name', 'Owner'], ['owner_email', 'Owner Email'],
  ['owner_phone', 'Owner Phone'], ['owner_mailing_address', 'Owner Mailing Address'],
  ['sublease_rent', 'Sublease Rent'], ['recorded_rent', 'MDS Base Rent'], ['lease_start_date', 'Lease Start'],
  ['lease_end_date', 'Lease End'], ['days_to_expiry', 'Days Left'], ['urgency', 'Urgency'],
  ['status', 'Status'], ['fee_amount', 'Renewal Fee'], ['fee_status', 'Fee Status'],
  ['assigned_to', 'Assigned To'], ['detection_confidence', 'Detection'], ['property_manager', 'Property Manager'],
];

function csvCell(v) {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(records = []) {
  const lines = [CSV_COLUMNS.map(([, h]) => h).join(',')];
  for (const r of records) lines.push(CSV_COLUMNS.map(([k]) => csvCell(r[k])).join(','));
  return lines.join('\n');
}

export function escapeHtml(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function money(n) {
  return n === null || n === undefined || n === '' ? '—' : `$${Math.round(Number(n)).toLocaleString('en-US')}`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${m}/${d}/${y}`;
}

/** Team digest body (wrapped in the Camelot letterhead by the caller). */
export function buildDigestHtml({ newlyInWindow = [], openInWindow = [], appUrl = '', fee = DEFAULT_RENEWAL_FEE }) {
  const rows = (list) => list.map((r) => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;">${escapeHtml(r.building_name || r.building_address)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;">${escapeHtml(r.unit_number)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;">${escapeHtml(r.subtenant_name || 'verify in MDS')}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;">${escapeHtml(r.owner_name || '—')}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;">${money(r.sublease_rent ?? r.recorded_rent)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;">${fmtDate(r.lease_start_date)} – ${fmtDate(r.lease_end_date)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">${r.days_to_expiry ?? '—'}</td>
    </tr>`).join('');
  const table = (list) => `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:12px;">
      <tr style="background:#1a1a2e;color:#fff;">
        <th align="left" style="padding:6px 8px;">Building</th><th align="left" style="padding:6px 8px;">Apt</th>
        <th align="left" style="padding:6px 8px;">Subtenant</th><th align="left" style="padding:6px 8px;">Owner</th>
        <th align="left" style="padding:6px 8px;">Rent</th><th align="left" style="padding:6px 8px;">Lease</th>
        <th align="right" style="padding:6px 8px;">Days</th>
      </tr>${rows(list)}
    </table>`;
  const potential = openInWindow.length * fee;
  return `
    <p style="font-size:15px;color:#1a1a2e;margin:0 0 12px;">
      <strong>${openInWindow.length}</strong> sublet lease${openInWindow.length === 1 ? '' : 's'} across Camelot-managed co-ops and condos
      expire in the next 60–90 days${newlyInWindow.length ? ` — <strong>${newlyInWindow.length} new</strong> since the last digest` : ''}.
      That's up to <strong>${money(potential)}</strong> in renewal filing fees, plus a brokerage opportunity on any owner who isn't renewing.
    </p>
    ${newlyInWindow.length ? `<h3 style="font-family:Georgia,serif;color:#c5a253;margin:18px 0 6px;">Newly entered the 60–90 day window</h3>${table(newlyInWindow)}` : ''}
    <h3 style="font-family:Georgia,serif;color:#c5a253;margin:18px 0 6px;">All open sublet renewals (60–90 days)</h3>
    ${openInWindow.length ? table(openInWindow) : '<p style="font-size:13px;color:#555;">None right now.</p>'}
    <p style="font-size:13px;color:#555;margin-top:16px;">
      Next step for each: send the owner the renewal notice, collect the renewed sublease and the ${money(fee)} filing fee,
      then record it in MDS. If the owner isn't renewing, flag it for Camelot Brokerage.
      ${appUrl ? `<br/><a href="${escapeHtml(appUrl)}/sublet-renewals" style="color:#c5a253;">Open the Sublet Renewals tracker</a> (full list attached as CSV).` : ''}
    </p>
    <p style="font-size:11px;color:#888;">Rows marked "verify in MDS" were detected from a lease date on a co-op/condo unit and need a quick check that they are sublets.</p>`;
}

/** Owner-facing renewal notice (draft — a human approves before it is sent). */
export function buildOwnerNotice(record, { fee = DEFAULT_RENEWAL_FEE, senderName = 'Camelot Property Management', replyTo = 'info@camelot.nyc', phone = '(212) 206-9939' } = {}) {
  const building = record.building_name || record.building_address || 'your building';
  const firstName = String(record.owner_name || '').split(/\s+/)[0] || 'Owner';
  const amount = money(record.fee_amount ?? fee);
  const subject = `Sublet lease renewal — Apt ${record.unit_number}, ${building} (expires ${fmtDate(record.lease_end_date)})`;
  const text = [
    `Dear ${firstName},`,
    '',
    `Our records show that the sublease for Apartment ${record.unit_number} at ${building}${record.building_address && record.building_name ? ` (${record.building_address})` : ''}${record.subtenant_name ? `, currently occupied by ${record.subtenant_name},` : ''} expires on ${fmtDate(record.lease_end_date)}.`,
    '',
    'If you plan to renew:',
    '  1. Prepare the renewal or extension with your subtenant, following your building\'s sublet policy (including any board approval it requires).',
    `  2. Send us a copy of the fully signed renewal so we can file it in the building records, along with the ${amount} renewal filing fee, which will be charged to your account.`,
    '',
    'If you are not renewing, please let us know as soon as possible. Camelot\'s brokerage team can help you find and qualify a new subtenant, market the apartment, or explore a sale.',
    '',
    `Please reply to this email or call us at ${phone} with any questions.`,
    '',
    'Warm regards,',
    senderName,
    replyTo,
  ].join('\n');
  const html = text.split('\n').map((l) => (l ? `<p style="margin:0 0 8px;font-size:14px;line-height:1.5;color:#222;">${escapeHtml(l)}</p>` : '')).join('');
  return { subject, text, html };
}
