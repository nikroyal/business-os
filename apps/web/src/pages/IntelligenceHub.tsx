import React, { useState, useEffect } from 'react';
import { dbService, authService } from '../services/firebase';
import type { CompanyIntelligence, UserConviction, Holding } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import IntelligenceService from '../services/intelligenceService';
import { ExportService } from '../services/exportService';
import { ResearchEngine } from '../services/researchEngine';
import type { ResearchReport } from '../services/researchEngine';
import { ProvenanceBadge } from '../components/ProvenanceBadge';
import { ExternalLink } from 'lucide-react';
import {
  Brain,
  TrendingUp,
  TrendingDown,
  BookOpen,
  Shield,
  Search,
  FileText,
  ChevronRight,
  RefreshCw,
  Download,
  Activity,
  Briefcase
} from 'lucide-react';

export const IntelligenceHub: React.FC = () => {
  const { user } = useAuth();
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [convictions, setConvictions] = useState<UserConviction[]>([]);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState<string | null>(null);
  
  // Search and directory selection state
  const [searchTerm, setSearchTerm] = useState('');
  
  // Selected asset details for research terminal workspace
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
  const [bsTicker, setBsTicker] = useState<string>('');
  const [bsExchange, setBsExchange] = useState<string>('NASDAQ');
  const [bsCaseData, setBsCaseData] = useState<any | null>(null);
  const [bsLoading, setBsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const userHoldings = await dbService.getHoldings(user.uid);
      setHoldings(userHoldings);
      
      const userConvictions = await IntelligenceService.fetchAllConvictions();
      setConvictions(userConvictions);

      // Auto-select first non-cash asset if present
      const firstAsset = userHoldings.find(h => h.ticker !== 'CASH');
      if (firstAsset) {
        setBsTicker(firstAsset.ticker);
        setBsExchange(firstAsset.exchange);
        handleSelectAsset(firstAsset.ticker, firstAsset.exchange, userConvictions);
      }

      // Automatically recalculate missing convictions in the background (Self-Healing)
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
    if (!bsTicker) return;
    setBsLoading(true);
    setBsCaseData(null);
    try {
      const data = await IntelligenceService.fetchBusinessSchoolCase(bsConcept, bsTicker, bsExchange);
      setBsCaseData(data);
    } catch (err) {
      console.error('Error compiling case study:', err);
    } finally {
      setBsLoading(false);
    }
  };

  useEffect(() => {
    if (bsTicker) {
      fetchCaseStudy();
    }
  }, [bsConcept, bsTicker, bsExchange]);

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

  // Executive Narrative Generators answering "Why care about this company?"
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

  // Directory filter logic
  const activeHoldings = holdings.filter(h => h.ticker !== 'CASH');
  
  const filteredHoldings = activeHoldings.filter(h => {
    const search = searchTerm.toLowerCase();
    return h.ticker.toUpperCase().includes(search.toUpperCase()) || h.name.toLowerCase().includes(search);
  });

  // Sort holdings by conviction score to get "Top Ideas First" (Section 2)
  const rankedIdeas = [...activeHoldings]
    .map(h => {
      const conv = convictions.find(
        c => c.ticker.toUpperCase() === h.ticker.toUpperCase() && c.exchange.toUpperCase() === h.exchange.toUpperCase()
      );
      return { holding: h, conviction: conv };
    })
    .sort((a, b) => (b.conviction?.overallScore || 0) - (a.conviction?.overallScore || 0));

  // Sector stats
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
    <div className="min-h-screen bg-[#FDFCF7] text-[#1A1A1A] p-4 md:p-8 font-sans selection:bg-[#E5E2D9]">
      
      {/* FT-Style Editorial Header */}
      <header className="border-b-2 border-stone-800 pb-5 mb-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="font-mono text-xs uppercase tracking-widest text-[#8c2a2a] mb-1 font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#8c2a2a]"></span>
              Institutional Sovereign Intelligence
            </div>
            <h1 className="font-serif text-4xl font-normal tracking-tight text-[#1A1A1A] mb-1">
              Investment Intelligence Hub
            </h1>
            <p className="text-sm text-stone-600 max-w-xl font-serif italic">
              Algorithmic sovereign research directory mapping capital structures, smart money registries, and discount pullbacks.
            </p>
          </div>
          <div className="font-mono text-xs text-stone-500 text-left md:text-right border-l-2 md:border-l-0 md:border-r-2 border-[#8c2a2a] pl-3 md:pr-3">
            <div>STATUS: INTEGRITY AUDITED</div>
            <div>SECURITIES LINKED: {totalAssetsCount}</div>
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
            <h2 className="font-mono text-xs uppercase tracking-widest text-[#8c2a2a] font-bold border-b border-stone-200 pb-2 mb-4">
              [Section 1 — Portfolio Intelligence Command Center]
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

          {/* SECTION 2 — HIGHEST CONVICTION OPPORTUNITIES */}
          <section aria-label="Highest Conviction Opportunities" className="bg-white border border-[#E5E2D9] p-4 md:p-6 shadow-sm">
            <h2 className="font-mono text-xs uppercase tracking-widest text-[#8c2a2a] font-bold border-b border-stone-200 pb-2 mb-4">
              [Section 2 — Highest Conviction Investment Opportunities]
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {rankedIdeas.slice(0, 3).map((item, index) => {
                const h = item.holding;
                const score = item.conviction?.overallScore || 0;
                const quality = item.conviction?.breakdown.fundamentalFactor.score || 0;
                
                let dipClass = "No active dip";
                let smartFlow = "Neutral Flows";
                if (item.conviction) {
                  if (item.conviction.breakdown.dipFactor.score > 15) dipClass = "Classified healthy dip";
                  else if (item.conviction.breakdown.dipFactor.score > 10) dipClass = "Uncertain dip";
                  if (item.conviction.breakdown.institutionalFactor.score >= 18) smartFlow = "Net insider accumulation";
                }
                
                // Construct a dynamic one-line thesis matching exactly their data (no fabrication)
                const thesis = `${h.name} matches a quality framework score of ${quality}/100 under a ${dipClass.toLowerCase()} pattern while indicating ${smartFlow.toLowerCase()}.`;

                return (
                  <div 
                    key={h.id} 
                    onClick={() => handleSelectAsset(h.ticker, h.exchange)}
                    className="border border-stone-300 p-4 bg-[#FCFAF6] hover:bg-[#FDFCF7] hover:border-stone-800 transition-all cursor-pointer relative"
                  >
                    <span className="absolute top-2 right-3 font-mono text-[9px] text-stone-400 font-bold uppercase">
                      RANK #{index + 1}
                    </span>
                    
                    <div className="font-serif text-lg font-bold text-stone-900">{h.name}</div>
                    <div className="font-mono text-xs text-stone-500 mb-3">{h.ticker}:{h.exchange}</div>
                    
                    <div className="grid grid-cols-2 gap-y-2 border-t border-stone-200 pt-3 text-xs font-mono">
                      <div>Conviction Index:</div>
                      <div className="text-right font-bold text-[#8c2a2a]">{score}/100</div>

                      <div>Quality Framework:</div>
                      <div className="text-right text-stone-700">{quality}/100</div>

                      <div>Dip Classification:</div>
                      <div className="text-right text-stone-700 uppercase text-[10px]">{item.conviction?.breakdown.dipFactor.score ? (item.conviction.breakdown.dipFactor.score > 10 ? 'HEALTHY DIP' : 'BASELINE') : '—'}</div>

                      <div>Smart Money Sentinel:</div>
                      <div className="text-right text-stone-700 uppercase text-[10px]">{item.conviction?.breakdown.institutionalFactor.score ? (item.conviction.breakdown.institutionalFactor.score >= 18 ? 'ACCUMULATING' : 'NEUTRAL') : '—'}</div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-dashed border-stone-300">
                      <p className="text-xs font-serif text-[#1A1A1A] leading-relaxed italic">
                        "{thesis}"
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* SPLIT PANE: DIRECTORY & WORKSPACE */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* LEFT COLUMN: ACTIVE MONITORED ASSETS DIRECTORY */}
            <div className="lg:col-span-1 flex flex-col gap-6">
              <section className="bg-white border border-[#E5E2D9] p-4 md:p-6 shadow-sm">
                <div className="border-b border-stone-200 pb-3 mb-4">
                  <h2 className="font-serif text-2xl font-normal text-[#1A1A1A]">
                    Monitored Directory
                  </h2>
                  <span className="font-mono text-[9px] text-stone-400 uppercase">Search and mount assets into workspace</span>
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
                          onClick={() => handleSelectAsset(h.ticker, h.exchange)}
                          style={{ borderLeft: isSelected ? '4px solid #8c2a2a' : '4px solid transparent' }}
                          className={`p-3 border border-stone-200 hover:bg-[#FAF8F5] cursor-pointer flex justify-between items-center transition-colors ${
                            isSelected ? 'bg-[#F9F8F4] border-stone-500' : 'bg-[#FCFAF6]'
                          }`}
                        >
                          <div>
                            <div className="font-serif text-sm font-bold text-stone-900">{h.ticker}</div>
                            <div className="font-mono text-[10px] text-stone-500">{h.name}</div>
                          </div>
                          <div className="text-right">
                            <span className="font-serif text-base font-bold text-stone-800">
                              {scoreRecord ? scoreRecord.overallScore : '—'}
                            </span>
                            <span className="font-mono text-[9px] text-stone-400 block uppercase">Conviction</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>
            </div>

            {/* RIGHT COLUMN: SECTION 3 & 4 — FLAGSHIP RESEARCH WORKSPACE */}
            <div className="lg:col-span-2">
              <section className="bg-white border border-[#E5E2D9] p-4 md:p-6 shadow-sm">
                
                {!selectedAsset ? (
                  <div className="py-24 text-center flex flex-col items-center justify-center gap-4">
                    <div className="p-4 bg-[#FAF8F5] border border-stone-300 text-[#8c2a2a]">
                      <Brain size={36} />
                    </div>
                    <h3 className="font-serif text-xl font-normal italic">No Asset Mounted in Workspace</h3>
                    <p className="text-xs text-stone-500 max-w-sm leading-relaxed font-serif">
                      Select any company from the monitored directory list on the left to mount its data modules and generate the institutional research brief.
                    </p>
                  </div>
                ) : !selectedAsset.intel ? (
                  <div className="py-24 text-center flex flex-col items-center justify-center gap-4">
                    <RefreshCw size={28} className="animate-spin text-[#8c2a2a]" />
                    <h3 className="font-serif text-lg italic">Compiling Research Registry</h3>
                    <p className="text-xs text-stone-400 font-mono">Resolving options pricing indexes and cash efficiency coefficients...</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-8">
                    
                    {/* Header Workspace Title and Exports */}
                    <div className="border-b-2 border-stone-800 pb-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
                      <div>
                        <div className="font-mono text-[9px] text-[#8c2a2a] uppercase tracking-widest font-bold flex items-center gap-1.5">
                          <Activity size={10} /> Live Workspace Rationale
                        </div>
                        <h2 className="font-serif text-4xl font-normal text-[#1A1A1A] mt-1">
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

                      <div className="flex gap-2 flex-wrap">
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

                    {/* Bloomberg-FT Flagship Analysis Dashboard Layout Grid */}
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                      
                      {/* LEFT SECTION (Col Span 2) */}
                      <div className="xl:col-span-2 flex flex-col gap-6">
                        
                        {/* 1. Executive Summary & Thesis */}
                        <div className="border border-stone-300 p-6 bg-[#FCFAF6] shadow-sm">
                          <h3 className="font-serif text-xl font-bold text-stone-900 border-b border-stone-200 pb-2 mb-4">
                            Executive Investment Thesis
                          </h3>
                          <div className="flex flex-col gap-4 font-serif text-sm leading-relaxed text-[#1A1A1A]">
                            <p className="italic bg-white p-4 border-l-4 border-[#8c2a2a] text-stone-850 text-base shadow-sm">
                              "{getExecutiveThesis(selectedAsset.intel, selectedAsset.conviction)}"
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                              <div className="bg-white p-4 border border-stone-200 rounded-none shadow-xs">
                                <strong className="font-mono text-[10px] uppercase tracking-wider text-stone-400 block mb-1">Primary Opportunity</strong>
                                <p className="text-stone-700 font-serif text-xs leading-relaxed">
                                  {getPrimaryOpportunity(selectedAsset.intel)}
                                </p>
                              </div>
                              <div className="bg-white p-4 border border-stone-200 rounded-none shadow-xs">
                                <strong className="font-mono text-[10px] uppercase tracking-wider text-stone-400 block mb-1">Core Catalysts</strong>
                                <p className="text-stone-700 font-serif text-xs leading-relaxed">
                                  {getPrimaryRisk(selectedAsset.intel)}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* 2. Supporting Evidence & Pullback Deviation workbench */}
                        <div className="border border-[#E5E2D9] p-6 bg-white shadow-sm">
                          <h3 className="font-serif text-xl font-bold text-stone-900 border-b border-stone-200 pb-2 mb-4">
                            Supporting Evidence & Technical Deviation
                          </h3>
                          <p className="font-serif text-xs text-stone-600 mb-4 leading-relaxed">
                            Analytical support indicates that statistical pullback margins-of-safety are preserved. Volatility indices and exponential moving averages verify that short-term price pullbacks exist inside structural long-term asset appreciation patterns.
                          </p>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs font-mono text-stone-600 bg-[#FCFAF6] border border-stone-200 p-4">
                            <div>
                              <span className="text-[9px] text-stone-400 uppercase block">Current Live Price</span>
                              <strong className="text-stone-950 text-sm font-bold">${(selectedAsset.intel.dip.currentPrice || 0).toFixed(2)}</strong>
                            </div>
                            <div>
                              <span className="text-[9px] text-stone-400 uppercase block">Z-Score Price Deviation</span>
                              <strong className="text-stone-950 text-sm font-bold">{(selectedAsset.intel.dip.zScore || 0).toFixed(2)} σ</strong>
                            </div>
                            <div>
                              <span className="text-[9px] text-stone-400 uppercase block">Historical Volatility</span>
                              <strong className="text-stone-950 text-sm font-bold">{(selectedAsset.intel.dip.volatility || 0).toFixed(2)}</strong>
                            </div>
                            <div>
                              <span className="text-[9px] text-stone-400 uppercase block">52-Week Range</span>
                              <strong className="text-stone-950 text-sm font-bold">${(selectedAsset.intel.dip.fiftyTwoWeekLow || 0).toFixed(0)} - ${(selectedAsset.intel.dip.fiftyTwoWeekHigh || 0).toFixed(0)}</strong>
                            </div>
                            <div>
                              <span className="text-[9px] text-stone-400 uppercase block">50-Day Price EMA</span>
                              <strong className="text-stone-950 text-sm font-bold">${(selectedAsset.intel.dip.ema50 || 0).toFixed(2)}</strong>
                            </div>
                            <div>
                              <span className="text-[9px] text-stone-400 uppercase block">Technical Pullback Status</span>
                              <strong className="text-stone-950 text-sm font-bold uppercase">{selectedAsset.intel.dip.dipDetected ? (selectedAsset.intel.dip.classification || 'Active Pullback') : 'Baseline bounds'}</strong>
                            </div>
                          </div>
                        </div>

                        {/* 3. Smart Money Dashboard (Insider & Institutional flows) */}
                        <div className="border border-[#E5E2D9] p-6 bg-white shadow-sm">
                          <h3 className="font-serif text-xl font-bold text-stone-900 border-b border-stone-200 pb-2 mb-4">
                            Smart Money Flow Dashboard
                          </h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            
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
                                  <div className="font-mono text-[11px] text-stone-700 leading-normal flex flex-col gap-1">
                                    <div><strong>Net Volume:</strong> {selectedAsset.intel.smartMoney.insiderTransactions.value.netSharesBought.toLocaleString()} Shares</div>
                                    <div><strong>Transactions (90d):</strong> {selectedAsset.intel.smartMoney.insiderTransactions.value.totalTransactionsCount} ({selectedAsset.intel.smartMoney.insiderTransactions.value.buyCount} buys, {selectedAsset.intel.smartMoney.insiderTransactions.value.sellCount} sells)</div>
                                  </div>
                                ) : (
                                  <div className="text-stone-450 font-mono text-[10px] italic">Data unavailable</div>
                                )}
                              </div>
                              <div className="text-[8px] text-stone-400 font-mono mt-3 border-t border-stone-200 pt-1">
                                SOURCE: SEC FORM 4 FILINGS | AS OF: {selectedAsset.intel.smartMoney.insiderTransactions?.timestamp ? new Date(selectedAsset.intel.smartMoney.insiderTransactions.timestamp).toLocaleDateString() : 'Baseline'}
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
                                  <div className="font-mono text-[11px] text-stone-700 leading-normal flex flex-col gap-1">
                                    <div><strong>Monthly Purchase Ratio:</strong> {selectedAsset.intel.smartMoney.insiderSentiment.value.mspr.toFixed(2)} Index</div>
                                    <div><strong>Officer Share Change:</strong> {selectedAsset.intel.smartMoney.insiderSentiment.value.change.toLocaleString()} Shares</div>
                                  </div>
                                ) : (
                                  <div className="text-stone-450 font-mono text-[10px] italic">Data unavailable</div>
                                )}
                              </div>
                              <div className="text-[8px] text-stone-400 font-mono mt-3 border-t border-stone-200 pt-1">
                                SOURCE: FINNHUB INSIDER API | AS OF: {selectedAsset.intel.smartMoney.insiderSentiment?.timestamp ? new Date(selectedAsset.intel.smartMoney.insiderSentiment.timestamp).toLocaleDateString() : 'Baseline'}
                              </div>
                            </div>

                            {/* Options Put/Call */}
                            <div className="p-4 border border-stone-200 bg-[#FCFAF6] flex flex-col justify-between shadow-xs">
                              <div>
                                <div className="flex justify-between items-center font-mono font-bold border-b border-stone-200 pb-1.5 mb-2.5 text-stone-850">
                                  <span>Options Volume Ratio</span>
                                  <span className="px-1.5 py-0.5 bg-white border border-stone-200 text-[8px] uppercase tracking-wider text-[#8c2a2a] font-bold">
                                    Conf: {selectedAsset.intel.smartMoney.optionsVolume?.confidence || 'none'}
                                  </span>
                                </div>
                                {selectedAsset.intel.smartMoney.optionsVolume?.value ? (
                                  <div className="font-mono text-[11px] text-stone-700 leading-normal flex flex-col gap-1">
                                    <div><strong>Put/Call Volume Ratio:</strong> {selectedAsset.intel.smartMoney.optionsVolume.value.putCallRatio.toFixed(2)}</div>
                                    <div><strong>Sentiment Classification:</strong> {selectedAsset.intel.smartMoney.optionsVolume.value.sentiment.toUpperCase()}</div>
                                  </div>
                                ) : (
                                  <div className="text-stone-450 font-mono text-[10px] italic">Data unavailable</div>
                                )}
                              </div>
                              <div className="text-[8px] text-stone-400 font-mono mt-3 border-t border-stone-200 pt-1">
                                SOURCE: HISTORICAL OPTIONS DATA | AS OF: {selectedAsset.intel.smartMoney.optionsVolume?.timestamp ? new Date(selectedAsset.intel.smartMoney.optionsVolume.timestamp).toLocaleDateString() : 'Baseline'}
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
                                  <div className="font-mono text-[11px] text-stone-700 leading-normal flex flex-col gap-1">
                                    <div><strong>Institutional Ownership:</strong> {selectedAsset.intel.smartMoney.institutionalOwnership.value.ownershipPercent.toFixed(1)}%</div>
                                    <div><strong>Fund Net Flows:</strong> {selectedAsset.intel.smartMoney.institutionalOwnership.value.netFlow.toUpperCase()}</div>
                                  </div>
                                ) : (
                                  <div className="text-stone-450 font-mono text-[10px] italic">Data unavailable</div>
                                )}
                              </div>
                              <div className="text-[8px] text-stone-400 font-mono mt-3 border-t border-stone-200 pt-1">
                                SOURCE: SEC FORM 13F DATABASES | AS OF: {selectedAsset.intel.smartMoney.institutionalOwnership?.timestamp ? new Date(selectedAsset.intel.smartMoney.institutionalOwnership.timestamp).toLocaleDateString() : 'Baseline'}
                              </div>
                            </div>

                          </div>
                        </div>

                        {/* 4. Research Summary Cards */}
                        <div className="border border-stone-300 p-6 bg-white shadow-sm">
                          <h3 className="font-serif text-xl font-bold text-stone-900 border-b border-stone-200 pb-2 mb-4 flex items-center gap-1.5">
                            <Briefcase size={18} /> Institutional Research Engine Brief
                          </h3>
                          
                          {researchLoading ? (
                            <div className="flex items-center gap-2 text-stone-500 font-mono text-xs py-8">
                              <RefreshCw size={14} className="animate-spin" /> Compiling Data Moat Research Report...
                            </div>
                          ) : researchReport ? (
                            <div className="flex flex-col gap-5 text-xs text-[#1A1A1A] font-serif leading-relaxed">
                              
                              {/* Executive Summary Narrative */}
                              <div className="bg-[#FCFAF6] border border-stone-200 p-4">
                                <strong className="font-mono text-[9px] uppercase tracking-wider text-stone-450 block mb-1">1. Business Overview & Context</strong>
                                <p className="text-stone-850 font-sans leading-relaxed text-sm">
                                  {researchReport.executiveSummary}
                                </p>
                              </div>

                              {/* Financial Analysis */}
                              <div className="bg-[#FCFAF6] border border-stone-200 p-4">
                                <strong className="font-mono text-[9px] uppercase tracking-wider text-stone-450 block mb-1">2. Financial Metrics Analysis</strong>
                                <p className="text-stone-850 font-sans leading-relaxed text-sm">
                                  {researchReport.financialMetricsAnalysis}
                                </p>
                              </div>

                              {/* Key Risks */}
                              <div className="bg-[#FCFAF6] border border-stone-200 p-4">
                                <strong className="font-mono text-[9px] uppercase tracking-wider text-stone-450 block mb-1">3. Risks and Mitigations</strong>
                                <p className="text-stone-850 font-sans leading-relaxed text-sm">
                                  {researchReport.risksAndMitigations}
                                </p>
                              </div>

                              {/* Filing Change Detector Alerts */}
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

                              {/* Earnings Trend */}
                              <div>
                                <strong className="font-mono text-[9px] uppercase tracking-wider text-stone-450 block mb-2">Earnings & Margin Trend (Historical Highlights)</strong>
                                {researchReport.earningsTrend.length > 0 ? (
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-left font-mono text-[9px] border-collapse">
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
                                  <span className="text-stone-400 italic text-[10px] font-mono">Historical earnings stats unavailable</span>
                                )}
                              </div>

                            </div>
                          ) : (
                            <div className="text-stone-400 font-mono text-[10px] italic">
                              Select an asset above to load details or verify cache database connection.
                            </div>
                          )}
                        </div>

                      </div>

                      {/* RIGHT SECTION (Col Span 1) */}
                      <div className="xl:col-span-1 flex flex-col gap-6">
                        
                        {/* 1. Large Conviction Score Card */}
                        <div className="bg-[#FCFAF6] border-2 border-[#8c2a2a] p-6 text-center shadow-md relative overflow-hidden">
                          <div className="absolute top-0 left-0 w-full h-1.5 bg-[#8c2a2a]" />
                          <span className="font-mono text-[10px] text-stone-400 uppercase tracking-widest block mb-2 font-bold">Conviction Rating</span>
                          
                          <div className="font-serif text-6xl font-bold text-[#8c2a2a] my-2 select-none">
                            {selectedAsset.conviction?.overallScore || '—'}
                          </div>
                          
                          <span className="font-mono text-xs font-bold text-stone-800 uppercase tracking-wider block bg-white border border-stone-200 py-1 px-3 inline-block rounded-none shadow-xs mt-1">
                            {(() => {
                              const score = selectedAsset.conviction?.overallScore || 0;
                              return score >= 75 ? '🔥 High Conviction Buy' : score >= 50 ? '🟡 Moderate Conviction Hold' : '❌ Low Conviction / Restrict';
                            })()}
                          </span>

                          <div className="flex flex-col gap-3.5 text-left text-xs border-t border-stone-200 pt-5 mt-5">
                            
                            {/* Allocation */}
                            <div>
                              <div className="flex justify-between font-mono font-bold mb-1">
                                <span className="text-stone-700">Portfolio Exposure Sizing</span>
                                <span className="text-stone-900">{selectedAsset.conviction?.breakdown.allocationFactor.contribution || 0} / 25</span>
                              </div>
                              <div className="w-full h-1.5 bg-stone-200 rounded-none overflow-hidden">
                                <div className="h-full bg-[#8c2a2a]" style={{ width: `${((selectedAsset.conviction?.breakdown.allocationFactor.contribution || 0) / 25) * 100}%` }} />
                              </div>
                            </div>

                            {/* Fundamental */}
                            <div>
                              <div className="flex justify-between font-mono font-bold mb-1">
                                <span className="text-stone-700">Fundamental Quality Index</span>
                                <span className="text-stone-900">{selectedAsset.conviction?.breakdown.fundamentalFactor.contribution || 0} / 25</span>
                              </div>
                              <div className="w-full h-1.5 bg-stone-200 rounded-none overflow-hidden">
                                <div className="h-full bg-[#8c2a2a]" style={{ width: `${((selectedAsset.conviction?.breakdown.fundamentalFactor.contribution || 0) / 25) * 100}%` }} />
                              </div>
                            </div>

                            {/* Dip */}
                            <div>
                              <div className="flex justify-between font-mono font-bold mb-1">
                                <span className="text-stone-700">Technical Dip Premium</span>
                                <span className="text-stone-900">{selectedAsset.conviction?.breakdown.dipFactor.contribution || 0} / 25</span>
                              </div>
                              <div className="w-full h-1.5 bg-stone-200 rounded-none overflow-hidden">
                                <div className="h-full bg-[#8c2a2a]" style={{ width: `${((selectedAsset.conviction?.breakdown.dipFactor.contribution || 0) / 25) * 100}%` }} />
                              </div>
                            </div>

                            {/* Institutional */}
                            <div>
                              <div className="flex justify-between font-mono font-bold mb-1">
                                <span className="text-stone-700">Institutional / Insider support</span>
                                <span className="text-stone-900">{selectedAsset.conviction?.breakdown.institutionalFactor.contribution || 0} / 25</span>
                              </div>
                              <div className="w-full h-1.5 bg-stone-200 rounded-none overflow-hidden">
                                <div className="h-full bg-[#8c2a2a]" style={{ width: `${((selectedAsset.conviction?.breakdown.institutionalFactor.contribution || 0) / 25) * 100}%` }} />
                              </div>
                            </div>

                          </div>
                        </div>

                        {/* 2. Quality Score Visualization */}
                        <div className="border border-stone-300 p-5 bg-white shadow-sm">
                          <h3 className="font-serif text-lg font-bold text-stone-900 border-b border-stone-200 pb-2 mb-4">
                            Quality Score Framework ({selectedAsset.intel.qualityScore}/100)
                          </h3>
                          
                          {(() => {
                            const qb = selectedAsset.intel.qualityBreakdown || {
                              moat: { score: selectedAsset.intel.qualityScore >= 70 ? 40 : 25, max: 40, weight: 0.4, contribution: selectedAsset.intel.qualityScore >= 70 ? 40 : 25, value: selectedAsset.intel.research.moatRating.toUpperCase(), rationale: selectedAsset.intel.research.moatRationale },
                              leverage: { score: selectedAsset.intel.research.leverageRatio < 0.4 ? 30 : 20, max: 30, weight: 0.3, contribution: selectedAsset.intel.research.leverageRatio < 0.4 ? 30 : 20, value: selectedAsset.intel.research.leverageRatio, rationale: `Leverage ratio is ${selectedAsset.intel.research.leverageRatio.toFixed(2)}.` },
                              fcfMargin: { score: selectedAsset.intel.research.freeCashFlowMargin > 25 ? 30 : 20, max: 30, weight: 0.3, contribution: selectedAsset.intel.research.freeCashFlowMargin > 25 ? 30 : 20, value: selectedAsset.intel.research.freeCashFlowMargin, rationale: `FCF Margin is ${selectedAsset.intel.research.freeCashFlowMargin.toFixed(1)}%.` }
                            };
                            
                            return (
                              <div className="flex flex-col gap-4 text-xs">
                                
                                {/* Moat */}
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

                                {/* Solvency */}
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

                                {/* Cash Flow */}
                                <div>
                                  <div className="flex justify-between font-mono font-bold text-stone-800 mb-1">
                                    <span>Cash Generation Capacity</span>
                                    <span className="text-[#8c2a2a]">{qb.fcfMargin.score} / {qb.fcfMargin.max} Max</span>
                                  </div>
                                  <div className="font-mono text-[9px] uppercase text-stone-400 mb-1.5">Target FCF Margin: &gt; 25.0%</div>
                                  <p className="text-stone-600 text-[11px] leading-normal">
                                    {qb.fcfMargin.rationale}
                                  </p>
                                </div>

                              </div>
                            );
                          })()}
                        </div>

                        {/* 3. Risks & Catalysts section */}
                        <div className="bg-[#FDF2F2] border border-[#F8B4B4] p-5 shadow-xs">
                          <h3 className="font-serif text-lg font-bold text-[#9B1C1C] border-b border-[#F8B4B4] pb-2 mb-3">
                            Risk Factors & Catalysts
                          </h3>
                          <div className="flex flex-col gap-3 text-xs text-[#9B1C1C]">
                            
                            {/* Leverage Warning */}
                            {selectedAsset.intel.research.leverageRatio >= 0.4 && (
                              <div className="bg-white border border-[#F8B4B4] p-2.5 font-sans leading-normal">
                                <strong>⚠️ High Leverage Ratio Warning:</strong> Leverage ratio is {(selectedAsset.intel.research.leverageRatio || 0).toFixed(2)}, which exceeds the targeted 0.40 limit. Re-check interest coverage rates.
                              </div>
                            )}

                            {/* Major catalog risks */}
                            <div className="font-sans leading-normal">
                              <strong>Primary Operational Risks:</strong>
                              <ul className="list-disc pl-4 mt-1.5 flex flex-col gap-1 text-stone-700">
                                {selectedAsset.intel.research.majorRisks && selectedAsset.intel.research.majorRisks.length > 0 ? (
                                  selectedAsset.intel.research.majorRisks.map((risk, i) => (
                                    <li key={i}>{risk}</li>
                                  ))
                                ) : (
                                  <li>Competitor price war and regulatory changes.</li>
                                )}
                              </ul>
                            </div>

                            {/* Technical Catalyst Alert */}
                            <div className="font-sans leading-normal mt-1 border-t border-[#F8B4B4] pt-3">
                              <strong>Current Catalyst Alert:</strong>
                              <p className="italic text-stone-700 mt-1 font-serif">
                                "{selectedAsset.intel.dip.catalyst || 'Baseline structural competition'}"
                              </p>
                            </div>

                          </div>
                        </div>

                      </div>

                    </div>

                    {/* Citations and Sources Full-Width Block */}
                    <div className="border border-stone-300 p-6 bg-[#FCFAF6] shadow-sm">
                      <div className="flex justify-between items-center mb-4 flex-wrap gap-2 border-b border-stone-200 pb-2">
                        <h4 className="font-serif text-lg font-bold text-stone-900">Sources and Citation Trail</h4>
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
                          <span className="text-stone-400 italic">No formal external citations linked to this snapshot rationale.</span>
                        )}
                      </div>
                    </div>

                    {/* Verification Audit Log Block */}
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
                              <th className="pb-1.5">Last Checked</th>
                            </tr>
                          </thead>
                          <tbody>
                            {/* Moat */}
                            <tr className="border-b border-stone-100">
                              <td className="py-1.5">Economic Moat</td>
                              <td className="py-1.5 font-bold">{selectedAsset.intel.research.moatRating.toUpperCase()}</td>
                              <td className="py-1.5 text-purple-700 font-bold">AI Interpretation</td>
                              <td className="py-1.5">Gemini 1.5 Pro</td>
                              <td className="py-1.5">{new Date(selectedAsset.intel.updatedAt).toLocaleDateString()}</td>
                            </tr>
                            {/* Debt */}
                            <tr className="border-b border-stone-100">
                              <td className="py-1.5">Debt to Equity</td>
                              <td className="py-1.5 font-bold">{(selectedAsset.intel.research.fundamentals?.debtToEquity || 0).toFixed(2)}</td>
                              <td className="py-1.5 text-[#8c2a2a] font-bold">Real Market Data</td>
                              <td className="py-1.5">Finnhub Core api</td>
                              <td className="py-1.5">{new Date(selectedAsset.intel.updatedAt).toLocaleDateString()}</td>
                            </tr>
                            {/* FCF */}
                            <tr className="border-b border-stone-100">
                              <td className="py-1.5">FCF Margin</td>
                              <td className="py-1.5 font-bold">{(selectedAsset.intel.research.freeCashFlowMargin || 0).toFixed(1)}%</td>
                              <td className="py-1.5 text-[#8c2a2a] font-bold">Real Market Data</td>
                              <td className="py-1.5">Finnhub Core api</td>
                              <td className="py-1.5">{new Date(selectedAsset.intel.updatedAt).toLocaleDateString()}</td>
                            </tr>
                            {/* Z-score */}
                            <tr className="border-b border-stone-100">
                              <td className="py-1.5">Z-Score Deviation</td>
                              <td className="py-1.5 font-bold">{(selectedAsset.intel.dip.zScore || 0).toFixed(2)} σ</td>
                              <td className="py-1.5 text-blue-700 font-bold">Derived Analytics</td>
                              <td className="py-1.5">EMA Calculation</td>
                              <td className="py-1.5">{new Date(selectedAsset.intel.dip.updatedAt).toLocaleDateString()}</td>
                            </tr>
                            {/* Insider buying */}
                            <tr className="border-b border-stone-100">
                              <td className="py-1.5">Insider buying</td>
                              <td className="py-1.5 font-bold">
                                {selectedAsset.intel.smartMoney.insiderTransactions?.value 
                                  ? selectedAsset.intel.smartMoney.insiderTransactions.value.netSharesBought.toLocaleString() 
                                  : 'Unavailable'}
                              </td>
                              <td className="py-1.5 font-bold" style={{ color: selectedAsset.intel.smartMoney.insiderTransactions?.value ? 'var(--color-accent)' : 'var(--text-muted)' }}>
                                {selectedAsset.intel.smartMoney.insiderTransactions?.value ? 'Regulatory Filing' : 'Unavailable'}
                              </td>
                              <td className="py-1.5">SEC Form 4</td>
                              <td className="py-1.5">{selectedAsset.intel.smartMoney.insiderTransactions?.value ? new Date(selectedAsset.intel.smartMoney.insiderTransactions.timestamp).toLocaleDateString() : '—'}</td>
                            </tr>
                            {/* Options volume */}
                            <tr className="border-b border-stone-100">
                              <td className="py-1.5">Options Volume</td>
                              <td className="py-1.5 font-bold">
                                {selectedAsset.intel.smartMoney.optionsVolume?.value 
                                  ? selectedAsset.intel.smartMoney.optionsVolume.value.putCallRatio.toFixed(2) 
                                  : 'Unavailable'}
                              </td>
                              <td className="py-1.5 text-stone-400 font-bold">Derived Options Ratio</td>
                              <td className="py-1.5">Options Database</td>
                              <td className="py-1.5">{selectedAsset.intel.smartMoney.optionsVolume?.timestamp ? new Date(selectedAsset.intel.smartMoney.optionsVolume.timestamp).toLocaleDateString() : '—'}</td>
                            </tr>
                            {/* 13F Ownership */}
                            <tr>
                              <td className="pt-1.5">13F Ownership</td>
                              <td className="pt-1.5 font-bold">
                                {selectedAsset.intel.smartMoney.institutionalOwnership?.value 
                                  ? `${selectedAsset.intel.smartMoney.institutionalOwnership.value.ownershipPercent.toFixed(1)}%` 
                                  : 'Unavailable'}
                              </td>
                              <td className="pt-1.5 text-stone-400 font-bold">Regulatory 13F</td>
                              <td className="pt-1.5">SEC Edgar 13F</td>
                              <td className="pt-1.5">{selectedAsset.intel.smartMoney.institutionalOwnership?.timestamp ? new Date(selectedAsset.intel.smartMoney.institutionalOwnership.timestamp).toLocaleDateString() : '—'}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                  </div>
                )}
              </section>
            </div>
          </div>

          {/* SECTION 5 — DYNAMIC ACADEMIC BUSINESS SCHOOL LESSON */}
          <section className="bg-white border border-[#E5E2D9] p-4 md:p-6 shadow-sm mt-8">
            <div className="border-b border-[#E5E2D9] pb-4 mb-6">
              <div className="font-mono text-xs uppercase tracking-widest text-[#8c2a2a] mb-1 font-bold flex items-center gap-1.5">
                <BookOpen size={12} />
                Section 5 — Investor Business School
              </div>
              <h2 className="font-serif text-3xl font-normal text-[#1A1A1A]">
                Academic Investment Frameworks
              </h2>
              <p className="text-sm text-stone-600 max-w-2xl mt-1">
                We bind classical economic definitions to the parameters calculated live from your portfolio holdings.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Left Selector Sidebar */}
              <div className="lg:col-span-1 flex flex-col gap-2">
                <button
                  onClick={() => setBsConcept('operating_leverage')}
                  className={`text-left font-serif text-base py-3 px-4 border transition-all flex justify-between items-center ${
                    bsConcept === 'operating_leverage'
                      ? 'border-stone-800 bg-[#FAF8F5] font-bold text-[#8c2a2a]'
                      : 'border-transparent text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  <span>Operating Leverage</span>
                  <ChevronRight size={16} className={bsConcept === 'operating_leverage' ? 'text-[#8c2a2a]' : 'text-stone-300'} />
                </button>
                
                <button
                  onClick={() => setBsConcept('economic_moats')}
                  className={`text-left font-serif text-base py-3 px-4 border transition-all flex justify-between items-center ${
                    bsConcept === 'economic_moats'
                      ? 'border-stone-800 bg-[#FAF8F5] font-bold text-[#8c2a2a]'
                      : 'border-transparent text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  <span>Economic Moats</span>
                  <ChevronRight size={16} className={bsConcept === 'economic_moats' ? 'text-[#8c2a2a]' : 'text-stone-300'} />
                </button>
                
                <button
                  onClick={() => setBsConcept('free_cash_flow_margin')}
                  className={`text-left font-serif text-base py-3 px-4 border transition-all flex justify-between items-center ${
                    bsConcept === 'free_cash_flow_margin'
                      ? 'border-stone-800 bg-[#FAF8F5] font-bold text-[#8c2a2a]'
                      : 'border-transparent text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  <span>Free Cash Flow Margin</span>
                  <ChevronRight size={16} className={bsConcept === 'free_cash_flow_margin' ? 'text-[#8c2a2a]' : 'text-stone-300'} />
                </button>
                
                <button
                  onClick={() => setBsConcept('financial_solvency')}
                  className={`text-left font-serif text-base py-3 px-4 border transition-all flex justify-between items-center ${
                    bsConcept === 'financial_solvency'
                      ? 'border-stone-800 bg-[#FAF8F5] font-bold text-[#8c2a2a]'
                      : 'border-transparent text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  <span>Financial Solvency</span>
                  <ChevronRight size={16} className={bsConcept === 'financial_solvency' ? 'text-[#8c2a2a]' : 'text-stone-300'} />
                </button>
                
                {/* Select holding to apply concept */}
                <div className="mt-4 p-4 bg-[#FCFAF6] border border-stone-200">
                  <label htmlFor="bs-ticker-selector" className="font-mono text-[9px] text-stone-500 uppercase tracking-wide block mb-1.5 font-bold">
                    Link Live Holding Instance:
                  </label>
                  <select
                    id="bs-ticker-selector"
                    value={bsTicker}
                    onChange={e => {
                      const h = holdings.find(item => item.ticker === e.target.value);
                      if (h) {
                        setBsTicker(h.ticker);
                        setBsExchange(h.exchange);
                      }
                    }}
                    className="w-full bg-white border border-stone-300 font-mono text-xs p-2.5 focus:outline-none focus:border-stone-800"
                  >
                    {holdings.filter(h => h.ticker !== 'CASH').map(h => (
                      <option key={h.id} value={h.ticker}>
                        {h.ticker} ({h.name})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Right Content Lesson card */}
              <div className="lg:col-span-3 bg-[#FAF8F5] border border-[#E5E2D9] p-6 flex flex-col justify-between">
                {bsLoading ? (
                  <div className="py-20 text-center font-serif italic text-stone-400 flex flex-col items-center justify-center gap-2">
                    <RefreshCw size={24} className="animate-spin text-[#8c2a2a]" />
                    Compiling academic framework narratives with live assets...
                  </div>
                ) : bsCaseData ? (
                  <div className="flex flex-col gap-5 text-sm font-sans text-[#1A1A1A]">
                    
                    {/* Lesson brief title */}
                    <div className="flex justify-between items-start border-b border-[#E5E2D9] pb-4">
                      <div>
                        <span className="font-mono text-[9px] text-[#8c2a2a] uppercase tracking-widest font-bold">[ACADEMIC CASE BRIEF]</span>
                        <h3 className="font-serif text-2xl font-normal mt-1">{bsCaseData.conceptName}</h3>
                      </div>
                      <div className="font-mono text-xs text-stone-600 bg-white border border-[#E5E2D9] px-3 py-1.5 uppercase font-semibold">
                        Textbook study: Apple Inc. Case
                      </div>
                    </div>

                    {/* Academic Definition */}
                    <div>
                      <h4 className="font-mono text-[10px] text-stone-500 uppercase tracking-wider mb-1.5 font-bold">Academic Definition</h4>
                      <p className="text-stone-700 bg-white border border-stone-200 p-4 leading-relaxed font-serif">
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

                    {/* Formula Mathematical panel */}
                    <div className="bg-white border border-[#E5E2D9] p-4 font-mono text-xs text-stone-700 my-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-stone-400 text-[10px] uppercase">Mathematical Formula:</span>
                        <strong className="text-stone-900 font-serif text-sm italic">
                          {bsConcept === 'operating_leverage' 
                            ? 'Degree of Operating Leverage (DOL) = % Change in EBIT / % Change in Sales' 
                            : bsConcept === 'economic_moats' 
                              ? 'Return on Invested Capital (ROIC) - Weighted Average Cost of Capital (WACC) > 0' 
                              : bsConcept === 'free_cash_flow_margin' 
                                ? 'FCF Margin (%) = [Operating Cash Flow - Capital Expenditures] / Total Revenue' 
                                : 'Debt to Equity Ratio = Total Liabilities / Shareholder Equity (Target < 0.40)'
                          }
                        </strong>
                      </div>
                      <span className="font-mono text-[9px] text-stone-400 uppercase hidden sm:block">Textbook Standard</span>
                    </div>

                    {/* HBS Apple Case narrative */}
                    <div>
                      <h4 className="font-mono text-[10px] text-stone-500 uppercase tracking-wider mb-1.5 font-bold">Harvard Case Study Application</h4>
                      <p className="text-stone-700 bg-white border border-stone-200 p-4 leading-relaxed">
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

                    {/* Selected Portfolio comparative stats */}
                    <div>
                      <h4 className="font-mono text-[10px] text-stone-500 uppercase tracking-wider mb-1.5 font-bold">
                        Portfolio Holding Real Case Study ({bsCaseData.companyName})
                      </h4>
                      
                      <div className="italic font-serif leading-relaxed text-stone-800 bg-[#FCFAF6] border-l-4 border-stone-800 p-5 shadow-sm relative">
                        <span className="absolute top-1 left-2 font-serif text-5xl text-stone-200 leading-none pointer-events-none select-none">“</span>
                        <p className="relative z-10 pl-4">{bsCaseData.caseStudyNarrative}</p>
                      </div>
                    </div>

                    {/* Why investors care */}
                    <div className="border-t border-stone-200 pt-3 mt-1">
                      <h4 className="font-mono text-[10px] text-stone-500 uppercase tracking-wider mb-1 font-bold">Why Investors Care</h4>
                      <p className="text-stone-600 text-xs leading-normal">
                        {bsConcept === 'operating_leverage' 
                          ? 'Operating leverage acts as a margin amplifier during sales growth, but exposes the capital structure to sharp profit contractions during market downturns.' 
                          : bsConcept === 'economic_moats' 
                            ? 'Moats insulate businesses against structural mean-reversion of returns. Wide moats prevent high return-on-equity numbers from being competed away by industry peers.' 
                            : bsConcept === 'free_cash_flow_margin' 
                              ? ' FCFF is the hard currency value underpinning all modern DCF equity evaluation models. It is the primary metric of corporate wealth generation.' 
                              : 'Leverage is the primary catalyst for business bankruptcy. Monitoring solvency buffers protects capital against permanent losses during macroeconomic stress regimes.'
                        }
                      </p>
                    </div>

                  </div>
                ) : (
                  <div className="py-20 text-center font-serif italic text-stone-400">
                    Select a concept or security ticker above to trigger calculation.
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default IntelligenceHub;
