/**
 * NYC Violation Search — Client-side API for NYC Open Data
 * Pulls HPD, DOB, ECB violations for any address
 */

const BORO_CODES: Record<string, string> = {
  'MANHATTAN': '1', 'MN': '1', 'NEW YORK': '1',
  'BRONX': '2', 'BX': '2',
  'BROOKLYN': '3', 'BK': '3', 'KINGS': '3',
  'QUEENS': '4', 'QN': '4',
  'STATEN ISLAND': '5', 'SI': '5',
};

const NAMED_AVENUE_MAP: Record<string, string> = {
  FIRST: '1',
  SECOND: '2',
  THIRD: '3',
  FOURTH: '4',
  FIFTH: '5',
  SIXTH: '6',
  SEVENTH: '7',
  EIGHTH: '8',
  NINTH: '9',
  TENTH: '10',
  ELEVENTH: '11',
  TWELFTH: '12',
};

const HPD_CLASS_SEVERITY: Record<string, { level: number; label: string; cureDays: number }> = {
  'C': { level: 3, label: 'IMMEDIATELY HAZARDOUS', cureDays: 1 },
  'B': { level: 2, label: 'HAZARDOUS', cureDays: 30 },
  'A': { level: 1, label: 'NON-HAZARDOUS', cureDays: 90 },
};

const PLAYER_MAP: Record<string, string[]> = {
  'LEAD': ['PM', 'Certified Lead Inspector', 'Lead Remediation Contractor', 'Expeditor'],
  'GAS': ['PM', 'Licensed Master Plumber', 'Expeditor'],
  'HEAT': ['PM', 'HVAC Contractor', 'Boiler Technician'],
  'FIRE': ['PM', 'Fire Safety Director', 'Contractor', 'FDNY'],
  'MOLD': ['PM', 'Remediation Contractor'],
  'PEST': ['PM', 'Pest Control'],
  'PLUMB': ['PM', 'Plumber'],
  'ELECT': ['PM', 'Electrician'],
  'DEFAULT_C': ['PM', 'Contractor', 'Expeditor'],
  'DEFAULT_B': ['PM', 'Contractor'],
  'DEFAULT_A': ['PM', 'Superintendent'],
  'DOB': ['Architect', 'Engineer', 'Expeditor'],
  'ECB': ['Attorney', 'Expeditor'],
};

const COST_MAP: Record<string, [number, number]> = {
  'LEAD': [3000, 15000],
  'MOLD': [2000, 10000],
  'PEST': [500, 2500],
  'PLUMB': [1000, 8000],
  'ELECT': [1000, 5000],
  'BOILER': [2000, 15000],
  'HEAT': [2000, 15000],
  'PAINT': [800, 2500],
  'WINDOW': [100, 300],
  'SMOKE': [50, 200],
  'DEFAULT': [1000, 25000],
  'DOB': [3000, 12000],
  'ECB': [1500, 5000],
};

/**
 * How-to-resolve guidance, keyed the same way as PLAYER_MAP/COST_MAP.
 * Sources: NYC HPD "Penalties and Fees" (nyc.gov/site/hpd/services-and-information/penalties-and-fees.page)
 * and standard DOB/OATH cure procedures.
 */
