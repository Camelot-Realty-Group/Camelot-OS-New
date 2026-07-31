import { GOOGLE_MAPS_KEY } from '@/lib/maps-key';
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Search, FileText, Download, Mail, Send, Phone, Table2, Link2, Loader2, Eye, Copy, Check, X, ShieldCheck, ShieldX, AlertTriangle, Printer } from 'lucide-react';
import { REPORT_FOCUS_THEMES, buildJackieIntelReportFilename, buildMasterReport, generateBrochureHTML, generateColdCallerSheet, generateEmailDraft, generateCSVExport, validateJackieReport, type MasterReportData, type QACheckResult, type ReportFocusInput, type ReportFocusKey } from '@/lib/camelot-report';
import { JACKIE_REPORT_PACKAGES, buildJackiePackageFilename, generateBoardMeetingDeck, generateFirstEmailIntroReport, generateJackieReportPackage, generatePitchEmail, type AgendaIntake, type JackieReportPackage } from '@/lib/pitch-report';
import { applyJackieFactAuthority, sanitizeJackieKnownPropertyHtml } from '@/lib/jackie-fact-authority';
import { generatePitchDeck } from '@/lib/pitch-deck-pptx';
import { openBrochureForPrint, downloadAsHTML, downloadAsPDF, triggerCSVDownload, copyToClipboard, openEmailDraft, sendCamelotEmail, getEmailConfigStatus, type EmailConfigStatus } from '@/lib/pdf-generator';
import { loadReportInputs, saveReportInputs } from '@/lib/report-input-memory';
import { DAVID_GOLDOFF_SIGNATURE_TEXT } from '@/lib/camelot-signature';
import { formatLibraryDate, loadLocalJackieReportLibrary, packageLabelFor, removeJackieReportRecord, saveJackieReportRecord, type SavedJackieReport } from '@/lib/jackie-report-library';
import { checkReportConsistency, summarizeConsistencyFindings } from '@/lib/report-consistency';
import { PARTNER_AUDIENCES, buildPartnerPitchFilename, generatePartnerPitchDeck, partnerAudienceLabel, type PartnerAudience, type PartnerFirmInfo } from '@/lib/partner-pitch';
import { pushBuildingToIntegrations } from '@/lib/integrations';
import { trackReportWorkflowEvent } from '@/lib/report-crm-tracking';
import type { Building, Contact } from '@/types'; import { findBuildingPhotos } from '@/lib/building-photos';
import toast from 'react-hot-toast';

type EmailType = 'intro' | 'followup' | 'proposal' | 'compliance' | 'loyalty';
const REPORT_FOCUS_OPTIONS = Object.values(REPORT_FOCUS_THEMES);
const REPORT_CENTER_INPUT_SCOPE = 'jackie-report-center';
const PHOTO_UPLOAD_LIMIT = 12;
const PHOTO_MAX_SOURCE_BYTES = 18 * 1024 * 1024;
const PHOTO_MAX_STORED_CHARS = 170_000;
const PHOTO_INITIAL_MAX_SIDE = 980;
const PHOTO_MIN_MAX_SIDE = 520;
const PHOTO_QUALITY_STEPS = [0.76, 0.68, 0.6, 0.52, 0.46];
const PHOTO_PERSIST_CHAR_LIMIT = 2_200_000;
const SAFE_STORED_PHOTO_RE = /^data:image\/(?:jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/i;

type ReportCenterSavedInputs = {
  address: string;
  borough: string;
  selectedFocus: ReportFocusKey[];
  inquiryContact: string;
  inquiryEmail: string;
  inquiryPhone: string;
  inquiryOrganization: string;
  inquiryRole: string;
  inquiryNotes: string;
  selectedPackage: JackieReportPackage;
};

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

function uniqueEmails(values: string[]) {
  return Array.from(new Set(values.map(v => v.trim().toLowerCase()).filter(Boolean)));
}

function collectReportContactEmails(d: MasterReportData, fallbackEmail?: string) {
  const emails: string[] = [];
  if (fallbackEmail) emails.push(fallbackEmail);
  if (d.reportFocus?.inquiryEmail) emails.push(d.reportFocus.inquiryEmail);
  (d.boardMembers as Array<{ email?: string }> | undefined)?.forEach(member => {
    if (member.email) emails.push(member.email);
  });
  (d.dobOwners || []).forEach(owner => {
    const found = `${owner.name || ''} ${owner.businessName || ''} ${owner.phone || ''}`.match(EMAIL_RE);
    if (found) emails.push(...found);
  });
  (d.contactResearchSources || []).forEach(source => {
    const found = source.match(EMAIL_RE);
    if (found) emails.push(...found);
  });
  return uniqueEmails(emails);
}

function sanitizeStoredPhotoList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => String(item || '').trim())
    .filter(url => {
      if (!url) return false;
      if (url.startsWith('/images/')) return true;
      if (!url.startsWith('data:image/')) return false;
      return url.length <= PHOTO_MAX_STORED_CHARS && SAFE_STORED_PHOTO_RE.test(url);
    })
    .slice(0, PHOTO_UPLOAD_LIMIT);
}

function reportPackageFilenames(d: MasterReportData, packageType: JackieReportPackage) {
  return packageType === 'appendix_full'
    ? {
        pdf: buildJackieIntelReportFilename(d, 'pdf'),
        html: buildJackieIntelReportFilename(d, 'html'),
      }
    : {
        pdf: buildJackiePackageFilename(d, packageType, 'pdf'),
        html: buildJackiePackageFilename(d, packageType, 'html'),
      };
}

