import type { MasterReportData, ReportFocusKey } from './camelot-report';
import { applyJackieFactAuthority, sanitizeJackieKnownPropertyHtml } from './jackie-fact-authority';
import { JACKIE_REPORT_PACKAGES, type JackieReportPackage } from './pitch-report';
import { supabase, isSupabaseConfigured } from './supabase';
import { CPW_279_ADDRESS, CPW_279_NAME, is279CentralParkWestValue, is36East22ndStreetValue } from './property-guardrails';

export type SavedJackieReport = {
  id: string;
  reportNumber: string;
  address: string;
  buildingName: string;
  borough?: string;
  packageType: JackieReportPackage;
  packageLabel: string;
  filename: string;
  html: string;
  dataSnapshot?: MasterReportData;
  inquiryContact?: string;
  inquiryEmail?: string;
  inquiryPhone?: string;
  focus: ReportFocusKey[];
  generatedAt: string;
};

export const JACKIE_REPORT_LIBRARY_KEY = 'camelot_generated_jackie_report_library_v1';
const JACKIE_REPORT_LIBRARY_BACKUP_KEY = `${JACKIE_REPORT_LIBRARY_KEY}_oversized_backup`;
const MAX_STORED_REPORT_HTML_CHARS = 1_250_000;
const MAX_LIBRARY_RAW_CHARS = 7_000_000;

function normalizeSavedRecord(record: SavedJackieReport): SavedJackieReport {
  const dataSnapshot = record.dataSnapshot
    ? applyJackieFactAuthority(record.dataSnapshot).data
    : undefined;
  const is279 = is279CentralParkWestValue(record.address, record.buildingName, dataSnapshot?.address, dataSnapshot?.buildingName, dataSnapshot?.managementCompany, record.html);
  const is36 = is36East22ndStreetValue(record.address, record.buildingName, dataSnapshot?.address, dataSnapshot?.buildingName, dataSnapshot?.managementCompany, record.html);
  const htmlData = dataSnapshot || { address: record.address, buildingName: record.buildingName };
  const html = (is279 || is36) ? sanitizeJackieKnownPropertyHtml(record.html, htmlData).data : record.html;

  if (is279) {
    return {
      ...record,
      address: CPW_279_ADDRESS,
      buildingName: CPW_279_NAME,
      filename: record.filename.replace(/halstead[-_\s]+/gi, ''),
      html,
      dataSnapshot,
    };
  }

  return {
    ...record,
    html,
    dataSnapshot,
  };
}

export const packageLabelFor = (packageType: JackieReportPackage) => (
  JACKIE_REPORT_PACKAGES.find(pkg => pkg.key === packageType)?.label || 'Engagement Report'
);

export const formatLibraryDate = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const loadLocalJackieReportLibrary = (): SavedJackieReport[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(JACKIE_REPORT_LIBRARY_KEY) || sessionStorage.getItem(JACKIE_REPORT_LIBRARY_KEY) || '[]';
    if (raw.length > MAX_LIBRARY_RAW_CHARS) {
      try {
        sessionStorage.setItem(JACKIE_REPORT_LIBRARY_BACKUP_KEY, raw);
      } catch {
        // If the browser cannot keep a temporary backup, prioritize keeping Jackie responsive.
      }
      localStorage.removeItem(JACKIE_REPORT_LIBRARY_KEY);
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const normalized = parsed.map(normalizeSavedRecord);
    if (JSON.stringify(normalized) !== JSON.stringify(parsed)) {
      writeLocalJackieReportLibrary(normalized);
    }
    return normalized;
  } catch {
    localStorage.removeItem(JACKIE_REPORT_LIBRARY_KEY);
    return [];
  }
};

const compactRecordForStorage = (record: SavedJackieReport): SavedJackieReport => {
  if (record.html.length <= MAX_STORED_REPORT_HTML_CHARS) return record;
  return {
    ...record,
    html: `<html><body style="font-family:Arial,sans-serif;padding:32px;line-height:1.6"><h1>${record.packageLabel}</h1><p><strong>${record.address}</strong></p><p>Report # ${record.reportNumber}</p><p>This report was generated and opened for preview, but the full HTML package was too large for browser archive storage. Re-run the report and use Download HTML or Print / Save PDF to preserve a full file copy.</p></body></html>`,
  };
};

export const writeLocalJackieReportLibrary = (records: SavedJackieReport[]) => {
  const trimmed = records.slice(0, 80).map(normalizeSavedRecord).map(compactRecordForStorage);
  try {
    localStorage.setItem(JACKIE_REPORT_LIBRARY_KEY, JSON.stringify(trimmed));
    return trimmed;
  } catch {
    const tighter = records.slice(0, 20).map(compactRecordForStorage);
    try {
      localStorage.setItem(JACKIE_REPORT_LIBRARY_KEY, JSON.stringify(tighter));
      return tighter;
    } catch {
      try {
        sessionStorage.setItem(JACKIE_REPORT_LIBRARY_KEY, JSON.stringify(tighter));
        return tighter;
      } catch {
        const metadataOnly = records.slice(0, 20).map(record => ({
          ...record,
          html: `<html><body><h1>${record.packageLabel}</h1><p>${record.address}</p><p>This report reference was saved, but browser storage was too full to retain the full HTML package. Re-run the report and download the report to preserve a file copy.</p></body></html>`,
          dataSnapshot: undefined,
        }));
        try {
          localStorage.setItem(JACKIE_REPORT_LIBRARY_KEY, JSON.stringify(metadataOnly));
        } catch {
          // Keep the in-memory list available to the caller even when browser storage is full.
        }
        return metadataOnly;
      }
    }
  }
};

/**
 * Track every generated report in Supabase (scout_reports) so the team can
 * see what was generated for which building, when, and for whom — across
 * devices, forever. Fire-and-forget: browser-archive saving never blocks
 * on the network, and failures degrade to local-only storage silently.
 */
const trackReportInDatabase = (record: SavedJackieReport) => {
  try {
    if (!isSupabaseConfigured()) return;
    void supabase.from('scout_reports').insert({
      building_address: record.address,
      building_bbl: (record.dataSnapshot as any)?.bbl || null,
      generated_by: 'Camelot OS — Engagement Reports',
      report_data: {
        report_number: record.reportNumber,
        package_type: record.packageType,
        package_label: record.packageLabel,
        building_name: record.buildingName,
        borough: record.borough || null,
        filename: record.filename,
        inquiry_contact: record.inquiryContact || null,
        inquiry_email: record.inquiryEmail || null,
        focus: record.focus,
        generated_at: record.generatedAt,
      },
    }).then(({ error }) => {
      if (error) console.warn('Report DB tracking skipped:', error.message);
    });
  } catch (err) {
    console.warn('Report DB tracking skipped:', err);
  }
};

export const saveJackieReportRecord = (record: SavedJackieReport) => {
  trackReportInDatabase(record);
  return writeLocalJackieReportLibrary([record, ...loadLocalJackieReportLibrary()]);
};

export const removeJackieReportRecord = (id: string) => (
  writeLocalJackieReportLibrary(loadLocalJackieReportLibrary().filter(record => record.id !== id))
);
