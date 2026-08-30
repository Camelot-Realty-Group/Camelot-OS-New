/**
 * call-scripts.mjs — Neighborhood Leads follow-up call/text scripts.
 *
 * Per David, Aug 2026: this is explicitly NOT the cold-sales script
 * (see Google Drive doc "camelot-cold-call-script", used by Carl & Luigi for
 * first-touch cold calling). This is a short, low-pressure VERIFICATION
 * call/text that happens AFTER an intro email has already gone out via the
 * Neighborhood Leads Engine. Its only three jobs, in order:
 *
 *   1. Confirm the intro email was received / sent to the right address.
 *   2. Verify the person is actually an owner or board member of THIS
 *      specific property (not staff, not a tenant, not unrelated).
 *   3. Only if both are true, work toward booking a meeting with a Camelot
 *      executive — never a sales pitch on this call.
 *
 * Two variants are exported:
 *   HUMAN_CALL_SCRIPT   — talking points for a live rep (Carl/Luigi/etc.),
 *                         meant to be read once and then used naturally,
 *                         same as the existing cold-call script's format.
 *   AI_VOICE_CALL_PROMPT — a strict system prompt for an AI voice agent
 *                         (e.g. via the Wing/Emergent connection or another
 *                         provider). The AI variant is deliberately more
 *                         rigid: it must not improvise into a sales pitch,
 *                         must log a structured outcome, and must respect
 *                         calling-hours/consent constraints external to the
 *                         script itself (enforced in leads-routes.mjs).
 *   SMS_OPT_IN_TEMPLATE  — the opt-in text sent only after a lead has
 *                         replied/opted in via the email opt-in flow (see
 *                         sms consent policy in leads-routes.mjs).
 */

export const HUMAN_CALL_SCRIPT = `
CAMELOT NEIGHBORHOOD LEADS — FOLLOW-UP VERIFICATION CALL
(Not a cold call — this person already received an intro email from David Goldoff.)

GOAL OF THIS CALL: Confirm they got the email, confirm they're the owner/board
member for this specific property, and — only if both are true — offer to set
up a meeting with a Camelot executive. Do NOT pitch. Do NOT read the full
cold-call script on this call.

OPENING (10 seconds):
"Hi, is this [NAME]? ... Hi [NAME], this is [YOUR NAME] with Camelot Realty
Group — you may have gotten an email from our president, David Goldoff, about
[ADDRESS]. I'm just following up quickly to make sure it reached you okay.
Do you have 60 seconds?"

STEP 1 — CONFIRM THE EMAIL:
"Did that email come through to you all right? It would have had a brief
overview of Camelot attached."
  - If yes: proceed to Step 2.
  - If no / doesn't recall: "No problem — I can resend it right now to
    whatever's the best address. What's the best one to use?" (log new email,
    end call politely, do not proceed to Step 2 on this call).

STEP 2 — VERIFY OWNER/BOARD STATUS (the real point of this call):
"Just to make sure I'm speaking with the right person — are you the owner of
[ADDRESS], or on the board there?"
  - If YES (owner or board member): proceed to Step 3.
  - If "I manage it" / "I'm the super" / "I'm staff": "Got it, thank you for
    letting me know. Is there an owner or board member I should be speaking
    with instead?" (log as not_owner_or_board; if they offer a name/contact,
    log it as a new lead; end call politely — do not pitch to a non-owner).
  - If "not me / wrong number": log as wrong_number, end call politely.

STEP 3 — QUALIFY TOWARD A MEETING (only reached if Step 2 confirmed owner/board):
"Great, thank you. I won't take much more of your time — David would love to
set up a short call or meeting with one of our executives to walk through how
Camelot could help with the building, whenever works for you. No pressure at
all if now isn't the right time. Would that be something you're open to?"
  - If YES: "Perfect — what's the best number or email to set that up, and is
    there a day this week or next that generally works better for you?" (log
    confirmed_owner_meeting_requested, capture preferred contact/timing,
    hand off to scheduling).
  - If "maybe later" / "not right now": "Totally understand — is it alright
    if we check back in a few weeks?" (log confirmed_owner_callback_requested).
  - If NO / not interested: "No problem at all, thank you for your time."
    (log confirmed_owner_not_interested — do not push further).

IF THEY ASK TO NOT BE CONTACTED AGAIN:
"Absolutely, I'll make sure you're taken off our list — sorry for the
interruption." (log do_not_call_requested — this must stop ALL future
calls/texts/emails to this lead, no exceptions.)

CALLING HOURS: Only call Monday–Friday, 9:00 AM–5:00 PM. Never call on
weekends. If you reach voicemail, leave no more than: "Hi [NAME], this is
[YOUR NAME] from Camelot Realty Group, just following up on an email we sent
about [ADDRESS] — no need to call back, I'll try again another time. Thanks!"
`.trim();

