import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { ServiceHealthService } from '../services/serviceHealthService';
import type { PlatformHealth } from '../services/serviceHealthService';
import { RefreshCw, CheckCircle, AlertTriangle, XCircle, HelpCircle, Activity } from 'lucide-react';

export const PlatformHealthWidget: React.FC = () => {
  const { user } = useAuth();
  const [health, setHealth] = useState<PlatformHealth | null>(null);
  const [checking, setChecking] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load cached health status on mount
  useEffect(() => {
    const cached = ServiceHealthService.getCachedHealth();
    if (cached) {
      setHealth(cached);
    }
  }, []);

  // Run initial check and set up periodic auto-check
  useEffect(() => {
    if (!user) return;

    const runCheck = async () => {
      setChecking(true);
      try {
        const result = await ServiceHealthService.checkHealth(user.uid);
        setHealth(result);
      } catch (err) {
        console.error('Platform health check failed:', err);
      } finally {
        setChecking(false);
      }
    };

    // Run immediately
    runCheck();

    // Refresh every 60 seconds
    const interval = setInterval(runCheck, 60000);

    return () => clearInterval(interval);
  }, [user]);

  // Click outside to close dropdown handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleManualRefresh = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || checking) return;
    setChecking(true);
    try {
      const result = await ServiceHealthService.checkHealth(user.uid, true);
      setHealth(result);
    } catch (err) {
      console.error('Manual platform health check failed:', err);
    } finally {
      setChecking(false);
    }
  };

  // Determine overall status
  const getOverallStatus = (): { label: string; color: string; indicator: string } => {
    if (!health) return { label: 'CHECKING STATUS...', color: 'var(--text-muted)', indicator: 'gray' };

    const statuses = Object.values(health.services);
    if (statuses.some(s => s.color === 'red')) {
      return { label: 'SERVICE ISSUES DETECTED', color: 'var(--color-danger-text)', indicator: 'red' };
    }
    if (statuses.some(s => s.color === 'orange')) {
      return { label: 'DEGRADED PERFORMANCE', color: 'var(--color-warning-text)', indicator: 'orange' };
    }
    return { label: 'ALL SERVICES OPERATIONAL', color: 'var(--color-success-text)', indicator: 'green' };
  };

  const getStatusColor = (color: string) => {
    switch (color) {
      case 'green': return '#22C55E';
      case 'orange': return '#F97316';
      case 'red': return '#EF4444';
      default: return '#9CA3AF';
    }
  };

  const getStatusIcon = (color: string, size = 14) => {
    switch (color) {
      case 'green': return <CheckCircle size={size} style={{ color: '#22C55E' }} />;
      case 'orange': return <AlertTriangle size={size} style={{ color: '#F97316' }} />;
      case 'red': return <XCircle size={size} style={{ color: '#EF4444' }} />;
      default: return <HelpCircle size={size} style={{ color: '#9CA3AF' }} />;
    }
  };

  const formatTimestamp = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return 'N/A';
    }
  };

  const formatRelativeTime = (isoString: string | null | undefined) => {
    if (!isoString) return 'N/A';
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'just now';
      if (diffMins < 60) return `${diffMins} min ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours} hr ago`;
      return `${Math.floor(diffHours / 24)} days ago`;
    } catch {
      return 'N/A';
    }
  };

  const overall = getOverallStatus();

  return (
    <div style={{ position: 'relative', display: 'inline-block', textAlign: 'left', zIndex: 100 }} ref={dropdownRef}>
      {/* Mini status pill trigger */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.4rem 0.75rem',
          border: '1px solid #222222',
          background: isOpen ? '#FAF8F5' : 'transparent',
          cursor: 'pointer',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.7rem',
          fontWeight: 600,
          letterSpacing: '0.03em',
          transition: 'all 0.15s ease-in-out'
        }}
        className="health-status-trigger"
      >
        <span 
          style={{ 
            display: 'inline-block', 
            width: '8px', 
            height: '8px', 
            borderRadius: '50%', 
            background: getStatusColor(overall.indicator),
            boxShadow: `0 0 8px ${getStatusColor(overall.indicator)}`
          }} 
        />
        <span style={{ color: '#222222' }}>{overall.label}</span>
      </div>

      {/* Popover Dropdown Card */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 0.5rem)',
          right: 0,
          width: '320px',
          background: '#FAF8F5',
          border: '2px solid #222222',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          padding: '1.25rem',
          animation: 'slideUp 0.15s ease-out'
        }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #222222',
            paddingBottom: '0.75rem',
            marginBottom: '0.75rem'
          }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontWeight: 'bold', fontSize: '0.9rem', color: '#222222', textTransform: 'uppercase' }}>
              Platform Services
            </span>
            <button 
              onClick={handleManualRefresh}
              disabled={checking}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: checking ? 'not-allowed' : 'pointer',
                color: '#222222',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                fontSize: '0.65rem',
                fontFamily: 'var(--font-mono)',
                padding: '0.25rem'
              }}
            >
              <RefreshCw size={12} className={checking ? 'spin' : ''} style={{ animation: checking ? 'spin 1s linear infinite' : 'none' }} />
              <span>REFRESH</span>
            </button>
          </div>

          {/* List of Services */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {health && Object.entries(health.services)
              .filter(([key]) => key !== 'dataMoat')
              .map(([key, service]) => (
                <div key={key} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                  <div style={{ marginTop: '2px', display: 'flex' }}>
                    {getStatusIcon(service.color)}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: '#222222' }}>
                        {service.name}
                      </span>
                      <span style={{ 
                        fontSize: '0.6rem', 
                        fontFamily: 'var(--font-mono)', 
                        fontWeight: 'bold', 
                        textTransform: 'uppercase',
                        color: getStatusColor(service.color)
                      }}>
                        {service.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '1px', lineHeight: 1.2 }}>
                      {service.description}
                    </span>

                    {/* Custom details for FRED */}
                    {key === 'fred' && (service as any).metadata && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', marginTop: '2px', fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                        <span style={{ color: '#222222', fontWeight: 500 }}>
                          {(service as any).metadata.latestIndicatorCount ?? 0} indicators cached
                        </span>
                        <span>
                          Updated {formatRelativeTime((service as any).metadata.lastSuccessfulCheck)}
                        </span>
                      </div>
                    )}

                    {/* Custom details for SEC EDGAR */}
                    {key === 'secEdgar' && (service as any).metadata && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', marginTop: '2px', fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                        <span style={{ color: '#222222', fontWeight: 500 }}>
                          {(service as any).metadata.companiesCached ?? 0} companies cached
                        </span>
                        <span style={{ color: '#222222', fontWeight: 500 }}>
                          {(service as any).metadata.filingsCached ?? 0} filings stored
                        </span>
                        <span>
                          Updated {formatRelativeTime((service as any).metadata.lastIngestionRun)}
                        </span>
                      </div>
                    )}

                    {/* Standard verification time for all other services */}
                    {key !== 'fred' && key !== 'secEdgar' && (
                      <span style={{ fontSize: '0.55rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Updated {formatRelativeTime(health.lastChecked)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
          </div>

          {/* Daily Dispatch Stats */}
          {health && (health.lastSuccessDispatch || health.lastFailedDispatch) && (
            <div style={{
              borderTop: '1px dashed #E2DACD',
              paddingTop: '0.6rem',
              marginTop: '0.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.35rem',
              fontSize: '0.65rem',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-secondary)'
            }}>
              {health.lastSuccessDispatch && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, color: '#222222' }}>LAST SUCCESS DISPATCH:</span>
                  <span>{formatTimestamp(health.lastSuccessDispatch)}</span>
                </div>
              )}
              {health.lastFailedDispatch && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, color: 'var(--color-danger-text)' }}>LAST FAILED DISPATCH:</span>
                  <span style={{ color: 'var(--color-danger-text)' }}>{formatTimestamp(health.lastFailedDispatch)}</span>
                </div>
              )}
            </div>
          )}

          {/* Footer Sync Meta */}
          <div style={{
            borderTop: '1px solid #E2DACD',
            paddingTop: '0.6rem',
            marginTop: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.55rem',
            color: 'var(--text-secondary)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
              <Activity size={10} />
              <span>SYNCED:</span>
            </div>
            <span>{health ? formatTimestamp(health.lastChecked) : 'NEVER'}</span>
          </div>
        </div>
      )}

      {/* Embedded Animations and hover CSS */}
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .health-status-trigger:hover {
          background-color: #FAF8F5 !important;
          border-color: var(--color-accent) !important;
        }
      `}</style>
    </div>
  );
};

export default PlatformHealthWidget;
