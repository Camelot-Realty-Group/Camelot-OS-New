import { isSupabaseConfigured, supabase } from '@/lib/supabase';

/**
 * Fetch a Camelot API route, attaching the signed-in Supabase user's access
 * token when one exists.
 *
 * Camelot OS has no login screen wired up (the sign-in logic in useAuth is
 * unused dead code), so a Supabase session never exists in practice. This
 * used to hard-fail every call with "Your session has expired" before a
 * request was even sent — silently breaking the portfolio list, AI chat,
 * HubSpot/Apollo/Prospeo, Daily Hunt, Neighborhood Leads, and the
 * violation-tracking/alerts features, for every user, always. These are
 * internal, single-operator routes protected by server-only service-role
 * keys and Render's private URL, not by per-user auth, so we now attach a
 * token opportunistically (forward-compatible if a real login screen is
 * ever added) but never block the request on one being present.
 */
export async function authenticatedApiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  try {
    if (isSupabaseConfigured()) {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) headers.set('Authorization', `Bearer ${token}`);
    }
  } catch {
    // No session available — proceed without one.
  }
  return fetch(input, { ...init, headers });
}
