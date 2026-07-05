/**
 * LL97 Penalty Calculator & Compliance Engine
 *
 * NYC Local Law 97 imposes carbon emission caps on buildings over 25,000 sq ft.
 * Buildings exceeding their limits face penalties of $268/metric ton CO2 over the cap.
 *
 * Reference: https://www.nyc.gov/site/sustainablebuildings/ll97/ll97.page
 */

// ============================================================
// Types
// ============================================================

export type LL97BuildingType = 'office' | 'multifamily' | 'healthcare' | 'assembly' | 'retail';

export type LL97CompliancePeriod = 'period1' | 'period2';

export type LL97ComplianceStatus = 'Compliant' | 'At Risk' | 'Non-Compliant';

export interface LL97BuildingData {
  address: string;
  buildingType: LL97BuildingType;
  /** Gross floor area in square feet */
  grossFloorArea: number;
  /** Site Energy Use Intensity in kBtu/sq ft */
  siteEUI?: number | null;
  /** Total GHG emissions in metric tons CO2e (from benchmarking) */
  totalEmissions?: number | null;
  /** Energy Star score (1-100) */
  energyStarScore?: number | null;
  /** Compliance period to evaluate */
  period?: LL97CompliancePeriod;
}

export interface LL97PenaltyResult {
  /** The compliance period evaluated */
  period: LL97CompliancePeriod;
  periodLabel: string;
  /** CO2 emission limit for this building type/period in kg CO2e/sq ft */
  emissionsLimitPerSqFt: number;
  /** Total building emissions limit in metric tons CO2e */
  totalEmissionsLimit: number;
  /** Estimated actual emissions in metric tons CO2e */
  estimatedActualEmissions: number;
  /** Emissions over the limit in metric tons CO2e (0 if compliant) */
  emissionsOverLimit: number;
  /** Annual penalty in USD */
  annualPenalty: number;
  /** 10-year total exposure */
  tenYearExposure: number;
  /** Compliance status */
  complianceStatus: LL97ComplianceStatus;
  /** Building type used for calculation */
  buildingType: LL97BuildingType;
  /** Gross floor area used */
  grossFloorArea: number;
}

export interface LL97RemediationEstimate {
  /** Current annual penalty */
  currentPenalty: number;
  /** Estimated penalty after 20% energy reduction */
  penaltyAfter20PctReduction: number;
  /** Annual savings from 20% reduction */
  savingsFrom20PctReduction: number;
  /** Estimated penalty after 40% energy reduction */
  penaltyAfter40PctReduction: number;
  /** Annual savings from 40% reduction */
  savingsFrom40PctReduction: number;
  /** Whether full compliance is achievable with 40% reduction */
  canAchieveComplianceWith40Pct: boolean;
  /** Reduction percentage needed for full compliance */
  reductionNeededForCompliance: number | null;
}

// ============================================================
// Constants
// ============================================================

/** Penalty per metric ton CO2 over the limit */
export const PENALTY_PER_TON = 268;

/**
 * CO2 emission limits in kg CO2e per sq ft by building type and period.
 * Source: NYC LL97 / Carbon Limits Table
 */
export const EMISSION_LIMITS: Record<LL97BuildingType, Record<LL97CompliancePeriod, number>> = {
  multifamily: { period1: 6.75, period2: 4.07 },
  office:      { period1: 8.46, period2: 4.53 },
  healthcare:  { period1: 23.81, period2: 13.71 },
  assembly:    { period1: 10.74, period2: 5.21 },
  retail:      { period1: 11.81, period2: 5.30 },
};

/** Period labels */
export const PERIOD_LABELS: Record<LL97CompliancePeriod, string> = {
  period1: '2024–2029 (Period 1)',
  period2: '2030–2034 (Period 2)',
};

/** Building type labels */
export const BUILDING_TYPE_LABELS: Record<LL97BuildingType, string> = {
  office: 'Office',
  multifamily: 'Multifamily Housing',
  healthcare: 'Healthcare',
  assembly: 'Assembly',
  retail: 'Retail',
};

/**
 * Default emission factor: converts site EUI (kBtu/sq ft) to kg CO2e/sq ft.
 *
 * LL97 official coefficients (2024–2029 period):
 *   - Electricity: 0.000288962 tCO2e per kWh  → ÷3.412 kBtu/kWh ≈ 0.0847 kg CO2e/kBtu
 *   - Natural gas: 0.00005311 tCO2e per kBtu  ≈ 0.0531 kg CO2e/kBtu
 *
 * Blended for a typical NYC multifamily site-energy mix (~60% gas / 40% electric):
 *   0.6 × 0.0531 + 0.4 × 0.0847 ≈ 0.066 kg CO2e/kBtu
 *
 * NOTE: a previous version used 0.289 (the per-kWh electricity coefficient
 * mislabeled as per-kBtu), which overstated estimated emissions — and any
 * EUI-derived penalty — by roughly 4×. Reported benchmarking emissions, when
 * available, are always preferred over this estimate.
 */
