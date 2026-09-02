import { useState, useCallback, useEffect, useMemo, Fragment } from 'react';
import { cn, formatCurrency } from '@/lib/utils';
import {
  searchViolations, type ViolationSummary, type ViolationResult, type UpcomingHearing,
  RESOLUTION_GUIDE,
} from '@/lib/nyc-violations';
import { buildICS, downloadICS, googleCalendarLink, outlookCalendarLink, type CalEvent } from '@/lib/calendar-export';
import { DAVID_GOLDOFF_SIGNATURE_TEXT } from '@/lib/camelot-signature';
import { authenticatedApiFetch } from '@/lib/api-auth';
import { getRegionByArea } from '@/lib/regions';
import toast from 'react-hot-toast';
import {
  AlertTriangle, Shield, Search, Loader2, RefreshCw,
  AlertCircle, Clock, DollarSign, Users, Calendar, FileDown, Printer, Mail,
  Building2, MapPin, ChevronDown, ChevronUp, ExternalLink, CalendarPlus, Share2,
  Gavel, Wrench, X,
} from 'lucide-react';

const BOROUGHS = ['MANHATTAN', 'BROOKLYN', 'BRONX', 'QUEENS', 'STATEN ISLAND'];

function SeverityBadge({ level, label }: { level: number; label?: string }) {
  const config: Record<number, { bg: string; text: string }> = {
    3: { bg: 'bg-red-500/20 border-red-500/30', text: 'text-red-400' },
    2: { bg: 'bg-orange-500/20 border-orange-500/30', text: 'text-orange-400' },
    1: { bg: 'bg-yellow-500/20 border-yellow-500/30', text: 'text-yellow-400' },
    0: { bg: 'bg-gray-500/20 border-gray-500/30', text: 'text-gray-400' },
  };
  const c = config[level] || config[0];
  return <span className={cn('px-2 py-0.5 rounded text-xs font-medium border', c.bg, c.text)}>{label || `Level ${level}`}</span>;
}

