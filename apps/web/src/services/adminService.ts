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

export interface ServiceHealth {
  status: string;
  latency: number;
}

export interface PlatformHealthStatus {
  pages: ServiceHealth;
  workers: ServiceHealth;
  firebaseAuth: ServiceHealth;
  firestore: ServiceHealth;
  finnhub: ServiceHealth;
  gemini: ServiceHealth;
  fred: ServiceHealth;
  secEdgar: ServiceHealth;
  resend: ServiceHealth;
}

export interface APIUsageStatistics {
  gemini: { 
    flashRequests?: number; 
    proRequests?: number; 
    totalTokens?: number; 
    dailyCost?: number; 
    hitRate?: number;
    requestsToday?: number;
    requestsThisMonth?: number;
    promptTokensToday?: number;
    completionTokensToday?: number;
    totalTokensToday?: number;
    monthlyCostProjection?: number;
    cacheHitRate?: number;
    cachedResponses?: number;
    estimatedCostSavings?: number;
    source?: string;
    error?: string;
  };
  finnhub: { requestsToday: number; hitRate: number; count429: number; latency: number };
  fred: { requests: number; cachedIndicators: number; lastRefresh: string };
  sec: { companiesCached: number; filingsCached: number; lastIngestion: string; queueHealth: string };
}

export interface QueueStatus {
  status: string;
  lastExecution: string;
  duration: number;
  pending: number;
  failures: number;
  retries: number;
}

export interface SystemQueueStatus {
  secIngestion: QueueStatus;
  fredRefresh: QueueStatus;
  newsIngestion: QueueStatus;
  researchCache: QueueStatus;
  dailyDispatch: QueueStatus;
  emailQueue: QueueStatus;
}

export class AdminService {
  private static async request<T>(
    endpoint: string,
    options: RequestInit = {},
    errorMessage: string
  ): Promise<T> {
    const token = (await authService.getIdToken()) || 'mock_anonymous';
    const headers = {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    };

    if (options.body && typeof options.body === 'string') {
      (headers as any)['Content-Type'] = 'application/json';
    }

    const res = await fetch(buildApiUrl(endpoint), {
      ...options,
      headers,
    });

    if (!res.ok) {
      throw new Error(errorMessage);
    }

    // For POST/PATCH that might not return JSON, handle carefully
    // But based on original code, all except updateGlobalFeatureFlags parse JSON.
    // updateGlobalFeatureFlags didn't return anything, so returning undefined is fine
    // or attempting JSON parse if content-length > 0
    if (res.status === 204 || res.headers.get('content-length') === '0') {
      return undefined as T;
    }

    try {
      return await res.json();
    } catch {
      return undefined as T;
    }
  }

  public static async listUsers(_isMockMode: boolean): Promise<any[]> {
    return this.request<any[]>('api/admin/users', {}, 'Failed to load user directories');
  }

  public static async getUserDetails(userId: string, _isMockMode: boolean): Promise<{
    profile: any;
    usage: { businessosCount: number; liveCount: number; deepCount: number };
    sessionsCount: number;
  }> {
    return this.request(
      `api/admin/users/${userId}`,
      {},
      'Failed to retrieve user details'
    );
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
    return this.request(
      `api/admin/users/${targetUserId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(updates),
      },
      'Administrative update failed'
    );
  }

  public static async getAuditLogs(_isMockMode: boolean): Promise<AuditLogEntry[]> {
    return this.request<AuditLogEntry[]>('api/admin/audit-logs', {}, 'Failed to retrieve audit log');
  }

  public static async getSystemStats(_isMockMode: boolean): Promise<{
    health: PlatformHealthStatus;
    apiAnalytics: APIUsageStatistics;
    queues: SystemQueueStatus;
    timestamp: string;
  }> {
    return this.request(
      'api/admin/system-stats',
      {},
      'Failed to query operational health stats'
    );
  }

  public static async getGlobalFeatureFlags(_isMockMode: boolean): Promise<FeatureFlags> {
    return this.request<FeatureFlags>('api/admin/feature-flags/global', {}, 'Failed to fetch global feature flags');
  }

  public static async updateGlobalFeatureFlags(flags: FeatureFlags, _isMockMode: boolean): Promise<void> {
    await this.request(
      'api/admin/feature-flags/global',
      {
        method: 'POST',
        body: JSON.stringify(flags),
      },
      'Failed to update global feature flags'
    );
  }
}
export default AdminService;
