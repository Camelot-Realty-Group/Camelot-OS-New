import { useState } from 'react';
import { Eye, Download, Share2, BarChart3, Building2, TrendingUp, DollarSign, MapPin, Search, ShieldAlert, Home, Landmark } from 'lucide-react';
import { openBrochureForPrint, downloadAsHTML } from '@/lib/pdf-generator';
import {
  generateBuildingReport,
  generateSubjectMarketReport,
  buildSentinelMarketFilename,
  TRACKED_BUILDINGS,
  SENTINEL_EXPANSION_SOURCE_STACK,
  SENTINEL_UNIT_MIX_BENCHMARKS,
  SENTINEL_MANAGEMENT_FEE_BENCHMARKS,
  type SentinelInput,
  DEFAULT_SENTINEL_INPUT,
  QUARTERS,
} from '@/lib/sentinel-report';
import { generateFullSentinelReport } from '@/lib/sentinel-full-report';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

export default function Sentinel() {
  const realtyMxConfigured = false;
  const [input, setInput] = useState<SentinelInput>({ ...DEFAULT_SENTINEL_INPUT, realtyMxEnabled: realtyMxConfigured });
  const [generated, setGenerated] = useState(false);
  const [subjectGenerated, setSubjectGenerated] = useState(false);
  const [selectedBuilding, setSelectedBuilding] = useState<number | null>(null);
  const [buildingGenerated, setBuildingGenerated] = useState(false);

  const update = (patch: Partial<SentinelInput>) => setInput(prev => ({ ...prev, ...patch }));

  const handleGenerate = () => {
    setGenerated(true);
    toast.success('Sentinel report generated');
  };

  const handlePreview = () => {
    const html = generateFullSentinelReport(input);
    openBrochureForPrint(html, `Camelot-Market-Report-${input.quarter}-${input.year}`);
  };

  const handleDownload = () => {
    const html = generateFullSentinelReport(input);
    downloadAsHTML(html, `Camelot-Market-Report-${input.quarter}-${input.year}.html`);
    toast.success('Report downloaded');
  };

  const handleSubjectGenerate = () => {
    if (!input.subjectAddress?.trim()) {
      toast.error('Enter a subject building address first');
      return;
    }
    setSubjectGenerated(true);
    toast.success('Subject market stack-up generated');
  };

  const handleSubjectPreview = () => {
    if (!input.subjectAddress?.trim()) {
      toast.error('Enter a subject building address first');
      return;
    }
    const html = generateSubjectMarketReport(input);
    openBrochureForPrint(html, buildSentinelMarketFilename(input, 'html').replace(/\.html$/, ''));
  };

  const handleSubjectDownload = () => {
    if (!input.subjectAddress?.trim()) {
      toast.error('Enter a subject building address first');
      return;
    }
    const html = generateSubjectMarketReport(input);
    downloadAsHTML(html, buildSentinelMarketFilename(input, 'html'));
    toast.success('Subject market report downloaded');
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-teal-600 rounded-lg flex items-center justify-center">
          <Eye size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sentinel</h1>
          <p className="text-gray-500 text-sm">Quarterly Market Intelligence — Generate branded Q1-Q4 market reports with images, maps, charts, source stacks, and board-ready pricing context</p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { icon: Building2, label: 'Tracked Buildings', value: '6' },
          { icon: MapPin, label: 'Markets', value: 'NY / CT / NJ / FL' },
          { icon: TrendingUp, label: 'Unit Mix Rules', value: String(SENTINEL_UNIT_MIX_BENCHMARKS.length) },
          { icon: DollarSign, label: 'Fee Benchmarks', value: String(SENTINEL_MANAGEMENT_FEE_BENCHMARKS.length) },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="bg-white rounded-xl border p-4 text-center">
            <Icon size={20} className="mx-auto text-camelot-gold mb-2" />
            <div className="text-xl font-bold">{value}</div>
            <div className="text-xs text-gray-500">{label}</div>
          </div>
        ))}
      </div>

      {/* Subject Building Market Stack-Up */}
      <div className="bg-white rounded-xl border shadow-sm divide-y">
        <div className="p-6">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-1 flex items-center gap-2">
                <Search size={18} className="text-camelot-gold" /> Subject Building Market Stack-Up
              </h2>
              <p className="text-gray-500 text-sm">
                Enter any Scout or Jackie location and Sentinel will frame value, unit velocity, default/foreclosure risk, new construction, land values, and management-fee benchmarks.
              </p>
            </div>
            <div className="hidden md:flex items-center gap-2 text-xs text-gray-500 bg-gray-50 border rounded-lg px-3 py-2">
              <ShieldAlert size={14} className="text-camelot-gold" />
              {realtyMxConfigured ? 'RealtyMX server integration active.' : 'RealtyMX is not connected; public-source fallback stays active.'}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-3">
              <label className="text-xs text-gray-600 font-medium mb-1 block">Building Address</label>
              <input
                type="text"
                value={input.subjectAddress || ''}
                onChange={e => { update({ subjectAddress: e.target.value }); setSubjectGenerated(false); }}
                placeholder="e.g., 201 East 79th Street, New York, NY"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600 font-medium mb-1 block">Market / State</label>
              <select
                value={input.subjectBorough || ''}
                onChange={e => update({ subjectBorough: e.target.value as SentinelInput['subjectBorough'] })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/50"
              >
                {['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island', 'Westchester / Riverdale', 'New Jersey', 'Connecticut', 'Florida'].map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 font-medium mb-1 block">Asset Class</label>
              <select
                value={input.subjectAssetClass || ''}
                onChange={e => update({ subjectAssetClass: e.target.value as SentinelInput['subjectAssetClass'] })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/50"
              >
                {['Co-op / Condo', 'Rental', 'Mixed-Use', 'HOA / Condo Community', 'Land / Development', 'Commercial'].map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 font-medium mb-1 block">Units</label>
              <input
                type="number"
                min="0"
                value={input.subjectUnits || ''}
                onChange={e => update({ subjectUnits: e.target.value })}
                placeholder="e.g., 167"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600 font-medium mb-1 block">Union Status</label>
              <select
                value={input.subjectUnionStatus || 'Unknown'}
                onChange={e => update({ subjectUnionStatus: e.target.value as SentinelInput['subjectUnionStatus'] })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/50"
              >
                {['Unknown', 'Union', 'Non-union', 'Mixed'].map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 font-medium mb-1 block">Service Level</label>
              <select
                value={input.subjectServiceLevel || ''}
                onChange={e => update({ subjectServiceLevel: e.target.value as SentinelInput['subjectServiceLevel'] })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/50"
              >
                {['Standard / Walk-Up', 'Elevator', 'Full-Service / Doorman', 'Luxury / Amenity', 'HOA / Field Operations'].map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
            <div className="lg:col-span-3">
              <label className="text-xs text-gray-600 font-medium mb-1 block">Amenities / Notes</label>
              <input
                type="text"
                value={input.subjectAmenities || ''}
                onChange={e => update({ subjectAmenities: e.target.value })}
                placeholder="Pool, garage, roof deck, storage, concierge, elevator, commercial space, etc."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50"
              />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-lg border bg-slate-50 p-4">
              <Home size={18} className="text-camelot-gold mb-2" />
              <div className="font-semibold text-sm">Unit Mix Velocity</div>
              <p className="text-xs text-gray-500 mt-1">Studio through duplex sweet spots, DOM risk, stale-price signals, and RealtyMX enrichment path.</p>
            </div>
            <div className="rounded-lg border bg-slate-50 p-4">
              <ShieldAlert size={18} className="text-camelot-gold mb-2" />
              <div className="font-semibold text-sm">Default Watch</div>
              <p className="text-xs text-gray-500 mt-1">Mortgage, lis pendens, tax lien, foreclosure, and stale-listing warning stack.</p>
            </div>
            <div className="rounded-lg border bg-slate-50 p-4">
              <Landmark size={18} className="text-camelot-gold mb-2" />
              <div className="font-semibold text-sm">Fees & Land Context</div>
              <p className="text-xs text-gray-500 mt-1">Management fees by borough, service level, union/staffing, amenities, and land PSF guides.</p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={handleSubjectGenerate}
              className="bg-camelot-navy text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-camelot-navy/90 transition-all flex items-center gap-2"
            >
              <BarChart3 size={16} /> Generate Stack-Up
            </button>
            {(subjectGenerated || input.subjectAddress) && (
              <>
                <button onClick={handleSubjectPreview} className="bg-gray-100 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-200 flex items-center gap-2">
                  <Eye size={16} /> Preview
                </button>
                <button onClick={handleSubjectDownload} className="bg-gray-100 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-200 flex items-center gap-2">
                  <Download size={16} /> Download HTML
                </button>
              </>
            )}
          </div>
          <div className="mt-4 text-xs text-gray-400">
            Source stack: {SENTINEL_EXPANSION_SOURCE_STACK.slice(0, 5).join(' | ')}.
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white rounded-xl border shadow-sm divide-y">

        {/* Quarter Selection */}
        <div className="p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Report Period</h2>
          <div className="flex gap-3">
            <div className="flex gap-2">
              {QUARTERS.map(q => (
                <button
                  key={q}
                  onClick={() => update({ quarter: q })}
                  className={cn(
                    'px-5 py-2.5 rounded-lg text-sm font-semibold transition-all',
                    input.quarter === q ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >{q}</button>
              ))}
            </div>
            <input
              type="number" value={input.year} onChange={e => update({ year: parseInt(e.target.value) || 2026 })}
              className="w-24 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50"
            />
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            {[
              { q: 'Q1', title: 'Baseline', desc: 'Budget, tax, insurance, winter compliance, early velocity.' },
              { q: 'Q2', title: 'Spring Market', desc: 'Listing season, leasing acceleration, project starts.' },
              { q: 'Q3', title: 'Summer Pulse', desc: 'Rental heat, stale listings, vendor drift, pre-budget checks.' },
              { q: 'Q4', title: 'Year-End Close', desc: 'Budget adoption, lien cleanup, winter readiness, next-year plan.' },
            ].map(item => (
              <div key={item.q} className={cn('rounded-lg border p-3', input.quarter === item.q ? 'border-teal-600 bg-teal-50' : 'border-gray-200 bg-gray-50')}>
                <div className="font-bold text-gray-900">{item.q} · {item.title}</div>
                <div className="text-gray-500 mt-1">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Visual + Data Requirements */}
        <div className="p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Quarterly Report Visual Standard</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { title: 'Images', body: 'Subject-property photo, nearby landmark or major avenue, portfolio proof, and real city context.' },
              { title: 'Graphs & Charts', body: 'Condo/co-op $/SF, rental rates, DOM, inventory, rate sensitivity, and unit-mix velocity.' },
              { title: 'Source Stack', body: 'RealtyMX, StreetEasy, Zillow, ACRIS/county clerk, DOF/tax, PLUTO/zoning, DOB/HPD/OATH or local equivalents.' },
            ].map(item => (
              <div key={item.title} className="rounded-xl border bg-slate-50 p-4">
                <div className="font-bold text-gray-900">{item.title}</div>
                <p className="text-xs text-gray-500 mt-1">{item.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Five Insights */}
        <div className="p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Five Standard Insights</h2>
          <p className="text-xs text-gray-400 mb-4">Update each quarter with current data. Leave blank to use defaults from SCOUT data.</p>
          {[
            { key: 'insight1' as const, icon: '🏢', label: 'Building Performance', placeholder: 'e.g., 5 of 6 tracked buildings beat their neighborhood median $/sqft' },
            { key: 'insight2' as const, icon: '⚡', label: 'Rental Velocity', placeholder: 'e.g., Sub-$3,500/mo 1-BRs clearing in under 14 days' },
            { key: 'insight3' as const, icon: '📊', label: 'Rate Sensitivity', placeholder: 'e.g., Every 50bps rate drop unlocks 8-10% more buying power' },
            { key: 'insight4' as const, icon: '🏠', label: 'Rent vs. Buy', placeholder: 'e.g., Break-even: 20 yrs in Sunnyside, 38+ yrs in Tribeca' },
            { key: 'insight5' as const, icon: '📍', label: 'Neighborhood Value Spectrum', placeholder: 'e.g., $/sqft ranges from $660 (Sunnyside) to $2,100 (Tribeca)' },
          ].map(({ key, icon, label, placeholder }) => (
            <div key={key} className="mb-3">
              <label className="text-xs text-gray-600 font-medium flex items-center gap-2 mb-1">
                <span>{icon}</span> {label}
              </label>
              <input
                type="text" value={input[key]} onChange={e => update({ [key]: e.target.value })}
                placeholder={placeholder}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50"
              />
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="p-6 flex gap-3">
          <button
            onClick={handleGenerate}
            className="bg-teal-600 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-teal-700 transition-all flex items-center gap-2 shadow-lg shadow-teal-600/20"
          >
            <BarChart3 size={16} /> Generate Report
          </button>
          {generated && (
            <>
              <button onClick={handlePreview} className="bg-gray-100 text-gray-700 px-5 py-3 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors flex items-center gap-2">
                <Eye size={16} /> Preview
              </button>
              <button onClick={handleDownload} className="bg-gray-100 text-gray-700 px-5 py-3 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors flex items-center gap-2">
                <Download size={16} /> Download
              </button>
            </>
          )}
        </div>
      </div>
      {/* Per-Building Client Reports */}
      <div className="bg-white rounded-xl border shadow-sm divide-y">
        <div className="p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-1">Client Building Reports</h2>
          <p className="text-gray-500 text-sm mb-4">Generate per-building market reports for each managed property. Send to boards as a complimentary quarterly service.</p>

          <div className="grid grid-cols-2 gap-3 mb-4">
            {TRACKED_BUILDINGS.map((b, i) => (
              <button
                key={i}
                onClick={() => { setSelectedBuilding(i); setBuildingGenerated(false); }}
                className={cn(
                  'p-3 rounded-lg text-left transition-all border',
                  selectedBuilding === i ? 'border-teal-600 bg-teal-50' : 'border-gray-200 hover:border-gray-300'
                )}
              >
                <div className="font-semibold text-sm">{b.name}</div>
                <div className="text-xs text-gray-500">{b.neighborhood} · {b.type} · {b.units} units</div>
                <div className={cn('text-xs font-bold mt-1', b.performance === 'Above' ? 'text-green-600' : 'text-yellow-600')}>
                  {b.performance === 'Above' ? '▲' : '●'} {b.performance} market · ${b.camelotPSF}/sqft
                </div>
              </button>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                if (selectedBuilding === null) { toast.error('Select a building first'); return; }
                setBuildingGenerated(true);
                toast.success(`Report generated for ${TRACKED_BUILDINGS[selectedBuilding].name}`);
              }}
              disabled={selectedBuilding === null}
              className="bg-teal-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-teal-700 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              <Building2 size={16} /> Generate Building Report
            </button>

            {buildingGenerated && selectedBuilding !== null && (
              <>
                <button
                  onClick={() => {
                    const html = generateBuildingReport(TRACKED_BUILDINGS[selectedBuilding], input);
                    openBrochureForPrint(html, `Camelot-${TRACKED_BUILDINGS[selectedBuilding].name}-${input.quarter}-${input.year}`);
                  }}
                  className="bg-gray-100 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-200 flex items-center gap-2"
                >
                  <Eye size={16} /> Preview
                </button>
                <button
                  onClick={() => {
                    const b = TRACKED_BUILDINGS[selectedBuilding];
                    const html = generateBuildingReport(b, input);
                    downloadAsHTML(html, `Camelot-${b.name.replace(/[^a-zA-Z0-9]/g,'-')}-${input.quarter}-${input.year}.html`);
                  }}
                  className="bg-gray-100 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-200 flex items-center gap-2"
                >
                  <Download size={16} /> Download
                </button>
              </>
            )}

            <button
              onClick={() => {
                TRACKED_BUILDINGS.forEach((b, i) => {
                  const html = generateBuildingReport(b, input);
                  setTimeout(() => {
                    downloadAsHTML(html, `Camelot-${b.name.replace(/[^a-zA-Z0-9]/g,'-')}-${input.quarter}-${input.year}.html`);
                  }, i * 500);
                });
                toast.success(`Downloading ${TRACKED_BUILDINGS.length} building reports...`);
              }}
              className="bg-gray-100 text-gray-700 px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-gray-200 transition-all flex items-center gap-2"
            >
              <Download size={16} /> Download All ({TRACKED_BUILDINGS.length})
            </button>

            <button
              onClick={async () => {
                toast.loading('Generating & emailing all reports...', { id: 'send-all' });
                // Generate all reports and trigger email via mailto
                const reportLinks = TRACKED_BUILDINGS.map(b => b.name).join(', ');
                const subject = encodeURIComponent(`${input.quarter} ${input.year} Quarterly Market Reports — ${TRACKED_BUILDINGS.length} Buildings`);
                const body = encodeURIComponent(
                  `Team,\n\nThe ${input.quarter} ${input.year} quarterly market reports have been generated for all ${TRACKED_BUILDINGS.length} managed buildings:\n\n` +
                  TRACKED_BUILDINGS.map(b => `• ${b.name} — ${b.neighborhood} — ${b.performance === 'Above' ? '▲ Above' : '● At'} market ($${b.camelotPSF}/sqft vs $${b.neighborhoodPSF} neighborhood)`).join('\n') +
                  `\n\nReports are being downloaded to your computer. Please distribute to each building's board via ConciergePlus or MDS.\n\nFull market report available on Scout: https://camelot-scout-v6.onrender.com/sentinel\n\n— Merlin AI\nCamelot OS · Sentinel Engine`
                );
                window.open(`mailto:info@camelot.nyc?cc=info@camelot.nyc,sam@camelot.nyc&subject=${subject}&body=${body}`);
                // Download all reports
                TRACKED_BUILDINGS.forEach((b, i) => {
                  const html = generateBuildingReport(b, input);
                  setTimeout(() => {
                    downloadAsHTML(html, `Camelot-${b.name.replace(/[^a-zA-Z0-9]/g,'-')}-${input.quarter}-${input.year}.html`);
                  }, i * 500);
                });
                toast.success(`${TRACKED_BUILDINGS.length} reports generated & email drafted`, { id: 'send-all' });
              }}
              className="bg-camelot-gold text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-camelot-gold-light transition-all flex items-center gap-2 ml-auto"
            >
              <Share2 size={16} /> Send to All Clients
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

