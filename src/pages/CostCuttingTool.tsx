/**
 * Cost-Cutting Analysis Tool
 *
 * Interactive tool for analyzing building expenses and identifying savings
 * Features:
 * - Select building from dropdown
 * - Run cost analysis
 * - View identified opportunities
 * - Send proposal to property manager
 * - Track proposal status
 */

import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Clock, DollarSign, TrendingDown, Mail, Eye, Award, FileSignature, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { authenticatedApiFetch } from '../lib/api-auth';

interface CostAnalysis {
  id: string;
  building_id: string;
  building_name?: string;
  analysis_date: string;
  identified_savings: number;
  savings_percentage: number;
  fee_one_time: number;
  fee_annual_3yr: number;
  confidence_score: number;
  proposal_status: string;
  proposal_url?: string;
  claude_reasoning?: string;
}

interface SavingsOpportunity {
  id: string;
  category: string;
  current_annual_cost: number;
  benchmark_annual_cost: number;
  potential_annual_savings: number;
  savings_pct: number;
  reasoning: string;
  difficulty: string;
  timeline_months: number;
}

// Portfolio-wide KPI rollup — see 012_cost_optimization_contracts_kpis.sql
// (cost_opt_kpi_summary view). Nullable everywhere because the migration may
// not be deployed in every environment yet; the dashboard degrades to "—"
// rather than breaking the page if the view / tables don't exist.
interface CostOptKpiSummary {
  total_contracts: number | null;
  active_contracts: number | null;
  total_identified_savings: number | null;
  total_year1_fees_earned: number | null;
  total_savings_verified: number | null;
  total_quarterly_fees_earned: number | null;
  total_vendor_commission: number | null;
  vendors_certified: number | null;
  vendors_gold: number | null;
  vendors_silver: number | null;
  vendors_bronze: number | null;
  avg_vendor_rating: number | null;
}

function fmtMoney(n?: number | null) {
  if (n === null || n === undefined) return '—';
  return `$${Math.round(n).toLocaleString()}`;
}

