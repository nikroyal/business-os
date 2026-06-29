export type LogicalModel = 'Latest Flash' | 'Latest Pro' | 'Automatic';
export type Subsystem = 'Editorial Commentary' | 'Research Engine' | 'Business School' | 'Copilot';

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

// Global in-memory states for dynamic health tracking
const modelCooldowns = new Map<string, number>();
const modelStats = new Map<string, { requests: number; success: number; failure: number; totalLatencyMs: number; lastSuccess?: string; lastFailure?: string }>();

// Simple Firestore REST helper
const firestoreUrl = (projectId: string, path: string) =>
  `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}`;

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
      provider: 'Google',
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
      provider: 'Google',
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
      provider: 'Google',
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
      provider: 'Google',
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
      provider: 'Google',
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
      provider: 'Google',
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
  private static readonly CONFIG_CACHE_TTL_MS = 5000; // 5-second cache to limit Firestore reads

  /**
   * Fetches configuration overrides from Firestore.
   */
  public static async getOrchestratorConfig(projectId: string): Promise<any> {
    const now = Date.now();
    if (this.cacheConfig && (now - this.cacheConfig.timestamp < this.CONFIG_CACHE_TTL_MS)) {
      return this.cacheConfig.data;
    }

    try {
      const res = await fetch(firestoreUrl(projectId, 'system/aiOrchestrator'));
      if (res.ok) {
        const raw = await res.json() as any;
        const config = fromFirestoreDoc(raw);
        this.cacheConfig = { data: config, timestamp: now };
        return config;
      }
    } catch (e) {
      console.warn('[AIOrchestrator] Failed to fetch config, using defaults:', e);
    }
    return null;
  }

  /**
   * Saves configuration overrides to Firestore.
   */
  public static async saveOrchestratorConfig(projectId: string, config: any): Promise<boolean> {
    try {
      const doc = { fields: {} as any };
      for (const [k, v] of Object.entries(config)) {
        doc.fields[k] = toFirestoreValue(v);
      }
      const res = await fetch(firestoreUrl(projectId, 'system/aiOrchestrator'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(doc)
      });
      if (res.ok) {
        this.cacheConfig = { data: config, timestamp: Date.now() };
        return true;
      }
    } catch (e) {
      console.error('[AIOrchestrator] Error saving configuration:', e);
    }
    return false;
  }

  /**
   * Saves request telemetry to Firestore.
   */
  public static async recordTelemetry(projectId: string, telemetry: any): Promise<void> {
    try {
      const docId = `telemetry_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
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

  /**
   * Gets the list of available telemetry reports.
   */
  public static async getTelemetry(projectId: string): Promise<any[]> {
    try {
      const res = await fetch(firestoreUrl(projectId, 'aiTelemetry?pageSize=100'));
      if (res.ok) {
        const raw = await res.json() as any;
        if (!raw.documents) return [];
        return raw.documents.map((d: any) => fromFirestoreDoc(d)).filter(Boolean);
      }
    } catch (e) {
      console.error('[AIOrchestrator] Telemetry retrieval failed:', e);
    }
    return [];
  }

  /**
   * Classifies error responses into BusinessOS normalized types.
   */
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

  /**
   * Executes a prompt with failure monitoring, retries, and dynamic model failovers.
   */
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
    
    // Resolve dynamic settings from Firestore overrides
    const config = await this.getOrchestratorConfig(projectId);
    const forcedModel = config?.forcedModel || null;
    const modelOverrides = config?.modelOverrides || {};

    // Build models list with applied overrides
    const registryList = this.DEFAULT_MODELS.map(m => {
      const override = modelOverrides[m.id];
      return {
        ...m,
        enabled: override && override.enabled !== undefined ? override.enabled : m.enabled,
        priority: override && override.priority !== undefined ? override.priority : m.priority,
        cooldownDurationMs: override && override.cooldownDurationMs !== undefined ? override.cooldownDurationMs : m.cooldownDurationMs
      };
    });

    // Determine target selection category
    const logicalChoice = preferredChoice || 'Automatic';
    let targetModelId = '';
    
    if (forcedModel) {
      targetModelId = forcedModel;
    } else if (logicalChoice.startsWith('gemini-') || logicalChoice.includes('-')) {
      targetModelId = logicalChoice;
    } else {
      const resolvedMapping = LogicalModelResolve(logicalChoice, subsystem);
      targetModelId = resolvedMapping;
    }

    const requestedModel = targetModelId;

    // Filter available models
    const activeModels = registryList.filter(m => m.enabled);
    
    // Sort in order of capability priorities
    const sortedFallbackChain = [...activeModels].sort((a, b) => a.priority - b.priority);

    // Build the final fallback chain
    const chain: typeof sortedFallbackChain = [];

    // Check if the requested model is valid and enabled
    const reqModelObj = activeModels.find(m => m.id === requestedModel);
    
    const now = Date.now();
    const isCooldowned = (id: string) => {
      const until = modelCooldowns.get(id) || 0;
      return now < until;
    };

    if (reqModelObj && !isCooldowned(requestedModel)) {
      chain.push(reqModelObj);
    }

    // Add other healthy fallback candidates
    for (const m of sortedFallbackChain) {
      if (m.id !== requestedModel && !isCooldowned(m.id)) {
        chain.push(m);
      }
    }

    // If all target models are down/cooldowned, fallback to trying them anyway as last resort
    if (chain.length === 0) {
      console.warn('[AIOrchestrator] All models in cooldown! Attempting anyway.');
      if (reqModelObj) {
        chain.push(reqModelObj);
      }
      chain.push(...sortedFallbackChain.filter(m => m.id !== requestedModel));
    }

    let lastErrorType = 'UNKNOWN_PROVIDER_ERROR';
    let lastErrorMsg = 'No models available in chain';
    let finalData: any = null;
    let finalModelId = '';
    let fallbackUsed = false;

    // Execute through the chain
    for (let i = 0; i < chain.length; i++) {
      const model = chain[i];
      finalModelId = model.id;
      fallbackUsed = model.id !== requestedModel;

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model.id}:generateContent?key=${apiKey}`;
      const cleanEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model.id}:generateContent?key=HIDDEN`;
      const payload = {
        contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
        generationConfig: { responseMimeType: 'application/json' }
      };

      const reqHeaders = { 'Content-Type': 'application/json' };
      
      let attemptSuccess = false;
      let attemptStatus = 0;
      let attemptBody = '';
      
      // Update dynamic states
      const stats = modelStats.get(model.id) || { requests: 0, success: 0, failure: 0, totalLatencyMs: 0 };
      stats.requests++;

      // Execute with retries
      const maxRetries = model.retryCount || 1;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (attempt > 0) retriesCount++;
        
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), model.defaultTimeoutMs);
          
          console.log(`[AIOrchestrator] Fetching: ${cleanEndpoint} (Model: ${model.id}, Attempt: ${attempt + 1}/${maxRetries + 1})`);
          
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: reqHeaders,
            body: JSON.stringify(payload),
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          attemptStatus = res.status;
          attemptBody = await res.text();

          if (res.ok) {
            finalData = JSON.parse(attemptBody);
            attemptSuccess = true;
            break;
          } else {
            console.warn(`[AIOrchestrator] Attempt failed: HTTP ${res.status} - ${attemptBody}`);
          }
        } catch (fetchErr: any) {
          attemptStatus = 0;
          attemptBody = fetchErr.message || String(fetchErr);
          console.warn(`[AIOrchestrator] Fetch exception: ${attemptBody}`);
        }

        if (attempt < maxRetries) {
          // Short delay before retrying
          await new Promise(r => setTimeout(r, 1000));
        }
      }

      if (attemptSuccess) {
        stats.success++;
        stats.lastSuccess = new Date().toISOString();
        stats.totalLatencyMs += (Date.now() - startTime);
        modelStats.set(model.id, stats);
        break; // Success! Exit model chain
      } else {
        // Classify the failure and mark cooldown
        stats.failure++;
        stats.lastFailure = new Date().toISOString();
        modelStats.set(model.id, stats);

        lastErrorType = this.classifyError(attemptStatus, attemptBody);
        lastErrorMsg = attemptBody;
        
        if (['MODEL_OVERLOADED', 'DAILY_QUOTA_EXCEEDED', 'RATE_LIMITED'].includes(lastErrorType)) {
          const duration = model.cooldownDurationMs;
          console.warn(`[AIOrchestrator] Placing ${model.id} into cooldown for ${duration}ms due to error type ${lastErrorType}`);
          modelCooldowns.set(model.id, Date.now() + duration);
        }
      }
    }

    const latency = Date.now() - startTime;
    
    // Character-based token estimations
    const promptChars = systemPrompt.length + userPrompt.length;
    const promptTokens = Math.ceil(promptChars / 4);
    
    let completionTokens = 0;
    let success = false;
    let cost = 0.0;

    if (finalData) {
      success = true;
      const completionText = finalData.candidates?.[0]?.content?.parts?.[0]?.text || '';
      completionTokens = Math.ceil(completionText.length / 4);
      
      const matchedModel = registryList.find(m => m.id === finalModelId);
      if (matchedModel) {
        cost = ((promptTokens / 1000000) * matchedModel.inputCostPer1M) +
               ((completionTokens / 1000000) * matchedModel.outputCostPer1M);
      }
    }

    const telemetry = {
      timestamp: new Date().toISOString(),
      user: userId,
      workspace: workspaceId,
      feature: subsystem,
      selectedModel: requestedModel,
      fallbackModel: fallbackUsed ? finalModelId : '',
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      latency,
      success,
      errorClassification: success ? '' : lastErrorType,
      retryCount: retriesCount,
      estimatedCost: cost,
      cachedResponse: false
    };

    // Record Telemetry asynchronously
    this.recordTelemetry(projectId, telemetry).catch(e => console.error('[AIOrchestrator] Async telemetry save failed:', e));

    if (!success) {
      throw new Error(`AIOrchestrator: All models in chain failed. Last Error: ${lastErrorType} - ${lastErrorMsg}`);
    }

    return {
      data: finalData,
      originalModel: requestedModel,
      actualModel: finalModelId,
      retries: retriesCount,
      fallbackUsed,
      errorReason: fallbackUsed ? lastErrorType : undefined
    };
  }

  /**
   * Convenience wrapper to execute commentary prompts with backwards compatibility.
   */
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

  /**
   * Aggregates dynamic in-memory metadata with static registry info.
   */
  public static getModelsStatus(configOverrides: any): any[] {
    const modelOverrides = configOverrides?.modelOverrides || {};
    const forcedModel = configOverrides?.forcedModel || null;
    const now = Date.now();

    return this.DEFAULT_MODELS.map(m => {
      const override = modelOverrides[m.id];
      const stats = modelStats.get(m.id) || { requests: 0, success: 0, failure: 0, totalLatencyMs: 0 };
      const cd = modelCooldowns.get(m.id) || 0;
      const cooldownRemaining = Math.max(0, cd - now);

      const successRate = stats.requests > 0 ? (stats.success / stats.requests) * 100 : 100;
      const avgLatency = stats.success > 0 ? stats.totalLatencyMs / stats.requests : 0;

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
          avgLatencyMs: Math.round(avgLatency),
          successRate: Math.round(successRate),
          lastSuccess: stats.lastSuccess || '',
          lastFailure: stats.lastFailure || ''
        }
      };
    });
  }

  /**
   * Compiles complete aggregation statistics from telemetry records.
   */
  public static async getOperationalStats(projectId: string): Promise<any> {
    const config = await this.getOrchestratorConfig(projectId);
    const models = this.getModelsStatus(config);
    const telemetry = await this.getTelemetry(projectId);

    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const startOfToday = now - oneDayMs;

    let requestsToday = 0;
    let tokensToday = 0;
    let costToday = 0;
    let totalFailovers = 0;
    let totalRetries = 0;
    let totalLatencyMs = 0;
    let successCount = 0;

    const featureCost: Record<string, number> = {};
    const workspaceCost: Record<string, number> = {};
    const userCost: Record<string, number> = {};

    for (const record of telemetry) {
      const recTime = new Date(record.timestamp).getTime();
      const isToday = recTime >= startOfToday;

      if (isToday) {
        requestsToday++;
        tokensToday += (record.totalTokens || 0);
        costToday += (record.estimatedCost || 0);
      }

      if (record.success) {
        successCount++;
      }
      totalLatencyMs += (record.latency || 0);
      totalRetries += (record.retryCount || 0);
      if (record.fallbackModel && record.fallbackModel !== '') {
        totalFailovers++;
      }

      // Cost breakdowns
      const feat = record.feature || 'Unknown';
      featureCost[feat] = (featureCost[feat] || 0) + (record.estimatedCost || 0);

      const ws = record.workspace || 'Unknown';
      workspaceCost[ws] = (workspaceCost[ws] || 0) + (record.estimatedCost || 0);

      const usr = record.user || 'Unknown';
      userCost[usr] = (userCost[usr] || 0) + (record.estimatedCost || 0);
    }

    const totalRequests = telemetry.length;
    const overallSuccessRate = totalRequests > 0 ? (successCount / totalRequests) * 100 : 100;
    const avgLatency = successCount > 0 ? totalLatencyMs / successCount : 0;

    // Quota Monitor estimations
    const requestsPerMinute = requestsToday / 1440; // simple average
    const tokensPerMinute = tokensToday / 1440;

    return {
      overview: {
        activeProvider: 'Google Gemini',
        overallHealth: overallSuccessRate > 80 ? 'healthy' : 'degraded',
        overallSuccessRate: Math.round(overallSuccessRate),
        averageLatencyMs: Math.round(avgLatency),
        requestsToday,
        tokensToday,
        estimatedDailyCost: costToday,
        estimatedMonthlyCost: costToday * 30,
        totalFailovers,
        totalRetries
      },
      models,
      breakdowns: {
        featureCost,
        workspaceCost,
        userCost
      },
      quota: {
        requestsPerMinute: Math.round(requestsPerMinute * 10) / 10,
        tokensPerMinute: Math.round(tokensPerMinute),
        estimatedRemainingDailyRequests: Math.max(0, 1500 - requestsToday), // default free tier is 1500
        quotaUtilisationPercentage: Math.round(Math.min(100, (requestsToday / 1500) * 100))
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
