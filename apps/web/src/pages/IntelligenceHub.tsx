import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { dbService, authService } from '../services/firebase';
import type { CompanyIntelligence, UserConviction, Holding } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import IntelligenceService from '../services/intelligenceService';
import { ExportService } from '../services/exportService';
import { ResearchEngine } from '../services/researchEngine';
import type { ResearchReport } from '../services/researchEngine';
import { CopilotService } from '../services/copilotService';
import type { CopilotMessage } from '../services/copilotService';
import { ProvenanceBadge } from '../components/ProvenanceBadge';
import { CompanyRegistry } from '../services/companyRegistry';
import {
  Brain,
  Shield,
  Search,
  FileText,
  RefreshCw,
  Download,
  Activity,
  Briefcase,
  AlertTriangle,
  ExternalLink,
  MessageSquare,
  Send
} from 'lucide-react';

export const IntelligenceHub: React.FC = () => {
  const { user } = useAuth();
  const { ticker: urlTicker } = useParams<{ ticker?: string }>();
  const navigate = useNavigate();

  // Core portfolio state
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [convictions, setConvictions] = useState<UserConviction[]>([]);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState<string | null>(null);
  
  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  
  // Workspace Active Tab
  const [activeTab, setActiveTab] = useState<'overview' | 'research' | 'financials' | 'smart_money' | 'business_school' | 'copilot'>('overview');

  // Selected asset details for active Company Workspace
  const [selectedAsset, setSelectedAsset] = useState<{
    ticker: string;
    exchange: string;
    intel: CompanyIntelligence | null;
    conviction: UserConviction | null;
  } | null>(null);

  const [researchReport, setResearchReport] = useState<ResearchReport | null>(null);
  const [researchLoading, setResearchLoading] = useState(false);

  // Business School State
  const [bsConcept, setBsConcept] = useState<string>('operating_leverage');
  const [bsCaseData, setBsCaseData] = useState<any | null>(null);
  const [bsLoading, setBsLoading] = useState(false);

  // Workspace Inline Copilot State
  const [copilotMessages, setCopilotMessages] = useState<CopilotMessage[]>([]);
  const [copilotInput, setCopilotInput] = useState('');
  const [copilotSending, setCopilotSending] = useState(false);
  const [copilotSessionId, setCopilotSessionId] = useState<string | null>(null);
  const copilotEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  // Synchronize when holdings list is populated and urlTicker changes
  useEffect(() => {
    if (urlTicker && holdings.length > 0) {
      const cleanTicker = urlTicker.toUpperCase();
      const match = holdings.find(h => h.ticker.toUpperCase() === cleanTicker);
      const exchange = match ? match.exchange : (CompanyRegistry.getEntry(cleanTicker)?.exchange || 'NASDAQ');
      handleSelectAsset(cleanTicker, exchange);
    }
  }, [urlTicker, holdings]);

  // Scroll to bottom of chat when new message arrives in workspace Copilot
  useEffect(() => {
    copilotEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [copilotMessages]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const userHoldings = await dbService.getHoldings(user.uid);
      setHoldings(userHoldings);
      
      const userConvictions = await IntelligenceService.fetchAllConvictions();
      setConvictions(userConvictions);

      // Auto-route to first non-cash holding if no URL parameter is loaded
      if (!urlTicker) {
        const firstAsset = userHoldings.find(h => h.ticker !== 'CASH');
        if (firstAsset) {
          navigate(`/intelligence/${firstAsset.ticker.toLowerCase()}`, { replace: true });
        }
      } else {
        const cleanTicker = urlTicker.toUpperCase();
        const match = userHoldings.find(h => h.ticker.toUpperCase() === cleanTicker);
        const exchange = match ? match.exchange : (CompanyRegistry.getEntry(cleanTicker)?.exchange || 'NASDAQ');
        handleSelectAsset(cleanTicker, exchange, userConvictions);
      }

      // Auto-recalculate missing convictions in background (Self-Healing)
      for (const h of userHoldings) {
        const hasConv = userConvictions.some(
          c => c.ticker.toUpperCase() === h.ticker.toUpperCase() && c.exchange.toUpperCase() === h.exchange.toUpperCase()
        );
        if (!hasConv && h.ticker !== 'CASH') {
          IntelligenceService.recalculateConviction(h.ticker, h.exchange).then(newConv => {
            if (newConv) {
              setConvictions(prev => {
                if (prev.some(c => c.ticker === newConv.ticker && c.exchange === newConv.exchange)) {
                  return prev.map(c => (c.ticker === newConv.ticker && c.exchange === newConv.exchange) ? newConv : c);
                }
                return [...prev, newConv];
              });
            }
          });
        }
      }
    } catch (err) {
      console.error('Error loading intelligence data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAsset = async (ticker: string, exchange: string, currentConvictions = convictions) => {
    setSelectedAsset({ ticker, exchange, intel: null, conviction: null });
    setResearchReport(null);
    setResearchLoading(true);
    
    // Reset workspace Copilot logs
    setCopilotMessages([
      {
        id: 'welcome',
        sender: 'copilot',
        content: `Mounted **${ticker}** workspace context. Ask me anything about its moat structure, smart money registries, or recent financial parameters.`,
        timestamp: new Date().toISOString()
      }
    ]);
    setCopilotSessionId(null);

    try {
      const intel = await IntelligenceService.fetchCompanyIntelligence(ticker, exchange);
      const conv = currentConvictions.find(
        c => c.ticker.toUpperCase() === ticker.toUpperCase() && c.exchange.toUpperCase() === exchange.toUpperCase()
      ) || null;
      
      setSelectedAsset({ ticker, exchange, intel, conviction: conv });

      const report = await ResearchEngine.generateResearchReport(ticker, exchange, authService.isMock);
      setResearchReport(report);
    } catch (e) {
      console.error('Error selecting asset details:', e);
    } finally {
      setResearchLoading(false);
    }
  };

  const handleRecalculate = async (ticker: string, exchange: string) => {
    setRecalculating(`${ticker}:${exchange}`);
    try {
      const updatedConv = await IntelligenceService.recalculateConviction(ticker, exchange);
      if (updatedConv) {
        // Refresh conviction list
        const updatedList = convictions.map(c => 
          (c.ticker.toUpperCase() === ticker.toUpperCase() && c.exchange.toUpperCase() === exchange.toUpperCase()) 
            ? updatedConv 
            : c
        );
        if (!convictions.some(c => c.ticker.toUpperCase() === ticker.toUpperCase() && c.exchange.toUpperCase() === exchange.toUpperCase())) {
          updatedList.push(updatedConv);
        }
        setConvictions(updatedList);
        
        // Refresh detail panel
        if (selectedAsset && selectedAsset.ticker === ticker && selectedAsset.exchange === exchange) {
          const intel = await IntelligenceService.fetchCompanyIntelligence(ticker, exchange);
          setSelectedAsset({ ticker, exchange, intel, conviction: updatedConv });
          
          setResearchLoading(true);
          try {
            const report = await ResearchEngine.generateResearchReport(ticker, exchange, authService.isMock);
            setResearchReport(report);
          } catch (reErr) {
            console.error('Failed to regenerate research report:', reErr);
          } finally {
            setResearchLoading(false);
          }
        }
      }
    } catch (err) {
      console.error('Failed to recalculate conviction:', err);
    } finally {
      setRecalculating(null);
    }
  };

  // Compile business school dynamic concept case study
  const fetchCaseStudy = async () => {
    if (!selectedAsset) return;
    setBsLoading(true);
    setBsCaseData(null);
    try {
      const data = await IntelligenceService.fetchBusinessSchoolCase(bsConcept, selectedAsset.ticker, selectedAsset.exchange);
      setBsCaseData(data);
    } catch (err) {
      console.error('Error compiling case study:', err);
    } finally {
      setBsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedAsset && activeTab === 'business_school') {
      fetchCaseStudy();
    }
  }, [bsConcept, selectedAsset?.ticker, activeTab]);

  // Synchronize selectedAsset's conviction when convictions list updates
  useEffect(() => {
    if (selectedAsset) {
      const match = convictions.find(
        c => c.ticker.toUpperCase() === selectedAsset.ticker.toUpperCase() && 
             c.exchange.toUpperCase() === selectedAsset.exchange.toUpperCase()
      );
      if (match && (!selectedAsset.conviction || selectedAsset.conviction.overallScore !== match.overallScore || selectedAsset.conviction.updatedAt !== match.updatedAt)) {
        setSelectedAsset(prev => prev ? { ...prev, conviction: match } : null);
      }
    }
  }, [convictions, selectedAsset]);

  const handleSendCopilotMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!copilotInput.trim() || !selectedAsset) return;

    const userText = copilotInput.trim();
    setCopilotInput('');

    const userMsg: CopilotMessage = {
      id: `user_${Date.now()}`,
      sender: 'user',
      content: userText,
      timestamp: new Date().toISOString()
    };
    setCopilotMessages(prev => [...prev, userMsg]);
    setCopilotSending(true);

    try {
      let activeId = copilotSessionId;
      if (!activeId) {
        const session = await CopilotService.createSession(`Company Workspace Chat for ${selectedAsset.ticker}`, 'deep', authService.isMock);
        activeId = session.id;
        setCopilotSessionId(activeId);
      }
      
      const reply = await CopilotService.sendChatMessage(activeId, `${userText} (grounded active context: ${selectedAsset.ticker})`, authService.isMock);
      setCopilotMessages(prev => [...prev, reply]);
    } catch (err) {
      console.error('Workspace Copilot error:', err);
      setCopilotMessages(prev => [...prev, {
        id: `err_${Date.now()}`,
        sender: 'copilot',
        content: 'Failed to process chat query. Please verify server connection.',
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setCopilotSending(false);
    }
  };

  const formatFreshness = (isoString?: string) => {
    if (!isoString) return 'Pending update';
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins} min ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours} hr ago`;
      return new Date(isoString).toLocaleDateString();
    } catch {
      return 'N/A';
    }
  };

  // Narrative thesis logic
  const getExecutiveThesis = (intel: CompanyIntelligence, conviction: UserConviction | null) => {
    if (!conviction) return `${intel.name} represents a standard asset holding currently under quantitative model scoring review.`;
    const score = conviction.overallScore;
    const moat = intel.research.moatRating.toUpperCase();
    const classification = score >= 75 ? 'Core Wide-Moat Compounder' : score >= 50 ? 'Tactical Value Play' : 'Surveillance Position';
    return `An investment index of ${score}/100 classifies ${intel.name} as a ${classification}. Its structural value is supported by a ${moat} economic moat framework, trading in ${intel.dip.dipDetected ? 'an active pullback phase' : 'normal price boundaries'} relative to long-term trend lines.`;
  };

  const getPrimaryOpportunity = (intel: CompanyIntelligence) => {
    if (intel.dip.dipDetected) {
      return `Technical dip detected at a classified ${(intel.dip.classification || 'Healthy').toLowerCase()} reset. The Z-Score price deviation of ${(intel.dip.zScore || 0).toFixed(2)}σ offers a statistical margin-of-safety buy opportunity, anticipating long-term mean reversion.`;
    }
    return `Sustained cash efficiency is indicated by a Free Cash Flow Margin of ${(intel.research.freeCashFlowMargin || 0).toFixed(1)}%. Revenue growth (+${(intel.research.fundamentals?.revenueGrowthYoy || 0).toFixed(1)}% YoY) is structurally sound, allowing compound interest expansion without requiring dilutive credit.`;
  };

  const getPrimaryRisk = (intel: CompanyIntelligence) => {
    const dToE = intel.research.fundamentals?.debtToEquity;
    const leverageRisk = dToE !== null && dToE !== undefined && dToE > 0.40 
      ? `Debt-to-equity leverage sits at ${dToE.toFixed(2)}, which exceeds the optimal solvency target of 0.40.`
      : `High capitalization requirements or macro interest exposure.`;
    
    const generalRisks = intel.research.majorRisks && intel.research.majorRisks.length > 0 
      ? `Primary market catalyst risk includes: ${intel.research.majorRisks[0]}.`
      : `No immediate solvency triggers detected.`;
      
    return `${leverageRisk} ${generalRisks} Current catalyst alert: "${intel.dip.catalyst || 'Baseline structural competition'}".`;
  };

  // Filter lists
  const activeHoldings = holdings.filter(h => h.ticker !== 'CASH');
  
  const filteredHoldings = activeHoldings.filter(h => {
    const search = searchTerm.toLowerCase();
    return h.ticker.toUpperCase().includes(search.toUpperCase()) || h.name.toLowerCase().includes(search);
  });

  const totalAssetsCount = activeHoldings.length;
  const highConvCount = convictions.filter(c => c.overallScore >= 75).length;
  
  const activeDipsCount = activeHoldings.filter(h => {
    const match = convictions.find(c => c.ticker.toUpperCase() === h.ticker.toUpperCase());
    return match && match.breakdown.dipFactor.score > 10;
  }).length;
  
  const strongSmartMoneyCount = convictions.filter(c => c.breakdown.institutionalFactor.score >= 18).length;
  
  const averageQualityIndex = convictions.length > 0
    ? Math.round(convictions.reduce((acc, curr) => acc + (curr.breakdown.fundamentalFactor.score), 0) / convictions.length)
    : 0;

  return (
    <div className="workspace-page" style={{ animation: 'fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards', textAlign: 'left', background: 'var(--bg-main)' }}>
      {/* Keyframe Injection for Pulsing Elements, Spinners and Hover-lifts */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes spinner-rot { to { transform: rotate(360deg); } }
        .spin-custom { animation: spinner-rot 1s linear infinite; }
        .premium-card {
          background: #FFFFFF;
          border: 1px solid #E2DACD;
          box-shadow: 0 4px 15px rgba(140, 130, 120, 0.04);
          transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease, border-color 0.2s ease;
        }
        .premium-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(140, 130, 120, 0.09) !important;
          border-color: #CFC5B6;
        }
        .asset-list-item {
          transition: background-color 0.15s ease, border-color 0.15s ease;
        }
        .asset-list-item:hover {
          background-color: #FAF8F5;
        }
        .tab-btn {
          position: relative;
          padding: 0.8rem 1.2rem;
          border: none;
          background: transparent;
          font-family: var(--font-sans);
          font-size: 0.82rem;
          cursor: pointer;
          color: #555555;
          font-weight: 500;
          transition: color 0.15s ease;
        }
        .tab-btn:hover {
          color: var(--color-accent);
        }
        .tab-btn.active {
          color: var(--color-accent);
          font-weight: bold;
        }
        .tab-btn.active::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 3px;
          background-color: var(--color-accent);
        }
        .chat-bubble {
          max-width: 80%;
          padding: 0.75rem 1.1rem;
          font-size: 0.82rem;
          line-height: 1.5;
          box-shadow: 0 1px 3px rgba(0,0,0,0.03);
          border: 1px solid #E2DACD;
        }
      `}} />

      {/* FT-Style Editorial Header */}
      <header className="workspace-header" style={{ borderBottom: '2px solid #222222', paddingBottom: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'space-between', alignItems: 'flex-start' }} className="md:flex-row md:items-end">
          <div>
            <div style={{ fontStyle: 'normal', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--color-accent)', marginBottom: '0.35rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="pulse-heartbeat" style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-accent)', display: 'inline-block' }}></span>
              Institutional Sovereign Intelligence Hub
            </div>
            <h1 className="font-serif" style={{ border: 'none', padding: 0, margin: 0, fontSize: '2.6rem', color: '#1A1A1A', fontWeight: 'normal', fontStyle: 'italic' }}>
              Company Workspaces
            </h1>
            <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.88rem', color: 'var(--text-secondary)', maxWidth: '550px', fontFamily: 'var(--font-serif)', fontStyle: 'italic', lineHeight: '1.5' }}>
              Algorithmic sovereign research workspaces mapping capital structures, smart money registries, and discount pullbacks.
            </p>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)', borderLeft: '2px solid var(--color-accent)', paddingLeft: '0.75rem' }}>
            <div>WORKSPACE STATUS: OPERATIONAL</div>
            <div>MONITORED SECURITIES: {totalAssetsCount}</div>
            <div>SYS DATE: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' }).toUpperCase()}</div>
          </div>
        </div>
      </header>

      {loading ? (
        <div style={{ paddingTop: '6rem', paddingBottom: '6rem', textAlign: 'center', fontFamily: 'var(--font-serif)', fontSize: '1.1rem', fontStyle: 'italic', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', justifyContent: 'center', minHeight: '40vh' }}>
          <RefreshCw size={28} className="spin-custom" style={{ color: 'var(--color-accent)' }} />
          Syncing holdings database and resolving institutional metrics...
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* SECTION 1 — INTELLIGENCE COMMAND CENTER */}
          <section aria-label="Intelligence Command Center" className="premium-card" style={{ padding: '1.5rem', borderRadius: '8px' }}>
            <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-accent)', fontWeight: 'bold', borderBottom: '1px solid #EAE5DB', paddingBottom: '0.5rem', marginBottom: '1rem', margin: 0 }}>
              [Portfolio Intelligence Metrics Center]
            </h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '1rem' }}>
              {/* Total Assets */}
              <div style={{ padding: '0.85rem 1rem', border: '1px solid #EAE5DB', background: '#FCFAF6' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Monitored Assets</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem', marginTop: '0.25rem' }}>
                  <span style={{ fontFamily: 'var(--font-serif)', fontSize: '1.8rem', fontWeight: 'bold', color: '#1A1A1A' }}>{totalAssetsCount}</span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>Assets</span>
                </div>
                <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-serif)', lineHeight: '1.2' }}>
                  Active non-cash equity holdings.
                </p>
              </div>

              {/* High Conviction */}
              <div style={{ padding: '0.85rem 1rem', border: '1px solid #EAE5DB', background: '#FCFAF6' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>High Conviction</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem', marginTop: '0.25rem' }}>
                  <span style={{ fontFamily: 'var(--font-serif)', fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--color-accent)' }}>{highConvCount}</span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 'bold', color: 'var(--color-accent)' }}>Flags</span>
                </div>
                <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-serif)', lineHeight: '1.2' }}>
                  Conviction index threshold &ge; 75.
                </p>
              </div>

              {/* Pullback Targets */}
              <div style={{ padding: '0.85rem 1rem', border: '1px solid #EAE5DB', background: '#FCFAF6' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Active Pullback Targets</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem', marginTop: '0.25rem' }}>
                  <span style={{ fontFamily: 'var(--font-serif)', fontSize: '1.8rem', fontWeight: 'bold', color: '#B45309' }}>{activeDipsCount}</span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 'bold', color: '#B45309' }}>Spikes</span>
                </div>
                <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-serif)', lineHeight: '1.2' }}>
                  Significant price z-score deviations.
                </p>
              </div>

              {/* Institutional Spikes */}
              <div style={{ padding: '0.85rem 1rem', border: '1px solid #EAE5DB', background: '#FCFAF6' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Institutional Spikes</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem', marginTop: '0.25rem' }}>
                  <span style={{ fontFamily: 'var(--font-serif)', fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--color-success-text)' }}>{strongSmartMoneyCount}</span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 'bold', color: 'var(--color-success-text)' }}>Holdings</span>
                </div>
                <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-serif)', lineHeight: '1.2' }}>
                  Strong corporate insider accumulation.
                </p>
              </div>

              {/* Quality Index */}
              <div style={{ padding: '0.85rem 1rem', border: '1px solid #EAE5DB', background: '#FCFAF6' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Average Quality Index</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem', marginTop: '0.25rem' }}>
                  <span style={{ fontFamily: 'var(--font-serif)', fontSize: '1.8rem', fontWeight: 'bold', color: '#1A1A1A' }}>{averageQualityIndex}</span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>/100</span>
                </div>
                <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-serif)', lineHeight: '1.2' }}>
                  Weighted moat durability rating.
                </p>
              </div>
            </div>
          </section>

          {/* SPLIT PANE: DIRECTORY & WORKSPACE */}
          <div className="workspace-body" style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '2rem', height: '100%', overflow: 'hidden' }}>
            
            {/* LEFT COLUMN: ACTIVE MONITORED ASSETS DIRECTORY */}
            <div className="scrollable-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingRight: '0.5rem' }}>
              <section className="premium-card" style={{ padding: '1.25rem', borderRadius: '8px' }}>
                <div style={{ borderBottom: '1px solid #E2DACD', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
                  <h2 style={{ fontSize: '1.15rem', margin: 0, padding: 0, fontFamily: 'var(--font-serif)', color: '#1A1A1A', fontWeight: 'bold' }}>
                    Sovereign Directory
                  </h2>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Search and mount context</span>
                </div>

                <div style={{ position: 'relative', marginBottom: '1rem' }}>
                  <Search size={13} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    placeholder="Search directory..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.72rem',
                      padding: '0.45rem 0.5rem 0.45rem 2rem',
                      background: '#FCFAF6',
                      border: '1px solid #E2DACD',
                      width: '100%',
                      outline: 'none',
                      transition: 'border-color 0.15s ease'
                    }}
                    onFocus={e => e.currentTarget.style.borderColor = '#1A1A1A'}
                    onBlur={e => e.currentTarget.style.borderColor = '#E2DACD'}
                    aria-label="Search Monitored Directory"
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {filteredHoldings.length === 0 ? (
                    <div style={{ padding: '2rem 0', textAlign: 'center', fontFamily: 'var(--font-serif)', fontSize: '0.75rem', fontStyle: 'italic', color: 'var(--text-muted)' }}>
                      No assets found.
                    </div>
                  ) : (
                    filteredHoldings.map(h => {
                      const scoreRecord = convictions.find(
                        c => c.ticker.toUpperCase() === h.ticker.toUpperCase() && c.exchange.toUpperCase() === h.exchange.toUpperCase()
                      );
                      const isSelected = selectedAsset?.ticker === h.ticker && selectedAsset?.exchange === h.exchange;
                      return (
                        <div
                          key={h.id}
                          onClick={() => navigate(`/intelligence/${h.ticker.toLowerCase()}`)}
                          className="asset-list-item"
                          style={{ 
                            borderLeft: isSelected ? '4px solid var(--color-accent)' : '4px solid transparent',
                            padding: '0.65rem 0.75rem',
                            border: '1px solid ' + (isSelected ? '#CFC5B6' : '#E2DACD'),
                            background: isSelected ? '#FCFAF6' : '#FFFFFF',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <div>
                            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8rem', fontWeight: 'bold', color: isSelected ? 'var(--color-accent)' : '#1A1A1A' }}>{h.ticker}</div>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-secondary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '140px' }}>{h.name}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontFamily: 'var(--font-serif)', fontSize: '1rem', fontWeight: 'bold', color: '#1A1A1A' }}>
                              {scoreRecord ? scoreRecord.overallScore : '—'}
                            </span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>CONV</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>
            </div>

            {/* RIGHT COLUMN: FLAGSHIP COMPANY WORKSPACE */}
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
              <section className="premium-card" style={{ padding: '1.75rem', borderRadius: '8px', display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden' }}>
                
                {!selectedAsset ? (
                  <div style={{ padding: '6rem 2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
                    <div style={{ padding: '1rem', background: '#FCFAF6', border: '1px solid #E2DACD', color: 'var(--color-accent)' }}>
                      <Brain size={36} />
                    </div>
                    <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', fontStyle: 'italic', margin: 0 }}>No Ticker Mounted</h3>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', maxWidth: '350px', lineHeight: '1.5', fontFamily: 'var(--font-serif)', margin: 0 }}>
                      Select a company from the directory list on the left to mount its active context workspace.
                    </p>
                  </div>
                ) : !selectedAsset.intel ? (
                  <div style={{ padding: '6rem 2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
                    <RefreshCw size={32} className="spin-custom text-[#8c2a2a]" style={{ color: 'var(--color-accent)' }} />
                    <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.1rem', fontStyle: 'italic', margin: 0 }}>Compiling Research Registry</h3>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', margin: 0 }}>Resolving options pricing indexes and cash efficiency coefficients...</p>
                  </div>
                ) : (
                  <div style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    
                    {/* Header Workspace Title and Action Ribbon */}
                    <div style={{ borderBottom: '2px solid #222222', paddingBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'space-between', alignItems: 'flex-end' }} className="md:flex-row">
                      <div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--color-accent)', textTransform: 'uppercase', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Activity size={10} /> Active Company Workspace Context
                        </div>
                        <h2 style={{ border: 'none', padding: 0, margin: '0.2rem 0 0 0', fontSize: '2.2rem', fontFamily: 'var(--font-serif)', color: '#1A1A1A', fontWeight: 'normal' }}>
                          {selectedAsset.intel.name}
                        </h2>
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                          <strong style={{ color: '#1A1A1A' }}>{selectedAsset.ticker}:{selectedAsset.exchange}</strong>
                          <span>|</span>
                          <span>{selectedAsset.intel.sector}</span>
                          <span>|</span>
                          <span>{selectedAsset.intel.research.fundamentals?.industry || 'Data unavailable'}</span>
                          <span>|</span>
                          <span style={{ background: '#FCFAF6', border: '1px solid #E2DACD', padding: '1px 5px', fontSize: '0.65rem', color: 'var(--color-accent)', fontWeight: 'bold' }}>
                            CONFIDENCE: {researchReport?.confidenceScore || selectedAsset.intel.qualityScore}%
                          </span>
                          <span>|</span>
                          <span style={{ fontWeight: 'bold' }}>
                            FRESHNESS: {formatFreshness(selectedAsset.intel.updatedAt)}
                          </span>
                        </div>
                      </div>

                      {/* Action Ribbon */}
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button 
                          onClick={() => navigate(`/copilot?ticker=${selectedAsset.ticker.toLowerCase()}`)}
                          style={{ color: 'var(--text-secondary)', border: '1px solid #E2DACD', padding: '0.4rem 0.75rem', fontFamily: 'var(--font-mono)', fontSize: '0.68rem', textTransform: 'uppercase', background: '#FCFAF6', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}
                          aria-label="Discuss with Copilot"
                        >
                          <MessageSquare size={10} /> Discuss
                        </button>
                        <button 
                          onClick={() => handleRecalculate(selectedAsset.ticker, selectedAsset.exchange)}
                          disabled={recalculating === `${selectedAsset.ticker}:${selectedAsset.exchange}`}
                          style={{ color: 'var(--text-secondary)', border: '1px solid #E2DACD', padding: '0.4rem 0.75rem', fontFamily: 'var(--font-mono)', fontSize: '0.68rem', textTransform: 'uppercase', background: '#FCFAF6', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', opacity: recalculating === `${selectedAsset.ticker}:${selectedAsset.exchange}` ? 0.5 : 1, fontWeight: 'bold' }}
                          aria-label="Recalculate Conviction"
                        >
                          <RefreshCw size={10} className={recalculating === `${selectedAsset.ticker}:${selectedAsset.exchange}` ? 'spin-custom' : ''} />
                          {recalculating === `${selectedAsset.ticker}:${selectedAsset.exchange}` ? 'Recalculating...' : 'Recalculate'}
                        </button>
                        <button 
                          onClick={() => ExportService.exportIntelligenceReportToMarkdown(selectedAsset.intel!, selectedAsset.conviction)}
                          style={{ color: 'var(--text-secondary)', border: '1px solid #E2DACD', padding: '0.4rem 0.75rem', fontFamily: 'var(--font-mono)', fontSize: '0.68rem', textTransform: 'uppercase', background: '#FCFAF6', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}
                          aria-label="Export Markdown Brief"
                        >
                          <Download size={10} /> Markdown
                        </button>
                        <button 
                          onClick={() => ExportService.exportIntelligenceReportToPDF(selectedAsset.intel!, selectedAsset.conviction)}
                          style={{ color: 'var(--text-secondary)', border: '1px solid #E2DACD', padding: '0.4rem 0.75rem', fontFamily: 'var(--font-mono)', fontSize: '0.68rem', textTransform: 'uppercase', background: '#FCFAF6', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}
                          aria-label="Export PDF Brief"
                        >
                          <FileText size={10} /> PDF Export
                        </button>
                      </div>
                    </div>

                    {/* Workspace Tabs Panel Navigation */}
                    <div style={{
                      display: 'flex',
                      borderBottom: '1px solid #E2DACD',
                      marginBottom: '0.5rem',
                      overflowX: 'auto',
                      gap: '0.25rem',
                      flexShrink: 0
                    }}>
                      {[
                        { id: 'overview', name: 'Overview' },
                        { id: 'research', name: 'Research & Filings' },
                        { id: 'financials', name: 'Financial Statements' },
                        { id: 'smart_money', name: 'Smart Money Flow' },
                        { id: 'business_school', name: 'Business School' },
                        { id: 'copilot', name: 'Workspace Copilot' }
                      ].map(tab => {
                        const isTabActive = activeTab === tab.id;
                        return (
                          <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`tab-btn ${isTabActive ? 'active' : ''}`}
                          >
                            {tab.name}
                          </button>
                        );
                      })}
                    </div>

                    {/* Active Workspace View Rendering */}
                    <div className="scrollable-panel custom-scrollbar" style={{ flexGrow: 1, overflowY: 'auto', maxHeight: 'calc(100vh - 355px)', paddingRight: '0.5rem' }}>
                      
                      {/* TAB 1: OVERVIEW */}
                      {activeTab === 'overview' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }} className="lg:grid-cols-3">
                          {/* Left summary block */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }} className="lg:col-span-2">
                            <div style={{ padding: '1.5rem', background: '#FCFAF6', border: '1px solid #E2DACD' }}>
                              <h3 style={{ fontSize: '1.15rem', margin: '0 0 1rem 0', padding: 0, fontFamily: 'var(--font-serif)', fontWeight: 'bold', color: '#1A1A1A', borderBottom: '1px solid #E2DACD', paddingBottom: '0.5rem' }}>
                                Executive Investment Thesis
                              </h3>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontFamily: 'var(--font-serif)', fontSize: '0.85rem', lineHeight: '1.6', color: '#1A1A1A' }}>
                                <p style={{ fontStyle: 'italic', background: '#FFFFFF', padding: '1rem 1.25rem', borderLeft: '4px solid var(--color-accent)', border: '1px solid #E2DACD', borderLeftWidth: '4px', margin: 0, color: 'var(--text-secondary)' }}>
                                  "{getExecutiveThesis(selectedAsset.intel, selectedAsset.conviction)}"
                                </p>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }} className="sm:grid-cols-2">
                                  <div style={{ background: '#FFFFFF', padding: '1rem', border: '1px solid #E2DACD' }}>
                                    <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--color-accent)', letterSpacing: '0.05em', display: 'block', marginBottom: '0.25rem' }}>Primary Opportunity</strong>
                                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontFamily: 'var(--font-serif)', fontSize: '0.78rem', lineHeight: '1.5' }}>
                                      {getPrimaryOpportunity(selectedAsset.intel)}
                                    </p>
                                  </div>
                                  <div style={{ background: '#FFFFFF', padding: '1rem', border: '1px solid #E2DACD' }}>
                                    <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--color-accent)', letterSpacing: '0.05em', display: 'block', marginBottom: '0.25rem' }}>Core Catalysts</strong>
                                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontFamily: 'var(--font-serif)', fontSize: '0.78rem', lineHeight: '1.5' }}>
                                      {getPrimaryRisk(selectedAsset.intel)}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Supporting Evidence block */}
                            <div style={{ padding: '1.5rem', background: '#FFFFFF', border: '1px solid #E2DACD' }}>
                              <h3 style={{ fontSize: '1.15rem', margin: '0 0 0.5rem 0', padding: 0, fontFamily: 'var(--font-serif)', fontWeight: 'bold', color: '#1A1A1A', borderBottom: '1px solid #E2DACD', paddingBottom: '0.5rem' }}>
                                Supporting Evidence & Technical Deviation
                              </h3>
                              <p style={{ fontFamily: 'var(--font-serif)', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: '1.5', margin: '0.5rem 0 1rem 0' }}>
                                Analytical support indicates that statistical pullback margins-of-safety are preserved. Volatility indices and exponential moving averages verify that short-term price pullbacks exist inside structural long-term asset appreciation patterns.
                              </p>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.75rem', padding: '1rem', background: '#FCFAF6', border: '1px solid #E2DACD' }}>
                                <div>
                                  <span style={{ fontSize: '0.62rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>Current Price</span>
                                  <strong style={{ fontSize: '0.85rem', color: '#1A1A1A', fontFamily: 'var(--font-mono)' }}>${(selectedAsset.intel.dip.currentPrice || 0).toFixed(2)}</strong>
                                </div>
                                <div>
                                  <span style={{ fontSize: '0.62rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>Z-Score Deviation</span>
                                  <strong style={{ fontSize: '0.85rem', color: '#1A1A1A', fontFamily: 'var(--font-mono)' }}>{(selectedAsset.intel.dip.zScore || 0).toFixed(2)} σ</strong>
                                </div>
                                <div>
                                  <span style={{ fontSize: '0.62rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>Hist Volatility</span>
                                  <strong style={{ fontSize: '0.85rem', color: '#1A1A1A', fontFamily: 'var(--font-mono)' }}>{(selectedAsset.intel.dip.volatility || 0).toFixed(2)}</strong>
                                </div>
                                <div>
                                  <span style={{ fontSize: '0.62rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>52-Week Range</span>
                                  <strong style={{ fontSize: '0.85rem', color: '#1A1A1A', fontFamily: 'var(--font-mono)' }}>${(selectedAsset.intel.dip.fiftyTwoWeekLow || 0).toFixed(0)} - ${(selectedAsset.intel.dip.fiftyTwoWeekHigh || 0).toFixed(0)}</strong>
                                </div>
                                <div>
                                  <span style={{ fontSize: '0.62rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>50-Day EMA</span>
                                  <strong style={{ fontSize: '0.85rem', color: '#1A1A1A', fontFamily: 'var(--font-mono)' }}>${(selectedAsset.intel.dip.ema50 || 0).toFixed(2)}</strong>
                                </div>
                                <div>
                                  <span style={{ fontSize: '0.62rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>Technical Status</span>
                                  <strong style={{ fontSize: '0.85rem', color: 'var(--color-accent)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>{selectedAsset.intel.dip.dipDetected ? (selectedAsset.intel.dip.classification || 'Pullback') : 'Baseline'}</strong>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Right rating panel */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div style={{ background: '#FCFAF6', border: '1px solid #E2DACD', borderTop: '4px solid var(--color-accent)', padding: '1.5rem', textAlign: 'center', position: 'relative' }}>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', fontWeight: 'bold' }}>Conviction Rating</span>
                              
                              <div style={{ fontFamily: 'var(--font-serif)', fontSize: '3.6rem', fontWeight: 'bold', color: 'var(--color-accent)', margin: '0.5rem 0' }}>
                                {selectedAsset.conviction?.overallScore || '—'}
                              </div>
                              
                              <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', fontWeight: 'bold', color: 'var(--color-accent)', background: '#FFFFFF', border: '1px solid #E2DACD', padding: '0.3rem 0.6rem', display: 'inline-block', textTransform: 'uppercase', marginTop: '0.2rem' }}>
                                {(() => {
                                  const score = selectedAsset.conviction?.overallScore || 0;
                                  return score >= 75 ? '🔥 High Conviction Buy' : score >= 50 ? '🟡 Moderate Conviction Hold' : '❌ Low Conviction / Restrict';
                                })()}
                              </span>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', textAlign: 'left', fontSize: '0.75rem', borderTop: '1px solid #E2DACD', paddingTop: '1rem', marginTop: '1.25rem' }}>
                                <div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontWeight: 'bold', marginBottom: '0.25rem', fontSize: '0.68rem' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Portfolio Exposure Sizing</span>
                                    <span style={{ color: '#1A1A1A' }}>{selectedAsset.conviction?.breakdown.allocationFactor.contribution || 0} / 25</span>
                                  </div>
                                  <div style={{ width: '100%', height: '5px', background: '#E2DACD', overflow: 'hidden' }}>
                                    <div style={{ width: `${((selectedAsset.conviction?.breakdown.allocationFactor.contribution || 0) / 25) * 100}%`, height: '100%', background: 'var(--color-accent)' }} />
                                  </div>
                                </div>
                                <div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontWeight: 'bold', marginBottom: '0.25rem', fontSize: '0.68rem' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Fundamental Quality Index</span>
                                    <span style={{ color: '#1A1A1A' }}>{selectedAsset.conviction?.breakdown.fundamentalFactor.contribution || 0} / 25</span>
                                  </div>
                                  <div style={{ width: '100%', height: '5px', background: '#E2DACD', overflow: 'hidden' }}>
                                    <div style={{ width: `${((selectedAsset.conviction?.breakdown.fundamentalFactor.contribution || 0) / 25) * 100}%`, height: '100%', background: 'var(--color-accent)' }} />
                                  </div>
                                </div>
                                <div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontWeight: 'bold', marginBottom: '0.25rem', fontSize: '0.68rem' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Technical Dip Premium</span>
                                    <span style={{ color: '#1A1A1A' }}>{selectedAsset.conviction?.breakdown.dipFactor.contribution || 0} / 25</span>
                                  </div>
                                  <div style={{ width: '100%', height: '5px', background: '#E2DACD', overflow: 'hidden' }}>
                                    <div style={{ width: `${((selectedAsset.conviction?.breakdown.dipFactor.contribution || 0) / 25) * 100}%`, height: '100%', background: 'var(--color-accent)' }} />
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Operational Risk warning */}
                            <div style={{ background: 'var(--color-danger-bg)', border: '1px solid var(--color-danger-border)', padding: '1.25rem' }}>
                              <h3 style={{ fontSize: '0.92rem', margin: '0 0 0.75rem 0', fontFamily: 'var(--font-serif)', fontWeight: 'bold', color: 'var(--color-danger-text)', borderBottom: '1px solid var(--color-danger-border)', paddingBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <AlertTriangle size={14} /> Risk Factors & Warnings
                              </h3>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.78rem', color: 'var(--color-danger-text)' }}>
                                {selectedAsset.intel.research.leverageRatio >= 0.4 && (
                                  <div style={{ background: '#FFFFFF', border: '1px solid var(--color-danger-border)', padding: '0.5rem 0.75rem', lineHeight: '1.4' }}>
                                    <strong>⚠️ Leverage Warning:</strong> Leverage ratio is {(selectedAsset.intel.research.leverageRatio || 0).toFixed(2)}, which exceeds the targeted 0.40 limit.
                                  </div>
                                )}
                                <div style={{ lineHeight: '1.4', color: 'var(--text-secondary)' }}>
                                  <strong style={{ color: '#1A1A1A', display: 'block', marginBottom: '0.2rem' }}>Primary Catalyst Alert:</strong>
                                  <p style={{ fontStyle: 'italic', fontFamily: 'var(--font-serif)', margin: 0 }}>
                                    "{selectedAsset.intel.dip.catalyst || 'Baseline structural competition'}"
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* TAB 2: RESEARCH ENGINE */}
                      {activeTab === 'research' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                          <div style={{ padding: '1.5rem', background: '#FFFFFF', border: '1px solid #E2DACD' }}>
                            <h3 style={{ fontSize: '1.15rem', margin: '0 0 1.25rem 0', padding: 0, fontFamily: 'var(--font-serif)', fontWeight: 'bold', color: '#1A1A1A', borderBottom: '1px solid #E2DACD', paddingBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <Briefcase size={16} style={{ color: 'var(--color-accent)' }} /> Institutional Research Engine Brief
                            </h3>
                            
                            {researchLoading ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', padding: '2rem 0' }}>
                                <RefreshCw size={14} className="spin-custom" /> Compiling Data Moat Research Report...
                              </div>
                            ) : researchReport ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', fontSize: '0.85rem', fontFamily: 'var(--font-serif)', lineHeight: '1.6', color: '#1A1A1A' }}>
                                <div style={{ background: '#FCFAF6', border: '1px solid #E2DACD', padding: '1rem 1.25rem' }}>
                                  <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-accent)', display: 'block', marginBottom: '0.35rem' }}>1. Business Overview & Context</strong>
                                  <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                                    {researchReport.executiveSummary}
                                  </p>
                                </div>

                                <div style={{ background: '#FCFAF6', border: '1px solid #E2DACD', padding: '1rem 1.25rem' }}>
                                  <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-accent)', display: 'block', marginBottom: '0.35rem' }}>2. Financial Metrics Analysis</strong>
                                  <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                                    {researchReport.financialMetricsAnalysis}
                                  </p>
                                </div>

                                <div style={{ background: '#FCFAF6', border: '1px solid #E2DACD', padding: '1rem 1.25rem' }}>
                                  <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-accent)', display: 'block', marginBottom: '0.35rem' }}>3. Risks and Mitigations</strong>
                                  <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                                    {researchReport.risksAndMitigations}
                                  </p>
                                </div>

                                {/* Filing Change Alert log */}
                                <div style={{ border: '1px solid #E2DACD', padding: '1rem 1.25rem', background: '#FFFFFF' }}>
                                  <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.5rem' }}>Filing Change Detector Alerts</strong>
                                  {researchReport.changeDetectionAlerts.length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                      {researchReport.changeDetectionAlerts.map((alert, i) => (
                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', paddingBottom: '0.25rem', borderBottom: '1px solid #FCFAF6' }}>
                                          <div>
                                            <span style={{ color: alert.direction === 'improved' ? 'var(--color-success-text)' : alert.direction === 'deteriorated' ? 'var(--color-danger-text)' : '#555', fontWeight: 'bold' }}>
                                              {alert.direction.toUpperCase()}
                                            </span>
                                            <span style={{ color: '#1A1A1A', marginLeft: '0.5rem' }}>{alert.metric}:</span>
                                          </div>
                                          <div style={{ color: 'var(--text-secondary)' }}>
                                            {alert.previousValue} → <strong>{alert.currentValue}</strong> ({alert.changePercent > 0 ? '+' : ''}{alert.changePercent}%)
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.72rem', fontFamily: 'var(--font-mono)' }}>No material filing changes detected relative to recent history.</span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontStyle: 'italic' }}>Verify cache database connection.</div>
                            )}
                          </div>

                          {/* Citations Full-Width Block */}
                          <div style={{ padding: '1.5rem', background: '#FCFAF6', border: '1px solid #E2DACD' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem', borderBottom: '1px solid #E2DACD', paddingBottom: '0.5rem' }}>
                              <h4 style={{ fontSize: '0.98rem', margin: 0, fontFamily: 'var(--font-serif)', color: '#1A1A1A', fontWeight: 'bold' }}>Sources and Citation Trail</h4>
                              {researchReport && (
                                <ProvenanceBadge 
                                  category={selectedAsset.exchange === 'NSE' || selectedAsset.exchange === 'BSE' ? 'News Intelligence' : 'Regulatory Filings'}
                                  source={selectedAsset.exchange === 'NSE' || selectedAsset.exchange === 'BSE' ? 'Investor Relations disclosures' : 'SEC EDGAR Database'}
                                  timestamp={researchReport.generationDate}
                                  confidence={researchReport.confidenceScore > 90 ? 'High' : 'Medium'}
                                />
                              )}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.72rem', fontFamily: 'var(--font-mono)' }}>
                              {researchReport && researchReport.sourcesUsed && researchReport.sourcesUsed.length > 0 ? (
                                researchReport.sourcesUsed.map((src, i) => (
                                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', alignItems: 'center', borderBottom: '1px solid #EAE5DB', paddingBottom: '0.25rem' }}>
                                    {src.url ? (
                                      <a href={src.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)', textDecoration: 'underline', display: 'flex', alignItems: 'center', gap: '2px', fontWeight: 'bold' }}>
                                        {src.name} <ExternalLink size={8} />
                                      </a>
                                    ) : (
                                      <span>{src.name}</span>
                                    )}
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>{src.timestamp}</span>
                                  </div>
                                ))
                              ) : (
                                <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No formal external citations linked.</span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* TAB 3: FINANCIAL STATEMENTS */}
                      {activeTab === 'financials' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                          
                          {/* Quality score parameters */}
                          <div style={{ padding: '1.5rem', background: '#FFFFFF', border: '1px solid #E2DACD' }}>
                            <h3 style={{ fontSize: '1.15rem', margin: '0 0 1.25rem 0', fontFamily: 'var(--font-serif)', fontWeight: 'bold', color: '#1A1A1A', borderBottom: '1px solid #E2DACD', paddingBottom: '0.5rem' }}>
                              Balance Sheet Quality Framework ({selectedAsset.intel.qualityScore}/100)
                            </h3>
                            
                            {(() => {
                              const qb = selectedAsset.intel.qualityBreakdown || {
                                moat: { score: selectedAsset.intel.qualityScore >= 70 ? 40 : 25, max: 40, weight: 0.4, contribution: selectedAsset.intel.qualityScore >= 70 ? 40 : 25, value: selectedAsset.intel.research.moatRating.toUpperCase(), rationale: selectedAsset.intel.research.moatRationale },
                                leverage: { score: selectedAsset.intel.research.leverageRatio < 0.4 ? 30 : 20, max: 30, weight: 0.3, contribution: selectedAsset.intel.research.leverageRatio < 0.4 ? 30 : 20, value: selectedAsset.intel.research.leverageRatio, rationale: `Leverage ratio is ${selectedAsset.intel.research.leverageRatio.toFixed(2)}.` },
                                fcfMargin: { score: selectedAsset.intel.research.freeCashFlowMargin > 25 ? 30 : 20, max: 30, weight: 0.3, contribution: selectedAsset.intel.research.freeCashFlowMargin > 25 ? 30 : 20, value: selectedAsset.intel.research.freeCashFlowMargin, rationale: `FCF Margin is ${selectedAsset.intel.research.freeCashFlowMargin.toFixed(1)}%.` }
                              };
                              
                              return (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.8rem' }}>
                                  <div style={{ borderBottom: '1px solid #F3ECE0', paddingBottom: '0.75rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontWeight: 'bold', color: '#1A1A1A', marginBottom: '0.2rem' }}>
                                      <span>Economic Moat Rating</span>
                                      <span style={{ color: 'var(--color-accent)' }}>{qb.moat.score} / {qb.moat.max} Max</span>
                                    </div>
                                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--color-accent)', marginBottom: '0.35rem', fontWeight: 'bold' }}>Class: {qb.moat.value}</div>
                                    <p style={{ fontStyle: 'italic', fontFamily: 'var(--font-serif)', color: 'var(--text-secondary)', fontSize: '0.78rem', lineHeight: '1.4', background: '#FCFAF6', borderLeft: '3px solid #E2DACD', padding: '0.5rem 0.75rem', margin: 0 }}>
                                      "{qb.moat.rationale}"
                                    </p>
                                  </div>

                                  <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontWeight: 'bold', color: '#1A1A1A', marginBottom: '0.2rem' }}>
                                      <span>Solvency & Leverage</span>
                                      <span style={{ color: 'var(--color-accent)' }}>{qb.leverage.score} / {qb.leverage.max} Max</span>
                                    </div>
                                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Target ratio: &lt; 0.40</div>
                                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.78rem', lineHeight: '1.4' }}>
                                      {qb.leverage.rationale}
                                    </p>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>

                          {/* Historical margins table */}
                          <div style={{ padding: '1.5rem', background: '#FFFFFF', border: '1px solid #E2DACD' }}>
                            <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--color-accent)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold', borderBottom: '1px solid #E2DACD', paddingBottom: '0.5rem', marginBottom: '1rem', margin: 0 }}>
                              Earnings & Margin Trend (Historical highlights)
                            </h3>
                            
                            {researchReport && researchReport.earningsTrend.length > 0 ? (
                              <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', borderCollapse: 'collapse' }}>
                                  <thead>
                                    <tr style={{ borderBottom: '1px solid #E2DACD', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                      <th style={{ paddingBottom: '0.5rem' }}>Reporting Period</th>
                                      <th style={{ paddingBottom: '0.5rem', textAlign: 'right' }}>Quarterly Revenue</th>
                                      <th style={{ paddingBottom: '0.5rem', textAlign: 'right' }}>Operating Margin</th>
                                      <th style={{ paddingBottom: '0.5rem', textAlign: 'right' }}>Net Income</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {researchReport.earningsTrend.map((trend, i) => (
                                      <tr key={i} style={{ borderBottom: '1px solid #F3ECE0' }}>
                                        <td style={{ padding: '0.5rem 0' }}>{trend.quarter}</td>
                                        <td style={{ padding: '0.5rem 0', textAlign: 'right', fontWeight: 'bold', color: '#1A1A1A' }}>
                                          {selectedAsset.exchange === 'NSE' || selectedAsset.exchange === 'BSE' 
                                            ? `₹${(trend.revenue / 10000000).toFixed(0)} Cr`
                                            : `$${(trend.revenue / 1000000000).toFixed(2)}B`}
                                        </td>
                                        <td style={{ padding: '0.5rem 0', textAlign: 'right', fontWeight: 'bold', color: trend.operatingMargin > 25 ? 'var(--color-success-text)' : trend.operatingMargin > 10 ? 'var(--color-warning-text)' : 'var(--color-danger-text)' }}>
                                          {trend.operatingMargin.toFixed(1)}%
                                        </td>
                                        <td style={{ padding: '0.5rem 0', textAlign: 'right', color: 'var(--text-secondary)' }}>
                                          {selectedAsset.exchange === 'NSE' || selectedAsset.exchange === 'BSE'
                                            ? `₹${(trend.netIncome / 10000000).toFixed(0)} Cr`
                                            : `$${(trend.netIncome / 1000000000).toFixed(2)}B`}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontStyle: 'italic' }}>No historical stats cached.</div>
                            )}
                          </div>

                          {/* Verification table */}
                          <div style={{ padding: '1.5rem', background: '#FFFFFF', border: '1px solid #E2DACD' }}>
                            <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--color-accent)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold', borderBottom: '1px solid #E2DACD', paddingBottom: '0.5rem', marginBottom: '0.85rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <Shield size={12} /> Live Intelligence Verification Audit Log
                            </h3>
                            <div style={{ overflowX: 'auto', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', background: '#FCFAF6', border: '1px solid #E2DACD', padding: '0.75rem' }}>
                              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                                <thead>
                                  <tr style={{ borderBottom: '1px solid #E2DACD', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                    <th style={{ paddingBottom: '0.35rem' }}>Model Metric</th>
                                    <th style={{ paddingBottom: '0.35rem' }}>Value</th>
                                    <th style={{ paddingBottom: '0.35rem' }}>Classification</th>
                                    <th style={{ paddingBottom: '0.35rem' }}>Sourcing Registry</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr style={{ borderBottom: '1px solid #EAE5DB' }}>
                                    <td style={{ padding: '0.35rem 0' }}>Economic Moat</td>
                                    <td style={{ padding: '0.35rem 0', fontWeight: 'bold', color: '#1A1A1A' }}>{selectedAsset.intel.research.moatRating.toUpperCase()}</td>
                                    <td style={{ padding: '0.35rem 0', color: 'purple', fontWeight: 'bold' }}>AI Interpretation</td>
                                    <td style={{ padding: '0.35rem 0' }}>Gemini 3.1 Pro</td>
                                  </tr>
                                  <tr style={{ borderBottom: '1px solid #EAE5DB' }}>
                                    <td style={{ padding: '0.35rem 0' }}>Debt to Equity</td>
                                    <td style={{ padding: '0.35rem 0', fontWeight: 'bold', color: '#1A1A1A' }}>{(selectedAsset.intel.research.fundamentals?.debtToEquity || 0).toFixed(2)}</td>
                                    <td style={{ padding: '0.35rem 0', color: 'var(--color-accent)', fontWeight: 'bold' }}>Real Market Data</td>
                                    <td style={{ padding: '0.35rem 0' }}>Finnhub Core API</td>
                                  </tr>
                                  <tr>
                                    <td style={{ paddingTop: '0.35rem' }}>FCF Margin</td>
                                    <td style={{ paddingTop: '0.35rem', fontWeight: 'bold', color: '#1A1A1A' }}>{(selectedAsset.intel.research.freeCashFlowMargin || 0).toFixed(1)}%</td>
                                    <td style={{ paddingTop: '0.35rem', color: 'var(--color-accent)', fontWeight: 'bold' }}>Real Market Data</td>
                                    <td style={{ paddingTop: '0.35rem' }}>Finnhub Core API</td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* TAB 4: SMART MONEY FLOW */}
                      {activeTab === 'smart_money' && (
                        <div style={{ padding: '1.5rem', background: '#FFFFFF', border: '1px solid #E2DACD' }}>
                          <h3 style={{ fontSize: '1.15rem', margin: '0 0 1.25rem 0', padding: 0, fontFamily: 'var(--font-serif)', fontWeight: 'bold', color: '#1A1A1A', borderBottom: '1px solid #E2DACD', paddingBottom: '0.5rem' }}>
                            Smart Money Flow Dashboard
                          </h3>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }} className="md:grid-cols-2">
                            {/* Insider Activity */}
                            <div style={{ padding: '1rem', border: '1px solid #E2DACD', background: '#FCFAF6', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                              <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'var(--font-mono)', fontWeight: 'bold', borderBottom: '1px solid #E2DACD', paddingBottom: '0.40rem', marginBottom: '0.75rem', color: '#1A1A1A', fontSize: '0.75rem' }}>
                                  <span>Insider Net Volume</span>
                                  <span style={{ padding: '1px 5px', border: '1px solid #E2DACD', fontSize: '0.58rem', textTransform: 'uppercase', color: 'var(--color-accent)', fontWeight: 'bold', background: '#FFFFFF' }}>
                                    CONF: {selectedAsset.intel.smartMoney.insiderTransactions?.confidence || 'none'}
                                  </span>
                                </div>
                                {selectedAsset.intel.smartMoney.insiderTransactions?.value ? (
                                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    <div><strong>Net Volume:</strong> {selectedAsset.intel.smartMoney.insiderTransactions.value.netSharesBought.toLocaleString()} Shares</div>
                                    <div><strong>Transactions (90d):</strong> {selectedAsset.intel.smartMoney.insiderTransactions.value.totalTransactionsCount} ({selectedAsset.intel.smartMoney.insiderTransactions.value.buyCount} buys, {selectedAsset.intel.smartMoney.insiderTransactions.value.sellCount} sells)</div>
                                  </div>
                                ) : (
                                  <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.68rem', fontStyle: 'italic' }}>Data unavailable</div>
                                )}
                              </div>
                              <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '1rem', borderTop: '1px dashed #E2DACD', paddingTop: '0.35rem' }}>
                                SOURCE: SEC FORM 4 FILINGS
                              </div>
                            </div>

                            {/* Officer Sentiment */}
                            <div style={{ padding: '1rem', border: '1px solid #E2DACD', background: '#FCFAF6', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                              <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'var(--font-mono)', fontWeight: 'bold', borderBottom: '1px solid #E2DACD', paddingBottom: '0.40rem', marginBottom: '0.75rem', color: '#1A1A1A', fontSize: '0.75rem' }}>
                                  <span>Corporate Officer Sentiment</span>
                                  <span style={{ padding: '1px 5px', border: '1px solid #E2DACD', fontSize: '0.58rem', textTransform: 'uppercase', color: 'var(--color-accent)', fontWeight: 'bold', background: '#FFFFFF' }}>
                                    CONF: {selectedAsset.intel.smartMoney.insiderSentiment?.confidence || 'none'}
                                  </span>
                                </div>
                                {selectedAsset.intel.smartMoney.insiderSentiment?.value ? (
                                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    <div><strong>Monthly Purchase Ratio:</strong> {selectedAsset.intel.smartMoney.insiderSentiment.value.mspr.toFixed(2)} Index</div>
                                    <div><strong>Officer Share Change:</strong> {selectedAsset.intel.smartMoney.insiderSentiment.value.change.toLocaleString()} Shares</div>
                                  </div>
                                ) : (
                                  <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.68rem', fontStyle: 'italic' }}>Data unavailable</div>
                                )}
                              </div>
                              <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '1rem', borderTop: '1px dashed #E2DACD', paddingTop: '0.35rem' }}>
                                SOURCE: FINNHUB INSIDER SENTIMENT FEED
                              </div>
                            </div>

                            {/* Options Ratio */}
                            <div style={{ padding: '1rem', border: '1px solid #E2DACD', background: '#FCFAF6', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                              <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'var(--font-mono)', fontWeight: 'bold', borderBottom: '1px solid #E2DACD', paddingBottom: '0.40rem', marginBottom: '0.75rem', color: '#1A1A1A', fontSize: '0.75rem' }}>
                                  <span>Options Volume Ratio</span>
                                  <span style={{ padding: '1px 5px', border: '1px solid #E2DACD', fontSize: '0.58rem', textTransform: 'uppercase', color: 'var(--color-accent)', fontWeight: 'bold', background: '#FFFFFF' }}>
                                    CONF: {selectedAsset.intel.smartMoney.optionsVolume?.confidence || 'none'}
                                  </span>
                                </div>
                                {selectedAsset.intel.smartMoney.optionsVolume?.value ? (
                                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    <div><strong>Put/Call Volume Ratio:</strong> {selectedAsset.intel.smartMoney.optionsVolume.value.putCallRatio.toFixed(2)}</div>
                                    <div><strong>Sentiment Classification:</strong> {selectedAsset.intel.smartMoney.optionsVolume.value.sentiment.toUpperCase()}</div>
                                  </div>
                                ) : (
                                  <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.68rem', fontStyle: 'italic' }}>Data unavailable</div>
                                )}
                              </div>
                              <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '1rem', borderTop: '1px dashed #E2DACD', paddingTop: '0.35rem' }}>
                                SOURCE: HISTORICAL OPTIONS REGISTRY
                              </div>
                            </div>

                            {/* 13F Ownership */}
                            <div style={{ padding: '1rem', border: '1px solid #E2DACD', background: '#FCFAF6', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                              <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'var(--font-mono)', fontWeight: 'bold', borderBottom: '1px solid #E2DACD', paddingBottom: '0.40rem', marginBottom: '0.75rem', color: '#1A1A1A', fontSize: '0.75rem' }}>
                                  <span>Institutional 13F Ownership</span>
                                  <span style={{ padding: '1px 5px', border: '1px solid #E2DACD', fontSize: '0.58rem', textTransform: 'uppercase', color: 'var(--color-accent)', fontWeight: 'bold', background: '#FFFFFF' }}>
                                    CONF: {selectedAsset.intel.smartMoney.institutionalOwnership?.confidence || 'none'}
                                  </span>
                                </div>
                                {selectedAsset.intel.smartMoney.institutionalOwnership?.value ? (
                                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    <div><strong>Institutional Ownership:</strong> {selectedAsset.intel.smartMoney.institutionalOwnership.value.ownershipPercent.toFixed(1)}%</div>
                                    <div><strong>Fund Net Flows:</strong> {selectedAsset.intel.smartMoney.institutionalOwnership.value.netFlow.toUpperCase()}</div>
                                  </div>
                                ) : (
                                  <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.68rem', fontStyle: 'italic' }}>Data unavailable</div>
                                )}
                              </div>
                              <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '1rem', borderTop: '1px dashed #E2DACD', paddingTop: '0.35rem' }}>
                                SOURCE: SEC FORM 13F FILINGS
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* TAB 5: BUSINESS SCHOOL */}
                      {activeTab === 'business_school' && (
                        <div style={{ padding: '1.5rem', background: '#FCFAF6', border: '1px solid #E2DACD', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                          
                          {/* Concept Selectors */}
                          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', borderBottom: '1px solid #E2DACD', paddingBottom: '0.75rem', marginBottom: '0.5rem' }}>
                            {[
                              { id: 'operating_leverage', name: 'Operating Leverage' },
                              { id: 'economic_moats', name: 'Economic Moats' },
                              { id: 'free_cash_flow_margin', name: 'FCF Margin' },
                              { id: 'financial_solvency', name: 'Financial Solvency' }
                            ].map(c => {
                              const isConceptActive = bsConcept === c.id;
                              return (
                                <button
                                  key={c.id}
                                  onClick={() => setBsConcept(c.id)}
                                  style={{
                                    background: isConceptActive ? 'var(--color-accent)' : '#FFFFFF',
                                    color: isConceptActive ? '#FFFFFF' : '#222222',
                                    border: isConceptActive ? '1px solid var(--color-accent)' : '1px solid #E2DACD',
                                    padding: '0.45rem 0.8rem',
                                    fontSize: '0.72rem',
                                    fontFamily: 'var(--font-mono)',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                  }}
                                >
                                  {c.name.toUpperCase()}
                                </button>
                              );
                            })}
                          </div>

                          {bsLoading ? (
                            <div style={{ paddingTop: '3rem', paddingBottom: '3rem', textAlign: 'center', fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                              <RefreshCw size={20} className="spin-custom inline mr-1" style={{ color: 'var(--color-accent)' }} /> Resolving textbook models...
                            </div>
                          ) : bsCaseData ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.8rem', fontFamily: 'var(--font-sans)', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                              <div>
                                <h4 style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem', fontWeight: 'bold' }}>Concept Definition</h4>
                                <p style={{ background: '#FFFFFF', border: '1px solid #E2DACD', padding: '0.75rem 1rem', fontFamily: 'var(--font-serif)', fontStyle: 'italic', margin: 0 }}>
                                  {bsConcept === 'operating_leverage' 
                                    ? 'Measures the proportion of fixed costs to variable costs in a company\'s expense structure. High operating leverage means that a small percentage change in sales volume results in a large percentage change in operating income.' 
                                    : bsConcept === 'economic_moats' 
                                      ? 'A company\'s ability to maintain a competitive advantage over its competitors in order to protect its long-term profits and market share from competing forces.' 
                                      : bsConcept === 'free_cash_flow_margin' 
                                        ? 'The percentage of revenue that a company converts into free cash flow (operating cash flow minus capital expenditures). It represents the pure excess cash generated after maintaining operations.' 
                                        : 'A company\'s capacity to meet its long-term financial commitments and obligations. It evaluates the capital structure health and debt repayment capacity relative to equity capitalization.'
                                  }
                                </p>
                              </div>

                              <div style={{ background: '#FFFFFF', border: '1px solid #E2DACD', padding: '0.75rem 1rem', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#1A1A1A' }}>
                                <strong>Math Model: </strong>
                                <span>
                                  {bsConcept === 'operating_leverage' 
                                    ? 'DOL = % Change in EBIT / % Change in Sales' 
                                    : bsConcept === 'economic_moats' 
                                      ? 'ROIC - WACC > 0' 
                                      : bsConcept === 'free_cash_flow_margin' 
                                        ? 'FCF Margin (%) = [Operating Cash Flow - CapEx] / Revenue' 
                                        : 'Debt to Equity = Liabilities / Shareholder Equity (Target < 0.40)'
                                  }
                                </span>
                              </div>

                              <div>
                                <h4 style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem', fontWeight: 'bold' }}>Academic case Study Overview</h4>
                                <p style={{ background: '#FFFFFF', border: '1px solid #E2DACD', padding: '0.75rem 1rem', margin: 0 }}>
                                  {bsConcept === 'operating_leverage' 
                                    ? 'Apple protects profits by scaling iOS platform and services. Once initially coded (fixed cost), each additional iCloud or App Store subscription carries near-zero variable cost, expanding margins exponentially during growth phases.' 
                                    : bsConcept === 'economic_moats' 
                                      ? 'Apple protects its premium pricing through high switching costs (iOS ecosystem lock-in), powerful network effects (App Store developers), and its intangible brand assets.' 
                                      : bsConcept === 'free_cash_flow_margin' 
                                        ? 'Apple regularly converts over 25% of its revenue directly into free cash flow. This massive cash engine funds dividends, share buybacks, and R&D capital expenditure internally without requiring debt expansion.' 
                                        : 'While Apple issues capital to optimize taxes, its cash holdings and exceptional interest coverage ratio insulate the balance sheet against credit shocks and economic recessions.'
                                  }
                                </p>
                              </div>

                              <div>
                                <h4 style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem', fontWeight: 'bold' }}>Active Case study application ({bsCaseData.companyName})</h4>
                                <div style={{ fontStyle: 'italic', fontFamily: 'var(--font-serif)', lineHeight: '1.6', color: '#1A1A1A', background: '#FFFFFF', borderLeft: '4px solid var(--color-accent)', border: '1px solid #E2DACD', borderLeftWidth: '4px', padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                                  <p style={{ margin: 0 }}>{bsCaseData.caseStudyNarrative}</p>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontFamily: 'var(--font-serif)', fontSize: '0.78rem' }}>Verify study registry connection.</div>
                          )}
                        </div>
                      )}

                      {/* TAB 6: INLINE WORKSPACE COPILOT */}
                      {activeTab === 'copilot' && (
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          height: '420px',
                          border: '1px solid #E2DACD',
                          background: '#FCFAF6'
                        }}>
                          {/* Messages Feed */}
                          <div style={{
                            flexGrow: 1,
                            overflowY: 'auto',
                            padding: '1rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.75rem'
                          }} className="custom-scrollbar">
                            {copilotMessages.map(msg => (
                              <div
                                key={msg.id}
                                className="chat-bubble"
                                style={{
                                  alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                                  background: msg.sender === 'user' ? 'var(--color-accent)' : '#FFFFFF',
                                  color: msg.sender === 'user' ? '#FFFFFF' : '#222222',
                                  borderColor: msg.sender === 'user' ? 'var(--color-accent)' : '#E2DACD',
                                  borderRadius: msg.sender === 'user' ? '12px 12px 0 12px' : '12px 12px 12px 0',
                                  fontFamily: msg.sender === 'user' ? 'var(--font-sans)' : 'var(--font-serif)',
                                  fontWeight: msg.sender === 'user' ? '500' : 'normal'
                                }}
                              >
                                {msg.content}
                              </div>
                            ))}
                            {copilotSending && (
                              <div style={{
                                alignSelf: 'flex-start',
                                background: '#FFFFFF',
                                border: '1px solid #E2DACD',
                                padding: '0.5rem 1rem',
                                fontSize: '0.72rem',
                                color: 'var(--text-secondary)',
                                fontFamily: 'var(--font-mono)',
                                borderRadius: '12px 12px 12px 0'
                              }}>
                                <RefreshCw size={10} className="spin-custom inline mr-1" /> Synthesizing data registry metrics...
                              </div>
                            )}
                            <div ref={copilotEndRef} />
                          </div>

                          {/* Quick Prompts Options */}
                          <div style={{
                            display: 'flex',
                            gap: '0.5rem',
                            padding: '0.5rem 1rem',
                            borderTop: '1px dashed #E2DACD',
                            overflowX: 'auto',
                            background: '#FFFFFF'
                          }} className="custom-scrollbar">
                            {[
                              { label: 'Analyze Solvency Ratios', prompt: `What is the solvency risk and interest coverage ratio for ${selectedAsset.ticker}?` },
                              { label: 'Check Smart Money net flows', prompt: `Summarize the institutional 13F and insider transactions flow for ${selectedAsset.ticker}.` },
                              { label: 'Evaluate Moat Rating', prompt: `What are the competitive moats and primary business risks of ${selectedAsset.ticker}?` }
                            ].map((q, idx) => (
                              <button
                                key={idx}
                                onClick={() => setCopilotInput(q.prompt)}
                                style={{
                                  background: '#FCFAF6',
                                  border: '1px solid #E2DACD',
                                  padding: '0.25rem 0.5rem',
                                  fontSize: '0.65rem',
                                  fontFamily: 'var(--font-mono)',
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                  color: 'var(--text-secondary)',
                                  fontWeight: 'bold',
                                  transition: 'all 0.15s ease'
                                }}
                                onMouseEnter={e => {
                                  e.currentTarget.style.borderColor = '#CFC5B6';
                                  e.currentTarget.style.backgroundColor = '#FAF8F5';
                                }}
                                onMouseLeave={e => {
                                  e.currentTarget.style.borderColor = '#E2DACD';
                                  e.currentTarget.style.backgroundColor = '#FCFAF6';
                                }}
                              >
                                {q.label.toUpperCase()}
                              </button>
                            ))}
                          </div>

                          {/* Input Bar */}
                          <form onSubmit={handleSendCopilotMessage} style={{
                            display: 'flex',
                            borderTop: '1px solid #E2DACD',
                            background: '#FFFFFF'
                          }}>
                            <input
                              type="text"
                              placeholder={`Ask anything about ${selectedAsset.ticker}...`}
                              value={copilotInput}
                              onChange={e => setCopilotInput(e.target.value)}
                              disabled={copilotSending}
                              style={{
                                flexGrow: 1,
                                border: 'none',
                                outline: 'none',
                                padding: '0.75rem 1rem',
                                fontSize: '0.8rem',
                                background: 'transparent'
                              }}
                            />
                            <button
                              type="submit"
                              disabled={copilotSending || !copilotInput.trim()}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                padding: '0 1.25rem',
                                color: copilotInput.trim() ? 'var(--color-accent)' : '#CCC',
                                cursor: copilotInput.trim() ? 'pointer' : 'default',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              <Send size={15} />
                            </button>
                          </form>
                        </div>
                      )}

                    </div>

                  </div>
                )}
              </section>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

export default IntelligenceHub;