function StatCard({ icon: Icon, label, value, sub, color = 'gold' }: {
  icon: any; label: string; value: string | number; sub?: string; color?: string;
}) {
  const borders: Record<string, string> = {
    gold: 'border-camelot-gold/30', red: 'border-red-500/30',
    orange: 'border-orange-500/30', green: 'border-green-500/30', blue: 'border-blue-500/30',
  };
  return (
    <div className={cn('bg-camelot-navy-light rounded-lg p-4 border', borders[color] || borders.gold)}>
      <div className="flex items-center gap-2 text-gray-400 text-xs mb-1"><Icon size={14} /><span>{label}</span></div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

/** Real MDS-synced managed building, as returned by GET /api/portfolio (portfolio_overview). */
interface PortfolioBuildingLite {
  id: number;
  building_name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
}

const NYC_BOROUGHS = new Set(['MANHATTAN', 'BROOKLYN', 'QUEENS', 'BRONX', 'STATEN ISLAND']);

/** Spire's `city` field is a USPS mailing city, not always the borough (Queens especially
 *  uses neighborhood names like "Astoria" or "Flushing"). Resolve it to one of the five
 *  NYC boroughs the violations search expects. */
function cityToBorough(city: string | null | undefined): string {
  const c = (city || '').trim().toUpperCase();
  if (!c) return 'MANHATTAN';
  if (c === 'NEW YORK' || c === 'NEW YORK CITY' || c === 'NYC') return 'MANHATTAN';
  if (NYC_BOROUGHS.has(c)) return c;
  const region = getRegionByArea(city!.trim());
  if (region && NYC_BOROUGHS.has(region.name.toUpperCase())) return region.name.toUpperCase();
  return 'MANHATTAN';
}

/** Plain-English one-paragraph summary of a single violation for the expanded detail view. */
function summarizeViolation(v: ViolationResult): string {
  const parts: string[] = [];
  const sev = v.source === 'HPD' ? `HPD Class ${v.violationClass} (${v.severityLabel})` : `${v.source} ${v.severityLabel}`;
  parts.push(`${sev} violation${v.unit && v.unit !== 'Building' ? ` in unit ${v.unit}` : ' at the building'}${v.isOpen ? ', currently OPEN' : ', now CLOSED'}.`);
  if (v.inspectionDate) parts.push(`Issued ${v.inspectionDate}.`);
  if (v.cureDeadline) {
    parts.push(v.isOverdue
      ? `Correction was due ${v.cureDeadline} and is now overdue.`
      : `Correction is due by ${v.cureDeadline}.`);
  }
  if (v.hearingDate) {
    parts.push(`An ECB/OATH hearing is scheduled for ${v.hearingDate}${v.hearingTime ? ` at ${v.hearingTime}` : ''}${v.hearingStatus ? ` (status: ${v.hearingStatus})` : ''}.`);
  }
  if (v.penaltyImposed != null && v.penaltyImposed > 0) {
    parts.push(`Penalty imposed: ${formatCurrency(v.penaltyImposed)}${v.amountPaid ? `, paid: ${formatCurrency(v.amountPaid)}` : ''}${v.balanceDue ? `, balance due: ${formatCurrency(v.balanceDue)}` : ''}.`);
  } else if (v.isOverdue && (v.penaltyAccruedLow || v.penaltyAccruedHigh)) {
    parts.push(`Estimated civil penalty accrued to date: ${formatCurrency(v.penaltyAccruedLow || 0)}\u2013${formatCurrency(v.penaltyAccruedHigh || 0)}, accruing roughly ${formatCurrency(v.penaltyDailyLow || 0)}\u2013${formatCurrency(v.penaltyDailyHigh || 0)} per day until corrected.`);
  } else if (v.penaltyDailyLow || v.penaltyDailyHigh) {
    parts.push(`If not corrected by the deadline, this class carries a civil penalty of roughly ${formatCurrency(v.penaltyDailyLow || 0)}\u2013${formatCurrency(v.penaltyDailyHigh || 0)} per day.`);
  }
  parts.push(`Estimated resolution cost: ${formatCurrency(v.costLow)}\u2013${formatCurrency(v.costHigh)}.`);
  if (v.players?.length) parts.push(`Typically requires: ${v.players.join(', ')}.`);
  return parts.join(' ');
}

function ViolationDetailPanel({ v }: { v: ViolationResult }) {
  const guide = RESOLUTION_GUIDE[v.resolutionKey] || RESOLUTION_GUIDE.DEFAULT;
  return (
    <tr className="bg-white/[0.03] border-b border-white/10">
      <td colSpan={9} className="px-4 py-4">
        <div className="grid md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-3">
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Summary</div>
              <p className="text-sm text-gray-200 leading-relaxed">{summarizeViolation(v)}</p>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Full Description</div>
              <p className="text-sm text-gray-300">{v.description || '\u2014'}</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div><div className="text-gray-500">Violation ID</div><div className="text-gray-200">{v.violationId || '\u2014'}</div></div>
              <div><div className="text-gray-500">Source / Class</div><div className="text-gray-200">{v.source} {v.violationClass}</div></div>
              <div><div className="text-gray-500">Unit</div><div className="text-gray-200">{v.unit || 'Building'}</div></div>
              <div><div className="text-gray-500">Inspection / Issue Date</div><div className="text-gray-200">{v.inspectionDate || '\u2014'}</div></div>
              <div><div className="text-gray-500">Status</div><div className={cn(v.isOpen ? 'text-red-400' : 'text-green-400')}>{v.status}</div></div>
              {v.cureDeadline && (
                <div><div className="text-gray-500">Cure Deadline</div><div className={cn(v.isOverdue ? 'text-red-400 font-semibold' : 'text-gray-200')}>{v.cureDeadline}{v.isOverdue ? ' (overdue)' : ''}</div></div>
              )}
              {v.hearingDate && (
                <div><div className="text-gray-500">Hearing</div><div className="text-purple-300">{v.hearingDate}{v.hearingTime ? ` @ ${v.hearingTime}` : ''}</div></div>
              )}
              {(v.penaltyImposed != null && v.penaltyImposed > 0) && (
                <>
                  <div><div className="text-gray-500">Penalty Imposed</div><div className="text-gray-200">{formatCurrency(v.penaltyImposed)}</div></div>
                  <div><div className="text-gray-500">Balance Due</div><div className="text-red-400">{formatCurrency(v.balanceDue || 0)}</div></div>
                </>
              )}
              <div><div className="text-gray-500">Est. Resolution Cost</div><div className="text-camelot-gold">{formatCurrency(v.costLow)} \u2013 {formatCurrency(v.costHigh)}</div></div>
            </div>
          </div>
          <div className="bg-camelot-navy rounded-lg p-3 border border-white/10">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">{guide.label} \u2014 How to Resolve</div>
            <ul className="space-y-1 mb-3">
              {guide.steps.map((s, i) => (
                <li key={i} className="text-xs text-gray-300 flex gap-1.5"><span className="text-camelot-gold">{i + 1}.</span>{s}</li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-1.5">
              {guide.companies.map(c => (
                <span key={c} className="px-2 py-0.5 bg-white/5 border border-white/10 rounded-full text-[11px] text-gray-300">{c}</span>
              ))}
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}

/** Unified time-sensitive item shared by ECB hearings and HPD/DOB cure deadlines. */
interface DeadlineItem {
  id: string;
  kind: 'hearing' | 'deadline';
  source: string;
  violationId: string;
  description: string;
  dateISO: string;
  time?: string;
  status: string | null;
  balanceDue: number | null;
  urgent: boolean;
  isPast: boolean;
}

function buildDeadlineItems(result: ViolationSummary): DeadlineItem[] {
  const items: DeadlineItem[] = [];
  const todayISO = new Date().toISOString().split('T')[0];

  for (const h of result.upcomingHearings) {
    items.push({
      id: `hearing-${h.source}-${h.violationId}`,
      kind: 'hearing',
      source: h.source,
      violationId: h.violationId,
      description: h.description,
      dateISO: h.hearingDate,
      time: h.hearingTime || undefined,
      status: h.hearingStatus,
      balanceDue: h.balanceDue,
      urgent: true,
      isPast: h.isPast,
    });
  }

  for (const v of result.violations) {
    if (v.isOpen && v.cureDeadline) {
      items.push({
        id: `deadline-${v.source}-${v.violationId}`,
        kind: 'deadline',
        source: v.source,
        violationId: v.violationId,
        description: v.description,
        dateISO: v.cureDeadline,
        status: v.isOverdue ? 'OVERDUE' : 'UPCOMING',
        balanceDue: null,
        urgent: v.violationClass === 'C',
        isPast: v.cureDeadline < todayISO,
      });
    }
  }

  return items.sort((a, b) => a.dateISO.localeCompare(b.dateISO));
}

function deadlineToCalEvent(item: DeadlineItem, address: string, borough: string): CalEvent {
  const label = item.kind === 'hearing' ? 'ECB/OATH Hearing' : `${item.source} Correction Deadline`;
  return {
    id: item.id,
    title: `${label}: ${address}`,
    description: `${item.description || 'Violation'} \u2014 ${item.source} #${item.violationId}${item.status ? ` \u2014 Status: ${item.status}` : ''}${item.balanceDue ? ` \u2014 Balance due: ${formatCurrency(item.balanceDue)}` : ''}\n\nPrepared by Camelot Property Management Services Corp.`,
    location: `${address}, ${borough}`,
    dateISO: item.dateISO,
    time: item.time,
    durationMinutes: item.kind === 'hearing' ? 60 : undefined,
    urgent: item.urgent,
  };
}

function DeadlineRow({ item, address, borough, guestEmails }: { item: DeadlineItem; address: string; borough: string; guestEmails: string[] }) {
  const ev = deadlineToCalEvent(item, address, borough);
  const isHearing = item.kind === 'hearing';
  return (
    <tr className={cn('border-b border-white/5', item.isPast ? 'bg-red-500/5' : '')}>
      <td className="px-4 py-2">
        <span className={cn('px-2 py-0.5 rounded text-xs font-medium inline-flex items-center gap-1',
          isHearing ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400')}>
          {isHearing ? <Gavel size={11} /> : <Clock size={11} />}
          {isHearing ? 'HEARING' : 'DEADLINE'}
        </span>
      </td>
      <td className="px-4 py-2 text-xs text-gray-300">{item.source} #{item.violationId || '\u2014'}</td>
      <td className="px-4 py-2 text-xs text-gray-300 max-w-xs truncate">{item.description?.substring(0, 90)}</td>
      <td className="px-4 py-2 text-xs">
        <span className={cn('font-medium', item.isPast ? 'text-red-400' : 'text-white')}>
          {item.dateISO}{item.time ? ` @ ${item.time}` : ''} {item.isPast && '\u26A0\uFE0F'}
        </span>
      </td>
      <td className="px-4 py-2 text-xs text-gray-400">{item.status || '\u2014'}</td>
      <td className="px-4 py-2 text-xs text-gray-300">{item.balanceDue ? formatCurrency(item.balanceDue) : '\u2014'}</td>
      <td className="px-4 py-2">
        <div className="flex items-center gap-1.5">
          <a
            href={googleCalendarLink(ev, guestEmails)}
            target="_blank" rel="noreferrer"
            title="Add to Google Calendar (shares with guests below, if any)"
            className="p-1.5 rounded bg-camelot-gold/10 text-camelot-gold hover:bg-camelot-gold/20"
          >
            <CalendarPlus size={13} />
          </a>
          <button
            onClick={() => downloadICS(`${item.source}-${item.violationId || 'violation'}`, [ev])}
            title="Download .ics (Outlook / Apple Calendar)"
            className="p-1.5 rounded bg-white/5 text-gray-300 hover:bg-white/10"
          >
            <FileDown size={13} />
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function Violations() {
  const [buildings, setBuildings] = useState<PortfolioBuildingLite[]>([]);
  const [buildingsError, setBuildingsError] = useState<string | null>(null);
  const [selectedBuildingId, setSelectedBuildingId] = useState('');
  const [address, setAddress] = useState('');
  const [borough, setBorough] = useState('BROOKLYN');
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<ViolationSummary | null>(null);
  const [filterSource, setFilterSource] = useState('all');
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [filterOpen, setFilterOpen] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [guestEmailsInput, setGuestEmailsInput] = useState('');
  const [showSharePanel, setShowSharePanel] = useState(false);

  useEffect(() => {
    // Pull the real, Spire MDS-synced managed portfolio (not the Scout prospecting list) —
    // see src/pages/Portfolio.tsx for the canonical source of this data.
    (async () => {
      try {
        const res = await authenticatedApiFetch('/api/portfolio');
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.message || body?.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        setBuildings(data?.buildings || []);
        setBuildingsError(null);
      } catch (err: any) {
        setBuildings([]);
        setBuildingsError(err?.message || 'Could not load the managed portfolio');
      }
    })();
  }, []);

  const guestEmails = useMemo(
    () => guestEmailsInput.split(',').map(e => e.trim()).filter(Boolean),
    [guestEmailsInput]
  );

  const sortedBuildings = useMemo(
    () => [...buildings].sort((a, b) => (a.building_name || a.address || '').localeCompare(b.building_name || b.address || '')),
    [buildings]
  );

  const handleSearch = useCallback(async (overrideAddress?: string, overrideBorough?: string) => {
    const addr = overrideAddress ?? address;
    const boro = overrideBorough ?? borough;
    if (!addr.trim()) { toast.error('Enter an address'); return; }
    setIsSearching(true);
    setResult(null);
    try {
      const data = await searchViolations(addr.trim(), boro);
      setResult(data);
      toast.success(`Found ${data.totalFound} violations (${data.totalOpen} open)`);
    } catch (err: any) {
      toast.error('Search failed: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSearching(false);
    }
  }, [address, borough]);

  const handleSelectBuilding = useCallback((id: string) => {
    setSelectedBuildingId(id);
    if (!id) return;
    const b = buildings.find(bb => String(bb.id) === id);
    if (!b || !b.address) return;
    const boro = cityToBorough(b.city);
    setAddress(b.address);
    setBorough(boro);
    handleSearch(b.address, boro);
  }, [buildings, handleSearch]);

  const filteredViolations = (result?.violations || []).filter(v => {
    if (filterOpen && !v.isOpen) return false;
    if (filterSource !== 'all' && v.source !== filterSource) return false;
    if (filterSeverity !== 'all' && String(v.severityLevel) !== filterSeverity) return false;
    if (searchText && !v.description?.toLowerCase().includes(searchText.toLowerCase()) && !v.violationId?.toLowerCase().includes(searchText.toLowerCase())) return false;
    return true;
  });

  const deadlineItems = useMemo(() => (result ? buildDeadlineItems(result) : []), [result]);

  const resolutionGroups = useMemo(() => {
    if (!result) return [];
    const open = result.violations.filter(v => v.isOpen);
    const groups = new Map<string, { key: string; label: string; count: number; costLow: number; costHigh: number; steps: string[]; companies: string[] }>();
    for (const v of open) {
      const guide = RESOLUTION_GUIDE[v.resolutionKey] || RESOLUTION_GUIDE.DEFAULT;
      const existing = groups.get(v.resolutionKey);
      if (existing) {
        existing.count += 1;
        existing.costLow += v.costLow;
        existing.costHigh += v.costHigh;
      } else {
        groups.set(v.resolutionKey, {
          key: v.resolutionKey, label: guide.label, count: 1,
          costLow: v.costLow, costHigh: v.costHigh,
          steps: guide.steps, companies: guide.companies,
        });
      }
    }
    return Array.from(groups.values()).sort((a, b) => b.costHigh - a.costHigh);
  }, [result]);

  const addAllToCalendar = () => {
    if (!result || deadlineItems.length === 0) { toast.error('No hearings or deadlines to add'); return; }
    const events = deadlineItems.map(d => deadlineToCalEvent(d, result.address, result.borough));
    downloadICS(`${result.address.replace(/\s+/g, '-')}-compliance-calendar`, events, `Camelot OS \u2014 ${result.address} Compliance Calendar`);
    toast.success(`${events.length} hearing/deadline(s) downloaded \u2014 import into Google, Outlook, or Apple Calendar`);
  };

  const shareCalendarByEmail = () => {
    if (!result || deadlineItems.length === 0) { toast.error('No hearings or deadlines to share'); return; }
    if (guestEmails.length === 0) { toast.error('Enter at least one email to share with'); return; }
    const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const subject = encodeURIComponent(`Compliance Calendar \u2014 ${result.address}, ${result.borough}`);
    const nl = '\n';
    const lines = deadlineItems.map(d =>
      `  \u2022 ${d.dateISO}${d.time ? ' @ ' + d.time : ''} \u2014 ${d.kind === 'hearing' ? 'ECB/OATH HEARING' : d.source + ' correction deadline'} \u2014 ${d.source} #${d.violationId || 'N/A'}${d.isPast ? ' \u26A0\uFE0F PAST DUE' : ''}`
    );
    const body = encodeURIComponent(
      `Hi,${nl}${nl}Sharing the compliance calendar for ${result.address}, ${result.borough} \u2014 these dates are time-sensitive, please add them to your calendar.${nl}${nl}UPCOMING HEARINGS & DEADLINES${nl}${'\u2501'.repeat(30)}${nl}${lines.join(nl)}${nl}${nl}A .ics file with all of these dates (plus automatic reminders) is attached \u2014 open it to add every date to your calendar in one step, or use the individual "Add to Google Calendar" buttons in Camelot OS.${nl}${nl}Best,${nl}${nl}${DAVID_GOLDOFF_SIGNATURE_TEXT}`
    );
    // Download the ics for manual attachment (mirrors the app's existing PDF-attach pattern) then open Gmail.
    const events = deadlineItems.map(d => deadlineToCalEvent(d, result.address, result.borough));
    downloadICS(`${result.address.replace(/\s+/g, '-')}-compliance-calendar`, events, `Camelot OS \u2014 ${result.address} Compliance Calendar`);
    window.open(`https://mail.google.com/mail/?view=cm&su=${subject}&body=${body}`, '_blank');
    toast.success('Calendar file downloaded and Gmail opened \u2014 attach the .ics file before sending');
  };

  const generatePDF = () => {
    if (!result) return;
    const openV = filteredViolations.filter(v => v.isOpen);
    const reportDate = new Date().toISOString().split('T')[0];
    const cleanAddr = result.address.replace(/\s+/g, '-');
    const pdfTitle = `${cleanAddr}_CamelotOS_ViolationReport_${reportDate}`;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${pdfTitle}</title><style>`
      + '@page{margin:.75in;size:letter} @media print{.no-print{display:none!important}}'
      + 'body{font-family:Arial,sans-serif;font-size:10px;color:#222;line-height:1.4;max-width:100%;overflow:hidden}'
      + '.hdr{background:linear-gradient(135deg,#1a1a2e,#16213e);color:#fff;padding:20px;margin:0 0 16px 0;border-radius:4px}'
      + '.hdr h1{margin:0;font-size:22px;color:#c5a253;letter-spacing:1px}'
      + '.hdr h2{margin:4px 0 0;font-size:13px;font-weight:400;color:#ccc}'
      + '.hdr .meta{margin-top:10px;font-size:10px;color:#aaa}'
      + 'h2{color:#1a1a2e;border-bottom:2px solid #c5a253;padding-bottom:4px;margin-top:20px;font-size:14px}'
      + 'h3{color:#1a1a2e;margin-top:14px;margin-bottom:4px;font-size:11px}'
      + '.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:10px 0}'
      + '.box{background:#f8f6f0;border-left:3px solid #c5a253;padding:6px 8px}'
      + '.box .l{font-size:8px;color:#666;text-transform:uppercase}.box .v{font-size:14px;font-weight:700;color:#1a1a2e}'
      + '.red{border-left-color:#dc3545}.org{border-left-color:#fd7e14}'
      + 'table{width:100%;border-collapse:collapse;margin:8px 0;font-size:8px;table-layout:fixed;word-wrap:break-word}'
      + 'th{background:#1a1a2e;color:#fff;padding:4px 6px;text-align:left;font-weight:600}'
      + 'td{padding:3px 6px;border-bottom:1px solid #eee;vertical-align:top}'
      + 'tr:nth-child(even) td{background:#fafafa}'
      + '.badge{display:inline-block;padding:1px 5px;border-radius:3px;font-size:8px;font-weight:700;color:#fff}'
      + '.bc{background:#dc3545}.bb{background:#fd7e14}.ba{background:#ffc107;color:#222}.bd{background:#0d6efd}.be{background:#6c757d}'
      + '.overdue{color:#dc3545;font-weight:700}'
      + '.players{margin:10px 0;columns:3;font-size:10px}'
      + '.resgroup{margin:10px 0;padding:8px 10px;background:#f8f6f0;border-left:3px solid #1a1a2e}'
      + '.resgroup h4{margin:0 0 4px;font-size:10px;color:#1a1a2e}'
      + '.resgroup ul{margin:4px 0;padding-left:16px;font-size:9px}'
      + '.footer{margin-top:20px;padding-top:10px;border-top:2px solid #c5a253;font-size:8px;color:#888}'
      + '.footer .co{color:#c5a253;font-weight:700}'
      + '</style></head><body>'
      + '<div class="hdr">'
      + '<div style="font-size:10px;color:#c5a253;font-weight:700;letter-spacing:2px">CAMELOT PROPERTY MANAGEMENT SERVICES CORP.</div>'
      + '<h1>VIOLATION &amp; RESOLUTION REPORT</h1>'
      + `<h2>${result.address} \u2014 ${result.borough}</h2>`
      + `<div class="meta">Report Date: ${new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})}</div>`
      + '</div>'
      + '<div style="display:flex;gap:8px;margin:12px 0;justify-content:flex-end" class="no-print">'
      + '<button onclick="window.print()" style="padding:8px 20px;background:#c5a253;color:#1a1a2e;border:none;border-radius:4px;font-weight:700;cursor:pointer;font-size:12px">\u{1F5A8} Print</button>'
      + '<button onclick="window.print()" style="padding:8px 20px;background:#1a1a2e;color:#fff;border:1px solid #c5a253;border-radius:4px;font-weight:700;cursor:pointer;font-size:12px">\u{1F4BE} Save as PDF</button>'
      + '</div>'
      + '<h2>EXECUTIVE SUMMARY</h2>'
      + '<div class="grid">'
      + `<div class="box red"><div class="l">Open Violations</div><div class="v">${result.totalOpen}</div></div>`
      + `<div class="box red"><div class="l">Class C (Critical)</div><div class="v">${result.hpdClassC}</div></div>`
      + `<div class="box org"><div class="l">Overdue</div><div class="v">${result.overdue}</div></div>`
      + `<div class="box"><div class="l">Est. Cost</div><div class="v">$${result.costLow.toLocaleString()} - $${result.costHigh.toLocaleString()}</div></div>`
      + '</div>'
      + '<div class="grid">'
      + `<div class="box"><div class="l">HPD Open</div><div class="v">${result.hpdOpen}</div></div>`
      + `<div class="box"><div class="l">DOB Open</div><div class="v">${result.dobOpen}</div></div>`
      + `<div class="box"><div class="l">ECB Open</div><div class="v">${result.ecbOpen}</div></div>`
      + `<div class="box"><div class="l">Total Found</div><div class="v">${result.totalFound}</div></div>`
      + '</div>'
      + '<div class="grid">'
      + `<div class="box red"><div class="l">ECB Penalties Assessed</div><div class="v">$${result.totalPenaltiesAssessed.toLocaleString()}</div></div>`
      + `<div class="box red"><div class="l">ECB Balance Due</div><div class="v">$${result.totalBalanceDue.toLocaleString()}</div></div>`
      + `<div class="box org"><div class="l">Est. HPD Civil Penalty Accrued</div><div class="v">$${result.totalHPDAccruedLow.toLocaleString()}-$${result.totalHPDAccruedHigh.toLocaleString()}</div></div>`
      + `<div class="box"><div class="l">Hearings Scheduled</div><div class="v">${result.upcomingHearings.length}</div></div>`
      + '</div>'
      + '<h2>PLAYERS &amp; PROFESSIONALS NEEDED</h2>'
      + `<div class="players">${result.players.map(p => '<div>\u2022 ' + p + '</div>').join('')}</div>`
      + (deadlineItems.length > 0
        ? '<h2>UPCOMING HEARINGS &amp; DEADLINES</h2>'
          + '<table><tr><th>Type</th><th>Source</th><th>Description</th><th>Date</th><th>Status</th><th>Balance Due</th></tr>'
          + deadlineItems.map(d =>
            `<tr><td>${d.kind === 'hearing' ? 'ECB/OATH HEARING' : 'CORRECTION DEADLINE'}</td>`
            + `<td>${d.source} #${d.violationId || '\u2014'}</td>`
            + `<td>${(d.description || '').substring(0, 80)}</td>`
            + `<td class="${d.isPast ? 'overdue' : ''}">${d.dateISO}${d.time ? ' @ ' + d.time : ''}${d.isPast ? ' OVERDUE' : ''}</td>`
            + `<td>${d.status || '\u2014'}</td>`
            + `<td>${d.balanceDue ? '$' + d.balanceDue.toLocaleString() : '\u2014'}</td></tr>`
          ).join('')
          + '</table>'
          + '<div style="font-size:8px;color:#888;margin:4px 0">Add these dates to your calendar (with automatic reminders) from the live Camelot OS Violation &amp; Resolution Center \u2014 look for the calendar icon next to each hearing/deadline.</div>'
        : '')
      + (resolutionGroups.length > 0
        ? '<h2>HOW TO RESOLVE &amp; REMEDY</h2>'
          + resolutionGroups.map(g =>
            '<div class="resgroup">'
            + `<h4>${g.label} \u2014 ${g.count} violation${g.count > 1 ? 's' : ''} \u2014 Est. $${g.costLow.toLocaleString()}-$${g.costHigh.toLocaleString()}</h4>`
            + `<ul>${g.steps.map(s => `<li>${s}</li>`).join('')}</ul>`
            + `<div style="font-size:9px;color:#555"><strong>Third parties needed:</strong> ${g.companies.join(', ')}</div>`
            + '</div>'
          ).join('')
        : '')
      + `<h2>OPEN VIOLATIONS (${openV.length})</h2>`
      + '<table><tr><th>#</th><th>Source</th><th>Class</th><th>Unit</th><th>Description</th><th>Deadline</th><th>Est. Cost</th><th>Players</th></tr>'
      + openV.slice(0,150).map((v: any, i: number) =>
        `<tr><td>${i+1}</td>`
        + `<td><span class="badge ${v.source==='HPD'?(v.violationClass==='C'?'bc':v.violationClass==='B'?'bb':'ba'):v.source==='DOB'?'bd':'be'}">${v.source}</span></td>`
        + `<td>${v.violationClass}</td><td>${v.unit||'Bldg'}</td>`
        + `<td>${(v.description||'').substring(0,100)}</td>`
        + `<td>${v.cureDeadline?(v.cureDeadline+(v.isOverdue?' <span class="overdue">OVERDUE</span>':'')):'-'}</td>`
        + `<td>$${v.costLow.toLocaleString()}-$${v.costHigh.toLocaleString()}</td>`
        + `<td>${v.players.join(', ')}</td></tr>`
      ).join('')
      + '</table>'
      + (openV.length>150?`<p style="color:#888;text-align:center">Showing 150 of ${openV.length}</p>`:'')
      + '<div class="footer">'
      + '<div class="co">CAMELOT PROPERTY MANAGEMENT SERVICES CORP.</div>'
      + '57 West 57th Street, Suite 410 | New York, NY 10019 | (212) 206-9939 | www.camelot.nyc<br>'
      + 'Generated from NYC Open Data (HPD, DOB, ECB). Verify details with issuing agency.<br>'
      + `Report generated: ${new Date().toISOString().substring(0,19)} UTC`
      + '</div></body></html>';
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
    toast.success('Report opened \u2014 use Print to save as PDF, email, or print');
  };

  const emailReport = () => {
    if (!result) return;
    const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const subject = encodeURIComponent(`Violation & Resolution Report: ${result.address}, ${result.borough}`);
    const nl = '%0A';
    const hearingLines = result.upcomingHearings.length > 0
      ? `\n\nUPCOMING HEARINGS\n${'\u2501'.repeat(30)}\n` + result.upcomingHearings.map(h =>
          `  \u2022 ${h.hearingDate}${h.hearingTime ? ' @ ' + h.hearingTime : ''} \u2014 ${h.source} #${h.violationId}${h.isPast ? ' (PAST \u2014 confirm status)' : ''}`
        ).join('\n')
      : '';
    const body = encodeURIComponent(
      `Dear ___,`
      + `\n\nPlease find attached the Violation & Resolution Report for ${result.address}, ${result.borough}, prepared by Camelot Property Management Services Corp.`
      + `\n\nREPORT SUMMARY\n${'\u2501'.repeat(30)}`
      + `\nProperty: ${result.address}, ${result.borough}`
      + `\nReport Date: ${date}`
      + `\nTotal Violations Found: ${result.totalFound}`
      + `\nOpen Violations: ${result.totalOpen}`
      + `\n  \u2022 HPD Class C (Immediately Hazardous): ${result.hpdClassC}`
      + `\n  \u2022 HPD Class B (Hazardous): ${result.hpdClassB}`
      + `\n  \u2022 HPD Class A (Non-Hazardous): ${result.hpdClassA}`
      + `\n  \u2022 DOB Violations: ${result.dobOpen}`
      + `\n  \u2022 ECB Violations: ${result.ecbOpen}`
      + `\nOverdue (Past Cure Deadline): ${result.overdue}`
      + `\nECB Penalties Assessed: $${result.totalPenaltiesAssessed.toLocaleString()}`
      + `\nECB Balance Due: $${result.totalBalanceDue.toLocaleString()}`
      + `\nEstimated Resolution Cost: $${result.costLow.toLocaleString()} \u2013 $${result.costHigh.toLocaleString()}`
      + hearingLines
      + `\n\nWHAT THIS REPORT CONTAINS\n${'\u2501'.repeat(30)}`
      + `\nThis report provides a comprehensive analysis of all open violations issued by NYC agencies (HPD, DOB, ECB) for the above property. Each violation is classified by severity, with cure deadlines, scheduled hearings, estimated resolution costs, and the specific professionals required to resolve each item.`
      + `\n\nRECOMMENDATIONS\n${'\u2501'.repeat(30)}`
      + (result.hpdClassC > 0 ? `\n\u26A0\uFE0F IMMEDIATE ACTION REQUIRED: There are ${result.hpdClassC} Class C (Immediately Hazardous) violations that must be addressed within 24 hours of issuance. These may include lead paint hazards, gas leaks, heat/hot water failures, or fire safety issues.` : '')
      + (result.overdue > 0 ? `\n\n\u26A0\uFE0F OVERDUE VIOLATIONS: ${result.overdue} violations are past their cure deadline. We recommend prioritizing these to avoid compounding fines and ECB hearings.` : '')
      + (result.upcomingHearings.length > 0 ? `\n\n\u26A0\uFE0F TIME-SENSITIVE: ${result.upcomingHearings.length} ECB/OATH hearing(s) are on the calendar \u2014 missing a hearing results in an automatic default judgment. Add these to your calendar from the Violation & Resolution Center (calendar icon next to each hearing) and share with counsel/PM.` : '')
      + `\n\nWe recommend a phased approach to resolution:`
      + `\n  Phase 1 (Weeks 1-2): Address all Class C and overdue violations immediately`
      + `\n  Phase 2 (Weeks 3-8): Resolve Class B violations and DOB/ECB matters`
      + `\n  Phase 3 (Weeks 9+): Clear remaining Class A violations through scheduled maintenance`
      + `\n\nPROFESSIONALS NEEDED\n${'\u2501'.repeat(30)}`
      + `\n` + result.players.map(p => `  \u2022 ${p}`).join('\n')
      + `\n\nPlease review the attached PDF for the complete violation-by-violation breakdown, including specific descriptions, unit locations, cure deadlines, hearing dates, cost estimates, and resolution steps.`
      + `\n\nWe are available to discuss a resolution strategy at your convenience.`
      + `\n\nBest regards,`
      + `\n\n${DAVID_GOLDOFF_SIGNATURE_TEXT}`
    );
    window.open(`https://mail.google.com/mail/?view=cm&su=${subject}&body=${body}`, '_blank');
    toast.success('Gmail opened \u2014 attach the downloaded PDF report');
  };

  const exportCSV = () => {
    if (!result) return;
    const rows = [['Source', 'Class', 'Unit', 'Description', 'Status', 'Overdue', 'Deadline', 'Hearing Date', 'Balance Due', 'Cost Low', 'Cost High', 'Players']];
    for (const v of filteredViolations) {
      rows.push([v.source, v.violationClass, v.unit, `"${(v.description || '').replace(/"/g, '""').substring(0, 200)}"`, v.status, v.isOverdue ? 'YES' : '', v.cureDeadline || '', v.hearingDate || '', v.balanceDue != null ? String(v.balanceDue) : '', String(v.costLow), String(v.costHigh), `"${v.players.join(', ')}"`]);
    }
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `violations-${result.address.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Shield className="text-camelot-gold" size={28} />
          Violation & Resolution Center
        </h1>
        <p className="text-slate-600 text-sm mt-1">
          Pick a building from the portfolio or search any NYC property to pull violations, hearings, penalties, and generate a resolution report
        </p>
      </div>

      {/* Search Box */}
      <div className="bg-camelot-navy-light rounded-xl p-6 border border-white/10 space-y-4">
        <div>
          <label className="text-gray-400 text-xs mb-1 block">Portfolio Building</label>
          <div className="relative">
            <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              value={selectedBuildingId}
              onChange={e => handleSelectBuilding(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-camelot-navy border border-white/10 rounded-lg text-white outline-none text-lg appearance-none"
            >
              <option value="">{`Select a Camelot building\u2026 (${sortedBuildings.length} in portfolio)`}</option>
              {sortedBuildings.map(b => (
                <option key={b.id} value={String(b.id)}>
                  {b.building_name ? `${b.building_name} \u2014 ${b.address}` : b.address}{b.city ? `, ${b.city}` : ''}
                </option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          {buildingsError && (
            <p className="text-xs text-gray-500 mt-1.5">{`Couldn't load the managed portfolio automatically (${buildingsError}) \u2014 use the address field below instead.`}</p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-xs text-gray-500">OR add a one-off building</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="text-gray-400 text-xs mb-1 block">Property Address</label>
            <div className="relative">
              <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={address}
                onChange={e => { setAddress(e.target.value); setSelectedBuildingId(''); }}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="e.g. 533 Washington Avenue"
                className="w-full pl-10 pr-4 py-3 bg-camelot-navy border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-camelot-gold/50 outline-none text-lg"
              />
            </div>
          </div>
          <div className="w-full md:w-48">
            <label className="text-gray-400 text-xs mb-1 block">Borough</label>
            <select
              value={borough}
              onChange={e => { setBorough(e.target.value); setSelectedBuildingId(''); }}
              className="w-full px-4 py-3 bg-camelot-navy border border-white/10 rounded-lg text-white outline-none text-lg"
            >
              {BOROUGHS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => handleSearch()}
              disabled={isSearching}
              className="w-full md:w-auto px-8 py-3 bg-camelot-gold text-camelot-navy font-bold rounded-lg hover:bg-camelot-gold/90 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isSearching ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
              {isSearching ? 'Searching...' : 'Run Report'}
            </button>
          </div>
        </div>
        {isSearching && (
          <div className="mt-4 text-center text-gray-400 text-sm">
            <Loader2 size={20} className="animate-spin inline mr-2" />
            Pulling violations, penalties, and hearing dates from HPD, DOB, and ECB/OATH databases...
          </div>
        )}
      </div>

      {/* Results */}
      {result && (
        <>
          {/* Summary Header */}
          <div className="bg-camelot-navy-light rounded-xl p-4 border border-camelot-gold/20">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-white">{result.address}</h2>
                <p className="text-gray-400 text-sm">{result.borough} · Scanned {new Date().toLocaleDateString()}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={generatePDF} className="flex items-center gap-2 px-4 py-2 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 hover:bg-red-500/30 text-sm">
                  <Printer size={14} /> PDF / Print
                </button>
                <button onClick={emailReport} className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 border border-blue-500/30 rounded-lg text-blue-400 hover:bg-blue-500/30 text-sm">
                  <Mail size={14} /> Email Report
                </button>
                <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-gray-300 hover:bg-white/10 text-sm">
                  <FileDown size={14} /> CSV
                </button>
                <button onClick={() => handleSearch()} className="flex items-center gap-2 px-4 py-2 bg-camelot-gold/20 text-camelot-gold rounded-lg hover:bg-camelot-gold/30 text-sm">
                  <RefreshCw size={14} /> Re-scan
                </button>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
              <StatCard icon={AlertTriangle} label="Total Found" value={result.totalFound.toLocaleString()} color="gold" />
              <StatCard icon={AlertCircle} label="Open" value={result.totalOpen.toLocaleString()} color="red" />
              <StatCard icon={Shield} label="Class C" value={result.hpdClassC} sub="Critical" color="red" />
              <StatCard icon={Shield} label="Class B" value={result.hpdClassB} sub="Hazardous" color="orange" />
              <StatCard icon={Clock} label="Overdue" value={result.overdue} color="red" />
              <StatCard icon={Gavel} label="Hearings" value={result.upcomingHearings.length} sub="Scheduled" color="blue" />
              <StatCard icon={DollarSign} label="ECB Balance Due" value={formatCurrency(result.totalBalanceDue)} color="red" />
              <StatCard icon={DollarSign} label="Est. Resolution Cost" value={`${formatCurrency(result.costLow)}\u2013${formatCurrency(result.costHigh)}`} color="orange" />
            </div>
          </div>

          {/* Players Needed */}
          {result.players.length > 0 && (
            <div className="bg-camelot-navy-light rounded-lg p-4 border border-white/10">
              <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2"><Users size={14} /> Players Needed for Resolution</h3>
              <div className="flex flex-wrap gap-2">
                {result.players.map(p => (
                  <span key={p} className="px-3 py-1 bg-camelot-gold/10 border border-camelot-gold/20 rounded-full text-xs text-camelot-gold">{p}</span>
                ))}
              </div>
            </div>
          )}

          {/* Hearings & Deadlines */}
          {deadlineItems.length > 0 && (
            <div className="bg-camelot-navy-light rounded-lg border border-white/10 overflow-hidden">
              <div className="p-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Gavel size={14} className="text-camelot-gold" /> Upcoming Hearings & Deadlines
                  <span className="text-xs text-gray-500 font-normal">{'\u2014 time-sensitive, don\'t let these slip'}</span>
                </h3>
                <div className="flex items-center gap-2">
                  <button onClick={addAllToCalendar} className="flex items-center gap-2 px-3 py-1.5 bg-camelot-gold/20 text-camelot-gold rounded-lg hover:bg-camelot-gold/30 text-xs">
                    <CalendarPlus size={13} /> Add All to Calendar
                  </button>
                  <button onClick={() => setShowSharePanel(s => !s)} className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 border border-blue-500/30 rounded-lg text-blue-400 hover:bg-blue-500/30 text-xs">
                    <Share2 size={13} /> Share Calendar
                  </button>
                </div>
              </div>

              {showSharePanel && (
                <div className="px-4 py-3 bg-white/5 border-b border-white/10 flex flex-col md:flex-row gap-3 md:items-end">
                  <div className="flex-1">
                    <label className="text-gray-400 text-xs mb-1 block">{'Guest email(s), comma-separated \u2014 used for "Add to Google Calendar" invites and the emailed calendar'}</label>
                    <input
                      type="text"
                      value={guestEmailsInput}
                      onChange={e => setGuestEmailsInput(e.target.value)}
                      placeholder="pm@camelot.nyc, attorney@example.com"
                      className="w-full px-3 py-2 bg-camelot-navy border border-white/10 rounded text-sm text-white placeholder-gray-500 outline-none"
                    />
                  </div>
                  <button onClick={shareCalendarByEmail} className="flex items-center gap-2 px-4 py-2 bg-camelot-gold text-camelot-navy font-bold rounded-lg hover:bg-camelot-gold/90 text-sm whitespace-nowrap">
                    <Mail size={14} /> Email Calendar
                  </button>
                  <button onClick={() => setShowSharePanel(false)} className="p-2 text-gray-400 hover:text-white"><X size={16} /></button>
                </div>
              )}

              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5">
                    <th className="text-left px-4 py-2 text-gray-400 font-medium w-24">Type</th>
                    <th className="text-left px-4 py-2 text-gray-400 font-medium w-28">Violation</th>
                    <th className="text-left px-4 py-2 text-gray-400 font-medium">Description</th>
                    <th className="text-left px-4 py-2 text-gray-400 font-medium w-40">Date</th>
                    <th className="text-left px-4 py-2 text-gray-400 font-medium w-28">Status</th>
                    <th className="text-left px-4 py-2 text-gray-400 font-medium w-28">Balance Due</th>
                    <th className="text-left px-4 py-2 text-gray-400 font-medium w-20">Calendar</th>
                  </tr>
                </thead>
                <tbody>
                  {deadlineItems.map(item => (
                    <DeadlineRow key={item.id} item={item} address={result.address} borough={result.borough} guestEmails={guestEmails} />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* How to Resolve & Remedy */}
          {resolutionGroups.length > 0 && (
            <div className="bg-camelot-navy-light rounded-lg border border-white/10 p-4">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Wrench size={14} className="text-camelot-gold" /> How to Resolve & Remedy
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                {resolutionGroups.map(g => (
                  <div key={g.key} className="bg-camelot-navy rounded-lg p-4 border border-white/10">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-white font-semibold text-sm">{g.label}</h4>
                      <span className="text-xs text-gray-400">{g.count} violation{g.count > 1 ? 's' : ''}</span>
                    </div>
                    <div className="text-camelot-gold text-sm font-bold mb-2">{formatCurrency(g.costLow)} \u2013 {formatCurrency(g.costHigh)} est.</div>
                    <ul className="space-y-1 mb-3">
                      {g.steps.map((s, i) => (
                        <li key={i} className="text-xs text-gray-300 flex gap-2"><span className="text-camelot-gold">{i + 1}.</span>{s}</li>
                      ))}
                    </ul>
                    <div className="flex flex-wrap gap-1.5">
                      {g.companies.map(c => (
                        <span key={c} className="px-2 py-0.5 bg-white/5 border border-white/10 rounded-full text-[11px] text-gray-300">{c}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Filter violations..."
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-camelot-navy-light border border-white/10 rounded text-sm text-white placeholder-gray-500 focus:border-camelot-gold/50 outline-none"
              />
            </div>
            <select value={filterSource} onChange={e => setFilterSource(e.target.value)} className="px-3 py-2 bg-camelot-navy-light border border-white/10 rounded text-sm text-white outline-none">
              <option value="all">All Sources</option>
              <option value="HPD">HPD</option>
              <option value="DOB">DOB</option>
              <option value="ECB">ECB</option>
            </select>
            <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)} className="px-3 py-2 bg-camelot-navy-light border border-white/10 rounded text-sm text-white outline-none">
              <option value="all">All Severity</option>
              <option value="3">Class C (Critical)</option>
              <option value="2">Class B / DOB / ECB</option>
              <option value="1">Class A</option>
            </select>
            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input type="checkbox" checked={filterOpen} onChange={e => setFilterOpen(e.target.checked)} className="rounded" />
              Open only
            </label>
            <span className="text-gray-500 text-sm">{filteredViolations.length} violations</span>
          </div>

          {/* Violation Table */}
          <div className="bg-camelot-navy-light rounded-lg border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="text-left px-4 py-3 text-gray-400 font-medium w-6"></th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium w-16">Source</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium w-20">Class</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium w-20">Unit</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Description</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium w-24">Status</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium w-28">Deadline</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium w-32">Est. Cost</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium w-40">Players</th>
                </tr>
              </thead>
              <tbody>
                {filteredViolations.slice(0, 200).map((v, i) => {
                  const rowKey = `${v.source}-${v.violationId}-${i}`;
                  const isExpanded = expandedId === rowKey;
                  return (
                  <Fragment key={rowKey}>
                  <tr
                    className={cn(
                      'border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors',
                      v.isOverdue && v.isOpen && 'bg-red-500/5',
                      isExpanded && 'bg-camelot-gold/5'
                    )}
                    onClick={() => setExpandedId(isExpanded ? null : rowKey)}
                  >
                    <td className="px-4 py-2 text-gray-500">
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </td>
                    <td className="px-4 py-2">
                      <span className={cn('px-2 py-0.5 rounded text-xs font-medium',
                        v.source === 'HPD' ? 'bg-purple-500/20 text-purple-400' :
                        v.source === 'DOB' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-orange-500/20 text-orange-400'
                      )}>{v.source}</span>
                    </td>
                    <td className="px-4 py-2"><SeverityBadge level={v.severityLevel} label={v.violationClass} /></td>
                    <td className="px-4 py-2 text-gray-300 text-xs">{v.unit || 'Bldg'}</td>
                    <td className="px-4 py-2 text-gray-300 text-xs max-w-xs truncate">{v.description?.substring(0, 100)}</td>
                    <td className="px-4 py-2">
                      <span className={cn('text-xs font-medium', v.isOpen ? 'text-red-400' : 'text-green-400')}>
                        {v.isOpen ? 'OPEN' : 'CLOSED'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {v.cureDeadline ? (
                        <span className={cn(v.isOverdue ? 'text-red-400 font-bold' : 'text-gray-400')}>
                          {v.cureDeadline} {v.isOverdue && '⚠️'}
                        </span>
                      ) : v.hearingDate ? (
                        <span className="text-purple-400">Hearing {v.hearingDate}</span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-2 text-gray-300 text-xs">{formatCurrency(v.costLow)} - {formatCurrency(v.costHigh)}</td>
                    <td className="px-4 py-2 text-gray-400 text-xs">{v.players?.slice(0, 2).join(', ')}{v.players?.length > 2 ? ` +${v.players.length - 2}` : ''}</td>
                  </tr>
                  {isExpanded && <ViolationDetailPanel v={v} />}
                  </Fragment>
                  );
                })}
              </tbody>
            </table>
            {filteredViolations.length > 200 && (
              <div className="px-4 py-3 text-center text-gray-400 text-sm border-t border-white/10">
                Showing 200 of {filteredViolations.length} violations
              </div>
            )}
            {filteredViolations.length === 0 && (
              <div className="px-4 py-8 text-center text-gray-500">No violations match your filters</div>
            )}
          </div>
        </>
      )}

      {/* Empty state */}
      {!result && !isSearching && (
        <div className="text-center py-16 text-gray-500">
          <Building2 size={64} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg">Select a building above, or enter an address and borough</p>
          <p className="text-sm mt-2">We'll pull all HPD, DOB, and ECB violations, penalties, and hearing dates from NYC Open Data in real-time</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {['533 Washington Avenue', '538 Pacific Street', '555 Pacific Street'].map(addr => (
              <button
                key={addr}
                onClick={() => { setAddress(addr); setBorough('BROOKLYN'); setSelectedBuildingId(''); }}
                className="px-3 py-1.5 bg-white/5 border border-white/10 rounded text-xs text-gray-400 hover:text-camelot-gold hover:border-camelot-gold/30 transition-colors"
              >
                {addr}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
