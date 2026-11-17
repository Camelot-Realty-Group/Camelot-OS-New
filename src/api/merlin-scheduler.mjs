/**
 * Merlin scheduler.
 *
 * The command center does not send email, scrape buildings, or write tasks
 * on a timer. Autonomous work belongs to an external agent calling
 * /api/merlin/*. This function exists so server.js can boot even when
 * Supabase or the AI key is absent.
 */

export function startMerlinScheduler() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const aiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY || '';

  if (!url || /placeholder/i.test(url) || !serviceKey) {
    console.log('[merlin] scheduler idle — SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set. No autonomous actions will run.');
    return;
  }
  if (!aiKey) {
    console.log('[merlin] scheduler idle — AI_API_KEY is not set. No autonomous actions will run.');
    return;
  }
  console.log('[merlin] scheduler standing by. This build does not send mail or mutate records on a timer.');
}
