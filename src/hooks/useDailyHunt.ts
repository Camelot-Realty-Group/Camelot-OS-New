import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { reportBotActivityToHubSpot } from '@/lib/bot-hubspot-reporting';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { useBuildings } from '@/hooks/useBuildings';
import type { PipelineStage } from '@/types';

export type LeadPriority = 'HIGH' | 'MEDIUM' | 'LOW';

export interface DailyHuntLead {
  id: string;
  name: string;
  address: string;
  city?: string | null;
  state?: string | null;
  unit_count?: number | null;
  lead_source?: string | null;
  lead_category?: string | null;
  lead_priority?: LeadPriority | null;
  lead_pitch_angle?: string | null;
  lead_contact_path?: string | null;
  lead_source_url?: string | null;
  lead_found_at?: string | null;
  developer_or_owner?: string | null;
  status?: string | null;
  verification_status?: 'VERIFIED' | 'CORRECTED' | 'UNVERIFIED' | null;
  verified_sources?: Array<{ label?: string; url?: string; checked_at?: string }>;
  corrections?: Array<{ field: string; from?: string | number | null; to?: string | number | null; reason?: string }>;
  source_mode: 'supabase';
}

export interface LeadHuntRun {
  id: string;
  started_at: string;
  finished_at: string | null;
  triggered_by: string;
  sources_queried: string[];
  candidates_found: number;
  new_leads_inserted: number;
  duplicates_skipped: number;
  rejected_count?: number;
  corrected_count?: number;
  errors?: Array<{ source: string; message: string }>;
}

type FilterState = {
  priority: LeadPriority | 'ALL';
  category: string;
  geo: string;
  daysBack: number;
};

const stateFromAddress = (address: string) => {
  if (/\bFL\b|Florida|Miami|Palm Beach|Broward/i.test(address)) return 'FL';
  if (/\bNJ\b|New Jersey/i.test(address)) return 'NJ';
  if (/\bCT\b|Connecticut|Fairfield|Stamford|Greenwich/i.test(address)) return 'CT';
  return 'NY';
};

const shouldUseServerDailyHunt = () =>
  String(import.meta.env.VITE_ENABLE_SERVER_INTEGRATIONS || '').toLowerCase() === 'true' &&
  String(import.meta.env.VITE_DISABLE_SERVER_INTEGRATIONS || '').toLowerCase() !== 'true';

