/**
 * Merlin command-center API.
 *
 * External agents and the Camelot OS UI share these routes:
 *   /api/merlin/tasks
 *   /api/merlin/templates
 *   /api/merlin/campaigns
 *   /api/merlin/activity
 *   /api/merlin/summary
 *
 * Persistence uses Supabase when SUPABASE_URL and a key are set
 * (SUPABASE_SERVICE_ROLE_KEY preferred). Otherwise records live in memory
 * for the life of the process. Memory mode starts empty — it is not a
 * demo dataset.
 *
 * When MERLIN_API_TOKEN is set, callers from another origin must send
 * Authorization: Bearer <token>. Same-origin browser calls are allowed
 * so staff can use the UI without embedding the token in the bundle.
 */

import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

const TASK_STATUSES = ['open', 'in_progress', 'blocked', 'done', 'cancelled'];
const TASK_PRIORITIES = ['low', 'normal', 'high', 'urgent'];
const CAMPAIGN_STATUSES = ['draft', 'active', 'paused', 'completed'];
const TEMPLATE_KINDS = ['proposal', 'letter', 'notice', 'board_report', 'email', 'other'];

const memory = {
  tasks: [],
  templates: [],
  marketing_campaigns: [],
  merlin_activity_log: [],
};

let supabaseClient = null;
let supabaseMode = null;

function clean(value, max = 4000) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/\u0000/g, '').trim().slice(0, max);
}

function optionalText(value, max) {
  const text = clean(value, max);
  return text || null;
}

function isPlaceholder(value) {
  return /placeholder|your-project|your-anon|your-service/i.test(value || '');
}

function getSupabase() {
  if (supabaseMode) return supabaseClient;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.SUPABASE_ANON_KEY
    || process.env.VITE_SUPABASE_ANON_KEY
    || '';
  if (!url || !key || isPlaceholder(url) || isPlaceholder(key)) {
    supabaseMode = 'memory';
    supabaseClient = null;
    return null;
  }
  supabaseClient = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  supabaseMode = 'supabase';
  return supabaseClient;
}

function storageName() {
  getSupabase();
  return supabaseMode === 'supabase' ? 'supabase' : 'memory';
}

function requireMerlinAccess(req, res, next) {
  const expected = clean(process.env.MERLIN_API_TOKEN, 500);
  if (!expected) return next();

  const presented = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (presented && presented === expected) return next();
  if (presented) return res.status(401).json({ error: 'Invalid Merlin API token.' });

  const origin = req.get('origin') || '';
  const host = req.get('host') || '';
  let originHost = '';
  try {
    originHost = origin ? new URL(origin).host : '';
  } catch {
    originHost = '';
  }
  if (originHost && host && originHost === host) return next();
  return res.status(401).json({
    error: 'Merlin API token required. Send Authorization: Bearer <MERLIN_API_TOKEN>.',
  });
}

router.use('/merlin', requireMerlinAccess);

function newId() {
  return crypto.randomUUID();
}

function nowIso() {
  return new Date().toISOString();
}

function parseDue(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { error: 'due_at must be an ISO date or empty.' };
  return date.toISOString();
}

function validateTask(body, { partial = false } = {}) {
  const source = body || {};
  const out = {};
  if (!partial || source.title !== undefined) {
    const title = clean(source.title, 200);
    if (!title) return { error: 'title is required.' };
    out.title = title;
  }
  if (source.description !== undefined) out.description = optionalText(source.description, 8000);
  if (!partial && out.description === undefined) out.description = null;
  if (source.status !== undefined || !partial) {
    const status = clean(source.status || 'open', 40);
    if (!TASK_STATUSES.includes(status)) return { error: `status must be one of: ${TASK_STATUSES.join(', ')}.` };
    out.status = status;
  }
  if (source.priority !== undefined || !partial) {
    const priority = clean(source.priority || 'normal', 40);
    if (!TASK_PRIORITIES.includes(priority)) return { error: `priority must be one of: ${TASK_PRIORITIES.join(', ')}.` };
    out.priority = priority;
  }
  if (source.building_label !== undefined || !partial) out.building_label = optionalText(source.building_label, 200);
  if (source.assignee !== undefined || !partial) out.assignee = optionalText(source.assignee, 120);
  if (source.due_at !== undefined || !partial) {
    const due = parseDue(source.due_at ?? null);
    if (due && typeof due === 'object' && due.error) return due;
    out.due_at = due ?? null;
  }
  if (source.source !== undefined || !partial) out.source = clean(source.source || 'manual', 40) || 'manual';
  if (source.created_by !== undefined || !partial) out.created_by = optionalText(source.created_by, 120);
  return { value: out };
}