function reportDataToBuilding(d: MasterReportData, inquiry?: { name?: string; email?: string; phone?: string; role?: string; organization?: string }): Building {
  const contacts: Contact[] = [];
  if (inquiry?.name || inquiry?.email || inquiry?.phone) {
    contacts.push({
      name: inquiry.name || d.buildingName || d.address,
      role: inquiry.role || 'board_member',
      email: inquiry.email || undefined,
      phone: inquiry.phone || undefined,
      company: inquiry.organization || d.buildingName || d.dofOwner || undefined,
      source: 'Engagement report inquiry contact',
    });
  }
  (d.boardMembers || []).forEach(member => {
    contacts.push({
      name: member.name,
      role: member.title || 'board_member',
      email: (member as any).email,
      phone: (member as any).phone,
      company: d.buildingName || d.dofOwner || undefined,
      source: 'Engagement report contact research',
    });
  });

  return {
    id: `jackie-${(d.bbl || d.address).replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
    address: d.address,
    name: d.buildingName || d.address,
    borough: d.borough,
    neighborhood: d.neighborhoodName,
    zip_code: d.zipCode,
    units: d.units,
    type: /coop|co-op|cooperative|tenancy/i.test(d.propertyType) ? 'co-op' : /condo|hoa/i.test(d.propertyType) ? 'condo' : /mixed/i.test(d.propertyType) ? 'mixed-use' : /commercial|retail|office/i.test(d.propertyType) ? 'commercial' : 'rental',
    year_built: d.yearBuilt,
    lot_area: d.lotArea,
    building_area: d.buildingArea,
    stories: d.stories,
    building_class: d.buildingClass,
    grade: (['A', 'B', 'C'].includes(d.scoutGrade) ? d.scoutGrade : 'C') as Building['grade'],
    score: d.scoutScore,
    signals: (d.distressSignals || []).map(signal => signal.description),
    contacts,
    enriched_data: { source: 'Engagement Report Center', reportFocus: d.reportFocus, bbl: d.bbl },
    current_management: d.managementCompany || undefined,
    source: 'Engagement Report Center',
    status: 'proposal',
    tags: ['jackie-report', `package:${d.reportFocus?.selectedFocus || 'general'}`],
    pipeline_stage: 'proposal',
    bbl: d.bbl,
    violations_count: d.violationsTotal,
    open_violations_count: d.violationsOpen,
    last_violation_date: d.lastViolationDate || undefined,
    market_value: d.marketValue,
    assessed_value: d.assessedValue,
    land_value: d.landValue,
    tax_class: d.taxClass,
    dof_owner: d.dofOwner,
    energy_star_score: d.energyStarScore || undefined,
    site_eui: d.siteEUI || undefined,
    ghg_emissions: d.ghgEmissions || undefined,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function ReleaseWorkflowPanel({
  qa,
  onPreview,
}: {
  qa: QACheckResult;
  onPreview: () => void;
}) {
  const failures = qa.checks.filter(c => c.status === 'fail');
  const warnings = qa.checks.filter(c => c.status === 'warn');
  const passed = qa.checks.filter(c => c.status === 'pass').length;
  const groups = [
    {
      title: 'Identity',
      desc: 'Address, BBL, unit count, floors, building type, and known-property guardrails.',
      checks: qa.checks.filter(c => /Address|Building Name|Unit Count|Borough|Property Type|Known Property|Source Conflict/i.test(c.name)),
    },
    {
      title: 'Sources',
      desc: 'State/town public records, assessor/land records, compliance, commercial/amenity, contacts, and market sources.',
      checks: qa.checks.filter(c => /Source|Commercial|Stakeholder|DOF|Market|Case Studies|Value Creation|Tax|Management Context/i.test(c.name)),
    },
    {
      title: 'Render',
      desc: 'Slides, logos, images, legal link, duplicate pages, and bad tokens.',
      checks: qa.checks.filter(c => /Slide|Render Token|Picture|Logo|Legal|Duplicate|Photo|Partner/i.test(c.name)),
    },
  ];

  return (
    <div className={`rounded-xl border p-5 shadow-sm ${qa.failures ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="flex gap-3">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${qa.failures ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
            {qa.failures ? <ShieldX size={24} /> : <ShieldCheck size={24} />}
          </div>
          <div>
            <h2 className={`text-lg font-bold ${qa.failures ? 'text-red-950' : 'text-emerald-950'}`}>Verified Release</h2>
            <p className={`text-sm mt-1 ${qa.failures ? 'text-red-800' : 'text-emerald-800'}`}>
              {qa.failures
                ? 'Review issues found. Jackie can still preview, export, and draft while the team cleans up source or render warnings.'
                : 'Jackie verified the factual guardrails and render checks for board-facing output.'}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="px-3 py-2 rounded-lg bg-white border text-xs font-semibold text-gray-700">{passed} passed</div>
          <div className="px-3 py-2 rounded-lg bg-white border text-xs font-semibold text-amber-700">{qa.warnings} warnings</div>
          <div className="px-3 py-2 rounded-lg bg-white border text-xs font-semibold text-red-700">{qa.failures} review issues</div>
          <button onClick={onPreview} className="px-3 py-2 rounded-lg bg-[#3A4B5B] text-white text-xs font-semibold flex items-center gap-2 hover:bg-[#2d3d4d]">
            <Eye size={14} /> Verify & Preview
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
        {groups.map(group => {
          const fail = group.checks.filter(c => c.status === 'fail').length;
          const warn = group.checks.filter(c => c.status === 'warn').length;
          const ok = fail === 0;
          return (
            <div key={group.title} className="bg-white border rounded-lg p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-gray-900">{group.title}</h3>
                <span className={`text-[10px] px-2 py-1 rounded-full font-bold ${ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                  {ok ? 'CLEAR' : 'REVIEW'}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-2 leading-relaxed">{group.desc}</p>
              <p className="text-xs mt-3 text-gray-600">{group.checks.length} checks · {warn} warning(s) · {fail} review issue(s)</p>
            </div>
          );
        })}
      </div>

      {(failures.length > 0 || warnings.length > 0) && (
        <div className="mt-4 bg-white border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className={failures.length ? 'text-red-600' : 'text-amber-600'} />
            <h3 className="text-sm font-bold text-gray-900">{failures.length ? 'Review Before Sending' : 'Warnings To Review'}</h3>
          </div>
          <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
            {(failures.length ? failures : warnings).slice(0, 8).map((check, idx) => (
              <div key={`${check.name}-${idx}`} className="text-xs leading-relaxed">
                <span className={`font-bold ${check.status === 'fail' ? 'text-red-700' : 'text-amber-700'}`}>{check.name}:</span>{' '}
                <span className="text-gray-600">{check.detail}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReportCenter() {
  const [address, setAddress] = useState('');
  const [borough, setBorough] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [data, setData] = useState<MasterReportData | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showCallerModal, setShowCallerModal] = useState(false);
  const [emailConfigStatus, setEmailConfigStatus] = useState<EmailConfigStatus | null>(null);
  const [sendingRealEmail, setSendingRealEmail] = useState(false);
  const [hubspotSyncedIds, setHubspotSyncedIds] = useState<{ address: string; contactId?: string; companyId?: string; dealId?: string } | null>(null);
  useEffect(() => { getEmailConfigStatus().then(setEmailConfigStatus).catch(() => setEmailConfigStatus(null)); }, []);
  const [emailType, setEmailType] = useState<EmailType>('intro');
  const [copied, setCopied] = useState(false);
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]); const [autoExteriorPhoto, setAutoExteriorPhoto] = useState<{ url: string; attribution: string } | null>(null); useEffect(() => { let cancelled = false; setAutoExteriorPhoto(null); const addr = data?.address; const name = data?.buildingName || addr; if (!addr) return; findBuildingPhotos(name || addr, addr).then((result: any) => { if (!cancelled && result?.exterior?.[0]) { setAutoExteriorPhoto({ url: result.exterior[0], attribution: result.attribution || '' }); } }).catch(() => {}); return () => { cancelled = true; }; }, [data?.address, data?.buildingName]);
  const [selectedFocus, setSelectedFocus] = useState<ReportFocusKey[]>(['property_management']);
  const [inquiryContact, setInquiryContact] = useState('');
  const [inquiryEmail, setInquiryEmail] = useState('');
  const [inquiryPhone, setInquiryPhone] = useState('');
  const [inquiryOrganization, setInquiryOrganization] = useState('');
  const [inquiryRole, setInquiryRole] = useState('');
  const [inquiryNotes, setInquiryNotes] = useState('');
  const [selectedPackage, setSelectedPackage] = useState<JackieReportPackage>('board_meeting_deck');
  const [agendaIntakeOpen, setAgendaIntakeOpen] = useState(false);
  const [agendaIntake, setAgendaIntake] = useState<AgendaIntake>({});
  const [partnerPitchAudience, setPartnerPitchAudience] = useState<PartnerAudience | null>(null);
  const [savedReports, setSavedReports] = useState<SavedJackieReport[]>(() => loadLocalJackieReportLibrary());
  const [releaseQA, setReleaseQA] = useState<QACheckResult | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const buildReportFocus = useCallback((): ReportFocusInput => ({
    selectedFocus: selectedFocus.length ? selectedFocus : ['property_management'],
    inquiryContact: inquiryContact.trim() || undefined,
    inquiryEmail: inquiryEmail.trim() || undefined,
    inquiryPhone: inquiryPhone.trim() || undefined,
    inquiryOrganization: inquiryOrganization.trim() || undefined,
    inquiryRole: inquiryRole.trim() || undefined,
    inquiryNotes: inquiryNotes.trim() || undefined,
  }), [selectedFocus, inquiryContact, inquiryEmail, inquiryPhone, inquiryOrganization, inquiryRole, inquiryNotes]);

  const buildSavedInputs = useCallback((): ReportCenterSavedInputs => ({
    address,
    borough,
    selectedFocus,
    inquiryContact,
    inquiryEmail,
    inquiryPhone,
    inquiryOrganization,
    inquiryRole,
    inquiryNotes,
    selectedPackage,
  }), [address, borough, selectedFocus, inquiryContact, inquiryEmail, inquiryPhone, inquiryOrganization, inquiryRole, inquiryNotes, selectedPackage]);

  const loadLastInputs = useCallback(() => {
    const saved = loadReportInputs<ReportCenterSavedInputs>(REPORT_CENTER_INPUT_SCOPE);
    if (!saved) {
      toast.error('No saved Jackie report inputs found yet');
      return;
    }
    setAddress(saved.address || '');
    setBorough(saved.borough || '');
    setSelectedFocus(saved.selectedFocus?.length ? saved.selectedFocus : ['property_management']);
    setInquiryContact(saved.inquiryContact || '');
    setInquiryEmail(saved.inquiryEmail || '');
    setInquiryPhone(saved.inquiryPhone || '');
    setInquiryOrganization(saved.inquiryOrganization || '');
    setInquiryRole(saved.inquiryRole || '');
    setInquiryNotes(saved.inquiryNotes || '');
    setSelectedPackage(saved.selectedPackage || 'board_meeting_deck');
    toast.success('Last Jackie report inputs restored');
  }, []);

  const toggleFocus = (key: ReportFocusKey) => {
    setSelectedFocus(prev => {
      const exists = prev.includes(key);
      const next = exists ? prev.filter(item => item !== key) : [...prev, key];
      return next.length ? next : ['property_management'];
    });
  };

  const generate = useCallback(async () => {
    if (!address.trim()) return;
    saveReportInputs(REPORT_CENTER_INPUT_SCOPE, buildSavedInputs());
    setLoading(true);
    setData(null);
    setReleaseQA(null);
    try {
      const regionalSearch = /connecticut|\bct\b|monroe|new jersey|\bnj\b|florida|\bfl\b|nys|new york state/i.test(`${borough} ${address}`);
      setLoadingMsg(regionalSearch ? 'Querying state and town records...' : 'Querying HPD violations...');
      await new Promise(r => setTimeout(r, 300));
      setLoadingMsg(regionalSearch ? 'Pulling assessor, land-record, and market data...' : 'Pulling DOF property data...');
      await new Promise(r => setTimeout(r, 200));
      setLoadingMsg(regionalSearch ? 'Checking HOA/entity and source-specific records...' : 'Fetching ACRIS ownership records...');
      const result = await buildMasterReport(address.trim(), borough || undefined);
      setData({ ...result, reportFocus: buildReportFocus() });
    } catch (err) {
      console.error('Report generation failed:', err);
    } finally {
      setLoading(false);
      setLoadingMsg('');
    }
  }, [address, borough, buildReportFocus, buildSavedInputs]);

  const archiveJackieReport = useCallback((
    reportData: MasterReportData,
    packageType: JackieReportPackage,
    html: string,
    filename: string,
  ) => {
    const generatedAt = new Date().toISOString();
    const reportNumber = `JACKIE-${generatedAt.slice(0, 10).replace(/-/g, '')}-${String(Date.now()).slice(-6)}`;
    const record: SavedJackieReport = {
      id: `${reportNumber}-${packageType}`,
      reportNumber,
      address: reportData.address,
      buildingName: reportData.buildingName || reportData.address,
      borough: reportData.borough,
      packageType,
      packageLabel: packageLabelFor(packageType),
      filename,
      html,
      dataSnapshot: {
        ...reportData,
        buildingPhotos: reportData.buildingPhotos ? {
          exterior: (reportData.buildingPhotos.exterior || []).map((url, idx) => String(url).startsWith('data:') ? `Uploaded photo ${idx + 1} retained in saved HTML` : url),
          interior: (reportData.buildingPhotos.interior || []).map((url, idx) => String(url).startsWith('data:') ? `Uploaded interior photo ${idx + 1} retained in saved HTML` : url),
          streetView: reportData.buildingPhotos.streetView,
          satellite: reportData.buildingPhotos.satellite,
          source: reportData.buildingPhotos.source,
        } : reportData.buildingPhotos,
      },
      inquiryContact: inquiryContact.trim() || undefined,
      inquiryEmail: inquiryEmail.trim() || undefined,
      inquiryPhone: inquiryPhone.trim() || undefined,
      focus: selectedFocus,
      generatedAt,
    };
    const next = saveJackieReportRecord(record);
    setSavedReports(next);
    void trackReportWorkflowEvent({
      building: reportDataToBuilding(reportData, {
        name: inquiryContact,
        email: inquiryEmail,
        phone: inquiryPhone,
        role: inquiryRole,
        organization: inquiryOrganization,
      }),
      reportData,
      packageType,
      packageLabel: record.packageLabel,
      action: 'generated',
      filename,
      reportNumber,
      html,
      extraContacts: [
        {
          name: inquiryContact || reportData.reportFocus?.inquiryContact || '',
          role: inquiryRole || reportData.reportFocus?.inquiryRole || 'Inquiry contact',
          email: inquiryEmail || reportData.reportFocus?.inquiryEmail,
          phone: inquiryPhone || reportData.reportFocus?.inquiryPhone,
          company: inquiryOrganization || reportData.reportFocus?.inquiryOrganization,
          source: 'Engagement Report Center inquiry fields',
        },
      ],
    });
    toast.success(`Saved to Generated Jackie Report Library: ${record.reportNumber}`);
    return record;
  }, [inquiryContact, inquiryEmail, inquiryOrganization, inquiryPhone, inquiryRole, selectedFocus]);

  const openPackageAndArchive = useCallback((
    reportData: MasterReportData,
    packageType: JackieReportPackage,
    html: string,
    pdfFilename: string,
    htmlFilename: string,
  ) => {
    const cleanHtml = sanitizeJackieKnownPropertyHtml(html, reportData).data;
    openBrochureForPrint(cleanHtml, pdfFilename);
    window.setTimeout(() => {
      archiveJackieReport(reportData, packageType, cleanHtml, htmlFilename);
    }, 100);
  }, [archiveJackieReport]);

  const openSavedReport = (record: SavedJackieReport) => {
    openBrochureForPrint(record.html, record.filename.replace(/\.html$/i, '.pdf'));
  };

  const downloadSavedReport = (record: SavedJackieReport) => {
    downloadAsHTML(record.html, record.filename);
  };

  const copySavedReportReference = async (record: SavedJackieReport) => {
    const lines = [
      `Report #: ${record.reportNumber}`,
      `Address: ${record.address}`,
      `Package: ${record.packageLabel}`,
      `Generated: ${formatLibraryDate(record.generatedAt)}`,
      record.inquiryContact ? `Contact: ${record.inquiryContact}` : '',
      record.inquiryEmail ? `Email: ${record.inquiryEmail}` : '',
      record.inquiryPhone ? `Phone: ${record.inquiryPhone}` : '',
      `File: ${record.filename}`,
    ].filter(Boolean).join('\n');
    const ok = await copyToClipboard(lines);
    if (ok) toast.success('Jackie report reference copied');
  };

  const deleteSavedReport = (id: string) => {
    const next = removeJackieReportRecord(id);
    setSavedReports(next);
    toast.success('Removed saved Jackie report');
  };

  const handlePreviewBrochure = () => {
    const d = getDataWithPhotos();
    if (!d) return;
    const html = generateBrochureHTML(d);
    if (!verifyJackieRelease(d, html, 'internal', 'appendix_full')) return;
    openPackageAndArchive(d, 'appendix_full', html, buildJackieIntelReportFilename(d, 'pdf'), buildJackieIntelReportFilename(d, 'html'));
  };

  const generateSelectedPackageHTML = (d: MasterReportData): string => {
    if (selectedPackage === 'appendix_full') return generateBrochureHTML(d);
    return generateJackieReportPackage(d, selectedPackage, selectedPackage === 'board_meeting_deck' ? agendaIntake : undefined);
  };

  const handlePreviewSelectedPackage = () => {
    const d = getDataWithPhotos();
    if (!d) return;
    const html = generateSelectedPackageHTML(d);
    if (!verifyJackieRelease(d, html, 'internal', selectedPackage)) return;
    const filename = selectedPackage === 'appendix_full' ? buildJackieIntelReportFilename(d, 'pdf') : buildJackiePackageFilename(d, selectedPackage, 'pdf');
    const htmlFilename = selectedPackage === 'appendix_full' ? buildJackieIntelReportFilename(d, 'html') : buildJackiePackageFilename(d, selectedPackage, 'html');
    openPackageAndArchive(d, selectedPackage, html, filename, htmlFilename);
  };

  const handlePreviewPitch = () => {
    const d = getDataWithPhotos();
    if (!d) return;
    const html = generateFirstEmailIntroReport(d);
    if (!verifyJackieRelease(d, html, 'internal', 'first_email_intro')) return;
    openPackageAndArchive(d, 'first_email_intro', html, buildJackiePackageFilename(d, 'first_email_intro', 'pdf'), buildJackiePackageFilename(d, 'first_email_intro', 'html'));
  };

  // The agenda deck is an agenda for a real conversation — so before it can
  // be generated, the operator answers the pre-call discovery questions
  // (David, July 31 2026). The answers become the "Call Agenda & Discussion
  // Highlights" page at the front of the deck.
  const handlePreviewBoardDeck = () => {
    const d = getDataWithPhotos();
    if (!d) return;
    setAgendaIntakeOpen(true);
  };

  const buildBoardDeckWithIntake = (intake: AgendaIntake) => {
    setAgendaIntakeOpen(false);
    setAgendaIntake(intake);
    const d = getDataWithPhotos();
    if (!d) return;
    const html = generateBoardMeetingDeck(d, intake);
    if (!verifyJackieRelease(d, html, 'internal', 'board_meeting_deck')) return;
    openPackageAndArchive(d, 'board_meeting_deck', html, buildJackiePackageFilename(d, 'board_meeting_deck', 'pdf'), buildJackiePackageFilename(d, 'board_meeting_deck', 'html'));
  };

  const handleDownloadPitchHTML = () => {
    const d = getDataWithPhotos();
    if (!d) return;
    const html = generateSelectedPackageHTML(d);
    if (!verifyJackieRelease(d, html, 'internal', selectedPackage)) return;
    const filename = reportPackageFilenames(d, selectedPackage).html;
    archiveJackieReport(d, selectedPackage, html, filename);
    downloadAsHTML(html, filename);
  };

  const handleDownloadSelectedPDF = async () => {
    const d = getDataWithPhotos();
    if (!d) return;
    const html = generateSelectedPackageHTML(d);
    if (!verifyJackieRelease(d, html, 'internal', selectedPackage)) return;
    const filenames = reportPackageFilenames(d, selectedPackage);
    archiveJackieReport(d, selectedPackage, html, filenames.html);
    toast.loading('Generating PDF...', { id: 'jackie-pdf' });
    try {
      await downloadAsPDF(html, filenames.pdf);
      toast.success('PDF downloaded', { id: 'jackie-pdf' });
    } catch (err) {
      console.error('PDF generation failed:', err);
      toast.error('PDF download failed. Use Print / Save PDF as a fallback.', { id: 'jackie-pdf' });
    }
  };

  const handlePitchEmail = async () => {
    const d = getDataWithPhotos();
    if (!d) return;
    const email = generatePitchEmail(d);
    const html = generateSelectedPackageHTML(d);
    if (!verifyJackieRelease(d, html, 'internal', selectedPackage)) return;
    const filenames = reportPackageFilenames(d, selectedPackage);
    archiveJackieReport(d, selectedPackage, html, filenames.html);
    toast.loading('Preparing PDF and email draft...', { id: 'jackie-email' });
    try {
      await downloadAsPDF(html, filenames.pdf);
    } catch (err) {
      console.error('PDF generation before email failed:', err);
      await downloadAsHTML(html, filenames.html);
    }
    const recipients = collectReportContactEmails(d, inquiryEmail);
    const subject = `Introduction to Camelot Property Management regarding ${d.buildingName || d.address}`;
    const body =
      `To the decision makers of ${d.buildingName || d.address},\n\n` +
      `Thank you for taking the time to review Camelot Property Management. Attached is a property-specific Camelot report for ${d.buildingName || d.address}.\n\n` +
      `Camelot is a New York-based property management company serving co-ops, condos, and rental buildings with senior attention, in-house accounting, legal and compliance guidance, practical technology, and hands-on local management. We would welcome the opportunity to speak with you by phone, Zoom, Google Meet, or in person to discuss where Camelot may be useful to your building.\n\n` +
      `Please attach the downloaded PDF report file before sending: ${filenames.pdf}\n\n` +
      `Sincerely,\n${DAVID_GOLDOFF_SIGNATURE_TEXT}`;
    openEmailDraft({
      to: recipients.join(','),
      cc: 'info@camelot.nyc,dgoldoff@camelot.nyc',
      subject,
      body,
    });
    void trackReportWorkflowEvent({
      building: reportDataToBuilding(d, {
        name: inquiryContact,
        email: inquiryEmail,
        phone: inquiryPhone,
        role: inquiryRole,
        organization: inquiryOrganization,
      }),
      reportData: d,
      packageType: selectedPackage,
      packageLabel: packageLabelFor(selectedPackage),
      action: 'email_draft_opened',
      filename: filenames.pdf,
      html,
      emailSubject: subject,
      emailBody: body,
      recipients,
    });
    copyToClipboard(email);
    toast.success(recipients.length ? 'PDF downloaded and addressed Gmail draft opened' : 'PDF downloaded and Gmail draft opened; add recipient before sending', { id: 'jackie-email' });
  };

  /**
   * Actually send the report by email via Camelot OS's own Resend-backed
   * endpoint (server.js /api/email/send) — a real delivery, not a mailto
   * draft the user has to finish themselves. Mirrors the send into HubSpot
   * as an Email engagement (associated to the matching deal, if this
   * building has one) so both systems show the same history. Requires
   * RESEND_API_KEY to be configured in Render; shows a clear error rather
   * than silently doing nothing if it isn't.
   */
  const handleSendRealEmail = async () => {
    const d = getDataWithPhotos();
    if (!d) return;
    if (!emailConfigStatus?.resendConfigured) {
      toast.error('Real sending isn\'t configured yet — add RESEND_API_KEY in Render, or use "Email PDF Draft" for now.', { id: 'jackie-send', duration: 6000 });
      return;
    }
    const recipients = collectReportContactEmails(d, inquiryEmail);
    if (!recipients.length) {
      toast.error('No recipient email found — add one in "Inquiry contact email" above before sending.', { id: 'jackie-send' });
      return;
    }
    const html = generateSelectedPackageHTML(d);
    if (!verifyJackieRelease(d, html, 'internal', selectedPackage)) return;
    const filenames = reportPackageFilenames(d, selectedPackage);
    archiveJackieReport(d, selectedPackage, html, filenames.html);

    const subject = `Introduction to Camelot Property Management regarding ${d.buildingName || d.address}`;
    const bodyText =
      `To the decision makers of ${d.buildingName || d.address},\n\n` +
      `Thank you for taking the time to review Camelot Property Management. Attached is a property-specific Camelot report for ${d.buildingName || d.address}.\n\n` +
      `Camelot is a New York-based property management company serving co-ops, condos, and rental buildings with senior attention, in-house accounting, legal and compliance guidance, practical technology, and hands-on local management. We would welcome the opportunity to speak with you by phone, Zoom, Google Meet, or in person to discuss where Camelot may be useful to your building.\n\n` +
      `Sincerely,\n${DAVID_GOLDOFF_SIGNATURE_TEXT}`;
    const bodyHtml = bodyText.split('\n').map(line => line ? `<p style="margin:0 0 12px;font-family:Georgia,serif;font-size:15px;color:#1a1f36;line-height:1.6">${line}</p>` : '').join('');

    setSendingRealEmail(true);
    toast.loading('Rendering PDF and sending...', { id: 'jackie-send' });
    try {
      const result = await sendCamelotEmail({
        to: recipients,
        subject,
        html: bodyHtml,
        text: bodyText,
        replyTo: 'dgoldoff@camelot.nyc',
        reportHtml: html,
        attachmentFilename: filenames.pdf,
        hubspot: hubspotSyncedIds && hubspotSyncedIds.address === d.address
          ? { contactId: hubspotSyncedIds.contactId, companyId: hubspotSyncedIds.companyId, dealId: hubspotSyncedIds.dealId }
          : undefined,
      });
      if (!result.ok) {
        toast.error(result.error || 'Send failed', { id: 'jackie-send' });
      } else {
        const hubspotNote = result.hubspot?.status === 'ok' ? ' · logged to HubSpot' : '';
        toast.success(`Sent to ${recipients.join(', ')}${hubspotNote}`, { id: 'jackie-send' });
        void trackReportWorkflowEvent({
          building: reportDataToBuilding(d, {
            name: inquiryContact,
            email: inquiryEmail,
            phone: inquiryPhone,
            role: inquiryRole,
            organization: inquiryOrganization,
          }),
          reportData: d,
          packageType: selectedPackage,
          packageLabel: packageLabelFor(selectedPackage),
          action: 'email_sent',
          filename: filenames.pdf,
          html,
          emailSubject: subject,
          emailBody: bodyText,
          recipients,
        });
      }
    } catch (err: any) {
      toast.error(err?.message || 'Send failed', { id: 'jackie-send' });
    } finally {
      setSendingRealEmail(false);
    }
  };

  const handlePushSelectedHubSpot = async () => {
    const d = getDataWithPhotos();
    if (!d) return;
    const html = generateSelectedPackageHTML(d);
    if (!verifyJackieRelease(d, html, 'internal', selectedPackage)) return;
    const filenames = reportPackageFilenames(d, selectedPackage);
    archiveJackieReport(d, selectedPackage, html, filenames.html);
    toast.loading('Pushing Jackie report lead to Scout / HubSpot...', { id: 'jackie-hubspot' });
    try {
      const result = await pushBuildingToIntegrations(reportDataToBuilding(d, {
        name: inquiryContact,
        email: inquiryEmail,
        phone: inquiryPhone,
        role: inquiryRole,
        organization: inquiryOrganization,
      }));
      void trackReportWorkflowEvent({
        building: reportDataToBuilding(d, {
          name: inquiryContact,
          email: inquiryEmail,
          phone: inquiryPhone,
          role: inquiryRole,
          organization: inquiryOrganization,
        }),
        reportData: d,
        packageType: selectedPackage,
        packageLabel: packageLabelFor(selectedPackage),
        action: 'hubspot_push',
        filename: filenames.html,
        html,
      });
      const hubspotText = result.hubspot?.status === 'ok' ? 'HubSpot synced' : result.hubspot?.message || 'HubSpot queued/skipped';
      if (result.hubspot?.status === 'ok' && (result.hubspot.contactId || result.hubspot.companyId || result.hubspot.dealId)) {
        setHubspotSyncedIds({
          address: d.address,
          contactId: result.hubspot.contactId,
          companyId: result.hubspot.companyId,
          dealId: result.hubspot.dealId,
        });
      }
      toast.success(`Scout workflow complete. ${hubspotText}`, { id: 'jackie-hubspot' });
    } catch (err: any) {
      console.error('HubSpot push failed:', err);
      toast.error(`HubSpot error: ${err.message || 'Unknown error'}`, { id: 'jackie-hubspot' });
    }
  };

  const handlePitchDeckPPTX = async () => {
    const d = getDataWithPhotos();
    if (!d) return;
    const releaseHtml = generateBrochureHTML(d);
    if (!verifyJackieRelease(d, releaseHtml, 'internal', 'appendix_full')) return;
    toast.loading('Generating PowerPoint deck...', { id: 'pptx' });
    try {
      await generatePitchDeck(d);
      toast.success('PowerPoint pitch deck downloaded!', { id: 'pptx' });
    } catch (err) {
      console.error('PPTX generation failed:', err);
      toast.error('Failed to generate PowerPoint deck', { id: 'pptx' });
    }
  };

  const handleDownloadHTML = () => {
    const d = getDataWithPhotos();
    if (!d) return;
    const html = generateBrochureHTML(d);
    if (!verifyJackieRelease(d, html, 'release', 'appendix_full')) return;
    archiveJackieReport(d, 'appendix_full', html, buildJackieIntelReportFilename(d, 'html'));
    downloadAsHTML(html, buildJackieIntelReportFilename(d, 'html'));
  };

  const handleCSV = () => {
    if (!data) return;
    const csv = generateCSVExport(data);
    triggerCSVDownload(csv, `Jackie-Export-${data.buildingName.replace(/[^a-zA-Z0-9]/g, '-')}.csv`);
  };

  const handleCopy = async (text: string) => {
    const ok = await copyToClipboard(text);
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  // Photo upload handler — converts files to data URLs and stores them
  const photoStorageKey = useCallback(() => {
    const keyAddress = (data?.address || address).trim();
    if (!keyAddress) return '';
    return `camelot_photos_${keyAddress.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  }, [address, data?.address]);

  const persistUploadedPhotos = useCallback((photos: string[]) => {
    const key = photoStorageKey();
    if (!key) return;
    const payload = JSON.stringify(photos);
    try {
      if (payload.length > PHOTO_PERSIST_CHAR_LIMIT) throw new Error('Photo payload too large for durable storage.');
      localStorage.setItem(key, payload);
      sessionStorage.removeItem(key);
      return;
    } catch {
      try {
        sessionStorage.setItem(key, payload);
        toast('Photos are saved for this browser session. Browser storage is full for permanent save.', { icon: 'Warning', duration: 5000 });
      } catch {
        toast('Photos loaded for this report, but browser storage is full.', { icon: 'Warning', duration: 5000 });
      }
    }
  }, [photoStorageKey]);

  const readPhotoAsDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
    if (/\.hei[cf]$/i.test(file.name) || /heic|heif/i.test(file.type)) {
      reject(new Error(`${file.name} is HEIC/HEIF. Please export it as JPG or PNG first.`));
      return;
    }
    if (file.size > PHOTO_MAX_SOURCE_BYTES) {
      reject(new Error(`${file.name} is too large. Please use an image under 18MB or export a smaller JPG.`));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.onload = () => {
      const raw = String(reader.result || '');
      const img = new Image();
      img.onerror = () => reject(new Error(`${file.name} could not be rendered by the browser. Try a JPG, PNG, or WEBP.`));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(raw);
        const sourceMaxSide = Math.max(img.width, img.height);
        let bestDataUrl = '';

        for (let maxSide = Math.min(PHOTO_INITIAL_MAX_SIDE, sourceMaxSide); maxSide >= PHOTO_MIN_MAX_SIDE; maxSide = Math.floor(maxSide * 0.82)) {
          const scale = Math.min(1, maxSide / sourceMaxSide);
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          for (const quality of PHOTO_QUALITY_STEPS) {
            const dataUrl = canvas.toDataURL('image/jpeg', quality);
            bestDataUrl = dataUrl;
            if (dataUrl.length <= PHOTO_MAX_STORED_CHARS) {
              resolve(dataUrl);
              return;
            }
          }
        }

        if (bestDataUrl) {
          resolve(bestDataUrl);
          return;
        }
        reject(new Error(`${file.name} could not be compressed for report use.`));
      };
      img.src = raw;
    };
    reader.readAsDataURL(file);
  });

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i.test(file.name));
    if (imageFiles.length === 0) {
      toast.error('Choose an image file: JPG, PNG, WEBP, or HEIC converted by your browser.');
      e.target.value = '';
      return;
    }

    let loadingToast: string | undefined;
    try {
      const remainingSlots = Math.max(0, PHOTO_UPLOAD_LIMIT - uploadedPhotos.length);
      if (remainingSlots === 0) {
        toast.error(`Jackie can include up to ${PHOTO_UPLOAD_LIMIT} uploaded photos per report. Remove one before adding more.`);
        return;
      }
      const filesToProcess = imageFiles.slice(0, remainingSlots);
      loadingToast = toast.loading(`Preparing ${filesToProcess.length} photo(s) for Jackie...`);
      const acceptedUrls: string[] = [];
      for (const file of filesToProcess) {
        acceptedUrls.push(await readPhotoAsDataUrl(file));
        await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      }
      toast.dismiss(loadingToast);
      loadingToast = undefined;
      const next = [...uploadedPhotos, ...acceptedUrls];
      setUploadedPhotos(next);
      persistUploadedPhotos(next);
      toast.success(`${acceptedUrls.length} photo(s) uploaded and optimized for report/PDF use`);
      if (imageFiles.length > remainingSlots) {
        toast(`Only the first ${remainingSlots} photo(s) were added. Limit is ${PHOTO_UPLOAD_LIMIT}.`, { icon: 'Warning', duration: 4500 });
      }
    } catch (err) {
      console.error('Photo upload failed:', err);
      toast.error(err instanceof Error ? err.message : 'Photo upload failed. Try a smaller JPG or PNG.');
    } finally {
      if (loadingToast) toast.dismiss(loadingToast);
      e.target.value = '';
    }
  };

  // Load saved photos when address changes
  const loadSavedPhotos = useCallback(() => {
    const key = photoStorageKey();
    if (!key) return;
    try {
      const saved = JSON.parse(localStorage.getItem(key) || sessionStorage.getItem(key) || '[]');
      const safePhotos = sanitizeStoredPhotoList(saved);
      setUploadedPhotos(safePhotos);
      if (JSON.stringify(saved) !== JSON.stringify(safePhotos)) {
        if (safePhotos.length > 0) persistUploadedPhotos(safePhotos);
        else {
          localStorage.removeItem(key);
          sessionStorage.removeItem(key);
        }
        toast('Jackie removed stale or oversized saved photos for this address. Please re-upload clean JPG/PNG/WEBP images if needed.', { icon: 'Warning', duration: 5500 });
      }
    } catch {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
      setUploadedPhotos([]);
    }
  }, [persistUploadedPhotos, photoStorageKey]);

  useEffect(() => {
    loadSavedPhotos();
  }, [loadSavedPhotos]);

  useEffect(() => {
    setReleaseQA(null);
  }, [uploadedPhotos.length, selectedPackage, selectedFocus, inquiryContact, inquiryEmail, inquiryPhone, inquiryOrganization, inquiryRole, inquiryNotes]);

  // Inject uploaded photos into report data before generating. Memoized so the page does not rebuild
  // a fresh report object on every render.
  const reportDataWithPhotos = useMemo((): MasterReportData | null => {
    if (!data) return null;
    const baseData = { ...data, reportFocus: buildReportFocus() };
    if (uploadedPhotos.length === 0 && !autoExteriorPhoto) return applyJackieFactAuthority(baseData).data as MasterReportData;
    const uploadedStack = uploadedPhotos.filter(Boolean);
    const existingExterior = baseData.buildingPhotos?.exterior || [];
    const existingInterior = baseData.buildingPhotos?.interior || [];
    return applyJackieFactAuthority({
      ...baseData,
      buildingPhotos: {
        exterior: [...uploadedStack, ...(uploadedStack.length === 0 && autoExteriorPhoto ? [autoExteriorPhoto.url] : []), ...existingExterior],
        interior: existingInterior,
        streetView: baseData.buildingPhotos?.streetView || '',
        satellite: baseData.buildingPhotos?.satellite || '',
        source: uploadedStack.length ? `Uploaded by Camelot team (${uploadedStack.length} photo${uploadedStack.length === 1 ? '' : 's'})` : (autoExteriorPhoto ? `Auto-located real exterior photo${autoExteriorPhoto.attribution ? ` (${autoExteriorPhoto.attribution})` : ''}` : (baseData.buildingPhotos?.source || '')),
      },
    }).data as MasterReportData;
  }, [data, uploadedPhotos, buildReportFocus, autoExteriorPhoto]);

  const getDataWithPhotos = useCallback((): MasterReportData | null => reportDataWithPhotos, [reportDataWithPhotos]);

  const verifyJackieRelease = (
    d: MasterReportData,
    html: string,
    mode: 'internal' | 'release' = 'release',
    packageType: JackieReportPackage = selectedPackage,
  ) => {
    const qa = validateJackieReport(d, html, { packageType });
    setReleaseQA(qa);
    // Cross-page fact consistency: block release when the rendered report
    // contradicts the building's canonical data (e.g. two different unit
    // counts on different pages).
    const consistency = checkReportConsistency(d, html);
    if (!consistency.clean) {
      toast.error(
        `Fact consistency check failed — fix before release:\n${summarizeConsistencyFindings(consistency)}`,
        { duration: 10000 }
      );
      if (mode === 'release') return false;
    }
    if (qa.failures > 0) {
      const detail = qa.checks.filter(c => c.status === 'fail').slice(0, 4).map(c => `${c.name}: ${c.detail}`).join('\n');
      if (mode === 'internal') {
        toast.error(`Internal review opened with Jackie review issues:\n${detail}`, { duration: 7000 });
        return true;
      }
      toast.error(`Jackie self-check found issues, but export is available for internal review:\n${detail}`, { duration: 8000 });
      return true;
    }
    if (qa.warnings > 0) {
      toast.success(`Jackie self-check passed with ${qa.warnings} warning(s). Review photo/data warnings if needed.`, { duration: 4500 });
    } else {
      toast.success('Jackie self-check passed. Report is clean for release.');
    }
    return true;
  };

  const clearUploadedPhotos = () => {
    setUploadedPhotos([]);
    const key = photoStorageKey();
    if (key) {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    }
    toast.success('Photos cleared');
  };

  const removeUploadedPhoto = (index: number) => {
    const updated = uploadedPhotos.filter((_, idx) => idx !== index);
    setUploadedPhotos(updated);
    persistUploadedPhotos(updated);
  };

  const renderPhotoUploadPanel = (compact = false) => (
    <div className="bg-white rounded-xl border p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900 mb-2">Building Photos</h2>
      <p className="text-xs text-gray-500 mb-3">
        Upload exterior, lobby, or interior photos before or after running Jackie. Photos are compressed for report use and saved per address.
      </p>
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <label htmlFor="jackie-photo-upload" className="cursor-pointer bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Upload Photos
          <input id="jackie-photo-upload" ref={photoInputRef} type="file" accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif" multiple onChange={handlePhotoUpload} className="sr-only" />
        </label>
        <span className="text-xs text-gray-500">{uploadedPhotos.length}/{PHOTO_UPLOAD_LIMIT} photo(s) uploaded</span>
        {uploadedPhotos.length > 0 && (
          <button type="button" onClick={clearUploadedPhotos} className="text-xs text-red-500 hover:text-red-700 underline">Clear all</button>
        )}
      </div>
      {uploadedPhotos.length > 0 && (
        <div className={`grid ${compact ? 'grid-cols-6' : 'grid-cols-4'} gap-2`}>
          {uploadedPhotos.map((url, i) => (
            <div key={`${url.slice(0, 28)}-${i}`} className="relative rounded-lg overflow-hidden border border-gray-200 h-20">
              <img src={url} alt={`Building photo ${i + 1}`} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removeUploadedPhoto(i)}
                className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"
              >×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const emailDraft = data ? generateEmailDraft(data, emailType) : null;
  const callerSheet = data ? generateColdCallerSheet(data) : '';
  const fmtMoney = (n: number) => n >= 1e6 ? `$${(n/1e6).toFixed(1)}M` : `$${n.toLocaleString()}`;
  const isRegionalMode = /connecticut|\bct\b|new jersey|\bnj\b|florida|\bfl\b|nys|new york state/i.test(`${borough} ${address} ${data?.borough || ''} ${data?.address || ''}`);
  const isConnecticutMode = /connecticut|\bct\b|monroe/i.test(`${borough} ${address} ${data?.borough || ''} ${data?.address || ''}`);

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">Pitch Deck Report Packager</h1>
        <p className="text-sm md:text-base text-gray-500 mt-1">Camelot&rsquo;s AI pitch engine — Property Intelligence Reports, management proposals, and email drafts. One address, every output.</p>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border p-4 md:p-6 shadow-sm">
        <div className="flex flex-col xl:flex-row gap-3">
          <div className="flex flex-1 gap-3">
            <input
              type="text" placeholder="Enter building address (e.g., 200 E 24th St)"
              value={address} onChange={e => setAddress(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && generate()}
              className="flex-1 px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#A89035]/50 focus:border-[#A89035]"
            />
            <select value={borough} onChange={e => setBorough(e.target.value)}
              className="px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#A89035]/50">
              <option value="">Region</option>
              <option value="manhattan">Manhattan</option>
              <option value="brooklyn">Brooklyn</option>
              <option value="queens">Queens</option>
              <option value="bronx">Bronx</option>
              <option value="staten island">Staten Island</option>
              <option value="New York State">NYS / New York State</option>
              <option value="Connecticut">CT / Connecticut</option>
              <option value="New Jersey">NJ / New Jersey</option>
              <option value="Florida">FLA / Florida</option>
            </select>
          </div>
          <button onClick={generate} disabled={loading || !address.trim()}
            className="px-6 py-3 bg-[#3A4B5B] text-white rounded-lg hover:bg-[#2d3d4d] disabled:opacity-50 flex items-center justify-center gap-2 font-medium">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Run Jackie
          </button>
          <button
            type="button"
            onClick={loadLastInputs}
            className="px-4 py-3 rounded-lg border border-gray-200 text-gray-600 hover:text-[#A89035] hover:border-[#A89035] text-sm font-medium"
          >
            Load Last Inputs
          </button>
        </div>

        <div className="mt-5 border-t pt-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h2 className="text-sm font-bold text-gray-900">Jackie Report Focus</h2>
              <p className="text-xs text-gray-500 mt-1">Select one or more areas. Facts stay source-checked; Jackie only changes the emphasis and proposal angle.</p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedFocus(['property_management'])}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-[#A89035] hover:border-[#A89035]"
            >
              Reset
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2">
            {REPORT_FOCUS_OPTIONS.map(option => {
              const active = selectedFocus.includes(option.key);
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => toggleFocus(option.key)}
                  className={`text-left rounded-xl border p-3 transition-colors ${active ? 'border-[#A89035] bg-[#F8F3E3] text-[#2C3240]' : 'border-gray-200 bg-white text-gray-600 hover:border-[#A89035]/50'}`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold ${active ? 'bg-[#3A4B5B] text-white' : 'bg-gray-100 text-gray-500'}`}>{option.icon}</span>
                    <span className="text-xs font-bold leading-tight">{option.label}</span>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-2 leading-snug">{option.headline}</p>
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
            <input
              value={inquiryContact}
              onChange={e => setInquiryContact(e.target.value)}
              placeholder="Inquiry contact"
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#A89035]/50"
            />
            <input
              value={inquiryRole}
              onChange={e => setInquiryRole(e.target.value)}
              placeholder="Role (board member, landlord, developer)"
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#A89035]/50"
            />
            <input
              value={inquiryOrganization}
              onChange={e => setInquiryOrganization(e.target.value)}
              placeholder="Organization / building group"
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#A89035]/50"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <input
              value={inquiryEmail}
              onChange={e => setInquiryEmail(e.target.value)}
              placeholder="Inquiry contact email"
              type="email"
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#A89035]/50"
            />
            <input
              value={inquiryPhone}
              onChange={e => setInquiryPhone(e.target.value)}
              placeholder="Inquiry contact phone"
              type="tel"
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#A89035]/50"
            />
          </div>
          <textarea
            value={inquiryNotes}
            onChange={e => setInquiryNotes(e.target.value)}
            placeholder="Optional notes from Get-a-Quote, email, call, or board conversation. Example: interested in accounting reports, collections, MDS, automation, compliance, staffing, capital projects..."
            className="mt-3 w-full px-3 py-2 rounded-lg border border-gray-200 text-sm h-20 resize-none focus:outline-none focus:ring-2 focus:ring-[#A89035]/50"
          />
          <div className="mt-5 border-t pt-5">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <h2 className="text-sm font-bold text-gray-900">Jackie Output Package</h2>
                <p className="text-xs text-gray-500 mt-1">Choose the client-facing length before preview or download. All packages use the same verified Jackie facts.</p>
              </div>
              <span className="text-[10px] uppercase tracking-[0.18em] text-[#A89035] font-bold">Facts strict · story tailored</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {JACKIE_REPORT_PACKAGES.map(option => {
                const active = selectedPackage === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setSelectedPackage(option.key)}
                    className={`text-left rounded-xl border p-4 transition-colors ${active ? 'border-[#A89035] bg-[#F8F3E3] text-[#2C3240]' : 'border-gray-200 bg-white text-gray-600 hover:border-[#A89035]/50'}`}
                  >
                    <div className="text-sm font-bold">{option.label}</div>
                    <div className="text-[11px] text-[#A89035] font-bold mt-1">{option.pages}</div>
                    <p className="text-[11px] text-gray-500 mt-2 leading-snug">{option.description}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {renderPhotoUploadPanel(!data)}

      {/* Loading */}
      {loading && (
        <div className="bg-white rounded-xl border p-12 shadow-sm flex flex-col items-center justify-center">
          <Loader2 className="w-12 h-12 animate-spin text-[#A89035] mb-4" />
          <p className="text-gray-500 font-medium">{loadingMsg || 'Building your report...'}</p>
          <p className="text-gray-400 text-sm mt-1">{isConnecticutMode ? 'CT entity records • Monroe land records • Assessor • Municipal files • HOA budget/claim docs • Market sources' : isRegionalMode ? 'State records • county/town records • assessor • land records • compliance • market sources' : 'HPD • DOB • DOF • LL97 • ACRIS • ECB • Housing Court • Rent Stabilization'}</p>
        </div>
      )}

      {/* Results */}
      {data && !loading && (
        <>
          {releaseQA && (
            <ReleaseWorkflowPanel qa={releaseQA} onPreview={handlePreviewBrochure} />
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-white rounded-xl border p-4 shadow-sm text-center">
              <p className="text-xs text-gray-500 uppercase font-medium">Market Value</p>
              <p className="text-xl font-bold text-[#A89035]">{fmtMoney(data.marketValue)}</p>
            </div>
            <div className="bg-white rounded-xl border p-4 shadow-sm text-center">
              <p className="text-xs text-gray-500 uppercase font-medium">Units</p>
              <p className="text-xl font-bold text-gray-900">{data.units || 'N/A'}</p>
            </div>
            <div className="bg-white rounded-xl border p-4 shadow-sm text-center">
              <p className="text-xs text-gray-500 uppercase font-medium">{isConnecticutMode ? 'HOA Findings' : 'HPD Violations'}</p>
              <p className={`text-xl font-bold ${data.violationsOpen > 10 ? 'text-red-600' : data.violationsOpen > 0 ? 'text-orange-500' : 'text-green-600'}`}>{isConnecticutMode ? (data.distressSignals?.length || 0) : data.violationsTotal}</p>
              <p className="text-xs text-gray-400">{isConnecticutMode ? 'operating signals' : `${data.violationsOpen} open`}</p>
            </div>
            <div className="bg-white rounded-xl border p-4 shadow-sm text-center">
              <p className="text-xs text-gray-500 uppercase font-medium">Scout Grade</p>
              <p className={`text-xl font-bold ${data.scoutGrade === 'A' ? 'text-green-600' : data.scoutGrade === 'B' ? 'text-yellow-600' : 'text-gray-500'}`}>{data.scoutGrade}</p>
              <p className="text-xs text-gray-400">{data.scoutScore}/100</p>
            </div>
            <div className="bg-white rounded-xl border p-4 shadow-sm text-center">
              <p className="text-xs text-gray-500 uppercase font-medium">{isConnecticutMode ? 'Claim / Project Risk' : 'LL97 Penalty'}</p>
              <p className={`text-xl font-bold ${data.ll97 && data.ll97.period1Penalty > 0 ? 'text-red-600' : 'text-green-600'}`}>{isConnecticutMode ? 'Scope' : data.ll97 ? `$${data.ll97.period1Penalty.toLocaleString()}/yr` : 'N/A'}</p>
            </div>
            <div className="bg-white rounded-xl border p-4 shadow-sm text-center">
              <p className="text-xs text-gray-500 uppercase font-medium">Distress</p>
              <p className={`text-xl font-bold ${data.distressLevel === 'critical' || data.distressLevel === 'distressed' ? 'text-red-600' : data.distressLevel === 'stressed' ? 'text-orange-500' : 'text-green-600'}`}>{data.distressLevel.toUpperCase()}</p>
            </div>
          </div>

          {/* Property Visual — Image + Map + Travel */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <iframe src={data.latitude && data.longitude ? `https://www.google.com/maps/embed/v1/streetview?key=${GOOGLE_MAPS_KEY}&location=${data.latitude},${data.longitude}&heading=0&pitch=5&fov=80` : `https://www.google.com/maps/embed/v1/place?key=${GOOGLE_MAPS_KEY}&q=${encodeURIComponent(data.address)}&zoom=18`} width="100%" height="220" style={{border:0}} allowFullScreen loading="lazy" title="Street View" />
              <div className="p-2 text-center text-xs text-gray-400">Street View — {data.address}</div>
            </div>
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <iframe src={`https://www.google.com/maps/embed/v1/place?key=${GOOGLE_MAPS_KEY}&q=${encodeURIComponent(data.address)}&zoom=16`} width="100%" height="220" style={{border:0}} allowFullScreen loading="lazy" title="Map" />
              <div className="p-2 text-center text-xs text-gray-400">Location Map</div>
            </div>
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <iframe src={`https://www.google.com/maps/embed/v1/directions?key=${GOOGLE_MAPS_KEY}&origin=57+West+57th+Street+Suite+410+New+York+NY+10019&destination=${encodeURIComponent(data.address)}&mode=driving`} width="100%" height="220" style={{border:0}} allowFullScreen loading="lazy" title="Travel from Camelot HQ" />
              <div className="p-2 text-center text-xs text-gray-400">Travel from Camelot HQ — 57 West 57th Street</div>
            </div>
          </div>

          {/* Report Preview */}
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Camelot Property Intelligence Report</h2>
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={handlePreviewSelectedPackage} className="px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 text-sm font-medium flex items-center gap-2">
                  <Eye className="w-4 h-4" /> Preview Selected Package
                </button>
                <button onClick={handlePreviewPitch} className="px-4 py-2 bg-[#0D2240] text-white rounded-lg hover:bg-[#1a3a5c] text-sm font-medium flex items-center gap-2">
                  <Eye className="w-4 h-4" /> Intro to Camelot (6-8)
                </button>
                <button onClick={handlePreviewBoardDeck} className="px-4 py-2 bg-[#5B4A1F] text-white rounded-lg hover:bg-[#473916] text-sm font-medium flex items-center gap-2">
                  <Eye className="w-4 h-4" /> Prospective Client Interview Agenda (15)
                </button>
                <button onClick={handlePreviewBrochure} className="px-4 py-2 bg-[#A89035] text-white rounded-lg hover:bg-[#8A7A2C] text-sm font-medium flex items-center gap-2">
                  <Eye className="w-4 h-4" /> Property Intelligence Dossier
                </button>
                <button onClick={handleDownloadPitchHTML} className="px-4 py-2 bg-[#3A4B5B] text-white rounded-lg hover:bg-[#2d3d4d] text-sm font-medium flex items-center gap-2">
                  <Download className="w-4 h-4" /> Download Selected HTML
                </button>
                <button onClick={handleDownloadSelectedPDF} className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium flex items-center gap-2">
                  <Download className="w-4 h-4" /> PDF
                </button>
                <button onClick={handlePitchEmail} className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium flex items-center gap-2">
                  <Mail className="w-4 h-4" /> Email PDF
                </button>
                <button onClick={handlePushSelectedHubSpot} className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 text-sm font-medium flex items-center gap-2">
                  <Link2 className="w-4 h-4" /> HubSpot
                </button>
                <button onClick={handlePitchDeckPPTX} className="px-4 py-2 bg-[#7C3AED] text-white rounded-lg hover:bg-[#6D28D9] text-sm font-medium flex items-center gap-2">
                  <Download className="w-4 h-4" /> ðŸ“Š PowerPoint Deck
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-6">
                <div><span className="text-gray-400 text-xs uppercase block">Address</span><span className="font-medium">{data.address}</span></div>
                <div><span className="text-gray-400 text-xs uppercase block">Type</span><span className="font-medium">{data.propertyType || 'Residential'}</span></div>
                <div><span className="text-gray-400 text-xs uppercase block">Units</span><span className="font-medium">{data.units || 'N/A'}</span></div>
                <div><span className="text-gray-400 text-xs uppercase block">Year Built</span><span className="font-medium">{data.yearBuilt || 'N/A'}</span></div>
                <div><span className="text-gray-400 text-xs uppercase block">Market Value</span><span className="font-medium text-[#A89035]">{fmtMoney(data.marketValue)}</span></div>
                <div><span className="text-gray-400 text-xs uppercase block">Management</span><span className="font-medium">{data.managementCompany || 'Management to verify'}</span></div>
                <div><span className="text-gray-400 text-xs uppercase block">Management Grade</span><span className={`font-bold ${data.managementGrade === 'A' ? 'text-green-600' : data.managementGrade === 'B' ? 'text-yellow-600' : 'text-red-600'}`}>{data.managementGrade}</span></div>
                <div><span className="text-gray-400 text-xs uppercase block">Scout Grade</span><span className="font-bold">{data.scoutGrade} ({data.scoutScore}/100)</span></div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-6">
                <div><span className="text-gray-400 text-xs uppercase block">{isConnecticutMode ? 'HOA Findings' : 'HPD Violations'}</span><span className={`font-medium ${data.violationsOpen > 5 ? 'text-red-600' : 'text-gray-900'}`}>{isConnecticutMode ? `${data.distressSignals?.length || 0} signals` : `${data.violationsTotal} total / ${data.violationsOpen} open`}</span></div>
                <div><span className="text-gray-400 text-xs uppercase block">{isConnecticutMode ? 'Municipal / Lien Leads' : 'ECB Penalties'}</span><span className="font-medium text-orange-600">{isConnecticutMode ? 'Manual review' : `$${data.ecbPenaltyBalance.toLocaleString()}`}</span></div>
                <div><span className="text-gray-400 text-xs uppercase block">{isConnecticutMode ? 'Claim / Project Risk' : 'LL97 Penalty'}</span><span className={`font-medium ${data.ll97 && data.ll97.period1Penalty > 0 ? 'text-red-600' : 'text-green-600'}`}>{isConnecticutMode ? 'Scope pending' : data.ll97 ? `$${data.ll97.period1Penalty.toLocaleString()}/yr` : 'N/A'}</span></div>
                <div><span className="text-gray-400 text-xs uppercase block">Distress Level</span><span className={`font-medium ${data.distressLevel === 'critical' || data.distressLevel === 'distressed' ? 'text-red-600' : 'text-green-600'}`}>{data.distressLevel.toUpperCase()} ({data.distressScore}/100)</span></div>
                <div><span className="text-gray-400 text-xs uppercase block">{isConnecticutMode ? 'Association / Entity' : 'Owner (DOF)'}</span><span className="font-medium">{data.dofOwner || 'N/A'}</span></div>
                <div><span className="text-gray-400 text-xs uppercase block">Last Sale</span><span className="font-medium">{data.lastSaleDate ? new Date(data.lastSaleDate).toLocaleDateString() : 'N/A'} — {data.lastSalePrice ? fmtMoney(data.lastSalePrice) : 'N/A'}</span></div>
                <div><span className="text-gray-400 text-xs uppercase block">Neighborhood</span><span className="font-medium capitalize">{data.neighborhoodName || data.borough || (isRegionalMode ? 'Regional' : 'NYC')}</span></div>
                <div><span className="text-gray-400 text-xs uppercase block">Proposed Fee</span><span className="font-medium text-[#A89035]">${data.monthlyFee.toLocaleString()}/mo (${data.pricePerUnit}/unit)</span></div>
              </div>
              {data.distressSignals && data.distressSignals.length > 0 && (
                <div className="mb-4">
                  <span className="text-gray-400 text-xs uppercase block mb-2">Distress Signals</span>
                  <div className="flex flex-wrap gap-2">
                    {data.distressSignals.map((s: any, i: number) => (
                      <span key={i} className="text-xs bg-red-50 text-red-700 border border-red-200 px-2 py-1 rounded-full">{s.description}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {uploadedPhotos.length < 0 && (
          /* Legacy photo upload kept disabled; renderPhotoUploadPanel is used above. */
          <>{/* Photo Upload */}
          <div className="bg-white rounded-xl border p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Building Photos</h2>
            <p className="text-xs text-gray-500 mb-3">Upload exterior, lobby, or interior photos to include in the report. Photos are saved per address.</p>
            <div className="flex items-center gap-3 mb-3">
              <button type="button" onClick={() => photoInputRef.current?.click()} className="cursor-pointer bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Upload Photos
              </button>
              <input ref={photoInputRef} type="file" accept="image/*" multiple onChange={handlePhotoUpload} className="hidden" />
              {uploadedPhotos.length > 0 && (
                <span className="text-xs text-gray-500">{uploadedPhotos.length} photo(s) uploaded</span>
              )}
              {uploadedPhotos.length > 0 && (
                <button
                  onClick={() => {
                    setUploadedPhotos([]);
                    if (address.trim()) {
                      const key = `camelot_photos_${address.trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
                      localStorage.removeItem(key);
                    }
                    toast.success('Photos cleared');
                  }}
                  className="text-xs text-red-500 hover:text-red-700 underline"
                >Clear all</button>
              )}
            </div>
            {uploadedPhotos.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {uploadedPhotos.map((url, i) => (
                  <div key={i} className="relative rounded-lg overflow-hidden border border-gray-200 h-20">
                    <img src={url} alt={`Building photo ${i + 1}`} className="w-full h-full object-cover" />
                    <button
                      onClick={() => {
                        const updated = uploadedPhotos.filter((_, idx) => idx !== i);
                        setUploadedPhotos(updated);
                        if (address.trim()) {
                          const key = `camelot_photos_${address.trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
                          localStorage.setItem(key, JSON.stringify(updated));
                        }
                      }}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"
                    >×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          </>)}

          {/* Action Buttons */}
          <div className="bg-white rounded-xl border p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
              <button onClick={handlePreviewPitch} className="px-4 py-3 bg-[#0D2240] text-white rounded-lg hover:bg-[#1a3a5c] font-medium flex flex-col items-center gap-1 text-sm">
                <Eye className="w-5 h-5" /> Intro to Camelot
              </button>
              <button onClick={handlePreviewBrochure} className="px-4 py-3 bg-[#A89035] text-white rounded-lg hover:bg-[#8A7A2C] font-medium flex flex-col items-center gap-1 text-sm">
                <Eye className="w-5 h-5" /> Appendix
              </button>
              <button onClick={handleDownloadPitchHTML} className="px-4 py-3 bg-[#3A4B5B] text-white rounded-lg hover:bg-[#2d3d4d] font-medium flex flex-col items-center gap-1 text-sm">
                <Download className="w-5 h-5" /> HTML
              </button>
              <button onClick={handleDownloadSelectedPDF} className="px-4 py-3 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 font-medium flex flex-col items-center gap-1 text-sm">
                <Download className="w-5 h-5" /> PDF
              </button>
              <button onClick={handlePreviewSelectedPackage} className="px-4 py-3 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 font-medium flex flex-col items-center gap-1 text-sm">
                <Printer className="w-5 h-5" /> Print
              </button>
              <button onClick={handlePitchEmail} className="px-4 py-3 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 font-medium flex flex-col items-center gap-1 text-sm">
                <Mail className="w-5 h-5" /> Email PDF Draft
              </button>
              <button
                onClick={handleSendRealEmail}
                disabled={sendingRealEmail}
                title={emailConfigStatus?.resendConfigured ? 'Actually sends via Resend and logs to HubSpot' : 'Add RESEND_API_KEY in Render to enable real sending'}
                className={`px-4 py-3 rounded-lg font-medium flex flex-col items-center gap-1 text-sm disabled:opacity-60 ${emailConfigStatus?.resendConfigured ? 'bg-[#16a34a] text-white hover:bg-[#15803d]' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
              >
                {sendingRealEmail ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                Send Email{!emailConfigStatus?.resendConfigured ? ' (setup needed)' : ''}
              </button>
              <button onClick={() => setShowCallerModal(true)} className="px-4 py-3 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 font-medium flex flex-col items-center gap-1 text-sm">
                <Phone className="w-5 h-5" /> Send to Carl
              </button>
              <button onClick={handleCSV} className="px-4 py-3 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 font-medium flex flex-col items-center gap-1 text-sm">
                <Table2 className="w-5 h-5" /> CSV Export
              </button>
              <button onClick={handlePushSelectedHubSpot} className="px-4 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-medium flex flex-col items-center gap-1 text-sm">
                <Link2 className="w-5 h-5" /> Push to HubSpot
              </button>
            </div>
          </div>

          {/* Professional Partner Pitch Decks — law / accounting / audit */}
          <div className="bg-white rounded-xl border p-6 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Professional Partner Pitch Decks</h2>
              <p className="text-xs text-gray-500 mt-1">
                Firm-level decks for the professionals who serve boards and landlords: who Camelot is, history,
                track record, markets, case studies, how we work with their teams — closing on a coffee meeting.
                Generated decks are archived below and tracked in the database under New Business Leads and Pitches.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {PARTNER_AUDIENCES.map((aud) => (
                <button
                  key={aud.key}
                  onClick={() => setPartnerPitchAudience(aud.key)}
                  className="text-left border border-[#A89035]/40 rounded-xl p-4 hover:bg-[#F7F1DE] transition-colors"
                >
                  <div className="text-sm font-bold text-gray-900">{aud.label}</div>
                  <div className="text-xs text-gray-500 mt-1">{aud.description}</div>
                  <div className="text-[11px] font-bold text-[#A89035] uppercase tracking-wider mt-3">Generate deck →</div>
                </button>
              ))}
            </div>
          </div>

          {/* Generated Jackie Report Library */}
          <div className="bg-white rounded-xl border p-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Generated Jackie Report Library</h2>
                <p className="text-xs text-gray-500 mt-1">
                  Every Jackie preview, email intro, meeting agenda deck, appendix, or selected download is saved here with a report number, timestamp, contact, and reopen/download actions.
                </p>
              </div>
              <div className="text-xs text-[#A89035] font-bold uppercase tracking-[0.16em]">
                {savedReports.length} saved
              </div>
            </div>
            {savedReports.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 p-5 text-sm text-gray-500 bg-gray-50">
                No saved Jackie reports yet. Run a preview or download a package and Camelot OS will archive it here automatically.
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {savedReports.map(record => (
                  <div key={record.id} className="rounded-xl border border-gray-200 p-4">
                    <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] uppercase tracking-[0.16em] text-[#A89035] font-bold">{record.reportNumber}</span>
                          <span className="text-[10px] px-2 py-1 rounded-full bg-[#F8F3E3] text-[#5B4A1F] font-bold">{record.packageLabel}</span>
                        </div>
                        <h3 className="text-sm font-bold text-gray-900 mt-2">{record.buildingName}</h3>
                        <p className="text-xs text-gray-500">{record.address}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          Generated {formatLibraryDate(record.generatedAt)}
                          {record.inquiryContact ? ` · For ${record.inquiryContact}` : ''}
                          {record.inquiryEmail ? ` · ${record.inquiryEmail}` : ''}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openSavedReport(record)}
                          className="px-3 py-2 rounded-lg bg-[#3A4B5B] text-white text-xs font-semibold hover:bg-[#2d3d4d] flex items-center gap-2"
                        >
                          <Eye size={14} /> Open / Print
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadSavedReport(record)}
                          className="px-3 py-2 rounded-lg border border-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-50 flex items-center gap-2"
                        >
                          <Download size={14} /> HTML
                        </button>
                        <button
                          type="button"
                          onClick={() => copySavedReportReference(record)}
                          className="px-3 py-2 rounded-lg border border-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-50 flex items-center gap-2"
                        >
                          <Copy size={14} /> Copy Ref
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteSavedReport(record.id)}
                          className="px-3 py-2 rounded-lg border border-red-100 text-red-600 text-xs font-semibold hover:bg-red-50"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 text-[11px] text-gray-400 truncate">Stored file: {record.filename}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Building Details */}
          <div className="bg-white rounded-xl border p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{data.buildingName}</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><span className="text-gray-400">Address:</span> <span className="font-medium">{data.address}</span></div>
              <div><span className="text-gray-400">Borough:</span> <span className="font-medium">{data.borough}</span></div>
              <div><span className="text-gray-400">Management:</span> <span className="font-medium">{data.managementCompany || 'Management to verify'}</span></div>
              <div><span className="text-gray-400">Owner (DOF):</span> <span className="font-medium">{data.dofOwner || 'N/A'}</span></div>
              <div><span className="text-gray-400">Year Built:</span> <span className="font-medium">{data.yearBuilt || 'N/A'}</span></div>
              <div><span className="text-gray-400">ECB Penalties:</span> <span className="font-medium text-orange-600">${data.ecbPenaltyBalance.toLocaleString()}</span></div>
              <div><span className="text-gray-400">Last Sale:</span> <span className="font-medium">{data.lastSaleDate ? new Date(data.lastSaleDate).toLocaleDateString() : 'N/A'} — {data.lastSalePrice ? fmtMoney(data.lastSalePrice) : 'N/A'}</span></div>
              <div><span className="text-gray-400">Proposed Fee:</span> <span className="font-medium text-[#A89035]">${data.monthlyFee.toLocaleString()}/mo</span></div>
            </div>
          </div>
        </>
      )}

      {/* Empty state */}
      {!data && !loading && (
        <div className="bg-white rounded-xl border p-12 shadow-sm text-center">
          <FileText className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-500">Enter a building address to run Jackie</h3>
          <p className="text-gray-400 mt-1">Jackie pulls live NYC data, generates your Property Intelligence Report, management proposal, email drafts, and cold caller sheet</p>
        </div>
      )}

      {/* Email Modal */}
      {showEmailModal && emailDraft && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Email Draft</h3>
              <button onClick={() => setShowEmailModal(false)} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4">
              <div className="flex gap-2 mb-4">
                {(['loyalty', 'intro', 'followup', 'proposal', 'compliance'] as EmailType[]).map(t => (
                  <button key={t} onClick={() => setEmailType(t)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium ${emailType === t ? 'bg-[#A89035] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {t === 'loyalty' ? 'Report Intro' : t === 'intro' ? 'Introduction' : t === 'followup' ? 'Follow-Up' : t === 'proposal' ? 'Proposal' : 'LL97 Compliance'}
                  </button>
                ))}
              </div>
              <div className="bg-gray-50 rounded-lg p-4 mb-3">
                <p className="text-xs text-gray-500 uppercase font-medium mb-1">Subject</p>
                <p className="text-sm font-medium">{emailDraft.subject}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-500 uppercase font-medium mb-1">Body</p>
                <pre className="text-sm whitespace-pre-wrap font-sans text-gray-700">{emailDraft.body}</pre>
              </div>
              <button onClick={() => handleCopy(`Subject: ${emailDraft.subject}\n\n${emailDraft.body}`)}
                className="mt-4 px-4 py-2 bg-[#3A4B5B] text-white rounded-lg flex items-center gap-2 font-medium">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy to Clipboard'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cold Caller Modal */}
      {showCallerModal && callerSheet && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Cold Caller Prep Sheet</h3>
              <button onClick={() => setShowCallerModal(false)} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4">
              <pre className="bg-gray-50 rounded-lg p-4 text-sm whitespace-pre-wrap font-mono text-gray-700">{callerSheet}</pre>
              <button onClick={() => handleCopy(callerSheet)}
                className="mt-4 px-4 py-2 bg-[#3A4B5B] text-white rounded-lg flex items-center gap-2 font-medium">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy to Clipboard'}
              </button>
            </div>
          </div>
        </div>
      )}

      {partnerPitchAudience && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setPartnerPitchAudience(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b bg-gray-50 rounded-t-xl">
              <h3 className="text-lg font-bold text-gray-900">Personalize this deck</h3>
              <p className="text-sm text-gray-600 mt-1">{partnerAudienceLabel(partnerPitchAudience)} — add the firm so the cover, working-together page, and coffee invite speak to them by name.</p>
            </div>
            <form
              className="p-5 space-y-3"
              onSubmit={e => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const aud = partnerPitchAudience;
                setPartnerPitchAudience(null);
                const firm: PartnerFirmInfo = {
                  firmName: String(fd.get('firmName') || '').trim(),
                  contactName: String(fd.get('contactName') || '').trim(),
                };
                const label = partnerAudienceLabel(aud);
                const html = generatePartnerPitchDeck(aud, firm);
                const filename = buildPartnerPitchFilename(aud, 'pdf', firm);
                openBrochureForPrint(html, filename);
                const record: SavedJackieReport = {
                  id: crypto.randomUUID(),
                  reportNumber: `PP-${Date.now().toString(36).toUpperCase()}`,
                  address: firm.firmName ? `Partner Pitch — ${firm.firmName}` : `Camelot Partner Pitch — ${label}`,
                  buildingName: firm.firmName || `Partner Pitch: ${label}`,
                  packageType: 'partner_pitch' as SavedJackieReport['packageType'],
                  packageLabel: `Partner Pitch — ${label}${firm.firmName ? ` (${firm.firmName})` : ''}`,
                  filename,
                  html,
                  inquiryContact: firm.contactName || undefined,
                  focus: [],
                  generatedAt: new Date().toISOString(),
                };
                setSavedReports(saveJackieReportRecord(record));
                toast.success(`${firm.firmName || label} partner deck opened and archived`);
              }}
            >
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Firm name</label>
                <input name="firmName" placeholder="e.g., Braverman Greenspun P.C." className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Contact name (optional)</label>
                <input name="contactName" placeholder="e.g., Sarah Cohen, Partner" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500" />
              </div>
              <div className="flex items-center justify-between pt-2 pb-1">
                <button type="button" onClick={e => { e.preventDefault(); (e.currentTarget.closest('form') as HTMLFormElement)?.reset(); (e.currentTarget.closest('form') as HTMLFormElement)?.requestSubmit(); }} className="text-sm text-gray-500 hover:text-gray-700 underline">
                  Skip — generic deck
                </button>
                <button type="submit" className="px-5 py-2.5 bg-[#5B4A1F] text-white rounded-lg hover:bg-[#473916] text-sm font-semibold">
                  Generate Deck
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {agendaIntakeOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setAgendaIntakeOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b bg-gray-50 rounded-t-xl">
              <h3 className="text-lg font-bold text-gray-900">Before we build this agenda…</h3>
              <p className="text-sm text-gray-600 mt-1">What do you know about this building, and have you spoken to any of its decision makers? We'll turn your answers into the agenda for your next Zoom or phone call — pain points get highlighted at the front of the deck.</p>
            </div>
            <form
              className="p-5 space-y-3"
              onSubmit={e => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                buildBoardDeckWithIntake({
                  spokeWithDecisionMakers: String(fd.get('spoke') || ''),
                  painPoints: String(fd.get('painPoints') || ''),
                  residentManager: String(fd.get('residentManager') || ''),
                  budget: String(fd.get('budget') || ''),
                  capitalProjects: String(fd.get('capitalProjects') || ''),
                  vendors: String(fd.get('vendors') || ''),
                  desiredOutcomes: String(fd.get('desiredOutcomes') || ''),
                  otherNotes: String(fd.get('otherNotes') || ''),
                });
              }}
            >
              {[
                ['spoke', 'Have you spoken to the decision makers? Who, and when?', 'e.g., Board president Jane R., intro call July 28 — via Otter/Zoom/Meet notes'],
                ['painPoints', 'What are their pain points with this property?', 'e.g., slow repairs, opaque financials, unhappy with current management'],
                ['residentManager', 'Are they happy with their resident manager / staff?', 'e.g., super is well liked but overloaded; no weekend coverage'],
                ['budget', "What's wrong (or right) with the budget? What's their budget direction?", 'e.g., running a deficit, want to avoid an assessment'],
                ['capitalProjects', 'Capital projects / Local Law needs? Assessment coming?', 'e.g., LL11 facade cycle due 2027, boiler replacement being discussed'],
                ['vendors', 'Do they like their current vendors and pricing?', 'e.g., locked into an expensive elevator contract'],
                ['desiredOutcomes', 'What would they like to see different? Where should the property go financially?', 'e.g., cut operating costs 10%, better board reporting'],
                ['otherNotes', 'Anything else important before the board / landlord call?', 'e.g., building may interview 2 other firms; decision by Labor Day'],
              ].map(([name, label, placeholder]) => (
                <div key={name}>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">{label}</label>
                  <textarea name={name} rows={2} placeholder={placeholder} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500" />
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 pb-1">
                <button type="button" onClick={() => buildBoardDeckWithIntake({})} className="text-sm text-gray-500 hover:text-gray-700 underline">
                  Skip — build with a generic discovery agenda
                </button>
                <button type="submit" className="px-5 py-2.5 bg-[#5B4A1F] text-white rounded-lg hover:bg-[#473916] text-sm font-semibold">
                  Build Interview Agenda Deck
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

