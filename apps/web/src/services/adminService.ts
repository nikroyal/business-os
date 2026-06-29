import { authService } from './firebase';
import { buildApiUrl } from './urlBuilder';
import type { FeatureFlags, UserRole, UsageLimits } from '../../../backend/src/index';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  adminId: string;
  adminEmail: string;
  targetUserId: string;
  action: string;
  beforeValue: any;
  afterValue: any;
  reason: string;
}

export interface PlatformHealthStatus {
  pages: { status: string; latency: number };
  workers: { status: string; latency: number };
  firebaseAuth: { status: string; latency: number };
  firestore: { status: string; latency: number };
  finnhub: { status: string; latency: number };
  gemini: { status: string; latency: number };
  fred: { status: string; latency: number };
  secEdgar: { status: string; latency: number };
  resend: { status: string; latency: number };
}

export interface APIUsageStatistics {
  gemini: { flashRequests: number; proRequests: number; totalTokens: number; dailyCost: number; hitRate: number };
  finnhub: { requestsToday: number; hitRate: number; count429: number; latency: number };
  fred: { requests: number; cachedIndicators: number; lastRefresh: string };
  sec: { companiesCached: number; filingsCached: number; lastIngestion: string; queueHealth: string };
}

export interface SystemQueueStatus {
  secIngestion: { status: string; lastExecution: string; duration: number; pending: number; failures: number; retries: number };
  fredRefresh: { status: string; lastExecution: string; duration: number; pending: number; failures: number; retries: number };
  newsIngestion: { status: string; lastExecution: string; duration: number; pending: number; failures: number; retries: number };
  researchCache: { status: string; lastExecution: string; duration: number; pending: number; failures: number; retries: number };
  dailyDispatch: { status: string; lastExecution: string; duration: number; pending: number; failures: number; retries: number };
  emailQueue: { status: string; lastExecution: string; duration: number; pending: number; failures: number; retries: number };
}

export class AdminService {
  private static readonly MOCK_USER_PROFILES = [
    { uid: 'mock_owner_1', email: 'owner@businessos.com', displayName: 'System Owner', role: 'OWNER', subscriptionTier: 'pro', createdAt: '2026-01-10T12:00:00Z', suspended: false, featureFlags: {}, customLimits: {} },
    { uid: 'mock_admin_1', email: 'admin@businessos.com', displayName: 'Lead Administrator', role: 'ADMIN', subscriptionTier: 'pro', createdAt: '2026-02-15T09:30:00Z', suspended: false, featureFlags: {}, customLimits: {} },
    { uid: 'mock_free_1', email: 'free_user@gmail.com', displayName: 'Free Tier User', role: 'FREE', subscriptionTier: 'free', createdAt: '2026-05-20T16:45:00Z', suspended: false, featureFlags: {}, customLimits: {} },
    { uid: 'mock_pro_1', email: 'pro_investor@yahoo.com', displayName: 'Pro Portfolio Investor', role: 'PRO', subscriptionTier: 'pro', createdAt: '2026-04-01T10:15:00Z', suspended: false, featureFlags: {}, customLimits: {} },
    { uid: 'mock_guest_1', email: 'guest_visitor@anon.com', displayName: 'Guest Visitor', role: 'GUEST', subscriptionTier: 'guest', createdAt: '2026-06-20T08:00:00Z', suspended: false, featureFlags: {}, customLimits: {} }
  ];

