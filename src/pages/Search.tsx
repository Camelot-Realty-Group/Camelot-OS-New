import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { REGIONS, isFloridaArea, getFloridaAreas, getRegionByArea } from '@/lib/regions';
import { fetchFullBuildingReport, searchByOwnerName, searchByUnit, searchBuildingsByRegion, fetchViolationCountsByBBLs } from '@/lib/nyc-api';
import { searchNYDOSCorporation, type NYDOSCorporation } from '@/lib/gov-apis';
import { generateFloridaBuildings } from '@/lib/florida-data';
import { generateTriStateBuildings, isTriStateArea } from '@/lib/tristate-data';
import { calculateScore } from '@/lib/scoring';
import { useBuildingsStore } from '@/lib/store';
import { cn, formatCurrency, formatNumber } from '@/lib/utils';
import type { BuildingType, Building } from '@/types';
import toast from 'react-hot-toast';
import {
  Search as SearchIcon, MapPin, ChevronDown, ChevronRight, Building2,
  Loader2, Zap, AlertTriangle, DollarSign, Calendar, X, Filter,
  Activity, TrendingUp, Users, Award, User, Home, Landmark, ExternalLink, FileText,
  Clock, PlayCircle, CheckCircle2, ArrowRight, Bot, BarChart3, ShieldCheck, BriefcaseBusiness, Download, Megaphone,
} from 'lucide-react';
import { detectBuildingOperations, getDoormanLabel, getFrontDeskLabel } from '@/lib/building-ops';
import { APP_NAME_SHORT, CAMELOT_CONTACT, V10_RELEASE_NOTE } from '@/lib/app-brand';

type SearchTab = 'address' | 'owner' | 'unit';

