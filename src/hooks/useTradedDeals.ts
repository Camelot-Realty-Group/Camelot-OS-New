import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { authenticatedApiFetch } from '@/lib/api-auth';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { scoreLead } from '@/lib/marketing-engine';

export type TradedContactSide = 'buyer' | 'seller';
export type TradedCampaignStatus = 'new' | 'qualified' | 'enriching' | 'ready' | 'synced' | 'nurture' | 'suppressed' | 'converted';

export interface TradedDeal {
  id: string;
  address: string;
  borough: string;
  dealType: string;
  price: string;
  units: number;
  saleDate: string | null;
  broker: string;
  sourceUrl: string;
  notes: string;
  score: number;
  buyerName: string;
  buyerCompany: string;
  buyerEmail: string | null;
  buyerPhone: string | null;
  sellerName: string;
  sellerCompany: string;
  sellerEmail: string | null;
  sellerPhone: string | null;
  enrichedAt: string | null;
  enrichmentSource: string | null;
  hubspotSyncedAt: string | null;
  hubspotContactId: string | null;
  hubspotCompanyId: string | null;
  hubspotDealId: string | null;
  hubspotSyncError: string | null;
  campaignStatus: TradedCampaignStatus;
  outreachEligible: boolean;
  doNotContact: boolean;
  contactSource: string;
  ingestionSource: 'manual' | 'traded_co_feed' | 'csv_import';
  createdAt: string;
}

export type NewTradedDealInput = {
  address: string;
  borough: string;
  dealType: string;
  price: string;
  units: number;
  buyerName: string;
  buyerCompany: string;
  sellerName: string;
  sellerCompany: string;
  broker: string;
  sourceUrl: string;
  notes: string;
};

function mapRow(row: Record<string, any>): TradedDeal {
  return {
    id: row.id,
    address: row.address ?? '',
    borough: row.borough ?? '',
    dealType: row.deal_type ?? '',
    price: row.price ?? '',
    units: row.units ?? 0,
    saleDate: row.sale_date ?? null,
    broker: row.broker ?? '',
    sourceUrl: row.source_url ?? '',
    notes: row.notes ?? '',
    score: row.score ?? 0,
    buyerName: row.buyer_name ?? '',
    buyerCompany: row.buyer_company ?? '',
    buyerEmail: row.buyer_email ?? null,
    buyerPhone: row.buyer_phone ?? null,
    sellerName: row.seller_name ?? '',
    sellerCompany: row.seller_company ?? '',
    sellerEmail: row.seller_email ?? null,
    sellerPhone: row.seller_phone ?? null,
    enrichedAt: row.enriched_at ?? null,
    enrichmentSource: row.enrichment_source ?? null,
    hubspotSyncedAt: row.hubspot_synced_at ?? null,
    hubspotContactId: row.hubspot_contact_id ?? null,
    hubspotCompanyId: row.hubspot_company_id ?? null,
    hubspotDealId: row.hubspot_deal_id ?? null,
    hubspotSyncError: row.hubspot_sync_error ?? null,
    campaignStatus: row.campaign_status ?? 'new',
    outreachEligible: Boolean(row.outreach_eligible),
    doNotContact: Boolean(row.do_not_contact),
    contactSource: row.contact_source ?? 'Traded NY (manual)',
    ingestionSource: row.ingestion_source ?? 'manual',
    createdAt: row.created_at,
  };
}

function contactFor(deal: TradedDeal, side: TradedContactSide) {
  return side === 'buyer'
    ? { name: deal.buyerName, company: deal.buyerCompany, email: deal.buyerEmail, phone: deal.buyerPhone }
    : { name: deal.sellerName, company: deal.sellerCompany, email: deal.sellerEmail, phone: deal.sellerPhone };
}

function parseName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') };
}

function normalizeSourceUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported protocol');
    return url.toString();
  } catch {
    throw new Error('Source link must be a valid http(s) URL.');
  }
}

function extractApolloPerson(payload: any) {
  const person = payload?.person || payload?.people?.[0] || payload?.matches?.[0];
  if (!person) return null;
  const email = person.email || person.email_address || person?.contact?.email || null;
  const phone = person.phone_number || person.phone || person?.phone_numbers?.[0]?.sanitized_number || person?.phone_numbers?.[0]?.raw_number || null;
  return { email, phone, linkedin: person.linkedin_url || null };
}

