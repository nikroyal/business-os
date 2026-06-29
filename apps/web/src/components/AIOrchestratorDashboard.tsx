import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { aiOrchestratorService } from '../services/aiOrchestratorService';
import type { 
  OrchestratorStats, 
  TelemetryRecord, 
  OrchestratorConfig 
} from '../services/aiOrchestratorService';
import { 
  Cpu, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw, 
  Save, 
  User, 
  Briefcase,
  Layers
} from 'lucide-react';

export const AIOrchestratorDashboard: React.FC = () => {
  const { profile } = useAuth();
  const isOwner = profile?.role === 'OWNER';

  const [activeSubTab, setActiveSubTab] = useState<'Overview' | 'Registry' | 'Usage' | 'Timeline'>('Overview');
  const [stats, setStats] = useState<OrchestratorStats | null>(null);
  const [timeline, setTimeline] = useState<TelemetryRecord[]>([]);
  const [config, setConfig] = useState<OrchestratorConfig>({ forcedModel: null, modelOverrides: {} });
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  // Stats fetching logic
  const loadData = async (showRefresher = false) => {
    if (showRefresher) setRefreshing(true);
    else setLoading(true);

    try {
      const [statsData, timelineData, configData] = await Promise.all([
        aiOrchestratorService.getStats(),
        aiOrchestratorService.getTimeline(),
        aiOrchestratorService.getConfig()
      ]);
      setStats(statsData);
      setTimeline(timelineData);
      setConfig(configData || { forcedModel: null, modelOverrides: {} });
    } catch (e) {
      console.error('Failed to load AI Orchestrator data:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    // Auto-refresh every 10 seconds to keep telemetry timeline and cooldown timers updated
    const interval = setInterval(() => loadData(true), 10000);
    return () => clearInterval(interval);
  }, []);

  // Update Config options
  const handleToggleModel = async (modelId: string, enabled: boolean) => {
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

  if (loading && !stats) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center', color: '#888', fontFamily: 'var(--font-mono)' }}>
        <RefreshCw size={24} className="spin-animation" style={{ marginBottom: '1rem' }} />
        <div>Connecting to AI Orchestrator nodes...</div>
      </div>
    );
  }

  // Derived dashboard details
  const overview = stats?.overview;
  const models = stats?.models || [];
  const activeForced = models.find(m => m.isForced);
  const primaryModel = activeForced ? activeForced : models.find(m => m.enabled && m.cooldownRemaining === 0);
  const fallbackChain = models.filter(m => m.enabled && m.id !== primaryModel?.id);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', color: '#f3f4f6' }}>
      
      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #222', paddingBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Cpu style={{ color: 'var(--color-primary)' }} />
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, textTransform: 'uppercase', margin: 0, letterSpacing: '0.05em' }}>AI Operations Center</h2>
          <span style={{ fontSize: '0.65rem', background: '#06b6d422', border: '1px solid #06b6d444', color: '#06b6d4', padding: '1px 6px', borderRadius: '4px', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>Orchestrator Active</span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            onClick={() => loadData(true)} 
            disabled={refreshing}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '4px', height: '28px' }}
          >
            <RefreshCw size={12} className={refreshing ? 'spin-animation' : ''} /> Refresh
          </button>
          {isOwner && (
            <button 
              onClick={handleSaveConfig} 
              disabled={saving}
              className="btn btn-primary btn-sm"
              style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '4px', height: '28px' }}
            >
              <Save size={12} /> {saving ? 'Saving...' : 'Commit Settings'}
            </button>
          )}
        </div>
      </div>

      {/* Sub tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #1c1c1c', paddingBottom: '0.5rem' }}>
        {(['Overview', 'Registry', 'Usage', 'Timeline'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveSubTab(tab)}
            style={{
              padding: '0.4rem 0.8rem',
              fontSize: '0.75rem',
              background: activeSubTab === tab ? 'rgba(6, 182, 212, 0.1)' : 'transparent',
              border: activeSubTab === tab ? '1px solid rgba(6, 182, 212, 0.3)' : '1px solid transparent',
              color: activeSubTab === tab ? '#06b6d4' : '#888',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: activeSubTab === tab ? 600 : 400,
              transition: 'all 0.2s ease'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Subtab Content: Overview */}
      {activeSubTab === 'Overview' && overview && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Main stats counters */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div className="stat-card" style={{ background: '#111', border: '1px solid #222', padding: '1rem', borderRadius: '6px' }}>
              <div style={{ fontSize: '0.65rem', color: '#666', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Operational Status</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '1.25rem', fontWeight: 600, color: overview.overallHealth === 'healthy' ? '#10b981' : '#f59e0b' }}>
                {overview.overallHealth === 'healthy' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                {overview.overallHealth === 'healthy' ? 'HEALTHY' : 'DEGRADED'}
              </div>
              <div style={{ fontSize: '0.65rem', color: '#444', fontFamily: 'var(--font-mono)', marginTop: '0.25rem' }}>Active Provider: {overview.activeProvider}</div>
            </div>

            <div className="stat-card" style={{ background: '#111', border: '1px solid #222', padding: '1rem', borderRadius: '6px' }}>
              <div style={{ fontSize: '0.65rem', color: '#666', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Success Rate</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--color-primary-text)' }}>{overview.overallSuccessRate}%</div>
              <div style={{ fontSize: '0.65rem', color: '#444', fontFamily: 'var(--font-mono)', marginTop: '0.25rem' }}>Total Failovers: {overview.totalFailovers} | Retries: {overview.totalRetries}</div>
            </div>

            <div className="stat-card" style={{ background: '#111', border: '1px solid #222', padding: '1rem', borderRadius: '6px' }}>
              <div style={{ fontSize: '0.65rem', color: '#666', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Avg Latency</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>{overview.averageLatencyMs} ms</div>
              <div style={{ fontSize: '0.65rem', color: '#444', fontFamily: 'var(--font-mono)', marginTop: '0.25rem' }}>Requests Today: {overview.requestsToday}</div>
            </div>

            <div className="stat-card" style={{ background: '#111', border: '1px solid #222', padding: '1rem', borderRadius: '6px' }}>
              <div style={{ fontSize: '0.65rem', color: '#666', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Estimated Daily Cost</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 600, color: '#10b981' }}>${overview.estimatedDailyCost.toFixed(4)}</div>
              <div style={{ fontSize: '0.65rem', color: '#444', fontFamily: 'var(--font-mono)', marginTop: '0.25rem' }}>Monthly Projection: ${overview.estimatedMonthlyCost.toFixed(2)}</div>
            </div>
          </div>

          {/* Active Chain Visualizer */}
          <div style={{ background: '#111', border: '1px solid #222', padding: '1.25rem', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <h3 style={{ margin: 0, fontSize: '0.85rem', color: '#fff', textTransform: 'uppercase' }}>Active Fallback Chain</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
              {primaryModel ? (
                <div style={{
                  background: 'rgba(16, 185, 129, 0.05)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <span style={{ fontSize: '0.6rem', background: '#10b981', color: '#000', fontWeight: 'bold', padding: '1px 4px', borderRadius: '2px', textTransform: 'uppercase' }}>Primary</span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#10b981' }}>{primaryModel.displayName}</span>
                  <span style={{ fontSize: '0.65rem', color: '#888', fontFamily: 'var(--font-mono)' }}>({primaryModel.id})</span>
                </div>
              ) : (
                <div style={{ color: '#ef4444', fontSize: '0.8rem' }}>No healthy primary model selected!</div>
              )}

              {fallbackChain.map((m, idx) => (
                <React.Fragment key={m.id}>
                  <div style={{ color: '#555', fontSize: '0.8rem' }}>&rarr;</div>
                  <div style={{
                    background: m.cooldownRemaining > 0 ? 'rgba(239, 68, 68, 0.05)' : 'rgba(245, 158, 11, 0.05)',
                    border: m.cooldownRemaining > 0 ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(245, 158, 11, 0.2)',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    opacity: m.cooldownRemaining > 0 ? 0.5 : 1
                  }}>
                    <span style={{
                      fontSize: '0.6rem',
                      background: m.cooldownRemaining > 0 ? '#ef4444' : '#f59e0b',
                      color: '#000',
                      fontWeight: 'bold',
                      padding: '1px 4px',
                      borderRadius: '2px',
                      textTransform: 'uppercase'
                    }}>
                      {m.cooldownRemaining > 0 ? 'Cooldown' : `Fallback ${idx + 1}`}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: m.cooldownRemaining > 0 ? '#ef4444' : '#f59e0b' }}>{m.displayName}</span>
                    {m.cooldownRemaining > 0 && (
                      <span style={{ fontSize: '0.65rem', color: '#ef4444', fontFamily: 'var(--font-mono)' }}>({Math.ceil(m.cooldownRemaining / 1000)}s left)</span>
                    )}
                  </div>
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Quota limit card */}
          {stats.quota && (
            <div style={{ background: '#111', border: '1px solid #222', padding: '1.25rem', borderRadius: '6px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#fff', textTransform: 'uppercase' }}>Estimated Quota Usage</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.8rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#aaa' }}>Requests Today:</span>
                    <span>{overview.requestsToday} / 1,500</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#aaa' }}>Estimated RPM (Average):</span>
                    <span>{stats.quota.requestsPerMinute} requests / min</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#aaa' }}>Tokens Today:</span>
                    <span>{overview.tokensToday.toLocaleString()} tokens</span>
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#555', fontStyle: 'italic', marginTop: '0.25rem' }}>
                    * Values are BusinessOS estimates derived from telemetry logs.
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', borderLeft: '1px solid #222', paddingLeft: '1.5rem' }}>
                <div style={{ position: 'relative', width: '90px', height: '90px', display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: '50%', background: 'conic-gradient(var(--color-primary) ' + stats.quota.quotaUtilisationPercentage + '%, #222 0)' }}>
                  <div style={{ position: 'absolute', width: '74px', height: '74px', borderRadius: '50%', background: '#111', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                    <span style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{stats.quota.quotaUtilisationPercentage}%</span>
                    <span style={{ fontSize: '0.55rem', color: '#666', textTransform: 'uppercase' }}>Utilized</span>
                  </div>
                </div>
                <div style={{ fontSize: '0.7rem', color: '#aaa', marginTop: '0.5rem' }}>{stats.quota.estimatedRemainingDailyRequests} requests remaining today</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Subtab Content: Registry */}
      {activeSubTab === 'Registry' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Forced Override Configuration */}
          {isOwner && (
            <div style={{ background: '#111', border: '1px solid #222', padding: '1rem', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.85rem', color: '#fff' }}>Force Preferred Model Override</h4>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.7rem', color: '#aaa' }}>If enabled, all client prompt queries will bypass failover logic and target this selected model.</p>
              </div>
              <select
                value={config.forcedModel || ''}
                onChange={e => handleForceModelChange(e.target.value === '' ? null : e.target.value)}
                style={{
                  background: '#222',
                  color: '#fff',
                  border: '1px solid #333',
                  padding: '0.35rem 0.6rem',
                  fontSize: '0.75rem',
                  borderRadius: '4px',
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

          {/* Model Registry List Table */}
          <div style={{ background: '#111', border: '1px solid #222', padding: '1rem', borderRadius: '6px', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #222', color: '#666' }}>
                  <th style={{ padding: '0.5rem 0.25rem' }}>Model Details</th>
                  <th style={{ padding: '0.5rem 0.25rem', textAlign: 'center' }}>Priority</th>
                  <th style={{ padding: '0.5rem 0.25rem', textAlign: 'center' }}>Category</th>
                  <th style={{ padding: '0.5rem 0.25rem', textAlign: 'center' }}>Scores (C/R/S)</th>
                  <th style={{ padding: '0.5rem 0.25rem', textAlign: 'center' }}>Active Status</th>
                  <th style={{ padding: '0.5rem 0.25rem', textAlign: 'center' }}>Success Rate</th>
                  <th style={{ padding: '0.5rem 0.25rem', textAlign: 'right' }}>Cooldown (Sec)</th>
                  {isOwner && <th style={{ padding: '0.5rem 0.25rem', textAlign: 'center' }}>Controls</th>}
                </tr>
              </thead>
              <tbody>
                {models.map(model => {
                  const mConfig = config.modelOverrides[model.id] || {};
                  const isModelEnabled = mConfig.enabled !== undefined ? mConfig.enabled : model.enabled;
                  const currentPriority = mConfig.priority !== undefined ? mConfig.priority : model.priority;

                  return (
                    <tr key={model.id} style={{ borderBottom: '1px solid #1c1c1c', opacity: isModelEnabled ? 1 : 0.5 }}>
                      <td style={{ padding: '0.6rem 0.25rem' }}>
                        <div style={{ fontWeight: 'bold', color: model.cooldownRemaining > 0 ? '#ef4444' : '#fff' }}>
                          {model.displayName}
                          {model.status === 'preview' && (
                            <span style={{ fontSize: '0.55rem', background: '#a855f722', border: '1px solid #a855f744', color: '#a855f7', padding: '1px 3px', borderRadius: '3px', marginLeft: '4px', textTransform: 'uppercase' }}>Preview</span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.6rem', color: '#666', fontFamily: 'var(--font-mono)' }}>{model.id}</div>
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
                              background: '#222',
                              border: '1px solid #333',
                              color: '#fff',
                              width: '45px',
                              padding: '2px',
                              textAlign: 'center',
                              borderRadius: '3px',
                              fontSize: '0.75rem'
                            }}
                          />
                        ) : (
                          <span>{currentPriority}</span>
                        )}
                      </td>
                      <td style={{ padding: '0.6rem 0.25rem', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                        <span style={{ fontSize: '0.65rem', border: '1px solid #333', padding: '1px 4px', borderRadius: '3px' }}>{model.category}</span>
                      </td>
                      <td style={{ padding: '0.6rem 0.25rem', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                        <span style={{ color: '#06b6d4' }}>{model.capabilityScore}</span>
                        <span style={{ color: '#444' }}>/</span>
                        <span style={{ color: '#a855f7' }}>{model.reasoningScore}</span>
                        <span style={{ color: '#444' }}>/</span>
                        <span style={{ color: '#10b981' }}>{model.speedScore}</span>
                      </td>
                      <td style={{ padding: '0.6rem 0.25rem', textAlign: 'center' }}>
                        <span style={{
                          color: !isModelEnabled ? '#666' : model.cooldownRemaining > 0 ? '#ef4444' : '#10b981',
                          fontWeight: 'bold',
                          fontSize: '0.65rem'
                        }}>
                          {!isModelEnabled ? 'DISABLED' : model.cooldownRemaining > 0 ? 'COOLDOWN' : 'HEALTHY'}
                        </span>
                      </td>
                      <td style={{ padding: '0.6rem 0.25rem', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                        <div>{model.stats.successRate}%</div>
                        <div style={{ fontSize: '0.55rem', color: '#555' }}>{model.stats.avgLatencyMs}ms | {model.stats.requests} reqs</div>
                      </td>
                      <td style={{ padding: '0.6rem 0.25rem', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                        {model.cooldownRemaining > 0 ? (
                          <span style={{ color: '#ef4444', fontWeight: 'bold' }}>{Math.ceil(model.cooldownRemaining / 1000)}s</span>
                        ) : (
                          <span style={{ color: '#666' }}>0s</span>
                        )}
                      </td>
                      {isOwner && (
                        <td style={{ padding: '0.6rem 0.25rem', textAlign: 'center' }}>
                          <button
                            onClick={() => handleToggleModel(model.id, !isModelEnabled)}
                            style={{
                              background: isModelEnabled ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                              border: isModelEnabled ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
                              color: isModelEnabled ? '#ef4444' : '#10b981',
                              padding: '2px 8px',
                              borderRadius: '3px',
                              cursor: 'pointer',
                              fontSize: '0.65rem',
                              fontWeight: 600,
                              width: '64px'
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.25rem' }}>
            {/* Feature cost breakdown */}
            <div style={{ background: '#111', border: '1px solid #222', padding: '1rem', borderRadius: '6px' }}>
              <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.8rem', color: '#fff', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Layers size={14} style={{ color: 'var(--color-primary)' }} /> Cost by Feature
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {Object.entries(stats.breakdowns.featureCost).map(([feat, cost]) => (
                  <div key={feat} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', borderBottom: '1px solid #1c1c1c', paddingBottom: '0.25rem' }}>
                    <span style={{ color: '#aaa' }}>{feat}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold', color: '#10b981' }}>${cost.toFixed(5)}</span>
                  </div>
                ))}
                {Object.keys(stats.breakdowns.featureCost).length === 0 && (
                  <div style={{ fontSize: '0.75rem', color: '#555', fontStyle: 'italic', textAlign: 'center', padding: '1rem' }}>No usage recorded.</div>
                )}
              </div>
            </div>

            {/* Workspace cost breakdown */}
            <div style={{ background: '#111', border: '1px solid #222', padding: '1rem', borderRadius: '6px' }}>
              <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.8rem', color: '#fff', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Briefcase size={14} style={{ color: '#a855f7' }} /> Cost by Workspace
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {Object.entries(stats.breakdowns.workspaceCost).map(([ws, cost]) => (
                  <div key={ws} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', borderBottom: '1px solid #1c1c1c', paddingBottom: '0.25rem' }}>
                    <span style={{ color: '#aaa', wordBreak: 'break-all' }}>{ws}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold', color: '#10b981' }}>${cost.toFixed(5)}</span>
                  </div>
                ))}
                {Object.keys(stats.breakdowns.workspaceCost).length === 0 && (
                  <div style={{ fontSize: '0.75rem', color: '#555', fontStyle: 'italic', textAlign: 'center', padding: '1rem' }}>No usage recorded.</div>
                )}
              </div>
            </div>

            {/* User cost breakdown */}
            <div style={{ background: '#111', border: '1px solid #222', padding: '1rem', borderRadius: '6px' }}>
              <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.8rem', color: '#fff', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <User size={14} style={{ color: '#f59e0b' }} /> Cost by User
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {Object.entries(stats.breakdowns.userCost).map(([usr, cost]) => (
                  <div key={usr} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', borderBottom: '1px solid #1c1c1c', paddingBottom: '0.25rem' }}>
                    <span style={{ color: '#aaa', wordBreak: 'break-all' }}>{usr.substring(0, 16)}{usr.length > 16 && '...'}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold', color: '#10b981' }}>${cost.toFixed(5)}</span>
                  </div>
                ))}
                {Object.keys(stats.breakdowns.userCost).length === 0 && (
                  <div style={{ fontSize: '0.75rem', color: '#555', fontStyle: 'italic', textAlign: 'center', padding: '1rem' }}>No usage recorded.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Subtab Content: Timeline logs */}
      {activeSubTab === 'Timeline' && (
        <div style={{ background: '#111', border: '1px solid #222', padding: '1rem', borderRadius: '6px' }}>
          <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', color: '#fff', textTransform: 'uppercase' }}>Recent Execution Telemetry Feed</h3>
          
          {timeline.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.7rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #222', color: '#666' }}>
                    <th style={{ padding: '0.4rem 0.25rem' }}>Timestamp</th>
                    <th style={{ padding: '0.4rem 0.25rem' }}>Feature</th>
                    <th style={{ padding: '0.4rem 0.25rem' }}>User</th>
                    <th style={{ padding: '0.4rem 0.25rem' }}>Models (Target &rarr; Actual)</th>
                    <th style={{ padding: '0.4rem 0.25rem', textAlign: 'center' }}>Tokens (P / C)</th>
                    <th style={{ padding: '0.4rem 0.25rem', textAlign: 'center' }}>Retries</th>
                    <th style={{ padding: '0.4rem 0.25rem', textAlign: 'center' }}>Latency</th>
                    <th style={{ padding: '0.4rem 0.25rem', textAlign: 'right' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {timeline.map(record => (
                    <tr key={record.id} style={{ borderBottom: '1px solid #1c1c1c' }}>
                      <td style={{ padding: '0.5rem 0.25rem', color: '#666', fontFamily: 'var(--font-mono)' }}>{new Date(record.timestamp).toLocaleTimeString()}</td>
                      <td style={{ padding: '0.5rem 0.25rem', fontWeight: 'bold' }}>{record.feature}</td>
                      <td style={{ padding: '0.5rem 0.25rem', color: '#aaa', fontFamily: 'var(--font-mono)' }}>{record.user.substring(0, 8)}...</td>
                      <td style={{ padding: '0.5rem 0.25rem' }}>
                        <span style={{ color: '#888' }}>{record.selectedModel}</span>
                        {record.fallbackModel && record.fallbackModel !== record.selectedModel && (
                          <>
                            <span style={{ color: '#ef4444', margin: '0 4px' }}>&rarr;</span>
                            <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>{record.fallbackModel}</span>
                          </>
                        )}
                      </td>
                      <td style={{ padding: '0.5rem 0.25rem', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                        <span style={{ color: '#888' }}>{record.promptTokens}</span>
                        <span style={{ color: '#444' }}>/</span>
                        <span style={{ color: '#aaa' }}>{record.completionTokens}</span>
                      </td>
                      <td style={{ padding: '0.5rem 0.25rem', textAlign: 'center', color: record.retryCount > 0 ? '#f59e0b' : '#666', fontFamily: 'var(--font-mono)' }}>
                        {record.retryCount}
                      </td>
                      <td style={{ padding: '0.5rem 0.25rem', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                        {record.latency}ms
                      </td>
                      <td style={{ padding: '0.5rem 0.25rem', textAlign: 'right', fontWeight: 'bold' }}>
                        {record.success ? (
                          <span style={{ color: '#10b981' }}>SUCCESS</span>
                        ) : (
                          <span style={{ color: '#ef4444', fontSize: '0.6rem' }} title={record.errorClassification}>
                            {record.errorClassification || 'FAILED'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#555', fontFamily: 'var(--font-mono)' }}>No AI request logs recorded.</div>
          )}
        </div>
      )}
    </div>
  );
};
