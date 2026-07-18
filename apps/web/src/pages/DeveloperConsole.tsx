import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { AdminService } from '../services/adminService';
import type { AuditLogEntry, PlatformHealthStatus, APIUsageStatistics, SystemQueueStatus } from '../services/adminService';
import type { UserRole } from '../../../backend/src/index';
import { 
  Activity, 
  Terminal, 
  Users, 
  Shield, 
  RefreshCw, 
  Search, 
  Lock, 
  Clock, 
  Sliders,
  Cpu
} from 'lucide-react';
import { AIOrchestratorDashboard } from '../components/AIOrchestratorDashboard';

const ApiErrorDisplay: React.FC<{
  endpoint: string;
  error: { status: string; message: string } | null;
  onRetry: () => void;
}> = ({ endpoint, error, onRetry }) => {
  if (!error) return null;
  return (
    <div className="card" style={{ padding: '2rem', border: '1px solid var(--color-danger-border)', background: 'var(--color-danger-bg)', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', textAlign: 'center', margin: '1.5rem 0', borderRadius: '8px', boxShadow: 'var(--shadow-subtle)' }}>
      <strong style={{ color: 'var(--color-danger-text)', fontSize: '1.1rem', fontFamily: 'var(--font-sans)' }}>API Connection Error</strong>
      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
        Unable to load platform data.
      </p>
      <div style={{ background: '#fff', border: '1px solid #E2DACD', padding: '0.75rem 1rem', width: '100%', maxWidth: '400px', fontSize: '0.75rem', textAlign: 'left', fontFamily: 'var(--font-mono)', borderRadius: '6px' }}>
        <div><strong>Endpoint:</strong> {endpoint}</div>
        <div><strong>Status:</strong> {error.status}</div>
        <div style={{ marginTop: '0.25rem', color: 'var(--text-secondary)' }}><strong>Error Message:</strong> {error.message}</div>
      </div>
      <button onClick={onRetry} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#FCFAF6', border: '1px solid #C4B9A7', borderRadius: '6px' }}>
        <RefreshCw size={12} /> Retry Request
      </button>
    </div>
  );
};

export const DeveloperConsole: React.FC = () => {
  const { profile, isMockMode } = useAuth();
  const [activeTab, setActiveTab] = useState<'Health' | 'Queues' | 'Users' | 'FeatureFlags' | 'AuditLogs' | 'AIOrchestrator'>('Health');
  
  // Dashboard Metrics
  const [health, setHealth] = useState<PlatformHealthStatus | null>(null);
  const [apiAnalytics, setApiAnalytics] = useState<APIUsageStatistics | null>(null);
  const [queues, setQueues] = useState<SystemQueueStatus | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // User Admin
  const [usersList, setUsersList] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [userDetails, setUserDetails] = useState<any | null>(null);
  const [loadingUser, setLoadingUser] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  
  // Edit Profile States
  const [editRole, setEditRole] = useState<UserRole>('FREE');
  const [editTier, setEditTier] = useState('free');
  const [editSuspended, setEditSuspended] = useState(false);
  const [editLimitBusinessOS, setEditLimitBusinessOS] = useState<string>('');
  const [editLimitLive, setEditLimitLive] = useState<string>('');
  const [editLimitDeep, setEditLimitDeep] = useState<string>('');
  const [editFeatureFlags, setEditFeatureFlags] = useState<Record<string, boolean>>({});
  const [editResetUsage, setEditResetUsage] = useState(false);
  const [editForceLogout, setEditForceLogout] = useState(false);
  const [editReason, setEditReason] = useState('');
  const [savingUser, setSavingUser] = useState(false);

  // Feature Flags
  const [globalFlags, setGlobalFlags] = useState<any>(null);
  const [savingFlags, setSavingFlags] = useState(false);
  const [overrideRole, setOverrideRole] = useState<UserRole>('PRO');
  const [overrideFlag, setOverrideFlag] = useState<string>('betaFeatures');
  const [overrideValue, setOverrideValue] = useState<boolean>(true);

  // Audit Logs
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditFilter, setAuditFilter] = useState('');
  const [loadingLogs, setLoadingLogs] = useState(false);

  // API Connection Errors (Phase 3 Requirement)
  const [statsError, setStatsError] = useState<{ status: string; message: string } | null>(null);
  const [usersError, setUsersError] = useState<{ status: string; message: string } | null>(null);
  const [flagsError, setFlagsError] = useState<{ status: string; message: string } | null>(null);
  const [logsError, setLogsError] = useState<{ status: string; message: string } | null>(null);

  const fallbackHealthWhenUnreachable = {
    firestore: { status: 'unknown', latency: 0 },
    finnhub: { status: 'unknown', latency: 0 },
    gemini: { status: 'unknown', latency: 0 },
    openrouter: { status: 'unknown', latency: 0 },
    fred: { status: 'unknown', latency: 0 },
    secEdgar: { status: 'unknown', latency: 0 }
  };

  const fallbackAnalytics = {
    gemini: { error: 'Backend unreachable' },
    finnhub: { requestsToday: 0, hitRate: 0, count429: 0, latency: 0 },
    fred: { cachedIndicators: 0, lastRefresh: '' },
    sec: { companiesCached: 0, filingsCached: 0, lastIngestion: '', queueHealth: 'unknown' }
  };

  const fallbackQueues = {
    secIngestion: { status: 'unknown', lastExecution: '', duration: 0, pending: 0, failures: 0, retries: 0 },
    fredRefresh: { status: 'unknown', lastExecution: '', duration: 0, pending: 0, failures: 0, retries: 0 },
    newsIngestion: { status: 'unknown', lastExecution: '', duration: 0, pending: 0, failures: 0, retries: 0 },
    researchCache: { status: 'unknown', lastExecution: '', duration: 0, pending: 0, failures: 0, retries: 0 },
    dailyDispatch: { status: 'unknown', lastExecution: '', duration: 0, pending: 0, failures: 0, retries: 0 },
    emailQueue: { status: 'unknown', lastExecution: '', duration: 0, pending: 0, failures: 0, retries: 0 }
  };

  const parseApiError = (e: any) => {
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
    return { status, message: msg };
  };

  const loadStats = async () => {
    setLoadingStats(true);
    setStatsError(null);
    try {
      const data = await AdminService.getSystemStats(isMockMode);
      setHealth(data.health);
      setApiAnalytics(data.apiAnalytics);
      setQueues(data.queues);
    } catch (e: any) {
      console.error(e);
      setStatsError(parseApiError(e));
    } finally {
      setLoadingStats(false);
    }
  };

  const loadUsers = async () => {
    setUsersError(null);
    try {
      const data = await AdminService.listUsers(isMockMode);
      setUsersList(data);
    } catch (e: any) {
      console.error(e);
      setUsersError(parseApiError(e));
    }
  };

  const loadGlobalFlags = async () => {
    setFlagsError(null);
    try {
      const flags = await AdminService.getGlobalFeatureFlags(isMockMode);
      setGlobalFlags(flags);
    } catch (e: any) {
      console.error(e);
      setFlagsError(parseApiError(e));
    }
  };

  const loadAuditLogs = async () => {
    setLoadingLogs(true);
    setLogsError(null);
    try {
      const logs = await AdminService.getAuditLogs(isMockMode);
      setAuditLogs(logs);
    } catch (e: any) {
      console.error(e);
      setLogsError(parseApiError(e));
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (profile?.role === 'OWNER' || profile?.role === 'ADMIN') {
      loadStats();
      loadUsers();
      loadGlobalFlags();
      loadAuditLogs();
    }
  }, [profile, isMockMode]);

  const handleSelectUser = async (targetUser: any) => {
    setSelectedUser(targetUser);
    setLoadingUser(true);
    setEditReason('');
    try {
      const data = await AdminService.getUserDetails(targetUser.uid, isMockMode);
      setUserDetails(data);
      setEditRole(data.profile.role || 'FREE');
      setEditTier(data.profile.subscriptionTier || 'free');
      setEditSuspended(!!data.profile.suspended);
      setEditLimitBusinessOS(data.profile.customLimits?.businessos?.toString() || '');
      setEditLimitLive(data.profile.customLimits?.live?.toString() || '');
      setEditLimitDeep(data.profile.customLimits?.deep?.toString() || '');
      setEditFeatureFlags(data.profile.featureFlags || {});
      setEditResetUsage(false);
      setEditForceLogout(false);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingUser(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !editReason.trim() || savingUser) return;
    if (!confirm('CONFIRM CHANGE: You are updating critical credentials and plans for this account. Proceed?')) return;

    setSavingUser(true);
    try {
      const updated = await AdminService.updateUserProfile(selectedUser.uid, {
        role: editRole,
        subscriptionTier: editTier,
        suspended: editSuspended,
        customLimits: {
          businessos: editLimitBusinessOS === '' ? undefined : (editLimitBusinessOS === 'unlimited' ? 'unlimited' : parseInt(editLimitBusinessOS)),
          live: editLimitLive === '' ? undefined : (editLimitLive === 'unlimited' ? 'unlimited' : parseInt(editLimitLive)),
          deep: editLimitDeep === '' ? undefined : (editLimitDeep === 'unlimited' ? 'unlimited' : parseInt(editLimitDeep))
        },
        featureFlags: editFeatureFlags,
        resetUsage: editResetUsage,
        forceLogout: editForceLogout,
        reason: editReason
      }, isMockMode);
      
      alert('User updated successfully');
      setEditReason('');
      loadUsers();
      handleSelectUser(updated.profile || selectedUser);
    } catch (err: any) {
      alert('Update failed: ' + err.message);
    } finally {
      setSavingUser(false);
    }
  };

  const handleUpdateGlobalFlags = async (flagKey: string, val: boolean) => {
    if (!globalFlags || savingFlags) return;
    const nextFlags = { ...globalFlags, [flagKey]: val };
    setSavingFlags(true);
    try {
      await AdminService.updateGlobalFeatureFlags(nextFlags, isMockMode);
      setGlobalFlags(nextFlags);
      loadAuditLogs();
    } catch (err: any) {
      alert('Flag update failed.');
    } finally {
      setSavingFlags(false);
    }
  };

  const handleCreateRoleOverride = async () => {
    if (!globalFlags || savingFlags) return;
    const key = `${overrideRole}_${overrideFlag}`;
    const nextFlags = { ...globalFlags, [key]: overrideValue };
    setSavingFlags(true);
    try {
      await AdminService.updateGlobalFeatureFlags(nextFlags, isMockMode);
      setGlobalFlags(nextFlags);
      loadAuditLogs();
      alert('Role default override set successfully.');
    } catch {
      alert('Failed to set role override.');
    } finally {
      setSavingFlags(false);
    }
  };

  const handleDeleteRoleOverride = async (key: string) => {
    if (!globalFlags || savingFlags) return;
    if (!confirm(`CONFIRM: Delete default override for key ${key}? This will fall back to code/global default.`)) return;
    const nextFlags = { ...globalFlags };
    delete nextFlags[key];
    setSavingFlags(true);
    try {
      await AdminService.updateGlobalFeatureFlags(nextFlags, isMockMode);
      setGlobalFlags(nextFlags);
      loadAuditLogs();
    } catch {
      alert('Failed to delete role override.');
    } finally {
      setSavingFlags(false);
    }
  };

  if (profile?.role !== 'OWNER' && profile?.role !== 'ADMIN') {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', background: '#111', minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Lock size={48} style={{ color: 'var(--color-danger-text)', marginBottom: '1.5rem' }} />
        <h2 style={{ color: '#fff', border: 'none', padding: 0 }}>Bloomberg Terminal Access Restricted</h2>
        <p style={{ color: '#888', maxWidth: '400px', fontSize: '0.85rem' }}>
          Your role profile is classified as <b>{profile?.role || 'GUEST'}</b>. Operational controls are restricted to the <b>OWNER</b> and <b>ADMIN</b> branches.
        </p>
      </div>
    );
  }

  // Filter users
  const filteredUsers = usersList.filter(u => 
    (u.email || '').toLowerCase().includes(userSearch.toLowerCase()) || 
    (u.displayName || '').toLowerCase().includes(userSearch.toLowerCase())
  );

  const filteredLogs = auditLogs.filter(log => 
    (log.action || '').toLowerCase().includes(auditFilter.toLowerCase()) ||
    (log.adminEmail || '').toLowerCase().includes(auditFilter.toLowerCase()) ||
    (log.targetUserId || '').toLowerCase().includes(auditFilter.toLowerCase())
  );

  const displayHealth = (health || fallbackHealthWhenUnreachable) as any;
  const displayAnalytics = (apiAnalytics || fallbackAnalytics) as any;
  const displayQueues = (queues || fallbackQueues) as any;

  return (
    <div className="scrollable-page">
      <div style={{ animation: 'fadeIn 0.25s ease-out', textAlign: 'left' }}>
      
      {/* Header operations center */}
      <div style={{ borderBottom: '2px solid var(--color-primary)', paddingBottom: '1.25rem', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <span style={{ color: 'var(--color-accent)', fontSize: '0.65rem', border: '1px solid var(--color-accent)', padding: '2px 6px', display: 'inline-block', marginBottom: '0.5rem', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>
            OPERATIONS SECURE INTERFACE (OWNER / ADMIN ONLY)
          </span>
          <h1 style={{ border: 'none', margin: 0, padding: 0, fontSize: '2.5rem', display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-primary)', fontFamily: 'var(--font-serif)', fontWeight: 'normal' }}>
            <Terminal size={28} style={{ color: 'var(--color-accent)' }} /> Operations Console
          </h1>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button onClick={() => { loadStats(); loadUsers(); loadAuditLogs(); }} className="btn btn-sm btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}>
            <RefreshCw size={12} /> Sync Operational Logs
          </button>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>MODE: {isMockMode ? 'MOCK LOCAL' : 'CLOUDFLARE EDGE'}</span>
        </div>
      </div>

      {/* Stats Quick-Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div className="card" style={{ padding: '1rem 1.25rem', background: '#fff', border: '1px solid #E2DACD', display: 'flex', flexDirection: 'column', gap: '0.25rem', borderRadius: '8px', boxShadow: 'var(--shadow-subtle)' }}>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-mono)' }}>
            Firestore Latency
          </span>
          <strong style={{ fontSize: '1.5rem', color: health?.firestore?.status === 'operational' ? 'var(--color-success-text)' : 'var(--color-danger-text)', fontFamily: 'var(--font-serif)', fontWeight: 'normal' }}>
            {health?.firestore?.latency || 0} ms
          </strong>
        </div>
        <div className="card" style={{ padding: '1rem 1.25rem', background: '#fff', border: '1px solid #E2DACD', display: 'flex', flexDirection: 'column', gap: '0.25rem', borderRadius: '8px', boxShadow: 'var(--shadow-subtle)' }}>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-mono)' }}>
            Gemini Daily Tokens
          </span>
          <strong style={{ fontSize: '1.5rem', color: 'var(--text-primary)', fontFamily: 'var(--font-serif)', fontWeight: 'normal' }}>
            {(apiAnalytics?.gemini?.totalTokens ?? apiAnalytics?.gemini?.totalTokensToday ?? 0).toLocaleString()}
          </strong>
        </div>
        <div className="card" style={{ padding: '1rem 1.25rem', background: '#fff', border: '1px solid #E2DACD', display: 'flex', flexDirection: 'column', gap: '0.25rem', borderRadius: '8px', boxShadow: 'var(--shadow-subtle)' }}>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-mono)' }}>
            Finnhub Requests
          </span>
          <strong style={{ fontSize: '1.5rem', color: 'var(--text-primary)', fontFamily: 'var(--font-serif)', fontWeight: 'normal' }}>
            {apiAnalytics?.finnhub?.requestsToday || 0} / 3000
          </strong>
        </div>
        <div className="card" style={{ padding: '1rem 1.25rem', background: '#fff', border: '1px solid #E2DACD', display: 'flex', flexDirection: 'column', gap: '0.25rem', borderRadius: '8px', boxShadow: 'var(--shadow-subtle)' }}>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-mono)' }}>
            Queue Health
          </span>
          <strong style={{ fontSize: '1.5rem', color: 'var(--color-success-text)', fontFamily: 'var(--font-serif)', fontWeight: 'normal' }}>
            {apiAnalytics?.sec?.queueHealth?.toUpperCase() || 'HEALTHY'}
          </strong>
        </div>
      </div>

      {/* Tab selection menu */}
      <div style={{ display: 'flex', gap: '0.25rem', borderBottom: '1px solid #E2DACD', marginBottom: '2rem', flexWrap: 'wrap', overflowX: 'auto' }}>
        {([
          { id: 'Health', label: 'Overview (NOC)', icon: Activity },
          { id: 'Queues', label: 'Background Jobs', icon: Clock },
          { id: 'Users', label: 'User Directory', icon: Users },
          { id: 'FeatureFlags', label: 'Global Flags', icon: Sliders },
          { id: 'AuditLogs', label: 'Audit Trail Logs', icon: Shield },
          { id: 'AIOrchestrator', label: 'AI Operations Center', icon: Cpu }
        ] as const).map(tab => {
          const isTabActive = activeTab === tab.id;
          return (
            <button 
              key={tab.id} 
              onClick={() => setActiveTab(tab.id)} 
              style={{
                padding: '0.65rem 1rem',
                border: '1px solid transparent',
                borderBottom: 'none',
                fontFamily: 'var(--font-sans)',
                fontWeight: isTabActive ? 'bold' : 500,
                fontSize: '0.8rem',
                background: isTabActive ? '#FAF8F5' : 'transparent',
                borderColor: isTabActive ? '#E2DACD' : 'transparent',
                color: isTabActive ? 'var(--color-accent)' : 'var(--text-secondary)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease-in-out',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <tab.icon size={13} style={{ color: isTabActive ? 'var(--color-accent)' : 'var(--text-muted)' }} /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* Loading bar */}
      {loadingStats && activeTab === 'Health' && (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Querying operational console nodes...</div>
      )}

      {/* Tab 1: System Operations Center (NOC Overview) */}
      {activeTab === 'Health' && statsError && !statsError.status?.includes("Network Error") && (
        <ApiErrorDisplay endpoint="/api/admin/system-stats" error={statsError} onRetry={loadStats} />
      )}
      {activeTab === 'Health' && (!statsError || statsError.status?.includes("Network Error")) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {statsError && statsError.status?.includes("Network Error") && (
            <div style={{
              background: '#FFF5F5',
              border: '1px solid #FEB2B2',
              color: '#C53030',
              padding: '1rem',
              borderRadius: '6px',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              <span style={{ fontWeight: 'bold' }}>⚠️ BACKEND UNREACHABLE (CORS BLOCKED)</span>
              <span>The operations console cannot communicate with the Cloudflare Worker backend. Verify the backend service is deployed and running. Tracing path failed.</span>
            </div>
          )}
          
          {/* Top 2x2 Grid: Health Matrix & AI Overview */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
            
            {/* Panel 1: NOC Health Matrix */}
            <div className="card" style={{ background: '#fff', padding: '1.5rem', border: '1px solid #E2DACD', display: 'flex', flexDirection: 'column', gap: '1rem', boxShadow: 'var(--shadow-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E2DACD', paddingBottom: '0.75rem' }}>
                <h3 style={{ margin: 0, padding: 0, border: 'none', color: 'var(--text-primary)', fontSize: '1.1rem', fontFamily: 'var(--font-serif)', fontWeight: 'normal', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Activity size={18} style={{ color: 'var(--color-accent)' }} /> NOC Health Matrix
                </h3>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>9 NODES MONITORED</span>
              </div>
              
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--color-primary)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                    <th style={{ padding: '0.5rem' }}>Service Node</th>
                    <th style={{ padding: '0.5rem' }}>Status</th>
                    <th style={{ padding: '0.5rem', textAlign: 'right' }}>Latency</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(displayHealth).map(([node, detail]: any) => {
                    const s = (detail?.status || '').toLowerCase();
                    const isGreen = ['operational', 'available', 'healthy'].includes(s);
                    const isOrange = ['degraded', 'cache_empty', 'waiting_for_scheduled_sync'].includes(s);
                    const isGray = ['not_configured'].includes(s);
                    const color = isGreen 
                      ? 'var(--color-success-text)' 
                      : isOrange 
                        ? 'var(--color-warning-text)' 
                        : isGray 
                          ? 'var(--text-muted)' 
                          : 'var(--color-danger-text)';
                    
                    return (
                      <tr key={node} style={{ borderBottom: '1px solid #E2DACD' }}>
                        <td style={{ padding: '0.6rem 0.5rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                          {node.toUpperCase()}
                        </td>
                        <td style={{ padding: '0.6rem 0.5rem' }}>
                          <span style={{ color, fontWeight: 'bold' }}>
                            ● {(detail?.status || '').toUpperCase().replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td style={{ padding: '0.6rem 0.5rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>
                          {detail?.latency || 0} ms
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Panel 2: AI Orchestrator Overview */}
            <div className="card" style={{ background: '#fff', padding: '1.5rem', border: '1px solid #E2DACD', display: 'flex', flexDirection: 'column', gap: '1rem', boxShadow: 'var(--shadow-subtle)', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E2DACD', paddingBottom: '0.75rem' }}>
                  <h3 style={{ margin: 0, padding: 0, border: 'none', color: 'var(--text-primary)', fontSize: '1.1rem', fontFamily: 'var(--font-serif)', fontWeight: 'normal', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Cpu size={18} style={{ color: 'var(--color-accent)' }} /> AI Orchestrator Overview
                  </h3>
                  <button onClick={() => setActiveTab('AIOrchestrator')} className="btn btn-sm btn-secondary" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
                    View Operations Center →
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #E2DACD', paddingBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Primary Routing Model:</span>
                    <strong style={{ color: 'var(--text-primary)' }}>Gemini 3.5 Flash</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #E2DACD', paddingBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Active Fallback Model:</span>
                    <strong style={{ color: 'var(--text-primary)' }}>Gemini 3.1 Pro</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #E2DACD', paddingBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Total Daily Requests:</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{displayAnalytics.gemini?.requestsToday ?? 0} calls</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #E2DACD', paddingBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Total Daily Tokens:</span>
                    <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{(displayAnalytics.gemini?.totalTokens ?? displayAnalytics.gemini?.totalTokensToday ?? 0).toLocaleString()}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #E2DACD', paddingBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Daily Cost Estimate:</span>
                    <strong style={{ color: 'var(--color-success-text)', fontSize: '1rem' }}>${(displayAnalytics.gemini?.dailyCost ?? 0).toFixed(4)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.25rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Prompt Cache Hit Ratio:</span>
                    <strong style={{ color: 'var(--color-warning-text)' }}>{displayAnalytics.gemini?.hitRate ?? displayAnalytics.gemini?.cacheHitRate ?? 0}%</strong>
                  </div>
                </div>
              </div>

              <div style={{ background: '#FAF8F5', border: '1px solid #E2DACD', padding: '0.75rem', fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                <span>Source: <strong>BusinessOS Edge Telemetry</strong></span>
                <span>Status: <strong style={{ color: 'var(--color-success-text)' }}>LIVE MONITORING</strong></span>
              </div>
            </div>

          </div>

          {/* Bottom 2x2 Grid: Active Job Queues & Data Quality */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
            
            {/* Panel 3: Active Job Queues */}
            <div className="card" style={{ background: '#fff', padding: '1.5rem', border: '1px solid #E2DACD', display: 'flex', flexDirection: 'column', gap: '1rem', boxShadow: 'var(--shadow-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E2DACD', paddingBottom: '0.75rem' }}>
                <h3 style={{ margin: 0, padding: 0, border: 'none', color: 'var(--text-primary)', fontSize: '1.1rem', fontFamily: 'var(--font-serif)', fontWeight: 'normal', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={18} style={{ color: 'var(--color-accent)' }} /> Active Job Queues
                </h3>
                <button onClick={() => setActiveTab('Queues')} className="btn btn-sm btn-secondary" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
                  Manage Queues →
                </button>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--color-primary)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                    <th style={{ padding: '0.5rem' }}>Job Worker</th>
                    <th style={{ padding: '0.5rem' }}>Status</th>
                    <th style={{ padding: '0.5rem' }}>Last Run</th>
                    <th style={{ padding: '0.5rem', textAlign: 'right' }}>Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {displayQueues && Object.entries(displayQueues).map(([key, q]: any) => {
                    const status = (q?.status || 'idle').toLowerCase();
                    const isGreen = ['idle', 'success', 'healthy', 'completed'].includes(status);
                    const isOrange = ['running', 'degraded', 'awaiting_first_execution'].includes(status);
                    const color = isGreen ? 'var(--color-success-text)' : isOrange ? 'var(--color-warning-text)' : 'var(--color-danger-text)';
                    
                    return (
                      <tr key={key} style={{ borderBottom: '1px solid #E2DACD' }}>
                        <td style={{ padding: '0.6rem 0.5rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                          {key}
                        </td>
                        <td style={{ padding: '0.6rem 0.5rem' }}>
                          <span style={{ color, fontWeight: 'bold' }}>● {status.toUpperCase().replace(/_/g, ' ')}</span>
                          {q?.failures > 0 && <span style={{ color: 'var(--color-danger-text)', fontSize: '0.7rem', marginLeft: '6px' }}>({q.failures} fail)</span>}
                        </td>
                        <td style={{ padding: '0.6rem 0.5rem', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                          {q?.lastExecution ? new Date(q.lastExecution).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never'}
                        </td>
                        <td style={{ padding: '0.6rem 0.5rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>
                          {q?.duration || 0}s
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Panel 4: Real-Time Audit Trail & Cache Quality */}
            <div className="card" style={{ background: '#fff', padding: '1.5rem', border: '1px solid #E2DACD', display: 'flex', flexDirection: 'column', gap: '1rem', boxShadow: 'var(--shadow-subtle)', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E2DACD', paddingBottom: '0.75rem' }}>
                  <h3 style={{ margin: 0, padding: 0, border: 'none', color: 'var(--text-primary)', fontSize: '1.1rem', fontFamily: 'var(--font-serif)', fontWeight: 'normal', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Shield size={18} style={{ color: 'var(--color-accent)' }} /> Real-Time Audit & Quality
                  </h3>
                  <button onClick={() => setActiveTab('AuditLogs')} className="btn btn-sm btn-secondary" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
                    View Full Trail →
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.8rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #E2DACD', paddingBottom: '0.35rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>FRED Economic Cache:</span> 
                    <strong style={{ color: 'var(--text-primary)' }}>{displayAnalytics?.fred?.cachedIndicators ?? 0} indicators</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #E2DACD', paddingBottom: '0.35rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>SEC EDGAR Coverage:</span> 
                    <strong style={{ color: 'var(--text-primary)' }}>{displayAnalytics?.sec?.companiesCached ?? 0} companies ({displayAnalytics?.sec?.filingsCached ?? 0} filings)</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #E2DACD', paddingBottom: '0.35rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Finnhub Rate Limits (429s):</span> 
                    <strong style={{ color: 'var(--color-success-text)' }}>{displayAnalytics?.finnhub?.count429 ?? 0} errors today</strong>
                  </div>
                </div>

                <div style={{ marginTop: '0.5rem' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', display: 'block', marginBottom: '0.5rem' }}>Recent Administrative Events</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '120px', overflowY: 'auto' }}>
                    {auditLogs.length > 0 ? (
                      auditLogs.slice(0, 4).map((log, i) => (
                        <div key={i} style={{ fontSize: '0.75rem', padding: '0.35rem 0.5rem', background: '#FAF8F5', borderLeft: '3px solid var(--color-accent)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{log.action}</span>
                          <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>
                            {log.timestamp ? new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '0.5rem' }}>No recent audit trail events recorded today.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* Tab 2: System Queue status */}
      {activeTab === 'Queues' && statsError && !statsError.status?.includes("Network Error") && (
        <ApiErrorDisplay endpoint="/api/admin/system-stats" error={statsError} onRetry={loadStats} />
      )}
      {activeTab === 'Queues' && (!statsError || statsError.status?.includes("Network Error")) && displayQueues && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {statsError && statsError.status?.includes("Network Error") && (
            <div style={{
              background: '#FFF5F5',
              border: '1px solid #FEB2B2',
              color: '#C53030',
              padding: '1rem',
              borderRadius: '6px',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              <span style={{ fontWeight: 'bold' }}>⚠️ BACKEND UNREACHABLE (CORS BLOCKED)</span>
              <span>The operations console cannot communicate with the Cloudflare Worker backend. Verify the backend service is deployed and running. Tracing path failed.</span>
            </div>
          )}
          <div className="card" style={{ background: '#fff', padding: '1.5rem', border: '1px solid #E2DACD', boxShadow: 'var(--shadow-subtle)' }}>
          <h3 style={{ margin: '0 0 1.25rem 0', padding: 0, border: 'none', color: 'var(--text-primary)', fontSize: '1.1rem', fontFamily: 'var(--font-serif)', fontWeight: 'normal' }}>System Job Queue Dashboard</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-primary)', color: 'var(--text-secondary)', textAlign: 'left', fontWeight: 'bold' }}>
                <th style={{ padding: '0.5rem' }}>Job Name</th>
                <th style={{ padding: '0.5rem' }}>Current Status</th>
                <th style={{ padding: '0.5rem' }}>Last Run</th>
                <th style={{ padding: '0.5rem' }}>Next Run</th>
                <th style={{ padding: '0.5rem' }}>Duration (s)</th>
                <th style={{ padding: '0.5rem' }}>Queue Depth</th>
                <th style={{ padding: '0.5rem' }}>Failures</th>
                <th style={{ padding: '0.5rem' }}>Retries</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(displayQueues || {}).map(([key, q]: any) => {
                if (!q) return null;
                let nextExecution = '—';
                if (q.lastExecution) {
                  const lastTime = new Date(q.lastExecution).getTime();
                  if (key === 'secIngestion') {
                    nextExecution = new Date(lastTime + 30 * 60 * 1000).toLocaleTimeString();
                  } else if (key === 'fredRefresh') {
                    nextExecution = new Date(lastTime + 24 * 60 * 60 * 1000).toLocaleString();
                  } else if (key === 'newsIngestion') {
                    nextExecution = new Date(lastTime + 60 * 60 * 1000).toLocaleTimeString();
                  } else {
                    nextExecution = new Date(lastTime + 15 * 60 * 1000).toLocaleTimeString();
                  }
                }
                const statusStr = q.status || 'unknown';
                return (
                  <tr key={key} style={{ borderBottom: '1px solid #E2DACD' }}>
                    <td style={{ padding: '0.75rem 0.5rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{key.replace(/([A-Z])/g, ' $1').toUpperCase()}</td>
                    <td style={{ padding: '0.75rem 0.5rem' }}><span style={{ color: 'var(--color-success-text)', fontWeight: 'bold' }}>{statusStr.toUpperCase()}</span></td>
                    <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{q.lastExecution ? new Date(q.lastExecution).toLocaleTimeString() : '—'}</td>
                    <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{nextExecution}</td>
                    <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{q.duration || 0}s</td>
                    <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{q.pending || 0}</td>
                    <td style={{ padding: '0.75rem 0.5rem', color: (q.failures || 0) > 0 ? 'var(--color-danger-text)' : 'inherit', fontFamily: 'var(--font-mono)' }}>{q.failures || 0}</td>
                    <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{q.retries || 0}</td>
                  </tr>
                );
              })}
              {(!displayQueues || Object.keys(displayQueues).length === 0) && (
                <tr>
                  <td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No background jobs have executed.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Tab 3: User Administration Directories */}
      {activeTab === 'Users' && usersError && (
        <ApiErrorDisplay endpoint="/api/admin/users" error={usersError} onRetry={loadUsers} />
      )}
      {activeTab === 'Users' && !usersError && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          
          {/* List Users panel */}
          <div className="card" style={{ background: '#fff', padding: '1.5rem', border: '1px solid #E2DACD', display: 'flex', flexDirection: 'column', gap: '1rem', boxShadow: 'var(--shadow-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, padding: 0, border: 'none', color: 'var(--text-primary)', fontSize: '1.1rem', fontFamily: 'var(--font-serif)', fontWeight: 'normal' }}>Registered Accounts</h3>
              <div style={{ position: 'relative' }}>
                <input 
                  type="text" 
                  placeholder="Filter users..." 
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  style={{ padding: '0.35rem 0.5rem 0.35rem 1.5rem', fontSize: '0.75rem', background: '#FCFAF6', border: '1px solid #E2DACD', color: 'var(--text-primary)', outline: 'none' }}
                />
                <Search size={12} style={{ position: 'absolute', left: '0.5rem', top: '0.55rem', color: 'var(--text-muted)' }} />
              </div>
            </div>

            <div style={{ overflowY: 'auto', maxHeight: '420px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--color-primary)', color: 'var(--text-secondary)', fontWeight: 'bold' }}>
                    <th style={{ padding: '0.5rem' }}>Email / Name</th>
                    <th style={{ padding: '0.5rem' }}>Role</th>
                    <th style={{ padding: '0.5rem' }}>Plan</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(u => (
                    <tr 
                      key={u.uid} 
                      onClick={() => handleSelectUser(u)}
                      style={{ 
                        borderBottom: '1px solid #E2DACD', 
                        cursor: 'pointer', 
                        background: selectedUser?.uid === u.uid ? '#FAF8F5' : 'transparent' 
                      }}
                    >
                      <td style={{ padding: '0.5rem' }}>
                        <strong style={{ display: 'block', color: u.suspended ? 'var(--color-danger-text)' : 'var(--text-primary)' }}>{u.displayName || 'Unnamed User'}</strong>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{u.email}</span>
                      </td>
                      <td style={{ padding: '0.5rem' }}>
                        <span style={{ fontSize: '0.65rem', border: '1px solid #C4B9A7', background: '#FCFAF6', padding: '1px 6px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>{u.role || 'FREE'}</span>
                      </td>
                      <td style={{ padding: '0.5rem' }}>
                        <span style={{ textTransform: 'uppercase', color: 'var(--text-secondary)' }}>{u.subscriptionTier || 'free'}</span>
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={3} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No users have signed into BusinessOS yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* User management Profile View panel */}
          <div className="card" style={{ background: '#fff', padding: '1.5rem', border: '1px solid #E2DACD', display: 'flex', flexDirection: 'column', gap: '1rem', boxShadow: 'var(--shadow-subtle)' }}>
            <h3 style={{ margin: 0, padding: 0, border: 'none', color: 'var(--text-primary)', fontSize: '1.1rem', fontFamily: 'var(--font-serif)', fontWeight: 'normal' }}>Account Control Console</h3>
            
            {loadingUser ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Querying Firestore record...</div>
            ) : userDetails ? (
              <form onSubmit={handleUpdateUser} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.8rem' }}>
                
                {/* Account details metadata grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', background: '#FCFAF6', padding: '1rem', border: '1px solid #E2DACD' }}>
                  <div style={{ color: 'var(--text-primary)' }}><span style={{ color: 'var(--text-secondary)' }}>Name:</span> <strong>{userDetails.profile.displayName || 'N/A'}</strong></div>
                  <div style={{ color: 'var(--text-primary)' }}><span style={{ color: 'var(--text-secondary)' }}>Email:</span> <strong>{userDetails.profile.email}</strong></div>
                  <div style={{ color: 'var(--text-primary)' }}><span style={{ color: 'var(--text-secondary)' }}>UID:</span> <strong style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)' }}>{userDetails.profile.uid}</strong></div>
                  <div style={{ color: 'var(--text-primary)' }}><span style={{ color: 'var(--text-secondary)' }}>Created:</span> <strong>{new Date(userDetails.profile.createdAt || '').toLocaleDateString()}</strong></div>
                  <div style={{ color: 'var(--text-primary)' }}><span style={{ color: 'var(--text-secondary)' }}>Last Login:</span> <strong>{userDetails.profile.lastLoginAt ? new Date(userDetails.profile.lastLoginAt).toLocaleString() : 'N/A'}</strong></div>
                  <div style={{ color: 'var(--text-primary)' }}><span style={{ color: 'var(--text-secondary)' }}>Current Role:</span> <strong style={{ color: 'var(--color-accent)' }}>{userDetails.profile.role || 'FREE'}</strong></div>
                  <div style={{ color: 'var(--text-primary)' }}><span style={{ color: 'var(--text-secondary)' }}>Subscription:</span> <strong style={{ textTransform: 'uppercase' }}>{userDetails.profile.subscriptionTier || 'free'}</strong></div>
                  <div style={{ color: 'var(--text-primary)' }}><span style={{ color: 'var(--text-secondary)' }}>Copilot Sessions:</span> <strong>{userDetails.sessionsCount}</strong></div>
                  <div style={{ color: 'var(--text-primary)' }}><span style={{ color: 'var(--text-secondary)' }}>Reports Compiled:</span> <strong>{userDetails.reportsCount || 0}</strong></div>
                  <div style={{ color: 'var(--text-primary)' }}><span style={{ color: 'var(--text-secondary)' }}>Dispatch Status:</span> <strong>{userDetails.dispatchStatus || 'Inactive'}</strong></div>
                  <div style={{ gridColumn: 'span 2', color: 'var(--text-primary)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Usage Today:</span> <strong style={{ fontFamily: 'var(--font-mono)' }}>{userDetails.usage.businessosCount} MI | {userDetails.usage.liveCount} Web | {userDetails.usage.deepCount || 0} Deep</strong>
                  </div>
                  <div style={{ gridColumn: 'span 2', color: 'var(--text-primary)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Suspended:</span> <strong style={{ color: userDetails.profile.suspended ? 'var(--color-danger-text)' : 'var(--color-success-text)' }}>{userDetails.profile.suspended ? 'YES' : 'NO'}</strong>
                  </div>
                  <div style={{ gridColumn: 'span 2', borderTop: '1px dashed #C4B9A7', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
                    <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.25rem', fontWeight: 'bold' }}>RESOLVED FEATURE FLAGS:</span>
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                      {userDetails.resolvedFlags ? (
                        Object.entries(userDetails.resolvedFlags).map(([k, val]) => (
                          <span key={k} style={{
                            background: val ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
                            color: val ? 'var(--color-success-text)' : 'var(--color-danger-text)',
                            border: `1px solid ${val ? 'var(--color-success-border)' : 'var(--color-danger-border)'}`,
                            fontSize: '0.65rem',
                            padding: '1px 4px',
                            fontFamily: 'var(--font-mono)'
                          }}>
                            {k}: {val ? 'ON' : 'OFF'}
                          </span>
                        ))
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>None resolved</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Promote/Demote Role selector */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Modify System Role:</label>
                  <select 
                    value={editRole} 
                    onChange={e => setEditRole(e.target.value as UserRole)}
                    style={{ padding: '0.4rem', background: '#FCFAF6', border: '1px solid #C4B9A7', color: 'var(--text-primary)', outline: 'none' }}
                  >
                    <option value="OWNER">OWNER</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="PRO">PRO</option>
                    <option value="FREE">FREE</option>
                    <option value="GUEST">GUEST</option>
                  </select>
                </div>

                {/* Subscription plan selector */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Subscription Plan Tier:</label>
                  <select 
                    value={editTier} 
                    onChange={e => setEditTier(e.target.value)}
                    style={{ padding: '0.4rem', background: '#FCFAF6', border: '1px solid #C4B9A7', color: 'var(--text-primary)', outline: 'none' }}
                  >
                    <option value="pro">Pro Plan</option>
                    <option value="free">Free Plan</option>
                    <option value="guest">Guest Trial</option>
                  </select>
                </div>

                {/* Custom limits overrides */}
                <div style={{ border: '1px solid #E2DACD', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', background: '#FCFAF6' }}>
                  <span style={{ fontWeight: 'bold', display: 'block', color: 'var(--text-primary)' }}>Custom Daily Limits Overrides (value or "unlimited"):</span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                    <div>
                      <label style={{ fontSize: '0.65rem', display: 'block', color: 'var(--text-secondary)' }}>BusinessOS</label>
                      <input 
                        type="text" 
                        value={editLimitBusinessOS} 
                        onChange={e => setEditLimitBusinessOS(e.target.value)}
                        placeholder="e.g. 50"
                        style={{ width: '100%', padding: '0.25rem', background: '#fff', border: '1px solid #C4B9A7', color: 'var(--text-primary)', outline: 'none' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.65rem', display: 'block', color: 'var(--text-secondary)' }}>Live Web</label>
                      <input 
                        type="text" 
                        value={editLimitLive} 
                        onChange={e => setEditLimitLive(e.target.value)}
                        placeholder="e.g. 10"
                        style={{ width: '100%', padding: '0.25rem', background: '#fff', border: '1px solid #C4B9A7', color: 'var(--text-primary)', outline: 'none' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.65rem', display: 'block', color: 'var(--text-secondary)' }}>Deep Research</label>
                      <input 
                        type="text" 
                        value={editLimitDeep} 
                        onChange={e => setEditLimitDeep(e.target.value)}
                        placeholder="e.g. 2"
                        style={{ width: '100%', padding: '0.25rem', background: '#fff', border: '1px solid #C4B9A7', color: 'var(--text-primary)', outline: 'none' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Individual feature flag overrides */}
                <div style={{ border: '1px solid #E2DACD', padding: '0.75rem', background: '#FCFAF6' }}>
                  <span style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.25rem', color: 'var(--text-primary)' }}>Individual Flag Overrides:</span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.7rem' }}>
                    {['copilot', 'quickMode', 'businessOSMode', 'liveWebMode', 'deepResearchMode', 'developerPanel', 'exportReports', 'betaFeatures', 'marketIntelligence', 'intelligenceHub'].map(flag => {
                      const isChecked = editFeatureFlags[flag] !== undefined ? editFeatureFlags[flag] : false;
                      return (
                        <label key={flag} style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', cursor: 'pointer', color: 'var(--text-primary)' }}>
                          <input 
                            type="checkbox" 
                            checked={isChecked}
                            onChange={e => setEditFeatureFlags(prev => ({ ...prev, [flag]: e.target.checked }))}
                          />
                          <span>{flag.replace(/([A-Z])/g, ' $1').toUpperCase()}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Administrative control checkboxes */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', border: '1px solid #E2DACD', padding: '0.75rem', background: '#FCFAF6' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input 
                      type="checkbox" 
                      id="editSuspended"
                      checked={editSuspended} 
                      onChange={e => setEditSuspended(e.target.checked)}
                    />
                    <label htmlFor="editSuspended" style={{ color: editSuspended ? 'var(--color-danger-text)' : 'var(--text-primary)', cursor: 'pointer', fontWeight: 500 }}>
                      Suspend account (Revoke access)
                    </label>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input 
                      type="checkbox" 
                      id="editResetUsage"
                      checked={editResetUsage} 
                      onChange={e => setEditResetUsage(e.target.checked)}
                    />
                    <label htmlFor="editResetUsage" style={{ cursor: 'pointer', color: 'var(--text-primary)', fontWeight: 500 }}>
                      Reset today's usage counters to zero
                    </label>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input 
                      type="checkbox" 
                      id="editForceLogout"
                      checked={editForceLogout} 
                      onChange={e => setEditForceLogout(e.target.checked)}
                    />
                    <label htmlFor="editForceLogout" style={{ cursor: 'pointer', color: 'var(--text-primary)', fontWeight: 500 }}>
                      Force logout from all devices
                    </label>
                  </div>
                </div>

                {/* Reason check */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Audit Reason (Required):</label>
                  <input 
                    type="text" 
                    placeholder="Enter reason for audit record compliance..." 
                    value={editReason}
                    onChange={e => setEditReason(e.target.value)}
                    required
                    style={{ padding: '0.4rem', background: '#FCFAF6', border: '1px solid #C4B9A7', color: 'var(--text-primary)', outline: 'none' }}
                  />
                </div>

                <button type="submit" disabled={savingUser || !editReason.trim()} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: '0.5rem' }}>
                  {savingUser ? <Activity className="animate-spin" size={14} /> : <Sliders size={14} />} Apply Modifications
                </button>
              </form>
            ) : (
              <div style={{ padding: '4rem 1rem', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed #C4B9A7', background: '#FCFAF6' }}>
                Select an account from the left directory column to adjust settings
              </div>
            )}

          </div>

        </div>
      )}

      {/* Tab 4: Feature Flags toggles */}
      {activeTab === 'FeatureFlags' && flagsError && (
        <ApiErrorDisplay endpoint="/api/admin/feature-flags/global" error={flagsError} onRetry={loadGlobalFlags} />
      )}
      {activeTab === 'FeatureFlags' && !flagsError && globalFlags && (
        <div className="card" style={{ background: '#fff', padding: '1.5rem', border: '1px solid #E2DACD', display: 'flex', flexDirection: 'column', gap: '1.2rem', boxShadow: 'var(--shadow-subtle)' }}>
          <div>
            <h3 style={{ margin: 0, padding: 0, border: 'none', color: 'var(--text-primary)', fontSize: '1.1rem', fontFamily: 'var(--font-serif)', fontWeight: 'normal' }}>Global Feature Flag Gates</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Toggle BusinessOS platform components globally for all users</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {Object.entries(globalFlags).filter(([k]) => !k.includes('_')).map(([key, val]: [string, any]) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.8rem', background: '#FCFAF6', border: '1px solid #E2DACD' }}>
                <div>
                  <strong style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 'bold' }}>{key.replace(/([A-Z])/g, ' $1').toUpperCase()}</strong>
                  <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-muted)' }}>Controlled by FeatureFlags resolver system</span>
                </div>

                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <button 
                    onClick={() => handleUpdateGlobalFlags(key, true)}
                    className={`btn btn-sm ${val ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.65rem', padding: '0.2rem 0.4rem' }}
                  >
                    ON
                  </button>
                  <button 
                    onClick={() => handleUpdateGlobalFlags(key, false)}
                    className={`btn btn-sm ${!val ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.65rem', padding: '0.2rem 0.4rem' }}
                  >
                    OFF
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Section: Staged Role Default Overrides */}
          <div style={{ borderTop: '1px dashed #C4B9A7', paddingTop: '1.2rem', marginTop: '0.8rem' }}>
            <h3 style={{ margin: '0 0 0.25rem 0', padding: 0, border: 'none', color: 'var(--text-primary)', fontSize: '1.1rem', fontFamily: 'var(--font-serif)', fontWeight: 'normal' }}>Role-Specific Default Overrides</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '1rem' }}>
              Define defaults for entire user groups. These take precedence over Global Gates but fall back to User Overrides.
            </span>

            {/* Existing overrides list */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem', marginBottom: '1.2rem' }}>
              {Object.entries(globalFlags).filter(([k]) => k.includes('_')).map(([key, val]: [string, any]) => {
                const parts = key.split('_');
                const r = parts[0];
                const f = parts.slice(1).join('_');
                return (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: '#FCFAF6', border: '1px solid #E2DACD', fontSize: '0.75rem' }}>
                    <div>
                      <span style={{ background: 'var(--color-accent)', color: '#fff', padding: '2px 6px', marginRight: '0.5rem', fontFamily: 'var(--font-mono)', fontSize: '0.6rem', fontWeight: 'bold' }}>{r}</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{f.replace(/([A-Z])/g, ' $1').toUpperCase()}</strong>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span style={{ color: val ? 'var(--color-success-text)' : 'var(--color-danger-text)', fontWeight: 'bold' }}>{val ? 'ON' : 'OFF'}</span>
                      <button 
                        onClick={() => handleDeleteRoleOverride(key)}
                        style={{ background: 'none', border: 'none', color: 'var(--color-danger-text)', cursor: 'pointer', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 'bold' }}
                      >
                        [Remove]
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add new override form */}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', background: '#FCFAF6', padding: '1.25rem', border: '1px solid #E2DACD', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Target Role:</span>
                <select 
                  value={overrideRole}
                  onChange={e => setOverrideRole(e.target.value as UserRole)}
                  style={{ padding: '0.4rem', background: '#fff', border: '1px solid #C4B9A7', color: 'var(--text-primary)', fontSize: '0.75rem', minWidth: '120px', outline: 'none' }}
                >
                  <option value="OWNER">OWNER</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="PRO">PRO</option>
                  <option value="FREE">FREE</option>
                  <option value="GUEST">GUEST</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Feature Gate:</span>
                <select 
                  value={overrideFlag}
                  onChange={e => setOverrideFlag(e.target.value)}
                  style={{ padding: '0.4rem', background: '#fff', border: '1px solid #C4B9A7', color: 'var(--text-primary)', fontSize: '0.75rem', minWidth: '180px', outline: 'none' }}
                >
                  {['copilot', 'quickMode', 'businessOSMode', 'liveWebMode', 'deepResearchMode', 'developerPanel', 'exportReports', 'betaFeatures', 'marketIntelligence', 'intelligenceHub'].map(f => (
                    <option key={f} value={f}>{f.replace(/([A-Z])/g, ' $1').toUpperCase()}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Default State:</span>
                <select 
                  value={overrideValue ? 'true' : 'false'}
                  onChange={e => setOverrideValue(e.target.value === 'true')}
                  style={{ padding: '0.4rem', background: '#fff', border: '1px solid #C4B9A7', color: 'var(--text-primary)', fontSize: '0.75rem', minWidth: '120px', outline: 'none' }}
                >
                  <option value="true">ON (Enabled)</option>
                  <option value="false">OFF (Disabled)</option>
                </select>
              </div>

              <button 
                onClick={handleCreateRoleOverride}
                className="btn btn-primary"
                style={{ fontSize: '0.75rem', padding: '0.45rem 1rem', height: 'fit-content' }}
              >
                Apply Role Default Override
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Immutable Audit Logs */}
      {activeTab === 'AuditLogs' && logsError && (
        <ApiErrorDisplay endpoint="/api/admin/audit-logs" error={logsError} onRetry={loadAuditLogs} />
      )}
      {activeTab === 'AuditLogs' && !logsError && (
        <div className="card" style={{ background: '#fff', padding: '1.5rem', border: '1px solid #E2DACD', display: 'flex', flexDirection: 'column', gap: '1rem', boxShadow: 'var(--shadow-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, padding: 0, border: 'none', color: 'var(--text-primary)', fontSize: '1.1rem', fontFamily: 'var(--font-serif)', fontWeight: 'normal' }}>Immutable Administrative Audit Logs</h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Tracking role updates and feature flags modifications</span>
            </div>
            
            <div style={{ position: 'relative' }}>
              <input 
                type="text" 
                placeholder="Search audit trail..." 
                value={auditFilter}
                onChange={e => setAuditFilter(e.target.value)}
                style={{ padding: '0.35rem 0.5rem 0.35rem 1.5rem', fontSize: '0.75rem', background: '#FCFAF6', border: '1px solid #E2DACD', color: 'var(--text-primary)', outline: 'none' }}
              />
              <Search size={12} style={{ position: 'absolute', left: '0.5rem', top: '0.55rem', color: 'var(--text-muted)' }} />
            </div>
          </div>

          <div style={{ overflowY: 'auto', maxHeight: '420px' }}>
            {loadingLogs ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Querying audit logs...</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--color-primary)', color: 'var(--text-secondary)', fontWeight: 'bold' }}>
                    <th style={{ padding: '0.5rem' }}>Timestamp</th>
                    <th style={{ padding: '0.5rem' }}>Event</th>
                    <th style={{ padding: '0.5rem' }}>User</th>
                    <th style={{ padding: '0.5rem' }}>Target</th>
                    <th style={{ padding: '0.5rem' }}>Status</th>
                    <th style={{ padding: '0.5rem' }}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map(log => (
                    <tr key={log.id} style={{ borderBottom: '1px solid #E2DACD' }}>
                      <td style={{ padding: '0.75rem 0.5rem', whiteSpace: 'nowrap', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{new Date(log.timestamp).toLocaleString()}</td>
                      <td style={{ padding: '0.75rem 0.5rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{log.action}</td>
                      <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{log.adminEmail}</td>
                      <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.65rem' }}>{log.targetUserId}</td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        <span style={{ background: 'var(--color-success-bg)', color: 'var(--color-success-text)', border: '1px solid var(--color-success-border)', fontSize: '0.65rem', padding: '1px 6px', fontWeight: 'bold', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                          COMMITTED
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>"{log.reason}"</td>
                    </tr>
                  ))}
                  {filteredLogs.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No audit events have been recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {activeTab === 'AIOrchestrator' && (
        <AIOrchestratorDashboard />
      )}

      </div>
    </div>
  );
};
export default DeveloperConsole;
