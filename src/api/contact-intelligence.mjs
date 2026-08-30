/**
 * Contact Intelligence Service — unified contact enrichment across Camelot OS
 *
 * This service is the single source of truth for resolving property owner
 * contacts across all Camelot tools (Neighborhood Leads, Results, Pipeline,
 * Factory Engine, etc.). It enforces the owner-only policy: outbound email,
 * calls, and mailers ONLY target actual property owners (HeadOfficer,
 * CorporateOwner, IndividualOwner), never management companies.
 *
 * Data sources:
 *   HPD Multiple Dwelling Registrations     — tesw-yqqr
 *   HPD Registration Contacts               — feu5-w2e2
 *   DOB Permit Issuance (owner section)     — ipu4-2q9a
 *   NYS Secretary of State (future)         — LLC owner resolution
 *   Apollo.io (future)                      — enriched contact data
 *   Prospeo (future)                        — email verification
 *
 * OWNER-ONLY POLICY (per David, Aug 2026):
 *   Owner-side (safe to mail/call/email):   HeadOfficer, CorporateOwner, IndividualOwner
 *   NOT safe (reference only):              Agent (management company), SiteManager (super)
 *
 * Every enriched contact includes:
 *   is_owner_contact (boolean) — true ONLY if type is HeadOfficer/CorporateOwner/IndividualOwner
 *   contact_name — the person/entity name
 *   contact_type — the HPD type (HeadOfficer, CorporateOwner, IndividualOwner, Agent)
 *   contact_email — email address (from HPD or external enrichment)
 *   contact_phone — phone number (from HPD or external enrichment)
 *   contact_address — mailing address
 *   management_company — name of third-party management company (if Agent is present)
 *   agent_contact_name — name of Agent-type contact (reference only, never emailed)
 *   dob_owner_name — corroborating owner name from DOB Permit Issuance
 *   dob_owner_business_name — corroborating business name from DOB Permit Issuance
 *   confidence — data source confidence (hpd_owner, dob_owner, owner_name_only)
 */

/* global fetch, console */

const SOCRATA_BASE = 'https://data.cityofnewyork.us/resource';
const HPD_REG_DATASET = 'tesw-yqqr';
const HPD_CONTACTS_DATASET = 'feu5-w2e2';
const DOB_PERMIT_DATASET = 'ipu4-2q9a';

/** HPD contact types that represent the actual property owner/board side —
 * the ONLY types this pipeline will ever surface as an email-send target. */
const OWNER_SIDE_HPD_TYPES = new Set(['HeadOfficer', 'CorporateOwner', 'IndividualOwner']);

const BOROUGH_CODE_MAP = { MN: 1, BX: 2, BK: 3, QN: 4, SI: 5 };

