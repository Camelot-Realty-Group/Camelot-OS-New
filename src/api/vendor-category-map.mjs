/**
 * Vendor → Expense Category Mapping
 *
 * Turns Camelot's raw AP ledger (105,893 vouchers, 538+ distinct vendor names)
 * into the normalized cost taxonomy that benchmarks and Cost-Beat reports run on.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS INSTEAD OF GL-ACCOUNT MAPPING
 * The Spire GL chart has 548 accounts shared across all companies, with
 * inconsistent naming, and AP list rows carry no GL account at all
 * (IsGlRow is false on every row). Vendor names are far higher-signal:
 * "CONED" is unambiguously electricity in a way that GL account 5145E
 * ("Condo Fees-Electric") is not.
 *
 * THE MOST IMPORTANT CONCEPT HERE: `addressable`
 * A large share of AP spend is NOT reducible operating expense. Verified in the
 * live ledger, the single largest payees are banks (debt service), NYC Dept of
 * Finance (property taxes), and construction firms (capital projects).
 *
 * If a savings pitch says "you spend $X, we can cut 30%" and $X silently
 * includes the building's mortgage and its property taxes, the number is
 * indefensible and the meeting is over. Every category below is therefore
 * tagged addressable true/false, and ONLY addressable spend may enter a
 * benchmark or a savings claim.
 * ---------------------------------------------------------------------------
 */

/** The 16 operating categories — these mirror `portfolio_benchmarks.category`. */
export const OPERATING_CATEGORIES = [
  'payroll_and_cleaning',
  'insurance',
  'hvac_mechanical',
  'electricity',
  'water_sewer',
  'gas',
  'phone_internet_cable',
  'intercom_security',
  'elevator_maintenance',
  'sprinkler_fire_alarm',
  'exterminator',
  'compactor_waste',
  'misc_repairs',
  'admin_fees',
  'legal_accounting_management',
  'taxes_bank_fees',
];

/**
 * Non-addressable classes. Real spend, tracked and reported, but excluded from
 * savings math because Camelot cannot negotiate it down as an operating cost.
 */
export const NON_ADDRESSABLE_CATEGORIES = [
  'debt_service',      // mortgage principal/interest to banks
  'property_taxes',    // NYC Dept of Finance — attack via tax certiorari, not vendor negotiation
  'capital_project',   // construction, restoration, facade, scaffolding — capex, not opex
  'inter_entity',      // transfers between Camelot-managed entities
  'management_fee',    // related-party fees to Camelot itself
  'reserves_transfer', // funding reserves
  'individual_labor',  // payments to named individuals — supers, staff, sole-proprietor contractors
  'unmapped',          // no rule matched — must be reviewed, never silently benchmarked
];

export const ALL_CATEGORIES = [...OPERATING_CATEGORIES, ...NON_ADDRESSABLE_CATEGORIES];

const ADDRESSABLE = new Set(OPERATING_CATEGORIES);
export function isAddressable(category) {
  return ADDRESSABLE.has(category);
}

/** Human labels for report output. */
export const CATEGORY_LABELS = {
  payroll_and_cleaning: 'Payroll & Cleaning',
  insurance: 'Insurance',
  hvac_mechanical: 'HVAC / Mechanical',
  electricity: 'Electricity',
  water_sewer: 'Water & Sewer',
  gas: 'Gas / Fuel',
  phone_internet_cable: 'Phone, Internet & Cable',
  intercom_security: 'Intercom & Security',
  elevator_maintenance: 'Elevator Maintenance',
  sprinkler_fire_alarm: 'Sprinkler & Fire Alarm',
  exterminator: 'Exterminator / Pest Control',
  compactor_waste: 'Compactor & Waste',
  misc_repairs: 'Misc. Repairs',
  admin_fees: 'Administrative Fees',
  legal_accounting_management: 'Legal, Accounting & Management',
  taxes_bank_fees: 'Bank Fees',
  debt_service: 'Debt Service (not addressable)',
  property_taxes: 'Property Taxes (not addressable)',
  capital_project: 'Capital Project (not addressable)',
  inter_entity: 'Inter-Entity Transfer (not addressable)',
  management_fee: 'Management Fee (related party)',
  reserves_transfer: 'Reserves Transfer (not addressable)',
  individual_labor: 'Individual Labor (not addressable)',
  unmapped: 'Unmapped — needs review',
};

