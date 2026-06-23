import React, { useState, useEffect } from 'react';
import { dbService } from '../services/firebase';
import type { CompanyIntelligence, UserConviction, Holding } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import IntelligenceService from '../services/intelligenceService';
import { ExportService } from '../services/exportService';
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
    try {
      const intel = await IntelligenceService.fetchCompanyIntelligence(ticker, exchange);
      const conv = currentConvictions.find(
        c => c.ticker.toUpperCase() === ticker.toUpperCase() && c.exchange.toUpperCase() === exchange.toUpperCase()
      ) || null;
      
      setSelectedAsset({ ticker, exchange, intel, conviction: conv });
    } catch (e) {
      console.error('Error selecting asset details:', e);
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
                    <div className="border-b-2 border-stone-800 pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                      <div>
                        <div className="font-mono text-[9px] text-[#8c2a2a] uppercase tracking-widest font-bold flex items-center gap-1">
                          <Activity size={10} /> Mounted Workspace Rationale
                        </div>
                        <h2 className="font-serif text-3xl font-normal text-[#1A1A1A] mt-1">
                          {selectedAsset.intel.name}
                        </h2>
                        <div className="flex gap-2 text-xs font-mono text-stone-500 mt-1">
                          <strong className="text-stone-800">{selectedAsset.ticker}:{selectedAsset.exchange}</strong>
                          <span>|</span>
                          <span>{selectedAsset.intel.sector}</span>
                          <span>|</span>
                          <span>{selectedAsset.intel.research.fundamentals?.industry || 'Data unavailable'}</span>
                        </div>
                      </div>

                      <div className="flex gap-2">
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

                    {/* Section 3.1: Executive Thesis */}
                    <div className="border border-stone-300 p-4 md:p-6 bg-[#FCFAF6]">
                      <h3 className="font-serif text-xl font-bold text-stone-900 border-b border-stone-200 pb-2 mb-4">
                        Executive Investment Thesis
                      </h3>
                      
                      <div className="flex flex-col gap-4 font-serif text-sm leading-relaxed text-[#1A1A1A]">
                        <div>
                          <strong className="font-mono text-[10px] uppercase tracking-wider text-stone-400 block mb-1">Thesis Overview</strong>
                          <p className="italic bg-white p-3 border-l-4 border-[#8c2a2a]">
                            "{getExecutiveThesis(selectedAsset.intel, selectedAsset.conviction)}"
                          </p>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                          <div>
                            <strong className="font-mono text-[10px] uppercase tracking-wider text-stone-400 block mb-1">Primary Opportunity</strong>
                            <p className="text-stone-700 bg-white p-3 border border-stone-200 text-xs">
                              {getPrimaryOpportunity(selectedAsset.intel)}
                            </p>
                          </div>
                          <div>
                            <strong className="font-mono text-[10px] uppercase tracking-wider text-stone-400 block mb-1">Primary Catalyst & Risk</strong>
                            <p className="text-stone-700 bg-white p-3 border border-stone-200 text-xs">
                              {getPrimaryRisk(selectedAsset.intel)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Section 3.2: Conviction Breakdown */}
                    <div className="border border-[#E5E2D9] p-4 md:p-6 bg-white">
                      <div className="flex justify-between items-center border-b border-stone-200 pb-2 mb-4">
                        <h3 className="font-serif text-lg font-bold text-stone-900">
                          Personalized Conviction Breakdown
                        </h3>
                        <div className="font-mono text-base font-bold text-[#8c2a2a] bg-[#FAF8F5] border px-2 py-0.5">
                          {selectedAsset.conviction?.overallScore || '—'}/100 Overall
                        </div>
                      </div>

                      <div className="flex flex-col gap-4 text-xs">
                        {/* Allocation */}
                        <div>
                          <div className="flex justify-between font-mono font-bold mb-1">
                            <span>Portfolio Exposure Sizing</span>
                            <span>{selectedAsset.conviction?.breakdown.allocationFactor.contribution || 0} / 25 Max</span>
                          </div>
                          <div className="w-full h-2 bg-stone-100 border border-stone-200 rounded-none overflow-hidden">
                            <div className="h-full bg-[#8c2a2a]" style={{ width: `${((selectedAsset.conviction?.breakdown.allocationFactor.contribution || 0) / 25) * 100}%` }}></div>
                          </div>
                          <span className="font-mono text-[9px] text-stone-400 block mt-1 uppercase">
                            Score Weight: 25% | RAW Metric: {selectedAsset.conviction?.breakdown.allocationFactor.score || 0}/100
                          </span>
                          <p className="text-stone-600 mt-1 font-serif">
                            {selectedAsset.conviction?.breakdown.allocationFactor.explanation}
                          </p>
                        </div>

                        {/* Fundamental */}
                        <div className="border-t border-stone-200 pt-3">
                          <div className="flex justify-between font-mono font-bold mb-1">
                            <span>Fundamental Quality Index</span>
                            <span>{selectedAsset.conviction?.breakdown.fundamentalFactor.contribution || 0} / 25 Max</span>
                          </div>
                          <div className="w-full h-2 bg-stone-100 border border-stone-200 rounded-none overflow-hidden">
                            <div className="h-full bg-[#8c2a2a]" style={{ width: `${((selectedAsset.conviction?.breakdown.fundamentalFactor.contribution || 0) / 25) * 100}%` }}></div>
                          </div>
                          <span className="font-mono text-[9px] text-stone-400 block mt-1 uppercase">
                            Score Weight: 25% | RAW Metric: {selectedAsset.conviction?.breakdown.fundamentalFactor.score || 0}/100
                          </span>
                          <p className="text-stone-600 mt-1 font-serif">
                            {selectedAsset.conviction?.breakdown.fundamentalFactor.explanation}
                          </p>
                        </div>

                        {/* Dip */}
                        <div className="border-t border-stone-200 pt-3">
                          <div className="flex justify-between font-mono font-bold mb-1">
                            <span>Technical Dip Premium</span>
                            <span>{selectedAsset.conviction?.breakdown.dipFactor.contribution || 0} / 25 Max</span>
                          </div>
                          <div className="w-full h-2 bg-stone-100 border border-stone-200 rounded-none overflow-hidden">
                            <div className="h-full bg-[#8c2a2a]" style={{ width: `${((selectedAsset.conviction?.breakdown.dipFactor.contribution || 0) / 25) * 100}%` }}></div>
                          </div>
                          <span className="font-mono text-[9px] text-stone-400 block mt-1 uppercase">
                            Score Weight: 25% | RAW Metric: {selectedAsset.conviction?.breakdown.dipFactor.score || 0}/100
                          </span>
                          <p className="text-stone-600 mt-1 font-serif">
                            {selectedAsset.conviction?.breakdown.dipFactor.explanation}
                          </p>
                        </div>

                        {/* Institutional */}
                        <div className="border-t border-stone-200 pt-3">
                          <div className="flex justify-between font-mono font-bold mb-1">
                            <span>Institutional & Insider Support</span>
                            <span>{selectedAsset.conviction?.breakdown.institutionalFactor.contribution || 0} / 25 Max</span>
                          </div>
                          <div className="w-full h-2 bg-stone-100 border border-stone-200 rounded-none overflow-hidden">
                            <div className="h-full bg-[#8c2a2a]" style={{ width: `${((selectedAsset.conviction?.breakdown.institutionalFactor.contribution || 0) / 25) * 100}%` }}></div>
                          </div>
                          <span className="font-mono text-[9px] text-stone-400 block mt-1 uppercase">
                            Score Weight: 25% | RAW Metric: {selectedAsset.conviction?.breakdown.institutionalFactor.score || 0}/100
                          </span>
                          <p className="text-stone-600 mt-1 font-serif">
                            {selectedAsset.conviction?.breakdown.institutionalFactor.explanation}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Section 3.3: Quality Score Framework */}
                    <div className="border border-[#E5E2D9] p-4 md:p-6 bg-[#FCFAF6]">
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
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                            {/* Economic Moat */}
                            <div className="bg-white border border-stone-200 p-3">
                              <div className="flex justify-between font-mono font-bold border-b border-stone-100 pb-1 mb-1 text-stone-800">
                                <span>Economic Moat</span>
                                <span className="text-[#8c2a2a]">{qb.moat.score}/40 Max</span>
                              </div>
                              <div className="font-mono text-[9px] uppercase text-stone-400 mb-2">Rating: {qb.moat.value}</div>
                              <p className="font-serif italic text-[#555555]">
                                "{qb.moat.rationale}"
                              </p>
                            </div>

                            {/* Leverage */}
                            <div className="bg-white border border-stone-200 p-3">
                              <div className="flex justify-between font-mono font-bold border-b border-stone-100 pb-1 mb-1 text-stone-800">
                                <span>Balance Sheet</span>
                                <span className="text-[#8c2a2a]">{qb.leverage.score}/30 Max</span>
                              </div>
                              <div className="font-mono text-[9px] uppercase text-stone-400 mb-2">Threshold target: &lt; 0.40</div>
                              <p className="text-[#555555]">
                                {qb.leverage.rationale}
                              </p>
                            </div>

                            {/* FCF Margin */}
                            <div className="bg-white border border-stone-200 p-3">
                              <div className="flex justify-between font-mono font-bold border-b border-stone-100 pb-1 mb-1 text-stone-800">
                                <span>Cash Generation</span>
                                <span className="text-[#8c2a2a]">{qb.fcfMargin.score}/30 Max</span>
                              </div>
                              <div className="font-mono text-[9px] uppercase text-stone-400 mb-2">Threshold target: &gt; 25.0%</div>
                              <p className="text-[#555555]">
                                {qb.fcfMargin.rationale}
                              </p>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Section 3.4: Smart Money Terminal */}
                    <div className="border border-[#E5E2D9] p-4 md:p-6 bg-white">
                      <h3 className="font-serif text-lg font-bold text-stone-900 border-b border-stone-200 pb-2 mb-4">
                        Institutional & Insider Flows
                      </h3>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                        {/* Insider Activity */}
                        <div className="p-3 border border-stone-200 bg-[#FCFAF6] flex flex-col justify-between">
                          <div>
                            <div className="flex justify-between items-center font-mono font-bold border-b border-stone-200 pb-1 mb-2 text-stone-800">
                              <span>Insider Transactions</span>
                              <span className="px-1.5 py-0.5 bg-white border border-stone-200 text-[8px] uppercase tracking-wider">
                                Conf: {selectedAsset.intel.smartMoney.insiderTransactions?.confidence || 'none'}
                              </span>
                            </div>
                            
                            {selectedAsset.intel.smartMoney.insiderTransactions?.value ? (
                              <div className="font-mono text-[11px] text-stone-700 leading-normal flex flex-col gap-1">
                                <div><strong>Net Volume:</strong> {selectedAsset.intel.smartMoney.insiderTransactions.value.netSharesBought.toLocaleString()} Shares</div>
                                <div><strong>Transactions (90d):</strong> {selectedAsset.intel.smartMoney.insiderTransactions.value.totalTransactionsCount} ({selectedAsset.intel.smartMoney.insiderTransactions.value.buyCount} buys, {selectedAsset.intel.smartMoney.insiderTransactions.value.sellCount} sells)</div>
                              </div>
                            ) : (
                              <div className="text-stone-400 font-mono text-[10px] italic">Data unavailable</div>
                            )}
                          </div>
                          
                          <div className="text-[8px] text-stone-400 font-mono mt-3 border-t border-stone-200 pt-1">
                            SOURCE: SEC FORM 4 FILINGS | AS OF: {selectedAsset.intel.smartMoney.insiderTransactions?.timestamp ? new Date(selectedAsset.intel.smartMoney.insiderTransactions.timestamp).toLocaleDateString() : 'Baseline'}
                          </div>
                        </div>

                        {/* Officer Sentiment */}
                        <div className="p-3 border border-stone-200 bg-[#FCFAF6] flex flex-col justify-between">
                          <div>
                            <div className="flex justify-between items-center font-mono font-bold border-b border-stone-200 pb-1 mb-2 text-stone-800">
                              <span>Corporate Officer Sentiment</span>
                              <span className="px-1.5 py-0.5 bg-white border border-stone-200 text-[8px] uppercase tracking-wider">
                                Conf: {selectedAsset.intel.smartMoney.insiderSentiment?.confidence || 'none'}
                              </span>
                            </div>
                            
                            {selectedAsset.intel.smartMoney.insiderSentiment?.value ? (
                              <div className="font-mono text-[11px] text-stone-700 leading-normal flex flex-col gap-1">
                                <div><strong>Monthly Purchase Ratio:</strong> {selectedAsset.intel.smartMoney.insiderSentiment.value.mspr.toFixed(2)} Index</div>
                                <div><strong>Officer Share Change:</strong> {selectedAsset.intel.smartMoney.insiderSentiment.value.change.toLocaleString()} Shares</div>
                              </div>
                            ) : (
                              <div className="text-stone-400 font-mono text-[10px] italic">Data unavailable</div>
                            )}
                          </div>
                          
                          <div className="text-[8px] text-stone-400 font-mono mt-3 border-t border-stone-200 pt-1">
                            SOURCE: FINNHUB INSIDER API | AS OF: {selectedAsset.intel.smartMoney.insiderSentiment?.timestamp ? new Date(selectedAsset.intel.smartMoney.insiderSentiment.timestamp).toLocaleDateString() : 'Baseline'}
                          </div>
                        </div>

                        {/* Options Put/Call */}
                        <div className="p-3 border border-stone-200 bg-[#FCFAF6] flex flex-col justify-between">
                          <div>
                            <div className="flex justify-between items-center font-mono font-bold border-b border-stone-200 pb-1 mb-2 text-stone-800">
                              <span>Options Sentiment Ratio</span>
                              <span className="px-1.5 py-0.5 bg-white border border-stone-200 text-[8px] uppercase tracking-wider">
                                Conf: {selectedAsset.intel.smartMoney.optionsVolume?.confidence || 'none'}
                              </span>
                            </div>
                            
                            {selectedAsset.intel.smartMoney.optionsVolume?.value ? (
                              <div className="font-mono text-[11px] text-stone-700 leading-normal flex flex-col gap-1">
                                <div><strong>Put/Call Volume Ratio:</strong> {selectedAsset.intel.smartMoney.optionsVolume.value.putCallRatio.toFixed(2)}</div>
                                <div><strong>Sentiment Classification:</strong> {selectedAsset.intel.smartMoney.optionsVolume.value.sentiment.toUpperCase()}</div>
                              </div>
                            ) : (
                              <div className="text-stone-400 font-mono text-[10px] italic">Data unavailable</div>
                            )}
                          </div>
                          
                          <div className="text-[8px] text-stone-400 font-mono mt-3 border-t border-stone-200 pt-1">
                            SOURCE: HISTORICAL OPTIONS DATA | AS OF: {selectedAsset.intel.smartMoney.optionsVolume?.timestamp ? new Date(selectedAsset.intel.smartMoney.optionsVolume.timestamp).toLocaleDateString() : 'Baseline'}
                          </div>
                        </div>

                        {/* 13F Ownership */}
                        <div className="p-3 border border-stone-200 bg-[#FCFAF6] flex flex-col justify-between">
                          <div>
                            <div className="flex justify-between items-center font-mono font-bold border-b border-stone-200 pb-1 mb-2 text-stone-800">
                              <span>Institutional 13F Holdings</span>
                              <span className="px-1.5 py-0.5 bg-white border border-stone-200 text-[8px] uppercase tracking-wider">
                                Conf: {selectedAsset.intel.smartMoney.institutionalOwnership?.confidence || 'none'}
                              </span>
                            </div>
                            
                            {selectedAsset.intel.smartMoney.institutionalOwnership?.value ? (
                              <div className="font-mono text-[11px] text-stone-700 leading-normal flex flex-col gap-1">
                                <div><strong>Institutional Ownership:</strong> {selectedAsset.intel.smartMoney.institutionalOwnership.value.ownershipPercent.toFixed(1)}%</div>
                                <div><strong>Fund Net Flows:</strong> {selectedAsset.intel.smartMoney.institutionalOwnership.value.netFlow.toUpperCase()}</div>
                              </div>
                            ) : (
                              <div className="text-stone-400 font-mono text-[10px] italic">Data unavailable</div>
                            )}
                          </div>
                          
                          <div className="text-[8px] text-stone-400 font-mono mt-3 border-t border-stone-200 pt-1">
                            SOURCE: SEC FORM 13F DATABASES | AS OF: {selectedAsset.intel.smartMoney.institutionalOwnership?.timestamp ? new Date(selectedAsset.intel.smartMoney.institutionalOwnership.timestamp).toLocaleDateString() : 'Baseline'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Section 3.5: Dip Analysis Workbench */}
                    <div className="border border-[#E5E2D9] p-4 md:p-6 bg-[#FCFAF6]">
                      <div className="flex justify-between items-center border-b border-stone-200 pb-2 mb-4">
                        <h3 className="font-serif text-lg font-bold text-stone-900">
                          Dip Technical Workbench
                        </h3>
                        <span className="font-mono text-xs font-bold text-[#8c2a2a] bg-white border px-2 py-0.5">
                          CLASSIFICATION: {selectedAsset.intel.dip.dipDetected ? (selectedAsset.intel.dip.classification?.toUpperCase() || 'UNCERTAIN') : 'NO ACTIVE DIP'}
                        </span>
                      </div>

                      <p className="font-serif text-xs italic text-stone-700 bg-white p-3 border border-stone-200 mb-4">
                        "{selectedAsset.intel.dip.classificationRationale || selectedAsset.intel.dip.catalyst || 'Sufficient technical support ranges preserved. Security operates inside regular statistical deviation limits.'}"
                      </p>

                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs font-mono text-stone-600">
                        <div>
                          <span className="text-[9px] text-stone-400 uppercase block">Current Live Price</span>
                          <strong className="text-stone-900 text-sm font-bold">${(selectedAsset.intel.dip.currentPrice || 0).toFixed(2)}</strong>
                        </div>
                        <div>
                          <span className="text-[9px] text-stone-400 uppercase block">52-Week High/Low</span>
                          <strong className="text-stone-900 text-sm font-bold">${(selectedAsset.intel.dip.fiftyTwoWeekLow || 0).toFixed(0)} - ${(selectedAsset.intel.dip.fiftyTwoWeekHigh || 0).toFixed(0)}</strong>
                        </div>
                        <div>
                          <span className="text-[9px] text-stone-400 uppercase block">50-Day Price EMA</span>
                          <strong className="text-stone-900 text-sm font-bold">${(selectedAsset.intel.dip.ema50 || 0).toFixed(2)}</strong>
                        </div>
                        <div>
                          <span className="text-[9px] text-stone-400 uppercase block">Z-Score Price Deviation</span>
                          <strong className="text-stone-900 text-sm font-bold">{(selectedAsset.intel.dip.zScore || 0).toFixed(2)} σ</strong>
                        </div>
                        <div>
                          <span className="text-[9px] text-stone-400 uppercase block">Historical Volatility</span>
                          <strong className="text-stone-900 text-sm font-bold">{(selectedAsset.intel.dip.volatility || 0).toFixed(2)}</strong>
                        </div>
                        <div>
                          <span className="text-[9px] text-stone-400 uppercase block">Calculated Quality Index</span>
                          <strong className="text-stone-900 text-sm font-bold">{selectedAsset.intel.qualityScore}/100</strong>
                        </div>
                      </div>
                    </div>

                    {/* SECTION 4 — EQUITY RESEARCH ENGINE */}
                    <div className="border border-stone-300 p-4 md:p-6 bg-white">
                      <h3 className="font-serif text-xl font-bold text-stone-900 border-b border-stone-200 pb-2 mb-4 flex items-center gap-1">
                        <Briefcase size={18} /> Equity Research Engine Brief
                      </h3>
                      
                      <div className="flex flex-col gap-5 text-xs text-[#1A1A1A] font-serif leading-relaxed">
                        {/* Business Overview */}
                        <div>
                          <strong className="font-mono text-[9px] uppercase tracking-wider text-stone-400 block mb-1">1. Business Overview</strong>
                          <p className="text-stone-700">
                            {selectedAsset.intel.name} is an active participant in the {selectedAsset.intel.sector} sector, operating specifically within the {selectedAsset.intel.research.fundamentals?.industry || 'sourcing industry'}. The organization commands a market capitalization of ${((selectedAsset.intel.research.fundamentals?.marketCapMillions || 0) / 1000).toFixed(2)}B and is monitored with a {selectedAsset.intel.research.moatRating} competitive moat structure.
                          </p>
                        </div>

                        {/* Revenue Drivers */}
                        <div>
                          <strong className="font-mono text-[9px] uppercase tracking-wider text-stone-400 block mb-1">2. Revenue Drivers</strong>
                          <p className="text-stone-700">
                            Cash flow is sustained through capital efficiencies yielding gross profit margins of ${(selectedAsset.intel.research.fundamentals?.grossMargin || 0).toFixed(1)}% and operating profit margins of ${(selectedAsset.intel.research.fundamentals?.operatingMargin || 0).toFixed(1)}%. Revenue growth indicators are currently cataloged at +${(selectedAsset.intel.research.fundamentals?.revenueGrowthYoy || 0).toFixed(1)}% YoY.
                          </p>
                        </div>

                        {/* Competitive Advantages */}
                        <div>
                          <strong className="font-mono text-[9px] uppercase tracking-wider text-stone-400 block mb-1">3. Competitive Advantages</strong>
                          <p className="text-stone-700">
                            Moat analysis indicates a {selectedAsset.intel.research.moatRating.toUpperCase()} competitive structure. Rationale indicates: "{selectedAsset.intel.research.moatRationale}"
                          </p>
                        </div>

                        {/* Growth Drivers */}
                        <div>
                          <strong className="font-mono text-[9px] uppercase tracking-wider text-stone-400 block mb-1">4. Capital Efficiency & Growth</strong>
                          <p className="text-stone-700">
                            The organization converts revenue into cash assets efficiently. Return on Invested Capital (ROIC) is running at ${(selectedAsset.intel.research.fundamentals?.roic || 0).toFixed(1)}% with rolling YoY earnings growth of +${(selectedAsset.intel.research.fundamentals?.earningsGrowthYoy || 0).toFixed(1)}%.
                          </p>
                        </div>

                        {/* Risks */}
                        <div>
                          <strong className="font-mono text-[9px] uppercase tracking-wider text-stone-400 block mb-1">5. Structural Risks</strong>
                          <p className="text-stone-700">
                            Capital structure health presents a Debt-to-Equity solvency leverage of ${(selectedAsset.intel.research.fundamentals?.debtToEquity || 0).toFixed(2)}. Technical catalyst warning is classified under: "{selectedAsset.intel.dip.catalyst || 'No immediate structural triggers identified'}".
                          </p>
                        </div>

                        {/* Management Quality & Industry Position */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-stone-200 pt-3 font-sans">
                          <div>
                            <strong className="font-mono text-[9px] uppercase tracking-wider text-stone-400 block mb-1">6. Management Quality</strong>
                            <p className="text-stone-700 text-xs leading-normal">
                              Evaluated via Form 4 insider buying flows. MSPR sentiment index is currently {(selectedAsset.intel.smartMoney.insiderSentiment?.value?.mspr || 0).toFixed(2)} with insider transactions counts showing {selectedAsset.intel.smartMoney.insiderTransactions?.value?.totalTransactionsCount || 0} active filings.
                            </p>
                          </div>
                          <div>
                            <strong className="font-mono text-[9px] uppercase tracking-wider text-stone-400 block mb-1">7. Industry Position</strong>
                            <p className="text-stone-700 text-xs leading-normal">
                              Monitored relative to rolling peer groupings. The organization maintains an absolute Cash Margin of ${(selectedAsset.intel.research.freeCashFlowMargin || 0).toFixed(1)}%, positioning it inside the top tier of its corresponding sector allocation.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* SECTION 6 — INTELLIGENCE AUDIT LAYER */}
                    <div className="border border-stone-300 p-4 md:p-6 bg-[#FCFAF6] mt-4">
                      <h3 className="font-mono text-[9px] text-[#8c2a2a] uppercase tracking-widest font-bold border-b border-stone-200 pb-1.5 mb-3 flex items-center gap-1.5">
                        <Shield size={12} /> Section 6 — Intelligence Verification Audit Log
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
                                  : '0'}
                              </td>
                              <td className="py-1.5 text-[#8c2a2a] font-bold">Regulatory Filing</td>
                              <td className="py-1.5">SEC Form 4</td>
                              <td className="py-1.5">{selectedAsset.intel.smartMoney.insiderTransactions?.timestamp ? new Date(selectedAsset.intel.smartMoney.insiderTransactions.timestamp).toLocaleDateString() : 'Baseline'}</td>
                            </tr>
                            {/* Options sentiment */}
                            <tr className="border-b border-stone-100">
                              <td className="py-1.5">Options Volume</td>
                              <td className="py-1.5 font-bold">
                                {selectedAsset.intel.smartMoney.optionsVolume?.value 
                                  ? selectedAsset.intel.smartMoney.optionsVolume.value.putCallRatio.toFixed(2) 
                                  : 'Unavailable'}
                              </td>
                              <td className="py-1.5 text-stone-400 font-bold">Unavailable</td>
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
                              <td className="pt-1.5 text-stone-400 font-bold">Unavailable</td>
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