export default function CostCuttingTool() {
  const [buildings, setBuildings] = useState<any[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<CostAnalysis | null>(null);
  const [opportunities, setOpportunities] = useState<SavingsOpportunity[]>([]);
  const [proposalEmail, setProposalEmail] = useState('');
  const [showProposalForm, setShowProposalForm] = useState(false);
  const [sendingProposal, setSendingProposal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');

  // Portfolio KPIs shown at the top of the page — total savings identified,
  // fees earned, vendor commission, active contracts, and vendor certification
  // mix, so this reads as a live program dashboard, not just a single-building
  // analysis tool.
  const [kpis, setKpis] = useState<CostOptKpiSummary | null>(null);
  const [kpisLoading, setKpisLoading] = useState(true);
  const [kpisUnavailable, setKpisUnavailable] = useState(false);

  // Load buildings on mount
  useEffect(() => {
    loadBuildings();
    loadKpis();
  }, []);

  async function loadKpis() {
    setKpisLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('cost_opt_kpi_summary')
        .select('*')
        .single();
      if (err) throw err;
      setKpis(data);
      setKpisUnavailable(false);
    } catch (err) {
      // View/tables not deployed yet (012_cost_optimization_contracts_kpis.sql
      // not run) — show the dashboard shell with placeholders instead of
      // failing the whole page.
      console.warn('Cost Optimization KPI view unavailable:', err);
      setKpis(null);
      setKpisUnavailable(true);
    } finally {
      setKpisLoading(false);
    }
  }

  async function loadBuildings() {
    try {
      const { data, error: err } = await supabase
        .from('buildings')
        .select('id, mds_code, building_name')
        .order('building_name');

      if (err) throw err;
      setBuildings(data || []);
    } catch (err) {
      console.error('Error loading buildings:', err);
      setError('Failed to load buildings');
    }
  }

  async function runAnalysis() {
    if (!selectedBuilding) {
      setError('Please select a building');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const response = await authenticatedApiFetch('/api/cost-analysis/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buildingCode: selectedBuilding,
          runAsync: false,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || `Analysis failed: ${response.statusText}`);
      }

      // Fetch the analysis from database
      if (result.analysis?.id) {
        const { data: analysisData, error: err } = await supabase
          .from('cost_savings_analysis')
          .select('*')
          .eq('id', result.analysis.id)
          .single();

        if (err) throw err;
        setAnalysis(analysisData);

        // Fetch opportunities
        const { data: oppsData, error: oppErr } = await supabase
          .from('savings_opportunities')
          .select('*')
          .eq('analysis_id', result.analysis.id)
          .order('potential_annual_savings', { ascending: false });

        if (oppErr) throw oppErr;
        setOpportunities(oppsData || []);

        setSuccessMessage('Analysis complete! Review the opportunities below.');
      }
    } catch (err) {
      console.error('Analysis error:', err);
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  }

  async function sendProposal() {
    if (!analysis || !proposalEmail) {
      setError('Please enter an email address');
      return;
    }

    setSendingProposal(true);
    setError('');

    try {
      const response = await authenticatedApiFetch(`/api/cost-analysis/${analysis.id}/send-proposal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientEmail: proposalEmail,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to send proposal');

      setSuccessMessage(`Proposal sent to ${proposalEmail}`);
      setShowProposalForm(false);
      setProposalEmail('');

      // Refresh analysis status
      const { data: updated } = await supabase
        .from('cost_savings_analysis')
        .select('*')
        .eq('id', analysis.id)
        .single();

      if (updated) setAnalysis(updated);
    } catch (err) {
      console.error('Send proposal error:', err);
      setError(err instanceof Error ? err.message : 'Failed to send proposal');
    } finally {
      setSendingProposal(false);
    }
  }

  async function acceptProposal(feeType: 'one_time' | 'annual_3yr') {
    if (!analysis) return;

    setLoading(true);
    setError('');

    try {
      const response = await authenticatedApiFetch(`/api/cost-analysis/${analysis.id}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acceptedFeeType: feeType,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to accept proposal');
      setSuccessMessage(`Proposal accepted! Invoice ${result.invoice.qb_invoice_id} created.`);

      // Refresh
      const { data: updated } = await supabase
        .from('cost_savings_analysis')
        .select('*')
        .eq('id', analysis.id)
        .single();

      if (updated) setAnalysis(updated);
    } catch (err) {
      console.error('Accept proposal error:', err);
      setError(err instanceof Error ? err.message : 'Failed to accept proposal');
    } finally {
      setLoading(false);
    }
  }

  const selectedBuildingName =
    buildings.find((b) => b.mds_code === selectedBuilding)?.building_name || selectedBuilding;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 flex items-center gap-3">
            <TrendingDown className="w-10 h-10 text-emerald-600" />
            Cost Optimization Tool
          </h1>
          <p className="text-slate-600 mt-2">
            Analyze building expenses and identify specific cost-cutting opportunities
          </p>
        </div>

        {/* Portfolio KPI Dashboard */}
        <div className="mb-8 bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Award className="w-5 h-5 text-emerald-600" />
              Program KPIs
            </h2>
            {kpisUnavailable && !kpisLoading && (
              <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
                Run 012_cost_optimization_contracts_kpis.sql in Supabase to enable live KPIs
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-100">
              <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Savings Identified</p>
              <p className="text-2xl font-bold text-emerald-700 mt-1">
                {kpisLoading ? '…' : fmtMoney(kpis?.total_identified_savings)}
              </p>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Camelot Fees Earned</p>
              <p className="text-2xl font-bold text-blue-700 mt-1">
                {kpisLoading
                  ? '…'
                  : fmtMoney((kpis?.total_year1_fees_earned || 0) + (kpis?.total_quarterly_fees_earned || 0))}
              </p>
            </div>
            <div className="p-4 bg-amber-50 rounded-lg border border-amber-100">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Vendor Commission</p>
              <p className="text-2xl font-bold text-amber-700 mt-1">
                {kpisLoading ? '…' : fmtMoney(kpis?.total_vendor_commission)}
              </p>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-1">
                <FileSignature className="w-3 h-3" /> Active Contracts
              </p>
              <p className="text-2xl font-bold text-slate-800 mt-1">
                {kpisLoading ? '…' : (kpis?.active_contracts ?? '—')}
                <span className="text-sm font-normal text-slate-400"> / {kpisLoading ? '…' : (kpis?.total_contracts ?? '—')}</span>
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200 text-center">
              <p className="text-[10px] font-bold text-yellow-700 uppercase">🥇 Gold Vendors</p>
              <p className="text-lg font-bold text-yellow-800">{kpisLoading ? '…' : (kpis?.vendors_gold ?? '—')}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-center">
              <p className="text-[10px] font-bold text-gray-600 uppercase">🥈 Silver Vendors</p>
              <p className="text-lg font-bold text-gray-700">{kpisLoading ? '…' : (kpis?.vendors_silver ?? '—')}</p>
            </div>
            <div className="p-3 bg-orange-50 rounded-lg border border-orange-200 text-center">
              <p className="text-[10px] font-bold text-orange-700 uppercase">🥉 Bronze Vendors</p>
              <p className="text-lg font-bold text-orange-800">{kpisLoading ? '…' : (kpis?.vendors_bronze ?? '—')}</p>
            </div>
            <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200 text-center flex flex-col items-center justify-center">
              <p className="text-[10px] font-bold text-indigo-700 uppercase flex items-center gap-1">
                <Users className="w-3 h-3" /> Avg Vendor Rating
              </p>
              <p className="text-lg font-bold text-indigo-800">
                {kpisLoading ? '…' : kpis?.avg_vendor_rating != null ? `${kpis.avg_vendor_rating}/10` : '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-900">{error}</p>
            </div>
          </div>
        )}

        {successMessage && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <p className="text-emerald-900">{successMessage}</p>
          </div>
        )}

        {/* Analysis Setup */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Select Building</h2>

          <div className="flex gap-4">
            <select
              value={selectedBuilding}
              onChange={(e) => setSelectedBuilding(e.target.value)}
              className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Choose a building...</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.mds_code}>
                  {b.building_name} ({b.mds_code})
                </option>
              ))}
            </select>

            <button
              onClick={runAnalysis}
              disabled={loading || !selectedBuilding}
              className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading ? 'Analyzing...' : 'Run Analysis'}
            </button>
          </div>
        </div>

        {/* Analysis Results */}
        {analysis && (
          <div className="space-y-6">
            {/* Summary Card */}
            <div className="bg-white rounded-lg shadow-md p-8">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div>
                  <p className="text-slate-600 text-sm font-semibold uppercase">Annual Savings</p>
                  <p className="text-3xl font-bold text-emerald-600 mt-1">
                    ${(analysis.identified_savings || 0).toLocaleString()}
                  </p>
                </div>

                <div>
                  <p className="text-slate-600 text-sm font-semibold uppercase">Savings %</p>
                  <p className="text-3xl font-bold text-emerald-600 mt-1">
                    {analysis.savings_percentage?.toFixed(1) || '0'}%
                  </p>
                </div>

                <div>
                  <p className="text-slate-600 text-sm font-semibold uppercase">Fee (One-Time)</p>
                  <p className="text-3xl font-bold text-slate-900 mt-1">
                    ${(analysis.fee_one_time || 0).toLocaleString()}
                  </p>
                </div>

                <div>
                  <p className="text-slate-600 text-sm font-semibold uppercase">Confidence</p>
                  <p className="text-3xl font-bold text-blue-600 mt-1">
                    {analysis.confidence_score?.toFixed(0) || '0'}%
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-6 border-t border-slate-200">
                {analysis.proposal_url && (
                  <a
                    href={analysis.proposal_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition"
                  >
                    <Eye className="w-4 h-4" />
                    View Proposal
                  </a>
                )}

                {analysis.proposal_status === 'generated' && (
                  <button
                    onClick={() => setShowProposalForm(!showProposalForm)}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition"
                  >
                    <Mail className="w-4 h-4" />
                    Send Proposal
                  </button>
                )}

                {analysis.proposal_status === 'accepted' && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-lg">
                    <CheckCircle className="w-4 h-4" />
                    Proposal Accepted
                  </div>
                )}
              </div>
            </div>

            {/* Send Proposal Form */}
            {showProposalForm && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="font-semibold text-slate-900 mb-4">Send Proposal</h3>
                <div className="flex gap-4">
                  <input
                    type="email"
                    placeholder="Property manager email..."
                    value={proposalEmail}
                    onChange={(e) => setProposalEmail(e.target.value)}
                    className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    onClick={sendProposal}
                    disabled={sendingProposal || !proposalEmail}
                    className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 disabled:opacity-50 transition"
                  >
                    {sendingProposal ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </div>
            )}

            {/* Opportunities */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-6">
                Identified Opportunities ({opportunities.length})
              </h3>

              <div className="space-y-4">
                {opportunities.map((opp) => (
                  <div key={opp.id} className="border border-slate-200 rounded-lg p-4 hover:border-emerald-300 transition">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-slate-900">{opp.category}</h4>
                      <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded text-sm font-semibold">
                        ${opp.potential_annual_savings.toLocaleString()} saved
                      </span>
                    </div>

                    <p className="text-slate-700 text-sm mb-3">{opp.reasoning}</p>

                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-slate-600">Difficulty</p>
                        <p className="font-semibold text-slate-900">{opp.difficulty}</p>
                      </div>
                      <div>
                        <p className="text-slate-600">Timeline</p>
                        <p className="font-semibold text-slate-900">{opp.timeline_months} months</p>
                      </div>
                      <div>
                        <p className="text-slate-600">Savings %</p>
                        <p className="font-semibold text-slate-900">{opp.savings_pct.toFixed(1)}%</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Fee Options */}
            {analysis.proposal_status === 'generated' && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Fee Options</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    onClick={() => acceptProposal('one_time')}
                    disabled={loading}
                    className="p-4 border-2 border-slate-200 rounded-lg hover:border-emerald-600 hover:bg-emerald-50 transition text-left"
                  >
                    <p className="font-semibold text-slate-900">One-Time Payment</p>
                    <p className="text-2xl font-bold text-emerald-600 mt-2">
                      ${(analysis.fee_one_time || 0).toLocaleString()}
                    </p>
                    <p className="text-slate-600 text-sm mt-2">Pay once, savings accrue to you</p>
                  </button>

                  <button
                    onClick={() => acceptProposal('annual_3yr')}
                    disabled={loading}
                    className="p-4 border-2 border-slate-200 rounded-lg hover:border-emerald-600 hover:bg-emerald-50 transition text-left"
                  >
                    <p className="font-semibold text-slate-900">3-Year Plan</p>
                    <p className="text-2xl font-bold text-emerald-600 mt-2">
                      ${(analysis.fee_annual_3yr || 0).toLocaleString()}/yr
                    </p>
                    <p className="text-slate-600 text-sm mt-2">Spread cost over 3 years</p>
                  </button>
                </div>
              </div>
            )}

            {/* Analysis Details */}
            <div className="bg-slate-50 rounded-lg p-6 text-sm">
              <p className="text-slate-600">
                <strong>Analyzed:</strong> {new Date(analysis.analysis_date).toLocaleDateString()}
              </p>
              <p className="text-slate-600 mt-2">
                <strong>Status:</strong> {analysis.proposal_status}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
