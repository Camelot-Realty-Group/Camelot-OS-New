/**
 * Authentication middleware for API routes
 *
 * Provides requireApiUser middleware that verifies Supabase JWT tokens
 * from Authorization headers. Used by all protected API routes.
 */

import { createClient } from '@supabase/supabase-js';

let supabaseAuthClient;

function getSupabaseAuthClient() {
  if (supabaseAuthClient) return supabaseAuthClient;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const authKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !authKey || /placeholder/i.test(`${url}${authKey}`)) return null;
  supabaseAuthClient = createClient(url, authKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return supabaseAuthClient;
}

/**
 * Middleware: Verify Supabase JWT from Authorization header.
 * Sets req.user to the authenticated user on success.
 */
export async function requireApiUser(req, res, next) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return res.status(401).json({ error: 'Authentication required.' });

  const authClient = getSupabaseAuthClient();
  if (!authClient) return res.status(503).json({ error: 'Server authentication is not configured.' });

  try {
    const { data, error } = await authClient.auth.getUser(token);
    if (error || !data.user) return res.status(401).json({ error: 'Invalid or expired session.' });
    req.user = data.user;
    return next();
  } catch {
    return res.status(401).json({ error: 'Could not verify the current session.' });
  }
}