async function socrataGet(dataset, params) {
  const qs = new URLSearchParams(params).toString();
  const url = `${SOCRATA_BASE}/${dataset}.json?${qs}`;
  const headers = {};
  if (process.env.NYC_OPEN_DATA_APP_TOKEN) headers['X-App-Token'] = process.env.NYC_OPEN_DATA_APP_TOKEN;
  const resp = await fetch(url, { headers });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Socrata ${dataset} request failed: ${resp.status} ${text.slice(0, 300)}`);
  }
  return resp.json();
}

/**
 * Enrich a single lead with HPD contacts, returning owner-verified contact info.
 * Returns an object with:
 *   is_owner_contact (boolean) — true only for HeadOfficer/CorporateOwner/IndividualOwner
 *   contact_name — primary contact person/entity
 *   contact_type — HPD contact type
 *   contact_email — email address (if available)
 *   contact_phone — phone number (if available)
 *   mailing_address — business mailing address
 *   management_company — third-party mgmt company name (Agent type)
 *   agent_contact_name — Agent contact name (reference only, never emailed)
 *   dob_owner_name — corroborating name from DOB Permit Issuance
 *   dob_filer_phone — filing agent phone from DOB (not owner's line)
 *   confidence — confidence level (hpd_owner, dob_owner, owner_name_only)
 */
export async function enrichContact(lead, options = {}) {
  const { withDobEnrichment = true } = options;
  const result = {
    is_owner_contact: false,
    contact_name: null,
    contact_type: null,
    contact_email: null,
    contact_phone: null,
    mailing_address: null,
    management_company: null,
    agent_contact_name: null,
    dob_owner_name: null,
    dob_owner_business_name: null,
    dob_filer_phone: null,
    confidence: 'owner_name_only',
  };

  if (!lead.block || !lead.lot || !lead.borough) {
    return result; // Can't look up without BBL components
  }

  const boroCode = BOROUGH_CODE_MAP[lead.borough];
  if (!boroCode) return result;

  try {
    // Step 1: Look up HPD registration
    const regRows = await socrataGet(HPD_REG_DATASET, {
      $select: 'registrationid,boroid,block,lot,lastregistrationdate',
      $where: `boroid=${boroCode} AND block=${Number(lead.block)} AND lot=${Number(lead.lot)}`,
      $limit: '1',
    });

    if (!Array.isArray(regRows) || regRows.length === 0) {
      return result; // No HPD registration
    }

    const reg = regRows[0];
    const regId = String(reg.registrationid);

    // Step 2: Look up HPD contacts for this registration
    const contactRows = await socrataGet(HPD_CONTACTS_DATASET, {
      $select: 'registrationid,type,firstname,lastname,corporationname,businesshousenumber,businessstreetname,businessapartment,businesscity,businessstate,businesszip',
      $where: `registrationid=${regId}`,
      $limit: '100',
    });

    if (!Array.isArray(contactRows) || contactRows.length === 0) {
      return result; // No contacts found
    }

    // Parse contacts by type
    const agent = contactRows.find((c) => c.type === 'Agent');
    const headOfficer = contactRows.find((c) => c.type === 'HeadOfficer');
    const corpOwner = contactRows.find((c) => c.type === 'CorporateOwner');
    const indivOwner = contactRows.find((c) => c.type === 'IndividualOwner');
    const siteManager = contactRows.find((c) => c.type === 'SiteManager');

    // Owner priority: HeadOfficer > CorporateOwner > IndividualOwner
    const ownerContact = headOfficer || corpOwner || indivOwner || null;

    if (ownerContact) {
      const personName = [ownerContact.firstname, ownerContact.lastname]
        .filter(Boolean)
        .join(' ')
        .trim();
      result.contact_name = personName || ownerContact.corporationname || null;
      result.contact_type = ownerContact.type;
      result.is_owner_contact = OWNER_SIDE_HPD_TYPES.has(ownerContact.type);
      result.confidence = 'hpd_owner';

      // Mailing address
      const mailingParts = [
        ownerContact.businesshousenumber,
        ownerContact.businessstreetname,
      ]
        .filter(Boolean)
        .join(' ');
      result.mailing_address = [mailingParts, ownerContact.businessapartment]
        .filter(Boolean)
        .join(', ') || null;
    }

    // Capture Agent (management company) separately — never as primary email target
    if (agent) {
      result.management_company = agent.corporationname || null;
      result.agent_contact_name = [agent.firstname, agent.lastname]
        .filter(Boolean)
        .join(' ')
        .trim() || agent.corporationname || null;

      // If no owner-side contact, surface the agent contact but flag is_owner_contact=false
      if (!ownerContact) {
        result.contact_name = result.agent_contact_name;
        result.contact_type = 'Agent';
        result.confidence = 'agent_only';
      }
    }

    // Capture super as reference (closest proxy to superintendent in public data)
    if (siteManager) {
      const superName = [siteManager.firstname, siteManager.lastname]
        .filter(Boolean)
        .join(' ')
        .trim() || siteManager.corporationname;
      // Store for reference if needed; don't use as primary contact
    }
  } catch (err) {
    console.error('[ContactIntelligence] HPD lookup failed:', err.message);
  }

  // Step 3: (Optional) Enrich with DOB Permit Issuance for corroborating owner data
  if (withDobEnrichment) {
    try {
      const dobRows = await socrataGet(DOB_PERMIT_DATASET, {
        $select: 'owner_s_first_name,owner_s_last_name,owner_s_business_name,owner_s_business_type,permittee_s_phone__',
        $where: `block=${Number(lead.block)} AND lot=${Number(lead.lot)}`,
        $limit: '1',
      });

      if (Array.isArray(dobRows) && dobRows.length > 0) {
        const dob = dobRows[0];
        result.dob_owner_name = [dob.owner_s_first_name, dob.owner_s_last_name]
          .filter(Boolean)
          .join(' ')
          .trim() || dob.owner_s_business_name || null;
        result.dob_owner_business_name = dob.owner_s_business_name || null;
        result.dob_filer_phone = dob.permittee_s_phone__ || null; // Filing agent, not owner

        // If HPD had no owner-side contact but DOB has owner data, use DOB as confidence signal
        if (!result.is_owner_contact && result.dob_owner_name) {
          result.confidence = 'dob_owner_fallback';
        }
      }
    } catch (err) {
      console.error('[ContactIntelligence] DOB enrichment failed:', err.message);
    }
  }

  return result;
}

/**
 * Enrich multiple leads in batch.
 * Filters to owner-verified contacts only (is_owner_contact=true).
 */
export async function enrichContactsBatch(leads, options = {}) {
  const { batchSize = 25, onProgress, ownerOnly = true } = options;
  const results = [];

  for (let i = 0; i < leads.length; i++) {
    try {
      const enriched = await enrichContact(leads[i], options);
      if (!ownerOnly || enriched.is_owner_contact) {
        results.push({
          ...leads[i],
          ...enriched,
        });
      }
      if (onProgress) onProgress({ current: i + 1, total: leads.length });
    } catch (err) {
      console.error(`[ContactIntelligence] Failed to enrich lead ${i}:`, err.message);
      if (!ownerOnly) {
        results.push({
          ...leads[i],
          is_owner_contact: false,
          confidence: 'error',
        });
      }
    }
  }

  return results;
}

/**
 * Utility: Check if a contact is safe to mail/call/email.
 * Returns true only if is_owner_contact=true.
 */
export function isSafeToOutreach(contact) {
  return contact.is_owner_contact === true;
}

/**
 * Utility: Get display name for contact (prefers formatted name, falls back to company).
 */
export function getContactDisplayName(contact) {
  return contact.contact_name || contact.management_company || 'Unknown Contact';
}

/**
 * Utility: Get safety badge label (owner vs. management company).
 */
export function getContactSafetyLabel(contact) {
  if (contact.is_owner_contact) {
    return `${contact.contact_type || 'Owner'} (Safe to mail)`;
  }
  if (contact.management_company) {
    return `${contact.management_company} (DO NOT MAIL)`;
  }
  return 'Contact status unknown';
}
