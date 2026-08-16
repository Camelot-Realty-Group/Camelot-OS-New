import { useState, useCallback } from 'react';
import { Sword, FileText, Download, Eye, Loader2, Sparkles, ChevronDown } from 'lucide-react';
import { generateAgreement, DEFAULT_INPUT, ASSET_CLASS_LABELS, type AgreementInput, type AssetClass } from '@/lib/excalibur';
import { buildMasterReport, type MasterReportData } from '@/lib/camelot-report';
import { openBrochureForPrint, downloadAsHTML } from '@/lib/pdf-generator';
import { formatLibraryDate, loadLocalJackieReportLibrary, type SavedJackieReport } from '@/lib/jackie-report-library';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { trackReportWorkflowEvent, buildingFromReportData } from '@/lib/report-crm-tracking';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

type SavedAgreementRecord = {
  id: string;
  agreementNumber: string;
  propertyAddress: string;
  clientName: string;
  filename: string;
  html: string;
  inputSnapshot: AgreementInput;
  linkedJackieReportNumber?: string;
  generatedAt: string;
};

const AGREEMENT_LIBRARY_KEY = 'camelot_generated_management_agreement_library_v1';

const normalizeAddress = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

const loadAgreementLibrary = (): SavedAgreementRecord[] => {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(AGREEMENT_LIBRARY_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    localStorage.removeItem(AGREEMENT_LIBRARY_KEY);
    return [];
  }
};

const writeAgreementLibrary = (records: SavedAgreementRecord[]) => {
  const trimmed = records.slice(0, 80);
  localStorage.setItem(AGREEMENT_LIBRARY_KEY, JSON.stringify(trimmed));
  return trimmed;
};

const inferAssetClass = (d: MasterReportData): AssetClass => {
  const text = `${d.propertyType} ${d.buildingClass} ${d.buildingName}`.toLowerCase();
  if (/co-?op|cooperative|tenancy/.test(text)) return 'coop';
  if (/condo|hoa|association/.test(text)) return 'condo';
  if (/office/.test(text)) return 'office';
  if (/retail|store|commercial/.test(text)) return 'retail';
  return 'rental';
};

const cleanFilenamePart = (value: string) =>
  String(value || '')
    .replace(/&amp;/g, 'and')
    .replace(/&/g, 'and')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);

const agreementFilename = (input: AgreementInput, extension = 'html') => {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const proposalVersion = `Proposal-Version-v${now.getFullYear()}.${month}.1`;
  const propertyName = cleanFilenamePart(input.jackieData?.buildingName || '');
  const propertyAddress = cleanFilenamePart(
    [input.propertyAddress, input.propertyCity, input.propertyState, input.propertyZip]
      .filter(Boolean)
      .join(' ') ||
      input.propertyAddress ||
      input.clientName ||
      'Draft',
  );
  const subjectParts = propertyName && propertyName !== propertyAddress ? [propertyName, propertyAddress] : [propertyAddress || propertyName || 'Draft'];

  return `Proposal-of-Property-Management-Services__${[...subjectParts, proposalVersion, date].filter(Boolean).join('__')}.${extension}`;
};

