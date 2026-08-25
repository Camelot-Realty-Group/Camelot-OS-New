---
name: camelot-proposal-os
description: "Use when David Goldoff (Camelot Realty Group) wants to build, extend, or reuse the Camelot Proposal OS — a reusable system that turns one prospect (a condo board, co-op board, HOA, or landlord/investor) into a hybrid promotional microsite, digital pitch deck, detailed management proposal, transition plan, and downloadable/e-signable management agreement, all generated from one data model. Trigger phrases: build a pitch deck, proposal site, management agreement site, board presentation website, prospect microsite, RFP response site, Camelot Proposal OS, new proposal for [property]. Oak Park at Douglaston is Template #1 / the reference pilot — read references/oak-park-pilot.md for its exact content and open items before building a second instance from the same pattern."
metadata:
  author: david-goldoff
  version: '2.0'
---

# Camelot Proposal OS

A repeatable system, not a one-off brochure. Every prospect (a specific building + a specific board or investor) gets its own generated instance — a private microsite that is simultaneously a pitch deck, a proposal, a transition plan, and a source of the two documents that actually close the deal: the Proposal and the Management Agreement. One data model drives the site and both documents so they never drift out of sync with each other.

Load `camelot-editorial-voice` and `website-building` (the `webapp` child skill, since this needs a real backend for uploads, document generation, and access control) alongside this skill. Load `office` when generating the .docx/.pdf outputs.

**Known existing system**: Camelot already runs a production app called Camelot OS with an "Excalibur" agreement generator at `camelot-os.onrender.com/#/agreements` (React + Express, GitHub-tracked, deployed on Render, run from David's Windows machine). It already does templated Word/PDF agreement generation with photo/document upload, a Google Maps distance embed, and Jackie-report/tier-pricing integration. Before building a parallel system from scratch in a new session, ask David whether this skill's build should (a) extend/call into that existing app, or (b) stand alone in the current environment (e.g. because the Windows machine or that deployment isn't reachable this session). Don't assume — the two paths produce different architectures.

## Read before building

- `references/oak-park-pilot.md` — the full extracted content of the Oak Park pilot (property facts, board pain points, team commitments, pricing, transition plan, and the explicit "do not guess" open items list). This is Template #1; reuse its structure for every subsequent prospect.
- `references/architecture.md` — information architecture, 14-section site structure, data schema, admin/upload workflow, security model, and document-generation architecture that apply to every instance this skill produces.
- `references/document-design-standard.md` — the exact letterhead, typography, section, schedule, and signature-page standard the generated Proposal and Management Agreement documents must follow (pulled from Camelot's own Excalibur redesign spec), so every prospect's documents look identical in quality regardless of who built them.

## Core principle: one data model, many outputs

Define a single structured record per prospect (property facts, unit counts, team assignments, pricing, pain points, transition milestones, photos, uploaded documents) and generate the microsite, the Proposal.docx/.pdf, and the Management_Agreement.docx/.pdf from that one record. Never hand-edit the docx and the site copy separately — if a fact changes, it changes once, in the data model, and everything downstream regenerates.

## Non-negotiable ground rules

1. **Never invent facts.** Unit counts, sponsor relationships, insurance limits, assigned staff, and references must come from client-supplied material or independently verified public records. If something is missing, mark it `TO BE CONFIRMED` in the UI and in generated documents — never fill the gap with a plausible-sounding guess. Always distinguish, visibly: client-provided facts vs. independently verified facts vs. Camelot's recommended strategy.
2. **Public vs. board-confidential content is a hard boundary**, not a styling choice. Financials, budgets, arrears, resident data, and contracts must never render on the public-facing marketing pages — only inside the access-gated board portal section.
3. **Real photos only for the subject property.** Street View, David's own uploads, or licensed listing photos — never a generated image presented as the real building. Generic neighborhood/atmosphere imagery (clearly not depicting the specific building) is fine for texture.
4. **Legal disclaimers are load-bearing, not decorative.** Include, verbatim in spirit: e-signature is not represented as legally sufficient in every jurisdiction without proper implementation and legal review; Tim Kelly's facilities walkthroughs are operational/visual observations, not licensed professional inspections; shared-savings and other contingent fees only apply under a separate written agreement.
5. **No fee, referral, or affiliate compensation is ever implied as included** unless the source material says so explicitly. Ancillary services are always a clearly separated menu, never bundled into "basic management" by default.

## The reusable structure (see `references/architecture.md` for full detail)

14 sections: Hero → What We Heard → The Camelot Solution → Your Dedicated Team → Weekly On-Site Management → Financial Reporting → Camelot OS (the automation/analytics story) → Resident Experience → Cost Optimization → Transition → Management Proposal (viewable + downloadable) → Management Agreement (viewable + downloadable + e-signature) → Supporting Documents (access-gated board portal) → Next Step.

Each instance replaces: property name/address/photos, unit count and entity structure, management fee and allocation, team member names, pain points, financial examples, transition milestones, and uploaded reports — everything else (voice, layout, section order, legal disclaimers, design system) stays constant across prospects so the product looks and feels like one system, not seventeen one-off builds.

## Step 1 — Intake for a new instance

Required: property address, prospect/client entity name(s), board or ownership contact, reason for the pitch, proposed fee structure. Ask in one grouped question if missing — do not guess pricing or the reason for the pitch.

Nice-to-have, ask but don't block on: unit/entity structure, known pain points, comparable Camelot buildings to reference, photos, any CamelotOS/Jackie report exports.

## Step 2 — Research and source content

Load `search` for `pplx_sdk` patterns. Same sourcing table as before:

| Source | What to pull | How |
|---|---|---|
| StreetEasy / PropertyShark | Unit counts, sale history, tax assessment, violations | `pplx_sdk.search.web` + `content.fetch` with citations. Never republish their photos. |
| Google Street View | Street-level building photo | Static Street View API if `custom-cred:maps.googleapis.com` exists; otherwise ask David for a photo or the credential. |
| CamelotOS system / Jackie reports | Live financials, comps, diagnostic data | No connector exists — David exports/uploads; treat as a direct file upload. |
| David's uploads | Photos, prior correspondence, board minutes, comps | Read directly from workspace attachment paths. |

## Step 3 — Build

Follow `references/architecture.md` for the data schema and section-by-section content plan, and `references/document-design-standard.md` for the exact document formatting. Build as a `website-building/webapp` project (needs a real backend for uploads, access gating, and document generation — not a static site). Use `office` skill conventions for the docx/pdf generation step.

## Step 4 — Publish and deliver

Default every instance to private/specific-people visibility — these carry a specific board's financial terms. Confirm with David before any public link. Name each project directory and subdomain after the property, not "camelot" generically, so instances never collide.

## Step 5 — Wrap-up

Report the private link, current visibility setting, and a short list of any `TO BE CONFIRMED` items still open before the Boards can receive a final package. Don't add the prospect to the cold-outreach HubSpot pipeline automatically — this is a warm, in-progress deal workflow, not prospecting.
