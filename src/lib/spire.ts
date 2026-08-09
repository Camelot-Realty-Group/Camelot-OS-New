/**
 * Spire MDS client helper — Camelot's own property-management/accounting
 * backend (Resident Management, AP, GL, Work Orders). Covers only
 * buildings Camelot actively manages, not prospects. Credentials live
 * server-side only (SPIRE_MDS_API_KEY / SPIRE_MDS_CLIENT_SECRET in Render);
 * this file only ever talks to Camelot OS's own /api/spire/* proxy.
 */

import { authenticatedApiFetch } from '@/lib/api-auth';

export interface SpireBuildingMatch {
  matched: true;
  buildingName: string;
  address: string;
  unitsResidential: number;
  unitsCommercial: number;
  unitsTotal: number;
  block: string;
  lot: string;
  propertyManagerName: string;
  propertyManagerEmail: string;
}

/** Best-effort lookup — returns null on any failure, missing config, or no match. */
export async function lookupSpireManagedBuilding(address: string): Promise<SpireBuildingMatch | null> {
  if (!address) return null;
  if (String(import.meta.env.VITE_DISABLE_SERVER_INTEGRATIONS || '').toLowerCase() === 'true') return null;
  try {
    const res = await authenticatedApiFetch(`/api/spire/building-lookup?address=${encodeURIComponent(address)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.matched ? (data as SpireBuildingMatch) : null;
  } catch {
    return null;
  }
}