export const RESOLUTION_GUIDE: Record<string, { label: string; steps: string[]; companies: string[] }> = {
  'LEAD': {
    label: 'Lead-Based Paint Hazard',
    steps: [
      'Retain an EPA/NYC-certified lead inspector to test and confirm the hazard location.',
      'Hire an EPA RRP-certified lead abatement or remediation contractor to remove/encapsulate.',
      'File the required HPD lead-based paint work application before starting work.',
      'Submit certification of correction with dust-clearance test results to HPD.',
    ],
    companies: ['Certified Lead Inspector', 'EPA RRP-Certified Remediation Contractor', 'DOB Expeditor'],
  },
  'GAS': {
    label: 'Gas Line / Gas Leak',
    steps: [
      'Call the gas utility (Con Edison / National Grid) immediately if an active leak is suspected.',
      'Retain a Licensed Master Plumber to inspect, repair, and pressure-test the gas line.',
      'File a DOB gas-work permit (PW1) if piping is altered or replaced.',
      'Schedule the utility restoration inspection and certify correction with HPD/DOB.',
    ],
    companies: ['Licensed Master Plumber', 'Gas Utility (Con Edison / National Grid)', 'DOB Expeditor'],
  },
  'HEAT': {
    label: 'Heat / Hot Water',
    steps: [
      'Dispatch an HVAC/boiler technician same-day — heat/hot-water violations carry the steepest daily penalties.',
      'Confirm boiler is operational and fuel supply is not interrupted; check for citywide/utility outages.',
      'If the boiler requires replacement, get emergency quotes from two contractors and notify HPD of the repair timeline.',
      'Certify correction with HPD promptly — penalties keep accruing daily until certified.',
    ],
    companies: ['HVAC Contractor', 'Licensed Boiler Technician', 'Fuel/Utility Provider'],
  },
  'FIRE': {
    label: 'Fire Safety',
    steps: [
      'Contact FDNY-registered Fire Safety Director/contractor to assess the specific code section cited.',
      'Repair or replace fire safety equipment (alarms, extinguishers, self-closing doors, sprinklers) as required.',
      'Schedule FDNY re-inspection and file DOB correction paperwork where applicable.',
    ],
    companies: ['Fire Safety Director', 'FDNY-Registered Contractor', 'DOB Expeditor'],
  },
  'MOLD': {
    label: 'Mold',
    steps: [
      'Identify and fix the underlying moisture source (leak, ventilation, plumbing) before remediation.',
      'Hire a licensed mold remediation contractor for removal and post-remediation clearance testing.',
      'Certify correction with HPD once clearance testing confirms the space is clear.',
    ],
    companies: ['Mold Remediation Contractor', 'Plumber (source repair)', 'Environmental Testing Lab'],
  },
  'PEST': {
    label: 'Pest Infestation',
    steps: [
      'Engage a licensed pest control company for inspection and a treatment plan (often multi-visit).',
      'Address building-wide conditions (waste storage, sealing entry points) alongside unit-level treatment.',
      'Certify correction with HPD after the exterminator confirms the infestation is resolved.',
    ],
    companies: ['Licensed Pest Control Company', 'Superintendent (building-wide prep)'],
  },
  'PLUMB': {
    label: 'Plumbing',
    steps: [
      'Dispatch a licensed plumber to diagnose and repair the leak, drain, or fixture issue.',
      'For structural/riser work, file a DOB plumbing permit before starting.',
      'Certify correction with HPD once repairs are verified.',
    ],
    companies: ['Licensed Plumber', 'DOB Expeditor (if permit required)'],
  },
  'ELECT': {
    label: 'Electrical',
    steps: [
      'Engage a licensed electrician to inspect and repair the wiring, panel, or fixture cited.',
      'File a DOB electrical permit if work goes beyond like-for-like repair.',
      'Schedule electrical inspection sign-off and certify correction.',
    ],
    companies: ['Licensed Electrician', 'DOB Expeditor (if permit required)'],
  },
  'DOB': {
    label: 'DOB Building Code Violation',
    steps: [
      'Retain a Registered Architect or Professional Engineer to assess the cited condition and design the fix.',
      'File the appropriate DOB application (Alt-1/Alt-2/EWO) and obtain permits before starting work.',
      'Complete the work, schedule DOB inspection, and file for violation dismissal once approved.',
    ],
    companies: ['Registered Architect / P.E.', 'DOB Expeditor', 'Licensed General Contractor'],
  },
  'ECB': {
    label: 'ECB / OATH Penalty',
    steps: [
      'Confirm the scheduled hearing date — defaulting on an ECB hearing results in an automatic penalty judgment.',
      'Retain counsel or an expeditor experienced with OATH hearings to appear (or file a written answer/adjournment).',
      'If the underlying condition is already corrected, request mitigation of the penalty at the hearing (commonly reduces the fine).',
      'Pay or settle the balance promptly once resolved — unpaid ECB judgments become liens on the property.',
    ],
    companies: ['Attorney (OATH/ECB hearings)', 'DOB Expeditor'],
  },
  'DEFAULT': {
    label: 'General Violation',
    steps: [
      'Assign a property manager to confirm the exact cited condition and correction deadline.',
      'Engage the appropriate licensed trade to perform the repair.',
      'Certify correction with the issuing agency (HPD/DOB) before the deadline to avoid civil penalties.',
    ],
    companies: ['Property Manager', 'Licensed Contractor'],
  },
  'FDNY': {
    label: 'FDNY / Fire Prevention Violation',
    steps: [
      'Contact an FDNY-registered Fire Safety Director or code consultant to review the cited condition.',
      'Correct the condition (equipment repair/replacement, access, signage, etc.) and retain proof (photos, invoices).',
      'Submit the required Certificate of Correction or respond to the OATH summons before the hearing/cure date.',
    ],
    companies: ['Fire Safety Director', 'FDNY-Registered Contractor', 'OATH Hearings Representative'],
  },
};

