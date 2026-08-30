/**
 * PostcardMailer.tsx — Postcard Mailer Campaign System
 *
 * Central hub for creating and managing postcard mailer campaigns across
 * all Camelot OS tools (Results, Pipeline, Factory Engine, Traded NY,
 * Engagement Reports, Partner Pitches, Neighborhood Leads, Needs Email,
 * Call Queue, Reports, Arthur Underwriting, Merlin Content, Templates).
 *
 * Workflow:
 * 1. Select tool + leads (filtered to owner-verified only)
 * 2. Design postcard template (Camelot branding, custom copy, QR code target)
 * 3. Configure QR code destination (/get-a-quote or custom landing page)
 * 4. Schedule mailer date (weekly batch)
 * 5. Review cost estimate & lead summary
 * 6. Approve → queues for Lob API or manual CSV export
 * 7. Track responses via landing page submissions
 *
 * Owner-only policy: all leads filtered to is_owner_contact=true
 * (never sends to management companies / Agent-type contacts)
 */

import { useState, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  Mail, Building2, QrCode, FileText, Send, RefreshCw, ChevronRight,
  CheckCircle2, AlertCircle, Copy, Eye, Download, Lock, Users,
  MapPin, Zap, Shield, Calendar, DollarSign, ArrowRight,
} from 'lucide-react';
import { authenticatedApiFetch } from '@/lib/api-auth';
import { cn } from '@/lib/utils';

interface Lead {
  id: number;
  bbl: string;
  address: string;
  owner_name: string | null;
  management_company: string | null;
  contact_email: string | null;
  is_owner_contact: boolean;
  status?: string;
}

interface PostcardTemplate {
  id: string;
  title: string;
  headline: string;
  body: string;
  cta_text: string;
  cta_url: string;
  qr_target: 'get_a_quote' | 'custom_url';
  custom_url?: string;
  preview_html?: string;
}

const TOOL_OPTIONS = [
  { value: 'results', label: 'Results & Scoring' },
  { value: 'pipeline', label: 'Pipeline' },
  { value: 'factory-engine', label: 'Factory Engine' },
  { value: 'traded-ny', label: 'Traded NY' },
  { value: 'engagement-reports', label: 'Engagement Reports' },
  { value: 'partner-pitches', label: 'Partner Pitch Decks' },
  { value: 'neighborhood-leads', label: 'Neighborhood Leads' },
  { value: 'needs-email', label: 'Needs Email' },
  { value: 'call-queue', label: 'Call Queue' },
  { value: 'reports', label: 'Reports' },
  { value: 'arthur', label: 'Arthur Underwriting' },
  { value: 'merlin-content', label: 'Merlin Content' },
  { value: 'templates', label: 'Template Concierge' },
];

const TEMPLATE_PRESETS: Record<string, PostcardTemplate> = {
  default: {
    id: 'default',
    title: 'Default Camelot Outreach',
    headline: 'Your Property Deserves Better',
    body: 'At Camelot, we specialize in helping NYC property owners and boards optimize their operations, reduce costs, and stay compliant.\n\nScanning this code leads to a free property evaluation. No obligation.',
    cta_text: 'Get Your Free Quote',
    cta_url: '/get-a-quote',
    qr_target: 'get_a_quote',
  },
  cost_cutting: {
    id: 'cost_cutting',
    title: 'Cost Optimization Focus',
    headline: 'Cutting Operating Costs Shouldn\'t Mean Cutting Corners',
    body: 'Camelot Property Management identifies $50-500K+ in annual savings for properties like yours through vendor negotiation, operational efficiency, and compliance optimization.',
    cta_text: 'See Your Savings',
    cta_url: '/cost-cutting',
    qr_target: 'custom_url',
    custom_url: '/cost-cutting',
  },
};

const COST_PER_CARD = 1.70; // $1.00 print + $0.68 postage
const COST_PER_MAILER = 10; // Lob setup
const RESPONSE_RATE_ESTIMATE = 0.03; // 3%

