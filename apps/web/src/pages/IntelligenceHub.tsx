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
  TrendingUp,
  TrendingDown,
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
    <div className="workspace-page" style={{ animation: 'fadeIn 0.25s ease-out', textAlign: 'left' }}>
      
      {/* FT-Style Editorial Header */}
      <header className="workspace-header border-b-2 border-stone-800 pb-5 mb-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="font-mono text-xs uppercase tracking-widest text-[#8c2a2a] mb-1 font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#8c2a2a]"></span>
              Institutional Sovereign Intelligence
            </div>
            <h1 className="font-serif text-4xl font-normal tracking-tight text-[#1A1A1A] mb-1" style={{ border: 'none', padding: 0 }}>
              Company Workspaces
            </h1>
            <p className="text-sm text-stone-600 max-w-xl font-serif italic">
              Algorithmic sovereign research workspaces mapping capital structures, smart money registries, and discount pullbacks.
            </p>
          </div>
          <div className="font-mono text-xs text-stone-500 text-left md:text-right border-l-2 md:border-l-0 md:border-r-2 border-[#8c2a2a] pl-3 md:pr-3">
            <div>WORKSPACE STATUS: OPERATIONAL</div>
            <div>MONITORED SECURITIES: {totalAssetsCount}</div>
            <div>SYS DATE: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' }).toUpperCase()}</div>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="py-20 text-center font-serif text-lg italic text-stone-500">
          <RefreshCw size={24} className="spinner mx-auto mb-2 text-[#8c2a2a] animate-spin" />
          Syncing holdings database and resolving institutional metrics...
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          
          {/* SECTION 1 — INTELLIGENCE COMMAND CENTER */}
          <section aria-label="Intelligence Command Center" className="bg-white border border-[#E5E2D9] p-4 md:p-6 shadow-sm">
            <h2 className="font-mono text-[10px] uppercase tracking-widest text-[#8c2a2a] font-bold border-b border-stone-200 pb-2 mb-4">
              [Portfolio Intelligence Metrics Center]
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Total Assets */}
              <div className="p-3 border border-stone-200 bg-[#FCFAF6]">
                <div className="font-mono text-[9px] text-stone-400 uppercase font-bold">Monitored Assets</div>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="font-serif text-3xl font-bold">{totalAssetsCount}</span>
                  <span className="text-xs font-semibold text-stone-500">
                    {totalAssetsCount > 0 ? '→ Flat' : '—'}
                  </span>
                </div>
                <p className="text-[10px] text-stone-500 mt-2 font-serif leading-tight">
                  Total non-cash equity and crypto holdings tracked.
                </p>
              </div>

              {/* High Conviction */}
              <div className="p-3 border border-stone-200 bg-[#FCFAF6]">
                <div className="font-mono text-[9px] text-stone-400 uppercase font-bold">High Conviction</div>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="font-serif text-3xl font-bold text-green-700">{highConvCount}</span>
                  <span className="text-xs font-semibold text-green-700 flex items-center">
                    <TrendingUp size={12} /> {highConvCount > 0 ? '+1' : '0'}
                  </span>
                </div>
                <p className="text-[10px] text-stone-500 mt-2 font-serif leading-tight">
                  Positions holding algorithmic rating indexes of 75/100 or above.
                </p>
              </div>

              {/* Active Dips */}
              <div className="p-3 border border-stone-200 bg-[#FCFAF6]">
                <div className="font-mono text-[9px] text-stone-400 uppercase font-bold">Active Dip Signals</div>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="font-serif text-3xl font-bold text-amber-700">{activeDipsCount}</span>
                  <span className="text-xs font-semibold text-amber-700 flex items-center">
                    <TrendingDown size={12} /> {activeDipsCount > 0 ? 'Active' : '0'}
                  </span>
                </div>
                <p className="text-[10px] text-stone-500 mt-2 font-serif leading-tight">
                  Wide-moat compounders trading at classified technical discounts.
                </p>
              </div>

              {/* Smart Money */}
              <div className="p-3 border border-stone-200 bg-[#FCFAF6]">
                <div className="font-mono text-[9px] text-stone-400 uppercase font-bold">Smart Money Accumulation</div>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="font-serif text-3xl font-bold text-[#8c2a2a]">{strongSmartMoneyCount}</span>
                  <span className="text-xs font-semibold text-[#8c2a2a] flex items-center">
                    <TrendingUp size={12} /> Strong
                  </span>
                </div>
                <p className="text-[10px] text-stone-500 mt-2 font-serif leading-tight">
                  Assets displaying net-positive insider purchases or 13F inflows.
                </p>
              </div>

              {/* Avg Quality */}
              <div className="p-3 border border-stone-200 bg-[#FCFAF6]">
                <div className="font-mono text-[9px] text-stone-400 uppercase font-bold">Average Quality Index</div>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="font-serif text-3xl font-bold">{averageQualityIndex}</span>
                  <span className="text-xs font-semibold text-stone-500">/100</span>
                </div>
                <p className="text-[10px] text-stone-500 mt-2 font-serif leading-tight">
                  Weighted structural solvency and moat durability rating.
                </p>
              </div>
            </div>
          </section>

          {/* SPLIT PANE: DIRECTORY & WORKSPACE */}
          <div className="workspace-body company-workspace-grid lg:gap-8">
            
            {/* LEFT COLUMN: ACTIVE MONITORED ASSETS DIRECTORY */}
            <div className="lg:col-span-1 flex flex-col gap-6 scrollable-panel" style={{ paddingRight: '0.5rem' }}>
              <section className="bg-white border border-[#E5E2D9] p-4 md:p-6 shadow-sm">
                <div className="border-b border-stone-200 pb-3 mb-4">
                  <h2 className="font-serif text-xl font-normal text-[#1A1A1A]">
                    Sovereign Directory
                  </h2>
                  <span className="font-mono text-[9px] text-stone-400 uppercase">Search and mount context</span>
                </div>

                <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
                  <Search size={14} className="text-stone-400" style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    placeholder="Search ticker or company..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="font-mono text-xs pl-8 pr-3 py-2 bg-[#FAF8F5] border border-stone-300 w-full focus:outline-none focus:border-stone-800"
                    aria-label="Search Monitored Directory"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  {filteredHoldings.length === 0 ? (
                    <div className="py-8 text-center font-serif text-xs italic text-stone-400">
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
                          style={{ borderLeft: isSelected ? '4px solid #8c2a2a' : '4px solid transparent' }}
                          className={`p-3 border border-stone-200 hover:bg-[#FAF8F5] cursor-pointer flex justify-between items-center transition-colors ${
                            isSelected ? 'bg-[#F9F8F4] border-stone-500' : 'bg-[#FCFAF6]'
                          }`}
                        >
                          <div>
                            <div className="font-serif text-sm font-bold text-stone-900">{h.ticker}</div>
                            <div className="font-mono text-[9px] text-stone-500">{h.name}</div>
                          </div>
                          <div className="text-right">
                            <span className="font-serif text-base font-bold text-stone-800">
                              {scoreRecord ? scoreRecord.overallScore : '—'}
                            </span>
                            <span className="font-mono text-[8px] text-stone-400 block uppercase">Conviction</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>
            </div>

            {/* RIGHT COLUMN: FLAGSHIP COMPANY WORKSPACE */}
            <div className="lg:col-span-3" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
              <section className="bg-white border border-[#E5E2D9] p-4 md:p-6 shadow-sm" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden' }}>
                
                {!selectedAsset ? (
                  <div className="py-24 text-center flex flex-col items-center justify-center gap-4">
                    <div className="p-4 bg-[#FAF8F5] border border-stone-300 text-[#8c2a2a]">
                      <Brain size={36} />
                    </div>
                    <h3 className="font-serif text-xl font-normal italic">No Ticker Mounted</h3>
                    <p className="text-xs text-stone-500 max-w-sm leading-relaxed font-serif">
                      Select a company from the directory list on the left or search using Command Palette (Ctrl+K) to mount a context workspace.
                    </p>
                  </div>
                ) : !selectedAsset.intel ? (
                  <div className="py-24 text-center flex flex-col items-center justify-center gap-4">
                    <RefreshCw size={28} className="animate-spin text-[#8c2a2a]" />
                    <h3 className="font-serif text-lg italic">Compiling Research Registry</h3>
                    <p className="text-xs text-stone-400 font-mono">Resolving options pricing indexes and cash efficiency coefficients...</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-6" style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                    
                    {/* Header Workspace Title and Action Ribbon */}
                    <div className="border-b-2 border-stone-800 pb-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
                      <div>
                        <div className="font-mono text-[9px] text-[#8c2a2a] uppercase tracking-widest font-bold flex items-center gap-1.5">
                          <Activity size={10} /> Active Company Workspace Context
                        </div>
                        <h2 className="font-serif text-4xl font-normal text-[#1A1A1A] mt-1" style={{ border: 'none', padding: 0 }}>
                          {selectedAsset.intel.name}
                        </h2>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-mono text-stone-500 mt-1.5">
                          <strong className="text-stone-800">{selectedAsset.ticker}:{selectedAsset.exchange}</strong>
                          <span>|</span>
                          <span>{selectedAsset.intel.sector}</span>
                          <span>|</span>
                          <span>{selectedAsset.intel.research.fundamentals?.industry || 'Data unavailable'}</span>
                          <span>|</span>
                          <span className="bg-[#FAF8F5] border border-stone-200 px-1.5 py-0.5 text-[10px] text-[#8c2a2a] font-bold">
                            CONFIDENCE: {researchReport?.confidenceScore || selectedAsset.intel.qualityScore}%
                          </span>
                          <span>|</span>
                          <span className="text-stone-600 font-bold">
                            FRESHNESS: {formatFreshness(selectedAsset.intel.updatedAt)}
                          </span>
                        </div>
                      </div>

                      {/* Action Ribbon */}
                      <div className="flex gap-2 flex-wrap">
                        <button 
                          onClick={() => navigate(`/copilot?ticker=${selectedAsset.ticker.toLowerCase()}`)}
                          className="text-stone-600 hover:text-[#8c2a2a] border border-stone-300 px-3 py-1.5 font-mono text-[10px] uppercase bg-[#FAF8F5] hover:bg-stone-50 transition-colors flex items-center gap-1"
                          aria-label="Discuss with Copilot"
                        >
                          <MessageSquare size={10} /> Discuss
                        </button>
                        <button 
                          onClick={() => handleRecalculate(selectedAsset.ticker, selectedAsset.exchange)}
                          disabled={recalculating === `${selectedAsset.ticker}:${selectedAsset.exchange}`}
                          className="text-stone-600 hover:text-[#8c2a2a] border border-stone-300 px-3 py-1.5 font-mono text-[10px] uppercase bg-[#FAF8F5] hover:bg-stone-50 transition-colors flex items-center gap-1 disabled:opacity-50"
                          aria-label="Recalculate Conviction"
                        >
                          <RefreshCw size={10} className={recalculating === `${selectedAsset.ticker}:${selectedAsset.exchange}` ? 'animate-spin' : ''} />
                          {recalculating === `${selectedAsset.ticker}:${selectedAsset.exchange}` ? 'Recalculating...' : 'Recalculate'}
                        </button>
                        <button 
                          onClick={() => ExportService.exportIntelligenceReportToMarkdown(selectedAsset.intel!, selectedAsset.conviction)}
                          className="text-stone-600 hover:text-[#8c2a2a] border border-stone-300 px-3 py-1.5 font-mono text-[10px] uppercase bg-[#FAF8F5] hover:bg-stone-50 transition-colors flex items-center gap-1"
                          aria-label="Export Markdown Brief"
                        >
                          <Download size={10} /> Markdown
                        </button>
                        <button 
                          onClick={() => ExportService.exportIntelligenceReportToPDF(selectedAsset.intel!, selectedAsset.conviction)}
                          className="text-stone-600 hover:text-[#8c2a2a] border border-stone-300 px-3 py-1.5 font-mono text-[10px] uppercase bg-[#FAF8F5] hover:bg-stone-50 transition-colors flex items-center gap-1"
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
                      marginBottom: '1rem',
                      overflowX: 'auto',
                      gap: '0.5rem'
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
                            style={{
                              padding: '0.65rem 1rem',
                              border: '1px solid transparent',
                              borderBottom: 'none',
                              fontFamily: 'var(--font-sans)',
                              fontWeight: isTabActive ? 'bold' : 500,
                              fontSize: '0.8rem',
                              background: isTabActive ? '#FAF8F5' : 'transparent',
                              borderColor: isTabActive ? '#E2DACD' : 'transparent',
                              color: isTabActive ? '#8c2a2a' : '#555',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                              transition: 'all 0.15s ease-in-out'
                            }}
                          >
                            {tab.name}
                          </button>
                        );
                      })}
                    </div>

                    {/* Active Workspace View Rendering */}
                    <div className="scrollable-panel" style={{ flexGrow: 1, overflowY: 'auto', maxHeight: 'calc(100vh - 355px)', paddingRight: '0.5rem' }}>
                      
                      {/* TAB 1: OVERVIEW */}
                      {activeTab === 'overview' && (
                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                          {/* Left summary block */}
                          <div className="xl:col-span-2 flex flex-col gap-6">
                            <div className="border border-stone-300 p-6 bg-[#FCFAF6] shadow-sm">
                              <h3 className="font-serif text-lg font-bold text-stone-900 border-b border-stone-200 pb-2 mb-4">
                                Executive Investment Thesis
                              </h3>
                              <div className="flex flex-col gap-4 font-serif text-sm leading-relaxed text-[#1A1A1A]">
                                <p className="italic bg-white p-4 border-l-4 border-[#8c2a2a] text-stone-850 text-xs shadow-sm">
                                  "{getExecutiveThesis(selectedAsset.intel, selectedAsset.conviction)}"
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                                  <div className="bg-white p-4 border border-stone-200 rounded-none shadow-xs">
                                    <strong className="font-mono text-[9px] uppercase tracking-wider text-stone-400 block mb-1">Primary Opportunity</strong>
                                    <p className="text-stone-700 font-serif text-[11px] leading-relaxed">
                                      {getPrimaryOpportunity(selectedAsset.intel)}
                                    </p>
                                  </div>
                                  <div className="bg-white p-4 border border-stone-200 rounded-none shadow-xs">
                                    <strong className="font-mono text-[9px] uppercase tracking-wider text-stone-400 block mb-1">Core Catalysts</strong>
                                    <p className="text-stone-700 font-serif text-[11px] leading-relaxed">
                                      {getPrimaryRisk(selectedAsset.intel)}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Supporting Evidence block */}
                            <div className="border border-[#E5E2D9] p-6 bg-white shadow-sm">
                              <h3 className="font-serif text-lg font-bold text-stone-900 border-b border-stone-200 pb-2 mb-4">
                                Supporting Evidence & Technical Deviation
                              </h3>
                              <p className="font-serif text-[11px] text-stone-600 mb-4 leading-relaxed">
                                Analytical support indicates that statistical pullback margins-of-safety are preserved. Volatility indices and exponential moving averages verify that short-term price pullbacks exist inside structural long-term asset appreciation patterns.
                              </p>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs font-mono text-stone-600 bg-[#FCFAF6] border border-stone-200 p-4">
                                <div>
                                  <span className="text-[9px] text-stone-400 uppercase block">Current Live Price</span>
                                  <strong className="text-stone-950 text-xs font-bold">${(selectedAsset.intel.dip.currentPrice || 0).toFixed(2)}</strong>
                                </div>
                                <div>
                                  <span className="text-[9px] text-stone-400 uppercase block">Z-Score Price Deviation</span>
                                  <strong className="text-stone-950 text-xs font-bold">{(selectedAsset.intel.dip.zScore || 0).toFixed(2)} σ</strong>
                                </div>
                                <div>
                                  <span className="text-[9px] text-stone-400 uppercase block">Historical Volatility</span>
                                  <strong className="text-stone-950 text-xs font-bold">{(selectedAsset.intel.dip.volatility || 0).toFixed(2)}</strong>
                                </div>
                                <div>
                                  <span className="text-[9px] text-stone-400 uppercase block">52-Week Range</span>
                                  <strong className="text-stone-950 text-xs font-bold">${(selectedAsset.intel.dip.fiftyTwoWeekLow || 0).toFixed(0)} - ${(selectedAsset.intel.dip.fiftyTwoWeekHigh || 0).toFixed(0)}</strong>
                                </div>
                                <div>
                                  <span className="text-[9px] text-stone-400 uppercase block">50-Day Price EMA</span>
                                  <strong className="text-stone-950 text-xs font-bold">${(selectedAsset.intel.dip.ema50 || 0).toFixed(2)}</strong>
                                </div>
                                <div>
                                  <span className="text-[9px] text-stone-400 uppercase block">Technical Pullback Status</span>
                                  <strong className="text-stone-950 text-xs font-bold uppercase">{selectedAsset.intel.dip.dipDetected ? (selectedAsset.intel.dip.classification || 'Active Pullback') : 'Baseline bounds'}</strong>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Right rating panel */}
                          <div className="xl:col-span-1 flex flex-col gap-6">
                            <div className="bg-[#FCFAF6] border-2 border-[#8c2a2a] p-6 text-center shadow-md relative overflow-hidden">
                              <div className="absolute top-0 left-0 w-full h-1.5 bg-[#8c2a2a]" />
                              <span className="font-mono text-[9px] text-stone-400 uppercase tracking-widest block mb-2 font-bold">Conviction Rating</span>
                              
                              <div className="font-serif text-5xl font-bold text-[#8c2a2a] my-2 select-none">
                                {selectedAsset.conviction?.overallScore || '—'}
                              </div>
                              
                              <span style={{ fontSize: '0.55rem' }} className="font-mono font-bold text-stone-800 uppercase tracking-wider block bg-white border border-stone-200 py-1 px-2 inline-block rounded-none shadow-xs mt-1">
                                {(() => {
                                  const score = selectedAsset.conviction?.overallScore || 0;
                                  return score >= 75 ? '🔥 High Conviction Buy' : score >= 50 ? '🟡 Moderate Conviction Hold' : '❌ Low Conviction / Restrict';
                                })()}
                              </span>

                              <div className="flex flex-col gap-3 text-left text-xs border-t border-stone-200 pt-4 mt-4">
                                <div>
                                  <div className="flex justify-between font-mono font-bold mb-1 text-[10px]">
                                    <span className="text-stone-700">Portfolio Exposure Sizing</span>
                                    <span className="text-stone-900">{selectedAsset.conviction?.breakdown.allocationFactor.contribution || 0} / 25</span>
                                  </div>
                                  <div className="w-full h-1 bg-stone-200 rounded-none overflow-hidden">
                                    <div className="h-full bg-[#8c2a2a]" style={{ width: `${((selectedAsset.conviction?.breakdown.allocationFactor.contribution || 0) / 25) * 100}%` }} />
                                  </div>
                                </div>
                                <div>
                                  <div className="flex justify-between font-mono font-bold mb-1 text-[10px]">
                                    <span className="text-stone-700">Fundamental Quality Index</span>
                                    <span className="text-stone-900">{selectedAsset.conviction?.breakdown.fundamentalFactor.contribution || 0} / 25</span>
                                  </div>
                                  <div className="w-full h-1 bg-stone-200 rounded-none overflow-hidden">
                                    <div className="h-full bg-[#8c2a2a]" style={{ width: `${((selectedAsset.conviction?.breakdown.fundamentalFactor.contribution || 0) / 25) * 100}%` }} />
                                  </div>
                                </div>
                                <div>
                                  <div className="flex justify-between font-mono font-bold mb-1 text-[10px]">
                                    <span className="text-stone-700">Technical Dip Premium</span>
                                    <span className="text-stone-900">{selectedAsset.conviction?.breakdown.dipFactor.contribution || 0} / 25</span>
                                  </div>
                                  <div className="w-full h-1 bg-stone-200 rounded-none overflow-hidden">
                                    <div className="h-full bg-[#8c2a2a]" style={{ width: `${((selectedAsset.conviction?.breakdown.dipFactor.contribution || 0) / 25) * 100}%` }} />
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Operational Risk warning */}
                            <div className="bg-[#FDF2F2] border border-[#F8B4B4] p-5 shadow-xs">
                              <h3 className="font-serif text-base font-bold text-[#9B1C1C] border-b border-[#F8B4B4] pb-2 mb-3 flex items-center gap-1">
                                <AlertTriangle size={14} /> Risk Factors & warnings
                              </h3>
                              <div className="flex flex-col gap-3 text-[11px] text-[#9B1C1C]">
                                {selectedAsset.intel.research.leverageRatio >= 0.4 && (
                                  <div className="bg-white border border-[#F8B4B4] p-2 font-sans leading-normal">
                                    <strong>⚠️ Leverage warning:</strong> Leverage ratio is {(selectedAsset.intel.research.leverageRatio || 0).toFixed(2)}, which exceeds the targeted 0.40 limit.
                                  </div>
                                )}
                                <div className="font-sans leading-normal text-stone-700">
                                  <strong>Primary Catalyst Alert:</strong>
                                  <p className="italic text-stone-700 mt-1 font-serif">
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
                        <div className="flex flex-col gap-6">
                          <div className="border border-stone-300 p-6 bg-white shadow-sm">
                            <h3 className="font-serif text-lg font-bold text-stone-900 border-b border-stone-200 pb-2 mb-4 flex items-center gap-1.5">
                              <Briefcase size={16} /> Institutional Research Engine Brief
                            </h3>
                            
                            {researchLoading ? (
                              <div className="flex items-center gap-2 text-stone-500 font-mono text-xs py-8">
                                <RefreshCw size={14} className="animate-spin" /> Compiling Data Moat Research Report...
                              </div>
                            ) : researchReport ? (
                              <div className="flex flex-col gap-5 text-xs text-[#1A1A1A] font-serif leading-relaxed">
                                <div className="bg-[#FCFAF6] border border-stone-200 p-4">
                                  <strong className="font-mono text-[9px] uppercase tracking-wider text-stone-450 block mb-1">1. Business Overview & Context</strong>
                                  <p className="text-stone-850 font-sans leading-relaxed text-sm">
                                    {researchReport.executiveSummary}
                                  </p>
                                </div>

                                <div className="bg-[#FCFAF6] border border-stone-200 p-4">
                                  <strong className="font-mono text-[9px] uppercase tracking-wider text-stone-450 block mb-1">2. Financial Metrics Analysis</strong>
                                  <p className="text-stone-850 font-sans leading-relaxed text-sm">
                                    {researchReport.financialMetricsAnalysis}
                                  </p>
                                </div>

                                <div className="bg-[#FCFAF6] border border-stone-200 p-4">
                                  <strong className="font-mono text-[9px] uppercase tracking-wider text-stone-450 block mb-1">3. Risks and Mitigations</strong>
                                  <p className="text-stone-850 font-sans leading-relaxed text-sm">
                                    {researchReport.risksAndMitigations}
                                  </p>
                                </div>

                                {/* Filing Change Alert log */}
                                <div className="border border-stone-200 p-4 bg-white">
                                  <strong className="font-mono text-[9px] uppercase tracking-wider text-stone-450 block mb-2">Filing Change Detector Alerts</strong>
                                  {researchReport.changeDetectionAlerts.length > 0 ? (
                                    <div className="flex flex-col gap-2">
                                      {researchReport.changeDetectionAlerts.map((alert, i) => (
                                        <div key={i} className="flex flex-col sm:flex-row sm:justify-between font-mono text-[10px] pb-1 border-b border-stone-100 last:border-b-0">
                                          <div>
                                            <span className={alert.direction === 'improved' ? 'text-green-700 font-bold' : alert.direction === 'deteriorated' ? 'text-red-700 font-bold' : 'text-stone-600'}>
                                              {alert.direction.toUpperCase()}
                                            </span>
                                            <span className="text-stone-800 ml-1.5">{alert.metric}:</span>
                                          </div>
                                          <div className="text-stone-600">
                                            {alert.previousValue} → <strong>{alert.currentValue}</strong> ({alert.changePercent > 0 ? '+' : ''}{alert.changePercent}%)
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-stone-400 italic text-[10px] font-mono">No material filing changes detected relative to recent history.</span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="text-stone-450 font-mono text-[10px] italic">Verify cache database connection.</div>
                            )}
                          </div>

                          {/* Citations Full-Width Block */}
                          <div className="border border-stone-300 p-6 bg-[#FCFAF6] shadow-sm">
                            <div className="flex justify-between items-center mb-4 flex-wrap gap-2 border-b border-stone-200 pb-2">
                              <h4 className="font-serif text-base font-bold text-stone-900">Sources and Citation Trail</h4>
                              {researchReport && (
                                <ProvenanceBadge 
                                  category={selectedAsset.exchange === 'NSE' || selectedAsset.exchange === 'BSE' ? 'News Intelligence' : 'Regulatory Filings'}
                                  source={selectedAsset.exchange === 'NSE' || selectedAsset.exchange === 'BSE' ? 'Investor Relations disclosures' : 'SEC EDGAR Database'}
                                  timestamp={researchReport.generationDate}
                                  confidence={researchReport.confidenceScore > 90 ? 'High' : 'Medium'}
                                />
                              )}
                            </div>
                            <div className="flex flex-col gap-1 text-[10px] font-mono">
                              {researchReport && researchReport.sourcesUsed && researchReport.sourcesUsed.length > 0 ? (
                                researchReport.sourcesUsed.map((src, i) => (
                                  <div key={i} className="flex justify-between text-stone-600 items-center">
                                    {src.url ? (
                                      <a href={src.url} target="_blank" rel="noopener noreferrer" className="hover:text-[#8c2a2a] text-[#8c2a2a] underline flex items-center gap-0.5">
                                        {src.name} <ExternalLink size={8} />
                                      </a>
                                    ) : (
                                      <span>{src.name}</span>
                                    )}
                                    <span className="text-stone-400">{src.timestamp}</span>
                                  </div>
                                ))
                              ) : (
                                <span className="text-stone-400 italic">No formal external citations linked.</span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* TAB 3: FINANCIAL STATEMENTS */}
                      {activeTab === 'financials' && (
                        <div className="flex flex-col gap-6">
                          
                          {/* Quality score parameters */}
                          <div className="border border-stone-300 p-6 bg-white shadow-sm">
                            <h3 className="font-serif text-lg font-bold text-stone-900 border-b border-stone-200 pb-2 mb-4">
                              Balance Sheet Quality Framework ({selectedAsset.intel.qualityScore}/100)
                            </h3>
                            
                            {(() => {
                              const qb = selectedAsset.intel.qualityBreakdown || {
                                moat: { score: selectedAsset.intel.qualityScore >= 70 ? 40 : 25, max: 40, weight: 0.4, contribution: selectedAsset.intel.qualityScore >= 70 ? 40 : 25, value: selectedAsset.intel.research.moatRating.toUpperCase(), rationale: selectedAsset.intel.research.moatRationale },
                                leverage: { score: selectedAsset.intel.research.leverageRatio < 0.4 ? 30 : 20, max: 30, weight: 0.3, contribution: selectedAsset.intel.research.leverageRatio < 0.4 ? 30 : 20, value: selectedAsset.intel.research.leverageRatio, rationale: `Leverage ratio is ${selectedAsset.intel.research.leverageRatio.toFixed(2)}.` },
                                fcfMargin: { score: selectedAsset.intel.research.freeCashFlowMargin > 25 ? 30 : 20, max: 30, weight: 0.3, contribution: selectedAsset.intel.research.freeCashFlowMargin > 25 ? 30 : 20, value: selectedAsset.intel.research.freeCashFlowMargin, rationale: `FCF Margin is ${selectedAsset.intel.research.freeCashFlowMargin.toFixed(1)}%.` }
                              };
                              
                              return (
                                <div className="flex flex-col gap-4 text-xs">
                                  <div className="border-b border-stone-100 pb-3">
                                    <div className="flex justify-between font-mono font-bold text-stone-800 mb-1">
                                      <span>Economic Moat Rating</span>
                                      <span className="text-[#8c2a2a]">{qb.moat.score} / {qb.moat.max} Max</span>
                                    </div>
                                    <div className="font-mono text-[9px] uppercase text-[#8c2a2a] mb-1.5 font-bold">Class: {qb.moat.value}</div>
                                    <p className="font-serif italic text-stone-600 text-[11px] leading-normal bg-[#FCFAF6] border-l-2 border-stone-300 p-2">
                                      "{qb.moat.rationale}"
                                    </p>
                                  </div>

                                  <div className="border-b border-stone-100 pb-3">
                                    <div className="flex justify-between font-mono font-bold text-stone-800 mb-1">
                                      <span>Solvency & Leverage</span>
                                      <span className="text-[#8c2a2a]">{qb.leverage.score} / {qb.leverage.max} Max</span>
                                    </div>
                                    <div className="font-mono text-[9px] uppercase text-stone-400 mb-1.5">Target ratio: &lt; 0.40</div>
                                    <p className="text-stone-600 text-[11px] leading-normal">
                                      {qb.leverage.rationale}
                                    </p>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>

                          {/* Historical margins table */}
                          <div className="border border-stone-300 p-6 bg-white shadow-sm">
                            <h3 className="font-mono text-[10px] text-[#8c2a2a] uppercase tracking-widest font-bold border-b border-stone-200 pb-2 mb-4">
                              Earnings & Margin Trend (Historical highlights)
                            </h3>
                            
                            {researchReport && researchReport.earningsTrend.length > 0 ? (
                              <div className="overflow-x-auto">
                                <table className="w-full text-left font-mono text-[10px] border-collapse">
                                  <thead>
                                    <tr className="border-b border-stone-300 font-bold uppercase text-stone-500">
                                      <th className="pb-1.5">Reporting Date</th>
                                      <th className="pb-1.5 text-right">Quarterly Revenue</th>
                                      <th className="pb-1.5 text-right">Operating Margin</th>
                                      <th className="pb-1.5 text-right">Net Income</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {researchReport.earningsTrend.map((trend, i) => (
                                      <tr key={i} className="border-b border-stone-100 last:border-b-0">
                                        <td className="py-1.5">{trend.quarter}</td>
                                        <td className="py-1.5 text-right font-bold">
                                          {selectedAsset.exchange === 'NSE' || selectedAsset.exchange === 'BSE' 
                                            ? `₹${(trend.revenue / 10000000).toFixed(0)} Cr`
                                            : `$${(trend.revenue / 1000000000).toFixed(2)}B`}
                                        </td>
                                        <td className="py-1.5 text-right font-bold" style={{ color: trend.operatingMargin > 25 ? '#2C6B50' : trend.operatingMargin > 10 ? '#B45309' : '#9B1C1C' }}>
                                          {trend.operatingMargin.toFixed(1)}%
                                        </td>
                                        <td className="py-1.5 text-right text-stone-600">
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
                              <div className="text-stone-400 font-mono text-[10px] italic">No historical stats cached.</div>
                            )}
                          </div>

                          {/* Verification table */}
                          <div className="border border-stone-300 p-6 bg-white shadow-sm">
                            <h3 className="font-mono text-[9px] text-[#8c2a2a] uppercase tracking-widest font-bold border-b border-stone-200 pb-1.5 mb-3 flex items-center gap-1.5">
                              <Shield size={12} /> Live Intelligence Verification Audit Log
                            </h3>
                            <div className="overflow-x-auto text-[10px] font-mono text-stone-600 bg-white border border-[#E5E2D9] p-3">
                              <table className="w-full text-left">
                                <thead>
                                  <tr className="border-b border-stone-300 font-bold uppercase text-stone-500">
                                    <th className="pb-1.5">Model Metric</th>
                                    <th className="pb-1.5">Value</th>
                                    <th className="pb-1.5">Classification</th>
                                    <th className="pb-1.5">Sourcing Registry</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr className="border-b border-stone-100">
                                    <td className="py-1.5">Economic Moat</td>
                                    <td className="py-1.5 font-bold">{selectedAsset.intel.research.moatRating.toUpperCase()}</td>
                                    <td className="py-1.5 text-purple-700 font-bold">AI Interpretation</td>
                                    <td className="py-1.5">Gemini 3.1 Pro</td>
                                  </tr>
                                  <tr className="border-b border-stone-100">
                                    <td className="py-1.5">Debt to Equity</td>
                                    <td className="py-1.5 font-bold">{(selectedAsset.intel.research.fundamentals?.debtToEquity || 0).toFixed(2)}</td>
                                    <td className="py-1.5 text-[#8c2a2a] font-bold">Real Market Data</td>
                                    <td className="py-1.5">Finnhub Core API</td>
                                  </tr>
                                  <tr>
                                    <td className="pt-1.5">FCF Margin</td>
                                    <td className="pt-1.5 font-bold">{(selectedAsset.intel.research.freeCashFlowMargin || 0).toFixed(1)}%</td>
                                    <td className="pt-1.5 text-[#8c2a2a] font-bold">Real Market Data</td>
                                    <td className="pt-1.5">Finnhub Core API</td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* TAB 4: SMART MONEY FLOW */}
                      {activeTab === 'smart_money' && (
                        <div className="border border-[#E5E2D9] p-6 bg-white shadow-sm">
                          <h3 className="font-serif text-lg font-bold text-stone-900 border-b border-stone-200 pb-2 mb-4">
                            Smart Money Flow Dashboard
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Insider Activity */}
                            <div className="p-4 border border-stone-200 bg-[#FCFAF6] flex flex-col justify-between shadow-xs">
                              <div>
                                <div className="flex justify-between items-center font-mono font-bold border-b border-stone-200 pb-1.5 mb-2.5 text-stone-850">
                                  <span>Insider Net Volume</span>
                                  <span className="px-1.5 py-0.5 bg-white border border-stone-200 text-[8px] uppercase tracking-wider text-[#8c2a2a] font-bold">
                                    Conf: {selectedAsset.intel.smartMoney.insiderTransactions?.confidence || 'none'}
                                  </span>
                                </div>
                                {selectedAsset.intel.smartMoney.insiderTransactions?.value ? (
                                  <div className="font-mono text-[10px] text-stone-700 leading-normal flex flex-col gap-1">
                                    <div><strong>Net Volume:</strong> {selectedAsset.intel.smartMoney.insiderTransactions.value.netSharesBought.toLocaleString()} Shares</div>
                                    <div><strong>Transactions (90d):</strong> {selectedAsset.intel.smartMoney.insiderTransactions.value.totalTransactionsCount} ({selectedAsset.intel.smartMoney.insiderTransactions.value.buyCount} buys, {selectedAsset.intel.smartMoney.insiderTransactions.value.sellCount} sells)</div>
                                  </div>
                                ) : (
                                  <div className="text-stone-450 font-mono text-[9px] italic">Data unavailable</div>
                                )}
                              </div>
                              <div className="text-[8px] text-stone-400 font-mono mt-3 border-t border-stone-200 pt-1">
                                SOURCE: SEC FORM 4 FILINGS
                              </div>
                            </div>

                            {/* Officer Sentiment */}
                            <div className="p-4 border border-stone-200 bg-[#FCFAF6] flex flex-col justify-between shadow-xs">
                              <div>
                                <div className="flex justify-between items-center font-mono font-bold border-b border-stone-200 pb-1.5 mb-2.5 text-stone-850">
                                  <span>Corporate Officer Sentiment</span>
                                  <span className="px-1.5 py-0.5 bg-white border border-stone-200 text-[8px] uppercase tracking-wider text-[#8c2a2a] font-bold">
                                    Conf: {selectedAsset.intel.smartMoney.insiderSentiment?.confidence || 'none'}
                                  </span>
                                </div>
                                {selectedAsset.intel.smartMoney.insiderSentiment?.value ? (
                                  <div className="font-mono text-[10px] text-stone-700 leading-normal flex flex-col gap-1">
                                    <div><strong>Monthly Purchase Ratio:</strong> {selectedAsset.intel.smartMoney.insiderSentiment.value.mspr.toFixed(2)} Index</div>
                                    <div><strong>Officer Share Change:</strong> {selectedAsset.intel.smartMoney.insiderSentiment.value.change.toLocaleString()} Shares</div>
                                  </div>
                                ) : (
                                  <div className="text-stone-450 font-mono text-[9px] italic">Data unavailable</div>
                                )}
                              </div>
                              <div className="text-[8px] text-stone-400 font-mono mt-3 border-t border-stone-200 pt-1">
                                SOURCE: FINNHUB INSIDER API
                              </div>
                            </div>

                            {/* Options Ratio */}
                            <div className="p-4 border border-stone-200 bg-[#FCFAF6] flex flex-col justify-between shadow-xs">
                              <div>
                                <div className="flex justify-between items-center font-mono font-bold border-b border-stone-200 pb-1.5 mb-2.5 text-stone-850">
                                  <span>Options Volume Ratio</span>
                                  <span className="px-1.5 py-0.5 bg-white border border-stone-200 text-[8px] uppercase tracking-wider text-[#8c2a2a] font-bold">
                                    Conf: {selectedAsset.intel.smartMoney.optionsVolume?.confidence || 'none'}
                                  </span>
                                </div>
                                {selectedAsset.intel.smartMoney.optionsVolume?.value ? (
                                  <div className="font-mono text-[10px] text-stone-700 leading-normal flex flex-col gap-1">
                                    <div><strong>Put/Call Volume Ratio:</strong> {selectedAsset.intel.smartMoney.optionsVolume.value.putCallRatio.toFixed(2)}</div>
                                    <div><strong>Sentiment Classification:</strong> {selectedAsset.intel.smartMoney.optionsVolume.value.sentiment.toUpperCase()}</div>
                                  </div>
                                ) : (
                                  <div className="text-stone-450 font-mono text-[9px] italic">Data unavailable</div>
                                )}
                              </div>
                              <div className="text-[8px] text-stone-400 font-mono mt-3 border-t border-stone-200 pt-1">
                                SOURCE: HISTORICAL OPTIONS DATA
                              </div>
                            </div>

                            {/* 13F Ownership */}
                            <div className="p-4 border border-stone-200 bg-[#FCFAF6] flex flex-col justify-between shadow-xs">
                              <div>
                                <div className="flex justify-between items-center font-mono font-bold border-b border-stone-200 pb-1.5 mb-2.5 text-stone-850">
                                  <span>Institutional 13F Ownership</span>
                                  <span className="px-1.5 py-0.5 bg-white border border-stone-200 text-[8px] uppercase tracking-wider text-[#8c2a2a] font-bold">
                                    Conf: {selectedAsset.intel.smartMoney.institutionalOwnership?.confidence || 'none'}
                                  </span>
                                </div>
                                {selectedAsset.intel.smartMoney.institutionalOwnership?.value ? (
                                  <div className="font-mono text-[10px] text-stone-700 leading-normal flex flex-col gap-1">
                                    <div><strong>Institutional Ownership:</strong> {selectedAsset.intel.smartMoney.institutionalOwnership.value.ownershipPercent.toFixed(1)}%</div>
                                    <div><strong>Fund Net Flows:</strong> {selectedAsset.intel.smartMoney.institutionalOwnership.value.netFlow.toUpperCase()}</div>
                                  </div>
                                ) : (
                                  <div className="text-stone-450 font-mono text-[9px] italic">Data unavailable</div>
                                )}
                              </div>
                              <div className="text-[8px] text-stone-400 font-mono mt-3 border-t border-stone-200 pt-1">
                                SOURCE: SEC FORM 13F FILINGS
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* TAB 5: BUSINESS SCHOOL */}
                      {activeTab === 'business_school' && (
                        <div className="border border-[#E5E2D9] p-6 bg-[#FCFAF6] flex flex-col gap-6">
                          
                          {/* Concept Selectors */}
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', borderBottom: '1px solid #E2DACD', paddingBottom: '0.75rem' }}>
                            {[
                              { id: 'operating_leverage', name: 'Operating Leverage' },
                              { id: 'economic_moats', name: 'Economic Moats' },
                              { id: 'free_cash_flow_margin', name: 'FCF Margin' },
                              { id: 'financial_solvency', name: 'Financial Solvency' }
                            ].map(c => (
                              <button
                                key={c.id}
                                onClick={() => setBsConcept(c.id)}
                                style={{
                                  background: bsConcept === c.id ? '#8c2a2a' : '#FFFFFF',
                                  color: bsConcept === c.id ? '#FFFFFF' : '#222222',
                                  border: '1px solid #E2DACD',
                                  padding: '0.4rem 0.75rem',
                                  fontSize: '0.75rem',
                                  fontFamily: 'var(--font-sans)',
                                  fontWeight: bsConcept === c.id ? 'bold' : 500,
                                  cursor: 'pointer'
                                }}
                              >
                                {c.name}
                              </button>
                            ))}
                          </div>

                          {bsLoading ? (
                            <div className="py-12 text-center font-serif italic text-stone-500">
                              <RefreshCw size={20} className="animate-spin inline mr-1 text-[#8c2a2a]" /> Resolving textbook models...
                            </div>
                          ) : bsCaseData ? (
                            <div className="flex flex-col gap-4 text-xs font-sans text-stone-800 leading-relaxed">
                              <div>
                                <h4 className="font-mono text-[9px] text-stone-400 uppercase tracking-wider mb-1 font-bold">Concept Definition</h4>
                                <p className="bg-white border border-stone-200 p-3 font-serif italic">
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

                              <div className="bg-white border border-stone-200 p-3 font-mono text-[11px]">
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
                                <h4 className="font-mono text-[9px] text-stone-400 uppercase tracking-wider mb-1 font-bold">Academic Harvard Case Study</h4>
                                <p className="bg-white border border-stone-200 p-3">
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
                                <h4 className="font-mono text-[9px] text-stone-400 uppercase tracking-wider mb-1 font-bold">Active Case study application ({bsCaseData.companyName})</h4>
                                <div className="italic font-serif leading-relaxed text-stone-800 bg-white border-l-4 border-[#8c2a2a] p-4 shadow-sm">
                                  <p>{bsCaseData.caseStudyNarrative}</p>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="text-stone-450 italic font-serif text-xs">Verify study registry connection.</div>
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
                          background: '#FAF8F5'
                        }}>
                          {/* Messages Feed */}
                          <div style={{
                            flexGrow: 1,
                            overflowY: 'auto',
                            padding: '1rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.75rem'
                          }}>
                            {copilotMessages.map(msg => (
                              <div
                                key={msg.id}
                                style={{
                                  alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                                  maxWidth: '80%',
                                  background: msg.sender === 'user' ? '#8c2a2a' : '#FFFFFF',
                                  color: msg.sender === 'user' ? '#FFFFFF' : '#222222',
                                  padding: '0.65rem 1rem',
                                  border: '1px solid #E2DACD',
                                  fontSize: '0.8rem',
                                  lineHeight: 1.4,
                                  fontFamily: msg.sender === 'user' ? 'var(--font-sans)' : 'var(--font-serif)'
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
                                fontSize: '0.75rem',
                                color: '#666',
                                fontFamily: 'var(--font-mono)'
                              }}>
                                <RefreshCw size={10} className="animate-spin inline mr-1" /> Synthesizing data registry metrics...
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
                            overflowX: 'auto'
                          }}>
                            {[
                              { label: 'Analyze Solvency Ratios', prompt: `What is the solvency risk and interest coverage ratio for ${selectedAsset.ticker}?` },
                              { label: 'Check Smart Money net flows', prompt: `Summarize the institutional 13F and insider transactions flow for ${selectedAsset.ticker}.` },
                              { label: 'Evaluate Moat Rating', prompt: `What are the competitive moats and primary business risks of ${selectedAsset.ticker}?` }
                            ].map((q, idx) => (
                              <button
                                key={idx}
                                onClick={() => setCopilotInput(q.prompt)}
                                style={{
                                  background: '#FFFFFF',
                                  border: '1px solid #E2DACD',
                                  padding: '0.25rem 0.6rem',
                                  fontSize: '0.65rem',
                                  fontFamily: 'var(--font-sans)',
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                  color: '#555'
                                }}
                              >
                                {q.label}
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
                                padding: '0 1rem',
                                color: copilotInput.trim() ? '#8c2a2a' : '#CCC',
                                cursor: copilotInput.trim() ? 'pointer' : 'default'
                              }}
                            >
                              <Send size={16} />
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
