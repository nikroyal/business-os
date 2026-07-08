import React, { useState } from 'react';
import { 
  GitBranch, 
  ShieldCheck, 
  Lock, 
  Cpu, 
  Save, 
  RotateCcw, 
  CheckCircle2
} from 'lucide-react';
import type { OrchestratorConfig } from '../../services/aiOrchestratorService';

interface RoutingPoliciesEditorProps {
  config: OrchestratorConfig;
  onSaveConfig: (updated: Partial<OrchestratorConfig>) => Promise<void>;
  isOwner: boolean;
}

const FEATURE_LIST = [
  {
    id: 'Daily Email',
    name: 'Daily Email',
    description: 'Automated daily intelligence briefing & executive newsletter.',
    defaultProvider: 'google' as const,
    defaultModel: 'gemini-3.1-pro-high',
    lockedNote: 'Reserved for Google Gemini by default for guaranteed email formatting & consistency.'
  },
  {
    id: 'Copilot',
    name: 'Copilot',
    description: 'Interactive conversation, code assistant, and real-time operator copilot.',
    defaultProvider: 'openrouter' as const,
    defaultModel: 'openrouter/anthropic/claude-3.5-sonnet'
  },
  {
    id: 'Reports',
    name: 'Reports',
    description: 'Long-form executive briefings, quarterly reports, and synthesis documents.',
    defaultProvider: 'openrouter' as const,
    defaultModel: 'openrouter/anthropic/claude-3.5-sonnet'
  },
  {
    id: 'Commentary',
    name: 'Commentary',
    description: 'Editorial commentary, market analysis, and high-frequency analytical insights.',
    defaultProvider: 'openrouter' as const,
    defaultModel: 'openrouter/google/gemini-2.5-pro'
  },
  {
    id: 'Company Intelligence',
    name: 'Company Intelligence',
    description: 'Structured enterprise teardowns, competitor moats, and financial evaluations.',
    defaultProvider: 'openrouter' as const,
    defaultModel: 'openrouter/google/gemini-2.5-pro'
  },
  {
    id: 'Research',
    name: 'Research',
    description: 'Deep multi-source financial and market research synthesis.',
    defaultProvider: 'openrouter' as const,
    defaultModel: 'openrouter/google/gemini-2.5-pro'
  },
  {
    id: 'Opportunities',
    name: 'Opportunities',
    description: 'Automated deal sourcing, financial screening, and opportunity spotting.',
    defaultProvider: 'openrouter' as const,
    defaultModel: 'openrouter/google/gemini-2.5-pro'
  },
  {
    id: 'Summaries',
    name: 'Summaries',
    description: 'High-speed document summarization and quick executive rollups.',
    defaultProvider: 'openrouter' as const,
    defaultModel: 'openrouter/meta-llama/llama-3.3-70b-instruct'
  },
  {
    id: 'Background AI Jobs',
    name: 'Background AI Jobs',
    description: 'Asynchronous batch processing, scheduled pipelines, and background workflows.',
    defaultProvider: 'openrouter' as const,
    defaultModel: 'openrouter/openai/gpt-4o'
  }
];

const AVAILABLE_MODELS = [
  { id: 'gemini-3.1-pro-high', name: 'Google Gemini 3.1 Pro (High)', provider: 'google', tier: 'Flagship' },
  { id: 'gemini-3.1-flash-lite', name: 'Google Gemini 3.1 Flash Lite', provider: 'google', tier: 'Fast' },
  { id: 'openrouter/google/gemini-2.5-pro', name: 'OpenRouter: Gemini 2.5 Pro', provider: 'openrouter', tier: 'Pro' },
  { id: 'openrouter/anthropic/claude-3.5-sonnet', name: 'OpenRouter: Claude 3.5 Sonnet', provider: 'openrouter', tier: 'Flagship' },
  { id: 'openrouter/openai/gpt-4o', name: 'OpenRouter: OpenAI GPT-4o', provider: 'openrouter', tier: 'Flagship' },
  { id: 'openrouter/meta-llama/llama-3.3-70b-instruct', name: 'OpenRouter: Llama 3.3 70B Instruct', provider: 'openrouter', tier: 'Fast' },
  { id: 'openrouter/deepseek/deepseek-r1', name: 'OpenRouter: DeepSeek R1 Reasoning', provider: 'openrouter', tier: 'Reasoning' }
];

