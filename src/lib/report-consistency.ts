/**
 * report-consistency.ts — cross-page fact consistency gate
 *
 * Scans a fully rendered report's HTML for numeric claims about the
 * building (unit counts, stories, year built) and verifies that every
 * mention agrees with the canonical building data. Catches the classic
 * failure of one page saying "30 units" while another says "75 units"
 * BEFORE the report is released to a prospect.
 *
 * Deterministic, offline, and fast. A clean result means "no internal
 * contradictions found", not a certification that the source data
 * itself is correct — that remains the fact-authority layer's job.
 */
import type { MasterReportData } from './camelot-report';

export interface ConsistencyFinding {
  field: 'units' | 'stories' | 'year_built' | 'units_vs_official_record';
  canonical: string;
  found: string;
  snippet: string;
}

export interface ConsistencyResult {
  clean: boolean;
  findings: ConsistencyFinding[];
}

const stripHtml = (html: string): string =>
  html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&mdash;|&middot;/g, ' ')
    .replace(/\s+/g, ' ');

const num = (v: unknown): number => {
  const n = parseInt(String(v ?? '').replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
};

const snippetAround = (text: string, index: number, span = 60): string => {
  const start = Math.max(0, index - span);
  return '…' + text.slice(start, Math.min(text.length, index + span)).trim() + '…';
};

export function checkReportConsistency(d: MasterReportData, html: string): ConsistencyResult {
  const findings: ConsistencyFinding[] = [];
  const text = stripHtml(html);

  // ---- Units vs. official record (DOF/PLUTO) --------------------------
  // The reconciled unit count must stay anchored to the city's recorded
  // numbers for the exact tax lot. 115 CPW once shipped as "727 units"
  // (a sqft-derived estimate) against a recorded 238 — this gate exists so
  // that class of error blocks release instead of reaching a board.
  const recordedRes = num((d as any).unitsResidential);
  const recordedTot = num((d as any).unitsTotalAll);
  const recordedMax = Math.max(recordedRes, recordedTot);
  const claimed = num(d.units);
  if (recordedMax >= 3 && claimed > 0 && (claimed > recordedMax * 1.5 || claimed < recordedRes * 0.5)) {
    findings.push({
      field: 'units_vs_official_record',
      canonical: recordedTot && recordedTot !== recordedRes
        ? `${recordedRes} residential / ${recordedTot} total (DOF/PLUTO)`
        : `${recordedMax} (DOF/PLUTO)`,
      found: String(claimed),
      snippet: 'Reconciled unit count diverges from the official DOF/PLUTO record for this BBL — verify address/BBL match before release.',
    });
  }

  // ---- Units ----------------------------------------------------------
  // Accept any of: total units, residential units, commercial/other units,
  // and the residential+commercial arithmetic — these legitimately appear
  // as different numbers in the same report ("163 residential + 284
  // commercial = 447 total"). Anything else is a contradiction.
  const unitsTotal = num((d as any).unitsTotalAll) || num(d.units);
  const unitsRes = num((d as any).unitsResidential);
  const acceptedUnits = new Set(
    [unitsTotal, unitsRes, num(d.units), unitsTotal - unitsRes]
      .filter(n => n > 0)
  );
  if (acceptedUnits.size) {
    const unitRe = /(\d[\d,]{0,6})(?:\s*[-–]\s*|\s+)(?:unit|units|residences|residential units|apartments)\b/gi;
    let m: RegExpExecArray | null;
    const flagged = new Set<number>();
    while ((m = unitRe.exec(text)) !== null) {
      const found = num(m[1]);
      // Ignore tiny incidental numbers (e.g. "2-unit combinations" in
      // boilerplate) and ranges from search criteria copy.
      if (found < 3 || acceptedUnits.has(found) || flagged.has(found)) continue;
      flagged.add(found);
      findings.push({
        field: 'units',
        canonical: [...acceptedUnits].sort((a, b) => a - b).join(' / '),
        found: String(found),
        snippet: snippetAround(text, m.index),
      });
    }
  }

  // ---- Stories --------------------------------------------------------
  const stories = num(d.stories);
  if (stories > 0) {
    const storyRe = /(\d[\d,]{0,3})(?:\s*[-–]\s*|\s+)(?:story|stories|floors)\b/gi;
    let m: RegExpExecArray | null;
    const flagged = new Set<number>();
    while ((m = storyRe.exec(text)) !== null) {
      const found = num(m[1]);
      if (found < 1 || found === stories || flagged.has(found)) continue;
      flagged.add(found);
      findings.push({
        field: 'stories',
        canonical: String(stories),
        found: String(found),
        snippet: snippetAround(text, m.index),
      });
    }
  }

  // ---- Year built -----------------------------------------------------
  const yearBuilt = num(d.yearBuilt);
  if (yearBuilt > 1600) {
    const yearRe = /(?:built\s+(?:in\s+)?|(\b))(\d{4})(?:\s*[-–]\s*built|\b(?=\s*[-–]?\s*built))/gi;
    const simpleRe = /(?:built (?:in )?)(\d{4})|(\d{4})-built/gi;
    let m: RegExpExecArray | null;
    const flagged = new Set<number>();
    while ((m = simpleRe.exec(text)) !== null) {
      const found = num(m[1] || m[2]);
      if (found < 1600 || found > 2100 || found === yearBuilt || flagged.has(found)) continue;
      flagged.add(found);
      findings.push({
        field: 'year_built',
        canonical: String(yearBuilt),
        found: String(found),
        snippet: snippetAround(text, m.index),
      });
    }
    void yearRe;
  }

  return { clean: findings.length === 0, findings };
}

/** One-line human summary for toasts/logs. */
export function summarizeConsistencyFindings(result: ConsistencyResult): string {
  if (result.clean) return 'Cross-page fact check passed — no contradictions found.';
  return result.findings
    .slice(0, 3)
    .map(f => `${f.field}: report says "${f.found}" but building data says "${f.canonical}" (${f.snippet.slice(0, 80)})`)
    .join('\n');
}
