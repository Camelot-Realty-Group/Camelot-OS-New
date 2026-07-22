import { useMemo, useState } from 'react';
import { FileText, Download, Loader2, Sparkles, ChevronRight, CheckCircle2, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import {
  DOCUMENT_TEMPLATES,
  getTemplatesByCategory,
  type DocumentTemplate,
  type TemplateField,
} from '@/lib/document-templates';

// Template Concierge: browse the Camelot document library by category,
// answer a short set of questions for a template, and download a
// finished, branded Word document. Templates marked "coming soon" are
// catalogued but not yet wired to a generator on the server.

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: TemplateField;
  value: string;
  onChange: (v: string) => void;
}) {
  const base =
    'w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-amber-400/60 focus:outline-none';
  if (field.type === 'textarea') {
    return (
      <textarea
        className={cn(base, 'min-h-[90px] resize-y')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.label}
      />
    );
  }
  if (field.type === 'select' && field.options) {
    return (
      <select className={base} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select…</option>
        {field.options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  }
  return (
    <input
      className={base}
      type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.label}
    />
  );
}

function TemplateFillPanel({ template, onClose }: { template: DocumentTemplate; onClose: () => void }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const missingRequired = template.fields.filter((f) => f.required && !answers[f.key]?.trim());

  const handleGenerate = async () => {
    if (missingRequired.length > 0) {
      toast.error(`Please fill in: ${missingRequired.map((f) => f.label).join(', ')}`);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/templates/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: template.id, answers }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Generation failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Camelot_${template.id}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Document generated — check your downloads.');
      onClose();
    } catch (e: any) {
      toast.error(e?.message || 'Could not generate document');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">{template.title}</h3>
        <button onClick={onClose} className="text-sm text-white/50 hover:text-white">
          Cancel
        </button>
      </div>
      <p className="text-sm text-white/60">{template.description}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {template.fields.map((field) => (
          <div key={field.key} className={field.type === 'textarea' ? 'sm:col-span-2' : ''}>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-white/50">
              {field.label}
              {field.required && <span className="text-amber-400"> *</span>}
            </label>
            <FieldInput
              field={field}
              value={answers[field.key] || ''}
              onChange={(v) => setAnswers((a) => ({ ...a, [field.key]: v }))}
            />
          </div>
        ))}
      </div>
      <button
        onClick={handleGenerate}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        Generate & Download
      </button>
    </div>
  );
}

export default function Templates() {
  const grouped = useMemo(() => getTemplatesByCategory(), []);
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = DOCUMENT_TEMPLATES.find((t) => t.id === activeId) || null;

  return (
    <div className="p-6 space-y-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Sparkles className="h-6 w-6 text-amber-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Template Concierge</h1>
          <p className="text-sm text-white/50">
            Pick a template, answer a few questions, get a branded Camelot Word document — ready to print, email, or
            download.
          </p>
        </div>
      </div>

      {active && (
        <TemplateFillPanel template={active} onClose={() => setActiveId(null)} />
      )}

      {(Object.keys(grouped) as Array<keyof typeof grouped>).map((category) => (
        <div key={category} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-white/40">{category}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {grouped[category].map((t) => (
              <button
                key={t.id}
                onClick={() => t.ready && setActiveId(t.id)}
                disabled={!t.ready}
                className={cn(
                  'flex items-start gap-3 rounded-lg border border-white/10 bg-white/5 p-4 text-left transition',
                  t.ready ? 'hover:border-amber-400/40 hover:bg-white/10 cursor-pointer' : 'opacity-50 cursor-not-allowed'
                )}
              >
                <FileText className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">{t.title}</span>
                    {t.ready ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <Clock className="h-3.5 w-3.5 text-white/30" />
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-white/50">{t.description}</p>
                  {!t.ready && <p className="mt-1 text-[10px] uppercase tracking-wide text-white/30">Coming soon</p>}
                </div>
                {t.ready && <ChevronRight className="h-4 w-4 text-white/30" />}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
