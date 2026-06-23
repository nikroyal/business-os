import React, { useState, useEffect } from 'react';
import { dbService } from '../services/firebase';
import type { CompanyIntelligence, UserConviction, Holding } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import IntelligenceService from '../services/intelligenceService';
import { ExportService } from '../services/exportService';
import {
  Brain,
  TrendingUp,
  BookOpen,
  Award,
  Shield,
  Layers,
  Search,
  FileText,
  ChevronRight,
  RefreshCw,
  Target,
  Download
} from 'lucide-react';

export const IntelligenceHub: React.FC = () => {
  const { user, profile } = useAuth();
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [convictions, setConvictions] = useState<UserConviction[]>([]);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState<string | null>(null);
  
  // Interactive filters
  const [listFilter, setListFilter] = useState<'all' | 'high' | 'medium' | 'review'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Selected asset details for component-level score breakdown panel
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

  // Synchronize selectedAsset's conviction when convictions list updates (background calculation finishes)
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

  // Dynamic sentence summary generator answering "Why care about this company?"
  const getExecutiveInvestmentNarrative = (intel: CompanyIntelligence, conviction: UserConviction | null) => {
    if (!conviction) return `${intel.name} is currently under review by quantitative intelligence algorithms.`;
    const score = conviction.overallScore;
    const moat = intel.research.moatRating.toUpperCase();
    const dip = intel.dip.dipDetected 
      ? `trading at a classified ${(intel.dip.classification || 'healthy').toLowerCase()} pullback (${(intel.dip.zScore || 0).toFixed(1)}σ deviation)` 
      : 'trading inside stable price boundary limits';
    
    let classification = "Standard Holding";
    if (score >= 75) classification = "Core High-Conviction Compounder";
    else if (score >= 50) classification = "Tactical Allocation Candidate";
    else classification = "Surveillance-Tier Position";

    return `${intel.name} is a wide-moat structural franchise (${moat} rating) currently ${dip}. Combining fundamental factors with smart money flows yields an overall conviction index of ${score}/100, positioning this asset as a ${classification} in your portfolio strategy.`;
  };

  // Filter assets based on search query and Tier toggle
  const activeMonitoredAssets = holdings.filter(h => h.ticker !== 'CASH');
  
  const filteredAssets = activeMonitoredAssets.filter(h => {
    const tickerStr = h.ticker.toUpperCase();
    const nameStr = h.name.toLowerCase();
    const search = searchTerm.toLowerCase();
    
    const matchesSearch = tickerStr.includes(search.toUpperCase()) || nameStr.includes(search);
    if (!matchesSearch) return false;

    const scoreRecord = convictions.find(
      c => c.ticker.toUpperCase() === h.ticker.toUpperCase() && c.exchange.toUpperCase() === h.exchange.toUpperCase()
    );
    
    if (listFilter === 'high') {
      return scoreRecord && scoreRecord.overallScore >= 75;
    }
    if (listFilter === 'medium') {
      return scoreRecord && scoreRecord.overallScore >= 50 && scoreRecord.overallScore < 75;
    }
    if (listFilter === 'review') {
      return !scoreRecord || scoreRecord.overallScore < 50;
    }
    return true;
  });

  // Aggregate stats
  const totalScoredCount = activeMonitoredAssets.length;
  const highConvictionCount = convictions.filter(c => c.overallScore >= 75).length;
  const activeDipsCount = activeMonitoredAssets.filter(h => {
    const match = convictions.find(c => c.ticker.toUpperCase() === h.ticker.toUpperCase());
    return match && match.breakdown.dipFactor.score > 10;
  }).length;
  
  const avgQualityScore = convictions.length > 0
    ? Math.round(convictions.reduce((acc, curr) => acc + (curr.breakdown.fundamentalFactor.score), 0) / convictions.length)
    : 0;

  return (
    <div className="min-h-screen bg-[#FDFCF7] text-[#1A1A1A] p-4 md:p-8 font-sans selection:bg-[#E5E2D9]">
      {/* Premium Editorial Header */}
      <header className="border-b border-[#E5E2D9] pb-6 mb-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="font-mono text-xs uppercase tracking-widest text-[#8c2a2a] mb-2 font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#8c2a2a] animate-pulse"></span>
              Institutional Grade Sovereign Research
            </div>
            <h1 className="font-serif text-4xl font-normal tracking-tight text-[#1A1A1A] mb-1">
              Investment Intelligence Hub
            </h1>
            <p className="text-sm text-stone-600 max-w-xl">
              Cross-asset scoring models evaluating moat durability, dip opportunities, insider sentiment, and portfolio risk boundaries.
            </p>
          </div>
          <div className="font-mono text-xs text-stone-500 text-left md:text-right border-l-2 md:border-l-0 md:border-r-2 border-[#8c2a2a] pl-3 md:pr-3">
            <div>ALGORITHMIC ENGINE: ACTIVE</div>
            <div>VERIFICATION CERTIFICATE: SECURED</div>
            <div>SYS DATE: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' })}</div>
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
          
          {/* Institutional Stats Summary Banner */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 bg-[#FAF8F5] border border-[#E5E2D9] p-4 shadow-sm">
            <div className="p-3 border-r border-[#E5E2D9] last:border-0">
              <div className="font-mono text-[10px] text-stone-500 uppercase">Monitored Assets</div>
              <div className="flex items-baseline gap-2">
                <span className="font-serif text-3xl font-bold">{totalScoredCount}</span>
                <span className="text-xs text-stone-400 font-mono">Securities</span>
              </div>
            </div>
            <div className="p-3 border-r border-[#E5E2D9] last:border-0">
              <div className="font-mono text-[10px] text-stone-500 uppercase">High Conviction</div>
              <div className="flex items-baseline gap-2">
                <span className="font-serif text-3xl font-bold text-green-700">{highConvictionCount}</span>
                <span className="text-xs text-stone-400 font-mono">Ranked 75+</span>
              </div>
            </div>
            <div className="p-3 border-r border-[#E5E2D9] last:border-0">
              <div className="font-mono text-[10px] text-stone-500 uppercase">Average Quality</div>
              <div className="flex items-baseline gap-2">
                <span className="font-serif text-3xl font-bold">{avgQualityScore}</span>
                <span className="text-xs text-stone-400 font-mono">/100 Index</span>
              </div>
            </div>
            <div className="p-3 last:border-0">
              <div className="font-mono text-[10px] text-stone-500 uppercase">Active Dip Triggers</div>
              <div className="flex items-baseline gap-2">
                <span className="font-serif text-3xl font-bold text-amber-700">{activeDipsCount}</span>
                <span className="text-xs text-stone-400 font-mono">Accumulate Signals</span>
              </div>
            </div>
          </div>

          {/* Main Content Grid Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Column: Rankings Table and Search Index */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              <section className="bg-white border border-[#E5E2D9] p-4 md:p-6 shadow-sm">
                
                {/* Directory Controls */}
                <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center border-b border-[#E5E2D9] pb-4 mb-4">
                  <div>
                    <h2 className="font-serif text-2xl font-normal text-[#1A1A1A]">
                      Conviction Rankings Directory
                    </h2>
                    <span className="font-mono text-[10px] text-stone-400 uppercase">Updated real-time // Dynamic tracking matrix</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    <div style={{ position: 'relative', flex: '1', minWidth: '160px' }}>
                      <Search size={14} className="text-stone-400" style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)' }} />
                      <input
                        type="text"
                        placeholder="Search code or company..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="font-mono text-xs pl-8 pr-3 py-1.5 bg-[#FAF8F5] border border-stone-300 w-full focus:outline-none focus:border-stone-800"
                        aria-label="Search directory"
                      />
                    </div>
                    
                    <button
                      onClick={() => setListFilter('all')}
                      className={`font-mono text-[10px] uppercase px-2.5 py-1.5 border transition-all ${
                        listFilter === 'all' ? 'bg-[#8c2a2a] text-white border-[#8c2a2a]' : 'bg-[#FAF8F5] text-stone-600 border-stone-300 hover:border-stone-500'
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setListFilter('high')}
                      className={`font-mono text-[10px] uppercase px-2.5 py-1.5 border transition-all ${
                        listFilter === 'high' ? 'bg-[#8c2a2a] text-white border-[#8c2a2a]' : 'bg-[#FAF8F5] text-stone-600 border-stone-300 hover:border-stone-500'
                      }`}
                    >
                      High
                    </button>
                    <button
                      onClick={() => setListFilter('medium')}
                      className={`font-mono text-[10px] uppercase px-2.5 py-1.5 border transition-all ${
                        listFilter === 'medium' ? 'bg-[#8c2a2a] text-white border-[#8c2a2a]' : 'bg-[#FAF8F5] text-stone-600 border-stone-300 hover:border-stone-500'
                      }`}
                    >
                      Medium
                    </button>
                    <button
                      onClick={() => setListFilter('review')}
                      className={`font-mono text-[10px] uppercase px-2.5 py-1.5 border transition-all ${
                        listFilter === 'review' ? 'bg-[#8c2a2a] text-white border-[#8c2a2a]' : 'bg-[#FAF8F5] text-stone-600 border-stone-300 hover:border-stone-500'
                      }`}
                    >
                      Review
                    </button>
                  </div>
                </div>
                
                {/* Table Viewport */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-stone-800 font-mono text-[10px] text-stone-500 uppercase tracking-wider">
                        <th className="py-3 px-2 font-semibold">Security / Asset</th>
                        <th className="py-3 px-2 font-semibold">Quality Score</th>
                        <th className="py-3 px-2 font-semibold">Technical dip</th>
                        <th className="py-3 px-2 font-semibold">smart Money</th>
                        <th className="py-3 px-2 text-right font-semibold">overall conviction</th>
                        <th className="py-3 px-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAssets.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center font-serif italic text-stone-400">
                            No assets match the active directory query filters.
                          </td>
                        </tr>
                      ) : (
                        filteredAssets.map(h => {
                          const scoreRecord = convictions.find(
                            c => c.ticker.toUpperCase() === h.ticker.toUpperCase() && c.exchange.toUpperCase() === h.exchange.toUpperCase()
                          );
                          const isSelected = selectedAsset?.ticker === h.ticker && selectedAsset?.exchange === h.exchange;
                          const hasDip = scoreRecord && scoreRecord.breakdown.dipFactor.score > 10;
                          
                          return (
                            <tr 
                              key={h.id} 
                              onClick={() => handleSelectAsset(h.ticker, h.exchange)}
                              style={{ borderLeft: isSelected ? '4px solid #8c2a2a' : '4px solid transparent' }}
                              className={`border-b border-[#FAF8F5] cursor-pointer hover:bg-[#FAF8F5] transition-colors ${
                                isSelected ? 'bg-[#F9F8F4]' : ''
                              }`}
                            >
                              <td className="py-4 px-2">
                                <div className="font-serif text-base font-medium text-stone-900">{h.name}</div>
                                <div className="font-mono text-xs text-stone-500 flex items-center gap-1.5">
                                  <span>{h.ticker}:{h.exchange}</span>
                                  <span className="px-1.5 py-0.5 bg-stone-100 border border-stone-200 uppercase text-[9px] font-bold text-stone-600">
                                    {h.assetClass}
                                  </span>
                                </div>
                              </td>
                              
                              <td className="py-4 px-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-sm font-semibold text-stone-800">
                                    {scoreRecord ? scoreRecord.breakdown.fundamentalFactor.score : '—'}
                                  </span>
                                  <div className="w-16 h-1.5 bg-stone-100 rounded-none overflow-hidden hidden sm:block border border-stone-200">
                                    <div 
                                      className="h-full bg-stone-600" 
                                      style={{ width: `${scoreRecord ? scoreRecord.breakdown.fundamentalFactor.score : 0}%` }}
                                    ></div>
                                  </div>
                                </div>
                              </td>

                              <td className="py-4 px-2">
                                {scoreRecord ? (
                                  hasDip ? (
                                    <span className="inline-flex items-center gap-1 font-mono text-[9px] font-bold px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 uppercase">
                                      <span className="w-1.5 h-1.5 rounded-full bg-green-600"></span>
                                      DIP CLASSIFIED
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 font-mono text-[9px] px-2 py-0.5 bg-stone-50 text-stone-500 border border-stone-200 uppercase">
                                      <span className="w-1.5 h-1.5 rounded-full bg-stone-300"></span>
                                      BASELINE
                                    </span>
                                  )
                                ) : (
                                  <span className="text-stone-300 font-mono text-xs">—</span>
                                )}
                              </td>

                              <td className="py-4 px-2">
                                {scoreRecord ? (
                                  scoreRecord.breakdown.institutionalFactor.score >= 18 ? (
                                    <span className="inline-flex items-center gap-1 font-mono text-[9px] font-bold text-[#8c2a2a] uppercase">
                                      <TrendingUp size={10} /> Accumulation
                                    </span>
                                  ) : (
                                    <span className="font-mono text-[10px] text-stone-500 capitalize">Neutral Flows</span>
                                  )
                                ) : (
                                  '—'
                                )}
                              </td>

                              <td className="py-4 px-2 text-right">
                                {scoreRecord ? (
                                  <span className={`font-serif font-bold text-lg ${
                                    scoreRecord.overallScore >= 75 ? 'text-green-700' : scoreRecord.overallScore >= 50 ? 'text-stone-800' : 'text-red-700'
                                  }`}>
                                    {scoreRecord.overallScore}
                                    <span className="text-[10px] text-stone-400 font-normal ml-0.5">/100</span>
                                  </span>
                                ) : (
                                  <span className="font-mono text-xs text-stone-400 italic">Calculating...</span>
                                )}
                              </td>
                              
                              <td className="py-4 px-2 text-right" onClick={e => e.stopPropagation()}>
                                <button
                                  onClick={() => handleRecalculate(h.ticker, h.exchange)}
                                  disabled={recalculating === `${h.ticker}:${h.exchange}`}
                                  className="font-mono text-[10px] uppercase border border-stone-300 hover:border-stone-800 disabled:opacity-50 px-2 py-1.5 bg-[#FDFCF7] hover:bg-stone-50 transition-colors flex items-center gap-1 ml-auto"
                                >
                                  <RefreshCw size={10} className={recalculating === `${h.ticker}:${h.exchange}` ? 'animate-spin' : ''} />
                                  <span>{recalculating === `${h.ticker}:${h.exchange}` ? 'recal' : 'refresh'}</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            {/* Right Column: Full Interactive Dashboard Sheet */}
            <div className="lg:col-span-1">
              <section className="bg-white border border-[#E5E2D9] p-4 md:p-6 shadow-sm sticky top-6">
                
                {!selectedAsset ? (
                  <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
                    <div className="p-4 bg-[#FAF8F5] border border-stone-200 rounded-none text-[#8c2a2a]">
                      <Brain size={32} />
                    </div>
                    <h3 className="font-serif text-lg font-normal italic">No Asset Selected</h3>
                    <p className="text-xs text-stone-500 max-w-xs leading-relaxed">
                      Select an active investment position from the directory list on the left to examine its personalized conviction breakdown.
                    </p>
                  </div>
                ) : !selectedAsset.intel ? (
                  <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
                    <RefreshCw size={24} className="animate-spin text-[#8c2a2a]" />
                    <h3 className="font-serif text-lg italic">Compiling Intelligence</h3>
                    <p className="text-xs text-stone-400">Loading fundamental and options data registry...</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-6">
                    
                    {/* Security Identification & Exports */}
                    <div className="border-b border-[#E5E2D9] pb-4">
                      <div className="flex justify-between items-start">
                        <span className="font-mono text-[9px] uppercase tracking-widest text-[#8c2a2a] font-bold">[ACTIVE SECURITIES REGISTER]</span>
                        
                        <div className="flex gap-1.5">
                          <button 
                            onClick={() => ExportService.exportIntelligenceReportToMarkdown(selectedAsset.intel!, selectedAsset.conviction)}
                            className="text-stone-500 hover:text-[#8c2a2a] border border-[#E5E2D9] px-2 py-1 font-mono text-[9px] uppercase bg-[#FDFCF7] hover:bg-stone-50 transition-colors flex items-center gap-1"
                            title="Export Markdown File"
                          >
                            <Download size={10} /> MD
                          </button>
                          <button 
                            onClick={() => ExportService.exportIntelligenceReportToPDF(selectedAsset.intel!, selectedAsset.conviction)}
                            className="text-stone-500 hover:text-[#8c2a2a] border border-[#E5E2D9] px-2 py-1 font-mono text-[9px] uppercase bg-[#FDFCF7] hover:bg-stone-50 transition-colors flex items-center gap-1"
                            title="Export PDF Document"
                          >
                            <FileText size={10} /> PDF
                          </button>
                        </div>
                      </div>

                      <h2 className="font-serif text-2xl font-normal text-[#1A1A1A] mt-2 mb-1">
                        {selectedAsset.intel.name}
                      </h2>
                      
                      <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-stone-500">
                        <span className="font-bold text-stone-800">{selectedAsset.ticker}:{selectedAsset.exchange}</span>
                        <span>•</span>
                        <span>{selectedAsset.intel.sector}</span>
                        <span>•</span>
                        <span>{selectedAsset.intel.research.fundamentals?.industry || 'General Industry'}</span>
                      </div>
                    </div>

                    {/* Executive Investment Brief: "Why Care?" */}
                    <div className="bg-[#FAF8F5] border-l-4 border-[#8c2a2a] p-4 text-xs font-serif leading-relaxed text-[#1A1A1A] italic">
                      {getExecutiveInvestmentNarrative(selectedAsset.intel, selectedAsset.conviction)}
                    </div>

                    {/* Overall Conviction Dial Section */}
                    <div>
                      <div className="font-mono text-[10px] text-stone-500 uppercase tracking-widest mb-2 border-b border-[#E5E2D9] pb-1 flex justify-between">
                        <span>Conviction Score Index</span>
                        <span>Risk Profile Target</span>
                      </div>

                      <div className="bg-[#FAF8F5] border border-[#E5E2D9] p-4 flex items-center justify-between">
                        <div>
                          <div className="font-serif text-2xl font-normal text-[#8c2a2a]">
                            {selectedAsset.conviction?.overallScore || '—'}
                            <span className="text-xs text-stone-400 font-mono font-normal">/100</span>
                          </div>
                          <div className="font-mono text-[9px] text-stone-500 uppercase mt-0.5 tracking-wider font-semibold">
                            {(() => {
                              const s = selectedAsset.conviction?.overallScore || 0;
                              if (s >= 75) return 'STRONG CONVICTION CORE';
                              if (s >= 50) return 'TACTICAL SIZING RECOMMENDED';
                              return 'UNDER STRUCTURAL REVIEW';
                            })()}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="font-mono text-xs font-bold text-stone-800 uppercase flex items-center justify-end gap-1">
                            <Target size={12} />
                            <span>{profile?.riskProfile || 'Balanced'}</span>
                          </div>
                          <span className="font-mono text-[9px] text-stone-400 block uppercase">Exposure Limit Adjusted</span>
                        </div>
                      </div>
                    </div>

                    {/* Conviction Score Component Breakdown */}
                    <div className="flex flex-col gap-4">
                      <h3 className="font-mono text-[10px] uppercase tracking-wider text-stone-500 border-b border-[#E5E2D9] pb-1">
                        PERSONALIZED CONVICTION METRICS
                      </h3>
                      
                      {/* Grid of factors */}
                      <div className="flex flex-col gap-3">
                        {/* Factor 1: Portfolio Allocation */}
                        <div className="border border-stone-200 bg-[#FCFAF6] p-3">
                          <div className="flex justify-between items-center font-mono text-xs font-bold mb-1">
                            <span className="text-stone-800">1. Portfolio Exposure Balance</span>
                            <span className="text-[#8c2a2a]">+{selectedAsset.conviction?.breakdown.allocationFactor.contribution || 0} pts</span>
                          </div>
                          <div className="w-full h-1 bg-stone-100 rounded-none overflow-hidden border border-stone-200 mb-2">
                            <div className="h-full bg-[#8c2a2a]" style={{ width: `${((selectedAsset.conviction?.breakdown.allocationFactor.contribution || 0) / 25) * 100}%` }}></div>
                          </div>
                          <p className="text-[11px] text-stone-600 leading-normal">
                            {selectedAsset.conviction?.breakdown.allocationFactor.explanation}
                          </p>
                        </div>

                        {/* Factor 2: Fundamental Quality */}
                        <div className="border border-stone-200 bg-[#FCFAF6] p-3">
                          <div className="flex justify-between items-center font-mono text-xs font-bold mb-1">
                            <span className="text-stone-800">2. Structural Business Quality</span>
                            <span className="text-[#8c2a2a]">+{selectedAsset.conviction?.breakdown.fundamentalFactor.contribution || 0} pts</span>
                          </div>
                          <div className="w-full h-1 bg-stone-100 rounded-none overflow-hidden border border-stone-200 mb-2">
                            <div className="h-full bg-[#8c2a2a]" style={{ width: `${((selectedAsset.conviction?.breakdown.fundamentalFactor.contribution || 0) / 25) * 100}%` }}></div>
                          </div>
                          <p className="text-[11px] text-stone-600 leading-normal">
                            {selectedAsset.conviction?.breakdown.fundamentalFactor.explanation}
                          </p>
                        </div>

                        {/* Factor 3: Dip Factor */}
                        <div className="border border-stone-200 bg-[#FCFAF6] p-3">
                          <div className="flex justify-between items-center font-mono text-xs font-bold mb-1">
                            <span className="text-stone-800">3. Technical Margin-of-Safety</span>
                            <span className="text-[#8c2a2a]">+{selectedAsset.conviction?.breakdown.dipFactor.contribution || 0} pts</span>
                          </div>
                          <div className="w-full h-1 bg-stone-100 rounded-none overflow-hidden border border-stone-200 mb-2">
                            <div className="h-full bg-[#8c2a2a]" style={{ width: `${((selectedAsset.conviction?.breakdown.dipFactor.contribution || 0) / 25) * 100}%` }}></div>
                          </div>
                          <p className="text-[11px] text-stone-600 leading-normal">
                            {selectedAsset.conviction?.breakdown.dipFactor.explanation}
                          </p>
                        </div>

                        {/* Factor 4: Institutional Factor */}
                        <div className="border border-stone-200 bg-[#FCFAF6] p-3">
                          <div className="flex justify-between items-center font-mono text-xs font-bold mb-1">
                            <span className="text-stone-800">4. Smart Money Support Flow</span>
                            <span className="text-[#8c2a2a]">+{selectedAsset.conviction?.breakdown.institutionalFactor.contribution || 0} pts</span>
                          </div>
                          <div className="w-full h-1 bg-stone-100 rounded-none overflow-hidden border border-stone-200 mb-2">
                            <div className="h-full bg-[#8c2a2a]" style={{ width: `${((selectedAsset.conviction?.breakdown.institutionalFactor.contribution || 0) / 25) * 100}%` }}></div>
                          </div>
                          <p className="text-[11px] text-stone-600 leading-normal">
                            {selectedAsset.conviction?.breakdown.institutionalFactor.explanation}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Standardized Quality Score Card */}
                    <div className="border border-[#E5E2D9] p-4 bg-[#FCFAF6]">
                      <h3 className="font-mono text-[10px] uppercase tracking-wider text-stone-500 border-b border-[#E5E2D9] pb-1.5 mb-3 flex justify-between items-center">
                        <span>Quality Score Framework</span>
                        <strong className="text-stone-800">{selectedAsset.intel.qualityScore}/100</strong>
                      </h3>
                      
                      {(() => {
                        const qb = selectedAsset.intel.qualityBreakdown || {
                          moat: { score: selectedAsset.intel.qualityScore >= 70 ? 40 : 25, max: 40, weight: 0.4, contribution: selectedAsset.intel.qualityScore >= 70 ? 40 : 25, value: selectedAsset.intel.research.moatRating.toUpperCase(), rationale: selectedAsset.intel.research.moatRationale },
                          leverage: { score: selectedAsset.intel.research.leverageRatio < 0.4 ? 30 : 20, max: 30, weight: 0.3, contribution: selectedAsset.intel.research.leverageRatio < 0.4 ? 30 : 20, value: selectedAsset.intel.research.leverageRatio, rationale: `Leverage ratio is ${selectedAsset.intel.research.leverageRatio.toFixed(2)}.` },
                          fcfMargin: { score: selectedAsset.intel.research.freeCashFlowMargin > 25 ? 30 : 20, max: 30, weight: 0.3, contribution: selectedAsset.intel.research.freeCashFlowMargin > 25 ? 30 : 20, value: selectedAsset.intel.research.freeCashFlowMargin, rationale: `FCF Margin is ${selectedAsset.intel.research.freeCashFlowMargin.toFixed(1)}%.` }
                        };
                        return (
                          <div className="flex flex-col gap-3.5 text-xs">
                            <div className="flex gap-2.5 items-start">
                              <Award size={16} className="text-[#8c2a2a] flex-shrink-0 mt-0.5" />
                              <div>
                                <div className="flex justify-between font-mono font-bold text-stone-800">
                                  <span>Economic Moat Rating</span>
                                  <span>{qb.moat.score} / {qb.moat.max}</span>
                                </div>
                                <p className="text-stone-600 font-sans text-xs italic mt-0.5">"{qb.moat.rationale}"</p>
                              </div>
                            </div>
                            
                            <div className="flex gap-2.5 items-start border-t border-stone-200 pt-3">
                              <Shield size={16} className="text-[#8c2a2a] flex-shrink-0 mt-0.5" />
                              <div>
                                <div className="flex justify-between font-mono font-bold text-stone-800">
                                  <span>Leverage & Debt Solvency</span>
                                  <span>{qb.leverage.score} / {qb.leverage.max}</span>
                                </div>
                                <p className="text-[#555555] font-sans text-xs mt-0.5">{qb.leverage.rationale} (Solvency target ratio &lt; 0.40)</p>
                              </div>
                            </div>
                            
                            <div className="flex gap-2.5 items-start border-t border-stone-200 pt-3">
                              <Layers size={16} className="text-[#8c2a2a] flex-shrink-0 mt-0.5" />
                              <div>
                                <div className="flex justify-between font-mono font-bold text-stone-800">
                                  <span>FCF Generation Strength</span>
                                  <span>{qb.fcfMargin.score} / {qb.fcfMargin.max}</span>
                                </div>
                                <p className="text-[#555555] font-sans text-xs mt-0.5">{qb.fcfMargin.rationale} (High-efficiency baseline &gt; 25.0%)</p>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Smart Money Dashboard */}
                    <div>
                      <h3 className="font-mono text-[10px] uppercase tracking-wider text-stone-500 border-b border-[#E5E2D9] pb-1 mb-3">
                        Institutional & Insider Flows
                      </h3>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Insider Buying */}
                        <div className="bg-[#FCFAF6] border border-stone-200 p-3 flex flex-col justify-between">
                          <div>
                            <div className="flex justify-between items-center font-mono text-[10px] font-bold mb-1">
                              <span>Insider Activity</span>
                              <span className={`w-2 h-2 rounded-full ${
                                selectedAsset.intel.smartMoney.insiderTransactions?.confidence === 'high' ? 'bg-green-600' : 'bg-stone-300'
                              }`} title={`Confidence: ${selectedAsset.intel.smartMoney.insiderTransactions?.confidence}`}></span>
                            </div>
                            {selectedAsset.intel.smartMoney.insiderTransactions?.value ? (
                              <div className="font-mono text-[11px] text-stone-700 leading-normal">
                                <strong>Net Shares:</strong> {selectedAsset.intel.smartMoney.insiderTransactions.value.netSharesBought.toLocaleString()}
                                <div className="text-[10px] text-stone-500 mt-0.5">Filings (90d): {selectedAsset.intel.smartMoney.insiderTransactions.value.totalTransactionsCount} ({selectedAsset.intel.smartMoney.insiderTransactions.value.buyCount} B, {selectedAsset.intel.smartMoney.insiderTransactions.value.sellCount} S)</div>
                              </div>
                            ) : (
                              <div className="text-stone-400 italic font-mono text-[10px]">Data unavailable</div>
                            )}
                          </div>
                          <div className="text-[8px] text-stone-400 font-mono mt-2 border-t border-stone-200 pt-1">
                            SOURCE: SEC FORM 4
                          </div>
                        </div>

                        {/* Insider Sentiment Ratio */}
                        <div className="bg-[#FCFAF6] border border-stone-200 p-3 flex flex-col justify-between">
                          <div>
                            <div className="flex justify-between items-center font-mono text-[10px] font-bold mb-1">
                              <span>Officer Sentiment</span>
                              <span className={`w-2 h-2 rounded-full ${
                                (selectedAsset.intel.smartMoney.insiderSentiment?.value?.mspr ?? 0) > 0.5 ? 'bg-green-600' : 'bg-stone-300'
                              }`}></span>
                            </div>
                            {selectedAsset.intel.smartMoney.insiderSentiment?.value ? (
                              <div className="font-mono text-[11px] text-stone-700 leading-normal">
                                <strong>MSPR Index:</strong> {selectedAsset.intel.smartMoney.insiderSentiment.value.mspr.toFixed(2)}
                                <div className="text-[10px] text-stone-500 mt-0.5">Officer Δ: {selectedAsset.intel.smartMoney.insiderSentiment.value.change.toLocaleString()}</div>
                              </div>
                            ) : (
                              <div className="text-stone-400 italic font-mono text-[10px]">Data unavailable</div>
                            )}
                          </div>
                          <div className="text-[8px] text-stone-400 font-mono mt-2 border-t border-stone-200 pt-1">
                            SOURCE: FINNHUB INSIDER API
                          </div>
                        </div>

                        {/* Options Put/Call Sentiment */}
                        <div className="bg-[#FCFAF6] border border-stone-200 p-3 flex flex-col justify-between">
                          <div>
                            <div className="flex justify-between items-center font-mono text-[10px] font-bold mb-1">
                              <span>Options Volume flow</span>
                              <span className={`w-2 h-2 rounded-full ${
                                selectedAsset.intel.smartMoney.optionsVolume?.value?.sentiment === 'bullish' ? 'bg-green-600' : 'bg-stone-300'
                              }`}></span>
                            </div>
                            {selectedAsset.intel.smartMoney.optionsVolume?.value ? (
                              <div className="font-mono text-[11px] text-stone-700 leading-normal">
                                <strong>Put/Call Ratio:</strong> {selectedAsset.intel.smartMoney.optionsVolume.value.putCallRatio.toFixed(2)}
                                <div className="text-[10px] text-stone-500 mt-0.5">Bias: {selectedAsset.intel.smartMoney.optionsVolume.value.sentiment.toUpperCase()}</div>
                              </div>
                            ) : (
                              <div className="text-stone-400 italic font-mono text-[10px]">Data unavailable</div>
                            )}
                          </div>
                          <div className="text-[8px] text-stone-400 font-mono mt-2 border-t border-stone-200 pt-1">
                            SOURCE: DERIVED VOL INDEX
                          </div>
                        </div>

                        {/* Institutional 13F Ownership */}
                        <div className="bg-[#FCFAF6] border border-stone-200 p-3 flex flex-col justify-between">
                          <div>
                            <div className="flex justify-between items-center font-mono text-[10px] font-bold mb-1">
                              <span>Institutional 13F</span>
                              <span className={`w-2 h-2 rounded-full ${
                                selectedAsset.intel.smartMoney.institutionalOwnership?.value?.netFlow === 'accumulation' ? 'bg-green-600' : 'bg-stone-300'
                              }`}></span>
                            </div>
                            {selectedAsset.intel.smartMoney.institutionalOwnership?.value ? (
                              <div className="font-mono text-[11px] text-stone-700 leading-normal">
                                <strong>Ownership:</strong> {selectedAsset.intel.smartMoney.institutionalOwnership.value.ownershipPercent.toFixed(1)}%
                                <div className="text-[10px] text-stone-500 mt-0.5">Flow: {selectedAsset.intel.smartMoney.institutionalOwnership.value.netFlow.toUpperCase()}</div>
                              </div>
                            ) : (
                              <div className="text-stone-400 italic font-mono text-[10px]">Data unavailable</div>
                            )}
                          </div>
                          <div className="text-[8px] text-stone-400 font-mono mt-2 border-t border-stone-200 pt-1">
                            SOURCE: SEC FORM 13F
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Live Fundamental Registry Table */}
                    <div>
                      <h3 className="font-mono text-[10px] uppercase tracking-wider text-stone-500 border-b border-[#E5E2D9] pb-1 mb-2">
                        Live Company Fundamentals Registry
                      </h3>
                      <div className="bg-[#FCFAF6] border border-[#E5E2D9] p-3 text-xs font-mono text-stone-700">
                        <div className="flex justify-between py-1 border-b border-stone-200">
                          <span>Market Cap</span>
                          <strong className="text-stone-900">
                            {selectedAsset.intel.research.fundamentals?.marketCapMillions 
                              ? `$${(selectedAsset.intel.research.fundamentals.marketCapMillions / 1000).toFixed(2)}B`
                              : 'Unavailable'}
                          </strong>
                        </div>
                        <div className="flex justify-between py-1 border-b border-stone-200">
                          <span>Debt to Equity Ratio</span>
                          <strong className="text-stone-900">
                            {selectedAsset.intel.research.fundamentals?.debtToEquity !== null && selectedAsset.intel.research.fundamentals?.debtToEquity !== undefined
                              ? selectedAsset.intel.research.fundamentals.debtToEquity.toFixed(2)
                              : 'Unavailable'}
                          </strong>
                        </div>
                        <div className="flex justify-between py-1 border-b border-stone-200">
                          <span>Free Cash Flow Margin</span>
                          <strong className="text-stone-900">
                            {selectedAsset.intel.research.freeCashFlowMargin !== null && selectedAsset.intel.research.freeCashFlowMargin !== undefined
                              ? `${selectedAsset.intel.research.freeCashFlowMargin.toFixed(1)}%`
                              : 'Unavailable'}
                          </strong>
                        </div>
                        <div className="flex justify-between py-1 border-b border-stone-200">
                          <span>YoY Revenue Growth</span>
                          <strong className="text-green-700">
                            {selectedAsset.intel.research.fundamentals?.revenueGrowthYoy !== null && selectedAsset.intel.research.fundamentals?.revenueGrowthYoy !== undefined
                              ? `+${(selectedAsset.intel.research.fundamentals.revenueGrowthYoy).toFixed(1)}%`
                              : 'Unavailable'}
                          </strong>
                        </div>
                        <div className="flex justify-between py-1 border-b border-stone-200">
                          <span>Return on Invested Capital</span>
                          <strong className="text-stone-900">
                            {selectedAsset.intel.research.fundamentals?.roic !== null && selectedAsset.intel.research.fundamentals?.roic !== undefined
                              ? `${(selectedAsset.intel.research.fundamentals.roic).toFixed(1)}%`
                              : 'Unavailable'}
                          </strong>
                        </div>
                        <div className="flex justify-between py-1">
                          <span>Gross / Operating Margin</span>
                          <strong className="text-stone-900">
                            {selectedAsset.intel.research.fundamentals?.grossMargin !== null && selectedAsset.intel.research.fundamentals?.grossMargin !== undefined
                              ? `${(selectedAsset.intel.research.fundamentals.grossMargin).toFixed(0)}% / ${(selectedAsset.intel.research.fundamentals?.operatingMargin || 0).toFixed(0)}%`
                              : 'Unavailable'}
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* Dip Technical Validator */}
                    <div className="border border-stone-200 bg-[#FCFAF6] p-3 text-xs">
                      <h4 className="font-mono text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-2 border-b border-stone-200 pb-1 flex justify-between">
                        <span>Technical Dip Validation Audit</span>
                        <span className={selectedAsset.intel.dip.dipDetected ? 'text-green-700' : 'text-stone-500'}>
                          {selectedAsset.intel.dip.dipDetected ? 'SIGNAL ACTIVE' : 'NO DEVIATION'}
                        </span>
                      </h4>

                      <p className="italic text-[#555555] mb-3">
                        "{selectedAsset.intel.dip.classificationRationale || selectedAsset.intel.dip.catalyst || 'No significant technical pullbacks identified.'}"
                      </p>

                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-[10px] text-stone-500 pt-2 border-t border-stone-200">
                        <div>Current Price:</div>
                        <div className="text-right text-stone-900 font-bold">${(selectedAsset.intel.dip.currentPrice || 0).toFixed(2)}</div>
                        
                        <div>52-Week Range:</div>
                        <div className="text-right text-stone-900 font-bold">${(selectedAsset.intel.dip.fiftyTwoWeekLow || 0).toFixed(0)} - ${(selectedAsset.intel.dip.fiftyTwoWeekHigh || 0).toFixed(0)}</div>
                        
                        <div>50-day EMA Price:</div>
                        <div className="text-right text-stone-900 font-bold">${(selectedAsset.intel.dip.ema50 || 0).toFixed(2)}</div>
                        
                        <div>Z-Score Price Deviation:</div>
                        <div className="text-right text-stone-900 font-bold">{(selectedAsset.intel.dip.zScore || 0).toFixed(2)} σ</div>
                        
                        <div>Asset Quality Score:</div>
                        <div className="text-right text-stone-900 font-bold">{selectedAsset.intel.qualityScore}/100</div>
                      </div>
                    </div>

                    {/* Data Integrity Audit Trail Logs */}
                    <div className="border-t border-[#E5E2D9] pt-4 mt-2">
                      <h3 className="font-mono text-[9px] uppercase tracking-widest text-[#8c2a2a] font-bold mb-2">
                        [DATA INTEGRITY AUDIT TRAIL LOG]
                      </h3>
                      <div className="overflow-x-auto text-[10px] font-mono text-stone-600 bg-[#FCFAF6] border border-[#E5E2D9] p-3">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="border-b border-stone-300 font-bold uppercase text-stone-500">
                              <th className="pb-1.5">Model Metric</th>
                              <th className="pb-1.5">Classification</th>
                              <th className="pb-1.5">Sourcing Registry</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b border-stone-150">
                              <td className="py-1.5">Structural Moat</td>
                              <td className="py-1.5 text-purple-700 font-bold">AI Analysis Mode</td>
                              <td className="py-1.5">Gemini 1.5 Pro</td>
                            </tr>
                            <tr className="border-b border-stone-150">
                              <td className="py-1.5">Debt to Equity</td>
                              <td className="py-1.5 text-stone-800 font-bold">Verified Market</td>
                              <td className="py-1.5">Finnhub Core Api</td>
                            </tr>
                            <tr className="border-b border-stone-150">
                              <td className="py-1.5">FCF Generation</td>
                              <td className="py-1.5 text-stone-800 font-bold">Verified Market</td>
                              <td className="py-1.5">Finnhub Core Api</td>
                            </tr>
                            <tr className="border-b border-stone-150">
                              <td className="py-1.5">EMA Z-Score</td>
                              <td className="py-1.5 text-blue-700 font-bold">Derived Index</td>
                              <td className="py-1.5">Calculated (30d block)</td>
                            </tr>
                            <tr className="border-b border-stone-150">
                              <td className="py-1.5">Insider Buying</td>
                              <td className="py-1.5 text-stone-800 font-bold">Verified Market</td>
                              <td className="py-1.5">SEC Form 4 Feed</td>
                            </tr>
                            <tr>
                              <td className="pt-1.5">Options Volume</td>
                              <td className="pt-1.5 text-stone-400 font-bold">Inferred Mode</td>
                              <td className="pt-1.5">Historical Implied Vol</td>
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
        </div>
      )}

      {/* Dynamic Academic Ivy-League Business School Lesson Segment */}
      <section className="bg-white border border-[#E5E2D9] p-4 md:p-6 shadow-sm mt-12">
        
        {/* Academic Header Banner */}
        <div className="border-b border-[#E5E2D9] pb-4 mb-6">
          <div className="font-mono text-xs uppercase tracking-widest text-[#8c2a2a] mb-1 font-bold flex items-center gap-1">
            <BookOpen size={12} />
            Interactive Business School
          </div>
          <h2 className="font-serif text-3xl font-normal text-[#1A1A1A]">
            Financial Theories & Live Cases
          </h2>
          <p className="text-sm text-stone-600 max-w-2xl mt-1">
            We map canonical academic corporate finance frameworks to live financial parameter calculations from your portfolio holdings records.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar Concept Selectors */}
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
            
            {/* Holdings Selector Example */}
            <div className="mt-6 p-4 bg-[#FCFAF6] border border-stone-200">
              <label htmlFor="bs-ticker-select" className="font-mono text-[10px] text-stone-500 uppercase tracking-wide block mb-1.5 font-bold">
                Apply Concept To Holding:
              </label>
              <select
                id="bs-ticker-select"
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

          {/* Academic Briefcase Content */}
          <div className="lg:col-span-3 bg-[#FAF8F5] border border-[#E5E2D9] p-6 flex flex-col justify-between">
            {bsLoading ? (
              <div className="py-20 text-center font-serif italic text-stone-400 flex flex-col items-center justify-center gap-2">
                <RefreshCw size={24} className="animate-spin text-stone-400" />
                Compiling academic textbook Briefs with live parameters...
              </div>
            ) : bsCaseData ? (
              <div className="flex flex-col gap-5 text-sm font-sans">
                
                {/* Brief Title */}
                <div className="flex justify-between items-start border-b border-[#E5E2D9] pb-4">
                  <div>
                    <span className="font-mono text-[9px] text-[#8c2a2a] uppercase tracking-widest font-bold">[ACADEMIC CASE STUDY SERIES]</span>
                    <h3 className="font-serif text-2xl font-normal mt-1">{bsCaseData.conceptName}</h3>
                  </div>
                  <div className="font-mono text-xs text-stone-600 bg-white border border-[#E5E2D9] px-3 py-1.5 uppercase font-semibold">
                    Live Example: {bsCaseData.companyExample}
                  </div>
                </div>

                {/* Concept Definition */}
                <div>
                  <h4 className="font-mono text-[10px] text-stone-500 uppercase tracking-wider mb-1.5 font-bold">Academic Concept & Context</h4>
                  <p className="text-stone-700 leading-relaxed text-sm bg-white border border-stone-200 p-4">
                    {bsCaseData.definition}
                  </p>
                </div>

                {/* Formula Equation Block */}
                <div className="bg-white border border-[#E5E2D9] p-4 font-mono text-xs text-stone-700 my-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-stone-400 text-[10px] uppercase">Mathematical Model:</span>
                    <strong className="text-stone-900 font-serif text-sm italic">{bsCaseData.equation}</strong>
                  </div>
                  <span className="font-mono text-[9px] text-stone-400 uppercase hidden sm:block">Standard Textbook Formula</span>
                </div>

                {/* Portfolio Specific Case Study Narrative */}
                <div>
                  <h4 className="font-mono text-[10px] text-stone-500 uppercase tracking-wider mb-1.5 font-bold">
                    Case Study Analysis ({bsCaseData.companyName})
                  </h4>
                  
                  <div className="italic font-serif leading-relaxed text-stone-800 bg-[#FCFAF6] border-l-4 border-stone-800 p-5 shadow-sm relative">
                    <span className="absolute top-1 left-2 font-serif text-5xl text-stone-200 leading-none pointer-events-none select-none">“</span>
                    <p className="relative z-10 pl-4">{bsCaseData.caseStudyNarrative}</p>
                  </div>
                </div>

              </div>
            ) : (
              <div className="py-20 text-center font-serif italic text-stone-400">
                Select a concept or security ticker example above to trigger textbook calculation.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default IntelligenceHub;
