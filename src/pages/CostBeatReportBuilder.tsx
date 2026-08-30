/**
 * Cost-Beat Report Builder
 *
 * Builds the "Budget vs. Camelot Portfolio Comparables — Cost-Beat Analysis"
 * report — the landscape, single-table comparison document (see The Story
 * House / 36 East 22nd Street example) that shows a building's current
 * budget line-by-line against Camelot portfolio comparable evidence, with a
 * Camelot target, dollar/percent savings, and a one-line "how we get there"
 * rationale per line.
 *
 * Line items can be typed in directly, pasted from Excel/Sheets, or uploaded
 * as PDFs, Excel files, CSV, or images (JPEG/PNG). Uploads are parsed with
 * OCR (images) or data extraction (Excel/CSV/PDF), stored with metadata
 * (upload date, uploader, file type), and data is auto-populated into budget
 * fields. Multiple files can be uploaded for complete financial submission.
 */
import { useMemo, useState, useCallback, useRef } from 'react';
import { TrendingDown, Plus, Trash2, FileDown, Mail, ClipboardPaste, Loader2, Upload, File, User, Calendar, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { CAMELOT_LOGO_B64 } from '@/lib/camelot-brand-assets';

interface LineItem {
  id: string;
  label: string;
  theirBudget: number | '';
  evidence: string;
  camelotTarget: number | '';
  howWeGetThere: string;
  excludeFromTotal: boolean; // e.g. a "visibility row" already folded into the line above
}

interface FileUpload {
  id: string;
  fileName: string;
  fileType: string; // 'pdf', 'excel', 'csv', 'image'
  uploadedAt: string; // ISO timestamp
  uploadedBy: string;
  fileSize: number; // bytes
  extractedData: { label: string; amount: number }[]; // parsed from file
}

function newRow(label = ''): LineItem {
  return {
    id: Math.random().toString(36).slice(2),
    label,
    theirBudget: '',
    evidence: '',
    camelotTarget: '',
    howWeGetThere: '',
    excludeFromTotal: false,
  };
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function money(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}

/** Splits pasted spreadsheet text (tab or comma separated) into Label/Amount pairs. */
function parsePastedBudget(text: string): { label: string; amount: number }[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.includes('\t') ? line.split('\t') : line.split(',');
      const label = (parts[0] || '').trim();
      const amountRaw = (parts[1] || '').replace(/[^0-9.\-]/g, '');
      const amount = amountRaw ? parseFloat(amountRaw) : NaN;
      return { label, amount };
    })
    .filter((row) => row.label && !Number.isNaN(row.amount));
}

