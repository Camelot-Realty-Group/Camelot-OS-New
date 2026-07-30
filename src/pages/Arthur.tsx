import { useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Mail,
  Printer,
  RefreshCw,
  Search,
  Send,
  SlidersHorizontal,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cn, formatCurrency, formatNumber } from '@/lib/utils';
import { downloadAsHTML, openBrochureForPrint, openEmailDraft } from '@/lib/pdf-generator';
import { loadReportInputs, saveReportInputs } from '@/lib/report-input-memory';
import { DAVID_GOLDOFF_SIGNATURE_TEXT } from '@/lib/camelot-signature';
import {
  ARTHUR_CRITERIA_FIELDS,
  DEFAULT_ARTHUR_CRITERIA,
  type ArthurCriteria,
  type ArthurDealType,
  type ArthurModel,
  type ArthurProperty,
  arthurDealTypeLabel,
  buildArthurFilename,
  buildArthurModel,
  buildArthurReportHtml,
  downloadArthurExcel,
  searchArthurListings,
} from '@/lib/arthur-underwriting';

const DEAL_TYPES: ArthurDealType[] = [
  'commercial',
  'family_internal',
  'gp_lp',
  'jv',
  'land_lease',
  'new_development',
  'land_purchase',
  'one_to_four_family',
  'walk_up',
  'elevator',
  'mixed_use',
  'hoa_condo_recovery',
];
const ARTHUR_INPUT_SCOPE = 'arthur-underwriter';