/**
 * Direct links to the official dismissal / certification-of-correction paperwork
 * for each resolution category, plus the fee and filing deadline that actually
 * governs removal from the agency's record (distinct from the deadline to fix
 * the underlying condition). Sourced from:
 *  - HPD Clear Violations: https://www.nyc.gov/site/hpd/services-and-information/clear-violations.page
 *  - HPD Dismissal Request form + fee schedule: https://www.nyc.gov/assets/hpd/downloads/pdfs/services/dismissal-request-form-clear-violations.pdf
 *  - DOB Violation Dismissal Request form: https://www.nyc.gov/assets/buildings/pdf/ENF-ViolationDismissalRequestForm.pdf
 *  - DOB OP106 Waiver/Reduction/Dismissal Cover Sheet (LL62/91, LL10/81, LL11/98, elevator, electrical): https://www.nyc.gov/site/buildings/dob/forms.page
 *  - DOB "Resolve a Summons or Violation": https://www.nyc.gov/site/buildings/dob/resolve-a-summons-or-violation.page
 *  - OATH "Appeal a Decision" (30 days / 35 if mailed; do NOT use for defaults): https://www.nyc.gov/site/oath/hearings/appeal-a-decision.page
 *  - OATH "Reopen a Missed Hearing (Default)": https://www.nyc.gov/site/oath/hearings/reopen-a-missed-hearing-default-online.page
 */
export const DISMISSAL_GUIDE: Record<string, { formName: string; formUrl: string; fee: string; deadline: string }> = {
  HPD_STANDARD: {
    formName: 'HPD Certification of Correction / Dismissal Request',
    formUrl: 'https://www.nyc.gov/site/hpd/services-and-information/clear-violations.page',
    fee: '$250\u2013$500 by unit count ($1,000 if the building is in the Alternative Enforcement Program)',
    deadline: 'Certify correction by the deadline on the notice. If overdue, file a Dismissal Request \u2014 HPD inspects within 45 days (summer) / 90 days (winter); if inspectors can\u2019t get access, a CV-1 self-certification is due within 45 business days of the final inspection attempt.',
  },
  HPD_LEAD: {
    formName: 'HPD Dismissal Request + Local Law 1 lead records submission',
    formUrl: 'https://www.nyc.gov/site/hpd/services-and-information/clear-violations.page',
    fee: '$250\u2013$500 by unit count (AEP buildings: $1,000)',
    deadline: 'Lead violations additionally require submitting the annual notice and the prior year\u2019s investigation records within 45 days of the violation; owners should submit at least 3, ideally all 10, consecutive years of records \u2014 missing years cost $1,000 each once HPD deems the submission sufficient.',
  },
  DOB_STANDARD: {
    formName: 'DOB Violation Dismissal Request (+ OP106 Waiver/Reduction/Dismissal Cover Sheet for LL62/91, LL10/81, LL11/98, elevator & electrical)',
    formUrl: 'https://www.nyc.gov/assets/buildings/pdf/ENF-ViolationDismissalRequestForm.pdf',
    fee: 'No filing fee; applicable DOB civil penalties must be paid before dismissal is granted',
    deadline: 'Submit the completed, typewritten form with all supporting documentation (before/after photos, licensed-professional assessment for structural items, proof of penalty payment for Work-Without-a-Permit) to the issuing unit (Executive Inspections, Plumbing Enforcement, Quality of Life, Special Operations, or the borough Construction Enforcement office).',
  },
  ECB_OATH: {
    formName: 'OATH Hearing response: Cure Request, Stipulation, or Appeal',
    formUrl: 'https://www.nyc.gov/site/oath/hearings/appeal-a-decision.page',
    fee: 'No filing fee to respond or appeal; unpaid judgments become liens on the property',
    deadline: 'Respond before the hearing date (cure, accept a stipulation, or attend). Appeals of a decision are due within 30 days (35 if mailed) \u2014 but a default judgment cannot be appealed; it requires a separate motion to reopen instead.',
  },
  FDNY_OATH: {
    formName: 'OATH/FDNY Certificate of Correction or Hearing response',
    formUrl: 'https://www.nyc.gov/site/oath/hearings/appeal-a-decision.page',
    fee: 'No filing fee to respond; applicable penalties must be paid to close the summons',
    deadline: 'Respond before the scheduled OATH hearing date to avoid an automatic default judgment at the maximum penalty.',
  },
};

