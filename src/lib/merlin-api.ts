export type MerlinStorage = 'memory' | 'supabase';

export type TaskStatus = 'open' | 'in_progress' | 'blocked' | 'done' | 'cancelled';
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';
export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed';
export type TemplateKind = 'proposal' | 'letter' | 'notice' | 'board_report' | 'email' | 'other';

export interface MerlinTask {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  building_label: string | null;
  assignee: string | null;
  due_at: string | null;
  source: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MerlinTemplate {
  id: string;
  slug: string | null;
  title: string;
  category: string;
  kind: TemplateKind;
  body: string;
  description: string | null;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface MerlinCampaign {
  id: string;
  name: string;
  channel: string | null;
  status: CampaignStatus;
  audience: string | null;
  summary: string | null;
  owner: string | null;
  created_at: string;
  updated_at: string;
}

export interface MerlinActivity {
  id: string;
  actor: string;
  action: string;
  module: string | null;
  summary: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface MerlinSummary {
  storage: MerlinStorage;
  warning: string | null;
  tasks: Record<TaskStatus | 'total', number>;
  campaigns: Record<CampaignStatus | 'total', number>;
  templates: { total: number };
  activity: MerlinActivity[];
}

export interface MerlinListResponse<T> {
  storage: MerlinStorage;
  warning: string | null;
  tasks?: T[];
  templates?: T[];
  campaigns?: T[];
  activity?: T[];
}

async function merlinFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers || {});
  if (init?.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const res = await fetch(path, { ...init, headers });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = typeof data?.error === 'string' ? data.error : `Merlin request failed (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

export function fetchMerlinSummary() {
  return merlinFetch<MerlinSummary>('/api/merlin/summary');
}

export function fetchTasks(params: { status?: string; assignee?: string; building?: string; q?: string } = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) qs.set(key, value);
  });
  const suffix = qs.toString() ? `?${qs}` : '';
  return merlinFetch<MerlinListResponse<MerlinTask> & { tasks: MerlinTask[] }>(`/api/merlin/tasks${suffix}`);
}

export function createTask(body: Partial<MerlinTask> & { title: string }) {
  return merlinFetch<MerlinTask>('/api/merlin/tasks', { method: 'POST', body: JSON.stringify(body) });
}

export function updateTask(id: string, body: Partial<MerlinTask>) {
  return merlinFetch<MerlinTask>(`/api/merlin/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export function deleteTask(id: string) {
  return merlinFetch<void>(`/api/merlin/tasks/${id}`, { method: 'DELETE' });
}

export function fetchTemplates(params: { q?: string; kind?: string; category?: string } = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) qs.set(key, value);
  });
  const suffix = qs.toString() ? `?${qs}` : '';
  return merlinFetch<MerlinListResponse<MerlinTemplate> & { templates: MerlinTemplate[] }>(`/api/merlin/templates${suffix}`);
}

export function createTemplate(body: Partial<MerlinTemplate> & { title: string }) {
  return merlinFetch<MerlinTemplate>('/api/merlin/templates', { method: 'POST', body: JSON.stringify(body) });
}

export function deleteTemplate(id: string) {
  return merlinFetch<void>(`/api/merlin/templates/${id}`, { method: 'DELETE' });
}

export function fetchCampaigns() {
  return merlinFetch<MerlinListResponse<MerlinCampaign> & { campaigns: MerlinCampaign[] }>('/api/merlin/campaigns');
}

export function createCampaign(body: Partial<MerlinCampaign> & { name: string }) {
  return merlinFetch<MerlinCampaign>('/api/merlin/campaigns', { method: 'POST', body: JSON.stringify(body) });
}

export function updateCampaign(id: string, body: Partial<MerlinCampaign>) {
  return merlinFetch<MerlinCampaign>(`/api/merlin/campaigns/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export function logMerlinActivity(body: { actor?: string; action: string; module?: string; summary?: string; metadata?: Record<string, unknown> }) {
  return merlinFetch<{ logged: boolean; warning?: string }>('/api/merlin/activity', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