export const RoutingPoliciesEditor: React.FC<RoutingPoliciesEditorProps> = ({
  config,
  onSaveConfig,
  isOwner
}) => {
  const existingPolicies = config.routingPolicies || {};
  const [globalPref, setGlobalPref] = useState<'openrouter' | 'google' | 'auto'>(
    existingPolicies.globalProviderPref || 'openrouter'
  );
  const [featureRouting, setFeatureRouting] = useState<Record<string, { provider: 'openrouter' | 'google' | 'auto'; preferredModel?: string }>>(
    existingPolicies.featureRouting || {}
  );
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const handleFeatureProviderChange = (featureId: string, provider: 'openrouter' | 'google' | 'auto') => {
    setFeatureRouting(prev => ({
      ...prev,
      [featureId]: {
        ...(prev[featureId] || {}),
        provider
      }
    }));
  };

  const handleFeatureModelChange = (featureId: string, preferredModel: string) => {
    setFeatureRouting(prev => ({
      ...prev,
      [featureId]: {
        ...(prev[featureId] || { provider: 'auto' }),
        preferredModel
      }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);
    try {
      await onSaveConfig({
        routingPolicies: {
          globalProviderPref: globalPref,
          featureRouting
        }
      });
      setSaveMessage('Routing policies successfully persisted to Firestore.');
      setTimeout(() => setSaveMessage(null), 4000);
    } catch (err) {
      setSaveMessage('Failed to save routing policies.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setGlobalPref('openrouter');
    setFeatureRouting({
      daily_email: { provider: 'google', preferredModel: 'gemini-3.1-pro-high' }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 border border-indigo-500/20 shadow-xl">
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400">
              <GitBranch className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                Dynamic AI Routing Policies
                <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Real-time Application
                </span>
              </h3>
              <p className="text-sm text-slate-300 mt-1 max-w-2xl">
                Configure primary provider targets and failover preferences per BusinessOS feature. By default, <strong className="text-emerald-300">Daily Executive Email</strong> is locked to Google Gemini, while <strong className="text-indigo-300">OpenRouter</strong> powers general intelligence tasks.
              </p>
            </div>
          </div>

          {isOwner && (
            <div className="flex items-center gap-3">
              <button
                onClick={handleReset}
                disabled={saving}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Defaults
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? 'Saving...' : 'Persist Policies'}
              </button>
            </div>
          )}
        </div>

        {saveMessage && (
          <div className="mt-4 flex items-center gap-2 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2 rounded-xl">
            <CheckCircle2 className="w-4 h-4" />
            {saveMessage}
          </div>
        )}
      </div>

      {/* Global Provider Strategy */}
      <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl p-6 border border-slate-800 shadow-lg">
        <h4 className="text-sm font-semibold text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Cpu className="w-4 h-4 text-indigo-400" />
          Global Default Routing Preference
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              id: 'openrouter',
              title: 'OpenRouter Primary (Recommended)',
              subtitle: 'Multi-model access across Anthropic Claude 3.5, OpenAI GPT-4o, and Llama 3.3',
              badge: 'Default for Platform'
            },
            {
              id: 'google',
              title: 'Google Gemini Direct',
              subtitle: 'Direct Google AI Studio execution with native Gemini Pro & Flash models',
              badge: 'Direct Tier'
            },
            {
              id: 'auto',
              title: 'Adaptive Orchestrator',
              subtitle: 'Dynamically balances between OpenRouter and Gemini based on latency & SLA',
              badge: 'Auto Balanced'
            }
          ].map(option => {
            const active = globalPref === option.id;
            return (
              <button
                key={option.id}
                onClick={() => isOwner && setGlobalPref(option.id as any)}
                disabled={!isOwner}
                className={`text-left p-4 rounded-xl border transition-all relative ${
                  active
                    ? 'bg-indigo-500/10 border-indigo-500/50 shadow-md shadow-indigo-500/10'
                    : 'bg-slate-800/40 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-bold ${active ? 'text-indigo-300' : 'text-slate-200'}`}>
                    {option.title}
                  </span>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700">
                    {option.badge}
                  </span>
                </div>
                <p className="text-xs text-slate-400">{option.subtitle}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Feature-Level Routing Policies Table */}
      <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 overflow-hidden shadow-lg">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
              Feature-Specific Routing & Model Targets
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Override global routing per task domain. Changes take effect on next dispatch without redeploy.
            </p>
          </div>
        </div>

        <div className="divide-y divide-slate-800/80">
          {FEATURE_LIST.map(feature => {
            const currentPolicy = featureRouting[feature.id] || {
              provider: feature.defaultProvider,
              preferredModel: feature.defaultModel
            };
            const isDailyEmail = feature.id === 'Daily Email' || feature.id === 'daily_email';

            return (
              <div key={feature.id} className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-800/20 transition-colors">
                <div className="max-w-md">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{feature.name}</span>
                    {isDailyEmail && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        <Lock className="w-2.5 h-2.5" />
                        Gemini Reserved
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{feature.description}</p>
                  {feature.lockedNote && (
                    <p className="text-[11px] text-emerald-400/90 mt-1.5 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
                      {feature.lockedNote}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Provider Selector */}
                  <div className="flex items-center bg-slate-950 rounded-xl p-1 border border-slate-800">
                    <button
                      onClick={() => handleFeatureProviderChange(feature.id, 'google')}
                      disabled={!isOwner}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        currentPolicy.provider === 'google'
                          ? 'bg-indigo-600 text-white shadow'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Google Gemini
                    </button>
                    <button
                      onClick={() => handleFeatureProviderChange(feature.id, 'openrouter')}
                      disabled={!isOwner}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        currentPolicy.provider === 'openrouter'
                          ? 'bg-indigo-600 text-white shadow'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      OpenRouter
                    </button>
                    <button
                      onClick={() => handleFeatureProviderChange(feature.id, 'auto')}
                      disabled={!isOwner}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        currentPolicy.provider === 'auto'
                          ? 'bg-indigo-600 text-white shadow'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Auto
                    </button>
                  </div>

                  {/* Preferred Model Dropdown */}
                  <select
                    value={currentPolicy.preferredModel || feature.defaultModel}
                    onChange={e => handleFeatureModelChange(feature.id, e.target.value)}
                    disabled={!isOwner}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    {AVAILABLE_MODELS.map(model => (
                      <option key={model.id} value={model.id}>
                        {model.name} ({model.tier})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
