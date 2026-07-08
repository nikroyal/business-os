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
  | 'moderation'
  | 'vision'
  | 'benchmarking';

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
  provider: string; // 'google' | 'openrouter'
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
  ownerOnly?: boolean;
  isFree?: boolean;
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
    if (!apiKey) {
      throw new Error('OpenRouter API key is missing or not configured');
    }
    const cleanModelId = modelId.startsWith('openrouter/') ? modelId.substring(11) : modelId;
    const endpoint = 'https://openrouter.ai/api/v1/chat/completions';
    const payload = {
      model: cleanModelId,
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
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://businessos.ai',
          'X-Title': 'BusinessOS'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const text = await res.text();

      if (!res.ok) {
        throw new Error(`OpenRouter API returned HTTP ${res.status}: ${text}`);
      }

      const data = JSON.parse(text);
      const rawText = data.choices?.[0]?.message?.content;
      if (!rawText) throw new Error('Empty response from OpenRouter API');

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
    'google': new GoogleGeminiAdapter(),
    'openrouter': new OpenRouterAdapter()
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
      supportedTaskTypes: ['daily_email', 'copilot_conversation', 'market_summary']
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
      supportedTaskTypes: ['daily_email', 'deep_research', 'report_generation']
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
      supportedTaskTypes: ['daily_email', 'company_analysis']
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
      supportedTaskTypes: ['daily_email']
    },
    // ==========================================
    // OPENROUTER MODELS REGISTRY
    // ==========================================
    // --- General Reasoning / Chat / Long-Form ---
    {
      id: 'gpt-oss-120b',
      displayName: 'GPT-OSS 120B',
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
      supportedTaskTypes: ['copilot_conversation', 'deep_research', 'report_generation', 'long_writing', 'company_analysis', 'market_summary', 'benchmarking']
    },
    {
      id: 'qwen3-next-80b-a3b-instruct',
      displayName: 'Qwen3 Next 80B A3B Instruct',
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
      supportedTaskTypes: ['copilot_conversation', 'deep_research', 'report_generation', 'long_writing', 'company_analysis', 'benchmarking']
    },
    {
      id: 'llama-3.3-70b-instruct',
      displayName: 'Llama 3.3 70B Instruct',
      category: 'Pro',
      priority: 3,
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
      supportedTaskTypes: ['copilot_conversation', 'report_generation', 'market_summary', 'short_summarization', 'company_analysis', 'benchmarking']
    },
    {
      id: 'hermes-3-405b-instruct',
      displayName: 'Hermes 3 405B Instruct',
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
      supportedTaskTypes: ['deep_research', 'long_writing', 'report_generation', 'benchmarking']
    },
    {
      id: 'gemma-4-31b-a4b',
      displayName: 'Gemma 4 31B A4B',
      category: 'Pro',
      priority: 5,
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
      supportedTaskTypes: ['copilot_conversation', 'market_summary', 'short_summarization', 'benchmarking']
    },
    {
      id: 'gemma-4-26b-a4b',
      displayName: 'Gemma 4 26B A4B',
      category: 'Flash',
      priority: 6,
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
      supportedTaskTypes: ['market_summary', 'short_summarization', 'copilot_conversation', 'benchmarking']
    },
    {
      id: 'laguna-m.1',
      displayName: 'Laguna M.1',
      category: 'Pro',
      priority: 7,
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
      supportedTaskTypes: ['copilot_conversation', 'market_summary', 'benchmarking']
    },
    {
      id: 'laguna-xs-2.1',
      displayName: 'Laguna XS 2.1',
      category: 'Flash',
      priority: 8,
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
      supportedTaskTypes: ['short_summarization', 'market_summary', 'benchmarking']
    },
    {
      id: 'laguna-xs.2',
      displayName: 'Laguna XS.2',
      category: 'Flash',
      priority: 9,
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
      supportedTaskTypes: ['short_summarization', 'benchmarking']
    },
    {
      id: 'hy3',
      displayName: 'Hy3',
      category: 'Pro',
      priority: 10,
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
      supportedTaskTypes: ['copilot_conversation', 'company_analysis', 'benchmarking']
    },
    // --- Coding / Developer Assistance ---
    {
      id: 'north-mini-code-20260617',
      displayName: 'North Mini Code',
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
      supportedTaskTypes: ['coding', 'benchmarking']
    },
    {
      id: 'qwen3-coder-480b-a35b',
      displayName: 'Qwen3 Coder 480B A35B',
      category: 'Pro',
      priority: 2,
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
      supportedTaskTypes: ['coding', 'benchmarking']
    },
    {
      id: 'gpt-oss-20b',
      displayName: 'GPT-OSS 20B',
      category: 'Flash',
      priority: 3,
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
      supportedTaskTypes: ['coding', 'copilot_conversation', 'short_summarization', 'benchmarking']
    },
    {
      id: 'llama-3.2-3b-instruct',
      displayName: 'Llama 3.2 3B Instruct',
      category: 'Flash',
      priority: 4,
      capabilityScore: 84,
      reasoningScore: 80,
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
      supportedTaskTypes: ['short_summarization', 'coding', 'benchmarking']
    },
    // --- Multimodal / Vision / Retrieval Utilities ---
    {
      id: 'llama-nemotron-embed-vl-1b-v2-20260224',
      displayName: 'Llama Nemotron Embed VL 1B v2',
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
      supportedTaskTypes: ['retrieval', 'benchmarking']
    },
    {
      id: 'llama-nemotron-rerank-vl-1b-v2',
      displayName: 'Llama Nemotron Rerank VL 1B v2',
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
      supportedTaskTypes: ['retrieval', 'benchmarking']
    },
    {
      id: 'nemotron-nano-12b-v2-vl',
      displayName: 'Nemotron Nano 12B v2 VL',
      category: 'Flash',
      priority: 3,
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
      supportedTaskTypes: ['vision', 'benchmarking']
    },
    {
      id: 'nemotron-nano-9b-v2',
      displayName: 'Nemotron Nano 9B v2',
      category: 'Flash',
      priority: 4,
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
      supportsVision: true,
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
      supportedTaskTypes: ['vision', 'benchmarking']
    },
    {
      id: 'nemotron-3-nano-30b-a3b',
      displayName: 'Nemotron 3 Nano 30B A3B',
      category: 'Pro',
      priority: 5,
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
      supportedTaskTypes: ['vision', 'deep_research', 'benchmarking']
    },
    {
      id: 'nemotron-3-nano-omni-30b-a3b-reasoning-20260428',
      displayName: 'Nemotron 3 Nano Omni 30B A3B Reasoning',
      category: 'Pro',
      priority: 6,
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
      supportedTaskTypes: ['vision', 'deep_research', 'benchmarking']
    },
    // --- Safety / Moderation ---
    {
      id: 'nemotron-3.5-content-safety-20260604',
      displayName: 'Nemotron 3.5 Content Safety',
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
      supportedTaskTypes: ['moderation', 'benchmarking']
    },
    // --- Special Handling ---
    {
      id: 'uncensored',
      displayName: 'Uncensored (Special)',
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
      enabled: false, // Disabled by default
      ownerOnly: true, // Owner-only if enabled
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
      supportedTaskTypes: ['benchmarking']
    }
  ];

  private static cacheConfig: { data: any; timestamp: number } | null = null;
  private static readonly CONFIG_CACHE_TTL_MS = 5000;

  // --- TASK CLASSIFICATION MATRIX ---
  public static selectBestModelForTask(task: TaskType, models: ModelMetadata[], config?: any): string {
    const active = models.filter(m => m.enabled && m.id !== 'uncensored');
    if (active.length === 0) return 'gemini-3.5-flash';

    const providerPref = config?.globalProviderPreference || 'openrouter';

    switch (task) {
      case 'daily_email':
        // Daily Email strictly prefers Gemini API
        return active.find(m => m.provider === 'google' && m.category === 'Flash')?.id ||
               active.find(m => m.provider === 'google')?.id ||
               'gemini-3.5-flash';
      case 'coding':
        return active.find(m => m.id === 'north-mini-code-20260617')?.id ||
               active.find(m => m.id === 'qwen3-coder-480b-a35b')?.id ||
               active.find(m => m.id === 'gpt-oss-20b')?.id ||
               active[0].id;
      case 'retrieval':
        return active.find(m => m.id === 'llama-nemotron-embed-vl-1b-v2-20260224')?.id ||
               active[0].id;
      case 'moderation':
        return active.find(m => m.id === 'nemotron-3.5-content-safety-20260604')?.id ||
               active[0].id;
      case 'vision':
        return active.find(m => m.id === 'nemotron-nano-12b-v2-vl')?.id ||
               active.find(m => m.id === 'nemotron-3-nano-30b-a3b')?.id ||
               active[0].id;
      case 'deep_research':
        if (providerPref === 'openrouter') {
          return active.find(m => m.id === 'gpt-oss-120b')?.id ||
                 active.find(m => m.id === 'qwen3-next-80b-a3b-instruct')?.id ||
                 active.find(m => m.provider === 'openrouter' && m.category === 'Pro')?.id ||
                 active[0].id;
        }
        return active.find(m => m.id === 'gemini-3.1-pro-preview')?.id || active[0].id;
      case 'copilot_conversation':
      case 'market_summary':
      case 'company_analysis':
      case 'report_generation':
      case 'long_writing':
      case 'short_summarization':
      case 'daily_briefing':
      default:
        // By default use OpenRouter for non-email workflows
        if (providerPref === 'openrouter') {
          const openRouterModels = active.filter(m => m.provider === 'openrouter');
          return openRouterModels.find(m => m.id === 'gpt-oss-120b')?.id ||
                 openRouterModels.find(m => m.id === 'qwen3-next-80b-a3b-instruct')?.id ||
                 openRouterModels.find(m => m.id === 'llama-3.3-70b-instruct')?.id ||
                 openRouterModels[0]?.id ||
                 active[0].id;
        }
        return active.find(m => m.id === 'gemini-3.5-flash')?.id || active[0].id;
    }
  }

  // --- STATUTORY SUB-SYSTEM MAPPING TO TASKS ---
  private static mapSubsystemToTask(subsystem: Subsystem): TaskType {
    switch (subsystem) {
      case 'Daily Email': return 'daily_email';
      case 'Research Engine': return 'deep_research';
      case 'Copilot': return 'copilot_conversation';
      case 'Editorial Commentary': return 'market_summary';
      case 'Business School': return 'company_analysis';
      case 'Reports': return 'report_generation';
      case 'Opportunities': return 'market_summary';
      case 'Summaries': return 'short_summarization';
      case 'Background AI': return 'long_writing';
      case 'Benchmarking': return 'benchmarking';
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
    token?: string
  ): Promise<{ data: any; originalModel: string; actualModel: string; retries: number; fallbackUsed: boolean; errorReason?: string }> {
    const startTime = Date.now();
    let retriesCount = 0;
    
    // 1. Fetch system configs and checks
    const config = await this.getOrchestratorConfig(projectId, token);
    const maintenanceMode = config?.maintenanceMode || false;
    if (maintenanceMode) {
      throw new Error('AIOrchestrator: System is currently undergoing scheduled maintenance. Please try again shortly.');
    }

    const forcedModel = config?.forcedModel || null;
    const modelOverrides = config?.modelOverrides || {};

    // 2. Fetch shared persistent cooldown state
    const persistentCooldowns = await this.getPersistentCooldowns(projectId, token);

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
    const taskModelDefault = this.selectBestModelForTask(taskType, registryList, config);

    let targetModelId = '';
    const logicalChoice = preferredChoice || 'Automatic';

    if (forcedModel) {
      targetModelId = forcedModel;
    } else if (logicalChoice === 'Automatic') {
      targetModelId = taskModelDefault;
    } else if (logicalChoice.startsWith('gemini-') || logicalChoice.startsWith('openrouter/') || logicalChoice.includes('-')) {
      targetModelId = logicalChoice;
    } else {
      targetModelId = LogicalModelResolve(logicalChoice, subsystem);
    }

    const requestedModel = targetModelId;

    // Filter and sort healthy active models
    const activeModels = registryList.filter(m => m.enabled);
    const reqModelObj = activeModels.find(m => m.id === requestedModel);
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
    let modelLatency = 0;
    let attemptSuccess = false;

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

      let attemptStatus = 200;
      let attemptBody = '';
      const modelStartTime = Date.now();

      const resolvedKey = typeof apiKey === 'object' && apiKey !== null
        ? (apiKey[model.provider] || apiKey['openrouter'] || apiKey['google'] || '')
        : apiKey;

      const maxRetries = model.retryCount || 1;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (attempt > 0) retriesCount++;

        try {
          const result = await adapter.executePrompt(
            model.id,
            systemPrompt,
            userPrompt,
            resolvedKey,
            model.defaultTimeoutMs
          );

          finalPayload = result.rawResponse;
          attemptSuccess = true;

          // Use actual provider token counts when available; fall back to estimation.
          const hasRealTokens = typeof result.promptTokens === 'number' && typeof result.completionTokens === 'number';
          finalPromptTokens = hasRealTokens ? result.promptTokens! : Math.ceil((systemPrompt.length + userPrompt.length) / 4);
          finalCompletionTokens = hasRealTokens ? result.completionTokens! : Math.ceil(result.text.length / 4);
          tokenCountSource = hasRealTokens ? 'provider' : 'estimated';

          modelLatency = Date.now() - modelStartTime;

          modelStats.success++;
          modelStats.totalLatencyMs += modelLatency;
          modelLocalStats.set(model.id, modelStats);

          provStats.success++;
          provStats.totalLatencyMs += modelLatency;
          providerLocalStats.set(model.provider, provStats);
          break;
        } catch (e: any) {
          modelLatency = Date.now() - modelStartTime;
          attemptBody = e.message || String(e);
          attemptStatus = 500;
          if (attemptBody.includes('HTTP 429')) attemptStatus = 429;
          else if (attemptBody.includes('HTTP 401') || attemptBody.includes('HTTP 403')) attemptStatus = 401;
          else if (attemptBody.includes('HTTP 503')) attemptStatus = 503;

          if (attempt < maxRetries) {
            await new Promise(r => setTimeout(r, Math.min(1000 * Math.pow(2, attempt), 3000)));
          }
        }
      }

      if (attemptSuccess) {
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
          await this.setPersistentCooldown(projectId, model.id, cooldownExpiry, token);
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
      tokenCountSource
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

  public static async executeCommentary(
    systemPrompt: string,
    userPrompt: string,
    preferredChoice: string | undefined,
    projectId: string,
    apiKey: string | Record<string, string>,
    userId: string,
    workspaceId = 'default',
    token?: string
  ): Promise<any> {
    const { data, fallbackUsed, actualModel } = await this.execute(
      'Editorial Commentary',
      systemPrompt,
      userPrompt,
      preferredChoice,
      projectId,
      apiKey,
      userId,
      workspaceId,
      token
    );

    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || data.choices?.[0]?.message?.content;
    if (!rawText) throw new Error('Empty response content from AI model.');
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

      const currentHealth = cooldownRemaining > 0
        ? `Cooldown (${Math.ceil(cooldownRemaining / 1000)}s)`
        : stats.requests > 0 && successRate < 80
        ? 'Disabled'
        : successRate < 95 && stats.requests > 0
        ? 'Warning'
        : 'Healthy';

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
    const officialRpm = Math.round((officialRequests / elapsedMinutes) * 100) / 100;
    const officialTpm = Math.round(officialTotalTokens / elapsedMinutes);
    const officialRpd = officialRequests;

    const deltaRequests = requestsToday - officialRequests;
    const deltaPrompt = promptTokensToday - officialPromptTokens;
    const deltaCompletion = completionTokensToday - officialCompletionTokens;
    const deltaTotal = tokensToday - officialTotalTokens;

    const providerComparison = {
      google: {
        rpm: officialRpm,
        tpm: officialTpm,
        rpd: officialRpd,
        promptTokens: officialPromptTokens,
        completionTokens: officialCompletionTokens,
        totalTokens: officialTotalTokens,
        requests: officialRequests,
        quotaRemaining: Math.max(0, 1500 - officialRpd),
        lastUpdated: latestNonCachedTime || new Date().toISOString()
      },
      openrouter: {
        rpm: Math.round((officialRequests / elapsedMinutes) * 100) / 100,
        tpm: officialTpm,
        rpd: officialRpd,
        promptTokens: officialPromptTokens,
        completionTokens: officialCompletionTokens,
        totalTokens: officialTotalTokens,
        requests: officialRequests,
        quotaRemaining: 100000,
        lastUpdated: latestNonCachedTime || new Date().toISOString()
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
