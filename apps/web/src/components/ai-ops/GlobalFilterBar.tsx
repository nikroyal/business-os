import React from 'react';
import { Calendar, X, Search } from 'lucide-react';
import type { TelemetryRecord } from '../../services/aiOrchestratorService';

export interface OpsFilterState {
  timeRange: '24h' | '7d' | '30d' | '90d' | 'custom';
  customStartDate?: string;
  customEndDate?: string;
  provider: string;
  model: string;
  user: string;
  workspace: string;
  feature: string;
  status: 'all' | 'success' | 'failed' | 'cached';
  searchQuery: string;
}

export const DEFAULT_FILTERS: OpsFilterState = {
  timeRange: '30d',
  provider: 'all',
  model: 'all',
  user: 'all',
  workspace: 'all',
  feature: 'all',
  status: 'all',
  searchQuery: ''
};

interface GlobalFilterBarProps {
  filters: OpsFilterState;
  onFilterChange: (newFilters: OpsFilterState) => void;
  timeline: TelemetryRecord[];
  filteredCount: number;
  totalCount: number;
  availableModels: { id: string; displayName: string }[];
}

export const GlobalFilterBar: React.FC<GlobalFilterBarProps> = ({
  filters,
  onFilterChange,
  timeline,
  filteredCount,
  totalCount,
  availableModels
}) => {
  // Extract unique options from timeline
  const uniqueUsers = Array.from(new Set(timeline.map(t => t.user).filter(Boolean))).sort();
  const uniqueWorkspaces = Array.from(new Set(timeline.map(t => t.workspace).filter(Boolean))).sort();
  const uniqueFeatures = Array.from(new Set(timeline.map(t => t.feature).filter(Boolean))).sort();

  const isFiltered = filters.timeRange !== '30d' ||
    filters.provider !== 'all' ||
    filters.model !== 'all' ||
    filters.user !== 'all' ||
    filters.workspace !== 'all' ||
    filters.feature !== 'all' ||
    filters.status !== 'all' ||
    filters.searchQuery !== '';

  const handleReset = () => {
    onFilterChange(DEFAULT_FILTERS);
  };

  const updateField = (field: keyof OpsFilterState, val: string) => {
    onFilterChange({ ...filters, [field]: val });
  };

  return (
    <div className="card" style={{
      background: '#fff',
      border: '1px solid #E2DACD',
      borderRadius: '8px',
      padding: '1rem 1.25rem',
      marginBottom: '1.25rem',
      boxShadow: 'var(--shadow-subtle)',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.85rem'
    }}>
      {/* Top row: Time range tabs + search + reset */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
            <Calendar size={14} style={{ color: 'var(--color-primary)' }} /> Time Range:
          </span>

          <div style={{ display: 'flex', background: '#FCFAF6', border: '1px solid #C4B9A7', borderRadius: '6px', overflow: 'hidden' }}>
            {[
              { id: '24h', label: 'Last 24 Hours' },
              { id: '7d', label: 'Last 7 Days' },
              { id: '30d', label: 'Last 30 Days' },
              { id: '90d', label: 'Last 90 Days' },
              { id: 'custom', label: 'Custom Range' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => updateField('timeRange', tab.id)}
                style={{
                  background: filters.timeRange === tab.id ? 'var(--color-primary)' : 'transparent',
                  color: filters.timeRange === tab.id ? '#fff' : 'var(--text-primary)',
                  border: 'none',
                  borderRight: '1px solid #E2DACD',
                  padding: '4px 10px',
                  fontSize: '0.7rem',
                  fontWeight: filters.timeRange === tab.id ? 'bold' : 'normal',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {filters.timeRange === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.7rem' }}>
              <input
                type="date"
                value={filters.customStartDate || ''}
                onChange={e => updateField('customStartDate', e.target.value)}
                style={{ padding: '2px 6px', border: '1px solid #C4B9A7', borderRadius: '4px', background: '#fff', fontSize: '0.7rem' }}
              />
              <span>to</span>
              <input
                type="date"
                value={filters.customEndDate || ''}
                onChange={e => updateField('customEndDate', e.target.value)}
                style={{ padding: '2px 6px', border: '1px solid #C4B9A7', borderRadius: '4px', background: '#fff', fontSize: '0.7rem' }}
              />
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ position: 'relative', minWidth: '200px' }}>
            <Search size={13} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
            <input
              type="text"
              placeholder="Search logs by keyword..."
              value={filters.searchQuery}
              onChange={e => updateField('searchQuery', e.target.value)}
              style={{
                width: '100%',
                padding: '4px 8px 4px 26px',
                border: '1px solid #C4B9A7',
                borderRadius: '6px',
                fontSize: '0.75rem',
                background: '#FCFAF6',
                outline: 'none'
              }}
            />
            {filters.searchQuery && (
              <button onClick={() => updateField('searchQuery', '')} style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                <X size={12} style={{ color: '#888' }} />
              </button>
            )}
          </div>

          {isFiltered && (
            <button
              onClick={handleReset}
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#ef4444',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '0.7rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              <X size={12} /> Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Bottom row: Multi-dimensional filter select boxes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.6rem', borderTop: '1px solid #F0ECE3', paddingTop: '0.75rem' }}>
        
        {/* Provider Select */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>Provider</label>
          <select
            value={filters.provider}
            onChange={e => updateField('provider', e.target.value)}
            style={{ padding: '4px 6px', border: '1px solid #C4B9A7', borderRadius: '4px', background: '#FCFAF6', fontSize: '0.7rem', outline: 'none' }}
          >
            <option value="all">All Providers</option>
            <option value="google">Google Gemini</option>
            <option value="openai">OpenAI (Multi-cloud Ready)</option>
            <option value="anthropic">Anthropic (Multi-cloud Ready)</option>
          </select>
        </div>

        {/* Model Select */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>Model</label>
          <select
            value={filters.model}
            onChange={e => updateField('model', e.target.value)}
            style={{ padding: '4px 6px', border: '1px solid #C4B9A7', borderRadius: '4px', background: '#FCFAF6', fontSize: '0.7rem', outline: 'none' }}
          >
            <option value="all">All Models</option>
            {availableModels.map(m => (
              <option key={m.id} value={m.id}>{m.displayName}</option>
            ))}
          </select>
        </div>

        {/* User Select */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>User</label>
          <select
            value={filters.user}
            onChange={e => updateField('user', e.target.value)}
            style={{ padding: '4px 6px', border: '1px solid #C4B9A7', borderRadius: '4px', background: '#FCFAF6', fontSize: '0.7rem', outline: 'none' }}
          >
            <option value="all">All Users</option>
            {uniqueUsers.map(u => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>

        {/* Workspace Select */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>Workspace</label>
          <select
            value={filters.workspace}
            onChange={e => updateField('workspace', e.target.value)}
            style={{ padding: '4px 6px', border: '1px solid #C4B9A7', borderRadius: '4px', background: '#FCFAF6', fontSize: '0.7rem', outline: 'none' }}
          >
            <option value="all">All Workspaces</option>
            {uniqueWorkspaces.map(w => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
        </div>

        {/* Feature Select */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>Feature</label>
          <select
            value={filters.feature}
            onChange={e => updateField('feature', e.target.value)}
            style={{ padding: '4px 6px', border: '1px solid #C4B9A7', borderRadius: '4px', background: '#FCFAF6', fontSize: '0.7rem', outline: 'none' }}
          >
            <option value="all">All Features</option>
            {uniqueFeatures.map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>

        {/* Status Select */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>Request Status</label>
          <select
            value={filters.status}
            onChange={e => updateField('status', e.target.value as any)}
            style={{ padding: '4px 6px', border: '1px solid #C4B9A7', borderRadius: '4px', background: '#FCFAF6', fontSize: '0.7rem', outline: 'none' }}
          >
            <option value="all">All Statuses</option>
            <option value="success">Successful (Live)</option>
            <option value="cached">Cached Responses</option>
            <option value="failed">Failed / Errored</option>
          </select>
        </div>

      </div>

      {/* Filter status indicator */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem', color: 'var(--text-secondary)', background: '#FAF8F5', padding: '0.4rem 0.75rem', borderRadius: '4px', border: '1px solid #EAE4DA' }}>
        <div>
          <span>Showing <strong>{filteredCount.toLocaleString()}</strong> filtered execution events (from <strong>{totalCount.toLocaleString()}</strong> total events recorded).</span>
        </div>
        {isFiltered && (
          <div style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>
            ⚡ Dynamic filter applied across all KPI charts, leaderboards, and logs
          </div>
        )}
      </div>
    </div>
  );
};

export const filterTelemetryRecords = (timeline: TelemetryRecord[], filters: OpsFilterState): TelemetryRecord[] => {
  const now = Date.now();
  let startTime = 0;
  let endTime = Infinity;

  if (filters.timeRange === '24h') startTime = now - 24 * 3600 * 1000;
  else if (filters.timeRange === '7d') startTime = now - 7 * 24 * 3600 * 1000;
  else if (filters.timeRange === '30d') startTime = now - 30 * 24 * 3600 * 1000;
  else if (filters.timeRange === '90d') startTime = now - 90 * 24 * 3600 * 1000;
  else if (filters.timeRange === 'custom') {
    if (filters.customStartDate) startTime = new Date(filters.customStartDate).getTime();
    if (filters.customEndDate) endTime = new Date(filters.customEndDate).getTime() + 86399999;
  }

  return timeline.filter(rec => {
    // Time check
    const recTime = new Date(rec.timestamp).getTime();
    if (recTime < startTime || recTime > endTime) return false;

    // Provider check
    if (filters.provider !== 'all') {
      const isGoogle = !rec.provider || rec.provider === 'google' || rec.selectedModel?.includes('gemini');
      if (filters.provider === 'google' && !isGoogle) return false;
      if (filters.provider !== 'google' && rec.provider !== filters.provider) return false;
    }

    // Model check
    if (filters.model !== 'all' && rec.selectedModel !== filters.model && rec.fallbackModel !== filters.model) return false;

    // User check
    if (filters.user !== 'all' && rec.user !== filters.user) return false;

    // Workspace check
    if (filters.workspace !== 'all' && rec.workspace !== filters.workspace) return false;

    // Feature check
    if (filters.feature !== 'all' && rec.feature !== filters.feature) return false;

    // Status check
    if (filters.status === 'success' && (!rec.success || rec.cachedResponse)) return false;
    if (filters.status === 'failed' && rec.success) return false;
    if (filters.status === 'cached' && !rec.cachedResponse) return false;

    // Search query check
    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      const match = (rec.feature || '').toLowerCase().includes(q) ||
        (rec.user || '').toLowerCase().includes(q) ||
        (rec.workspace || '').toLowerCase().includes(q) ||
        (rec.selectedModel || '').toLowerCase().includes(q) ||
        (rec.fallbackModel || '').toLowerCase().includes(q) ||
        (rec.errorClassification || '').toLowerCase().includes(q);
      if (!match) return false;
    }

    return true;
  });
};
