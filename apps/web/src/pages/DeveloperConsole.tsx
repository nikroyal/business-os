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

  const loadStats = async () => {
    setLoadingStats(true);
    try {
      const data = await AdminService.getSystemStats(isMockMode);
      setHealth(data.health);
      setApiAnalytics(data.apiAnalytics);
      setQueues(data.queues);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingStats(false);
    }
  };

  const loadUsers = async () => {
    try {
      const data = await AdminService.listUsers(isMockMode);
      setUsersList(data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadGlobalFlags = async () => {
    try {
      const flags = await AdminService.getGlobalFeatureFlags(isMockMode);
      setGlobalFlags(flags);
    } catch (e) {
      console.error(e);
    }
  };

  const loadAuditLogs = async () => {
    setLoadingLogs(true);
    try {
      const logs = await AdminService.getAuditLogs(isMockMode);
      setAuditLogs(logs);
    } catch (e) {
      console.error(e);
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
    u.email.toLowerCase().includes(userSearch.toLowerCase()) || 
    (u.displayName || '').toLowerCase().includes(userSearch.toLowerCase())
  );

  const filteredLogs = auditLogs.filter(log => 
    log.action.toLowerCase().includes(auditFilter.toLowerCase()) ||
    log.adminEmail.toLowerCase().includes(auditFilter.toLowerCase()) ||
    log.targetUserId.toLowerCase().includes(auditFilter.toLowerCase())
  );

  return (
    <div className="scrollable-page">
      <div style={{ animation: 'fadeIn 0.25s ease-out', textAlign: 'left', fontFamily: 'var(--font-mono)' }}>
      
      {/* Header operations center */}
      <div style={{ borderBottom: '1px solid #222', paddingBottom: '1rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <span style={{ color: 'var(--color-danger-text)', fontSize: '0.65rem', border: '1px solid var(--color-danger-text)', padding: '2px 6px', display: 'inline-block', marginBottom: '0.5rem' }}>
            OPERATIONS SECURE INTERFACE (OWNER/ADMIN ONLY)
          </span>
          <h1 style={{ border: 'none', margin: 0, padding: 0, fontSize: '2rem', display: 'flex', alignItems: 'center', gap: '8px', color: '#fff' }}>
            <Terminal size={24} style={{ color: 'var(--color-danger-text)' }} /> BusinessOS Operations Console
          </h1>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button onClick={() => { loadStats(); loadUsers(); loadAuditLogs(); }} className="btn btn-sm btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem' }}>
            <RefreshCw size={12} /> Sync Operational Logs
          </button>
          <span style={{ fontSize: '0.7rem', color: '#666' }}>MODE: {isMockMode ? 'MOCK LOCAL' : 'CLOUDFLARE EDGE'}</span>
        </div>
      </div>

      {/* Stats Quick-Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: '#111', padding: '0.75rem 1rem', border: '1px solid #222' }}>
          <span style={{ fontSize: '0.6rem', color: '#666', display: 'block' }}>FIRESTORE LATENCY</span>
          <strong style={{ fontSize: '1.2rem', color: health?.firestore.status === 'operational' ? 'var(--color-success-text)' : 'var(--color-danger-text)' }}>
            {health?.firestore.latency || 0} ms
          </strong>
        </div>
        <div style={{ background: '#111', padding: '0.75rem 1rem', border: '1px solid #222' }}>
          <span style={{ fontSize: '0.6rem', color: '#666', display: 'block' }}>GEMINI DAILY TOKENS</span>
          <strong style={{ fontSize: '1.2rem', color: 'var(--color-primary-light)' }}>
            {(apiAnalytics?.gemini.totalTokens || 0).toLocaleString()}
          </strong>
        </div>
        <div style={{ background: '#111', padding: '0.75rem 1rem', border: '1px solid #222' }}>
          <span style={{ fontSize: '0.6rem', color: '#666', display: 'block' }}>FINNHUB REQUESTS</span>
          <strong style={{ fontSize: '1.2rem', color: '#fff' }}>
            {apiAnalytics?.finnhub.requestsToday || 0} / 3000
          </strong>
        </div>
        <div style={{ background: '#111', padding: '0.75rem 1rem', border: '1px solid #222' }}>
          <span style={{ fontSize: '0.6rem', color: '#666', display: 'block' }}>QUEUE HEALTH</span>
          <strong style={{ fontSize: '1.2rem', color: 'var(--color-success-text)' }}>
            {apiAnalytics?.sec.queueHealth.toUpperCase() || 'HEALTHY'}
          </strong>
        </div>
      </div>

      {/* Tab selection menu */}
      <div style={{ display: 'flex', gap: '0.25rem', borderBottom: '1px solid #222', paddingBottom: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {([
          { id: 'Health', label: 'Platform Health', icon: Activity },
          { id: 'Queues', label: 'Background Jobs', icon: Clock },
          { id: 'Users', label: 'User Directory', icon: Users },
          { id: 'FeatureFlags', label: 'Global Flags', icon: Sliders },
          { id: 'AuditLogs', label: 'Audit Trail Logs', icon: Shield },
          { id: 'AIOrchestrator', label: 'AI Operations Center', icon: Cpu }
        ] as const).map(tab => (
          <button 
            key={tab.id} 
            onClick={() => setActiveTab(tab.id)} 
            className={`btn btn-sm ${activeTab === tab.id ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', textTransform: 'uppercase' }}
          >
            <tab.icon size={12} /> {tab.label}
          </button>
        ))}
      </div>

      {/* Loading bar */}
      {loadingStats && activeTab === 'Health' && (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>Querying operational console nodes...</div>
      )}

      {/* Tab 1: Health Diagnostics */}
      {activeTab === 'Health' && health && apiAnalytics && (
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '1.5rem' }}>
          
          {/* Diagnostic latency logs */}
          <div style={{ background: '#111', padding: '1.25rem', border: '1px solid #222', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ margin: 0, padding: 0, border: 'none', color: '#fff', fontSize: '0.9rem', textTransform: 'uppercase' }}>Service Status Latency Ratios</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #222', color: '#666', textAlign: 'left' }}>
                  <th style={{ padding: '0.5rem' }}>Service Node</th>
                  <th style={{ padding: '0.5rem' }}>Operational Status</th>
                  <th style={{ padding: '0.5rem' }}>Response Latency</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(health).map(([node, detail]: any) => {
                  const s = detail.status.toLowerCase();
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
                    <tr key={node} style={{ borderBottom: '1px solid #1c1c1c' }}>
                      <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>{node.toUpperCase()}</td>
                      <td style={{ padding: '0.5rem' }}>
                        <span style={{ color }}>
                          ● {detail.status.toUpperCase().replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '0.5rem' }}>{detail.latency} ms</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Token Costs summaries */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            <div style={{ background: '#111', padding: '1.25rem', border: '1px solid #222', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ margin: 0, padding: 0, border: 'none', color: '#fff', fontSize: '0.9rem', textTransform: 'uppercase' }}>Gemini Cost Tracking</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Flash API Calls:</span> <strong>{apiAnalytics.gemini.flashRequests}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Pro API Calls:</span> <strong>{apiAnalytics.gemini.proRequests}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Total Token Overhead:</span> <strong>{apiAnalytics.gemini.totalTokens.toLocaleString()}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Daily Cost Estimate:</span> <strong style={{ color: 'var(--color-warning-text)' }}>${apiAnalytics.gemini.dailyCost.toFixed(2)}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Prompt Cache Hit Ratio:</span> <strong style={{ color: 'var(--color-success-text)' }}>{apiAnalytics.gemini.hitRate}%</strong></div>
              </div>
            </div>

            <div style={{ background: '#111', padding: '1.25rem', border: '1px solid #222', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ margin: 0, padding: 0, border: 'none', color: '#fff', fontSize: '0.9rem', textTransform: 'uppercase' }}>Data Quality Metrics</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>FRED Cached Indicators:</span> <strong>{apiAnalytics.fred.cachedIndicators}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>SEC Edgar Companies:</span> <strong>{apiAnalytics.sec.companiesCached}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>SEC Edgar Filings:</span> <strong>{apiAnalytics.sec.filingsCached}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Finnhub 429 Errors:</span> <strong style={{ color: 'var(--color-success-text)' }}>{apiAnalytics.finnhub.count429}</strong></div>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* Tab 2: System Queue status */}
      {activeTab === 'Queues' && queues && (
        <div style={{ background: '#111', padding: '1.25rem', border: '1px solid #222' }}>
          <h3 style={{ margin: '0 0 1rem 0', padding: 0, border: 'none', color: '#fff', fontSize: '0.9rem', textTransform: 'uppercase' }}>System Job Queue Dashboard</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #222', color: '#666', textAlign: 'left' }}>
                <th style={{ padding: '0.5rem' }}>Job Name</th>
                <th style={{ padding: '0.5rem' }}>Current Status</th>
                <th style={{ padding: '0.5rem' }}>Last Run</th>
                <th style={{ padding: '0.5rem' }}>Duration (s)</th>
                <th style={{ padding: '0.5rem' }}>Pending</th>
                <th style={{ padding: '0.5rem' }}>Failures</th>
                <th style={{ padding: '0.5rem' }}>Retries</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(queues).map(([key, q]: any) => (
                <tr key={key} style={{ borderBottom: '1px solid #1c1c1c' }}>
                  <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>{key.replace(/([A-Z])/g, ' $1').toUpperCase()}</td>
                  <td style={{ padding: '0.5rem' }}><span style={{ color: 'var(--color-success-text)' }}>{q.status.toUpperCase()}</span></td>
                  <td style={{ padding: '0.5rem' }}>{new Date(q.lastExecution).toLocaleTimeString()}</td>
                  <td style={{ padding: '0.5rem' }}>{q.duration}s</td>
                  <td style={{ padding: '0.5rem' }}>{q.pending}</td>
                  <td style={{ padding: '0.5rem', color: q.failures > 0 ? 'var(--color-danger-text)' : 'inherit' }}>{q.failures}</td>
                  <td style={{ padding: '0.5rem' }}>{q.retries}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 3: User Administration Directories */}
      {activeTab === 'Users' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          
          {/* List Users panel */}
          <div style={{ background: '#111', padding: '1.25rem', border: '1px solid #222', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, padding: 0, border: 'none', color: '#fff', fontSize: '0.9rem', textTransform: 'uppercase' }}>Registered Accounts</h3>
              <div style={{ position: 'relative' }}>
                <input 
                  type="text" 
                  placeholder="Filter users..." 
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  style={{ padding: '0.25rem 0.5rem 0.25rem 1.5rem', fontSize: '0.7rem', background: '#181818', border: '1px solid #333', color: '#fff' }}
                />
                <Search size={10} style={{ position: 'absolute', left: '0.5rem', top: '0.45rem', color: '#888' }} />
              </div>
            </div>

            <div style={{ overflowY: 'auto', maxHeight: '400px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #222', color: '#666' }}>
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
                        borderBottom: '1px solid #1c1c1c', 
                        cursor: 'pointer', 
                        background: selectedUser?.uid === u.uid ? '#1c2236' : 'transparent' 
                      }}
                    >
                      <td style={{ padding: '0.5rem' }}>
                        <strong style={{ display: 'block', color: u.suspended ? 'var(--color-danger-text)' : '#fff' }}>{u.displayName || 'Unnamed User'}</strong>
                        <span style={{ fontSize: '0.65rem', color: '#666' }}>{u.email}</span>
                      </td>
                      <td style={{ padding: '0.5rem' }}>
                        <span className="mono-tag" style={{ fontSize: '0.6rem' }}>{u.role || 'FREE'}</span>
                      </td>
                      <td style={{ padding: '0.5rem' }}>
                        <span style={{ textTransform: 'uppercase' }}>{u.subscriptionTier || 'free'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* User management Profile View panel */}
          <div style={{ background: '#111', padding: '1.25rem', border: '1px solid #222' }}>
            <h3 style={{ margin: '0 0 1rem 0', padding: 0, border: 'none', color: '#fff', fontSize: '0.9rem', textTransform: 'uppercase' }}>Account Control Console</h3>
            
            {loadingUser ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>Querying Firestore record...</div>
            ) : userDetails ? (
              <form onSubmit={handleUpdateUser} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.8rem' }}>
                
                {/* Account details metadata grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', background: '#181818', padding: '0.75rem', border: '1px solid #222' }}>
                  <div><span>Name:</span> <strong style={{ color: '#fff' }}>{userDetails.profile.displayName || 'N/A'}</strong></div>
                  <div><span>Email:</span> <strong style={{ color: '#fff' }}>{userDetails.profile.email}</strong></div>
                  <div><span>UID:</span> <strong style={{ fontSize: '0.65rem' }}>{userDetails.profile.uid}</strong></div>
                  <div><span>Created:</span> <strong>{new Date(userDetails.profile.createdAt || '').toLocaleDateString()}</strong></div>
                  <div><span>Last Login:</span> <strong>{userDetails.profile.lastLoginAt ? new Date(userDetails.profile.lastLoginAt).toLocaleString() : 'N/A'}</strong></div>
                  <div><span>Current Role:</span> <strong style={{ color: 'var(--color-accent)' }}>{userDetails.profile.role || 'FREE'}</strong></div>
                  <div><span>Subscription:</span> <strong style={{ textTransform: 'uppercase' }}>{userDetails.profile.subscriptionTier || 'free'}</strong></div>
                  <div><span>Copilot Sessions:</span> <strong>{userDetails.sessionsCount}</strong></div>
                  <div><span>Reports Compiled:</span> <strong>{userDetails.reportsCount || 0}</strong></div>
                  <div><span>Dispatch Status:</span> <strong>{userDetails.dispatchStatus || 'Inactive'}</strong></div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <span>Usage Today:</span> <strong style={{ color: 'var(--color-primary-light)' }}>{userDetails.usage.businessosCount} MI | {userDetails.usage.liveCount} Web | {userDetails.usage.deepCount || 0} Deep</strong>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <span>Suspended:</span> <strong style={{ color: userDetails.profile.suspended ? 'var(--color-danger-text)' : 'var(--color-success-text)' }}>{userDetails.profile.suspended ? 'YES' : 'NO'}</strong>
                  </div>
                  <div style={{ gridColumn: 'span 2', borderTop: '1px dashed #333', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
                    <span style={{ display: 'block', fontSize: '0.7rem', color: '#888', marginBottom: '0.25rem', fontWeight: 'bold' }}>RESOLVED FEATURE FLAGS:</span>
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                      {userDetails.resolvedFlags ? (
                        Object.entries(userDetails.resolvedFlags).map(([k, val]) => (
                          <span key={k} style={{
                            background: val ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: val ? '#4ade80' : '#f87171',
                            border: `1px solid ${val ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                            fontSize: '0.65rem',
                            padding: '1px 4px',
                            fontFamily: 'var(--font-mono)'
                          }}>
                            {k}: {val ? 'ON' : 'OFF'}
                          </span>
                        ))
                      ) : (
                        <span style={{ color: '#666' }}>None resolved</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Promote/Demote Role selector */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label>Modify System Role:</label>
                  <select 
                    value={editRole} 
                    onChange={e => setEditRole(e.target.value as UserRole)}
                    style={{ padding: '0.4rem', background: '#111', border: '1px solid #333', color: '#fff' }}
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
                  <label>Subscription Plan Tier:</label>
                  <select 
                    value={editTier} 
                    onChange={e => setEditTier(e.target.value)}
                    style={{ padding: '0.4rem', background: '#111', border: '1px solid #333', color: '#fff' }}
                  >
                    <option value="pro">Pro Plan</option>
                    <option value="free">Free Plan</option>
                    <option value="guest">Guest Trial</option>
                  </select>
                </div>

                {/* Custom limits overrides */}
                <div style={{ border: '1px solid #222', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <span style={{ fontWeight: 'bold', display: 'block' }}>Custom Daily Limits Overrides (value or "unlimited"):</span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                    <div>
                      <label style={{ fontSize: '0.65rem', display: 'block' }}>BusinessOS</label>
                      <input 
                        type="text" 
                        value={editLimitBusinessOS} 
                        onChange={e => setEditLimitBusinessOS(e.target.value)}
                        placeholder="e.g. 50"
                        style={{ width: '100%', padding: '0.25rem', background: '#111', border: '1px solid #333', color: '#fff' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.65rem', display: 'block' }}>Live Web</label>
                      <input 
                        type="text" 
                        value={editLimitLive} 
                        onChange={e => setEditLimitLive(e.target.value)}
                        placeholder="e.g. 10"
                        style={{ width: '100%', padding: '0.25rem', background: '#111', border: '1px solid #333', color: '#fff' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.65rem', display: 'block' }}>Deep Research</label>
                      <input 
                        type="text" 
                        value={editLimitDeep} 
                        onChange={e => setEditLimitDeep(e.target.value)}
                        placeholder="e.g. 2"
                        style={{ width: '100%', padding: '0.25rem', background: '#111', border: '1px solid #333', color: '#fff' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Individual feature flag overrides */}
                <div style={{ border: '1px solid #222', padding: '0.5rem' }}>
                  <span style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.25rem' }}>Individual Flag Overrides:</span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.7rem' }}>
                    {['copilot', 'quickMode', 'businessOSMode', 'liveWebMode', 'deepResearchMode', 'developerPanel', 'exportReports', 'betaFeatures', 'marketIntelligence', 'intelligenceHub'].map(flag => {
                      const isChecked = editFeatureFlags[flag] !== undefined ? editFeatureFlags[flag] : false;
                      return (
                        <label key={flag} style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', cursor: 'pointer' }}>
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', border: '1px solid #222', padding: '0.5rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input 
                      type="checkbox" 
                      id="editSuspended"
                      checked={editSuspended} 
                      onChange={e => setEditSuspended(e.target.checked)}
                    />
                    <label htmlFor="editSuspended" style={{ color: editSuspended ? 'var(--color-danger-text)' : 'inherit', cursor: 'pointer' }}>
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
                    <label htmlFor="editResetUsage" style={{ cursor: 'pointer' }}>
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
                    <label htmlFor="editForceLogout" style={{ cursor: 'pointer' }}>
                      Force logout from all devices (future-ready JWT revoke)
                    </label>
                  </div>
                </div>

                {/* Reason check */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label>Audit Reason (Required):</label>
                  <input 
                    type="text" 
                    placeholder="Enter reason for audit record compliance..." 
                    value={editReason}
                    onChange={e => setEditReason(e.target.value)}
                    required
                    style={{ padding: '0.4rem', background: '#181818', border: '1px solid #333', color: '#fff' }}
                  />
                </div>

                <button type="submit" disabled={savingUser || !editReason.trim()} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: '0.5rem' }}>
                  {savingUser ? <Activity className="animate-spin" size={14} /> : <Sliders size={14} />} Apply Modifications
                </button>
              </form>
            ) : (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#555', border: '1px dashed #333' }}>
                Select an account from the left directory column to adjust settings
              </div>
            )}

          </div>

        </div>
      )}

      {/* Tab 4: Feature Flags toggles */}
      {activeTab === 'FeatureFlags' && globalFlags && (
        <div style={{ background: '#111', padding: '1.25rem', border: '1px solid #222', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          <div>
            <h3 style={{ margin: 0, padding: 0, border: 'none', color: '#fff', fontSize: '0.9rem', textTransform: 'uppercase' }}>Global Feature Flag Gates</h3>
            <span style={{ fontSize: '0.75rem', color: '#666' }}>Toggle BusinessOS platform components globally for all users</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {Object.entries(globalFlags).filter(([k]) => !k.includes('_')).map(([key, val]: [string, any]) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.8rem', background: '#181818', border: '1px solid #222' }}>
                <div>
                  <strong style={{ fontSize: '0.8rem', color: '#fff' }}>{key.replace(/([A-Z])/g, ' $1').toUpperCase()}</strong>
                  <span style={{ display: 'block', fontSize: '0.65rem', color: '#666' }}>Controlled by FeatureFlags resolver system</span>
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
          <div style={{ borderTop: '1px dashed #333', paddingTop: '1.2rem', marginTop: '0.8rem' }}>
            <h3 style={{ margin: '0 0 0.25rem 0', padding: 0, border: 'none', color: '#fff', fontSize: '0.9rem', textTransform: 'uppercase' }}>Role-Specific Default Overrides</h3>
            <span style={{ fontSize: '0.75rem', color: '#666', display: 'block', marginBottom: '1rem' }}>
              Define defaults for entire user groups. These take precedence over Global Gates but fall back to User Overrides.
            </span>

            {/* Existing overrides list */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.2rem' }}>
              {Object.entries(globalFlags).filter(([k]) => k.includes('_')).map(([key, val]: [string, any]) => {
                const parts = key.split('_');
                const r = parts[0];
                const f = parts.slice(1).join('_');
                return (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: '#141414', border: '1px solid #222', fontSize: '0.75rem' }}>
                    <div>
                      <span style={{ background: 'rgba(139, 92, 246, 0.2)', color: '#a78bfa', padding: '2px 4px', marginRight: '0.5rem', fontFamily: 'var(--font-mono)', fontSize: '0.6rem' }}>{r}</span>
                      <strong style={{ color: '#fff' }}>{f.replace(/([A-Z])/g, ' $1').toUpperCase()}</strong>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span style={{ color: val ? '#4ade80' : '#f87171', fontWeight: 'bold' }}>{val ? 'ON' : 'OFF'}</span>
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
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', background: '#151515', padding: '1rem', border: '1px solid #222', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <span style={{ fontSize: '0.7rem', color: '#888', fontWeight: 'bold' }}>Target Role:</span>
                <select 
                  value={overrideRole}
                  onChange={e => setOverrideRole(e.target.value as UserRole)}
                  style={{ padding: '0.4rem', background: '#111', border: '1px solid #333', color: '#fff', fontSize: '0.75rem', minWidth: '120px' }}
                >
                  <option value="OWNER">OWNER</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="PRO">PRO</option>
                  <option value="FREE">FREE</option>
                  <option value="GUEST">GUEST</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <span style={{ fontSize: '0.7rem', color: '#888', fontWeight: 'bold' }}>Feature Gate:</span>
                <select 
                  value={overrideFlag}
                  onChange={e => setOverrideFlag(e.target.value)}
                  style={{ padding: '0.4rem', background: '#111', border: '1px solid #333', color: '#fff', fontSize: '0.75rem', minWidth: '180px' }}
                >
                  {['copilot', 'quickMode', 'businessOSMode', 'liveWebMode', 'deepResearchMode', 'developerPanel', 'exportReports', 'betaFeatures', 'marketIntelligence', 'intelligenceHub'].map(f => (
                    <option key={f} value={f}>{f.replace(/([A-Z])/g, ' $1').toUpperCase()}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <span style={{ fontSize: '0.7rem', color: '#888', fontWeight: 'bold' }}>Default State:</span>
                <select 
                  value={overrideValue ? 'true' : 'false'}
                  onChange={e => setOverrideValue(e.target.value === 'true')}
                  style={{ padding: '0.4rem', background: '#111', border: '1px solid #333', color: '#fff', fontSize: '0.75rem', minWidth: '120px' }}
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
      {activeTab === 'AuditLogs' && (
        <div style={{ background: '#111', padding: '1.25rem', border: '1px solid #222', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, padding: 0, border: 'none', color: '#fff', fontSize: '0.9rem', textTransform: 'uppercase' }}>Immutable Administrative Audit Logs</h3>
              <span style={{ fontSize: '0.75rem', color: '#666' }}>Tracking role updates and feature flags modifications</span>
            </div>
            
            <div style={{ position: 'relative' }}>
              <input 
                type="text" 
                placeholder="Search audit trail..." 
                value={auditFilter}
                onChange={e => setAuditFilter(e.target.value)}
                style={{ padding: '0.25rem 0.5rem 0.25rem 1.5rem', fontSize: '0.7rem', background: '#181818', border: '1px solid #333', color: '#fff' }}
              />
              <Search size={10} style={{ position: 'absolute', left: '0.5rem', top: '0.45rem', color: '#888' }} />
            </div>
          </div>

          <div style={{ overflowY: 'auto', maxHeight: '400px' }}>
            {loadingLogs ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>Querying audit logs...</div>
            ) : filteredLogs.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #222', color: '#666' }}>
                    <th style={{ padding: '0.5rem' }}>Timestamp</th>
                    <th style={{ padding: '0.5rem' }}>Admin Email</th>
                    <th style={{ padding: '0.5rem' }}>Action</th>
                    <th style={{ padding: '0.5rem' }}>Target</th>
                    <th style={{ padding: '0.5rem' }}>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map(log => (
                    <tr key={log.id} style={{ borderBottom: '1px solid #1c1c1c' }}>
                      <td style={{ padding: '0.5rem', whiteSpace: 'nowrap', color: '#aaa' }}>{new Date(log.timestamp).toLocaleString()}</td>
                      <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>{log.adminEmail}</td>
                      <td style={{ padding: '0.5rem' }}>
                        <span className="mono-tag" style={{ fontSize: '0.6rem', color: 'var(--color-warning-text)', background: 'rgba(245, 158, 11, 0.1)' }}>
                          {log.action}
                        </span>
                      </td>
                      <td style={{ padding: '0.5rem', fontSize: '0.65rem' }}>{log.targetUserId}</td>
                      <td style={{ padding: '0.5rem', color: '#888', fontStyle: 'italic' }}>"{log.reason}"</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#555' }}>No audit trail entries matched criteria</div>
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