function slugify(value) {
  const slug = clean(value, 80).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return slug || `template-${Date.now().toString(36)}`;
}

function validateTemplate(body, { partial = false } = {}) {
  const source = body || {};
  const out = {};
  if (!partial || source.title !== undefined) {
    const title = clean(source.title, 200);
    if (!title) return { error: 'title is required.' };
    out.title = title;
  }
  if (source.slug !== undefined) out.slug = slugify(source.slug);
  if (!partial && out.slug === undefined) out.slug = slugify(source.title);
  if (source.category !== undefined || !partial) out.category = clean(source.category || 'General', 80) || 'General';
  if (source.kind !== undefined || !partial) {
    const kind = clean(source.kind || 'letter', 40);
    if (!TEMPLATE_KINDS.includes(kind)) return { error: `kind must be one of: ${TEMPLATE_KINDS.join(', ')}.` };
    out.kind = kind;
  }
  if (source.body !== undefined || !partial) out.body = clean(source.body || '', 20000);
  if (source.description !== undefined || !partial) out.description = optionalText(source.description, 2000);
  if (source.source !== undefined || !partial) out.source = clean(source.source || 'library', 40) || 'library';
  return { value: out };
}

function validateCampaign(body, { partial = false } = {}) {
  const source = body || {};
  const out = {};
  if (!partial || source.name !== undefined) {
    const name = clean(source.name, 200);
    if (!name) return { error: 'name is required.' };
    out.name = name;
  }
  if (source.channel !== undefined || !partial) out.channel = optionalText(source.channel, 80);
  if (source.status !== undefined || !partial) {
    const status = clean(source.status || 'draft', 40);
    if (!CAMPAIGN_STATUSES.includes(status)) return { error: `status must be one of: ${CAMPAIGN_STATUSES.join(', ')}.` };
    out.status = status;
  }
  if (source.audience !== undefined || !partial) out.audience = optionalText(source.audience, 200);
  if (source.summary !== undefined || !partial) out.summary = optionalText(source.summary, 4000);
  if (source.owner !== undefined || !partial) out.owner = optionalText(source.owner, 120);
  return { value: out };
}

function validateActivity(body) {
  const source = body || {};
  const action = clean(source.action, 80);
  if (!action) return { error: 'action is required.' };
  let metadata = source.metadata && typeof source.metadata === 'object' && !Array.isArray(source.metadata)
    ? source.metadata
    : {};
  try {
    metadata = JSON.parse(JSON.stringify(metadata));
  } catch {
    metadata = {};
  }
  return {
    value: {
      actor: clean(source.actor || 'merlin', 80) || 'merlin',
      action,
      module: optionalText(source.module, 80),
      summary: optionalText(source.summary, 2000),
      metadata,
    },
  };
}

function missingTable(error) {
  const message = `${error?.message || ''} ${error?.details || ''} ${error?.code || ''}`;
  return error?.code === 'PGRST205' || /schema cache|does not exist|relation/i.test(message);
}

function dbError(res, error) {
  if (missingTable(error)) {
    return res.status(503).json({
      error: 'Merlin tables are not installed. Apply supabase/migrations/028_merlin_command_center.sql. Do not treat this environment as having live tasks or templates.',
      storage: 'supabase',
    });
  }
  console.error('[merlin] database error:', error?.message || error);
  return res.status(503).json({ error: 'Merlin could not reach Supabase.', storage: 'supabase' });
}

function sortByUpdated(rows) {
  return [...rows].sort((a, b) => String(b.updated_at || b.created_at).localeCompare(String(a.updated_at || a.created_at)));
}