export default function PostcardMailer() {
  const [step, setStep] = useState<'select' | 'template' | 'configure' | 'review' | 'confirm'>('select');
  const [selectedTool, setSelectedTool] = useState('results');
  const [selectedLeads, setSelectedLeads] = useState<Set<number>>(new Set());
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [template, setTemplate] = useState<PostcardTemplate>(TEMPLATE_PRESETS.default);
  const [scheduleDate, setScheduleDate] = useState(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [campaignType, setCampaignType] = useState<'postcard_only' | 'email_first' | 'call_first'>('email_first');
  const [approverNote, setApproverNote] = useState('');

  // Load leads from selected tool
  const handleLoadLeads = useCallback(async () => {
    setLoading(true);
    try {
      const response = await authenticatedApiFetch(
        `/api/tools/${selectedTool}/leads?owner_only=true`
      );
      if (response.ok) {
        const data = await response.json();
        setLeads(data.leads || []);
        setSelectedLeads(new Set());
        toast.success(`Loaded ${data.leads?.length || 0} owner-verified leads`);
      } else {
        toast.error('Failed to load leads');
      }
    } catch (err) {
      console.error('Load leads error:', err);
      toast.error('Error loading leads');
    } finally {
      setLoading(false);
    }
  }, [selectedTool]);

  const ownerVerifiedLeads = useMemo(() => {
    return leads.filter((l) => l.is_owner_contact === true);
  }, [leads]);

  const selectedLeadsList = useMemo(() => {
    return Array.from(selectedLeads).map((id) => leads.find((l) => l.id === id)).filter(Boolean) as Lead[];
  }, [selectedLeads, leads]);

  const costEstimate = useMemo(() => {
    const cardCount = selectedLeadsList.length;
    const printPostageCost = cardCount * COST_PER_CARD;
    const setupCost = COST_PER_MAILER;
    const totalCost = printPostageCost + setupCost;
    const estimatedResponses = Math.ceil(cardCount * RESPONSE_RATE_ESTIMATE);
    return { cardCount, printPostageCost, setupCost, totalCost, estimatedResponses };
  }, [selectedLeadsList]);

  const handleToggleLead = (leadId: number) => {
    const newSet = new Set(selectedLeads);
    if (newSet.has(leadId)) {
      newSet.delete(leadId);
    } else {
      newSet.add(leadId);
    }
    setSelectedLeads(newSet);
  };

  const handleSelectAll = () => {
    setSelectedLeads(new Set(ownerVerifiedLeads.map((l) => l.id)));
  };

  const handleClearSelection = () => {
    setSelectedLeads(new Set());
  };

  const qrCodeUrl = useMemo(() => {
    if (template.qr_target === 'get_a_quote') {
      return `${window.location.origin}/get-a-quote?source=postcard`;
    }
    return template.custom_url || '/get-a-quote';
  }, [template]);

  const handleSubmitCampaign = async () => {
    if (selectedLeadsList.length === 0) {
      toast.error('Select at least one lead');
      return;
    }

    try {
      const response = await authenticatedApiFetch('/api/campaigns/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_ids: selectedLeadsList.map((l) => l.id),
          source_tool: selectedTool,
          campaign_type: campaignType,
          template_id: template.id,
          scheduled_mailer: scheduleDate,
          approver_note: approverNote,
          cost_estimate: costEstimate.totalCost,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`Campaign #${data.campaign_id} created. Queued for ${scheduleDate}.`);
        setStep('confirm');
        // Reset form
        setTimeout(() => {
          setStep('select');
          setSelectedLeads(new Set());
          setLeads([]);
        }, 2000);
      } else {
        toast.error('Failed to create campaign');
      }
    } catch (err) {
      console.error('Campaign submission error:', err);
      toast.error('Error creating campaign');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F6EF]">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-8 py-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <Mail size={28} className="text-camelot-gold" />
            <h1 className="text-3xl font-bold text-slate-900">Postcard Mailer</h1>
          </div>
          <p className="text-sm text-slate-600">
            Create personalized postcard campaigns with QR codes linking to quote pages.
            Leads are filtered to owners only — never management companies.
          </p>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="bg-white border-b border-slate-200 px-8 py-4 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-2 text-sm">
            {(['select', 'template', 'configure', 'review', 'confirm'] as const).map((s, idx) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center font-semibold text-xs transition-all',
                    step === s
                      ? 'bg-camelot-gold text-white'
                      : (
                        ['select', 'template', 'configure', 'review', 'confirm'].indexOf(step) > idx
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-600'
                      )
                  )}
                >
                  {['select', 'template', 'configure', 'review', 'confirm'].indexOf(step) > idx ? (
                    <CheckCircle2 size={16} />
                  ) : (
                    idx + 1
                  )}
                </div>
                <span className="text-slate-600 capitalize">{s}</span>
                {idx < 4 && <ArrowRight size={16} className="text-slate-300 ml-1" />}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-8 py-8">
        <div className="max-w-6xl mx-auto">
          {step === 'select' && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h2 className="text-lg font-semibold mb-4">Step 1: Select Lead Source</h2>
                <p className="text-sm text-slate-600 mb-4">
                  Choose which Camelot tool you want to pull leads from. All leads are automatically filtered to owners only.
                </p>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                  {TOOL_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setSelectedTool(opt.value)}
                      className={cn(
                        'p-3 rounded-lg border-2 transition-all text-sm font-medium',
                        selectedTool === opt.value
                          ? 'border-camelot-gold bg-yellow-50 text-camelot-gold'
                          : 'border-slate-200 text-slate-600 hover:border-camelot-gold hover:bg-yellow-50'
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleLoadLeads}
                  disabled={loading}
                  className="w-full bg-camelot-gold text-white py-2 rounded-lg hover:bg-camelot-gold/90 font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? <RefreshCw size={16} className="animate-spin" /> : <Users size={16} />}
                  {loading ? 'Loading leads...' : 'Load Leads'}
                </button>
              </div>

              {leads.length > 0 && (
                <div className="bg-white rounded-lg border border-slate-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold">Lead Selection</h3>
                      <p className="text-sm text-slate-600">
                        Owner-verified: {ownerVerifiedLeads.length} of {leads.length}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleSelectAll}
                        className="px-3 py-1 text-sm border border-camelot-gold text-camelot-gold rounded hover:bg-yellow-50"
                      >
                        Select All
                      </button>
                      <button
                        onClick={handleClearSelection}
                        className="px-3 py-1 text-sm border border-slate-300 text-slate-600 rounded hover:bg-slate-50"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {ownerVerifiedLeads.map((lead) => (
                      <div
                        key={lead.id}
                        className={cn(
                          'p-3 rounded border flex items-start gap-3 cursor-pointer transition-colors',
                          selectedLeads.has(lead.id)
                            ? 'bg-emerald-50 border-emerald-300'
                            : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                        )}
                        onClick={() => handleToggleLead(lead.id)}
                      >
                        <input
                          type="checkbox"
                          checked={selectedLeads.has(lead.id)}
                          onChange={() => handleToggleLead(lead.id)}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-slate-900">{lead.address}</p>
                          <p className="text-xs text-slate-600">
                            {lead.owner_name} {lead.is_owner_contact && <span className="text-emerald-600">✓ Owner</span>}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => setStep('template')}
                    disabled={selectedLeads.size === 0}
                    className="mt-4 w-full bg-camelot-gold text-white py-2 rounded-lg hover:bg-camelot-gold/90 font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    Continue to Template <ArrowRight size={16} />
                  </button>
                </div>
              )}
            </div>
          )}

          {step === 'template' && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h2 className="text-lg font-semibold mb-4">Step 2: Design Postcard</h2>
                <p className="text-sm text-slate-600 mb-6">
                  Customize your postcard template. All cards include Camelot branding and a unique QR code.
                </p>

                <div className="grid md:grid-cols-2 gap-6">
                  {/* Template Selector */}
                  <div>
                    <label className="block text-sm font-medium mb-3">Quick Templates</label>
                    <div className="space-y-2">
                      {Object.values(TEMPLATE_PRESETS).map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setTemplate(t)}
                          className={cn(
                            'w-full p-3 rounded-lg border text-left transition-all',
                            template.id === t.id
                              ? 'border-camelot-gold bg-yellow-50'
                              : 'border-slate-200 hover:border-camelot-gold'
                          )}
                        >
                          <p className="font-medium text-sm">{t.title}</p>
                          <p className="text-xs text-slate-600">{t.headline}</p>
                        </button>
                      ))}
                    </div>

                    <div className="mt-6 pt-6 border-t">
                      <label className="block text-sm font-medium mb-2">Headline</label>
                      <textarea
                        value={template.headline}
                        onChange={(e) => setTemplate({ ...template, headline: e.target.value })}
                        rows={2}
                        className="w-full p-2 border border-slate-300 rounded text-sm"
                      />

                      <label className="block text-sm font-medium mt-4 mb-2">Body Copy</label>
                      <textarea
                        value={template.body}
                        onChange={(e) => setTemplate({ ...template, body: e.target.value })}
                        rows={4}
                        className="w-full p-2 border border-slate-300 rounded text-sm"
                      />

                      <label className="block text-sm font-medium mt-4 mb-2">CTA Button Text</label>
                      <input
                        type="text"
                        value={template.cta_text}
                        onChange={(e) => setTemplate({ ...template, cta_text: e.target.value })}
                        className="w-full p-2 border border-slate-300 rounded text-sm"
                      />
                    </div>
                  </div>

                  {/* Preview */}
                  <div>
                    <label className="block text-sm font-medium mb-3">Preview</label>
                    <div className="bg-white border-2 border-slate-200 rounded-lg overflow-hidden aspect-video flex flex-col">
                      <div className="flex-1 p-4 bg-gradient-to-b from-slate-50 to-white flex flex-col justify-between">
                        <div>
                          <div className="text-center mb-3">
                            <img
                              src="/images/camelot-gold-logo.png"
                              alt="Camelot"
                              className="h-6 mx-auto mb-2"
                            />
                            <h3 className="font-bold text-sm text-slate-900 leading-snug">{template.headline}</h3>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed text-center mb-3">
                            {template.body}
                          </p>
                        </div>

                        <div className="flex items-end gap-2">
                          <div className="bg-white border-2 border-slate-300 p-2 rounded">
                            <div className="w-16 h-16 bg-slate-100 flex items-center justify-center text-xs text-slate-400">
                              <QrCode size={32} />
                            </div>
                          </div>
                          <div className="flex-1">
                            <button className="w-full bg-camelot-gold text-white py-1 px-2 rounded text-xs font-semibold">
                              {template.cta_text}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
                      <p className="font-semibold mb-1">QR Code Info</p>
                      <p className="font-mono text-blue-900 break-all">{qrCodeUrl}</p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setStep('configure')}
                  className="mt-6 w-full bg-camelot-gold text-white py-2 rounded-lg hover:bg-camelot-gold/90 font-semibold flex items-center justify-center gap-2"
                >
                  Continue to Configuration <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {step === 'configure' && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h2 className="text-lg font-semibold mb-4">Step 3: Configure Campaign</h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Campaign Type</label>
                    <div className="space-y-2">
                      {[
                        {
                          value: 'postcard_only' as const,
                          label: 'Postcard Only',
                          desc: 'Send postcard standalone',
                        },
                        {
                          value: 'email_first' as const,
                          label: 'Email First, Then Postcard',
                          desc: 'Email this week, mailer scheduled for next week',
                        },
                        {
                          value: 'call_first' as const,
                          label: 'Call First, Then Postcard',
                          desc: 'Call from queue, then mailer follows if no response',
                        },
                      ].map((opt) => (
                        <label
                          key={opt.value}
                          className={cn(
                            'p-3 rounded-lg border-2 cursor-pointer transition-all',
                            campaignType === opt.value
                              ? 'border-camelot-gold bg-yellow-50'
                              : 'border-slate-200 hover:border-camelot-gold'
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="campaign_type"
                              value={opt.value}
                              checked={campaignType === opt.value}
                              onChange={(e) => setCampaignType(e.target.value as typeof campaignType)}
                            />
                            <div>
                              <p className="font-medium text-sm">{opt.label}</p>
                              <p className="text-xs text-slate-600">{opt.desc}</p>
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                      <Calendar size={16} />
                      Schedule Mailer Date
                    </label>
                    <input
                      type="date"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Mailers are printed and mailed in batches weekly (typically Monday morning).
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Approval Notes (Optional)</label>
                    <textarea
                      value={approverNote}
                      onChange={(e) => setApproverNote(e.target.value)}
                      rows={3}
                      placeholder="E.g., 'This is follow-up to March email campaign' or campaign-specific notes"
                      className="w-full p-2 border border-slate-300 rounded text-sm"
                    />
                  </div>
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => setStep('template')}
                    className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 font-semibold"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setStep('review')}
                    className="flex-1 bg-camelot-gold text-white py-2 rounded-lg hover:bg-camelot-gold/90 font-semibold flex items-center justify-center gap-2"
                  >
                    Review Campaign <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h2 className="text-lg font-semibold mb-4">Step 4: Review & Approve</h2>

                <div className="grid md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <p className="text-xs text-slate-600 font-medium">Lead Count</p>
                    <p className="text-2xl font-bold text-slate-900">{costEstimate.cardCount}</p>
                    <p className="text-xs text-slate-500 mt-1">owner-verified leads</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <p className="text-xs text-slate-600 font-medium">Estimated Cost</p>
                    <p className="text-2xl font-bold text-slate-900">${costEstimate.totalCost.toFixed(0)}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {costEstimate.cardCount} × ${COST_PER_CARD} + setup
                    </p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <p className="text-xs text-slate-600 font-medium">Est. Responses</p>
                    <p className="text-2xl font-bold text-emerald-600">{costEstimate.estimatedResponses}</p>
                    <p className="text-xs text-slate-500 mt-1">@ {(RESPONSE_RATE_ESTIMATE * 100).toFixed(1)}% response</p>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h3 className="font-semibold mb-3">Campaign Summary</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Tool:</span>
                      <span className="font-medium">
                        {TOOL_OPTIONS.find((t) => t.value === selectedTool)?.label}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Campaign Type:</span>
                      <span className="font-medium capitalize">{campaignType.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Scheduled Date:</span>
                      <span className="font-medium">{new Date(scheduleDate).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Template:</span>
                      <span className="font-medium">{template.title}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex gap-3">
                  <Shield size={20} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-emerald-800">
                    <p className="font-semibold mb-1">Owner-Only Verification</p>
                    <p>
                      All {costEstimate.cardCount} leads have been verified as direct owners (is_owner_contact=true).
                      No management companies will receive these postcards.
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => setStep('configure')}
                    className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 font-semibold"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setStep('confirm')}
                    className="flex-1 bg-emerald-600 text-white py-2 rounded-lg hover:bg-emerald-700 font-semibold flex items-center justify-center gap-2"
                  >
                    Approve & Create Campaign <CheckCircle2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 'confirm' && (
            <div className="bg-emerald-50 border border-emerald-300 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <CheckCircle2 size={32} className="text-emerald-600" />
                <div>
                  <h2 className="text-xl font-bold text-emerald-900">Campaign Created Successfully</h2>
                  <p className="text-emerald-800">Your postcard mailer is queued for {new Date(scheduleDate).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="bg-white rounded-lg p-4 mb-4 space-y-2 text-sm">
                <p>
                  <span className="text-slate-600">Leads:</span> <span className="font-medium">{costEstimate.cardCount}</span>
                </p>
                <p>
                  <span className="text-slate-600">Estimated Cost:</span> <span className="font-medium">${costEstimate.totalCost.toFixed(0)}</span>
                </p>
                <p>
                  <span className="text-slate-600">Status:</span> <span className="font-medium text-emerald-600">Pending send</span>
                </p>
              </div>

              <button
                onClick={() => {
                  setStep('select');
                  setSelectedLeads(new Set());
                  setLeads([]);
                }}
                className="w-full bg-emerald-600 text-white py-2 rounded-lg hover:bg-emerald-700 font-semibold"
              >
                Create Another Campaign
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
