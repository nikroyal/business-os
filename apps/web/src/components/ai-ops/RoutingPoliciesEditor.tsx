import React, { useState, useEffect } from 'react';
import { 
  GitBranch, 
  ShieldCheck, 
  Lock, 
  Cpu, 
  Save, 
  RotateCcw, 
  CheckCircle2
} from 'lucide-react';
import { aiOrchestratorService, type OrchestratorConfig, type ModelMetadataWithStats } from '../../services/aiOrchestratorService';

interface RoutingPoliciesEditorProps {
  config: OrchestratorConfig;
  models?: ModelMetadataWithStats[];
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
    defaultModel: 'llama-3.3-70b-instruct'
  },
  {
    id: 'Reports',
    name: 'Reports',
    description: 'Long-form executive briefings, quarterly reports, and synthesis documents.',
    defaultProvider: 'openrouter' as const,
    defaultModel: 'llama-3.3-70b-instruct'
  },
  {
    id: 'Commentary',
    name: 'Commentary',
    description: 'Editorial commentary, market analysis, and high-frequency analytical insights.',
    defaultProvider: 'openrouter' as const,
    defaultModel: 'openai/gpt-4o-mini'
  },
  {
    id: 'Company Intelligence',
    name: 'Company Intelligence',
    description: 'Structured enterprise teardowns, competitor moats, and financial evaluations.',
    defaultProvider: 'openrouter' as const,
    defaultModel: 'openai/gpt-4o-mini'
  },
  {
    id: 'Research',
    name: 'Research',
    description: 'Deep multi-source financial and market research synthesis.',
    defaultProvider: 'openrouter' as const,
    defaultModel: 'llama-3.3-70b-instruct'
  },
  {
    id: 'Opportunities',
    name: 'Opportunities',
    description: 'Automated deal sourcing, financial screening, and opportunity spotting.',
    defaultProvider: 'openrouter' as const,
    defaultModel: 'openai/gpt-4o-mini'
  },
  {
    id: 'Summaries',
    name: 'Summaries',
    description: 'High-speed document summarization and quick executive rollups.',
    defaultProvider: 'openrouter' as const,
    defaultModel: 'openai/gpt-4o-mini'
  },
  {
    id: 'Background AI Jobs',
    name: 'Background AI Jobs',
    description: 'Asynchronous batch processing, scheduled pipelines, and background workflows.',
    defaultProvider: 'openrouter' as const,
    defaultModel: 'openai/gpt-4o-mini'
  }
];