function filterRows(rows, { status, assignee, building, q, kind, category, channel }) {
  const query = clean(q, 120).toLowerCase();
  return rows.filter((row) => {
    if (status && row.status !== status) return false;
    if (kind && row.kind !== kind) return false;
    if (category && clean(row.category, 80).toLowerCase() !== category.toLowerCase()) return false;
    if (channel && clean(row.channel, 80).toLowerCase() !== channel.toLowerCase()) return false;
    if (assignee && !clean(row.assignee, 120).toLowerCase().includes(assignee.toLowerCase())) return false;
    if (building && !clean(row.building_label, 200).toLowerCase().includes(building.toLowerCase())) return false;
    if (query) {
      const haystack = [row.title, row.name, row.description, row.summary, row.body, row.action, row.assignee, row.building_label]
        .map((part) => clean(part, 4000).toLowerCase())
        .join(' ');
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

async function listRows(table, filters) {
  const supabase = getSupabase();
  if (!supabase) {
    return { rows: filterRows(sortByUpdated(memory[table]), filters), storage: 'memory', warning: null };
  }
  let query = supabase.from(table).select('*').order('created_at', { ascending: false }).limit(200);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.kind) query = query.eq('kind', filters.kind);
  if (filters.category) query = query.ilike('category', filters.category);
  if (filters.channel) query = query.ilike('channel', filters.channel);
  if (filters.assignee) query = query.ilike('assignee', `%${filters.assignee.replace(/[%_]/g, '')}%`);
  if (filters.building) query = query.ilike('building_label', `%${filters.building.replace(/[%_]/g, '')}%`);
  const q = clean(filters.q, 120).replace(/[%_,*()]/g, '');
  if (q && table === 'tasks') query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
  if (q && table === 'templates') query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%,body.ilike.%${q}%`);
  if (q && table === 'marketing_campaigns') query = query.or(`name.ilike.%${q}%,summary.ilike.%${q}%`);
  const { data, error } = await query;
  if (error) {
    if (missingTable(error)) {
      return {
        rows: [],
        storage: 'supabase',
        warning: 'Merlin tables are not installed yet. Apply supabase/migrations/028_merlin_command_center.sql.',
      };
    }
    throw error;
  }
  return { rows: data || [], storage: 'supabase', warning: null };
}

async function findRow(table, id) {
  const supabase = getSupabase();
  if (!supabase) return memory[table].find((row) => row.id === id) || null;
  const { data, error } = await supabase.from(table).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

async function insertRow(table, row) {
  const supabase = getSupabase();
  const stamped = { ...row, id: row.id || newId(), created_at: nowIso(), updated_at: nowIso() };
  if (!supabase) {
    memory[table].unshift(stamped);
    return stamped;
  }
  const { data, error } = await supabase.from(table).insert(stamped).select('*').single();
  if (error) throw error;
  return data;
}

async function updateRow(table, id, patch) {
  const supabase = getSupabase();
  const stamped = { ...patch, updated_at: nowIso() };
  if (!supabase) {
    const index = memory[table].findIndex((row) => row.id === id);
    if (index === -1) return null;
    memory[table][index] = { ...memory[table][index], ...stamped };
    return memory[table][index];
  }
  const { data, error } = await supabase.from(table).update(stamped).eq('id', id).select('*').maybeSingle();
  if (error) throw error;
  return data;
}

async function deleteRow(table, id) {
  const supabase = getSupabase();
  if (!supabase) {
    const before = memory[table].length;
    memory[table] = memory[table].filter((row) => row.id !== id);
    return memory[table].length !== before;
  }
  const { data, error } = await supabase.from(table).delete().eq('id', id).select('id');
  if (error) throw error;
  return Array.isArray(data) && data.length > 0;
}

function sendList(res, key, result) {
  res.json({ [key]: result.rows, storage: result.storage, warning: result.warning });
}

router.get('/merlin/summary', async (_req, res) => {
  try {
    const [tasks, campaigns, templates, activity] = await Promise.all([
      listRows('tasks', {}),
      listRows('marketing_campaigns', {}),
      listRows('templates', {}),
      listRows('merlin_activity_log', {}),
    ]);
    const countStatus = (rows, status) => rows.filter((row) => row.status === status).length;
    const warning = tasks.warning || campaigns.warning || templates.warning || activity.warning;
    res.json({
      storage: storageName(),
      warning,
      tasks: {
        total: tasks.rows.length,
        open: countStatus(tasks.rows, 'open'),
        in_progress: countStatus(tasks.rows, 'in_progress'),
        blocked: countStatus(tasks.rows, 'blocked'),
        done: countStatus(tasks.rows, 'done'),
        cancelled: countStatus(tasks.rows, 'cancelled'),
      },
      campaigns: {
        total: campaigns.rows.length,
        draft: countStatus(campaigns.rows, 'draft'),
        active: countStatus(campaigns.rows, 'active'),
        paused: countStatus(campaigns.rows, 'paused'),
        completed: countStatus(campaigns.rows, 'completed'),
      },
      templates: { total: templates.rows.length },
      activity: activity.rows.slice(0, 8),
    });
  } catch (error) {
    dbError(res, error);
  }
});

function listHandler(table, key) {
  return async (req, res) => {
    try {
      const result = await listRows(table, {
        status: clean(req.query.status, 40),
        assignee: clean(req.query.assignee, 120),
        building: clean(req.query.building, 200),
        q: clean(req.query.q, 120),
        kind: clean(req.query.kind, 40),
        category: clean(req.query.category, 80),
        channel: clean(req.query.channel, 80),
      });
      sendList(res, key, result);
    } catch (error) {
      dbError(res, error);
    }
  };
}

router.get('/merlin/tasks', listHandler('tasks', 'tasks'));
router.get('/merlin/templates', listHandler('templates', 'templates'));
router.get('/merlin/campaigns', listHandler('marketing_campaigns', 'campaigns'));
router.get('/merlin/activity', async (req, res) => {
  try {
    const result = await listRows('merlin_activity_log', { q: clean(req.query.q, 120) });
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    sendList(res, 'activity', { ...result, rows: result.rows.slice(0, limit) });
  } catch (error) {
    dbError(res, error);
  }
});

function readHandler(table) {
  return async (req, res) => {
    try {
      const row = await findRow(table, req.params.id);
      if (!row) return res.status(404).json({ error: 'Not found.' });
      res.json(row);
    } catch (error) {
      dbError(res, error);
    }
  };
}

router.get('/merlin/tasks/:id', readHandler('tasks'));
router.get('/merlin/templates/:id', readHandler('templates'));
router.get('/merlin/campaigns/:id', readHandler('marketing_campaigns'));

router.post('/merlin/tasks', async (req, res) => {
  const parsed = validateTask(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  try {
    const row = await insertRow('tasks', parsed.value);
    res.status(201).json(row);
  } catch (error) {
    dbError(res, error);
  }
});

router.post('/merlin/templates', async (req, res) => {
  const parsed = validateTemplate(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  try {
    const row = await insertRow('templates', parsed.value);
    res.status(201).json(row);
  } catch (error) {
    dbError(res, error);
  }
});

router.post('/merlin/campaigns', async (req, res) => {
  const parsed = validateCampaign(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  try {
    const row = await insertRow('marketing_campaigns', parsed.value);
    res.status(201).json(row);
  } catch (error) {
    dbError(res, error);
  }
});

router.post('/merlin/activity', async (req, res) => {
  const parsed = validateActivity(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  try {
    const row = await insertRow('merlin_activity_log', parsed.value);
    res.status(201).json({ logged: true, storage: storageName(), activity: row });
  } catch (error) {
    // Fire-and-forget callers (QA console) must not surface a failed network
    // line for a missing table. The body says whether the row was stored.
    if (missingTable(error)) {
      return res.status(200).json({
        logged: false,
        storage: 'supabase',
        warning: 'Merlin tables are not installed yet. Apply supabase/migrations/028_merlin_command_center.sql.',
      });
    }
    console.error('[merlin] activity log failed:', error?.message || error);
    return res.status(200).json({ logged: false, storage: storageName(), warning: 'Activity could not be stored.' });
  }
});

function patchHandler(table, validate) {
  return async (req, res) => {
    const parsed = validate(req.body, { partial: true });
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    if (!Object.keys(parsed.value).length) return res.status(400).json({ error: 'No fields to update.' });
    try {
      const row = await updateRow(table, req.params.id, parsed.value);
      if (!row) return res.status(404).json({ error: 'Not found.' });
      res.json(row);
    } catch (error) {
      dbError(res, error);
    }
  };
}

router.patch('/merlin/tasks/:id', patchHandler('tasks', validateTask));
router.patch('/merlin/templates/:id', patchHandler('templates', validateTemplate));
router.patch('/merlin/campaigns/:id', patchHandler('marketing_campaigns', validateCampaign));

function deleteHandler(table) {
  return async (req, res) => {
    try {
      const removed = await deleteRow(table, req.params.id);
      if (!removed) return res.status(404).json({ error: 'Not found.' });
      res.status(204).end();
    } catch (error) {
      dbError(res, error);
    }
  };
}

router.delete('/merlin/tasks/:id', deleteHandler('tasks'));
router.delete('/merlin/templates/:id', deleteHandler('templates'));
router.delete('/merlin/campaigns/:id', deleteHandler('marketing_campaigns'));

export default router;
