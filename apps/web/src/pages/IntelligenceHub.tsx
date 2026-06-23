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

      // Auto-select first asset if present
      if (userHoldings.length > 0) {
        const first = userHoldings[0];
        setBsTicker(first.ticker);
        setBsExchange(first.exchange);
        handleSelectAsset(first.ticker, first.exchange, userConvictions);
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
                    {holdings.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center font-mono text-sm text-stone-400">
                          No active holdings. Add assets on the Dashboard to populate rankings.
                        </td>
                      </tr>
                    ) : (
                      holdings.map(h => {
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
                    <div className="font-mono text-xs text-stone-500 uppercase tracking-wider">{selectedAsset.ticker}:{selectedAsset.exchange} // {selectedAsset.intel.sector}</div>
                  </div>

                  {/* Overall Conviction */}
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

                  {/* Explainable Factor Breakdown (Requirement 2) */}
                  <div className="flex flex-col gap-4">
                    <h3 className="font-mono text-xs uppercase tracking-wider text-stone-500 border-b border-[#E5E2D9] pb-1">
                      Component Score Breakdown
                    </h3>
                    
                    {/* Factor 1: Portfolio Fit */}
                    <div className="border-b border-[#F5F3EF] pb-3">
                      <div className="flex justify-between font-mono text-xs font-bold mb-1">
                        <span>Portfolio Allocation & Fit</span>
                        <span>{selectedAsset.conviction?.breakdown.allocationFactor.score || 0} / 25</span>
                      </div>
                      <p className="text-xs text-stone-600 font-sans">
                        {selectedAsset.conviction?.breakdown.allocationFactor.explanation}
                      </p>
                    </div>

                    {/* Factor 2: Fundamentals */}
                    <div className="border-b border-[#F5F3EF] pb-3">
                      <div className="flex justify-between font-mono text-xs font-bold mb-1">
                        <span>Fundamental Quality Score</span>
                        <span>{selectedAsset.conviction?.breakdown.fundamentalFactor.score || 0} / 25</span>
                      </div>
                      <p className="text-xs text-stone-600 font-sans">
                        {selectedAsset.conviction?.breakdown.fundamentalFactor.explanation}
                      </p>
                      <div className="mt-1 font-mono text-[10px] text-stone-400 uppercase">
                        Moat: {selectedAsset.intel.research.moatRating.toUpperCase()} // FCF Margin: {selectedAsset.intel.research.freeCashFlowMargin.toFixed(1)}% // Leverage: {selectedAsset.intel.research.leverageRatio.toFixed(2)}
                      </div>
                    </div>

                    {/* Factor 3: Dip valuation */}
                    <div className="border-b border-[#F5F3EF] pb-3">
                      <div className="flex justify-between font-mono text-xs font-bold mb-1">
                        <span>Buy-The-Dip Premium</span>
                        <span>{selectedAsset.conviction?.breakdown.dipFactor.score || 0} / 25</span>
                      </div>
                      <p className="text-xs text-stone-600 font-sans">
                        {selectedAsset.conviction?.breakdown.dipFactor.explanation}
                      </p>
                    </div>

                    {/* Factor 4: Smart Money */}
                    <div>
                      <div className="flex justify-between font-mono text-xs font-bold mb-1">
                        <span>Smart Money Flow</span>
                        <span>{selectedAsset.conviction?.breakdown.institutionalFactor.score || 0} / 25</span>
                      </div>
                      <p className="text-xs text-stone-600 font-sans">
                        {selectedAsset.conviction?.breakdown.institutionalFactor.explanation}
                      </p>
                    </div>
                  </div>

                  {/* Qualitative Narrative */}
                  {selectedAsset.conviction?.rationale && (
                    <div className="bg-[#FDFCF7] border border-[#E5E2D9] p-4 text-xs font-sans text-stone-700 italic">
                      "{selectedAsset.conviction.rationale}"
                    </div>
                  )}

                  {/* Risks */}
                  {selectedAsset.intel.research.majorRisks && selectedAsset.intel.research.majorRisks.length > 0 && (
                    <div>
                      <h3 className="font-mono text-xs uppercase tracking-wider text-stone-500 mb-2">
                        Key Structural Risks
                      </h3>
                      <ul className="list-disc pl-4 text-xs text-stone-600 flex flex-col gap-1">
                        {selectedAsset.intel.research.majorRisks.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {selectedAsset.intel.dip.dipDetected && (
                    <div className="bg-amber-50 border border-amber-200 p-4 text-xs font-sans text-amber-900">
                      <strong className="font-mono uppercase text-[10px] tracking-wider block text-amber-700 mb-1">
                        [Active Dip Catalyst Alert]
                      </strong>
                      {selectedAsset.intel.dip.catalyst}
                    </div>
                  )}
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
                {holdings.map(h => (
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