const DEFAULT_EMISSION_FACTOR_KG_PER_KBTU = 0.066;

// ============================================================
// Core Functions
// ============================================================

/**
 * Determine the current compliance period based on year.
 */
export function getCurrentPeriod(year: number = new Date().getFullYear()): LL97CompliancePeriod {
  if (year < 2030) return 'period1';
  return 'period2';
}

/**
 * Estimate CO2 emissions from site EUI and GFA.
 * Returns metric tons CO2e.
 */
function estimateEmissionsFromEUI(siteEUI: number, grossFloorArea: number): number {
  // siteEUI is in kBtu/sq ft
  // Total energy = siteEUI * GFA (in kBtu)
  // Emissions = Total energy * emission factor (kg CO2e/kBtu) → convert to metric tons (/1000)
  const totalEnergyKBtu = siteEUI * grossFloorArea;
  const emissionsKg = totalEnergyKBtu * DEFAULT_EMISSION_FACTOR_KG_PER_KBTU;
  return emissionsKg / 1000; // metric tons
}

/**
 * Calculate LL97 penalty for a building.
 *
 * Uses actual GHG emissions from benchmarking data if available,
 * otherwise estimates from site EUI and GFA using NYC grid emission factors.
 */
export function calculateLL97Penalty(data: LL97BuildingData): LL97PenaltyResult {
  const period = data.period || getCurrentPeriod();
  const limitPerSqFt = EMISSION_LIMITS[data.buildingType]?.[period];

  if (limitPerSqFt === undefined) {
    // Unknown building type — return zero penalty
    return {
      period,
      periodLabel: PERIOD_LABELS[period],
      emissionsLimitPerSqFt: 0,
      totalEmissionsLimit: 0,
      estimatedActualEmissions: 0,
      emissionsOverLimit: 0,
      annualPenalty: 0,
      tenYearExposure: 0,
      complianceStatus: 'Compliant',
      buildingType: data.buildingType,
      grossFloorArea: data.grossFloorArea,
    };
  }

  // Total building emissions limit in metric tons
  // limitPerSqFt is in kg CO2e/sq ft → multiply by GFA → divide by 1000 for metric tons
  const totalEmissionsLimit = (limitPerSqFt * data.grossFloorArea) / 1000;

  // Estimate actual emissions
  let estimatedActualEmissions: number;
  if (data.totalEmissions != null && data.totalEmissions > 0) {
    // Use reported GHG from benchmarking
    estimatedActualEmissions = data.totalEmissions;
  } else if (data.siteEUI != null && data.siteEUI > 0) {
    // Estimate from EUI
    estimatedActualEmissions = estimateEmissionsFromEUI(data.siteEUI, data.grossFloorArea);
  } else {
    // No data — can't calculate
    return {
      period,
      periodLabel: PERIOD_LABELS[period],
      emissionsLimitPerSqFt: limitPerSqFt,
      totalEmissionsLimit,
      estimatedActualEmissions: 0,
      emissionsOverLimit: 0,
      annualPenalty: 0,
      tenYearExposure: 0,
      complianceStatus: 'Compliant',
      buildingType: data.buildingType,
      grossFloorArea: data.grossFloorArea,
    };
  }

  const emissionsOverLimit = Math.max(0, estimatedActualEmissions - totalEmissionsLimit);
  const annualPenalty = emissionsOverLimit * PENALTY_PER_TON;

  // Period durations: period1 = 6 years (2024-2029), period2 = 5 years (2030-2034)
  const periodYears = period === 'period1' ? 6 : 5;
  const tenYearExposure = annualPenalty * periodYears;

  // Determine compliance status
  let complianceStatus: LL97ComplianceStatus;
  if (emissionsOverLimit <= 0) {
    // Check if within 10% of the limit — "At Risk" for tightening in Period 2
    const margin = totalEmissionsLimit * 0.1;
    if (estimatedActualEmissions > totalEmissionsLimit - margin && period === 'period1') {
      complianceStatus = 'At Risk';
    } else {
      complianceStatus = 'Compliant';
    }
  } else {
    complianceStatus = 'Non-Compliant';
  }

  return {
    period,
    periodLabel: PERIOD_LABELS[period],
    emissionsLimitPerSqFt: limitPerSqFt,
    totalEmissionsLimit: Math.round(totalEmissionsLimit * 100) / 100,
    estimatedActualEmissions: Math.round(estimatedActualEmissions * 100) / 100,
    emissionsOverLimit: Math.round(emissionsOverLimit * 100) / 100,
    annualPenalty: Math.round(annualPenalty),
    tenYearExposure: Math.round(tenYearExposure),
    complianceStatus,
    buildingType: data.buildingType,
    grossFloorArea: data.grossFloorArea,
  };
}