export default function Search() {
  const navigate = useNavigate();
  const addBuildings = useBuildingsStore((s) => s.addBuildings);
  const setBuildings = useBuildingsStore((s) => s.setBuildings);
  const setFilters = useBuildingsStore((s) => s.setFilters);

  // Search tab state
  const [activeTab, setActiveTab] = useState<SearchTab>('address');
  const [operatorProfile, setOperatorProfile] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('camelot-os-v10-operator-profile') || '{}') as {
        preparedBy?: string;
        role?: string;
        audience?: string;
      };
    } catch {
      return {};
    }
  });

  // Quick report state (address search)
  const [quickAddress, setQuickAddress] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [reportData, setReportData] = useState<any>(null);

  // Owner search state
  const [ownerName, setOwnerName] = useState('');
  const [ownerResults, setOwnerResults] = useState<any[]>([]);
  const [dosResults, setDosResults] = useState<NYDOSCorporation[]>([]);
  const [isOwnerSearching, setIsOwnerSearching] = useState(false);
  const [ownerSearchedName, setOwnerSearchedName] = useState('');
  const [ownerSearchDone, setOwnerSearchDone] = useState(false);

  // Unit search state
  const [unitAddress, setUnitAddress] = useState('');
  const [unitNumber, setUnitNumber] = useState('');
  const [unitData, setUnitData] = useState<any>(null);
  const [isUnitSearching, setIsUnitSearching] = useState(false);

  // Region selection
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Advanced filters
  const [buildingTypes, setBuildingTypes] = useState<BuildingType[]>([]);
  const [minUnits, setMinUnits] = useState('');
  const [maxUnits, setMaxUnits] = useState('');
  const [yearBuiltMin, setYearBuiltMin] = useState('');
  const [yearBuiltMax, setYearBuiltMax] = useState('');
  const [violationThreshold, setViolationThreshold] = useState('');

  // Quick Building Report (address search)
  const handleQuickReport = async () => {
    if (!quickAddress.trim()) return;
    setIsSearching(true);
    setReportData(null);
    setOwnerResults([]);
    setUnitData(null);
    try {
      const data = await fetchFullBuildingReport(quickAddress.trim());
      const score = calculateScore({
        violations_count: data.violations.total,
        open_violations_count: data.violations.open,
        units: data.dof?.units,
        current_management: data.registration?.managementCompany,
        year_built: data.dof?.yearBuilt,
        has_recent_permits: data.permits.hasRecent,
        energy_star_score: data.energy?.energyStarScore ?? undefined,
        site_eui: data.energy?.siteEUI ?? undefined,
        ecb_violation_count: data.ecb?.count,
        ecb_penalty_balance: data.ecb?.totalPenaltyBalance,
        has_active_litigation: data.litigation?.hasActive,
        is_rent_stabilized: data.rentStabilization?.isStabilized,
      });
      setReportData({ ...data, score });
      toast.success('Building report generated');
    } catch (err) {
      toast.error('Failed to fetch building data');
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  // Owner name search — also queries NY DOS for corporate filings
  const handleOwnerSearch = async () => {
    if (!ownerName.trim()) return;
    setIsOwnerSearching(true);
    setOwnerResults([]);
    setDosResults([]);
    setOwnerSearchDone(false);
    setReportData(null);
    setUnitData(null);
    const searchedName = ownerName.trim();
    setOwnerSearchedName(searchedName);
    try {
      // Run HPD owner search and NY DOS search in parallel
      const [results, dosData] = await Promise.all([
        searchByOwnerName(searchedName),
        searchNYDOSCorporation(searchedName),
      ]);
      setOwnerResults(results);
      setDosResults(dosData);
      setOwnerSearchDone(true);
      const totalFound = results.length + dosData.length;
      if (totalFound === 0) {
        toast('No buildings or corporate filings found', { icon: '🔍' });
      } else {
        const parts: string[] = [];
        if (results.length > 0) parts.push(`${results.length} building(s)`);
        if (dosData.length > 0) parts.push(`${dosData.length} corporate filing(s)`);
        toast.success(`Found ${parts.join(' + ')}`);
      }
    } catch (err) {
      toast.error('Owner search failed');
      setOwnerSearchDone(true);
      console.error(err);
    } finally {
      setIsOwnerSearching(false);
    }
  };

  // Click an owner result → run full building report
  const handleOwnerResultClick = async (row: any) => {
    const addr = `${row.housenumber} ${row.streetname}`.trim();
    if (!addr) return;
    setActiveTab('address');
    setQuickAddress(addr);
    setOwnerResults([]);
    setIsSearching(true);
    setReportData(null);
    try {
      const data = await fetchFullBuildingReport(addr);
      const score = calculateScore({
        violations_count: data.violations.total,
        open_violations_count: data.violations.open,
        units: data.dof?.units,
        current_management: data.registration?.managementCompany,
        year_built: data.dof?.yearBuilt,
        has_recent_permits: data.permits.hasRecent,
        energy_star_score: data.energy?.energyStarScore ?? undefined,
        site_eui: data.energy?.siteEUI ?? undefined,
        ecb_violation_count: data.ecb?.count,
        ecb_penalty_balance: data.ecb?.totalPenaltyBalance,
        has_active_litigation: data.litigation?.hasActive,
        is_rent_stabilized: data.rentStabilization?.isStabilized,
      });
      setReportData({ ...data, score });
      toast.success('Building report generated');
    } catch (err) {
      toast.error('Failed to fetch building data');
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  // Unit lookup
  const handleUnitSearch = async () => {
    if (!unitAddress.trim() || !unitNumber.trim()) return;
    setIsUnitSearching(true);
    setUnitData(null);
    setReportData(null);
    setOwnerResults([]);
    try {
      const data = await searchByUnit(unitAddress.trim(), unitNumber.trim());
      setUnitData(data);
      if (data.violations.total === 0) {
        toast('No unit-specific violations found', { icon: '🔍' });
      } else {
        toast.success(`Found ${data.violations.total} violation(s) for unit ${unitNumber.toUpperCase()}`);
      }
    } catch (err) {
      toast.error('Unit lookup failed');
      console.error(err);
    } finally {
      setIsUnitSearching(false);
    }
  };

  // Region toggling
  const toggleGroup = (name: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const toggleRegion = (area: string) => {
    setSelectedRegions((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    );
  };

  const toggleAllInGroup = (group: typeof REGIONS[0]) => {
    const allSelected = group.areas.every((a) => selectedRegions.includes(a));
    if (allSelected) {
      setSelectedRegions((prev) => prev.filter((a) => !group.areas.includes(a)));
    } else {
      setSelectedRegions((prev) => [...new Set([...prev, ...group.areas])]);
    }
  };

  const toggleBuildingType = (type: BuildingType) => {
    setBuildingTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  // Scanning state
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState('');

  // Run Scan
  const handleScan = async () => {
    if (selectedRegions.length === 0) {
      toast.error('Select at least one area to scan');
      return;
    }

    const floridaAreas = selectedRegions.filter((a) => isFloridaArea(a));
    const NYC_BOROUGH_NAMES = ['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island'];
    const allNonFlorida = selectedRegions.filter((a) => !isFloridaArea(a));
    const nycAreas = allNonFlorida.filter((a) => {
      const region = getRegionByArea(a);
      return region && NYC_BOROUGH_NAMES.includes(region.name);
    });
    const otherAreas = allNonFlorida.filter((a) => {
      const region = getRegionByArea(a);
      return !region || !NYC_BOROUGH_NAMES.includes(region.name);
    });

    setIsScanning(true);
    let totalFound = 0;

    // Clear previous scan results so the Results page starts fresh
    setBuildings([]);

    // Florida areas — use pre-built data
    if (floridaAreas.length > 0) {
      setScanProgress(`Scanning ${floridaAreas.length} Florida area(s)...`);
      await new Promise((resolve) => setTimeout(resolve, 600));
      const floridaBuildings = generateFloridaBuildings(floridaAreas);
      if (floridaBuildings.length > 0) {
        addBuildings(floridaBuildings);
        totalFound += floridaBuildings.length;
        toast.success(`🌴 Found ${floridaBuildings.length} buildings in Florida`);
      }
    }

    // NYC areas — query DOF/PLUTO for real buildings
    if (nycAreas.length > 0) {
      setScanProgress(`Querying NYC property records for ${nycAreas.length} area(s)...`);

      // Determine unique boroughs from selected areas
      const boroughSet = new Set<string>();
      for (const area of nycAreas) {
        const region = getRegionByArea(area);
        if (region) {
          const name = region.name.toUpperCase();
          if (['MANHATTAN', 'BROOKLYN', 'QUEENS', 'BRONX', 'STATEN ISLAND'].includes(name)) {
            boroughSet.add(name);
          }
        }
      }

      const parsedMin = minUnits ? parseInt(minUnits) : undefined;
      const parsedMax = maxUnits ? parseInt(maxUnits) : undefined;
      const parsedYearMin = yearBuiltMin ? parseInt(yearBuiltMin) : undefined;
      const parsedYearMax = yearBuiltMax ? parseInt(yearBuiltMax) : undefined;
      const boroughs = Array.from(boroughSet);

      // Query each borough (or all if none resolved)
      const allDofResults: any[] = [];
      if (boroughs.length > 0) {
        for (const boro of boroughs) {
          setScanProgress(`Scanning ${boro}...`);
          try {
            const results = await searchBuildingsByRegion({
              borough: boro,
              minUnits: parsedMin,
              maxUnits: parsedMax,
              yearBuiltMin: parsedYearMin,
              yearBuiltMax: parsedYearMax,
              limit: 100,
            });
            allDofResults.push(...results);
          } catch (err) {
            console.error(`Scan error for ${boro}:`, err);
          }
        }
      } else {
        // No borough resolved — query without borough filter
        try {
          const results = await searchBuildingsByRegion({
            minUnits: parsedMin,
            maxUnits: parsedMax,
            yearBuiltMin: parsedYearMin,
            yearBuiltMax: parsedYearMax,
            limit: 200,
          });
          allDofResults.push(...results);
        } catch (err) {
          console.error('Scan error:', err);
        }
      }

      setScanProgress(`Processing ${allDofResults.length} buildings...`);

      // Convert DOF results to Building objects
      const nycBuildings: Building[] = allDofResults
        .filter((r) => r.address && r.bbl)
        .map((r) => {
          const units = parseInt(r.unitsres) || parseInt(r.unitstotal) || 0;
          const yearBuilt = parseInt(r.yearbuilt) || 0;
          const marketValue = parseFloat(r.fullval) || 0;
          const scoreResult = calculateScore({
            units,
            year_built: yearBuilt,
          });
          return {
            id: crypto.randomUUID(),
            address: r.address,
            name: r.ownername ? `${r.address} (${r.ownername})` : r.address,
            borough: ({ MN: 'Manhattan', BK: 'Brooklyn', QN: 'Queens', BX: 'Bronx', SI: 'Staten Island' } as Record<string, string>)[r.borough] || r.borough || '',
            region: ({ MN: 'Manhattan', BK: 'Brooklyn', QN: 'Queens', BX: 'Bronx', SI: 'Staten Island' } as Record<string, string>)[r.borough] || r.borough || '',
            units,
            type: (r.bldgcl?.startsWith('R') ? 'condo' : r.bldgcl?.startsWith('D') ? 'co-op' : 'rental') as BuildingType,
            year_built: yearBuilt,
            grade: scoreResult.grade,
            score: scoreResult.total,
            signals: scoreResult.signals,
            contacts: [],
            enriched_data: {},
            current_management: 'Unknown',
            source: 'nyc_pluto_scan',
            status: 'active',
            tags: [],
            pipeline_stage: 'discovered' as const,
            violations_count: 0,
            open_violations_count: 0,
            market_value: marketValue,
            assessed_value: parseFloat(r.avtot) || 0,
            land_value: parseFloat(r.avland) || 0,
            tax_class: r.taxclass || '',
            dof_owner: r.owner || '',
            bbl: r.bbl,
            lot_area: parseFloat(r.lotarea) || 0,
            building_area: parseFloat(r.bldgarea) || 0,
            stories: parseInt(r.numfloors) || 0,
            building_class: r.bldgcl || '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as Building;
        });

      // Pull real HPD violation counts for every scanned building (batched
      // group-by queries — a few requests for the whole result set), then
      // re-score each building with its actual violation profile. Without
      // this every card showed 0 violations and a near-identical score.
      if (nycBuildings.length > 0) {
        setScanProgress(`Pulling HPD violations for ${nycBuildings.length} buildings...`);
        try {
          const counts = await fetchViolationCountsByBBLs(
            nycBuildings.map((b) => String(b.bbl || ''))
          );
          for (const b of nycBuildings) {
            const key = String(b.bbl || '').replace(/\D/g, '').slice(0, 10);
            const c = counts[key];
            b.violations_count = c?.total || 0;
            b.open_violations_count = c?.open || 0;
            const rescored = calculateScore({
              units: b.units,
              year_built: b.year_built,
              violations_count: b.violations_count,
              open_violations_count: b.open_violations_count,
              current_management: b.current_management,
            });
            b.score = rescored.total;
            b.grade = rescored.grade;
            b.signals = rescored.signals;
          }
        } catch (err) {
          console.error('Violation backfill failed (scores fall back to size/age):', err);
        }
      }

      if (nycBuildings.length > 0) {
        addBuildings(nycBuildings);
        totalFound += nycBuildings.length;
      }
    }

    // Non-NYC, non-Florida areas (Westchester, NJ, CT, Long Island, Hamptons)
    if (otherAreas.length > 0) {
      const triStateAreas = otherAreas.filter((a) => isTriStateArea(a));
      const unknownAreas = otherAreas.filter((a) => !isTriStateArea(a));

      if (triStateAreas.length > 0) {
        setScanProgress(`Researching ${triStateAreas.length} tri-state area(s)...`);
        await new Promise((resolve) => setTimeout(resolve, 600));
        const triStateBuildings = generateTriStateBuildings(triStateAreas);
        if (triStateBuildings.length > 0) {
          addBuildings(triStateBuildings);
          totalFound += triStateBuildings.length;
          toast.success(`🏘️ Found ${triStateBuildings.length} buildings in ${[...new Set(triStateAreas.map(a => getRegionByArea(a)?.name || ''))].join(', ')}`);
        }
      }

      if (unknownAreas.length > 0) {
        toast(`${unknownAreas.length} area(s) not yet in database: ${unknownAreas.join(', ')}`, { icon: '🔍', duration: 5000 });
      }
    }

    setIsScanning(false);
    setScanProgress('');

    // Clear region filters so Results page shows ALL scanned buildings
    // (scanned buildings store borough codes like 'MN', not area names like 'Upper East Side')
    setFilters({
      regions: [],
      buildingTypes,
      minUnits: minUnits ? parseInt(minUnits) : undefined,
      maxUnits: maxUnits ? parseInt(maxUnits) : undefined,
      yearBuiltMin: yearBuiltMin ? parseInt(yearBuiltMin) : undefined,
      yearBuiltMax: yearBuiltMax ? parseInt(yearBuiltMax) : undefined,
      violationThreshold: violationThreshold ? parseInt(violationThreshold) : undefined,
    } as any);

    if (totalFound > 0) {
      toast.success(`🏢 Found ${totalFound} buildings across ${selectedRegions.length} area(s)`, { duration: 5000 });
    } else {
      toast('No buildings found matching your criteria. Try adjusting filters.', { icon: '🔍' });
    }

    navigate('/results');
  };

  // Add quick report building to database
  const handleAddToScout = () => {
    if (!reportData) return;
    const building: Partial<Building> = {
      id: crypto.randomUUID(),
      address: quickAddress,
      name: reportData.energy?.propertyName || quickAddress,
      units: reportData.dof?.units,
      type: 'co-op',
      year_built: reportData.dof?.yearBuilt,
      grade: reportData.score?.grade || 'C',
      score: reportData.score?.total || 0,
      signals: reportData.score?.signals || [],
      contacts: [],
      enriched_data: { ...reportData, buildingOps: reportData.buildingOps },
      current_management: reportData.registration?.managementCompany || 'Unknown',
      source: 'nyc_open_data',
      status: 'active',
      tags: [],
      pipeline_stage: 'discovered',
      pipeline_moved_at: new Date().toISOString(),
      violations_count: reportData.violations?.total || 0,
      open_violations_count: reportData.violations?.open || 0,
      market_value: reportData.dof?.marketValue,
      assessed_value: reportData.dof?.assessedValue,
      land_value: reportData.dof?.landValue,
      tax_class: reportData.dof?.taxClass,
      dof_owner: reportData.dof?.owner,
      bbl: reportData.dof?.bbl,
      energy_star_score: reportData.energy?.energyStarScore,
      site_eui: reportData.energy?.siteEUI,
      ghg_emissions: reportData.energy?.ghgEmissions,
      lot_area: reportData.dof?.lotArea,
      building_area: reportData.dof?.buildingArea,
      stories: reportData.dof?.stories,
      building_class: reportData.dof?.buildingClass,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    addBuildings([building as Building]);
    // Clear region filters so the Results page shows ALL buildings (including newly added ones)
    setFilters({ regions: [], buildingTypes: [], grades: [] });
    toast.success('Building added to Scout database');
    navigate('/results');
  };

  // Clear all search results
  const clearResults = () => {
    setReportData(null);
    setOwnerResults([]);
    setDosResults([]);
    setUnitData(null);
    setOwnerSearchDone(false);
    setOwnerSearchedName('');
  };

  const hasResults = reportData || ownerResults.length > 0 || dosResults.length > 0 || unitData || ownerSearchDone;
  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const timestamp = now.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  const updateOperatorProfile = (field: 'preparedBy' | 'role' | 'audience', value: string) => {
    const next = { ...operatorProfile, [field]: value };
    setOperatorProfile(next);
    localStorage.setItem('camelot-os-v10-operator-profile', JSON.stringify(next));
  };
  const commandCards = [
    { label: 'Last Reports', value: 'Jackie, Arthur, Sentinel', note: 'Recent report packages stay visible from each bot workspace.', icon: FileText },
    { label: 'Saved Files', value: 'Exports + HTML', note: 'Download, print, email, and staged HTML actions are grouped by workflow.', icon: Download },
    { label: 'Critical Items', value: 'Review blockers', note: 'Source conflicts, missing images, and failed report checks should surface here.', icon: AlertTriangle },
    { label: 'Time Stamp', value: timestamp, note: 'V10 is designed around dated, numbered, attributable output.', icon: Clock },
  ];
  const botCards = [
    { name: 'Scout', route: '/results', icon: SearchIcon, text: 'Source, score, and organize new management targets.' },
    { name: 'Daily Hunt', route: '/daily-hunt', icon: Activity, text: 'Upload or review lead lists, verify facts, and queue Pipeline-ready opportunities.' },
    { name: 'Jackie', route: '/report-center', icon: Award, text: 'Build client-ready introductions, decks, and full property intelligence reports.' },
    { name: 'Sentinel', route: '/sentinel', icon: BarChart3, text: 'Track market movement, distress, timing, and benchmark signals.' },
    { name: 'Arthur', route: '/arthur', icon: BriefcaseBusiness, text: 'Underwrite investments, produce models, and queue broker follow-up.' },
    { name: 'Merlin Content', route: '/content-engine', icon: Megaphone, text: 'Generate, approve, schedule, publish, and track Camelot content.' },
    { name: 'Shield', route: '/compliance', icon: ShieldCheck, text: 'Review violations, compliance, DOB/HPD/local-law risk, and next actions.' },
    { name: 'Merlin', route: '/chat', icon: Bot, text: 'Ask questions, summarize work, and coordinate Camelot OS tasks.' },
  ];

  return (
    <div className="min-h-screen">
      {!hasResults && (
        <section className="px-6 py-8 md:px-8">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_0.65fr] gap-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
                  <div>
                    <div className="text-xs uppercase tracking-[0.28em] text-camelot-gold font-bold mb-2">
                      {APP_NAME_SHORT} Command Center
                    </div>
                    <h1 className="font-heading text-3xl md:text-4xl text-slate-950">
                      {greeting}, welcome back.
                    </h1>
                    <p className="text-slate-600 mt-3 max-w-3xl leading-relaxed">
                      {V10_RELEASE_NOTE} This dashboard shows what the platform is doing, which bots are ready, and what needs attention before a client-facing report is released.
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#F8F6EF] border border-camelot-gold/25 p-4 min-w-[260px]">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-1">Current Session</div>
                    <div className="font-semibold text-slate-950">{timestamp}</div>
                    <div className="text-sm text-slate-600 mt-2">{CAMELOT_CONTACT.address}</div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-6">
                  {commandCards.map(({ label, value, note, icon: Icon }) => (
                    <div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="flex items-center gap-2 text-camelot-gold">
                        <Icon size={17} />
                        <span className="text-[10px] uppercase tracking-[0.18em] font-bold">{label}</span>
                      </div>
                      <div className="mt-3 text-lg font-bold text-slate-950">{value}</div>
                      <p className="mt-2 text-xs leading-relaxed text-slate-500">{note}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle2 size={18} className="text-camelot-gold" />
                  <h2 className="font-heading text-xl text-slate-950">Report Attribution</h2>
                </div>
                <div className="space-y-3">
                  <input
                    value={operatorProfile.preparedBy || ''}
                    onChange={(e) => updateOperatorProfile('preparedBy', e.target.value)}
                    placeholder="Prepared by (user name)"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-camelot-gold/40"
                  />
                  <input
                    value={operatorProfile.role || ''}
                    onChange={(e) => updateOperatorProfile('role', e.target.value)}
                    placeholder="Role / department"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-camelot-gold/40"
                  />
                  <input
                    value={operatorProfile.audience || ''}
                    onChange={(e) => updateOperatorProfile('audience', e.target.value)}
                    placeholder="Default audience / addressed to"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-camelot-gold/40"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-4 leading-relaxed">
                  V10 stores this locally so reports can be prepared with a clear author, recipient, date, and document trail.
                </p>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-5">
                <div>
                  <div className="text-xs uppercase tracking-[0.24em] text-camelot-gold font-bold">Bot Workspaces</div>
                  <h2 className="font-heading text-2xl text-slate-950 mt-1">Choose the job, then launch the right bot.</h2>
                </div>
                <button
                  onClick={() => navigate('/tutorials')}
                  className="inline-flex items-center gap-2 rounded-xl border border-camelot-gold/40 px-4 py-2 text-sm font-semibold text-camelot-gold hover:bg-[#F8F6EF]"
                >
                  <PlayCircle size={16} />
                  Video Tutorial Hub
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {botCards.map(({ name, route, icon: Icon, text }) => (
                  <button
                    key={name}
                    onClick={() => navigate(route)}
                    className="text-left rounded-xl border border-slate-200 bg-[#FFFEFB] p-4 hover:border-camelot-gold/60 hover:shadow-md transition-all"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="w-10 h-10 rounded-xl bg-[#F7F1DE] text-camelot-gold flex items-center justify-center">
                          <Icon size={19} />
                        </span>
                        <span className="font-bold text-slate-950">{name}</span>
                      </div>
                      <ArrowRight size={16} className="text-slate-400" />
                    </div>
                    <p className="text-sm text-slate-600 mt-3 leading-relaxed">{text}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Hero with integrated search */}
      <div className={cn(
        "bg-white text-slate-950 px-8 transition-all duration-500 border-y border-slate-200",
        hasResults ? 'pb-8' : 'py-10'
      )}>
        <div className="max-w-5xl mx-auto pt-10">
          {/* Camelot Logo + Scout Branding */}
          <div className="flex items-center gap-4 mb-6">
            <img
              src="/images/camelot-logo.png"
              alt="Camelot Realty Group"
              className="h-8 object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <div className="h-8 w-px bg-slate-200" />
            <div>
              <h1 className="text-2xl font-heading font-bold tracking-wide text-camelot-gold">
                {APP_NAME_SHORT}
              </h1>
              <p className="text-[10px] text-gray-400 tracking-[0.2em] uppercase font-body">The Operating System for Property Management</p>
            </div>
          </div>

          {/* Value proposition */}
          {!hasResults && (
            <div className="mb-8 max-w-2xl">
              <h2 className="text-xl font-heading text-slate-950 leading-relaxed mb-3">
                Find, analyze, and win new management contracts with a cleaner V10 workspace.
              </h2>
              <p className="text-slate-600 font-body leading-relaxed mb-4">
                Camelot OS V10 organizes building data, state-specific source checks, report packages, proposal tools, compliance alerts, and acquisition workflows into one source-aware operating dashboard.
              </p>
              <div className="flex flex-wrap gap-4 text-sm font-body">
                <div className="flex items-center gap-2 text-camelot-gold">
                  <SearchIcon size={14} />
                  <span>Search individual buildings</span>
                </div>
                <div className="flex items-center gap-2 text-camelot-gold">
                  <Users size={14} />
                  <span>Bulk pull by region or owner</span>
                </div>
                <div className="flex items-center gap-2 text-camelot-gold">
                  <FileText size={14} />
                  <span>Generate branded reports &amp; proposals</span>
                </div>
              </div>
            </div>
          )}

          {/* Search Tabs */}
          <div className="flex gap-2 mb-4">
            {([
              { key: 'address' as SearchTab, icon: MapPin, label: 'Address' },
              { key: 'owner' as SearchTab, icon: User, label: 'Owner Name' },
              { key: 'unit' as SearchTab, icon: Home, label: 'Unit Lookup' },
            ]).map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                onClick={() => {
                  setActiveTab(key);
                  clearResults();
                  if (key === 'address') { setOwnerName(''); setOwnerResults([]); setDosResults([]); }
                  if (key === 'owner') { setQuickAddress(''); setReportData(null); }
                  if (key === 'unit') { setQuickAddress(''); setReportData(null); setOwnerName(''); setOwnerResults([]); setDosResults([]); }
                }}
                className={cn(
                  'flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-200',
                  activeTab === key
                    ? 'bg-camelot-gold text-camelot-navy shadow-lg shadow-camelot-gold/20'
                    : 'bg-white text-slate-600 hover:bg-[#F8F6EF] hover:text-slate-950 border border-slate-200'
                )}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </div>

          {/* Address Search */}
          {activeTab === 'address' && (
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <MapPin size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={quickAddress}
                  onChange={(e) => setQuickAddress(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleQuickReport()}
                  onFocus={(e) => e.target.select()}
                  placeholder="Enter any NYC address (e.g., 301 East 79th Street)"
                  className="w-full pl-12 pr-10 py-4 bg-white border border-slate-200 rounded-2xl text-slate-950 text-lg placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-camelot-gold/60 focus:border-camelot-gold transition-all"
                />
                {quickAddress && (
                  <button
                    onClick={() => { setQuickAddress(''); setReportData(null); }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-950 transition-colors"
                    title="Clear search"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              <button
                onClick={handleQuickReport}
                disabled={!quickAddress.trim() || isSearching}
                className="bg-camelot-gold text-camelot-navy px-8 py-4 rounded-2xl font-bold text-lg hover:bg-camelot-gold-light transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-camelot-gold/20"
              >
                {isSearching ? <Loader2 size={20} className="animate-spin" /> : <SearchIcon size={20} />}
                Search
              </button>
            </div>
          )}

          {/* Owner Name Search */}
          {activeTab === 'owner' && (
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleOwnerSearch()}
                  placeholder="Enter owner or company name (e.g., Silverstein Properties)"
                  className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl text-slate-950 text-lg placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-camelot-gold/60 focus:border-camelot-gold transition-all"
                />
              </div>
              <button
                onClick={handleOwnerSearch}
                disabled={!ownerName.trim() || isOwnerSearching}
                className="bg-camelot-gold text-camelot-navy px-8 py-4 rounded-2xl font-bold text-lg hover:bg-camelot-gold-light transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-camelot-gold/20"
              >
                {isOwnerSearching ? <Loader2 size={20} className="animate-spin" /> : <SearchIcon size={20} />}
                Search
              </button>
            </div>
          )}

          {/* Unit Lookup */}
          {activeTab === 'unit' && (
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <MapPin size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={unitAddress}
                  onChange={(e) => setUnitAddress(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleUnitSearch()}
                  placeholder="Building address (e.g., 301 East 79th Street)"
                  className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl text-slate-950 text-lg placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-camelot-gold/60 focus:border-camelot-gold transition-all"
                />
              </div>
              <div className="w-40 relative">
                <Home size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={unitNumber}
                  onChange={(e) => setUnitNumber(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleUnitSearch()}
                  placeholder="Unit #"
                  className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl text-slate-950 text-lg placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-camelot-gold/60 focus:border-camelot-gold transition-all"
                />
              </div>
              <button
                onClick={handleUnitSearch}
                disabled={!unitAddress.trim() || !unitNumber.trim() || isUnitSearching}
                className="bg-camelot-gold text-camelot-navy px-8 py-4 rounded-2xl font-bold text-lg hover:bg-camelot-gold-light transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-camelot-gold/20"
              >
                {isUnitSearching ? <Loader2 size={20} className="animate-spin" /> : <SearchIcon size={20} />}
                Search
              </button>
            </div>
          )}

          {/* Stats Bar */}
          <div className="grid grid-cols-4 gap-4 mt-6">
            {[
              { icon: Building2, label: 'Properties', value: '42' },
              { icon: DollarSign, label: 'AUM', value: '$240M+' },
              { icon: Calendar, label: 'Years', value: '18+' },
              { icon: TrendingUp, label: 'Units Tracked', value: '5,351+' },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="text-center bg-[#F8F6EF] rounded-xl p-3 border border-slate-200">
                <Icon size={20} className="mx-auto text-camelot-gold mb-1" />
                <p className="text-lg font-bold">{value}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
              </div>
            ))}
          </div>

          {/* ====== INLINE RESULTS (dark theme, inside hero) ====== */}

          {/* Address Report Results */}
          {reportData && (
            <div className="mt-6 bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6 animate-slide-in">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">Building Report: {quickAddress}</h3>
                  {reportData.energy?.propertyName && (
                    <p className="text-sm text-gray-400">{reportData.energy.propertyName}</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleAddToScout}
                    className="bg-camelot-gold text-camelot-navy px-6 py-3 rounded-xl text-sm font-bold hover:bg-camelot-gold-light transition-all shadow-lg shadow-camelot-gold/20 flex items-center gap-2"
                  >
                    <Award size={16} />
                    Add to Scout
                  </button>
                  <button onClick={clearResults} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                    <X size={18} className="text-slate-400" />
                  </button>
                </div>
              </div>

              {/* Google Maps Embed for address report */}
              <div className="mb-5 rounded-xl overflow-hidden border border-white/10">
                <iframe
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(quickAddress + ', New York, NY')}&output=embed&z=17`}
                  className="w-full h-[180px]"
                  style={{ border: 0, filter: 'brightness(0.85) contrast(1.1)' }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Building location"
                  allowFullScreen
                />
              </div>

              {/* Score */}
              {reportData.score && (
                <div className="flex items-center gap-4 mb-6 p-4 bg-white/5 rounded-xl border border-white/10">
                  <div className={cn(
                    'w-16 h-16 rounded-xl flex items-center justify-center text-2xl font-bold border-2',
                    reportData.score.grade === 'A' ? 'bg-green-900/30 text-green-400 border-green-500/30' :
                    reportData.score.grade === 'B' ? 'bg-yellow-900/30 text-yellow-400 border-yellow-500/30' :
                    'bg-gray-800/30 text-gray-400 border-gray-500/30'
                  )}>
                    {reportData.score.grade}
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Lead Score</p>
                    <p className="text-2xl font-bold text-white">{reportData.score.total}/100</p>
                  </div>
                  <div className="ml-auto flex flex-wrap gap-1 max-w-md">
                    {reportData.score.signals.map((s: string, i: number) => (
                      <span key={i} className="text-xs bg-camelot-gold/20 text-camelot-gold px-2 py-0.5 rounded-full border border-camelot-gold/30">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Building Operations Badges */}
              {reportData.buildingOps && (
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <span className={cn(
                    'text-xs px-2.5 py-1 rounded-full font-medium border',
                    reportData.buildingOps.unionStatus === 'likely_union'
                      ? 'bg-blue-900/30 text-blue-300 border-blue-500/30'
                      : 'bg-white/10 text-gray-400 border-white/10',
                  )}>
                    {reportData.buildingOps.unionLabel}
                  </span>
                  <span className={cn(
                    'text-xs px-2.5 py-1 rounded-full font-medium border',
                    reportData.buildingOps.hasDoorman
                      ? 'bg-green-900/30 text-green-300 border-green-500/30'
                      : 'bg-white/10 text-gray-400 border-white/10',
                  )}>
                    {reportData.buildingOps.hasDoorman ? '🚪 Doorman Building' : 'No Doorman'}
                  </span>
                  {reportData.buildingOps.hasFrontDesk && (
                    <span className="text-xs px-2.5 py-1 rounded-full font-medium border bg-green-900/30 text-green-300 border-green-500/30">
                      📞 Has Front Desk
                    </span>
                  )}
                  {reportData.buildingOps.hasElevator && (
                    <span className="text-xs px-2.5 py-1 rounded-full font-medium border bg-purple-900/30 text-purple-300 border-purple-500/30">
                      🛗 Elevator
                    </span>
                  )}
                  {reportData.buildingOps.buildingClassDescription && (
                    <span className="text-xs px-2.5 py-1 rounded-full font-medium border bg-white/10 text-gray-300 border-white/10">
                      {reportData.buildingOps.buildingClass}: {reportData.buildingOps.buildingClassDescription}
                    </span>
                  )}
                  {reportData.litigation?.hasActive && (
                    <span className="text-xs px-2.5 py-1 rounded-full font-bold border bg-red-900/40 text-red-300 border-red-500/40 animate-pulse">
                      ⚖️ ACTIVE LITIGATION
                    </span>
                  )}
                  {reportData.rentStabilization?.isStabilized && (
                    <span className="text-xs px-2.5 py-1 rounded-full font-medium border bg-blue-900/30 text-blue-300 border-blue-500/30">
                      📋 Rent Stabilized
                    </span>
                  )}
                  {reportData.ecb?.count > 0 && (
                    <span className="text-xs px-2.5 py-1 rounded-full font-medium border bg-orange-900/30 text-orange-300 border-orange-500/30">
                      ⚠️ {reportData.ecb.count} ECB Violation{reportData.ecb.count !== 1 ? 's' : ''}
                      {reportData.ecb.totalPenaltyBalance > 0 && ` ($${reportData.ecb.totalPenaltyBalance.toLocaleString()})`}
                    </span>
                  )}
                </div>
              )}

              {/* Data Grid */}
              <div className="grid grid-cols-3 gap-6">
                {/* DOF Data */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <DollarSign size={12} className="text-camelot-gold" /> Property Assessment
                  </h4>
                  <div className="space-y-1.5">
                    {reportData.dof ? (
                      <>
                        <DarkInfoRow label="Owner" value={reportData.dof.owner || '—'} />
                        <DarkInfoRow label="Market Value" value={formatCurrency(reportData.dof.marketValue)} />
                        <DarkInfoRow label="Assessed Value" value={formatCurrency(reportData.dof.assessedValue)} />
                        <DarkInfoRow label="Land Value" value={formatCurrency(reportData.dof.landValue)} />
                        <DarkInfoRow label="Year Built" value={String(reportData.dof.yearBuilt || '—')} />
                        <DarkInfoRow label="Units" value={String(reportData.dof.units || '—')} />
                        <DarkInfoRow label="Lot Area" value={reportData.dof.lotArea ? `${formatNumber(reportData.dof.lotArea)} sf` : '—'} />
                        <DarkInfoRow label="Tax Class" value={reportData.dof.taxClass || '—'} />
                      </>
                    ) : (
                      <p className="text-xs text-gray-500">No DOF data found</p>
                    )}
                  </div>
                </div>

                {/* Violations */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <AlertTriangle size={12} className="text-camelot-gold" /> HPD Violations
                  </h4>
                  <div className="space-y-1.5">
                    <DarkInfoRow label="Total" value={String(reportData.violations.total)} highlight={reportData.violations.total > 20} />
                    <DarkInfoRow label="Open" value={String(reportData.violations.open)} highlight={reportData.violations.open > 5} />
                    <DarkInfoRow label="Last Violation" value={reportData.violations.lastDate ? new Date(reportData.violations.lastDate).toLocaleDateString() : '—'} />
                  </div>
                  {reportData.registration && (
                    <div className="mt-3">
                      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <Users size={12} className="text-camelot-gold" /> Registration
                      </h4>
                      <DarkInfoRow label="Owner" value={reportData.registration.owner || '—'} />
                      <DarkInfoRow label="Management" value={reportData.registration.managementCompany || '—'} />
                    </div>
                  )}
                </div>

                {/* Energy & Permits */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Zap size={12} className="text-camelot-gold" /> Energy / LL97
                  </h4>
                  <div className="space-y-1.5">
                    {reportData.energy ? (
                      <>
                        <DarkInfoRow label="Energy Star" value={String(reportData.energy.energyStarScore ?? '—')} />
                        <DarkInfoRow label="Site EUI" value={reportData.energy.siteEUI ? `${reportData.energy.siteEUI} kBtu/ft²` : '—'} />
                        <DarkInfoRow label="GHG Emissions" value={reportData.energy.ghgEmissions ? `${reportData.energy.ghgEmissions} MT` : '—'} />
                      </>
                    ) : (
                      <p className="text-xs text-gray-500">No energy data found</p>
                    )}
                  </div>
                  <div className="mt-3">
                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                      <Activity size={12} className="text-camelot-gold" /> DOB Permits
                    </h4>
                    <DarkInfoRow label="Total Permits" value={String(reportData.permits.count)} />
                    <DarkInfoRow label="Recent Activity" value={reportData.permits.hasRecent ? 'Yes' : 'No'} />
                  </div>
                </div>
              </div>

              {/* Ownership / ACRIS Section */}
              {reportData.acris && reportData.acris.records.length > 0 && (
                <div className="mt-6 pt-5 border-t border-white/10">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1">
                    <Landmark size={12} className="text-camelot-gold" /> Ownership / ACRIS
                  </h4>
                  <div className="grid grid-cols-3 gap-4 mb-3">
                    <div className="bg-[#F8F6EF] rounded-xl p-3 border border-slate-200">
                      <p className="text-[10px] text-gray-400 uppercase">Last Sale Price</p>
                      <p className="text-sm font-medium text-white">
                        {reportData.acris.lastSalePrice
                          ? `$${Number(reportData.acris.lastSalePrice).toLocaleString()}`
                          : '—'}
                      </p>
                    </div>
                    <div className="bg-[#F8F6EF] rounded-xl p-3 border border-slate-200">
                      <p className="text-[10px] text-gray-400 uppercase">Last Sale Date</p>
                      <p className="text-sm font-medium text-white">
                        {reportData.acris.lastSaleDate
                          ? new Date(reportData.acris.lastSaleDate).toLocaleDateString()
                          : '—'}
                      </p>
                    </div>
                    <div className="bg-[#F8F6EF] rounded-xl p-3 border border-slate-200">
                      <p className="text-[10px] text-gray-400 uppercase">Last Buyer</p>
                      <p className="text-sm font-medium text-white truncate">
                        {reportData.acris.lastSaleBuyer || '—'}
                      </p>
                    </div>
                  </div>
                  {reportData.acris.deeds.length > 0 && (
                    <div className="space-y-1 mb-3">
                      {reportData.acris.deeds.slice(0, 3).map((d: any, i: number) => {
                        const buyer = d.parties?.find((p: any) => p.type === 'buyer');
                        const seller = d.parties?.find((p: any) => p.type === 'seller');
                        return (
                          <div key={i} className="flex items-center justify-between px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-400">{d.date ? new Date(d.date).toLocaleDateString() : '—'}</span>
                              <span className="text-green-400 font-medium">{d.documentTypeLabel}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-gray-300 truncate max-w-[120px]">{seller?.name || '—'}</span>
                              <span className="text-gray-500">→</span>
                              <span className="text-white font-medium truncate max-w-[120px]">{buyer?.name || '—'}</span>
                              <span className="text-camelot-gold font-medium">
                                {d.amount ? `$${Number(d.amount).toLocaleString()}` : ''}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <a
                    href={reportData.acris.acrisUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-camelot-gold hover:underline"
                  >
                    <ExternalLink size={12} /> View full ACRIS history on NYC.gov
                  </a>
                </div>
              )}

              {/* Generate Proposal CTA */}
              <div className="mt-6 pt-5 border-t border-white/10">
                <button
                  onClick={() => navigate('/instant-proposal', { state: { address: quickAddress } })}
                  className="w-full bg-camelot-gold text-white font-bold py-3 px-6 rounded-xl hover:bg-camelot-gold/90 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-camelot-gold/20"
                >
                  <FileText size={18} />
                  Generate Proposal for This Building
                </button>
              </div>
            </div>
          )}

          {/* New Search button — visible when report is loaded */}
          {reportData && (
            <div className="mt-4 flex justify-center">
              <button
                onClick={() => {
                  setQuickAddress('');
                  setReportData(null);
                  setOwnerResults([]);
                  setDosResults([]);
                  setUnitData(null);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="px-6 py-2.5 bg-white/10 border border-white/20 text-white rounded-xl text-sm font-medium hover:bg-white/20 transition-colors flex items-center gap-2"
              >
                <SearchIcon size={15} />
                New Search
              </button>
            </div>
          )}

          {/* Owner Search — empty state */}
          {ownerSearchDone && ownerResults.length === 0 && dosResults.length === 0 && (
            <div className="mt-6 bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-8 animate-slide-in text-center">
              <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <SearchIcon size={22} className="text-slate-400" />
              </div>
              <p className="text-white font-semibold mb-1">No results found for "{ownerSearchedName}"</p>
              <p className="text-sm text-gray-400">Try a partial name or company name (e.g., "Silverstein" instead of "Silverstein Properties LLC").</p>
              <button
                onClick={clearResults}
                className="mt-4 px-4 py-2 text-sm text-slate-400 hover:text-slate-950 transition-colors"
              >
                Clear
              </button>
            </div>
          )}

          {/* Owner Search Results */}
          {(ownerResults.length > 0 || dosResults.length > 0) && (
            <div className="mt-6 bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6 animate-slide-in">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">
                  Owner Results: "{ownerName}" — {ownerResults.length} building(s)
                  {dosResults.length > 0 && `, ${dosResults.length} corporate filing(s)`}
                </h3>
                <button onClick={clearResults} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                  <X size={18} className="text-slate-400" />
                </button>
              </div>

              {/* NY DOS Corporate Filings */}
              {dosResults.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                    🏛️ NY Secretary of State — Corporate Filings
                  </h4>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 mb-4">
                    {dosResults.slice(0, 10).map((corp, i) => (
                      <div key={i} className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl">
                        <p className="text-sm font-semibold text-white">{corp.current_entity_name}</p>
                        <div className="text-xs text-gray-400 mt-1 space-y-0.5">
                          {corp.dos_id && <span className="mr-3">DOS ID: {corp.dos_id}</span>}
                          {corp.dos_process_name && (
                            <p className="text-camelot-gold font-medium">
                              Process Agent: {corp.dos_process_name}
                            </p>
                          )}
                          {corp.dos_process_address_1 && (
                            <p>{corp.dos_process_address_1}{corp.dos_process_address_2 ? `, ${corp.dos_process_address_2}` : ''}</p>
                          )}
                          {corp.entity_formation_date && (
                            <span className="mr-3">Formed: {new Date(corp.entity_formation_date).toLocaleDateString()}</span>
                          )}
                          {corp.county && <span>County: {corp.county}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* HPD Building Results */}
              {ownerResults.length > 0 && (
                <>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                    🏢 HPD Building Registrations
                  </h4>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                    {ownerResults.map((row, i) => {
                      const addr = `${row.housenumber || ''} ${row.streetname || ''}`.trim();
                      const ownerDisplay = row.corporationname
                        || `${row.ownerfirstname || ''} ${row.ownerlastname || ''}`.trim()
                        || '—';
                      const boroughNames: Record<string, string> = { '1': 'Manhattan', '2': 'Bronx', '3': 'Brooklyn', '4': 'Queens', '5': 'Staten Island' };
                      return (
                        <button
                          key={i}
                          onClick={() => handleOwnerResultClick(row)}
                          className="w-full flex items-center justify-between px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all text-left group"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white group-hover:text-camelot-gold transition-colors truncate">
                              {addr || 'Unknown address'}
                            </p>
                            <p className="text-xs text-gray-400 truncate">
                              {boroughNames[row.boroid] || ''} · Owner: {ownerDisplay}
                            </p>
                            {row.managementcompany && (
                              <p className="text-xs text-gray-500 truncate">
                                Mgmt: {row.managementcompany}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                            {row.buildingid && (
                              <span className="text-[10px] bg-white/10 text-gray-400 px-2 py-0.5 rounded-full">
                                ID: {row.buildingid}
                              </span>
                            )}
                            <ChevronRight size={16} className="text-gray-500 group-hover:text-camelot-gold transition-colors" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Unit Lookup Results — Enhanced */}
          {unitData && (
            <div className="mt-6 bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6 animate-slide-in">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">
                    Unit {unitData.unit} — {unitAddress}
                  </h3>
                  <p className="text-sm text-gray-400">
                    {unitData.violations.total} violation(s) · {unitData.violations.open} open
                    {unitData.isCondo && <span className="ml-2 text-xs bg-blue-900/40 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/30">Condo</span>}
                    {unitData.isCoop && <span className="ml-2 text-xs bg-purple-900/40 text-purple-300 px-2 py-0.5 rounded-full border border-purple-500/30">Co-op</span>}
                  </p>
                </div>
                <button onClick={clearResults} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                  <X size={18} className="text-slate-400" />
                </button>
              </div>

              {/* Google Maps Embed */}
              <div className="mb-4 rounded-xl overflow-hidden border border-white/10">
                <iframe
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(unitAddress + ', New York, NY')}&output=embed&z=17`}
                  className="w-full h-[200px]"
                  style={{ border: 0, filter: 'brightness(0.85) contrast(1.1)' }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Building location"
                  allowFullScreen
                />
              </div>

              {/* Building Info Card */}
              {unitData.dof && (
                <div className="grid grid-cols-4 gap-3 mb-4">
                  <div className="bg-[#F8F6EF] rounded-xl p-3 border border-slate-200">
                    <p className="text-[10px] text-gray-400 uppercase">Owner</p>
                    <p className="text-sm font-medium text-white truncate">{unitData.dof.owner || '—'}</p>
                  </div>
                  <div className="bg-[#F8F6EF] rounded-xl p-3 border border-slate-200">
                    <p className="text-[10px] text-gray-400 uppercase">BBL</p>
                    <p className="text-sm font-medium text-white font-mono">{unitData.dof.bbl || '—'}</p>
                  </div>
                  <div className="bg-[#F8F6EF] rounded-xl p-3 border border-slate-200">
                    <p className="text-[10px] text-gray-400 uppercase">Total Units</p>
                    <p className="text-sm font-medium text-white">{unitData.dof.units || '—'}</p>
                  </div>
                  <div className="bg-[#F8F6EF] rounded-xl p-3 border border-slate-200">
                    <p className="text-[10px] text-gray-400 uppercase">Market Value</p>
                    <p className="text-sm font-medium text-white">{unitData.dof.marketValue ? formatCurrency(unitData.dof.marketValue) : '—'}</p>
                  </div>
                  <div className="bg-[#F8F6EF] rounded-xl p-3 border border-slate-200">
                    <p className="text-[10px] text-gray-400 uppercase">Year Built</p>
                    <p className="text-sm font-medium text-white">{unitData.dof.yearBuilt || '—'}</p>
                  </div>
                  <div className="bg-[#F8F6EF] rounded-xl p-3 border border-slate-200">
                    <p className="text-[10px] text-gray-400 uppercase">Stories</p>
                    <p className="text-sm font-medium text-white">{unitData.dof.stories || '—'}</p>
                  </div>
                  <div className="bg-[#F8F6EF] rounded-xl p-3 border border-slate-200">
                    <p className="text-[10px] text-gray-400 uppercase">Building Class</p>
                    <p className="text-sm font-medium text-white">{unitData.dof.buildingClass || '—'}</p>
                  </div>
                  <div className="bg-[#F8F6EF] rounded-xl p-3 border border-slate-200">
                    <p className="text-[10px] text-gray-400 uppercase">Management</p>
                    <p className="text-sm font-medium text-white truncate">{unitData.registration?.managementCompany || '—'}</p>
                  </div>
                </div>
              )}

              {/* Condo/Co-op note */}
              {unitData.isCondo && (
                <div className="mb-4 px-4 py-2.5 bg-blue-900/20 border border-blue-500/20 rounded-xl">
                  <p className="text-xs text-blue-300">
                    🏢 <strong>Condo unit</strong> — Individual lot/BBL may be available via <a href="https://a836-acris.nyc.gov/DS/DocumentSearch/Index" target="_blank" rel="noopener" className="underline hover:text-blue-200">ACRIS</a>. Each condo unit has its own tax lot.
                  </p>
                </div>
              )}
              {unitData.isCoop && (
                <div className="mb-4 px-4 py-2.5 bg-purple-900/20 border border-purple-500/20 rounded-xl">
                  <p className="text-xs text-purple-300">
                    🏠 <strong>Co-op unit</strong> — Ownership is via stock shares and proprietary lease. The entire building shares one BBL ({unitData.dof?.bbl || 'N/A'}).
                  </p>
                </div>
              )}

              {/* Unit Violations */}
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1">
                <AlertTriangle size={12} className="text-camelot-gold" /> Unit {unitData.unit} Violations
              </h4>
              {unitData.violations.items.length > 0 ? (
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                  {unitData.violations.items.map((v: any, i: number) => (
                    <div key={i} className="flex items-start gap-3 px-4 py-3 bg-white/5 border border-white/10 rounded-xl">
                      <div className={cn(
                        'w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5',
                        v.class === 'C' ? 'bg-red-900/40 text-red-400 border border-red-500/30' :
                        v.class === 'B' ? 'bg-orange-900/40 text-orange-400 border border-orange-500/30' :
                        'bg-yellow-900/40 text-yellow-400 border border-yellow-500/30'
                      )}>
                        {v.class || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white leading-relaxed">{v.novdescription || 'No description'}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[10px] text-gray-500">
                            {v.inspectiondate ? new Date(v.inspectiondate).toLocaleDateString() : '—'}
                          </span>
                          <span className={cn(
                            'text-[10px] px-1.5 py-0.5 rounded-full',
                            (v.currentstatus === 'CLOSE' || v.violationstatus === 'Close')
                              ? 'bg-green-900/30 text-green-400'
                              : 'bg-red-900/30 text-red-400'
                          )}>
                            {(v.currentstatus === 'CLOSE' || v.violationstatus === 'Close') ? 'Closed' : 'Open'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500 text-sm">No violations found for unit {unitData.unit}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Region Selector + Filters (below hero, white area) */}
      <div className="max-w-5xl mx-auto px-8 py-8">
        <div className="grid grid-cols-3 gap-8">
          {/* Region Selector - takes 2 columns */}
          <div className="col-span-2">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <MapPin size={20} className="text-camelot-gold" /> Region Selector
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Select areas to scan. NYC boroughs have live government data; other regions use AI-powered research.
            </p>

            {selectedRegions.length > 0 && (
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <span className="text-xs text-gray-500">{selectedRegions.length} selected:</span>
                {selectedRegions.slice(0, 8).map((area) => (
                  <span key={area} className="text-xs bg-camelot-gold/10 text-camelot-gold px-2 py-1 rounded-full flex items-center gap-1">
                    {area}
                    <button onClick={() => toggleRegion(area)} className="hover:text-red-500">
                      <X size={10} />
                    </button>
                  </span>
                ))}
                {selectedRegions.length > 8 && (
                  <span className="text-xs text-gray-400">+{selectedRegions.length - 8} more</span>
                )}
                <button
                  onClick={() => setSelectedRegions([])}
                  className="text-xs text-red-500 hover:underline ml-2"
                >
                  Clear all
                </button>
              </div>
            )}

            <div className="space-y-1 max-h-[500px] overflow-y-auto pr-2">
              {REGIONS.map((group) => {
                const isExpanded = expandedGroups.has(group.name);
                const selectedCount = group.areas.filter((a) => selectedRegions.includes(a)).length;
                const allSelected = selectedCount === group.areas.length;

                return (
                  <div key={group.name} className="border border-gray-200 rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleGroup(group.name)}
                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <span className="font-medium text-sm">{group.name}</span>
                        <span className="text-xs text-gray-400">({group.areas.length} areas)</span>
                        {group.tag && (
                          <span className={cn(
                            'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                            group.tag === 'LIVE'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-purple-100 text-purple-700'
                          )}>
                            {group.tag}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedCount > 0 && (
                          <span className="text-xs bg-camelot-gold text-white px-1.5 py-0.5 rounded-full">
                            {selectedCount}
                          </span>
                        )}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-3 border-t border-gray-100">
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleAllInGroup(group); }}
                          className="text-xs text-camelot-gold hover:underline my-2"
                        >
                          {allSelected ? 'Deselect all' : 'Select all'}
                        </button>
                        <div className="grid grid-cols-3 gap-1">
                          {group.areas.map((area) => (
                            <label
                              key={area}
                              className={cn(
                                'flex items-center gap-2 px-2 py-1.5 rounded-md text-xs cursor-pointer transition-colors',
                                selectedRegions.includes(area)
                                  ? 'bg-camelot-gold/10 text-camelot-gold'
                                  : 'hover:bg-gray-50'
                              )}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                checked={selectedRegions.includes(area)}
                                onChange={() => toggleRegion(area)}
                                onClick={(e) => e.stopPropagation()}
                                className="rounded border-gray-300 text-camelot-gold focus:ring-camelot-gold"
                              />
                              {area}
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Advanced Filters */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Filter size={20} className="text-camelot-gold" /> Filters
              </h2>
              <button
                onClick={() => {
                  setBuildingTypes([]);
                  setMinUnits('');
                  setMaxUnits('');
                  setYearBuiltMin('');
                  setYearBuiltMax('');
                  setViolationThreshold('');
                }}
                className="text-xs text-gray-400 hover:text-camelot-gold transition-colors underline"
              >
                Reset
              </button>
            </div>

            {/* Building Type */}
            <div className="mb-4">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Building Type</label>
              <div className="space-y-1">
                {(['co-op', 'condo', 'rental', 'mixed-use'] as BuildingType[]).map((type) => (
                  <label
                    key={type}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors',
                      buildingTypes.includes(type)
                        ? 'bg-camelot-gold/10 text-camelot-gold'
                        : 'hover:bg-gray-50'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={buildingTypes.includes(type)}
                      onChange={() => toggleBuildingType(type)}
                      className="rounded border-gray-300 text-camelot-gold focus:ring-camelot-gold"
                    />
                    <span className="capitalize">{type}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Unit Range */}
            <div className="mb-4">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Unit Count</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={minUnits}
                  onChange={(e) => setMinUnits(e.target.value)}
                  placeholder="Min"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-camelot-gold/50"
                />
                <input
                  type="number"
                  value={maxUnits}
                  onChange={(e) => setMaxUnits(e.target.value)}
                  placeholder="Max"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-camelot-gold/50"
                />
              </div>
            </div>

            {/* Year Built */}
            <div className="mb-4">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Year Built</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={yearBuiltMin}
                  onChange={(e) => setYearBuiltMin(e.target.value)}
                  placeholder="From"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-camelot-gold/50"
                />
                <input
                  type="number"
                  value={yearBuiltMax}
                  onChange={(e) => setYearBuiltMax(e.target.value)}
                  placeholder="To"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-camelot-gold/50"
                />
              </div>
            </div>

            {/* Violation Threshold */}
            <div className="mb-6">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Min. Violations</label>
              <input
                type="number"
                value={violationThreshold}
                onChange={(e) => setViolationThreshold(e.target.value)}
                placeholder="e.g., 10"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-camelot-gold/50"
              />
            </div>

            {/* Scan Button */}
            <button
              onClick={handleScan}
              disabled={selectedRegions.length === 0 || isScanning}
              className="w-full bg-camelot-gold text-white py-3 rounded-xl font-semibold hover:bg-camelot-gold-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isScanning ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <SearchIcon size={18} />
                  Scan {selectedRegions.length} Area{selectedRegions.length !== 1 ? 's' : ''}
                </>
              )}
            </button>
            {isScanning && scanProgress && (
              <p className="text-xs text-camelot-gold text-center mt-2 animate-pulse">{scanProgress}</p>
            )}
            {selectedRegions.length === 0 && !isScanning && (
              <p className="text-xs text-gray-400 text-center mt-2">Select at least one area to scan</p>
            )}
            {selectedRegions.filter((a) => isFloridaArea(a)).length > 0 && !isScanning && (
              <p className="text-xs text-amber-600 text-center mt-2">🌴 Florida areas use AI-researched data</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DarkInfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between py-1 text-xs">
      <span className="text-gray-500">{label}</span>
      <span className={cn('font-medium text-gray-200', highlight && 'text-red-400 font-bold')}>{value}</span>
    </div>
  );
}
