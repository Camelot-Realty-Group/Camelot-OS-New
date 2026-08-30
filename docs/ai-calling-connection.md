# AI Voice Calling — Connection Design (Aug 2026)

## What was investigated

David's message pointed to an existing tool: `https://app.emergent.sh/wing?wm=2d45168a-3f8f-407c-a3d2-09e8ea5ed397`.

Fetching that URL shows it is a **login-gated workspace inside Emergent**, a
general-purpose no-code AI app builder ("Emergent — AI-Powered App
Development"). It is not itself a calling/SMS API with a public, callable
endpoint — it's the account David uses to build things, and "Wing" appears to
be the name of a specific project/workspace inside it. There is no
documented webhook, REST API, or SDK surface visible from the outside that
this system could call directly without knowing what David built inside that
workspace (an agent? a script? nothing yet?).

**Conclusion: this can't be wired up blind.** Building a webhook integration
to an unknown internal tool risks silently failing or, worse, firing calls
outside the compliance guardrails built into this system (business hours,
owner-verification, consent). Rather than guess, this system exposes a clean
integration point that works with Wing, any other AI-calling platform
(Bland, Retell, Vapi, etc.), or a human using the prompt manually — see below.

## What was built instead: a provider-agnostic handoff point

`GET /api/leads/:id/ai-call-prompt` (see `src/api/leads-routes.mjs`) is the
integration surface. It:

1. Refuses to run unless the lead is `is_owner_contact = true` (never hands
   out a prompt for a management-company contact).
2. Refuses to run outside Mon–Fri, 9am–5pm ET (the same guardrail enforced on
   `POST /:id/calls`).
3. Returns a fully-built system prompt (see `buildAiVoiceCallPrompt` in
   `src/api/call-scripts.mjs`) — verification-only, non-pitch, with hard
   rules against impersonating a human, against pitching a non-owner, and a
   required structured output format.

The Call Queue page's "Get AI Call Prompt" button calls this route and
copies the result to the clipboard. From there, David or Carl/Luigi can:

- Paste it into Wing (once its actual agent-creation interface is known) as
  the calling agent's instructions, or
- Paste it into any other AI voice-calling platform that accepts a system
  prompt (Bland AI, Retell AI, Vapi, Air.ai, etc.), or
- Use it as a same-page reference for a human making the call themselves.

After the call happens (by whatever platform), the outcome is logged back
via `POST /api/leads/:id/calls` with `call_type: 'ai_voice'` and a structured
`outcome` — which is also what pushes into the call history shown on the
Call Queue page and can be extended to sync to HubSpot the same way the
email-send flow already does (see `pushLeadToHubSpotPipeline` in
`leads-routes.mjs` for the existing pattern to follow).

## To make this a fully automatic (no manual copy/paste) connection

Once David identifies what Wing (or another provider) actually exposes —
a webhook URL, an API key, a "trigger call" endpoint — the missing piece is
small: a new route (e.g. `POST /api/leads/:id/calls/trigger-ai`) that:

1. Calls the same `is_owner_contact` + business-hours checks already built.
2. Calls `buildAiVoiceCallPrompt(...)`.
3. POSTs it to the provider's "place a call" endpoint along with the phone
   number on file.
4. Registers a webhook receiver (e.g. `POST /api/leads/webhooks/ai-call-result`)
   for the provider to call back with the outcome, which then calls the same
   `neighborhood_lead_calls` insert logic already in `POST /:id/calls`.

This is a half-day of work once there's a real API to point at — the
guardrails, prompt-building, and outcome-logging plumbing this session built
are already provider-agnostic and reusable for whichever platform David
picks.

## Recommendation

Rather than reverse-engineer Wing's internals, the fastest safe path is:
David opens Wing, checks whether it has a documented API/webhook (most
no-code AI app builders do once you look at the built app's settings), and
shares that with a future session — at which point step "To make this fully
automatic" above is quick to build. In the meantime, the manual
copy-prompt-and-paste flow on the Call Queue page is fully functional today
and enforces every compliance guardrail already.