/**
 * Get compliance status summary for a building across both periods.
 */
export function getComplianceStatus(data: LL97BuildingData): {
  period1: LL97PenaltyResult;
  period2: LL97PenaltyResult;
  worstStatus: LL97ComplianceStatus;
  totalExposure: number;
} {
  const period1 = calculateLL97Penalty({ ...data, period: 'period1' });
  const period2 = calculateLL97Penalty({ ...data, period: 'period2' });

  const statusRank: Record<LL97ComplianceStatus, number> = {
    'Compliant': 0,
    'At Risk': 1,
    'Non-Compliant': 2,
  };

  const worstStatus = statusRank[period1.complianceStatus] >= statusRank[period2.complianceStatus]
    ? period1.complianceStatus
    : period2.complianceStatus;

  // If compliant in period 1 but non-compliant in period 2, worst is non-compliant
  const actualWorst = statusRank[period2.complianceStatus] > statusRank[period1.complianceStatus]
    ? period2.complianceStatus
    : worstStatus;

  return {
    period1,
    period2,
    worstStatus: actualWorst,
    totalExposure: period1.tenYearExposure + period2.tenYearExposure,
  };
}

/**
 * Estimate savings from energy remediation measures.
 */
export function estimateRemediationSavings(data: LL97BuildingData): LL97RemediationEstimate {
  const currentResult = calculateLL97Penalty(data);
  const currentPenalty = currentResult.annualPenalty;

  // Simulate 20% energy reduction
  const data20 = {
    ...data,
    totalEmissions: data.totalEmissions != null
      ? data.totalEmissions * 0.8
      : undefined,
    siteEUI: data.siteEUI != null
      ? data.siteEUI * 0.8
      : undefined,
  };
  const result20 = calculateLL97Penalty(data20);

  // Simulate 40% energy reduction
  const data40 = {
    ...data,
    totalEmissions: data.totalEmissions != null
      ? data.totalEmissions * 0.6
      : undefined,
    siteEUI: data.siteEUI != null
      ? data.siteEUI * 0.6
      : undefined,
  };
  const result40 = calculateLL97Penalty(data40);

  // Calculate reduction needed for full compliance
  let reductionNeededForCompliance: number | null = null;
  if (currentResult.emissionsOverLimit > 0 && currentResult.estimatedActualEmissions > 0) {
    const targetEmissions = currentResult.totalEmissionsLimit;
    const reductionFraction = 1 - (targetEmissions / currentResult.estimatedActualEmissions);
    reductionNeededForCompliance = Math.round(reductionFraction * 100);
    if (reductionNeededForCompliance < 0) reductionNeededForCompliance = 0;
    if (reductionNeededForCompliance > 100) reductionNeededForCompliance = 100;
  }

  return {
    currentPenalty,
    penaltyAfter20PctReduction: result20.annualPenalty,
    savingsFrom20PctReduction: currentPenalty - result20.annualPenalty,
    penaltyAfter40PctReduction: result40.annualPenalty,
    savingsFrom40PctReduction: currentPenalty - result40.annualPenalty,
    canAchieveComplianceWith40Pct: result40.complianceStatus === 'Compliant',
    reductionNeededForCompliance,
  };
}

/**
 * Attempt to infer LL97 building type from NYC building class code.
 */
export function inferBuildingType(buildingClass?: string | null): LL97BuildingType | null {
  if (!buildingClass) return null;
  const code = buildingClass.toUpperCase().trim();

  // Residential / Multifamily: C, D, S (co-op/condo/walkup/elevator)
  if (/^[CDS]/.test(code) || /^R[1-9]/.test(code)) return 'multifamily';

  // Office: O, L (loft)
  if (/^[OL]/.test(code)) return 'office';

  // Healthcare: I
  if (/^I/.test(code)) return 'healthcare';

  // Assembly / Entertainment: P (theater, church), Y (church)
  if (/^[PY]/.test(code)) return 'assembly';

  // Retail / Store: K
  if (/^K/.test(code)) return 'retail';

  // Mixed-use elevator buildings are commonly multifamily
  if (/^D/.test(code)) return 'multifamily';

  return null;
}
