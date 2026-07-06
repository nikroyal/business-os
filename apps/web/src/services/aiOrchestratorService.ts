import { authService } from './firebase';
import { buildApiUrl } from './urlBuilder';

export interface ModelStats {
  requests: number;
  success: number;
  failure: number;
  avgLatencyMs: number;
  successRate: number;
  lastSuccess: string;
  lastFailure: string;
  lastFailureReason: string;
  todayRequests?: number;
  todayTokens?: number;
  todayCost?: number;
  retriesCount?: number;
  fallbackCount?: number;
  cooldownCount?: number;
  rpmUsage?: number;
  rpmLimit?: number;
  tpmUsage?: number;
  tpmLimit?: number;
  rpdUsage?: number;
  rpdLimit?: number;
  quotaRemaining?: number;
  quotaReset?: string;
  currentHealth?: string;
}

export interface ModelMetadataWithStats {
  id: string;
  displayName: string;
  category: 'Flash' | 'Pro';
  priority: number;
  capabilityScore: number;
  reasoningScore: number;
  speedScore: number;
  stabilityScore: number;
  status: 'production' | 'preview';
  provider: string;
  supportsGrounding: boolean;
  supportsStructuredOutput: boolean;
  supportsLongContext: boolean;
  supportsStreaming: boolean;
  supportsVision: boolean;
  supportsAudio: boolean;
  supportsTools: boolean;
  defaultTimeoutMs: number;
  retryCount: number;
  cooldownDurationMs: number;
  enabled: boolean;
  isForced: boolean;
  cooldownRemaining: number;
  stats: ModelStats;
  fallbackEnabled?: boolean;
  contextWindow?: number;
  maxOutput?: number;
  supportsImageOutput?: boolean;
  supportsVideo?: boolean;
  inputCostPer1M?: number;
  outputCostPer1M?: number;
}

export interface OverviewStats {
  activeProvider: string;
  overallHealth: 'healthy' | 'degraded' | 'failure';
  overallSuccessRate: number;
  averageLatencyMs: number;
  requestsToday: number;
  requestsThisMonth?: number;
  tokensToday: number;
  promptTokensToday: number;
  completionTokensToday: number;
  estimatedDailyCost: number;
  estimatedMonthlyCost: number;
  totalFailovers: number;
  totalRetries: number;
  dailyQuotaLimit: number;
  cachedResponses: number;
  cacheHitRate: number;
  estimatedCostSavings: number;
  maintenanceMode?: boolean;
  retentionDays?: number;
}

export interface QuotaStats {
  requestsPerMinute: number;
  tokensPerMinute: number;
  estimatedRemainingDailyRequests: number;
  quotaUtilisationPercentage: number;
  /** 'businessos_estimate' = derived from telemetry; never provider-reported. */
  source: 'businessos_estimate';
}

export interface ProviderStats {
  id: string;
  displayName: string;
  health: 'operational' | 'degraded';
  successRate: number;
  averageLatencyMs: number;
}

export interface OrchestratorStats {
  overview: OverviewStats;
  provider?: ProviderStats;
  models: ModelMetadataWithStats[];
  breakdowns: {
    featureCost: Record<string, number>;
    workspaceCost: Record<string, number>;
    userCost: Record<string, number>;
    featureByModel?: Record<string, Record<string, { requests: number; tokens: number; cost: number }>>;
    userBreakdown?: Array<{ user: string; requests: number; tokens: number; cost: number; avgLatencyMs: number; failures: number; fallbacks: number; favouriteModel: string }>;
    costAnalytics?: { today: number; thisWeek: number; thisMonth: number; projectedMonth: number; projectedYear: number; byModel: Record<string, number>; byDay: Array<{ date: string; cost: number; requests: number; tokens: number; latency: number; failures: number; fallbacks: number }> };
    dailyAnalytics?: Array<{ date: string; cost: number; requests: number; tokens: number; latency: number; failures: number; fallbacks: number; avgLatencyMs: number }>;
  };
  quota?: QuotaStats;
}

export interface TelemetryRecord {
  id: string;
  timestamp: string;
  user: string;
  workspace: string;
  feature: string;
  provider?: string;
  selectedModel: string;
  fallbackModel: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latency: number;
  success: boolean;
  errorClassification: string;
  retryCount: number;
  estimatedCost: number;
  cachedResponse: boolean;
  /** 'provider' = official API usageMetadata; 'estimated' = character-division fallback. */
  tokenCountSource?: 'provider' | 'estimated';
}

