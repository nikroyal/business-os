import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { MarketIntelligenceService } from '../services/marketIntelligenceService';
import type { MarketIntelligenceData, RegimeTimelineEvent } from '../services/marketIntelligenceService';
import { 
  Activity, 
  AlertOctagon, 
  Calendar, 
  Shield, 
  ExternalLink, 
  Sparkles,
  Info,
  Clock
} from 'lucide-react';
import { PlatformHealthWidget } from '../components/PlatformHealthWidget';
import { ProvenanceBadge } from '../components/ProvenanceBadge';

export const Markets: React.FC = () => {
  const { user, isMockMode } = useAuth();
  const [data, setData] = useState<MarketIntelligenceData | null>(null);
  const [timeline, setTimeline] = useState<RegimeTimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'All' | 'Risk' | 'Opportunity' | 'Review' | 'Watch'>('All');

  const fetchIntelligence = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const miData = await MarketIntelligenceService.getMarketIntelligence(user.uid, isMockMode);
      const history = await MarketIntelligenceService.getRegimeHistory(user.uid, isMockMode);
      setData(miData);
      setTimeline(history);
    } catch (err: any) {
      console.error(err);
      setError('Failed to fetch market intelligence data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchIntelligence();
    }
  }, [user, isMockMode]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: '1rem' }}>
        <Activity className="animate-spin" size={32} style={{ color: 'var(--color-primary)' }} />
        <span className="mono-tag">Compiling Overnight Dispatch...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <AlertOctagon size={48} style={{ color: 'var(--color-danger-text)', marginBottom: '1rem' }} />
        <h3>Data Compilation Error</h3>
        <p style={{ color: 'var(--text-secondary)' }}>{error || 'Market intelligence state is currently unavailable.'}</p>
        <button onClick={fetchIntelligence} className="btn btn-primary" style={{ marginTop: '1rem' }}>Retry Query</button>
      </div>
    );
  }

  // Filter Action Items based on Tab
  const filteredActionItems = activeTab === 'All' 
    ? data.actionBoard 
    : data.actionBoard.filter(item => item.type === activeTab);

  // Group Sector positions by Quadrant
  const sectorsByQuadrant = {
    Leader: data.sectors.filter(s => s.quadrant === 'Leader'),
    Improver: data.sectors.filter(s => s.quadrant === 'Improver'),
    Deteriorator: data.sectors.filter(s => s.quadrant === 'Deteriorator'),
    Laggard: data.sectors.filter(s => s.quadrant === 'Laggard')
  };

  const formattedDate = new Date(data.timestamp).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="workspace-page" style={{ animation: 'fadeIn 0.25s ease-out', textAlign: 'left' }}>
      
      {/* Header bar */}
      <div className="workspace-header" style={{ 
        borderBottom: '1px solid #222222', 
        paddingBottom: '1.5rem', 
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <span className="mono-tag" style={{ color: 'var(--color-accent)', marginBottom: '0.25rem', display: 'block' }}>
            OVERNIGHT MARKET DISPATCH & ANOMALIES
          </span>
          <h1 style={{ border: 'none', padding: 0, margin: 0, fontSize: '2.5rem' }}>
            What changed overnight that matters?
          </h1>
        </div>
        
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <Calendar size={14} />
              <span>{formattedDate}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-success-text)' }}>
              <Clock size={12} />
              <span>LATEST SYSTEM RUN COMPLETE</span>
            </div>
          </div>
          <PlatformHealthWidget />
        </div>
      </div>

      <div className="workspace-body" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem', flexGrow: 1, overflow: 'hidden' }}>
        
        {/* LEFT COLUMN: News Feed, News Brief, Timeline */}
        <div className="scrollable-panel" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingRight: '1rem' }}>
          
          {/* Overnight Feed */}
          <div className="card-custom" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.2rem', minHeight: '300px' }}>
            <div style={{ borderBottom: '1px solid #333', paddingBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.25rem', margin: 0, padding: 0, border: 'none' }}>Overnight Intelligence Feed</h2>
              <span className="mono-tag" style={{ background: '#222', padding: '2px 8px' }}>CHRONOLOGICAL MATCH</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {data.overnightFeed.map((event) => {
                const badgeColor = event.significance === 'HIGH' ? 'var(--color-danger-text)' : event.significance === 'MEDIUM' ? 'var(--color-warning-text)' : 'var(--text-secondary)';
                const badgeBg = event.significance === 'HIGH' ? 'var(--color-danger-bg)' : event.significance === 'MEDIUM' ? 'var(--color-warning-bg)' : '#1a1a1a';
                return (
                  <div key={event.id} style={{ borderBottom: '1px solid #1a1a1a', paddingBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className="mono-tag" style={{ color: badgeColor, background: badgeBg, fontSize: '0.65rem' }}>{event.significance}</span>
                        <strong style={{ fontSize: '0.95rem' }}>{event.title}</strong>
                      </div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                        {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      {event.description}
                    </p>
                    <ProvenanceBadge 
                      category="News Intelligence" 
                      source={event.source} 
                      timestamp={event.timestamp} 
                      confidence={event.significance === 'HIGH' ? 'High' : 'Medium'} 
                      style={{ alignSelf: 'flex-start' }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* News Intelligence */}
          <div className="card-custom" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ borderBottom: '1px solid #333', paddingBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sparkles size={18} style={{ color: 'var(--color-primary)' }} />
              <h2 style={{ fontSize: '1.25rem', margin: 0, padding: 0, border: 'none' }}>News Intelligence Brief</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ 
                background: '#121212', 
                borderLeft: '2px solid var(--color-primary)', 
                padding: '0.75rem 1rem', 
                fontSize: '0.8rem', 
                lineHeight: 1.5, 
                color: 'var(--text-primary)',
                textAlign: 'justify'
              }}>
                {data.newsBrief.macroSummary}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px solid #222', paddingTop: '0.75rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>Source Citations Index:</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {data.newsBrief.citations.map((cite, idx) => (
                    <a 
                      key={idx} 
                      href={cite.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        fontSize: '0.7rem', 
                        color: 'var(--color-primary-light)', 
                        textDecoration: 'none' 
                      }}
                      className="hover-link"
                    >
                      <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '75%' }}>
                        [{idx + 1}] {cite.headline}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '2px', color: 'var(--text-secondary)' }}>
                        {cite.sourceName} <ExternalLink size={10} />
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Regime Transition History */}
          <div className="card-custom" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
            <div style={{ borderBottom: '1px solid #333', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.25rem', margin: 0, padding: 0, border: 'none' }}>Market Regime Transition Timeline</h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Audit trail of regional market status corrections</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative', paddingLeft: '1rem' }}>
              <div style={{ position: 'absolute', left: '4px', top: '10px', bottom: '10px', width: '2px', background: '#333' }} />
              {timeline.map((event) => {
                const isBullShift = event.newRegime.includes('Bull');
                return (
                  <div key={event.id} style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1fr 5fr', gap: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid #1a1a1a' }}>
                    <div style={{ position: 'absolute', left: '-16px', top: '4px', width: '10px', height: '10px', borderRadius: '50%', background: isBullShift ? 'var(--color-success-text)' : 'var(--color-warning-text)' }} />
                    <div>
                      <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                        {new Date(event.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                      <strong style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>{event.region}</strong>
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <span className="mono-tag" style={{ background: '#222' }}>{event.previousRegime}</span>
                        <span>→</span>
                        <span className="mono-tag" style={{ background: isBullShift ? 'var(--color-success-bg)' : 'var(--color-warning-bg)', color: isBullShift ? 'var(--color-success-text)' : 'var(--color-warning-text)' }}>
                          {event.newRegime}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Confidence: {event.confidence * 100}%</span>
                      </div>
                      <p style={{ margin: 0, padding: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                        {event.triggerEvent}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Macro Dashboard, Action Board, Rotation, breadths */}
        <div className="scrollable-panel" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Overview Stat Widgets */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="metric-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <span className="metric-label">US MARKET REGIME</span>
                <div className="metric-value-container" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.5rem 0' }}>
                  <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: data.regimes.US.regime.includes('Bull') ? 'var(--color-success-text)' : data.regimes.US.regime.includes('Bear') ? 'var(--color-danger-text)' : 'var(--text-primary)' }}>
                    {data.regimes.US.regime}
                  </span>
                </div>
                <span className="metric-subtext">S&P 500: {data.regimes.US.metrics.indexPrice.toFixed(0)} ({data.regimes.US.metrics.dailyChange >= 0 ? '+' : ''}{data.regimes.US.metrics.dailyChange.toFixed(2)}%)</span>
              </div>
              <ProvenanceBadge 
                category="Derived Analytics" 
                source={data.regimes.US.source} 
                timestamp={data.regimes.US.timestamp} 
                confidence={data.regimes.US.confidence > 0.8 ? 'High' : 'Medium'} 
                style={{ marginTop: '0.75rem', alignSelf: 'flex-start' }}
              />
            </div>
            
            <div className="metric-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <span className="metric-label">INDIA MARKET REGIME</span>
                <div className="metric-value-container" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.5rem 0' }}>
                  <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: data.regimes.IN.regime.includes('Bull') ? 'var(--color-success-text)' : data.regimes.IN.regime.includes('Bear') ? 'var(--color-danger-text)' : 'var(--text-primary)' }}>
                    {data.regimes.IN.regime}
                  </span>
                </div>
                <span className="metric-subtext">Nifty 50: {data.regimes.IN.metrics.indexPrice.toFixed(0)} ({data.regimes.IN.metrics.dailyChange >= 0 ? '+' : ''}{data.regimes.IN.metrics.dailyChange.toFixed(2)}%)</span>
              </div>
              <ProvenanceBadge 
                category="Derived Analytics" 
                source={data.regimes.IN.source} 
                timestamp={data.regimes.IN.timestamp} 
                confidence={data.regimes.IN.confidence > 0.8 ? 'High' : 'Medium'} 
                style={{ marginTop: '0.75rem', alignSelf: 'flex-start' }}
              />
            </div>

            <div className="metric-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <span className="metric-label">PORTFOLIO EXPOSURE DELTA</span>
                <div className="metric-value-container" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.5rem 0' }}>
                  <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: data.portfolioImpact.allocationRiskDelta > 0 ? 'var(--color-warning-text)' : 'var(--color-success-text)' }}>
                    {data.portfolioImpact.affectedHoldingsCount} Assets Impacted
                  </span>
                </div>
                <span className="metric-subtext">Allocation Risk Shift: {data.portfolioImpact.allocationRiskDelta >= 0 ? '+' : ''}{data.portfolioImpact.allocationRiskDelta.toFixed(1)} pts</span>
              </div>
              <ProvenanceBadge 
                category="Derived Analytics" 
                source="Portfolio Impact Engine" 
                timestamp={data.timestamp} 
                confidence="High" 
                style={{ marginTop: '0.75rem', alignSelf: 'flex-start' }}
              />
            </div>
          </div>

          {/* Action Board */}
          <div className="card-custom" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.2rem', minHeight: '300px' }}>
            <div style={{ borderBottom: '1px solid #333', paddingBottom: '0.75rem' }}>
              <h2 style={{ fontSize: '1.25rem', margin: 0, padding: 0, border: 'none' }}>Action Board</h2>
            </div>
            
            <div style={{ display: 'flex', gap: '0.25rem', borderBottom: '1px solid #222', paddingBottom: '0.5rem', flexWrap: 'wrap' }}>
              {(['All', 'Risk', 'Opportunity', 'Review', 'Watch'] as const).map(tab => (
                <button 
                  key={tab} 
                  onClick={() => setActiveTab(tab)} 
                  className={`btn btn-sm ${activeTab === tab ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.7rem', padding: '0.25rem 0.5rem' }}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {filteredActionItems.map((item) => {
                const borderLeftColor = 
                  item.type === 'Risk' ? '#ea4335' : 
                  item.type === 'Opportunity' ? '#34a853' : 
                  item.type === 'Review' ? '#4285f4' : '#fbbc05';
                return (
                  <div key={item.id} style={{ 
                    borderLeft: `3px solid ${borderLeftColor}`, 
                    background: '#111', 
                    padding: '0.75rem 1rem', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '0.4rem' 
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase', color: borderLeftColor }}>{item.type}</span>
                      <span className="mono-tag" style={{ fontSize: '0.65rem' }}>{item.significance} PRIORITY</span>
                    </div>
                    <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{item.title}</strong>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      {item.description}
                    </p>
                    {item.ticker && (
                      <span style={{ alignSelf: 'start', background: '#222', padding: '1px 5px', fontSize: '0.65rem', fontFamily: 'var(--font-mono)' }}>
                        Asset: {item.ticker}
                      </span>
                    )}
                    <ProvenanceBadge 
                      category="Derived Analytics" 
                      source="Decision Engine" 
                      timestamp={item.timestamp} 
                      confidence={item.significance === 'HIGH' ? 'High' : 'Medium'} 
                      style={{ alignSelf: 'flex-start' }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sector Rotation Matrix */}
          <div className="card-custom" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ borderBottom: '1px solid #333', paddingBottom: '0.75rem' }}>
              <h2 style={{ fontSize: '1.25rem', margin: 0, padding: 0, border: 'none' }}>Visual Sector Rotation Matrix</h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Based on Relative Strength (RS) vs. S&P 500 Index</span>
            </div>

            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr', 
              gridTemplateRows: '1fr 1fr', 
              gap: '0.5rem', 
              background: '#222', 
              padding: '0.5rem', 
              borderRadius: '4px',
              minHeight: '220px'
            }}>
              
              {/* Top Left: Improvers */}
              <div style={{ background: '#141722', border: '1px solid #4285f4', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #222', paddingBottom: '0.25rem', marginBottom: '0.25rem' }}>
                  <strong style={{ color: '#4285f4', fontSize: '0.75rem' }}>IMPROVERS</strong>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', overflowY: 'auto', maxHeight: '80px' }}>
                  {sectorsByQuadrant.Improver.map(s => (
                    <span key={s.sectorId} className="badge-active" style={{ background: '#1c2236', border: '1px solid #2b395e', color: '#82b1ff', fontSize: '0.65rem', padding: '1px 4px' }}>
                      {s.name}
                    </span>
                  ))}
                </div>
              </div>

              {/* Top Right: Leaders */}
              <div style={{ background: '#121e17', border: '1px solid #34a853', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #222', paddingBottom: '0.25rem', marginBottom: '0.25rem' }}>
                  <strong style={{ color: '#34a853', fontSize: '0.75rem' }}>LEADERS</strong>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', overflowY: 'auto', maxHeight: '80px' }}>
                  {sectorsByQuadrant.Leader.map(s => (
                    <span key={s.sectorId} className="badge-active" style={{ background: '#1a2e20', border: '1px solid #2a4c33', color: '#81c784', fontSize: '0.65rem', padding: '1px 4px' }}>
                      {s.name}
                    </span>
                  ))}
                </div>
              </div>

              {/* Bottom Left: Laggards */}
              <div style={{ background: '#241416', border: '1px solid #ea4335', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #222', paddingBottom: '0.25rem', marginBottom: '0.25rem' }}>
                  <strong style={{ color: '#ea4335', fontSize: '0.75rem' }}>LAGGARDS</strong>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', overflowY: 'auto', maxHeight: '80px' }}>
                  {sectorsByQuadrant.Laggard.map(s => (
                    <span key={s.sectorId} className="badge-active" style={{ background: '#3b1c1e', border: '1px solid #632a2c', color: '#e57373', fontSize: '0.65rem', padding: '1px 4px' }}>
                      {s.name}
                    </span>
                  ))}
                </div>
              </div>

              {/* Bottom Right: Deteriorators */}
              <div style={{ background: '#241a12', border: '1px solid #fbbc05', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #222', paddingBottom: '0.25rem', marginBottom: '0.25rem' }}>
                  <strong style={{ color: '#fbbc05', fontSize: '0.75rem' }}>DETERIORATORS</strong>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', overflowY: 'auto', maxHeight: '80px' }}>
                  {sectorsByQuadrant.Deteriorator.map(s => (
                    <span key={s.sectorId} className="badge-active" style={{ background: '#362816', border: '1px solid #5a4220', color: '#ffd54f', fontSize: '0.65rem', padding: '1px 4px' }}>
                      {s.name}
                    </span>
                  ))}
                </div>
              </div>

            </div>
          </div>

          {/* Market Breadth & Macro Factors */}
          <div className="card-custom" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ borderBottom: '1px solid #333', paddingBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', margin: 0, padding: 0, border: 'none' }}>Market Breadth & Macro Factors</h2>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Market participation thresholds and Fed macroeconomic yields</span>
              </div>
              <ProvenanceBadge 
                category="Macro Data" 
                source="FRED Economics Feed" 
                timestamp={data.timestamp} 
                confidence="High" 
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* US S&P 500 Breadth */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.4rem' }}>
                  <span><strong>US S&P 500 Index Breadth</strong></span>
                  <span style={{ color: 'var(--color-warning-text)' }}>{data.regimes.US.breadth.participationStatus} ({data.regimes.US.breadth.aboveSMA50}%)</span>
                </div>
                <div style={{ width: '100%', height: '8px', background: '#222', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${data.regimes.US.breadth.aboveSMA50}%`, height: '100%', background: 'var(--color-warning-text)', borderRadius: '4px' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                  <span>SMA50: {data.regimes.US.breadth.aboveSMA50}% above</span>
                  <span>SMA200: {data.regimes.US.breadth.aboveSMA200}% above</span>
                </div>
              </div>

              {/* India Nifty 50 Breadth */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.4rem' }}>
                  <span><strong>India Nifty 50 Index Breadth</strong></span>
                  <span style={{ color: 'var(--color-success-text)' }}>{data.regimes.IN.breadth.participationStatus} ({data.regimes.IN.breadth.aboveSMA50}%)</span>
                </div>
                <div style={{ width: '100%', height: '8px', background: '#222', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${data.regimes.IN.breadth.aboveSMA50}%`, height: '100%', background: 'var(--color-success-text)', borderRadius: '4px' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                  <span>SMA50: {data.regimes.IN.breadth.aboveSMA50}% above</span>
                  <span>SMA200: {data.regimes.IN.breadth.aboveSMA200}% above</span>
                </div>
              </div>

              {/* Systemic Macro Indicators Grid */}
              <div style={{ borderTop: '1px solid #222', paddingTop: '1rem', marginTop: '0.5rem' }}>
                <strong style={{ fontSize: '0.8rem', display: 'block', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-primary)' }}>
                  Systemic Macro Indicators
                </strong>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  {data.macros.map((macro) => {
                    const isNegativeSpread = macro.id === 't10y2y' && typeof macro.value === 'number' && macro.value < 0;
                    const isRisingInflation = (macro.id === 'cpiaucsl' || macro.id === 'cpilfesl') && macro.trendDirection === 'Rising';
                    const valueColor = isNegativeSpread || isRisingInflation ? 'var(--color-danger-text, #ea4335)' : 'var(--text-primary)';
                    const trendColor = macro.trendDirection === 'Rising' ? '#34a853' : macro.trendDirection === 'Falling' ? '#ea4335' : '#888';

                    return (
                      <div key={macro.id} style={{ background: '#111', padding: '0.5rem 0.75rem', borderRadius: '2px', border: '1px solid #1c1c1c' }} title={macro.explanation}>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {macro.name}
                        </span>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '0.25rem' }}>
                          <strong style={{ fontSize: '0.9rem', color: valueColor, fontFamily: 'var(--font-mono)' }}>
                            {macro.value}{macro.unit}
                          </strong>
                          <span style={{ fontSize: '0.65rem', color: trendColor, fontFamily: 'var(--font-mono)' }}>
                            {macro.trendDirection === 'Rising' ? '▲' : macro.trendDirection === 'Falling' ? '▼' : '■'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Breadth Definition Tip */}
              <div style={{ display: 'flex', gap: '0.5rem', background: '#111', padding: '0.75rem', fontSize: '0.75rem', lineHeight: 1.4, color: 'var(--text-secondary)' }}>
                <Info size={16} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                <span>
                  <strong>Macro Inversion Check:</strong> Inverted Yield Curve (10Y-2Y &lt; 0) warns of prospective recession. Elevated CPI Inflation (&gt; 3.5%) triggers multiples contraction risks.
                </span>
              </div>
            </div>
          </div>

          {/* "Why This Matters To Me" Engine */}
          <div className="card-custom" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ borderBottom: '1px solid #333', paddingBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Shield size={18} style={{ color: 'var(--color-accent)' }} />
              <h2 style={{ fontSize: '1.25rem', margin: 0, padding: 0, border: 'none' }}>"Why This Matters To Me" Engine</h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Impact Metrics Summary */}
              <div style={{ background: '#111', padding: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block' }}>PORTFOLIO EXPOSURES</span>
                  <strong style={{ fontSize: '1.05rem' }}>{data.portfolioImpact.affectedHoldingsCount} of your active assets</strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block' }}>RISK SCORE ADJUSTMENT</span>
                  <strong style={{ fontSize: '1.05rem', color: data.portfolioImpact.allocationRiskDelta > 0 ? 'var(--color-warning-text)' : 'var(--color-success-text)' }}>
                    {data.portfolioImpact.allocationRiskDelta > 0 ? '+' : ''}{data.portfolioImpact.allocationRiskDelta.toFixed(1)} pts
                  </strong>
                </div>
              </div>

              {/* Implication Bullet Points */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <strong style={{ fontSize: '0.85rem' }}>Risk Summary & Flagged Alignments:</strong>
                {data.portfolioImpact.riskHighlights.length > 0 ? (
                  <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {data.portfolioImpact.riskHighlights.map((r, idx) => (
                      <li key={idx} style={{ lineHeight: 1.4 }}>{r}</li>
                    ))}
                  </ul>
                ) : (
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-success-text)' }}>✓ No high-priority risk warnings triggered.</span>
                )}

                <strong style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>Upside & Opportunity Alignments:</strong>
                {data.portfolioImpact.opportunityHighlights.length > 0 ? (
                  <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {data.portfolioImpact.opportunityHighlights.map((o, idx) => (
                      <li key={idx} style={{ lineHeight: 1.4 }}>{o}</li>
                    ))}
                  </ul>
                ) : (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>No active thematic opportunity spikes generated.</span>
                )}
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};

export default Markets;
