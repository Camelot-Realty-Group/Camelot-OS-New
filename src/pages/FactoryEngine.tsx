import { Bot, Cpu, Database, Activity, CheckCircle, AlertCircle, Play, Pause, Settings, RefreshCw, Mail, GitBranch } from 'lucide-react';
import { useState } from 'react';

const BOTS = [
  { id: 'radar', name: 'Radar (Bot 1)', role: 'Scout', description: 'Queries NYC PLUTO for properties with 30-100 units in the Manhattan Grid.', status: 'active', coverage: '319 properties' },
  { id: 'underwriter', name: 'Underwriter (Bot 2)', role: 'Arthur', description: 'Unmasks human decision-makers via HPD, DOB, and ACRIS waterfall.', status: 'active', success_rate: '92%' },
  { id: 'closer', name: 'Closer (Bot 3)', role: 'Jackie', description: 'Injects verified contacts into HubSpot and generates Gold Standard PDFs.', status: 'active', pipeline: '50-150 Potential Leads' },
];

export default function FactoryEngine() {
  const [activeTab, setActiveBot] = useState('radar');

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3 text-camelot-dark">
              <Cpu className="text-camelot-gold" size={28} /> Factory Engine — NYC Manhattan Grid
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Automated 3-Bot lead generation and unmasking pipeline.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 text-sm font-medium">
              <Activity size={14} /> System Online
            </span>
          </div>
        </div>
      </div>

      <div className="p-8 space-y-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {BOTS.map((bot) => (
            <div key={bot.id} className={`bg-white border rounded-xl p-5 transition-all ${activeTab === bot.id ? 'border-camelot-gold shadow-sm ring-1 ring-camelot-gold/20' : 'border-gray-200'}`}>
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 bg-camelot-navy rounded-lg flex items-center justify-center">
                  <Bot size={24} className="text-camelot-gold" />
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] uppercase tracking-widest font-bold text-gray-400">{bot.role}</span>
                  <span className="text-xs text-emerald-600 font-semibold mt-1 flex items-center gap-1">
                    <CheckCircle size={12} /> {bot.status}
                  </span>
                </div>
              </div>
              <h3 className="font-bold text-lg mt-4">{bot.name}</h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed h-12">{bot.description}</p>
              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-xs font-medium text-gray-400">
                <span>{bot.coverage || bot.success_rate || bot.pipeline}</span>
                <button onClick={() => setActiveBot(bot.id)} className="text-camelot-gold hover:underline">View Intelligence</button>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="p-5 border-b border-gray-100 bg-[#FCFBF7] flex items-center justify-between">
            <h2 className="font-bold text-gray-700 flex items-center gap-2">
              <Database size={18} className="text-camelot-gold" /> Automation Control Center
            </h2>
            <div className="flex gap-2">
              <button className="inline-flex items-center gap-2 text-sm border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors font-medium">
                <Play size={14} /> Execute Run
              </button>
              <button className="inline-flex items-center gap-2 text-sm border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors font-medium">
                <Settings size={14} /> Schedule
              </button>
            </div>
          </div>
          <div className="p-10 text-center space-y-4">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto">
              <RefreshCw className="text-gray-300 animate-spin-slow" size={32} />
            </div>
            <div>
              <h3 className="font-bold text-gray-800">Bot Intelligence Active</h3>
              <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
                The Factory Engine is currently monitoring **319 properties**. The next automated unmasking waterfall is scheduled for **3:00 AM ET**.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="font-bold text-gray-700 flex items-center gap-2 mb-4">
              <GitBranch size={18} className="text-camelot-gold" /> HubSpot Sync Logic
            </h2>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                <div className="w-2 h-2 mt-1.5 rounded-full bg-camelot-gold flex-shrink-0" />
                <p className="text-xs text-gray-600">**Pipeline:** "50-150 Potential Leads" (ID: 2128999132)</p>
              </div>
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                <div className="w-2 h-2 mt-1.5 rounded-full bg-camelot-gold flex-shrink-0" />
                <p className="text-xs text-gray-600">**Deal Title:** "1st engagement of Camelot"</p>
              </div>
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                <div className="w-2 h-2 mt-1.5 rounded-full bg-camelot-gold flex-shrink-0" />
                <p className="text-xs text-gray-600">**Association:** Linking verified human contacts to deal cards automatically.</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="font-bold text-gray-700 flex items-center gap-2 mb-4">
              <Mail size={18} className="text-camelot-gold" /> Execution Reporting
            </h2>
            <p className="text-xs text-gray-500 mb-4 leading-relaxed">
              David Goldoff is the exclusive recipient of daily reports. Distribution to interns and staff is currently disabled per David's directive.
            </p>
            <div className="p-3 bg-blue-50 text-blue-700 rounded-lg border border-blue-100 text-[11px] font-medium flex items-center gap-2">
              <CheckCircle size={14} /> Reports sent to dgoldoff@camelot.nyc
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
