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
import { AlertCircle, CheckCircle, Clock, DollarSign, TrendingDown, Mail, Eye } from 'lucide-react';
import { supabase } from '../lib/supabase';

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

  // Load buildings on mount
  useEffect(() => {
    loadBuildings();
  }, []);

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
      const response = await fetch('/api/cost-analysis/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buildingCode: selectedBuilding,
          runAsync: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.statusText}`);
      }

      const result = await response.json();

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
      const response = await fetch(`/api/cost-analysis/${analysis.id}/send-proposal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientEmail: proposalEmail,
        }),
      });

      if (!response.ok) throw new Error('Failed to send proposal');

      const result = await response.json();
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
      const response = await fetch(`/api/cost-analysis/${analysis.id}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acceptedFeeType: feeType,
        }),
      });

      if (!response.ok) throw new Error('Failed to accept proposal');

      const result = await response.json();
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