export interface OrchestratorConfig {
  forcedModel: string | null;
  maintenanceMode?: boolean;
  retentionDays?: number;
  /** Configurable daily request quota limit; defaults to 1500 (free tier). */
  dailyQuotaLimit?: number;
  flashFallbackOrder?: string[];
  proFallbackOrder?: string[];
  modelOverrides: Record<string, {
    enabled?: boolean;
    priority?: number;
    cooldownDurationMs?: number;
  }>;
}

class AIOrchestratorService {
  private async getAuthHeaders(): Promise<HeadersInit> {
    const token = await authService.getIdToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  async getStats(): Promise<OrchestratorStats> {
    if (authService.isMock) {
      const savedStats = localStorage.getItem('mock_ai_orchestrator_stats');
      if (savedStats) return JSON.parse(savedStats) as OrchestratorStats;
      
      const defaultStats: OrchestratorStats = {
        overview: {
          activeProvider: "Google Gemini",
          overallHealth: "healthy",
          overallSuccessRate: 100,
          averageLatencyMs: 0,
          requestsToday: 0,
          requestsThisMonth: 0,
          tokensToday: 0,
          promptTokensToday: 0,
          completionTokensToday: 0,
          estimatedDailyCost: 0,
          estimatedMonthlyCost: 0,
          totalFailovers: 0,
          totalRetries: 0,
          dailyQuotaLimit: 1500,
          cachedResponses: 0,
          cacheHitRate: 0,
          estimatedCostSavings: 0
        },
        provider: {
          id: "google",
          displayName: "Google AI Studio",
          health: "operational",
          successRate: 100,
          averageLatencyMs: 0
        },
        models: [
          {
            id: "gemini-3.5-flash",
            displayName: "Gemini 3.5 Flash",
            category: "Flash",
            priority: 1,
            capabilityScore: 95,
            reasoningScore: 90,
            speedScore: 95,
            stabilityScore: 95,
            status: "production",
            provider: "google",
            supportsGrounding: true,
            supportsStructuredOutput: true,
            supportsLongContext: true,
            supportsStreaming: true,
            supportsVision: true,
            supportsAudio: true,
            supportsTools: true,
            defaultTimeoutMs: 15000,
            retryCount: 1,
            cooldownDurationMs: 300000,
            enabled: true,
            isForced: false,
            cooldownRemaining: 0,
            fallbackEnabled: true,
            contextWindow: 1048576,
            maxOutput: 8192,
            supportsImageOutput: false,
            supportsVideo: true,
            inputCostPer1M: 0.075,
            outputCostPer1M: 0.30,
            stats: {
              requests: 0,
              success: 0,
              failure: 0,
              avgLatencyMs: 0,
              successRate: 100,
              lastSuccess: "",
              lastFailure: "",
              lastFailureReason: "",
              todayRequests: 0,
              todayTokens: 0,
              todayCost: 0,
              retriesCount: 0,
              fallbackCount: 0,
              cooldownCount: 0,
              rpmUsage: 0,
              rpmLimit: 15,
              tpmUsage: 0,
              tpmLimit: 1000000,
              rpdUsage: 0,
              rpdLimit: 1500,
              quotaRemaining: 1500,
              quotaReset: "Midnight UTC",
              currentHealth: "Operational"
            }
          },
          {
            id: "gemini-3.1-pro-preview",
            displayName: "Gemini 3.1 Pro",
            category: "Pro",
            priority: 2,
            capabilityScore: 98,
            reasoningScore: 98,
            speedScore: 70,
            stabilityScore: 85,
            status: "preview",
            provider: "google",
            supportsGrounding: true,
            supportsStructuredOutput: true,
            supportsLongContext: true,
            supportsStreaming: true,
            supportsVision: true,
            supportsAudio: true,
            supportsTools: true,
            defaultTimeoutMs: 30000,
            retryCount: 1,
            cooldownDurationMs: 300000,
            enabled: true,
            isForced: false,
            cooldownRemaining: 0,
            fallbackEnabled: true,
            contextWindow: 2097152,
            maxOutput: 8192,
            supportsImageOutput: false,
            supportsVideo: true,
            inputCostPer1M: 1.25,
            outputCostPer1M: 5.00,
            stats: {
              requests: 0,
              success: 0,
              failure: 0,
              avgLatencyMs: 0,
              successRate: 100,
              lastSuccess: "",
              lastFailure: "",
              lastFailureReason: "",
              todayRequests: 0,
              todayTokens: 0,
              todayCost: 0,
              retriesCount: 0,
              fallbackCount: 0,
              cooldownCount: 0,
              rpmUsage: 0,
              rpmLimit: 2,
              tpmUsage: 0,
              tpmLimit: 32000,
              rpdUsage: 0,
              rpdLimit: 50,
              quotaRemaining: 50,
              quotaReset: "Midnight UTC",
              currentHealth: "Operational"
            }
          },
          {
            id: "gemini-2.5-pro",
            displayName: "Gemini 2.5 Pro",
            category: "Pro",
            priority: 3,
            capabilityScore: 94,
            reasoningScore: 95,
            speedScore: 75,
            stabilityScore: 92,
            status: "production",
            provider: "google",
            supportsGrounding: true,
            supportsStructuredOutput: true,
            supportsLongContext: true,
            supportsStreaming: true,
            supportsVision: true,
            supportsAudio: true,
            supportsTools: true,
            defaultTimeoutMs: 25000,
            retryCount: 1,
            cooldownDurationMs: 180000,
            enabled: true,
            isForced: false,
            cooldownRemaining: 0,
            fallbackEnabled: true,
            contextWindow: 2097152,
            maxOutput: 8192,
            supportsImageOutput: false,
            supportsVideo: true,
            inputCostPer1M: 1.25,
            outputCostPer1M: 5.00,
            stats: {
              requests: 0,
              success: 0,
              failure: 0,
              avgLatencyMs: 0,
              successRate: 100,
              lastSuccess: "",
              lastFailure: "",
              lastFailureReason: "",
              todayRequests: 0,
              todayTokens: 0,
              todayCost: 0,
              retriesCount: 0,
              fallbackCount: 0,
              cooldownCount: 0,
              rpmUsage: 0,
              rpmLimit: 2,
              tpmUsage: 0,
              tpmLimit: 32000,
              rpdUsage: 0,
              rpdLimit: 50,
              quotaRemaining: 50,
              quotaReset: "Midnight UTC",
              currentHealth: "Operational"
            }
          },
          {
            id: "gemini-2.5-flash",
            displayName: "Gemini 2.5 Flash",
            category: "Flash",
            priority: 4,
            capabilityScore: 88,
            reasoningScore: 82,
            speedScore: 92,
            stabilityScore: 94,
            status: "production",
            provider: "google",
            supportsGrounding: true,
            supportsStructuredOutput: true,
            supportsLongContext: true,
            supportsStreaming: true,
            supportsVision: true,
            supportsAudio: true,
            supportsTools: true,
            defaultTimeoutMs: 15000,
            retryCount: 1,
            cooldownDurationMs: 120000,
            enabled: true,
            isForced: false,
            cooldownRemaining: 0,
            fallbackEnabled: true,
            contextWindow: 1048576,
            maxOutput: 8192,
            supportsImageOutput: false,
            supportsVideo: true,
            inputCostPer1M: 0.075,
            outputCostPer1M: 0.30,
            stats: {
              requests: 0,
              success: 0,
              failure: 0,
              avgLatencyMs: 0,
              successRate: 100,
              lastSuccess: "",
              lastFailure: "",
              lastFailureReason: "",
              todayRequests: 0,
              todayTokens: 0,
              todayCost: 0,
              retriesCount: 0,
              fallbackCount: 0,
              cooldownCount: 0,
              rpmUsage: 0,
              rpmLimit: 15,
              tpmUsage: 0,
              tpmLimit: 1000000,
              rpdUsage: 0,
              rpdLimit: 1500,
              quotaRemaining: 1500,
              quotaReset: "Midnight UTC",
              currentHealth: "Operational"
            }
          },
          {
            id: "gemini-3.1-flash-lite",
            displayName: "Gemini 3.1 Flash Lite",
            category: "Flash",
            priority: 5,
            capabilityScore: 85,
            reasoningScore: 80,
            speedScore: 98,
            stabilityScore: 96,
            status: "production",
            provider: "google",
            supportsGrounding: true,
            supportsStructuredOutput: true,
            supportsLongContext: true,
            supportsStreaming: true,
            supportsVision: true,
            supportsAudio: true,
            supportsTools: true,
            defaultTimeoutMs: 12000,
            retryCount: 1,
            cooldownDurationMs: 120000,
            enabled: true,
            isForced: false,
            cooldownRemaining: 0,
            fallbackEnabled: true,
            contextWindow: 1048576,
            maxOutput: 8192,
            supportsImageOutput: false,
            supportsVideo: true,
            inputCostPer1M: 0.0375,
            outputCostPer1M: 0.15,
            stats: {
              requests: 0,
              success: 0,
              failure: 0,
              avgLatencyMs: 0,
              successRate: 100,
              lastSuccess: "",
              lastFailure: "",
              lastFailureReason: "",
              todayRequests: 0,
              todayTokens: 0,
              todayCost: 0,
              retriesCount: 0,
              fallbackCount: 0,
              cooldownCount: 0,
              rpmUsage: 0,
              rpmLimit: 15,
              tpmUsage: 0,
              tpmLimit: 1000000,
              rpdUsage: 0,
              rpdLimit: 1500,
              quotaRemaining: 1500,
              quotaReset: "Midnight UTC",
              currentHealth: "Operational"
            }
          },
          {
            id: "gemini-2.5-flash-lite",
            displayName: "Gemini 2.5 Flash Lite",
            category: "Flash",
            priority: 6,
            capabilityScore: 82,
            reasoningScore: 78,
            speedScore: 98,
            stabilityScore: 95,
            status: "production",
            provider: "google",
            supportsGrounding: true,
            supportsStructuredOutput: true,
            supportsLongContext: true,
            supportsStreaming: true,
            supportsVision: true,
            supportsAudio: true,
            supportsTools: true,
            defaultTimeoutMs: 12000,
            retryCount: 1,
            cooldownDurationMs: 120000,
            enabled: true,
            isForced: false,
            cooldownRemaining: 0,
            fallbackEnabled: true,
            contextWindow: 1048576,
            maxOutput: 8192,
            supportsImageOutput: false,
            supportsVideo: true,
            inputCostPer1M: 0.0375,
            outputCostPer1M: 0.15,
            stats: {
              requests: 0,
              success: 0,
              failure: 0,
              avgLatencyMs: 0,
              successRate: 100,
              lastSuccess: "",
              lastFailure: "",
              lastFailureReason: "",
              todayRequests: 0,
              todayTokens: 0,
              todayCost: 0,
              retriesCount: 0,
              fallbackCount: 0,
              cooldownCount: 0,
              rpmUsage: 0,
              rpmLimit: 15,
              tpmUsage: 0,
              tpmLimit: 1000000,
              rpdUsage: 0,
              rpdLimit: 1500,
              quotaRemaining: 1500,
              quotaReset: "Midnight UTC",
              currentHealth: "Operational"
            }
          },
          {
            id: "gemini-flash-latest",
            displayName: "Gemini Flash (Latest Alias)",
            category: "Flash",
            priority: 7,
            capabilityScore: 90,
            reasoningScore: 85,
            speedScore: 90,
            stabilityScore: 90,
            status: "production",
            provider: "google",
            supportsGrounding: true,
            supportsStructuredOutput: true,
            supportsLongContext: true,
            supportsStreaming: true,
            supportsVision: true,
            supportsAudio: true,
            supportsTools: true,
            defaultTimeoutMs: 15000,
            retryCount: 1,
            cooldownDurationMs: 120000,
            enabled: true,
            isForced: false,
            cooldownRemaining: 0,
            fallbackEnabled: true,
            contextWindow: 1048576,
            maxOutput: 8192,
            supportsImageOutput: false,
            supportsVideo: true,
            inputCostPer1M: 0.075,
            outputCostPer1M: 0.30,
            stats: {
              requests: 0,
              success: 0,
              failure: 0,
              avgLatencyMs: 0,
              successRate: 100,
              lastSuccess: "",
              lastFailure: "",
              lastFailureReason: "",
              todayRequests: 0,
              todayTokens: 0,
              todayCost: 0,
              retriesCount: 0,
              fallbackCount: 0,
              cooldownCount: 0,
              rpmUsage: 0,
              rpmLimit: 15,
              tpmUsage: 0,
              tpmLimit: 1000000,
              rpdUsage: 0,
              rpdLimit: 1500,
              quotaRemaining: 1500,
              quotaReset: "Midnight UTC",
              currentHealth: "Operational"
            }
          },
          {
            id: "gemini-pro-latest",
            displayName: "Gemini Pro (Latest Alias)",
            category: "Pro",
            priority: 8,
            capabilityScore: 93,
            reasoningScore: 93,
            speedScore: 72,
            stabilityScore: 90,
            status: "production",
            provider: "google",
            supportsGrounding: true,
            supportsStructuredOutput: true,
            supportsLongContext: true,
            supportsStreaming: true,
            supportsVision: true,
            supportsAudio: true,
            supportsTools: true,
            defaultTimeoutMs: 25000,
            retryCount: 1,
            cooldownDurationMs: 180000,
            enabled: true,
            isForced: false,
            cooldownRemaining: 0,
            fallbackEnabled: true,
            contextWindow: 2097152,
            maxOutput: 8192,
            supportsImageOutput: false,
            supportsVideo: true,
            inputCostPer1M: 1.25,
            outputCostPer1M: 5.00,
            stats: {
              requests: 0,
              success: 0,
              failure: 0,
              avgLatencyMs: 0,
              successRate: 100,
              lastSuccess: "",
              lastFailure: "",
              lastFailureReason: "",
              todayRequests: 0,
              todayTokens: 0,
              todayCost: 0,
              retriesCount: 0,
              fallbackCount: 0,
              cooldownCount: 0,
              rpmUsage: 0,
              rpmLimit: 2,
              tpmUsage: 0,
              tpmLimit: 32000,
              rpdUsage: 0,
              rpdLimit: 50,
              quotaRemaining: 50,
              quotaReset: "Midnight UTC",
              currentHealth: "Operational"
            }
          }
        ],
        breakdowns: {
          featureCost: {},
          workspaceCost: {},
          userCost: {},
          featureByModel: {},
          userBreakdown: [],
          costAnalytics: { today: 0, thisWeek: 0, thisMonth: 0, projectedMonth: 0, projectedYear: 0, byModel: {}, byDay: [] },
          dailyAnalytics: []
        },
        quota: {
          requestsPerMinute: 0,
          tokensPerMinute: 0,
          estimatedRemainingDailyRequests: 1500,
          quotaUtilisationPercentage: 0,
          source: "businessos_estimate"
        }
      };
      
      localStorage.setItem('mock_ai_orchestrator_stats', JSON.stringify(defaultStats));
      return defaultStats;
    }

    const headers = await this.getAuthHeaders();
    const res = await fetch(buildApiUrl('api/admin/ai-orchestrator/stats'), { headers });
    if (!res.ok) throw new Error(`Failed to load AI stats: HTTP ${res.status}`);
    return await res.json() as OrchestratorStats;
  }

  async getTimeline(): Promise<TelemetryRecord[]> {
    if (authService.isMock) {
      const savedTimeline = localStorage.getItem('mock_ai_orchestrator_timeline');
      if (savedTimeline) return JSON.parse(savedTimeline) as TelemetryRecord[];
      
      const defaultTimeline: TelemetryRecord[] = [];
      localStorage.setItem('mock_ai_orchestrator_timeline', JSON.stringify(defaultTimeline));
      return defaultTimeline;
    }

    const headers = await this.getAuthHeaders();
    const res = await fetch(buildApiUrl('api/admin/ai-orchestrator/timeline'), { headers });
    if (!res.ok) throw new Error(`Failed to load AI timeline: HTTP ${res.status}`);
    return await res.json() as TelemetryRecord[];
  }

  async getConfig(): Promise<OrchestratorConfig> {
    if (authService.isMock) {
      const savedConfig = localStorage.getItem('mock_ai_orchestrator_config');
      if (savedConfig) return JSON.parse(savedConfig) as OrchestratorConfig;
      
      const defaultConfig: OrchestratorConfig = {
        forcedModel: null,
        maintenanceMode: false,
        retentionDays: 30,
        dailyQuotaLimit: 1500,
        flashFallbackOrder: ["gemini-3.5-flash", "gemini-2.5-flash", "gemini-3.1-flash-lite", "gemini-2.5-flash-lite", "gemini-flash-latest"],
        proFallbackOrder: ["gemini-3.1-pro-preview", "gemini-2.5-pro", "gemini-pro-latest"],
        modelOverrides: {}
      };
      localStorage.setItem('mock_ai_orchestrator_config', JSON.stringify(defaultConfig));
      return defaultConfig;
    }

    const headers = await this.getAuthHeaders();
    const res = await fetch(buildApiUrl('api/admin/ai-orchestrator/config'), { headers });
    if (!res.ok) throw new Error(`Failed to load AI config: HTTP ${res.status}`);
    return await res.json() as OrchestratorConfig;
  }

  async saveConfig(config: OrchestratorConfig): Promise<boolean> {
    if (authService.isMock) {
      localStorage.setItem('mock_ai_orchestrator_config', JSON.stringify(config));
      // update stats forced model
      const stats = await this.getStats();
      stats.models.forEach(m => {
        m.isForced = m.id === config.forcedModel;
        const ov = config.modelOverrides[m.id] || {};
        m.enabled = ov.enabled !== undefined ? ov.enabled : m.enabled;
        m.priority = ov.priority !== undefined ? ov.priority : m.priority;
      });
      stats.overview.maintenanceMode = !!config.maintenanceMode;
      localStorage.setItem('mock_ai_orchestrator_stats', JSON.stringify(stats));
      return true;
    }

    const headers = await this.getAuthHeaders();
    const res = await fetch(buildApiUrl('api/admin/ai-orchestrator/config'), {
      method: 'POST',
      headers,
      body: JSON.stringify(config)
    });
    if (!res.ok) throw new Error(`Failed to save AI config: HTTP ${res.status}`);
    const data = await res.json() as any;
    return !!data.success;
  }

  async triggerHealthTest(type: 'provider' | 'model', targetId: string): Promise<any> {
    if (authService.isMock) {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            success: true,
            latency: 150 + Math.floor(Math.random() * 100),
            message: `Mock connection check for ${type} '${targetId}' succeeded.`
          });
        }, 800);
      });
    }

    const headers = await this.getAuthHeaders();
    const res = await fetch(buildApiUrl('api/admin/ai-orchestrator/health-test'), {
      method: 'POST',
      headers,
      body: JSON.stringify({ type, targetId })
    });
    if (!res.ok) throw new Error(`Failed to run health test: HTTP ${res.status}`);
    return await res.json();
  }

  async flushCooldowns(): Promise<boolean> {
    if (authService.isMock) {
      const stats = await this.getStats();
      stats.models.forEach(m => m.cooldownRemaining = 0);
      localStorage.setItem('mock_ai_orchestrator_stats', JSON.stringify(stats));
      return true;
    }

    const headers = await this.getAuthHeaders();
    const res = await fetch(buildApiUrl('api/admin/ai-orchestrator/flush-cooldowns'), {
      method: 'POST',
      headers
    });
    if (!res.ok) throw new Error(`Failed to flush cooldowns: HTTP ${res.status}`);
    const data = await res.json() as any;
    return !!data.success;
  }

  async clearTelemetry(): Promise<boolean> {
    if (authService.isMock) {
      localStorage.setItem('mock_ai_orchestrator_timeline', JSON.stringify([]));
      const stats = await this.getStats();
      stats.overview.requestsToday = 0;
      stats.overview.tokensToday = 0;
      stats.overview.promptTokensToday = 0;
      stats.overview.completionTokensToday = 0;
      stats.overview.estimatedDailyCost = 0;
      stats.breakdowns = { featureCost: {}, workspaceCost: {}, userCost: {} };
      localStorage.setItem('mock_ai_orchestrator_stats', JSON.stringify(stats));
      return true;
    }

    const headers = await this.getAuthHeaders();
    const res = await fetch(buildApiUrl('api/admin/ai-orchestrator/clear-telemetry'), {
      method: 'POST',
      headers
    });
    if (!res.ok) throw new Error(`Failed to clear telemetry: HTTP ${res.status}`);
    const data = await res.json() as any;
    return !!data.success;
  }

  async exportTelemetryCsv(): Promise<string> {
    if (authService.isMock) {
      const timeline = await this.getTimeline();
      const headers = ['Timestamp', 'User', 'Workspace', 'Feature', 'Requested Model', 'Fallback Model', 'Prompt Tokens', 'Completion Tokens', 'Latency (ms)', 'Success', 'Error Class', 'Estimated Cost ($)'];
      let csv = headers.join(',') + '\n';
      for (const r of timeline) {
        const row = [
          r.timestamp,
          r.user,
          r.workspace,
          r.feature,
          r.selectedModel,
          r.fallbackModel || 'None',
          r.promptTokens,
          r.completionTokens,
          r.latency,
          r.success ? 'TRUE' : 'FALSE',
          r.errorClassification || 'None',
          r.estimatedCost
        ];
        csv += row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',') + '\n';
      }
      return csv;
    }

    const headers = await this.getAuthHeaders();
    const res = await fetch(buildApiUrl('api/admin/ai-orchestrator/export-csv'), { headers });
    if (!res.ok) throw new Error(`Failed to export CSV: HTTP ${res.status}`);
    return await res.text();
  }
}

export const aiOrchestratorService = new AIOrchestratorService();
