# Document Design Standard (Proposal + Management Agreement)

Source of truth: Camelot's own Excalibur agreement-generator redesign spec (implemented 2026-08-17 in the live Camelot OS app). Apply this to every generated Proposal.docx/.pdf and Management_Agreement.docx/.pdf, regardless of asset class (condo, co-op, rental, HOA, office).

## Naming

- Documents are named for what they are: **"Camelot Rental Management Agreement"**, **"Camelot Condominium Management Agreement"**, etc. — never a vague "Proposal of Property Management Services" as the filename/title once it's the formal agreement.
- Filename convention: `{Property-Address}__Camelot-{Type}-Management-Agreement__v{YYYY.MM.1}__{YYYY-MM-DD}.{docx|pdf}` — e.g. `239-12-Oak-Park-Dr-Douglaston-NY-11362__Camelot-Condominium-Management-Agreement__v2026.08.1__2026-08-25.pdf`

## Letterhead (every page)

- **Header**: gold square CAMELOT REALTY GROUP mark at left + "CAMELOT REALTY GROUP" in navy bold + services line ("REAL ESTATE · PROPERTY MGMT · BROKERAGE · INVESTMENT SERVICES") + gold italic tagline "New Yorkers Working for New Yorkers  EST. 2006" + thin rule beneath.
- **Footer**: centered "57 West 57th Street, Suite 410, New York, NY 10019 · (212) 206-9939 · info@camelot.nyc · www.camelot.nyc" above a centered CONFIDENTIAL line, with page numbers.
- **Page format**: 8.5"×11", 0.75in margins, light gold border (`#C9A55C`, 2px) on every page.

## Typography and color

- **Font**: Georgia serif (matches the Word master template).
- **Title**: "CAMELOT [TYPE] MANAGEMENT AGREEMENT," centered, navy (`#1B2A4A`) bold, sans-serif, uppercase — no cover page, no centered kicker beyond the title itself.
- **Article headings**: "ARTICLE N — Title," centered, dark gold (`#4A3728`), uppercase, with a gold underline rule beneath.
- **Article subheadings**: centered, dark gold, normal case, bold.
- **Body**: justified, 12pt, Georgia. Bold-lead paragraphs for definitions in Article I. Bullet list permitted in the services-included article.
- **Management fee sentence**: bold + underlined, its own dedicated paragraph, e.g. *"As consideration for the Services, the Client shall pay the Agent a management fee of $[amount]."*

## Structure

- Articles I through XIX (or XX if special terms are needed), covering: definitions, term/termination, appointment/scope, weekly site presence, staff supervision, financial management, budgets/tax coordination, billing/collections, vendor administration, board meetings, resident technology, transition, records ownership, expenditure authority, compensation, additional services, compensation transparency, shared-savings program, insurance, indemnification, notices/amendments.
- **Signature page**: one dedicated page, both parties together. Centered "SIGNATURES" heading, "IN WITNESS WHEREOF…" clause, CLIENT block (signature line, By/Name/Title/Date) — for a multi-entity deal like Oak Park, one CLIENT block per entity — gold rule divider, then AGENT block: "Camelot Property Management Services Corp.," "David A. Goldoff," "President," Date.
- **Schedules**, after a full page break from the signature page: Schedule A (Fee Schedule/Basic Services), Schedule B (Ancillary Rate Sheet), Schedule C (Insurance Coverage or Transition Deliverables depending on asset class) — navy-header striped tables with real Camelot rates, never placeholder numbers.

## Property photos

- Page control for 3–5 images max. First image is the cover image, full-width under the title; additional images render as a small grid.
- **If no photos are uploaded, render no image block at all** — no placeholder graphic, nothing.
- Compress client-side to ≤1400px JPEG; embed as data URIs so the document stays self-contained (no broken links when downloaded).

## Map

- Exactly one small map per document: a compact driving-directions embed from Camelot's office (57 West 57th Street, Suite 410) to the property, with adjacent text explaining the mileage and why proximity matters (faster inspections, quicker emergency response, in-person presence). Never duplicate this map elsewhere in the same document.

## Supporting document parsing

- Accept PDF/DOCX uploads (PropertyShark exports, rent rolls, offering docs). Extract text server-side and pull: owner entity, units, block/lot, year built, sq ft, stories, assessed value, mortgages, violations, rent regulation status. Surface extracted facts as a removable "Property Overview" list before the document is finalized — never silently bake unverified extracted facts into contract language.

## What must never appear as fabricated

- Coverage limits not verified by the issuing broker/carrier
- An assigned property manager's name/portfolio/backup that hasn't been internally confirmed
- Final unit counts before offering-plan/ledger verification
- Any e-signature claim of legal sufficiency without disclosure that proper implementation and jurisdiction-specific legal review are required
