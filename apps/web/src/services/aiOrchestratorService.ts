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
  };
  quota?: QuotaStats;
}

export interface TelemetryRecord {
  id: string;
  timestamp: string;
  user: string;
  workspace: string;
  feature: string;
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
          overallSuccessRate: 99,
          averageLatencyMs: 850,
          requestsToday: 24,
          requestsThisMonth: 780,
          tokensToday: 68000,
          promptTokensToday: 42000,
          completionTokensToday: 26000,
          estimatedDailyCost: 0.0845,
          estimatedMonthlyCost: 2.535,
          totalFailovers: 0,
          totalRetries: 0,
          dailyQuotaLimit: 1500,
          cachedResponses: 4,
          cacheHitRate: 16,
          estimatedCostSavings: 0.014
        },
        provider: {
          id: "google",
          displayName: "Google AI Studio",
          health: "operational",
          successRate: 100,
          averageLatencyMs: 850
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
            stats: {
              requests: 18,
              success: 18,
              failure: 0,
              avgLatencyMs: 620,
              successRate: 100,
              lastSuccess: new Date().toISOString(),
              lastFailure: "",
              lastFailureReason: ""
            }
          },
          {
            id: "gemini-3.1-pro-preview",
            displayName: "Gemini 3.1 Pro (Preview)",
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
            stats: {
              requests: 6,
              success: 6,
              failure: 0,
              avgLatencyMs: 2800,
              successRate: 100,
              lastSuccess: new Date().toISOString(),
              lastFailure: "",
              lastFailureReason: ""
            }
          }
        ],
        breakdowns: {
          featureCost: {
            "Editorial Commentary": 0.0035,
            "Research Engine": 0.078,
            "Copilot": 0.003
          },
          workspaceCost: {
            "default": 0.0845
          },
          userCost: {
            "mock_owner_1": 0.0065,
            "mock_free_1": 0.078
          }
        },
        quota: {
          requestsPerMinute: 0.02,
          tokensPerMinute: 47,
          estimatedRemainingDailyRequests: 1476,
          quotaUtilisationPercentage: 2,
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
      
      const defaultTimeline: TelemetryRecord[] = [
        {
          id: "telemetry_mock_1",
          timestamp: new Date().toISOString(),
          user: "mock_owner_1",
          workspace: "default",
          feature: "Editorial Commentary",
          selectedModel: "gemini-3.5-flash",
          fallbackModel: "",
          promptTokens: 1500,
          completionTokens: 950,
          totalTokens: 2450,
          latency: 1100,
          success: true,
          errorClassification: "",
          retryCount: 0,
          estimatedCost: 0.0004,
          cachedResponse: false,
          tokenCountSource: "provider"
        },
        {
          id: "telemetry_mock_2",
          timestamp: new Date(Date.now() - 600000).toISOString(),
          user: "mock_free_1",
          workspace: "default",
          feature: "Research Engine",
          selectedModel: "gemini-3.1-pro-preview",
          fallbackModel: "",
          promptTokens: 8000,
          completionTokens: 4000,
          totalTokens: 12000,
          latency: 3800,
          success: true,
          errorClassification: "",
          retryCount: 0,
          estimatedCost: 0.0300,
          cachedResponse: false,
          tokenCountSource: "provider"
        }
      ];
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
