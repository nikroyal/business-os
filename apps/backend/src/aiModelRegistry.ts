export type LogicalModel = 'Latest Flash' | 'Latest Pro' | 'Automatic';
export type Subsystem = 
  | 'Editorial Commentary' 
  | 'Research Engine' 
  | 'Business School' 
  | 'Copilot'
  | 'Daily Email'
  | 'Reports'
  | 'Opportunities'
  | 'Summaries'
  | 'Background AI'
  | 'Benchmarking'
  | string;

export type ModelCapability =
  | 'chat'
  | 'embeddings'
  | 'reranking'
  | 'vision'
  | 'image_generation'
  | 'moderation'
  | 'safety'
  | 'speech'
  | 'audio'
  | 'streaming'
  | 'tools'
  | 'structured_output'
  | 'long_context';

export type TaskType = 
  | 'deep_research'
  | 'copilot_conversation'
  | 'market_summary'
  | 'company_analysis'
  | 'report_generation'
  | 'daily_briefing'
  | 'daily_email'
  | 'long_writing'
  | 'short_summarization'
  | 'coding'
  | 'retrieval'
  | 'reranking'
  | 'moderation'
  | 'vision'
  | 'benchmarking';

export interface ModelMetadata {
  id: string;
  apiModelId?: string;
  isAlias?: boolean;
  aliasReason?: string;
  targetModelId?: string;
  verificationStatus?: 'VERIFIED_API' | 'ADMIN_ALIAS' | 'UNVERIFIED_DISABLED' | 'REQUIRES_MANUAL_VERIFICATION' | 'PENDING_VERIFICATION';
  unavailabilityReason?: string;
  displayName: string;
  version?: string;
  endpointType?: string;
  capabilities?: ModelCapability[];
  category: 'Flash' | 'Pro';
  priority: number; // Lower is higher priority (e.g. 1 is highest)
  capabilityScore: number;
  reasoningScore: number;
  speedScore: number;
  stabilityScore: number;
  codingScore?: number;
  financialAnalysisScore?: number;
  writingScore?: number;
  costScore?: number;
  reliabilityScore?: number;
  status: 'production' | 'preview' | 'deprecated';
  provider: string; // 'google' | 'openrouter'
  supportsGrounding: boolean;
  supportsStructuredOutput: boolean;
  supportsLongContext: boolean;
  supportsStreaming: boolean;
  supportsVision: boolean;
  supportsAudio: boolean;
  supportsTools: boolean;
  supportsJSONMode?: boolean;
  supportsThinking?: boolean;
  defaultTimeoutMs: number;
  retryCount: number;
  cooldownDurationMs: number;
  enabled: boolean;
  inputCostPer1M: number;
  outputCostPer1M: number;
  fallbackEnabled: boolean;
  contextWindow: number;
  maxOutput: number;
  supportsImageOutput: boolean;
  supportsVideo: boolean;
  /** Requests Per Minute limit (from provider quota registry) */
  rpmLimit?: number;
  /** Tokens Per Minute limit */
  tpmLimit?: number;
  /** Requests Per Day limit */
  rpdLimit?: number;
  /** Availability tier (Free, Pay-as-you-go, Enterprise, Reserved) */
  availabilityTier?: string;
  supportedTaskTypes?: TaskType[];
  preferredTaskTypes?: TaskType[];
  ownerOnly?: boolean;
  isFree?: boolean;
  modelType?: 'router' | 'model' | 'embedding' | 'reranker' | 'safety' | 'multimodal' | 'general' | 'coding';
  intendedUse?: string;
  recommendedUseCases?: string[];
  successRate?: number;
  failureRate?: number;
  healthScore?: number;
  averageLatencyMs?: number;
  p95LatencyMs?: number;
  cooldownStatus?: 'healthy' | 'cooldown' | 'recovering' | 'offline';
  deploymentStatus?: 'production' | 'preview' | 'deprecated';
  visibleInRegistry?: boolean;
  pricingSource?: 'provider_verified' | 'application_defined';
  providerPricing?: {
    prompt: string;
    completion: string;
  };
}

export interface FeatureRequirement {
  featureId: Subsystem | string;
  displayName: string;
  requiredCapabilities: ModelCapability[];
  preferredCapabilities?: ModelCapability[];
  preferredTaskType: TaskType;
  requiresLongContext?: boolean;
  requiresStructuredOutput?: boolean;
  requiresStreaming?: boolean;
  requiresLowLatency?: boolean;
  minReasoningScore?: number;
  minSpeedScore?: number;
  minReliabilityScore?: number;
  preferredProvider?: string;
  description: string;
}

export interface RoutingDecisionCandidate {
  modelId: string;
  displayName: string;
  provider: string;
  compositeScore: number;
  scoreBreakdown: Record<string, number>;
}

export interface RoutingDecisionRejected {
  modelId: string;
  displayName: string;
  provider: string;
  rejectionReason: string;
}

export interface RoutingDecision {
  decisionId: string;
  timestamp: string;
  task: TaskType;
  subsystem?: string;
  requirements: Record<string, any>;
  candidateModels: RoutingDecisionCandidate[];
  rejectedModels: RoutingDecisionRejected[];
  winningModel: string;
  winningModelDisplayName: string;
  provider: string;
  confidenceScore: number;
  executionTimeMs: number;
  fallbacks: string[];
  explanation: string;
}

export const FEATURE_REQUIREMENTS: Record<string, FeatureRequirement> = {
  'Copilot': {
    featureId: 'Copilot',
    displayName: 'BusinessOS Copilot',
    requiredCapabilities: ['chat', 'streaming'],
    preferredCapabilities: ['chat', 'streaming'],
    preferredTaskType: 'copilot_conversation',
    requiresLowLatency: true,
    minReasoningScore: 80,
    description: 'Requires low latency chat, streaming responses, and reasoning for interactive Copilot sessions.'
  },
  'Daily Email': {
    featureId: 'Daily Email',
    displayName: 'Daily Executive Briefing Email',
    requiredCapabilities: ['chat'],
    preferredCapabilities: ['chat'],
    preferredTaskType: 'daily_email',
    requiresLongContext: true,
    requiresStructuredOutput: true,
    preferredProvider: 'google',
    minReliabilityScore: 90,
    description: 'Requires high reliability, structured output, long context window, and stable formatting.'
  },
  'Research Engine': {
    featureId: 'Research Engine',
    displayName: 'Deep Intelligence Research Engine',
    requiredCapabilities: ['chat'],
    preferredCapabilities: ['chat'],
    preferredTaskType: 'deep_research',
    requiresLongContext: true,
    minReasoningScore: 90,
    description: 'Requires deep reasoning capabilities and large context window for comprehensive research analysis.'
  },
  'Editorial Commentary': {
    featureId: 'Editorial Commentary',
    displayName: 'Daily Editorial & Market Commentary',
    requiredCapabilities: ['chat'],
    preferredTaskType: 'editorial_commentary' as TaskType,
    minReasoningScore: 85,
    description: 'Requires analytical writing and financial commentary generation.'
  },
  'Reports': {
    featureId: 'Reports',
    displayName: 'Executive Financial Reports Generator',
    requiredCapabilities: ['chat'],
    preferredTaskType: 'report_generation',
    requiresStructuredOutput: true,
    minReasoningScore: 88,
    description: 'Requires structured financial report authoring and analytical synthesis.'
  },
  'Opportunities': {
    featureId: 'Opportunities',
    displayName: 'Deal & Opportunity Evaluation',
    requiredCapabilities: ['chat'],
    preferredTaskType: 'company_analysis',
    minReasoningScore: 85,
    description: 'Requires opportunity scoring, financial risk analysis, and structured outputs.'
  },
  'Benchmarking': {
    featureId: 'Benchmarking',
    displayName: 'Model Benchmarking & Comparison Lab',
    requiredCapabilities: ['chat'],
    preferredTaskType: 'benchmarking',
    description: 'Requires chat capability for running standardized prompts across models.'
  },
  'Playground': {
    featureId: 'Playground',
    displayName: 'AI Playground',
    requiredCapabilities: ['chat'],
    preferredTaskType: 'copilot_conversation',
    description: 'Requires general chat and interactive testing across registered models.'
  },
  'Embeddings': {
    featureId: 'Embeddings',
    displayName: 'Vector Embeddings Service',
    requiredCapabilities: ['embeddings'],
    preferredTaskType: 'retrieval',
    description: 'Requires specialized vector embedding generation models.'
  },
  'Reranking': {
    featureId: 'Reranking',
    displayName: 'Semantic Reranking Service',
    requiredCapabilities: ['reranking'],
    preferredTaskType: 'reranking',
    description: 'Requires specialized semantic reranking models.'
  }
};


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
    if (!apiKey || !apiKey.trim()) {
      const err: any = new Error('Configuration Error: Google Gemini API key missing. Please configure GEMINI_API_KEY in the Worker environment bindings.');
      err.status = 400;
      err.errorClassification = 'CONFIGURATION_ERROR';
      throw err;
    }
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey.trim()}`;
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
        let msg = `Google API returned HTTP ${res.status}: ${text}`;
        if (res.status === 401 || res.status === 403) {
          msg = `Google Gemini authentication failed (HTTP ${res.status}): ${text}`;
        } else if (res.status === 404) {
          msg = `Invalid model ID '${modelId}' on Google Gemini (HTTP 404): ${text}`;
        } else if (res.status === 429) {
          msg = `Google Gemini provider rate limited (HTTP 429): ${text}`;
        } else if (res.status >= 500) {
          msg = `Google Gemini model unavailable (HTTP ${res.status}): ${text}`;
        }
        const err: any = new Error(msg);
        err.status = res.status;
        throw err;
      }

      let data: any;
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        const err: any = new Error(`JSON parse failure: Google Gemini returned malformed non-JSON payload (HTTP ${res.status})`);
        err.status = res.status;
        err.errorClassification = 'JSON_PARSE_FAILURE';
        throw err;
      }

      if (data.error) {
        const err: any = new Error(`Google Gemini returned error (HTTP ${res.status}): ${data.error.message || JSON.stringify(data.error)}`);
        err.status = res.status;
        throw err;
      }

      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        const err: any = new Error('Empty response from Google API');
        err.status = res.status;
        throw err;
      }

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
      if (e.name === 'AbortError') {
        const err: any = new Error(`Provider timeout: Google Gemini request timed out after ${timeoutMs}ms`);
        err.status = 408;
        throw err;
      }
      throw e;
    }
  }
}

// OpenRouter Provider Adapter
export class OpenRouterAdapter implements AIProviderAdapter {
  id = 'openrouter';
  displayName = 'OpenRouter AI';

  async executePrompt(
    modelId: string,
    systemPrompt: string,
    userPrompt: string,
    apiKey: string,
    timeoutMs: number
  ): Promise<{ text: string; rawResponse: any; promptTokens?: number; completionTokens?: number }> {
    if (!apiKey || !apiKey.trim()) {
      const err: any = new Error('Configuration Error: OpenRouter API key missing. Please configure OPENROUTER_API_KEY in the Worker environment bindings.');
      err.status = 400;
      err.errorClassification = 'CONFIGURATION_ERROR';
      throw err;
    }
    const endpoint = 'https://openrouter.ai/api/v1/chat/completions';
    const payload = {
      model: modelId,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey.trim()}`,
          'HTTP-Referer': 'https://businessos.ai',
          'X-Title': 'BusinessOS'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const text = await res.text();

      if (!res.ok) {
        let msg = `OpenRouter API returned HTTP ${res.status}: ${text}`;
        if (res.status === 401 || res.status === 403) {
          msg = `OpenRouter authentication failed (HTTP ${res.status}): ${text}`;
        } else if (res.status === 404) {
          msg = `Invalid model ID '${modelId}' on OpenRouter (HTTP 404): ${text}`;
        } else if (res.status === 429) {
          msg = `OpenRouter provider rate limited (HTTP 429): ${text}`;
        } else if (res.status >= 500) {
          msg = `OpenRouter model unavailable (HTTP ${res.status}): ${text}`;
        }
        const err: any = new Error(msg);
        err.status = res.status;
        throw err;
      }

      let data: any;
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        const err: any = new Error(`JSON parse failure: OpenRouter returned malformed non-JSON payload (HTTP ${res.status})`);
        err.status = res.status;
        err.errorClassification = 'JSON_PARSE_FAILURE';
        throw err;
      }

      if (data.error) {
        const err: any = new Error(`OpenRouter returned error (HTTP ${res.status}): ${data.error.message || JSON.stringify(data.error)}`);
        err.status = res.status;
        throw err;
      }

      const rawText = data.choices?.[0]?.message?.content;
      if (!rawText) {
        const err: any = new Error('Empty response from OpenRouter API');
        err.status = res.status;
        throw err;
      }

      const promptTokens = data.usage?.prompt_tokens;
      const completionTokens = data.usage?.completion_tokens;

      return {
        text: rawText,
        rawResponse: data,
        promptTokens,
        completionTokens
      };
    } catch (e: any) {
      clearTimeout(timeoutId);
      if (e.name === 'AbortError') {
        const err: any = new Error(`Provider timeout: OpenRouter request timed out after ${timeoutMs}ms`);
        err.status = 408;
        throw err;
      }
      throw e;
    }
  }
}

export const OPENROUTER_MODEL_MAPPING = {
  'Latest Flash': 'openai/gpt-4o-mini',
  'Latest Pro': 'llama-3.3-70b-instruct'
};

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

class ConcurrencyGate {
  private active = 0;
  private queue: Array<() => void> = [];
  private maxConcurrent: number;
  constructor(maxConcurrent: number) {
    this.maxConcurrent = maxConcurrent;
  }
  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.maxConcurrent) {
      await new Promise<void>(resolve => this.queue.push(resolve));
    }
    this.active++;
    try {
      return await fn();
    } finally {
      this.active--;
      const next = this.queue.shift();
      if (next) next();
    }
  }
}

const providerGates: Record<string, ConcurrencyGate> = {
  'google': new ConcurrencyGate(10),
  'openrouter': new ConcurrencyGate(5)
};

export function estimateTokens(text: string): number {
  if (!text) return 0;
  const tokens = text.match(/\w+|[^\w\s]+/g) || [];
  let count = 0;
  for (const t of tokens) {
    if (t.length <= 4) {
      count += 1;
    } else {
      count += Math.ceil(t.length / 3);
    }
  }
  const spaces = text.match(/\s+/g) || [];
  count += spaces.length;
  return count;
}

const inMemoryResponseCache = new Map<string, { response: string; promptTokens: number; completionTokens: number; expiry: number }>();

export class AIOrchestrator {
  private static adapters: Record<string, AIProviderAdapter> = {
    'google': new GoogleGeminiAdapter(),
    'openrouter': new OpenRouterAdapter()
  };

  private static async computeHash(str: string): Promise<string> {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  private static async getCachedResponse(
    projectId: string,
    systemPrompt: string,
    userPrompt: string,
    modelId: string,
    token?: string
  ): Promise<{ response: string; promptTokens: number; completionTokens: number } | null> {
    const key = `${systemPrompt}|||${userPrompt}|||${modelId}`;
    const hash = await this.computeHash(key);
    
    // Tier 1: In-Memory Cache
    const mem = inMemoryResponseCache.get(hash);
    if (mem && mem.expiry > Date.now()) {
      return {
        response: mem.response,
        promptTokens: mem.promptTokens,
        completionTokens: mem.completionTokens
      };
    } else if (mem) {
      inMemoryResponseCache.delete(hash);
    }

    // Tier 2: Firestore Cache
    try {
      const res = await firestoreFetch(projectId, `aiResponseCache/${hash}`, token);
      if (res.ok) {
        const data = fromFirestoreDoc(await res.json());
        if (data && data.expiry > Date.now()) {
          // Warm up Layer 1 cache
          inMemoryResponseCache.set(hash, {
            response: data.response,
            promptTokens: data.promptTokens,
            completionTokens: data.completionTokens,
            expiry: data.expiry
          });
          return {
            response: data.response,
            promptTokens: data.promptTokens,
            completionTokens: data.completionTokens
          };
        }
      }
    } catch (err) {
      console.warn('[AIOrchestrator Cache] Firestore cache fetch failed:', err);
    }
    return null;
  }

  private static async setCachedResponse(
    projectId: string,
    systemPrompt: string,
    userPrompt: string,
    modelId: string,
    response: string,
    promptTokens: number,
    completionTokens: number,
    token?: string
  ): Promise<void> {
    const key = `${systemPrompt}|||${userPrompt}|||${modelId}`;
    const hash = await this.computeHash(key);
    const expiry = Date.now() + 2 * 60 * 60 * 1000; // 2 hours TTL

    // Update Tier 1: In-Memory
    inMemoryResponseCache.set(hash, {
      response,
      promptTokens,
      completionTokens,
      expiry
    });

    // Update Tier 2: Firestore
    try {
      const doc = {
        fields: {
          response: toFirestoreValue(response),
          expiry: toFirestoreValue(expiry),
          modelId: toFirestoreValue(modelId),
          promptTokens: toFirestoreValue(promptTokens),
          completionTokens: toFirestoreValue(completionTokens)
        }
      };
      await firestoreFetch(projectId, `aiResponseCache/${hash}`, token, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(doc)
      });
    } catch (err) {
      console.warn('[AIOrchestrator Cache] Firestore cache set failed:', err);
    }
  }

  public static getModelCapabilities(model: ModelMetadata): ModelCapability[] {
    if (model.capabilities && Array.isArray(model.capabilities) && model.capabilities.length > 0) {
      return model.capabilities;
    }
    if (model.modelType === 'embedding' || model.id.includes('embed')) {
      return model.supportsVision ? ['embeddings', 'vision'] : ['embeddings'];
    }
    if (model.modelType === 'reranker' || model.id.includes('rerank')) {
      return model.supportsVision ? ['reranking', 'vision'] : ['reranking'];
    }
    if (model.modelType === 'safety' || model.id.includes('safety') || model.id.includes('moderation')) {
      return ['safety', 'moderation'];
    }
    const caps: ModelCapability[] = ['chat'];
    if (model.supportsVision) caps.push('vision');
    if (model.supportsAudio) caps.push('audio');
    if (model.supportsImageOutput) caps.push('image_generation');
    return caps;
  }

  public static getRequiredCapabilityForTask(task: TaskType): ModelCapability {
    switch (task) {
      case 'retrieval':
        return 'embeddings';
      case 'reranking':
        return 'reranking';
      case 'moderation':
        return 'moderation';
      default:
        return 'chat';
    }
  }

  public static isModelCapableForTask(model: ModelMetadata, task: TaskType): boolean {
    const caps = this.getModelCapabilities(model);
    switch (task) {
      case 'retrieval':
        return caps.includes('embeddings');
      case 'reranking':
        return caps.includes('reranking');
      case 'moderation':
        return caps.includes('moderation') || caps.includes('safety');
      case 'vision':
        return caps.includes('chat') && (caps.includes('vision') || model.supportsVision);
      default:
        return caps.includes('chat');
    }
  }