  public static async listUsers(isMockMode: boolean): Promise<any[]> {
    if (isMockMode) {
      const saved = localStorage.getItem('mock_admin_users');
      if (saved) return JSON.parse(saved);
      localStorage.setItem('mock_admin_users', JSON.stringify(this.MOCK_USER_PROFILES));
      return this.MOCK_USER_PROFILES;
    }

    try {
      const token = await authService.getIdToken() || 'mock_anonymous';
      const res = await fetch(buildApiUrl('api/admin/users'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Failed to load live admin user database, falling back to mock:', e);
    }
    return this.listUsers(true);
  }

  public static async getUserDetails(userId: string, isMockMode: boolean): Promise<{
    profile: any;
    usage: { businessosCount: number; liveCount: number; deepCount: number };
    sessionsCount: number;
  }> {
    if (isMockMode) {
      const users = await this.listUsers(true);
      const profile = users.find(u => u.uid === userId) || this.MOCK_USER_PROFILES[2];
      
      const usage = {
        businessosCount: userId === 'mock_free_1' ? 12 : 2,
        liveCount: userId === 'mock_free_1' ? 4 : 0,
        deepCount: userId === 'mock_free_1' ? 1 : 0
      };
      
      return {
        profile,
        usage,
        sessionsCount: 3
      };
    }

    const token = await authService.getIdToken() || 'mock_anonymous';
    const res = await fetch(buildApiUrl(`api/admin/users/${userId}`), {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      return await res.json();
    }
    throw new Error('Failed to retrieve user details');
  }

  public static async updateUserProfile(
    targetUserId: string,
    updates: {
      role?: UserRole;
      subscriptionTier?: string;
      customLimits?: Partial<UsageLimits>;
      featureFlags?: Partial<FeatureFlags>;
      suspended?: boolean;
      resetUsage?: boolean;
      forceLogout?: boolean;
      reason: string;
    },
    isMockMode: boolean
  ): Promise<any> {
    if (isMockMode) {
      const users = await this.listUsers(true);
      const idx = users.findIndex(u => u.uid === targetUserId);
      if (idx !== -1) {
        const existing = users[idx];
        users[idx] = {
          ...existing,
          role: updates.role !== undefined ? updates.role : existing.role,
          subscriptionTier: updates.subscriptionTier !== undefined ? updates.subscriptionTier : existing.subscriptionTier,
          customLimits: updates.customLimits !== undefined ? { ...existing.customLimits, ...updates.customLimits } : existing.customLimits,
          featureFlags: updates.featureFlags !== undefined ? { ...existing.featureFlags, ...updates.featureFlags } : existing.featureFlags,
          suspended: updates.suspended !== undefined ? updates.suspended : existing.suspended,
          forceLogoutAt: updates.forceLogout ? new Date().toISOString() : existing.forceLogoutAt
        };
        localStorage.setItem('mock_admin_users', JSON.stringify(users));

        if (updates.resetUsage) {
          const todayStr = new Date().toISOString().split('T')[0];
          localStorage.setItem(`mock_usage_${targetUserId}_${todayStr}`, JSON.stringify({ businessosCount: 0, liveCount: 0, deepCount: 0 }));
        }

        // Create mock audit log
        const logs = await this.getAuditLogs(true);
        logs.unshift({
          id: `audit_${Date.now()}`,
          timestamp: new Date().toISOString(),
          adminId: 'mock_admin',
          adminEmail: 'admin@businessos.com',
          targetUserId,
          action: 'UPDATE_USER_PROFILE',
          beforeValue: existing,
          afterValue: users[idx],
          reason: updates.reason
        });
        localStorage.setItem('mock_admin_audit_logs', JSON.stringify(logs));

        return {
          profile: users[idx],
          usage: { businessosCount: 0, liveCount: 0, deepCount: 0 },
          sessionsCount: 3
        };
      }
      throw new Error('User not found');
    }

    const token = await authService.getIdToken() || 'mock_anonymous';
    const res = await fetch(buildApiUrl(`api/admin/users/${targetUserId}`), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(updates)
    });
    if (res.ok) {
      return await res.json();
    }
    throw new Error('Administrative update failed');
  }

  public static async getAuditLogs(isMockMode: boolean): Promise<AuditLogEntry[]> {
    if (isMockMode) {
      const saved = localStorage.getItem('mock_admin_audit_logs');
      return saved ? JSON.parse(saved) : [
        {
          id: 'audit_init',
          timestamp: new Date().toISOString(),
          adminId: 'mock_owner_1',
          adminEmail: 'owner@businessos.com',
          targetUserId: 'global',
          action: 'INITIALIZE_OPERATIONS_CONSOLE',
          beforeValue: {},
          afterValue: { status: 'operational' },
          reason: 'Initial setup of mock Bloomberg terminal audit tracking logs'
        }
      ];
    }

    try {
      const token = await authService.getIdToken() || 'mock_anonymous';
      const res = await fetch(buildApiUrl('api/admin/audit-logs'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Failed to load live audit logs, falling back to mock:', e);
    }
    return this.getAuditLogs(true);
  }

  public static async getSystemStats(isMockMode: boolean): Promise<{
    health: PlatformHealthStatus;
    apiAnalytics: APIUsageStatistics;
    queues: SystemQueueStatus;
    timestamp: string;
  }> {
    if (isMockMode) {
      return {
        health: {
          pages: { status: 'operational', latency: 45 },
          workers: { status: 'operational', latency: 28 },
          firebaseAuth: { status: 'operational', latency: 110 },
          firestore: { status: 'operational', latency: 85 },
          finnhub: { status: 'operational', latency: 195 },
          gemini: { status: 'operational', latency: 310 },
          fred: { status: 'operational', latency: 160 },
          secEdgar: { status: 'operational', latency: 220 },
          resend: { status: 'operational', latency: 70 }
        },
        apiAnalytics: {
          gemini: { flashRequests: 820, proRequests: 42, totalTokens: 6450000, dailyCost: 2.58, hitRate: 82.1 },
          finnhub: { requestsToday: 1220, hitRate: 75.4, count429: 0, latency: 195 },
          fred: { requests: 140, cachedIndicators: 7, lastRefresh: new Date().toISOString() },
          sec: { companiesCached: 5, filingsCached: 42, lastIngestion: new Date().toISOString(), queueHealth: 'healthy' }
        },
        queues: {
          secIngestion: { status: 'idle', lastExecution: new Date().toISOString(), duration: 15, pending: 0, failures: 0, retries: 0 },
          fredRefresh: { status: 'idle', lastExecution: new Date().toISOString(), duration: 5, pending: 0, failures: 0, retries: 0 },
          newsIngestion: { status: 'idle', lastExecution: new Date().toISOString(), duration: 10, pending: 0, failures: 0, retries: 0 },
          researchCache: { status: 'idle', lastExecution: new Date().toISOString(), duration: 30, pending: 0, failures: 0, retries: 0 },
          dailyDispatch: { status: 'idle', lastExecution: new Date().toISOString(), duration: 45, pending: 0, failures: 0, retries: 0 },
          emailQueue: { status: 'idle', lastExecution: new Date().toISOString(), duration: 3, pending: 0, failures: 0, retries: 0 }
        },
        timestamp: new Date().toISOString()
      };
    }

    const token = await authService.getIdToken() || 'mock_anonymous';
    const res = await fetch(buildApiUrl('api/admin/system-stats'), {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      return await res.json();
    }
    throw new Error('Failed to query operational health stats');
  }

  public static async getGlobalFeatureFlags(isMockMode: boolean): Promise<FeatureFlags> {
    if (isMockMode) {
      const saved = localStorage.getItem('mock_global_flags');
      return saved ? JSON.parse(saved) : {
        copilot: true,
        quickMode: true,
        businessOSMode: true,
        liveWebMode: true,
        deepResearchMode: true,
        developerPanel: true,
        exportReports: true,
        betaFeatures: true,
        marketIntelligence: true,
        intelligenceHub: true
      };
    }

    const token = await authService.getIdToken() || 'mock_anonymous';
    const res = await fetch(buildApiUrl('api/admin/feature-flags/global'), {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      return await res.json();
    }
    throw new Error('Failed to fetch global feature flags');
  }

  public static async updateGlobalFeatureFlags(flags: FeatureFlags, isMockMode: boolean): Promise<void> {
    if (isMockMode) {
      localStorage.setItem('mock_global_flags', JSON.stringify(flags));
      return;
    }

    const token = await authService.getIdToken() || 'mock_anonymous';
    const res = await fetch(buildApiUrl('api/admin/feature-flags/global'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(flags)
    });
    if (!res.ok) {
      throw new Error('Failed to update global feature flags');
    }
  }
}
export default AdminService;
