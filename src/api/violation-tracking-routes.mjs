/**
 * Violation Tracking API Routes — internal workflow layer on top of the live
 * NYC Open Data violation feed (HPD/DOB/ECB, see src/lib/nyc-violations.ts).
 *
 * A violation is identified everywhere by its `violation_key`:
 *   `${source}|${violationId}|${normalizedAddress}`
 * built client-side (see buildViolationKey in Violations.tsx) and passed as-is.
 *
 * GET    /api/violations/tracking?key=...            — tracking row + notes + documents for one violation
 * PATCH  /api/violations/tracking                     — upsert status/assignment/hearing outcome
 * POST   /api/violations/notes                        — add a note
 * DELETE /api/violations/notes/:id                     — remove a note
 * POST   /api/violations/documents                     — upload a document/photo (base64)
 * GET    /api/violations/documents/:id/url              — fresh signed download URL
 * DELETE /api/violations/documents/:id                  — remove a document
 *
 * All routes sit behind requireApiUser (see server.js).
 */

import express from 'express';
import { createClient } from '@supabase/supabase-js';

/* global console, process, Buffer */

const router = express.Router();

let supabaseInstance = null;
function getSupabase() {
  if (!supabaseInstance) {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      || process.env.SUPABASE_ANON_KEY
      || process.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Violation tracking database is not configured (SUPABASE_URL / key missing).');
    }
    supabaseInstance = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return supabaseInstance;
}

const DOCUMENTS_BUCKET = 'violation-documents';

