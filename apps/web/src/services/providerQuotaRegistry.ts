/**
 * Centralized Provider Quota Registry
 *
 * This is the single source of truth for all provider model quotas, pricing,
 * context windows, and capability metadata. No quota constants should be
 * hardcoded elsewhere in the Operations Center.
 *
 * Sources:
 *  - Google AI Studio free-tier limits (as of 2025-07)
 *  - Google Cloud Vertex AI Gemini pricing (public)
 */

export type AvailabilityTier = 'Free' | 'Pay-as-you-go' | 'Enterprise' | 'Reserved';
export type ModelStatus = 'production' | 'preview' | 'experimental' | 'deprecated';

export interface ModelQuotaDefinition {
  modelId: string;
  displayName: string;
  provider: 'google' | 'openai' | 'anthropic' | 'azure';

  /** Requests Per Minute limit */
  rpmLimit: number;
  /** Tokens Per Minute limit */
  tpmLimit: number;
  /** Requests Per Day limit */
  rpdLimit: number;

  /** Context window in tokens */
  contextWindow: number;
  /** Maximum output tokens per request */
  maxOutputTokens: number;

  /** Input cost in USD per 1 million tokens */
  inputCostPer1M: number;
  /** Output cost in USD per 1 million tokens */
  outputCostPer1M: number;

  availabilityTier: AvailabilityTier;
  status: ModelStatus;

  /** Whether this model is currently in preview (may break/change) */
  isPreview: boolean;
  /** Whether this model is generally available */
  isGA: boolean;

  /** Optional: thinking/reasoning tokens cost per 1M (if applicable) */
  thinkingCostPer1M?: number;

  /** Notes about quota e.g. "Free tier limits apply" */
  quotaNote?: string;
}