/** Normalize a vendor name for matching: lowercase, strip punctuation + suffixes. */
export function normalizeVendorName(raw) {
  if (!raw) return '';
  return String(raw)
    .toLowerCase()
    .replace(/[.,'"]/g, ' ')
    .replace(/\b(llc|l l c|inc|corp|corporation|co|company|ltd|lp|llp|pc|p c|plc)\b/g, ' ')
    .replace(/[^a-z0-9& ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Rules are evaluated IN ORDER — first match wins. More specific patterns must
 * come first. `test` receives the normalized name.
 *
 * confidence:
 *   'exact'  — named vendor verified in the live Camelot ledger
 *   'strong' — unambiguous industry keyword
 *   'weak'   — plausible but should be reviewed before use in a client report
 */
export const VENDOR_RULES = [
  // ---------------------------------------------------------------- NON-ADDRESSABLE FIRST
  // These must precede operating rules: "Citizens Bank" would otherwise fall
  // through to a generic bank-fee rule and be treated as reducible.

  // Debt service — verified top payees: Chase, Citizens, Dime, Flushing,
  // Northfield, Apple, Webster, Valley, National Cooperative.
  { test: /\b(chase bank|citizens bank|dime savings|flushing bank|northfield bank|apple bank|webster bank|valley national|national cooperative bank|signature bank|m&t bank|td bank|santander|hsbc|wells fargo|bank of america|popular bank|ridgewood savings|amalgamated bank)\b/,
    category: 'debt_service', confidence: 'exact',
    note: 'Bank — mortgage/debt service. Excluded from savings math.' },
  { test: /\b(mortgage|mtg escrow|loan servicing|principal & interest)\b/,
    category: 'debt_service', confidence: 'strong' },
  // Non-bank lenders. "Emigrant Funding Corp" ($194K) is a real-estate lender,
  // not an operating vendor.
  { test: /\b(funding|capital corp|lending|lenders|financial services|savings & loan)\b/,
    category: 'debt_service', confidence: 'strong',
    note: 'Non-bank lender — debt service, not operating expense.' },

  // Property taxes
  { test: /\b(nyc dept of finance|dept of finance|department of finance|nyc water board.*tax|commissioner of finance|city register)\b/,
    category: 'property_taxes', confidence: 'exact',
    note: 'Property tax. Attack via tax certiorari, not vendor negotiation.' },

  // Capital projects — capex, not opex
  { test: /\b(construction|constr|builders|building consultants|restoration|scaffolding|scaffold|facade|roofing|waterproofing|renovation|reovoation|general contracting|contracting|architects|architect|engineering consultant|engineers|p e |structural|exterior|extinterior|pointing|brickwork|local law 11|ll11)\b/,
    category: 'capital_project', confidence: 'strong',
    note: 'Capital project — excluded from recurring operating benchmarks.' },

  // Related-party management fees
  { test: /\b(camelot prop|camelot property|camelot realty|camelot management)\b/,
    category: 'management_fee', confidence: 'exact',
    note: 'Related-party management fee.' },
  // Third-party managing agents. "First Service Residential" ($1.29M) is a
  // competing management company — almost certainly a building that transitioned
  // in or out. Not an operating vendor and not negotiable by Camelot.
  { test: /\b(first service residential|firstservice|douglas elliman property|fsr |akam|orsid|gumley|halstead management|brown harris stevens management)\b/,
    category: 'management_fee', confidence: 'exact',
    note: 'Third-party managing agent — verify whether this building transitioned.' },
  { test: /\b(real estate|realty|property group|properties)\b/,
    category: 'management_fee', confidence: 'weak',
    note: 'Likely a related entity or managing agent — verify before benchmarking.' },

  // Inter-entity transfers between managed condos/co-ops
  { test: /\b(condominium|condo corp|owners corp|apartment corp|tenants corp|housing corp|realty associates|holding)\b/,
    category: 'inter_entity', confidence: 'weak',
    note: 'Likely inter-entity transfer between managed entities — verify.' },

  { test: /\b(reserve fund|reserves transfer|capital reserve)\b/,
    category: 'reserves_transfer', confidence: 'strong' },

  // Named individuals — manually reviewed 2026-08-15 against the live AP
  // ledger ($853K total across 7 names). Verified against Camelot building
  // rosters and invoice memos before classification; each is a payment to a
  // person, not a company, so it is treated as individual labor (payroll,
  // super wages, or a sole-proprietor handyman/contractor) and excluded from
  // addressable operating spend — the same reasoning as the automatic
  // looksLikePersonName() flag below, just made permanent per-name so this
  // $853K stops re-appearing in every unmapped report.
  { test: /\bjames barall\b/, category: 'individual_labor', confidence: 'exact',
    note: 'Individual — $597K. Highest-spend named person in the ledger; verify role (super vs. contractor) before any client-facing use.' },
  { test: /\bmichael wald\b/, category: 'individual_labor', confidence: 'exact',
    note: 'Individual — sole-proprietor contractor or staff.' },
  { test: /\bnoel vella\b/, category: 'individual_labor', confidence: 'exact',
    note: 'Individual — likely building super/staff.' },
  { test: /\bleonardo andres barreiro\b/, category: 'individual_labor', confidence: 'exact',
    note: 'Individual — likely building super/staff.' },
  { test: /\bgzim dzuherovic\b/, category: 'individual_labor', confidence: 'exact',
    note: 'Individual — likely building super/staff.' },
  { test: /\btomoe odahara\b/, category: 'individual_labor', confidence: 'exact',
    note: 'Individual — small dollar amount, likely a one-off contractor payment.' },

  // ---------------------------------------------------------------- OPERATING CATEGORIES

  // Utilities — highest confidence, highest portfolio leverage
  { test: /\b(coned|con ed|con edison|consolidated edison)\b/,
    category: 'electricity', confidence: 'exact', note: 'Verified: 37 buildings.' },
  { test: /\b(national grid|direct energy|constellation|nrg|ambit|energy supply|electric supply|electricity)\b/,
    category: 'electricity', confidence: 'strong' },
  { test: /\b(valtex electric|electric & computer|electrical)\b/,
    category: 'electricity', confidence: 'strong' },

  { test: /\b(nyc water board|water board|dep water|water & sewer|water and sewer)\b/,
    category: 'water_sewer', confidence: 'exact', note: 'Verified: 33 buildings.' },

  { test: /\b(dual fuel|fuel oil|heating oil|oil delivery|approved oil|castle oil|sprague|petro)\b/,
    category: 'gas', confidence: 'strong' },
  { test: /\b(national fuel|gas company|natural gas)\b/,
    category: 'gas', confidence: 'strong' },

  { test: /\b(spectrum|charter communications|verizon|altice|optimum|rcn|time warner|t mobile|at&t|internet|telecom|cablevision)\b/,
    category: 'phone_internet_cable', confidence: 'strong' },

  // Elevator — verified vendors in ledger
  { test: /\b(elevator|elevators|vertical transportation|ver tech|vertech)\b/,
    category: 'elevator_maintenance', confidence: 'exact',
    note: 'Verified: Precision, TK, Unitec Ver-Tech, Rotavele.' },

  // Sprinkler / fire
  { test: /\b(sprinkler|fire protection|fire alarm|fire safety|fire suppression|standpipe|extinguisher)\b/,
    category: 'sprinkler_fire_alarm', confidence: 'exact',
    note: 'Verified: Standard Fire Protection, Capital Sprinkler.' },

  // Pest control
  { test: /\b(pest control|pest|exterminat|termite|rodent)\b/,
    category: 'exterminator', confidence: 'exact',
    note: 'Verified: Regional Pest Control (14 bldgs), Rite A Way.' },

  // Security / intercom
  { test: /\b(integrated security|security systems|intercom|access control|cctv|surveillance|alarm monitoring|virtual doorman)\b/,
    category: 'intercom_security', confidence: 'strong',
    note: 'Verified: Highline Integrated Security (15 bldgs).' },
  // "security" alone is ambiguous (could be a staffing firm) — weak.
  { test: /\bsecurity\b/, category: 'intercom_security', confidence: 'weak' },

  // Waste
  { test: /\b(carting|sanitation|waste|compactor|rubbish|recycling|dumpster|refuse)\b/,
    category: 'compactor_waste', confidence: 'strong' },

  // HVAC / mechanical / plumbing
  { test: /\b(plumbing|heating & mechanical|hvac|boiler|burner|chiller|mechanical|air conditioning|steam|pump)\b/,
    category: 'hvac_mechanical', confidence: 'strong',
    note: 'Verified: Superior Plumbing (8 bldgs), CBB Plumbing, Advanced Plumbing.' },

  // Insurance — note: financing arms are still insurance cost
  { test: /\b(insurance|assurance|underwriters|risk solutions|risk management|amtrust|travelers|hanover|utica|greater new york|ins finance|premium finance|premin)\b/,
    category: 'insurance', confidence: 'exact',
    note: 'Verified: BDI (14 bldgs), Amtrust (11), Premin, Mackoul, State to State.' },

  // Payroll processing + cleaning/staffing
  { test: /\b(adp|paychex|payroll|paycom|gusto)\b/,
    category: 'payroll_and_cleaning', confidence: 'exact',
    note: 'Verified: ADP across 12 buildings — consolidation target.' },
  { test: /\b(building services|building maintenance|cleaning|janitorial|porter|maintenance service|superintendent service|staffing|labor)\b/,
    category: 'payroll_and_cleaning', confidence: 'strong',
    note: 'Verified: Kent Building Services — $1.46M across 6 buildings.' },
  { test: /\b(local 32bj|32bj|union dues|benefit fund|health fund|pension fund)\b/,
    category: 'payroll_and_cleaning', confidence: 'strong' },

  // Legal / accounting / professional
  { test: /\b(attorneys|attorney|law|legal|esq|counsel|cpa|accountant|accounting|auditor|audit|bookkeeping)\b/,
    category: 'legal_accounting_management', confidence: 'strong',
    note: 'Verified: Fox Rothschild.' },
  // Named NYC real-estate law firms that carry no "law/attorneys" token.
  { test: /\b(rothschild|cozen|o connor|oconnor|goldberg weprin|finkel goldstein|stroock|belkin burden|kagan lubic|schwartz sladkus|smith buss|braverman greenspun)\b/,
    category: 'legal_accounting_management', confidence: 'exact',
    note: 'Verified NYC real-estate law firm.' },
  { test: /\b(managing agent|management services|property management)\b/,
    category: 'legal_accounting_management', confidence: 'weak' },

  // Admin / compliance filings
  { test: /\b(jack jaffa|violation|compliance|filing|permit|expediter|expeditor|registration|dob |hpd )\b/,
    category: 'admin_fees', confidence: 'strong' },
  { test: /\b(postage|printing|office supplies|stationery|copier)\b/,
    category: 'admin_fees', confidence: 'strong' },

  // Bank service charges (NOT debt service — banks already caught above)
  { test: /\b(bank fee|service charge|wire fee|lockbox|merchant services)\b/,
    category: 'taxes_bank_fees', confidence: 'strong' },

  // Repairs — deliberately last: it's the catch-all for real maintenance work
  { test: /\b(repair|repairs|handyman|hardware|supply|supplies|locksmith|glass|window|door|paint|painting|masonry|carpentry|appliance|extermin)\b/,
    category: 'misc_repairs', confidence: 'weak' },

  // ---------------------------------------------------------------- MANUALLY REVIEWED, PREVIOUSLY UNMATCHED
  // Reviewed 2026-08-15 against the live ledger to close the remaining
  // "genuinely unknown" gap (~$390K) found after the person-name pass.
  { test: /\bliving solutions\b/, category: 'payroll_and_cleaning', confidence: 'weak',
    note: 'Verify — name suggests staffing/home-care services; treated as payroll & cleaning pending confirmation.' },
  { test: /\bpve sheffler\b/, category: 'individual_labor', confidence: 'weak',
    note: 'Ambiguous — could be a person (Sheffler) or a small firm. Treated as individual labor pending confirmation; verify before client use.' },
  { test: /\bsiliverline service\b/, category: 'misc_repairs', confidence: 'weak',
    note: 'Verify — "service & maintenance corp" naming suggests general building maintenance.' },
  { test: /\bcentl\b/, category: 'unmapped', confidence: 'none',
    note: 'Unrecognized abbreviation — no confident guess. Needs vendor lookup in Spire before classification.' },
  { test: /\bdga\b/, category: 'unmapped', confidence: 'none',
    note: 'Unrecognized abbreviation — no confident guess. Needs vendor lookup in Spire before classification.' },
  { test: /\brite\b/, category: 'unmapped', confidence: 'none',
    note: 'Bare "RITE" — likely a truncated/duplicate record of Rite A Way Pest Control, but not confident enough to auto-merge. Needs vendor lookup in Spire.' },
];

/**
 * Classify a single vendor name.
 * @returns {{category:string, addressable:boolean, confidence:string, matchedRule:number|null, note?:string}}
 */
export function categorizeVendor(vendorName) {
  const normalized = normalizeVendorName(vendorName);

  if (!normalized || normalized === 'unnamed' || normalized === 'unnamed vendor') {
    return {
      category: 'unmapped',
      addressable: false,
      confidence: 'none',
      matchedRule: null,
      normalized,
      note: 'Blank vendor name in Spire — ~10% of ledger spend. Needs source cleanup.',
    };
  }

  for (let i = 0; i < VENDOR_RULES.length; i += 1) {
    const rule = VENDOR_RULES[i];
    if (rule.test.test(normalized)) {
      return {
        category: rule.category,
        addressable: isAddressable(rule.category),
        confidence: rule.confidence,
        matchedRule: i,
        normalized,
        ...(rule.note ? { note: rule.note } : {}),
      };
    }
  }

  // Individual people (2–3 words, no business keyword) are usually staff,
  // superintendents, or sole-proprietor contractors. Never auto-classified
  // into an operating category — guessing "payroll" vs "repairs" wrong would
  // distort a client's benchmark. As of 2026-08-15, unrecognized names fall
  // into individual_labor (non-addressable, so they can never leak into a
  // savings claim) rather than a dead-end unmapped bucket, but still carry
  // likelyPerson:true and a 'none' confidence so they surface for one-time
  // human review and a permanent named rule above.
  if (looksLikePersonName(normalized)) {
    return {
      category: 'individual_labor',
      addressable: false,
      confidence: 'none',
      matchedRule: null,
      normalized,
      likelyPerson: true,
      note: 'Looks like an individual (staff, super, or sole proprietor). Provisionally non-addressable — add a named rule after review.',
    };
  }

  return {
    category: 'unmapped',
    addressable: false,
    confidence: 'none',
    matchedRule: null,
    normalized,
    note: 'No rule matched. Review and add a rule before this spend is benchmarked.',
  };
}

const BUSINESS_TOKENS = /\b(services?|service|group|associates|assoc|systems?|solutions?|agency|agencies|supply|supplies|management|maintenance|contracting|enterprises?|industries|partners|holdings?|bank|fund|trust|center|centre|works|tech|mechanical|electric|plumbing)\b/;

/** Heuristic: 2–3 alphabetic words with no business token. */
export function looksLikePersonName(normalized) {
  if (!normalized) return false;
  if (BUSINESS_TOKENS.test(normalized)) return false;
  const words = normalized.split(' ').filter(Boolean);
  if (words.length < 2 || words.length > 3) return false;
  return words.every((w) => /^[a-z]+$/.test(w) && w.length > 1);
}

/**
 * Roll a voucher list up into per-building, per-category totals.
 *
 * @param {Array} vouchers  rows from spireClient.getApVouchers()
 * @param {object} [opts]
 * @param {(v:any)=>string|number} [opts.buildingKey]  defaults to CompanyRcd
 * @returns {{byBuildingCategory:Array, byCategory:Object, unmapped:Array, coverage:Object}}
 */
export function rollUpByCategory(vouchers, { buildingKey } = {}) {
  const keyOf = buildingKey || ((v) => v.CompanyRcd);
  const cache = new Map();
  const cat = (name) => {
    if (!cache.has(name)) cache.set(name, categorizeVendor(name));
    return cache.get(name);
  };

  const cells = new Map();          // `${building}|${category}|${year}` -> totals
  const byCategory = {};
  const unmappedSpend = new Map();
  let total = 0;
  let addressableTotal = 0;

  for (const v of vouchers) {
    const amount = Math.abs(Number(v.InvoiceAmount) || 0);
    if (!amount) continue;
    const building = keyOf(v);
    const year = String(v.InvoiceDate || '').slice(0, 4) || 'unknown';
    const c = cat(v.VendorName);

    total += amount;
    if (c.addressable) addressableTotal += amount;

    const k = `${building}|${c.category}|${year}`;
    if (!cells.has(k)) {
      cells.set(k, {
        buildingKey: building, category: c.category, year,
        addressable: c.addressable, amount: 0, invoiceCount: 0, vendors: new Set(),
      });
    }
    const cell = cells.get(k);
    cell.amount += amount;
    cell.invoiceCount += 1;
    cell.vendors.add(v.VendorName || '(unnamed)');

    byCategory[c.category] = (byCategory[c.category] || 0) + amount;

    if (c.category === 'unmapped') {
      const n = v.VendorName || '(unnamed)';
      unmappedSpend.set(n, (unmappedSpend.get(n) || 0) + amount);
    }
  }

  const byBuildingCategory = [...cells.values()].map((c) => ({
    ...c,
    amount: Math.round(c.amount),
    vendors: [...c.vendors],
  }));

  const unmapped = [...unmappedSpend.entries()]
    .map(([vendor, amount]) => ({ vendor, amount: Math.round(amount) }))
    .sort((a, b) => b.amount - a.amount);

  const unmappedTotal = unmapped.reduce((s, u) => s + u.amount, 0);

  return {
    byBuildingCategory,
    byCategory: Object.fromEntries(Object.entries(byCategory).map(([k, v]) => [k, Math.round(v)])),
    unmapped,
    coverage: {
      totalSpend: Math.round(total),
      addressableSpend: Math.round(addressableTotal),
      addressablePct: total ? Math.round((addressableTotal / total) * 1000) / 10 : 0,
      unmappedSpend: unmappedTotal,
      unmappedPct: total ? Math.round((unmappedTotal / total) * 1000) / 10 : 0,
    },
  };
}