// ---------------------------------------------------------------------------
// GET /api/violations/tracking?key=...
// ---------------------------------------------------------------------------
router.get('/violations/tracking', async (req, res) => {
  try {
    const key = String(req.query.key || '').trim();
    if (!key) return res.status(400).json({ error: 'key is required' });
    const supabase = getSupabase();

    const [trackingRes, notesRes, docsRes] = await Promise.all([
      supabase.from('violation_tracking').select('*').eq('violation_key', key).maybeSingle(),
      supabase.from('violation_notes').select('*').eq('violation_key', key).order('created_at', { ascending: false }),
      supabase.from('violation_documents').select('*').eq('violation_key', key).order('created_at', { ascending: false }),
    ]);
    if (trackingRes.error && !/no rows/i.test(trackingRes.error.message || '')) throw trackingRes.error;
    if (notesRes.error) throw notesRes.error;
    if (docsRes.error) throw docsRes.error;

    res.json({
      tracking: trackingRes.data || { violation_key: key, internal_status: 'new' },
      notes: notesRes.data || [],
      documents: docsRes.data || [],
    });
  } catch (err) {
    console.error('GET /violations/tracking error:', err);
    res.status(500).json({ error: err.message || 'Failed to load violation tracking' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/violations/tracking/bulk-status?keys=key1,key2,...
// Returns only { violation_key, internal_status } for the given keys — used to
// hide "Not Me" violations from the default report view without a per-row fetch.
// ---------------------------------------------------------------------------
router.get('/violations/tracking/bulk-status', async (req, res) => {
  try {
    const keys = String(req.query.keys || '').split(',').map(k => k.trim()).filter(Boolean);
    if (!keys.length) return res.json({ statuses: {} });
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('violation_tracking').select('violation_key, internal_status').in('violation_key', keys);
    if (error) throw error;
    const statuses = {};
    for (const row of (data || [])) statuses[row.violation_key] = row.internal_status;
    res.json({ statuses });
  } catch (err) {
    console.error('GET /violations/tracking/bulk-status error:', err);
    res.status(500).json({ error: err.message || 'Failed to load statuses' });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/violations/tracking — upsert status/assignment/hearing outcome
// ---------------------------------------------------------------------------
router.patch('/violations/tracking', async (req, res) => {
  try {
    const {
      violationKey, buildingId, address, borough, source, violationId,
      internalStatus, assignedTo, assignedToEmail, dueDate,
      hearingOutcome, hearingOutcomeNotes, updatedBy,
    } = req.body || {};
    if (!violationKey || !source || !violationId || !address) {
      return res.status(400).json({ error: 'violationKey, source, violationId, and address are required' });
    }
    const supabase = getSupabase();
    const row = {
      violation_key: violationKey,
      building_id: buildingId || null,
      address,
      borough: borough || null,
      source,
      violation_id: violationId,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy || null,
    };
    if (internalStatus !== undefined) row.internal_status = internalStatus;
    if (assignedTo !== undefined) row.assigned_to = assignedTo;
    if (assignedToEmail !== undefined) row.assigned_to_email = assignedToEmail;
    if (dueDate !== undefined) row.due_date = dueDate || null;
    if (hearingOutcome !== undefined) row.hearing_outcome = hearingOutcome || null;
    if (hearingOutcomeNotes !== undefined) row.hearing_outcome_notes = hearingOutcomeNotes;

    const { data, error } = await supabase
      .from('violation_tracking')
      .upsert(row, { onConflict: 'violation_key' })
      .select()
      .single();
    if (error) throw error;
    res.json({ tracking: data });
  } catch (err) {
    console.error('PATCH /violations/tracking error:', err);
    res.status(500).json({ error: err.message || 'Failed to update violation tracking' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/violations/notes
// ---------------------------------------------------------------------------
router.post('/violations/notes', async (req, res) => {
  try {
    const { violationKey, author, body } = req.body || {};
    if (!violationKey || !body) return res.status(400).json({ error: 'violationKey and body are required' });
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('violation_notes')
      .insert({ violation_key: violationKey, author: author || 'Camelot OS', body })
      .select()
      .single();
    if (error) throw error;
    res.json({ note: data });
  } catch (err) {
    console.error('POST /violations/notes error:', err);
    res.status(500).json({ error: err.message || 'Failed to add note' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/violations/notes/:id
// ---------------------------------------------------------------------------
router.delete('/violations/notes/:id', async (req, res) => {
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('violation_notes').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /violations/notes/:id error:', err);
    res.status(500).json({ error: err.message || 'Failed to delete note' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/violations/documents — { violationKey, filename, contentType, fileBase64, docType, uploadedBy }
// ---------------------------------------------------------------------------
router.post('/violations/documents', async (req, res) => {
  try {
    const { violationKey, filename, contentType, fileBase64, docType, uploadedBy } = req.body || {};
    if (!violationKey || !filename || !fileBase64) {
      return res.status(400).json({ error: 'violationKey, filename, and fileBase64 are required' });
    }
    const supabase = getSupabase();
    const buffer = Buffer.from(fileBase64, 'base64');
    if (buffer.length > 15 * 1024 * 1024) {
      return res.status(413).json({ error: 'File too large (15MB max)' });
    }
    const safeName = String(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${violationKey.replace(/[^a-zA-Z0-9._-]/g, '_')}/${Date.now()}_${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .upload(storagePath, buffer, { contentType: contentType || 'application/octet-stream', upsert: false });
    if (uploadError) throw uploadError;

    const { data, error } = await supabase
      .from('violation_documents')
      .insert({
        violation_key: violationKey,
        filename: safeName,
        storage_path: storagePath,
        content_type: contentType || null,
        size_bytes: buffer.length,
        doc_type: docType || 'other',
        uploaded_by: uploadedBy || null,
      })
      .select()
      .single();
    if (error) throw error;

    const { data: signed } = await supabase.storage.from(DOCUMENTS_BUCKET).createSignedUrl(storagePath, 3600);
    res.json({ document: data, url: signed?.signedUrl || null });
  } catch (err) {
    console.error('POST /violations/documents error:', err);
    res.status(500).json({ error: err.message || 'Failed to upload document' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/violations/documents/:id/url — fresh signed URL (1 hour)
// ---------------------------------------------------------------------------
router.get('/violations/documents/:id/url', async (req, res) => {
  try {
    const supabase = getSupabase();
    const { data: doc, error: docErr } = await supabase
      .from('violation_documents').select('storage_path').eq('id', req.params.id).single();
    if (docErr) throw docErr;
    const { data: signed, error: signErr } = await supabase.storage
      .from(DOCUMENTS_BUCKET).createSignedUrl(doc.storage_path, 3600);
    if (signErr) throw signErr;
    res.json({ url: signed.signedUrl });
  } catch (err) {
    console.error('GET /violations/documents/:id/url error:', err);
    res.status(500).json({ error: err.message || 'Failed to get document URL' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/violations/documents/:id
// ---------------------------------------------------------------------------
router.delete('/violations/documents/:id', async (req, res) => {
  try {
    const supabase = getSupabase();
    const { data: doc, error: docErr } = await supabase
      .from('violation_documents').select('storage_path').eq('id', req.params.id).single();
    if (docErr) throw docErr;
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([doc.storage_path]);
    const { error } = await supabase.from('violation_documents').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /violations/documents/:id error:', err);
    res.status(500).json({ error: err.message || 'Failed to delete document' });
  }
});

export default router;
