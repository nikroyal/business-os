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
  public static async listUsers(_isMockMode: boolean): Promise<any[]> {
    const token = await authService.getIdToken() || 'mock_anonymous';
    const res = await fetch(buildApiUrl('api/admin/users'), {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      return await res.json();
    }
    throw new Error('Failed to load user directories');
  }

  public static async getUserDetails(userId: string, _isMockMode: boolean): Promise<{
    profile: any;
    usage: { businessosCount: number; liveCount: number; deepCount: number };
    sessionsCount: number;
  }> {
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
    _isMockMode: boolean
  ): Promise<any> {
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

  public static async getAuditLogs(_isMockMode: boolean): Promise<AuditLogEntry[]> {
    const token = await authService.getIdToken() || 'mock_anonymous';
    const res = await fetch(buildApiUrl('api/admin/audit-logs'), {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      return await res.json();
    }
    throw new Error('Failed to retrieve audit log');
  }

  public static async getSystemStats(_isMockMode: boolean): Promise<{
    health: PlatformHealthStatus;
    apiAnalytics: APIUsageStatistics;
    queues: SystemQueueStatus;
    timestamp: string;
  }> {
    const token = await authService.getIdToken() || 'mock_anonymous';
    const res = await fetch(buildApiUrl('api/admin/system-stats'), {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      return await res.json();
    }
    throw new Error('Failed to query operational health stats');
  }

  public static async getGlobalFeatureFlags(_isMockMode: boolean): Promise<FeatureFlags> {
    const token = await authService.getIdToken() || 'mock_anonymous';
    const res = await fetch(buildApiUrl('api/admin/feature-flags/global'), {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      return await res.json();
    }
    throw new Error('Failed to fetch global feature flags');
  }

  public static async updateGlobalFeatureFlags(flags: FeatureFlags, _isMockMode: boolean): Promise<void> {
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