export default function Arthur() {
  const [criteria, setCriteria] = useState<ArthurCriteria>(DEFAULT_ARTHUR_CRITERIA);
  const [results, setResults] = useState<ArthurProperty[]>(() => searchArthurListings(DEFAULT_ARTHUR_CRITERIA));
  const [selectedId, setSelectedId] = useState(results[0]?.id || '');
  const [isSearching, setIsSearching] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [pushStatus, setPushStatus] = useState('');
  const [candidateIds, setCandidateIds] = useState<string[]>([]);
  const detailRef = useRef<HTMLElement | null>(null);

  const selected = useMemo(
    () => results.find((property) => property.id === selectedId) || results[0],
    [results, selectedId]
  );
  const hasNearestResults = results.some((property) => property.matchStatus === 'nearest');
  const exactResultCount = results.filter((property) => property.matchStatus !== 'nearest').length;
  const model = useMemo(() => selected ? buildArthurModel(selected) : null, [selected]);
  const reportHtml = useMemo(() => selected && model ? buildArthurReportHtml(selected, criteria, model) : '', [selected, criteria, model]);

  const runSearch = () => {
    saveReportInputs(ARTHUR_INPUT_SCOPE, criteria);
    setIsSearching(true);
    window.setTimeout(() => {
      const next = searchArthurListings(criteria);
      setResults(next);
      setSelectedId(next[0]?.id || '');
      setIsSearching(false);
      const nearest = next.some((property) => property.matchStatus === 'nearest');
      toast.success(nearest ? `${next.length} nearest Arthur candidates shown` : `${next.length} Arthur candidate${next.length === 1 ? '' : 's'} found`);
    }, 300);
  };

  const loadLastInputs = () => {
    const saved = loadReportInputs<ArthurCriteria>(ARTHUR_INPUT_SCOPE);
    if (!saved) {
      toast.error('No saved Arthur criteria found yet');
      return;
    }
    setCriteria(saved);
    const next = searchArthurListings(saved);
    setResults(next);
    setSelectedId(next[0]?.id || '');
    toast.success('Last Arthur criteria restored');
  };

  const selectProperty = (id: string) => {
    setSelectedId(id);
    const picked = results.find((property) => property.id === id);
    if (picked) toast.success(`Selected ${picked.name}. Underwriting results updated.`);
    window.setTimeout(() => {
      detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const addCandidateAndUnderwrite = (id: string) => {
    setCandidateIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    selectProperty(id);
    const picked = results.find((property) => property.id === id);
    if (picked) toast.success(`${picked.name} added to potential investment candidates.`);
  };

  const openListingSource = (property: ArthurProperty) => {
    const url = property.sourceUrl || `https://www.google.com/search?q=${encodeURIComponent(property.address + ' investment listing broker')}`;
    window.open(url, '_blank');
  };

  const toggleDealType = (type: ArthurDealType) => {
    setCriteria((prev) => ({
      ...prev,
      dealTypes: prev.dealTypes.includes(type)
        ? prev.dealTypes.filter((item) => item !== type)
        : [...prev.dealTypes, type],
    }));
  };

  const sendToHubSpot = async () => {
    if (!selected) return;
    setIsPushing(true);
    setPushStatus('');
    const quality = { score: Math.round((selected.neighborhoodScore + selected.commuteScore) / 2), tier: 'hot', missingFields: [], strengths: selected.pros, warnings: selected.cons };
    const routing = { team: 'Arthur / acquisitions desk', region: selected.location, priority: 'same-day', tags: ['arthur-underwriting', selected.type, 'investment-candidate'] };
    try {
      const response = await fetch('/api/integrations/push-building', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          building: {
            id: selected.id,
            name: selected.name,
            address: selected.address,
            region: selected.location,
            neighborhood: selected.location,
            units: selected.units,
            type: selected.type,
            score: quality.score,
            grade: quality.score >= 76 ? 'A' : 'B',
            current_management: selected.ownership,
            market_value: selected.askingPrice,
            assessed_value: selected.lastSalePrice,
            violations_count: selected.violations,
            open_violations_count: selected.violations,
            signals: [...selected.pros, ...selected.cons],
            tags: routing.tags,
          },
          contact: {
            name: selected.listingAgent,
            email: '',
            phone: '',
            role: 'listing_agent',
            company: selected.listingSource,
          },
          quality,
          routing,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok && data.status === 'error') throw new Error(data.hubspot?.message || data.scout?.message || 'HubSpot push failed');
      const scoutMessage = data.scout?.message || 'Saved to Scout/local lead queue.';
      const hubspotMessage = data.hubspot?.message || 'HubSpot sync attempted.';
      const nextStatus = `${selected.name} was queued for Scout/HubSpot. Scout: ${scoutMessage} HubSpot: ${hubspotMessage}`;
      setPushStatus(nextStatus);
      if (data.status === 'ok') toast.success(`Queued ${selected.name} for Scout/HubSpot`);
      else if (data.status === 'partial' || data.status === 'skipped') toast(`Queued with follow-up needed: ${selected.name}`, { icon: '!' });
      else toast.error(`Scout/HubSpot follow-up needed for ${selected.name}`);
    } catch (err: any) {
      toast.error(err.message || 'HubSpot workflow failed');
    } finally {
      setIsPushing(false);
    }
  };

  const emailReport = async () => {
    if (!selected) return;
    // Download the report first — browser email drafts cannot carry
    // attachments, so the user needs the file on disk to attach manually.
    const reportFilename = buildArthurFilename(selected, 'html');
    await downloadAsHTML(reportHtml, reportFilename);
    openEmailDraft({
      to: '',
      subject: `Arthur Investment Report - ${selected.address}`,
      body: `To the investment review team,\n\nAttached is the Arthur Investment Report for ${selected.address}. The opportunity includes ${selected.units} units, estimated base IRR of ${model ? (model.irr * 100).toFixed(1) : 'TBD'}%, and an underwriting package that should be reviewed alongside Camelot operator diligence.\n\nSincerely,\n${DAVID_GOLDOFF_SIGNATURE_TEXT}`,
    });
    toast(`"${reportFilename}" was saved to your Downloads — attach it to the draft before sending.`, { duration: 10000, icon: '📎' });
  };

  const emailBrokerInquiry = () => {
    if (!selected) return;
    openEmailDraft({
      to: selected.brokerEmail || '',
      subject: `Buyer inquiry from Camelot Brokerage Services Corp. - ${selected.address}`,
      body: `Dear ${selected.listingAgent || 'Listing Broker'},\n\nI am reaching out on behalf of Camelot Brokerage Services Corp. regarding ${selected.address}. We are reviewing the opportunity for a potential acquisition candidate and would appreciate any available listing package, rent roll, operating statements, tax information, violation/compliance history, and seller timing guidance.\n\nPlease let us know whether the asset is still available and the best time to discuss pricing, terms, and diligence access.\n\nSincerely,\n${DAVID_GOLDOFF_SIGNATURE_TEXT}`,
    });
  };

  return (
    <div className="min-h-screen">
      <div className="bg-white border-b border-gray-200 px-6 md:px-8 py-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 size={25} className="text-camelot-gold" /> Arthur AI Underwriter
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Investment search, acquisition criteria, live underwriting, subject-property report, HubSpot handoff, HTML/PDF/email and editable Excel model.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={runSearch} className="inline-flex items-center gap-2 bg-camelot-navy text-white px-3 py-2 rounded-md text-sm hover:bg-camelot-navy/90">
              {isSearching ? <RefreshCw size={15} className="animate-spin" /> : <Search size={15} />} Run Listing Search
            </button>
            {selected && (
              <>
                <button onClick={() => openBrochureForPrint(reportHtml, buildArthurFilename(selected, 'html'))} className="action-btn"><Printer size={15} /> Print / Save PDF</button>
                <button onClick={() => downloadAsHTML(reportHtml, buildArthurFilename(selected, 'html'))} className="action-btn"><FileText size={15} /> HTML</button>
                <button onClick={() => downloadArthurExcel(selected, criteria)} className="action-btn"><FileSpreadsheet size={15} /> Excel Model</button>
                <button onClick={emailReport} className="action-btn"><Mail size={15} /> Email</button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="p-6 md:p-8 space-y-6">
        <section className="grid grid-cols-1 xl:grid-cols-[390px_minmax(0,1fr)] gap-5">
          <CriteriaPanel criteria={criteria} setCriteria={setCriteria} toggleDealType={toggleDealType} onLoadLast={loadLastInputs} />
          <div className="space-y-5">
            <section className="bg-white border border-gray-200 rounded-lg p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-bold flex items-center gap-2"><SlidersHorizontal size={18} className="text-camelot-gold" /> Required Criteria Coverage</h2>
                  <p className="text-xs text-gray-500 mt-1">Arthur asks these questions before and after report generation so assumptions can be changed live.</p>
                </div>
                <span className="text-xs text-camelot-gold font-semibold">{ARTHUR_CRITERIA_FIELDS.length} data points</span>
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                {ARTHUR_CRITERIA_FIELDS.map((field) => (
                  <span key={field} className="text-xs bg-camelot-cream border border-gray-200 rounded-full px-3 py-1">{field}</span>
                ))}
              </div>
            </section>

            <section className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h2 className="font-bold">Listing Search Results</h2>
                  <p className="text-xs text-gray-500">Pick a property card or row to drill into the listing, report, and editable model.</p>
                </div>
                <span className="text-xs text-gray-500">
                  {candidateIds.length} saved candidate{candidateIds.length === 1 ? '' : 's'} | {hasNearestResults ? `${exactResultCount} exact / ${results.length - exactResultCount} nearest` : `${results.length} source candidates`}
                </span>
              </div>
              {hasNearestResults && (
                <div className="mx-4 mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  No exact match was found for the active hard filters, so Arthur is showing nearest candidates with their actual asset class. Turn off hard filters or widen the ranges to broaden the true listing queue.
                </div>
              )}
              <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4 p-4">
                {results.map((property) => (
                  <ListingCard
                    key={property.id}
                    property={property}
                    active={selected?.id === property.id}
                    saved={candidateIds.includes(property.id)}
                    onSelect={() => selectProperty(property.id)}
                    onOpenSource={() => openListingSource(property)}
                    onAddCandidate={() => addCandidateAndUnderwrite(property.id)}
                  />
                ))}
              </div>
              {selected && model && (
                <div className="px-4 pb-4">
                  <UnderwritingResultsSummary
                    property={selected}
                    model={model}
                    onPush={sendToHubSpot}
                    isPushing={isPushing}
                    pushStatus={pushStatus}
                    isSaved={candidateIds.includes(selected.id)}
                    onAddCandidate={() => addCandidateAndUnderwrite(selected.id)}
                    onSourceSearch={() => openListingSource(selected)}
                    onPrint={() => openBrochureForPrint(reportHtml, buildArthurFilename(selected, 'html'))}
                    onHtml={() => downloadAsHTML(reportHtml, buildArthurFilename(selected, 'html'))}
                    onExcel={() => downloadArthurExcel(selected, criteria)}
                    onEmail={emailReport}
                    onBrokerEmail={emailBrokerInquiry}
                  />
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="text-left p-3">Property</th>
                      <th className="text-left p-3">Type</th>
                      <th className="text-right p-3">Price</th>
                      <th className="text-right p-3">Units</th>
                      <th className="text-right p-3">Cap</th>
                      <th className="text-right p-3">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((property) => {
                      const score = Math.round((property.commuteScore + property.neighborhoodScore + (100 - Math.min(80, property.violations))) / 3);
                      const active = selected?.id === property.id;
                      return (
                        <tr
                          key={property.id}
                          onClick={() => selectProperty(property.id)}
                          className={cn('border-t border-gray-100 cursor-pointer hover:bg-camelot-gold/5', active && 'bg-camelot-gold/10')}
                        >
                          <td className="p-3">
                            <p className="font-semibold">{property.name}</p>
                            <p className="text-xs text-gray-500">{property.address}</p>
                            {property.matchStatus === 'nearest' && <p className="text-[11px] font-semibold text-amber-700 mt-1">Nearest candidate</p>}
                            {candidateIds.includes(property.id) && <p className="text-[11px] font-semibold text-emerald-700 mt-1">Saved investment candidate</p>}
                          </td>
                          <td className="p-3">{arthurDealTypeLabel(property.type)}</td>
                          <td className="p-3 text-right">{formatCurrency(property.askingPrice)}</td>
                          <td className="p-3 text-right">{property.units}</td>
                          <td className="p-3 text-right">{(property.capRate * 100).toFixed(1)}%</td>
                          <td className="p-3 text-right font-semibold">{score}/100</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </section>

        {selected && model && (
          <section ref={detailRef} className="scroll-mt-24 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-5">
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-camelot-gold font-semibold">Detailed Arthur Report</p>
                  <h2 className="text-xl font-bold mt-1">{selected.name}</h2>
                  <p className="text-sm text-gray-500">{selected.address}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={sendToHubSpot}
                    disabled={isPushing}
                    className="inline-flex items-center gap-2 bg-emerald-700 text-white px-3 py-2 rounded-md text-sm hover:bg-emerald-800 disabled:opacity-60"
                  >
                    {isPushing ? <RefreshCw size={15} className="animate-spin" /> : <Send size={15} />} Scout / HubSpot
                  </button>
                  <button onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(selected.address + ' property records')}`, '_blank')} className="action-btn">
                    <ExternalLink size={15} /> Source Search
                  </button>
                </div>
              </div>
              {pushStatus && <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">{pushStatus}</p>}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
                <Metric label="Total Basis" value={formatCurrency(model.totalBasis)} />
                <Metric label="Equity Required" value={formatCurrency(model.equityRequired)} />
                <Metric label="Base IRR" value={`${(model.irr * 100).toFixed(1)}%`} />
                <Metric label="Equity Multiple" value={`${model.equityMultiple.toFixed(2)}x`} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-4 mt-5">
                <div className="rounded-lg border border-gray-200 overflow-hidden bg-camelot-cream">
                  <PropertyImage src={selected.imageUrl} alt={selected.name} className="h-52 w-full object-cover" />
                  <div className="p-3">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Selected Listing Card</p>
                    <p className="font-semibold">{selected.listingSource}</p>
                    <p className="text-xs text-gray-500 mt-1">{selected.listingAgent}</p>
                  </div>
                </div>
                <Card title="Broker Facts, Criteria & Arthur Read">
                  <p className="text-sm text-gray-600 leading-relaxed">{selected.brokerNotes}</p>
                  <p className="text-sm text-gray-600 leading-relaxed mt-3">{selected.arthurThesis}</p>
                  <div className="flex flex-wrap gap-2 mt-4">
                    {(selected.selectedCriteriaNotes || []).map((note) => (
                      <span key={note} className="text-xs bg-camelot-cream border border-gray-200 rounded-full px-3 py-1">{note}</span>
                    ))}
                  </div>
                  {selected.matchStatus === 'nearest' && Boolean(selected.mismatchReasons?.length) && (
                    <div className="mt-4 rounded-md bg-amber-50 border border-amber-200 p-3">
                      <p className="text-xs font-semibold text-amber-900">Why this is a nearest candidate</p>
                      {selected.mismatchReasons?.map((reason) => (
                        <p key={reason} className="text-xs text-amber-800 mt-1">{reason}</p>
                      ))}
                    </div>
                  )}
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-5">
                <iframe title="Subject property map" className="w-full h-72 border border-gray-200 rounded-lg" src={`https://www.google.com/maps?q=${encodeURIComponent(selected.address)}&output=embed`} />
                <iframe title="Subject property street view" className="w-full h-72 border border-gray-200 rounded-lg" src={`https://www.google.com/maps?q=${encodeURIComponent(selected.address)}&output=embed`} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5">
                <Card title="Pros">
                  {selected.pros.map((item) => <Bullet key={item} positive>{item}</Bullet>)}
                </Card>
                <Card title="Cons / Caveats">
                  {selected.cons.map((item) => <Bullet key={item}>{item}</Bullet>)}
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5">
                <Card title="Ownership, Zoning & Listing">
                  <Info label="Ownership" value={selected.ownership} />
                  <Info label="Zoning" value={selected.zoning} />
                  <Info label="Violations" value={`${selected.violations}`} />
                  <Info label="Flood Zone" value={selected.floodZone} />
                  <Info label="Listing Agent" value={selected.listingAgent} />
                  <Info label="Last Sale" value={`${formatCurrency(selected.lastSalePrice)} on ${selected.lastSaleDate}`} />
                </Card>
                <Card title="Neighborhood Intelligence">
                  <Info label="Commute Score" value={`${selected.commuteScore}/100`} />
                  <Info label="School Score" value={`${selected.schoolScore}/100`} />
                  <Info label="Crime Score" value={`${selected.crimeScore}/100`} />
                  <Info label="Neighborhood Score" value={`${selected.neighborhoodScore}/100`} />
                  <Info label="Taxes" value={formatCurrency(selected.taxes)} />
                  <Info label="Insurance Estimate" value={formatCurrency(selected.insurance)} />
                </Card>
              </div>
            </div>

            <aside className="space-y-5">
              <Card title="Sensitivity Analysis">
                <div className="space-y-3">
                  {model.sensitivity.map((row) => (
                    <div key={row.caseName} className="border border-gray-200 rounded-md p-3">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold">{row.caseName}</p>
                        <p className="text-camelot-gold font-bold">{(row.irr * 100).toFixed(1)}%</p>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Exit cap {(row.exitCap * 100).toFixed(2)}% | Growth {(row.rentGrowth * 100).toFixed(1)}% | {row.equityMultiple.toFixed(2)}x</p>
                    </div>
                  ))}
                </div>
              </Card>

              <Card title="Comps">
                {selected.comps.map((comp) => (
                  <div key={comp.address} className="border-b border-gray-100 last:border-b-0 py-2">
                    <p className="font-semibold text-sm">{comp.address}</p>
                    <p className="text-xs text-gray-500">{formatCurrency(comp.price)} | {comp.units} units | {(comp.capRate * 100).toFixed(1)}% cap | {comp.distance}</p>
                  </div>
                ))}
              </Card>

              <Card title="Model Inputs">
                <Info label="Purchase Price" value={formatCurrency(model.purchasePrice)} />
                <Info label="Closing Costs" value={formatCurrency(model.closingCosts)} />
                <Info label="Repair Cost" value={formatCurrency(model.repairCost)} />
                <Info label="Loan Amount" value={formatCurrency(model.loanAmount)} />
                <Info label="Stabilized NOI" value={formatCurrency(model.stabilizedNoi)} />
                <Info label="DSCR" value={`${model.dscr.toFixed(2)}x`} />
              </Card>
            </aside>
          </section>
        )}
      </div>

      <style>{`
        .action-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          border: 1px solid #d1d5db;
          padding: 0.5rem 0.75rem;
          border-radius: 0.375rem;
          font-size: 0.875rem;
          background: white;
        }
        .action-btn:hover { background: #f9fafb; }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
}

function CriteriaPanel({
  criteria,
  setCriteria,
  toggleDealType,
  onLoadLast,
}: {
  criteria: ArthurCriteria;
  setCriteria: React.Dispatch<React.SetStateAction<ArthurCriteria>>;
  toggleDealType: (type: ArthurDealType) => void;
  onLoadLast: () => void;
}) {
  return (
    <section className="bg-white border border-gray-200 rounded-lg p-5 h-fit">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-bold flex items-center gap-2"><Search size={18} className="text-camelot-gold" /> Arthur Search Criteria</h2>
          <p className="text-xs text-gray-500 mt-1">Change assumptions here before or after report generation.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onLoadLast}
            className="text-xs border border-gray-200 rounded-md px-2 py-1 hover:bg-gray-50"
          >
            Load Last
          </button>
          <button
            onClick={() => setCriteria(DEFAULT_ARTHUR_CRITERIA)}
            className="text-xs border border-gray-200 rounded-md px-2 py-1 hover:bg-gray-50"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="space-y-4 mt-5">
        <label className="block">
          <span className="text-xs uppercase tracking-wide text-gray-500">Location</span>
          <input value={criteria.location} onChange={(e) => setCriteria((p) => ({ ...p, location: e.target.value }))} className="mt-1 w-full border border-gray-200 rounded-md px-3 py-2 text-sm" />
        </label>

        <label className="block">
          <span className="text-xs uppercase tracking-wide text-gray-500">Block / Lot</span>
          <input value={criteria.blockLot} onChange={(e) => setCriteria((p) => ({ ...p, blockLot: e.target.value }))} placeholder="Optional BBL, APN, block/lot" className="mt-1 w-full border border-gray-200 rounded-md px-3 py-2 text-sm" />
        </label>

        <div className="rounded-lg border border-camelot-gold/30 bg-camelot-cream p-3">
          <p className="text-xs font-semibold text-camelot-dark">Hard Filter Controls</p>
          <p className="text-xs text-gray-500 mt-1">
            Leave these unchecked when you want the report to include criteria without choking off the listing search.
          </p>
          <div className="grid grid-cols-1 gap-2 mt-3">
            <Toggle label="Use deal types as a listing filter" checked={criteria.applyDealTypeFilter} onChange={(value) => setCriteria((p) => ({ ...p, applyDealTypeFilter: value }))} />
            <Toggle label="Use unit range as a listing filter" checked={criteria.applyUnitRangeFilter} onChange={(value) => setCriteria((p) => ({ ...p, applyUnitRangeFilter: value }))} />
            <Toggle label="Use square footage as a listing filter" checked={criteria.applySqftRangeFilter} onChange={(value) => setCriteria((p) => ({ ...p, applySqftRangeFilter: value }))} />
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <p className="text-xs font-semibold text-camelot-dark">Deal Source Signals</p>
          <p className="text-xs text-gray-500 mt-1">
            These are the acquisition-search reasons Arthur should hunt: foreclosures, distress, low basis, and stale listings.
          </p>
          <div className="grid grid-cols-1 gap-2 mt-3">
            <Toggle label="Foreclosure / mortgage default" checked={criteria.searchForeclosures} onChange={(value) => setCriteria((p) => ({ ...p, searchForeclosures: value }))} />
            <Toggle label="Distress / liens / violations" checked={criteria.searchDistress} onChange={(value) => setCriteria((p) => ({ ...p, searchDistress: value }))} />
            <Toggle label="Long days on market" checked={criteria.searchLongDom} onChange={(value) => setCriteria((p) => ({ ...p, searchLongDom: value }))} />
            <Toggle label="Low price / below-market basis" checked={criteria.searchLowPrice} onChange={(value) => setCriteria((p) => ({ ...p, searchLowPrice: value }))} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <NumberInput label="Min Units" value={criteria.minUnits} onChange={(value) => setCriteria((p) => ({ ...p, minUnits: value }))} />
          <NumberInput label="Max Units" hint="0 = no max" value={criteria.maxUnits} onChange={(value) => setCriteria((p) => ({ ...p, maxUnits: value }))} />
          <NumberInput label="Min SF" value={criteria.minSqft} onChange={(value) => setCriteria((p) => ({ ...p, minSqft: value }))} />
          <NumberInput label="Max SF" hint="0 = no max" value={criteria.maxSqft} onChange={(value) => setCriteria((p) => ({ ...p, maxSqft: value }))} />
        </div>

        <div>
          <span className="text-xs uppercase tracking-wide text-gray-500">Deal Type</span>
          <p className="text-[11px] text-gray-400 mt-1">
            These shape Arthur’s report. They narrow listings only when the hard filter is checked.
          </p>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {DEAL_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => toggleDealType(type)}
                className={cn(
                  'text-left text-xs border rounded-md px-2 py-2',
                  criteria.dealTypes.includes(type)
                    ? 'bg-camelot-gold/15 border-camelot-gold text-camelot-dark'
                    : 'border-gray-200 hover:bg-gray-50'
                )}
              >
                {arthurDealTypeLabel(type)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2">
          <Toggle label="Massing study" checked={criteria.massingStudy} onChange={(value) => setCriteria((p) => ({ ...p, massingStudy: value }))} />
          <Toggle label="Flood zone" checked={criteria.floodZone} onChange={(value) => setCriteria((p) => ({ ...p, floodZone: value }))} />
          <Toggle label="Tax sensitivity" checked={criteria.taxSensitivity} onChange={(value) => setCriteria((p) => ({ ...p, taxSensitivity: value }))} />
          <Toggle label="Insurance estimate" checked={criteria.insuranceEstimate} onChange={(value) => setCriteria((p) => ({ ...p, insuranceEstimate: value }))} />
          <Toggle label="US Census profile" checked={criteria.censusProfile} onChange={(value) => setCriteria((p) => ({ ...p, censusProfile: value }))} />
          <Toggle label="School / crime / neighborhood scores" checked={criteria.schoolCrimeNeighborhoodScores} onChange={(value) => setCriteria((p) => ({ ...p, schoolCrimeNeighborhoodScores: value }))} />
          <Toggle label="Repair and labor cost estimate" checked={criteria.repairCostEstimate} onChange={(value) => setCriteria((p) => ({ ...p, repairCostEstimate: value }))} />
          <Toggle label="Commercial and bridge rates" checked={criteria.includeCommercialRates && criteria.includeBridgeRates} onChange={(value) => setCriteria((p) => ({ ...p, includeCommercialRates: value, includeBridgeRates: value }))} />
          <Toggle label="Investor friendly" checked={criteria.investorFriendly} onChange={(value) => setCriteria((p) => ({ ...p, investorFriendly: value }))} />
        </div>
      </div>
    </section>
  );
}

function ListingCard({
  property,
  active,
  saved,
  onSelect,
  onOpenSource,
  onAddCandidate,
}: {
  property: ArthurProperty;
  active: boolean;
  saved: boolean;
  onSelect: () => void;
  onOpenSource: () => void;
  onAddCandidate: () => void;
}) {
  const score = Math.round((property.commuteScore + property.neighborhoodScore + (100 - Math.min(80, property.violations))) / 3);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'text-left border rounded-lg overflow-hidden bg-white hover:shadow-md transition-shadow',
        active ? 'border-camelot-gold ring-2 ring-camelot-gold/20' : 'border-gray-200'
      )}
    >
      <div className="relative h-36 bg-camelot-cream">
        <PropertyImage src={property.imageUrl} alt={property.name} className="h-full w-full object-cover" />
        <span className="absolute top-2 left-2 rounded bg-camelot-navy text-white text-[11px] px-2 py-1">{arthurDealTypeLabel(property.type)}</span>
        {property.matchStatus === 'nearest' && <span className="absolute top-2 right-2 rounded bg-amber-600 text-white text-[11px] px-2 py-1">Nearest</span>}
        {saved && <span className="absolute bottom-2 left-2 rounded bg-emerald-700 text-white text-[11px] font-semibold px-2 py-1">Candidate</span>}
        {active && <span className="absolute bottom-2 right-2 rounded bg-camelot-gold text-camelot-navy text-[11px] font-semibold px-2 py-1">Selected</span>}
      </div>
      <div className="p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold leading-tight">{property.name}</p>
            <p className="text-xs text-gray-500 mt-1">{property.address}</p>
          </div>
          <span className="text-xs font-semibold text-camelot-gold">{score}/100</span>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
          <div><span className="block text-gray-400">Price</span><span className="font-semibold">{formatCurrency(property.askingPrice)}</span></div>
          <div><span className="block text-gray-400">Units</span><span className="font-semibold">{formatNumber(property.units)}</span></div>
          <div><span className="block text-gray-400">Cap</span><span className="font-semibold">{(property.capRate * 100).toFixed(1)}%</span></div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-1">{property.listingStatus || 'Source review'}</span>
          {typeof property.daysOnMarket === 'number' && <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-1">{property.daysOnMarket} DOM</span>}
        </div>
        <p className="text-xs text-gray-500 mt-3 line-clamp-2">{property.brokerNotes}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span
            role="button"
            tabIndex={0}
            onClick={(event) => {
              event.stopPropagation();
              onOpenSource();
            }}
            className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs hover:bg-gray-50"
          >
            <ExternalLink size={12} /> View Listing
          </span>
          <span
            role="button"
            tabIndex={0}
            onClick={(event) => {
              event.stopPropagation();
              onAddCandidate();
            }}
            className="inline-flex items-center gap-1 rounded-md bg-camelot-navy px-2 py-1 text-xs text-white hover:bg-camelot-navy/90"
          >
            <Send size={12} /> {saved ? 'Run Underwriting' : 'Add Candidate'}
          </span>
        </div>
      </div>
    </button>
  );
}

function UnderwritingResultsSummary({
  property,
  model,
  onPush,
  isPushing,
  pushStatus,
  isSaved,
  onAddCandidate,
  onSourceSearch,
  onPrint,
  onHtml,
  onExcel,
  onEmail,
  onBrokerEmail,
}: {
  property: ArthurProperty;
  model: ArthurModel;
  onPush: () => void;
  isPushing: boolean;
  pushStatus: string;
  isSaved: boolean;
  onAddCandidate: () => void;
  onSourceSearch: () => void;
  onPrint: () => void;
  onHtml: () => void;
  onExcel: () => void;
  onEmail: () => void;
  onBrokerEmail: () => void;
}) {
  return (
    <section className="rounded-lg border border-camelot-gold/40 bg-camelot-cream/70 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-camelot-gold font-semibold">Underwriting Results on Selected Listing</p>
          <h3 className="text-lg font-bold mt-1">{property.name}</h3>
          <p className="text-sm text-gray-500">{property.address} | {arthurDealTypeLabel(property.type)} | {property.units} units</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-gray-200 bg-white px-2 py-1">{property.listingSource}</span>
            <span className="rounded-full border border-gray-200 bg-white px-2 py-1">{property.listingStatus || 'Source review'}</span>
            {typeof property.daysOnMarket === 'number' && <span className="rounded-full border border-gray-200 bg-white px-2 py-1">{property.daysOnMarket} days on market</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onAddCandidate}
            className={cn(
              'inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm',
              isSaved ? 'bg-emerald-700 text-white' : 'bg-camelot-navy text-white hover:bg-camelot-navy/90'
            )}
          >
            <Send size={15} /> {isSaved ? 'Saved Candidate - Run Underwriting' : 'Add to Investment Candidates'}
          </button>
          <button
            type="button"
            onClick={onPush}
            disabled={isPushing}
            className="inline-flex items-center gap-2 bg-emerald-700 text-white px-3 py-2 rounded-md text-sm hover:bg-emerald-800 disabled:opacity-60"
          >
            {isPushing ? <RefreshCw size={15} className="animate-spin" /> : <Send size={15} />} Queue Scout / HubSpot
          </button>
          <button type="button" onClick={onSourceSearch} className="action-btn">
            <ExternalLink size={15} /> Source Search
          </button>
          <button type="button" onClick={onPrint} className="action-btn"><Printer size={15} /> Print / PDF</button>
          <button type="button" onClick={onHtml} className="action-btn"><FileText size={15} /> HTML</button>
          <button type="button" onClick={onExcel} className="action-btn"><FileSpreadsheet size={15} /> Excel</button>
          <button type="button" onClick={onEmail} className="action-btn"><Mail size={15} /> Email</button>
          <button type="button" onClick={onBrokerEmail} className="action-btn"><Mail size={15} /> Broker Inquiry</button>
        </div>
      </div>

      {pushStatus && <p className="mt-3 rounded-md border border-emerald-200 bg-white px-3 py-2 text-xs text-emerald-900">{pushStatus}</p>}
      {Boolean(property.opportunitySignals?.length) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {property.opportunitySignals?.map((signal) => (
            <span key={signal} className="rounded-full border border-camelot-gold/30 bg-white px-3 py-1 text-xs text-camelot-dark">{signal}</span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
        <Metric label="Total Basis" value={formatCurrency(model.totalBasis)} />
        <Metric label="Equity Required" value={formatCurrency(model.equityRequired)} />
        <Metric label="Base IRR" value={`${(model.irr * 100).toFixed(1)}%`} />
        <Metric label="Equity Multiple" value={`${model.equityMultiple.toFixed(2)}x`} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[260px_minmax(0,1fr)] gap-4 mt-4">
        <div className="rounded-lg border border-gray-200 overflow-hidden bg-white">
          <PropertyImage src={property.imageUrl} alt={property.name} className="h-44 w-full object-cover" />
          <div className="p-3 text-xs text-gray-600">
            <p><span className="font-semibold">Source:</span> {property.listingSource}</p>
            <p className="mt-1"><span className="font-semibold">Agent:</span> {property.listingAgent}</p>
            <p className="mt-1"><span className="font-semibold">Ownership:</span> {property.ownership}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <h4 className="font-bold text-sm">Pros</h4>
            <div className="mt-2">{property.pros.slice(0, 4).map((item) => <Bullet key={item} positive>{item}</Bullet>)}</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <h4 className="font-bold text-sm">Cons / Caveats</h4>
            <div className="mt-2">{property.cons.slice(0, 4).map((item) => <Bullet key={item}>{item}</Bullet>)}</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <h4 className="font-bold text-sm">Owner, Zoning & Massing</h4>
            <Info label="Zoning" value={property.zoning} />
            <Info label="Flood Zone" value={property.floodZone} />
            <Info label="Violations" value={`${property.violations}`} />
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <h4 className="font-bold text-sm">Comps & Model Inputs</h4>
            {property.comps.slice(0, 2).map((comp) => (
              <p key={comp.address} className="text-xs text-gray-600 mt-2">
                <span className="font-semibold">{comp.address}</span>: {formatCurrency(comp.price)} | {comp.units} units | {(comp.capRate * 100).toFixed(1)}% cap
              </p>
            ))}
            <p className="text-xs text-gray-600 mt-2"><span className="font-semibold">Repair Cost:</span> {formatCurrency(model.repairCost)}</p>
            <p className="text-xs text-gray-600 mt-1"><span className="font-semibold">DSCR:</span> {model.dscr.toFixed(2)}x</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function NumberInput({ label, hint, value, onChange }: { label: string; hint?: string; value: number; onChange: (value: number) => void }) {
  return (
    <label>
      <span className="text-xs uppercase tracking-wide text-gray-500">{label}</span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value) || 0)}
        className="mt-1 w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
      />
      {hint && <span className="mt-1 block text-[11px] text-gray-400">{hint}</span>}
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 border border-gray-200 rounded-md px-3 py-2 text-sm">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-camelot-cream">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-lg font-bold mt-1">{value}</p>
    </div>
  );
}

function PropertyImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return (
    <img
      src={src || '/images/case-studies/rental-portfolio.jpg'}
      alt={alt}
      className={className}
      loading="lazy"
      onError={(event) => {
        event.currentTarget.onerror = null;
        event.currentTarget.src = '/images/case-studies/rental-portfolio.jpg';
      }}
    />
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="font-bold mb-3">{title}</h3>
      {children}
    </section>
  );
}

function Bullet({ children, positive = false }: { children: React.ReactNode; positive?: boolean }) {
  return (
    <p className="flex items-start gap-2 text-sm text-gray-600 mb-2">
      <span className={cn('mt-1 w-2 h-2 rounded-full flex-shrink-0', positive ? 'bg-emerald-600' : 'bg-amber-600')} />
      {children}
    </p>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-gray-100 last:border-b-0 py-2 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-right">{value || 'To verify'}</span>
    </div>
  );
}