/** The canonical registry. Keys are model IDs. */
export const PROVIDER_QUOTA_REGISTRY: Record<string, ModelQuotaDefinition> = {
  'gemini-3.5-flash': {
    modelId: 'gemini-3.5-flash',
    displayName: 'Gemini 3.5 Flash',
    provider: 'google',
    rpmLimit: 15,
    tpmLimit: 1_000_000,
    rpdLimit: 1500,
    contextWindow: 1_048_576,
    maxOutputTokens: 8192,
    inputCostPer1M: 0.075,
    outputCostPer1M: 0.30,
    availabilityTier: 'Free',
    status: 'production',
    isPreview: false,
    isGA: true,
    quotaNote: 'Google AI Studio free tier: 15 RPM / 1M TPM / 1500 RPD',
  },
  'gemini-3.1-pro-preview': {
    modelId: 'gemini-3.1-pro-preview',
    displayName: 'Gemini 3.1 Pro',
    provider: 'google',
    rpmLimit: 2,
    tpmLimit: 32_000,
    rpdLimit: 50,
    contextWindow: 2_097_152,
    maxOutputTokens: 8192,
    inputCostPer1M: 1.25,
    outputCostPer1M: 5.00,
    availabilityTier: 'Free',
    status: 'preview',
    isPreview: true,
    isGA: false,
    quotaNote: 'Preview model: 2 RPM / 32K TPM / 50 RPD – subject to change',
  },
  'gemini-2.5-pro': {
    modelId: 'gemini-2.5-pro',
    displayName: 'Gemini 2.5 Pro',
    provider: 'google',
    rpmLimit: 2,
    tpmLimit: 32_000,
    rpdLimit: 50,
    contextWindow: 2_097_152,
    maxOutputTokens: 8192,
    inputCostPer1M: 1.25,
    outputCostPer1M: 5.00,
    availabilityTier: 'Free',
    status: 'production',
    isPreview: false,
    isGA: true,
    quotaNote: 'Google AI Studio free tier: 2 RPM / 32K TPM / 50 RPD',
  },
  'gemini-2.5-flash': {
    modelId: 'gemini-2.5-flash',
    displayName: 'Gemini 2.5 Flash',
    provider: 'google',
    rpmLimit: 15,
    tpmLimit: 1_000_000,
    rpdLimit: 1500,
    contextWindow: 1_048_576,
    maxOutputTokens: 8192,
    inputCostPer1M: 0.075,
    outputCostPer1M: 0.30,
    availabilityTier: 'Free',
    status: 'production',
    isPreview: false,
    isGA: true,
    quotaNote: 'Google AI Studio free tier: 15 RPM / 1M TPM / 1500 RPD',
  },
  'gemini-3.1-flash-lite': {
    modelId: 'gemini-3.1-flash-lite',
    displayName: 'Gemini 3.1 Flash Lite',
    provider: 'google',
    rpmLimit: 15,
    tpmLimit: 1_000_000,
    rpdLimit: 1500,
    contextWindow: 1_048_576,
    maxOutputTokens: 8192,
    inputCostPer1M: 0.0375,
    outputCostPer1M: 0.15,
    availabilityTier: 'Free',
    status: 'production',
    isPreview: false,
    isGA: true,
    quotaNote: 'Google AI Studio free tier: 15 RPM / 1M TPM / 1500 RPD',
  },
  'gemini-2.5-flash-lite': {
    modelId: 'gemini-2.5-flash-lite',
    displayName: 'Gemini 2.5 Flash Lite',
    provider: 'google',
    rpmLimit: 15,
    tpmLimit: 1_000_000,
    rpdLimit: 1500,
    contextWindow: 1_048_576,
    maxOutputTokens: 8192,
    inputCostPer1M: 0.0375,
    outputCostPer1M: 0.15,
    availabilityTier: 'Free',
    status: 'production',
    isPreview: false,
    isGA: true,
    quotaNote: 'Google AI Studio free tier: 15 RPM / 1M TPM / 1500 RPD',
  },
  'gemini-flash-latest': {
    modelId: 'gemini-flash-latest',
    displayName: 'Gemini Flash (Latest Alias)',
    provider: 'google',
    rpmLimit: 15,
    tpmLimit: 1_000_000,
    rpdLimit: 1500,
    contextWindow: 1_048_576,
    maxOutputTokens: 8192,
    inputCostPer1M: 0.075,
    outputCostPer1M: 0.30,
    availabilityTier: 'Free',
    status: 'production',
    isPreview: false,
    isGA: true,
    quotaNote: 'Alias resolves to latest stable Flash. Same limits apply.',
  },
  'gemini-pro-latest': {
    modelId: 'gemini-pro-latest',
    displayName: 'Gemini Pro (Latest Alias)',
    provider: 'google',
    rpmLimit: 2,
    tpmLimit: 32_000,
    rpdLimit: 50,
    contextWindow: 2_097_152,
    maxOutputTokens: 8192,
    inputCostPer1M: 1.25,
    outputCostPer1M: 5.00,
    availabilityTier: 'Free',
    status: 'production',
    isPreview: false,
    isGA: true,
    quotaNote: 'Alias resolves to latest stable Pro. Same limits apply.',
  },
};

/**
 * Retrieves quota definition for a model. Falls back to a safe default if unknown.
 */
export function getModelQuota(modelId: string): ModelQuotaDefinition {
  return PROVIDER_QUOTA_REGISTRY[modelId] ?? {
    modelId,
    displayName: modelId,
    provider: 'google',
    rpmLimit: 15,
    tpmLimit: 1_000_000,
    rpdLimit: 1500,
    contextWindow: 1_048_576,
    maxOutputTokens: 8192,
    inputCostPer1M: 0.075,
    outputCostPer1M: 0.30,
    availabilityTier: 'Free',
    status: 'production',
    isPreview: false,
    isGA: true,
    quotaNote: 'Defaults applied – model not found in quota registry',
  };
}

/**
 * Returns all registered models for a given provider.
 */
export function getModelsByProvider(provider: string): ModelQuotaDefinition[] {
  return Object.values(PROVIDER_QUOTA_REGISTRY).filter(m => m.provider === provider);
}

/**
 * Returns models matching a given availability tier.
 */
export function getModelsByTier(tier: AvailabilityTier): ModelQuotaDefinition[] {
  return Object.values(PROVIDER_QUOTA_REGISTRY).filter(m => m.availabilityTier === tier);
}
