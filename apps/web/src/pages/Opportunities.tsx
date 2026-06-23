import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Lightbulb, 
  RefreshCw, 
  Check, 
  Plus, 
  AlertCircle,
  HelpCircle,
  Sparkles
} from 'lucide-react';
import { OpportunityService } from '../services/opportunityService';
import { WatchlistService } from '../services/watchlistService';
import { dbService } from '../services/firebase';
import type { Opportunity, AICommentary } from '../services/firebase';
import { GeminiService } from '../services/geminiService';
import { PortfolioAnalyticsService } from '../services/portfolioAnalyticsService';
import { marketDataService } from '../services/marketDataService';
import type { AssetMetadata } from '../services/marketDataService';
import { PlatformHealthWidget } from '../components/PlatformHealthWidget';
import { SampleDataService } from '../services/sampleDataService';

export const Opportunities: React.FC = () => {
  const { user, profile } = useAuth();
  
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState('Initializing scan...');
  const [error, setError] = useState<string | null>(null);
  
  // Filtering state
  // Supported filters: 'all', 'momentum', 'value', 'diversification', 'watchlist'
  const [activeFilter, setActiveFilter] = useState<'all' | 'momentum' | 'value' | 'diversification' | 'watchlist'>('all');

  // Gemini & Detail states
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [aiCommentary, setAiCommentary] = useState<AICommentary | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  const scanSteps = [
    "Establishing connection to market data servers...",
    "Querying 365-day candle records for candidate tickers...",
    "Calculating short-term (30-day) relative price momentum...",
    "Evaluating medium-term (90-day) price performance coefficients...",
    "Locating support ranges near 52-week low thresholds...",
    "Detecting resistance bands near 52-week high levels...",
    "Retrieving user portfolio valuation & holdings distribution...",
    "Calculating Herfindahl-Hirschman index (HHI) for concentration risk...",
    "Analyzing sector weights to identify underexposed industries...",
    "Evaluating currency exposures relative to base base currencies...",
    "Filtering candidates against deterministic opportunity rules...",
    "Writing calculated intelligence records to Firestore...",
    "Scan complete. Redrawing intelligence board."
  ];

  const fetchAICommentary = async (currentOpps: Opportunity[]) => {
    if (!user || !profile?.geminiEnabled) {
      setAiCommentary(null);
      return;
    }
    setLoadingAi(true);
    try {
      const listHoldings = await dbService.getHoldings(user.uid);
      const prices: Record<string, number> = {};
      const metadataMap: Record<string, AssetMetadata | null> = {};
      
      for (const h of listHoldings) {
        prices[h.id] = await marketDataService.getPrice(h.ticker, h.exchange, h.currentPrice || h.purchasePrice);
        const meta = await marketDataService.getMetadata(h.ticker, h.exchange);
        metadataMap[h.ticker || h.symbol] = meta;
      }

      const reportingCurrency = profile?.reportingCurrency || 'USD';
      const usdToInrRate = profile?.usdToInrRate || 83.50;

      const analytics = PortfolioAnalyticsService.calculate(
        listHoldings,
        prices,
        metadataMap,
        reportingCurrency,
        usdToInrRate,
        profile?.riskProfile
      );

      const dummyReport = {
        userId: user.uid,
        date: new Date().toISOString().split('T')[0],
        title: "Opportunities Intelligence Scan Summary",
        summary: "Detailed scanning of watchlist and portfolio diversification gaps.",
        sections: {
          marketSnapshot: {
            globalTrend: 'neutral' as const,
            usMarket: '',
            indianMarket: '',
            cryptoMarket: ''
          },
          portfolioSummary: {
            totalValue: analytics.totalValue,
            totalGainLoss: analytics.totalGainLoss,
            performanceLabel: '',
            allocationHighlights: ''
          },
          watchlistMovers: [],
          riskFlags: [],
          learningItem: { term: '', definition: '', context: '' }
        }
      };

      const commentary = await GeminiService.generateEditorialCommentary(
        user.uid,
        profile,
        dummyReport,
        analytics,
        currentOpps,
        'opportunities_latest'
      );
      setAiCommentary(commentary);
    } catch (err) {
      console.warn("Opportunities AI Commentary fetch failed:", err);
    } finally {
      setLoadingAi(false);
    }
  };

  useEffect(() => {
    if (opportunities.length > 0) {
      fetchAICommentary(opportunities);
    } else {
      setAiCommentary(null);
    }
  }, [opportunities, profile]);

  const fetchOpportunities = async (forceRegen = false) => {
    if (!user) return;
    
    if (forceRegen) {
      setScanning(true);
      setError(null);
      
      // Step through scanning messages to simulate active computation
      let stepIdx = 0;
      const interval = setInterval(() => {
        if (stepIdx < scanSteps.length) {
          setScanMessage(scanSteps[stepIdx]);
          stepIdx++;
        }
      }, 350);

      try {
        await OpportunityService.generateAndPersist(user.uid);
        const data = await OpportunityService.getStoredOpportunities(user.uid);
        setOpportunities(data);
      } catch (err) {
        console.error('Error generating opportunities:', err);
        setError('Scanning error. Check market data provider credentials or fallback parameters.');
      } finally {
        clearInterval(interval);
        setScanning(false);
      }
    } else {
      setLoading(true);
      setError(null);
      try {
        let data = await OpportunityService.getStoredOpportunities(user.uid);
        // If empty, generate them automatically for the first time
        if (data.length === 0) {
          data = await OpportunityService.generateAndPersist(user.uid);
        }
        setOpportunities(data);
      } catch (err) {
        console.error('Error fetching opportunities:', err);
        setError('Failed to retrieve opportunities database records.');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleLoadSampleOpportunities = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      await SampleDataService.loadSampleData(user.uid);
      const data = await OpportunityService.getStoredOpportunities(user.uid);
      setOpportunities(data);
    } catch (err) {
      console.error(err);
      setError('Failed to load sample opportunities.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchOpportunities(false);
    }
  }, [user]);

  const handleTrackAsset = async (opp: Opportunity) => {
    if (!user) return;
    try {
      await WatchlistService.addAsset(user.uid, opp.ticker, opp.exchange);
      
      // Dynamically update the local state to show as tracked without doing a full scan reload
      setOpportunities(prev => 
        prev.map(item => {
          if (item.ticker.toUpperCase() === opp.ticker.toUpperCase() && 
              item.exchange.toUpperCase() === opp.exchange.toUpperCase()) {
            // Append 'watchlist' to tags if not already present
            const updatedTags = item.tags.includes('watchlist') ? item.tags : [...item.tags, 'watchlist' as const];
            return {
              ...item,
              tags: updatedTags
            };
          }
          return item;
        })
      );
    } catch (err) {
      console.error('Failed to track asset in watchlist:', err);
      alert('Unable to update watchlist record.');
    }
  };

  // Filter logic
  const filteredOpportunities = opportunities
    .filter(opp => {
      if (activeFilter === 'all') return true;
      return opp.tags.includes(activeFilter);
    })
    .sort((a, b) => b.confidenceScore - a.confidenceScore);

  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="container" style={{ padding: '2rem 0' }}>
      <div className="opportunities-container">
        
        {/* Header Section */}
        <div className="opportunities-header-section">
          <div className="opportunities-title-area">
            <span className="mono-tag" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Lightbulb size={12} />
              Phase 8 Intelligence Feed
            </span>
            <h1>Opportunity Intelligence</h1>
            <p style={{ marginTop: '0.25rem' }}>
              Deterministic scanning board identifying value discounts, momentum trends, and portfolio structural rebalances.
            </p>
          </div>
          
          <div className="opportunities-actions" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {formattedDate}
            </span>
            <PlatformHealthWidget />
            <button 
              className="refresh-trigger-btn"
              onClick={() => fetchOpportunities(true)}
              disabled={loading || scanning}
            >
              <RefreshCw size={14} className={scanning ? 'spinner' : ''} style={{ animation: scanning ? 'spin 1s linear infinite' : 'none' }} />
              {scanning ? 'Scanning Market...' : 'Scan & Refresh'}
            </button>
          </div>
        </div>

        {/* Filters and Summary Toolbar */}
        <div className="filter-bar">
          <span className="filter-label">Filter Intelligence:</span>
          
          <button 
            className={`filter-pill ${activeFilter === 'all' ? 'active' : ''}`}
            onClick={() => setActiveFilter('all')}
          >
            All Candidates
          </button>
          
          <button 
            className={`filter-pill ${activeFilter === 'value' ? 'active' : ''}`}
            onClick={() => setActiveFilter('value')}
          >
            Value Discounts
          </button>
          
          <button 
            className={`filter-pill ${activeFilter === 'momentum' ? 'active' : ''}`}
            onClick={() => setActiveFilter('momentum')}
          >
            Momentum Trends
          </button>
          
          <button 
            className={`filter-pill ${activeFilter === 'diversification' ? 'active' : ''}`}
            onClick={() => setActiveFilter('diversification')}
          >
            Diversification Gaps
          </button>
          
          <button 
            className={`filter-pill ${activeFilter === 'watchlist' ? 'active' : ''}`}
            onClick={() => setActiveFilter('watchlist')}
          >
            Watchlist Hits
          </button>
        </div>

        {/* Scanning Simulation View */}
        {scanning && (
          <div className="scanner-animation-overlay">
            <div className="scanner-radar-line"></div>
            <RefreshCw size={36} className="spinner" style={{ animation: 'spin 1.5s linear infinite', color: 'var(--color-accent)' }} />
            <h3 style={{ marginTop: '1.5rem', fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}>
              Conducting Market Scans
            </h3>
            <p style={{ maxWidth: '400px', margin: '0.5rem 0', fontSize: '0.85rem' }}>
              The engine is scanning historical price metrics and testing diversification models.
            </p>
            <div className="scanner-text-scroller">
              <span>{scanMessage}</span>
            </div>
            <style>{`
              @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        )}

        {/* Main Content Area */}
        {!scanning && (
          <>
            {error && (
              <div style={{
                border: '1px solid var(--color-danger-border)',
                background: 'var(--color-danger-bg)',
                color: 'var(--color-danger-text)',
                padding: '1rem 1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem'
              }}>
                <AlertCircle size={20} />
                <div style={{ fontSize: '0.85rem' }}>{error}</div>
              </div>
            )}

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '5rem 0', gap: '1rem' }}>
                <div className="spinner" style={{
                  width: 32,
                  height: 32,
                  border: '2px solid rgba(139, 92, 246, 0.2)',
                  borderTop: '2px solid var(--color-primary)',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}></div>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Loading database records...
                </p>
              </div>
            ) : filteredOpportunities.length === 0 ? (
              <div style={{
                background: 'var(--bg-card)',
                border: '1px dashed #E2DACD',
                padding: '4rem 1.5rem',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1rem'
              }}>
                <HelpCircle size={32} style={{ color: 'var(--text-muted)' }} />
                <div>
                  <h3 style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '1.1rem', marginBottom: '0.4rem' }}>
                    No Scanned Opportunities Found
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '420px', margin: '0 auto 1rem auto', lineHeight: 1.4 }}>
                    The opportunity board displays assets trading near annual support lows, momentum breakout targets, or sector-level diversification deficits.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <button 
                    className="btn btn-primary btn-sm"
                    onClick={() => fetchOpportunities(true)}
                  >
                    Run Fresh Market Scan
                  </button>
                  <button 
                    className="btn btn-secondary btn-sm"
                    onClick={handleLoadSampleOpportunities}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                  >
                    <Sparkles size={12} />
                    <span>Load Sample Signals</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="opportunity-grid">
                {filteredOpportunities.map((opp) => {
                  const isWatchlisted = opp.tags.includes('watchlist');
                  // Find primary tag for styling
                  const primaryCategory = opp.tags.find(t => t !== 'watchlist') || 'value';
                  
                  return (
                    <div 
                      key={opp.id} 
                      className={`opportunity-card category-${primaryCategory}`}
                    >
                      {/* Card Header Row */}
                      <div className="card-header-row">
                        <div className="asset-badge-info">
                          <span className="asset-badge-ticker">{opp.ticker}</span>
                          <span className="asset-badge-exchange">{opp.exchange}</span>
                        </div>
                        
                        <div className="asset-confidence-badge">
                          <span className="confidence-number">{opp.confidenceScore}%</span>
                          <span className="confidence-label">Confidence</span>
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className="opportunity-card-body">
                        <h4 className="opp-card-title">{opp.title}</h4>
                        <p className="opp-card-rationale">{opp.rationale}</p>
                        
                        <div className="opp-card-metrics-grid">
                          <div className="opp-metric-row">
                            <span className="opp-metric-label">Signal Rule</span>
                            <span className="opp-metric-value">{opp.supportingMetrics.ruleMatched}</span>
                          </div>
                          
                          <div className="opp-metric-row">
                            <span className="opp-metric-label">Current Price</span>
                            <span className="opp-metric-value">
                              {opp.supportingMetrics.currentPrice.toFixed(2)}
                            </span>
                          </div>

                          <div className="opp-metric-row">
                            <span className="opp-metric-label">Condition Value</span>
                            <span className="opp-metric-value">{opp.supportingMetrics.metricValue}</span>
                          </div>
                        </div>
                      </div>

                      {/* Card Footer Row */}
                      <div className="card-footer-row">
                        <div className="opp-tag-list">
                          {opp.tags.map(tag => (
                            <span key={tag} className={`opp-badge-tag tag-${tag}`}>
                              {tag}
                            </span>
                          ))}
                        </div>

                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button 
                            className="card-action-trigger"
                            onClick={() => setSelectedOpportunity(opp)}
                            style={{ padding: '0.35rem 0.65rem' }}
                          >
                            Details
                          </button>

                          <button 
                            className="card-action-trigger"
                            onClick={() => !isWatchlisted && handleTrackAsset(opp)}
                            disabled={isWatchlisted}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              cursor: isWatchlisted ? 'default' : 'pointer',
                              opacity: isWatchlisted ? 0.75 : 1
                            }}
                          >
                            {isWatchlisted ? (
                              <>
                                <Check size={12} />
                                <span>Tracked</span>
                              </>
                            ) : (
                              <>
                                <Plus size={12} />
                                <span>Track</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

      </div>

      {/* Opportunity Detail View Modal */}
      {selectedOpportunity && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(34, 34, 34, 0.4)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          animation: 'fadeInModal 0.2s ease-out'
        }}>
          <div style={{
            background: 'var(--bg-card)',
            border: '2px solid var(--text-primary)',
            width: '90%',
            maxWidth: '650px',
            padding: '2.5rem',
            boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
            position: 'relative',
            animation: 'slideUpModal 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            textAlign: 'left'
          }}>
            {/* Close button */}
            <button 
              onClick={() => setSelectedOpportunity(null)}
              style={{
                position: 'absolute',
                top: '1.25rem',
                right: '1.25rem',
                background: 'transparent',
                border: 'none',
                fontSize: '1.5rem',
                cursor: 'pointer',
                color: 'var(--text-muted)'
              }}
            >
              &times;
            </button>

            {/* Header */}
            <div style={{ borderBottom: '2px solid var(--text-primary)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <span className="mono-tag" style={{ color: 'var(--color-accent)' }}>Opportunity Detail View</span>
              <h2 style={{ fontSize: '1.75rem', fontFamily: 'var(--font-serif)', margin: '0.25rem 0 0.5rem 0' }}>
                {selectedOpportunity.ticker} — {selectedOpportunity.title}
              </h2>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                EXCHANGE: {selectedOpportunity.exchange.toUpperCase()} • GENERATED: {new Date(selectedOpportunity.generatedTimestamp).toLocaleString()}
              </span>
            </div>

            {/* Content */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <h4 style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
                  Quantitative Signal & Rationale
                </h4>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                  {selectedOpportunity.rationale}
                </p>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: '1rem',
                background: '#FAF8F5',
                border: '1px solid #E2DACD',
                padding: '0.75rem 1rem'
              }}>
                <div>
                  <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-muted)' }}>Confidence Score</span>
                  <strong style={{ fontSize: '1.15rem', color: 'var(--color-accent)', fontFamily: 'var(--font-mono)' }}>
                    {selectedOpportunity.confidenceScore}%
                  </strong>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-muted)' }}>Scan Category</span>
                  <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                    {selectedOpportunity.tags.find(t => t !== 'watchlist') || 'Value'}
                  </strong>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-muted)' }}>Trigger Condition</span>
                  <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    {selectedOpportunity.supportingMetrics.metricValue}
                  </strong>
                </div>
              </div>

              {/* Gemini Editorial commentary section */}
              <div style={{ borderTop: '1px dashed #E2DACD', paddingTop: '1.25rem', marginTop: '0.5rem' }}>
                <h4 style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--color-accent)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Sparkles size={14} />
                  <span>AI Editorial Context Analysis</span>
                </h4>
                
                {profile?.geminiEnabled ? (
                  loadingAi ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      <div className="spinner" style={{ width: 12, height: 12, border: '2px solid rgba(0,0,0,0.1)', borderTopColor: 'var(--color-accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                      <span>Contextualizing scanner data...</span>
                    </div>
                  ) : aiCommentary ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem', lineHeight: 1.45 }}>
                      <p style={{ margin: 0, color: 'var(--text-primary)' }}>
                        <strong>Opportunity Analysis:</strong> {aiCommentary.opportunityCommentary}
                      </p>
                      <p style={{ margin: 0, color: 'var(--text-secondary)', fontStyle: 'italic', borderLeft: '2px solid #E2DACD', paddingLeft: '0.5rem' }}>
                        <strong>Market Alignment:</strong> {aiCommentary.marketContext}
                      </p>
                    </div>
                  ) : (
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>
                      Failed to load editorial context. Falls back to deterministic metrics.
                    </p>
                  )
                ) : (
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>
                    AI Commentary layer is disabled. Turn it on under "Settings" to translate stats into executive editorial contexts.
                  </p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem', borderTop: '1px solid #E2DACD', paddingTop: '1.25rem' }}>
              <button 
                onClick={() => setSelectedOpportunity(null)}
                className="btn"
                style={{ border: '1px solid var(--text-primary)', background: 'transparent', padding: '0.5rem 1.25rem', fontSize: '0.8rem', cursor: 'pointer' }}
              >
                Close Detail Dispatch
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeInModal {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUpModal {
          from { transform: translateY(10px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default Opportunities;