export function useDailyHunt() {
  const [leads, setLeads] = useState<DailyHuntLead[]>([]);
  const [runs, setRuns] = useState<LeadHuntRun[]>([]);
  const [latestRun, setLatestRun] = useState<LeadHuntRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [selectedLead, setSelectedLead] = useState<DailyHuntLead | null>(null);
  const [filter, setFilter] = useState<FilterState>({
    priority: 'ALL',
    category: 'ALL',
    geo: 'ALL',
    daysBack: 7,
  });
  const { moveToPipeline, archiveBuilding } = useBuildings();

  const applyFilters = useCallback((items: DailyHuntLead[]) => {
    const since = Date.now() - filter.daysBack * 86_400_000;
    return items.filter((lead) => {
      if (filter.priority !== 'ALL' && lead.lead_priority !== filter.priority) return false;
      if (filter.category !== 'ALL' && lead.lead_category !== filter.category) return false;
      if (filter.geo !== 'ALL' && lead.state !== filter.geo) return false;
      if (lead.lead_found_at && new Date(lead.lead_found_at).getTime() < since) return false;
      return true;
    });
  }, [filter]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!isSupabaseConfigured()) {
        setError('Daily Hunt requires live Supabase data. No offline research packet, demo, or sandbox leads are being shown.');
        setLeads([]);
        setRuns([]);
        setLatestRun(null);
        return;
      }

      const sinceIso = new Date(Date.now() - filter.daysBack * 86_400_000).toISOString();
      let query = supabase
        .from('scout_buildings')
        .select('*')
        .not('lead_source', 'is', null)
        .gte('lead_found_at', sinceIso)
        .order('lead_found_at', { ascending: false });

      if (filter.priority !== 'ALL') query = query.eq('lead_priority', filter.priority);
      if (filter.category !== 'ALL') query = query.eq('lead_category', filter.category);

      const { data, error } = await query;
      if (error) throw error;
      const mapped: DailyHuntLead[] = (data ?? []).map((row: any) => ({
        id: row.id,
        name: row.name ?? row.address ?? 'Untitled lead',
        address: row.address ?? '',
        city: row.city ?? null,
        state: row.state ?? stateFromAddress(row.address ?? ''),
        unit_count: row.units ?? row.unit_count ?? null,
        lead_source: row.lead_source,
        lead_category: row.lead_category,
        lead_priority: row.lead_priority,
        lead_pitch_angle: row.lead_pitch_angle,
        lead_contact_path: row.lead_contact_path,
        lead_source_url: row.lead_source_url,
        lead_found_at: row.lead_found_at,
        developer_or_owner: row.current_management ?? row.dof_owner ?? null,
        status: row.status,
        verification_status: row.verification_status,
        verified_sources: row.verified_sources ?? [],
        corrections: row.corrections ?? [],
        source_mode: 'supabase',
      }));
      setLeads(filter.geo === 'ALL' ? mapped : mapped.filter((lead) => lead.state === filter.geo));

      const { data: runRows } = await supabase
        .from('lead_hunt_runs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(14);
      setRuns((runRows ?? []) as LeadHuntRun[]);
      setLatestRun(((runRows ?? [])[0] ?? null) as LeadHuntRun | null);
    } catch (error: any) {
      console.warn('Daily Hunt Supabase load failed; live queue blocked.', error?.message || error);
      setError(`Daily Hunt live data blocked: ${error?.message || 'Supabase query failed'}`);
      setLeads([]);
      setRuns([]);
      setLatestRun(null);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    reload();
  }, [reload]);

  const pushToPipeline = useCallback(async (lead: DailyHuntLead, stage: PipelineStage = 'contacted') => {
    if (isSupabaseConfigured() && lead.source_mode === 'supabase') {
      await moveToPipeline(lead.id, stage);
    }
    void reportBotActivityToHubSpot({
      botId: 'dailyhunt',
      botName: 'Daily Hunt Lead Verifier',
      action: 'pipeline_added',
      source: lead.lead_source || 'Daily Hunt',
      pipelineStage: stage,
      building: {
        id: lead.id,
        name: lead.name,
        address: lead.address,
        borough: lead.state === 'NY' ? 'NY' : lead.state || undefined,
        region: lead.city || lead.state || undefined,
        units: lead.unit_count || undefined,
        type: 'other',
        current_management: lead.developer_or_owner || undefined,
        source: lead.lead_source || 'Daily Hunt',
        status: 'active',
        grade: lead.lead_priority === 'HIGH' ? 'A' : lead.lead_priority === 'MEDIUM' ? 'B' : 'C',
        score: lead.lead_priority === 'HIGH' ? 82 : lead.lead_priority === 'MEDIUM' ? 64 : 42,
        signals: [lead.lead_pitch_angle, lead.lead_contact_path, lead.lead_category].filter(Boolean) as string[],
        tags: ['daily-hunt', `priority:${lead.lead_priority || 'review'}`, `category:${lead.lead_category || 'unknown'}`],
        pipeline_stage: stage,
        violations_count: 0,
        open_violations_count: 0,
        contacts: [],
        enriched_data: {
          lead_source_url: lead.lead_source_url,
          verification_status: lead.verification_status,
          verified_sources: lead.verified_sources,
          corrections: lead.corrections,
        },
        created_at: lead.lead_found_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      notes: `${lead.lead_pitch_angle || ''} ${lead.lead_contact_path || ''}`.trim(),
    });
    setLeads((prev) => prev.filter((item) => item.id !== lead.id));
    toast.success(`${lead.name} pushed to Pipeline`);
  }, [moveToPipeline]);

  const dismiss = useCallback(async (lead: DailyHuntLead) => {
    if (isSupabaseConfigured() && lead.source_mode === 'supabase') {
      await archiveBuilding(lead.id, 'Dismissed from Daily Hunt');
    }
    setLeads((prev) => prev.filter((item) => item.id !== lead.id));
    toast.success(`${lead.name} dismissed`);
  }, [archiveBuilding]);

  const runNow = useCallback(async () => {
    setRunning(true);
    try {
      if (!isSupabaseConfigured()) {
        toast.error('Daily Hunt requires live Supabase data. No sandbox or imported export will be used.');
        return;
      }

      let response: Response;
      if (shouldUseServerDailyHunt()) {
        response = await fetch('/api/daily-hunt/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ triggered_by: 'manual_ui' }),
        });
      } else {
        const { data: { session } } = await supabase.auth.getSession();
        response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/daily-hunt-run`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ triggered_by: 'manual_ui' }),
        });
      }

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || `Daily Hunt failed: ${response.status}`);
      await reload();
      if (payload.status === 'fallback') {
        toast.error(payload.message || 'Daily Hunt backend is not deployed. Live queue was not refreshed.');
      } else {
        toast.success(payload.message || 'Daily Hunt run started');
      }
    } catch (error: any) {
      console.warn('Daily Hunt run failed; live queue blocked.', error?.message || error);
      await reload();
      toast.error('Daily Hunt backend is unavailable. No sandbox or imported queue will be used.');
    } finally {
      setRunning(false);
    }
  }, [reload]);

  const stats = useMemo(() => {
    const out = {
      total: leads.length,
      high: 0,
      medium: 0,
      low: 0,
      verified: 0,
      corrected: 0,
      rejected: latestRun?.rejected_count ?? 0,
      byCategory: {} as Record<string, number>,
      byGeo: {} as Record<string, number>,
    };
    for (const lead of leads) {
      if (lead.lead_priority === 'HIGH') out.high += 1;
      if (lead.lead_priority === 'MEDIUM') out.medium += 1;
      if (lead.lead_priority === 'LOW') out.low += 1;
      if (lead.verification_status === 'VERIFIED') out.verified += 1;
      if (lead.verification_status === 'CORRECTED') out.corrected += 1;
      if (lead.lead_category) out.byCategory[lead.lead_category] = (out.byCategory[lead.lead_category] ?? 0) + 1;
      if (lead.state) out.byGeo[lead.state] = (out.byGeo[lead.state] ?? 0) + 1;
    }
    return out;
  }, [latestRun?.rejected_count, leads]);

  return {
    leads,
    runs,
    latestRun,
    error,
    loading,
    running,
    filter,
    setFilter,
    selectedLead,
    setSelectedLead,
    reload,
    runNow,
    pushToPipeline,
    dismiss,
    stats,
  };
}
