import { useState, useCallback, useEffect, useMemo, Fragment } from 'react';
import { cn, formatCurrency } from '@/lib/utils';
import {
  searchViolations, type ViolationSummary, type ViolationResult, type UpcomingHearing,
  RESOLUTION_GUIDE, dismissalGuideFor,
} from '@/lib/nyc-violations';
import {
  buildViolationKey, getViolationTracking, updateViolationTracking, addViolationNote, deleteViolationNote,
  uploadViolationDocument, getViolationDocumentUrl, deleteViolationDocument, INTERNAL_STATUS_LABELS,
  listAlertSubscriptions, createAlertSubscription, deleteAlertSubscription, runViolationMonitorNow, getAlertLog,
  getBulkViolationStatuses,
  type ViolationTrackingRow, type ViolationNote, type ViolationDocument, type InternalStatus, type HearingOutcome,
  type AlertSubscription, type AlertLogRow,
} from '@/lib/violation-tracking';
import { buildICS, downloadICS, googleCalendarLink, outlookCalendarLink, type CalEvent } from '@/lib/calendar-export';
import { DAVID_GOLDOFF_SIGNATURE_TEXT, DAVID_GOLDOFF_SIGNATURE } from '@/lib/camelot-signature';
import { wrapCamelotEmailHtml } from '@/lib/camelot-email-branding';
import { sendCamelotEmail, getEmailConfigStatus } from '@/lib/pdf-generator';
import { authenticatedApiFetch } from '@/lib/api-auth';
import { getRegionByArea } from '@/lib/regions';
import toast from 'react-hot-toast';
import {
  AlertTriangle, Shield, Search, Loader2, RefreshCw,
  AlertCircle, Clock, DollarSign, Users, Calendar, FileDown, Printer, Mail,
  Building2, MapPin, ChevronDown, ChevronUp, ExternalLink, CalendarPlus, Share2,
  Gavel, Wrench, X, EyeOff, MessageSquare, Paperclip, UploadCloud, Trash2, BellRing,
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

/** Official NYC public lookup portals — same HPD Online URL already used elsewhere in this
 *  codebase (src/lib/camelot-report.ts). DOB/ECB don't expose a reliable violation-ID deep
 *  link without a BBL (which these records don't carry), so we link the portal itself and
 *  let the recipient search by the violation/ECB number we include in the report. */
const VIOLATION_PORTALS: Record<string, { label: string; url: string }> = {
  HPD: { label: 'HPD Online (search by address; open violations show under "Violations")', url: 'https://hpdonline.nyc.gov/hpdonline/' },
  DOB: { label: 'DOB Building Information System — BIS (search by address or violation number)', url: 'https://a810-bisweb.nyc.gov/bisweb/bispi00.jsp' },
  ECB: { label: 'OATH/ECB Case Status (search by ECB/OATH violation number or address)', url: 'https://www.nyc.gov/site/oath/help-center/case-status.page' },
};

/** Groups a violation list by source and returns one line per open violation with its
 *  official lookup portal link, for use in both the emailed report and the PDF. */
function buildViolationLinksLines(violations: ViolationResult[]): string[] {
  const bySource = new Map<string, ViolationResult[]>();
  for (const v of violations) {
    if (!v.isOpen) continue;
    if (!bySource.has(v.source)) bySource.set(v.source, []);
    bySource.get(v.source)!.push(v);
  }
  const lines: string[] = [];
  for (const [source, vs] of bySource) {
    const portal = VIOLATION_PORTALS[source];
    if (!portal) continue;
    lines.push(`${source} — ${portal.label}: ${portal.url}`);
    const ids = vs.map(v => v.violationId).filter(Boolean);
    if (ids.length) lines.push(`  ${source} violation number(s) to search: ${ids.join(', ')}`);
  }
  return lines;
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
    parts.push(`Estimated civil penalty accrued to date: ${formatCurrency(v.penaltyAccruedLow || 0)}–${formatCurrency(v.penaltyAccruedHigh || 0)}, accruing roughly ${formatCurrency(v.penaltyDailyLow || 0)}–${formatCurrency(v.penaltyDailyHigh || 0)} per day until corrected.`);
  } else if (v.penaltyDailyLow || v.penaltyDailyHigh) {
    parts.push(`If not corrected by the deadline, this class carries a civil penalty of roughly ${formatCurrency(v.penaltyDailyLow || 0)}–${formatCurrency(v.penaltyDailyHigh || 0)} per day.`);
  }
  parts.push(`Estimated resolution cost: ${formatCurrency(v.costLow)}–${formatCurrency(v.costHigh)}.`);
  if (v.players?.length) parts.push(`Typically requires: ${v.players.join(', ')}.`);
  return parts.join(' ');
}

