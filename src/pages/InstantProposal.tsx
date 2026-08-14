import { useState, useRef, useCallback, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Search, CheckCircle, FileText, Edit3, Download, Printer, Mail, Loader2, ChevronRight, ArrowLeft, Zap, X, ExternalLink, Copy } from 'lucide-react';
import { buildJackieIntelReportFilename, buildMasterReport, generateBrochureHTML, validateJackieReport, type MasterReportData, type QACheckResult } from '@/lib/camelot-report';
import { fetchAddressByBBL } from '@/lib/nyc-api';
import { generatePitchReport } from '@/lib/pitch-report';
import { loadReportInputs, saveReportInputs } from '@/lib/report-input-memory';
import { DAVID_GOLDOFF_SIGNATURE_TEXT } from '@/lib/camelot-signature';
import toast from 'react-hot-toast';

type Step = 'search' | 'verify' | 'jackie' | 'draft' | 'export';

const STEPS: { key: Step; label: string; icon: typeof Search }[] = [
  { key: 'search', label: 'Property', icon: Search },
  { key: 'verify', label: 'Verify', icon: CheckCircle },
  { key: 'jackie', label: 'Jackie Report', icon: FileText },
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
      const monthly = d.monthlyFee || 0;
      const proposalHtml = `<!DOCTYPE html><html><head><meta charset="utf-8" /><style>
        body{font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#222;margin:0;padding:32px;}
        .wrap{max-width:900px;margin:0 auto;}
        h1{color:#0f2a2a;border-bottom:3px solid #c5a55a;padding-bottom:10px;}
        h2{color:#c5a55a;margin-top:28px;}
        .info{background:#f7f5f0;padding:18px;border-radius:8px;margin:16px 0;}
        .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e6e2d8;}
        .row:last-child{border-bottom:none;}
        .label{font-weight:700;color:#555;}
        .pricing{background:#fffaf0;border-left:4px solid #c5a55a;padding:18px;margin:16px 0;}
        ul.services{list-style:none;padding:0;margin:0;}
        ul.services li{padding:8px 0;border-bottom:1px solid #eee;}
        ul.services li:before{content:"\2713  ";color:#c5a55a;font-weight:700;}
        .footer{margin-top:48px;padding-top:16px;border-top:1px solid #ddd;text-align:center;font-size:12px;color:#888;}
      </style></head><body><div class="wrap">
        <h1>Proposal of Property Management Services</h1>
        <p>Prepared for: <strong>${d.buildingName || d.address}</strong></p>

        <h2>Property Information</h2>
        <div class="info">
          <div class="row"><span class="label">Address</span><span>${d.address || 'N/A'}</span></div>
          <div class="row"><span class="label">Units</span><span>${d.units ?? 'N/A'}</span></div>
          <div class="row"><span class="label">Stories</span><span>${d.stories ?? 'N/A'}</span></div>
          <div class="row"><span class="label">Building Type</span><span>${d.propertyType || 'N/A'}</span></div>
          <div class="row"><span class="label">Year Built</span><span>${d.yearBuilt ?? 'N/A'}</span></div>
          <div class="row"><span class="label">Open Violations</span><span>${d.violationsOpen ?? 0}</span></div>
          <div class="row"><span class="label">Grade</span><span>${d.scoutGrade || 'N/A'}</span></div>
          <div class="row"><span class="label">Current Management</span><span>${d.managementCompany || 'Management to verify'}</span></div>
        </div>

        <h2>Pricing Estimate</h2>
        <div class="pricing">
          <div class="row"><span class="label">Monthly Fee</span><span style="font-size:18px;color:#c5a55a;font-weight:700;">$${monthly.toLocaleString()}/mo</span></div>
          <div class="row"><span class="label">Per Unit</span><span>$${d.pricePerUnit ?? 0}/unit</span></div>
          <div class="row"><span class="label">Annual Fee</span><span>$${(monthly * 12).toLocaleString()}/yr</span></div>
        </div>

        <h2>Included Services</h2>
        <ul class="services">
          <li>Property Management — day-to-day building operations, staff oversight, vendor management</li>
          <li>Financial Management — budgeting, accounts payable/receivable, monthly board reporting</li>
          <li>Violation Resolution — HPD, DOB, and ECB violation tracking, resolution, and dismissal</li>
          <li>Maintenance Coordination — work order management, preventive maintenance scheduling</li>
          <li>Resident Communication — ConciergePlus portal, package tracking, announcements</li>
          <li>Insurance Administration — policy review, claims management, certificate tracking</li>
          <li>Capital Planning — reserve fund analysis, project management, contractor procurement</li>
          <li>Compliance &amp; Reporting — annual filings, Local Law compliance, DHCR submissions</li>
        </ul>

        <h2>Why Camelot</h2>
        <p>Camelot Realty Group personally oversees every property in its portfolio with weekly on-site inspections, real-time financial transparency, zero hidden bank fees, and 20+ years of vendor relationships that deliver better pricing and faster response times.</p>

        <div class="footer">
          <p>Camelot Realty Group | 57 West 57th Street, Suite 410 | New York, NY 10019</p>
          <p>(212) 206-9939 | www.camelot.nyc</p>
        </div>
      </div></body></html>`;

      setProposalHTML(proposalHtml);
      setStep('draft');
      toast.success('Proposal draft ready for review');
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

  // Export: Download PDF directly (no popup)
  const handleDownloadPDF = async () => {
    if (releaseQA?.failures) {
      toast.error('Jackie found report warnings/review issues; exporting anyway for internal review.', { duration: 5000 });
    }
    const content = getDraftContent();
    if (!content) { toast.error('No proposal content'); return; }
    setPdfLoading(true);
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      // Create a temporary container for rendering
      const container = document.createElement('div');
      container.innerHTML = content;
      container.style.cssText = 'position:absolute;left:-9999px;top:0;width:800px;';
      document.body.appendChild(container);

      await html2pdf()
        .set({
          margin: [0.5, 0.5, 0.5, 0.5],
          filename: `${getFilenameBase()}.pdf`,
          image: { type: 'jpeg', quality: 0.95 },
          html2canvas: { scale: 2, useCORS: true, logging: false },
          jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
        })
        .from(container)
        .save();

      document.body.removeChild(container);
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

  // Export: Email — build email body, copy to clipboard + open mailto link
  const handleEmail = async () => {
    if (releaseQA?.failures) {
      toast.error('Jackie found report warnings/review issues; opening email draft anyway for internal review.', { duration: 5000 });
    }
    const buildingName = reportData?.buildingName || 'Property';
    const emailBody =
      `Dear Board,\n\n` +
      `Please find attached our Proposal of Property Management Services for ${buildingName}.\n\n` +
      `We have taken the time to research your building and are confident that Camelot can deliver measurable improvements in operations, transparency, and service quality.\n\n` +
      `We look forward to meeting with you — either in person or via Zoom — to discuss this proposal further.\n\n` +
      `Warm regards,\n${DAVID_GOLDOFF_SIGNATURE_TEXT}`;

    const subject = `Proposal of Services — ${buildingName} | Camelot Realty Group`;

    // First download the PDF so they have the attachment ready
    await handleDownloadPDF();

    // Copy email body to clipboard as fallback
    try {
      await navigator.clipboard.writeText(emailBody);
      toast.success('Email text copied to clipboard');
    } catch {
      // Clipboard may not be available
    }

    // Use mailto: link (works on mobile — opens default mail app)
    const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;
    window.location.href = mailto;

    toast.success('Attach the downloaded PDF to your email');
  };

  const d = reportData;

  return (
    <div className="max-w-5xl mx-auto">
      {/* Jackie Report Modal */}
      {showJackieModal && jackieHTML && (
        <ReportModal
          html={jackieHTML}
          title={`Jackie Report — ${d?.buildingName || 'Property'}`}
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
          <p className="text-sm text-gray-500">Search → Verify → Jackie Report → Draft → Send</p>
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
            <div className="border border-gray-100 rounded-lg p-3">
              <span className="text-gray-500">Proposed Fee:</span> <strong className="text-camelot-gold">${d.monthlyFee.toLocaleString()}/mo (${d.pricePerUnit}/unit)</strong>
            </div>
            <div className="border border-gray-100 rounded-lg p-3">
              <span className="text-gray-500">ECB Penalties:</span> <strong>${d.ecbPenaltyBalance.toLocaleString()}</strong>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400">Confirm data is accurate before proceeding</p>
            <button
              onClick={handleGenerateJackie}
              disabled={loading}
              className="px-6 py-2.5 bg-camelot-gold text-white rounded-xl font-semibold text-sm hover:bg-camelot-gold/90 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? <><Loader2 size={14} className="animate-spin" /> Generating...</> : <>Confirm & Generate Jackie <ChevronRight size={14} /></>}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Jackie Report Preview */}
      {step === 'jackie' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-camelot-navy">Jackie Report Generated</h2>
            <button onClick={() => setStep('verify')} className="text-sm text-gray-500 hover:text-camelot-gold flex items-center gap-1">
              <ArrowLeft size={14} /> Back
            </button>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4 flex items-center gap-3">
            <CheckCircle size={20} className="text-green-600" />
            <div>
              <p className="font-semibold text-green-800 text-sm">Jackie report ready — {d?.buildingName}</p>
              <p className="text-xs text-green-600">{d?.units} units · {d?.violationsOpen} open violations · Grade {d?.scoutGrade} · {d?.propertyType} · Fee ${d?.monthlyFee.toLocaleString()}/mo · Mgmt: {d?.managementCompany || 'Management to verify'}</p>
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
              title="Jackie Report Preview"
              className="w-full h-full"
              sandbox="allow-same-origin"
            />
          </div>

          <div className="flex flex-wrap gap-2 mb-3">
            <button
              onClick={() => setJackieHTML(pitchHTML)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${jackieHTML === pitchHTML ? 'bg-camelot-navy text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              ✨ Pitch Report (External)
            </button>
            <button
              onClick={() => setJackieHTML(fullJackieHTML)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${jackieHTML === fullJackieHTML ? 'bg-camelot-navy text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              Full Report (Internal)
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
                onClick={() => setStep('export')}
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
          <p className="text-sm text-gray-500 mb-6">{d?.buildingName} — {d?.units} units — ${d?.monthlyFee.toLocaleString()}/month</p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-2xl mx-auto">
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
            <button onClick={handleEmail} className="flex flex-col items-center gap-2 p-4 bg-red-50 rounded-xl hover:bg-red-100 transition-colors border border-red-200">
              <Mail size={24} className="text-red-500" />
              <span className="text-xs font-semibold text-camelot-navy">PDF + Email</span>
            </button>
          </div>

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
import { useState, useRef, useCallback, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Search, CheckCircle, FileText, Edit3, Download, Printer, Mail, Loader2, ChevronRight, ArrowLeft, Zap, X, ExternalLink, Copy } from 'lucide-react';
import { buildJackieIntelReportFilename, buildMasterReport, generateBrochureHTML, validateJackieReport, type MasterReportData, type QACheckResult } from '@/lib/camelot-report';
import { fetchAddressByBBL } from '@/lib/nyc-api';
import { generatePitchReport } from '@/lib/pitch-report';
import { loadReportInputs, saveReportInputs } from '@/lib/report-input-memory';
import { DAVID_GOLDOFF_SIGNATURE_TEXT } from '@/lib/camelot-signature';
import toast from 'react-hot-toast';

type Step = 'search' | 'verify' | 'jackie' | 'draft' | 'export';

const STEPS: { key: Step; label: string; icon: typeof Search }[] = [
  { key: 'search', label: 'Property', icon: Search },
  { key: 'verify', label: 'Verify', icon: CheckCircle },
  { key: 'jackie', label: 'Jackie Report', icon: FileText },
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
    // Render Jackie HTML in a hidden iframe to extract the proposal
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:absolute;width:0;height:0;border:0;opacity:0;pointer-events:none;';
    document.body.appendChild(iframe);
    iframe.contentDocument?.write(jackieHTML);
    iframe.contentDocument?.close();
    try {
      const win = iframe.contentWindow as any;
      if (win && typeof win.generateProposal === 'function') {
        // Intercept window.open inside the iframe so it captures HTML instead of opening a popup
        let capturedHTML = '';
        win.window.open = function () {
          return {
            document: {
              write: function (h: string) { capturedHTML = h; },
              close: function () {},
            },
            print: function () {},
          };
        };
        win.generateProposal();
        if (capturedHTML) {
          setProposalHTML(capturedHTML);
          setStep('draft');
          toast.success('Proposal draft ready for review');
        } else {
          toast.error('Could not generate proposal');
        }
      } else {
        toast.error('Proposal generation not available');
      }
    } catch (e) {
      toast.error('Proposal generation error');
    }
    document.body.removeChild(iframe);
  };

  // Get the current draft content (edited or original)
  const getDraftContent = useCallback(() => {
    return draftRef.current?.innerHTML || proposalHTML;
  }, [proposalHTML]);

  // Generate filename base
  const getFilenameBase = useCallback(() => {
    return reportData ? buildJackieIntelReportFilename(reportData) : 'Camelot-Intel-Report-For_Property';
  }, [reportData]);

  // Export: Download PDF directly (no popup)
  const handleDownloadPDF = async () => {
    if (releaseQA?.failures) {
      toast.error('Jackie found report warnings/review issues; exporting anyway for internal review.', { duration: 5000 });
    }
    const content = getDraftContent();
    if (!content) { toast.error('No proposal content'); return; }
    setPdfLoading(true);
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      // Create a temporary container for rendering
      const container = document.createElement('div');
      container.innerHTML = content;
      container.style.cssText = 'position:absolute;left:-9999px;top:0;width:800px;';
      document.body.appendChild(container);

      await html2pdf()
        .set({
          margin: [0.5, 0.5, 0.5, 0.5],
          filename: `${getFilenameBase()}.pdf`,
          image: { type: 'jpeg', quality: 0.95 },
          html2canvas: { scale: 2, useCORS: true, logging: false },
          jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
        })
        .from(container)
        .save();

      document.body.removeChild(container);
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

  // Export: Email — build email body, copy to clipboard + open mailto link
  const handleEmail = async () => {
    if (releaseQA?.failures) {
      toast.error('Jackie found report warnings/review issues; opening email draft anyway for internal review.', { duration: 5000 });
    }
    const buildingName = reportData?.buildingName || 'Property';
    const emailBody =
      `Dear Board,\n\n` +
      `Please find attached our Proposal of Property Management Services for ${buildingName}.\n\n` +
      `We have taken the time to research your building and are confident that Camelot can deliver measurable improvements in operations, transparency, and service quality.\n\n` +
      `We look forward to meeting with you — either in person or via Zoom — to discuss this proposal further.\n\n` +
      `Warm regards,\n${DAVID_GOLDOFF_SIGNATURE_TEXT}`;

    const subject = `Proposal of Services — ${buildingName} | Camelot Realty Group`;

    // First download the PDF so they have the attachment ready
    await handleDownloadPDF();

    // Copy email body to clipboard as fallback
    try {
      await navigator.clipboard.writeText(emailBody);
      toast.success('Email text copied to clipboard');
    } catch {
      // Clipboard may not be available
    }

    // Use mailto: link (works on mobile — opens default mail app)
    const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;
    window.location.href = mailto;

    toast.success('Attach the downloaded PDF to your email');
  };

  const d = reportData;

  return (
    <div className="max-w-5xl mx-auto">
      {/* Jackie Report Modal */}
      {showJackieModal && jackieHTML && (
        <ReportModal
          html={jackieHTML}
          title={`Jackie Report — ${d?.buildingName || 'Property'}`}
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
          <p className="text-sm text-gray-500">Search → Verify → Jackie Report → Draft → Send</p>
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
            <div className="border border-gray-100 rounded-lg p-3">
              <span className="text-gray-500">Proposed Fee:</span> <strong className="text-camelot-gold">${d.monthlyFee.toLocaleString()}/mo (${d.pricePerUnit}/unit)</strong>
            </div>
            <div className="border border-gray-100 rounded-lg p-3">
              <span className="text-gray-500">ECB Penalties:</span> <strong>${d.ecbPenaltyBalance.toLocaleString()}</strong>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400">Confirm data is accurate before proceeding</p>
            <button
              onClick={handleGenerateJackie}
              disabled={loading}
              className="px-6 py-2.5 bg-camelot-gold text-white rounded-xl font-semibold text-sm hover:bg-camelot-gold/90 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? <><Loader2 size={14} className="animate-spin" /> Generating...</> : <>Confirm & Generate Jackie <ChevronRight size={14} /></>}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Jackie Report Preview */}
      {step === 'jackie' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-camelot-navy">Jackie Report Generated</h2>
            <button onClick={() => setStep('verify')} className="text-sm text-gray-500 hover:text-camelot-gold flex items-center gap-1">
              <ArrowLeft size={14} /> Back
            </button>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4 flex items-center gap-3">
            <CheckCircle size={20} className="text-green-600" />
            <div>
              <p className="font-semibold text-green-800 text-sm">Jackie report ready — {d?.buildingName}</p>
              <p className="text-xs text-green-600">{d?.units} units · {d?.violationsOpen} open violations · Grade {d?.scoutGrade} · {d?.propertyType} · Fee ${d?.monthlyFee.toLocaleString()}/mo · Mgmt: {d?.managementCompany || 'Management to verify'}</p>
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
              title="Jackie Report Preview"
              className="w-full h-full"
              sandbox="allow-same-origin"
            />
          </div>

          <div className="flex flex-wrap gap-2 mb-3">
            <button
              onClick={() => setJackieHTML(pitchHTML)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${jackieHTML === pitchHTML ? 'bg-camelot-navy text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              ✨ Pitch Report (External)
            </button>
            <button
              onClick={() => setJackieHTML(fullJackieHTML)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${jackieHTML === fullJackieHTML ? 'bg-camelot-navy text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              Full Report (Internal)
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
                onClick={() => setStep('export')}
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
          <p className="text-sm text-gray-500 mb-6">{d?.buildingName} — {d?.units} units — ${d?.monthlyFee.toLocaleString()}/month</p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-2xl mx-auto">
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
            <button onClick={handleEmail} className="flex flex-col items-center gap-2 p-4 bg-red-50 rounded-xl hover:bg-red-100 transition-colors border border-red-200">
              <Mail size={24} className="text-red-500" />
              <span className="text-xs font-semibold text-camelot-navy">PDF + Email</span>
            </button>
          </div>

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

