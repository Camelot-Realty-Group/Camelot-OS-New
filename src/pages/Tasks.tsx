import { FormEvent, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { createTask, deleteTask, fetchTasks, updateTask, type MerlinStorage, type MerlinTask, type TaskPriority, type TaskStatus } from '@/lib/merlin-api';

const STATUSES: { id: TaskStatus; label: string }[] = [
  { id: 'open', label: 'Open' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'blocked', label: 'Blocked' },
  { id: 'done', label: 'Done' },
];

const PRIORITIES: TaskPriority[] = ['low', 'normal', 'high', 'urgent'];

const EMPTY_FORM = {
  title: '',
  description: '',
  priority: 'normal' as TaskPriority,
  assignee: '',
  building_label: '',
  due_at: '',
};

export default function Tasks() {
  const [tasks, setTasks] = useState<MerlinTask[]>([]);
  const [storage, setStorage] = useState<MerlinStorage>('memory');
  const [warning, setWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [buildingFilter, setBuildingFilter] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchTasks({
        assignee: assigneeFilter.trim(),
        building: buildingFilter.trim(),
      });
      setTasks(data.tasks || []);
      setStorage(data.storage);
      setWarning(data.warning);
    } catch (error) {
      setWarning(error instanceof Error ? error.message : 'Could not load tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // Filters are applied from the form submit so typing does not refetch each keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<TaskStatus, MerlinTask[]>();
    STATUSES.forEach((status) => map.set(status.id, []));
    tasks.forEach((task) => {
      if (task.status === 'cancelled') return;
      const bucket = map.get(task.status);
      if (bucket) bucket.push(task);
    });
    return map;
  }, [tasks]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.title.trim()) {
      toast.error('A task needs a title.');
      return;
    }
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      priority: form.priority,
      assignee: form.assignee.trim() || null,
      building_label: form.building_label.trim() || null,
      due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
      source: 'staff',
    };
    try {
      if (editingId) {
        await updateTask(editingId, payload);
        toast.success('Task updated.');
      } else {
        await createTask(payload);
        toast.success('Task added to the queue.');
      }
      setForm(EMPTY_FORM);
      setEditingId(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the task');
    }
  };

  const move = async (task: MerlinTask, status: TaskStatus) => {
    try {
      await updateTask(task.id, { status });
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update status');
    }
  };

  const remove = async (task: MerlinTask) => {
    try {
      await deleteTask(task.id);
      if (editingId === task.id) {
        setEditingId(null);
        setForm(EMPTY_FORM);
      }
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not delete the task');
    }
  };

  const beginEdit = (task: MerlinTask) => {
    setEditingId(task.id);
    setForm({
      title: task.title,
      description: task.description || '',
      priority: task.priority,
      assignee: task.assignee || '',
      building_label: task.building_label || '',
      due_at: task.due_at ? task.due_at.slice(0, 10) : '',
    });
  };

  return (
    <div className="jarvis-grid min-h-full text-slate-100">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6 md:px-8">
        <header className="jarvis-rise">
          <p className="text-[11px] uppercase tracking-[0.36em] text-[#e8cc5a]">Task management</p>
          <h1 className="mt-1 font-heading text-4xl text-white md:text-5xl">Queue</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
            Create, assign, and move work by building or person. The board starts empty until someone — staff or Merlin — writes a real task.
          </p>
          <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-500">
            Store: {storage === 'supabase' ? 'Supabase' : 'this server’s memory (clears on restart)'}
          </p>
          {warning && <p className="mt-2 text-sm text-amber-200">{warning}</p>}
        </header>

        <form onSubmit={onSubmit} className="jarvis-panel grid gap-3 p-4 md:grid-cols-6">
          <label className="md:col-span-2 text-xs uppercase tracking-[0.16em] text-slate-400">
            Title
            <input
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm normal-case tracking-normal text-white"
              placeholder="What needs doing?"
            />
          </label>
          <label className="text-xs uppercase tracking-[0.16em] text-slate-400">
            Priority
            <select
              value={form.priority}
              onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as TaskPriority }))}
              className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm normal-case tracking-normal text-white"
            >
              {PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>{priority}</option>
              ))}
            </select>
          </label>
          <label className="text-xs uppercase tracking-[0.16em] text-slate-400">
            Assignee
            <input
              value={form.assignee}
              onChange={(event) => setForm((current) => ({ ...current, assignee: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm normal-case tracking-normal text-white"
              placeholder="Name"
            />
          </label>
          <label className="text-xs uppercase tracking-[0.16em] text-slate-400">
            Building
            <input
              value={form.building_label}
              onChange={(event) => setForm((current) => ({ ...current, building_label: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm normal-case tracking-normal text-white"
              placeholder="Address or name"
            />
          </label>
          <label className="text-xs uppercase tracking-[0.16em] text-slate-400">
            Due
            <input
              type="date"
              value={form.due_at}
              onChange={(event) => setForm((current) => ({ ...current, due_at: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm normal-case tracking-normal text-white"
            />
          </label>
          <label className="md:col-span-5 text-xs uppercase tracking-[0.16em] text-slate-400">
            Notes
            <input
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm normal-case tracking-normal text-white"
              placeholder="Optional context"
            />
          </label>
          <div className="flex items-end">
            <button type="submit" className="w-full rounded-lg bg-[#e8cc5a] px-3 py-2 text-sm font-semibold text-[#1a1404] hover:bg-[#f4e4a8]">
              {editingId ? 'Save' : 'Add task'}
            </button>
          </div>
        </form>

        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void load();
          }}
        >
          <input
            value={assigneeFilter}
            onChange={(event) => setAssigneeFilter(event.target.value)}
            placeholder="Filter by person"
            className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white"
          />
          <input
            value={buildingFilter}
            onChange={(event) => setBuildingFilter(event.target.value)}
            placeholder="Filter by building"
            className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white"
          />
          <button type="submit" className="rounded-lg border border-white/15 px-3 py-2 text-sm text-slate-200">
            Apply
          </button>
        </form>

        {loading ? (
          <p className="text-sm text-slate-400">Loading the queue…</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {STATUSES.map((status) => {
              const items = grouped.get(status.id) || [];
              return (
                <section key={status.id} className="jarvis-panel min-h-48 p-3">
                  <header className="mb-3 flex items-baseline justify-between">
                    <h2 className="font-heading text-xl text-white">{status.label}</h2>
                    <span className="text-xs text-slate-500">{items.length}</span>
                  </header>
                  {items.length === 0 ? (
                    <p className="text-sm text-slate-500">Nothing in {status.label.toLowerCase()}.</p>
                  ) : (
                    <ul className="space-y-2">
                      {items.map((task) => (
                        <li key={task.id} className="rounded-xl border border-white/10 bg-black/25 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <button type="button" onClick={() => beginEdit(task)} className="text-left text-sm font-medium text-white hover:text-[#f4e4a8]">
                              {task.title}
                            </button>
                            <span className="shrink-0 text-[10px] uppercase tracking-[0.14em] text-[#e8cc5a]">{task.priority}</span>
                          </div>
                          {(task.assignee || task.building_label) && (
                            <p className="mt-1 text-xs text-slate-400">
                              {[task.assignee, task.building_label].filter(Boolean).join(' · ')}
                            </p>
                          )}
                          {task.due_at && <p className="mt-1 text-xs text-slate-500">Due {task.due_at.slice(0, 10)}</p>}
                          <div className="mt-2 flex flex-wrap gap-1">
                            {STATUSES.filter((option) => option.id !== task.status).map((option) => (
                              <button
                                key={option.id}
                                type="button"
                                onClick={() => void move(task, option.id)}
                                className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-slate-300 hover:border-[#e8cc5a]/50"
                              >
                                {option.label}
                              </button>
                            ))}
                            <button type="button" onClick={() => void remove(task)} className="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider text-rose-200/80">
                              Remove
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