export const RoutingPoliciesEditor: React.FC<RoutingPoliciesEditorProps> = ({
  config,
  models,
  onSaveConfig,
  isOwner
}) => {
  const [registryModels, setRegistryModels] = useState<ModelMetadataWithStats[]>(models || []);

  useEffect(() => {
    if (!models || models.length === 0) {
      aiOrchestratorService.getRegistryModels().then(setRegistryModels);
    } else {
      setRegistryModels(models);
    }
  }, [models]);

  const routingModels = aiOrchestratorService.filterRoutingModels(registryModels);

  const existingPolicies = config.routingPolicies || {};
  const [globalPref, setGlobalPref] = useState<'openrouter' | 'google' | 'auto'>(
    existingPolicies.globalProviderPref || 'openrouter'
  );
  const [freeFirstRouting, setFreeFirstRouting] = useState<boolean>(
    existingPolicies.freeFirstRouting !== false
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
          freeFirstRouting,
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header Banner */}
      <div className="card" style={{
        background: '#FAF8F5',
        border: 'var(--border-thin)',
        borderRadius: '8px',
        padding: '1.25rem 1.5rem',
        boxShadow: 'var(--shadow-subtle)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'start', gap: '0.75rem' }}>
          <div style={{
            padding: '0.5rem',
            borderRadius: '6px',
            background: 'var(--color-success-bg)',
            color: 'var(--color-success-text)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: '2px'
          }}>
            <GitBranch size={20} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 'normal', fontFamily: 'var(--font-serif)', color: 'var(--text-primary)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Dynamic AI Routing Policies
              <span style={{ fontSize: '0.6rem', fontWeight: 'bold', padding: '1px 6px', borderRadius: '12px', background: '#EAF6F0', color: 'var(--color-success-text)', border: '1px solid var(--color-success-border)' }}>
                Real-time Application
              </span>
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)', maxWidth: '600px' }}>
              Configure primary provider targets and failover preferences per BusinessOS feature. By default, <strong style={{ color: 'var(--color-success-text)' }}>Daily Executive Email</strong> is locked to Google Gemini, while <strong style={{ color: 'var(--color-accent)' }}>OpenRouter</strong> powers general intelligence tasks.
            </p>
          </div>
        </div>

        {isOwner && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handleReset}
              disabled={saving}
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', borderRadius: '6px' }}
            >
              <RotateCcw size={12} />
              Reset Defaults
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn btn-primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.75rem',
                borderRadius: '6px',
                padding: '0.5rem 1.25rem',
                background: 'var(--color-primary)',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              <Save size={12} />
              {saving ? 'Saving...' : 'Persist Policies'}
            </button>
          </div>
        )}

        {saveMessage && (
          <div style={{
            width: '100%',
            marginTop: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.7rem',
            fontWeight: 'bold',
            color: 'var(--color-success-text)',
            background: 'var(--color-success-bg)',
            border: '1px solid var(--color-success-border)',
            padding: '4px 10px',
            borderRadius: '6px'
          }}>
            <CheckCircle2 size={12} />
            {saveMessage}
          </div>
        )}
      </div>

      {/* Global Provider Strategy */}
      <div className="card" style={{
        background: '#fff',
        border: 'var(--border-thin)',
        borderRadius: '8px',
        padding: '1.25rem',
        boxShadow: 'var(--shadow-subtle)'
      }}>
        <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-mono)' }}>
          <Cpu size={14} style={{ color: 'var(--color-accent)' }} />
          Global Default Routing Preference
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
          {[
            {
              id: 'openrouter',
              title: 'OpenRouter Primary (Recommended)',
              subtitle: 'Multi-model access across Anthropic Claude 3.5, OpenAI GPT-4o, and Llama 3.3',
              badge: 'Default'
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
                style={{
                  textAlign: 'left',
                  padding: '1rem',
                  borderRadius: '6px',
                  border: active ? '1px solid var(--color-accent)' : '1px solid #E2DACD',
                  background: active ? '#FDF2F2' : '#FCFAF6',
                  cursor: isOwner ? 'pointer' : 'default',
                  transition: 'all 0.15s ease',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: active ? 'var(--color-accent)' : 'var(--text-primary)' }}>
                    {option.title}
                  </span>
                  <span style={{ fontSize: '0.55rem', textTransform: 'uppercase', fontWeight: 'bold', padding: '1px 6px', borderRadius: '4px', background: '#fff', border: '1px solid #E2DACD', color: 'var(--text-secondary)' }}>
                    {option.badge}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '0.65rem', color: 'var(--text-secondary)' }}>{option.subtitle}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Free-First Inference Routing Policy Card */}
      <div className="card" style={{
        background: '#fff',
        border: 'var(--border-thin)',
        borderRadius: '8px',
        padding: '1rem 1.25rem',
        boxShadow: 'var(--shadow-subtle)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <h4 style={{ margin: 0, fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-mono)' }}>
            <ShieldCheck size={14} style={{ color: 'var(--color-success-text)' }} />
            Free-First Inference Policy (OpenRouter)
          </h4>
          <p style={{ margin: '2px 0 0 0', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
            Automatically routes tasks to <strong style={{ color: 'var(--color-success-text)' }}>openrouter/free</strong> and zero-cost OpenRouter models wherever possible before falling back to pay-as-you-go models.
          </p>
        </div>
        <button
          onClick={() => isOwner && setFreeFirstRouting(!freeFirstRouting)}
          disabled={!isOwner}
          style={{
            padding: '4px 10px',
            borderRadius: '6px',
            fontSize: '0.7rem',
            fontWeight: 'bold',
            cursor: isOwner ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: freeFirstRouting ? 'var(--color-success-bg)' : '#FCFAF6',
            color: freeFirstRouting ? 'var(--color-success-text)' : 'var(--text-secondary)',
            border: freeFirstRouting ? '1px solid var(--color-success-border)' : '1px solid #C4B9A7',
            transition: 'all 0.15s ease'
          }}
        >
          <span style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: freeFirstRouting ? 'var(--color-success-text)' : '#C4B9A7'
          }} />
          {freeFirstRouting ? 'Free-First Enabled' : 'Free-First Disabled'}
        </button>
      </div>

      {/* Feature-Level Routing Policies Table */}
      <div className="card" style={{
        background: '#fff',
        border: 'var(--border-thin)',
        borderRadius: '8px',
        padding: 0,
        boxShadow: 'var(--shadow-subtle)',
        overflow: 'hidden'
      }}>
        <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid #E2DACD', background: '#FCFAF6' }}>
          <h4 style={{ margin: 0, fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-primary)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
            Feature-Specific Routing & Model Targets
          </h4>
          <p style={{ margin: '2px 0 0 0', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
            Override global routing per task domain. Changes take effect on next dispatch without redeploy.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {FEATURE_LIST.map((feature, idx) => {
            const currentPolicy = featureRouting[feature.id] || {
              provider: feature.defaultProvider,
              preferredModel: feature.defaultModel
            };
            const isDailyEmail = feature.id === 'Daily Email' || feature.id === 'daily_email';

            return (
              <div
                key={feature.id}
                style={{
                  padding: '1rem 1.25rem',
                  borderBottom: idx === FEATURE_LIST.length - 1 ? 'none' : '1px solid #E2DACD',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '1rem'
                }}
              >
                <div style={{ maxWidth: '400px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{feature.name}</span>
                    {isDailyEmail && (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '2px',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        fontSize: '0.6rem',
                        fontWeight: 'bold',
                        background: 'var(--color-success-bg)',
                        color: 'var(--color-success-text)',
                        border: '1px solid var(--color-success-border)'
                      }}>
                        <Lock size={10} />
                        Gemini Reserved
                      </span>
                    )}
                  </div>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{feature.description}</p>
                  {feature.lockedNote && (
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.65rem', color: 'var(--color-success-text)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <ShieldCheck size={12} />
                      {feature.lockedNote}
                    </p>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {/* Provider Selector */}
                  <div style={{ display: 'flex', background: '#FCFAF6', border: '1px solid #C4B9A7', borderRadius: '6px', padding: '2px', overflow: 'hidden' }}>
                    {[
                      { id: 'google', label: 'Gemini' },
                      { id: 'openrouter', label: 'OpenRouter' },
                      { id: 'auto', label: 'Auto' }
                    ].map(p => (
                      <button
                        key={p.id}
                        onClick={() => handleFeatureProviderChange(feature.id, p.id as any)}
                        disabled={!isOwner}
                        style={{
                          background: currentPolicy.provider === p.id ? 'var(--color-primary)' : 'transparent',
                          color: currentPolicy.provider === p.id ? '#fff' : 'var(--text-primary)',
                          border: 'none',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '0.65rem',
                          fontWeight: currentPolicy.provider === p.id ? 'bold' : 'normal',
                          cursor: isOwner ? 'pointer' : 'default',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  {/* Preferred Model Dropdown */}
                  <select
                    value={currentPolicy.preferredModel || feature.defaultModel}
                    onChange={e => handleFeatureModelChange(feature.id, e.target.value)}
                    disabled={!isOwner}
                    style={{
                      padding: '4px 6px',
                      border: '1px solid #C4B9A7',
                      borderRadius: '4px',
                      background: '#FCFAF6',
                      fontSize: '0.7rem',
                      outline: 'none',
                      color: 'var(--text-primary)'
                    }}
                  >
                    {routingModels.map(model => (
                      <option key={model.id} value={model.id}>
                        {model.displayName} ({model.category})
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
export default RoutingPoliciesEditor;
