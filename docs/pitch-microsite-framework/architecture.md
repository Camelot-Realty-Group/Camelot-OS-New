# Camelot Proposal OS — Architecture

## Data schema (single source of truth per prospect instance)

```
Prospect
├── prospect_id, created_at, status (draft | sent | under_review | signed | archived)
├── property
│   ├── name, address, alt_addresses[], borough, year_built, unit_count_total
│   ├── entities[] — { name, type (condo|coop|hoa|uoa|rental), unit_count, unit_count_confirmed: bool }
│   ├── photos[] — { url, caption, is_public: bool, source (upload|street_view|listing) }
│   └── public_facts[] / verified_facts[] / client_provided_facts[]  — each tagged with provenance
├── client
│   ├── contact_name, contact_title, contact_email, contact_phone
│   └── board_members[] — optional, names only if provided
├── pain_points[] — { text, source: "board" | "camelot_diagnostic" }
├── team[] — { role, person_name, commitment_text }
├── pricing
│   ├── model (per_unit | flat | tiered), rate, entity_allocation[]
│   ├── escalator_pct, escalator_start
│   └── meeting_policy — { included_per_month, additional_fee }
├── ancillary_rate_sheet[] — { service, fee_or_rule, payer }
├── transition_plan[] — { phase, days_range, actions[], deliverable }
├── technology_stack — { accounting_system, resident_portal, automation_layer, legacy_system_handling }
├── documents_confidential[] — { file, category, uploaded_at, visible_to_roles[] }
├── documents_public[] — { file, category }
├── proposal_doc — generated Proposal.docx/.pdf reference + version
├── agreement_doc — generated Management_Agreement.docx/.pdf reference + version
├── acceptance
│   ├── status (not_sent | viewed | accepted | declined)
│   └── signatures[] — { entity_represented, signer_name, signer_title, signer_email, signed_at, ip_captured }
└── to_be_confirmed[] — explicit list of unresolved facts, rendered visibly wherever referenced
```

Every page and every generated document reads from this one record. A fact changes once; the site and both documents regenerate from it.

## Information architecture — 14 sections

1. **Hero** — property name, one-line positioning statement (e.g. "WEEKLY EYES. THREE CLEAN BOOKS. ONE ACCOUNTABLE TEAM."), CTA to the proposal
2. **What We Heard** — the board's own pain points, verbatim where possible, to demonstrate listening before pitching
3. **The Camelot Solution** — weekly physical management, dedicated team, facilities oversight, accounting, technology, board reporting, cost reduction — mapped 1:1 against section 2's pain points
4. **Your Dedicated Team** — bios/cards for the PM, facilities manager, accounting manager, CPA access, executive sponsor
5. **Weekly On-Site Management** — visual workflow of what a site visit actually includes
6. **Financial Reporting** — mock dashboard + sample MDS-style monthly package, clearly labeled as illustrative/mockup, not real client data
7. **Camelot OS** — the automation/analytics/cost-benchmarking story
8. **Resident Experience** — Concierge Plus, rebranded per-community where the product supports it
9. **Cost Optimization** — the benchmarking and shared-savings workflow, with the "separate written agreement" disclaimer front and center
10. **Transition** — interactive 60–90 day timeline
11. **Management Proposal** — expandable on-page view + Word/PDF download
12. **Management Agreement** — on-page review + Word/PDF download + acceptance/signature capture
13. **Supporting Documents** — access-gated board portal (sample reports, budgets, agendas, insurance certs, references, transition checklist, ancillary fee schedule)
14. **Next Step** — schedule a meeting / approve proposal / download documents / contact Camelot

## Admin / content upload workflow

- Authorized Camelot users (not the board/client) can upload: JPG/PNG/WebP/PDF/DOCX/TXT — property reports, photos, logos, marketing copy, board documents, budgets, management reports.
- Every upload is categorized at upload time as **public** or **board-confidential** — default to confidential; an explicit action is required to mark something public. Never infer public-safe from file type alone.
- Uploaded financial/board documents never appear on public routes regardless of how they're stored — enforce this at the API/route layer, not just in the UI.

## Security / permissions model

- Public marketing pages (sections 1–10, and the top-level view of 11/12): no auth required, but confidential fields render as `TO BE CONFIRMED` or are omitted, never partially exposed.
- Section 13 (Supporting Documents) and any board-confidential upload: password-protected or tokenized per-prospect link. A shared site-wide password is not sufficient once more than one board/entity needs access — prefer per-recipient tokenized links so access can be revoked individually.
- Signed agreements and financial documents are stored with the same confidentiality tier as the source uploads.

## Document generation architecture

- One templating layer consumes the Prospect data model and produces `Proposal.docx`, `Proposal.pdf`, `Management_Agreement.docx`, `Management_Agreement.pdf`.
- Use `python-docx` to populate a base template (mirroring the uploaded `Camelot_Proposal_of_Services_Template.docx` and the property-specific management agreement structure) and a docx→pdf conversion step (LibreOffice headless, or an equivalent renderer) so both formats stay pixel-consistent.
- See `document-design-standard.md` for the exact letterhead/typography/section spec these documents must follow.
- Regenerating a document after a data change must not require manual re-editing of the docx — the template + data model produces the same output deterministically.

## E-signature / acceptance architecture

- Capture, at minimum: entity represented, signer name, title, email, date, and a signature artifact (typed name is an acceptable v1; a drawn/uploaded signature image is a nicer v2).
- Architect the acceptance record as its own object so a future real e-signature provider (DocuSign, Dropbox Sign, Adobe Acrobat Sign) can be wired in without changing the data model — the acceptance record already has everywhere a provider would need to attach an envelope ID and signed document hash.
- **Never claim this in-house capture mechanism is legally equivalent to a compliant e-signature provider** in any user-facing copy — disclose that proper e-signature requires provider integration and, where relevant, legal review for the applicable jurisdiction.

## Reusability contract (CMS layer)

"Create New Proposal" should require only: prospect name, property, address, unit count, property type, boards/entities, price, pain points, team, photos, uploaded documents — and produce a new branded instance following the same 14-section structure, the same document design standard, and the same security model. Oak Park is Template #1; every later instance is validated against it structurally (same sections, same data model shape), not copy-pasted with a new logo.

## Long-term pipeline

Lead → Research → Custom Microsite → Pitch Deck → Proposal → Agreement → Signature → Transition → Client. This skill covers Research through Agreement/Signature. Transition-phase tooling (the actual onboarding checklists once signed) can reuse the same Prospect record but is a distinct workflow — flag to David if a transition-phase build is wanted as a follow-on, don't assume it's in scope for a single pitch-deck request.
