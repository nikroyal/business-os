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
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1.25rem', background: 'var(--bg-main)' }}>
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes spin { to { transform: rotate(360deg); } }
          .animate-spin-custom { animation: spin 1s linear infinite; }
        `}} />
        <Activity className="animate-spin-custom" size={36} style={{ color: 'var(--color-accent)' }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--color-accent)', fontWeight: 'bold', letterSpacing: '0.1em' }}>
          COMPILING OVERNIGHT DISPATCH...
        </span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: '4rem 2rem', textAlign: 'center', background: 'var(--bg-main)', minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <AlertOctagon size={54} style={{ color: 'var(--color-danger-text)', marginBottom: '1.5rem' }} />
        <h3 style={{ fontSize: '1.75rem', fontFamily: 'var(--font-serif)', margin: '0 0 0.5rem 0' }}>Data Compilation Error</h3>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto 1.5rem auto', fontSize: '0.9rem', lineHeight: '1.5' }}>
          {error || 'Market intelligence state is currently unavailable.'}
        </p>
        <button 
          onClick={fetchIntelligence} 
          style={{
            padding: '0.65rem 1.5rem',
            background: 'var(--color-accent)',
            color: 'white',
            border: 'none',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.8rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'background 0.15s'
          }}
        >
          RETRY QUERY
        </button>
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
    <div className="workspace-page" style={{ animation: 'fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards', textAlign: 'left', background: 'var(--bg-main)' }}>
      {/* Dynamic Keyframes Injection */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes pulse-dot {
          0% { transform: scale(0.95); opacity: 0.5; }
          50% { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(0.95); opacity: 0.5; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .pulse-heartbeat {
          animation: pulse-dot 2s infinite ease-in-out;
        }
        .dispatch-card {
          background: #FFFFFF;
          border: 1px solid #E2DACD;
          box-shadow: 0 4px 15px rgba(140, 130, 120, 0.04);
          transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease, border-color 0.25s ease;
        }
        .dispatch-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(140, 130, 120, 0.1);
          border-color: #CFC5B6;
        }
        .dispatch-feed-item {
          border-bottom: 1px solid #F3ECE0;
          transition: background-color 0.2s ease;
          padding: 1rem;
          margin: 0 -1rem;
        }
        .dispatch-feed-item:hover {
          background-color: #FCFAF6;
        }
        .quadrant-cell {
          padding: 0.85rem;
          border-radius: 6px;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          transition: transform 0.2s ease;
        }
        .quadrant-cell:hover {
          transform: scale(1.01);
        }
        .quadrant-badge {
          font-family: var(--font-mono);
          font-size: 0.68rem;
          font-weight: bold;
          padding: 0.2rem 0.5rem;
          border-radius: 4px;
          transition: transform 0.15s ease;
        }
        .quadrant-badge:hover {
          transform: scale(1.05);
        }
      `}} />

      {/* Header bar */}
      <div className="workspace-header" style={{ 
        borderBottom: '2px solid #222222', 
        paddingBottom: '1.75rem', 
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        flexWrap: 'wrap',
        gap: '1.5rem',
        marginBottom: '2rem'
      }}>
        <div>
          <span className="mono-tag" style={{ color: 'var(--color-accent)', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 'bold' }}>
            <span className="pulse-heartbeat" style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--color-accent)', display: 'inline-block' }}></span>
            OVERNIGHT MARKET DISPATCH & ANOMALIES
          </span>
          <h1 style={{ border: 'none', padding: 0, margin: 0, fontSize: '2.6rem', fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: '#1A1A1A', fontWeight: 'normal' }}>
            What changed overnight that matters?
          </h1>
        </div>
        
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <Calendar size={13} style={{ color: 'var(--color-accent)' }} />
              <span style={{ fontWeight: 'bold', color: '#1A1A1A' }}>{formattedDate.toUpperCase()}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-success-text)' }}>
              <Clock size={12} />
              <span>SYS RUN COMPLETE & VERIFIED</span>
            </div>
          </div>
          <PlatformHealthWidget />
        </div>
      </div>

      <div className="workspace-body" style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: '2.5rem', flexGrow: 1, overflow: 'hidden' }}>
        
        {/* LEFT COLUMN: News Feed, News Brief, Timeline */}
        <div className="scrollable-panel" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingRight: '1rem' }}>
          
          {/* Overnight Feed */}
          <div className="dispatch-card" style={{ padding: '1.75rem', borderRadius: '8px' }}>
            <div style={{ borderBottom: '1px solid #E2DACD', paddingBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.35rem', margin: 0, padding: 0, border: 'none', fontFamily: 'var(--font-serif)', fontWeight: 'bold' }}>
                Overnight Intelligence Feed
              </h2>
              <span className="mono-tag" style={{ background: '#FAF8F5', border: '1px solid #E2DACD', padding: '2px 8px', fontSize: '0.65rem' }}>
                CHRONOLOGICAL MATCH
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {data.overnightFeed.map((event) => {
                const isHigh = event.significance === 'HIGH';
                const isMed = event.significance === 'MEDIUM';
                const badgeColor = isHigh ? 'var(--color-danger-text)' : isMed ? 'var(--color-warning-text)' : 'var(--text-secondary)';
                const badgeBg = isHigh ? 'var(--color-danger-bg)' : isMed ? 'var(--color-warning-bg)' : '#F3ECE0';
                const itemBorder = isHigh ? '3px solid var(--color-danger-border)' : '3px solid transparent';
                return (
                  <div key={event.id} className="dispatch-feed-item" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', borderLeft: itemBorder, paddingLeft: isHigh ? '0.75rem' : '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span className="mono-tag" style={{ color: badgeColor, background: badgeBg, fontSize: '0.62rem', padding: '1px 5px', fontWeight: 'bold' }}>
                          {event.significance}
                        </span>
                        <strong style={{ fontSize: '0.98rem', color: '#1A1A1A', fontFamily: 'var(--font-sans)', fontWeight: 600 }}>
                          {event.title}
                        </strong>
                      </div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p style={{ margin: '0.2rem 0 0.4rem 0', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
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
          <div className="dispatch-card" style={{ padding: '1.75rem', borderRadius: '8px' }}>
            <div style={{ borderBottom: '1px solid #E2DACD', paddingBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <Sparkles size={18} style={{ color: 'var(--color-accent)' }} />
              <h2 style={{ fontSize: '1.35rem', margin: 0, padding: 0, border: 'none', fontFamily: 'var(--font-serif)', fontWeight: 'bold' }}>
                News Intelligence Brief
              </h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ 
                background: 'linear-gradient(135deg, #FCFAF6 0%, #F5F1E8 100%)', 
                borderLeft: '4px solid var(--color-accent)', 
                padding: '1.25rem', 
                fontSize: '0.9rem', 
                lineHeight: 1.6, 
                color: '#1A1A1A',
                fontFamily: 'var(--font-serif)',
                boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.02)'
              }}>
                "{data.newsBrief.macroSummary}"
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', borderTop: '1px solid #EAE5DB', paddingTop: '1rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', fontFamily: 'var(--font-mono)', color: 'var(--color-accent)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Source Citations Index:
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {data.newsBrief.citations.map((cite, idx) => (
                    <a 
                      key={idx} 
                      href={cite.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        fontSize: '0.78rem', 
                        color: 'var(--color-accent)', 
                        textDecoration: 'none',
                        padding: '0.4rem 0.6rem',
                        background: '#FCFAF6',
                        border: '1px solid #EAE5DB',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = '#CFC5B6';
                        e.currentTarget.style.backgroundColor = '#FAF8F5';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = '#EAE5DB';
                        e.currentTarget.style.backgroundColor = '#FCFAF6';
                      }}
                    >
                      <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '75%', fontWeight: '500' }}>
                        [{idx + 1}] {cite.headline}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)', fontSize: '0.7rem', fontFamily: 'var(--font-mono)' }}>
                        {cite.sourceName} <ExternalLink size={10} />
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Regime Transition History */}
          <div className="dispatch-card" style={{ padding: '1.75rem', borderRadius: '8px' }}>
            <div style={{ borderBottom: '1px solid #E2DACD', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.35rem', margin: 0, padding: 0, border: 'none', fontFamily: 'var(--font-serif)', fontWeight: 'bold' }}>
                Market Regime Transition Timeline
              </h2>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Audit trail of regional market status corrections</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', position: 'relative', paddingLeft: '1.25rem' }}>
              <div style={{ position: 'absolute', left: '4px', top: '10px', bottom: '10px', width: '2px', background: '#E2DACD' }} />
              {timeline.map((event) => {
                const isBullShift = event.newRegime.includes('Bull');
                return (
                  <div key={event.id} style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1.2fr 4.8fr', gap: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid #FCFAF6' }}>
                    <div style={{ 
                      position: 'absolute', 
                      left: '-19px', 
                      top: '5px', 
                      width: '12px', 
                      height: '12px', 
                      borderRadius: '50%', 
                      background: isBullShift ? 'var(--color-success-text)' : 'var(--color-warning-text)',
                      border: '2px solid white',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                    }} />
                    <div>
                      <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>
                        {new Date(event.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()}
                      </span>
                      <strong style={{ fontSize: '0.85rem', color: '#1A1A1A', textTransform: 'uppercase', letterSpacing: '0.02em' }}>{event.region}</strong>
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                        <span className="mono-tag" style={{ background: '#F3ECE0', padding: '1px 5px', fontSize: '0.65rem', border: '1px solid #E2DACD' }}>{event.previousRegime}</span>
                        <span style={{ color: 'var(--text-muted)' }}>→</span>
                        <span className="mono-tag" style={{ background: isBullShift ? 'var(--color-success-bg)' : 'var(--color-warning-bg)', color: isBullShift ? 'var(--color-success-text)' : 'var(--color-warning-text)', border: '1px solid ' + (isBullShift ? 'var(--color-success-border)' : 'var(--color-warning-border)'), padding: '1px 5px', fontSize: '0.65rem', fontWeight: 'bold' }}>
                          {event.newRegime}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Confidence: {event.confidence * 100}%</span>
                      </div>
                      <p style={{ margin: 0, padding: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
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
            {/* US Card */}
            <div className="dispatch-card" style={{ padding: '1.25rem 1.5rem', borderRadius: '8px', borderLeft: '4px solid ' + (data.regimes.US.regime.includes('Bull') ? 'var(--color-success-text)' : 'var(--color-warning-text)') }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', letterSpacing: '0.05em', fontWeight: 'bold' }}>US REGIME</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.35rem 0' }}>
                    <span style={{ fontSize: '1.6rem', fontWeight: 'bold', fontFamily: 'var(--font-serif)', color: data.regimes.US.regime.includes('Bull') ? 'var(--color-success-text)' : 'var(--color-danger-text)' }}>
                      {data.regimes.US.regime}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block' }}>
                    S&P 500: <strong>{data.regimes.US.metrics.indexPrice.toFixed(0)}</strong> ({data.regimes.US.metrics.dailyChange >= 0 ? '+' : ''}{data.regimes.US.metrics.dailyChange.toFixed(2)}%)
                  </span>
                </div>
                <ProvenanceBadge 
                  category="Derived Analytics" 
                  source={data.regimes.US.source} 
                  timestamp={data.regimes.US.timestamp} 
                  confidence={data.regimes.US.confidence > 0.8 ? 'High' : 'Medium'} 
                />
              </div>
            </div>

            {/* India Card */}
            <div className="dispatch-card" style={{ padding: '1.25rem 1.5rem', borderRadius: '8px', borderLeft: '4px solid ' + (data.regimes.IN.regime.includes('Bull') ? 'var(--color-success-text)' : 'var(--color-warning-text)') }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', letterSpacing: '0.05em', fontWeight: 'bold' }}>INDIA REGIME</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.35rem 0' }}>
                    <span style={{ fontSize: '1.6rem', fontWeight: 'bold', fontFamily: 'var(--font-serif)', color: data.regimes.IN.regime.includes('Bull') ? 'var(--color-success-text)' : 'var(--color-danger-text)' }}>
                      {data.regimes.IN.regime}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block' }}>
                    Nifty 50: <strong>{data.regimes.IN.metrics.indexPrice.toFixed(0)}</strong> ({data.regimes.IN.metrics.dailyChange >= 0 ? '+' : ''}{data.regimes.IN.metrics.dailyChange.toFixed(2)}%)
                  </span>
                </div>
                <ProvenanceBadge 
                  category="Derived Analytics" 
                  source={data.regimes.IN.source} 
                  timestamp={data.regimes.IN.timestamp} 
                  confidence={data.regimes.IN.confidence > 0.8 ? 'High' : 'Medium'} 
                />
              </div>
            </div>

            {/* Exposure Card */}
            <div className="dispatch-card" style={{ padding: '1.25rem 1.5rem', borderRadius: '8px', borderLeft: '4px solid var(--color-accent)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', letterSpacing: '0.05em', fontWeight: 'bold' }}>PORTFOLIO IMPACT SHIFT</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.35rem 0' }}>
                    <span style={{ fontSize: '1.6rem', fontWeight: 'bold', fontFamily: 'var(--font-serif)', color: '#1A1A1A' }}>
                      {data.portfolioImpact.affectedHoldingsCount} Assets Flagged
                    </span>
                  </div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block' }}>
                    Allocation Risk Shift: <strong style={{ color: data.portfolioImpact.allocationRiskDelta > 0 ? 'var(--color-warning-text)' : 'var(--color-success-text)' }}>{data.portfolioImpact.allocationRiskDelta >= 0 ? '+' : ''}{data.portfolioImpact.allocationRiskDelta.toFixed(1)} pts</strong>
                  </span>
                </div>
                <ProvenanceBadge 
                  category="Derived Analytics" 
                  source="Impact Engine" 
                  timestamp={data.timestamp} 
                  confidence="High" 
                />
              </div>
            </div>
          </div>

          {/* Action Board */}
          <div className="dispatch-card" style={{ padding: '1.75rem', borderRadius: '8px', minHeight: '300px' }}>
            <div style={{ borderBottom: '1px solid #E2DACD', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.35rem', margin: 0, padding: 0, border: 'none', fontFamily: 'var(--font-serif)', fontWeight: 'bold' }}>
                Action Board
              </h2>
            </div>
            
            <div style={{ display: 'flex', gap: '0.35rem', borderBottom: '1px solid #F3ECE0', paddingBottom: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
              {(['All', 'Risk', 'Opportunity', 'Review', 'Watch'] as const).map(tab => {
                const isActive = activeTab === tab;
                return (
                  <button 
                    key={tab} 
                    onClick={() => setActiveTab(tab)} 
                    style={{ 
                      fontSize: '0.72rem', 
                      padding: '0.35rem 0.75rem',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 'bold',
                      border: isActive ? '1px solid var(--color-accent)' : '1px solid #E2DACD',
                      background: isActive ? 'var(--color-accent)' : '#FCFAF6',
                      color: isActive ? '#FFFFFF' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {tab.toUpperCase()}
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {filteredActionItems.map((item) => {
                const borderLeftColor = 
                  item.type === 'Risk' ? 'var(--color-danger-text)' : 
                  item.type === 'Opportunity' ? 'var(--color-success-text)' : 
                  item.type === 'Review' ? '#1e3a8a' : 'var(--color-warning-text)';
                const cardBgColor = 
                  item.type === 'Risk' ? 'var(--color-danger-bg)' : 
                  item.type === 'Opportunity' ? 'var(--color-success-bg)' : 
                  item.type === 'Review' ? '#F0F4F8' : 'var(--color-warning-bg)';
                return (
                  <div key={item.id} style={{ 
                    borderLeft: `4px solid ${borderLeftColor}`, 
                    background: cardBgColor, 
                    padding: '1rem 1.25rem', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '0.4rem',
                    border: '1px solid #E2DACD',
                    borderLeftWidth: '4px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.68rem', fontWeight: 'bold', textTransform: 'uppercase', color: borderLeftColor, fontFamily: 'var(--font-mono)' }}>{item.type}</span>
                      <span className="mono-tag" style={{ fontSize: '0.62rem', border: '1px solid #EAE5DB', padding: '1px 5px', background: '#FFF' }}>{item.significance} PRIORITY</span>
                    </div>
                    <strong style={{ fontSize: '0.9rem', color: '#1A1A1A', fontWeight: '600' }}>{item.title}</strong>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                      {item.description}
                    </p>
                    {item.ticker && (
                      <span style={{ alignSelf: 'start', background: '#FFFFFF', border: '1px solid #EAE5DB', color: 'var(--color-accent)', padding: '2px 6px', fontSize: '0.65rem', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>
                        Asset: {item.ticker}
                      </span>
                    )}
                    <ProvenanceBadge 
                      category="Derived Analytics" 
                      source="Decision Engine" 
                      timestamp={item.timestamp} 
                      confidence={item.significance === 'HIGH' ? 'High' : 'Medium'} 
                      style={{ alignSelf: 'flex-start', marginTop: '0.2rem' }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sector Rotation Matrix */}
          <div className="dispatch-card" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1rem', borderRadius: '8px' }}>
            <div style={{ borderBottom: '1px solid #E2DACD', paddingBottom: '0.75rem', marginBottom: '0.5rem' }}>
              <h2 style={{ fontSize: '1.35rem', margin: 0, padding: 0, border: 'none', fontFamily: 'var(--font-serif)', fontWeight: 'bold' }}>
                Visual Sector Rotation Matrix
              </h2>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Relative Strength (RS) momentum model vs. S&P 500</span>
            </div>

            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr', 
              gridTemplateRows: '1fr 1fr', 
              gap: '0.75rem', 
              background: '#F3ECE0', 
              padding: '0.75rem', 
              minHeight: '260px',
              border: '1px solid #E2DACD'
            }}>
              
              {/* Top Left: Improvers */}
              <div className="quadrant-cell" style={{ background: '#F0F4F8', border: '1.5px solid #3B82F6' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #D0DBEA', paddingBottom: '0.25rem' }}>
                  <strong style={{ color: '#2563EB', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>IMPROVERS (RS +)</strong>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', overflowY: 'auto', maxHeight: '90px' }} className="custom-scrollbar">
                  {sectorsByQuadrant.Improver.map(s => (
                    <span key={s.sectorId} className="quadrant-badge" style={{ background: '#FFFFFF', border: '1px solid #BFDBFE', color: '#1D4ED8' }}>
                      {s.name}
                    </span>
                  ))}
                </div>
              </div>

              {/* Top Right: Leaders */}
              <div className="quadrant-cell" style={{ background: '#EAF6F0', border: '1.5px solid #10B981' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #C6EADB', paddingBottom: '0.25rem' }}>
                  <strong style={{ color: '#059669', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>LEADERS (LEAD +)</strong>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', overflowY: 'auto', maxHeight: '90px' }} className="custom-scrollbar">
                  {sectorsByQuadrant.Leader.map(s => (
                    <span key={s.sectorId} className="quadrant-badge" style={{ background: '#FFFFFF', border: '1px solid #A7F3D0', color: '#047857' }}>
                      {s.name}
                    </span>
                  ))}
                </div>
              </div>

              {/* Bottom Left: Laggards */}
              <div className="quadrant-cell" style={{ background: '#FFF1F2', border: '1.5px solid #F43F5E' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #FDC2C9', paddingBottom: '0.25rem' }}>
                  <strong style={{ color: '#E11D48', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>LAGGARDS (MOM -)</strong>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', overflowY: 'auto', maxHeight: '90px' }} className="custom-scrollbar">
                  {sectorsByQuadrant.Laggard.map(s => (
                    <span key={s.sectorId} className="quadrant-badge" style={{ background: '#FFFFFF', border: '1px solid #FECDD3', color: '#BE123C' }}>
                      {s.name}
                    </span>
                  ))}
                </div>
              </div>

              {/* Bottom Right: Deteriorators */}
              <div className="quadrant-cell" style={{ background: '#FFFBEB', border: '1.5px solid #F59E0B' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #FDE68A', paddingBottom: '0.25rem' }}>
                  <strong style={{ color: '#D97706', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>DETERIORATORS (RS -)</strong>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', overflowY: 'auto', maxHeight: '90px' }} className="custom-scrollbar">
                  {sectorsByQuadrant.Deteriorator.map(s => (
                    <span key={s.sectorId} className="quadrant-badge" style={{ background: '#FFFFFF', border: '1px solid #FDE68A', color: '#B45309' }}>
                      {s.name}
                    </span>
                  ))}
                </div>
              </div>

            </div>
          </div>

          {/* Market Breadth & Macro Factors */}
          <div className="dispatch-card" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1rem', borderRadius: '8px' }}>
            <div style={{ borderBottom: '1px solid #E2DACD', paddingBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <div>
                <h2 style={{ fontSize: '1.35rem', margin: 0, padding: 0, border: 'none', fontFamily: 'var(--font-serif)', fontWeight: 'bold' }}>
                  Market Breadth & Macro Factors
                </h2>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Market participation thresholds and Fed macroeconomic yields</span>
              </div>
              <ProvenanceBadge 
                category="Macro Data" 
                source="FRED Economic System" 
                timestamp={data.timestamp} 
                confidence="High" 
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* US S&P 500 Breadth */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.45rem', fontFamily: 'var(--font-sans)', fontWeight: '500' }}>
                  <span>US S&P 500 Index Breadth</span>
                  <span style={{ color: 'var(--color-warning-text)', fontWeight: 'bold' }}>{data.regimes.US.breadth.participationStatus.toUpperCase()} ({data.regimes.US.breadth.aboveSMA50}%)</span>
                </div>
                <div style={{ width: '100%', height: '10px', background: '#F3ECE0', borderRadius: '5px', overflow: 'hidden', border: '1px solid #E2DACD' }}>
                  <div style={{ width: `${data.regimes.US.breadth.aboveSMA50}%`, height: '100%', background: 'var(--color-warning-text)', borderRadius: '5px' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.35rem', fontFamily: 'var(--font-mono)' }}>
                  <span>SMA50: {data.regimes.US.breadth.aboveSMA50}% above</span>
                  <span>SMA200: {data.regimes.US.breadth.aboveSMA200}% above</span>
                </div>
              </div>

              {/* India Nifty 50 Breadth */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.45rem', fontFamily: 'var(--font-sans)', fontWeight: '500' }}>
                  <span>India Nifty 50 Index Breadth</span>
                  <span style={{ color: 'var(--color-success-text)', fontWeight: 'bold' }}>{data.regimes.IN.breadth.participationStatus.toUpperCase()} ({data.regimes.IN.breadth.aboveSMA50}%)</span>
                </div>
                <div style={{ width: '100%', height: '10px', background: '#F3ECE0', borderRadius: '5px', overflow: 'hidden', border: '1px solid #E2DACD' }}>
                  <div style={{ width: `${data.regimes.IN.breadth.aboveSMA50}%`, height: '100%', background: 'var(--color-success-text)', borderRadius: '5px' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.35rem', fontFamily: 'var(--font-mono)' }}>
                  <span>SMA50: {data.regimes.IN.breadth.aboveSMA50}% above</span>
                  <span>SMA200: {data.regimes.IN.breadth.aboveSMA200}% above</span>
                </div>
              </div>

              {/* Systemic Macro Indicators Grid */}
              <div style={{ borderTop: '1px solid #E2DACD', paddingTop: '1.25rem', marginTop: '0.5rem' }}>
                <strong style={{ fontSize: '0.75rem', display: 'block', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-accent)', fontFamily: 'var(--font-mono)' }}>
                  Systemic Macro Indicators
                </strong>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  {data.macros.map((macro) => {
                    const isNegativeSpread = macro.id === 't10y2y' && typeof macro.value === 'number' && macro.value < 0;
                    const isRisingInflation = (macro.id === 'cpiaucsl' || macro.id === 'cpilfesl') && macro.trendDirection === 'Rising';
                    const valueColor = isNegativeSpread || isRisingInflation ? 'var(--color-danger-text)' : '#1A1A1A';
                    const trendColor = macro.trendDirection === 'Rising' ? '#10B981' : macro.trendDirection === 'Falling' ? '#EF4444' : '#888';
                    const cardBg = isNegativeSpread || isRisingInflation ? 'var(--color-danger-bg)' : '#FCFAF6';

                    return (
                      <div key={macro.id} style={{ background: cardBg, padding: '0.75rem 1rem', borderRadius: '4px', border: '1px solid #E2DACD', transition: 'transform 0.15s ease' }} title={macro.explanation}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', fontWeight: '500' }}>
                          {macro.name}
                        </span>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '0.35rem' }}>
                          <strong style={{ fontSize: '1.05rem', color: valueColor, fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>
                            {macro.value}{macro.unit}
                          </strong>
                          <span style={{ fontSize: '0.75rem', color: trendColor, fontFamily: 'var(--font-mono)' }}>
                            {macro.trendDirection === 'Rising' ? '▲' : macro.trendDirection === 'Falling' ? '▼' : '■'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Breadth Definition Tip */}
              <div style={{ display: 'flex', gap: '0.65rem', background: '#FCFAF6', border: '1px solid #E2DACD', padding: '1rem', fontSize: '0.78rem', lineHeight: 1.5, color: 'var(--text-secondary)', borderRadius: '4px' }}>
                <Info size={16} style={{ color: 'var(--color-accent)', flexShrink: 0, marginTop: '2px' }} />
                <span>
                  <strong>Macro Inversion Check:</strong> Inverted Yield Curve (10Y-2Y &lt; 0) warns of prospective recession. Elevated CPI Inflation (&gt; 3.5%) triggers multiples contraction risks.
                </span>
              </div>
            </div>
          </div>

          {/* "Why This Matters To Me" Engine */}
          <div className="dispatch-card" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', borderRadius: '8px' }}>
            <div style={{ borderBottom: '1px solid #E2DACD', paddingBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Shield size={18} style={{ color: 'var(--color-accent)' }} />
              <h2 style={{ fontSize: '1.35rem', margin: 0, padding: 0, border: 'none', fontFamily: 'var(--font-serif)', fontWeight: 'bold' }}>
                "Why This Matters To Me" Engine
              </h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Impact Metrics Summary */}
              <div style={{ background: '#FCFAF6', border: '1px solid #E2DACD', padding: '1rem 1.25rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', borderRadius: '4px' }}>
                <div>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', display: 'block', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>PORTFOLIO EXPOSURES</span>
                  <strong style={{ fontSize: '1.1rem', color: '#1A1A1A' }}>{data.portfolioImpact.affectedHoldingsCount} of your active assets</strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', display: 'block', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>RISK SCORE ADJUSTMENT</span>
                  <strong style={{ fontSize: '1.1rem', color: data.portfolioImpact.allocationRiskDelta > 0 ? 'var(--color-warning-text)' : 'var(--color-success-text)' }}>
                    {data.portfolioImpact.allocationRiskDelta > 0 ? '+' : ''}{data.portfolioImpact.allocationRiskDelta.toFixed(1)} pts
                  </strong>
                </div>
              </div>

              {/* Implication Bullet Points */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <strong style={{ fontSize: '0.85rem', fontFamily: 'var(--font-sans)', color: '#1A1A1A' }}>Risk Summary & Flagged Alignments:</strong>
                {data.portfolioImpact.riskHighlights.length > 0 ? (
                  <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontFamily: 'var(--font-sans)' }}>
                    {data.portfolioImpact.riskHighlights.map((r, idx) => (
                      <li key={idx} style={{ lineHeight: 1.5 }}>{r}</li>
                    ))}
                  </ul>
                ) : (
                  <span style={{ fontSize: '0.82rem', color: 'var(--color-success-text)', fontWeight: '500' }}>✓ No high-priority risk warnings triggered.</span>
                )}

                <strong style={{ fontSize: '0.85rem', marginTop: '0.5rem', fontFamily: 'var(--font-sans)', color: '#1A1A1A' }}>Upside & Opportunity Alignments:</strong>
                {data.portfolioImpact.opportunityHighlights.length > 0 ? (
                  <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontFamily: 'var(--font-sans)' }}>
                    {data.portfolioImpact.opportunityHighlights.map((o, idx) => (
                      <li key={idx} style={{ lineHeight: 1.5 }}>{o}</li>
                    ))}
                  </ul>
                ) : (
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>No active thematic opportunity spikes generated.</span>
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
