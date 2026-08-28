import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense, useEffect, type ComponentType } from 'react';
import { Toaster } from 'react-hot-toast';
import Layout from '@/components/Layout';
import GuidedTour from '@/components/GuidedTour';
import OfflineBanner from '@/components/OfflineBanner';
import VersionStamp from '@/components/VersionStamp';
import { useTour } from '@/hooks/useTour';
import { useBuildings } from '@/hooks/useBuildings';

const Search = lazy(() => import('@/pages/Search'));
const Results = lazy(() => import('@/pages/Results'));
const DailyHunt = lazy(() => import('@/pages/DailyHunt'));
const Saved = lazy(() => import('@/pages/Saved'));
const Import = lazy(() => import('@/pages/Import'));
const Pipeline = lazy(() => import('@/pages/Pipeline'));
const Outreach = lazy(() => import('@/pages/Outreach'));
const Chat = lazy(() => import('@/pages/Chat'));
const Archive = lazy(() => import('@/pages/Archive'));
const Export = lazy(() => import('@/pages/Export'));
const Integrations = lazy(() => import('@/pages/Integrations'));
const Bots = lazy(() => import('@/pages/Bots'));
const Settings = lazy(() => import('@/pages/Settings'));
const Tutorials = lazy(() => import('@/pages/Tutorials'));
const Compliance = lazy(() => import('@/pages/Compliance'));
const Alerts = lazy(() => import('@/pages/Alerts'));
const Proposals = lazy(() => import('@/pages/Proposals'));
const InstantProposal = lazy(() => import('@/pages/InstantProposal'));
const Intelligence = lazy(() => import('@/pages/Intelligence'));
const Reports = lazy(() => import('@/pages/Reports'));
const ReportCenter = lazy(() => import('@/pages/ReportCenter'));
const Agreements = lazy(() => import('@/pages/Agreements'));
const Sentinel = lazy(() => import('@/pages/Sentinel'));
const Violations = lazy(() => import('@/pages/Violations'));
const LegalReportTerms = lazy(() => import('@/pages/LegalReportTerms'));
const Arthur = lazy(() => import('@/pages/Arthur'));
const ContentEngine = lazy(() => import('@/pages/ContentEngine'));
const QAConsole = lazy(() => import('@/pages/QAConsole'));
const TemplateBilling = lazy(() => import('@/pages/TemplateBilling'));
const Templates = lazy(() => import('@/pages/Templates'));
const PartnerPitches = lazy(() => import('@/pages/PartnerPitches'));
const NeighborhoodLeads = lazy(() => import('@/pages/NeighborhoodLeads'));
const TradedNY = lazy(() => import('@/pages/TradedNY'));
const CostCuttingTool = lazy(() => import('@/pages/CostCuttingTool'));
const CostBeatReportBuilder = lazy(() => import('@/pages/CostBeatReportBuilder'));
const Portfolio = lazy(() => import('@/pages/Portfolio'));
const FactoryEngine = lazy(() => import('@/pages/FactoryEngine'));
const PitchOakParkDouglaston = lazy(() => import('@/pages/PitchOakParkDouglaston'));

function page(Page: ComponentType) {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-gray-500">Loading Camelot OS...</div>}>
      <Page />
    </Suspense>
  );
}

export default function App() {
  const { loadBuildings } = useBuildings();
  const { isOpen: isTourOpen, startTour, closeTour } = useTour();

  useEffect(() => {
    loadBuildings();
  }, [loadBuildings]);

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1a1f36',
            color: '#fff',
            border: '1px solid rgba(197, 165, 90, 0.3)',
          },
        }}
      />
      <OfflineBanner />
      <GuidedTour isOpen={isTourOpen} onClose={closeTour} />
      <Layout onStartTour={startTour}>
        <Routes>
          <Route path="/" element={page(Search)} />
          <Route path="/results" element={page(Results)} />
          <Route path="/daily-hunt" element={page(DailyHunt)} />
          <Route path="/saved" element={page(Saved)} />
          <Route path="/import" element={page(Import)} />
          <Route path="/pipeline" element={page(Pipeline)} />
          <Route path="/outreach" element={page(Outreach)} />
          <Route path="/chat" element={page(Chat)} />
          <Route path="/archive" element={page(Archive)} />
          <Route path="/export" element={page(Export)} />
          <Route path="/integrations" element={page(Integrations)} />
          <Route path="/bots" element={page(Bots)} />
          <Route path="/settings" element={page(Settings)} />
          <Route path="/tutorials" element={page(Tutorials)} />
          <Route path="/compliance" element={page(Compliance)} />
          <Route path="/alerts" element={page(Alerts)} />
          <Route path="/instant-proposal" element={page(InstantProposal)} />
          <Route path="/proposals" element={page(Proposals)} />
          <Route path="/intelligence" element={page(Intelligence)} />
          <Route path="/reports" element={page(Reports)} />
          <Route path="/report-center" element={page(ReportCenter)} />
          <Route path="/partner-pitches" element={page(PartnerPitches)} />
          <Route path="/neighborhood-leads" element={page(NeighborhoodLeads)} />
          <Route path="/portfolio" element={page(Portfolio)} />
          <Route path="/cost-cutting" element={page(CostCuttingTool)} />
          <Route path="/cost-beat-report" element={page(CostBeatReportBuilder)} />
          <Route path="/factory-engine" element={page(FactoryEngine)} />
          <Route path="/traded-ny" element={page(TradedNY)} />
          <Route path="/agreements" element={page(Agreements)} />
          <Route path="/sentinel" element={page(Sentinel)} />
          <Route path="/arthur" element={page(Arthur)} />
          <Route path="/content-engine" element={page(ContentEngine)} />
          <Route path="/template-billing" element={page(TemplateBilling)} />
          <Route path="/templates" element={page(Templates)} />
          <Route path="/violations" element={page(Violations)} />
          <Route path="/legal-report-terms" element={page(LegalReportTerms)} />
          <Route path="/qa" element={page(QAConsole)} />
          <Route path="/diagnostics" element={page(QAConsole)} />
          {/* Client-facing pitch microsites — reusable pattern (Oak Park is Template #1). Renders as a full-viewport overlay so it reads as a standalone site, not the internal dashboard. */}
          <Route path="/pitch/oak-park-douglaston" element={page(PitchOakParkDouglaston)} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
      <VersionStamp />
    </>
  );
}
