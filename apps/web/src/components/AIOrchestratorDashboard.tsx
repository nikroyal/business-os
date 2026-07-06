import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { aiOrchestratorService } from '../services/aiOrchestratorService';
import type { 
  OrchestratorStats, 
  TelemetryRecord, 
  OrchestratorConfig 
} from '../services/aiOrchestratorService';
import { FallbackPriorityEditor } from './FallbackPriorityEditor';
import { MetricTooltip, SourceBadge } from './ai-ops/MetricTooltip';
import { GlobalFilterBar, DEFAULT_FILTERS, filterTelemetryRecords } from './ai-ops/GlobalFilterBar';
import type { OpsFilterState } from './ai-ops/GlobalFilterBar';
import { AIRequestInspectorModal } from './ai-ops/AIRequestInspectorModal';
import { 
  Cpu, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw, 
  Trash2,
  Save,
  User,
  Briefcase,
  Layers,
  Download,
  AlertTriangle,
  Zap,
  Eye
} from 'lucide-react';

export const AIOrchestratorDashboard: React.FC = () => {
  const { profile } = useAuth();
  const isOwner = profile?.role === 'OWNER';

  const [activeSubTab, setActiveSubTab] = useState<'Overview' | 'Registry' | 'Comparison' | 'Usage' | 'Diagnostics' | 'Timeline' | 'Controls'>('Overview');
  const [stats, setStats] = useState<OrchestratorStats | null>(null);
  const [timeline, setTimeline] = useState<TelemetryRecord[]>([]);
  const [config, setConfig] = useState<OrchestratorConfig>({ forcedModel: null, modelOverrides: {}, maintenanceMode: false, retentionDays: 30 });
  const [filters, setFilters] = useState<OpsFilterState>(DEFAULT_FILTERS);
  const [selectedRequest, setSelectedRequest] = useState<TelemetryRecord | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [testingHealth, setTestingHealth] = useState<string | null>(null);
  const [error, setError] = useState<{ status: string; message: string } | null>(null);

  const filteredTimeline = React.useMemo(() => filterTelemetryRecords(timeline, filters), [timeline, filters]);

  const isFilterActive = filters.timeRange !== '30d' || filters.provider !== 'all' || filters.model !== 'all' || filters.user !== 'all' || filters.workspace !== 'all' || filters.feature !== 'all' || filters.status !== 'all' || filters.searchQuery !== '';

  const activeStats = React.useMemo(() => {
    if (!stats) return null;
    if (!isFilterActive) return stats;

    const featCost: Record<string, number> = {};
    const wsCost: Record<string, number> = {};
    const usrCost: Record<string, number> = {};
    let promptTokens = 0;
    let completionTokens = 0;
    let cachedCount = 0;
    let totalCost = 0;
    let costSavings = 0;
    let totalFailovers = 0;
    let totalRetries = 0;
    let totalLatency = 0;

    filteredTimeline.forEach(rec => {
      promptTokens += rec.promptTokens || 0;
      completionTokens += rec.completionTokens || 0;
      totalCost += rec.estimatedCost || 0;
      totalRetries += rec.retryCount || 0;
      totalLatency += rec.latency || 0;
      if (rec.cachedResponse) {
        cachedCount++;
        costSavings += (rec.estimatedCost || 0.001);
      }
      if (rec.fallbackModel && rec.fallbackModel !== rec.selectedModel) {
        totalFailovers++;
      }
      if (rec.feature) featCost[rec.feature] = (featCost[rec.feature] || 0) + (rec.estimatedCost || 0);
      if (rec.workspace) wsCost[rec.workspace] = (wsCost[rec.workspace] || 0) + (rec.estimatedCost || 0);
      if (rec.user) usrCost[rec.user] = (usrCost[rec.user] || 0) + (rec.estimatedCost || 0);
    });

    const reqCount = filteredTimeline.length;
    const cacheHitRate = reqCount > 0 ? Math.round((cachedCount / reqCount) * 100) : 0;
    const avgLatency = reqCount > 0 ? Math.round(totalLatency / reqCount) : 0;

    return {
      ...stats,
      overview: {
        ...stats.overview,
        requestsToday: reqCount,
        tokensToday: promptTokens + completionTokens,
        promptTokensToday: promptTokens,
        completionTokensToday: completionTokens,
        cachedResponses: cachedCount,
        cacheHitRate,
        estimatedCostSavings: costSavings,
        estimatedDailyCost: totalCost,
        totalFailovers,
        totalRetries,
        averageLatencyMs: avgLatency
      },
      breakdowns: {
        ...stats.breakdowns,
        featureCost: featCost,
        workspaceCost: wsCost,
        userCost: usrCost
      }
    };
  }, [stats, filteredTimeline, isFilterActive]);

  const loadData = async (showRefresher = false) => {
    if (showRefresher) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const [statsData, timelineData, configData] = await Promise.all([
        aiOrchestratorService.getStats(),
        aiOrchestratorService.getTimeline(),
        aiOrchestratorService.getConfig()
      ]);
      setStats(statsData);
      setTimeline(timelineData);
      setConfig(configData || { forcedModel: null, modelOverrides: {}, maintenanceMode: false, retentionDays: 30 });
    } catch (e: any) {
      console.error('Failed to load AI Orchestrator data:', e);
      let status = "HTTP 500 Internal Error";
      let msg = e.message || String(e);
      if (msg.includes("HTTP ")) {
        const parts = msg.split("HTTP ");
        if (parts[1]) {
          status = "HTTP " + parts[1].trim();
        }
      } else if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
        status = "Network Error (CORS Blocked)";
      }
      setError({ status, message: msg });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => loadData(true), 10000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleModel = (modelId: string, enabled: boolean) => {
    if (!isOwner) return;
    const modelOverrides = { ...config.modelOverrides };
    modelOverrides[modelId] = {
      ...modelOverrides[modelId],
      enabled
    };
    setConfig({ ...config, modelOverrides });
  };

  const handlePriorityChange = (modelId: string, priority: number) => {
    if (!isOwner) return;
    const modelOverrides = { ...config.modelOverrides };
    modelOverrides[modelId] = {
      ...modelOverrides[modelId],
      priority
    };
    setConfig({ ...config, modelOverrides });
  };

  const handleForceModelChange = (forcedModel: string | null) => {
    if (!isOwner) return;
    setConfig({ ...config, forcedModel });
  };

  const handleSaveConfig = async () => {
    if (!isOwner) return;
    setSaving(true);
    try {
      const ok = await aiOrchestratorService.saveConfig(config);
      if (ok) {
        alert('AI Orchestrator configuration saved successfully.');
        loadData(true);
      } else {
        alert('Failed to save config.');
      }
    } catch (e: any) {
      alert(`Save error: ${e.message || e}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEditorConfig = async (newConfig: OrchestratorConfig): Promise<boolean> => {
    if (!isOwner) return false;
    try {
      const ok = await aiOrchestratorService.saveConfig(newConfig);
      if (ok) {
        setConfig(newConfig);
        loadData(true);
      }
      return ok;
    } catch (e: any) {
      console.error('Save editor config error:', e);
      throw e;
    }
  };

  // Health tests triggers
  const handleHealthTest = async (type: 'provider' | 'model', targetId: string) => {
    setTestingHealth(targetId);
    try {
      const result = await aiOrchestratorService.triggerHealthTest(type, targetId);
      alert(`Health Test Result for ${targetId}:\nStatus: ${result.success ? '🟢 SUCCESS' : '🔴 FAILED'}\nLatency: ${result.latency}ms\nMessage: ${result.message}`);
      loadData(true);
    } catch (err: any) {
      alert(`Test execution exception: ${err.message || err}`);
    } finally {
      setTestingHealth(null);
    }
  };

  // Cooldown flushing
  const handleFlushCooldowns = async () => {
    if (!confirm('Are you sure you want to flush all active persistent cooldown states? Models will return to their default healthy status.')) return;
    try {
      const ok = await aiOrchestratorService.flushCooldowns();
      if (ok) {
        alert('All model cooldowns flushed successfully.');
        loadData(true);
      }
    } catch (e: any) {
      alert(`Flush error: ${e.message || e}`);
    }
  };

  // Telemetry clear
  const handleClearTelemetry = async () => {
    if (!confirm('CRITICAL: Are you sure you want to purge all telemetry logs? This will erase usage history.')) return;
    try {
      const ok = await aiOrchestratorService.clearTelemetry();
      if (ok) {
        alert('Telemetry logs cleared successfully.');
        loadData(true);
      }
    } catch (e: any) {
      alert(`Clear telemetry error: ${e.message || e}`);
    }
  };

  // CSV Exporter
  const handleExportCsv = async () => {
    try {
      const csvContent = await aiOrchestratorService.exportTelemetryCsv();
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `ai_telemetry_export_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e: any) {
      alert(`CSV Export failed: ${e.message || e}`);
    }
  };

  if (error) {
    return (
      <div className="card" style={{ padding: '2rem', border: '1px solid var(--color-danger-border)', background: 'var(--color-danger-bg)', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', textAlign: 'center', margin: '2rem 0', boxShadow: 'var(--shadow-subtle)' }}>
        <strong style={{ color: 'var(--color-danger-text)', fontSize: '1.2rem', fontFamily: 'var(--font-serif)' }}>API Connection Error</strong>
        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
          Unable to load AI Operations data.
        </p>
        <div style={{ background: '#fff', border: '1px solid #E2DACD', padding: '1rem', width: '100%', maxWidth: '450px', fontSize: '0.8rem', textAlign: 'left', fontFamily: 'var(--font-mono)' }}>
          <div><strong>Endpoint:</strong> /api/admin/ai-orchestrator/stats</div>
          <div><strong>Status:</strong> {error.status}</div>
          <div style={{ marginTop: '0.5rem', color: 'var(--text-secondary)' }}><strong>Error Message:</strong> {error.message}</div>
        </div>
        <button onClick={() => loadData()} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', background: '#FCFAF6', border: '1px solid #C4B9A7' }}>
          <RefreshCw size={14} /> Retry Connection
        </button>
      </div>
    );
  }

  if (loading && !stats) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center', color: '#888', fontFamily: 'var(--font-mono)' }}>
        <RefreshCw size={24} className="spin-animation" style={{ marginBottom: '1rem' }} />
        <div>Connecting to AI Orchestrator nodes...</div>
      </div>
    );
  }

  const overview = activeStats?.overview;
  const provider = activeStats?.provider;
  const models = activeStats?.models || [];
  const activeForced = models.find(m => m.isForced);
  const primaryModel = activeForced ? activeForced : models.find(m => m.enabled && m.cooldownRemaining === 0);
  const fallbackChain = models.filter(m => m.enabled && m.id !== primaryModel?.id);

  const handleDrillDown = (field: keyof OpsFilterState, value: string) => {
    setFilters({ ...filters, [field]: value });
    setActiveSubTab('Timeline');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', color: 'var(--text-primary)' }}>
      
      {/* Maintenance Mode Banner */}
      {config.maintenanceMode && (
        <div style={{
          backgroundColor: 'var(--color-danger-bg)',
          border: '1px solid var(--color-danger-border)',
          color: 'var(--color-danger-text)',
          fontSize: '0.8rem',
          padding: '0.75rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontFamily: 'var(--font-mono)'
        }}>
          <AlertTriangle size={16} />
          <span><b>MAINTENANCE MODE ACTIVE:</b> AI Orchestrator is offline. Client requests will be rejected.</span>
        </div>
      )}

      {/* Telemetry Failure Alert Banner */}
      {stats?.telemetryAlert && (
        <div style={{
          backgroundColor: 'var(--color-danger-bg)',
          border: '1px solid var(--color-danger-border)',
          color: 'var(--color-danger-text)',
          fontSize: '0.8rem',
          padding: '1rem 1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          fontFamily: 'var(--font-sans)',
          borderRadius: '4px',
          boxShadow: 'var(--shadow-subtle)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
            <AlertCircle style={{ color: 'var(--color-danger-text)' }} />
            <span>CRITICAL OPERATIONS ALERT: Telemetry Pipeline Failure Detected</span>
          </div>
          <div style={{ paddingLeft: '1.5rem', fontSize: '0.75rem', lineHeight: '1.4' }}>
            <div><strong>Observed Error:</strong> {stats.telemetryAlert.message}</div>
            <div style={{ marginTop: '0.25rem' }}><strong>Missing Metric:</strong> {stats.telemetryAlert.missingMetric || 'N/A'}</div>
            <div><strong>Suspected Failure Point:</strong> {stats.telemetryAlert.suspectedFailurePoint || 'N/A'}</div>
            <div style={{ marginTop: '0.25rem', color: 'var(--color-danger-text)', fontWeight: 500 }}>
              <strong>Recommended Action:</strong> {stats.telemetryAlert.recommendedAction || 'N/A'}
            </div>
          </div>
        </div>
      )}

      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E2DACD', paddingBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Cpu style={{ color: 'var(--color-accent)' }} />
          <h2 style={{ fontSize: '1.1rem', fontWeight: 'bold', textTransform: 'uppercase', margin: 0, letterSpacing: '0.05em', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}>AI Operations Center</h2>
          <span style={{ fontSize: '0.65rem', background: 'var(--color-success-bg)', border: '1px solid var(--color-success-border)', color: 'var(--color-success-text)', padding: '1px 6px', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>Orchestrator Active</span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            onClick={() => loadData(true)} 
            disabled={refreshing}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', height: '28px' }}
          >
            <RefreshCw size={12} className={refreshing ? 'spin-animation' : ''} /> Refresh
          </button>
          {isOwner && (
            <button 
              onClick={handleSaveConfig} 
              disabled={saving}
              className="btn btn-primary btn-sm"
              style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', height: '28px' }}
            >
              <Save size={12} /> {saving ? 'Saving...' : 'Commit Settings'}
            </button>
          )}
        </div>
      </div>

      {/* Sub tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', borderBottom: '1px solid #E2DACD', paddingBottom: '0', overflowX: 'auto' }}>
        {(['Overview', 'Registry', 'Comparison', 'Usage', 'Diagnostics', 'Timeline', 'Controls'] as const).map(tab => {
          if (tab === 'Controls' && !isOwner) return null;
          const isTabActive = activeSubTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveSubTab(tab)}
              style={{
                padding: '0.5rem 0.75rem',
                fontSize: '0.75rem',
                fontFamily: 'var(--font-sans)',
                fontWeight: isTabActive ? 'bold' : 500,
                background: isTabActive ? '#FAF8F5' : 'transparent',
                border: '1px solid transparent',
                borderBottom: 'none',
                borderColor: isTabActive ? '#E2DACD' : 'transparent',
                color: isTabActive ? 'var(--color-accent)' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease-in-out',
                whiteSpace: 'nowrap'
              }}
            >
              {tab === 'Controls' ? '🔧 Developer Controls' : tab}
            </button>
          );
        })}
      </div>

      <GlobalFilterBar
        filters={filters}
        onFilterChange={setFilters}
        timeline={timeline}
        filteredCount={filteredTimeline.length}
        totalCount={timeline.length}
        availableModels={models.map(m => ({ id: m.id, displayName: m.displayName }))}
      />

      {/* Subtab Content: Overview */}
      {activeSubTab === 'Overview' && overview && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Diagnostic overview status grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            
            {/* Provider Health vs Model Health */}
            {provider && (
              <div className="card" style={{ background: '#fff', border: '1px solid #E2DACD', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', boxShadow: 'var(--shadow-subtle)' }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem', fontFamily: 'var(--font-mono)' }}>Provider Node Health</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '1.15rem', fontWeight: 600, color: provider.health === 'operational' ? 'var(--color-success-text)' : 'var(--color-danger-text)' }}>
                  {provider.health === 'operational' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  {provider.displayName}
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Success Rate: {provider.successRate}% | Latency: {provider.averageLatencyMs}ms</div>
                {isOwner && (
                  <button
                    onClick={() => handleHealthTest('provider', provider.id)}
                    disabled={testingHealth !== null}
                    style={{ fontSize: '0.65rem', background: '#FCFAF6', color: 'var(--text-secondary)', border: '1px solid #C4B9A7', padding: '2px 8px', marginTop: '0.5rem', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}
                  >
                    {testingHealth === provider.id ? 'Testing...' : 'Test Connection'}
                  </button>
                )}
              </div>
            )}

            <div className="card" style={{ background: '#fff', border: '1px solid #E2DACD', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', boxShadow: 'var(--shadow-subtle)' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem', fontFamily: 'var(--font-mono)' }}>Overall AI Health</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '1.15rem', fontWeight: 600, color: overview?.overallHealth === 'healthy' ? 'var(--color-success-text)' : 'var(--color-warning-text)' }}>
                {overview?.overallHealth === 'healthy' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                {overview?.overallHealth === 'healthy' ? 'HEALTHY' : 'DEGRADED'}
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Success Rate: {overview?.overallSuccessRate || 0}% | Failovers: {overview?.totalFailovers || 0}</div>
            </div>

            <div className="card" style={{ background: '#fff', border: '1px solid #E2DACD', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', boxShadow: 'var(--shadow-subtle)' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem', fontFamily: 'var(--font-mono)' }}>Volume & Latency</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-primary)' }}>{overview?.averageLatencyMs || 0} ms</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Requests Today: {overview?.requestsToday || 0} | Monthly: {overview?.requestsThisMonth || 0}</div>
            </div>

            <div className="card" style={{ background: '#fff', border: '1px solid #E2DACD', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', boxShadow: 'var(--shadow-subtle)' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem', fontFamily: 'var(--font-mono)' }}>Operational Cost Today</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--color-success-text)' }}>${(overview?.estimatedDailyCost || 0).toFixed(4)}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Monthly Projection: ${(overview?.estimatedMonthlyCost || 0).toFixed(2)}</div>
            </div>

            <div className="card" style={{ background: '#fff', border: '1px solid #E2DACD', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', boxShadow: 'var(--shadow-subtle)' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem', fontFamily: 'var(--font-mono)' }}>Cache Performance</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--color-warning-text)' }}>{overview?.cacheHitRate || 0}%</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Hit Rate | {overview?.cachedResponses || 0} cached | Saved ${(overview?.estimatedCostSavings || 0).toFixed(4)}</div>
            </div>
          </div>

          {/* Fallback chain visualizer */}
          <div className="card" style={{ background: '#fff', border: '1px solid #E2DACD', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', boxShadow: 'var(--shadow-subtle)' }}>
            <h3 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)', textTransform: 'uppercase', fontFamily: 'var(--font-serif)', fontWeight: 'normal' }}>Active Fallback Chain</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
              {primaryModel ? (
                <div style={{
                  background: 'var(--color-success-bg)',
                  border: '1px solid var(--color-success-border)',
                  padding: '0.5rem 0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <span style={{ fontSize: '0.6rem', background: 'var(--color-success-text)', color: '#fff', fontWeight: 'bold', padding: '2px 4px', textTransform: 'uppercase' }}>Primary</span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--color-success-text)' }}>{primaryModel.displayName}</span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>({primaryModel.id})</span>
                </div>
              ) : (
                <div style={{ color: 'var(--color-danger-text)', fontSize: '0.8rem' }}>No healthy primary model selected!</div>
              )}

              {fallbackChain.map((m, idx) => (
                <React.Fragment key={m.id}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>&rarr;</div>
                  <div style={{
                    background: m.cooldownRemaining > 0 ? 'var(--color-danger-bg)' : 'var(--color-warning-bg)',
                    border: m.cooldownRemaining > 0 ? '1px solid var(--color-danger-border)' : '1px solid var(--color-warning-border)',
                    padding: '0.5rem 0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    opacity: m.cooldownRemaining > 0 ? 0.6 : 1
                  }}>
                    <span style={{
                      fontSize: '0.6rem',
                      background: m.cooldownRemaining > 0 ? 'var(--color-danger-text)' : 'var(--color-warning-text)',
                      color: '#fff',
                      fontWeight: 'bold',
                      padding: '2px 4px',
                      textTransform: 'uppercase'
                    }}>
                      {m.cooldownRemaining > 0 ? 'Cooldown' : `Fallback ${idx + 1}`}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: m.cooldownRemaining > 0 ? 'var(--color-danger-text)' : 'var(--color-warning-text)' }}>{m.displayName}</span>
                    {m.cooldownRemaining > 0 && (
                      <span style={{ fontSize: '0.65rem', color: 'var(--color-danger-text)', fontFamily: 'var(--font-mono)' }}>({Math.ceil(m.cooldownRemaining / 1000)}s remaining)</span>
                    )}
                  </div>
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Quota estimation widget */}
          {(activeStats?.quota || overview) && (() => {
            const qStats = activeStats?.quota || {
              requestsPerMinute: Math.round((overview?.requestsToday || 0) / Math.max(1, (new Date().getHours() * 60 + new Date().getMinutes()))),
              tokensPerMinute: Math.round((overview?.tokensToday || 0) / Math.max(1, (new Date().getHours() * 60 + new Date().getMinutes()))),
              estimatedRemainingDailyRequests: Math.max(0, (overview?.dailyQuotaLimit || 1500) - (overview?.requestsToday || 0)),
              quotaUtilisationPercentage: Math.min(100, Math.round(((overview?.requestsToday || 0) / (overview?.dailyQuotaLimit || 1500)) * 100)),
              source: 'businessos_estimate' as const
            };
            return (
              <div className="card" style={{ background: '#fff', border: '1px solid #E2DACD', padding: '1.25rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', boxShadow: 'var(--shadow-subtle)' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <h3 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)', textTransform: 'uppercase', fontFamily: 'var(--font-serif)', fontWeight: 'normal' }}>Estimated Quota Limits</h3>
                    <SourceBadge source="estimated" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-secondary)' }}><MetricTooltip metricKey="RPD">Daily Requests (RPD):</MetricTooltip></span>
                      <strong style={{ color: 'var(--text-primary)' }}>{overview?.requestsToday || 0} / {overview?.dailyQuotaLimit?.toLocaleString() || '1,500'}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-secondary)' }}><MetricTooltip metricKey="RPM">RPM Average:</MetricTooltip></span>
                      <strong style={{ color: 'var(--text-primary)' }}>{qStats.requestsPerMinute} reqs / min</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-secondary)' }}><MetricTooltip metricKey="TPM">Tokens Ingested Today:</MetricTooltip></span>
                      <strong style={{ color: 'var(--text-primary)' }}>{(overview?.tokensToday || 0).toLocaleString()} tokens</strong>
                    </div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--color-warning-text)', fontStyle: 'italic', marginTop: '0.25rem' }}>
                      ⚠️ Note: Displayed values are BusinessOS estimates derived from recorded telemetry, not provider-reported limits.
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', borderLeft: '1px solid #E2DACD', paddingLeft: '1.5rem' }}>
                  <div style={{ position: 'relative', width: '90px', height: '90px', display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: '50%', background: 'conic-gradient(var(--color-accent) ' + qStats.quotaUtilisationPercentage + '%, #E2DACD 0)' }}>
                    <div style={{ position: 'absolute', width: '74px', height: '74px', borderRadius: '50%', background: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                      <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{qStats.quotaUtilisationPercentage}%</span>
                      <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Utilized</span>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem', fontFamily: 'var(--font-sans)' }}>{qStats.estimatedRemainingDailyRequests} requests estimated remaining</div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Subtab Content: Registry */}
      {activeSubTab === 'Registry' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <FallbackPriorityEditor
            models={models}
            config={config}
            isOwner={isOwner}
            onSaveConfig={handleSaveEditorConfig}
            onUpdateConfig={setConfig}
          />

          {isOwner && (
            <div className="card" style={{ background: '#fff', border: '1px solid #E2DACD', padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: 'var(--shadow-subtle)' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)', fontFamily: 'var(--font-serif)', fontWeight: 'normal' }}>Force Preferred Model Override</h4>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>If enabled, all client prompt queries will bypass failover logic and target this selected model.</p>
              </div>
              <select
                value={config.forcedModel || ''}
                onChange={e => handleForceModelChange(e.target.value === '' ? null : e.target.value)}
                style={{
                  background: '#FCFAF6',
                  color: 'var(--text-primary)',
                  border: '1px solid #C4B9A7',
                  padding: '0.35rem 0.6rem',
                  fontSize: '0.75rem',
                  outline: 'none'
                }}
              >
                <option value="">No Override (Use Priority Fallback Chain)</option>
                {models.map(m => (
                  <option key={m.id} value={m.id}>{m.displayName} ({m.id})</option>
                ))}
              </select>
            </div>
          )}

          <div className="card" style={{ background: '#fff', border: '1px solid #E2DACD', padding: '1.5rem', overflowX: 'auto', boxShadow: 'var(--shadow-subtle)' }}>
            <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', color: 'var(--text-primary)', fontFamily: 'var(--font-serif)', fontWeight: 'bold' }}>
              Complete AI Model Registry & Operational Metrics
            </h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--color-primary)', color: 'var(--text-secondary)', fontWeight: 'bold' }}>
                  <th style={{ padding: '0.5rem 0.25rem' }}>Model Details</th>
                  <th style={{ padding: '0.5rem 0.25rem', textAlign: 'center' }} title="Current runtime priority in chain">Priority</th>
                  <th style={{ padding: '0.5rem 0.25rem', textAlign: 'center' }}>Provider</th>
                  <th style={{ padding: '0.5rem 0.25rem', textAlign: 'center' }} title="Input Context Window and Maximum Output Tokens">Context / Max Out</th>
                  <th style={{ padding: '0.5rem 0.25rem', textAlign: 'center' }} title="Supported Model Capabilities">Capabilities</th>
                  <th style={{ padding: '0.5rem 0.25rem', textAlign: 'center' }} title="Estimated Cost per 1 Million Input/Output Tokens">Pricing ($/1M)</th>
                  <th style={{ padding: '0.5rem 0.25rem', textAlign: 'center' }} title="Capability / Reasoning / Speed Scores">C / R / S Scores</th>
                  <th style={{ padding: '0.5rem 0.25rem', textAlign: 'center' }}>Status</th>
                  <th style={{ padding: '0.5rem 0.25rem', textAlign: 'center' }}>Success / Failure Rate</th>
                  <th style={{ padding: '0.5rem 0.25rem', textAlign: 'right' }}>Cooldown</th>
                  <th style={{ padding: '0.5rem 0.25rem', textAlign: 'center' }}>Health Test</th>
                  {isOwner && <th style={{ padding: '0.5rem 0.25rem', textAlign: 'center' }}>Controls</th>}
                </tr>
              </thead>
              <tbody>
                {models.map(model => {
                  const mConfig = config.modelOverrides?.[model.id] || {};
                  const isModelEnabled = mConfig.enabled !== undefined ? mConfig.enabled : (model.enabled !== undefined ? model.enabled : true);
                  const currentPriority = mConfig.priority !== undefined ? mConfig.priority : model.priority;

                  return (
                    <tr key={model.id} style={{ borderBottom: '1px solid #E2DACD', opacity: isModelEnabled ? 1 : 0.5 }}>
                      <td style={{ padding: '0.6rem 0.25rem' }}>
                        <div style={{ fontWeight: 'bold', color: model.cooldownRemaining > 0 ? 'var(--color-danger-text)' : 'var(--text-primary)' }}>
                          {model.displayName}
                          {model.status === 'preview' && (
                            <span style={{ fontSize: '0.55rem', background: '#a855f722', border: '1px solid #a855f744', color: '#a855f7', padding: '1px 3px', marginLeft: '4px', textTransform: 'uppercase' }}>Preview</span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{model.id}</div>
                      </td>
                      <td style={{ padding: '0.6rem 0.25rem', textAlign: 'center' }}>
                        {isOwner ? (
                          <input
                            type="number"
                            min="1"
                            max="20"
                            value={currentPriority}
                            onChange={e => handlePriorityChange(model.id, parseInt(e.target.value) || 1)}
                            style={{
                              background: '#FCFAF6',
                              border: '1px solid #C4B9A7',
                              color: 'var(--text-primary)',
                              width: '45px',
                              padding: '2px',
                              textAlign: 'center',
                              fontSize: '0.75rem'
                            }}
                          />
                        ) : (
                          <span>{currentPriority}</span>
                        )}
                      </td>
                      <td style={{ padding: '0.6rem 0.25rem', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                        <span style={{ fontSize: '0.65rem', border: '1px solid #C4B9A7', background: '#FCFAF6', padding: '1px 6px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{model.provider}</span>
                      </td>
                      <td style={{ padding: '0.6rem 0.25rem', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>
                        <div style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{(model.contextWindow || 1048576) >= 1000000 ? `${((model.contextWindow || 1048576)/1000000).toFixed(1).replace('.0', '')}M` : `${((model.contextWindow || 1048576)/1000).toFixed(0)}K`}</div>
                        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Max: {((model.maxOutput || 8192)/1000).toFixed(0)}K</div>
                      </td>
                      <td style={{ padding: '0.6rem 0.25rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', justifyContent: 'center', maxWidth: '140px', margin: '0 auto' }}>
                          {model.supportsGrounding && <span title="Supports Grounding with Google Search" style={{ fontSize: '0.55rem', background: '#e0f2fe', color: '#0369a1', padding: '1px 4px', borderRadius: '3px', border: '1px solid #bae6fd' }}>Ground</span>}
                          {model.supportsVision && <span title="Supports Vision / Image Input" style={{ fontSize: '0.55rem', background: '#f0fdf4', color: '#15803d', padding: '1px 4px', borderRadius: '3px', border: '1px solid #bbf7d0' }}>Vision</span>}
                          {model.supportsAudio && <span title="Supports Audio Input" style={{ fontSize: '0.55rem', background: '#fef3c7', color: '#b45309', padding: '1px 4px', borderRadius: '3px', border: '1px solid #fde68a' }}>Audio</span>}
                          {model.supportsVideo && <span title="Supports Video Input" style={{ fontSize: '0.55rem', background: '#f3e8ff', color: '#6b21a8', padding: '1px 4px', borderRadius: '3px', border: '1px solid #e9d5ff' }}>Video</span>}
                          {model.supportsTools && <span title="Supports Tools / Function Calling" style={{ fontSize: '0.55rem', background: '#fce7f3', color: '#be185d', padding: '1px 4px', borderRadius: '3px', border: '1px solid #fbcfe8' }}>Tools</span>}
                        </div>
                      </td>
                      <td style={{ padding: '0.6rem 0.25rem', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>
                        <div style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>${(model.inputCostPer1M !== undefined ? model.inputCostPer1M : 0.075).toFixed(3)}</div>
                        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Out: ${(model.outputCostPer1M !== undefined ? model.outputCostPer1M : 0.30).toFixed(2)}</div>
                      </td>
                      <td style={{ padding: '0.6rem 0.25rem', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                        <span style={{ color: '#06b6d4' }}>{model.capabilityScore}</span>
                        <span style={{ color: 'var(--text-muted)' }}>/</span>
                        <span style={{ color: '#a855f7' }}>{model.reasoningScore}</span>
                        <span style={{ color: 'var(--text-muted)' }}>/</span>
                        <span style={{ color: 'var(--color-success-text)' }}>{model.speedScore}</span>
                      </td>
                      <td style={{ padding: '0.6rem 0.25rem', textAlign: 'center' }}>
                        <span style={{
                          color: !isModelEnabled ? 'var(--text-muted)' : model.cooldownRemaining > 0 ? 'var(--color-danger-text)' : 'var(--color-success-text)',
                          fontWeight: 'bold',
                          fontSize: '0.65rem'
                        }}>
                          {!isModelEnabled ? 'DISABLED' : model.cooldownRemaining > 0 ? 'COOLDOWN' : 'HEALTHY'}
                        </span>
                      </td>
                      <td style={{ padding: '0.6rem 0.25rem', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                        <div>{(model.stats?.successRate || 0)}% S / {(model.stats?.failure || 0) > 0 ? `${model.stats?.failure} F` : '0 F'}</div>
                        <div style={{ fontSize: '0.55rem', color: 'var(--text-secondary)' }}>Avg Latency: {(model.stats?.avgLatencyMs || 0)}ms</div>
                        {model.stats?.lastSuccess && (
                          <div style={{ fontSize: '0.5rem', color: 'var(--color-success-text)', marginTop: '2px' }} title={`Last success: ${model.stats.lastSuccess}`}>
                            ✓ {new Date(model.stats.lastSuccess).toLocaleTimeString()}
                          </div>
                        )}
                        {model.stats?.lastFailure && (
                          <div style={{ fontSize: '0.5rem', color: 'var(--color-danger-text)', marginTop: '1px' }} title={model.stats.lastFailureReason || 'Unknown error'}>
                            ✗ {new Date(model.stats.lastFailure).toLocaleTimeString()}
                            {model.stats?.lastFailureReason && (
                              <span style={{ marginLeft: '2px', color: 'var(--color-danger-text)', opacity: 0.7 }}>({model.stats.lastFailureReason})</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '0.6rem 0.25rem', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                        {model.cooldownRemaining > 0 ? (
                          <span style={{ color: 'var(--color-danger-text)', fontWeight: 'bold' }}>{Math.ceil(model.cooldownRemaining / 1000)}s</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>0s</span>
                        )}
                      </td>
                      <td style={{ padding: '0.6rem 0.25rem', textAlign: 'center' }}>
                        <button
                          onClick={() => handleHealthTest('model', model.id)}
                          disabled={testingHealth !== null}
                          style={{
                            background: '#FCFAF6',
                            border: '1px solid #C4B9A7',
                            color: 'var(--text-secondary)',
                            padding: '2px 8px',
                            cursor: 'pointer',
                            fontSize: '0.65rem'
                          }}
                        >
                          {testingHealth === model.id ? 'Testing...' : 'Test Run'}
                        </button>
                      </td>
                      {isOwner && (
                        <td style={{ padding: '0.6rem 0.25rem', textAlign: 'center' }}>
                          <button
                            onClick={() => handleToggleModel(model.id, !isModelEnabled)}
                            style={{
                              background: isModelEnabled ? 'var(--color-danger-bg)' : 'var(--color-success-bg)',
                              border: isModelEnabled ? '1px solid var(--color-danger-border)' : '1px solid var(--color-success-border)',
                              color: isModelEnabled ? 'var(--color-danger-text)' : 'var(--color-success-text)',
                              padding: '2px 8px',
                              cursor: 'pointer',
                              fontSize: '0.65rem',
                              fontWeight: 'bold',
                              width: '68px'
                            }}
                          >
                            {isModelEnabled ? 'Disable' : 'Enable'}
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Subtab Content: Usage Analytics */}
      {activeSubTab === 'Usage' && stats && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Summary stats row: token split + cache metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            <div className="card" style={{ background: '#fff', border: '1px solid #E2DACD', padding: '1rem', boxShadow: 'var(--shadow-subtle)' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem', fontFamily: 'var(--font-mono)' }}>Prompt Tokens Today</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--color-accent)', fontFamily: 'var(--font-mono)' }}>{(overview?.promptTokensToday || 0).toLocaleString()}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>Input to AI models</div>
              <div style={{ borderTop: '1px solid #E2DACD', marginTop: '0.5rem', paddingTop: '0.4rem', fontSize: '0.55rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div><strong>Source:</strong> Provider (Gemini usageMetadata)</div>
                <div><strong>Updated:</strong> Just now (10s poll)</div>
                <div><strong>Confidence:</strong> {stats?.providerComparison?.google?.promptTokens ? '100% (Authoritative)' : '95% (Estimated)'}</div>
              </div>
            </div>
            <div className="card" style={{ background: '#fff', border: '1px solid #E2DACD', padding: '1rem', boxShadow: 'var(--shadow-subtle)' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem', fontFamily: 'var(--font-mono)' }}>Completion Tokens Today</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#a855f7', fontFamily: 'var(--font-mono)' }}>{(overview?.completionTokensToday || 0).toLocaleString()}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>Output from AI models</div>
              <div style={{ borderTop: '1px solid #E2DACD', marginTop: '0.5rem', paddingTop: '0.4rem', fontSize: '0.55rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div><strong>Source:</strong> Provider (Gemini usageMetadata)</div>
                <div><strong>Updated:</strong> Just now (10s poll)</div>
                <div><strong>Confidence:</strong> {stats?.providerComparison?.google?.completionTokens ? '100% (Authoritative)' : '95% (Estimated)'}</div>
              </div>
            </div>
            <div className="card" style={{ background: '#fff', border: '1px solid #E2DACD', padding: '1rem', boxShadow: 'var(--shadow-subtle)' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem', fontFamily: 'var(--font-mono)' }}>Cached Responses Today</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--color-warning-text)', fontFamily: 'var(--font-mono)' }}>{overview?.cachedResponses || 0}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>Cache hit rate: {overview?.cacheHitRate || 0}%</div>
              <div style={{ borderTop: '1px solid #E2DACD', marginTop: '0.5rem', paddingTop: '0.4rem', fontSize: '0.55rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div><strong>Source:</strong> Cached (Semantic Cache)</div>
                <div><strong>Updated:</strong> Just now (10s poll)</div>
                <div><strong>Confidence:</strong> 100%</div>
              </div>
            </div>
            <div className="card" style={{ background: '#fff', border: '1px solid #E2DACD', padding: '1rem', boxShadow: 'var(--shadow-subtle)' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem', fontFamily: 'var(--font-mono)' }}>Est. Cost Savings (Cache)</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--color-success-text)', fontFamily: 'var(--font-mono)' }}>${(overview?.estimatedCostSavings || 0).toFixed(4)}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>Avoided via cached responses</div>
              <div style={{ borderTop: '1px solid #E2DACD', marginTop: '0.5rem', paddingTop: '0.4rem', fontSize: '0.55rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div><strong>Source:</strong> Derived (BusinessOS Pricing)</div>
                <div><strong>Updated:</strong> Just now (10s poll)</div>
                <div><strong>Confidence:</strong> 100%</div>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.25rem' }}>
            <div className="card" style={{ background: '#fff', border: '1px solid #E2DACD', padding: '1.25rem', boxShadow: 'var(--shadow-subtle)' }}>
              <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: 'var(--text-primary)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.25rem', fontFamily: 'var(--font-serif)', fontWeight: 'normal' }}>
                <Layers size={14} style={{ color: 'var(--color-accent)' }} /> Cost by Feature
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {(() => {
                  const total = Object.values(stats?.breakdowns?.featureCost || {}).reduce((a, b) => a + (b || 0), 0);
                  return Object.entries(stats?.breakdowns?.featureCost || {}).map(([feat, cost]) => {
                    const pct = total > 0 ? ((cost / total) * 100).toFixed(1) : '0';
                    return (
                      <div 
                        key={feat} 
                        onClick={() => handleDrillDown('feature', feat)}
                        title="Click to drill down into timeline logs for this feature"
                        style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.75rem', borderBottom: '1px solid #E2DACD', paddingBottom: '0.35rem', cursor: 'pointer', transition: 'background 0.15s' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{feat}</span>
                          <span style={{ fontFamily: 'var(--font-mono)' }}>
                            <strong style={{ color: 'var(--color-success-text)' }}>${(cost || 0).toFixed(5)}</strong>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem', marginLeft: '6px' }}>({pct}%)</span>
                          </span>
                        </div>
                        <div style={{ width: '100%', background: '#FAF8F5', height: '5px', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, background: 'var(--color-accent)', height: '100%' }} />
                        </div>
                      </div>
                    );
                  });
                })()}
                {Object.keys(stats?.breakdowns?.featureCost || {}).length === 0 && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '1rem' }}>No operational usage logs recorded yet.</div>
                )}
              </div>
            </div>

            <div className="card" style={{ background: '#fff', border: '1px solid #E2DACD', padding: '1.25rem', boxShadow: 'var(--shadow-subtle)' }}>
              <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: 'var(--text-primary)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.25rem', fontFamily: 'var(--font-serif)', fontWeight: 'normal' }}>
                <Briefcase size={14} style={{ color: '#a855f7' }} /> Cost by Workspace
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {(() => {
                  const total = Object.values(stats?.breakdowns?.workspaceCost || {}).reduce((a, b) => a + (b || 0), 0);
                  return Object.entries(stats?.breakdowns?.workspaceCost || {}).map(([ws, cost]) => {
                    const pct = total > 0 ? ((cost / total) * 100).toFixed(1) : '0';
                    return (
                      <div 
                        key={ws} 
                        onClick={() => handleDrillDown('workspace', ws)}
                        title="Click to drill down into timeline logs for this workspace"
                        style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.75rem', borderBottom: '1px solid #E2DACD', paddingBottom: '0.35rem', cursor: 'pointer', transition: 'background 0.15s' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)', fontWeight: 500, wordBreak: 'break-all' }}>{ws}</span>
                          <span style={{ fontFamily: 'var(--font-mono)' }}>
                            <strong style={{ color: 'var(--color-success-text)' }}>${(cost || 0).toFixed(5)}</strong>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem', marginLeft: '6px' }}>({pct}%)</span>
                          </span>
                        </div>
                        <div style={{ width: '100%', background: '#FAF8F5', height: '5px', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, background: '#a855f7', height: '100%' }} />
                        </div>
                      </div>
                    );
                  });
                })()}
                {Object.keys(stats?.breakdowns?.workspaceCost || {}).length === 0 && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '1rem' }}>No operational usage logs recorded yet.</div>
                )}
              </div>
            </div>

            <div className="card" style={{ background: '#fff', border: '1px solid #E2DACD', padding: '1.25rem', boxShadow: 'var(--shadow-subtle)' }}>
              <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: 'var(--text-primary)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.25rem', fontFamily: 'var(--font-serif)', fontWeight: 'normal' }}>
                <User size={14} style={{ color: 'var(--color-warning-text)' }} /> Cost Leaderboard (Top Users)
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {(() => {
                  const entries = Object.entries(stats?.breakdowns?.userCost || {}).sort((a, b) => (b[1] || 0) - (a[1] || 0));
                  const total = entries.reduce((a, b) => a + (b[1] || 0), 0);
                  return entries.slice(0, 10).map(([usr, cost], idx) => {
                    const pct = total > 0 ? ((cost / total) * 100).toFixed(1) : '0';
                    return (
                      <div 
                        key={usr} 
                        onClick={() => handleDrillDown('user', usr)}
                        title="Click to drill down into timeline logs for this user"
                        style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.75rem', borderBottom: '1px solid #E2DACD', paddingBottom: '0.35rem', cursor: 'pointer', transition: 'background 0.15s' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)', fontWeight: 500, wordBreak: 'break-all' }}>
                            <strong style={{ color: 'var(--text-primary)', marginRight: '4px' }}>#{idx + 1}</strong>
                            {(usr || '').substring(0, 16)}{(usr || '').length > 16 && '...'}
                          </span>
                          <span style={{ fontFamily: 'var(--font-mono)' }}>
                            <strong style={{ color: 'var(--color-success-text)' }}>${(cost || 0).toFixed(5)}</strong>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem', marginLeft: '6px' }}>({pct}%)</span>
                          </span>
                        </div>
                        <div style={{ width: '100%', background: '#FAF8F5', height: '5px', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, background: 'var(--color-warning-text)', height: '100%' }} />
                        </div>
                      </div>
                    );
                  });
                })()}
                {Object.keys(stats?.breakdowns?.userCost || {}).length === 0 && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '1rem' }}>No operational usage logs recorded yet.</div>
                )}
              </div>
            </div>
          </div>

          {/* Fallback Trigger Tracking Card */}
          <div className="card" style={{ background: '#fff', border: '1px solid #E2DACD', padding: '1.25rem', boxShadow: 'var(--shadow-subtle)' }}>
            <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: 'var(--text-primary)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.35rem', fontFamily: 'var(--font-serif)', fontWeight: 'normal' }}>
              <AlertTriangle size={15} style={{ color: 'var(--color-warning-text)' }} /> Fallback Trigger Analysis & Health Degradation
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ background: '#FAF8F5', padding: '0.85rem', borderLeft: '3px solid var(--color-warning-border)' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', fontFamily: 'var(--font-mono)' }}>Total Failovers Triggered</span>
                <strong style={{ fontSize: '1.25rem', color: 'var(--color-warning-text)' }}>{overview?.totalFailovers || 0} events</strong>
              </div>
              <div style={{ background: '#FAF8F5', padding: '0.85rem', borderLeft: '3px solid var(--color-danger-border)' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', fontFamily: 'var(--font-mono)' }}>Total API Retries</span>
                <strong style={{ fontSize: '1.25rem', color: 'var(--color-danger-text)' }}>{overview?.totalRetries || 0} retries</strong>
              </div>
              <div style={{ background: '#FAF8F5', padding: '0.85rem', borderLeft: '3px solid var(--color-success-border)' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', fontFamily: 'var(--font-mono)' }}>Primary Route Reliability</span>
                <strong style={{ fontSize: '1.25rem', color: 'var(--color-success-text)' }}>
                  {overview?.requestsToday ? Math.max(0, Math.round((1 - (overview?.totalFailovers || 0) / overview?.requestsToday) * 100)) : 100}%
                </strong>
              </div>
            </div>
            
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              <strong style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-primary)', textTransform: 'uppercase', fontSize: '0.7rem', fontFamily: 'var(--font-mono)' }}>Recent Fallback Activity Log:</strong>
              {timeline && timeline.filter(t => t.selectedModel !== t.fallbackModel && t.fallbackModel).length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '160px', overflowY: 'auto' }}>
                  {timeline.filter(t => t.selectedModel !== t.fallbackModel && t.fallbackModel).slice(0, 5).map((record, idx) => (
                    <div key={idx} style={{ padding: '0.5rem 0.75rem', background: '#fff', border: '1px solid #E2DACD', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontWeight: 'bold', color: 'var(--color-danger-text)' }}>{record.selectedModel}</span> &rarr; <span style={{ fontWeight: 'bold', color: 'var(--color-success-text)' }}>{record.fallbackModel}</span>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>Feature: <strong>{record.feature}</strong> | Classification: {record.errorClassification}</div>
                      </div>
                      <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                        {new Date(record.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontStyle: 'italic', color: 'var(--text-muted)', background: '#FAF8F5', padding: '1rem', textAlign: 'center', border: '1px dashed #E2DACD' }}>
                  No failovers or fallback activations triggered in recent telemetry window. Primary models operating within SLA.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Subtab Content: Provider Comparison */}
      {activeSubTab === 'Comparison' && stats && stats.providerComparison && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card" style={{ background: '#fff', border: '1px solid #E2DACD', padding: '1.5rem', boxShadow: 'var(--shadow-subtle)' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontFamily: 'var(--font-serif)', color: 'var(--text-primary)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Layers size={18} style={{ color: 'var(--color-accent)' }} /> Provider vs BusinessOS Telemetry Reconciler
            </h3>
            <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              This reconciler compares upstream provider usage metrics directly against local BusinessOS telemetry records to verify billing accuracy, semantic cache hit savings, and identify any telemetry propagation pipeline failures.
            </p>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #E2DACD', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.5rem' }}>Metric</th>
                  <th style={{ padding: '0.5rem' }}>Google (Official)</th>
                  <th style={{ padding: '0.5rem' }}>BusinessOS</th>
                  <th style={{ padding: '0.5rem' }}>Difference</th>
                  <th style={{ padding: '0.5rem' }}>Reconciliation Reason / Diagnostics</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const comp = stats.providerComparison;
                  const rows = [
                    {
                      label: 'Requests (RPD)',
                      google: comp.google.requests,
                      bos: comp.businessos.requests,
                      diff: comp.differences.requests.delta,
                      reason: comp.differences.requests.reason,
                      isMismatch: comp.differences.requests.reason === 'Telemetry mismatch'
                    },
                    {
                      label: 'Prompt Tokens',
                      google: comp.google.promptTokens,
                      bos: comp.businessos.promptTokens,
                      diff: comp.differences.promptTokens.delta,
                      reason: comp.differences.promptTokens.reason,
                      isMismatch: comp.differences.promptTokens.reason === 'Telemetry mismatch'
                    },
                    {
                      label: 'Completion Tokens',
                      google: comp.google.completionTokens,
                      bos: comp.businessos.completionTokens,
                      diff: comp.differences.completionTokens.delta,
                      reason: comp.differences.completionTokens.reason,
                      isMismatch: comp.differences.completionTokens.reason === 'Telemetry mismatch'
                    },
                    {
                      label: 'Total Tokens',
                      google: comp.google.totalTokens,
                      bos: comp.businessos.totalTokens,
                      diff: comp.differences.totalTokens.delta,
                      reason: comp.differences.totalTokens.reason,
                      isMismatch: comp.differences.totalTokens.reason === 'Telemetry mismatch'
                    }
                  ];

                  return rows.map((row, idx) => {
                    const diffSign = row.diff > 0 ? `+${row.diff.toLocaleString()}` : row.diff.toLocaleString();
                    const rowBg = row.isMismatch ? 'rgba(239, 68, 68, 0.08)' : idx % 2 === 0 ? '#FAF8F5' : '#fff';
                    const diffColor = row.isMismatch ? 'var(--color-danger-text)' : row.diff > 0 ? 'var(--color-success-text)' : 'var(--text-secondary)';

                    return (
                      <tr key={row.label} style={{ background: rowBg, borderBottom: '1px solid #E2DACD' }}>
                        <td style={{ padding: '0.75rem 0.5rem', fontWeight: 'bold' }}>{row.label}</td>
                        <td style={{ padding: '0.75rem 0.5rem', fontFamily: 'var(--font-mono)' }}>{row.google.toLocaleString()}</td>
                        <td style={{ padding: '0.75rem 0.5rem', fontFamily: 'var(--font-mono)' }}>{row.bos.toLocaleString()}</td>
                        <td style={{ padding: '0.75rem 0.5rem', fontFamily: 'var(--font-mono)', color: diffColor, fontWeight: 'bold' }}>
                          {row.isMismatch ? 'Telemetry Mismatch' : diffSign}
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', color: row.isMismatch ? 'var(--color-danger-text)' : 'var(--text-secondary)', fontWeight: row.isMismatch ? 'bold' : 'normal' }}>
                          {row.reason}
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1.5rem', borderTop: '1px dashed #E2DACD', paddingTop: '1.25rem', fontSize: '0.7rem' }}>
              <div>
                <div style={{ fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>GOOGLE OFFICIAL METADATA</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontFamily: 'var(--font-mono)' }}>
                  <div>Official RPM Limit: 15 / min</div>
                  <div>Official TPM Limit: 1,000,000 / min</div>
                  <div>Official RPD Limit: 1,500 / day</div>
                  <div>Remaining Daily Quota: {stats.providerComparison.google.quotaRemaining} requests</div>
                  <div>Last Updated Upstream: {new Date(stats.providerComparison.google.lastUpdated).toLocaleString()}</div>
                </div>
              </div>
              <div>
                <div style={{ fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>BUSINESSOS TELEMETRY METADATA</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontFamily: 'var(--font-mono)' }}>
                  <div>Calculated RPM: {stats.providerComparison.businessos.rpm} / min</div>
                  <div>Calculated TPM: {stats.providerComparison.businessos.tpm} / min</div>
                  <div>Calculated Daily Cost: ${stats.providerComparison.businessos.estimatedCost.toFixed(5)}</div>
                  <div>Total Cache Hits Today: {stats.providerComparison.businessos.cacheHits}</div>
                  <div>Total Cache Cost Savings: ${stats.providerComparison.businessos.cacheSavings.toFixed(5)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Subtab Content: Telemetry Diagnostics */}
      {activeSubTab === 'Diagnostics' && stats && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card" style={{ background: '#fff', border: '1px solid #E2DACD', padding: '1.5rem', boxShadow: 'var(--shadow-subtle)' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontFamily: 'var(--font-serif)', color: 'var(--text-primary)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Zap size={18} style={{ color: 'var(--color-accent)' }} /> Telemetry Pipeline Diagnostics
            </h3>
            <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Real-time audit trace displaying execution latency, status, documents written, and validation audits for every stage of the AI orchestrator telemetry pipeline.
            </p>

            {!stats.telemetryDiagnostics ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', background: '#FAF8F5', border: '1px dashed #E2DACD', fontSize: '0.75rem' }}>
                No diagnostics telemetry recorded yet. Perform an AI prompt request to generate pipeline diagnostics.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem', color: 'var(--text-muted)', borderBottom: '1px solid #FAF8F5', paddingBottom: '0.5rem' }}>
                  <span><strong>Last Pipeline Trace:</strong> {new Date(stats.telemetryDiagnostics.timestamp).toLocaleString()}</span>
                  <span><strong>Telemetry Document Ref:</strong> {stats.telemetryDiagnostics.requestId || 'N/A'}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative', paddingLeft: '1.5rem' }}>
                  {/* Vertical Timeline line */}
                  <div style={{ position: 'absolute', left: '6px', top: '10px', bottom: '10px', width: '2px', background: '#E2DACD' }} />

                  {stats.telemetryDiagnostics.stages.map((stage, idx) => {
                    const isFailed = stage.status === 'failed';
                    const isFallback = stage.status === 'fallback';
                    const dotColor = isFailed ? 'var(--color-danger-text)' : isFallback ? 'var(--color-warning-text)' : 'var(--color-success-text)';
                    const dotBg = isFailed ? 'var(--color-danger-bg)' : isFallback ? 'var(--color-warning-bg)' : 'var(--color-success-bg)';
                    const dotBorder = isFailed ? '1px solid var(--color-danger-border)' : isFallback ? '1px solid var(--color-warning-border)' : '1px solid var(--color-success-border)';

                    return (
                      <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px', position: 'relative' }}>
                        {/* Timeline dot */}
                        <div style={{
                          position: 'absolute',
                          left: '-24px',
                          top: '2px',
                          width: '14px',
                          height: '14px',
                          borderRadius: '50%',
                          background: dotBg,
                          border: dotBorder,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          zIndex: 2
                        }}>
                          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: dotColor }} />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>{stage.name}</span>
                          <span style={{
                            fontSize: '0.55rem',
                            padding: '1px 5px',
                            borderRadius: '3px',
                            textTransform: 'uppercase',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 'bold',
                            background: dotBg,
                            color: dotColor,
                            border: dotBorder
                          }}>
                            {stage.status}
                          </span>
                          {stage.executionTimeMs !== undefined && (
                            <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                              ({stage.executionTimeMs}ms)
                            </span>
                          )}
                          {stage.latencyMs !== undefined && (
                            <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                              (latency: {stage.latencyMs}ms)
                            </span>
                          )}
                        </div>

                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', paddingLeft: '2px' }}>
                          {stage.details && <div>{stage.details}</div>}
                          {stage.docId && <div><strong>Document Path:</strong> <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem' }}>{stage.docId}</code></div>}
                          {stage.attempts !== undefined && <div><strong>Attempts:</strong> {stage.attempts}</div>}
                          {(stage.promptTokens !== undefined || stage.completionTokens !== undefined) && (
                            <div>
                              <strong>Tokens:</strong> {stage.promptTokens || 0} prompt / {stage.completionTokens || 0} completion ({stage.source} source)
                            </div>
                          )}
                          {stage.error && (
                            <div style={{ color: 'var(--color-danger-text)', marginTop: '2px', fontWeight: 'bold', fontFamily: 'var(--font-mono)', fontSize: '0.65rem' }}>
                              Error: {stage.error}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Subtab Content: Timeline logs */}
      {activeSubTab === 'Timeline' && (
        <div className="card" style={{ background: '#fff', border: '1px solid #E2DACD', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', boxShadow: 'var(--shadow-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)', textTransform: 'uppercase', fontFamily: 'var(--font-serif)', fontWeight: 'normal' }}>Recent Execution Telemetry Feed</h3>
            <button
              onClick={handleExportCsv}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <Download size={12} /> Export CSV
            </button>
          </div>
          
          {filteredTimeline.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.7rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #222', color: '#666' }}>
                    <th style={{ padding: '0.4rem 0.25rem' }}>Timestamp</th>
                    <th style={{ padding: '0.4rem 0.25rem' }}>Feature</th>
                    <th style={{ padding: '0.4rem 0.25rem' }}>User</th>
                    <th style={{ padding: '0.4rem 0.25rem' }}>Workspace</th>
                    <th style={{ padding: '0.4rem 0.25rem' }}>Models (Target &rarr; Actual)</th>
                    <th style={{ padding: '0.4rem 0.25rem', textAlign: 'center' }}>Tokens (P / C)</th>
                    <th style={{ padding: '0.4rem 0.25rem', textAlign: 'center' }}>Retries</th>
                    <th style={{ padding: '0.4rem 0.25rem', textAlign: 'center' }}>Latency</th>
                    <th style={{ padding: '0.4rem 0.25rem', textAlign: 'center' }}>Cost</th>
                    <th style={{ padding: '0.4rem 0.25rem', textAlign: 'right' }}>Status</th>
                    <th style={{ padding: '0.4rem 0.25rem', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTimeline.map(record => (
                    <tr 
                      key={record.id} 
                      onClick={() => setSelectedRequest(record)}
                      style={{ borderBottom: '1px solid #E2DACD', cursor: 'pointer', transition: 'background 0.15s' }}
                      title="Click to launch AI Request Inspector (DevTools view)"
                    >
                      <td style={{ padding: '0.5rem 0.25rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{new Date(record.timestamp).toLocaleTimeString()}</td>
                      <td style={{ padding: '0.5rem 0.25rem', fontWeight: 'bold' }}>{record.feature}</td>
                      <td style={{ padding: '0.5rem 0.25rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{(record.user || '').substring(0, 8)}...</td>
                      <td style={{ padding: '0.5rem 0.25rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={record.workspace}>
                        {record.workspace || '—'}
                      </td>
                      <td style={{ padding: '0.5rem 0.25rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{record.selectedModel}</span>
                        {record.fallbackModel && record.fallbackModel !== record.selectedModel && (
                          <>
                            <span style={{ color: 'var(--color-danger-text)', margin: '0 4px' }}>&rarr;</span>
                            <span style={{ color: 'var(--color-warning-text)', fontWeight: 'bold' }}>{record.fallbackModel}</span>
                          </>
                        )}
                      </td>
                      <td style={{ padding: '0.5rem 0.25rem', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{record.promptTokens}</span>
                        <span style={{ color: 'var(--text-muted)' }}>/</span>
                        <span style={{ color: 'var(--text-secondary)' }}>{record.completionTokens}</span>
                        {record.tokenCountSource === 'estimated' && (
                          <span style={{ display: 'block', fontSize: '0.45rem', color: 'var(--text-muted)', fontStyle: 'italic' }} title="Estimated via character count; provider did not return usage data">~est</span>
                        )}
                      </td>
                      <td style={{ padding: '0.5rem 0.25rem', textAlign: 'center', color: record.retryCount > 0 ? 'var(--color-warning-text)' : 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                        {record.retryCount}
                      </td>
                      <td style={{ padding: '0.5rem 0.25rem', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                        {record.latency}ms
                      </td>
                      <td style={{ padding: '0.5rem 0.25rem', textAlign: 'center', color: 'var(--color-success-text)', fontFamily: 'var(--font-mono)' }}>
                        ${(record.estimatedCost || 0).toFixed(5)}
                      </td>
                      <td style={{ padding: '0.5rem 0.25rem', textAlign: 'right', fontWeight: 'bold' }}>
                        {record.cachedResponse && (
                          <span style={{ display: 'block', fontSize: '0.5rem', background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning-border)', color: 'var(--color-warning-text)', padding: '1px 4px', marginBottom: '2px', textTransform: 'uppercase' }}>Cached</span>
                        )}
                        {record.success ? (
                          <span style={{ color: 'var(--color-success-text)' }}>SUCCESS</span>
                        ) : (
                          <span style={{ color: 'var(--color-danger-text)', fontSize: '0.6rem' }} title={record.errorClassification}>
                            {record.errorClassification || 'FAILED'}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '0.5rem 0.25rem', textAlign: 'center' }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedRequest(record); }}
                          style={{
                            background: '#FAF8F5',
                            border: '1px solid #C4B9A7',
                            color: 'var(--color-primary)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '0.65rem',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '2px'
                          }}
                        >
                          <Eye size={11} /> Inspect
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No telemetry events match active filter criteria.</div>
          )}
        </div>
      )}

      {/* Subtab Content: Controls (OWNER only) */}
      {activeSubTab === 'Controls' && isOwner && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Policy controls */}
          <div className="card" style={{ background: '#fff', border: '1px solid #E2DACD', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', boxShadow: 'var(--shadow-subtle)' }}>
            <h3 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)', textTransform: 'uppercase', fontFamily: 'var(--font-serif)', fontWeight: 'normal' }}>Operational Policies</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-primary)' }}>
                <input
                  type="checkbox"
                  checked={config.maintenanceMode || false}
                  onChange={e => setConfig({ ...config, maintenanceMode: e.target.checked })}
                  style={{ width: '14px', height: '14px' }}
                />
                <span>Enable Global Maintenance Mode (Temporarily disables orchestrator executions)</span>
              </label>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', marginTop: '0.25rem', color: 'var(--text-primary)' }}>
                <span>Telemetry logs retention window:</span>
                <select
                  value={config.retentionDays || 30}
                  onChange={e => setConfig({ ...config, retentionDays: parseInt(e.target.value) || 30 })}
                  style={{
                    background: '#FCFAF6',
                    border: '1px solid #C4B9A7',
                    color: 'var(--text-primary)',
                    padding: '0.25rem 0.5rem',
                    fontSize: '0.75rem',
                    outline: 'none'
                  }}
                >
                  <option value={7}>7 Days</option>
                  <option value={15}>15 Days</option>
                  <option value={30}>30 Days</option>
                  <option value={90}>90 Days</option>
                </select>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                <span>Daily request quota limit (BusinessOS estimate baseline):</span>
                <input
                  type="number"
                  min="100"
                  max="100000"
                  step="100"
                  value={config.dailyQuotaLimit || 1500}
                  onChange={e => setConfig({ ...config, dailyQuotaLimit: parseInt(e.target.value) || 1500 })}
                  style={{
                    background: '#FCFAF6',
                    border: '1px solid #C4B9A7',
                    color: 'var(--text-primary)',
                    padding: '0.25rem 0.5rem',
                    fontSize: '0.75rem',
                    width: '100px',
                    outline: 'none'
                  }}
                />
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>reqs/day (not provider-reported)</span>
              </div>
            </div>
          </div>

          {/* Maintenance triggers */}
          <div className="card" style={{ background: '#fff', border: '1px solid #E2DACD', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', boxShadow: 'var(--shadow-subtle)' }}>
            <h3 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)', textTransform: 'uppercase', fontFamily: 'var(--font-serif)', fontWeight: 'normal' }}>Maintenance Controls</h3>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <button
                onClick={handleFlushCooldowns}
                className="btn btn-secondary"
                style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem', background: '#FCFAF6', border: '1px solid #C4B9A7' }}
              >
                <Zap size={14} style={{ color: 'var(--color-warning-text)' }} /> Flush Active Cooldowns
              </button>

              <button
                onClick={handleClearTelemetry}
                className="btn btn-danger"
                style={{ 
                  fontSize: '0.75rem', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.35rem', 
                  background: 'var(--color-danger-bg)', 
                  border: '1px solid var(--color-danger-border)', 
                  color: 'var(--color-danger-text)' 
                }}
              >
                <Trash2 size={14} /> Clear Telemetry Logs
              </button>
            </div>
          </div>

        </div>
      )}

      <AIRequestInspectorModal
        record={selectedRequest}
        onClose={() => setSelectedRequest(null)}
      />
    </div>
  );
};
