/**
 * Contact Enrichment — Apollo.io and Prospeo integration
 */

import type { Contact } from '@/types';
import { authenticatedApiFetch } from '@/lib/api-auth';

/**
 * Call an Apollo search endpoint. Prefers the same-origin server proxy
 * (/api/apollo/org-search | people-search), which uses the SERVER-side
 * APOLLO_API_KEY configured in Render — so enrichment works in production
 * with no key in the browser bundle. Returns null when the authenticated
 * server proxy is unavailable.
 */
async function apolloSearch(
  proxyPath: 'org-search' | 'people-search',
  _directPath: string,
  body: Record<string, unknown>,
): Promise<any | null> {
  // 1. Server proxy (production runtime)
  try {
    const res = await authenticatedApiFetch(`/api/apollo/${proxyPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) return await res.json();
    return null;
    // 400 = server has no key; 404 = old server build — fall through
  } catch {
    // static hosting / dev without server — fall through to direct
  }
  // 2. Direct with browser key (dev)
  return null;
}

/**
 * Search for contacts associated with a building/company via Apollo.io
 */
export async function enrichWithApollo(params: {
  companyName?: string;
  address?: string;
  domain?: string;
}): Promise<Contact[]> {
  try {
    // Search for organization first
    const orgData = await apolloSearch('org-search', '/organizations/search', {
      q_organization_name: params.companyName || params.address,
      page: 1,
      per_page: 5,
    });
    if (!orgData) {
      console.warn('Apollo enrichment unavailable through the authenticated server proxy.');
      return [];
    }
    const org = orgData.organizations?.[0];
    if (!org) return [];

    // Search for people at the organization
    const peopleData = await apolloSearch('people-search', '/people/search', {
      q_organization_id: org.id,
      page: 1,
      per_page: 25,
      person_titles: [
        'board president',
        'president',
        'treasurer',
        'secretary',
        'board member',
        'director',
        'property manager',
        'managing agent',
        'superintendent',
        'owner',
        'principal',
      ],
    });
    if (!peopleData) return [];
    return (peopleData.people || []).map((p: any) => ({
      name: `${p.first_name} ${p.last_name}`,
      role: p.title || 'Unknown',
      email: p.email,
      phone: p.phone_numbers?.[0]?.sanitized_number,
      linkedin: p.linkedin_url,
      source: 'apollo',
      verified_at: new Date().toISOString(),
    }));
  } catch (err) {
    console.error('Apollo enrichment error:', err);
    return [];
  }
}

/**
 * Verify/find email via Prospeo
 */
export async function enrichWithProspeo(params: {
  firstName?: string;
  lastName?: string;
  company?: string;
  domain?: string;
}): Promise<{ email?: string; phone?: string }> {
  try {
    const res = await authenticatedApiFetch('/api/prospeo/find-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first_name: params.firstName,
        last_name: params.lastName,
        company_name: params.company,
        domain: params.domain,
      }),
    });

    if (!res.ok) return {};
    const data = await res.json();
    return {
      email: data.email,
      phone: data.phone,
    };
  } catch (err) {
    console.error('Prospeo enrichment error:', err);
    return {};
  }
}

/**
 * Enrich a building's contacts by trying Apollo first, then Prospeo fallback
 */
export async function enrichBuildingContacts(params: {
  buildingName?: string;
  address: string;
  currentManagement?: string;
}): Promise<Contact[]> {
  // Try Apollo first
  let contacts = await enrichWithApollo({
    companyName: params.currentManagement || params.buildingName,
    address: params.address,
  });

  // For each contact without email, try Prospeo
  for (const contact of contacts) {
    if (!contact.email && contact.name) {
      const [firstName, ...lastParts] = contact.name.split(' ');
      const lastName = lastParts.join(' ');
      if (firstName && lastName) {
        const prospeoResult = await enrichWithProspeo({
          firstName,
          lastName,
          company: params.currentManagement || params.buildingName,
        });
        if (prospeoResult.email) contact.email = prospeoResult.email;
        if (prospeoResult.phone && !contact.phone) contact.phone = prospeoResult.phone;
      }
    }
  }

  return contacts;
}

/**
 * Check if enrichment APIs are configured
 */
export function isEnrichmentConfigured(): { apollo: boolean; prospeo: boolean } {
  const serverRuntime = String(import.meta.env.VITE_RUNTIME_MODE || '').toLowerCase() === 'server';
  return {
    apollo: serverRuntime,
    prospeo: serverRuntime,
  };
}