/** Maps a violation's resolutionKey + source to the right entry in DISMISSAL_GUIDE. */
export function dismissalGuideFor(resolutionKey: string, source: string): { formName: string; formUrl: string; fee: string; deadline: string } {
  if (source === 'DOB') return DISMISSAL_GUIDE.DOB_STANDARD;
  if (source === 'ECB') return DISMISSAL_GUIDE.ECB_OATH;
  if (source === 'FDNY') return DISMISSAL_GUIDE.FDNY_OATH;
  if (resolutionKey === 'LEAD') return DISMISSAL_GUIDE.HPD_LEAD;
  return DISMISSAL_GUIDE.HPD_STANDARD;
}

function resolutionKeyFor(desc: string, source: string, vClass: string): string {
  const d = desc.toUpperCase();
  for (const key of Object.keys(RESOLUTION_GUIDE)) {
    if (key === 'DEFAULT' || key === 'DOB' || key === 'ECB' || key === 'FDNY') continue;
    if (d.includes(key)) return key;
  }
  if (source === 'DOB') return 'DOB';
  if (source === 'ECB') return 'ECB';
  if (source === 'FDNY') return 'FDNY';
  return 'DEFAULT';
}

/**
 * Current (post-Dec 8, 2023) NYC HPD civil penalty schedule.
 * Source: nyc.gov/site/hpd/services-and-information/penalties-and-fees.page
 * Returns an initial fine range plus a per-day accrual range once the
 * violation is past its cure deadline, and the estimated amount accrued
 * to date if overdue.
 */
function estimateHPDPenalty(vClass: string, desc: string, isOverdue: boolean, cureDeadline: string | null): {
  initialLow: number; initialHigh: number; dailyLow: number; dailyHigh: number; accruedLow: number; accruedHigh: number;
} {
  const d = desc.toUpperCase();
  const isHeat = d.includes('HEAT') || d.includes('HOT WATER');
  const isLead = d.includes('LEAD');
  let initialLow = 0, initialHigh = 0, dailyLow = 0, dailyHigh = 0;

  if (vClass === 'A') {
    initialLow = 50; initialHigh = 150; dailyLow = 25; dailyHigh = 25;
  } else if (vClass === 'B') {
    initialLow = 75; initialHigh = 500; dailyLow = 25; dailyHigh = 125;
  } else if (vClass === 'C') {
    if (isLead) {
      initialLow = 0; initialHigh = 0; dailyLow = 250; dailyHigh = 250; // capped at $10,000 — not modeled per-day cap here
    } else if (isHeat) {
      initialLow = 350; initialHigh = 1250; dailyLow = 350; dailyHigh = 1250;
    } else {
      initialLow = 150; initialHigh = 1200; dailyLow = 50; dailyHigh = 1200;
    }
  }

  let accruedLow = 0, accruedHigh = 0;
  if (isOverdue && cureDeadline) {
    const daysPast = Math.max(0, Math.floor((Date.now() - new Date(cureDeadline).getTime()) / 86400000));
    accruedLow = initialLow + daysPast * dailyLow;
    accruedHigh = initialHigh + daysPast * dailyHigh;
    if (isLead) { accruedLow = Math.min(accruedLow, 10000); accruedHigh = Math.min(accruedHigh, 10000); }
  }

  return { initialLow, initialHigh, dailyLow, dailyHigh, accruedLow, accruedHigh };
}

