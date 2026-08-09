import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileSpreadsheet, ArrowRight, Check, Loader2, Search, Database, ShieldCheck } from 'lucide-react';
import Papa from 'papaparse';
import { cn } from '@/lib/utils';
import { useBuildingsStore } from '@/lib/store';
import { recalculateBuildingScore } from '@/lib/scoring';
import { fetchFullBuildingReport } from '@/lib/nyc-api';
import type { Building, BuildingType, Contact, PipelineStage } from '@/types';
import toast from 'react-hot-toast';

type ImportStep = 'upload' | 'mapping' | 'preview' | 'complete';

const SCOUT_FIELDS = [
  { key: 'address', label: 'Address', required: true },
  { key: 'name', label: 'Building Name' },
  { key: 'borough', label: 'Borough' },
  { key: 'region', label: 'Region/Neighborhood' },
  { key: 'zip_code', label: 'Zip Code' },
  { key: 'bbl', label: 'BBL' },
  { key: 'bin', label: 'BIN' },
  { key: 'units', label: 'Unit Count' },
  { key: 'type', label: 'Building Type' },
  { key: 'year_built', label: 'Year Built' },
  { key: 'stories', label: 'Stories/Floors' },
  { key: 'building_area', label: 'Building Sq Ft' },
  { key: 'lot_area', label: 'Lot Sq Ft' },
  { key: 'building_class', label: 'Building Class' },
  { key: 'tax_class', label: 'Tax Class' },
  { key: 'dof_owner', label: 'Owner / Entity' },
  { key: 'current_management', label: 'Current Management' },
  { key: 'contacts_name', label: 'Contact Name' },
  { key: 'contacts_role', label: 'Contact Role' },
  { key: 'contacts_phone', label: 'Contact Phone' },
  { key: 'contacts_email', label: 'Contact Email' },
  { key: 'violations_count', label: 'Violations Count' },
  { key: 'open_violations_count', label: 'Open Violations Count' },
  { key: 'market_value', label: 'Market Value' },
  { key: 'assessed_value', label: 'Assessed Value' },
  { key: 'energy_star_score', label: 'Energy Star Score' },
  { key: 'site_eui', label: 'Site EUI' },
  { key: 'notes', label: 'Notes' },
];

const FIELD_ALIASES: Record<string, string[]> = {
  address: ['address', 'property address', 'building address', 'site address', 'location', 'full address'],
  name: ['building name', 'property name', 'name'],
  borough: ['borough', 'county', 'boro'],
  region: ['neighborhood', 'region', 'submarket', 'area'],
  zip_code: ['zip', 'zipcode', 'zip code', 'postal code'],
  bbl: ['bbl', 'borough block lot'],
  bin: ['bin', 'building identification number'],
  units: ['units', 'unit count', 'residential units', 'total units', '# units', 'number of units'],
  type: ['type', 'building type', 'property type', 'asset type', 'class'],
  year_built: ['year built', 'built', 'yr built', 'construction year'],
  stories: ['stories', 'floors', 'num floors', 'number of floors'],
  building_area: ['building sq ft', 'building sqft', 'gross sq ft', 'gross sqft', 'bldg area', 'building area'],
  lot_area: ['lot sq ft', 'lot sqft', 'lot area', 'land sq ft'],
  building_class: ['building class', 'bldg class', 'bldgcl', 'property class'],
  tax_class: ['tax class'],
  dof_owner: ['owner', 'owner name', 'ownership', 'entity', 'registered owner'],
  current_management: ['management', 'manager', 'management company', 'managing agent', 'current management'],
  contacts_name: ['contact', 'contact name', 'decision maker', 'board contact', 'owner contact'],
  contacts_role: ['contact role', 'role', 'title'],
  contacts_phone: ['phone', 'telephone', 'contact phone'],
  contacts_email: ['email', 'e-mail', 'contact email'],
  violations_count: ['violations', 'violation count', 'total violations'],
  open_violations_count: ['open violations', 'open violation count'],
  market_value: ['market value', 'full value', 'full market value'],
  assessed_value: ['assessed value', 'assessment', 'tax assessment'],
  energy_star_score: ['energy star', 'energy star score'],
  site_eui: ['site eui', 'eui'],
  notes: ['notes', 'comments', 'remarks'],
};

