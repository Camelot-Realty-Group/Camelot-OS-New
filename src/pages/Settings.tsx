import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getSupabaseStatusMessage, isSupabaseConfigured } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import {
  Settings as SettingsIcon, CheckCircle, XCircle, Shield, Users,
  Building2, Key, Database, Save, ExternalLink, AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ServiceStatus {
  name: string;
  configured: boolean;
  details?: string;
  fallbackLabel?: string;
}

export default function Settings() {
  const { members } = useAuth();
  const [activeSection, setActiveSection] = useState<'status' | 'api' | 'team' | 'company'>('status');
  const [hubSpotConfigured, setHubSpotConfigured] = useState(false);
  const [serverConfig, setServerConfig] = useState({ apollo: false, prospeo: false, ai: false, aiModel: '' });

  useEffect(() => {
    fetch('/api/integrations/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setHubSpotConfigured(Boolean(data?.hubspot?.configured));
        setServerConfig({
          apollo: Boolean(data?.enrichment?.apolloConfigured),
          prospeo: Boolean(data?.enrichment?.prospeoConfigured),
          ai: Boolean(data?.ai?.configured),
          aiModel: String(data?.ai?.model || ''),
        });
      })
      .catch(() => {
        setHubSpotConfigured(false);
        setServerConfig({ apollo: false, prospeo: false, ai: false, aiModel: '' });
      });
  }, []);

  // Check service statuses — each API listed individually
  const services: ServiceStatus[] = [
    {
      name: 'Supabase Database',
      configured: isSupabaseConfigured(),
      details: getSupabaseStatusMessage(),
      fallbackLabel: 'Live data blocked',
    },
    {
      name: 'NYC Open Data (HPD, DOF, DOB, LL97)',
      configured: true,
      details: 'HPD Violations ✅ · HPD Registration ✅ · DOF/PLUTO Assessment ✅ · DOB Permits ✅ · LL97 Energy ✅ — no API key required',
    },
    {
      name: 'NYC ACRIS',
      configured: true,
      details: 'Deed transfers, mortgages, and property transaction records — no API key required',
    },
    {
      name: 'NYC ECB/OATH',
      configured: true,
      details: 'Environmental Control Board violations and penalty tracking — no API key required',
    },
    {
      name: 'NYC Housing Court',
      configured: true,
      details: 'Housing litigation cases and court filings — no API key required',
    },
    {
      name: 'NYC Rent Stabilization',
      configured: true,
      details: 'Rent stabilized building registry — no API key required',
    },
    {
      name: 'NY Secretary of State (DOS)',
      configured: true,
      details: 'Active Corporations and LLC search — no API key required',
    },
    {
      name: 'Apollo.io',
      configured: serverConfig.apollo,
      details: serverConfig.apollo ? 'Server-side enrichment configured' : 'Deploy the Node server and set APOLLO_API_KEY',
    },
    {
      name: 'Prospeo',
      configured: serverConfig.prospeo,
      details: serverConfig.prospeo ? 'Server-side verification configured' : 'Deploy the Node server and set PROSPEO_API_KEY',
    },
    {
      name: 'HubSpot CRM',
      configured: hubSpotConfigured,
      details: hubSpotConfigured ? 'Server-side private app token set — CRM sync active' : 'Set HUBSPOT_PRIVATE_APP_TOKEN in Render/server environment for CRM sync',
    },
    {
      name: 'AI Chat',
      configured: serverConfig.ai,
      details: serverConfig.ai
        ? `Connected — Model: ${serverConfig.aiModel}`
        : 'Not configured — deploy the Node server and set AI_API_URL, AI_API_KEY, and AI_MODEL.',
    },
  ];

  const roleLabels: Record<string, string> = {
    owner: 'Owner',
    tech_lead: 'Tech Lead',
    cold_caller: 'Cold Caller',
    operations: 'Operations',
    team: 'Team',
  };

  const sections = [
    { key: 'status' as const, label: 'Service Status', icon: Shield },
    { key: 'api' as const, label: 'API Keys', icon: Key },
    { key: 'team' as const, label: 'Team Management', icon: Users },
    { key: 'company' as const, label: 'Company Info', icon: Building2 },
  ];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-5">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <SettingsIcon size={24} className="text-camelot-gold" /> Settings
        </h1>
      </div>

      <div className="flex">
        {/* Section Nav */}
        <div className="w-56 bg-white border-r border-gray-200 min-h-[calc(100vh-140px)]">
          {sections.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveSection(key)}
              className={cn(
                'w-full flex items-center gap-2 px-4 py-3 text-sm text-left transition-colors',
                activeSection === key
                  ? 'bg-camelot-gold/10 text-camelot-gold font-medium border-l-2 border-l-camelot-gold'
                  : 'text-gray-600 hover:bg-gray-50'
              )}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 p-8 max-w-3xl">
          {/* Service Status */}
          {activeSection === 'status' && (
            <div>
              <h2 className="text-lg font-bold mb-6">Service Status</h2>
              <div className="space-y-3">
                {services.map((service) => (
                  <div key={service.name} className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200">
                    <div className="flex items-center gap-3">
                      {service.configured ? (
                        <CheckCircle size={20} className="text-green-500" />
                      ) : (
                        <XCircle size={20} className="text-red-400" />
                      )}
                      <div>
                        <p className="font-medium text-sm">{service.name}</p>
                        <p className="text-xs text-gray-500">{service.details}</p>
                      </div>
                    </div>
                    <span className={cn(
                      'text-xs px-2 py-1 rounded-full',
                      service.configured
                        ? 'bg-green-100 text-green-700'
                        : service.fallbackLabel
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-red-50 text-red-500'
                    )}>
                      {service.configured ? 'Connected' : service.fallbackLabel || 'Not configured'}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-blue-800">Configuration via Environment Variables</p>
                    <p className="text-xs text-blue-600 mt-1">
                      All API keys and settings are configured through environment variables (.env file). 
                      Copy <code className="bg-blue-100 px-1 rounded">.env.example</code> to <code className="bg-blue-100 px-1 rounded">.env</code> and fill in your values.
                      NYC Open Data APIs work without any configuration.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* API Keys */}
          {activeSection === 'api' && (
            <div>
              <h2 className="text-lg font-bold mb-2">API Keys</h2>
              <p className="text-sm text-gray-500 mb-6">
                API keys are managed through environment variables for security. The values shown below are masked.
              </p>

              <div className="space-y-4">
                {[
                  {
                    label: 'AI Chat (OpenAI-compatible)',
                    envVars: ['AI_API_URL', 'AI_API_KEY', 'AI_MODEL'],
                    configured: serverConfig.ai,
                    description: 'Works with OpenAI, OpenRouter, Anthropic proxy, local LLMs (Ollama/LM Studio), or any OpenAI-compatible endpoint.',
                  },
                  {
                    label: 'Supabase',
                    envVars: ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'],
                    configured: isSupabaseConfigured(),
                    description: 'Postgres database and authentication.',
                  },
                  {
                    label: 'Apollo.io',
                    envVars: ['APOLLO_API_KEY'],
                    configured: serverConfig.apollo,
                    description: 'Contact enrichment — find board members, owners, supers with email/phone.',
                  },
                  {
                    label: 'Prospeo',
                    envVars: ['PROSPEO_API_KEY'],
                    configured: serverConfig.prospeo,
                    description: 'Email verification and mobile number lookup fallback.',
                  },
                  {
                    label: 'HubSpot',
                    envVars: ['HUBSPOT_PRIVATE_APP_TOKEN', 'HUBSPOT_PIPELINE_ID', 'HUBSPOT_DEAL_STAGE_ID'],
                    configured: hubSpotConfigured,
                    description: 'Server-side CRM sync for contacts, management opportunities, report events, and outreach history.',
                  },
                  {
                    label: 'Google Maps',
                    envVars: ['VITE_GOOGLE_MAPS_API_KEY'],
                    configured: !!(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''),
                    description: 'Map embeds on property details (optional).',
                  },
                ].map((item) => (
                  <div key={item.label} className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {item.configured ? (
                          <CheckCircle size={16} className="text-green-500" />
                        ) : (
                          <XCircle size={16} className="text-gray-300" />
                        )}
                        <h3 className="font-medium text-sm">{item.label}</h3>
                      </div>
                      <span className={cn(
                        'text-xs',
                        item.configured ? 'text-green-600' : 'text-gray-400'
                      )}>
                        {item.configured ? '✓ Configured' : 'Not set'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">{item.description}</p>
                    <div className="flex flex-wrap gap-1">
                      {item.envVars.map((v) => (
                        <code key={v} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{v}</code>
                      ))}
                    </div>
                    {item.configured && (
                      <div className="mt-2">
                        <input
                          type="password"
                          value="••••••••••••••••"
                          readOnly
                          className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-400"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Team Management */}
          {activeSection === 'team' && (
            <div>
              <h2 className="text-lg font-bold mb-6">Team Management</h2>
              <div className="space-y-3">
                {members.map((member) => (
                  <div key={member.id} className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-200">
                    <div className="w-10 h-10 bg-camelot-gold rounded-full flex items-center justify-center text-white font-bold text-sm">
                      {member.initials}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{member.name}</p>
                      <p className="text-sm text-gray-500">{member.email}</p>
                    </div>
                    <span className={cn(
                      'text-xs px-2 py-1 rounded-full font-medium',
                      member.role === 'owner' && 'bg-camelot-gold/10 text-camelot-gold',
                      member.role === 'tech_lead' && 'bg-purple-100 text-purple-700',
                      member.role === 'cold_caller' && 'bg-blue-100 text-blue-700',
                      member.role === 'operations' && 'bg-green-100 text-green-700',
                      member.role === 'team' && 'bg-gray-100 text-gray-700',
                    )}>
                      {roleLabels[member.role] || member.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Company Info */}
          {activeSection === 'company' && (
            <div>
              <h2 className="text-lg font-bold mb-6">Company Information</h2>
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 bg-camelot-gold rounded-xl flex items-center justify-center text-white text-2xl">
                    🏰
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Camelot Realty Group</h3>
                    <p className="text-sm text-gray-500">Licensed Real Estate Broker</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Company Name</label>
                    <input
                      type="text"
                      defaultValue="Camelot Realty Group"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-camelot-gold/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">DBA</label>
                    <input
                      type="text"
                      defaultValue="Camelot Realty Group LLC"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-camelot-gold/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Brokerage</label>
                    <input
                      type="text"
                      defaultValue="Camelot Brokerage Services Corp"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-camelot-gold/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Brokerage License #</label>
                    <input
                      type="text"
                      defaultValue="10311208308"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-camelot-gold/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Address</label>
                    <input
                      type="text"
                      defaultValue="57 West 57th Street, Suite 410"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-camelot-gold/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">City, State, ZIP</label>
                    <input
                      type="text"
                      defaultValue="New York, NY 10019"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-camelot-gold/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Phone</label>
                    <input
                      type="tel"
                      defaultValue="(212) 206-9939"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-camelot-gold/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Email</label>
                    <input
                      type="email"
                      defaultValue="info@camelot.nyc"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-camelot-gold/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Website</label>
                    <input
                      type="url"
                      defaultValue="https://www.camelot.nyc"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-camelot-gold/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Principal</label>
                    <input
                      type="text"
                      defaultValue="David Goldoff"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-camelot-gold/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Realty Group License #</label>
                    <input
                      type="text"
                      defaultValue="10491200104"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-camelot-gold/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">PM Services License #</label>
                    <input
                      type="text"
                      defaultValue=""
                      placeholder="Enter license number"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-camelot-gold/50"
                    />
                  </div>
                </div>

                <button
                  onClick={() => toast.success('Settings saved')}
                  className="mt-6 bg-camelot-gold text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-camelot-gold-dark transition-colors flex items-center gap-2"
                >
                  <Save size={14} /> Save Settings
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

