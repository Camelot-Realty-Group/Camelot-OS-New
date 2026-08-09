import { isSupabaseConfigured, supabase } from '@/lib/supabase';

/**
 * Fetch a Camelot API route with the signed-in Supabase user's access token.
 * Sensitive server routes fail closed when the user is not authenticated.
 */
export async function authenticatedApiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  if (!isSupabaseConfigured()) {
    throw new Error('Live Supabase authentication is required for this operation.');
  }

  const { data, error } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (error || !token) {
    throw new Error('Your session has expired. Sign in again before using integrations.');
  }

  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}