export default function Agreements() {
  const [input, setInput] = useState<AgreementInput>({ ...DEFAULT_INPUT });
  const [jackieLoading, setJackieLoading] = useState(false);
  const [jackieData, setJackieData] = useState<MasterReportData | null>(null);
  const [generated, setGenerated] = useState(false);
  const [linkedJackieReport, setLinkedJackieReport] = useState<SavedJackieReport | null>(null);
  const [selectedArchiveId, setSelectedArchiveId] = useState('');
  const [jackieArchive, setJackieArchive] = useState<SavedJackieReport[]>(() => loadLocalJackieReportLibrary());
  const [savedAgreements, setSavedAgreements] = useState<SavedAgreementRecord[]>(() => loadAgreementLibrary());

  const update = (patch: Partial<AgreementInput>) => setInput(prev => ({ ...prev, ...patch }));

  const applyJackieData = useCallback((data: MasterReportData, source?: SavedJackieReport | null) => {
    setJackieData(data);
    setLinkedJackieReport(source || null);
    const assetClass = inferAssetClass(data);
    const intelligenceMonthly = data.tieredPricing?.intelligence?.monthly || data.monthlyFee || null;
    update({
      jackieData: data,
      assetClass,
      selectedTier: 'intelligence',
      tieredPricing: data.tieredPricing,
      customMonthlyFee: data.tieredPricing?.intelligence ? null : intelligenceMonthly,
      units: data.units || input.units,
      blockLot: data.bbl ? `BBL: ${data.bbl}` : input.blockLot,
      isRentStabilized: data.isRentStabilized || input.isRentStabilized,
      buildingType: data.propertyType ? `${data.units || input.units || ''} ${data.propertyType}${data.isRentStabilized ? ' · Rent Stabilized' : ''}`.trim() : input.buildingType,
      propertyAddress: data.address || input.propertyAddress,
      propertyCity: data.borough ? 'New York' : input.propertyCity,
      propertyState: data.borough ? 'NY' : input.propertyState,
      clientName: input.clientName || (assetClass === 'coop' ? 'Shareholders' : ''),
      clientEntityName: input.clientEntityName || data.dofOwner || '',
    });
  }, [input.units, input.blockLot, input.isRentStabilized, input.buildingType, input.propertyAddress, input.propertyCity, input.propertyState, input.clientName, input.clientEntityName]);

  // Auto-populate from Jackie
  const pullFromJackie = useCallback(async () => {
    if (!input.propertyAddress.trim()) {
      toast.error('Enter a property address first');
      return;
    }
    setJackieLoading(true);
    try {
      const data = await buildMasterReport(input.propertyAddress.trim());
      setJackieData(data);
      update({
        jackieData: data,
        tieredPricing: data.tieredPricing,
        units: data.units || input.units,
        blockLot: data.bbl ? `BBL: ${data.bbl}` : input.blockLot,
        isRentStabilized: data.isRentStabilized || input.isRentStabilized,
        buildingType: data.propertyType ? `${data.units} ${data.propertyType} Units${data.isRentStabilized ? ' · Rent Stabilized' : ''}` : input.buildingType,
      });
      toast.success(`Pulled data for ${data.buildingName || input.propertyAddress}`);
    } catch (err) {
      toast.error('Failed to pull report data — fill in manually');
      console.error(err);
    } finally {
      setJackieLoading(false);
    }
  }, [input.propertyAddress, input.units, input.blockLot, input.isRentStabilized, input.buildingType]);

  const pullFromJackieArchiveAware = useCallback(async () => {
    if (!input.propertyAddress.trim()) {
      toast.error('Enter a property address first');
      return;
    }
    setJackieLoading(true);
    try {
      const archive = loadLocalJackieReportLibrary();
      setJackieArchive(archive);
      const query = normalizeAddress(input.propertyAddress.trim());
      const archived = archive.find(record =>
        record.dataSnapshot && (normalizeAddress(record.address).includes(query) || query.includes(normalizeAddress(record.address)))
      );
      if (archived?.dataSnapshot) {
        applyJackieData(archived.dataSnapshot, archived);
        toast.success(`Loaded archived Jackie report ${archived.reportNumber}`);
        return;
      }
      const data = await buildMasterReport(input.propertyAddress.trim());
      applyJackieData(data, null);
      toast.success(`Pulled fresh Jackie data for ${data.buildingName || input.propertyAddress}`);
    } catch (err) {
      toast.error('Failed to pull report data - fill in manually');
      console.error(err);
    } finally {
      setJackieLoading(false);
    }
  }, [input.propertyAddress, applyJackieData]);

  const loadArchivedJackie = () => {
    const record = jackieArchive.find(item => item.id === selectedArchiveId);
    if (!record?.dataSnapshot) {
      toast.error('Choose a saved Engagement report with a data snapshot');
      return;
    }
    applyJackieData(record.dataSnapshot, record);
    toast.success(`Agreement fields loaded from ${record.reportNumber}`);
  };

  // Archives to Supabase (camelot_generated_documents — address, building
  // name, recipient, date, version) and queues the same HubSpot/Pipeline
  // activity used by proposals and reports, so every generated agreement is
  // trackable by address, name, "to who," date, and version, not just saved
  // to this browser's localStorage. Both calls are fire-and-forget — a CRM
  // hiccup should never block generating or downloading an agreement.
  const versionLabel = (() => {
    const now = new Date();
    return `v${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.1`;
  })();

  const archiveAgreementToCrm = async (record: SavedAgreementRecord) => {
    const recipientName = input.clientName || input.clientEntityName || undefined;
    if (isSupabaseConfigured()) {
      try {
        await supabase.from('camelot_generated_documents').insert({
          building_address: record.propertyAddress || 'Unassigned property',
          building_name: input.clientEntityName || jackieData?.buildingName || null,
          document_title: `${ASSET_CLASS_LABELS[input.assetClass]} — Property Management Agreement`,
          document_number: record.agreementNumber,
          version_label: versionLabel,
          recipient_name: recipientName || null,
          recipient_email: null,
          generated_by: 'Excalibur Agreement Engine',
          generated_payload: { assetClass: input.assetClass, units: input.units, selectedTier: input.selectedTier, linkedJackieReportNumber: record.linkedJackieReportNumber },
          status: 'draft',
        });
      } catch (e) {
        console.error('Failed to archive agreement to Supabase:', e);
      }
    }

    try {
      const building = jackieData
        ? buildingFromReportData(jackieData)
        : {
            id: `agreement-${record.agreementNumber.toLowerCase()}`,
            address: record.propertyAddress || 'Unassigned property',
            name: input.clientEntityName || record.propertyAddress || 'Draft Agreement',
            type: (['coop', 'condo'].includes(input.assetClass) ? 'co-op' : input.assetClass === 'office' ? 'commercial' : 'rental') as any,
            grade: 'C' as const,
            score: 0,
            signals: [],
            contacts: [],
            enriched_data: { source: 'Excalibur Agreement Engine' },
            status: 'proposal',
            tags: ['agreement-generated'],
            pipeline_stage: 'proposal' as const,
            violations_count: 0,
            open_violations_count: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
      void trackReportWorkflowEvent({
        building,
        packageType: 'management_agreement',
        packageLabel: `${ASSET_CLASS_LABELS[input.assetClass]} — Property Management Agreement`,
        action: 'generated',
        filename: record.filename,
        reportNumber: record.agreementNumber,
        recipients: [],
        metadata: { versionLabel, recipientName, clientEntityName: input.clientEntityName, units: input.units },
      });
    } catch (e) {
      console.error('Failed to queue agreement HubSpot/Pipeline activity:', e);
    }
  };

  const archiveAgreement = (html: string) => {
    const generatedAt = new Date().toISOString();
    const agreementNumber = `AGMT-${generatedAt.slice(0, 10).replace(/-/g, '')}-${String(Date.now()).slice(-6)}`;
    const record: SavedAgreementRecord = {
      id: agreementNumber,
      agreementNumber,
      propertyAddress: input.propertyAddress,
      clientName: input.clientName || input.clientEntityName || 'Draft',
      filename: agreementFilename(input),
      html,
      inputSnapshot: input,
      linkedJackieReportNumber: linkedJackieReport?.reportNumber,
      generatedAt,
    };
    const next = writeAgreementLibrary([record, ...loadAgreementLibrary()]);
    setSavedAgreements(next);
    void archiveAgreementToCrm(record);
    return record;
  };

  // Generate agreement
  const handleGenerate = () => {
    if (!input.clientName.trim() && !input.propertyAddress.trim()) {
      toast.error('Enter at least a client name or address');
      return;
    }
    const html = generateAgreement(input);
    const record = archiveAgreement(html);
    setGenerated(true);
    toast.success(`Agreement generated and archived: ${record.agreementNumber}`);
  };

  const handlePreview = () => {
    const html = generateAgreement(input);
    const record = archiveAgreement(html);
    openBrochureForPrint(html, record.filename.replace(/\.html$/i, '.pdf'));
  };

  const handleDownload = () => {
    const html = generateAgreement(input);
    const record = archiveAgreement(html);
    const filename = record.filename;
    downloadAsHTML(html, filename);
    toast.success(`Agreement downloaded and archived: ${record.agreementNumber}`);
  };

  const openSavedAgreement = (record: SavedAgreementRecord) => {
    openBrochureForPrint(record.html, record.filename.replace(/\.html$/i, '.pdf'));
  };

  const downloadSavedAgreement = (record: SavedAgreementRecord) => {
    downloadAsHTML(record.html, record.filename);
  };

  const loadSavedAgreementInputs = (record: SavedAgreementRecord) => {
    setInput(record.inputSnapshot);
    setGenerated(true);
    toast.success(`Loaded editable inputs from ${record.agreementNumber}`);
  };

  // Auto-generate all fields from Jackie data
  const autoFill = () => {
    if (!jackieData) {
      toast.error('Pull report data first');
      return;
    }
    const d = jackieData;
    update({
      units: d.units || input.units,
      blockLot: d.bbl ? `BBL: ${d.bbl}` : input.blockLot,
      isRentStabilized: d.isRentStabilized,
      buildingType: `${d.units} ${d.propertyType} Units${d.isRentStabilized ? ' · Rent Stabilized' : ''}`,
      propertyCity: 'New York',
      propertyState: 'NY',
      tieredPricing: d.tieredPricing,
      selectedTier: 'intelligence',
      customMonthlyFee: null,
    });
    toast.success('Auto-filled from Engagement report data');
  };

  const tierOptions: Array<{ key: AgreementInput['selectedTier']; label: string; desc: string }> = [
    { key: 'intelligence', label: 'Camelot Intelligence ⭐', desc: 'Recommended: AI portal, zero bank fees, market reports' },
    { key: 'classic', label: 'Camelot Classic', desc: 'Full management, standard tech' },
    { key: 'premier', label: 'Camelot Premier', desc: 'White-glove, dedicated PM, insurance rebid' },
  ];

  const currentTierFee = input.tieredPricing ? input.tieredPricing[input.selectedTier].monthly : 0;
  const currentMonthlyFee = input.customMonthlyFee || currentTierFee;
  const jackieIntelligenceMonthly = jackieData?.tieredPricing?.intelligence?.monthly || jackieData?.monthlyFee || 0;
  const pricingMatchesJackie = Boolean(
    jackieIntelligenceMonthly &&
    currentMonthlyFee &&
    Math.abs(currentMonthlyFee - jackieIntelligenceMonthly) < 1 &&
    input.selectedTier === 'intelligence' &&
    !input.customMonthlyFee
  );
  const resetPricingToJackie = () => {
    if (!jackieData) {
      toast.error('Load report data first');
      return;
    }
    update({
      selectedTier: 'intelligence',
      tieredPricing: jackieData.tieredPricing,
      customMonthlyFee: null,
    });
    toast.success('Agreement pricing reset to Camelot Intelligence');
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-camelot-gold rounded-lg flex items-center justify-center">
          <Sword size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Excalibur</h1>
          <p className="text-gray-500 text-sm">Agreement Engine — Generate branded property management agreements by asset class</p>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white rounded-xl border shadow-sm divide-y">

        {/* SECTION: Asset Class */}
        <div className="p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Agreement Type</h2>
          <div className="grid grid-cols-3 gap-2">
            {(Object.entries(ASSET_CLASS_LABELS) as [AssetClass, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => update({ assetClass: key })}
                className={cn(
                  'px-4 py-3 rounded-lg text-sm font-medium transition-all text-left',
                  input.assetClass === key
                    ? 'bg-camelot-gold text-white shadow-md'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* SECTION: Property Address + Jackie Pull */}
        <div className="p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Property</h2>
          <div className="flex gap-3 mb-3">
            <input
              type="text"
              placeholder="Property address (e.g., 553 W 187th St)"
              value={input.propertyAddress}
              onChange={e => update({ propertyAddress: e.target.value })}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-camelot-gold/50"
            />
            <button
              onClick={pullFromJackieArchiveAware}
              disabled={jackieLoading || !input.propertyAddress.trim()}
              className="bg-camelot-gold/10 text-camelot-gold px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-camelot-gold/20 transition-colors disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
            >
              {jackieLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              Pull from Jackie
            </button>
          </div>
          <div className="bg-[#F8F3E3] border border-camelot-gold/30 rounded-lg p-3 mb-3">
            <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
              <div className="flex-1">
                <div className="text-xs font-bold text-[#5B4A1F] uppercase tracking-wider">Use Saved Engagement Report</div>
                <p className="text-[11px] text-gray-600 mt-1">
                  Agreements can pull the same archived Jackie facts, Intelligence pricing, ownership, BBL, and report context instead of starting from a separate script.
                </p>
              </div>
              <select
                value={selectedArchiveId}
                onChange={e => setSelectedArchiveId(e.target.value)}
                onFocus={() => setJackieArchive(loadLocalJackieReportLibrary())}
                className="lg:w-80 px-3 py-2 border border-camelot-gold/30 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-camelot-gold/40"
              >
                <option value="">Select archived Engagement report</option>
                {jackieArchive.filter(record => record.dataSnapshot).map(record => (
                  <option key={record.id} value={record.id}>
                    {record.reportNumber} - {record.address} - {formatLibraryDate(record.generatedAt)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={loadArchivedJackie}
                className="px-4 py-2 bg-[#3A4B5B] text-white rounded-lg text-xs font-semibold hover:bg-[#2d3d4d] whitespace-nowrap"
              >
                Load Archive
              </button>
            </div>
            {linkedJackieReport && (
              <div className="mt-2 text-[11px] text-emerald-700 font-semibold">
                Linked to Jackie report {linkedJackieReport.reportNumber} - {linkedJackieReport.packageLabel}
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <input type="text" placeholder="City" value={input.propertyCity} onChange={e => update({ propertyCity: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-camelot-gold/50" />
            <input type="text" placeholder="State" value={input.propertyState} onChange={e => update({ propertyState: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-camelot-gold/50" />
            <input type="text" placeholder="Zip" value={input.propertyZip} onChange={e => update({ propertyZip: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-camelot-gold/50" />
          </div>
          <div className="grid grid-cols-3 gap-3 mt-3">
            <input type="number" placeholder="Units" value={input.units || ''} onChange={e => update({ units: parseInt(e.target.value) || 0 })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-camelot-gold/50" />
            <input type="text" placeholder="Block/Lot (e.g., Block 2145, Lot 32)" value={input.blockLot} onChange={e => update({ blockLot: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-camelot-gold/50" />
            <input type="text" placeholder="Building type description" value={input.buildingType} onChange={e => update({ buildingType: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-camelot-gold/50" />
          </div>
          <div className="flex gap-4 mt-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={input.isRentStabilized} onChange={e => update({ isRentStabilized: e.target.checked })} className="rounded border-gray-300 text-camelot-gold focus:ring-camelot-gold" />
              Rent Stabilized
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={input.isUnion} onChange={e => update({ isUnion: e.target.checked })} className="rounded border-gray-300 text-camelot-gold focus:ring-camelot-gold" />
              Union (32BJ)
            </label>
          </div>
          {jackieData && (
            <button onClick={autoFill} className="mt-3 text-xs text-camelot-gold hover:underline flex items-center gap-1">
              <Sparkles size={12} /> Auto-fill remaining fields from Jackie data
            </button>
          )}
        </div>

        {/* SECTION: Client / Parties */}
        <div className="p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Client (Owner)</h2>
          <div className="grid grid-cols-2 gap-3">
            <input type="text" placeholder="Client name (e.g., Jose Ramon Tur)" value={input.clientName} onChange={e => update({ clientName: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-camelot-gold/50" />
            <input type="text" placeholder="Entity name (if different)" value={input.clientEntityName} onChange={e => update({ clientEntityName: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-camelot-gold/50" />
          </div>
        </div>

        {/* SECTION: Agreement Terms */}
        <div className="p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Agreement Terms</h2>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Effective Date</label>
              <input type="date" value={input.effectiveDate} onChange={e => update({ effectiveDate: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-camelot-gold/50" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Initial Term (years)</label>
              <select value={input.initialTermYears} onChange={e => update({ initialTermYears: parseInt(e.target.value) })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-camelot-gold/50">
                <option value={1}>1 Year</option>
                <option value={2}>2 Years</option>
                <option value={3}>3 Years</option>
                <option value={5}>5 Years</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Termination Notice (days)</label>
              <select value={input.terminationNoticeDays} onChange={e => update({ terminationNoticeDays: parseInt(e.target.value) })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-camelot-gold/50">
                <option value={60}>60 Days</option>
                <option value={90}>90 Days</option>
                <option value={120}>120 Days</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Annual Increase (%)</label>
              <select value={input.annualIncrease} onChange={e => update({ annualIncrease: parseInt(e.target.value) })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-camelot-gold/50">
                <option value={3}>3%</option>
                <option value={4}>4%</option>
                <option value={5}>5%</option>
              </select>
            </div>
          </div>
        </div>

        {/* SECTION: Pricing Tier */}
        <div className="p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Pricing</h2>
          <div className="grid grid-cols-3 gap-3 mb-3">
            {tierOptions.map(t => {
              const pricing = input.tieredPricing;
              const perUnit = pricing ? pricing[t.key].perUnit : null;
              return (
                <button
                  key={t.key}
                  onClick={() => update({ selectedTier: t.key, customMonthlyFee: null })}
                  className={cn(
                    'p-4 rounded-lg text-left transition-all border-2',
                    input.selectedTier === t.key
                      ? t.key === 'intelligence' ? 'bg-camelot-gold/10 border-camelot-gold' : 'bg-gray-50 border-gray-400'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  )}
                >
                  <div className="font-semibold text-sm">{t.label}</div>
                  <div className="text-xs text-gray-500 mt-1">{t.desc}</div>
                  {perUnit && <div className="text-lg font-bold text-camelot-gold mt-2">${perUnit}/unit/mo</div>}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Custom Monthly Fee Override (optional)</label>
              <input type="number" placeholder="Leave blank for auto-calculated" value={input.customMonthlyFee || ''} onChange={e => update({ customMonthlyFee: e.target.value ? parseInt(e.target.value) : null })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-camelot-gold/50" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Startup / Onboarding Fee (optional)</label>
              <input type="number" placeholder="$0" value={input.startupFee || ''} onChange={e => update({ startupFee: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-camelot-gold/50" />
            </div>
          </div>
        </div>

        {/* SECTION: Final Review */}
        <div className="p-6 bg-[#F8F3E3]/60">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-4">
            <div>
              <h2 className="text-sm font-semibold text-[#5B4A1F] uppercase tracking-wider">Final Review Before Agreement</h2>
              <p className="text-xs text-gray-600 mt-1">
                Edit these key controls before generating the final agreement. Overrides here affect the agreement only and do not rewrite the archived Jackie report.
              </p>
            </div>
            <button
              type="button"
              onClick={resetPricingToJackie}
              disabled={!jackieData}
              className="px-4 py-2 bg-white border border-camelot-gold/40 text-[#5B4A1F] rounded-lg text-xs font-semibold hover:bg-camelot-gold/10 disabled:opacity-50"
            >
              Reset to Jackie Intelligence
            </button>
          </div>
          <div className="grid lg:grid-cols-3 gap-3">
            <div className="bg-white rounded-lg border border-camelot-gold/25 p-3">
              <div className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Intelligence Source</div>
              <div className="mt-1 text-sm font-bold text-gray-900">
                {linkedJackieReport ? linkedJackieReport.reportNumber : jackieData ? 'Fresh Jackie Data' : 'Not linked'}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {linkedJackieReport ? `${linkedJackieReport.packageLabel} - ${formatLibraryDate(linkedJackieReport.generatedAt)}` : 'Load a saved Jackie report or pull fresh data first.'}
              </div>
            </div>
            <div className="bg-white rounded-lg border border-camelot-gold/25 p-3">
              <div className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Recommended Fee</div>
              <div className="mt-1 text-sm font-bold text-gray-900">
                {jackieIntelligenceMonthly ? `$${jackieIntelligenceMonthly.toLocaleString()}/mo` : 'To be set'}
              </div>
              <div className="text-xs text-gray-500 mt-1">The Camelot Intelligence package should be the starting point.</div>
            </div>
            <div className={cn(
              'rounded-lg border p-3',
              pricingMatchesJackie ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
            )}>
              <div className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Agreement Pricing Check</div>
              <div className={cn('mt-1 text-sm font-bold', pricingMatchesJackie ? 'text-emerald-700' : 'text-amber-700')}>
                {pricingMatchesJackie ? 'Matches Camelot Intelligence' : 'Review before sending'}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                Current agreement fee: {currentMonthlyFee ? `$${currentMonthlyFee.toLocaleString()}/mo` : 'not set'}.
              </div>
            </div>
          </div>
          <div className="grid lg:grid-cols-4 gap-3 mt-3">
            <input type="text" placeholder="Prepared for / client" value={input.clientName} onChange={e => update({ clientName: e.target.value })} className="px-3 py-2 border border-camelot-gold/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-camelot-gold/50" />
            <input type="text" placeholder="Property entity / owner" value={input.clientEntityName} onChange={e => update({ clientEntityName: e.target.value })} className="px-3 py-2 border border-camelot-gold/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-camelot-gold/50" />
            <input type="number" placeholder="Final monthly fee" value={currentMonthlyFee || ''} onChange={e => update({ customMonthlyFee: e.target.value ? parseInt(e.target.value) : null })} className="px-3 py-2 border border-camelot-gold/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-camelot-gold/50" />
            <input type="number" placeholder="Onboarding fee" value={input.startupFee || ''} onChange={e => update({ startupFee: parseInt(e.target.value) || 0 })} className="px-3 py-2 border border-camelot-gold/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-camelot-gold/50" />
          </div>
        </div>

        {/* SECTION: Special Terms */}
        <div className="p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Special Terms (Optional)</h2>
          <textarea
            placeholder="Any special terms, conditions, or notes to include in the agreement..."
            value={input.specialTerms}
            onChange={e => update({ specialTerms: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-camelot-gold/50"
          />
        </div>

        {/* ACTION BUTTONS */}
        <div className="p-6 flex gap-3">
          <button
            onClick={handleGenerate}
            className="bg-camelot-gold text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-camelot-gold-light transition-all flex items-center gap-2 shadow-lg shadow-camelot-gold/20"
          >
            <Sword size={16} /> Generate Agreement
          </button>
          {generated && (
            <>
              <button onClick={handlePreview} className="bg-gray-100 text-gray-700 px-5 py-3 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors flex items-center gap-2">
                <Eye size={16} /> Preview / Print
              </button>
              <button onClick={handleDownload} className="bg-gray-100 text-gray-700 px-5 py-3 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors flex items-center gap-2">
                <Download size={16} /> Download HTML
              </button>
            </>
          )}
        </div>
      </div>

      {/* Preview Summary */}
      {generated && (
        <div className="bg-white rounded-xl border shadow-sm p-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Agreement Summary</h3>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Type:</span><span className="font-medium">{ASSET_CLASS_LABELS[input.assetClass]}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Client:</span><span className="font-medium">{input.clientName || '—'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Property:</span><span className="font-medium">{input.propertyAddress || '—'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Units:</span><span className="font-medium">{input.units || '—'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Tier:</span><span className="font-medium text-camelot-gold">{input.selectedTier === 'classic' ? 'Classic' : input.selectedTier === 'intelligence' ? 'Intelligence ⭐' : 'Premier'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Monthly Fee:</span><span className="font-bold text-camelot-gold">${(input.customMonthlyFee || (input.tieredPricing ? input.tieredPricing[input.selectedTier].monthly : 0)).toLocaleString()}/mo</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Term:</span><span className="font-medium">{input.initialTermYears} year(s), {input.annualIncrease}% annual increase</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Rent Stabilized:</span><span className="font-medium">{input.isRentStabilized ? 'Yes' : 'No'}</span></div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border shadow-sm p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Generated Agreement Library</h3>
            <p className="text-xs text-gray-500 mt-1">
              Saved property management agreements retain the editable input snapshot and the linked Jackie report number when one was used.
            </p>
          </div>
          <span className="text-xs text-camelot-gold font-bold">{savedAgreements.length} saved</span>
        </div>
        {savedAgreements.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
            No agreements archived yet. Generate, preview, or download an agreement to create a record.
          </div>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {savedAgreements.map(record => (
              <div key={record.id} className="rounded-lg border border-gray-200 p-4">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-camelot-gold font-bold">{record.agreementNumber}</div>
                    <div className="text-sm font-bold text-gray-900 mt-1">{record.propertyAddress || 'Draft Agreement'}</div>
                    <div className="text-xs text-gray-500">
                      {record.clientName} · {formatLibraryDate(record.generatedAt)}
                      {record.linkedJackieReportNumber ? ` · Jackie ${record.linkedJackieReportNumber}` : ''}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => loadSavedAgreementInputs(record)} className="px-3 py-2 rounded-lg border border-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-50">
                      Edit Inputs
                    </button>
                    <button type="button" onClick={() => openSavedAgreement(record)} className="px-3 py-2 rounded-lg bg-[#3A4B5B] text-white text-xs font-semibold hover:bg-[#2d3d4d]">
                      Open / Print
                    </button>
                    <button type="button" onClick={() => downloadSavedAgreement(record)} className="px-3 py-2 rounded-lg border border-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-50">
                      Download HTML
                    </button>
                  </div>
                </div>
                <div className="mt-2 text-[11px] text-gray-400 truncate">Stored file: {record.filename}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
