import { useState, useRef, useCallback, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Search, CheckCircle, FileText, Edit3, Download, Printer, Mail, Loader2, ChevronRight, ArrowLeft, Zap, X, ExternalLink, Copy } from 'lucide-react';
import { buildJackieIntelReportFilename, buildMasterReport, generateBrochureHTML, validateJackieReport, type MasterReportData, type QACheckResult } from '@/lib/camelot-report';
import { fetchAddressByBBL } from '@/lib/nyc-api';
import { generatePitchReport } from '@/lib/pitch-report';
import { loadReportInputs, saveReportInputs } from '@/lib/report-input-memory';
import { DAVID_GOLDOFF_SIGNATURE_TEXT } from '@/lib/camelot-signature';
// Existing CRM plumbing (same functions the legacy Proposals page and Report
// Center already use): creates/updates a HubSpot contact for the recipient
// and upserts a Building record into the Pipeline board's local store.
import { buildingFromReportData, trackReportWorkflowEvent } from '@/lib/report-crm-tracking';
import toast from 'react-hot-toast';
import { CAMELOT_LOGO_B64, CAMELOT_HEADER_B64, CAMELOT_SIGNATURE_B64, CAMELOT_CONTACT_B64 } from '@/lib/camelot-brand-assets';
// Same Proposal Library archive the legacy Proposals page reads from
// (scout_proposals table) — Instant Proposal writes here too so every
// proposal shows up in one place regardless of which flow generated it.
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
// Real Gmail draft creation with attachments already in place (no manual
// download-and-attach step) — see src/lib/google-gmail.ts.
import { isGmailComposeConfigured, getGmailComposeToken, createGmailDraftWithAttachments } from '@/lib/google-gmail';

type Step = 'search' | 'verify' | 'jackie' | 'draft' | 'export';

const STEPS: { key: Step; label: string; icon: typeof Search }[] = [
  { key: 'search', label: 'Property', icon: Search },
  { key: 'verify', label: 'Verify', icon: CheckCircle },
  { key: 'jackie', label: 'Engagement Report', icon: FileText },
  { key: 'draft', label: 'Review Draft', icon: Edit3 },
  { key: 'export', label: 'Export', icon: Download },
];

/**
 * Full-screen modal for displaying HTML reports inline.
 * Replaces all window.open() calls for mobile compatibility.
 */
function ReportModal({ html, title, onClose }: { html: string; title: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-camelot-navy text-white flex-shrink-0">
        <h3 className="text-sm font-bold truncate">{title}</h3>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
        >
          <X size={18} />
        </button>
      </div>
      {/* Report content in sandboxed iframe */}
      <iframe
        srcDoc={html}
        title={title}
        className="flex-1 w-full bg-white"
        sandbox="allow-same-origin"
      />
    </div>
  );
}

// Demo property constants
const DEMO_ADDRESS = '201 East 79th Street';
const DEMO_BOROUGH = 'Manhattan';
const INSTANT_PROPOSAL_INPUT_SCOPE = 'instant-proposal';

type InstantProposalSavedInputs = {
  address: string;
  borough: string;
};

// ---------------------------------------------------------------------------
// Rate sheets — Camelot's standard schedules, insertable into the proposal
// ---------------------------------------------------------------------------

type FeeLine = { label: string; fee: string };

const DEFAULT_ANCILLARY_FEES: FeeLine[] = [
  { label: 'Alteration Fee', fee: '$500.00' },
  { label: 'CCTA (Cooperative Condo Tax Abatement)', fee: '$200 per bldg. filing' },
  { label: 'Coop or Condo Closing (inside management offices)', fee: '$1,000 Flat Fee' },
  { label: 'Audit Review and Assistance', fee: '$150.00 per hour' },
  { label: 'Tax Forms 1098, 1099', fee: '$25 per form filed' },
  { label: 'Monthly Administrative Fee (avg. copies, messenger, mailings, data filings, cloud storage, web hosting, physical storage)', fee: '$200.00 per month' },
  { label: 'Alteration Agreement Review and Submittal', fee: '$500, or 10% of the Alteration cost over $5,000' },
  { label: 'Sales or Rental Package Review', fee: '$500 per package' },
  { label: 'HPD Filing Fee', fee: '$50.00 (once per year)' },
  { label: 'Emergency Site Plan Creation & Submittal', fee: '$175.00' },
  { label: 'Bank & Insurance Questionnaire Fee', fee: '$200.00' },
];

const DEFAULT_RATE_SCHEDULE: FeeLine[] = [
  { label: 'Property or Project Manager (Emergency or Supervision Services)', fee: '$150.00 per hour' },
  { label: 'Travel', fee: 'Billed by receipt' },
  { label: 'Sales & Leasing', fee: 'Per Separate Brokerage Agreement' },
  { label: 'Agent Insurance Policies', fee: '$450.00 Annually' },
  { label: 'Cleaning, Ordinary Repairs & Maintenance', fee: '$50.00 per hour' },
  { label: 'Extraordinary Repairs (over $5,000 per repair)', fee: 'Subject to $150/hour project manager fee & 20% markup, per management agreement' },
  { label: 'Locksmith', fee: '$150.00 per hour + Materials + 20% Markup' },
  { label: 'Supplies & Material Markups', fee: '10% Overhead and 10% Profit, billed monthly or quarterly (not individually per invoice)' },
  { label: 'Pre-Occupation Services', fee: '$150.00 per hour' },
  { label: 'Court Appearance or Deposition', fee: '$150.00 per hour' },
  { label: 'Application Review', fee: '$200.00 per application, or the maximum amount permissible under applicable law' },
  { label: 'RPIE Filing (Real Property Income & Expense)', fee: '$400 per filing' },
  { label: 'DHCR Filing — NYC Rent Registration (per building)', fee: '$500.00 per building per year' },
];

/** Small, self-contained editor for a rate schedule: a checkbox to include it
 *  in the proposal, plus a collapsible list of editable per-line fees. */
