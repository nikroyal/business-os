export type LogicalModel = 'Latest Flash' | 'Latest Pro' | 'Automatic';
export type Subsystem = 'Editorial Commentary' | 'Research Engine' | 'Business School' | 'Copilot';

export type TaskType = 
  | 'deep_research'
  | 'copilot_conversation'
  | 'market_summary'
  | 'company_analysis'
  | 'report_generation'
  | 'daily_briefing'
  | 'long_writing'
  | 'short_summarization';

export interface ModelMetadata {
  id: string;
  displayName: string;
  category: 'Flash' | 'Pro';
  priority: number; // Lower is higher priority (e.g. 1 is highest)
  capabilityScore: number;
  reasoningScore: number;
  speedScore: number;
  stabilityScore: number;
  status: 'production' | 'preview';
  provider: string; // 'Google'
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
  inputCostPer1M: number;
  outputCostPer1M: number;
}

// Provider Adapter Interface
export interface AIProviderAdapter {
  id: string;
  displayName: string;
  executePrompt(
    modelId: string,
    systemPrompt: string,
    userPrompt: string,
    apiKey: string,
    timeoutMs: number
  ): Promise<{
    text: string;
    rawResponse: any;
    promptTokens?: number;
    completionTokens?: number;
  }>;
}

// Google Gemini API Provider Adapter
export class GoogleGeminiAdapter implements AIProviderAdapter {
  id = 'google';
  displayName = 'Google AI Studio';

  async executePrompt(
    modelId: string,
    systemPrompt: string,
    userPrompt: string,
    apiKey: string,
    timeoutMs: number
  ): Promise<{ text: string; rawResponse: any; promptTokens?: number; completionTokens?: number }> {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
    const payload = {
      contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
      generationConfig: { responseMimeType: 'application/json' }
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const text = await res.text();

      if (!res.ok) {
        throw new Error(`Google API returned HTTP ${res.status}: ${text}`);
      }

      const data = JSON.parse(text);
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) throw new Error('Empty response from Google API');

      // Use actual provider token counts when available
      const promptTokens = data.usageMetadata?.promptTokenCount;
      const completionTokens = data.usageMetadata?.candidatesTokenCount;

      return {
        text: rawText,
        rawResponse: data,
        promptTokens,
        completionTokens
      };
    } catch (e: any) {
      clearTimeout(timeoutId);
      throw e;
    }
  }
}

export const GEMINI_MODEL_MAPPING = {
  'Latest Flash': 'gemini-3.5-flash',
  'Latest Pro': 'gemini-3.1-pro-preview'
};

export const SUBSYSTEM_AUTOMATIC_MAPPING: Record<Subsystem, keyof typeof GEMINI_MODEL_MAPPING> = {
  'Editorial Commentary': 'Latest Flash',
  'Research Engine': 'Latest Pro',
  'Business School': 'Latest Flash',
  'Copilot': 'Latest Pro'
};

// Global in-memory local cache for configs & stats
const modelLocalStats = new Map<string, { requests: number; success: number; failure: number; totalLatencyMs: number; lastSuccess?: string; lastFailure?: string; lastFailureReason?: string }>();
const providerLocalStats = new Map<string, { requests: number; success: number; failure: number; totalLatencyMs: number }>();
let localCooldownCache: Record<string, number> = {};
let localCooldownCacheExpiry = 0;

// Simple Firestore REST helpers
const firestoreUrl = (projectId: string, path: string) =>
  `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}`;

const firestoreFetch = async (projectId: string, path: string, token?: string, options: RequestInit = {}): Promise<Response> => {
  const headers = {
    ...(options.headers || {}),
  } as Record<string, string>;
  if (token && !token.startsWith('mock_')) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return await fetch(firestoreUrl(projectId, path), {
    ...options,
    headers
  });
};

