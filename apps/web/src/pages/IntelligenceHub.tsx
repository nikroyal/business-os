import React, { useState, useEffect } from 'react';
import { dbService } from '../services/firebase';
import type { CompanyIntelligence, UserConviction, Holding } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import IntelligenceService from '../services/intelligenceService';

export const IntelligenceHub: React.FC = () => {
  const { user } = useAuth();
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [convictions, setConvictions] = useState<UserConviction[]>([]);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState<string | null>(null);
  
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

  return (
    <div className="min-h-screen bg-[#FDFCF7] text-[#1A1A1A] p-8 font-sans selection:bg-[#E5E2D9]">
      {/* Editorial Header */}
      <header className="border-b border-[#E5E2D9] pb-6 mb-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="font-mono text-xs uppercase tracking-widest text-stone-500 mb-2">
              [Unified Intelligence Platform — Phase 10]
            </div>
            <h1 className="font-serif text-4xl font-normal tracking-tight text-[#1A1A1A]">
              Investment Intelligence Hub
            </h1>
          </div>
          <div className="font-mono text-xs text-stone-500 text-right">
            <div>STATUS: ACTIVE // ALL ENGINES FUNCTIONING</div>
            <div>LAST UPDATED: {new Date().toLocaleDateString()}</div>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="py-20 text-center font-mono text-sm text-stone-500">
          Syncing company indices and recalculating portfolios...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Columns: Holdings Conviction Rankings Table */}
          <div className="lg:col-span-2 flex flex-col gap-8">
            <section className="bg-white border border-[#E5E2D9] p-6 shadow-sm">
              <h2 className="font-serif text-2xl font-normal mb-4 border-b border-[#E5E2D9] pb-2 text-[#1A1A1A]">
                Holdings & Watchlist Conviction Rankings
              </h2>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#E5E2D9] font-mono text-xs text-stone-500 uppercase">
                      <th className="py-3 px-2">Asset</th>
                      <th className="py-3 px-2">Quality Score</th>
                      <th className="py-3 px-2">Dip Indicator</th>
                      <th className="py-3 px-2">Smart Money</th>
                      <th className="py-3 px-2 text-right">Conviction</th>
                      <th className="py-3 px-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {holdings.filter(h => h.ticker !== 'CASH').length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center font-mono text-sm text-stone-400">
                          No active holdings. Add assets on the Dashboard to populate rankings.
                        </td>
                      </tr>
                    ) : (
                      holdings.filter(h => h.ticker !== 'CASH').map(h => {
                        const scoreRecord = convictions.find(
                          c => c.ticker.toUpperCase() === h.ticker.toUpperCase() && c.exchange.toUpperCase() === h.exchange.toUpperCase()
                        );
                        const isSelected = selectedAsset?.ticker === h.ticker && selectedAsset?.exchange === h.exchange;
                        
                        return (
                          <tr 
                            key={h.id} 
                            onClick={() => handleSelectAsset(h.ticker, h.exchange)}
                            className={`border-b border-[#F5F3EF] cursor-pointer hover:bg-[#FDFCF7] transition-colors ${
                              isSelected ? 'bg-[#F9F8F4]' : ''
                            }`}
                          >
                            <td className="py-4 px-2">
                              <div className="font-serif text-base font-normal">{h.name}</div>
                              <div className="font-mono text-xs text-stone-400">{h.ticker}:{h.exchange}</div>
                            </td>
                            <td className="py-4 px-2 font-mono text-sm">
                              {scoreRecord ? (
                                <span className="font-bold text-stone-700">
                                  {scoreRecord.breakdown.fundamentalFactor.score * 4}
                                </span>
                              ) : (
                                <span className="text-stone-300">—</span>
                              )}
                              <span className="text-stone-400">/100</span>
                            </td>
                            <td className="py-4 px-2">
                              {scoreRecord && scoreRecord.breakdown.dipFactor.score > 10 ? (
                                <span className="font-mono text-xs px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 uppercase">
                                  Dip Detected
                                </span>
                              ) : (
                                <span className="font-mono text-xs text-stone-400 uppercase">Baseline</span>
                              )}
                            </td>
                            <td className="py-4 px-2 font-mono text-xs text-stone-600">
                              {scoreRecord ? (
                                <span className="capitalize">{scoreRecord.breakdown.institutionalFactor.score >= 18 ? 'Accumulation' : 'Neutral'}</span>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="py-4 px-2 text-right">
                              {scoreRecord ? (
                                <span className={`font-mono font-bold text-lg ${
                                  scoreRecord.overallScore >= 75 ? 'text-green-700' : scoreRecord.overallScore >= 50 ? 'text-stone-700' : 'text-red-700'
                                }`}>
                                  {scoreRecord.overallScore}
                                </span>
                              ) : (
                                <span className="font-mono text-stone-300">Pending</span>
                              )}
                            </td>
                            <td className="py-4 px-2 text-right" onClick={e => e.stopPropagation()}>
                              <button
                                onClick={() => handleRecalculate(h.ticker, h.exchange)}
                                disabled={recalculating === `${h.ticker}:${h.exchange}`}
                                className="font-mono text-xs border border-stone-300 hover:border-stone-800 disabled:opacity-50 px-2 py-1 bg-[#FDFCF7] hover:bg-stone-50 transition-colors"
                              >
                                {recalculating === `${h.ticker}:${h.exchange}` ? '...' : 'Refresh'}
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

          {/* Right Column: Component-Level Explainability Details Panel */}
          <div className="lg:col-span-1">
            <section className="bg-white border border-[#E5E2D9] p-6 shadow-sm sticky top-6">
              <h2 className="font-serif text-2xl font-normal mb-4 border-b border-[#E5E2D9] pb-2 text-[#1A1A1A]">
                Intelligence Rationale
              </h2>
              
              {!selectedAsset ? (
                <div className="font-mono text-xs text-stone-400 py-12 text-center">
                  Select an asset on the left to examine its component score analysis.
                </div>
              ) : !selectedAsset.intel ? (
                <div className="font-mono text-xs text-stone-400 py-12 text-center">
                  Compiling canonical intelligence record...
                </div>
              ) : (
                <div className="flex flex-col gap-6">
                  <div>
                    <div className="font-mono text-xs text-stone-400 uppercase">[Active Selection]</div>
                    <div className="font-serif text-2xl font-normal">{selectedAsset.intel.name}</div>
                    <div className="font-mono text-xs text-stone-500 uppercase tracking-wider">
                      {selectedAsset.ticker}:{selectedAsset.exchange} // {selectedAsset.intel.sector} // {selectedAsset.intel.research.fundamentals?.industry || 'General Industry'}
                    </div>
                  </div>

                  {/* Overall Conviction Score Card */}
                  <div className="bg-[#FDFCF7] border border-[#E5E2D9] p-4 flex items-center justify-between">
                    <div>
                      <div className="font-mono text-xs text-stone-500 uppercase">Overall Conviction</div>
                      <div className="font-mono text-xs text-stone-400">Personalized Risk Profile</div>
                    </div>
                    <div className="text-right">
                      <span className="font-serif text-4xl font-normal">
                        {selectedAsset.conviction?.overallScore || '—'}
                      </span>
                      <span className="font-mono text-xs text-stone-400">/100</span>
                    </div>
                  </div>

                  {/* Hardened Conviction Explainability (Part 2) */}
                  <div className="flex flex-col gap-4">
                    <h3 className="font-mono text-xs uppercase tracking-wider text-stone-500 border-b border-[#E5E2D9] pb-1">
                      Conviction Score Breakdown
                    </h3>
                    
                    {/* Allocation Factor */}
                    <div className="border-b border-[#F5F3EF] pb-3">
                      <div className="flex justify-between font-mono text-xs font-bold mb-1">
                        <span>Portfolio Allocation Factor</span>
                        <span>{selectedAsset.conviction?.breakdown.allocationFactor.contribution || 0} / 25</span>
                      </div>
                      <div className="text-[10px] text-stone-400 font-mono mb-1">
                        RAW: {selectedAsset.conviction?.breakdown.allocationFactor.score || 0}/100 | WEIGHT: 25% | CONTRIBUTION: {selectedAsset.conviction?.breakdown.allocationFactor.contribution || 0} pts
                      </div>
                      <p className="text-xs text-stone-600 font-sans">
                        {selectedAsset.conviction?.breakdown.allocationFactor.explanation}
                      </p>
                    </div>

                    {/* Fundamental Factor */}
                    <div className="border-b border-[#F5F3EF] pb-3">
                      <div className="flex justify-between font-mono text-xs font-bold mb-1">
                        <span>Fundamental Quality Factor</span>
                        <span>{selectedAsset.conviction?.breakdown.fundamentalFactor.contribution || 0} / 25</span>
                      </div>
                      <div className="text-[10px] text-stone-400 font-mono mb-1">
                        RAW: {selectedAsset.conviction?.breakdown.fundamentalFactor.score || 0}/100 | WEIGHT: 25% | CONTRIBUTION: {selectedAsset.conviction?.breakdown.fundamentalFactor.contribution || 0} pts
                      </div>
                      <p className="text-xs text-stone-600 font-sans">
                        {selectedAsset.conviction?.breakdown.fundamentalFactor.explanation}
                      </p>
                    </div>

                    {/* Dip Factor */}
                    <div className="border-b border-[#F5F3EF] pb-3">
                      <div className="flex justify-between font-mono text-xs font-bold mb-1">
                        <span>Buy-The-Dip Premium</span>
                        <span>{selectedAsset.conviction?.breakdown.dipFactor.contribution || 0} / 25</span>
                      </div>
                      <div className="text-[10px] text-stone-400 font-mono mb-1">
                        RAW: {selectedAsset.conviction?.breakdown.dipFactor.score || 0}/100 | WEIGHT: 25% | CONTRIBUTION: {selectedAsset.conviction?.breakdown.dipFactor.contribution || 0} pts
                      </div>
                      <p className="text-xs text-stone-600 font-sans">
                        {selectedAsset.conviction?.breakdown.dipFactor.explanation}
                      </p>
                    </div>

                    {/* Smart Money Factor */}
                    <div className="pb-2">
                      <div className="flex justify-between font-mono text-xs font-bold mb-1">
                        <span>Smart Money Flow Factor</span>
                        <span>{selectedAsset.conviction?.breakdown.institutionalFactor.contribution || 0} / 25</span>
                      </div>
                      <div className="text-[10px] text-stone-400 font-mono mb-1">
                        RAW: {selectedAsset.conviction?.breakdown.institutionalFactor.score || 0}/100 | WEIGHT: 25% | CONTRIBUTION: {selectedAsset.conviction?.breakdown.institutionalFactor.contribution || 0} pts
                      </div>
                      <p className="text-xs text-stone-600 font-sans">
                        {selectedAsset.conviction?.breakdown.institutionalFactor.explanation}
                      </p>
                    </div>
                  </div>

                  {/* Standardized Quality Score Breakdown (Part 3) */}
                  <div className="flex flex-col gap-4">
                    <h3 className="font-mono text-xs uppercase tracking-wider text-stone-500 border-b border-[#E5E2D9] pb-1">
                      Quality Score Framework ({selectedAsset.intel.qualityScore}/100)
                    </h3>
                    
                    {(() => {
                      const qb = selectedAsset.intel.qualityBreakdown || {
                        moat: { score: selectedAsset.intel.qualityScore >= 70 ? 40 : 25, max: 40, weight: 0.4, contribution: selectedAsset.intel.qualityScore >= 70 ? 40 : 25, value: selectedAsset.intel.research.moatRating.toUpperCase(), rationale: selectedAsset.intel.research.moatRationale },
                        leverage: { score: selectedAsset.intel.research.leverageRatio < 0.4 ? 30 : 20, max: 30, weight: 0.3, contribution: selectedAsset.intel.research.leverageRatio < 0.4 ? 30 : 20, value: selectedAsset.intel.research.leverageRatio, rationale: `Leverage ratio is ${selectedAsset.intel.research.leverageRatio.toFixed(2)}.` },
                        fcfMargin: { score: selectedAsset.intel.research.freeCashFlowMargin > 25 ? 30 : 20, max: 30, weight: 0.3, contribution: selectedAsset.intel.research.freeCashFlowMargin > 25 ? 30 : 20, value: selectedAsset.intel.research.freeCashFlowMargin, rationale: `FCF Margin is ${selectedAsset.intel.research.freeCashFlowMargin.toFixed(1)}%.` }
                      };
                      return (
                        <div className="flex flex-col gap-3 text-xs">
                          <div>
                            <div className="flex justify-between font-mono font-bold">
                              <span>1. Economic Moat Rating</span>
                              <span>{qb.moat.score} / {qb.moat.max} (Weight 40%)</span>
                            </div>
                            <p className="text-stone-600 font-sans text-xs italic">"{qb.moat.rationale}"</p>
                          </div>
                          <div>
                            <div className="flex justify-between font-mono font-bold">
                              <span>2. Leverage & Solvency</span>
                              <span>{qb.leverage.score} / {qb.leverage.max} (Weight 30%)</span>
                            </div>
                            <p className="text-stone-600 font-sans text-xs">{qb.leverage.rationale} (Target Debt/Equity ratio &lt; 0.40)</p>
                          </div>
                          <div>
                            <div className="flex justify-between font-mono font-bold">
                              <span>3. FCF Generation Margin</span>
                              <span>{qb.fcfMargin.score} / {qb.fcfMargin.max} (Weight 30%)</span>
                            </div>
                            <p className="text-stone-600 font-sans text-xs">{qb.fcfMargin.rationale} (High Quality target &gt; 25.0%)</p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Expanded Company Fundamentals (Part 3) */}
                  <div>
                    <h3 className="font-mono text-xs uppercase tracking-wider text-stone-500 border-b border-[#E5E2D9] pb-1 mb-2">
                      Live Fundamentals Registry
                    </h3>
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono text-stone-700 bg-stone-50 p-3 border border-[#E5E2D9]">
                      <div>Sector:</div>
                      <div className="text-right font-bold">{selectedAsset.intel.sector}</div>

                      <div>Industry:</div>
                      <div className="text-right font-bold">{selectedAsset.intel.research.fundamentals?.industry || 'Data unavailable'}</div>

                      <div>Market Cap:</div>
                      <div className="text-right font-bold">
                        {selectedAsset.intel.research.fundamentals?.marketCapMillions 
                          ? `$${(selectedAsset.intel.research.fundamentals.marketCapMillions / 1000).toFixed(2)}B`
                          : 'Data unavailable'}
                      </div>
                      
                      <div>Debt/Equity:</div>
                      <div className="text-right font-bold">
                        {selectedAsset.intel.research.fundamentals?.debtToEquity !== null && selectedAsset.intel.research.fundamentals?.debtToEquity !== undefined
                          ? selectedAsset.intel.research.fundamentals.debtToEquity.toFixed(2)
                          : 'Data unavailable'}
                      </div>

                      <div>Free Cash Flow Margin:</div>
                      <div className="text-right font-bold">
                        {selectedAsset.intel.research.freeCashFlowMargin !== null && selectedAsset.intel.research.freeCashFlowMargin !== undefined
                          ? `${selectedAsset.intel.research.freeCashFlowMargin.toFixed(1)}%`
                          : 'Data unavailable'}
                      </div>

                      <div>Revenue Growth:</div>
                      <div className="text-right font-bold text-green-700">
                        {selectedAsset.intel.research.fundamentals?.revenueGrowthYoy !== null && selectedAsset.intel.research.fundamentals?.revenueGrowthYoy !== undefined
                          ? `+${(selectedAsset.intel.research.fundamentals.revenueGrowthYoy).toFixed(1)}% YoY`
                          : 'Data unavailable'}
                      </div>

                      <div>Earnings Growth:</div>
                      <div className="text-right font-bold text-green-700">
                        {selectedAsset.intel.research.fundamentals?.earningsGrowthYoy !== null && selectedAsset.intel.research.fundamentals?.earningsGrowthYoy !== undefined
                          ? `+${(selectedAsset.intel.research.fundamentals.earningsGrowthYoy).toFixed(1)}% YoY`
                          : 'Data unavailable'}
                      </div>

                      <div>Return on Capital (ROIC):</div>
                      <div className="text-right font-bold">
                        {selectedAsset.intel.research.fundamentals?.roic !== null && selectedAsset.intel.research.fundamentals?.roic !== undefined
                          ? `${(selectedAsset.intel.research.fundamentals.roic).toFixed(1)}%`
                          : 'Data unavailable'}
                      </div>

                      <div>Gross Margin:</div>
                      <div className="text-right font-bold">
                        {selectedAsset.intel.research.fundamentals?.grossMargin !== null && selectedAsset.intel.research.fundamentals?.grossMargin !== undefined
                          ? `${(selectedAsset.intel.research.fundamentals.grossMargin).toFixed(1)}%`
                          : 'Data unavailable'}
                      </div>

                      <div>Operating Margin:</div>
                      <div className="text-right font-bold">
                        {selectedAsset.intel.research.fundamentals?.operatingMargin !== null && selectedAsset.intel.research.fundamentals?.operatingMargin !== undefined
                          ? `${(selectedAsset.intel.research.fundamentals.operatingMargin).toFixed(1)}%`
                          : 'Data unavailable'}
                      </div>
                    </div>
                  </div>

                  {/* Audited Dip detector validation (Part 4) */}
                  <div className="flex flex-col gap-2">
                    <h3 className="font-mono text-xs uppercase tracking-wider text-stone-500 border-b border-[#E5E2D9] pb-1">
                      Dip Detector Validation
                    </h3>
                    {selectedAsset.intel.dip.dipDetected ? (
                      <div className={`p-4 border text-xs font-sans ${
                        selectedAsset.intel.dip.classification === 'Healthy' 
                          ? 'bg-green-50 border-green-200 text-green-900' 
                          : selectedAsset.intel.dip.classification === 'Dangerous' 
                            ? 'bg-red-50 border-red-200 text-red-900' 
                            : 'bg-amber-50 border-amber-200 text-amber-900'
                      }`}>
                        <div className="font-mono font-bold uppercase text-[10px] mb-1">
                          [DIP CLASSIFICATION: {selectedAsset.intel.dip.classification?.toUpperCase() || 'UNSTABLE'}]
                        </div>
                        <p className="mb-2 italic">"{selectedAsset.intel.dip.classificationRationale || selectedAsset.intel.dip.catalyst}"</p>
                        
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[10px] text-stone-500 pt-2 border-t border-stone-200">
                          <div>Current Price:</div>
                          <div className="text-right text-stone-800">${(selectedAsset.intel.dip.currentPrice || 0).toFixed(2)}</div>
                          <div>52W Range:</div>
                          <div className="text-right text-stone-800">${(selectedAsset.intel.dip.fiftyTwoWeekLow || 0).toFixed(2)} - ${(selectedAsset.intel.dip.fiftyTwoWeekHigh || 0).toFixed(2)}</div>
                          <div>50-day EMA:</div>
                          <div className="text-right text-stone-800">${(selectedAsset.intel.dip.ema50 || 0).toFixed(2)}</div>
                          <div>Z-score Deviation:</div>
                          <div className="text-right text-stone-800">{(selectedAsset.intel.dip.zScore || 0).toFixed(2)} σ</div>
                          <div>Volatility (StdDev):</div>
                          <div className="text-right text-stone-800">{(selectedAsset.intel.dip.volatility || 0).toFixed(2)}</div>
                          <div>Quality Score:</div>
                          <div className="text-right text-stone-800">{selectedAsset.intel.qualityScore}/100</div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-stone-50 border border-stone-200 p-4 text-xs font-sans text-stone-600">
                        <strong className="font-mono uppercase text-[10px] block text-stone-500 mb-1">[DIP CLASSIFICATION: HEALTHY]</strong>
                        <p className="mb-2 italic">"{selectedAsset.intel.dip.classificationRationale || 'No unusual price declines detected. Asset remains within standard deviation limits.'}"</p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[10px] text-stone-500 pt-2 border-t border-stone-200">
                          <div>Current Price:</div>
                          <div className="text-right text-stone-800">${(selectedAsset.intel.dip.currentPrice || 0).toFixed(2)}</div>
                          <div>52W Range:</div>
                          <div className="text-right text-stone-800">${(selectedAsset.intel.dip.fiftyTwoWeekLow || 0).toFixed(2)} - ${(selectedAsset.intel.dip.fiftyTwoWeekHigh || 0).toFixed(2)}</div>
                          <div>50-day EMA:</div>
                          <div className="text-right text-stone-800">${(selectedAsset.intel.dip.ema50 || 0).toFixed(2)}</div>
                          <div>Z-score Deviation:</div>
                          <div className="text-right text-stone-800">{(selectedAsset.intel.dip.zScore || 0).toFixed(2)} σ</div>
                          <div>Volatility (StdDev):</div>
                          <div className="text-right text-stone-800">{(selectedAsset.intel.dip.volatility || 0).toFixed(2)}</div>
                          <div>Quality Score:</div>
                          <div className="text-right text-stone-800">{selectedAsset.intel.qualityScore}/100</div>
                        </div>
                      </div>
                    )}
                                  {/* Institutional-Grade Smart Money Registry (Part 1) */}
                  <div className="flex flex-col gap-3">
                    <h3 className="font-mono text-xs uppercase tracking-wider text-stone-500 border-b border-[#E5E2D9] pb-1">
                      Institutional & Insider Flows
                    </h3>

                    {/* Insider Transactions Metric */}
                    <div className="bg-stone-50 border border-stone-200 p-3 text-xs">
                      <div className="flex justify-between font-mono font-bold mb-1">
                        <span>1. Insider Buying Activity</span>
                        <span className="text-[10px] uppercase text-stone-500 bg-white border px-1 border-stone-200">
                          Confidence: {selectedAsset.intel.smartMoney.insiderTransactions?.confidence || 'none'}
                        </span>
                      </div>
                      {selectedAsset.intel.smartMoney.insiderTransactions?.value ? (
                        <div className="font-mono text-[10px] text-stone-700">
                          <div>Net Shares Exchanged: {selectedAsset.intel.smartMoney.insiderTransactions.value.netSharesBought.toLocaleString()}</div>
                          <div>Total Filings (90 Days): {selectedAsset.intel.smartMoney.insiderTransactions.value.totalTransactionsCount} ({selectedAsset.intel.smartMoney.insiderTransactions.value.buyCount} buys, {selectedAsset.intel.smartMoney.insiderTransactions.value.sellCount} sells)</div>
                        </div>
                      ) : (
                        <div className="text-stone-400 italic font-mono text-[10px]">Data unavailable</div>
                      )}
                      <div className="text-[9px] text-stone-400 font-mono mt-1">
                        SOURCE: {selectedAsset.intel.smartMoney.insiderTransactions?.source} | FRESHNESS: {selectedAsset.intel.smartMoney.insiderTransactions?.freshness}
                        {selectedAsset.intel.smartMoney.insiderTransactions?.timestamp && ` | AS OF: ${new Date(selectedAsset.intel.smartMoney.insiderTransactions.timestamp).toLocaleString()}`}
                      </div>
                    </div>

                    {/* Insider Sentiment Metric */}
                    <div className="bg-stone-50 border border-stone-200 p-3 text-xs">
                      <div className="flex justify-between font-mono font-bold mb-1">
                        <span>2. Corporate Officer Sentiment</span>
                        <span className="text-[10px] uppercase text-stone-500 bg-white border px-1 border-stone-200">
                          Confidence: {selectedAsset.intel.smartMoney.insiderSentiment?.confidence || 'none'}
                        </span>
                      </div>
                      {selectedAsset.intel.smartMoney.insiderSentiment?.value ? (
                        <div className="font-mono text-[10px] text-stone-700">
                          <div>Monthly Purchase Ratio (MSPR): {selectedAsset.intel.smartMoney.insiderSentiment.value.mspr.toFixed(2)}</div>
                          <div>Officer Share Change: {selectedAsset.intel.smartMoney.insiderSentiment.value.change.toLocaleString()}</div>
                        </div>
                      ) : (
                        <div className="text-stone-400 italic font-mono text-[10px]">Data unavailable</div>
                      )}
                      <div className="text-[9px] text-stone-400 font-mono mt-1">
                        SOURCE: {selectedAsset.intel.smartMoney.insiderSentiment?.source} | FRESHNESS: {selectedAsset.intel.smartMoney.insiderSentiment?.freshness}
                        {selectedAsset.intel.smartMoney.insiderSentiment?.timestamp && ` | AS OF: ${new Date(selectedAsset.intel.smartMoney.insiderSentiment.timestamp).toLocaleString()}`}
                      </div>
                    </div>

                    {/* Options Flow Metric */}
                    <div className="bg-stone-50 border border-stone-200 p-3 text-xs">
                      <div className="flex justify-between font-mono font-bold mb-1">
                        <span>3. Options Volume & Flow Sentiment</span>
                        <span className="text-[10px] uppercase text-stone-500 bg-white border px-1 border-stone-200">
                          Confidence: {selectedAsset.intel.smartMoney.optionsVolume?.confidence || 'none'}
                        </span>
                      </div>
                      {selectedAsset.intel.smartMoney.optionsVolume?.value ? (
                        <div className="font-mono text-[10px] text-stone-700">
                          <div>Put/Call Ratio: {selectedAsset.intel.smartMoney.optionsVolume.value.putCallRatio.toFixed(2)}</div>
                          <div>Sentiment: {selectedAsset.intel.smartMoney.optionsVolume.value.sentiment.toUpperCase()}</div>
                        </div>
                      ) : (
                        <div className="text-stone-400 italic font-mono text-[10px]">Data unavailable</div>
                      )}
                      <div className="text-[9px] text-stone-400 font-mono mt-1">
                        SOURCE: {selectedAsset.intel.smartMoney.optionsVolume?.source || 'Finnhub Options Volume API'} | FRESHNESS: {selectedAsset.intel.smartMoney.optionsVolume?.freshness || 'Data unavailable'}
                        {selectedAsset.intel.smartMoney.optionsVolume?.timestamp && ` | AS OF: ${new Date(selectedAsset.intel.smartMoney.optionsVolume.timestamp).toLocaleString()}`}
                      </div>
                    </div>

                    {/* Institutional 13F Metric */}
                    <div className="bg-stone-50 border border-stone-200 p-3 text-xs">
                      <div className="flex justify-between font-mono font-bold mb-1">
                        <span>4. SEC Form 13F Positions</span>
                        <span className="text-[10px] uppercase text-stone-500 bg-white border px-1 border-stone-200">
                          Confidence: {selectedAsset.intel.smartMoney.institutionalOwnership?.confidence || 'none'}
                        </span>
                      </div>
                      {selectedAsset.intel.smartMoney.institutionalOwnership?.value ? (
                        <div className="font-mono text-[10px] text-stone-700">
                          <div>Ownership: {selectedAsset.intel.smartMoney.institutionalOwnership.value.ownershipPercent.toFixed(1)}%</div>
                          <div>Net Flow: {selectedAsset.intel.smartMoney.institutionalOwnership.value.netFlow.toUpperCase()}</div>
                        </div>
                      ) : (
                        <div className="text-stone-400 italic font-mono text-[10px]">Data unavailable</div>
                      )}
                      <div className="text-[9px] text-stone-400 font-mono mt-1">
                        SOURCE: {selectedAsset.intel.smartMoney.institutionalOwnership?.source || 'SEC Form 13F database'} | FRESHNESS: {selectedAsset.intel.smartMoney.institutionalOwnership?.freshness || 'Data unavailable'}
                        {selectedAsset.intel.smartMoney.institutionalOwnership?.timestamp && ` | AS OF: ${new Date(selectedAsset.intel.smartMoney.institutionalOwnership.timestamp).toLocaleString()}`}
                      </div>
                    </div>
                  </div>

                  {/* Data Integrity Audit Panel (Part 6) */}
                  <div className="border-t border-[#E5E2D9] pt-4 mt-2">
                    <h3 className="font-mono text-xs uppercase tracking-wider text-stone-500 mb-2">
                      [Data Integrity Audit Log]
                    </h3>
                    <div className="overflow-x-auto text-[10px] font-mono text-stone-600 bg-stone-50 border border-[#E5E2D9] p-3">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-stone-300 font-bold uppercase text-stone-500">
                            <th className="pb-1">Metric</th>
                            <th className="pb-1">Classification</th>
                            <th className="pb-1">Data Source</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-stone-100">
                            <td className="py-1">Moat Rating</td>
                            <td className="py-1 text-purple-700 font-semibold">AI Interpretation</td>
                            <td className="py-1">Gemini 1.5 Pro Model</td>
                          </tr>
                          <tr className="border-b border-stone-100">
                            <td className="py-1">Debt/Equity</td>
                            <td className={`py-1 font-semibold ${selectedAsset.intel.research.fundamentals?.debtToEquity !== null ? 'text-green-700' : 'text-stone-400'}`}>
                              {selectedAsset.intel.research.fundamentals?.debtToEquity !== null ? 'Real Market Data' : 'Unavailable'}
                            </td>
                            <td className="py-1">Finnhub Stock Metrics</td>
                          </tr>
                          <tr className="border-b border-stone-100">
                            <td className="py-1">FCF Margin</td>
                            <td className={`py-1 font-semibold ${selectedAsset.intel.research.freeCashFlowMargin !== null ? 'text-green-700' : 'text-stone-400'}`}>
                              {selectedAsset.intel.research.freeCashFlowMargin !== null ? 'Real Market Data' : 'Unavailable'}
                            </td>
                            <td className="py-1">Finnhub Stock Metrics</td>
                          </tr>
                          <tr className="border-b border-stone-100">
                            <td className="py-1">Z-Score Deviation</td>
                            <td className="py-1 text-blue-700 font-semibold">Derived Data</td>
                            <td className="py-1">50-day Candle EMA StdDev</td>
                          </tr>
                          <tr className="border-b border-stone-100">
                            <td className="py-1">Dip Classification</td>
                            <td className="py-1 text-orange-600 font-semibold">Heuristic</td>
                            <td className="py-1">Standard Quality Rules</td>
                          </tr>
                          <tr className="border-b border-stone-100">
                            <td className="py-1">Insider Transactions</td>
                            <td className={`py-1 font-semibold ${selectedAsset.intel.smartMoney.insiderTransactions?.value ? 'text-green-700' : 'text-stone-400'}`}>
                              {selectedAsset.intel.smartMoney.insiderTransactions?.value ? 'Real Market Data' : 'Unavailable'}
                            </td>
                            <td className="py-1">
                              {selectedAsset.intel.smartMoney.insiderTransactions?.value ? selectedAsset.intel.smartMoney.insiderTransactions.source : 'None'}
                            </td>
                          </tr>
                          <tr className="border-b border-stone-100">
                            <td className="py-1">Insider Sentiment</td>
                            <td className={`py-1 font-semibold ${selectedAsset.intel.smartMoney.insiderSentiment?.value ? 'text-green-700' : 'text-stone-400'}`}>
                              {selectedAsset.intel.smartMoney.insiderSentiment?.value ? 'Real Market Data' : 'Unavailable'}
                            </td>
                            <td className="py-1">
                              {selectedAsset.intel.smartMoney.insiderSentiment?.value ? selectedAsset.intel.smartMoney.insiderSentiment.source : 'None'}
                            </td>
                          </tr>
                          <tr className="border-b border-stone-100">
                            <td className="py-1">Options Volume Flow</td>
                            <td className="py-1 text-stone-400 font-semibold">Unavailable</td>
                            <td className="py-1">Finnhub Options Volume API (Null)</td>
                          </tr>
                          <tr>
                            <td className="pt-1">13F Holdings</td>
                            <td className="pt-1 text-stone-400 font-semibold">Unavailable</td>
                            <td className="pt-1">SEC Edgar Database (Null)</td>
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
      )}

      {/* Bottom Segment: Business School Concept Case Studies */}
      <section className="bg-white border border-[#E5E2D9] p-6 shadow-sm mt-12">
        <div className="border-b border-[#E5E2D9] pb-3 mb-6">
          <div className="font-mono text-xs uppercase tracking-widest text-stone-500 mb-1">
            [Interactive Business School — Requirement 3]
          </div>
          <h2 className="font-serif text-3xl font-normal text-[#1A1A1A]">
            Financial Theories & Live Cases
          </h2>
          <p className="text-sm text-stone-600 font-sans mt-1">
            Rather than calling separate analysis prompts, we dynamically compile textbook academic parameters combined with live Company Intelligence values of your holdings.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Concept Selectors */}
          <div className="md:col-span-1 flex flex-col gap-2">
            <button
              onClick={() => setBsConcept('operating_leverage')}
              className={`text-left font-serif text-lg py-2 px-3 border transition-colors ${
                bsConcept === 'operating_leverage'
                  ? 'border-stone-800 bg-[#FDFCF7] font-semibold'
                  : 'border-transparent hover:bg-stone-50'
              }`}
            >
              Operating Leverage
            </button>
            <button
              onClick={() => setBsConcept('economic_moats')}
              className={`text-left font-serif text-lg py-2 px-3 border transition-colors ${
                bsConcept === 'economic_moats'
                  ? 'border-stone-800 bg-[#FDFCF7] font-semibold'
                  : 'border-transparent hover:bg-stone-50'
              }`}
            >
              Economic Moats
            </button>
            <button
              onClick={() => setBsConcept('free_cash_flow_margin')}
              className={`text-left font-serif text-lg py-2 px-3 border transition-colors ${
                bsConcept === 'free_cash_flow_margin'
                  ? 'border-stone-800 bg-[#FDFCF7] font-semibold'
                  : 'border-transparent hover:bg-stone-50'
              }`}
            >
              Free Cash Flow Margin
            </button>
            <button
              onClick={() => setBsConcept('financial_solvency')}
              className={`text-left font-serif text-lg py-2 px-3 border transition-colors ${
                bsConcept === 'financial_solvency'
                  ? 'border-stone-800 bg-[#FDFCF7] font-semibold'
                  : 'border-transparent hover:bg-stone-50'
              }`}
            >
              Financial Solvency
            </button>
            
            <div className="mt-4">
              <label className="font-mono text-xs text-stone-400 block mb-1">Select Ticker Example</label>
              <select
                value={bsTicker}
                onChange={e => {
                  const h = holdings.find(item => item.ticker === e.target.value);
                  if (h) {
                    setBsTicker(h.ticker);
                    setBsExchange(h.exchange);
                  }
                }}
                className="w-full bg-[#FDFCF7] border border-stone-300 font-mono text-xs p-2 focus:outline-none focus:border-stone-800"
              >
                {holdings.filter(h => h.ticker !== 'CASH').map(h => (
                  <option key={h.id} value={h.ticker}>
                    {h.ticker} ({h.name})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Case Study Output Display */}
          <div className="md:col-span-3 bg-[#FDFCF7] border border-[#E5E2D9] p-6">
            {bsLoading ? (
              <div className="py-12 text-center font-mono text-sm text-stone-400">
                Compiling theoretical models with live parameters...
              </div>
            ) : bsCaseData ? (
              <div className="flex flex-col gap-4 font-sans">
                <div className="flex justify-between items-start border-b border-[#E5E2D9] pb-3">
                  <div>
                    <span className="font-mono text-[10px] text-stone-400 uppercase tracking-widest">[CONCEPT BRIEF]</span>
                    <h3 className="font-serif text-2xl font-normal">{bsCaseData.conceptName}</h3>
                  </div>
                  <div className="font-mono text-xs text-stone-500 bg-white border border-[#E5E2D9] px-2 py-1 uppercase">
                    Case Study: {bsCaseData.companyExample}
                  </div>
                </div>

                <div>
                  <h4 className="font-mono text-xs text-stone-500 uppercase tracking-wider mb-1">Academic Definition</h4>
                  <p className="text-sm text-stone-700 leading-relaxed">{bsCaseData.definition}</p>
                </div>

                <div className="bg-white border border-[#E5E2D9] p-3 font-mono text-xs text-stone-600 my-2">
                  <span className="font-bold text-stone-400 mr-2">FORMULA:</span>
                  {bsCaseData.equation}
                </div>

                <div>
                  <h4 className="font-mono text-xs text-stone-500 uppercase tracking-wider mb-1">
                    Holdings-Specific Case Study ({bsCaseData.companyName})
                  </h4>
                  <p className="text-sm text-stone-700 leading-relaxed italic bg-white border-l-4 border-stone-800 p-4">
                    "{bsCaseData.caseStudyNarrative}"
                  </p>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center font-mono text-sm text-stone-400">
                Select an example above to generate the live Business School analysis.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default IntelligenceHub;