export function useTradedDeals() {
  const [deals, setDeals] = useState<TradedDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!isSupabaseConfigured()) throw new Error('Configure Supabase in Render to use Traded NY.');
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error('Sign in to view the shared Traded NY pipeline.');
      const { data, error: queryError } = await supabase.from('traded_deals').select('*').order('created_at', { ascending: false });
      if (queryError) throw queryError;
      setDeals((data ?? []).map(mapRow));
    } catch (err) {
      setDeals([]);
      setError(err instanceof Error ? err.message : 'Could not load Traded NY deals.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const addDeal = useCallback(async (input: NewTradedDealInput) => {
    if (!input.address.trim()) { toast.error('Property address required'); return false; }
    if (!isSupabaseConfigured()) { toast.error('Live database not configured.'); return false; }
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) { toast.error('Sign in before saving a deal.'); return false; }

    let sourceUrl: string | null;
    try { sourceUrl = normalizeSourceUrl(input.sourceUrl); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Invalid source link.'); return false; }

    const { score } = scoreLead({
      hasComplianceTrigger: /receivership|distress/i.test(input.dealType),
      hasDecisionMakerContact: Boolean(input.buyerName.trim() || input.sellerName.trim()),
      unitCount: input.units,
      inCoverageArea: true,
      serviceFit: input.units >= 5,
      hasTimingSignal: /sold|contract|1031|foreign/i.test(input.dealType),
      hasReferralOrRelationship: Boolean(input.broker.trim()),
    });
    const row = {
      address: input.address.trim(), borough: input.borough, deal_type: input.dealType,
      price: input.price.trim() || null, units: input.units || 0,
      buyer_name: input.buyerName.trim() || null, buyer_company: input.buyerCompany.trim() || null,
      seller_name: input.sellerName.trim() || null, seller_company: input.sellerCompany.trim() || null,
      broker: input.broker.trim() || null, source_url: sourceUrl,
      notes: input.notes.trim() || null, score,
      campaign_status: score >= 60 ? 'qualified' : 'new', contact_source: 'Traded NY (manual)',
      ingestion_source: 'manual', created_by: authData.user.id,
    };
    try {
      const { data, error: insertError } = await supabase.from('traded_deals').insert(row).select('*').single();
      if (insertError) throw insertError;
      setDeals((current) => [mapRow(data), ...current]);
      toast.success(`Tracked — lead score ${score}/100`);
      return true;
    } catch (err: any) {
      toast.error(err?.code === '23505' ? 'This Traded NY source link is already tracked.' : 'Could not save this deal.');
      return false;
    }
  }, []);

  const updateDeal = useCallback(async (id: string, patch: Record<string, unknown>) => {
    const { data, error: updateError } = await supabase.from('traded_deals').update(patch).eq('id', id).select('*').single();
    if (updateError) throw updateError;
    const mapped = mapRow(data);
    setDeals((current) => current.map((deal) => deal.id === id ? mapped : deal));
    return mapped;
  }, []);

  const removeDeal = useCallback(async (id: string) => {
    const previous = deals;
    setDeals((current) => current.filter((deal) => deal.id !== id));
    const { error: deleteError } = await supabase.from('traded_deals').delete().eq('id', id);
    if (deleteError) { setDeals(previous); toast.error('Could not delete this deal.'); }
  }, [deals]);

  const setEligibility = useCallback(async (id: string, eligible: boolean) => {
    try {
      await updateDeal(id, {
        outreach_eligible: eligible,
        do_not_contact: !eligible,
        campaign_status: eligible ? 'qualified' : 'suppressed',
      });
      toast.success(eligible ? 'Approved for outreach.' : 'Lead suppressed from outreach.');
    } catch { toast.error('Could not update outreach eligibility.'); }
  }, [updateDeal]);

  const enrichDeal = useCallback(async (id: string, side: TradedContactSide = 'buyer') => {
    const deal = deals.find((item) => item.id === id);
    if (!deal) return;
    const contact = contactFor(deal, side);
    if (!contact.name && !contact.company) { toast.error(`Add a ${side} name or company first.`); return; }
    setBusyId(id);
    try {
      await updateDeal(id, { campaign_status: 'enriching', hubspot_sync_error: null });
      const name = parseName(contact.name);
      const response = await authenticatedApiFetch('/api/apollo/enrich', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ first_name: name.firstName, last_name: name.lastName, organization_name: contact.company }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || payload.message || `Enrichment failed (${response.status})`);
      const enriched = extractApolloPerson(payload);
      if (!enriched?.email && !enriched?.phone) throw new Error('Apollo returned no verified email or phone.');
      const prefix = side === 'buyer' ? 'buyer' : 'seller';
      await updateDeal(id, {
        [`${prefix}_email`]: enriched.email,
        [`${prefix}_phone`]: enriched.phone,
        [`${prefix}_linkedin`]: enriched.linkedin,
        enriched_at: new Date().toISOString(), enrichment_source: 'apollo',
        campaign_status: enriched.email ? 'ready' : 'qualified',
      });
      toast.success(`${side === 'buyer' ? 'Buyer' : 'Seller'} contact enriched.`);
    } catch (err) {
      await updateDeal(id, { campaign_status: deal.campaignStatus, hubspot_sync_error: err instanceof Error ? err.message : 'Enrichment failed' }).catch(() => undefined);
      toast.error(err instanceof Error ? err.message : 'Contact enrichment failed.');
    } finally { setBusyId(null); }
  }, [deals, updateDeal]);

  const syncHubSpot = useCallback(async (id: string, side: TradedContactSide = 'buyer') => {
    const deal = deals.find((item) => item.id === id);
    if (!deal) return;
    if (deal.doNotContact) { toast.error('This lead is suppressed. Approve outreach before CRM handoff.'); return; }
    const contact = contactFor(deal, side);
    setBusyId(id);
    try {
      const response = await authenticatedApiFetch('/api/integrations/push-building', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          building: {
            id: `traded-ny:${deal.id}`, name: contact.company || deal.address,
            address: deal.address, borough: deal.borough, units: deal.units,
            type: 'Multifamily', score: deal.score,
            signals: [`Traded NY ${deal.dealType}`, deal.price, deal.broker ? `Broker: ${deal.broker}` : ''].filter(Boolean),
          },
          contact: contact.name || contact.email ? {
            name: contact.name, email: contact.email || undefined, phone: contact.phone || undefined,
            company: contact.company, role: side === 'buyer' ? 'New owner / buyer' : 'Seller',
            source: deal.contactSource,
          } : undefined,
          quality: {
            score: deal.score, tier: deal.score >= 76 ? 'hot' : deal.score >= 55 ? 'warm' : 'cold',
            missingFields: contact.email ? [] : ['verified email contact'], strengths: [`Traded NY ${deal.dealType}`], warnings: [],
          },
          routing: {
            team: deal.score >= 76 ? 'David / Jackie priority desk' : 'Scout outreach team',
            region: deal.borough, priority: deal.score >= 76 ? 'same-day' : '24-48 hours',
            tags: ['source:traded-ny', `deal:${deal.dealType.toLowerCase().replace(/\s+/g, '-')}`],
          },
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.hubspot?.status === 'error') throw new Error(payload?.hubspot?.message || payload?.error || 'HubSpot sync failed.');
      if (payload?.hubspot?.status !== 'ok') throw new Error(payload?.hubspot?.message || 'HubSpot did not accept this lead.');
      await updateDeal(id, {
        hubspot_synced_at: new Date().toISOString(), hubspot_contact_id: payload.hubspot.contactId || null,
        hubspot_company_id: payload.hubspot.companyId || null, hubspot_deal_id: payload.hubspot.dealId || null,
        hubspot_sync_error: null, campaign_status: 'synced',
      });
      toast.success(payload.hubspot.message || 'Saved to HubSpot.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'HubSpot sync failed.';
      await updateDeal(id, { hubspot_sync_error: message }).catch(() => undefined);
      toast.error(message);
    } finally { setBusyId(null); }
  }, [deals, updateDeal]);

  return { deals, loading, error, busyId, reload, addDeal, removeDeal, setEligibility, enrichDeal, syncHubSpot };
}