function parseSocrataDate(yyyymmdd: string): string | null {
  if (!yyyymmdd || yyyymmdd.length < 8) return null;
  const y = yyyymmdd.slice(0, 4), m = yyyymmdd.slice(4, 6), d = yyyymmdd.slice(6, 8);
  return `${y}-${m}-${d}`;
}

function parseSocrataTime(hhmm: string): string | null {
  if (!hhmm) return null;
  const padded = hhmm.padStart(4, '0');
  return `${padded.slice(0, 2)}:${padded.slice(2, 4)}`;
}

export interface ViolationResult {
  source: string;
  violationClass: string;
  severityLevel: number;
  severityLabel: string;
  violationId: string;
  unit: string;
  description: string;
  status: string;
  isOpen: boolean;
  isOverdue: boolean;
  inspectionDate: string;
  cureDeadline: string | null;
  players: string[];
  costLow: number;
  costHigh: number;
  /** Resolution guidance key (LEAD/GAS/HEAT/FIRE/MOLD/PEST/PLUMB/ELECT/DOB/ECB/DEFAULT) */
  resolutionKey: string;
  /** ECB/OATH hearing date, ISO yyyy-mm-dd, when the record has a scheduled hearing */
  hearingDate: string | null;
  /** ECB/OATH hearing time, 24h "HH:mm" NYC local */
  hearingTime: string | null;
  hearingStatus: string | null;
  /** Real assessed penalty figures for ECB records (from NYC Open Data) */
  penaltyImposed: number | null;
  amountPaid: number | null;
  balanceDue: number | null;
  /** Estimated civil-penalty accrual for HPD records, per the current HPD schedule */
  penaltyAccruedLow: number | null;
  penaltyAccruedHigh: number | null;
  penaltyDailyLow: number | null;
  penaltyDailyHigh: number | null;
}

export interface UpcomingHearing {
  source: string;
  violationId: string;
  description: string;
  hearingDate: string;
  hearingTime: string | null;
  hearingStatus: string | null;
  balanceDue: number | null;
  isPast: boolean;
}

export interface ViolationSummary {
  address: string;
  borough: string;
  totalFound: number;
  totalOpen: number;
  hpdOpen: number;
  hpdClassC: number;
  hpdClassB: number;
  hpdClassA: number;
  dobOpen: number;
  ecbOpen: number;
  overdue: number;
  costLow: number;
  costHigh: number;
  players: string[];
  violations: ViolationResult[];
  /** Scheduled ECB/OATH hearings, sorted soonest first */
  upcomingHearings: UpcomingHearing[];
  /** Real penalties assessed to date across open ECB records */
  totalPenaltiesAssessed: number;
  /** Real outstanding balance across open ECB records */
  totalBalanceDue: number;
  /** Estimated accrued HPD civil penalties across overdue open records (low/high) */
  totalHPDAccruedLow: number;
  totalHPDAccruedHigh: number;
}

async function fetchNYCData(url: string, params: Record<string, string>): Promise<any[]> {
  const query = new URLSearchParams({ ...params, '$limit': '5000' });
  try {
    const resp = await fetch(`${url}?${query}`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!resp.ok) return [];
    return await resp.json();
  } catch {
    return [];
  }
}

