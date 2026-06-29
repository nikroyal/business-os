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
  tokensToday: number;
  estimatedDailyCost: number;
  estimatedMonthlyCost: number;
  totalFailovers: number;
  totalRetries: number;
}

export interface QuotaStats {
  requestsPerMinute: number;
  tokensPerMinute: number;
  estimatedRemainingDailyRequests: number;
  quotaUtilisationPercentage: number;
}

export interface OrchestratorStats {
  overview: OverviewStats;
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
}

export interface OrchestratorConfig {
  forcedModel: string | null;
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
    const headers = await this.getAuthHeaders();
    const res = await fetch(buildApiUrl('api/admin/ai-orchestrator/stats'), { headers });
    if (!res.ok) throw new Error(`Failed to load AI stats: HTTP ${res.status}`);
    return await res.json() as OrchestratorStats;
  }

  async getTimeline(): Promise<TelemetryRecord[]> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(buildApiUrl('api/admin/ai-orchestrator/timeline'), { headers });
    if (!res.ok) throw new Error(`Failed to load AI timeline: HTTP ${res.status}`);
    return await res.json() as TelemetryRecord[];
  }

  async getConfig(): Promise<OrchestratorConfig> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(buildApiUrl('api/admin/ai-orchestrator/config'), { headers });
    if (!res.ok) throw new Error(`Failed to load AI config: HTTP ${res.status}`);
    return await res.json() as OrchestratorConfig;
  }

  async saveConfig(config: OrchestratorConfig): Promise<boolean> {
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
}

export const aiOrchestratorService = new AIOrchestratorService();