export function toFirestoreValue(value: any): any {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: value.toString() } : { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(item => toFirestoreValue(item)) } };
  }
  if (typeof value === 'object') {
    const fields: any = {};
    for (const [k, v] of Object.entries(value)) {
      fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

export function fromFirestoreDoc(doc: any): any {
  if (!doc) return null;
  const fields = doc.fields;
  if (!fields) return null;
  const result: any = { id: doc.name ? doc.name.split('/').pop() : undefined };
  for (const [k, v] of Object.entries(fields)) {
    result[k] = fromFirestoreValue(v);
  }
  return result;
}

function fromFirestoreValue(val: any): any {
  if (!val) return null;
  if ('stringValue' in val) return val.stringValue;
  if ('booleanValue' in val) return val.booleanValue;
  if ('integerValue' in val) return parseInt(val.integerValue, 10);
  if ('doubleValue' in val) return val.doubleValue;
  if ('nullValue' in val) return null;
  if ('arrayValue' in val) {
    const arr = val.arrayValue.values || [];
    return arr.map((item: any) => fromFirestoreValue(item));
  }
  if ('mapValue' in val) {
    const fields = val.mapValue.fields || {};
    const res: any = {};
    for (const [k, v] of Object.entries(fields)) {
      res[k] = fromFirestoreValue(v);
    }
    return res;
  }
  return null;
}

export class AIOrchestrator {
  private static adapters: Record<string, AIProviderAdapter> = {
    'google': new GoogleGeminiAdapter()
  };

  public static readonly DEFAULT_MODELS: ModelMetadata[] = [
    {
      id: 'gemini-3.5-flash',
      displayName: 'Gemini 3.5 Flash',
      category: 'Flash',
      priority: 1,
      capabilityScore: 95,
      reasoningScore: 90,
      speedScore: 95,
      stabilityScore: 95,
      status: 'production',
      provider: 'google',
      supportsGrounding: true,
      supportsStructuredOutput: true,
      supportsLongContext: true,
      supportsStreaming: true,
      supportsVision: true,
      supportsAudio: true,
      supportsTools: true,
      defaultTimeoutMs: 15000,
      retryCount: 1,
      cooldownDurationMs: 300000, // 5 minutes
      enabled: true,
      inputCostPer1M: 0.075,
      outputCostPer1M: 0.30
    },
    {
      id: 'gemini-3.1-pro-preview',
      displayName: 'Gemini 3.1 Pro (Preview)',
      category: 'Pro',
      priority: 2,
      capabilityScore: 98,
      reasoningScore: 98,
      speedScore: 70,
      stabilityScore: 85,
      status: 'preview',
      provider: 'google',
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
      inputCostPer1M: 1.25,
      outputCostPer1M: 5.00
    },
    {
      id: 'gemini-2.5-pro',
      displayName: 'Gemini 2.5 Pro',
      category: 'Pro',
      priority: 3,
      capabilityScore: 94,
      reasoningScore: 95,
      speedScore: 75,
      stabilityScore: 92,
      status: 'production',
      provider: 'google',
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
      inputCostPer1M: 1.25,
      outputCostPer1M: 5.00
    },
    {
      id: 'gemini-2.5-flash',
      displayName: 'Gemini 2.5 Flash',
      category: 'Flash',
      priority: 4,
      capabilityScore: 88,
      reasoningScore: 82,
      speedScore: 92,
      stabilityScore: 94,
      status: 'production',
      provider: 'google',
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
      inputCostPer1M: 0.075,
      outputCostPer1M: 0.30
    },
    {
      id: 'gemini-flash-latest',
      displayName: 'Gemini Flash (Latest Alias)',
      category: 'Flash',
      priority: 5,
      capabilityScore: 90,
      reasoningScore: 85,
      speedScore: 90,
      stabilityScore: 90,
      status: 'production',
      provider: 'google',
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
      inputCostPer1M: 0.075,
      outputCostPer1M: 0.30
    },
    {
      id: 'gemini-pro-latest',
      displayName: 'Gemini Pro (Latest Alias)',
      category: 'Pro',
      priority: 6,
      capabilityScore: 93,
      reasoningScore: 93,
      speedScore: 72,
      stabilityScore: 90,
      status: 'production',
      provider: 'google',
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
      inputCostPer1M: 1.25,
      outputCostPer1M: 5.00
    }
  ];

  private static cacheConfig: { data: any; timestamp: number } | null = null;
  private static readonly CONFIG_CACHE_TTL_MS = 5000;

  // --- TASK CLASSIFICATION MATRIX ---
  public static selectBestModelForTask(task: TaskType, models: ModelMetadata[]): string {
    const active = models.filter(m => m.enabled);
    if (active.length === 0) return 'gemini-3.5-flash';

    switch (task) {
      case 'deep_research':
        // Prefers highest reasoning and long context
        return active.find(m => m.id === 'gemini-3.1-pro-preview')?.id || 
               active.find(m => m.id === 'gemini-2.5-pro')?.id || 
               active[0].id;
      case 'copilot_conversation':
        // Prefers low latency and high capability
        return active.find(m => m.id === 'gemini-3.5-flash')?.id || 
               active.find(m => m.id === 'gemini-2.5-flash')?.id || 
               active[0].id;
      case 'market_summary':
      case 'short_summarization':
      case 'daily_briefing':
        // Prefers fastest response and lowest cost
        return active.find(m => m.id === 'gemini-2.5-flash')?.id || 
               active.find(m => m.id === 'gemini-3.5-flash')?.id || 
               active[0].id;
      case 'report_generation':
      case 'long_writing':
      case 'company_analysis':
        // Prefers stability and structured output capabilities
        return active.find(m => m.id === 'gemini-2.5-pro')?.id || 
               active.find(m => m.id === 'gemini-3.1-pro-preview')?.id || 
               active[0].id;
      default:
        return active[0].id;
    }
  }

  // --- STATUTORY SUB-SYSTEM MAPPING TO TASKS ---
  private static mapSubsystemToTask(subsystem: Subsystem): TaskType {
    switch (subsystem) {
      case 'Research Engine': return 'deep_research';
      case 'Copilot': return 'copilot_conversation';
      case 'Editorial Commentary': return 'market_summary';
      case 'Business School': return 'company_analysis';
      default: return 'copilot_conversation';
    }
  }

  public static classifyError(status: number, bodyText: string): string {
    const text = bodyText.toLowerCase();
    if (status === 503 || text.includes('experiencing high demand') || text.includes('overloaded') || text.includes('service unavailable')) {
      return 'MODEL_OVERLOADED';
    }
    if (text.includes('quota exceeded') || text.includes('resourceexhausted') || (status === 429 && text.includes('quota'))) {
      return 'DAILY_QUOTA_EXCEEDED';
    }
    if (status === 429 || text.includes('rate limit') || text.includes('too many requests')) {
      return 'RATE_LIMITED';
    }
    if (status === 401 || status === 403 || text.includes('api key not valid') || text.includes('invalid api key')) {
      return 'INVALID_API_KEY';
    }
    if (text.includes('billing') || text.includes('quota exceeded due to billing')) {
      return 'BILLING_REQUIRED';
    }
    if (status === 404 || text.includes('model not found') || text.includes('not available')) {
      return 'MODEL_NOT_FOUND';
    }
    if (status === 408 || text.includes('timeout') || text.includes('deadline exceeded')) {
      return 'REQUEST_TIMEOUT';
    }
    if (status >= 500) {
      return 'INTERNAL_PROVIDER_ERROR';
    }
    return 'UNKNOWN_PROVIDER_ERROR';
  }

  public static async recordTelemetry(projectId: string, telemetry: any): Promise<void> {
    try {
      const docId = `telemetry_${Date.now()}_${crypto.randomUUID()}`;
      const doc = { fields: {} as any };
      for (const [k, v] of Object.entries(telemetry)) {
        doc.fields[k] = toFirestoreValue(v);
      }
      await fetch(firestoreUrl(projectId, `aiTelemetry/${docId}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(doc)
      });
    } catch (e) {
      console.error('[AIOrchestrator] Telemetry save failed:', e);
    }
  }

  private static async getPersistentCooldowns(projectId: string, token?: string): Promise<Record<string, number>> {
    const now = Date.now();
    if (localCooldownCacheExpiry > now) {
      return localCooldownCache;
    }

    try {
      const res = await firestoreFetch(projectId, 'system/aiOrchestratorCooldowns', token);
      if (res.ok) {
        const raw = await res.json() as any;
        const data = fromFirestoreDoc(raw) || {};
        const parsed: Record<string, number> = {};
        for (const [k, v] of Object.entries(data)) {
          if (typeof v === 'number' && v > now) {
            parsed[k] = v;
          }
        }
        localCooldownCache = parsed;
        localCooldownCacheExpiry = now + 5000; // cache for 5 seconds
        return parsed;
      }
    } catch (e) {
      console.warn('[AIOrchestrator] Cooldown fetch failed, using local fallback:', e);
    }
    return localCooldownCache;
  }

  private static async setPersistentCooldown(projectId: string, modelId: string, until: number): Promise<void> {
    localCooldownCache[modelId] = until;
    try {
      const doc = { fields: {} as any };
      for (const [k, v] of Object.entries(localCooldownCache)) {
        doc.fields[k] = toFirestoreValue(v);
      }
      await fetch(firestoreUrl(projectId, 'system/aiOrchestratorCooldowns'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(doc)
      });
    } catch (e) {
      console.error('[AIOrchestrator] Cooldown write failed:', e);
    }
  }

  public static async flushCooldowns(projectId: string): Promise<void> {
    localCooldownCache = {};
    localCooldownCacheExpiry = 0;
    try {
      await fetch(firestoreUrl(projectId, 'system/aiOrchestratorCooldowns'), {
        method: 'DELETE'
      });
    } catch (e) {
      console.error('[AIOrchestrator] Flush cooldowns failed:', e);
    }
  }

  // --- RETENTION POLICY & CLEANUP ---
  public static async runTelemetryRetentionCleanup(projectId: string, retentionDays = 30): Promise<void> {
    try {
      const threshold = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
      const telemetry = await this.getTelemetry(projectId);
      const toDelete = telemetry.filter(record => new Date(record.timestamp).getTime() < threshold);
      
      console.log(`[AIOrchestrator] Retention Cleanup: deleting ${toDelete.length} legacy telemetry logs.`);
      for (const record of toDelete) {
        await fetch(firestoreUrl(projectId, `aiTelemetry/${record.id}`), {
          method: 'DELETE'
        });
      }
    } catch (e) {
      console.error('[AIOrchestrator] Telemetry cleanup failed:', e);
    }
  }

  // --- GENERAL SYSTEM CONFIGS ---
  public static async getOrchestratorConfig(projectId: string, token?: string): Promise<any> {
    const now = Date.now();
    if (this.cacheConfig && (now - this.cacheConfig.timestamp < this.CONFIG_CACHE_TTL_MS)) {
      return this.cacheConfig.data;
    }

    try {
      const res = await firestoreFetch(projectId, 'system/aiOrchestrator', token);
      if (res.ok) {
        const raw = await res.json() as any;
        const config = fromFirestoreDoc(raw);
        this.cacheConfig = { data: config, timestamp: now };
        return config;
      }
    } catch (e) {
      console.warn('[AIOrchestrator] Config fetch failed, using default registry overrides:', e);
    }
    return null;
  }

  public static async saveOrchestratorConfig(projectId: string, config: any, token?: string): Promise<boolean> {
    try {
      const doc = { fields: {} as any };
      for (const [k, v] of Object.entries(config)) {
        doc.fields[k] = toFirestoreValue(v);
      }
      const res = await firestoreFetch(projectId, 'system/aiOrchestrator', token, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(doc)
      });
      if (res.ok) {
        this.cacheConfig = { data: config, timestamp: Date.now() };
        return true;
      }
    } catch (e) {
      console.error('[AIOrchestrator] Save configuration failed:', e);
    }
    return false;
  }

  public static async clearTelemetry(projectId: string): Promise<void> {
    try {
      const telemetry = await this.getTelemetry(projectId);
      for (const record of telemetry) {
        await fetch(firestoreUrl(projectId, `aiTelemetry/${record.id}`), {
          method: 'DELETE'
        });
      }
    } catch (e) {
      console.error('[AIOrchestrator] Clear telemetry failed:', e);
    }
  }

  // --- EXECUTE PROMPTS VIA ADAPTERS ---
  public static async execute(
    subsystem: Subsystem,
    systemPrompt: string,
    userPrompt: string,
    preferredChoice: string | undefined,
    projectId: string,
    apiKey: string,
    userId: string,
    workspaceId = 'default'
  ): Promise<{ data: any; originalModel: string; actualModel: string; retries: number; fallbackUsed: boolean; errorReason?: string }> {
    const startTime = Date.now();
    let retriesCount = 0;
    
    // 1. Fetch system configs and checks
    const config = await this.getOrchestratorConfig(projectId);
    const maintenanceMode = config?.maintenanceMode || false;
    if (maintenanceMode) {
      throw new Error('AIOrchestrator: System is currently undergoing scheduled maintenance. Please try again shortly.');
    }

    const forcedModel = config?.forcedModel || null;
    const modelOverrides = config?.modelOverrides || {};

    // 2. Fetch shared persistent cooldown state
    const persistentCooldowns = await this.getPersistentCooldowns(projectId);

    // Build model objects mapping configurations
    const registryList = this.DEFAULT_MODELS.map(m => {
      const override = modelOverrides[m.id];
      return {
        ...m,
        enabled: override && override.enabled !== undefined ? override.enabled : m.enabled,
        priority: override && override.priority !== undefined ? override.priority : m.priority,
        cooldownDurationMs: override && override.cooldownDurationMs !== undefined ? override.cooldownDurationMs : m.cooldownDurationMs
      };
    });

    // 3. Task-Based model selection
    const taskType = this.mapSubsystemToTask(subsystem);
    const taskModelDefault = this.selectBestModelForTask(taskType, registryList);

    let targetModelId = '';
    const logicalChoice = preferredChoice || 'Automatic';

    if (forcedModel) {
      targetModelId = forcedModel;
    } else if (logicalChoice === 'Automatic') {
      targetModelId = taskModelDefault;
    } else if (logicalChoice.startsWith('gemini-') || logicalChoice.includes('-')) {
      targetModelId = logicalChoice;
    } else {
      targetModelId = LogicalModelResolve(logicalChoice, subsystem);
    }

    const requestedModel = targetModelId;

    // Filter and sort healthy active models
    const activeModels = registryList.filter(m => m.enabled);
    const sortedFallbackChain = [...activeModels].sort((a, b) => a.priority - b.priority);

    const chain: typeof sortedFallbackChain = [];
    const isCooldowned = (id: string) => {
      const until = persistentCooldowns[id] || 0;
      return Date.now() < until;
    };

    const reqModelObj = activeModels.find(m => m.id === requestedModel);
    if (reqModelObj && !isCooldowned(requestedModel)) {
      chain.push(reqModelObj);
    }

    for (const m of sortedFallbackChain) {
      if (m.id !== requestedModel && !isCooldowned(m.id)) {
        chain.push(m);
      }
    }

    // Force fallback if chain empty
    if (chain.length === 0) {
      console.warn('[AIOrchestrator] All registry models are in cooldown. Attempting fallback chain.');
      if (reqModelObj) chain.push(reqModelObj);
      chain.push(...sortedFallbackChain.filter(m => m.id !== requestedModel));
    }

    let lastErrorType = 'UNKNOWN_PROVIDER_ERROR';
    let lastErrorMsg = 'All models are down';
    let finalPayload: any = null;
    let finalModelId = '';
    let fallbackUsed = false;
    let finalPromptTokens = 0;
    let finalCompletionTokens = 0;
    let tokenCountSource: 'provider' | 'estimated' = 'estimated';

    // 4. Try models in fallback chain
    for (let i = 0; i < chain.length; i++) {
      const model = chain[i];
      finalModelId = model.id;
      fallbackUsed = model.id !== requestedModel;

      const adapter = this.adapters[model.provider];
      if (!adapter) {
        console.error(`[AIOrchestrator] Unsupported provider adapter: ${model.provider}`);
        continue;
      }

      // Track model request
      const modelStats = modelLocalStats.get(model.id) || { requests: 0, success: 0, failure: 0, totalLatencyMs: 0 };
      modelStats.requests++;

      // Track provider request
      const provStats = providerLocalStats.get(model.provider) || { requests: 0, success: 0, failure: 0, totalLatencyMs: 0 };
      provStats.requests++;

      let attemptSuccess = false;
      let attemptStatus = 200;
      let attemptBody = '';
      const modelStartTime = Date.now();

      const maxRetries = model.retryCount || 1;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (attempt > 0) retriesCount++;

        try {
          const result = await adapter.executePrompt(
            model.id,
            systemPrompt,
            userPrompt,
            apiKey,
            model.defaultTimeoutMs
          );

          finalPayload = result.rawResponse;
          attemptSuccess = true;

          // Use actual provider token counts when available; fall back to estimation.
          // tokenCountSource is recorded in telemetry so consumers can distinguish real vs estimated.
          const hasRealTokens = typeof result.promptTokens === 'number' && typeof result.completionTokens === 'number';
          finalPromptTokens = hasRealTokens ? result.promptTokens! : Math.ceil((systemPrompt.length + userPrompt.length) / 4);
          finalCompletionTokens = hasRealTokens ? result.completionTokens! : Math.ceil((result.text.length) / 4);
          tokenCountSource = hasRealTokens ? 'provider' : 'estimated';
          break;
        } catch (e: any) {
          attemptStatus = e.status || 500;
          attemptBody = e.message || String(e);
          console.warn(`[AIOrchestrator] Execution failed (Attempt ${attempt + 1}): ${attemptBody}`);
        }

        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 1000));
        }
      }

      const modelLatency = Date.now() - modelStartTime;

      if (attemptSuccess) {
        modelStats.success++;
        modelStats.lastSuccess = new Date().toISOString();
        modelStats.totalLatencyMs += modelLatency;
        modelLocalStats.set(model.id, modelStats);

        provStats.success++;
        provStats.totalLatencyMs += modelLatency;
        providerLocalStats.set(model.provider, provStats);
        break;
      } else {
        modelStats.failure++;
        modelStats.lastFailure = new Date().toISOString();
        modelStats.lastFailureReason = lastErrorType;
        modelLocalStats.set(model.id, modelStats);

        provStats.failure++;
        providerLocalStats.set(model.provider, provStats);

        lastErrorType = this.classifyError(attemptStatus, attemptBody);
        lastErrorMsg = attemptBody;

        if (['MODEL_OVERLOADED', 'DAILY_QUOTA_EXCEEDED', 'RATE_LIMITED'].includes(lastErrorType)) {
          const cooldownExpiry = Date.now() + model.cooldownDurationMs;
          await this.setPersistentCooldown(projectId, model.id, cooldownExpiry);
        }
      }
    }

    const totalLatency = Date.now() - startTime;
    let totalTokens = finalPromptTokens + finalCompletionTokens;
    let cost = 0.0;
    
    if (finalPayload) {
      const matched = registryList.find(m => m.id === finalModelId);
      if (matched) {
        cost = ((finalPromptTokens / 1000000) * matched.inputCostPer1M) +
               ((finalCompletionTokens / 1000000) * matched.outputCostPer1M);
      }
    }

    // 5. Telemetry
    const telemetry = {
      timestamp: new Date().toISOString(),
      user: userId,
      workspace: workspaceId,
      feature: subsystem,
      selectedModel: requestedModel,
      fallbackModel: fallbackUsed ? finalModelId : '',
      promptTokens: finalPromptTokens,
      completionTokens: finalCompletionTokens,
      totalTokens,
      latency: totalLatency,
      success: !!finalPayload,
      errorClassification: finalPayload ? '' : lastErrorType,
      retryCount: retriesCount,
      estimatedCost: cost,
      cachedResponse: false,
      // Distinguishes official provider-reported counts from character-division estimates.
      // Consumers should display or flag this field when presenting token metrics.
      tokenCountSource
    };

    this.recordTelemetry(projectId, telemetry).catch((e: any) => console.error('[AIOrchestrator] Async telemetry save failed:', e));

    if (!finalPayload) {
      throw new Error(`AIOrchestrator: Request failed. Error Class: ${lastErrorType} - ${lastErrorMsg}`);
    }

    return {
      data: finalPayload,
      originalModel: requestedModel,
      actualModel: finalModelId,
      retries: retriesCount,
      fallbackUsed,
      errorReason: fallbackUsed ? lastErrorType : undefined
    };
  }

  public static async executeCommentary(
    systemPrompt: string,
    userPrompt: string,
    preferredChoice: string | undefined,
    projectId: string,
    apiKey: string,
    userId: string,
    workspaceId = 'default'
  ): Promise<any> {
    const { data, fallbackUsed, actualModel } = await this.execute(
      'Editorial Commentary',
      systemPrompt,
      userPrompt,
      preferredChoice,
      projectId,
      apiKey,
      userId,
      workspaceId
    );

    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) throw new Error('Empty response content from Gemini model.');
    const parsed = JSON.parse(rawText.trim());

    if (fallbackUsed) {
      parsed._metadata = {
        fallbackModelUsed: true,
        requestedModel: preferredChoice || 'gemini-3.5-flash',
        actualModel,
        infoMessage: `Temporarily switched to ${actualModel} due to high demand on ${preferredChoice || 'gemini-3.5-flash'}.`
      };
    }
    return parsed;
  }

  // --- TELEMETRY EXPORT HELPER ---
  public static async getTelemetryCsv(projectId: string): Promise<string> {
    const telemetry = await this.getTelemetry(projectId);
    const headers = ['Timestamp', 'User', 'Workspace', 'Feature', 'Requested Model', 'Fallback Model', 'Prompt Tokens', 'Completion Tokens', 'Latency (ms)', 'Success', 'Error Class', 'Estimated Cost ($)'];
    let csv = headers.join(',') + '\n';
    
    for (const r of telemetry) {
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

  // --- PROVIDER & MODEL HEALTH TESTS ---
  public static async triggerHealthTest(_projectId: string, apiKey: string, type: 'provider' | 'model', targetId: string): Promise<any> {
    const startTime = Date.now();
    const systemPrompt = 'Health test verification';
    const userPrompt = 'Return json: {"status": "ok"}';
    const timeout = 10000;

    if (type === 'provider') {
      // Test Google Gemini provider status
      const adapter = this.adapters.google;
      try {
        await adapter.executePrompt('gemini-3.5-flash', systemPrompt, userPrompt, apiKey, timeout);
        return { success: true, latency: Date.now() - startTime, message: 'Provider connection is fully active' };
      } catch (e: any) {
        return { success: false, latency: Date.now() - startTime, message: `Provider test failed: ${e.message || e}` };
      }
    } else {
      // Test individual model status
      const model = this.DEFAULT_MODELS.find(m => m.id === targetId);
      if (!model) return { success: false, message: `Model ${targetId} not found` };
      
      const adapter = this.adapters[model.provider];
      try {
        await adapter.executePrompt(model.id, systemPrompt, userPrompt, apiKey, timeout);
        return { success: true, latency: Date.now() - startTime, message: `Model ${model.id} is healthy` };
      } catch (e: any) {
        return { success: false, latency: Date.now() - startTime, message: `Model test failed: ${e.message || e}` };
      }
    }
  }

  // --- TELEMETRY READ LOGS ---
  // pageSize=500 ensures retention cleanup can act on a representative recent window.
  // Firestore orderBy requires a composite index; ordering client-side instead.
  public static async getTelemetry(projectId: string, token?: string): Promise<any[]> {
    try {
      const res = await firestoreFetch(projectId, 'aiTelemetry?pageSize=500', token);
      if (res.ok) {
        const raw = await res.json() as any;
        return (raw.documents || []).map((d: any) => fromFirestoreDoc(d)).filter(Boolean);
      }
    } catch (e) {
      console.error('[AIOrchestrator] Telemetry fetch failed:', e);
    }
    return [];
  }

  // --- COMPILE DETAILED OPERATIONAL METRICS ---
  public static async getOperationalStats(projectId: string, token?: string): Promise<any> {
    const config = await this.getOrchestratorConfig(projectId, token);
    const forcedModel = config?.forcedModel || null;
    const modelOverrides = config?.modelOverrides || {};
    const maintenanceMode = config?.maintenanceMode || false;
    const retentionDays = config?.retentionDays || 30;

    const persistentCooldowns = await this.getPersistentCooldowns(projectId, token);
    const telemetry = await this.getTelemetry(projectId, token);
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const startOfToday = now - oneDayMs;

    let requestsToday = 0;
    let tokensToday = 0;
    let promptTokensToday = 0;
    let completionTokensToday = 0;
    let costToday = 0;
    let totalFailovers = 0;
    let totalRetries = 0;
    let totalLatencyMs = 0;
    let successCount = 0;
    let cachedResponses = 0;
    let totalRequests30d = 0;

    const featureCost: Record<string, number> = {};
    const workspaceCost: Record<string, number> = {};
    const userCost: Record<string, number> = {};

    for (const record of telemetry) {
      const recTime = new Date(record.timestamp).getTime();
      const isToday = recTime >= startOfToday;

      totalRequests30d++;

      if (isToday) {
        requestsToday++;
        tokensToday += (record.totalTokens || 0);
        promptTokensToday += (record.promptTokens || 0);
        completionTokensToday += (record.completionTokens || 0);
        costToday += (record.estimatedCost || 0);
        if (record.cachedResponse) cachedResponses++;
      }

      if (record.success) successCount++;
      totalLatencyMs += (record.latency || 0);
      totalRetries += (record.retryCount || 0);
      if (record.fallbackModel && record.fallbackModel !== '') {
        totalFailovers++;
      }

      const feat = record.feature || 'Unknown';
      featureCost[feat] = (featureCost[feat] || 0) + (record.estimatedCost || 0);

      const ws = record.workspace || 'Unknown';
      workspaceCost[ws] = (workspaceCost[ws] || 0) + (record.estimatedCost || 0);

      const usr = record.user || 'Unknown';
      userCost[usr] = (userCost[usr] || 0) + (record.estimatedCost || 0);
    }

    const cacheHitRate = requestsToday > 0 ? Math.round((cachedResponses / requestsToday) * 100) : 0;
    // Cost savings: assume a cached response would have cost the average non-cached cost
    const avgNonCachedCost = (requestsToday - cachedResponses) > 0
      ? costToday / (requestsToday - cachedResponses)
      : 0;
    const estimatedCostSavings = cachedResponses * avgNonCachedCost;

    const totalRequests = telemetry.length;
    const overallSuccessRate = totalRequests > 0 ? (successCount / totalRequests) * 100 : 100;
    const avgLatency = successCount > 0 ? totalLatencyMs / successCount : 0;

    // Provider Aggregates
    const googleProvStats = providerLocalStats.get('google') || { requests: 0, success: 0, failure: 0, totalLatencyMs: 0 };
    const googleSuccessRate = googleProvStats.requests > 0 ? (googleProvStats.success / googleProvStats.requests) * 100 : 100;
    const googleLatency = googleProvStats.success > 0 ? googleProvStats.totalLatencyMs / googleProvStats.success : 0;

    const providerStatus = {
      id: 'google',
      displayName: 'Google AI Studio',
      health: googleSuccessRate > 90 ? 'operational' : 'degraded',
      successRate: Math.round(googleSuccessRate),
      averageLatencyMs: Math.round(googleLatency)
    };

    // Models Aggregates
    const models = this.DEFAULT_MODELS.map(m => {
      const override = modelOverrides[m.id];
      const stats = modelLocalStats.get(m.id) || { requests: 0, success: 0, failure: 0, totalLatencyMs: 0, lastSuccess: '', lastFailure: '', lastFailureReason: '' };
      const cd = persistentCooldowns[m.id] || 0;
      const cooldownRemaining = Math.max(0, cd - now);

      const successRate = stats.requests > 0 ? (stats.success / stats.requests) * 100 : 100;
      const avgModelLatency = stats.success > 0 ? stats.totalLatencyMs / stats.requests : 0;

      return {
        ...m,
        enabled: override && override.enabled !== undefined ? override.enabled : m.enabled,
        priority: override && override.priority !== undefined ? override.priority : m.priority,
        cooldownDurationMs: override && override.cooldownDurationMs !== undefined ? override.cooldownDurationMs : m.cooldownDurationMs,
        isForced: forcedModel === m.id,
        cooldownRemaining,
        stats: {
          requests: stats.requests,
          success: stats.success,
          failure: stats.failure,
          avgLatencyMs: Math.round(avgModelLatency),
          successRate: Math.round(successRate),
          lastSuccess: stats.lastSuccess || '',
          lastFailure: stats.lastFailure || '',
          lastFailureReason: stats.lastFailureReason || ''
        }
      };
    });

    const requestsPerMinute = requestsToday / 1440;
    const tokensPerMinute = tokensToday / 1440;

    // Daily quota limit — configurable from Developer Console; defaults to 1500 (free tier)
    const dailyQuotaLimit: number = config?.dailyQuotaLimit || 1500;

    return {
      overview: {
        activeProvider: 'Google Gemini',
        overallHealth: overallSuccessRate > 80 ? 'healthy' : 'degraded',
        overallSuccessRate: Math.round(overallSuccessRate),
        averageLatencyMs: Math.round(avgLatency),
        requestsToday,
        requestsThisMonth: totalRequests30d,
        tokensToday,
        promptTokensToday,
        completionTokensToday,
        estimatedDailyCost: costToday,
        estimatedMonthlyCost: costToday * 30,
        totalFailovers,
        totalRetries,
        maintenanceMode,
        retentionDays,
        dailyQuotaLimit,
        cachedResponses,
        cacheHitRate,
        estimatedCostSavings
      },
      provider: providerStatus,
      models,
      breakdowns: {
        featureCost,
        workspaceCost,
        userCost
      },
      quota: {
        requestsPerMinute: Math.round(requestsPerMinute * 10) / 10,
        tokensPerMinute: Math.round(tokensPerMinute),
        estimatedRemainingDailyRequests: Math.max(0, dailyQuotaLimit - requestsToday),
        quotaUtilisationPercentage: Math.round(Math.min(100, (requestsToday / dailyQuotaLimit) * 100)),
        // Clearly mark this as BusinessOS-estimated, not provider-reported
        source: 'businessos_estimate' as const
      }
    };
  }
}

function LogicalModelResolve(choice: string, subsystem: Subsystem): string {
  const modelChoice = choice || 'Automatic';
  if (modelChoice === 'Automatic') {
    const automaticChoice = SUBSYSTEM_AUTOMATIC_MAPPING[subsystem];
    return GEMINI_MODEL_MAPPING[automaticChoice];
  }
  if (modelChoice === 'Latest Flash' || modelChoice === 'Latest Pro') {
    return GEMINI_MODEL_MAPPING[modelChoice as 'Latest Flash' | 'Latest Pro'];
  }
  return GEMINI_MODEL_MAPPING['Latest Flash'];
}

export class AIModelRegistry {
  public static resolveModel(choice: string | undefined, subsystem: Subsystem): string {
    const modelChoice = choice || 'Automatic';

    if (modelChoice === 'Automatic') {
      const automaticChoice = SUBSYSTEM_AUTOMATIC_MAPPING[subsystem];
      return GEMINI_MODEL_MAPPING[automaticChoice];
    }

    if (modelChoice === 'Latest Flash' || modelChoice === 'Latest Pro') {
      return GEMINI_MODEL_MAPPING[modelChoice as 'Latest Flash' | 'Latest Pro'];
    }

    if (typeof modelChoice === 'string' && (modelChoice.startsWith('gemini-') || modelChoice.includes('-'))) {
      return modelChoice;
    }

    return GEMINI_MODEL_MAPPING['Latest Flash'];
  }
}
