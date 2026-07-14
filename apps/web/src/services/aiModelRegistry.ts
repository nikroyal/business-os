export type LogicalModel = 'Latest Flash' | 'Latest Pro' | 'Automatic';
export type Subsystem = 'Editorial Commentary' | 'Research Engine' | 'Business School' | 'Copilot' | 'Daily Email' | 'Reports' | 'Opportunities' | 'Benchmarking' | 'Playground' | string;

export interface FeatureRequirement {
  featureId: string;
  displayName: string;
  requiredCapabilities: string[];
  preferredTaskType: string;
  description: string;
}

export const FEATURE_REQUIREMENTS: Record<string, FeatureRequirement> = {
  'Copilot': {
    featureId: 'Copilot',
    displayName: 'BusinessOS Copilot',
    requiredCapabilities: ['chat', 'streaming'],
    preferredTaskType: 'copilot_conversation',
    description: 'Low latency interactive assistant sessions'
  },
  'Daily Email': {
    featureId: 'Daily Email',
    displayName: 'Daily Executive Briefing Email',
    requiredCapabilities: ['chat'],
    preferredTaskType: 'daily_email',
    description: 'High reliability structured email briefing'
  },
  'Research Engine': {
    featureId: 'Research Engine',
    displayName: 'Deep Intelligence Research Engine',
    requiredCapabilities: ['chat'],
    preferredTaskType: 'deep_research',
    description: 'Deep reasoning multi-step research synthesis'
  },
  'Editorial Commentary': {
    featureId: 'Editorial Commentary',
    displayName: 'Daily Editorial & Market Commentary',
    requiredCapabilities: ['chat'],
    preferredTaskType: 'editorial_commentary',
    description: 'Analytical financial commentary authoring'
  }
};

export const GEMINI_MODEL_MAPPING = {
  'Latest Flash': 'gemini-3.5-flash',
  'Latest Pro': 'gemini-3.1-pro-preview'
};

export const SUBSYSTEM_AUTOMATIC_MAPPING: Record<string, keyof typeof GEMINI_MODEL_MAPPING> = {
  'Editorial Commentary': 'Latest Flash',
  'Research Engine': 'Latest Pro',
  'Business School': 'Latest Flash',
  'Copilot': 'Latest Pro'
};

export class AIModelRegistry {
  public static getFeatureRequirements(subsystem: string): FeatureRequirement | undefined {
    return FEATURE_REQUIREMENTS[subsystem];
  }

  /**
   * Resolves a logical model choice (or Automatic) for a given subsystem to its physical API model ID.
   */
  public static resolveModel(choice: string | undefined, subsystem: Subsystem): string {
    const modelChoice = choice || 'Automatic';

    if (modelChoice === 'Automatic') {
      const automaticChoice = SUBSYSTEM_AUTOMATIC_MAPPING[subsystem];
      if (automaticChoice) return GEMINI_MODEL_MAPPING[automaticChoice];
      return 'openrouter/free';
    }

    if (modelChoice === 'Latest Flash' || modelChoice === 'Latest Pro') {
      return GEMINI_MODEL_MAPPING[modelChoice as 'Latest Flash' | 'Latest Pro'];
    }

    if (typeof modelChoice === 'string' && (modelChoice.startsWith('gemini-') || modelChoice.includes('-') || modelChoice.includes('/'))) {
      return modelChoice;
    }

    return GEMINI_MODEL_MAPPING['Latest Flash'];
  }
}