function parseAddress(address: string): { houseNum: string; street: string; streetClean: string } {
  let clean = address.toUpperCase().split(',')[0].trim();
  clean = clean.replace(/\bAVE\b/g, 'AVENUE').replace(/\bST\b/g, 'STREET');
  clean = clean.replace(/\bBLVD\b/g, 'BOULEVARD').replace(/\bPL\b/g, 'PLACE').replace(/\bRD\b/g, 'ROAD').replace(/\bDR\b/g, 'DRIVE');
  for (const [word, num] of Object.entries(NAMED_AVENUE_MAP)) {
    clean = clean.replace(new RegExp(`\\b${word}\\s+(AVENUE|AVE)\\b`, 'g'), `${num} AVENUE`);
  }
  clean = clean.replace(/(\d+)\s*(ST|ND|RD|TH)\b/g, '$1');
  clean = clean.replace(/\s+(NEW YORK CITY|NEW YORK|NYC|NY|MANHATTAN|BROOKLYN|QUEENS|BRONX|STATEN ISLAND)\s*$/g, '');
  clean = clean.replace(/\s{2,}/g, ' ').trim();

  const match = clean.match(/\b(\d+[-\d]*)\s+(.+)$/);
  const houseNum = match?.[1] || '';
  const street = (match?.[2] || clean).trim();
  const streetClean = street
    .replace(/\b(STREET|AVENUE|PLACE|ROAD|DRIVE|BOULEVARD|COURT|LANE|TERRACE)\b/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return { houseNum, street, streetClean };
}

function streetLikeClause(field: string, street: string): string {
  const tokens = street
    .replace(/\b(STREET|AVENUE|PLACE|ROAD|DRIVE|BOULEVARD|COURT|LANE|TERRACE)\b/g, '')
    .split(/\s+/)
    .map(t => t.trim())
    .filter(Boolean);
  return tokens.map(token => `upper(${field}) like '%${token.replace(/'/g, "''")}%'`).join(' AND ');
}

function getPlayers(desc: string, vClass: string): string[] {
  const d = desc.toUpperCase();
  for (const [key, players] of Object.entries(PLAYER_MAP)) {
    if (key !== 'DEFAULT_C' && key !== 'DEFAULT_B' && key !== 'DEFAULT_A' && key !== 'DOB' && key !== 'ECB' && d.includes(key)) {
      return players;
    }
  }
  if (vClass === 'C') return PLAYER_MAP['DEFAULT_C'];
  if (vClass === 'B') return PLAYER_MAP['DEFAULT_B'];
  return PLAYER_MAP['DEFAULT_A'];
}

function getCost(desc: string, source: string): [number, number] {
  if (source === 'DOB') return COST_MAP['DOB'];
  if (source === 'ECB') return COST_MAP['ECB'];
  const d = desc.toUpperCase();
  for (const [key, cost] of Object.entries(COST_MAP)) {
    if (key !== 'DEFAULT' && key !== 'DOB' && key !== 'ECB' && d.includes(key)) return cost;
  }
  return COST_MAP['DEFAULT'];
}

export async function searchViolations(address: string, borough: string): Promise<ViolationSummary> {
  const boroId = BORO_CODES[borough.toUpperCase()] || borough;
  const { houseNum, street, streetClean } = parseAddress(address);
  const hpdStreetWhere = streetLikeClause('streetname', street);
  const dobStreetWhere = streetLikeClause('street', street);
  const ecbStreetWhere = streetLikeClause('respondent_street', street);

  // Fetch HPD violations
  const hpdData = await fetchNYCData('https://data.cityofnewyork.us/resource/wvxf-dwi5.json', {
    '$where': [
      houseNum ? `housenumber='${houseNum.replace(/'/g, "''")}'` : '',
      `boroid='${boroId}'`,
      hpdStreetWhere,
    ].filter(Boolean).join(' AND '),
  });

  // Fetch DOB violations
  const dobData = await fetchNYCData('https://data.cityofnewyork.us/resource/3h2n-5cm9.json', {
    '$where': [
      houseNum ? `house_number='${houseNum.replace(/'/g, "''")}'` : '',
      `boro='${boroId}'`,
      dobStreetWhere || (streetClean ? `upper(street) like '%${streetClean.replace(/'/g, "''")}%'` : ''),
    ].filter(Boolean).join(' AND '),
  });

  // Fetch ECB violations
  const ecbData = await fetchNYCData('https://data.cityofnewyork.us/resource/6bgk-3dad.json', {
    '$where': [
      houseNum ? `respondent_house_number='${houseNum.replace(/'/g, "''")}'` : '',
      ecbStreetWhere,
    ].filter(Boolean).join(' AND '),
  });

  const now = new Date();
  const violations: ViolationResult[] = [];

  // Process HPD
  for (const v of hpdData) {
    const vClass = (v.violationclass || v.class || '').toUpperCase().trim();
    const status = (v.violationstatus || v.currentstatus || '').toUpperCase();
    const isOpen = ['OPEN', 'NOTICE SENT', 'CIV PENALTY', ''].includes(status) || !status.includes('CLOSE');
    const severity = HPD_CLASS_SEVERITY[vClass] || { level: 0, label: 'UNKNOWN', cureDays: 30 };
    const desc = v.novdescription || v.violationdescription || '';
    const inspDate = v.inspectiondate || v.novissueddate || '';

    let cureDeadline: string | null = null;
    let isOverdue = false;
    if (inspDate) {
      try {
        const d = new Date(inspDate);
        const deadline = new Date(d.getTime() + severity.cureDays * 86400000);
        cureDeadline = deadline.toISOString().split('T')[0];
        isOverdue = deadline < now;
      } catch { /* ignore */ }
    }

    const hpdPenalty = estimateHPDPenalty(vClass, desc, isOpen && isOverdue, cureDeadline);

    violations.push({
      source: 'HPD',
      violationClass: vClass,
      severityLevel: severity.level,
      severityLabel: severity.label,
      violationId: v.violationid || v.novid || '',
      unit: v.apartment || 'Building',
      description: desc,
      status: isOpen ? 'OPEN' : status,
      isOpen,
      isOverdue: isOpen && isOverdue,
      inspectionDate: inspDate,
      cureDeadline,
      players: getPlayers(desc, vClass),
      resolutionKey: resolutionKeyFor(desc, 'HPD', vClass),
      hearingDate: null,
      hearingTime: null,
      hearingStatus: null,
      penaltyImposed: null,
      amountPaid: null,
      balanceDue: null,
      penaltyAccruedLow: (isOpen && isOverdue) ? hpdPenalty.accruedLow : null,
      penaltyAccruedHigh: (isOpen && isOverdue) ? hpdPenalty.accruedHigh : null,
      penaltyDailyLow: hpdPenalty.dailyLow,
      penaltyDailyHigh: hpdPenalty.dailyHigh,
      ...(() => { const c = getCost(desc, 'HPD'); return { costLow: c[0], costHigh: c[1] }; })(),
    });
  }

  // Process DOB
  for (const v of dobData) {
    const category = (v.violation_category || '').toUpperCase();
    const isOpen = category.includes('ACTIVE') || (!category.includes('DISMISS') && !category.includes('RESOLVE') && !category.includes('V*'));
    const desc = v.violation_type || '';

    violations.push({
      source: 'DOB',
      violationClass: 'DOB',
      severityLevel: 2,
      severityLabel: 'DOB VIOLATION',
      violationId: v.isn_dob_bis_viol || v.violation_number || '',
      unit: 'Building',
      description: desc,
      status: isOpen ? 'ACTIVE' : 'DISMISSED',
      isOpen,
      isOverdue: false,
      inspectionDate: v.issue_date || '',
      cureDeadline: null,
      players: PLAYER_MAP['DOB'],
      resolutionKey: 'DOB',
      hearingDate: null,
      hearingTime: null,
      hearingStatus: null,
      penaltyImposed: null,
      amountPaid: null,
      balanceDue: null,
      penaltyAccruedLow: null,
      penaltyAccruedHigh: null,
      penaltyDailyLow: null,
      penaltyDailyHigh: null,
      costLow: COST_MAP['DOB'][0],
      costHigh: COST_MAP['DOB'][1],
    });
  }

  // Process ECB — this dataset carries real hearing dates/times and real assessed penalties.
  for (const v of ecbData) {
    const status = (v.ecb_violation_status || v.violation_status || v.status || '').toUpperCase();
    const isOpen = !status.includes('RESOLVE') && !status.includes('DISMISS') && !status.includes('PAID');
    const hearingDate = parseSocrataDate(v.hearing_date || '');
    const hearingTime = parseSocrataTime(v.hearing_time || '');
    const penaltyImposed = v.penality_imposed != null ? Number(v.penality_imposed) || 0 : null;
    const amountPaid = v.amount_paid != null ? Number(v.amount_paid) || 0 : null;
    const balanceDue = v.balance_due != null ? Number(v.balance_due) || 0 : null;

    violations.push({
      source: 'ECB',
      violationClass: 'ECB',
      severityLevel: 2,
      severityLabel: 'ECB PENALTY',
      violationId: v.ecb_violation_number || v.isn_dob_bis_viol || '',
      unit: 'Building',
      description: v.violation_description || v.infraction_code1 || v.infraction_codes || '',
      status: isOpen ? (v.hearing_status || 'OPEN') : status,
      isOpen,
      isOverdue: isOpen,
      inspectionDate: v.issue_date || v.violation_date || '',
      cureDeadline: null,
      players: PLAYER_MAP['ECB'],
      resolutionKey: 'ECB',
      hearingDate,
      hearingTime,
      hearingStatus: v.hearing_status || null,
      penaltyImposed,
      amountPaid,
      balanceDue,
      penaltyAccruedLow: null,
      penaltyAccruedHigh: null,
      penaltyDailyLow: null,
      penaltyDailyHigh: null,
      costLow: COST_MAP['ECB'][0],
      costHigh: COST_MAP['ECB'][1],
    });
  }

  // Sort: open first, then by severity desc
  violations.sort((a, b) => {
    if (a.isOpen !== b.isOpen) return a.isOpen ? -1 : 1;
    return b.severityLevel - a.severityLevel;
  });

  const openViolations = violations.filter(v => v.isOpen);
  const hpdOpen = openViolations.filter(v => v.source === 'HPD');
  const allPlayers = new Set<string>();
  openViolations.forEach(v => v.players.forEach(p => allPlayers.add(p)));

  const nowISO = now.toISOString().split('T')[0];
  const upcomingHearings: UpcomingHearing[] = violations
    .filter(v => v.hearingDate)
    .map(v => ({
      source: v.source,
      violationId: v.violationId,
      description: v.description,
      hearingDate: v.hearingDate as string,
      hearingTime: v.hearingTime,
      hearingStatus: v.hearingStatus,
      balanceDue: v.balanceDue,
      isPast: (v.hearingDate as string) < nowISO,
    }))
    .sort((a, b) => a.hearingDate.localeCompare(b.hearingDate));

  return {
    address,
    borough: borough.toUpperCase(),
    totalFound: violations.length,
    totalOpen: openViolations.length,
    hpdOpen: hpdOpen.length,
    hpdClassC: hpdOpen.filter(v => v.violationClass === 'C').length,
    hpdClassB: hpdOpen.filter(v => v.violationClass === 'B').length,
    hpdClassA: hpdOpen.filter(v => v.violationClass === 'A').length,
    dobOpen: openViolations.filter(v => v.source === 'DOB').length,
    ecbOpen: openViolations.filter(v => v.source === 'ECB').length,
    overdue: openViolations.filter(v => v.isOverdue).length,
    costLow: openViolations.reduce((s, v) => s + v.costLow, 0),
    costHigh: openViolations.reduce((s, v) => s + v.costHigh, 0),
    players: Array.from(allPlayers).sort(),
    violations,
    upcomingHearings,
    totalPenaltiesAssessed: openViolations.reduce((s, v) => s + (v.penaltyImposed || 0), 0),
    totalBalanceDue: openViolations.reduce((s, v) => s + (v.balanceDue || 0), 0),
    totalHPDAccruedLow: openViolations.reduce((s, v) => s + (v.penaltyAccruedLow || 0), 0),
    totalHPDAccruedHigh: openViolations.reduce((s, v) => s + (v.penaltyAccruedHigh || 0), 0),
  };
}