const normalizeHeader = (value: string) => value.toLowerCase().replace(/[_/-]+/g, ' ').replace(/\s+/g, ' ').trim();
const parseNumber = (value?: string) => {
  if (!value) return undefined;
  const parsed = Number(String(value).replace(/[$,%\s,]/g, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
};
const parseInteger = (value?: string) => {
  const parsed = parseNumber(value);
  return parsed === undefined ? undefined : Math.round(parsed);
};
const normalizeBuildingType = (value?: string): BuildingType => {
  const v = normalizeHeader(value || '');
  if (/co.?op|coop/.test(v)) return 'co-op';
  if (/condo|condominium/.test(v)) return 'condo';
  if (/rental|apartment|multifamily|multi family/.test(v)) return 'rental';
  if (/mixed/.test(v)) return 'mixed-use';
  if (/commercial|office|retail/.test(v)) return 'commercial';
  return 'other';
};
const inferBorough = (address: string, supplied?: string) => {
  if (supplied) return supplied;
  const a = address.toLowerCase();
  if (/\bnew york\b|\bmanhattan\b|\bny 100/.test(a)) return 'Manhattan';
  if (/\bbrooklyn\b|\bny 112/.test(a)) return 'Brooklyn';
  if (/\bqueens\b|\bjackson heights\b|\bwoodside\b|\bflushing\b|\bastoria\b|\bhoward beach\b|\bny 113|\bny 114|\bny 111/.test(a)) return 'Queens';
  if (/\bbronx\b|\bny 104/.test(a)) return 'Bronx';
  if (/\bstaten island\b|\bny 103/.test(a)) return 'Staten Island';
  return undefined;
};

export default function Import() {
  const navigate = useNavigate();
  const addBuildings = useBuildingsStore((s) => s.addBuildings);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<ImportStep>('upload');
  const [fileName, setFileName] = useState('');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [importStage, setImportStage] = useState<PipelineStage>('discovered');
  const [enrichAfterImport, setEnrichAfterImport] = useState(true);
  const [enrichProgress, setEnrichProgress] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const parseCSV = (text: string): { headers: string[]; rows: Record<string, string>[] } => {
    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      delimiter: text.includes('\t') ? '\t' : '',
      transformHeader: (header) => header.trim(),
    });
    if (parsed.errors.length) {
      console.warn('Import parse warnings:', parsed.errors);
    }
    const rows = parsed.data.filter((row) => Object.values(row).some((value) => String(value || '').trim()));
    return { headers: parsed.meta.fields || [], rows };
  };

  const parseWorkbook = async (file: File): Promise<{ headers: string[]; rows: Record<string, string>[] }> => {
    const ExcelJS = await import('exceljs');
    const buffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) return { headers: [], rows: [] };

    const headerRow = worksheet.getRow(1);
    const headers = Array.from({ length: worksheet.columnCount }, (_, index) =>
      headerRow.getCell(index + 1).text.trim()
    );
    const rows: Record<string, string>[] = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const record = Object.fromEntries(
        headers.map((header, index) => [header, row.getCell(index + 1).text])
      );
      if (Object.values(record).some((value) => value.trim())) rows.push(record);
    });
    return { headers, rows };
  };

  const buildAutoMapping = (headers: string[]) => {
    const autoMap: Record<string, string> = {};
    const normalized = headers.map((header) => ({ original: header, normalized: normalizeHeader(header) }));
    SCOUT_FIELDS.forEach((field) => {
      const aliases = FIELD_ALIASES[field.key] || [field.key, field.label];
      const match = normalized.find((header) =>
        aliases.some((alias) => header.normalized === normalizeHeader(alias))
      ) || normalized.find((header) =>
        aliases.some((alias) => header.normalized.includes(normalizeHeader(alias)) || normalizeHeader(alias).includes(header.normalized))
      );
      if (match) autoMap[field.key] = match.original;
    });
    return autoMap;
  };

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.match(/\.(csv|tsv|txt|xlsx)$/i)) {
      toast.error('Please upload a CSV, TSV, TXT, or XLSX file');
      return;
    }

    setFileName(file.name);
    try {
      const { headers, rows } = file.name.match(/\.xlsx$/i)
        ? await parseWorkbook(file)
        : parseCSV(await file.text());
      setCsvHeaders(headers);
      setCsvData(rows);
      setFieldMapping(buildAutoMapping(headers));

      setStep('mapping');
      toast.success(`Loaded ${rows.length} rows from ${file.name}`);
    } catch (err) {
      console.error('Import file parse failed:', err);
      toast.error('File could not be parsed. Try saving Excel as CSV if the workbook is protected.');
    }
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const enrichBuildingFromPublicRecords = async (building: Building, index: number, total: number): Promise<Building> => {
    setEnrichProgress(`Public-record scan ${index + 1} of ${total}: ${building.address}`);
    try {
      const report = await fetchFullBuildingReport(building.address, building.borough);
      const contacts: Contact[] = [...(building.contacts || [])];
      (report.hpdContacts || []).slice(0, 8).forEach((contact: any) => {
        const name = contact.name || contact.corp;
        if (!name) return;
        contacts.push({
          name,
          role: contact.type || contact.description || 'HPD Contact',
          company: contact.corp || undefined,
          notes: [contact.description, contact.title, contact.address].filter(Boolean).join(' | ') || undefined,
          source: 'HPD MDR import enrichment',
        });
      });

      const enriched: Building = {
        ...building,
        borough: building.borough || inferBorough(building.address),
        units: report.dof?.units || report.dobUnits || building.units,
        year_built: report.dof?.yearBuilt || building.year_built,
        stories: report.dof?.stories || report.dobStories || building.stories,
        lot_area: report.dof?.lotArea || building.lot_area,
        building_area: report.dof?.buildingArea || building.building_area,
        building_class: report.dof?.buildingClass || building.building_class,
        tax_class: report.dof?.taxClass || building.tax_class,
        bbl: report.dof?.bbl || building.bbl,
        hpd_building_id: report.registration?.buildingId || building.hpd_building_id,
        current_management: report.registration?.managementCompany || building.current_management,
        dof_owner: report.dof?.owner || report.registration?.owner || building.dof_owner,
        market_value: report.dof?.marketValue || building.market_value,
        assessed_value: report.dof?.assessedValue || building.assessed_value,
        land_value: report.dof?.landValue || building.land_value,
        violations_count: report.violations?.total ?? building.violations_count,
        open_violations_count: report.violations?.open ?? building.open_violations_count,
        last_violation_date: report.violations?.lastDate || building.last_violation_date,
        energy_star_score: report.energy?.energyStarScore || building.energy_star_score,
        site_eui: report.energy?.siteEUI || building.site_eui,
        ghg_emissions: report.energy?.ghgEmissions || building.ghg_emissions,
        contacts,
        enriched_data: {
          ...(building.enriched_data || {}),
          importPublicRecordScan: {
            scannedAt: new Date().toISOString(),
            sourceStack: 'HPD, DOF, DOB, ACRIS, ECB/OATH, LL97, rent stabilization, litigation and tax lien endpoints where available',
          },
          hpd: report.registration,
          hpdContacts: report.hpdContacts,
          dof: report.dof,
          permits: report.permits,
          energy: report.energy,
          acris: report.acris,
          ecb: report.ecb,
          litigation: report.litigation,
          rentStabilization: report.rentStabilization,
          buildingOps: report.buildingOps,
          facade: report.facade,
          taxLiens: report.taxLiens,
        },
        tags: Array.from(new Set([...(building.tags || []), 'imported', 'bulk-list', 'public-record-scan'])),
        updated_at: new Date().toISOString(),
      };

      const { score, grade, signals } = recalculateBuildingScore(enriched);
      return { ...enriched, score, grade, signals };
    } catch (err) {
      console.warn(`Public-record enrichment failed for ${building.address}`, err);
      return {
        ...building,
        tags: Array.from(new Set([...(building.tags || []), 'imported', 'bulk-list', 'needs-source-check'])),
        notes: [building.notes, 'Public-record enrichment did not complete during import; open Details and refresh NYC data.'].filter(Boolean).join('\n'),
      };
    }
  };

  const runImport = async () => {
    setIsImporting(true);
    setEnrichProgress('');
    let buildings: Building[] = csvData.map((row) => {
      const getVal = (fieldKey: string) => {
        const csvCol = fieldMapping[fieldKey];
        return csvCol ? row[csvCol] : '';
      };
      const address = getVal('address') || 'Unknown Address';
      const importedOwner = getVal('dof_owner');

      const building: Partial<Building> = {
        id: crypto.randomUUID(),
        address,
        name: getVal('name') || undefined,
        borough: inferBorough(address, getVal('borough')) || undefined,
        region: getVal('region') || undefined,
        neighborhood: getVal('region') || undefined,
        zip_code: getVal('zip_code') || undefined,
        bbl: getVal('bbl') || undefined,
        bin: getVal('bin') || undefined,
        units: parseInteger(getVal('units')),
        type: normalizeBuildingType(getVal('type')),
        year_built: parseInteger(getVal('year_built')),
        stories: parseInteger(getVal('stories')),
        building_area: parseNumber(getVal('building_area')),
        lot_area: parseNumber(getVal('lot_area')),
        building_class: getVal('building_class') || undefined,
        tax_class: getVal('tax_class') || undefined,
        dof_owner: importedOwner || undefined,
        current_management: getVal('current_management') || undefined,
        violations_count: parseInteger(getVal('violations_count')) || 0,
        open_violations_count: parseInteger(getVal('open_violations_count')) || 0,
        market_value: parseNumber(getVal('market_value')),
        assessed_value: parseNumber(getVal('assessed_value')),
        energy_star_score: parseInteger(getVal('energy_star_score')),
        site_eui: parseNumber(getVal('site_eui')),
        notes: getVal('notes') || undefined,
        contacts: [],
        enriched_data: {},
        signals: ['User-supplied bulk list candidate'],
        tags: ['imported', 'bulk-list', fileName ? `source:${fileName}` : 'source:bulk-upload'],
        status: 'active',
        source: fileName ? `bulk import: ${fileName}` : 'bulk import',
        pipeline_stage: importStage,
        pipeline_moved_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Build contact if data present
      const contactName = getVal('contacts_name');
      if (contactName) {
        building.contacts = [{
          name: contactName,
          role: getVal('contacts_role') || 'Unknown',
          phone: getVal('contacts_phone') || undefined,
          email: getVal('contacts_email') || undefined,
          source: 'import',
        }];
      }

      // Calculate score
      const { score, grade, signals } = recalculateBuildingScore(building);
      building.score = score;
      building.grade = grade;
      building.signals = signals;

      return building as Building;
    });

    if (enrichAfterImport) {
      toast.loading('Running public-record scans on imported addresses...', { id: 'bulk-import' });
      const enriched: Building[] = [];
      for (let i = 0; i < buildings.length; i += 1) {
        // Sequential calls avoid hammering NYC endpoints and make progress easier to follow.
        // A PropertyShark list is usually worth being slower and more accurate here.
        enriched.push(await enrichBuildingFromPublicRecords(buildings[i], i, buildings.length));
      }
      buildings = enriched;
      toast.success('Public-record enrichment complete', { id: 'bulk-import' });
    }

    addBuildings(buildings);
    setImportedCount(buildings.length);
    setStep('complete');
    setIsImporting(false);
    setEnrichProgress('');
    toast.success(`Imported ${buildings.length} buildings! Redirecting to Results...`);

    // Auto-redirect to Results after a brief delay so user sees the success state
    setTimeout(() => {
      navigate('/results');
    }, 2000);
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-5">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Upload size={24} className="text-camelot-gold" /> Bulk Property Intake
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload a PropertyShark, Excel, Google Sheets, or CSV list and turn every address into a searchable property card.
        </p>
      </div>

      {/* Progress Steps */}
      <div className="px-8 py-4 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2 max-w-2xl mx-auto">
          {['upload', 'mapping', 'preview', 'complete'].map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                step === s ? 'bg-camelot-gold text-white' :
                ['upload', 'mapping', 'preview', 'complete'].indexOf(step) > i ? 'bg-green-500 text-white' :
                'bg-gray-200 text-gray-500'
              )}>
                {['upload', 'mapping', 'preview', 'complete'].indexOf(step) > i ? <Check size={14} /> : i + 1}
              </div>
              <span className="text-xs capitalize hidden sm:block">{s}</span>
              {i < 3 && <ArrowRight size={14} className="text-gray-300 flex-shrink-0" />}
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-8 py-8">
        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={() => setIsDragging(false)}
            className={cn(
              'border-2 border-dashed rounded-2xl p-16 text-center transition-all cursor-pointer',
              isDragging ? 'border-camelot-gold bg-camelot-gold/5' : 'border-gray-300 hover:border-camelot-gold'
            )}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.tsv,.txt"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              className="hidden"
            />
            <FileSpreadsheet size={48} className={cn('mx-auto mb-4', isDragging ? 'text-camelot-gold' : 'text-gray-400')} />
            <h3 className="text-lg font-bold mb-2">Drop your property list here</h3>
            <p className="text-sm text-gray-500 mb-4">or click to browse</p>
            <p className="text-xs text-gray-400">Supports: XLSX, CSV, TSV, TXT. Required field: property address.</p>
            <div className="flex justify-center gap-4 mt-6">
              {['PropertyShark List', 'Excel Workbook', 'Google Sheets CSV', 'Generic CSV'].map((fmt) => (
                <span key={fmt} className="text-xs bg-gray-100 text-gray-500 px-3 py-1 rounded-full">{fmt}</span>
              ))}
            </div>
            <div className="max-w-2xl mx-auto mt-8 grid sm:grid-cols-3 gap-3 text-left">
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <Database size={18} className="text-camelot-gold mb-2" />
                <p className="text-sm font-semibold">You control the list</p>
                <p className="text-xs text-gray-500 mt-1">Upload addresses from PropertyShark or your own target sheet instead of relying only on broad territory searches.</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <Search size={18} className="text-camelot-gold mb-2" />
                <p className="text-sm font-semibold">Scout fills the cards</p>
                <p className="text-xs text-gray-500 mt-1">Optional enrichment checks HPD, DOF, DOB, ACRIS, ECB/OATH, LL97, litigation, tax liens, and building operations signals where available.</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <ShieldCheck size={18} className="text-camelot-gold mb-2" />
                <p className="text-sm font-semibold">Then run Jackie</p>
                <p className="text-xs text-gray-500 mt-1">Imported properties land in Results so you can open Details, enrich contacts, preview reports, push HubSpot, and create outreach.</p>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Mapping */}
        {step === 'mapping' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold">Map Columns</h3>
                <p className="text-sm text-gray-500">Match your uploaded columns to Scout fields. PropertyShark-style headers are auto-detected where possible.</p>
              </div>
              <span className="text-sm text-gray-400">{csvData.length} rows • {csvHeaders.length} columns</span>
            </div>

            <div className="space-y-3">
              {SCOUT_FIELDS.map((field) => (
                <div key={field.key} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                  <div className="w-48">
                    <span className="text-sm font-medium">{field.label}</span>
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </div>
                  <ArrowRight size={14} className="text-gray-400" />
                  <select
                    value={fieldMapping[field.key] || ''}
                    onChange={(e) => setFieldMapping({ ...fieldMapping, [field.key]: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-camelot-gold/50"
                  >
                    <option value="">— Skip —</option>
                    {csvHeaders.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                  {fieldMapping[field.key] && (
                    <span className="text-xs text-gray-400 w-32 truncate">
                      e.g. "{csvData[0]?.[fieldMapping[field.key]] || '—'}"
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Import Stage */}
            <div className="mt-6 grid md:grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-xl">
                <label className="text-sm font-medium mb-2 block">Import into pipeline stage:</label>
                <select
                  value={importStage}
                  onChange={(e) => setImportStage(e.target.value as PipelineStage)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                >
                  <option value="discovered">Discovered</option>
                  <option value="scored">Scored</option>
                  <option value="contacted">Contacted</option>
                  <option value="nurture">Nurture</option>
                </select>
              </div>
              <label className="p-4 bg-camelot-gold/5 border border-camelot-gold/20 rounded-xl flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enrichAfterImport}
                  onChange={(e) => setEnrichAfterImport(e.target.checked)}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-semibold text-camelot-navy">Run public-record enrichment after import</span>
                  <span className="block text-xs text-gray-500 mt-1">Recommended. This populates violations, ownership, financials, permits, energy, contacts, and operations signals before opening Results.</span>
                </span>
              </label>
            </div>

            <div className="flex justify-between mt-6">
              <button onClick={() => setStep('upload')} className="text-sm text-gray-500 hover:text-gray-700">
                ← Back
              </button>
              <button
                onClick={() => setStep('preview')}
                disabled={!fieldMapping['address']}
                className="bg-camelot-gold text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-camelot-gold-dark disabled:opacity-50"
              >
                Preview Import →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Preview */}
        {step === 'preview' && (
          <div>
            <h3 className="text-lg font-bold mb-2">Preview</h3>
            <p className="text-sm text-gray-500 mb-6">Review the first 5 rows before importing</p>

            <div className="overflow-x-auto bg-white border border-gray-200 rounded-xl">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {SCOUT_FIELDS.filter((f) => fieldMapping[f.key]).map((f) => (
                      <th key={f.key} className="text-left px-3 py-2 text-xs font-semibold text-gray-500">{f.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {csvData.slice(0, 5).map((row, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      {SCOUT_FIELDS.filter((f) => fieldMapping[f.key]).map((f) => (
                        <td key={f.key} className="px-3 py-2 text-xs truncate max-w-[150px]">
                          {row[fieldMapping[f.key]] || '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-sm text-gray-500 mt-4">
              Importing {csvData.length} buildings into <strong className="capitalize">{importStage}</strong> stage.
              {enrichAfterImport ? ' Scout will run an initial public-record enrichment pass before sending you to Results.' : ' Scout will create property cards only; you can enrich from each Details card later.'}
            </p>
            {enrichProgress && (
              <div className="mt-4 p-3 rounded-lg bg-camelot-navy text-white text-sm flex items-center gap-2">
                <Loader2 size={15} className="animate-spin" />
                {enrichProgress}
              </div>
            )}

            <div className="flex justify-between mt-6">
              <button onClick={() => setStep('mapping')} className="text-sm text-gray-500 hover:text-gray-700">
                ← Back
              </button>
              <button
                onClick={runImport}
                disabled={isImporting}
                className="bg-camelot-gold text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-camelot-gold-dark disabled:opacity-50 flex items-center gap-2"
              >
                {isImporting ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {enrichAfterImport ? 'Import & Scan' : 'Import'} {csvData.length} Buildings
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Complete */}
        {step === 'complete' && (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Check size={32} className="text-green-600" />
            </div>
            <h3 className="text-xl font-bold mb-2">Import Complete!</h3>
            <p className="text-gray-500 mb-6">{importedCount} buildings imported successfully</p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => { setStep('upload'); setCsvData([]); setCsvHeaders([]); setFieldMapping({}); }}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
              >
                Import More
              </button>
              <button
                onClick={() => navigate('/results')}
                className="bg-camelot-gold text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-camelot-gold-dark"
              >
                View Results →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