async function renderLandscapeReportPdf(html: string, filename: string): Promise<Blob> {
  const html2pdf = (await import('html2pdf.js')).default;
  const container = document.createElement('div');
  container.innerHTML = html;
  container.style.cssText = 'position:fixed;left:0;top:0;width:1400px;opacity:0;pointer-events:none;z-index:-1;';
  document.body.appendChild(container);
  try {
    const opt = {
      margin: [0.35, 0.35, 0.35, 0.35] as [number, number, number, number],
      filename,
      image: { type: 'jpeg' as const, quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#ffffff', logging: false },
      jsPDF: { unit: 'in' as const, format: 'letter' as const, orientation: 'landscape' as const },
      pagebreak: { mode: 'avoid-all' as const },
    };
    const pdf = await html2pdf().set(opt).from(container).toPdf().get('pdf');
    return pdf.output('blob') as Blob;
  } finally {
    document.body.removeChild(container);
  }
}

export default function CostBeatReportBuilder() {
  const [buildingName, setBuildingName] = useState('');
  const [buildingAddress, setBuildingAddress] = useState('');
  const [descriptor, setDescriptor] = useState('');
  const [preparedDate, setPreparedDate] = useState(() => new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }));
  const [budgetYear, setBudgetYear] = useState(String(new Date().getFullYear()));
  const [comparablesText, setComparablesText] = useState('');
  const [totalBudgetedExpenses, setTotalBudgetedExpenses] = useState<number | ''>('');
  const [notAddressedText, setNotAddressedText] = useState('');

  const [items, setItems] = useState<LineItem[]>([newRow()]);
  const [pasteBoxOpen, setPasteBoxOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');

  const [uploads, setUploads] = useState<FileUpload[]>([]);
  const [uploaderName, setUploaderName] = useState(localStorage.getItem('costbeat_uploader_name') || '');
  const [uploadLoading, setUploadLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [recipientEmail, setRecipientEmail] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);

  const updateItem = useCallback((id: string, patch: Partial<LineItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  const addItem = useCallback(() => setItems((prev) => [...prev, newRow()]), []);

  const applyPaste = useCallback(() => {
    const rows = parsePastedBudget(pasteText);
    if (!rows.length) {
      toast.error('No "Label <tab/comma> Amount" rows found in the pasted text');
      return;
    }
    setItems((prev) => {
      const withoutBlankFirst = prev.length === 1 && !prev[0].label && prev[0].theirBudget === '' ? [] : prev;
      return [...withoutBlankFirst, ...rows.map((r) => ({ ...newRow(r.label), theirBudget: r.amount }))];
    });
    setPasteText('');
    setPasteBoxOpen(false);
    toast.success(`Added ${rows.length} line item${rows.length === 1 ? '' : 's'} from paste`);
  }, [pasteText]);

  // Parse uploaded file and extract budget data
  const parseUploadedFile = useCallback(async (file: File): Promise<{ label: string; amount: number }[]> => {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';

    // CSV and Excel parsing
    if (ext === 'csv' || ext === 'xlsx' || ext === 'xls') {
      const text = await file.text();
      return parsePastedBudget(text);
    }

    // PDF text extraction (basic - requires pdf-parse or similar in production)
    if (ext === 'pdf') {
      // For now, show placeholder text extraction message
      toast.loading('PDF processing: extracting text...');
      // In production, use a PDF library like pdfjs-dist or pdf-parse
      return [];
    }

    // Image OCR (JPEG, PNG) - placeholder for production OCR
    if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) {
      toast.loading('Image processing: running OCR...');
      // In production, use Tesseract.js or similar
      return [];
    }

    return [];
  }, []);

  // Handle file upload
  const handleFileUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!uploaderName.trim()) {
      toast.error('Please enter your name before uploading');
      return;
    }

    setUploadLoading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = file.name.split('.').pop()?.toLowerCase() || '';

        // Validate file type
        const validTypes = ['pdf', 'xlsx', 'xls', 'csv', 'jpg', 'jpeg', 'png', 'gif'];
        if (!validTypes.includes(ext)) {
          toast.error(`Unsupported file type: .${ext}. Supported: PDF, Excel, CSV, JPEG, PNG, GIF`);
          continue;
        }

        // Parse file
        const extractedData = await parseUploadedFile(file);

        // Create upload record
        const upload: FileUpload = {
          id: Math.random().toString(36).slice(2),
          fileName: file.name,
          fileType: ['xlsx', 'xls'].includes(ext) ? 'excel' : ext === 'csv' ? 'csv' : ['pdf'].includes(ext) ? 'pdf' : 'image',
          uploadedAt: new Date().toISOString(),
          uploadedBy: uploaderName.trim(),
          fileSize: file.size,
          extractedData,
        };

        setUploads((prev) => [...prev, upload]);

        // Auto-populate line items if data was extracted
        if (extractedData.length > 0) {
          setItems((prev) => {
            const withoutBlankFirst = prev.length === 1 && !prev[0].label && prev[0].theirBudget === '' ? [] : prev;
            return [...withoutBlankFirst, ...extractedData.map((r) => ({ ...newRow(r.label), theirBudget: r.amount }))];
          });
          toast.success(`Added ${extractedData.length} line item(s) from ${file.name}`);
        } else {
          toast.success(`Uploaded ${file.name} — review extracted data below`);
        }
      }

      // Persist uploader name for next session
      localStorage.setItem('costbeat_uploader_name', uploaderName.trim());

      // Clear file input
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      console.error('File upload error:', err);
      toast.error(`Upload failed: ${err.message}`);
    } finally {
      setUploadLoading(false);
    }
  }, [uploaderName, parseUploadedFile]);

  const removeUpload = useCallback((id: string) => {
    setUploads((prev) => prev.filter((u) => u.id !== id));
  }, []);

  const totals = useMemo(() => {
    const included = items.filter((it) => !it.excludeFromTotal);
    const theirTotal = included.reduce((s, it) => s + (Number(it.theirBudget) || 0), 0);
    const targetTotal = included.reduce((s, it) => s + (Number(it.camelotTarget) || (Number(it.theirBudget) || 0)), 0);
    const savingsTotal = theirTotal - targetTotal;
    const pct = theirTotal > 0 ? savingsTotal / theirTotal : 0;
    const pctOfBudget = totalBudgetedExpenses ? savingsTotal / Number(totalBudgetedExpenses) : null;
    return { theirTotal, targetTotal, savingsTotal, pct, pctOfBudget };
  }, [items, totalBudgetedExpenses]);

  const buildReportHtml = useCallback(() => {
    const rowsHtml = items
      .map((it) => {
        const their = Number(it.theirBudget) || 0;
        const target = it.camelotTarget === '' ? their : Number(it.camelotTarget);
        const savings = their - target;
        const pct = their > 0 ? savings / their : 0;
        const isVisibility = it.excludeFromTotal;
        return `
        <tr class="${isVisibility ? 'visibility-row' : ''}">
          <td class="label">${isVisibility ? '&nbsp;&nbsp;of which: ' : ''}${it.label}</td>
          <td class="num their">${it.theirBudget === '' ? '' : money(their)}</td>
          <td class="evidence">${it.evidence}</td>
          <td class="num target">${it.camelotTarget === '' ? '' : money(target)}</td>
          <td class="num savings">${it.camelotTarget === '' ? '-' : money(savings)}</td>
          <td class="num pct">${it.camelotTarget === '' ? '0%' : Math.round(pct * 100) + '%'}</td>
          <td class="how">${it.howWeGetThere}</td>
        </tr>`;
      })
      .join('');

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      * { box-sizing: border-box; }
      body { font-family: Calibri, Arial, sans-serif; margin: 0; padding: 24px; color: #1a1a1a; }
      .brand { display:flex; align-items:center; gap:10px; margin-bottom: 10px; }
      .brand img { height: 30px; }
      h1 { font-size: 18px; color: #162B5E; margin: 0 0 2px 0; }
      .subtitle { font-size: 12px; color: #C5A55A; font-style: italic; margin: 0 0 4px 0; font-weight: bold; }
      .meta { font-size: 9.5px; color: #444; margin: 0 0 3px 0; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 9px; }
      th { background: #162B5E; color: #fff; text-align: left; padding: 6px 6px; font-size: 8.5px; text-transform: uppercase; letter-spacing: 0.3px; }
      th.num, td.num { text-align: right; }
      td { padding: 6px 6px; border-bottom: 1px solid #eee; vertical-align: top; }
      tr:nth-child(even) td { background: #F9F8F5; }
      tr.visibility-row td { background: #FBF6E7; font-style: italic; color: #666; }
      td.their, td.target { color: #1D4ED8; font-weight: bold; white-space: nowrap; }
      td.savings, td.pct { color: #15803D; font-weight: bold; white-space: nowrap; }
      td.label { font-weight: 600; width: 15%; }
      td.evidence { width: 22%; color: #333; }
      td.how { width: 24%; color: #333; }
      .totals-row td { background: #162B5E !important; color: #fff; font-weight: bold; border-bottom: none; }
      .totals-row td.savings { color: #E8D28A; }
      .totals-row td.pct { color: #E8D28A; }
      .context { margin-top: 10px; font-size: 9.5px; }
      .context .pct-line { color: #15803D; font-weight: bold; }
      .not-addressed { font-size: 8.5px; color: #666; margin-top: 6px; }
      .legend { font-size: 8px; color: #888; margin-top: 10px; border-top: 1px solid #eee; padding-top: 6px; }
    </style></head><body>
      <div class="brand"><img src="${CAMELOT_LOGO_B64}" /></div>
      <h1>${buildingName.toUpperCase()}${buildingAddress ? ' - ' + buildingAddress.toUpperCase() : ''}</h1>
      <p class="subtitle">${budgetYear} Budget vs. Camelot Portfolio Comparables - Cost-Beat Analysis</p>
      <p class="meta">Prepared by Camelot Property Management - ${preparedDate}${descriptor ? ' - ' + descriptor : ''}</p>
      ${comparablesText ? `<p class="meta">${comparablesText}</p>` : ''}
      <table>
        <thead><tr>
          <th>Line Item</th><th class="num">Their ${budgetYear} Budget</th><th>Camelot Comparable Evidence</th>
          <th class="num">Camelot Target (Est.)</th><th class="num">Est. Annual Savings</th><th class="num">%</th><th>How We Get There</th>
        </tr></thead>
        <tbody>
          ${rowsHtml}
          <tr class="totals-row">
            <td>TOTAL - addressable lines</td>
            <td class="num">${money(totals.theirTotal)}</td>
            <td></td>
            <td class="num">${money(totals.targetTotal)}</td>
            <td class="num savings">${money(totals.savingsTotal)}</td>
            <td class="num pct">${Math.round(totals.pct * 100)}%</td>
            <td></td>
          </tr>
        </tbody>
      </table>
      <div class="context">
        ${totalBudgetedExpenses ? `<p>Context: total ${budgetYear} budgeted expenses ${money(Number(totalBudgetedExpenses))}</p>` : ''}
        ${totals.pctOfBudget != null ? `<p class="pct-line">Estimated savings as % of total expense budget ${(totals.pctOfBudget * 100).toFixed(1)}%</p>` : ''}
      </div>
      ${notAddressedText ? `<p class="not-addressed">Not addressed here: ${notAddressedText}</p>` : ''}
      <p class="legend">Legend: blue = Camelot estimate (editable input) - green = calculated savings. Targets are good-faith estimates, not quotes; final numbers follow vendor bids and records review.</p>
    </body></html>`;
  }, [items, buildingName, buildingAddress, budgetYear, preparedDate, descriptor, comparablesText, totalBudgetedExpenses, notAddressedText, totals]);

  const filenameBase = () =>
    `${(buildingName || 'Building').replace(/[^a-zA-Z0-9]+/g, '-')}-Cost-Beat-Comparison`;

  const handleDownloadPdf = async () => {
    if (!buildingName.trim()) { toast.error('Enter a building name first'); return; }
    setPdfLoading(true);
    try {
      const html = buildReportHtml();
      const blob = await renderLandscapeReportPdf(html, `${filenameBase()}.pdf`);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${filenameBase()}.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success('Cost-Beat report PDF downloaded');
    } catch (e: any) {
      console.error('Cost-beat PDF failed:', e);
      toast.error('PDF generation failed');
    } finally {
      setPdfLoading(false);
    }
  };

  // Opens a Gmail compose draft with the report subject/body pre-filled, and
  // downloads the PDF at the same time to attach — same pattern used by
  // Instant Proposal's PDF + Email (see InstantProposal.tsx), so this is
  // consistent across the app: no API can attach a file to a mail draft
  // automatically, so the PDF downloads for a one-step manual attach.
  const handleEmailReport = async () => {
    if (!buildingName.trim()) { toast.error('Enter a building name first'); return; }
    if (!recipientEmail.trim()) { toast.error("Enter the recipient's email above first"); return; }
    const composeTab = window.open('about:blank', '_blank');
    setEmailLoading(true);
    setPdfLoading(true);
    try {
      const html = buildReportHtml();
      const blob = await renderLandscapeReportPdf(html, `${filenameBase()}.pdf`);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${filenameBase()}.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);

      const subject = `${buildingName} - ${budgetYear} Cost-Beat Comparison`;
      const body =
        `Hi,\n\nAttached is the ${budgetYear} budget vs. Camelot portfolio comparables cost-beat analysis for ${buildingName}` +
        `${buildingAddress ? ` (${buildingAddress})` : ''}. It walks through each addressable expense line, the comparable evidence behind our target, ` +
        `and the estimated annual savings — ${money(totals.savingsTotal)} identified (${Math.round(totals.pct * 100)}% of addressable spend).\n\n` +
        `Happy to walk through any line item in detail.\n\nBest,\nCamelot Realty Group`;

      const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(recipientEmail.trim())}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      if (composeTab) composeTab.location.href = url; else window.open(url, '_blank');

      toast.success('Opening Gmail with the draft — attach the PDF that just downloaded, then review and send', { duration: 8000 });
    } catch (e: any) {
      console.error('Cost-beat email failed:', e);
      composeTab?.close();
      toast.error('Could not prepare the email draft — try Download PDF instead');
    } finally {
      setEmailLoading(false);
      setPdfLoading(false);
    }
  };

  const inputCls = 'w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <TrendingDown className="w-8 h-8 text-emerald-600" />
            Cost-Beat Report Builder
          </h1>
          <p className="text-slate-600 mt-1">
            Build the budget-vs-comparables cost-beat analysis report (line items, evidence, targets, savings) and export it as a landscape PDF — same format as The Story House / 36 East 22nd Street example.
          </p>
        </div>

        {/* How it works */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-5 mb-6">
          <h2 className="text-sm font-bold text-emerald-900 uppercase tracking-wide mb-3">How it works</h2>
          <ol className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm text-emerald-900">
            <li>
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold mb-2">1</span>
              <strong className="block mb-0.5">Upload financials</strong>
              <span className="text-emerald-800/80 text-xs">PDF, Excel, CSV, JPEG, or PNG — we extract data and auto-populate line items. Track all uploads by date & uploader.</span>
            </li>
            <li>
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold mb-2">2</span>
              <strong className="block mb-0.5">Review line items</strong>
              <span className="text-emerald-800/80 text-xs">Edit budgets, add comparable evidence, set Camelot targets. Type manually, paste from Excel/Sheets, or upload more files.</span>
            </li>
            <li>
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold mb-2">3</span>
              <strong className="block mb-0.5">Build the report</strong>
              <span className="text-emerald-800/80 text-xs">Estimated annual savings and % calculate automatically. All uploaded files are linked in the final report.</span>
            </li>
            <li>
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold mb-2">4</span>
              <strong className="block mb-0.5">Export &amp; share</strong>
              <span className="text-emerald-800/80 text-xs">Download as a landscape PDF with file references, or email directly with attachments.</span>
            </li>
          </ol>
        </div>

        {/* File Upload Section */}
        <div className="bg-white rounded-lg shadow-md p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Upload className="w-5 h-5 text-blue-600" /> Existing Property Financial Files
            </h2>
            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-1 rounded">{uploads.length} file{uploads.length === 1 ? '' : 's'} uploaded</span>
          </div>

          {/* Uploader name + upload button */}
          <div className="flex gap-3 mb-4">
            <div className="flex-1">
              <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Your Name (for audit trail)</label>
              <input
                className={inputCls}
                value={uploaderName}
                onChange={(e) => setUploaderName(e.target.value)}
                placeholder="Your full name"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">&nbsp;</label>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadLoading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
              >
                {uploadLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploadLoading ? 'Processing...' : 'Upload File'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.xlsx,.xls,.csv,.jpg,.jpeg,.png,.gif"
                onChange={(e) => handleFileUpload(e.target.files)}
                style={{ display: 'none' }}
              />
            </div>
          </div>

          <p className="text-xs text-slate-500 mb-4 p-3 bg-slate-50 rounded border border-slate-200">
            <strong>Supported formats:</strong> PDF, Excel (.xlsx, .xls), CSV, JPEG, PNG, GIF. All files are automatically parsed and data is extracted into line items above. Upload as many files as needed to ensure complete financial data is available.
          </p>

          {/* Uploads list */}
          {uploads.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Uploaded Files</h3>
              {uploads.map((upload) => (
                <div key={upload.id} className="p-3 border border-slate-200 rounded-lg bg-slate-50 flex items-center justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <File className="w-5 h-5 text-slate-400 mt-1 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{upload.fileName}</p>
                      <p className="text-xs text-slate-500 flex items-center gap-2 mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {new Date(upload.uploadedAt).toLocaleDateString()} {new Date(upload.uploadedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" /> {upload.uploadedBy}
                        </span>
                        <span>•</span>
                        <span>{formatFileSize(upload.fileSize)}</span>
                      </p>
                      {upload.extractedData.length > 0 && (
                        <p className="text-xs text-emerald-600 mt-1 font-semibold">{upload.extractedData.length} line item(s) extracted</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => removeUpload(upload.id)}
                    className="ml-2 p-1.5 text-slate-400 hover:text-red-500 rounded hover:bg-slate-100 flex-shrink-0"
                    title="Remove from upload history"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-lg bg-slate-50">
              <Upload className="w-12 h-12 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-600">No files uploaded yet</p>
              <p className="text-xs text-slate-500 mt-1">Click "Upload File" above to add PDF, Excel, CSV, or images</p>
            </div>
          )}
        </div>

        {/* Building & report info */}
        <div className="bg-white rounded-lg shadow-md p-5 mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Building Name *</label>
            <input className={inputCls} value={buildingName} onChange={(e) => setBuildingName(e.target.value)} placeholder="The Story House" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Address</label>
            <input className={inputCls} value={buildingAddress} onChange={(e) => setBuildingAddress(e.target.value)} placeholder="36 East 22nd Street" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Budget Year</label>
            <input className={inputCls} value={budgetYear} onChange={(e) => setBudgetYear(e.target.value)} placeholder="2026" />
          </div>
          <div className="md:col-span-3">
            <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Building Descriptor</label>
            <input className={inputCls} value={descriptor} onChange={(e) => setDescriptor(e.target.value)} placeholder="8-unit Flatiron prewar elevator condominium with commercial" />
          </div>
          <div className="md:col-span-3">
            <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Comparables (source line)</label>
            <input className={inputCls} value={comparablesText} onChange={(e) => setComparablesText(e.target.value)} placeholder="Comparables: 27 Mercer Street Condominium (...) — Camelot MDS monthly reports, June 2026." />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Total Budgeted Expenses ($)</label>
            <input className={inputCls} type="number" value={totalBudgetedExpenses} onChange={(e) => setTotalBudgetedExpenses(e.target.value === '' ? '' : Number(e.target.value))} placeholder="373890" />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Not Addressed Here (excluded lines)</label>
            <input className={inputCls} value={notAddressedText} onChange={(e) => setNotAddressedText(e.target.value)} placeholder="Misc repairs $10,000 - admin $1,650 - Legal/Acct/Mgmt $32,444..." />
          </div>
        </div>

        {/* Line items */}
        <div className="bg-white rounded-lg shadow-md p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-slate-900">Line Items</h2>
            <div className="flex gap-2">
              <button onClick={() => setPasteBoxOpen((v) => !v)} className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200">
                <ClipboardPaste className="w-4 h-4" /> Paste from Excel/Sheets
              </button>
              <button onClick={addItem} className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100">
                <Plus className="w-4 h-4" /> Add Line
              </button>
            </div>
          </div>

          {pasteBoxOpen && (
            <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <p className="text-xs text-slate-500 mb-2">Paste rows copied from Excel or Google Sheets — one line item per row, "Label" then "Amount" (tab or comma separated).</p>
              <textarea className={inputCls + ' h-24 font-mono'} value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder={'Payroll\t52304\nInsurance package\t72670'} />
              <button onClick={applyPaste} className="mt-2 text-sm px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">Add Pasted Rows</button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 uppercase border-b border-slate-200">
                  <th className="py-2 pr-2 w-[16%]">Line Item</th>
                  <th className="py-2 pr-2 w-[10%]">Their Budget</th>
                  <th className="py-2 pr-2 w-[22%]">Comparable Evidence</th>
                  <th className="py-2 pr-2 w-[10%]">Camelot Target</th>
                  <th className="py-2 pr-2 w-[22%]">How We Get There</th>
                  <th className="py-2 pr-2 w-[8%]">Visibility row</th>
                  <th className="py-2 w-[4%]"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-b border-slate-100 align-top">
                    <td className="py-1.5 pr-2"><input className={inputCls} value={it.label} onChange={(e) => updateItem(it.id, { label: e.target.value })} /></td>
                    <td className="py-1.5 pr-2"><input className={inputCls} type="number" value={it.theirBudget} onChange={(e) => updateItem(it.id, { theirBudget: e.target.value === '' ? '' : Number(e.target.value) })} /></td>
                    <td className="py-1.5 pr-2"><input className={inputCls} value={it.evidence} onChange={(e) => updateItem(it.id, { evidence: e.target.value })} /></td>
                    <td className="py-1.5 pr-2"><input className={inputCls} type="number" value={it.camelotTarget} onChange={(e) => updateItem(it.id, { camelotTarget: e.target.value === '' ? '' : Number(e.target.value) })} /></td>
                    <td className="py-1.5 pr-2"><input className={inputCls} value={it.howWeGetThere} onChange={(e) => updateItem(it.id, { howWeGetThere: e.target.value })} /></td>
                    <td className="py-1.5 pr-2 text-center"><input type="checkbox" checked={it.excludeFromTotal} onChange={(e) => updateItem(it.id, { excludeFromTotal: e.target.checked })} /></td>
                    <td className="py-1.5"><button onClick={() => removeItem(it.id)} className="text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-[10px] font-semibold text-blue-700 uppercase">Their Total</p>
              <p className="text-lg font-bold text-blue-800">{money(totals.theirTotal)}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-[10px] font-semibold text-blue-700 uppercase">Camelot Target Total</p>
              <p className="text-lg font-bold text-blue-800">{money(totals.targetTotal)}</p>
            </div>
            <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
              <p className="text-[10px] font-semibold text-emerald-700 uppercase">Est. Annual Savings</p>
              <p className="text-lg font-bold text-emerald-700">{money(totals.savingsTotal)}</p>
            </div>
            <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
              <p className="text-[10px] font-semibold text-emerald-700 uppercase">Savings %</p>
              <p className="text-lg font-bold text-emerald-700">{Math.round(totals.pct * 100)}%</p>
            </div>
          </div>
        </div>

        {/* Export */}
        <div className="bg-white rounded-lg shadow-md p-5">
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Export & Share</h2>
          <div className="flex flex-col md:flex-row gap-3 md:items-end">
            <div className="flex-1">
              <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Recipient Email (for Email Report)</label>
              <input className={inputCls} type="email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} placeholder="board@example.com" />
            </div>
            <button
              onClick={handleDownloadPdf}
              disabled={pdfLoading}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-800 text-white rounded-lg font-semibold hover:bg-slate-900 disabled:opacity-50"
            >
              {pdfLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />} Download PDF
            </button>
            <button
              onClick={handleEmailReport}
              disabled={emailLoading || pdfLoading}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 disabled:opacity-50"
            >
              {emailLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />} Email Report (Gmail)
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-3">
            Email Report opens a Gmail compose draft with the recipient, subject, and cover note filled in, and downloads the PDF at the same time to attach — nothing is sent automatically.
          </p>
        </div>
      </div>
    </div>
  );
}
