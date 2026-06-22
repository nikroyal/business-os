import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Lightbulb, 
  RefreshCw, 
  Check, 
  Plus, 
  AlertCircle,
  HelpCircle
} from 'lucide-react';
import { OpportunityService } from '../services/opportunityService';
import { WatchlistService } from '../services/watchlistService';
import type { Opportunity } from '../services/firebase';

export const Opportunities: React.FC = () => {
  const { user } = useAuth();
  
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState('Initializing scan...');
  const [error, setError] = useState<string | null>(null);
  
  // Filtering state
  // Supported filters: 'all', 'momentum', 'value', 'diversification', 'watchlist'
  const [activeFilter, setActiveFilter] = useState<'all' | 'momentum' | 'value' | 'diversification' | 'watchlist'>('all');

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
  const filteredOpportunities = opportunities.filter(opp => {
    if (activeFilter === 'all') return true;
    return opp.tags.includes(activeFilter);
  });

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
              Phase 7 Intelligence Feed
            </span>
            <h1>Opportunity Intelligence</h1>
            <p style={{ marginTop: '0.25rem' }}>
              Deterministic scanning board identifying value discounts, momentum trends, and portfolio structural rebalances.
            </p>
          </div>
          
          <div className="opportunities-actions">
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {formattedDate}
            </span>
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
                padding: '4rem 2rem',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1rem'
              }}>
                <HelpCircle size={32} style={{ color: 'var(--text-muted)' }} />
                <div>
                  <h3 style={{ fontStyle: 'italic', marginBottom: '0.25rem' }}>No Opportunities Found</h3>
                  <p style={{ fontSize: '0.85rem', maxWidth: '350px' }}>
                    Try clicking the "Scan & Refresh" button above to pull active market candles and run scan rule triggers.
                  </p>
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
                  );
                })}
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
};

export default Opportunities;