function ViolationDetailPanel({ v, address, borough, buildingId, onNotMe }: { v: ViolationResult; address: string; borough: string; buildingId: number | null; onNotMe: (key: string) => void }) {
  const guide = RESOLUTION_GUIDE[v.resolutionKey] || RESOLUTION_GUIDE.DEFAULT;
  const dismissal = dismissalGuideFor(v.resolutionKey, v.source);
  const key = useMemo(() => buildViolationKey(v.source, v.violationId, address), [v.source, v.violationId, address]);

  const [loading, setLoading] = useState(true);
  const [tracking, setTracking] = useState<ViolationTrackingRow | null>(null);
  const [notes, setNotes] = useState<ViolationNote[]>([]);
  const [documents, setDocuments] = useState<ViolationDocument[]>([]);
  const [status, setStatus] = useState<InternalStatus>('new');
  const [assignedTo, setAssignedTo] = useState('');
  const [assignedToEmail, setAssignedToEmail] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [hearingOutcome, setHearingOutcome] = useState<HearingOutcome | ''>('');
  const [hearingOutcomeNotes, setHearingOutcomeNotes] = useState('');
  const [savingTracking, setSavingTracking] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getViolationTracking(key)
      .then(({ tracking: t, notes: n, documents: d }) => {
        if (cancelled) return;
        setTracking(t);
        setStatus(t.internal_status || 'new');
        setAssignedTo(t.assigned_to || '');
        setAssignedToEmail(t.assigned_to_email || '');
        setDueDate(t.due_date || '');
        setHearingOutcome((t.hearing_outcome as HearingOutcome) || '');
        setHearingOutcomeNotes(t.hearing_outcome_notes || '');
        setNotes(n);
        setDocuments(d);
      })
      .catch(() => { /* tracking layer is best-effort — the core violation data above still works */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [key]);

  const saveTracking = async () => {
    setSavingTracking(true);
    try {
      const { tracking: t } = await updateViolationTracking({
        violationKey: key, buildingId, address, borough, source: v.source, violationId: v.violationId,
        internalStatus: status, assignedTo, assignedToEmail, dueDate: dueDate || null,
        hearingOutcome: hearingOutcome || null, hearingOutcomeNotes,
        updatedBy: DAVID_GOLDOFF_SIGNATURE.name,
      });
      setTracking(t);
      toast.success('Saved');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save');
    } finally {
      setSavingTracking(false);
    }
  };

  const markNotMe = async () => {
    setStatus('not_me');
    setSavingTracking(true);
    try {
      const { tracking: t } = await updateViolationTracking({
        violationKey: key, buildingId, address, borough, source: v.source, violationId: v.violationId,
        internalStatus: 'not_me', updatedBy: DAVID_GOLDOFF_SIGNATURE.name,
      });
      setTracking(t);
      onNotMe(key);
      toast.success('Marked as not affiliated — hidden from default view');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save');
    } finally {
      setSavingTracking(false);
    }
  };

  const submitNote = async () => {
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      const { note } = await addViolationNote(key, DAVID_GOLDOFF_SIGNATURE.name, noteText.trim());
      setNotes(prev => [note, ...prev]);
      setNoteText('');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to add note');
    } finally {
      setSavingNote(false);
    }
  };

  const removeNote = async (id: number) => {
    setNotes(prev => prev.filter(n => n.id !== id));
    try { await deleteViolationNote(id); } catch { /* already optimistically removed */ }
  };

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    setUploading(true);
    try {
      for (const file of files) {
        const { document } = await uploadViolationDocument({ violationKey: key, file, uploadedBy: DAVID_GOLDOFF_SIGNATURE.name });
        setDocuments(prev => [document, ...prev]);
      }
      toast.success(`${files.length} file(s) attached`);
    } catch (err: any) {
      toast.error(err?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const viewDoc = async (id: number) => {
    try {
      const url = await getViolationDocumentUrl(id);
      window.open(url, '_blank');
    } catch (err: any) {
      toast.error(err?.message || 'Could not open file');
    }
  };

  const removeDoc = async (id: number) => {
    setDocuments(prev => prev.filter(d => d.id !== id));
    try { await deleteViolationDocument(id); } catch { /* already optimistically removed */ }
  };

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
              <p className="text-sm text-gray-300">{v.description || '—'}</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div><div className="text-gray-500">Violation ID</div><div className="text-gray-200">{v.violationId || '—'}</div></div>
              <div><div className="text-gray-500">Source / Class</div><div className="text-gray-200">{v.source} {v.violationClass}</div></div>
              <div><div className="text-gray-500">Unit</div><div className="text-gray-200">{v.unit || 'Building'}</div></div>
              <div><div className="text-gray-500">Inspection / Issue Date</div><div className="text-gray-200">{v.inspectionDate || '—'}</div></div>
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
              <div><div className="text-gray-500">Est. Resolution Cost</div><div className="text-camelot-gold">{formatCurrency(v.costLow)} – {formatCurrency(v.costHigh)}</div></div>
            </div>

            {/* Internal tracking: status, assignment, hearing outcome */}
            <div className="bg-camelot-navy rounded-lg p-3 border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-500 uppercase tracking-wide">Internal Tracking</div>
                <button onClick={markNotMe} disabled={savingTracking} title="Hide this violation — not affiliated with our respondent" className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-red-400">
                  <EyeOff size={11} /> Not Me
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div>
                  <label className="text-[10px] text-gray-500 block mb-0.5">Status</label>
                  <select value={status} onChange={e => setStatus(e.target.value as InternalStatus)} className="w-full px-2 py-1.5 bg-camelot-navy-light border border-white/10 rounded text-xs text-white outline-none">
                    {Object.entries(INTERNAL_STATUS_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 block mb-0.5">Assigned To</label>
                  <input type="text" value={assignedTo} onChange={e => setAssignedTo(e.target.value)} placeholder="Name" className="w-full px-2 py-1.5 bg-camelot-navy-light border border-white/10 rounded text-xs text-white placeholder-gray-500 outline-none" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 block mb-0.5">Assignee Email</label>
                  <input type="email" value={assignedToEmail} onChange={e => setAssignedToEmail(e.target.value)} placeholder="name@camelot.nyc" className="w-full px-2 py-1.5 bg-camelot-navy-light border border-white/10 rounded text-xs text-white placeholder-gray-500 outline-none" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 block mb-0.5">Due Date</label>
                  <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full px-2 py-1.5 bg-camelot-navy-light border border-white/10 rounded text-xs text-white outline-none" />
                </div>
              </div>
              {v.hearingDate && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-0.5">Hearing Outcome</label>
                    <select value={hearingOutcome} onChange={e => setHearingOutcome(e.target.value as HearingOutcome)} className="w-full px-2 py-1.5 bg-camelot-navy-light border border-white/10 rounded text-xs text-white outline-none">
                      <option value="">Not yet known</option>
                      <option value="pending">Pending</option>
                      <option value="won">Won / Dismissed</option>
                      <option value="settled">Settled</option>
                      <option value="adjourned">Adjourned</option>
                      <option value="default">Default Judgment</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-[10px] text-gray-500 block mb-0.5">Hearing Notes</label>
                    <input type="text" value={hearingOutcomeNotes} onChange={e => setHearingOutcomeNotes(e.target.value)} placeholder="e.g. represented by counsel, penalty reduced to $X" className="w-full px-2 py-1.5 bg-camelot-navy-light border border-white/10 rounded text-xs text-white placeholder-gray-500 outline-none" />
                  </div>
                </div>
              )}
              <button onClick={saveTracking} disabled={savingTracking || loading} className="px-3 py-1.5 bg-camelot-gold text-camelot-navy text-xs font-semibold rounded hover:bg-camelot-gold/90 disabled:opacity-50">
                {savingTracking ? 'Saving...' : 'Save Tracking'}
              </button>
            </div>

            {/* Notes thread */}
            <div className="bg-camelot-navy rounded-lg p-3 border border-white/10">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5"><MessageSquare size={12} /> Notes</div>
              <div className="flex gap-2 mb-2">
                <input type="text" value={noteText} onChange={e => setNoteText(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitNote()} placeholder="Add a note for the team..." className="flex-1 px-2 py-1.5 bg-camelot-navy-light border border-white/10 rounded text-xs text-white placeholder-gray-500 outline-none" />
                <button onClick={submitNote} disabled={savingNote || !noteText.trim()} className="px-3 py-1.5 bg-white/10 border border-white/20 rounded text-xs text-white hover:bg-white/20 disabled:opacity-50">Add</button>
              </div>
              {notes.length === 0 && !loading ? (
                <p className="text-xs text-gray-500">No notes yet.</p>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {notes.map(n => (
                    <div key={n.id} className="text-xs bg-white/5 rounded px-2 py-1.5 flex items-start justify-between gap-2">
                      <div>
                        <span className="text-camelot-gold font-medium">{n.author}</span>{' '}
                        <span className="text-gray-500">{new Date(n.created_at).toLocaleString()}</span>
                        <p className="text-gray-300 mt-0.5">{n.body}</p>
                      </div>
                      <button onClick={() => removeNote(n.id)} className="text-gray-600 hover:text-red-400 shrink-0"><X size={12} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Document / photo attachments */}
            <div className="bg-camelot-navy rounded-lg p-3 border border-white/10">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-gray-500 uppercase tracking-wide flex items-center gap-1.5"><Paperclip size={12} /> Documents &amp; Photos</div>
                <label className="flex items-center gap-1 text-[11px] text-camelot-gold hover:underline cursor-pointer">
                  <UploadCloud size={12} /> {uploading ? 'Uploading...' : 'Attach file'}
                  <input type="file" multiple onChange={onUpload} disabled={uploading} className="hidden" />
                </label>
              </div>
              {documents.length === 0 ? (
                <p className="text-xs text-gray-500">No files attached — attach the violation notice, proof of correction, permits, or photos.</p>
              ) : (
                <div className="space-y-1">
                  {documents.map(d => (
                    <div key={d.id} className="text-xs bg-white/5 rounded px-2 py-1.5 flex items-center justify-between gap-2">
                      <button onClick={() => viewDoc(d.id)} className="text-gray-200 hover:text-camelot-gold truncate text-left">{d.filename}</button>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-gray-500">{d.doc_type.replace(/_/g, ' ')}</span>
                        <button onClick={() => removeDoc(d.id)} className="text-gray-600 hover:text-red-400"><Trash2 size={11} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="space-y-3">
            <div className="bg-camelot-navy rounded-lg p-3 border border-white/10">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">{guide.label} — How to Resolve</div>
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
            <div className="bg-camelot-navy rounded-lg p-3 border border-camelot-gold/20">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Dismissal &amp; Removal Paperwork</div>
              <p className="text-xs text-gray-300 mb-1.5">{dismissal.formName}</p>
              <a href={dismissal.formUrl} target="_blank" rel="noreferrer" className="text-xs text-camelot-gold hover:underline flex items-center gap-1 mb-2">
                <ExternalLink size={11} /> Open official form / page
              </a>
              <div className="text-[11px] text-gray-400 mb-1"><span className="text-gray-500">Fee:</span> {dismissal.fee}</div>
              <div className="text-[11px] text-gray-400"><span className="text-gray-500">Deadline:</span> {dismissal.deadline}</div>
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}

/** Portfolio-wide monitoring & alert-subscription management — self-contained
 *  so it can be toggled open without affecting the single-building report state. */
function PortfolioAlertsPanel({ buildings, onClose }: { buildings: PortfolioBuildingLite[]; onClose: () => void }) {
  const [subs, setSubs] = useState<AlertSubscription[]>([]);
  const [log, setLog] = useState<AlertLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [scope, setScope] = useState<'portfolio' | 'building'>('portfolio');
  const [buildingId, setBuildingId] = useState('');
  const [notifyNew, setNotifyNew] = useState(true);
  const [notifyStatus, setNotifyStatus] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, l] = await Promise.all([listAlertSubscriptions(), getAlertLog()]);
      setSubs(s);
      setLog(l);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load alert settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const addSub = async () => {
    if (!email.trim()) { toast.error('Enter an email address'); return; }
    try {
      await createAlertSubscription({
        email: email.trim(), name: name.trim() || undefined, scope,
        buildingId: scope === 'building' && buildingId ? Number(buildingId) : undefined,
        notifyNewViolations: notifyNew, notifyStatusChanges: notifyStatus,
      });
      setEmail(''); setName(''); setBuildingId('');
      toast.success('Subscribed');
      load();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to add subscription');
    }
  };

  const removeSub = async (id: number) => {
    setSubs(prev => prev.filter(s => s.id !== id));
    try { await deleteAlertSubscription(id); } catch { /* already optimistically removed */ }
  };

  const runNow = async () => {
    setRunning(true);
    toast.loading('Scanning portfolio for new violations, status changes, and upcoming hearings…', { id: 'run-monitor' });
    try {
      const result = await runViolationMonitorNow();
      if (result.status === 'error') {
        toast.error(result.error || 'Scan failed', { id: 'run-monitor' });
      } else {
        toast.success(`Scanned ${result.buildingsScanned ?? 0} building(s) — ${result.newViolationsFound ?? 0} new, ${result.statusChangesFound ?? 0} changed, ${result.hearingsFlagged ?? 0} hearing(s) flagged`, { id: 'run-monitor', duration: 6000 });
      }
      load();
    } catch (err: any) {
      toast.error(err?.message || 'Scan failed', { id: 'run-monitor' });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="bg-camelot-navy-light rounded-xl p-6 border border-camelot-gold/20 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2"><BellRing size={16} className="text-camelot-gold" /> Portfolio-Wide Monitoring &amp; Alerts</h3>
        <div className="flex items-center gap-2">
          <button onClick={runNow} disabled={running} className="flex items-center gap-1.5 px-3 py-1.5 bg-camelot-gold text-camelot-navy text-xs font-semibold rounded-lg hover:bg-camelot-gold/90 disabled:opacity-50">
            {running ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Run Scan Now
          </button>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-white"><X size={16} /></button>
        </div>
      </div>
      <p className="text-xs text-gray-400">Scans every active building in the portfolio every 6 hours for brand-new violations, status changes, and hearings coming up within 14 days — and emails a digest to anyone subscribed below.</p>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Subscribe to Alerts</div>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@camelot.nyc" className="w-full px-3 py-2 bg-camelot-navy border border-white/10 rounded text-sm text-white placeholder-gray-500 outline-none" />
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Name (optional)" className="w-full px-3 py-2 bg-camelot-navy border border-white/10 rounded text-sm text-white placeholder-gray-500 outline-none" />
          <div className="flex gap-2">
            <select value={scope} onChange={e => setScope(e.target.value as 'portfolio' | 'building')} className="flex-1 px-3 py-2 bg-camelot-navy border border-white/10 rounded text-sm text-white outline-none">
              <option value="portfolio">Whole portfolio</option>
              <option value="building">One building</option>
            </select>
            {scope === 'building' && (
              <select value={buildingId} onChange={e => setBuildingId(e.target.value)} className="flex-1 px-3 py-2 bg-camelot-navy border border-white/10 rounded text-sm text-white outline-none">
                <option value="">Select building…</option>
                {buildings.map(b => <option key={b.id} value={String(b.id)}>{b.building_name || b.address}</option>)}
              </select>
            )}
          </div>
          <div className="flex gap-4 text-xs text-gray-300">
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={notifyNew} onChange={e => setNotifyNew(e.target.checked)} /> New violations</label>
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={notifyStatus} onChange={e => setNotifyStatus(e.target.checked)} /> Status changes</label>
          </div>
          <button onClick={addSub} className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-sm text-white hover:bg-white/20">Add Subscription</button>

          {subs.length > 0 && (
            <div className="space-y-1 pt-2">
              {subs.map(s => (
                <div key={s.id} className="flex items-center justify-between text-xs bg-white/5 rounded px-2 py-1.5">
                  <span className="text-gray-300">{s.email} {s.name ? `(${s.name})` : ''} — {s.scope === 'building' ? (buildings.find(b => b.id === s.building_id)?.building_name || 'one building') : 'whole portfolio'}</span>
                  <button onClick={() => removeSub(s.id)} className="text-gray-600 hover:text-red-400"><X size={12} /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Recent Scan History</div>
          {loading ? (
            <p className="text-xs text-gray-500">Loading…</p>
          ) : log.length === 0 ? (
            <p className="text-xs text-gray-500">No scans yet — click "Run Scan Now" or wait for the next scheduled scan.</p>
          ) : (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {log.map(l => (
                <div key={l.id} className="text-xs bg-white/5 rounded px-2 py-1.5">
                  <div className="flex justify-between text-gray-400">
                    <span>{new Date(l.run_at).toLocaleString()}</span>
                    {l.error ? <span className="text-red-400">Error</span> : <span className="text-green-400">OK</span>}
                  </div>
                  {!l.error ? (
                    <div className="text-gray-300 mt-0.5">{l.buildings_scanned} scanned · {l.new_violations_found} new · {l.status_changes_found} changed · {l.hearings_flagged} hearings · {l.emails_sent} email(s) sent</div>
                  ) : (
                    <div className="text-red-400/80 mt-0.5">{l.error}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
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
    description: `${item.description || 'Violation'} — ${item.source} #${item.violationId}${item.status ? ` — Status: ${item.status}` : ''}${item.balanceDue ? ` — Balance due: ${formatCurrency(item.balanceDue)}` : ''}\n\nPrepared by Camelot Property Management Services Corp.`,
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
      <td className="px-4 py-2 text-xs text-gray-300">{item.source} #{item.violationId || '—'}</td>
      <td className="px-4 py-2 text-xs text-gray-300 max-w-xs truncate">{item.description?.substring(0, 90)}</td>
      <td className="px-4 py-2 text-xs">
        <span className={cn('font-medium', item.isPast ? 'text-red-400' : 'text-white')}>
          {item.dateISO}{item.time ? ` @ ${item.time}` : ''} {item.isPast && '⚠️'}
        </span>
      </td>
      <td className="px-4 py-2 text-xs text-gray-400">{item.status || '—'}</td>
      <td className="px-4 py-2 text-xs text-gray-300">{item.balanceDue ? formatCurrency(item.balanceDue) : '—'}</td>
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
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set());
  const [filterSource, setFilterSource] = useState('all');
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [filterOpen, setFilterOpen] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [guestEmailsInput, setGuestEmailsInput] = useState('');
  const [showSharePanel, setShowSharePanel] = useState(false);
  const [showEmailPanel, setShowEmailPanel] = useState(false);
  const [showAlertsPanel, setShowAlertsPanel] = useState(false);
  const [emailRecipientName, setEmailRecipientName] = useState('');
  const [emailRecipientAddress, setEmailRecipientAddress] = useState('');
  const [emailSenderChoice, setEmailSenderChoice] = useState<'david' | 'other'>('david');
  const [otherSenderName, setOtherSenderName] = useState('');
  const [otherSenderTitle, setOtherSenderTitle] = useState('');
  const [otherSenderEmail, setOtherSenderEmail] = useState('');
  const [emailConfigStatus, setEmailConfigStatus] = useState<{ resendConfigured: boolean } | null>(null);
  const [sendingRealEmail, setSendingRealEmail] = useState(false);

  useEffect(() => {
    // Check once whether real (Resend-backed) sending is configured, so the
    // "Send Now" button can show an honest state instead of pretending to work.
    getEmailConfigStatus().then(setEmailConfigStatus).catch(() => setEmailConfigStatus(null));
  }, []);

  /** Display name of whoever is currently selected to send/sign the report. */
  const currentSenderName = () => emailSenderChoice === 'david' ? DAVID_GOLDOFF_SIGNATURE.name : (otherSenderName.trim() || 'Camelot Property Management');
  /** Reply-to / from-identity email of the currently selected sender. */
  const currentSenderEmail = () => emailSenderChoice === 'david' ? DAVID_GOLDOFF_SIGNATURE.email : (otherSenderEmail.trim() || DAVID_GOLDOFF_SIGNATURE.email);
  /** Plain-text signature block for the currently selected sender. */
  const currentSenderSignatureText = () => emailSenderChoice === 'david'
    ? DAVID_GOLDOFF_SIGNATURE_TEXT
    : [otherSenderName.trim() || '(sender name)', otherSenderTitle.trim(), 'Camelot Property Management Services Corp.', otherSenderEmail.trim() ? `Email: ${otherSenderEmail.trim()}` : ''].filter(Boolean).join('\n');
  /** HTML signature block (for the real branded send) for the currently selected sender. */
  const currentSenderSignatureHtml = () => {
    if (emailSenderChoice === 'david') {
      return `<div style="margin-top:22px;font-family:Arial,Helvetica,sans-serif;color:#1a1f36;line-height:1.5">`
        + `<div style="font-size:14px;font-weight:700">${DAVID_GOLDOFF_SIGNATURE.name}</div>`
        + `<div style="font-size:12px;color:#555">${DAVID_GOLDOFF_SIGNATURE.title} — Camelot Property Management Services Corp.</div>`
        + `<div style="font-size:12px;margin-top:4px">${DAVID_GOLDOFF_SIGNATURE.phone}</div>`
        + `<div style="font-size:12px">Email: <a href="mailto:${DAVID_GOLDOFF_SIGNATURE.email}" style="color:#a8853a">${DAVID_GOLDOFF_SIGNATURE.email}</a> &nbsp;·&nbsp; <a href="https://${DAVID_GOLDOFF_SIGNATURE.web}" style="color:#a8853a">${DAVID_GOLDOFF_SIGNATURE.web}</a></div>`
        + `</div>`;
    }
    const name = otherSenderName.trim() || '(sender name)';
    const title = otherSenderTitle.trim();
    const email = otherSenderEmail.trim();
    return `<div style="margin-top:22px;font-family:Arial,Helvetica,sans-serif;color:#1a1f36;line-height:1.5">`
      + `<div style="font-size:14px;font-weight:700">${name}</div>`
      + (title ? `<div style="font-size:12px;color:#555">${title} — Camelot Property Management Services Corp.</div>` : `<div style="font-size:12px;color:#555">Camelot Property Management Services Corp.</div>`)
      + (email ? `<div style="font-size:12px">Email: <a href="mailto:${email}" style="color:#a8853a">${email}</a></div>` : '')
      + `</div>`;
  };

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

  useEffect(() => {
    if (!result || !result.violations.length) { setHiddenKeys(new Set()); return; }
    let cancelled = false;
    const keys = result.violations.map(v => buildViolationKey(v.source, v.violationId, result.address));
    getBulkViolationStatuses(keys)
      .then(statuses => {
        if (cancelled) return;
        const hidden = new Set(Object.entries(statuses).filter(([, s]) => s === 'not_me').map(([k]) => k));
        setHiddenKeys(hidden);
      })
      .catch(() => { /* best-effort — if this fails, all violations just stay visible */ });
    return () => { cancelled = true; };
  }, [result]);

  const filteredViolations = (result?.violations || []).filter(v => {
    if (!result) return false;
    if (hiddenKeys.has(buildViolationKey(v.source, v.violationId, result.address))) return false;
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
    downloadICS(`${result.address.replace(/\s+/g, '-')}-compliance-calendar`, events, `Camelot OS — ${result.address} Compliance Calendar`);
    toast.success(`${events.length} hearing/deadline(s) downloaded — import into Google, Outlook, or Apple Calendar`);
  };

  const shareCalendarByEmail = () => {
    if (!result || deadlineItems.length === 0) { toast.error('No hearings or deadlines to share'); return; }
    if (guestEmails.length === 0) { toast.error('Enter at least one email to share with'); return; }
    const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const subject = encodeURIComponent(`Compliance Calendar — ${result.address}, ${result.borough}`);
    const nl = '\n';
    const lines = deadlineItems.map(d =>
      `  • ${d.dateISO}${d.time ? ' @ ' + d.time : ''} — ${d.kind === 'hearing' ? 'ECB/OATH HEARING' : d.source + ' correction deadline'} — ${d.source} #${d.violationId || 'N/A'}${d.isPast ? ' ⚠️ PAST DUE' : ''}`
    );
    const body = encodeURIComponent(
      `Hi,${nl}${nl}Sharing the compliance calendar for ${result.address}, ${result.borough} — these dates are time-sensitive, please add them to your calendar.${nl}${nl}UPCOMING HEARINGS & DEADLINES${nl}${'━'.repeat(30)}${nl}${lines.join(nl)}${nl}${nl}A .ics file with all of these dates (plus automatic reminders) is attached — open it to add every date to your calendar in one step, or use the individual "Add to Google Calendar" buttons in Camelot OS.${nl}${nl}Best,${nl}${nl}${DAVID_GOLDOFF_SIGNATURE_TEXT}`
    );
    // Download the ics for manual attachment (mirrors the app's existing PDF-attach pattern) then open Gmail.
    const events = deadlineItems.map(d => deadlineToCalEvent(d, result.address, result.borough));
    downloadICS(`${result.address.replace(/\s+/g, '-')}-compliance-calendar`, events, `Camelot OS — ${result.address} Compliance Calendar`);
    window.open(`https://mail.google.com/mail/?view=cm&su=${subject}&body=${body}`, '_blank');
    toast.success('Calendar file downloaded and Gmail opened — attach the .ics file before sending');
  };

  const generatePDF = (silent?: boolean): string | undefined => {
    if (!result) return undefined;
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
      + `<h2>${result.address} — ${result.borough}</h2>`
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
      + `<div class="players">${result.players.map(p => '<div>• ' + p + '</div>').join('')}</div>`
      + (deadlineItems.length > 0
        ? '<h2>UPCOMING HEARINGS &amp; DEADLINES</h2>'
          + '<table><tr><th>Type</th><th>Source</th><th>Description</th><th>Date</th><th>Status</th><th>Balance Due</th></tr>'
          + deadlineItems.map(d =>
            `<tr><td>${d.kind === 'hearing' ? 'ECB/OATH HEARING' : 'CORRECTION DEADLINE'}</td>`
            + `<td>${d.source} #${d.violationId || '—'}</td>`
            + `<td>${(d.description || '').substring(0, 80)}</td>`
            + `<td class="${d.isPast ? 'overdue' : ''}">${d.dateISO}${d.time ? ' @ ' + d.time : ''}${d.isPast ? ' OVERDUE' : ''}</td>`
            + `<td>${d.status || '—'}</td>`
            + `<td>${d.balanceDue ? '$' + d.balanceDue.toLocaleString() : '—'}</td></tr>`
          ).join('')
          + '</table>'
          + '<div style="font-size:8px;color:#888;margin:4px 0">Add these dates to your calendar (with automatic reminders) from the live Camelot OS Violation &amp; Resolution Center — look for the calendar icon next to each hearing/deadline.</div>'
        : '')
      + (resolutionGroups.length > 0
        ? '<h2>HOW TO RESOLVE &amp; REMEDY</h2>'
          + resolutionGroups.map(g =>
            '<div class="resgroup">'
            + `<h4>${g.label} — ${g.count} violation${g.count > 1 ? 's' : ''} — Est. $${g.costLow.toLocaleString()}-$${g.costHigh.toLocaleString()}</h4>`
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
    if (silent) return html;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
    toast.success('Report opened — use Print to save as PDF, email, or print');
  };

  /** Shared plain-text report body used by both the Gmail draft and the real branded send (as the `text` fallback). */
  const buildReportBodyText = (recipientName: string, signatureText: string): string => {
    if (!result) return '';
    const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const hearingLines = result.upcomingHearings.length > 0
      ? `\n\nUPCOMING HEARINGS\n${'━'.repeat(30)}\n` + result.upcomingHearings.map(h =>
          `  • ${h.hearingDate}${h.hearingTime ? ' @ ' + h.hearingTime : ''} — ${h.source} #${h.violationId}${h.isPast ? ' (PAST — confirm status)' : ''}`
        ).join('\n')
      : '';
    const linkLines = buildViolationLinksLines(result.violations);
    const linksSection = linkLines.length > 0
      ? `\n\nVIOLATION RECORDS — OFFICIAL LOOKUP\n${'━'.repeat(30)}\n` + linkLines.join('\n')
      : '';
    const greeting = recipientName.trim() ? `Dear ${recipientName.trim()},` : 'Dear Sir or Madam,';
    return greeting
      + `\n\nPlease find attached the Violation & Resolution Report for ${result.address}, ${result.borough}, prepared by Camelot Property Management Services Corp.`
      + `\n\nREPORT SUMMARY\n${'━'.repeat(30)}`
      + `\nProperty: ${result.address}, ${result.borough}`
      + `\nReport Date: ${date}`
      + `\nTotal Violations Found: ${result.totalFound}`
      + `\nOpen Violations: ${result.totalOpen}`
      + `\n  • HPD Class C (Immediately Hazardous): ${result.hpdClassC}`
      + `\n  • HPD Class B (Hazardous): ${result.hpdClassB}`
      + `\n  • HPD Class A (Non-Hazardous): ${result.hpdClassA}`
      + `\n  • DOB Violations: ${result.dobOpen}`
      + `\n  • ECB Violations: ${result.ecbOpen}`
      + `\nOverdue (Past Cure Deadline): ${result.overdue}`
      + `\nECB Penalties Assessed: $${result.totalPenaltiesAssessed.toLocaleString()}`
      + `\nECB Balance Due: $${result.totalBalanceDue.toLocaleString()}`
      + `\nEstimated Resolution Cost: $${result.costLow.toLocaleString()} – $${result.costHigh.toLocaleString()}`
      + hearingLines
      + `\n\nWHAT THIS REPORT CONTAINS\n${'━'.repeat(30)}`
      + `\nThis report provides a comprehensive analysis of all open violations issued by NYC agencies (HPD, DOB, ECB) for the above property. Each violation is classified by severity, with cure deadlines, scheduled hearings, estimated resolution costs, and the specific professionals required to resolve each item.`
      + `\n\nRECOMMENDATIONS\n${'━'.repeat(30)}`
      + (result.hpdClassC > 0 ? `\n⚠️ IMMEDIATE ACTION REQUIRED: There are ${result.hpdClassC} Class C (Immediately Hazardous) violations that must be addressed within 24 hours of issuance. These may include lead paint hazards, gas leaks, heat/hot water failures, or fire safety issues.` : '')
      + (result.overdue > 0 ? `\n\n⚠️ OVERDUE VIOLATIONS: ${result.overdue} violations are past their cure deadline. We recommend prioritizing these to avoid compounding fines and ECB hearings.` : '')
      + (result.upcomingHearings.length > 0 ? `\n\n⚠️ TIME-SENSITIVE: ${result.upcomingHearings.length} ECB/OATH hearing(s) are on the calendar — missing a hearing results in an automatic default judgment. Add these to your calendar from the Violation & Resolution Center (calendar icon next to each hearing) and share with counsel/PM.` : '')
      + `\n\nWe recommend a phased approach to resolution:`
      + `\n  Phase 1 (Weeks 1-2): Address all Class C and overdue violations immediately`
      + `\n  Phase 2 (Weeks 3-8): Resolve Class B violations and DOB/ECB matters`
      + `\n  Phase 3 (Weeks 9+): Clear remaining Class A violations through scheduled maintenance`
      + `\n\nPROFESSIONALS NEEDED\n${'━'.repeat(30)}`
      + `\n` + result.players.map(p => `  • ${p}`).join('\n')
      + linksSection
      + `\n\nPlease review the attached PDF for the complete violation-by-violation breakdown, including specific descriptions, unit locations, cure deadlines, hearing dates, cost estimates, and resolution steps.`
      + `\n\nWe are available to discuss a resolution strategy at your convenience.`
      + `\n\nBest regards,`
      + `\n\n${signatureText}`;
  };

  /** "Open in Gmail" — a plain-text draft the user reviews and sends themselves. Fast, no backend config required. */
  const emailReport = () => {
    if (!result) return;
    if (!emailRecipientAddress.trim() && !emailRecipientName.trim()) {
      toast.error('Enter who this report is addressed to first');
      return;
    }
    const subject = encodeURIComponent(`Violation & Resolution Report: ${result.address}, ${result.borough}`);
    const to = encodeURIComponent(emailRecipientAddress.trim());
    const body = encodeURIComponent(buildReportBodyText(emailRecipientName, currentSenderSignatureText()));
    window.open(`https://mail.google.com/mail/?view=cm&to=${to}&su=${subject}&body=${body}`, '_blank');
    toast.success('Gmail opened — attach the downloaded PDF report');
    setShowEmailPanel(false);
  };

  /** "Send Branded Email Now" — an actual delivery via Camelot OS's Resend-backed endpoint, wrapped in the default Camelot header/footer letterhead. */
  const sendBrandedEmailNow = async () => {
    if (!result) return;
    if (!emailRecipientAddress.trim()) { toast.error('Enter a recipient email address'); return; }
    if (!emailConfigStatus?.resendConfigured) {
      toast.error('Real sending isn\'t configured yet — add RESEND_API_KEY in Render, or use "Open in Gmail" for now.', { id: 'violations-send', duration: 6000 });
      return;
    }
    const plainText = buildReportBodyText(emailRecipientName, currentSenderSignatureText());
    const linkLines = buildViolationLinksLines(result.violations);
    const bodyParagraphs = plainText
      .split('\n\n')
      .map(block => {
        const escaped = block.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const linked = escaped.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" style="color:#a8853a">$1</a>');
        return `<p style="margin:0 0 14px;white-space:pre-line;font-size:14px;">${linked}</p>`;
      })
      .join('');
    const bodyHtml = bodyParagraphs + currentSenderSignatureHtml();
    const html = wrapCamelotEmailHtml({
      bodyHtml,
      eyebrow: `Violation &amp; Resolution Report — ${result.address}, ${result.borough}`,
      preheaderText: `${result.totalOpen} open violation(s), ${linkLines.length ? 'with official record lookup links' : ''} for ${result.address}`,
    });
    const subject = `Violation & Resolution Report: ${result.address}, ${result.borough}`;
    const reportHtml = generatePDF(true);
    const cleanAddr = result.address.replace(/\s+/g, '-');
    setSendingRealEmail(true);
    toast.loading('Sending branded report...', { id: 'violations-send' });
    try {
      const res = await sendCamelotEmail({
        to: emailRecipientAddress.trim(),
        subject,
        html,
        text: plainText,
        replyTo: currentSenderEmail(),
        reportHtml: reportHtml,
        attachmentFilename: `${cleanAddr}_CamelotOS_ViolationReport.pdf`,
      });
      if (!res.ok) {
        toast.error(res.error || 'Send failed', { id: 'violations-send' });
      } else {
        toast.success(`Sent to ${emailRecipientAddress.trim()}`, { id: 'violations-send' });
        setShowEmailPanel(false);
      }
    } finally {
      setSendingRealEmail(false);
    }
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Shield className="text-camelot-gold" size={28} />
            Violation & Resolution Center
          </h1>
          <p className="text-slate-600 text-sm mt-1">
            Pick a building from the portfolio or search any NYC property to pull violations, hearings, penalties, and generate a resolution report
          </p>
        </div>
        <button
          onClick={() => setShowAlertsPanel(s => !s)}
          className="flex items-center gap-2 px-4 py-2 bg-camelot-navy-light border border-camelot-gold/30 rounded-lg text-camelot-gold hover:bg-camelot-gold/10 text-sm font-medium shrink-0"
        >
          <BellRing size={16} /> Portfolio Alerts
        </button>
      </div>

      {showAlertsPanel && <PortfolioAlertsPanel buildings={sortedBuildings} onClose={() => setShowAlertsPanel(false)} />}

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
              <option value="">{`Select a Camelot building… (${sortedBuildings.length} in portfolio)`}</option>
              {sortedBuildings.map(b => (
                <option key={b.id} value={String(b.id)}>
                  {b.building_name ? `${b.building_name} — ${b.address}` : b.address}{b.city ? `, ${b.city}` : ''}
                </option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          {buildingsError && (
            <p className="text-xs text-gray-500 mt-1.5">{`Couldn't load the managed portfolio automatically (${buildingsError}) — use the address field below instead.`}</p>
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
                <button onClick={() => generatePDF()} className="flex items-center gap-2 px-4 py-2 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 hover:bg-red-500/30 text-sm">
                  <Printer size={14} /> PDF / Print
                </button>
                <button onClick={() => setShowEmailPanel(s => !s)} className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 border border-blue-500/30 rounded-lg text-blue-400 hover:bg-blue-500/30 text-sm">
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
              <StatCard icon={DollarSign} label="Est. Resolution Cost" value={`${formatCurrency(result.costLow)}–${formatCurrency(result.costHigh)}`} color="orange" />
            </div>

            {showEmailPanel && (() => {
              const links = buildViolationLinksLines(result.violations);
              return (
                <div className="mt-4 p-4 bg-white/5 border border-white/10 rounded-lg space-y-3">
                  <h4 className="text-sm font-semibold text-white flex items-center gap-2"><Mail size={14} className="text-camelot-gold" /> Email This Report</h4>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-gray-400 text-xs mb-1 block">Addressed to (recipient name)</label>
                      <input
                        type="text"
                        value={emailRecipientName}
                        onChange={e => setEmailRecipientName(e.target.value)}
                        placeholder="e.g. Board President, Jane Smith"
                        className="w-full px-3 py-2 bg-camelot-navy border border-white/10 rounded text-sm text-white placeholder-gray-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-gray-400 text-xs mb-1 block">Recipient email</label>
                      <input
                        type="email"
                        value={emailRecipientAddress}
                        onChange={e => setEmailRecipientAddress(e.target.value)}
                        placeholder="recipient@example.com"
                        className="w-full px-3 py-2 bg-camelot-navy border border-white/10 rounded text-sm text-white placeholder-gray-500 outline-none"
                      />
                    </div>
                  </div>
                  <div className="grid md:grid-cols-3 gap-3 items-end">
                    <div>
                      <label className="text-gray-400 text-xs mb-1 block">Send &amp; sign as</label>
                      <select
                        value={emailSenderChoice}
                        onChange={e => setEmailSenderChoice(e.target.value as 'david' | 'other')}
                        className="w-full px-3 py-2 bg-camelot-navy border border-white/10 rounded text-sm text-white outline-none"
                      >
                        <option value="david">{DAVID_GOLDOFF_SIGNATURE.name} ({DAVID_GOLDOFF_SIGNATURE.title})</option>
                        <option value="other">Someone else…</option>
                      </select>
                    </div>
                    {emailSenderChoice === 'other' && (
                      <>
                        <div>
                          <label className="text-gray-400 text-xs mb-1 block">Sender name</label>
                          <input type="text" value={otherSenderName} onChange={e => setOtherSenderName(e.target.value)} placeholder="Full name" className="w-full px-3 py-2 bg-camelot-navy border border-white/10 rounded text-sm text-white placeholder-gray-500 outline-none" />
                        </div>
                        <div>
                          <label className="text-gray-400 text-xs mb-1 block">Sender title</label>
                          <input type="text" value={otherSenderTitle} onChange={e => setOtherSenderTitle(e.target.value)} placeholder="e.g. Property Manager" className="w-full px-3 py-2 bg-camelot-navy border border-white/10 rounded text-sm text-white placeholder-gray-500 outline-none" />
                        </div>
                      </>
                    )}
                  </div>
                  {emailSenderChoice === 'other' && (
                    <div>
                      <label className="text-gray-400 text-xs mb-1 block">Sender email (used as reply-to)</label>
                      <input type="email" value={otherSenderEmail} onChange={e => setOtherSenderEmail(e.target.value)} placeholder="name@camelot.nyc" className="w-full md:w-1/2 px-3 py-2 bg-camelot-navy border border-white/10 rounded text-sm text-white placeholder-gray-500 outline-none" />
                    </div>
                  )}
                  {links.length > 0 && (
                    <div className="text-xs text-gray-400">
                      <span className="text-gray-300 font-medium">Official violation record links included in this report:</span>
                      <ul className="mt-1 space-y-0.5">
                        {Object.keys(VIOLATION_PORTALS).filter(src => result.violations.some(v => v.isOpen && v.source === src)).map(src => (
                          <li key={src}>
                            <ExternalLink size={10} className="inline mr-1 -mt-0.5" />
                            {src}: <a href={VIOLATION_PORTALS[src].url} target="_blank" rel="noreferrer" className="text-camelot-gold hover:underline">{VIOLATION_PORTALS[src].url}</a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button onClick={emailReport} className="flex items-center gap-2 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white hover:bg-white/20 text-sm">
                      <Mail size={14} /> Open in Gmail
                    </button>
                    <button
                      onClick={sendBrandedEmailNow}
                      disabled={sendingRealEmail || !emailConfigStatus?.resendConfigured}
                      title={emailConfigStatus?.resendConfigured ? 'Sends now with the default Camelot header/footer, via Resend' : 'Add RESEND_API_KEY in Render to enable real sending'}
                      className={cn('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50', emailConfigStatus?.resendConfigured ? 'bg-camelot-gold text-camelot-navy hover:bg-camelot-gold/90' : 'bg-white/5 text-gray-500 border border-white/10')}
                    >
                      {sendingRealEmail ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                      Send Branded Email Now{!emailConfigStatus?.resendConfigured ? ' (setup needed)' : ''}
                    </button>
                    <button onClick={() => setShowEmailPanel(false)} className="px-3 py-2 text-gray-400 hover:text-white text-sm">Cancel</button>
                  </div>
                </div>
              );
            })()}
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
                  <span className="text-xs text-gray-500 font-normal">{'— time-sensitive, don\'t let these slip'}</span>
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
                    <label className="text-gray-400 text-xs mb-1 block">{'Guest email(s), comma-separated — used for "Add to Google Calendar" invites and the emailed calendar'}</label>
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
                    <div className="text-camelot-gold text-sm font-bold mb-2">{formatCurrency(g.costLow)} – {formatCurrency(g.costHigh)} est.</div>
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
            {hiddenKeys.size > 0 && (
              <span className="flex items-center gap-1 text-xs text-gray-500" title="Marked Not Me — open a violation and clear its status to bring it back">
                <EyeOff size={12} /> {hiddenKeys.size} hidden (Not Me)
              </span>
            )}
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
                  {isExpanded && (
                    <ViolationDetailPanel
                      v={v} address={result.address} borough={result.borough}
                      buildingId={selectedBuildingId ? Number(selectedBuildingId) : null}
                      onNotMe={hiddenKey => setHiddenKeys(prev => new Set(prev).add(hiddenKey))}
                    />
                  )}
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