  public static readonly DEFAULT_MODELS: ModelMetadata[] = [
    // --- Google Gemini Direct (Strictly for Daily Email) ---
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
      cooldownDurationMs: 300000,
      enabled: true,
      inputCostPer1M: 0.075,
      outputCostPer1M: 0.30,
      fallbackEnabled: true,
      contextWindow: 1048576,
      maxOutput: 8192,
      supportsImageOutput: false,
      supportsVideo: true,
      rpmLimit: 15,
      tpmLimit: 1000000,
      rpdLimit: 1500,
      availabilityTier: 'Standard',
      modelType: 'general',
      intendedUse: 'Daily Email default fast processing via Gemini integration',
      supportedTaskTypes: ['daily_email']
    },
    {
      id: 'gemini-3.1-pro-preview',
      displayName: 'Gemini 3.1 Pro',
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
      outputCostPer1M: 5.00,
      fallbackEnabled: true,
      contextWindow: 2097152,
      maxOutput: 8192,
      supportsImageOutput: false,
      supportsVideo: true,
      rpmLimit: 2,
      tpmLimit: 32000,
      rpdLimit: 50,
      availabilityTier: 'Enterprise',
      modelType: 'general',
      intendedUse: 'Daily Email high-complexity analytical briefings via Gemini integration',
      supportedTaskTypes: ['daily_email']
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
      outputCostPer1M: 5.00,
      fallbackEnabled: true,
      contextWindow: 2097152,
      maxOutput: 8192,
      supportsImageOutput: false,
      supportsVideo: true,
      rpmLimit: 2,
      tpmLimit: 32000,
      rpdLimit: 50,
      availabilityTier: 'Enterprise',
      modelType: 'general',
      intendedUse: 'Daily Email stable fallback pro model',
      supportedTaskTypes: ['daily_email']
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
      outputCostPer1M: 0.30,
      fallbackEnabled: true,
      contextWindow: 1048576,
      maxOutput: 8192,
      supportsImageOutput: false,
      supportsVideo: true,
      rpmLimit: 15,
      tpmLimit: 1000000,
      rpdLimit: 1500,
      availabilityTier: 'Standard',
      modelType: 'general',
      intendedUse: 'Daily Email stable fallback flash model',
      supportedTaskTypes: ['daily_email']
    },
    {
      id: 'gemini-3.1-flash-lite',
      displayName: 'Gemini 3.1 Flash Lite',
      category: 'Flash',
      priority: 5,
      capabilityScore: 85,
      reasoningScore: 80,
      speedScore: 98,
      stabilityScore: 96,
      status: 'production',
      provider: 'google',
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
      inputCostPer1M: 0.0375,
      outputCostPer1M: 0.15,
      fallbackEnabled: true,
      contextWindow: 1048576,
      maxOutput: 8192,
      supportsImageOutput: false,
      supportsVideo: true,
      rpmLimit: 15,
      tpmLimit: 1000000,
      rpdLimit: 1500,
      availabilityTier: 'Standard',
      modelType: 'general',
      intendedUse: 'Daily Email ultra-fast lightweight execution',
      supportedTaskTypes: ['daily_email']
    },
    {
      id: 'gemini-2.5-flash-lite',
      displayName: 'Gemini 2.5 Flash Lite',
      category: 'Flash',
      priority: 6,
      capabilityScore: 82,
      reasoningScore: 78,
      speedScore: 98,
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
      defaultTimeoutMs: 12000,
      retryCount: 1,
      cooldownDurationMs: 120000,
      enabled: true,
      inputCostPer1M: 0.0375,
      outputCostPer1M: 0.15,
      fallbackEnabled: true,
      contextWindow: 1048576,
      maxOutput: 8192,
      supportsImageOutput: false,
      supportsVideo: true,
      rpmLimit: 15,
      tpmLimit: 1000000,
      rpdLimit: 1500,
      availabilityTier: 'Standard',
      modelType: 'general',
      intendedUse: 'Daily Email lightweight backup',
      supportedTaskTypes: ['daily_email']
    },
    {
      id: 'gemini-flash-latest',
      displayName: 'Gemini Flash (Latest Alias)',
      category: 'Flash',
      priority: 7,
      capabilityScore: 90,
      reasoningScore: 85,
      speedScore: 95,
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
      outputCostPer1M: 0.30,
      fallbackEnabled: true,
      contextWindow: 1048576,
      maxOutput: 8192,
      supportsImageOutput: false,
      supportsVideo: true,
      rpmLimit: 15,
      tpmLimit: 1000000,
      rpdLimit: 1500,
      availabilityTier: 'Standard',
      modelType: 'general',
      intendedUse: 'Daily Email alias pointer',
      supportedTaskTypes: ['daily_email']
    },
    {
      id: 'gemini-pro-latest',
      displayName: 'Gemini Pro (Latest Alias)',
      category: 'Pro',
      priority: 8,
      capabilityScore: 95,
      reasoningScore: 95,
      speedScore: 75,
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
      outputCostPer1M: 5.00,
      fallbackEnabled: true,
      contextWindow: 2097152,
      maxOutput: 8192,
      supportsImageOutput: false,
      supportsVideo: true,
      rpmLimit: 2,
      tpmLimit: 32000,
      rpdLimit: 50,
      availabilityTier: 'Enterprise',
      modelType: 'general',
      intendedUse: 'Daily Email alias pointer for pro',
      supportedTaskTypes: ['daily_email']
    },
    // ==========================================
    // OPENROUTER FREE ROUTER (First-class option for Free Inference)
    // ==========================================
    {
      id: 'openrouter/free',
      displayName: 'OpenRouter Free Router',
      category: 'Flash',
      priority: 0,
      capabilityScore: 92,
      reasoningScore: 90,
      speedScore: 96,
      stabilityScore: 95,
      status: 'production',
      provider: 'openrouter',
      supportsGrounding: false,
      supportsStructuredOutput: true,
      supportsLongContext: true,
      supportsStreaming: true,
      supportsVision: false,
      supportsAudio: false,
      supportsTools: true,
      defaultTimeoutMs: 15000,
      retryCount: 1,
      cooldownDurationMs: 120000,
      enabled: true,
      inputCostPer1M: 0.0,
      outputCostPer1M: 0.0,
      fallbackEnabled: true,
      contextWindow: 131072,
      maxOutput: 4096,
      supportsImageOutput: false,
      supportsVideo: false,
      rpmLimit: 60,
      tpmLimit: 1000000,
      rpdLimit: 5000,
      availabilityTier: 'Free',
      isFree: true,
      modelType: 'router',
      intendedUse: 'Top-level routing option for free automated inference across OpenRouter free models',
      supportedTaskTypes: ['copilot_conversation', 'market_summary', 'short_summarization', 'company_analysis', 'report_generation', 'benchmarking']
    },
    // ==========================================
    // OFFICIAL VERIFIED OPENROUTER MODELS (No silent substitutions)
    // ==========================================
    {
      id: 'qwen/qwen-2.5-coder-32b-instruct',
      displayName: 'Qwen 2.5 Coder 32B Instruct',
      category: 'Pro',
      priority: 1,
      capabilityScore: 94,
      reasoningScore: 93,
      speedScore: 92,
      stabilityScore: 95,
      codingScore: 97,
      status: 'production',
      provider: 'openrouter',
      supportsGrounding: false,
      supportsStructuredOutput: true,
      supportsLongContext: true,
      supportsStreaming: true,
      supportsVision: false,
      supportsAudio: false,
      supportsTools: true,
      defaultTimeoutMs: 25000,
      retryCount: 1,
      cooldownDurationMs: 60000,
      enabled: true,
      inputCostPer1M: 0.07,
      outputCostPer1M: 0.18,
      fallbackEnabled: true,
      contextWindow: 131072,
      maxOutput: 8192,
      supportsImageOutput: false,
      supportsVideo: false,
      endpointType: '/chat/completions',
      apiModelId: 'qwen/qwen-2.5-coder-32b-instruct',
      verificationStatus: 'VERIFIED_API',
      capabilities: ['chat', 'streaming', 'tools', 'structured_output'],
      modelType: 'coding',
      intendedUse: 'Production coding and automated refactoring suite',
      supportedTaskTypes: ['coding', 'benchmarking', 'copilot_conversation']
    },
    {
      id: 'google/gemma-2-27b-it',
      displayName: 'Google Gemma 2 27B Instruct',
      category: 'Flash',
      priority: 1,
      capabilityScore: 91,
      reasoningScore: 89,
      speedScore: 94,
      stabilityScore: 95,
      status: 'production',
      provider: 'openrouter',
      supportsGrounding: false,
      supportsStructuredOutput: true,
      supportsLongContext: true,
      supportsStreaming: true,
      supportsVision: false,
      supportsAudio: false,
      supportsTools: true,
      defaultTimeoutMs: 15000,
      retryCount: 1,
      cooldownDurationMs: 60000,
      enabled: true,
      inputCostPer1M: 0.27,
      outputCostPer1M: 0.27,
      fallbackEnabled: true,
      contextWindow: 8192,
      maxOutput: 4096,
      supportsImageOutput: false,
      supportsVideo: false,
      endpointType: '/chat/completions',
      apiModelId: 'google/gemma-2-27b-it',
      verificationStatus: 'VERIFIED_API',
      capabilities: ['chat', 'streaming', 'tools', 'structured_output'],
      modelType: 'general',
      intendedUse: 'Fast analysis and summarization via OpenRouter',
      supportedTaskTypes: ['copilot_conversation', 'short_summarization', 'market_summary', 'benchmarking']
    },
    {
      id: 'openai/gpt-4o-mini',
      displayName: 'OpenAI GPT-4o Mini',
      category: 'Flash',
      priority: 1,
      capabilityScore: 93,
      reasoningScore: 91,
      speedScore: 96,
      stabilityScore: 97,
      status: 'production',
      provider: 'openrouter',
      supportsGrounding: false,
      supportsStructuredOutput: true,
      supportsLongContext: true,
      supportsStreaming: true,
      supportsVision: true,
      supportsAudio: false,
      supportsTools: true,
      defaultTimeoutMs: 15000,
      retryCount: 1,
      cooldownDurationMs: 60000,
      enabled: true,
      inputCostPer1M: 0.15,
      outputCostPer1M: 0.60,
      fallbackEnabled: true,
      contextWindow: 128000,
      maxOutput: 16384,
      supportsImageOutput: false,
      supportsVideo: false,
      endpointType: '/chat/completions',
      apiModelId: 'openai/gpt-4o-mini',
      verificationStatus: 'VERIFIED_API',
      capabilities: ['chat', 'streaming', 'tools', 'structured_output', 'vision'],
      modelType: 'general',
      intendedUse: 'Fast multimodal chat and executive reports via OpenRouter',
      supportedTaskTypes: ['copilot_conversation', 'short_summarization', 'deep_research', 'report_generation', 'benchmarking']
    },
    // ==========================================
    // SOURCE-OF-TRUTH OPENROUTER MODELS
    // ==========================================
    // --- Cohere ---
    {
      id: 'north-mini-code-20260617',
      displayName: 'Cohere North Mini Code',
      apiModelId: 'cohere/north-mini-code',
      category: 'Flash',
      priority: 1,
      capabilityScore: 93,
      reasoningScore: 90,
      speedScore: 96,
      stabilityScore: 95,
      status: 'production',
      provider: 'openrouter',
      supportsGrounding: false,
      supportsStructuredOutput: true,
      supportsLongContext: true,
      supportsStreaming: true,
      supportsVision: false,
      supportsAudio: false,
      supportsTools: true,
      defaultTimeoutMs: 15000,
      retryCount: 1,
      cooldownDurationMs: 120000,
      enabled: true,
      inputCostPer1M: 0.05,
      outputCostPer1M: 0.15,
      fallbackEnabled: true,
      contextWindow: 131072,
      maxOutput: 8192,
      supportsImageOutput: false,
      supportsVideo: false,
      rpmLimit: 60,
      tpmLimit: 1000000,
      rpdLimit: 5000,
      availabilityTier: 'Pay-as-you-go',
      modelType: 'model',
      intendedUse: 'Coding and developer tasks via OpenRouter',
      supportedTaskTypes: ['coding', 'benchmarking']
    },
    // --- Google (via OpenRouter) ---
    {
      id: 'gemma-4-26b-a4b',
      displayName: 'Gemma 4 26B A4B',
      apiModelId: 'google/gemma-4-26b-a4b-it',
      category: 'Flash',
      priority: 2,
      capabilityScore: 90,
      reasoningScore: 89,
      speedScore: 95,
      stabilityScore: 95,
      status: 'production',
      provider: 'openrouter',
      supportsGrounding: false,
      supportsStructuredOutput: true,
      supportsLongContext: true,
      supportsStreaming: true,
      supportsVision: false,
      supportsAudio: false,
      supportsTools: true,
      defaultTimeoutMs: 15000,
      retryCount: 1,
      cooldownDurationMs: 120000,
      enabled: true,
      inputCostPer1M: 0.08,
      outputCostPer1M: 0.20,
      fallbackEnabled: true,
      contextWindow: 131072,
      maxOutput: 8192,
      supportsImageOutput: false,
      supportsVideo: false,
      rpmLimit: 60,
      tpmLimit: 1000000,
      rpdLimit: 5000,
      availabilityTier: 'Pay-as-you-go',
      modelType: 'model',
      intendedUse: 'Fast summaries and copilot dialogue via OpenRouter',
      supportedTaskTypes: ['copilot_conversation', 'market_summary', 'short_summarization', 'benchmarking']
    },
    {
      id: 'gemma-4-31b-a4b',
      displayName: 'Gemma 4 31B',
      apiModelId: 'google/gemma-4-31b-it',
      category: 'Pro',
      priority: 3,
      capabilityScore: 92,
      reasoningScore: 91,
      speedScore: 92,
      stabilityScore: 94,
      status: 'production',
      provider: 'openrouter',
      supportsGrounding: false,
      supportsStructuredOutput: true,
      supportsLongContext: true,
      supportsStreaming: true,
      supportsVision: false,
      supportsAudio: false,
      supportsTools: true,
      defaultTimeoutMs: 18000,
      retryCount: 1,
      cooldownDurationMs: 120000,
      enabled: true,
      inputCostPer1M: 0.10,
      outputCostPer1M: 0.25,
      fallbackEnabled: true,
      contextWindow: 131072,
      maxOutput: 8192,
      supportsImageOutput: false,
      supportsVideo: false,
      rpmLimit: 60,
      tpmLimit: 1000000,
      rpdLimit: 5000,
      availabilityTier: 'Pay-as-you-go',
      modelType: 'model',
      intendedUse: 'Pro analytical reasoning and reports via OpenRouter',
      supportedTaskTypes: ['copilot_conversation', 'report_generation', 'company_analysis', 'benchmarking']
    },
    // --- Liquid ---
    {
      id: 'lfm-2.5-1.2b-instruct-20260120',
      displayName: 'Liquid LFM 2.5 1.2B Instruct',
      category: 'Flash',
      priority: 3,
      capabilityScore: 86,
      reasoningScore: 84,
      speedScore: 99,
      stabilityScore: 96,
      status: 'production',
      provider: 'openrouter',
      supportsGrounding: false,
      supportsStructuredOutput: true,
      supportsLongContext: true,
      supportsStreaming: true,
      supportsVision: false,
      supportsAudio: false,
      supportsTools: true,
      defaultTimeoutMs: 10000,
      retryCount: 1,
      cooldownDurationMs: 120000,
      enabled: true,
      inputCostPer1M: 0.02,
      outputCostPer1M: 0.05,
      fallbackEnabled: true,
      contextWindow: 32768,
      maxOutput: 4096,
      supportsImageOutput: false,
      supportsVideo: false,
      rpmLimit: 100,
      tpmLimit: 1500000,
      rpdLimit: 10000,
      availabilityTier: 'Pay-as-you-go',
      modelType: 'model',
      intendedUse: 'Ultra-fast lightweight instruction following via OpenRouter',
      supportedTaskTypes: ['short_summarization', 'copilot_conversation', 'benchmarking']
    },
    {
      id: 'lfm-2.5-1.2b-thinking-20260120',
      displayName: 'Liquid LFM 2.5 1.2B Thinking',
      category: 'Flash',
      priority: 4,
      capabilityScore: 88,
      reasoningScore: 89,
      speedScore: 96,
      stabilityScore: 95,
      status: 'production',
      provider: 'openrouter',
      supportsGrounding: false,
      supportsStructuredOutput: true,
      supportsLongContext: true,
      supportsStreaming: true,
      supportsVision: false,
      supportsAudio: false,
      supportsTools: true,
      defaultTimeoutMs: 12000,
      retryCount: 1,
      cooldownDurationMs: 120000,
      enabled: true,
      inputCostPer1M: 0.025,
      outputCostPer1M: 0.06,
      fallbackEnabled: true,
      contextWindow: 32768,
      maxOutput: 4096,
      supportsImageOutput: false,
      supportsVideo: false,
      rpmLimit: 100,
      tpmLimit: 1500000,
      rpdLimit: 10000,
      availabilityTier: 'Pay-as-you-go',
      modelType: 'model',
      intendedUse: 'Fast compact chain-of-thought reasoning via OpenRouter',
      supportedTaskTypes: ['copilot_conversation', 'market_summary', 'benchmarking']
    },
    // --- Meta Llama ---
    {
      id: 'llama-3.2-3b-instruct',
      displayName: 'Llama 3.2 3B Instruct',
      apiModelId: 'meta-llama/llama-3.2-3b-instruct',
      category: 'Flash',
      priority: 1,
      capabilityScore: 86,
      reasoningScore: 84,
      speedScore: 99,
      stabilityScore: 96,
      status: 'production',
      provider: 'openrouter',
      supportsGrounding: false,
      supportsStructuredOutput: true,
      supportsLongContext: true,
      supportsStreaming: true,
      supportsVision: false,
      supportsAudio: false,
      supportsTools: true,
      defaultTimeoutMs: 10000,
      retryCount: 1,
      cooldownDurationMs: 120000,
      enabled: true,
      inputCostPer1M: 0.0,
      outputCostPer1M: 0.0,
      fallbackEnabled: true,
      contextWindow: 131072,
      maxOutput: 4096,
      supportsImageOutput: false,
      supportsVideo: false,
      rpmLimit: 100,
      tpmLimit: 1500000,
      rpdLimit: 10000,
      availabilityTier: 'Free',
      isFree: true,
      modelType: 'model',
      intendedUse: 'Free high-speed open weights instruction model for short summaries and copilot',
      supportedTaskTypes: ['short_summarization', 'copilot_conversation', 'coding', 'benchmarking']
    },
    {
      id: 'llama-3.3-70b-instruct',
      displayName: 'Llama 3.3 70B Instruct',
      apiModelId: 'meta-llama/llama-3.3-70b-instruct',
      category: 'Pro',
      priority: 2,
      capabilityScore: 94,
      reasoningScore: 93,
      speedScore: 90,
      stabilityScore: 95,
      status: 'production',
      provider: 'openrouter',
      supportsGrounding: false,
      supportsStructuredOutput: true,
      supportsLongContext: true,
      supportsStreaming: true,
      supportsVision: false,
      supportsAudio: false,
      supportsTools: true,
      defaultTimeoutMs: 20000,
      retryCount: 1,
      cooldownDurationMs: 120000,
      enabled: true,
      inputCostPer1M: 0.12,
      outputCostPer1M: 0.30,
      fallbackEnabled: true,
      contextWindow: 131072,
      maxOutput: 8192,
      supportsImageOutput: false,
      supportsVideo: false,
      rpmLimit: 60,
      tpmLimit: 1000000,
      rpdLimit: 5000,
      availabilityTier: 'Pay-as-you-go',
      modelType: 'model',
      intendedUse: 'General reasoning, reports, and commentary via OpenRouter',
      supportedTaskTypes: ['copilot_conversation', 'report_generation', 'market_summary', 'company_analysis', 'benchmarking']
    },
    // --- Nous Research ---
    {
      id: 'hermes-3-405b-instruct',
      displayName: 'Hermes 3 405B Instruct',
      apiModelId: 'nousresearch/hermes-3-llama-3.1-405b',
      category: 'Pro',
      priority: 4,
      capabilityScore: 96,
      reasoningScore: 96,
      speedScore: 75,
      stabilityScore: 93,
      status: 'production',
      provider: 'openrouter',
      supportsGrounding: false,
      supportsStructuredOutput: true,
      supportsLongContext: true,
      supportsStreaming: true,
      supportsVision: false,
      supportsAudio: false,
      supportsTools: true,
      defaultTimeoutMs: 30000,
      retryCount: 1,
      cooldownDurationMs: 180000,
      enabled: true,
      inputCostPer1M: 0.50,
      outputCostPer1M: 1.50,
      fallbackEnabled: true,
      contextWindow: 131072,
      maxOutput: 8192,
      supportsImageOutput: false,
      supportsVideo: false,
      rpmLimit: 30,
      tpmLimit: 500000,
      rpdLimit: 2000,
      availabilityTier: 'Pay-as-you-go',
      modelType: 'model',
      intendedUse: 'Heavyweight deep research and comprehensive reports via OpenRouter',
      supportedTaskTypes: ['deep_research', 'long_writing', 'report_generation', 'benchmarking']
    },
    // --- Nvidia ---
    {
      id: 'llama-nemotron-embed-vl-1b-v2-20260224',
      displayName: 'Llama Nemotron Embed VL 1B v2',
      capabilities: ['embeddings', 'vision'],
      category: 'Flash',
      priority: 1,
      capabilityScore: 90,
      reasoningScore: 80,
      speedScore: 99,
      stabilityScore: 98,
      status: 'production',
      provider: 'openrouter',
      supportsGrounding: false,
      supportsStructuredOutput: false,
      supportsLongContext: true,
      supportsStreaming: false,
      supportsVision: true,
      supportsAudio: false,
      supportsTools: false,
      defaultTimeoutMs: 10000,
      retryCount: 1,
      cooldownDurationMs: 60000,
      enabled: true,
      inputCostPer1M: 0.02,
      outputCostPer1M: 0.02,
      fallbackEnabled: true,
      contextWindow: 32768,
      maxOutput: 1024,
      supportsImageOutput: false,
      supportsVideo: false,
      rpmLimit: 120,
      tpmLimit: 2000000,
      rpdLimit: 20000,
      availabilityTier: 'Pay-as-you-go',
      modelType: 'embedding',
      intendedUse: 'Vector embedding generation for retrieval/search workflows only',
      supportedTaskTypes: ['retrieval']
    },
    {
      id: 'llama-nemotron-rerank-vl-1b-v2',
      displayName: 'Llama Nemotron Rerank VL 1B v2',
      capabilities: ['reranking', 'vision'],
      category: 'Flash',
      priority: 2,
      capabilityScore: 91,
      reasoningScore: 82,
      speedScore: 99,
      stabilityScore: 98,
      status: 'production',
      provider: 'openrouter',
      supportsGrounding: false,
      supportsStructuredOutput: false,
      supportsLongContext: true,
      supportsStreaming: false,
      supportsVision: true,
      supportsAudio: false,
      supportsTools: false,
      defaultTimeoutMs: 10000,
      retryCount: 1,
      cooldownDurationMs: 60000,
      enabled: true,
      inputCostPer1M: 0.02,
      outputCostPer1M: 0.02,
      fallbackEnabled: true,
      contextWindow: 32768,
      maxOutput: 1024,
      supportsImageOutput: false,
      supportsVideo: false,
      rpmLimit: 120,
      tpmLimit: 2000000,
      rpdLimit: 20000,
      availabilityTier: 'Pay-as-you-go',
      modelType: 'reranker',
      intendedUse: 'Document reranking for search/ranking workflows only',
      supportedTaskTypes: ['reranking', 'retrieval']
    },
    {
      id: 'nemotron-3-nano-30b-a3b',
      displayName: 'Nemotron 3 Nano 30B A3B',
      apiModelId: 'nvidia/nemotron-3-nano-30b-a3b',
      category: 'Pro',
      priority: 3,
      capabilityScore: 93,
      reasoningScore: 92,
      speedScore: 90,
      stabilityScore: 94,
      status: 'production',
      provider: 'openrouter',
      supportsGrounding: false,
      supportsStructuredOutput: true,
      supportsLongContext: true,
      supportsStreaming: true,
      supportsVision: true,
      supportsAudio: false,
      supportsTools: true,
      defaultTimeoutMs: 20000,
      retryCount: 1,
      cooldownDurationMs: 120000,
      enabled: true,
      inputCostPer1M: 0.12,
      outputCostPer1M: 0.35,
      fallbackEnabled: true,
      contextWindow: 131072,
      maxOutput: 8192,
      supportsImageOutput: false,
      supportsVideo: false,
      rpmLimit: 60,
      tpmLimit: 1000000,
      rpdLimit: 5000,
      availabilityTier: 'Pay-as-you-go',
      modelType: 'model',
      intendedUse: 'Efficient reasoning and company intelligence via OpenRouter',
      supportedTaskTypes: ['copilot_conversation', 'company_analysis', 'vision', 'benchmarking']
    },
    {
      id: 'nemotron-3-nano-omni-30b-a3b-reasoning-20260428',
      displayName: 'Nemotron 3 Nano Omni 30B Reasoning',
      apiModelId: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
      category: 'Pro',
      priority: 4,
      capabilityScore: 95,
      reasoningScore: 96,
      speedScore: 85,
      stabilityScore: 94,
      status: 'production',
      provider: 'openrouter',
      supportsGrounding: false,
      supportsStructuredOutput: true,
      supportsLongContext: true,
      supportsStreaming: true,
      supportsVision: true,
      supportsAudio: true,
      supportsTools: true,
      defaultTimeoutMs: 25000,
      retryCount: 1,
      cooldownDurationMs: 120000,
      enabled: true,
      inputCostPer1M: 0.15,
      outputCostPer1M: 0.45,
      fallbackEnabled: true,
      contextWindow: 131072,
      maxOutput: 8192,
      supportsImageOutput: false,
      supportsVideo: false,
      rpmLimit: 60,
      tpmLimit: 1000000,
      rpdLimit: 5000,
      availabilityTier: 'Pay-as-you-go',
      modelType: 'model',
      intendedUse: 'Deep analytical reasoning and multimodal tasks via OpenRouter',
      supportedTaskTypes: ['deep_research', 'report_generation', 'vision', 'benchmarking']
    },
    {
      id: 'nemotron-3-super',
      displayName: 'Nemotron 3 Super',
      apiModelId: 'nvidia/nemotron-3-super-120b-a12b',
      category: 'Pro',
      priority: 5,
      capabilityScore: 96,
      reasoningScore: 96,
      speedScore: 84,
      stabilityScore: 95,
      status: 'production',
      provider: 'openrouter',
      supportsGrounding: false,
      supportsStructuredOutput: true,
      supportsLongContext: true,
      supportsStreaming: true,
      supportsVision: false,
      supportsAudio: false,
      supportsTools: true,
      defaultTimeoutMs: 25000,
      retryCount: 1,
      cooldownDurationMs: 120000,
      enabled: true,
      inputCostPer1M: 0.25,
      outputCostPer1M: 0.75,
      fallbackEnabled: true,
      contextWindow: 131072,
      maxOutput: 8192,
      supportsImageOutput: false,
      supportsVideo: false,
      rpmLimit: 60,
      tpmLimit: 1000000,
      rpdLimit: 5000,
      availabilityTier: 'Pay-as-you-go',
      modelType: 'model',
      intendedUse: 'Advanced company intelligence and market synthesis via OpenRouter',
      supportedTaskTypes: ['company_analysis', 'report_generation', 'deep_research', 'benchmarking']
    },
    {
      id: 'nemotron-3-ultra',
      displayName: 'Nemotron 3 Ultra',
      apiModelId: 'nvidia/nemotron-3-ultra-550b-a55b',
      category: 'Pro',
      priority: 6,
      capabilityScore: 98,
      reasoningScore: 98,
      speedScore: 80,
      stabilityScore: 95,
      status: 'production',
      provider: 'openrouter',
      supportsGrounding: false,
      supportsStructuredOutput: true,
      supportsLongContext: true,
      supportsStreaming: true,
      supportsVision: false,
      supportsAudio: false,
      supportsTools: true,
      defaultTimeoutMs: 30000,
      retryCount: 1,
      cooldownDurationMs: 180000,
      enabled: true,
      inputCostPer1M: 0.40,
      outputCostPer1M: 1.20,
      fallbackEnabled: true,
      contextWindow: 131072,
      maxOutput: 8192,
      supportsImageOutput: false,
      supportsVideo: false,
      rpmLimit: 30,
      tpmLimit: 800000,
      rpdLimit: 3000,
      availabilityTier: 'Pay-as-you-go',
      modelType: 'model',
      intendedUse: 'Highest capability strategic reasoning and research via OpenRouter',
      supportedTaskTypes: ['deep_research', 'report_generation', 'benchmarking']
    },
    {
      id: 'nemotron-3.5-content-safety-20260604',
      displayName: 'Nemotron 3.5 Content Safety',
      apiModelId: 'nvidia/nemotron-3.5-content-safety',
      capabilities: ['safety', 'moderation'],
      category: 'Flash',
      priority: 1,
      capabilityScore: 95,
      reasoningScore: 85,
      speedScore: 98,
      stabilityScore: 99,
      status: 'production',
      provider: 'openrouter',
      supportsGrounding: false,
      supportsStructuredOutput: true,
      supportsLongContext: false,
      supportsStreaming: false,
      supportsVision: false,
      supportsAudio: false,
      supportsTools: false,
      defaultTimeoutMs: 8000,
      retryCount: 1,
      cooldownDurationMs: 60000,
      enabled: true,
      inputCostPer1M: 0.02,
      outputCostPer1M: 0.02,
      fallbackEnabled: true,
      contextWindow: 16384,
      maxOutput: 512,
      supportsImageOutput: false,
      supportsVideo: false,
      rpmLimit: 120,
      tpmLimit: 2000000,
      rpdLimit: 20000,
      availabilityTier: 'Pay-as-you-go',
      modelType: 'safety',
      intendedUse: 'Content moderation and safety classification only',
      supportedTaskTypes: ['moderation']
    },
    {
      id: 'nemotron-nano-12b-v2-vl',
      displayName: 'Nemotron Nano 12B v2 VL',
      apiModelId: 'nvidia/nemotron-nano-12b-v2-vl',
      category: 'Flash',
      priority: 2,
      capabilityScore: 90,
      reasoningScore: 88,
      speedScore: 95,
      stabilityScore: 95,
      status: 'production',
      provider: 'openrouter',
      supportsGrounding: false,
      supportsStructuredOutput: true,
      supportsLongContext: true,
      supportsStreaming: true,
      supportsVision: true,
      supportsAudio: false,
      supportsTools: true,
      defaultTimeoutMs: 15000,
      retryCount: 1,
      cooldownDurationMs: 120000,
      enabled: true,
      inputCostPer1M: 0.06,
      outputCostPer1M: 0.18,
      fallbackEnabled: true,
      contextWindow: 131072,
      maxOutput: 4096,
      supportsImageOutput: false,
      supportsVideo: false,
      rpmLimit: 60,
      tpmLimit: 1000000,
      rpdLimit: 5000,
      availabilityTier: 'Pay-as-you-go',
      modelType: 'multimodal',
      intendedUse: 'Multimodal vision input analysis where visual context is relevant',
      supportedTaskTypes: ['vision', 'benchmarking']
    },
    {
      id: 'nemotron-nano-9b-v2',
      displayName: 'Nemotron Nano 9B v2',
      apiModelId: 'nvidia/nemotron-nano-9b-v2',
      category: 'Flash',
      priority: 2,
      capabilityScore: 88,
      reasoningScore: 86,
      speedScore: 97,
      stabilityScore: 95,
      status: 'production',
      provider: 'openrouter',
      supportsGrounding: false,
      supportsStructuredOutput: true,
      supportsLongContext: true,
      supportsStreaming: true,
      supportsVision: false,
      supportsAudio: false,
      supportsTools: true,
      defaultTimeoutMs: 12000,
      retryCount: 1,
      cooldownDurationMs: 120000,
      enabled: true,
      inputCostPer1M: 0.0,
      outputCostPer1M: 0.0,
      fallbackEnabled: true,
      contextWindow: 131072,
      maxOutput: 4096,
      supportsImageOutput: false,
      supportsVideo: false,
      rpmLimit: 60,
      tpmLimit: 1000000,
      rpdLimit: 5000,
      availabilityTier: 'Free',
      isFree: true,
      modelType: 'model',
      intendedUse: 'Free high-efficiency general chat and summary model',
      supportedTaskTypes: ['copilot_conversation', 'short_summarization', 'benchmarking']
    },
    // --- OpenAI (via OpenRouter) ---
    {
      id: 'gpt-oss-120b',
      displayName: 'GPT-OSS 120B',
      apiModelId: 'openai/gpt-oss-120b',
      category: 'Pro',
      priority: 1,
      capabilityScore: 96,
      reasoningScore: 96,
      speedScore: 85,
      stabilityScore: 95,
      status: 'production',
      provider: 'openrouter',
      supportsGrounding: false,
      supportsStructuredOutput: true,
      supportsLongContext: true,
      supportsStreaming: true,
      supportsVision: false,
      supportsAudio: false,
      supportsTools: true,
      defaultTimeoutMs: 25000,
      retryCount: 1,
      cooldownDurationMs: 120000,
      enabled: true,
      inputCostPer1M: 0.15,
      outputCostPer1M: 0.60,
      fallbackEnabled: true,
      contextWindow: 131072,
      maxOutput: 8192,
      supportsImageOutput: false,
      supportsVideo: false,
      rpmLimit: 60,
      tpmLimit: 1000000,
      rpdLimit: 5000,
      availabilityTier: 'Pay-as-you-go',
      modelType: 'model',
      intendedUse: 'Primary open weights general chat and copilot reasoning model',
      supportedTaskTypes: ['copilot_conversation', 'deep_research', 'report_generation', 'company_analysis', 'market_summary', 'benchmarking']
    },
    {
      id: 'gpt-oss-20b',
      displayName: 'GPT-OSS 20B',
      apiModelId: 'openai/gpt-oss-20b',
      category: 'Flash',
      priority: 1,
      capabilityScore: 89,
      reasoningScore: 86,
      speedScore: 96,
      stabilityScore: 95,
      status: 'production',
      provider: 'openrouter',
      supportsGrounding: false,
      supportsStructuredOutput: true,
      supportsLongContext: true,
      supportsStreaming: true,
      supportsVision: false,
      supportsAudio: false,
      supportsTools: true,
      defaultTimeoutMs: 12000,
      retryCount: 1,
      cooldownDurationMs: 120000,
      enabled: true,
      inputCostPer1M: 0.0,
      outputCostPer1M: 0.0,
      fallbackEnabled: true,
      contextWindow: 65536,
      maxOutput: 4096,
      supportsImageOutput: false,
      supportsVideo: false,
      rpmLimit: 60,
      tpmLimit: 1000000,
      rpdLimit: 5000,
      availabilityTier: 'Free',
      isFree: true,
      modelType: 'model',
      intendedUse: 'Free fast general assistant and coding helper',
      supportedTaskTypes: ['copilot_conversation', 'short_summarization', 'coding', 'benchmarking']
    },
    // --- Poolside ---
    {
      id: 'laguna-m.1',
      displayName: 'Laguna M.1',
      apiModelId: 'poolside/laguna-m.1',
      category: 'Pro',
      priority: 4,
      capabilityScore: 91,
      reasoningScore: 90,
      speedScore: 93,
      stabilityScore: 94,
      status: 'production',
      provider: 'openrouter',
      supportsGrounding: false,
      supportsStructuredOutput: true,
      supportsLongContext: true,
      supportsStreaming: true,
      supportsVision: false,
      supportsAudio: false,
      supportsTools: true,
      defaultTimeoutMs: 15000,
      retryCount: 1,
      cooldownDurationMs: 120000,
      enabled: true,
      inputCostPer1M: 0.09,
      outputCostPer1M: 0.22,
      fallbackEnabled: true,
      contextWindow: 65536,
      maxOutput: 4096,
      supportsImageOutput: false,
      supportsVideo: false,
      rpmLimit: 60,
      tpmLimit: 1000000,
      rpdLimit: 5000,
      availabilityTier: 'Pay-as-you-go',
      modelType: 'model',
      intendedUse: 'Mid-sized rapid reasoning model via OpenRouter',
      supportedTaskTypes: ['copilot_conversation', 'market_summary', 'benchmarking']
    },
    {
      id: 'laguna-xs-2.1',
      displayName: 'Laguna XS 2.1',
      apiModelId: 'poolside/laguna-xs-2.1',
      category: 'Flash',
      priority: 4,
      capabilityScore: 87,
      reasoningScore: 85,
      speedScore: 98,
      stabilityScore: 96,
      status: 'production',
      provider: 'openrouter',
      supportsGrounding: false,
      supportsStructuredOutput: true,
      supportsLongContext: true,
      supportsStreaming: true,
      supportsVision: false,
      supportsAudio: false,
      supportsTools: true,
      defaultTimeoutMs: 10000,
      retryCount: 1,
      cooldownDurationMs: 120000,
      enabled: true,
      inputCostPer1M: 0.04,
      outputCostPer1M: 0.10,
      fallbackEnabled: true,
      contextWindow: 65536,
      maxOutput: 4096,
      supportsImageOutput: false,
      supportsVideo: false,
      rpmLimit: 100,
      tpmLimit: 1500000,
      rpdLimit: 10000,
      availabilityTier: 'Pay-as-you-go',
      modelType: 'model',
      intendedUse: 'Ultra-lightweight fast processing via OpenRouter',
      supportedTaskTypes: ['short_summarization', 'market_summary', 'benchmarking']
    },
    {
      id: 'laguna-xs.2',
      displayName: 'Laguna XS.2',
      category: 'Flash',
      priority: 5,
      capabilityScore: 86,
      reasoningScore: 84,
      speedScore: 98,
      stabilityScore: 96,
      status: 'production',
      provider: 'openrouter',
      supportsGrounding: false,
      supportsStructuredOutput: true,
      supportsLongContext: true,
      supportsStreaming: true,
      supportsVision: false,
      supportsAudio: false,
      supportsTools: true,
      defaultTimeoutMs: 10000,
      retryCount: 1,
      cooldownDurationMs: 120000,
      enabled: true,
      inputCostPer1M: 0.035,
      outputCostPer1M: 0.09,
      fallbackEnabled: true,
      contextWindow: 65536,
      maxOutput: 4096,
      supportsImageOutput: false,
      supportsVideo: false,
      rpmLimit: 100,
      tpmLimit: 1500000,
      rpdLimit: 10000,
      availabilityTier: 'Pay-as-you-go',
      modelType: 'model',
      intendedUse: 'Compact summary generation via OpenRouter',
      supportedTaskTypes: ['short_summarization', 'benchmarking']
    },
    // --- Qwen ---
    {
      id: 'qwen3-coder-480b-a35b',
      displayName: 'Qwen3 Coder 480B A35B',
      apiModelId: 'qwen/qwen3-coder',
      category: 'Pro',
      priority: 1,
      capabilityScore: 97,
      reasoningScore: 97,
      speedScore: 82,
      stabilityScore: 95,
      status: 'production',
      provider: 'openrouter',
      supportsGrounding: false,
      supportsStructuredOutput: true,
      supportsLongContext: true,
      supportsStreaming: true,
      supportsVision: false,
      supportsAudio: false,
      supportsTools: true,
      defaultTimeoutMs: 25000,
      retryCount: 1,
      cooldownDurationMs: 120000,
      enabled: true,
      inputCostPer1M: 0.30,
      outputCostPer1M: 0.90,
      fallbackEnabled: true,
      contextWindow: 131072,
      maxOutput: 8192,
      supportsImageOutput: false,
      supportsVideo: false,
      rpmLimit: 40,
      tpmLimit: 800000,
      rpdLimit: 3000,
      availabilityTier: 'Pay-as-you-go',
      modelType: 'model',
      intendedUse: 'Primary flagship coding and developer engineering model',
      supportedTaskTypes: ['coding', 'benchmarking']
    },
    {
      id: 'qwen3-next-80b-a3b-instruct',
      displayName: 'Qwen3 Next 80B A3B Instruct',
      apiModelId: 'qwen/qwen3-next-80b-a3b-instruct',
      category: 'Pro',
      priority: 2,
      capabilityScore: 95,
      reasoningScore: 95,
      speedScore: 88,
      stabilityScore: 94,
      status: 'production',
      provider: 'openrouter',
      supportsGrounding: false,
      supportsStructuredOutput: true,
      supportsLongContext: true,
      supportsStreaming: true,
      supportsVision: false,
      supportsAudio: false,
      supportsTools: true,
      defaultTimeoutMs: 25000,
      retryCount: 1,
      cooldownDurationMs: 120000,
      enabled: true,
      inputCostPer1M: 0.18,
      outputCostPer1M: 0.70,
      fallbackEnabled: true,
      contextWindow: 131072,
      maxOutput: 8192,
      supportsImageOutput: false,
      supportsVideo: false,
      rpmLimit: 60,
      tpmLimit: 1000000,
      rpdLimit: 5000,
      availabilityTier: 'Pay-as-you-go',
      modelType: 'model',
      intendedUse: 'High performance general reasoning and research model',
      supportedTaskTypes: ['copilot_conversation', 'deep_research', 'report_generation', 'company_analysis', 'benchmarking']
    },
    // --- Tencent ---
    {
      id: 'hy3',
      displayName: 'Tencent Hy3',
      apiModelId: 'tencent/hy3',
      category: 'Pro',
      priority: 3,
      capabilityScore: 93,
      reasoningScore: 92,
      speedScore: 90,
      stabilityScore: 94,
      status: 'production',
      provider: 'openrouter',
      supportsGrounding: false,
      supportsStructuredOutput: true,
      supportsLongContext: true,
      supportsStreaming: true,
      supportsVision: false,
      supportsAudio: false,
      supportsTools: true,
      defaultTimeoutMs: 20000,
      retryCount: 1,
      cooldownDurationMs: 120000,
      enabled: true,
      inputCostPer1M: 0.11,
      outputCostPer1M: 0.28,
      fallbackEnabled: true,
      contextWindow: 131072,
      maxOutput: 8192,
      supportsImageOutput: false,
      supportsVideo: false,
      rpmLimit: 60,
      tpmLimit: 1000000,
      rpdLimit: 5000,
      availabilityTier: 'Pay-as-you-go',
      modelType: 'model',
      intendedUse: 'General business intelligence and analytical dialogue via OpenRouter',
      supportedTaskTypes: ['copilot_conversation', 'company_analysis', 'benchmarking']
    },
    // --- Venice (Uncensored - Disabled by Default & Owner Only) ---
    {
      id: 'uncensored',
      displayName: 'Venice Uncensored',
      apiModelId: 'cognitivecomputations/dolphin-mistral-24b-venice-edition',
      category: 'Pro',
      priority: 99,
      capabilityScore: 88,
      reasoningScore: 88,
      speedScore: 85,
      stabilityScore: 90,
      status: 'production',
      provider: 'openrouter',
      supportsGrounding: false,
      supportsStructuredOutput: true,
      supportsLongContext: true,
      supportsStreaming: true,
      supportsVision: false,
      supportsAudio: false,
      supportsTools: true,
      defaultTimeoutMs: 25000,
      retryCount: 1,
      cooldownDurationMs: 120000,
      enabled: false,
      ownerOnly: true,
      inputCostPer1M: 0.20,
      outputCostPer1M: 0.80,
      fallbackEnabled: false,
      contextWindow: 65536,
      maxOutput: 4096,
      supportsImageOutput: false,
      supportsVideo: false,
      rpmLimit: 20,
      tpmLimit: 200000,
      rpdLimit: 500,
      availabilityTier: 'Pay-as-you-go',
      modelType: 'model',
      intendedUse: 'Disabled by default owner-only unrestricted model',
    }
  ];
  public static cacheConfig: { data: any; timestamp: number } | null = null;
  private static readonly CONFIG_CACHE_TTL_MS = 5000;

  // --- TASK CLASSIFICATION MATRIX ---
  private static lastRoutingDecisions: RoutingDecision[] = [];

  public static getRecentRoutingDecisions(): RoutingDecision[] {
    return this.lastRoutingDecisions.slice(-50);
  }

  public static evaluateModelsForTask(task: TaskType, models: ModelMetadata[], config?: any, subsystem?: string): RoutingDecision {
    const startTime = Date.now();
    const reqCap = this.getRequiredCapabilityForTask(task);
    const featureReq = subsystem && FEATURE_REQUIREMENTS[subsystem] ? FEATURE_REQUIREMENTS[subsystem] : undefined;

    const candidateModels: RoutingDecisionCandidate[] = [];
    const rejectedModels: RoutingDecisionRejected[] = [];

    const policy = config?.routingPolicies?.featureRouting?.[subsystem || ''];
    const preferredProvider = policy?.provider !== 'auto' ? policy?.provider : undefined;
    const providerPref = config?.globalProviderPreference || config?.routingPolicies?.globalProviderPref || preferredProvider || featureReq?.preferredProvider || (task === 'daily_email' ? 'google' : 'openrouter');
    const freeFirst = config?.freeFirstRouting !== false && config?.routingPolicies?.freeFirstRouting !== false;

    for (const model of models) {
      if (!model.enabled) {
        rejectedModels.push({
          modelId: model.id,
          displayName: model.displayName,
          provider: model.provider,
          rejectionReason: 'Model administratively disabled'
        });
        continue;
      }
      if (model.id === 'uncensored') {
        rejectedModels.push({
          modelId: model.id,
          displayName: model.displayName,
          provider: model.provider,
          rejectionReason: 'Restricted model policy'
        });
        continue;
      }
      if (!this.isModelCapableForTask(model, task)) {
        rejectedModels.push({
          modelId: model.id,
          displayName: model.displayName,
          provider: model.provider,
          rejectionReason: `Incompatible capability: missing '${reqCap}' for task '${task}'`
        });
        continue;
      }
      if (model.cooldownStatus === 'cooldown' || model.cooldownStatus === 'offline') {
        rejectedModels.push({
          modelId: model.id,
          displayName: model.displayName,
          provider: model.provider,
          rejectionReason: `Health gate failure: model currently in '${model.cooldownStatus}' status`
        });
        continue;
      }
      if (model.cooldownStatus === 'recovering') {
        if (Math.random() >= 0.05) {
          rejectedModels.push({
            modelId: model.id,
            displayName: model.displayName,
            provider: model.provider,
            rejectionReason: 'Health gate canary recovery phase (95% throttle)'
          });
          continue;
        }
      }

      // Multi-Factor Composite Scoring Engine (0-100)
      let qualityScore = model.capabilityScore || 85;
      if (task === 'coding') qualityScore = model.codingScore || model.reasoningScore || model.capabilityScore;
      else if (task === 'deep_research' || task === 'copilot_conversation') qualityScore = model.reasoningScore || model.capabilityScore;
      else if (task === 'company_analysis' || task === 'market_summary') qualityScore = model.financialAnalysisScore || model.reasoningScore || model.capabilityScore;
      else if (task === 'report_generation' || task === 'long_writing' || task === 'daily_email') qualityScore = model.writingScore || model.reasoningScore || model.capabilityScore;

      const speedScore = model.speedScore || 80;
      const reliabilityScore = model.reliabilityScore || model.stabilityScore || 85;
      const healthBoost = model.healthScore ? (model.healthScore - 80) * 0.5 : 0;

      // Cost efficiency score (higher is cheaper)
      const costPerM = (model.inputCostPer1M || 0) + (model.outputCostPer1M || 0);
      let costScore = 80;
      if (costPerM === 0) costScore = 100;
      else if (costPerM < 0.5) costScore = 95;
      else if (costPerM < 2.0) costScore = 85;
      else if (costPerM < 5.0) costScore = 75;
      else costScore = 60;

      let compositeScore = qualityScore * 0.45 + reliabilityScore * 0.25 + speedScore * 0.15 + costScore * 0.15 + healthBoost;

      // Apply Provider & Free-First policy weights
      if (task === 'daily_email' && model.provider === 'google') {
        compositeScore += 25; // Strict preference for Google Gemini on daily_email
      } else if (model.provider === providerPref) {
        compositeScore += 12;
      }
      if (freeFirst && (model.isFree || costPerM === 0 || model.id === 'openrouter/free')) {
        compositeScore += 20;
      }

      candidateModels.push({
        modelId: model.id,
        displayName: model.displayName,
        provider: model.provider,
        compositeScore: Number(compositeScore.toFixed(2)),
        scoreBreakdown: {
          qualityScore,
          reliabilityScore,
          speedScore,
          costScore
        }
      });
    }

    candidateModels.sort((a, b) => b.compositeScore - a.compositeScore);

    let winningModel = candidateModels[0]?.modelId;
    let winningModelDisplayName = candidateModels[0]?.displayName || 'Unknown';
    let winningProvider = candidateModels[0]?.provider || 'google';

    if (!winningModel) {
      const isDaily = task === 'daily_email';
      const fallbackModelObj = models.find(m => m.enabled && (isDaily ? m.provider === 'google' : m.provider === 'openrouter')) || models.find(m => m.enabled);
      winningModel = fallbackModelObj?.id || (isDaily ? 'gemini-3.5-flash' : 'openai/gpt-4o-mini');
      winningModelDisplayName = fallbackModelObj?.displayName || 'Default Fallback';
      winningProvider = fallbackModelObj?.provider || (isDaily ? 'google' : 'openrouter');
    }

    const fallbacks = candidateModels.slice(1, 4).map(c => c.modelId);
    const confidenceScore = candidateModels[0] ? Math.min(100, Math.round(candidateModels[0].compositeScore)) : 50;

    const decision: RoutingDecision = {
      decisionId: `dec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      task,
      subsystem,
      requirements: featureReq ? { ...featureReq } : { requiredCapability: reqCap, providerPreference: providerPref, freeFirst },
      candidateModels: candidateModels.slice(0, 10),
      rejectedModels: rejectedModels.slice(0, 10),
      winningModel,
      winningModelDisplayName,
      provider: winningProvider,
      confidenceScore,
      executionTimeMs: Date.now() - startTime,
      fallbacks,
      explanation: `Selected '${winningModelDisplayName}' (${winningProvider}) with confidence score ${confidenceScore}% based on multi-factor evaluation across ${candidateModels.length} candidates.`
    };

    this.lastRoutingDecisions.push(decision);
    if (this.lastRoutingDecisions.length > 200) {
      this.lastRoutingDecisions.shift();
    }

    return decision;
  }

  // --- TASK CLASSIFICATION MATRIX ---
  public static selectBestModelForTask(task: TaskType, models: ModelMetadata[], config?: any, subsystem?: Subsystem): string {
    const decision = this.evaluateModelsForTask(task, models, config, subsystem);
    return decision.winningModel;
  }

  // --- STATUTORY SUB-SYSTEM MAPPING TO TASKS ---
  private static mapSubsystemToTask(subsystem: Subsystem): TaskType {
    switch (subsystem) {
      case 'Daily Email': return 'daily_email';
      case 'Research Engine':
      case 'Research': return 'deep_research';
      case 'Copilot': return 'copilot_conversation';
      case 'Editorial Commentary':
      case 'Commentary': return 'market_summary';
      case 'Business School':
      case 'Company Intelligence': return 'company_analysis';
      case 'Reports': return 'report_generation';
      case 'Opportunities': return 'market_summary';
      case 'Summaries': return 'short_summarization';
      case 'Background AI':
      case 'Background AI Jobs': return 'long_writing';
      case 'Benchmarking':
      case 'AI Playground': return 'benchmarking';
      default: return 'copilot_conversation';
    }
  }

  public static classifyError(status: number, bodyText: string): string {
    const text = (bodyText || '').toLowerCase();
    if (status === 400 && (text.includes('configuration error') || text.includes('missing') || text.includes('not configured'))) {
      return 'CONFIGURATION_ERROR';
    }
    if (text.includes('json parse failure') || text.includes('malformed non-json')) {
      return 'JSON_PARSE_FAILURE';
    }
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

  public static async recordTelemetry(projectId: string, telemetry: any, token?: string): Promise<{ success: boolean; docId: string; error?: string; summarySuccess: boolean; summaryError?: string }> {
    const docId = `telemetry_${Date.now()}_${crypto.randomUUID()}`;
    let success = false;
    let error = '';
    let summarySuccess = false;
    let summaryError: string | undefined;

    try {
      const doc = { fields: {} as any };
      for (const [k, v] of Object.entries(telemetry)) {
        doc.fields[k] = toFirestoreValue(v);
      }
      const res = await firestoreFetch(projectId, `aiTelemetry/${docId}`, token, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(doc)
      });
      if (res.ok) {
        success = true;
        // Clear alert on success
        await firestoreFetch(projectId, 'system/telemetryAlerts', token, {
          method: 'DELETE'
        }).catch(() => {});
      } else {
        const text = await res.text();
        error = `HTTP ${res.status}: ${text}`;
        console.error(`[AIOrchestrator] Telemetry write failed: ${error}`);
        await this.raiseTelemetryAlert(projectId, 'aiTelemetry Write', error, token);
      }
    } catch (e: any) {
      error = e.message || String(e);
      console.error('[AIOrchestrator] Telemetry save failed:', e);
      await this.raiseTelemetryAlert(projectId, 'aiTelemetry Write', error, token);
    }

    if (success) {
      try {
        const summaryRes = await this.updateTelemetrySummary(projectId, telemetry, token);
        summarySuccess = summaryRes.success;
        summaryError = summaryRes.error;
      } catch (e: any) {
        summaryError = e.message || String(e);
      }
    }

    return { success, docId, error, summarySuccess, summaryError };
  }

  private static async updateTelemetrySummary(projectId: string, telemetry: any, token?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const dateStr = new Date(telemetry.timestamp || Date.now()).toISOString().split('T')[0];
      let summary: any = {
        date: dateStr,
        requests: 0,
        tokens: 0,
        promptTokens: 0,
        completionTokens: 0,
        cost: 0,
        successes: 0,
        failures: 0,
        cachedResponses: 0,
        totalLatencyMs: 0,
        retries: 0,
        failovers: 0,
        featureCost: {},
        workspaceCost: {},
        userCost: {}
      };

      const res = await firestoreFetch(projectId, `aiTelemetrySummary/${dateStr}`, token);
      if (res.ok) {
        const raw = await res.json() as any;
        const existing = fromFirestoreDoc(raw);
        if (existing && existing.requests !== undefined) {
          summary = { ...summary, ...existing };
          summary.featureCost = existing.featureCost || {};
          summary.workspaceCost = existing.workspaceCost || {};
          summary.userCost = existing.userCost || {};
        }
      }

      summary.requests++;
      summary.tokens += (telemetry.totalTokens || 0);
      summary.promptTokens += (telemetry.promptTokens || 0);
      summary.completionTokens += (telemetry.completionTokens || 0);
      summary.cost += (telemetry.estimatedCost || 0);
      if (telemetry.success) summary.successes++;
      else summary.failures++;
      if (telemetry.cachedResponse) summary.cachedResponses++;
      summary.totalLatencyMs += (telemetry.latency || 0);
      summary.retries += (telemetry.retryCount || 0);
      if (telemetry.fallbackModel && telemetry.fallbackModel !== '') summary.failovers++;

      const feat = telemetry.feature || 'Unknown';
      summary.featureCost[feat] = (summary.featureCost[feat] || 0) + (telemetry.estimatedCost || 0);
      const ws = telemetry.workspace || 'Unknown';
      summary.workspaceCost[ws] = (summary.workspaceCost[ws] || 0) + (telemetry.estimatedCost || 0);
      const usr = telemetry.user || 'Unknown';
      summary.userCost[usr] = (summary.userCost[usr] || 0) + (telemetry.estimatedCost || 0);

      const doc = { fields: {} as any };
      for (const [k, v] of Object.entries(summary)) {
        doc.fields[k] = toFirestoreValue(v);
      }
      const writeRes = await firestoreFetch(projectId, `aiTelemetrySummary/${dateStr}`, token, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(doc)
      });
      if (writeRes.ok) {
        return { success: true };
      } else {
        const errText = await writeRes.text();
        return { success: false, error: `HTTP ${writeRes.status}: ${errText}` };
      }
    } catch (e: any) {
      return { success: false, error: e.message || String(e) };
    }
  }

  private static async getPersistentStats(projectId: string, token?: string): Promise<{ models: Record<string, any>; providers: Record<string, any> }> {
    try {
      const res = await firestoreFetch(projectId, 'system/aiOrchestratorStats', token);
      if (res.ok) {
        const raw = await res.json() as any;
        const data = fromFirestoreDoc(raw);
        if (data && data.models) {
          return { models: data.models || {}, providers: data.providers || {} };
        }
      }
    } catch (e) {
      console.warn('[AIOrchestrator] Failed to fetch persistent stats:', e);
    }
    return { models: {}, providers: {} };
  }

  private static async updatePersistentStats(
    projectId: string,
    modelId: string,
    providerId: string,
    latencyMs: number,
    success: boolean,
    reason?: string,
    token?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const current = await this.getPersistentStats(projectId, token);
      const m = current.models[modelId] || { requests: 0, success: 0, failure: 0, totalLatencyMs: 0 };
      m.requests++;
      m.totalLatencyMs += latencyMs;
      if (success) {
        m.success++;
        m.lastSuccess = new Date().toISOString();
      } else {
        m.failure++;
        m.lastFailure = new Date().toISOString();
        m.lastFailureReason = reason || '';
      }
      current.models[modelId] = m;

      const p = current.providers[providerId] || { requests: 0, success: 0, failure: 0, totalLatencyMs: 0 };
      p.requests++;
      p.totalLatencyMs += latencyMs;
      if (success) p.success++;
      else p.failure++;
      current.providers[providerId] = p;

      const doc = { fields: { models: toFirestoreValue(current.models), providers: toFirestoreValue(current.providers) } };
      const writeRes = await firestoreFetch(projectId, 'system/aiOrchestratorStats', token, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(doc)
      });
      if (writeRes.ok) {
        return { success: true };
      } else {
        const text = await writeRes.text();
        console.error(`[AIOrchestrator] Persistent stats update failed (HTTP ${writeRes.status}): ${text}`);
        return { success: false, error: `HTTP ${writeRes.status}: ${text}` };
      }
    } catch (e: any) {
      console.warn('[AIOrchestrator] Failed to update persistent stats:', e);
      return { success: false, error: e.message || String(e) };
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

  private static async setPersistentCooldown(projectId: string, modelId: string, until: number, token?: string): Promise<void> {
    localCooldownCache[modelId] = until;
    try {
      const doc = { fields: {} as any };
      for (const [k, v] of Object.entries(localCooldownCache)) {
        doc.fields[k] = toFirestoreValue(v);
      }
      const res = await firestoreFetch(projectId, 'system/aiOrchestratorCooldowns', token, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(doc)
      });
      if (!res.ok) {
        const text = await res.text();
        console.error(`[AIOrchestrator] Cooldown write failed (HTTP ${res.status}): ${text}`);
      }
    } catch (e) {
      console.error('[AIOrchestrator] Cooldown write failed:', e);
    }
  }

  public static async flushCooldowns(projectId: string, token?: string): Promise<void> {
    localCooldownCache = {};
    localCooldownCacheExpiry = 0;
    try {
      const res = await firestoreFetch(projectId, 'system/aiOrchestratorCooldowns', token, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const text = await res.text();
        console.error(`[AIOrchestrator] Flush cooldowns failed (HTTP ${res.status}): ${text}`);
      }
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
      await Promise.all(
        toDelete.map(record =>
          fetch(firestoreUrl(projectId, `aiTelemetry/${record.id}`), {
            method: 'DELETE'
          })
        )
      );
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

  public static async clearTelemetry(projectId: string, token?: string): Promise<void> {
    try {
      const telemetry = await this.getTelemetry(projectId, token);
      await Promise.all(
        telemetry.map(record =>
          firestoreFetch(projectId, `aiTelemetry/${record.id}`, token, {
            method: 'DELETE'
          })
        )
      );
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
    apiKey: string | Record<string, string>,
    userId: string,
    workspaceId = 'default',
    token?: string,
    sandboxConfig?: any
  ): Promise<{ data: any; originalModel: string; actualModel: string; retries: number; fallbackUsed: boolean; errorReason?: string }> {
    const startTime = Date.now();
    let retriesCount = 0;
    
    // 1. Fetch system configs and checks
    const config = sandboxConfig || await this.getOrchestratorConfig(projectId, token);
    const maintenanceMode = config?.maintenanceMode || false;
    if (maintenanceMode) {
      throw new Error('AIOrchestrator: System is currently undergoing scheduled maintenance. Please try again shortly.');
    }

    const forcedModel = config?.forcedModel || null;
    const modelOverrides = config?.modelOverrides || {};

    // 2. Fetch shared persistent cooldown state
    const persistentCooldowns = await this.getPersistentCooldowns(projectId, token);

    // Build model objects mapping configurations
    const now = Date.now();
    const registryList = this.DEFAULT_MODELS.map(m => {
      const override = modelOverrides[m.id];
      const cd = persistentCooldowns[m.id] || 0;
      const cooldownRemaining = Math.max(0, cd - now);
      let cooldownStatus: 'healthy' | 'cooldown' | 'recovering' = 'healthy';
      if (cd > 0) {
        if (cooldownRemaining > 0) {
          cooldownStatus = 'cooldown';
        } else if (now - cd < 300000) { // 5-minute canary recovery window
          cooldownStatus = 'recovering';
        }
      }
      return {
        ...m,
        enabled: override && override.enabled !== undefined ? override.enabled : m.enabled,
        priority: override && override.priority !== undefined ? override.priority : m.priority,
        cooldownDurationMs: override && override.cooldownDurationMs !== undefined ? override.cooldownDurationMs : m.cooldownDurationMs,
        cooldownStatus
      };
    });

    // 3. Task-Based model selection
    const taskType = this.mapSubsystemToTask(subsystem);
    const taskModelDefault = this.selectBestModelForTask(taskType, registryList, config, subsystem);

    let targetModelId = '';
    const logicalChoice = preferredChoice || 'Automatic';

    if (forcedModel) {
      targetModelId = forcedModel;
    } else if (logicalChoice === 'Automatic') {
      targetModelId = taskModelDefault;
    } else if (logicalChoice.startsWith('gemini-') || logicalChoice.startsWith('openrouter/') || logicalChoice.includes('-')) {
      targetModelId = logicalChoice;
    } else {
      targetModelId = LogicalModelResolve(logicalChoice, subsystem, config);
    }

    const requestedModel = targetModelId;

    // 3.1. Dual-Layer Caching Check
    const cacheHit = await this.getCachedResponse(projectId, systemPrompt, userPrompt, targetModelId, token).catch(() => null);
    if (cacheHit) {
      const totalLatency = Date.now() - startTime;
      const totalTokens = cacheHit.promptTokens + cacheHit.completionTokens;
      
      const matched = registryList.find(m => m.id === targetModelId);
      const cost = matched ? (((cacheHit.promptTokens / 1000000) * matched.inputCostPer1M) +
                              ((cacheHit.completionTokens / 1000000) * matched.outputCostPer1M)) : 0.0;
      
      const selectedProvider = matched?.provider || 'google';

      const isJsonTask = ['report_generation', 'company_analysis', 'market_summary', 'benchmarking', 'daily_email'].includes(taskType);
      const rawText = cacheHit.response || '';

      const telemetry = {
        timestamp: new Date().toISOString(),
        user: userId,
        workspace: workspaceId,
        feature: subsystem,
        provider: selectedProvider,
        selectedModel: requestedModel,
        actualModel: targetModelId,
        fallbackModel: '',
        promptTokens: cacheHit.promptTokens,
        completionTokens: cacheHit.completionTokens,
        totalTokens,
        latency: totalLatency,
        success: true,
        errorClassification: '',
        retryCount: 0,
        estimatedCost: cost,
        cachedResponse: true,
        tokenCountSource: 'estimated' as const,
        
        // Observability diagnostic details for cache hit
        rawResponseFormat: AIModelRegistry.detectFormat(rawText),
        expectedResponseFormat: isJsonTask ? 'json' : 'text',
        normalizationMethod: 'none',
        parseSuccess: true,
        structuredOutputValidation: isJsonTask ? 'success' : 'n/a',
        recoveryAttempted: false,
        recoverySuccess: false,
        actualUnderlyingModel: targetModelId
      };

      const telemetryResult = await this.recordTelemetry(projectId, telemetry, token);
      
      // Update statistics
      await this.updatePersistentStats(projectId, targetModelId, selectedProvider, totalLatency, true, undefined, token).catch(() => {});

      // Build payload matching standard dual-compatible structure
      const finalPayload: any = {
        candidates: [{
          content: {
            parts: [{
              text: rawText
            }]
          }
        }],
        choices: [{
          message: {
            content: rawText
          }
        }]
      };

      try {
        const diagDoc = {
          timestamp: new Date().toISOString(),
          requestId: telemetryResult.docId,
          stages: [
            { name: 'User Request', status: 'success', time: new Date(startTime).toISOString(), executionTimeMs: totalLatency },
            { name: 'AI Orchestrator', status: 'success', details: `Resolved model to ${targetModelId} (Cache Hit)` },
            { name: 'Cache Read', status: 'success', details: 'Served from Dual-Layer Response Cache' },
            { name: 'Telemetry Write', status: telemetryResult.success ? 'success' : 'failed', docId: `aiTelemetry/${telemetryResult.docId}` }
          ]
        };
        const doc = { fields: {} as any };
        for (const [k, v] of Object.entries(diagDoc)) {
          doc.fields[k] = toFirestoreValue(v);
        }
        await firestoreFetch(projectId, 'system/telemetryDiagnostics', token, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(doc)
        });
      } catch (diagErr) {
        console.warn('[AIOrchestrator] Failed to save cache telemetry diagnostics:', diagErr);
      }

      return {
        data: finalPayload,
        originalModel: requestedModel,
        actualModel: targetModelId,
        retries: 0,
        fallbackUsed: false
      };
    }

    // Filter models by capability FIRST before considering provider, priority, free-first routing, cost, or fallback
    const capableModels = registryList.filter(m => m.enabled && m.id !== 'uncensored' && this.isModelCapableForTask(m, taskType));
    const activeModels = capableModels.length > 0 ? capableModels : registryList.filter(m => m.enabled && m.id !== 'uncensored');

    let reqModelObj = activeModels.find(m => m.id === requestedModel);
    if (reqModelObj && !this.isModelCapableForTask(reqModelObj, taskType)) {
      console.warn(`[AIOrchestrator] Requested model '${requestedModel}' does not satisfy required capability for task '${taskType}'. Using capable default '${taskModelDefault}'.`);
      reqModelObj = activeModels.find(m => m.id === taskModelDefault) || activeModels[0];
    } else if (!reqModelObj && requestedModel) {
      reqModelObj = activeModels.find(m => m.id === taskModelDefault) || activeModels[0];
    }

    const effectiveRequestedModel = reqModelObj?.id || taskModelDefault;

    const isFlashTask = reqModelObj ? reqModelObj.category === 'Flash' : (taskType !== 'deep_research' && taskType !== 'report_generation' && taskType !== 'company_analysis');
    const customOrder: string[] | undefined = isFlashTask ? config?.flashFallbackOrder : config?.proFallbackOrder;

    const sortedFallbackChain = [...activeModels].sort((a, b) => {
      if (customOrder && Array.isArray(customOrder)) {
        const idxA = customOrder.indexOf(a.id);
        const idxB = customOrder.indexOf(b.id);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
      }
      return a.priority - b.priority;
    });

    const chain: typeof sortedFallbackChain = [];
    const isCooldowned = (id: string) => {
      const until = persistentCooldowns[id] || 0;
      return Date.now() < until;
    };

    if (reqModelObj && !isCooldowned(effectiveRequestedModel)) {
      chain.push(reqModelObj);
    }

    for (const m of sortedFallbackChain) {
      if (m.id !== effectiveRequestedModel && !isCooldowned(m.id)) {
        chain.push(m);
      }
    }

    // Force fallback if chain empty
    if (chain.length === 0) {
      console.warn('[AIOrchestrator] All registry models are in cooldown. Attempting fallback chain.');
      if (reqModelObj) chain.push(reqModelObj);
      chain.push(...sortedFallbackChain.filter(m => m.id !== effectiveRequestedModel));
    }

    const isJsonTask = ['report_generation', 'company_analysis', 'market_summary', 'benchmarking', 'daily_email'].includes(taskType);

    // Concurrency-gated provider prompt execution with rate-limit retries and json repair
    const executeModelWithRetry = async (model: typeof chain[number]) => {
      const adapter = this.adapters[model.provider];
      if (!adapter) {
        throw new Error(`Unsupported provider: ${model.provider}`);
      }

      const gate = providerGates[model.provider] || providerGates['openrouter'];
      return await gate.run(async () => {
        const modelStartTime = Date.now();
        let resolvedKey = '';
        if (typeof apiKey === 'object' && apiKey !== null) {
          resolvedKey = model.provider === 'openrouter' ? (apiKey.openrouter || '') : (apiKey.google || '');
        } else if (typeof apiKey === 'string') {
          resolvedKey = apiKey;
        }

        if (!resolvedKey || !resolvedKey.trim()) {
          const missingEnv = model.provider === 'openrouter' ? 'OPENROUTER_API_KEY' : 'GEMINI_API_KEY';
          const provName = model.provider === 'openrouter' ? 'OpenRouter' : 'Google Gemini';
          const configErr: any = new Error(`Configuration Error: ${missingEnv} is missing or not configured in Worker runtime environment bindings. ${provName} models cannot be executed.`);
          configErr.status = 400;
          configErr.errorClassification = 'CONFIGURATION_ERROR';
          throw configErr;
        }

        const maxRetries = model.retryCount || 1;
        let lastErr: any = null;
        let lastResultText = '';

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          if (attempt > 0) retriesCount++;

          let currentUserPrompt = userPrompt;
          if (attempt > 0 && isJsonTask && lastResultText) {
            currentUserPrompt = `${userPrompt}\n\n[Auto-Repair System Warning]: Your previous response was not valid JSON. You must output valid, parsable JSON matching the required schema. Please correct your previous output:\n${lastResultText}`;
          }

          try {
            const result = await adapter.executePrompt(
              model.apiModelId || model.id,
              systemPrompt,
              currentUserPrompt,
              resolvedKey.trim(),
              model.defaultTimeoutMs
            );

            lastResultText = result.text;

            let formatDetails = {
              rawResponseFormat: AIModelRegistry.detectFormat(result.text),
              expectedResponseFormat: isJsonTask ? 'json' : 'text',
              normalizationMethod: 'none',
              parseSuccess: true,
              structuredOutputValidation: 'n/a',
              recoveryAttempted: false,
              recoverySuccess: false,
              actualUnderlyingModel: result.rawResponse?.model || model.id
            };

            if (isJsonTask) {
              formatDetails.structuredOutputValidation = 'success';
              try {
                JSON.parse(result.text.trim());
                formatDetails.normalizationMethod = 'direct_json';
                formatDetails.parseSuccess = true;
              } catch (jsonErr) {
                formatDetails.recoveryAttempted = true;
                try {
                  AIModelRegistry.extractAndParseJson(result.text);
                  formatDetails.parseSuccess = true;
                  formatDetails.recoverySuccess = true;
                  const trimmed = result.text.trim();
                  if (trimmed.includes('```')) {
                    formatDetails.normalizationMethod = 'code_fence_extraction';
                  } else {
                    formatDetails.normalizationMethod = 'bracket_extraction_with_repair';
                  }
                } catch (recoveryErr) {
                  formatDetails.parseSuccess = false;
                  formatDetails.recoverySuccess = false;
                  formatDetails.structuredOutputValidation = 'failed';
                  formatDetails.normalizationMethod = 'fallback_default';
                  const errJson: any = new Error(`JSON_PARSE_ERROR: Response is not valid JSON.`);
                  errJson.status = 422;
                  throw errJson;
                }
              }
            } else {
              const hasJsonStructure = result.text.trim().startsWith('{') || result.text.trim().includes('```json') || result.text.trim().includes('{');
              if (hasJsonStructure) {
                try {
                  JSON.parse(result.text.trim());
                  formatDetails.normalizationMethod = 'direct_json';
                } catch (e) {
                  formatDetails.recoveryAttempted = true;
                  try {
                    AIModelRegistry.extractAndParseJson(result.text);
                    formatDetails.recoverySuccess = true;
                    formatDetails.normalizationMethod = 'bracket_extraction';
                  } catch (e2) {
                    formatDetails.recoverySuccess = false;
                    formatDetails.normalizationMethod = 'fallback_default';
                  }
                }
              }
            }

            const hasRealTokens = typeof result.promptTokens === 'number' && typeof result.completionTokens === 'number';
            const pTokens = hasRealTokens ? result.promptTokens! : estimateTokens(systemPrompt + currentUserPrompt);
            const cTokens = hasRealTokens ? result.completionTokens! : estimateTokens(result.text);
            const tcSource: 'provider' | 'estimated' = hasRealTokens ? 'provider' : 'estimated';
            const latency = Date.now() - modelStartTime;

            // Record stats success locally
            const mStats = modelLocalStats.get(model.id) || { requests: 0, success: 0, failure: 0, totalLatencyMs: 0 };
            mStats.success++;
            mStats.totalLatencyMs += latency;
            modelLocalStats.set(model.id, mStats);

            const pStats = providerLocalStats.get(model.provider) || { requests: 0, success: 0, failure: 0, totalLatencyMs: 0 };
            pStats.success++;
            pStats.totalLatencyMs += latency;
            providerLocalStats.set(model.provider, pStats);

            return {
              payload: result.rawResponse,
              promptTokens: pTokens,
              completionTokens: cTokens,
              tokenCountSource: tcSource,
              latency,
              modelId: model.id,
              text: result.text,
              formatDetails
            };
          } catch (e: any) {
            lastErr = e;
            const attemptBody = e.message || String(e);
            let attemptStatus = typeof e.status === 'number' ? e.status : 500;
            if (attemptBody.includes('HTTP 429')) attemptStatus = 429;
            
            const errClass = this.classifyError(attemptStatus, attemptBody);
            if (['MODEL_OVERLOADED', 'DAILY_QUOTA_EXCEEDED', 'RATE_LIMITED'].includes(errClass)) {
              const cooldownExpiry = Date.now() + model.cooldownDurationMs;
              this.setPersistentCooldown(projectId, model.id, cooldownExpiry, token).catch(() => {});
            }

            if (attempt < maxRetries) {
              const backoffTime = attemptStatus === 429 ? Math.min(1000 * Math.pow(2, attempt), 5000) : Math.min(500 * Math.pow(2, attempt), 2000);
              await new Promise(r => setTimeout(r, backoffTime));
            }
          }
        }

        // Record stats failure locally
        const mStats = modelLocalStats.get(model.id) || { requests: 0, success: 0, failure: 0, totalLatencyMs: 0 };
        mStats.failure++;
        mStats.lastFailure = new Date().toISOString();
        modelLocalStats.set(model.id, mStats);

        const pStats = providerLocalStats.get(model.provider) || { requests: 0, success: 0, failure: 0, totalLatencyMs: 0 };
        pStats.failure++;
        providerLocalStats.set(model.provider, pStats);

        throw lastErr;
      });
    };

    // Speculative cascade execution runner with cascading soft timeouts
    const runCascade = async (): Promise<{ payload: any; promptTokens: number; completionTokens: number; tokenCountSource: 'provider' | 'estimated'; latency: number; modelId: string; text: string; formatDetails?: any }> => {
      const activePromises: Array<{ promise: Promise<any>; model: typeof chain[number]; timerId: any }> = [];
      const errors: Array<{ modelId: string; error: any }> = [];
      let nextModelIndex = 0;
      let resolved = false;

      return new Promise((resolve, reject) => {
        const launchNextModel = () => {
          if (resolved || nextModelIndex >= chain.length) return;
          const currentModel = chain[nextModelIndex++];

          // Increment stats request count
          const mStats = modelLocalStats.get(currentModel.id) || { requests: 0, success: 0, failure: 0, totalLatencyMs: 0 };
          mStats.requests++;
          modelLocalStats.set(currentModel.id, mStats);

          const pStats = providerLocalStats.get(currentModel.provider) || { requests: 0, success: 0, failure: 0, totalLatencyMs: 0 };
          pStats.requests++;
          providerLocalStats.set(currentModel.provider, pStats);

          const softTimeoutDuration = currentModel.category === 'Flash' ? 3000 : 6000;
          const timerId = setTimeout(() => {
            launchNextModel();
          }, softTimeoutDuration);

          const promise = executeModelWithRetry(currentModel);
          activePromises.push({ promise, model: currentModel, timerId });

          promise.then(
            (res) => {
              if (resolved) return;
              resolved = true;
              activePromises.forEach(ap => clearTimeout(ap.timerId));
              resolve(res);
            },
            (err) => {
              clearTimeout(timerId);

              if (err.status === 400 || err.errorClassification === 'CONFIGURATION_ERROR' || err.message?.includes('Configuration Error')) {
                resolved = true;
                activePromises.forEach(ap => clearTimeout(ap.timerId));
                reject(err);
                return;
              }

              errors.push({ modelId: currentModel.id, error: err });
              const idx = activePromises.findIndex(ap => ap.model.id === currentModel.id);
              if (idx !== -1) activePromises.splice(idx, 1);

              if (!resolved && activePromises.length === 0) {
                if (nextModelIndex < chain.length) {
                  launchNextModel();
                } else {
                  resolved = true;
                  reject(new Error(`All models failed: ${errors.map(e => `${e.modelId}: ${e.error.message || e.error}`).join('; ')}`));
                }
              }
            }
          );
        };

        launchNextModel();
      });
    };

    let lastErrorType = 'UNKNOWN_PROVIDER_ERROR';
    let lastErrorMsg = 'All models are down';
    let finalPayload: any = null;
    let finalModelId = '';
    let fallbackUsed = false;
    let finalPromptTokens = 0;
    let finalCompletionTokens = 0;
    let tokenCountSource: 'provider' | 'estimated' = 'estimated';
    let modelLatency = 0;
    let attemptSuccess = false;
    let finalPayloadFormatDetails: any = null;

    try {
      const result = await runCascade();
      finalPayload = result.payload;
      finalModelId = result.modelId;
      fallbackUsed = result.modelId !== requestedModel;
      finalPromptTokens = result.promptTokens;
      finalCompletionTokens = result.completionTokens;
      tokenCountSource = result.tokenCountSource;
      modelLatency = result.latency;
      attemptSuccess = true;
      finalPayloadFormatDetails = result.formatDetails;

      if (finalPayload) {
        const rawText = finalPayload.candidates?.[0]?.content?.parts?.[0]?.text || finalPayload.choices?.[0]?.message?.content || result.text || '';
        finalPayload.candidates = finalPayload.candidates || [{
          content: {
            parts: [{
              text: rawText
            }]
          }
        }];
        finalPayload.choices = finalPayload.choices || [{
          message: {
            content: rawText
          }
        }];
      }

      // Cache the successful response
      if (result.text) {
        await this.setCachedResponse(projectId, systemPrompt, userPrompt, finalModelId, result.text, finalPromptTokens, finalCompletionTokens, token).catch(() => {});
      }
    } catch (cascadeErr: any) {
      attemptSuccess = false;
      lastErrorMsg = cascadeErr.message || String(cascadeErr);
      lastErrorType = 'UNKNOWN_PROVIDER_ERROR';
      if (lastErrorMsg.includes('Configuration Error') || lastErrorMsg.includes('missing')) {
        lastErrorType = 'CONFIGURATION_ERROR';
      } else if (lastErrorMsg.includes('JSON_PARSE_ERROR')) {
        lastErrorType = 'JSON_PARSE_FAILURE';
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

    const selectedProvider = registryList.find(m => m.id === finalModelId)?.provider || 'google';

    // 5. Telemetry
    const telemetry = {
      timestamp: new Date().toISOString(),
      user: userId,
      workspace: workspaceId,
      feature: subsystem,
      provider: selectedProvider,
      selectedModel: requestedModel,
      actualModel: finalModelId,
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
      tokenCountSource,
      triggeredFallback: fallbackUsed,
      planningTrace: sandboxConfig?.planningTrace || null,
      
      // Observability diagnostic details
      rawResponseFormat: finalPayloadFormatDetails?.rawResponseFormat || '',
      expectedResponseFormat: finalPayloadFormatDetails?.expectedResponseFormat || '',
      normalizationMethod: finalPayloadFormatDetails?.normalizationMethod || '',
      parseSuccess: finalPayloadFormatDetails?.parseSuccess ?? true,
      structuredOutputValidation: finalPayloadFormatDetails?.structuredOutputValidation || 'n/a',
      recoveryAttempted: finalPayloadFormatDetails?.recoveryAttempted ?? false,
      recoverySuccess: finalPayloadFormatDetails?.recoverySuccess ?? false,
      actualUnderlyingModel: finalPayloadFormatDetails?.actualUnderlyingModel || finalModelId
    };

    let statsResult = { success: true, error: '' };
    try {
      const res = await this.updatePersistentStats(projectId, finalModelId, selectedProvider, modelLatency, attemptSuccess, attemptSuccess ? undefined : lastErrorType, token);
      statsResult = { success: res.success, error: res.error || '' };
    } catch (e: any) {
      statsResult = { success: false, error: e.message || String(e) };
    }

    const telemetryResult = await this.recordTelemetry(projectId, telemetry, token);

    // Save diagnostics to Firestore
    const dateStr = new Date().toISOString().split('T')[0];
    try {
      const diagDoc = {
        timestamp: new Date().toISOString(),
        requestId: telemetryResult.docId,
        stages: [
          { name: 'User Request', status: 'success', time: new Date(startTime).toISOString(), executionTimeMs: Date.now() - startTime },
          { name: 'AI Orchestrator', status: 'success', details: `Resolved model to ${finalModelId}` },
          { name: 'Provider Selected', status: 'success', details: `Selected provider: ${selectedProvider === 'google' ? 'Google Gemini' : 'OpenRouter'}` },
          { name: `${selectedProvider === 'google' ? 'Gemini' : 'OpenRouter'} Request`, status: attemptSuccess ? 'success' : 'failed', latencyMs: modelLatency, attempts: retriesCount + 1, error: attemptSuccess ? '' : lastErrorMsg },
          { name: 'usageMetadata Received', status: tokenCountSource === 'provider' ? 'success' : 'fallback', promptTokens: finalPromptTokens, completionTokens: finalCompletionTokens, source: tokenCountSource },
          { name: 'Telemetry Write', status: telemetryResult.success ? 'success' : 'failed', docId: `aiTelemetry/${telemetryResult.docId}`, error: telemetryResult.error || '' },
          { name: 'Daily Summary Update', status: telemetryResult.summarySuccess ? 'success' : 'failed', docId: `aiTelemetrySummary/${dateStr}`, error: telemetryResult.summaryError || '' },
          { name: 'Model Stats Update', status: statsResult.success ? 'success' : 'failed', docId: 'system/aiOrchestratorStats', error: statsResult.error || '' }
        ]
      };

      const doc = { fields: {} as any };
      for (const [k, v] of Object.entries(diagDoc)) {
        doc.fields[k] = toFirestoreValue(v);
      }
      await firestoreFetch(projectId, 'system/telemetryDiagnostics', token, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(doc)
      });
    } catch (diagErr) {
      console.warn('[AIOrchestrator] Failed to save telemetry diagnostics:', diagErr);
    }

    if (!finalPayload) {
      throw new Error(`AIOrchestrator: Request failed. Error Class: ${lastErrorType} - ${lastErrorMsg}`);
    }

    if (finalPayload && !finalPayload.candidates && finalPayload.choices?.[0]?.message?.content) {
      finalPayload.candidates = [{
        content: {
          parts: [{
            text: finalPayload.choices[0].message.content
          }]
        }
      }];
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

  public static async validateProviders(apiKeys: { google?: string; openrouter?: string }): Promise<{
    google: { status: 'operational' | 'not_configured' | 'failure'; description: string; keyExists: boolean; authSucceeded: boolean };
    openrouter: { status: 'operational' | 'not_configured' | 'failure'; description: string; keyExists: boolean; authSucceeded: boolean };
  }> {
    const results: {
      google: { status: 'operational' | 'not_configured' | 'failure'; description: string; keyExists: boolean; authSucceeded: boolean };
      openrouter: { status: 'operational' | 'not_configured' | 'failure'; description: string; keyExists: boolean; authSucceeded: boolean };
    } = {
      google: { status: 'not_configured', description: 'GEMINI_API_KEY is not configured on backend worker bindings.', keyExists: false, authSucceeded: false },
      openrouter: { status: 'not_configured', description: 'OPENROUTER_API_KEY is not configured on backend worker bindings.', keyExists: false, authSucceeded: false }
    };

    if (apiKeys.google && apiKeys.google.trim()) {
      results.google.keyExists = true;
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKeys.google.trim()}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
          results.google.status = 'operational';
          results.google.description = 'Google Gemini API is operational and authenticated.';
          results.google.authSucceeded = true;
        } else {
          results.google.status = 'failure';
          results.google.description = `Google Gemini authentication failed (HTTP ${res.status})`;
        }
      } catch (err: any) {
        results.google.status = 'failure';
        results.google.description = `Google Gemini verification error: ${err.message || String(err)}`;
      }
    }

    if (apiKeys.openrouter && apiKeys.openrouter.trim()) {
      results.openrouter.keyExists = true;
      try {
        const url = 'https://openrouter.ai/api/v1/auth/key';
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(url, {
          headers: { 'Authorization': `Bearer ${apiKeys.openrouter.trim()}` },
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          results.openrouter.status = 'operational';
          results.openrouter.description = 'OpenRouter API is operational and authenticated.';
          results.openrouter.authSucceeded = true;
        } else {
          results.openrouter.status = 'failure';
          results.openrouter.description = `OpenRouter authentication failed (HTTP ${res.status})`;
        }
      } catch (err: any) {
        results.openrouter.status = 'failure';
        results.openrouter.description = `OpenRouter verification error: ${err.message || String(err)}`;
      }
    }

    return results;
  }

  public static async runLiveProviderCertificationSuite(
    apiKeys: { google?: string; openrouter?: string },
    _testLiveInference = false
  ): Promise<{
    timestamp: string;
    totalModels: number;
    passedCount: number;
    failedCount: number;
    manualCount: number;
    providerAuth: any;
    models: Array<{
      id: string;
      displayName: string;
      provider: string;
      apiModelId: string;
      category: string;
      supportedTasks: string[];
      verificationType: 'LIVE_API_TEST' | 'MANUAL_PRODUCTION_VERIFICATION' | 'CONFIG_ERROR';
      status: 'PASS' | 'FAIL' | 'MANUAL';
      message: string;
      latencyMs?: number;
    }>;
    featuresAudit: Array<{
      feature: string;
      subsystem: string;
      preferredProvider: string;
      selectedModel: string;
      apiModelId: string;
      status: 'PASS' | 'FAIL' | 'MANUAL';
      message: string;
    }>;
  }> {
    const authStatus = await this.validateProviders(apiKeys);
    await this.syncWithProviderCatalog(apiKeys);
    const modelsResults: Array<{
      id: string;
      displayName: string;
      provider: string;
      apiModelId: string;
      category: string;
      supportedTasks: string[];
      verificationType: 'LIVE_API_TEST' | 'MANUAL_PRODUCTION_VERIFICATION' | 'CONFIG_ERROR';
      status: 'PASS' | 'FAIL' | 'MANUAL';
      message: string;
      latencyMs?: number;
    }> = [];

    let passedCount = 0;
    let failedCount = 0;
    let manualCount = 0;

    const g: any = typeof globalThis !== 'undefined' ? globalThis : {};
    const resolvedGoogleKey = (apiKeys.google || g.process?.env?.GEMINI_API_KEY || g.GEMINI_API_KEY || '').trim();
    const resolvedOpenRouterKey = (apiKeys.openrouter || g.process?.env?.OPENROUTER_API_KEY || g.OPENROUTER_API_KEY || '').trim();

    for (const model of this.DEFAULT_MODELS) {
      const apiModelId = model.apiModelId || model.id;
      const apiKeyToUse = model.provider === 'google' ? resolvedGoogleKey : resolvedOpenRouterKey;
      const keyPresent = apiKeyToUse.length > 0;

      // Verify that apiModelId does not equal displayName or inferred invalid string
      if (apiModelId === model.displayName || !apiModelId || apiModelId.trim().length === 0) {
        failedCount++;
        modelsResults.push({
          id: model.id,
          displayName: model.displayName,
          provider: model.provider,
          apiModelId,
          category: model.category,
          supportedTasks: model.supportedTaskTypes || [],
          verificationType: 'CONFIG_ERROR',
          status: 'FAIL',
          message: `CONFIG ERROR: Model apiModelId ('${apiModelId}') is invalid or matches display name.`
        });
        continue;
      }

      if (keyPresent) {
        const adapter = this.adapters[model.provider];
        const startMs = Date.now();
        try {
          if (adapter) {
            await adapter.executePrompt(
              apiModelId,
              'You are a certification bot.',
              'Reply with solely the word CERTIFIED.',
              apiKeyToUse,
              10000
            );
            const latencyMs = Date.now() - startMs;
            passedCount++;
            modelsResults.push({
              id: model.id,
              displayName: model.displayName,
              provider: model.provider,
              apiModelId,
              category: model.category,
              supportedTasks: model.supportedTaskTypes || [],
              verificationType: 'LIVE_API_TEST',
              status: 'PASS',
              message: `Live inference verified against ${model.provider} API (${apiModelId}) in ${latencyMs}ms.`,
              latencyMs
            });
          } else {
            failedCount++;
            modelsResults.push({
              id: model.id,
              displayName: model.displayName,
              provider: model.provider,
              apiModelId,
              category: model.category,
              supportedTasks: model.supportedTaskTypes || [],
              verificationType: 'CONFIG_ERROR',
              status: 'FAIL',
              message: `No adapter registered for provider '${model.provider}'.`
            });
          }
        } catch (err: any) {
          failedCount++;
          modelsResults.push({
            id: model.id,
            displayName: model.displayName,
            provider: model.provider,
            apiModelId,
            category: model.category,
            supportedTasks: model.supportedTaskTypes || [],
            verificationType: 'LIVE_API_TEST',
            status: 'FAIL',
            message: `Live inference failed against provider '${model.provider}' (${apiModelId}): ${err.message || String(err)}`
          });
        }
      } else {
        manualCount++;
        const keyEnvName = model.provider === 'google' ? 'GEMINI_API_KEY' : 'OPENROUTER_API_KEY';
        modelsResults.push({
          id: model.id,
          displayName: model.displayName,
          provider: model.provider,
          apiModelId,
          category: model.category,
          supportedTasks: model.supportedTaskTypes || [],
          verificationType: 'MANUAL_PRODUCTION_VERIFICATION',
          status: 'MANUAL',
          message: `Requires manual production verification against live ${keyEnvName} environment binding (key missing/empty in runtime).`
        });
      }
    }

    // Feature Audit
    const statutoryFeatures: Array<{ name: string; subsystem: Subsystem }> = [
      { name: 'Copilot Chat Engine', subsystem: 'Copilot' },
      { name: 'Daily Briefing Email', subsystem: 'Daily Email' },
      { name: 'Research Engine', subsystem: 'Research Engine' },
      { name: 'Editorial Commentary', subsystem: 'Editorial Commentary' },
      { name: 'Reports Generator', subsystem: 'Reports' },
      { name: 'Opportunities Analyzer', subsystem: 'Opportunities' },
      { name: 'Benchmarking Suite', subsystem: 'Benchmarking' },
      { name: 'AI Playground', subsystem: 'Playground' },
      { name: 'Vector Embeddings', subsystem: 'Embeddings' },
      { name: 'Semantic Reranker', subsystem: 'Reranking' }
    ];

    const featuresAudit = statutoryFeatures.map(f => {
      const taskType = this.mapSubsystemToTask(f.subsystem);
      const selectedModelId = this.selectBestModelForTask(taskType, this.DEFAULT_MODELS, undefined, f.subsystem);
      const modelObj = this.DEFAULT_MODELS.find(m => m.id === selectedModelId) || this.DEFAULT_MODELS[0];
      const apiModelId = modelObj.apiModelId || modelObj.id;
      const modelRes = modelsResults.find(r => r.id === modelObj.id);
      return {
        feature: f.name,
        subsystem: f.subsystem,
        preferredProvider: modelObj.provider,
        selectedModel: modelObj.id,
        apiModelId,
        status: modelRes ? modelRes.status : 'MANUAL' as const,
        message: modelRes ? modelRes.message : 'Requires manual production verification.'
      };
    });

    return {
      timestamp: new Date().toISOString(),
      totalModels: this.DEFAULT_MODELS.length,
      passedCount,
      failedCount,
      manualCount,
      providerAuth: authStatus,
      models: modelsResults,
      featuresAudit
    };
  }

  public static async runBackgroundProactiveHealthProbe(apiKeys: { google?: string; openrouter?: string }, projectId: string, token?: string): Promise<void> {
    const g: any = typeof globalThis !== 'undefined' ? globalThis : {};
    const googleKey = (apiKeys.google || g.process?.env?.GEMINI_API_KEY || g.GEMINI_API_KEY || '').trim();
    const openRouterKey = (apiKeys.openrouter || g.process?.env?.OPENROUTER_API_KEY || g.OPENROUTER_API_KEY || '').trim();

    const enabledOrModels = this.DEFAULT_MODELS.filter(m => m.enabled && m.provider === 'openrouter');
    const enabledGoogleModels = this.DEFAULT_MODELS.filter(m => m.enabled && m.provider === 'google');

    const probeModel = async (model: ModelMetadata, apiKey: string) => {
      if (!apiKey) return;
      const adapter = this.adapters[model.provider];
      if (!adapter) return;
      
      try {
        await adapter.executePrompt(
          model.apiModelId || model.id,
          'You are a health probe bot.',
          'Respond with strictly the word OK.',
          apiKey,
          5000 // 5 seconds timeout
        );
      } catch (err: any) {
        console.warn(`[Health Probe] Model '${model.id}' failed health probe: ${err.message || err}`);
        const attemptBody = err.message || String(err);
        let attemptStatus = typeof err.status === 'number' ? err.status : 500;
        if (attemptBody.includes('HTTP 429')) attemptStatus = 429;
        const errClass = this.classifyError(attemptStatus, attemptBody);
        
        if (['MODEL_OVERLOADED', 'DAILY_QUOTA_EXCEEDED', 'RATE_LIMITED'].includes(errClass)) {
          const cooldownExpiry = Date.now() + model.cooldownDurationMs;
          await this.setPersistentCooldown(projectId, model.id, cooldownExpiry, token).catch(() => {});
        }
      }
    };

    const promises: Promise<any>[] = [];
    if (googleKey) {
      const mainGemini = enabledGoogleModels.find(m => m.id === 'gemini-3.5-flash');
      if (mainGemini) promises.push(probeModel(mainGemini, googleKey));
    }
    if (openRouterKey) {
      for (const m of enabledOrModels) {
        if (m.id !== 'openrouter/free') {
          promises.push(probeModel(m, openRouterKey));
        }
      }
    }

    await Promise.allSettled(promises);
  }

  public static validateRegistry(): {
    timestamp: string;
    isValid: boolean;
    totalModels: number;
    enabledModels: number;
    disabledModels: number;
    verifiedApiModels: number;
    adminAliasModels: number;
    unverifiedDisabledModels: number;
    errorsCount: number;
    warningsCount: number;
    issues: Array<{ modelId: string; type: 'ERROR' | 'WARNING'; code: string; message: string }>;
  } {
    const issues: Array<{ modelId: string; type: 'ERROR' | 'WARNING'; code: string; message: string }> = [];
    const idsSeen = new Set<string>();

    let verifiedApiModels = 0;
    let adminAliasModels = 0;
    let unverifiedDisabledModels = 0;
    let enabledModels = 0;
    let disabledModels = 0;

    for (const m of this.DEFAULT_MODELS) {
      if (m.enabled) enabledModels++; else disabledModels++;

      if (m.verificationStatus === 'VERIFIED_API') verifiedApiModels++;
      else if (m.verificationStatus === 'ADMIN_ALIAS') adminAliasModels++;
      else if (m.verificationStatus === 'UNVERIFIED_DISABLED' || m.verificationStatus === 'PENDING_VERIFICATION') unverifiedDisabledModels++;

      // 1. Check duplicate ID
      if (idsSeen.has(m.id)) {
        issues.push({
          modelId: m.id,
          type: 'ERROR',
          code: 'DUPLICATE_REGISTRY_ID',
          message: `Duplicate model registry ID '${m.id}' found.`
        });
      }
      idsSeen.add(m.id);

      // 2. Check provider
      if (m.provider !== 'google' && m.provider !== 'openrouter') {
        issues.push({
          modelId: m.id,
          type: 'ERROR',
          code: 'INVALID_PROVIDER',
          message: `Invalid provider '${m.provider}'. Must be 'google' or 'openrouter'.`
        });
      }

      // 3. Check apiModelId
      const apiId = m.apiModelId || m.id;
      if (!apiId || apiId.trim().length === 0) {
        issues.push({
          modelId: m.id,
          type: 'ERROR',
          code: 'MISSING_API_MODEL_ID',
          message: `Model '${m.id}' has missing or empty apiModelId.`
        });
      }

      // 4. Check alias rules
      if (m.isAlias) {
        if (!m.aliasReason) {
          issues.push({
            modelId: m.id,
            type: 'WARNING',
            code: 'MISSING_ALIAS_REASON',
            message: `Administrator alias '${m.id}' is missing documentation aliasReason.`
          });
        }
        if (!m.targetModelId) {
          issues.push({
            modelId: m.id,
            type: 'ERROR',
            code: 'MISSING_ALIAS_TARGET',
            message: `Administrator alias '${m.id}' is missing targetModelId.`
          });
        }
      }

      // 5. Check metadata correctness
      if (m.contextWindow <= 0) {
        issues.push({
          modelId: m.id,
          type: 'ERROR',
          code: 'INVALID_CONTEXT_WINDOW',
          message: `Context window must be > 0 for model '${m.id}'.`
        });
      }
      if (typeof m.supportsStreaming !== 'boolean') {
        issues.push({
          modelId: m.id,
          type: 'ERROR',
          code: 'INVALID_STREAMING_FLAG',
          message: `Streaming metadata must be boolean for model '${m.id}'.`
        });
      }
    }

    const errorsCount = issues.filter(i => i.type === 'ERROR').length;
    const warningsCount = issues.filter(i => i.type === 'WARNING').length;

    return {
      timestamp: new Date().toISOString(),
      isValid: errorsCount === 0,
      totalModels: this.DEFAULT_MODELS.length,
      enabledModels,
      disabledModels,
      verifiedApiModels,
      adminAliasModels,
      unverifiedDisabledModels,
      errorsCount,
      warningsCount,
      issues
    };
  }

  public static applyProviderPricingCatalog(openRouterCatalogModels: any[]): void {
    const catalogArray = Array.isArray(openRouterCatalogModels) ? openRouterCatalogModels : [];
    for (const m of this.DEFAULT_MODELS) {
      if (m.provider === 'google') {
        m.pricingSource = 'application_defined';
        continue;
      }
      if (m.provider === 'openrouter') {
        const freeCatalogModel = catalogArray.find((cm: any) =>
          cm.id === `${m.apiModelId || m.id}:free` || cm.id === `${m.id}:free`
        );
        const catalogModel = catalogArray.find((cm: any) => cm.id === (m.apiModelId || m.id) || cm.id === m.id) || freeCatalogModel;
        if (catalogModel && catalogModel.pricing) {
          const rawPrompt = String(catalogModel.pricing.prompt ?? '0');
          const rawCompletion = String(catalogModel.pricing.completion ?? '0');
          const promptCostPerToken = parseFloat(rawPrompt);
          const completionCostPerToken = parseFloat(rawCompletion);
          const inputCostPer1M = Number((!isNaN(promptCostPerToken) ? promptCostPerToken * 1000000 : 0).toFixed(6));
          const outputCostPer1M = Number((!isNaN(completionCostPerToken) ? completionCostPerToken * 1000000 : 0).toFixed(6));

          const isZeroCost = inputCostPer1M === 0 && outputCostPer1M === 0;
          const isDesignatedFree = m.id.includes(':free') || m.id === 'openrouter/free' || Boolean(m.apiModelId && m.apiModelId.includes(':free')) || Boolean(freeCatalogModel);
          const isFreeModel = isZeroCost || isDesignatedFree;

          if (freeCatalogModel && isFreeModel) {
            m.inputCostPer1M = 0;
            m.outputCostPer1M = 0;
            m.apiModelId = freeCatalogModel.id;
          } else {
            m.inputCostPer1M = inputCostPer1M;
            m.outputCostPer1M = outputCostPer1M;
            if (catalogModel) {
              m.apiModelId = catalogModel.id;
            }
          }

          m.isFree = isFreeModel;
          m.availabilityTier = isFreeModel ? 'Free' : 'Pay-as-you-go';
          m.pricingSource = 'provider_verified';
          m.verificationStatus = 'VERIFIED_API';
          m.unavailabilityReason = undefined;
          m.providerPricing = {
            prompt: rawPrompt,
            completion: rawCompletion
          };
        } else {
          if (!m.pricingSource) {
            m.pricingSource = 'application_defined';
          }
          if (m.inputCostPer1M === 0 && m.outputCostPer1M === 0) {
            m.isFree = true;
            m.availabilityTier = 'Free';
          }
          if (catalogArray.length > 0 && m.verificationStatus !== 'ADMIN_ALIAS') {
            m.verificationStatus = 'PENDING_VERIFICATION';
            m.unavailabilityReason = 'Awaiting live provider catalog confirmation';
          }
        }
      }
    }
  }

  public static async syncWithProviderCatalog(apiKeys: { google?: string; openrouter?: string }): Promise<{
    timestamp: string;
    google: { synchronized: boolean; status: string; modelsFound?: number; message: string };
    openrouter: { synchronized: boolean; status: string; modelsFound?: number; message: string };
  }> {
    const result: {
      timestamp: string;
      google: { synchronized: boolean; status: string; modelsFound?: number; message: string };
      openrouter: { synchronized: boolean; status: string; modelsFound?: number; message: string };
    } = {
      timestamp: new Date().toISOString(),
      google: { synchronized: false, status: 'NOT_SYNCHRONIZED', message: 'GEMINI_API_KEY binding not configured or offline runtime environment.' },
      openrouter: { synchronized: false, status: 'NOT_SYNCHRONIZED', message: 'OPENROUTER_API_KEY binding not configured or offline runtime environment.' }
    };

    for (const m of this.DEFAULT_MODELS) {
      if (m.provider === 'google') {
        m.pricingSource = 'application_defined';
      }
    }

    const g: any = typeof globalThis !== 'undefined' ? globalThis : {};
    const googleKey = (apiKeys.google || g.process?.env?.GEMINI_API_KEY || g.GEMINI_API_KEY || '').trim();
    const openRouterKey = (apiKeys.openrouter || g.process?.env?.OPENROUTER_API_KEY || g.OPENROUTER_API_KEY || '').trim();

    if (googleKey) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${googleKey}`);
        if (res.ok) {
          const data: any = await res.json();
          result.google = {
            synchronized: true,
            status: 'OPERATIONAL',
            modelsFound: data.models?.length || 0,
            message: `Successfully synchronized with Google AI catalog (${data.models?.length || 0} models verified).`
          };
        } else {
          const errBody = await res.text().catch(() => '');
          result.google.status = 'FAILURE';
          result.google.message = `Provider synchronization failed: HTTP ${res.status} ${res.statusText} - ${errBody}`;
        }
      } catch (err: any) {
        result.google.status = 'FAILURE';
        result.google.message = `Provider synchronization error: ${err.message || String(err)}`;
      }
    }

    if (openRouterKey) {
      try {
        const res = await fetch('https://openrouter.ai/api/v1/models', {
          headers: {
            'Authorization': `Bearer ${openRouterKey}`,
            'HTTP-Referer': 'https://business-os.cloud',
            'X-Title': 'BusinessOS'
          }
        });
        if (res.ok) {
          const data: any = await res.json();
          const catalogModels = Array.isArray(data.data) ? data.data : [];
          this.applyProviderPricingCatalog(catalogModels);
          result.openrouter = {
            synchronized: true,
            status: 'OPERATIONAL',
            modelsFound: catalogModels.length,
            message: `Successfully synchronized with OpenRouter model catalog (${catalogModels.length} models verified and authoritative pricing populated).`
          };
        } else {
          const errBody = await res.text().catch(() => '');
          result.openrouter.status = 'FAILURE';
          result.openrouter.message = `Provider synchronization failed: HTTP ${res.status} ${res.statusText} - ${errBody}`;
        }
      } catch (err: any) {
        result.openrouter.status = 'FAILURE';
        result.openrouter.message = `Provider synchronization error: ${err.message || String(err)}`;
      }
    }

    return result;
  }

  public static async executeCommentary(
    systemPrompt: string,
    userPrompt: string,
    preferredChoice: string | undefined,
    projectId: string,
    apiKey: string | Record<string, string>,
    userId: string,
    workspaceId = 'default',
    token?: string,
    sandboxConfig?: any
  ): Promise<any> {
    const targetSubsystem = sandboxConfig?.subsystem || 'Editorial Commentary';
    const { data, fallbackUsed, actualModel } = await this.execute(
      targetSubsystem,
      systemPrompt,
      userPrompt,
      preferredChoice,
      projectId,
      apiKey,
      userId,
      workspaceId,
      token,
      sandboxConfig
    );

    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || data.choices?.[0]?.message?.content;
    if (!rawText) throw new Error('Empty response content from AI model.');
    
    // Centralized Response Normalization Layer call
    const parsed = AIModelRegistry.normalizeAIResponse(rawText, targetSubsystem);

    // Ensure _metadata is injected securely
    parsed._metadata = parsed._metadata || {};
    parsed._metadata.fallbackModelUsed = fallbackUsed;
    parsed._metadata.requestedModel = preferredChoice || 'gemini-3.5-flash';
    parsed._metadata.actualModel = actualModel;
    if (fallbackUsed) {
      parsed._metadata.infoMessage = `Temporarily switched to ${actualModel} due to high demand on ${preferredChoice || 'gemini-3.5-flash'}.`;
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
      const provider = targetId === 'openrouter' ? 'openrouter' : 'google';
      const adapter = this.adapters[provider];
      const testModel = provider === 'openrouter' ? 'openai/gpt-4o-mini' : 'gemini-3.5-flash';
      try {
        await adapter.executePrompt(testModel, systemPrompt, userPrompt, apiKey, timeout);
        return { success: true, latency: Date.now() - startTime, message: `Provider ${provider} connection is fully active` };
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
  public static async getOperationalStats(projectId: string, token?: string, apiKeys?: { google?: string; openrouter?: string }): Promise<any> {
    const config = await this.getOrchestratorConfig(projectId, token);
    const forcedModel = config?.forcedModel || null;
    const modelOverrides = config?.modelOverrides || {};
    const maintenanceMode = config?.maintenanceMode || false;
    const retentionDays = config?.retentionDays || 30;

    const persistentCooldowns = await this.getPersistentCooldowns(projectId, token);
    const persistentStats = await this.getPersistentStats(projectId, token);
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

    let cachedPromptTokens = 0;
    let cachedCompletionTokens = 0;
    let cachedTotalTokens = 0;
    let latestNonCachedTime: string | null = null;

    const featureCost: Record<string, number> = {};
    const workspaceCost: Record<string, number> = {};
    const userCost: Record<string, number> = {};
    const featureByModel: Record<string, Record<string, { requests: number; tokens: number; cost: number }>> = {};
    const userMap: Record<string, { requests: number; tokens: number; cost: number; totalLatencyMs: number; failures: number; fallbacks: number; modelCounts: Record<string, number> }> = {};
    const modelTodayStats: Record<string, { requests: number; tokens: number; cost: number; retries: number; fallbacks: number }> = {};
    const dailyAnalyticsMap: Record<string, { date: string; cost: number; requests: number; tokens: number; latency: number; failures: number; fallbacks: number }> = {};
    const costByModel: Record<string, number> = {};

    interface RollingStats {
      requests: number;
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      latencySum: number;
      successCount: number;
    }

    const time1m = now - 60 * 1000;
    const time5m = now - 5 * 60 * 1000;
    const time1h = now - 60 * 60 * 1000;

    const createEmptyRolling = (): RollingStats => ({ requests: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, latencySum: 0, successCount: 0 });

    const globalRolling1m = createEmptyRolling();
    const globalRolling5m = createEmptyRolling();
    const globalRolling1h = createEmptyRolling();

    const modelRolling1m: Record<string, RollingStats> = {};
    const modelRolling5m: Record<string, RollingStats> = {};
    const modelRolling1h: Record<string, RollingStats> = {};

    const globalLatencies: number[] = [];
    const modelLatencies: Record<string, number[]> = {};

    const errorAnalytics: Record<string, { count: number; lastOccurrence: string }> = {
      '400': { count: 0, lastOccurrence: '' },
      '401': { count: 0, lastOccurrence: '' },
      '403': { count: 0, lastOccurrence: '' },
      '404': { count: 0, lastOccurrence: '' },
      '408': { count: 0, lastOccurrence: '' },
      '429': { count: 0, lastOccurrence: '' },
      '500': { count: 0, lastOccurrence: '' },
      '502': { count: 0, lastOccurrence: '' },
      '503': { count: 0, lastOccurrence: '' },
      'network': { count: 0, lastOccurrence: '' },
      'timeout': { count: 0, lastOccurrence: '' },
      'cancelled': { count: 0, lastOccurrence: '' },
      'authentication': { count: 0, lastOccurrence: '' },
      'unknown': { count: 0, lastOccurrence: '' }
    };

    const fallbackEvents: any[] = [];
    const fallbackPathCounts: Record<string, number> = {};
    const overloadedModels: Record<string, number> = {};
    let fallbackRetriesSucceeded = 0;
    let fallbackRetriesTotal = 0;

    const modelReliability: Record<string, { success: number; failure: number; retries: number; failovers: number; code429: number; code500: number; code503: number; consecutiveFailures: number }> = {};

    for (const record of telemetry) {
      const recTime = new Date(record.timestamp).getTime();
      const isToday = recTime >= startOfToday;
      const modelId = record.selectedModel || 'gemini-3.5-flash';

      totalRequests30d++;

      if (isToday) {
        requestsToday++;
        tokensToday += (record.totalTokens || 0);
        promptTokensToday += (record.promptTokens || 0);
        completionTokensToday += (record.completionTokens || 0);
        costToday += (record.estimatedCost || 0);
        if (record.cachedResponse) {
          cachedResponses++;
          cachedPromptTokens += (record.promptTokens || 0);
          cachedCompletionTokens += (record.completionTokens || 0);
          cachedTotalTokens += (record.totalTokens || 0);
        } else {
          if (!latestNonCachedTime || new Date(record.timestamp).getTime() > new Date(latestNonCachedTime).getTime()) {
            latestNonCachedTime = record.timestamp;
          }
        }
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

      costByModel[modelId] = (costByModel[modelId] || 0) + (record.estimatedCost || 0);

      if (!featureByModel[modelId]) featureByModel[modelId] = {};
      if (!featureByModel[modelId][feat]) featureByModel[modelId][feat] = { requests: 0, tokens: 0, cost: 0 };
      featureByModel[modelId][feat].requests++;
      featureByModel[modelId][feat].tokens += (record.totalTokens || 0);
      featureByModel[modelId][feat].cost += (record.estimatedCost || 0);

      if (!userMap[usr]) userMap[usr] = { requests: 0, tokens: 0, cost: 0, totalLatencyMs: 0, failures: 0, fallbacks: 0, modelCounts: {} };
      userMap[usr].requests++;
      userMap[usr].tokens += (record.totalTokens || 0);
      userMap[usr].cost += (record.estimatedCost || 0);
      userMap[usr].totalLatencyMs += (record.latency || 0);
      if (!record.success) userMap[usr].failures++;
      if (record.fallbackModel && record.fallbackModel !== '') userMap[usr].fallbacks++;
      userMap[usr].modelCounts[modelId] = (userMap[usr].modelCounts[modelId] || 0) + 1;

      if (isToday) {
        if (!modelTodayStats[modelId]) modelTodayStats[modelId] = { requests: 0, tokens: 0, cost: 0, retries: 0, fallbacks: 0 };
        modelTodayStats[modelId].requests++;
        modelTodayStats[modelId].tokens += (record.totalTokens || 0);
        modelTodayStats[modelId].cost += (record.estimatedCost || 0);
        modelTodayStats[modelId].retries += (record.retryCount || 0);
        if (record.fallbackModel && record.fallbackModel !== '') modelTodayStats[modelId].fallbacks++;
      }

      const dateStr = (record.timestamp || new Date().toISOString()).split('T')[0];
      if (!dailyAnalyticsMap[dateStr]) {
        dailyAnalyticsMap[dateStr] = { date: dateStr, cost: 0, requests: 0, tokens: 0, latency: 0, failures: 0, fallbacks: 0 };
      }
      const d = dailyAnalyticsMap[dateStr];
      d.requests++;
      d.cost += (record.estimatedCost || 0);
      d.tokens += (record.totalTokens || 0);
      d.latency += (record.latency || 0);
      if (!record.success) d.failures++;
      if (record.fallbackModel && record.fallbackModel !== '') d.fallbacks++;

      // Metric correctness & latency calculations
      if (record.success && record.latency) {
        globalLatencies.push(record.latency);
        if (!modelLatencies[modelId]) modelLatencies[modelId] = [];
        modelLatencies[modelId].push(record.latency);
      }

      if (!modelRolling1m[modelId]) modelRolling1m[modelId] = createEmptyRolling();
      if (!modelRolling5m[modelId]) modelRolling5m[modelId] = createEmptyRolling();
      if (!modelRolling1h[modelId]) modelRolling1h[modelId] = createEmptyRolling();
      if (!modelReliability[modelId]) modelReliability[modelId] = { success: 0, failure: 0, retries: 0, failovers: 0, code429: 0, code500: 0, code503: 0, consecutiveFailures: 0 };

      if (record.success) {
        modelReliability[modelId].success++;
        modelReliability[modelId].consecutiveFailures = 0;
      } else {
        modelReliability[modelId].failure++;
        modelReliability[modelId].consecutiveFailures++;

        let errorClass = 'unknown';
        const errLower = (record.errorClassification || record.lastFailureReason || '').toLowerCase();
        if (errLower.includes('400')) { errorClass = '400'; modelReliability[modelId].code500++; }
        else if (errLower.includes('401')) errorClass = '401';
        else if (errLower.includes('403')) errorClass = '403';
        else if (errLower.includes('404')) errorClass = '404';
        else if (errLower.includes('408') || errLower.includes('timeout')) errorClass = '408';
        else if (errLower.includes('429') || errLower.includes('rate limit')) { errorClass = '429'; modelReliability[modelId].code429++; }
        else if (errLower.includes('500')) { errorClass = '500'; modelReliability[modelId].code500++; }
        else if (errLower.includes('502')) errorClass = '502';
        else if (errLower.includes('503') || errLower.includes('unavailable')) { errorClass = '503'; modelReliability[modelId].code503++; }
        else if (errLower.includes('network') || errLower.includes('connection')) errorClass = 'network';
        else if (errLower.includes('cancel')) errorClass = 'cancelled';
        else if (errLower.includes('auth')) errorClass = 'authentication';

        if (errorAnalytics[errorClass]) {
          errorAnalytics[errorClass].count++;
          if (!errorAnalytics[errorClass].lastOccurrence || recTime > new Date(errorAnalytics[errorClass].lastOccurrence).getTime()) {
            errorAnalytics[errorClass].lastOccurrence = record.timestamp;
          }
        }
      }

      modelReliability[modelId].retries += (record.retryCount || 0);
      if (record.fallbackModel && record.fallbackModel !== '') {
        modelReliability[modelId].failovers++;
      }

      if (recTime >= time1m) {
        globalRolling1m.requests++;
        globalRolling1m.promptTokens += (record.promptTokens || 0);
        globalRolling1m.completionTokens += (record.completionTokens || 0);
        globalRolling1m.totalTokens += (record.totalTokens || 0);
        if (record.success) {
          globalRolling1m.latencySum += (record.latency || 0);
          globalRolling1m.successCount++;
        }
        const m1 = modelRolling1m[modelId];
        m1.requests++;
        m1.promptTokens += (record.promptTokens || 0);
        m1.completionTokens += (record.completionTokens || 0);
        m1.totalTokens += (record.totalTokens || 0);
        if (record.success) {
          m1.latencySum += (record.latency || 0);
          m1.successCount++;
        }
      }

      if (recTime >= time5m) {
        globalRolling5m.requests++;
        globalRolling5m.promptTokens += (record.promptTokens || 0);
        globalRolling5m.completionTokens += (record.completionTokens || 0);
        globalRolling5m.totalTokens += (record.totalTokens || 0);
        if (record.success) {
          globalRolling5m.latencySum += (record.latency || 0);
          globalRolling5m.successCount++;
        }
        const m5 = modelRolling5m[modelId];
        m5.requests++;
        m5.promptTokens += (record.promptTokens || 0);
        m5.completionTokens += (record.completionTokens || 0);
        m5.totalTokens += (record.totalTokens || 0);
        if (record.success) {
          m5.latencySum += (record.latency || 0);
          m5.successCount++;
        }
      }

      if (recTime >= time1h) {
        globalRolling1h.requests++;
        globalRolling1h.promptTokens += (record.promptTokens || 0);
        globalRolling1h.completionTokens += (record.completionTokens || 0);
        globalRolling1h.totalTokens += (record.totalTokens || 0);
        if (record.success) {
          globalRolling1h.latencySum += (record.latency || 0);
          globalRolling1h.successCount++;
        }
        const m1h = modelRolling1h[modelId];
        m1h.requests++;
        m1h.promptTokens += (record.promptTokens || 0);
        m1h.completionTokens += (record.completionTokens || 0);
        m1h.totalTokens += (record.totalTokens || 0);
        if (record.success) {
          m1h.latencySum += (record.latency || 0);
          m1h.successCount++;
        }
      }

      if (record.fallbackModel && record.fallbackModel !== '') {
        const path = `${modelId} -> ${record.fallbackModel}`;
        fallbackPathCounts[path] = (fallbackPathCounts[path] || 0) + 1;
        overloadedModels[modelId] = (overloadedModels[modelId] || 0) + 1;

        fallbackEvents.push({
          originalModel: modelId,
          fallbackModel: record.fallbackModel,
          triggerReason: record.errorClassification || 'Rate Limited / Timeout',
          retryCount: record.retryCount || 0,
          recoveryTime: record.latency || 0,
          user: record.user || 'Unknown',
          feature: record.feature || 'Unknown',
          workspace: record.workspace || 'Unknown',
          timestamp: record.timestamp
        });

        fallbackRetriesTotal++;
        if (record.success) {
          fallbackRetriesSucceeded++;
        }
      }
    }

    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const res = await firestoreFetch(projectId, `aiTelemetrySummary/${todayStr}`, token);
      if (res.ok) {
        const raw = await res.json() as any;
        const sum = fromFirestoreDoc(raw);
        if (sum && typeof sum.requests === 'number' && sum.requests > requestsToday) {
          requestsToday = sum.requests;
          tokensToday = sum.tokens || 0;
          promptTokensToday = sum.promptTokens || 0;
          completionTokensToday = sum.completionTokens || 0;
          costToday = sum.cost || 0;
          cachedResponses = sum.cachedResponses || 0;
          if (sum.totalLatencyMs) totalLatencyMs = sum.totalLatencyMs;
          if (sum.retries) totalRetries = sum.retries;
          if (sum.failovers) totalFailovers = sum.failovers;
          if (sum.successes) successCount = sum.successes;
          if (sum.featureCost) Object.assign(featureCost, sum.featureCost);
          if (sum.workspaceCost) Object.assign(workspaceCost, sum.workspaceCost);
          if (sum.userCost) Object.assign(userCost, sum.userCost);
        }
      }
    } catch (err) {
      console.warn('[AIOrchestrator] Summary fetch failed in getOperationalStats:', err);
    }

    const calculatePercentiles = (arr: number[]) => {
      if (arr.length === 0) return { p50: 0, p95: 0, p99: 0 };
      const sorted = [...arr].sort((a, b) => a - b);
      return {
        p50: sorted[Math.floor(sorted.length * 0.50)] || 0,
        p95: sorted[Math.floor(sorted.length * 0.95)] || 0,
        p99: sorted[Math.floor(sorted.length * 0.99)] || 0
      };
    };

    const cacheHitRate = requestsToday > 0 ? Math.round((cachedResponses / requestsToday) * 100) : 0;
    const avgNonCachedCost = (requestsToday - cachedResponses) > 0
      ? costToday / (requestsToday - cachedResponses)
      : 0;
    const estimatedCostSavings = cachedResponses * avgNonCachedCost;

    const totalRequests = telemetry.length;
    const overallSuccessRate = totalRequests > 0 ? (successCount / totalRequests) * 100 : 100;
    const avgLatency = successCount > 0 ? totalLatencyMs / successCount : 0;

    const localGoogleProv = providerLocalStats.get('google') || { requests: 0, success: 0, failure: 0, totalLatencyMs: 0 };
    const persistGoogleProv = persistentStats.providers['google'] || { requests: 0, success: 0, failure: 0, totalLatencyMs: 0 };
    const googleProvStats = {
      requests: localGoogleProv.requests + persistGoogleProv.requests,
      success: localGoogleProv.success + persistGoogleProv.success,
      failure: localGoogleProv.failure + persistGoogleProv.failure,
      totalLatencyMs: localGoogleProv.totalLatencyMs + persistGoogleProv.totalLatencyMs
    };

    const googleSuccessRate = googleProvStats.requests > 0 ? (googleProvStats.success / googleProvStats.requests) * 100 : 100;
    const googleLatency = googleProvStats.success > 0 ? googleProvStats.totalLatencyMs / googleProvStats.success : 0;

    const providerStatus = {
      id: 'google',
      displayName: 'Google AI Studio',
      health: googleSuccessRate > 90 ? 'operational' : 'degraded',
      successRate: Math.round(googleSuccessRate),
      averageLatencyMs: Math.round(googleLatency)
    };

    const models = this.DEFAULT_MODELS.map(m => {
      const override = modelOverrides[m.id];
      const localStats = modelLocalStats.get(m.id) || { requests: 0, success: 0, failure: 0, totalLatencyMs: 0, lastSuccess: '', lastFailure: '', lastFailureReason: '' };
      const persistStats = persistentStats.models[m.id] || { requests: 0, success: 0, failure: 0, totalLatencyMs: 0, lastSuccess: '', lastFailure: '', lastFailureReason: '' };
      const stats = {
        requests: localStats.requests + persistStats.requests,
        success: localStats.success + persistStats.success,
        failure: localStats.failure + persistStats.failure,
        totalLatencyMs: localStats.totalLatencyMs + persistStats.totalLatencyMs,
        lastSuccess: localStats.lastSuccess || persistStats.lastSuccess || '',
        lastFailure: localStats.lastFailure || persistStats.lastFailure || '',
        lastFailureReason: localStats.lastFailureReason || persistStats.lastFailureReason || ''
      };
      const cd = persistentCooldowns[m.id] || 0;
      const cooldownRemaining = Math.max(0, cd - now);

      const successRate = stats.requests > 0 ? (stats.success / stats.requests) * 100 : 100;
      const avgModelLatency = stats.success > 0 ? stats.totalLatencyMs / stats.requests : 0;

      const today = modelTodayStats[m.id] || { requests: 0, tokens: 0, cost: 0, retries: 0, fallbacks: 0 };
      const quotaRemaining = Math.max(0, (m.rpdLimit ?? 0) - today.requests);

      const latencies = modelLatencies[m.id] || [];
      const percentiles = calculatePercentiles(latencies);

      const r1m = modelRolling1m[m.id] || createEmptyRolling();
      const r5m = modelRolling5m[m.id] || createEmptyRolling();
      const r1h = modelRolling1h[m.id] || createEmptyRolling();

      const rel = modelReliability[m.id] || { success: 0, failure: 0, retries: 0, failovers: 0, code429: 0, code500: 0, code503: 0, consecutiveFailures: 0 };

      let currentHealth = 'Healthy';
      if (cooldownRemaining > 0) {
        currentHealth = `Cooldown (${Math.ceil(cooldownRemaining / 1000)}s)`;
      } else if (cd > 0 && (now - cd < 300000)) {
        currentHealth = 'Canary Recovery';
      } else if (stats.requests > 0 && successRate < 80) {
        currentHealth = 'Disabled';
      } else if (successRate < 95 && stats.requests > 0) {
        currentHealth = 'Warning';
      }

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
          lastFailureReason: stats.lastFailureReason || '',
          todayRequests: today.requests,
          todayTokens: today.tokens,
          todayCost: today.cost,
          retriesCount: today.retries,
          fallbackCount: today.fallbacks,
          cooldownCount: cooldownRemaining > 0 ? 1 : 0,
          rpmLimit: m.rpmLimit,
          tpmLimit: m.tpmLimit,
          rpdLimit: m.rpdLimit,
          quotaRemaining,
          quotaReset: 'Midnight UTC',
          currentHealth,
          rolling: {
            current1m: {
              requests: r1m.requests,
              promptTokens: r1m.promptTokens,
              completionTokens: r1m.completionTokens,
              totalTokens: r1m.totalTokens,
              avgLatencyMs: r1m.successCount > 0 ? Math.round(r1m.latencySum / r1m.successCount) : 0
            },
            rolling5m: {
              requests: r5m.requests,
              totalTokens: r5m.totalTokens,
              avgLatencyMs: r5m.successCount > 0 ? Math.round(r5m.latencySum / r5m.successCount) : 0
            },
            rolling1h: {
              requests: r1h.requests,
              totalTokens: r1h.totalTokens,
              avgLatencyMs: r1h.successCount > 0 ? Math.round(r1h.latencySum / r1h.successCount) : 0
            }
          },
          percentiles,
          reliability: {
            consecutiveFailures: rel.consecutiveFailures,
            code429: rel.code429,
            code500: rel.code500,
            code503: rel.code503,
            failovers: rel.failovers
          }
        }
      };
    });

    const userBreakdown = Object.entries(userMap).map(([u, d]) => {
      let favModel = 'None';
      let maxC = -1;
      for (const [mid, cnt] of Object.entries(d.modelCounts)) {
        if (cnt > maxC) {
          maxC = cnt;
          favModel = mid;
        }
      }
      return {
        user: u,
        requests: d.requests,
        tokens: d.tokens,
        cost: d.cost,
        avgLatencyMs: d.requests > 0 ? Math.round(d.totalLatencyMs / d.requests) : 0,
        failures: d.failures,
        fallbacks: d.fallbacks,
        favouriteModel: favModel
      };
    });

    const dailyAnalytics = Object.values(dailyAnalyticsMap)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({
        ...d,
        avgLatencyMs: d.requests > 0 ? Math.round(d.latency / d.requests) : 0
      }));

    const costAnalytics = {
      today: costToday,
      thisWeek: dailyAnalytics.slice(-7).reduce((acc, d) => acc + d.cost, 0),
      thisMonth: dailyAnalytics.slice(-30).reduce((acc, d) => acc + d.cost, 0),
      projectedMonth: (costToday > 0 ? costToday * 30 : dailyAnalytics.reduce((acc, d) => acc + d.cost, 0)),
      projectedYear: (costToday > 0 ? costToday * 365 : dailyAnalytics.reduce((acc, d) => acc + d.cost, 0) * 12),
      byModel: costByModel,
      byDay: dailyAnalytics
    };

    const requestsPerMinute = requestsToday / 1440;
    const tokensPerMinute = tokensToday / 1440;
    const dailyQuotaLimit: number = config?.dailyQuotaLimit || 1500;

    let telemetryAlert: any = null;
    try {
      const alertRes = await firestoreFetch(projectId, 'system/telemetryAlerts', token);
      if (alertRes.ok) {
        const rawAlert = await alertRes.json() as any;
        telemetryAlert = fromFirestoreDoc(rawAlert);
      }
    } catch (e) {
      // Ignore if not present
    }

    let telemetryDiagnostics: any = null;
    try {
      const diagRes = await firestoreFetch(projectId, 'system/telemetryDiagnostics', token);
      if (diagRes.ok) {
        const rawDiag = await diagRes.json() as any;
        telemetryDiagnostics = fromFirestoreDoc(rawDiag);
      }
    } catch (e) {
      // Ignore if not present
    }

    const elapsedMinutes = Math.max(1, (new Date().getHours() * 60 + new Date().getMinutes()));
    const bosRpm = Math.round((requestsToday / elapsedMinutes) * 100) / 100;
    const bosTpm = Math.round(tokensToday / elapsedMinutes);
    const officialRequests = Math.max(0, requestsToday - cachedResponses);
    const officialPromptTokens = Math.max(0, promptTokensToday - cachedPromptTokens);
    const officialCompletionTokens = Math.max(0, completionTokensToday - cachedCompletionTokens);
    const officialTotalTokens = Math.max(0, tokensToday - cachedTotalTokens);


    const deltaRequests = requestsToday - officialRequests;
    const deltaPrompt = promptTokensToday - officialPromptTokens;
    const deltaCompletion = completionTokensToday - officialCompletionTokens;
    const deltaTotal = tokensToday - officialTotalTokens;

    let googleReq = 0, googlePrompt = 0, googleComp = 0, googleTot = 0;
    let orReq = 0, orPrompt = 0, orComp = 0, orTot = 0;
    for (const record of telemetry) {
      if (record.cacheHit) continue;
      const recProv = record.provider || (record.selectedModel && record.selectedModel.startsWith('openrouter/') ? 'openrouter' : 'google');
      if (recProv === 'openrouter') {
        orReq++;
        orPrompt += (record.promptTokens || 0);
        orComp += (record.completionTokens || 0);
        orTot += (record.totalTokens || 0);
      } else {
        googleReq++;
        googlePrompt += (record.promptTokens || 0);
        googleComp += (record.completionTokens || 0);
        googleTot += (record.totalTokens || 0);
      }
    }

    if (!this.DEFAULT_MODELS.some(m => m.pricingSource === 'provider_verified')) {
      await this.syncWithProviderCatalog(apiKeys || {}).catch(() => {});
    }

    const googleModelsList = this.DEFAULT_MODELS.filter(m => m.provider === 'google');
    const orModelsList = this.DEFAULT_MODELS.filter(m => m.provider === 'openrouter');

    const providerComparison = {
      google: {
        rpm: Math.round((googleReq / elapsedMinutes) * 100) / 100,
        tpm: Math.round(googleTot / elapsedMinutes),
        rpd: googleReq,
        promptTokens: googlePrompt,
        completionTokens: googleComp,
        totalTokens: googleTot,
        requests: googleReq,
        quotaRemaining: Math.max(0, 1500 - googleReq),
        lastUpdated: latestNonCachedTime || new Date().toISOString(),
        providerStatus: 'Operational',
        providerHealth: 'Healthy',
        apiKeyStatus: 'Configured & Verified',
        availableModelsCount: googleModelsList.length,
        enabledModelsCount: googleModelsList.filter(m => m.enabled).length,
        freeModelsCount: googleModelsList.filter(m => m.isFree || (m.inputCostPer1M === 0 && m.outputCostPer1M === 0)).length,
        paidModelsCount: googleModelsList.filter(m => !m.isFree && (m.inputCostPer1M > 0 || m.outputCostPer1M > 0)).length
      },
      openrouter: {
        rpm: Math.round((orReq / elapsedMinutes) * 100) / 100,
        tpm: Math.round(orTot / elapsedMinutes),
        rpd: orReq,
        promptTokens: orPrompt,
        completionTokens: orComp,
        totalTokens: orTot,
        requests: orReq,
        quotaRemaining: Math.max(0, 100000 - orReq),
        lastUpdated: latestNonCachedTime || new Date().toISOString(),
        providerStatus: 'Operational',
        providerHealth: 'Healthy',
        apiKeyStatus: 'Configured & Verified',
        availableModelsCount: orModelsList.length,
        enabledModelsCount: orModelsList.filter(m => m.enabled).length,
        freeModelsCount: orModelsList.filter(m => m.isFree || (m.inputCostPer1M === 0 && m.outputCostPer1M === 0)).length,
        paidModelsCount: orModelsList.filter(m => !m.isFree && (m.inputCostPer1M > 0 || m.outputCostPer1M > 0)).length
      },
      businessos: {
        rpm: bosRpm,
        tpm: bosTpm,
        rpd: requestsToday,
        promptTokens: promptTokensToday,
        completionTokens: completionTokensToday,
        totalTokens: tokensToday,
        requests: requestsToday,
        estimatedCost: costToday,
        cacheHits: cachedResponses,
        cacheSavings: estimatedCostSavings,
        lastUpdated: new Date().toISOString()
      },
      differences: {
        requests: {
          delta: deltaRequests,
          reason: deltaRequests === cachedResponses
            ? `${cachedResponses} responses served from semantic cache.`
            : 'Telemetry mismatch'
        },
        promptTokens: {
          delta: deltaPrompt,
          reason: deltaPrompt === cachedPromptTokens
            ? `${cachedPromptTokens} prompt tokens saved via semantic cache.`
            : 'Telemetry mismatch'
        },
        completionTokens: {
          delta: deltaCompletion,
          reason: deltaCompletion === cachedCompletionTokens
            ? `${cachedCompletionTokens} completion tokens saved via semantic cache.`
            : 'Telemetry mismatch'
        },
        totalTokens: {
          delta: deltaTotal,
          reason: deltaTotal === cachedTotalTokens
            ? `${cachedTotalTokens} total tokens saved via semantic cache.`
            : 'Telemetry mismatch'
        }
      }
    };

    // Advanced Observability v3 Aggregations
    let healthScore = 100;
    healthScore -= (100 - overallSuccessRate) * 1.5;
    if (avgLatency > 1500) healthScore -= 10;
    else if (avgLatency > 800) healthScore -= 5;
    healthScore -= totalFailovers * 2;
    healthScore -= totalRetries * 0.5;
    if (telemetryAlert) healthScore -= 20;

    healthScore = Math.max(0, Math.min(100, Math.round(healthScore)));
    let healthStatus = 'Excellent';
    if (healthScore < 50) healthStatus = 'Critical';
    else if (healthScore < 75) healthStatus = 'Warning';
    else if (healthScore < 90) healthStatus = 'Healthy';

    const healthScoreObj = {
      score: healthScore,
      status: healthStatus
    };

    const dailyQuotaExhaustionHours = requestsToday > 0 
      ? (Math.max(0, dailyQuotaLimit - requestsToday) / (requestsToday / Math.max(1, elapsedMinutes / 60)))
      : 24;
    const dailyQuotaRisk = dailyQuotaExhaustionHours < 6 ? 'High Risk' : dailyQuotaExhaustionHours < 18 ? 'Medium Risk' : 'Low Risk';

    const monthlyBudgetExhaustionDays = costToday > 0
      ? (Math.max(0, 100 - costToday) / (costToday / Math.max(1, elapsedMinutes / 1440)))
      : 30;
    const monthlyBudgetRisk = monthlyBudgetExhaustionDays < 5 ? 'High Risk' : monthlyBudgetExhaustionDays < 15 ? 'Medium Risk' : 'Low Risk';

    const forecasting = {
      dailyExhaustionHours: isFinite(dailyQuotaExhaustionHours) ? Math.round(dailyQuotaExhaustionHours * 10) / 10 : 24,
      dailyQuotaRisk,
      monthlyExhaustionDays: isFinite(monthlyBudgetExhaustionDays) ? Math.round(monthlyBudgetExhaustionDays * 10) / 10 : 30,
      monthlyBudgetRisk
    };

    const fallbackAnalytics = {
      events: fallbackEvents.slice(-50),
      overloadedModels,
      fallbackPaths: Object.entries(fallbackPathCounts).map(([path, count]) => ({ path, count })),
      retrySuccessRate: fallbackRetriesTotal > 0 ? Math.round((fallbackRetriesSucceeded / fallbackRetriesTotal) * 100) : 100,
      recoveryRate: fallbackRetriesTotal > 0 ? Math.round((fallbackRetriesSucceeded / fallbackRetriesTotal) * 100) : 100
    };

    const errorAnalyticsSummary = Object.entries(errorAnalytics).map(([code, data]) => {
      const percentage = (successCount + data.count) > 0 ? Math.round((data.count / (successCount + data.count)) * 100) : 0;
      return {
        code,
        count: data.count,
        percentage,
        lastOccurrence: data.lastOccurrence
      };
    });

    const trend1h: any[] = [];
    const trend24h: any[] = [];
    const trend7d: any[] = [];
    const trend30d: any[] = [];
    const trend90d: any[] = [];

    trend7d.push(...dailyAnalytics.slice(-7));
    trend30d.push(...dailyAnalytics.slice(-30));
    trend90d.push(...dailyAnalytics.slice(-90));

    const hourMap: Record<string, { label: string; requests: number; tokens: number; cost: number; latencySum: number; successCount: number; failovers: number }> = {};
    for (let i = 23; i >= 0; i--) {
      const hTime = now - i * 60 * 60 * 1000;
      const hDate = new Date(hTime);
      const key = `${hDate.getFullYear()}-${hDate.getMonth()+1}-${hDate.getDate()} H${hDate.getHours()}`;
      hourMap[key] = {
        label: `${hDate.getHours()}:00`,
        requests: 0,
        tokens: 0,
        cost: 0,
        latencySum: 0,
        successCount: 0,
        failovers: 0
      };
    }
    for (const record of telemetry) {
      const recTime = new Date(record.timestamp).getTime();
      if (recTime >= now - 24 * 60 * 60 * 1000) {
        const hDate = new Date(recTime);
        const key = `${hDate.getFullYear()}-${hDate.getMonth()+1}-${hDate.getDate()} H${hDate.getHours()}`;
        if (hourMap[key]) {
          hourMap[key].requests++;
          hourMap[key].tokens += (record.totalTokens || 0);
          hourMap[key].cost += (record.estimatedCost || 0);
          hourMap[key].failovers += (record.fallbackModel && record.fallbackModel !== '' ? 1 : 0);
          if (record.success) {
            hourMap[key].latencySum += (record.latency || 0);
            hourMap[key].successCount++;
          }
        }
      }
    }
    trend24h.push(...Object.values(hourMap).map(h => ({
      date: h.label,
      requests: h.requests,
      tokens: h.tokens,
      cost: h.cost,
      avgLatencyMs: h.successCount > 0 ? Math.round(h.latencySum / h.successCount) : 0,
      failovers: h.failovers,
      successRate: h.requests > 0 ? Math.round((h.successCount / h.requests) * 100) : 100
    })));

    const minMap: Record<string, { label: string; requests: number; tokens: number; cost: number; latencySum: number; successCount: number; failovers: number }> = {};
    for (let i = 11; i >= 0; i--) {
      const mTime = now - i * 5 * 60 * 1000;
      const mDate = new Date(mTime);
      const key = `${mDate.getFullYear()}-${mDate.getMonth()+1}-${mDate.getDate()} H${mDate.getHours()} M${Math.floor(mDate.getMinutes()/5)*5}`;
      minMap[key] = {
        label: `${mDate.getHours()}:${String(Math.floor(mDate.getMinutes()/5)*5).padStart(2, '0')}`,
        requests: 0,
        tokens: 0,
        cost: 0,
        latencySum: 0,
        successCount: 0,
        failovers: 0
      };
    }
    for (const record of telemetry) {
      const recTime = new Date(record.timestamp).getTime();
      if (recTime >= now - 60 * 60 * 1000) {
        const mDate = new Date(recTime);
        const key = `${mDate.getFullYear()}-${mDate.getMonth()+1}-${mDate.getDate()} H${mDate.getHours()} M${Math.floor(mDate.getMinutes()/5)*5}`;
        if (minMap[key]) {
          minMap[key].requests++;
          minMap[key].tokens += (record.totalTokens || 0);
          minMap[key].cost += (record.estimatedCost || 0);
          minMap[key].failovers += (record.fallbackModel && record.fallbackModel !== '' ? 1 : 0);
          if (record.success) {
            minMap[key].latencySum += (record.latency || 0);
            minMap[key].successCount++;
          }
        }
      }
    }
    trend1h.push(...Object.values(minMap).map(m => ({
      date: m.label,
      requests: m.requests,
      tokens: m.tokens,
      cost: m.cost,
      avgLatencyMs: m.successCount > 0 ? Math.round(m.latencySum / m.successCount) : 0,
      failovers: m.failovers,
      successRate: m.requests > 0 ? Math.round((m.successCount / m.requests) * 100) : 100
    })));

    const trends = {
      trend1h,
      trend24h,
      trend7d,
      trend30d,
      trend90d
    };

    const globalPercentiles = calculatePercentiles(globalLatencies);

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
        userCost,
        featureByModel,
        userBreakdown,
        costAnalytics,
        dailyAnalytics
      },
      quota: {
        requestsPerMinute: Math.round(requestsPerMinute * 10) / 10,
        tokensPerMinute: Math.round(tokensPerMinute),
        estimatedRemainingDailyRequests: Math.max(0, dailyQuotaLimit - requestsToday),
        quotaUtilisationPercentage: Math.round(Math.min(100, (requestsToday / dailyQuotaLimit) * 100)),
        source: 'businessos_estimate' as const
      },
      providerComparison,
      telemetryAlert,
      telemetryDiagnostics,
      healthScore: healthScoreObj,
      forecasting,
      fallbackAnalytics,
      errorAnalytics: errorAnalyticsSummary,
      trends,
      globalPercentiles,
      rolling: {
        current1m: {
          requests: globalRolling1m.requests,
          promptTokens: globalRolling1m.promptTokens,
          completionTokens: globalRolling1m.completionTokens,
          totalTokens: globalRolling1m.totalTokens,
          avgLatencyMs: globalRolling1m.successCount > 0 ? Math.round(globalRolling1m.latencySum / globalRolling1m.successCount) : 0
        },
        rolling5m: {
          requests: globalRolling5m.requests,
          totalTokens: globalRolling5m.totalTokens,
          avgLatencyMs: globalRolling5m.successCount > 0 ? Math.round(globalRolling5m.latencySum / globalRolling5m.successCount) : 0
        },
        rolling1h: {
          requests: globalRolling1h.requests,
          totalTokens: globalRolling1h.totalTokens,
          avgLatencyMs: globalRolling1h.successCount > 0 ? Math.round(globalRolling1h.latencySum / globalRolling1h.successCount) : 0
        }
      }
    };
  }

  public static async raiseTelemetryAlert(
    projectId: string, 
    metric: string, 
    errorDetails: string, 
    token?: string
  ): Promise<void> {
    try {
      const alertId = `alert_tel_${Date.now()}`;
      const alertDoc = {
        id: alertId,
        priority: 'high',
        category: 'system',
        title: 'Telemetry Pipeline Failure',
        message: `Expected telemetry write to succeed, but observed write failure. Expected: Telemetry Log. Observed: Write Blocked. Missing: ${metric}. Suspected Failure Point: Firestore Write Security Rules or Network Error. Details: ${errorDetails}`,
        timestamp: new Date().toISOString(),
        source: 'AI Orchestrator Telemetry Audit',
        read: false,
        expectedValue: 'Success (HTTP 200/201)',
        observedValue: 'Failure',
        missingMetric: metric,
        suspectedFailurePoint: 'Firestore REST Write',
        recommendedAction: 'Verify Bearer token validity and Firestore Security Rules for the aiTelemetry collection.'
      };

      const doc = { fields: {} as any };
      for (const [k, v] of Object.entries(alertDoc)) {
        doc.fields[k] = toFirestoreValue(v);
      }
      await firestoreFetch(projectId, 'system/telemetryAlerts', token, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(doc)
      });

      const auditId = `audit_${Date.now()}`;
      const auditDoc = {
        id: auditId,
        timestamp: new Date().toISOString(),
        action: 'TELEMETRY_PIPELINE_FAILURE',
        userId: 'system',
        details: JSON.stringify(alertDoc)
      };
      const auditDocFields = { fields: {} as any };
      for (const [k, v] of Object.entries(auditDoc)) {
        auditDocFields.fields[k] = toFirestoreValue(v);
      }
      await firestoreFetch(projectId, `auditLog/${auditId}`, token, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(auditDocFields)
      });
    } catch (e) {
      console.error('[AIOrchestrator] Failed to raise telemetry alert:', e);
    }
  }
}

function LogicalModelResolve(choice: string, subsystem: Subsystem, config?: any): string {
  const modelChoice = choice || 'Automatic';
  const activeConfig = config || AIOrchestrator.cacheConfig?.data;

  const getMapping = (sel: 'Latest Flash' | 'Latest Pro') => {
    if (activeConfig?.modelMapping?.[sel]) {
      return activeConfig.modelMapping[sel];
    }
    return subsystem === 'Daily Email' ? GEMINI_MODEL_MAPPING[sel] : OPENROUTER_MODEL_MAPPING[sel];
  };

  if (modelChoice === 'Automatic') {
    const automaticChoice = SUBSYSTEM_AUTOMATIC_MAPPING[subsystem] || 'Latest Flash';
    return getMapping(automaticChoice);
  }
  if (modelChoice === 'Latest Flash' || modelChoice === 'Latest Pro') {
    return getMapping(modelChoice as 'Latest Flash' | 'Latest Pro');
  }
  return getMapping('Latest Flash');
}

export class AIModelRegistry {
  public static getFeatureRequirements(subsystem: string): FeatureRequirement | undefined {
    return FEATURE_REQUIREMENTS[subsystem];
  }

  public static resolveModel(choice: string | undefined, subsystem: Subsystem, config?: any): string {
    const modelChoice = choice || 'Automatic';
    const activeConfig = config || AIOrchestrator.cacheConfig?.data;

    const getMapping = (sel: 'Latest Flash' | 'Latest Pro') => {
      if (activeConfig?.modelMapping?.[sel]) {
        return activeConfig.modelMapping[sel];
      }
      return subsystem === 'Daily Email' ? GEMINI_MODEL_MAPPING[sel] : OPENROUTER_MODEL_MAPPING[sel];
    };

    if (modelChoice === 'Automatic') {
      const automaticChoice = SUBSYSTEM_AUTOMATIC_MAPPING[subsystem];
      if (automaticChoice) {
        return getMapping(automaticChoice);
      }
      const featureReq = FEATURE_REQUIREMENTS[subsystem];
      const task = featureReq?.preferredTaskType || 'copilot_conversation';
      return AIOrchestrator.selectBestModelForTask(task, AIOrchestrator.DEFAULT_MODELS, activeConfig, subsystem);
    }

    if (modelChoice === 'Latest Flash' || modelChoice === 'Latest Pro') {
      return getMapping(modelChoice as 'Latest Flash' | 'Latest Pro');
    }

    if (typeof modelChoice === 'string' && (modelChoice.startsWith('gemini-') || modelChoice.includes('-') || modelChoice.includes('/'))) {
      return modelChoice;
    }

    return getMapping('Latest Flash');
  }

  public static tryRepairTruncatedJson(str: string): string {
    let openBrackets: string[] = [];
    let inString = false;
    let escape = false;

    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (char === '\\') {
        escape = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (inString) {
        continue;
      }
      if (char === '{' || char === '[') {
        openBrackets.push(char);
      } else if (char === '}') {
        if (openBrackets[openBrackets.length - 1] === '{') {
          openBrackets.pop();
        }
      } else if (char === ']') {
        if (openBrackets[openBrackets.length - 1] === '[') {
          openBrackets.pop();
        }
      }
    }

    let repaired = str;
    if (inString) {
      repaired += '"';
    }
    
    repaired = repaired.trim().replace(/,\s*$/, '');

    while (openBrackets.length > 0) {
      const last = openBrackets.pop();
      if (last === '{') {
        repaired += '}';
      } else if (last === '[') {
        repaired += ']';
      }
    }

    return repaired;
  }

  public static extractAndParseJson(text: string): any {
    const trimmed = text.trim();
    
    try {
      return JSON.parse(trimmed);
    } catch (e) {
      // Ignore and proceed
    }

    const fenceRegex = /```(?:json)?\s*([\s\S]*?)\s*```/g;
    let match;
    while ((match = fenceRegex.exec(trimmed)) !== null) {
      const content = match[1].trim();
      try {
        return JSON.parse(content);
      } catch (e) {
        try {
          return JSON.parse(this.tryRepairTruncatedJson(content));
        } catch (e2) {
          // Proceed
        }
      }
    }

    const startIdx = trimmed.indexOf('{');
    const endIdx = trimmed.lastIndexOf('}');
    if (startIdx !== -1) {
      const candidate = endIdx > startIdx ? trimmed.substring(startIdx, endIdx + 1) : trimmed.substring(startIdx);
      try {
        return JSON.parse(candidate);
      } catch (e) {
        try {
          return JSON.parse(this.tryRepairTruncatedJson(candidate));
        } catch (e2) {
          try {
            const repaired = candidate
              .replace(/'/g, '"')
              .replace(/,\s*([}\]])/g, '$1');
            return JSON.parse(repaired);
          } catch (e3) {
            try {
              const repaired = this.tryRepairTruncatedJson(candidate)
                .replace(/'/g, '"')
                .replace(/,\s*([}\]])/g, '$1');
              return JSON.parse(repaired);
            } catch (e4) {
              // Ignore
            }
          }
        }
      }
    }

    throw new Error("Failed to extract valid JSON from LLM response.");
  }

  public static detectFormat(text: string): string {
    const trimmed = text.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) return 'json';
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) return 'json';
    if (trimmed.includes('```')) return 'markdown_fenced';
    if (trimmed.startsWith('#') || trimmed.includes('\n#') || trimmed.includes('**')) return 'markdown';
    return 'text';
  }

  public static normalizeAIResponse(rawText: string, subsystem: string): any {
    const isCopilot = subsystem === 'Copilot';
    
    try {
      const parsed = this.extractAndParseJson(rawText);
      
      if (isCopilot) {
        return {
          response: parsed.response || rawText,
          metadata: parsed.metadata || { confidenceScore: 90, dataFreshness: 'Live' },
          rawResponse: parsed
        };
      }
      
      if (subsystem === 'Company Intelligence') {
        if ('moatRating' in parsed || 'moatRationale' in parsed || 'majorRisks' in parsed) {
          return {
            moatRating: parsed.moatRating || 'none',
            moatRationale: parsed.moatRationale || rawText,
            majorRisks: Array.isArray(parsed.majorRisks) ? parsed.majorRisks : [parsed.majorRisks || 'N/A'],
            rawResponse: parsed
          };
        }
        if ('catalyst' in parsed || 'isStructural' in parsed) {
          return {
            catalyst: parsed.catalyst || rawText,
            isStructural: typeof parsed.isStructural === 'boolean' ? parsed.isStructural : false,
            rawResponse: parsed
          };
        }
        return {
          ...parsed,
          moatRating: parsed.moatRating || 'none',
          moatRationale: parsed.moatRationale || rawText,
          majorRisks: Array.isArray(parsed.majorRisks) ? parsed.majorRisks : [],
          catalyst: parsed.catalyst || rawText,
          isStructural: typeof parsed.isStructural === 'boolean' ? parsed.isStructural : false,
          rawResponse: parsed
        };
      }

      if (subsystem === 'Daily Email') {
        return {
          executiveSummary: parsed.executiveSummary || rawText,
          portfolioCommentary: parsed.portfolioCommentary || 'N/A',
          riskCommentary: parsed.riskCommentary || 'N/A',
          opportunityCommentary: parsed.opportunityCommentary || 'N/A',
          marketContext: parsed.marketContext || 'N/A',
          rawResponse: parsed
        };
      }

      if (subsystem === 'Editorial Commentary') {
        return {
          executiveSummary: parsed.executiveSummary || rawText,
          portfolioCommentary: parsed.portfolioCommentary || 'No portfolio analysis available.',
          riskCommentary: parsed.riskCommentary || 'No risk assessment generated.',
          opportunityCommentary: parsed.opportunityCommentary || 'No opportunities scan analysis.',
          marketContext: parsed.marketContext || 'No global market contextualization.',
          rawResponse: parsed
        };
      }

      if (subsystem === 'Opportunities') {
        return {
          macroSummary: parsed.macroSummary || rawText,
          rawResponse: parsed
        };
      }

      if (subsystem === 'Reports') {
        return {
          executiveSummary: parsed.executiveSummary || rawText,
          financialMetricsAnalysis: parsed.financialMetricsAnalysis || 'N/A',
          risksAndMitigations: parsed.risksAndMitigations || 'N/A',
          rawResponse: parsed
        };
      }

      if (subsystem === 'Summaries') {
        return {
          summary: parsed.summary || rawText,
          rawResponse: parsed
        };
      }

      return parsed;
    } catch (err) {
      if (isCopilot) {
        return {
          response: rawText,
          metadata: { confidenceScore: 90, dataFreshness: 'Live' }
        };
      }

      if (subsystem === 'Company Intelligence') {
        return {
          moatRating: 'none',
          moatRationale: rawText,
          majorRisks: [],
          catalyst: rawText,
          isStructural: false
        };
      }

      if (subsystem === 'Daily Email') {
        return {
          executiveSummary: rawText,
          portfolioCommentary: 'N/A',
          riskCommentary: 'N/A',
          opportunityCommentary: 'N/A',
          marketContext: 'N/A'
        };
      }

      if (subsystem === 'Editorial Commentary') {
        return {
          executiveSummary: rawText,
          portfolioCommentary: 'No portfolio analysis available.',
          riskCommentary: 'No risk assessment generated.',
          opportunityCommentary: 'No opportunities scan analysis.',
          marketContext: 'No global market contextualization.'
        };
      }

      if (subsystem === 'Opportunities') {
        return {
          macroSummary: rawText
        };
      }

      if (subsystem === 'Reports') {
        return {
          executiveSummary: rawText,
          financialMetricsAnalysis: 'N/A',
          risksAndMitigations: 'N/A'
        };
      }

      if (subsystem === 'Summaries') {
        return {
          summary: rawText
        };
      }

      return {
        text: rawText,
        response: rawText
      };
    }
  }
}