function RateSheetEditor({
  title,
  included,
  onToggleIncluded,
  lines,
  onChangeFee,
}: {
  title: string;
  included: boolean;
  onToggleIncluded: () => void;
  lines: FeeLine[];
  onChangeFee: (index: number, value: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border border-gray-100 rounded-lg p-3">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={included}
          onChange={onToggleIncluded}
          className="w-4 h-4 accent-camelot-gold"
        />
        <span className="text-sm font-semibold text-camelot-navy">{title}</span>
        <span className="text-xs text-gray-400 ml-auto whitespace-nowrap">{lines.length} line items</span>
      </label>
      {included && (
        <>
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            className="text-xs text-camelot-gold hover:underline mt-2"
          >
            {expanded ? 'Hide rates' : 'Edit rates'}
          </button>
          {expanded && (
            <div className="mt-2 max-h-64 overflow-y-auto space-y-1.5 pr-1">
              {lines.map((line, i) => (
                <div key={line.label} className="flex items-start gap-2">
                  <span className="text-[11px] text-gray-600 flex-1 leading-snug pt-1.5">{line.label}</span>
                  <input
                    type="text"
                    value={line.fee}
                    onChange={e => onChangeFee(i, e.target.value)}
                    className="w-44 flex-shrink-0 px-2 py-1 border border-gray-300 rounded text-[11px] text-right focus:outline-none focus:ring-2 focus:ring-camelot-gold/50"
                  />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

type BuildingClientType = 'coop' | 'condo' | 'rental' | 'newdev';
type NewDevBase = 'rental' | 'condo';

/** UI-side mirror of the recipient-title defaults used when generating the
 *  proposal — keeps the Verify-step placeholder text in sync with what will
 *  actually appear in the document. */
function recipientTitleHint(clientType: BuildingClientType, newDevBase: NewDevBase, isReceiver: boolean): string {
  if (isReceiver) return 'Court-Appointed Receiver';
  const base = clientType === 'newdev' ? newDevBase : clientType;
  if (base === 'coop') return 'Board President';
  if (base === 'condo') return 'President, Board of Managers';
  return 'Owner / Managing Member';
}

/** UI-side mirror of the "who is the client entity" placeholder. */
function recipientOrgHint(clientType: BuildingClientType, newDevBase: NewDevBase, isReceiver: boolean): string {
  if (isReceiver) return 'Firm / entity (e.g. Bergy Management Group LLC)';
  const base = clientType === 'newdev' ? newDevBase : clientType;
  if (base === 'coop') return 'Cooperative corporation name';
  if (base === 'condo') return 'Condominium association name';
  return 'Ownership entity / investment group name';
}

// ---------------------------------------------------------------------------
// PDF / Email export helpers (module scope — no component state needed)
// ---------------------------------------------------------------------------

/** Pulls the <style> CSS text and inner <body> HTML out of a full HTML document
 *  string. Falls back to treating the whole string as body content if no
 *  <body> tag is present (e.g. a contentEditable fragment). Extracting the
 *  stylesheet and re-attaching it to the real document <head> (instead of
 *  relying on fragment-parsing a <style> tag into a plain <div>) guarantees
 *  the CSS is actually applied when html2canvas renders the clone. */
function extractStyleAndBody(fullHtml: string): { css: string; bodyHtml: string } {
  const styleMatches = Array.from(fullHtml.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)).map(m => m[1]);
  const bodyMatch = fullHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  return {
    css: styleMatches.join('\n'),
    bodyHtml: bodyMatch ? bodyMatch[1] : fullHtml,
  };
}

/** Waits for every <img> under root to finish loading (or fail/timeout) so
 *  html2canvas never snapshots a page before its images have decoded. */
function waitForImages(root: HTMLElement, timeoutMs = 4000): Promise<void> {
  const imgs = Array.from(root.querySelectorAll('img'));
  if (!imgs.length) return Promise.resolve();
  return Promise.all(
    imgs.map(img => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise<void>(resolve => {
        const done = () => resolve();
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
        setTimeout(done, timeoutMs);
      });
    })
  ).then(() => undefined);
}

/**
 * Renders proposal HTML to a PDF Blob.
 *
 * html2pdf.js has a documented limitation: rasterizing a very tall, multi-page
 * container into ONE giant canvas can silently produce a completely blank PDF
 * (see html2pdf.js README "Known issues #6 — Maximum size"). Our proposal is a
 * 6-page document, so instead of rendering it as a single tall container, each
 * `.page` block is captured as its own bounded canvas and stitched into one
 * multi-page PDF via the jsPDF instance that html2pdf.js hands back — this
 * keeps every individual canvas well within safe browser limits.
 */
async function renderProposalPdfBlob(content: string, filename: string): Promise<Blob> {
  const html2pdf = (await import('html2pdf.js')).default;
  const { css, bodyHtml } = extractStyleAndBody(content);

  // Attach the extracted stylesheet to the real document head so it behaves
  // exactly like a normal page's CSS (no fragment-parsing ambiguity).
  const styleEl = document.createElement('style');
  styleEl.setAttribute('data-camelot-pdf-export', 'true');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // Render off-screen but still fully painted (opacity:0, not display:none or
  // an extreme negative offset) so html2canvas has a real, decoded layout to copy.
  const container = document.createElement('div');
  container.innerHTML = bodyHtml;
  container.style.cssText = 'position:fixed;left:0;top:0;width:800px;opacity:0;pointer-events:none;z-index:-1;';
  document.body.appendChild(container);

  try {
    await waitForImages(container);

    const pageEls = Array.from(container.querySelectorAll<HTMLElement>('.page'));
    const targets = pageEls.length ? pageEls : [container];

    const margin: [number, number, number, number] = [0.5, 0.5, 0.5, 0.5];
    const baseOpt = {
      margin,
      filename,
      image: { type: 'jpeg' as const, quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#ffffff', logging: false },
      jsPDF: { unit: 'in' as const, format: 'letter' as const, orientation: 'portrait' as const },
      pagebreak: { mode: 'avoid-all' as const },
    };

    // Page 1: let html2pdf.js build the initial jsPDF document (handles unit
    // conversion / page sizing for us).
    const pdf = await html2pdf().set(baseOpt).from(targets[0]).toPdf().get('pdf');

    const pageWidthPt = pdf.internal.pageSize.getWidth();
    const pageHeightPt = pdf.internal.pageSize.getHeight();
    const [mTop, mRight, mBottom, mLeft] = margin;
    const usableWidth = pageWidthPt - mLeft - mRight;
    const usableHeight = pageHeightPt - mTop - mBottom;

    for (let i = 1; i < targets.length; i++) {
      const canvas: HTMLCanvasElement = await html2pdf().set(baseOpt).from(targets[i]).toContainer().toCanvas().get('canvas');
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const imgHeight = (canvas.height / canvas.width) * usableWidth;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', mLeft, mTop, usableWidth, Math.min(imgHeight, usableHeight));
    }

    return pdf.output('blob') as Blob;
  } finally {
    document.body.removeChild(container);
    document.head.removeChild(styleEl);
  }
}

/** Reads a Blob and resolves to its base64 payload (no `data:...;base64,` prefix). */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result || '');
      resolve(result.split(',')[1] || '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** RFC 2045 requires base64 body lines to be wrapped — most mail clients are
 *  lenient, but a few (older Outlook builds) reject/garble unwrapped lines. */
function wrapBase64(base64: string): string {
  return base64.match(/.{1,76}/g)?.join('\r\n') || base64;
}

/**
 * Builds a standalone .eml (RFC 822) file with the PDF attached and the
 * `X-Unsent: 1` header, which Outlook (desktop) recognizes and opens the
 * file as an editable, unsent DRAFT — populated with To/Subject/Body and the
 * attachment already in place — rather than sending anything automatically.
 */
function buildEmlDraft(opts: {
  to: string;
  subject: string;
  body: string;
  attachmentName: string;
  attachmentBase64: string;
}): string {
  const boundary = `----=_NextPart_Camelot_${Date.now()}`;
  return [
    `To: ${opts.to}`,
    `Subject: ${opts.subject}`,
    `X-Unsent: 1`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ``,
    `This is a multi-part message in MIME format.`,
    `--${boundary}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `Content-Transfer-Encoding: 8bit`,
    ``,
    opts.body,
    ``,
    `--${boundary}`,
    `Content-Type: application/pdf; name="${opts.attachmentName}"`,
    `Content-Transfer-Encoding: base64`,
    `Content-Disposition: attachment; filename="${opts.attachmentName}"`,
    ``,
    wrapBase64(opts.attachmentBase64),
    ``,
    `--${boundary}--`,
    ``,
  ].join('\r\n');
}

export default function InstantProposal() {
  const location = useLocation();
  const [step, setStep] = useState<Step>('search');
  const [address, setAddress] = useState((location.state as { address?: string } | null)?.address || '');
  const [borough, setBorough] = useState('');
  const [blockNum, setBlockNum] = useState('');
  const [lotNum, setLotNum] = useState('');
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<MasterReportData | null>(null);
  const [proposalHTML, setProposalHTML] = useState('');
  const [jackieHTML, setJackieHTML] = useState('');
  const [pitchHTML, setPitchHTML] = useState('');
  const [fullJackieHTML, setFullJackieHTML] = useState('');
  const [releaseQA, setReleaseQA] = useState<QACheckResult | null>(null);
  const [showJackieModal, setShowJackieModal] = useState(false);
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [gmailDraftLoading, setGmailDraftLoading] = useState(false);
  // Editable fee (Verify step) — defaults to the auto-calculated suggestion until the user overrides it
  const [customFee, setCustomFee] = useState<number | null>(null);
  // Manual unit-mix entry (studios/1BR/2BR/3BR) — not published by any NYC Open Data source
  const [unitMix, setUnitMix] = useState('');
  // Who this proposal is being sent to — used to build the "PDF + Email" draft
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  // Which email service to open the draft in. Plain mailto: only opens
  // something if the browser/OS has a mail app or web handler registered for
  // it — for Gmail users (the common case, and one who has no protocol
  // handler registered) that silently does nothing, so Gmail/Outlook Web are
  // opened via their own compose-URL, which works with zero setup.
  const [emailProvider, setEmailProvider] = useState<'gmail' | 'outlook' | 'default'>('gmail');
  // Building/client type — swaps "Board," "shareholders," "unit owners," etc.
  // for the correct vocabulary throughout the proposal. Defaults to Rental
  // since most Camelot properties are rental buildings, not co-ops/condos —
  // never inferred from NYC data, always a manual, per-proposal choice.
  const [clientType, setClientType] = useState<'coop' | 'condo' | 'rental' | 'newdev'>('rental');
  // Only used when clientType === 'newdev' — a new development can be either
  // a newly delivered rental building or a sponsor-controlled condo/co-op.
  const [newDevBase, setNewDevBase] = useState<'rental' | 'condo'>('rental');
  // Independent of building type — a court-appointed receiver can be recipient
  // of a proposal for any building type, so this is its own toggle.
  const [isReceiver, setIsReceiver] = useState(false);
  const [recipientTitle, setRecipientTitle] = useState('');
  const [recipientOrgName, setRecipientOrgName] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  // Term, commencement, and renewal — editable on the Verify step, feeding the
  // "Term, Rate & Fees" page of the generated proposal
  const [initialTerm, setInitialTerm] = useState('');
  const [commencing, setCommencing] = useState('');
  const [renewalTerms, setRenewalTerms] = useState('');
  // Rate sheets — toggled + editable on the Verify step, inserted as new pages
  // near the end of the generated proposal when checked
  const [includeAncillaryFees, setIncludeAncillaryFees] = useState(true);
  const [includeRateSchedule, setIncludeRateSchedule] = useState(true);
  const [ancillaryFees, setAncillaryFees] = useState<FeeLine[]>(DEFAULT_ANCILLARY_FEES);
  const [rateSchedule, setRateSchedule] = useState<FeeLine[]>(DEFAULT_RATE_SCHEDULE);
  // Whether to bundle the Property Engagement Report alongside the proposal —
  // shown as proof of Camelot's intelligence on the property. Defaults on
  // once a report has actually been generated (jackieHTML is set).
  const [includeEngagementReport, setIncludeEngagementReport] = useState(true);
  const draftRef = useRef<HTMLDivElement>(null);

  const stepIndex = STEPS.findIndex(s => s.key === step);

  const loadLastInputs = useCallback(() => {
    const saved = loadReportInputs<InstantProposalSavedInputs>(INSTANT_PROPOSAL_INPUT_SCOPE);
    if (!saved) {
      toast.error('No saved instant proposal inputs found yet');
      return;
    }
    setAddress(saved.address || '');
    setBorough(saved.borough || '');
    toast.success('Last instant proposal inputs restored');
  }, []);

  // Step 1: Search
  const handleSearch = async () => {
    if (!address.trim()) { toast.error('Enter a property address'); return; }
    saveReportInputs(INSTANT_PROPOSAL_INPUT_SCOPE, { address, borough });
    setLoading(true);
    try {
      const data = await buildMasterReport(address.trim(), borough || undefined);
      setReportData(data);
      setReleaseQA(null);
      setCustomFee(null);
      setUnitMix('');
      // Recipient/client info is a manual, one-off override per proposal — never
      // inferred from NYC data — so it's cleared on every new property search
      // rather than silently carrying over to the next building.
      setClientType('rental');
      setNewDevBase('rental');
      setIsReceiver(false);
      setRecipientName('');
      setRecipientTitle('');
      setRecipientOrgName('');
      setRecipientAddress('');
      setRecipientEmail('');
      setRecipientPhone('');
      setInitialTerm('');
      setCommencing('');
      setRenewalTerms('');
      setStep('verify');
      toast.success('Property data loaded');
    } catch (e: unknown) {
      const err = e as { message?: string; name?: string };
      const msg = err?.message || '';
      if (msg.toLowerCase().includes('fetch') || msg.toLowerCase().includes('network') || msg.toLowerCase().includes('cors') || msg.toLowerCase().includes('failed to fetch')) {
        toast.error('Could not reach NYC data APIs. Try a different address format.');
      } else if (msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('no data') || msg.toLowerCase().includes('no results')) {
        toast.error("No NYC records found for this address. Try including the borough (e.g., 'Manhattan').");
      } else {
        toast.error('Failed to load property: ' + (msg || 'Unknown error'));
      }
      // Keep address so user can edit and retry
    } finally {
      setLoading(false);
    }
  };

  // Search by Borough + Block + Lot (tax-record workflow)
  const handleBblSearch = async () => {
    if (!borough) { toast.error('Select a borough for a Block & Lot search'); return; }
    if (!blockNum.trim() || !lotNum.trim()) { toast.error('Enter both Block and Lot'); return; }
    setLoading(true);
    try {
      const resolved = await fetchAddressByBBL(borough, blockNum, lotNum);
      if (!resolved) {
        toast.error(`No PLUTO record for ${borough} Block ${blockNum} / Lot ${lotNum}`);
        return;
      }
      setAddress(resolved.address);
      toast.success(`Block/Lot resolved: ${resolved.address}`);
      const data = await buildMasterReport(resolved.address, borough);
      setReportData(data);
      setReleaseQA(null);
      setCustomFee(null);
      setUnitMix('');
      // Recipient/client info is a manual, one-off override per proposal — never
      // inferred from NYC data — so it's cleared on every new property search
      // rather than silently carrying over to the next building.
      setClientType('rental');
      setNewDevBase('rental');
      setIsReceiver(false);
      setRecipientName('');
      setRecipientTitle('');
      setRecipientOrgName('');
      setRecipientAddress('');
      setRecipientEmail('');
      setRecipientPhone('');
      setInitialTerm('');
      setCommencing('');
      setRenewalTerms('');
      setStep('verify');
      toast.success('Property data loaded');
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast.error('Block/Lot lookup failed: ' + (err?.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  // Try Demo: load sample property
  const handleTryDemo = async () => {
    setAddress(DEMO_ADDRESS);
    setBorough(DEMO_BOROUGH);
    saveReportInputs(INSTANT_PROPOSAL_INPUT_SCOPE, { address: DEMO_ADDRESS, borough: DEMO_BOROUGH });
    setLoading(true);
    try {
      const data = await buildMasterReport(DEMO_ADDRESS, DEMO_BOROUGH);
      setReportData(data);
      setReleaseQA(null);
      setCustomFee(null);
      setUnitMix('');
      // Recipient/client info is a manual, one-off override per proposal — never
      // inferred from NYC data — so it's cleared on every new property search
      // rather than silently carrying over to the next building.
      setClientType('rental');
      setNewDevBase('rental');
      setIsReceiver(false);
      setRecipientName('');
      setRecipientTitle('');
      setRecipientOrgName('');
      setRecipientAddress('');
      setRecipientEmail('');
      setRecipientPhone('');
      setInitialTerm('');
      setCommencing('');
      setRenewalTerms('');
      setStep('verify');
      toast.success('Demo property loaded: 201 East 79th Street');
    } catch (e: unknown) {
      toast.error('Demo load failed — NYC APIs may be unavailable. Try again shortly.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2→3: Generate Jackie
  const handleGenerateJackie = async () => {
    if (!reportData) return;
    setLoading(true);
    try {
      const pitchHtml = generatePitchReport(reportData);
      const fullHtml = generateBrochureHTML(reportData);
      const qa = validateJackieReport(reportData, fullHtml);
      setReleaseQA(qa);
      setJackieHTML(qa.failures > 0 ? fullHtml : pitchHtml);
      setPitchHTML(pitchHtml);
      setFullJackieHTML(fullHtml);
      setStep('jackie');
      if (qa.failures > 0) {
        toast.error(`Jackie opened for internal review with ${qa.failures} issue(s). Proposal export remains available for internal review.`, { duration: 7000 });
      } else {
        toast.success(qa.warnings > 0 ? `Jackie report generated with ${qa.warnings} review warning(s)` : 'Jackie report verified for release');
      }
    } catch (e: any) {
      toast.error('Failed: ' + (e.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  // Step 3→4: Generate proposal draft
  const handleGenerateDraft = () => {
    if (!reportData) return;
    if (releaseQA?.failures) {
      toast.error('Jackie found report warnings/review issues, but proposal draft generation will continue for internal review.', { duration: 7000 });
    }
    try {
      const d = reportData;
      const monthly = customFee ?? d.monthlyFee ?? 0;
      const perUnit = d.units ? Math.round(monthly / d.units) : (d.pricePerUnit ?? 0);
      const annual = monthly * 12;
      const sqFt = d.buildingArea ? d.buildingArea.toLocaleString() + ' sq ft' : 'N/A';
      const lotSqFt = d.lotArea ? d.lotArea.toLocaleString() + ' sq ft' : 'N/A';
      const resUnits = d.unitsResidential ?? d.units;
      const totalUnits = d.unitsTotalAll ?? d.units;
      const hpdReg = d.registrationDate ? `On file since ${d.registrationDate}` : 'Not registered / N/A';
      const lastSale = d.lastSalePrice ? `$${d.lastSalePrice.toLocaleString()}${d.lastSaleDate ? ' on ' + d.lastSaleDate : ''}${d.lastSaleBuyer ? ' to ' + d.lastSaleBuyer : ''}` : 'No sale on record (ACRIS)';
      const dobPermits = `${d.permitsCount ?? 0} filed${d.hasRecentPermits ? ' (recent activity)' : ''}`;
      const todayStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      const owner = d.registrationOwner || d.dofOwner || null;

      // Auto-written property description from the data already pulled on Verify —
      // this is what the user asked to be researched/filled in before the letter.
      const propertyDescription =
        `${d.buildingName || d.address} is a ${d.stories ? d.stories + '-story ' : ''}${(d.propertyType || 'residential').toLowerCase()} building` +
        `${d.neighborhoodName ? ` in ${d.neighborhoodName}` : ''}${d.borough ? `, ${d.borough}` : ''}. ` +
        `Built in ${d.yearBuilt || 'an unreported year'}, the property comprises ${resUnits ?? 'N/A'} residential unit${resUnits === 1 ? '' : 's'}` +
        `${totalUnits && totalUnits !== resUnits ? ` (${totalUnits} total, including non-residential space)` : ''} across approximately ${sqFt}. ` +
        `${owner ? `Ownership is on file as ${owner}. ` : ''}` +
        `${d.violationsOpen ? `The building currently has ${d.violationsOpen} open violation${d.violationsOpen === 1 ? '' : 's'} on record.` : 'The building currently has no open violations on record.'}`;

      // Recipient + building-type framing. `base` is the underlying vocabulary
      // track (co-op / condo / rental) — New Development borrows whichever
      // base the user picked (a new dev can be a rental building or a
      // sponsor-controlled condo) and layers on transition-specific language.
      // `isReceiver` is independent of building type — a court-appointed
      // receiver can be the recipient for any of these.
      const base: 'coop' | 'condo' | 'rental' = clientType === 'newdev' ? newDevBase : clientType;
      const isNewDev = clientType === 'newdev';
      const occupantNoun = base === 'coop' ? 'shareholders' : base === 'condo' ? 'unit owners' : 'tenants';

      const recName = recipientName.trim() || '[Recipient Name]';
      const recTitleDefaultMap: Record<'coop' | 'condo' | 'rental', string> = {
        coop: 'Board President',
        condo: 'President, Board of Managers',
        rental: 'Owner / Managing Member',
      };
      const recTitleDefault = isReceiver ? 'Court-Appointed Receiver' : recTitleDefaultMap[base];
      const recTitle = recipientTitle.trim() || `[Recipient Title — e.g. ${recTitleDefault}]`;

      const clientEntityDefaultMap: Record<'coop' | 'condo' | 'rental', string> = {
        coop: '[Board / Cooperative Corporation Name]',
        condo: '[Board of Managers / Condominium Association Name]',
        rental: '[Ownership Entity / Investment Group Name]',
      };
      const recOrgDefault = isReceiver ? '[Building Name / Receivership Estate]' : clientEntityDefaultMap[base];
      const recOrg = recipientOrgName.trim() || recOrgDefault;
      const addrLines = recipientAddress.trim() ? recipientAddress.trim().split('\n').map(l => l.trim()).filter(Boolean) : [];
      const addrLine1 = addrLines[0] || '[Address Line 1]';
      const addrLine2 = addrLines.slice(1).join(', ') || '[City, State ZIP]';
      const recContact = [recipientEmail.trim(), recipientPhone.trim()].filter(Boolean).join(' / ') || '[Email / Phone]';
      const clientEntityDefault = isReceiver ? '[Receivership Estate / Ownership Entity Name]' : clientEntityDefaultMap[base];
      const clientEntity = recipientOrgName.trim() || clientEntityDefault;

      const boardAndResidents = isReceiver
        ? 'the property, its residents, and the receivership estate you oversee'
        : base === 'rental'
          ? `your ownership and the property's ${occupantNoun}`
          : `your Board and the building's ${occupantNoun}`;
      const boardMeetingsPhrase = isReceiver
        ? 'regular reporting to you as Receiver'
        : base === 'rental' ? 'regular ownership reporting' : 'Board meetings';
      const boardMeetingsListItem = isReceiver
        ? 'Regular reporting and coordination with the Court-Appointed Receiver'
        : base === 'rental'
          ? 'Regular ownership reporting and financial review meetings'
          : base === 'coop'
            ? 'Management of Board and annual shareholder meetings'
            : 'Management of Board of Managers and annual unit owner meetings';
      const ownershipUpdatesPhrase = isReceiver
        ? 'ownership/you as Receiver'
        : base === 'rental' ? 'ownership' : 'ownership/the Board';
      const enforcementPhrase = base === 'coop'
        ? 'Enforcement of House Rules, the proprietary lease, and alteration agreements'
        : base === 'condo'
          ? 'Enforcement of House Rules, bylaws, and alteration agreements'
          : 'Enforcement of House Rules, lease terms, and landlord-tenant compliance';
      const violationsBoardPhrase = isReceiver
        ? 'brought to you as Receiver'
        : base === 'rental' ? 'brought to Ownership' : 'brought to the Board';
      const alterationBoardPhrase = isReceiver
        ? 'on behalf of the Receiver'
        : base === 'rental' ? 'on behalf of Ownership' : 'on behalf of the Board';
      const financeReportPhrase = isReceiver
        ? 'to you as Receiver'
        : base === 'rental' ? 'to Ownership' : 'to the Board';
      const meetGreetPhrase = isReceiver
        ? 'residents and to you as Receiver'
        : base === 'rental' ? 'tenants and ownership' : `${occupantNoun} and the Board`;
      const meetGreetHeading = isReceiver
        ? 'Meet &amp; Greet with Ownership/Receiver'
        : base === 'rental'
          ? 'Meet &amp; Greet with Tenants/Ownership'
          : base === 'coop'
            ? 'Meet &amp; Greet with Shareholders/Board'
            : 'Meet &amp; Greet with Unit Owners/Board';
      const meetGreetSubjectWord = isReceiver ? 'you' : base === 'rental' ? 'ownership' : 'owners';
      const finalizeTermPhrase = isReceiver
        ? 'the receivership'
        : base === 'rental' ? 'ownership' : 'the Board/ownership';

      const transferHeading = base === 'rental' ? 'Leasing &amp; Renewal Services' : 'Brokerage &amp; Transfer Services';
      const transferBullets = base === 'rental'
        ? [
            'Management of lease renewals, new leasing, and unit turnover',
            'Tenant screening coordination and move-in/move-out inspections',
            'Insurance requirement review (renter\'s insurance / COI compliance)',
          ]
        : base === 'coop'
          ? [
              'Management of sublet and shareholder transfer submittals',
              'Insurance requirement review to protect the cooperative corporation',
              'Scheduled move-ins, coordinated only after proof of insurance (COI) is received',
            ]
          : [
              'Management of sale and rental submittals',
              'Insurance requirement review to protect the condominium association',
              'Scheduled move-ins, coordinated only after proof of insurance (COI) is received',
            ];

      const newDevBullets = isNewDev ? [
        newDevBase === 'condo'
          ? 'Coordination with the Sponsor on remaining unit sales, closings, and eventual Board transition'
          : 'Coordination of initial lease-up, marketing support, and unit turnover for newly delivered units',
        'Certificate of Occupancy (TCO/CO) and punch-list tracking with the developer/general contractor',
        'Warranty claim coordination during the building\'s initial post-construction period',
      ] : [];

      // Page numbering — Cover/Letter/Property Description/Scope/Term & Fees are
      // always pages 1-5; the two optional rate-sheet pages and Next Steps shift
      // depending on which schedules are included.
      let pageCounter = 5;
      const pAncillary = includeAncillaryFees ? ++pageCounter : 0;
      const pSchedule = includeRateSchedule ? ++pageCounter : 0;
      const pNextSteps = ++pageCounter;
      const totalPages = pNextSteps;

      const proposalHtml = `<!DOCTYPE html><html><head><meta charset="utf-8" /><style>
        @page { margin: 0.6in; }
        body{font-family:Georgia,'Times New Roman',serif;line-height:1.6;color:#222;margin:0;padding:0;background:#fff;}
        .page{max-width:800px;margin:0 auto;padding:40px 44px;}
        .page + .page{page-break-before:always;}
        .brand-header{display:flex;align-items:center;margin-bottom:14px;}
        .brand-header img{height:66px;width:auto;}
        .brand-rule{border:none;border-top:2px solid #C5A55A;margin:0 0 28px;}
        h1,h2,h3{font-family:Georgia,'Times New Roman',serif;color:#162B5E;margin:0;}
        .cover{text-align:center;padding:30px 20px 10px;}
        .cover img.logo{width:150px;height:150px;margin:10px auto 26px;display:block;}
        .cover h1{font-size:22px;letter-spacing:1.5px;text-transform:uppercase;}
        .cover .prepared-by{color:#6B7280;font-size:11px;letter-spacing:1.2px;text-transform:uppercase;margin:10px 0 22px;padding-bottom:18px;border-bottom:2px solid #C5A55A;display:inline-block;}
        .cover .prop-name{font-style:italic;color:#444;font-size:15px;margin:0 0 2px;}
        .cover .prop-addr{font-style:italic;color:#888;font-size:12px;margin:0 0 30px;}
        .cover .info-label{color:#162B5E;font-weight:700;font-size:11px;letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;}
        table.info-table{width:100%;max-width:520px;margin:0 auto;border-collapse:collapse;font-size:12.5px;text-align:left;}
        table.info-table td{padding:8px 12px;border-bottom:1px solid #eee;}
        table.info-table td.k{background:#F7F5F0;font-weight:700;color:#162B5E;width:38%;}
        .letter p{font-size:13.5px;margin:0 0 14px;}
        .letter .addr-block p{margin:0 0 2px;font-style:italic;color:#777;}
        .letter .re-line{font-weight:700;color:#162B5E;margin:18px 0 14px;}
        .letter .re-line em{font-weight:400;font-style:italic;color:#777;}
        .sig-block{margin-top:26px;}
        .sig-block img{width:200px;display:block;margin-bottom:4px;}
        .sig-block .name{font-weight:700;font-size:13px;}
        .sig-block .role{font-size:13px;}
        .notes-box{background:#F4F3EF;border:1px solid #D8D4C8;border-radius:4px;padding:16px 18px;margin-top:26px;}
        .notes-box .title{font-weight:700;color:#162B5E;font-size:11px;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;}
        .notes-box .hint{font-style:italic;color:#888;font-size:11px;margin-bottom:8px;}
        .notes-box ul{margin:0;padding-left:18px;font-size:12px;color:#666;}
        .notes-box li{margin-bottom:4px;font-style:italic;}
        h2.section{color:#162B5E;font-size:16px;letter-spacing:1px;text-transform:uppercase;border-bottom:2px solid #C5A55A;padding-bottom:8px;margin-bottom:16px;}
        .desc-box{background:#F7F5F0;border-left:4px solid #C5A55A;padding:14px 18px;font-size:13px;margin-bottom:22px;}
        h3.sub{color:#162B5E;font-size:13.5px;margin:20px 0 6px;}
        ul.services{list-style:none;padding:0;margin:0 0 6px;}
        ul.services li{padding:5px 0;font-size:12.5px;padding-left:18px;position:relative;}
        ul.services li:before{content:"•";color:#C5A55A;font-weight:700;position:absolute;left:0;}
        .fee-note{font-size:12.5px;margin:16px 0;}
        ol.next-steps{padding-left:20px;font-size:13px;margin:0 0 20px;}
        ol.next-steps li{margin-bottom:8px;}
        ol.next-steps b{color:#162B5E;}
        .thankyou{font-style:italic;color:#162B5E;text-align:center;margin:26px 0 14px;font-size:13px;}
        .contact-block img{width:340px;display:block;}
        .footer-bar{margin-top:36px;padding-top:10px;border-top:1px solid #ccc;text-align:center;font-size:10px;color:#888;}
        .footer-bar .conf{font-style:italic;margin-top:2px;}
        .footer-bar .page-num{margin-top:4px;font-weight:700;color:#999;letter-spacing:0.5px;}
        table.fee-table{width:100%;border-collapse:collapse;font-size:11.5px;margin-bottom:6px;}
        table.fee-table th{background:#162B5E;color:#fff;text-align:left;padding:7px 10px;font-size:10px;letter-spacing:0.5px;text-transform:uppercase;}
        table.fee-table th.amt{text-align:right;}
        table.fee-table td{padding:7px 10px;border-bottom:1px solid #eee;vertical-align:top;}
        table.fee-table tr:nth-child(even) td{background:#F9F8F5;}
        table.fee-table td.fee-amt{white-space:nowrap;font-weight:700;color:#162B5E;text-align:right;}
      </style></head><body>

        <div class="page cover">
          <img class="logo" src="${CAMELOT_LOGO_B64}" alt="Camelot Realty Group" />
          <h1>Proposal of Property Management Services</h1>
          <div class="prepared-by">Prepared by Camelot Property Management Services Corp.</div>
          <p class="prop-name">${d.buildingName || d.address}</p>
          <p class="prop-addr">${d.address || ''}</p>
          <div class="info-label">Proposal Information</div>
          <table class="info-table">
            <tr><td class="k">Date</td><td>${todayStr}</td></tr>
            <tr><td class="k">Version</td><td>v1.0</td></tr>
            <tr><td class="k">Prepared For</td><td>${recName}, ${recTitle}</td></tr>
            <tr><td class="k">Addressed To</td><td>${recOrg}</td></tr>
            <tr><td class="k">Recipient Contact</td><td>${recContact}</td></tr>
            <tr><td class="k">Recipient Address</td><td>${addrLines.length ? `${addrLine1}, ${addrLine2}` : '[Street, City, State ZIP]'}</td></tr>
          </table>
          <div class="footer-bar">
            57 West 57th Street, Suite 410, New York, NY 10019 &nbsp;·&nbsp; (212) 206-9939 &nbsp;·&nbsp; info@camelot.nyc
            <div class="conf">CONFIDENTIAL — PREPARED EXCLUSIVELY FOR THE ADDRESSEE</div>
            <div class="page-num">Page 1 of ${totalPages}</div>
          </div>
        </div>

        <div class="page letter">
          <div class="brand-header"><img src="${CAMELOT_HEADER_B64}" alt="Camelot Realty Group" /></div>
          <hr class="brand-rule" />
          <p>${todayStr}</p>
          <div class="addr-block">
            <p>${recName}</p>
            <p>${recTitle}</p>
            <p>${recOrg}</p>
            <p>${addrLine1}</p>
            <p>${addrLine2}</p>
          </div>
          <p class="re-line">Re:&nbsp; Property Management Proposal — <em>${d.buildingName || d.address}, ${d.address || ''}</em></p>
          <p>Dear ${recName},</p>
          <p>It was a pleasure connecting with you about the opportunity to manage ${d.buildingName || d.address}. We are grateful for your consideration and the trust you're placing in Camelot — we're confident that our hands-on approach, vetted network of contractors and vendors, and responsive team can bring real, measurable value to ${boardAndResidents}.</p>
          <p>Outlined in this proposal is the scope of services, fee structure, and next steps we recommend for ${d.buildingName || d.address}. We would welcome the opportunity to discuss this further at your convenience, and we look forward to the possibility of working together.</p>
          <div class="sig-block">
            <img src="${CAMELOT_SIGNATURE_B64}" alt="David Goldoff signature" />
            <div class="name">David Goldoff</div>
            <div class="role">President</div>
            <div class="role">Camelot Property Management Services Corp.</div>
          </div>
          <div class="notes-box">
            <div class="title">Notes</div>
            <div class="hint">Context gathered from conversations with the client — reference before finalizing this proposal.</div>
            <ul>
              <li>[Note — e.g. a specific concern, current management pain point, or special request the client raised]</li>
              <li>[Note — e.g. staffing, vendor, or building-condition context]</li>
              <li>[Note — e.g. timeline, decision process, or ownership dynamics]</li>
            </ul>
          </div>
          <div class="footer-bar">
            57 West 57th Street, Suite 410, New York, NY 10019 &nbsp;·&nbsp; (212) 206-9939 &nbsp;·&nbsp; info@camelot.nyc
            <div class="conf">CONFIDENTIAL — PREPARED EXCLUSIVELY FOR THE ADDRESSEE</div>
            <div class="page-num">Page 2 of ${totalPages}</div>
          </div>
        </div>

        <div class="page">
          <div class="brand-header"><img src="${CAMELOT_HEADER_B64}" alt="Camelot Realty Group" /></div>
          <hr class="brand-rule" />
          <h2 class="section">Property Description</h2>
          <div class="desc-box">${propertyDescription}</div>
          <h3 class="sub">Property Snapshot</h3>
          <table class="info-table">
            <tr><td class="k">The Property</td><td>${d.address || 'N/A'}</td></tr>
            <tr><td class="k">The Client</td><td>${clientEntity}</td></tr>
            <tr><td class="k">Unit Mix</td><td>${unitMix || `${d.propertyType || 'Residential'} — ${resUnits ?? 'N/A'} units`}</td></tr>
            <tr><td class="k">Square Footage</td><td>${sqFt} (lot: ${lotSqFt})</td></tr>
            <tr><td class="k">HPD Registration (MDR)</td><td>${hpdReg}</td></tr>
            <tr><td class="k">Last Sale (ACRIS)</td><td>${lastSale}</td></tr>
            <tr><td class="k">DOB Permits</td><td>${dobPermits}</td></tr>
            <tr><td class="k">Current Management</td><td>${d.managementCompany || 'Management to verify'}</td></tr>
          </table>
          <div class="footer-bar">
            57 West 57th Street, Suite 410, New York, NY 10019 &nbsp;·&nbsp; (212) 206-9939 &nbsp;·&nbsp; info@camelot.nyc
            <div class="conf">CONFIDENTIAL — PREPARED EXCLUSIVELY FOR THE ADDRESSEE</div>
            <div class="page-num">Page 3 of ${totalPages}</div>
          </div>
        </div>

        <div class="page">
          <div class="brand-header"><img src="${CAMELOT_HEADER_B64}" alt="Camelot Realty Group" /></div>
          <hr class="brand-rule" />
          <h2 class="section">Scope of Services</h2>
          <p style="font-size:13px;">If retained, Camelot will assign a dedicated team to ${d.buildingName || d.address}, including a Property Manager who leads day-to-day operations and ${boardMeetingsPhrase}, an account manager and administrative support, and an in-house controller and CPA for budget development and financial oversight.</p>
          <h3 class="sub">Property Management Services</h3>
          <ul class="services">
            <li>24/7 on-call response to building and resident inquiries</li>
            <li>Administrative tracking, filings, and recordkeeping</li>
            <li>Regular on-site visits and inspections</li>
            <li>Coordination with service trades, contractors, and vendors</li>
            <li>Regular reporting and updates to ${ownershipUpdatesPhrase}</li>
            <li>${enforcementPhrase}</li>
            <li>${boardMeetingsListItem}</li>
          </ul>
          <h3 class="sub">Accounting Services</h3>
          <ul class="services">
            <li>Full bookkeeping services</li>
            <li>Annual budget preparation and oversight</li>
            <li>Monthly and year-end reconciliation of cash, A/R, and A/P</li>
            <li>Annual tax return coordination (available under separate proposal)</li>
          </ul>
          <h3 class="sub">Compliance &amp; Local Law Supervision</h3>
          <ul class="services">
            <li>Review of open violations, with a resolution plan ${violationsBoardPhrase}</li>
            <li>Review of current Local Law and code compliance status</li>
            <li>Management of annual registrations and life-safety mechanical filings</li>
            <li>Oversight of open alteration permit reviews ${alterationBoardPhrase}</li>
            <li>Monitoring of energy benchmarking and related regulatory requirements</li>
          </ul>
          <h3 class="sub">${transferHeading}</h3>
          <ul class="services">
            ${transferBullets.map(b => `<li>${b}</li>`).join('')}
          </ul>
          ${isNewDev ? `<h3 class="sub">New Development Transition Services</h3>
          <ul class="services">
            ${newDevBullets.map(b => `<li>${b}</li>`).join('')}
          </ul>` : ''}
          <div class="footer-bar">
            57 West 57th Street, Suite 410, New York, NY 10019 &nbsp;·&nbsp; (212) 206-9939 &nbsp;·&nbsp; info@camelot.nyc
            <div class="conf">CONFIDENTIAL — PREPARED EXCLUSIVELY FOR THE ADDRESSEE</div>
            <div class="page-num">Page 4 of ${totalPages}</div>
          </div>
        </div>

        <div class="page">
          <div class="brand-header"><img src="${CAMELOT_HEADER_B64}" alt="Camelot Realty Group" /></div>
          <hr class="brand-rule" />
          <h2 class="section">Term, Rate &amp; Fees</h2>
          <table class="info-table">
            <tr><td class="k">Initial Term</td><td>${initialTerm.trim() || '[XX months]'}${commencing.trim() ? `, commencing ${commencing.trim()}` : ', commencing [Date]'}</td></tr>
            <tr><td class="k">Renewal</td><td>${renewalTerms.trim() || "[Auto-renews annually unless terminated with XX days' written notice]"}</td></tr>
            <tr><td class="k">Monthly Management Fee</td><td><strong style="color:#C5A55A;">$${monthly.toLocaleString()}</strong>/mo ($${perUnit}/unit)</td></tr>
            <tr><td class="k">Annual Fee</td><td>$${annual.toLocaleString()}/yr</td></tr>
            <tr><td class="k">Ancillary Fees</td><td>${includeAncillaryFees || includeRateSchedule ? 'Per the attached Schedule(s) below' : 'Available upon request'}</td></tr>
          </table>
          <p class="fee-note">The fee above reflects comparable properties we currently manage, factoring in scope, labor, insurance, overhead, and profit. Services outside the base scope of this proposal — such as lease renewals, sublet/transfer processing, capital project oversight, or tax certiorari coordination — are billed according to our standard Ancillary Fee Sheet and Fee Schedule${includeAncillaryFees || includeRateSchedule ? ', attached to this proposal' : ' (available upon request)'}.</p>
          <p class="fee-note">The full terms, responsibilities, and conditions of our engagement are set forth in Camelot's standard Property Management Agreement, which we will issue once the term and fee above are confirmed.</p>
          <div class="footer-bar">
            57 West 57th Street, Suite 410, New York, NY 10019 &nbsp;·&nbsp; (212) 206-9939 &nbsp;·&nbsp; info@camelot.nyc
            <div class="conf">CONFIDENTIAL — PREPARED EXCLUSIVELY FOR THE ADDRESSEE</div>
            <div class="page-num">Page 5 of ${totalPages}</div>
          </div>
        </div>

        ${includeAncillaryFees ? `<div class="page">
          <div class="brand-header"><img src="${CAMELOT_HEADER_B64}" alt="Camelot Realty Group" /></div>
          <hr class="brand-rule" />
          <h2 class="section">Schedule — Ancillary Fee Sheet</h2>
          <p class="fee-note">The following ancillary fees apply to services outside the base scope of the monthly management fee.</p>
          <table class="fee-table">
            <tr><th>Service</th><th class="amt">Fee</th></tr>
            ${ancillaryFees.map(f => `<tr><td>${f.label}</td><td class="fee-amt">${f.fee}</td></tr>`).join('')}
          </table>
          <div class="footer-bar">
            57 West 57th Street, Suite 410, New York, NY 10019 &nbsp;·&nbsp; (212) 206-9939 &nbsp;·&nbsp; info@camelot.nyc
            <div class="conf">CONFIDENTIAL — PREPARED EXCLUSIVELY FOR THE ADDRESSEE</div>
            <div class="page-num">Page ${pAncillary} of ${totalPages}</div>
          </div>
        </div>` : ''}

        ${includeRateSchedule ? `<div class="page">
          <div class="brand-header"><img src="${CAMELOT_HEADER_B64}" alt="Camelot Realty Group" /></div>
          <hr class="brand-rule" />
          <h2 class="section">Schedule — Fee Schedule</h2>
          <p class="fee-note">The following hourly and per-service rates apply to work outside the base scope of the monthly management fee.</p>
          <table class="fee-table">
            <tr><th>Service</th><th class="amt">Fee</th></tr>
            ${rateSchedule.map(f => `<tr><td>${f.label}</td><td class="fee-amt">${f.fee}</td></tr>`).join('')}
          </table>
          <div class="footer-bar">
            57 West 57th Street, Suite 410, New York, NY 10019 &nbsp;·&nbsp; (212) 206-9939 &nbsp;·&nbsp; info@camelot.nyc
            <div class="conf">CONFIDENTIAL — PREPARED EXCLUSIVELY FOR THE ADDRESSEE</div>
            <div class="page-num">Page ${pSchedule} of ${totalPages}</div>
          </div>
        </div>` : ''}

        <div class="page">
          <div class="brand-header"><img src="${CAMELOT_HEADER_B64}" alt="Camelot Realty Group" /></div>
          <hr class="brand-rule" />
          <h2 class="section">Next Steps</h2>
          <ol class="next-steps">
            <li><b>Discuss This Proposal Further</b> — schedule a call or meeting to walk through scope, fee, and answer any questions.</li>
            <li><b>Finalize Term &amp; Fee</b> — confirm the management term and fee structure that works best for ${finalizeTermPhrase}.</li>
            <li><b>Execute Property Management Agreement</b> — once terms are identified, Camelot will issue the formal Agreement for signature.</li>
            <li><b>Begin Transition</b> — our transition team takes over from there, outlined below.</li>
          </ol>
          <h3 class="sub">Summary of Transitional Procedures</h3>
          <p style="font-size:12.5px;">Camelot understands that a change in management can feel disruptive if it isn't handled carefully. Our transition team works closely with the outgoing management company, ownership, and building staff to make the handoff as seamless as possible — most transitions take 45–60 days. Upon being retained, we contact the outgoing manager directly, request all building files and financial records, and set target dates for payroll, billing, and any time-sensitive operational items so nothing falls through the cracks.</p>
          <h3 class="sub">Budget, Facility &amp; Staff Review</h3>
          <p style="font-size:12.5px;">In parallel with the transition, we conduct a full review of the building's finances, staff, and current vendor relationships against comparable properties in our portfolio. We meet with building staff to understand what's working and what isn't, and we deliver a written report ${financeReportPhrase} within the first 30 days, along with recommendations for cost savings or operational improvements.</p>
          <h3 class="sub">${meetGreetHeading}</h3>
          <p style="font-size:12.5px;">Within the first 30–60 days, we like to introduce the Camelot team to ${meetGreetPhrase}, in person or over Zoom. This gives ${meetGreetSubjectWord} a chance to put a face to the team managing the building, raise any concerns directly, and update contact information on file.</p>
          <p class="thankyou">Thank you again for your consideration.</p>
          <div class="contact-block"><img src="${CAMELOT_CONTACT_B64}" alt="Camelot contact information" /></div>
          <div class="footer-bar">
            57 West 57th Street, Suite 410, New York, NY 10019 &nbsp;·&nbsp; (212) 206-9939 &nbsp;·&nbsp; info@camelot.nyc
            <div class="conf">CONFIDENTIAL — PREPARED EXCLUSIVELY FOR THE ADDRESSEE</div>
            <div class="page-num">Page ${pNextSteps} of ${totalPages}</div>
          </div>
        </div>

      </body></html>`;

      setProposalHTML(proposalHtml);
      setStep('draft');
      toast.success('Proposal draft ready for review');

      // File this proposal in HubSpot (contact create/update) and on the
      // Pipeline board — fire-and-forget so a CRM hiccup never blocks the
      // proposal draft itself.
      const trackingBuilding = buildProposalTrackingBuilding();
      if (trackingBuilding) {
        void trackReportWorkflowEvent({
          building: trackingBuilding,
          reportData: reportData || undefined,
          packageType: 'proposal_of_services',
          packageLabel: 'Proposal of Property Management Services',
          action: 'generated',
          filename: `${getFilenameBase()}.pdf`,
          extraContacts: buildProposalTrackingContacts(),
          metadata: {
            clientType,
            isReceiver,
            recipientOrgName: recipientOrgName.trim() || undefined,
          },
        });
      }
    } catch (e: any) {
      toast.error('Proposal generation failed: ' + (e?.message || 'Unknown error'));
    }
  };

  // Get the current draft content (edited or original)
  const getDraftContent = useCallback(() => {
    return draftRef.current?.innerHTML || proposalHTML;
  }, [proposalHTML]);

  // Generate filename base
  const getFilenameBase = useCallback(() => {
    return reportData ? buildJackieIntelReportFilename(reportData) : 'Camelot-Intel-Report-For_Property';
  }, [reportData]);

  // CRM tracking — HubSpot contact + Pipeline board. Always built from the
  // manually-entered recipient fields on the Verify step (never inferred),
  // matching the same "one-off, editable" rule the rest of the recipient
  // panel follows. Used by both the draft-generation and PDF+Email steps so
  // the Pipeline board and HubSpot see the full lifecycle of a proposal.
  const buildProposalTrackingContacts = () => {
    if (!recipientName.trim() && !recipientEmail.trim() && !recipientPhone.trim()) return [];
    return [{
      name: recipientName.trim() || recipientEmail.trim() || 'Proposal recipient',
      role: recipientTitle.trim() || (isReceiver ? 'Court-Appointed Receiver' : 'Decision maker'),
      email: recipientEmail.trim() || undefined,
      phone: recipientPhone.trim() || undefined,
      company: recipientOrgName.trim() || reportData?.buildingName || reportData?.address,
      source: 'Instant Proposal recipient fields',
    }];
  };

  const buildProposalTrackingBuilding = () => {
    if (!reportData) return null;
    // Jackie report-sourced buildings default to status 'proposal', which the
    // Pipeline Kanban board filters out (it only shows status 'active'), so
    // it's forced to 'active' here — otherwise this proposal would never
    // actually surface on the Pipeline page.
    return { ...buildingFromReportData(reportData, buildProposalTrackingContacts()), status: 'active' };
  };

  // Archives this proposal into the same Proposal Library (`scout_proposals`
  // in Supabase) that the Proposals page reads from, so anything generated
  // through Instant Proposal shows up there too — fire-and-forget, same
  // pattern as trackReportWorkflowEvent, so a DB hiccup never blocks export.
  const saveProposalToLibrary = async (opts: { subject: string; to: string; includedEngagementReport: boolean }) => {
    if (!reportData || !isSupabaseConfigured()) return;
    try {
      const d = reportData;
      const monthly = customFee ?? d.monthlyFee ?? 0;
      const perUnit = d.units ? Math.round(monthly / d.units) : (d.pricePerUnit ?? 0);
      await supabase.from('scout_proposals').insert({
        building_address: d.address || d.buildingName || 'Unknown property',
        contact_name: recipientName.trim() || undefined,
        contact_email: opts.to,
        pricing_per_unit: perUnit,
        total_monthly: monthly,
        total_annual: monthly * 12,
        sections: {
          source: 'instant_proposal',
          client_type: clientType,
          is_receiver: isReceiver,
          included_engagement_report: opts.includedEngagementReport,
          email_subject: opts.subject,
        },
        status: 'draft',
      });
    } catch (e) {
      console.error('Failed to archive proposal to Proposal Library:', e);
    }
  };

  // Export: Download PDF directly (no popup)
  const handleDownloadPDF = async () => {
    if (releaseQA?.failures) {
      toast.error('Jackie found report warnings/review issues; exporting anyway for internal review.', { duration: 5000 });
    }
    const content = getDraftContent();
    if (!content) { toast.error('No proposal content'); return; }
    setPdfLoading(true);
    try {
      const filename = `${getFilenameBase()}.pdf`;
      const blob = await renderProposalPdfBlob(content, filename);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success('PDF downloaded');
    } catch (e: any) {
      console.error('PDF generation error:', e);
      toast.error('PDF download failed — try Download HTML instead');
    } finally {
      setPdfLoading(false);
    }
  };

  // Export: Download HTML
  const handleDownloadHTML = () => {
    if (releaseQA?.failures) {
      toast.error('Jackie found report warnings/review issues; exporting HTML anyway for internal review.', { duration: 5000 });
    }
    const content = getDraftContent();
    const blob = new Blob([content], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${getFilenameBase()}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success('Proposal downloaded');
  };

  // Export: Print using hidden iframe (works on mobile — triggers native print sheet)
  const handlePrint = () => {
    if (releaseQA?.failures) {
      toast.error('Jackie found report warnings/review issues; opening print preview anyway for internal review.', { duration: 5000 });
    }
    const content = getDraftContent();
    if (!content) return;
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (doc) {
      doc.write(`<!DOCTYPE html><html><head><title>Print Proposal</title></head><body>${content}</body></html>`);
      doc.close();
      // Preview only — open in new tab for review before printing
      const previewWin = window.open('', '_blank');
      if (previewWin) {
        previewWin.document.write(`<!DOCTYPE html><html><head><title>Camelot Proposal Preview</title></head><body>${content}</body></html>`);
        previewWin.document.close();
      }
      document.body.removeChild(iframe);
    }
    toast.success('Print dialog opening...');
  };

  // Export: PDF + Email — opens a compose draft for the chosen email provider
  // immediately, with To/Subject/Body pre-filled, and downloads the PDF at the
  // same moment so it's ready to drag into that now-open draft.
  //
  // Plain mailto: only does anything if the OS/browser has a mail app or web
  // handler *registered* for it. Most Gmail users have never registered one,
  // so mailto: silently does nothing — that's what was happening. Gmail and
  // Outlook Web both have their own compose-URL formats that open the actual
  // webmail compose window directly, with zero setup required, so those are
  // used instead when selected below ("Default Mail App" still uses mailto:
  // for people on Outlook/Apple Mail desktop with a real registered handler).
  //
  // Browsers have no API to attach a file to any of these drafts (a
  // deliberate security restriction), so the PDF downloads alongside for a
  // one-step manual attach. Nothing is ever sent automatically.
  const handlePdfEmail = async () => {
    if (!recipientEmail.trim()) {
      toast.error("Enter the recipient's email above before creating the draft");
      return;
    }
    if (releaseQA?.failures) {
      toast.error('Jackie found report warnings/review issues; opening the email draft anyway for internal review.', { duration: 5000 });
    }
    const content = getDraftContent();
    if (!content) { toast.error('No proposal content'); return; }

    // Open a blank tab synchronously, still inside the click handler, so the
    // browser treats it as a direct result of the user's click and doesn't
    // pop-up-block it — we only navigate it to the real URL once it's built,
    // after the (async, several-second) PDF render below.
    const composeTab = emailProvider !== 'default' ? window.open('about:blank', '_blank') : null;

    setEmailLoading(true);
    setPdfLoading(true);
    try {
      const buildingName = reportData?.buildingName || reportData?.address || 'the property';
      const todayStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      const filenameBase = getFilenameBase();
      const filename = `${filenameBase}.pdf`;

      const pdfBlob = await renderProposalPdfBlob(content, filename);

      // Optionally render the Property Engagement Report as a second PDF —
      // sent alongside the proposal as a "gift"/proof-of-intelligence piece.
      let reportBlob: Blob | null = null;
      let reportFilename = '';
      if (includeEngagementReport && jackieHTML) {
        reportFilename = `${filenameBase}-Property-Engagement-Report.pdf`;
        try {
          reportBlob = await renderProposalPdfBlob(jackieHTML, reportFilename);
        } catch (reportErr) {
          console.error('Engagement report PDF render failed:', reportErr);
          toast.error('Proposal PDF is ready, but the Engagement Report PDF failed to render — sending the proposal alone.', { duration: 6000 });
        }
      }

      const address = reportData?.address || buildingName;
      const emailBase: 'coop' | 'condo' | 'rental' = clientType === 'newdev' ? newDevBase : clientType;
      const emailOccupantNoun = emailBase === 'coop' ? 'shareholders' : emailBase === 'condo' ? 'unit owners' : 'tenants';
      const greetName = recipientName.trim() || (isReceiver ? 'Receiver' : emailBase === 'rental' ? 'Ownership' : 'Board');
      const decisionMakerPhrase = isReceiver ? 'you as Receiver' : emailBase === 'rental' ? 'ownership' : 'the Board';
      const entityPhrase = isReceiver
        ? 'the property and the receivership estate you oversee'
        : emailBase === 'rental'
          ? `your ownership and the property's ${emailOccupantNoun}`
          : `your Board and the building's ${emailOccupantNoun}`;

      const subject = `Re: ${address} - Proposal of Services V1. ${todayStr}`;

      // Full cover note — this is what actually belongs in the email and what
      // gets copied to the clipboard for pasting into the draft.
      const fullBody =
        `Dear ${greetName},\n\n` +
        `Thank you for the opportunity to be considered to manage ${buildingName}. Attached please find our Proposal of Property Management Services${reportBlob ? ' along with our Property Engagement Report on the building' : ''}, outlining our recommended scope of services, fee structure, and next steps for transitioning management to Camelot Realty Group.\n\n` +
        `We have taken the time to research the property and are confident that our hands-on approach, responsive team, and vetted network of vendors and contractors can bring real, measurable value to ${entityPhrase}.\n\n` +
        `As a next step, we would welcome the opportunity to schedule a call or meeting to walk through this proposal in detail and answer any questions ${decisionMakerPhrase} may have. Once the term and fee are confirmed, we can move quickly to finalize the Property Management Agreement and begin a seamless transition — most transitions are completed within 45–60 days of engagement.\n\n` +
        `Please don't hesitate to reach out with any questions in the meantime. We look forward to the possibility of working together.\n\n` +
        `Warm regards,\n${DAVID_GOLDOFF_SIGNATURE_TEXT}`;

      // Gmail's compose deep link (mail.google.com/mail/?view=cm&...) has a
      // known failure mode where a long `body=` query param — this letter
      // runs 1,500+ characters before encoding — trips a server-side
      // "Temporary Error / account unavailable" page instead of opening
      // compose (that's the blank/error page this used to land on). Keeping
      // the URL-embedded body short and reliable, and delivering the real
      // cover letter via clipboard (pasted in one step), fixes it.
      const shortBody =
        `Dear ${greetName},\n\n` +
        `Attached please find our Proposal of Property Management Services for ${buildingName}${reportBlob ? ' along with our Property Engagement Report on the building' : ''}.\n\n` +
        `Full cover note is on your clipboard — paste it here (Ctrl/Cmd+V) before sending.\n\n` +
        `Warm regards,\n${DAVID_GOLDOFF_SIGNATURE_TEXT}`;

      // Download the PDF(s) first so they're already sitting in Downloads by
      // the time the compose window appears.
      const downloadBlob = (blob: Blob, name: string) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name;
        a.click();
        URL.revokeObjectURL(a.href);
      };
      downloadBlob(pdfBlob, filename);
      if (reportBlob) downloadBlob(reportBlob, reportFilename);

      // Copy the full letter to the clipboard so it's one paste away —
      // clipboard writes must happen in the same user-gesture chain, which
      // an async handler like this technically breaks, so this is
      // best-effort and silently ignored if the browser blocks it.
      try { await navigator.clipboard.writeText(fullBody); } catch { /* clipboard may be unavailable */ }

      const to = recipientEmail.trim();
      let providerLabel = 'your email app';
      if (emailProvider === 'gmail') {
        const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(shortBody)}`;
        if (composeTab) composeTab.location.href = url; else window.open(url, '_blank');
        providerLabel = 'Gmail';
      } else if (emailProvider === 'outlook') {
        const url = `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(to)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(shortBody)}`;
        if (composeTab) composeTab.location.href = url; else window.open(url, '_blank');
        providerLabel = 'Outlook Web';
      } else {
        const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(shortBody)}`;
        window.location.href = mailto;
        providerLabel = 'your default mail app';
      }

      const fileWord = reportBlob ? `${filename} and ${reportFilename}` : filename;
      toast.success(`Opening ${providerLabel} with the draft — the full cover note is on your clipboard (paste with Ctrl/Cmd+V), then attach ${fileWord} from your Downloads and review before sending`, { duration: 11000 });

      // File this send in HubSpot + Pipeline (moves the board card to
      // "Contacted") — mirrors the 'generated' tracking call above so the
      // CRM sees the full lifecycle of this proposal. Also logs to the
      // Proposal Library archive so it shows up there, not just Pipeline.
      const trackingBuilding = buildProposalTrackingBuilding();
      if (trackingBuilding) {
        void trackReportWorkflowEvent({
          building: trackingBuilding,
          reportData: reportData || undefined,
          packageType: 'proposal_of_services',
          packageLabel: reportBlob ? 'Proposal of Property Management Services + Property Engagement Report' : 'Proposal of Property Management Services',
          action: 'email_draft_opened',
          filename,
          emailSubject: subject,
          emailBody: fullBody,
          recipients: [to],
          extraContacts: buildProposalTrackingContacts(),
          metadata: { clientType, isReceiver, emailProvider, includedEngagementReport: !!reportBlob, reportFilename: reportBlob ? reportFilename : undefined },
        });
      }
      saveProposalToLibrary({ subject, to, includedEngagementReport: !!reportBlob });
    } catch (e: any) {
      console.error('PDF + Email failed:', e);
      composeTab?.close();
      toast.error('Could not prepare the email draft — try Save as PDF instead');
    } finally {
      setEmailLoading(false);
      setPdfLoading(false);
    }
  };

  // Real Gmail draft with the PDF(s) already attached — no manual
  // download-and-attach step. Requires VITE_GOOGLE_GMAIL_CLIENT_ID to be
  // configured (see src/lib/google-gmail.ts); the button that calls this
  // is only shown when that's true. Still never sends automatically — the
  // draft opens in Gmail for the user to review and click Send themselves.
  const handleCreateGmailDraft = async () => {
    if (!recipientEmail.trim()) {
      toast.error("Enter the recipient's email above before creating the draft");
      return;
    }
    const content = getDraftContent();
    if (!content) { toast.error('No proposal content'); return; }

    setGmailDraftLoading(true);
    try {
      const token = await getGmailComposeToken();

      const buildingName = reportData?.buildingName || reportData?.address || 'the property';
      const todayStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      const filenameBase = getFilenameBase();
      const filename = `${filenameBase}.pdf`;

      const pdfBlob = await renderProposalPdfBlob(content, filename);

      let reportBlob: Blob | null = null;
      let reportFilename = '';
      if (includeEngagementReport && jackieHTML) {
        reportFilename = `${filenameBase}-Property-Engagement-Report.pdf`;
        try {
          reportBlob = await renderProposalPdfBlob(jackieHTML, reportFilename);
        } catch (reportErr) {
          console.error('Engagement report PDF render failed:', reportErr);
          toast.error('Proposal PDF is ready, but the Engagement Report PDF failed to render — sending the proposal alone.', { duration: 6000 });
        }
      }

      const address = reportData?.address || buildingName;
      const emailBase: 'coop' | 'condo' | 'rental' = clientType === 'newdev' ? newDevBase : clientType;
      const emailOccupantNoun = emailBase === 'coop' ? 'shareholders' : emailBase === 'condo' ? 'unit owners' : 'tenants';
      const greetName = recipientName.trim() || (isReceiver ? 'Receiver' : emailBase === 'rental' ? 'Ownership' : 'Board');
      const decisionMakerPhrase = isReceiver ? 'you as Receiver' : emailBase === 'rental' ? 'ownership' : 'the Board';
      const entityPhrase = isReceiver
        ? 'the property and the receivership estate you oversee'
        : emailBase === 'rental'
          ? `your ownership and the property's ${emailOccupantNoun}`
          : `your Board and the building's ${emailOccupantNoun}`;

      const subject = `Re: ${address} - Proposal of Services V1. ${todayStr}`;
      const fullBody =
        `Dear ${greetName},\n\n` +
        `Thank you for the opportunity to be considered to manage ${buildingName}. Attached please find our Proposal of Property Management Services${reportBlob ? ' along with our Property Engagement Report on the building' : ''}, outlining our recommended scope of services, fee structure, and next steps for transitioning management to Camelot Realty Group.\n\n` +
        `We have taken the time to research the property and are confident that our hands-on approach, responsive team, and vetted network of vendors and contractors can bring real, measurable value to ${entityPhrase}.\n\n` +
        `As a next step, we would welcome the opportunity to schedule a call or meeting to walk through this proposal in detail and answer any questions ${decisionMakerPhrase} may have. Once the term and fee are confirmed, we can move quickly to finalize the Property Management Agreement and begin a seamless transition — most transitions are completed within 45–60 days of engagement.\n\n` +
        `Please don't hesitate to reach out with any questions in the meantime. We look forward to the possibility of working together.\n\n` +
        `Warm regards,\n${DAVID_GOLDOFF_SIGNATURE_TEXT}`;

      const attachments = [{ blob: pdfBlob, filename, mimeType: 'application/pdf' }];
      if (reportBlob) attachments.push({ blob: reportBlob, filename: reportFilename, mimeType: 'application/pdf' });

      const to = recipientEmail.trim();
      const draft = await createGmailDraftWithAttachments({ accessToken: token, to, subject, bodyText: fullBody, attachments });

      window.open(draft.draftUrl, '_blank');
      toast.success(
        `Gmail draft created with ${attachments.length === 2 ? 'both PDFs' : 'the proposal PDF'} already attached — review and send from the tab that just opened.`,
        { duration: 9000 }
      );

      const trackingBuilding = buildProposalTrackingBuilding();
      if (trackingBuilding) {
        void trackReportWorkflowEvent({
          building: trackingBuilding,
          reportData: reportData || undefined,
          packageType: 'proposal_of_services',
          packageLabel: reportBlob ? 'Proposal of Property Management Services + Property Engagement Report' : 'Proposal of Property Management Services',
          action: 'email_draft_opened',
          filename,
          emailSubject: subject,
          emailBody: fullBody,
          recipients: [to],
          extraContacts: buildProposalTrackingContacts(),
          metadata: { clientType, isReceiver, emailProvider: 'gmail', includedEngagementReport: !!reportBlob, reportFilename: reportBlob ? reportFilename : undefined, autoAttached: true, gmailDraftId: draft.draftId },
        });
      }
      saveProposalToLibrary({ subject, to, includedEngagementReport: !!reportBlob });
    } catch (e: any) {
      console.error('Gmail auto-attach draft failed:', e);
      toast.error(e?.message || 'Could not create the Gmail draft — try "PDF + Email" instead (manual attach).', { duration: 7000 });
    } finally {
      setGmailDraftLoading(false);
    }
  };

  const d = reportData;
  const displayFee = customFee ?? (d?.monthlyFee ?? 0);
  const displayPerUnit = d?.units ? Math.round(displayFee / d.units) : (d?.pricePerUnit ?? 0);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Jackie Report Modal */}
      {showJackieModal && jackieHTML && (
        <ReportModal
          html={jackieHTML}
          title={`Property Engagement Report — ${d?.buildingName || 'Property'}`}
          onClose={() => setShowJackieModal(false)}
        />
      )}

      {/* Proposal Preview Modal */}
      {showProposalModal && proposalHTML && (
        <ReportModal
          html={getDraftContent()}
          title={`Proposal Preview — ${d?.buildingName || 'Property'}`}
          onClose={() => setShowProposalModal(false)}
        />
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-camelot-gold rounded-lg flex items-center justify-center">
          <Zap size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-camelot-navy font-heading">Instant Proposal</h1>
          <p className="text-sm text-gray-500">Search → Verify → Engagement Report → Draft → Send</p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1 mb-8 bg-gray-50 rounded-xl p-3">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isActive = s.key === step;
          const isPast = i < stepIndex;
          return (
            <div key={s.key} className="flex items-center gap-1 flex-1">
              <button
                onClick={() => isPast ? setStep(s.key) : undefined}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all flex-1 justify-center ${
                  isActive ? 'bg-camelot-gold text-white shadow-md' :
                  isPast ? 'bg-camelot-navy/10 text-camelot-navy cursor-pointer hover:bg-camelot-navy/20' :
                  'bg-white text-gray-400'
                }`}
              >
                <Icon size={14} />
                <span className="hidden sm:inline">{s.label}</span>
              </button>
              {i < STEPS.length - 1 && <ChevronRight size={14} className="text-gray-300 flex-shrink-0" />}
            </div>
          );
        })}
      </div>

      {/* Step 1: Search */}
      {step === 'search' && (
        <div className="relative bg-white rounded-2xl border border-gray-200 p-8 text-center overflow-hidden">
          {/* Loading overlay */}
          {loading && (
            <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-10 flex flex-col items-center justify-center rounded-2xl">
              <Loader2 size={36} className="animate-spin text-camelot-gold mb-3" />
              <p className="text-camelot-navy font-semibold">Fetching NYC property data...</p>
              <p className="text-sm text-gray-500 mt-1">Querying HPD, DOF, DOB, ACRIS &amp; more</p>
            </div>
          )}
          <h2 className="text-lg font-bold text-camelot-navy mb-2">Enter Property Address</h2>
          <p className="text-sm text-gray-500 mb-6">We'll pull all available data from NYC open data sources</p>
          <div className="flex flex-col sm:flex-row gap-3 max-w-xl mx-auto">
            <input
              type="text"
              placeholder="e.g. 1770 Grand Concourse, Bronx"
              value={address}
              onChange={e => setAddress(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-camelot-gold/50 focus:border-camelot-gold"
            />
            <select
              value={borough}
              onChange={e => setBorough(e.target.value)}
              className="px-3 py-3 border border-gray-300 rounded-xl text-sm bg-white"
            >
              <option value="">Auto-detect borough</option>
              <option value="Manhattan">Manhattan</option>
              <option value="Brooklyn">Brooklyn</option>
              <option value="Bronx">Bronx</option>
              <option value="Queens">Queens</option>
              <option value="Staten Island">Staten Island</option>
            </select>
          </div>
          <div className="flex items-center justify-center gap-2 mt-3 max-w-xl mx-auto">
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-wide whitespace-nowrap">or by Block &amp; Lot</span>
            <input
              type="text"
              placeholder="Block (e.g. 198)"
              value={blockNum}
              onChange={e => setBlockNum(e.target.value)}
              className="w-32 px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-camelot-gold/50"
            />
            <input
              type="text"
              placeholder="Lot (e.g. 126)"
              value={lotNum}
              onChange={e => setLotNum(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleBblSearch()}
              className="w-28 px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-camelot-gold/50"
            />
            <button
              onClick={handleBblSearch}
              disabled={loading}
              className="px-4 py-2 border border-camelot-gold text-camelot-gold rounded-xl font-semibold text-xs hover:bg-camelot-gold/10 transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              Find by Block/Lot
            </button>
          </div>
          <div className="flex items-center justify-center gap-3 mt-4">
            <button
              onClick={handleSearch}
              disabled={loading}
              className="px-8 py-3 bg-camelot-gold text-white rounded-xl font-semibold text-sm hover:bg-camelot-gold/90 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? <><Loader2 size={16} className="animate-spin" /> Searching...</> : <><Search size={16} /> Search Property</>}
            </button>
            <button
              onClick={handleTryDemo}
              disabled={loading}
              className="px-5 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              Try Demo
            </button>
            <button
              onClick={loadLastInputs}
              disabled={loading}
              className="px-5 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-semibold text-sm hover:border-camelot-gold hover:text-camelot-gold transition-colors disabled:opacity-50"
            >
              Load Last Inputs
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-3">Demo loads 201 East 79th Street, Manhattan</p>
        </div>
      )}

      {/* Step 2: Verify */}
      {step === 'verify' && d && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-camelot-navy">Verify Property Data</h2>
            <button onClick={() => setStep('search')} className="text-sm text-gray-500 hover:text-camelot-gold flex items-center gap-1">
              <ArrowLeft size={14} /> Back
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-camelot-cream rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-camelot-gold">{d.units}</div>
              <div className="text-[10px] text-gray-500 uppercase">Units</div>
            </div>
            <div className="bg-camelot-cream rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-camelot-navy">{d.stories}</div>
              <div className="text-[10px] text-gray-500 uppercase">Stories</div>
            </div>
            <div className={`rounded-lg p-3 text-center ${d.violationsOpen > 20 ? 'bg-red-50' : d.violationsOpen > 5 ? 'bg-amber-50' : 'bg-green-50'}`}>
              <div className={`text-2xl font-bold ${d.violationsOpen > 20 ? 'text-red-600' : d.violationsOpen > 5 ? 'text-amber-600' : 'text-green-600'}`}>{d.violationsOpen}</div>
              <div className="text-[10px] text-gray-500 uppercase">Open Violations</div>
            </div>
            <div className="bg-camelot-cream rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-camelot-navy">{d.scoutGrade}</div>
              <div className="text-[10px] text-gray-500 uppercase">Grade</div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mb-4">
            <div className="border border-gray-100 rounded-lg p-3">
              <span className="text-gray-500">Address:</span> <strong>{d.address}</strong>
            </div>
            <div className="border border-gray-100 rounded-lg p-3">
              <span className="text-gray-500">BBL:</span> <strong>{d.bbl ? String(d.bbl).replace(/\.0+$/, '') : 'N/A'}</strong>
            </div>
            <div className="border border-gray-100 rounded-lg p-3">
              <span className="text-gray-500">Type:</span> <strong>{d.propertyType}</strong>
            </div>
            <div className="border border-gray-100 rounded-lg p-3">
              <span className="text-gray-500">Year Built:</span> <strong>{d.yearBuilt}</strong>
            </div>
            <div className="border border-gray-100 rounded-lg p-3">
              <span className="text-gray-500">Management:</span> <strong>{d.managementCompany || 'Management to verify'}</strong>
            </div>
            <div className="border border-gray-100 rounded-lg p-3">
              <span className="text-gray-500">Owner:</span> <strong>{d.registrationOwner || d.dofOwner || 'Unknown'}</strong>
            </div>
            <div className="border border-gray-100 rounded-lg p-3 sm:col-span-2">
              <span className="text-gray-500 block mb-1">Monthly Fee:</span>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-camelot-gold font-bold text-sm">$</span>
                <input
                  type="number"
                  min={0}
                  value={displayFee}
                  onChange={e => setCustomFee(e.target.value === '' ? 0 : Number(e.target.value))}
                  className="w-28 px-2 py-1 border border-gray-300 rounded-lg text-sm font-bold text-camelot-gold focus:outline-none focus:ring-2 focus:ring-camelot-gold/50"
                />
                <span className="text-xs text-gray-400">/mo (${displayPerUnit}/unit) · suggested ${d.monthlyFee.toLocaleString()}</span>
                {customFee !== null && customFee !== d.monthlyFee && (
                  <button onClick={() => setCustomFee(null)} className="text-xs text-gray-400 hover:text-camelot-gold underline">
                    Reset to suggested
                  </button>
                )}
              </div>
            </div>
            <div className="border border-gray-100 rounded-lg p-3">
              <span className="text-gray-500">ECB Penalties:</span> <strong>${d.ecbPenaltyBalance.toLocaleString()}</strong>
            </div>
            <div className="border border-gray-100 rounded-lg p-3 sm:col-span-2">
              <span className="text-gray-500 block mb-1">Term &amp; Renewal:</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="Initial term (e.g. 12 months)"
                  value={initialTerm}
                  onChange={e => setInitialTerm(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-camelot-gold/50"
                />
                <input
                  type="text"
                  placeholder="Commencing (e.g. upon execution)"
                  value={commencing}
                  onChange={e => setCommencing(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-camelot-gold/50"
                />
                <input
                  type="text"
                  placeholder="Renewal (e.g. Auto-renews annually, 60 days' notice)"
                  value={renewalTerms}
                  onChange={e => setRenewalTerms(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-camelot-gold/50"
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-1">Feeds the "Term, Rate &amp; Fees" page of the proposal — left blank shows a bracketed placeholder to fill in manually.</p>
            </div>
          </div>

          {/* Property identification — richer source data for confirming this is the right building */}
          <div className="mb-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Property Identification</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="border border-gray-100 rounded-lg p-3">
                <span className="text-gray-500">Square Footage:</span> <strong>{d.buildingArea ? `${d.buildingArea.toLocaleString()} sq ft` : 'N/A'}</strong>
              </div>
              <div className="border border-gray-100 rounded-lg p-3">
                <span className="text-gray-500">Lot Area:</span> <strong>{d.lotArea ? `${d.lotArea.toLocaleString()} sq ft` : 'N/A'}</strong>
              </div>
              <div className="border border-gray-100 rounded-lg p-3">
                <span className="text-gray-500">Residential / Total Units:</span> <strong>{d.unitsResidential ?? d.units} / {d.unitsTotalAll ?? d.units}</strong>
              </div>
              <div className="border border-gray-100 rounded-lg p-3">
                <span className="text-gray-500">HPD Registration (MDR):</span> <strong>{d.registrationDate ? `On file since ${d.registrationDate}` : 'Not registered / N/A'}</strong>
              </div>
              <div className="border border-gray-100 rounded-lg p-3">
                <span className="text-gray-500">Last Sale (ACRIS):</span>{' '}
                <strong>{d.lastSalePrice ? `$${d.lastSalePrice.toLocaleString()}${d.lastSaleDate ? ` on ${d.lastSaleDate}` : ''}` : 'No sale on record'}</strong>
              </div>
              <div className="border border-gray-100 rounded-lg p-3">
                <span className="text-gray-500">DOB Permits:</span> <strong>{d.permitsCount ?? 0} filed{d.hasRecentPermits ? ' (recent activity)' : ''}</strong>
              </div>
              <div className="border border-gray-100 rounded-lg p-3 sm:col-span-2">
                <span className="text-gray-500 block mb-1">Unit Mix (studios / 1BR / 2BR / 3BR+):</span>
                <input
                  type="text"
                  value={unitMix}
                  onChange={e => setUnitMix(e.target.value)}
                  placeholder="Not published by NYC Open Data, HPD, ACRIS, or DOB — enter manually if known (e.g. 4 studio, 10 1BR, 8 2BR, 2 3BR)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-camelot-gold/50"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  RealtyMX and PropertyShark don't offer a public data API — cross-check unit mix there manually, or key it in above once confirmed.
                </p>
              </div>
            </div>
          </div>

          {/* Recipient + building type — who this proposal is addressed to, and which
              vocabulary track it reads in (co-op/condo Board, rental Ownership, a new
              development, or a court-appointed receivership on top of any of those). */}
          <div className="mb-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Recipient & Client Type</h3>
            <div className="border border-gray-100 rounded-lg p-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setClientType('coop')}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${clientType === 'coop' ? 'bg-camelot-navy text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  Co-op
                </button>
                <button
                  type="button"
                  onClick={() => setClientType('condo')}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${clientType === 'condo' ? 'bg-camelot-navy text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  Condo
                </button>
                <button
                  type="button"
                  onClick={() => setClientType('rental')}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${clientType === 'rental' ? 'bg-camelot-navy text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  Rental
                </button>
                <button
                  type="button"
                  onClick={() => setClientType('newdev')}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${clientType === 'newdev' ? 'bg-camelot-navy text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  New Development
                </button>
              </div>
              {clientType === 'newdev' && (
                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setNewDevBase('rental')}
                    className={`flex-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${newDevBase === 'rental' ? 'bg-camelot-gold text-white' : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100'}`}
                  >
                    New Rental Building
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewDevBase('condo')}
                    className={`flex-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${newDevBase === 'condo' ? 'bg-camelot-gold text-white' : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100'}`}
                  >
                    Sponsor-Controlled Condo
                  </button>
                </div>
              )}
              <label className="flex items-center gap-2 mb-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isReceiver}
                  onChange={() => setIsReceiver(v => !v)}
                  className="w-4 h-4 accent-camelot-gold"
                />
                <span className="text-xs font-semibold text-camelot-navy">This recipient is a Court-Appointed Receiver</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder={isReceiver ? 'Recipient name (e.g. Marc R. Bergman)' : 'Recipient name'}
                  value={recipientName}
                  onChange={e => setRecipientName(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-camelot-gold/50"
                />
                <input
                  type="text"
                  placeholder={`Title (e.g. ${recipientTitleHint(clientType, newDevBase, isReceiver)})`}
                  value={recipientTitle}
                  onChange={e => setRecipientTitle(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-camelot-gold/50"
                />
                <input
                  type="text"
                  placeholder={recipientOrgHint(clientType, newDevBase, isReceiver)}
                  value={recipientOrgName}
                  onChange={e => setRecipientOrgName(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-camelot-gold/50 sm:col-span-2"
                />
                <textarea
                  placeholder={'Mailing address (one line per row), e.g.\n376 Hollywood Ave. Suite 204\nFairfield, NJ 07004'}
                  value={recipientAddress}
                  onChange={e => setRecipientAddress(e.target.value)}
                  rows={2}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-camelot-gold/50 sm:col-span-2 resize-none"
                />
                <input
                  type="email"
                  placeholder="Recipient email"
                  value={recipientEmail}
                  onChange={e => setRecipientEmail(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-camelot-gold/50"
                />
                <input
                  type="text"
                  placeholder="Recipient phone"
                  value={recipientPhone}
                  onChange={e => setRecipientPhone(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-camelot-gold/50"
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-2">
                Building type controls the vocabulary throughout the proposal (Board vs. Ownership vs. Sponsor) — Co-op and Condo use Board language, Rental and New Rental use Ownership/tenant language. Everything here is a manual, one-off entry for this proposal only — nothing is inferred from the property data collected above.
              </p>
            </div>
          </div>

          {/* Rate sheets — checked schedules are inserted as new pages near the end of the proposal */}
          <div className="mb-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Rate Sheets to Include</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <RateSheetEditor
                title="Ancillary Fee Sheet"
                included={includeAncillaryFees}
                onToggleIncluded={() => setIncludeAncillaryFees(v => !v)}
                lines={ancillaryFees}
                onChangeFee={(i, val) => setAncillaryFees(prev => prev.map((l, idx) => idx === i ? { ...l, fee: val } : l))}
              />
              <RateSheetEditor
                title="Fee Schedule"
                included={includeRateSchedule}
                onToggleIncluded={() => setIncludeRateSchedule(v => !v)}
                lines={rateSchedule}
                onChangeFee={(i, val) => setRateSchedule(prev => prev.map((l, idx) => idx === i ? { ...l, fee: val } : l))}
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400">Confirm data is accurate before proceeding</p>
            <button
              onClick={handleGenerateJackie}
              disabled={loading}
              className="px-6 py-2.5 bg-camelot-gold text-white rounded-xl font-semibold text-sm hover:bg-camelot-gold/90 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? <><Loader2 size={14} className="animate-spin" /> Generating...</> : <>Confirm & Generate Report <ChevronRight size={14} /></>}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Property Engagement Report Preview */}
      {step === 'jackie' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-camelot-navy">Property Engagement Report Generated</h2>
            <button onClick={() => setStep('verify')} className="text-sm text-gray-500 hover:text-camelot-gold flex items-center gap-1">
              <ArrowLeft size={14} /> Back
            </button>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4 flex items-center gap-3">
            <CheckCircle size={20} className="text-green-600" />
            <div>
              <p className="font-semibold text-green-800 text-sm">Property Engagement Report ready — {d?.buildingName}</p>
              <p className="text-xs text-green-600">{d?.units} units · {d?.violationsOpen} open violations · Grade {d?.scoutGrade} · {d?.propertyType} · Fee ${displayFee.toLocaleString()}/mo · Mgmt: {d?.managementCompany || 'Management to verify'}</p>
            </div>
          </div>

          {releaseQA && (
            <div className={`border rounded-lg p-4 mb-4 ${
              releaseQA.failures > 0
                ? 'bg-red-50 border-red-200'
                : releaseQA.warnings > 0
                ? 'bg-amber-50 border-amber-200'
                : 'bg-green-50 border-green-200'
            }`}>
              <div className="flex items-start gap-3">
                {releaseQA.failures > 0 ? (
                  <X size={18} className="text-red-600 mt-0.5" />
                ) : (
                  <CheckCircle size={18} className="text-green-600 mt-0.5" />
                )}
                <div className="min-w-0">
                  <p className={`text-sm font-semibold ${releaseQA.failures > 0 ? 'text-red-800' : 'text-green-800'}`}>
                    Jackie Verified Release {releaseQA.failures > 0 ? 'Needs Review' : 'Ready'}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    {releaseQA.failures > 0
                      ? 'Internal review is available. Board-facing drafts, PDF, HTML, print, and email exports remain available while these checks are reviewed.'
                      : 'External proposal actions are available. Warnings should still be reviewed before sending.'}
                  </p>
                  {(releaseQA.failures > 0 ? releaseQA.checks.filter(c => c.status === 'fail') : releaseQA.checks.filter(c => c.status === 'warn')).slice(0, 4).map((check) => (
                    <p key={`${check.name}-${check.detail}`} className="text-xs text-gray-700 mt-1">
                      <strong>{check.name}:</strong> {check.detail}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Inline Jackie report preview */}
          <div className="border border-gray-200 rounded-xl overflow-hidden mb-4" style={{ height: '50vh' }}>
            <iframe
              srcDoc={jackieHTML}
              title="Property Engagement Report Preview"
              className="w-full h-full"
              sandbox="allow-same-origin"
            />
          </div>

          <div className="flex flex-wrap gap-2 mb-3">
            <button
              onClick={() => setJackieHTML(pitchHTML)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${jackieHTML === pitchHTML ? 'bg-camelot-navy text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              ✨ Intro to Camelot (client-facing)
            </button>
            <button
              onClick={() => setJackieHTML(fullJackieHTML)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${jackieHTML === fullJackieHTML ? 'bg-camelot-navy text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              Property Intelligence Dossier (full, internal)
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setShowJackieModal(true)}
              className="px-4 py-2 bg-camelot-navy/10 text-camelot-navy rounded-lg text-sm font-semibold hover:bg-camelot-navy/20 transition-colors flex items-center gap-2 justify-center"
            >
              <ExternalLink size={14} /> View Full Screen
            </button>
            <button
              onClick={handleGenerateDraft}
              className="px-6 py-2.5 bg-camelot-gold text-white rounded-xl font-semibold text-sm hover:bg-camelot-gold/90 transition-colors flex items-center gap-2 sm:ml-auto justify-center"
            >
              Generate Proposal Draft <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Draft Review (editable) */}
      {step === 'draft' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-camelot-navy">Review & Edit Proposal</h2>
            <div className="flex gap-2">
              <button onClick={() => setStep('jackie')} className="text-sm text-gray-500 hover:text-camelot-gold flex items-center gap-1">
                <ArrowLeft size={14} /> Back
              </button>
              <button
                onClick={() => setShowProposalModal(true)}
                className="px-3 py-1.5 bg-camelot-navy/10 text-camelot-navy rounded-lg text-xs font-semibold hover:bg-camelot-navy/20 transition-colors flex items-center gap-1"
              >
                <ExternalLink size={12} /> Preview
              </button>
              <button
                onClick={() => {
                  // Persist any live edits made in the contentEditable draft into
                  // state before leaving this step — otherwise edits are lost
                  // once the div unmounts on the Export step.
                  if (draftRef.current) setProposalHTML(draftRef.current.innerHTML);
                  setStep('export');
                }}
                className="px-4 py-2 bg-camelot-gold text-white rounded-lg text-sm font-semibold hover:bg-camelot-gold/90 transition-colors flex items-center gap-1"
              >
                Finalize <ChevronRight size={14} />
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-400 mb-3">Tap any text below to edit it directly. Changes are preserved when you export.</p>
          <div
            ref={draftRef}
            contentEditable
            suppressContentEditableWarning
            className="border-2 border-gray-200 rounded-xl p-1 max-h-[70vh] overflow-y-auto focus:outline-none focus:border-camelot-gold/50 -webkit-overflow-scrolling-touch"
            style={{ minHeight: '400px' }}
            dangerouslySetInnerHTML={{ __html: proposalHTML }}
          />
        </div>
      )}

      {/* Step 5: Export */}
      {step === 'export' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-green-600" />
          </div>
          <h2 className="text-lg font-bold text-camelot-navy mb-2">Proposal Ready</h2>
          <p className="text-sm text-gray-500 mb-6">{d?.buildingName} — {d?.units} units — ${displayFee.toLocaleString()}/month</p>

          {/* Include the Engagement Report as a gift — proof to the prospective
              client that Camelot already knows their property in depth. Only
              offered if a report was actually generated in Step 3. */}
          {jackieHTML && (
            <div className="max-w-md mx-auto mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4 text-left">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeEngagementReport}
                  onChange={e => setIncludeEngagementReport(e.target.checked)}
                  className="w-4 h-4 mt-0.5 accent-camelot-gold flex-shrink-0"
                />
                <span>
                  <span className="text-sm font-semibold text-camelot-navy block">Include the Property Engagement Report with this proposal?</span>
                  <span className="text-xs text-gray-500 block mt-0.5">Sends it as a second attachment alongside the proposal — a gift that shows the prospective client we already know their property and can manage it with accuracy.</span>
                </span>
              </label>
            </div>
          )}

          {/* Send To — captured up front so the PDF + Email draft has a real recipient */}
          <div className="max-w-md mx-auto mb-6 bg-gray-50 rounded-xl p-4 text-left">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Send To</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Recipient name (e.g. Jane Smith)"
                value={recipientName}
                onChange={e => setRecipientName(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-camelot-gold/50"
              />
              <input
                type="email"
                placeholder="Recipient email *"
                value={recipientEmail}
                onChange={e => setRecipientEmail(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-camelot-gold/50"
              />
            </div>
            <div className="mt-3">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1.5">Open draft in</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEmailProvider('gmail')}
                  className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors ${emailProvider === 'gmail' ? 'bg-camelot-navy text-white' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-100'}`}
                >
                  Gmail
                </button>
                <button
                  type="button"
                  onClick={() => setEmailProvider('outlook')}
                  className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors ${emailProvider === 'outlook' ? 'bg-camelot-navy text-white' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-100'}`}
                >
                  Outlook Web
                </button>
                <button
                  type="button"
                  onClick={() => setEmailProvider('default')}
                  className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors ${emailProvider === 'default' ? 'bg-camelot-navy text-white' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-100'}`}
                >
                  Default Mail App
                </button>
              </div>
            </div>
            <p className="text-[10px] text-gray-400 mt-2">
              Required for "PDF + Email." Opens a compose draft in the selected service with the recipient, subject, and cover note filled in, and downloads the PDF at the same time to attach — nothing is sent automatically.
            </p>
          </div>

          <div className={`grid grid-cols-2 ${emailProvider === 'gmail' && isGmailComposeConfigured() ? 'md:grid-cols-5' : 'md:grid-cols-4'} gap-3 max-w-3xl mx-auto`}>
            <button onClick={handlePrint} className="flex flex-col items-center gap-2 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
              <Printer size={24} className="text-camelot-navy" />
              <span className="text-xs font-semibold text-camelot-navy">Print</span>
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={pdfLoading}
              className="flex flex-col items-center gap-2 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              {pdfLoading ? (
                <Loader2 size={24} className="text-camelot-gold animate-spin" />
              ) : (
                <Download size={24} className="text-camelot-gold" />
              )}
              <span className="text-xs font-semibold text-camelot-navy">
                {pdfLoading ? 'Generating...' : 'Save as PDF'}
              </span>
            </button>
            <button onClick={handleDownloadHTML} className="flex flex-col items-center gap-2 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
              <FileText size={24} className="text-camelot-navy" />
              <span className="text-xs font-semibold text-camelot-navy">Download HTML</span>
            </button>
            {emailProvider === 'gmail' && isGmailComposeConfigured() && (
              <button
                onClick={handleCreateGmailDraft}
                disabled={gmailDraftLoading}
                className="flex flex-col items-center gap-2 p-4 bg-emerald-50 rounded-xl hover:bg-emerald-100 transition-colors border border-emerald-200 disabled:opacity-50"
              >
                {gmailDraftLoading ? (
                  <Loader2 size={24} className="text-emerald-600 animate-spin" />
                ) : (
                  <Mail size={24} className="text-emerald-600" />
                )}
                <span className="text-xs font-semibold text-camelot-navy text-center">
                  {gmailDraftLoading ? 'Creating draft...' : 'Gmail Draft (Auto-Attach)'}
                </span>
              </button>
            )}
            <button
              onClick={handlePdfEmail}
              disabled={emailLoading}
              className="flex flex-col items-center gap-2 p-4 bg-red-50 rounded-xl hover:bg-red-100 transition-colors border border-red-200 disabled:opacity-50"
            >
              {emailLoading ? (
                <Loader2 size={24} className="text-red-500 animate-spin" />
              ) : (
                <Mail size={24} className="text-red-500" />
              )}
              <span className="text-xs font-semibold text-camelot-navy">
                {emailLoading ? 'Preparing...' : 'PDF + Email'}
              </span>
            </button>
          </div>

          {emailProvider === 'gmail' && isGmailComposeConfigured() ? (
            <div className="max-w-md mx-auto mt-6 bg-emerald-50 rounded-xl p-4 text-left border border-emerald-200">
              <h3 className="text-xs font-bold text-emerald-800 uppercase tracking-wide mb-3">Gmail Draft (Auto-Attach) — recommended</h3>
              <ol className="text-xs text-emerald-900 space-y-2 list-decimal list-inside">
                <li><strong>Click "Gmail Draft (Auto-Attach)"</strong> — the first time, Google will ask you to sign in and approve Camelot OS creating drafts in your Gmail (nothing else — it can't read or send).</li>
                <li><strong>The draft opens</strong> with the recipient, subject, cover note, and PDF{includeEngagementReport && jackieHTML ? 's' : ''} already attached — no downloading or attaching by hand.</li>
                <li><strong>Review and send</strong> from Gmail yourself — nothing goes out automatically.</li>
              </ol>
              <p className="text-[10px] text-emerald-700 mt-3">Prefer the manual route, or using Outlook/another provider? "PDF + Email" still works exactly as before.</p>
            </div>
          ) : (
            /* Step-by-step guidance — browsers can't attach a file to a webmail
               compose window automatically (a security restriction, not a bug),
               so this spells out the two manual steps that remain after
               "PDF + Email" opens the draft. */
            <div className="max-w-md mx-auto mt-6 bg-gray-50 rounded-xl p-4 text-left">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Next steps to send</h3>
              <ol className="text-xs text-gray-600 space-y-2 list-decimal list-inside">
                <li><strong className="text-camelot-navy">Click "PDF + Email"</strong> — downloads the proposal{includeEngagementReport && jackieHTML ? ' and the Property Engagement Report' : ''} to your computer, copies the full cover note to your clipboard, and opens a draft in the service selected above.</li>
                <li><strong className="text-camelot-navy">Paste the cover note</strong> — click into the draft's message body and press Ctrl/Cmd+V (Gmail/Outlook Web don't accept a long cover note through the link itself).</li>
                <li><strong className="text-camelot-navy">Attach the downloaded file{includeEngagementReport && jackieHTML ? 's' : ''}</strong> from your Downloads folder — drag in, or use the paperclip/attach button.</li>
                <li><strong className="text-camelot-navy">Review and send</strong> — nothing goes out automatically; the draft waits for you.</li>
              </ol>
              <p className="text-[10px] text-gray-400 mt-3">This proposal is also logged to Pipeline, HubSpot, and the Proposal Library the moment the draft opens.</p>
            </div>
          )}

          <div className="mt-6 flex gap-3 justify-center">
            <button onClick={() => setStep('draft')} className="text-sm text-gray-500 hover:text-camelot-gold flex items-center gap-1">
              <Edit3 size={14} /> Edit Draft
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