/**
 * Strict system prompt for an AI voice agent. Deliberately more rigid than
 * the human script — no room for the model to freelance into a sales pitch,
 * explicit disclosure of AI nature (required when asked, per TCPA/FCC
 * guidance), explicit stop conditions, and a required structured output at
 * the end of every call so the outcome can be logged programmatically.
 */
export function buildAiVoiceCallPrompt({ leadAddress, ownerOrContactName, callerDisplayName = 'Camelot Realty Group' }) {
  return `
You are an AI voice assistant calling on behalf of ${callerDisplayName}. You are
placing a FOLLOW-UP call, not a cold sales call — the person you're calling
already received an introductory email from David Goldoff, President of
Camelot Realty Group, about the property at ${leadAddress}.

YOUR ONLY THREE GOALS, IN STRICT ORDER:
1. Confirm the email was received.
2. Verify the person is the OWNER or a BOARD MEMBER of ${leadAddress}
   specifically — not staff, not a tenant, not an unrelated party.
3. ONLY if both are confirmed true, ask if they'd be open to a short meeting
   with a Camelot executive. Do not describe Camelot's services in detail.
   Do not negotiate pricing. Do not make claims about savings, performance,
   or guarantees of any kind.

HARD RULES — NEVER VIOLATE THESE:
- If asked "are you a robot / AI / a real person," you MUST truthfully say
  you are an AI calling on behalf of Camelot Realty Group. Never claim to be
  human.
- If the person says they are not the owner or a board member, thank them,
  ask only if they can point you to the right person, and end the call. Do
  not pitch to a non-owner under any circumstance.
- If the person asks not to be contacted again, or says "stop calling," you
  must immediately acknowledge, apologize for the interruption, and end the
  call. Record this as do_not_call_requested — it is the single most
  important outcome to capture correctly, as it must block all future
  contact.
- Never extend the call past confirming interest in a meeting. Do not
  attempt to schedule specific meeting logistics yourself — say a member of
  the Camelot team will follow up to find a time.
- If the person becomes upset, confused, or asks to speak to a human at any
  point, immediately offer to have a Camelot staff member call them back and
  end the call politely.
- This call must only ever be placed Monday–Friday, between 9:00 AM and
  5:00 PM. (This is enforced by the system that schedules you — if you are
  somehow running outside those hours, end the call immediately without
  speaking.)

REQUIRED OUTPUT: at the end of every call, produce a structured summary with
exactly these fields: outcome (one of: no_answer, voicemail, wrong_number,
confirmed_owner_meeting_requested, confirmed_owner_not_interested,
confirmed_owner_callback_requested, not_owner_or_board, declined_to_verify,
do_not_call_requested), notes (one or two sentences, factual, no
speculation), and preferred_contact (any phone/email/timing they gave you,
or null).

The person's name on file (if known): ${ownerOrContactName || 'unknown — confirm on the call'}.
Never fabricate information about Camelot, the building, or the person you
did not actually hear from them or were not given above.
`.trim();
}

/**
 * SMS opt-in confirmation text — sent only after a lead has taken an
 * affirmative opt-in action (replying YES to the intro email's opt-in line,
 * or texting START to the number below). Never sent cold. See
 * neighborhood_lead_sms_consent in migration 023 and the consent check in
 * leads-routes.mjs before any SMS send.
 */
export function buildSmsOptInConfirmation({ leadAddress }) {
  return `Camelot Realty Group: Thanks for opting in! We'll text you occasional follow-ups about ${leadAddress}. Reply STOP anytime to opt out, HELP for help. Msg & data rates may apply.`;
}

/** The line added to the intro email offering the SMS opt-in — this is the
 * consent-gathering mechanism itself, not a text message. */
export const EMAIL_SMS_OPT_IN_LINE =
  'Prefer text? Reply to this email with YES, or text START to (646) 523-9068, and we will follow up by text instead — reply STOP anytime.';
