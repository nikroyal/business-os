import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Terminal,
  Settings2
} from 'lucide-react';
import { aiOrchestratorService } from '../../services/aiOrchestratorService';
import type { ModelMetadataWithStats } from '../../services/aiOrchestratorService';

interface PlaygroundResponse {
  modelId: string;
  provider: string;
  output: string;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  temperature: number;
  topP: number;
  maxTokens: number;
}

export const AIPlayground: React.FC<{ models?: ModelMetadataWithStats[] }> = ({ models }) => {
  const [registryModels, setRegistryModels] = useState<ModelMetadataWithStats[]>(models || []);

  useEffect(() => {
    if (!models || models.length === 0) {
      aiOrchestratorService.getRegistryModels().then(setRegistryModels);
    } else {
      setRegistryModels(models);
    }
  }, [models]);

  useEffect(() => {
    const handleReplay = () => {
      const payloadStr = localStorage.getItem('playground_replay_payload');
      if (payloadStr) {
        try {
          const payload = JSON.parse(payloadStr);
          if (payload.modelId) {
            setSelectedModels([payload.modelId]);
          }
          if (payload.feature) {
            const feat = payload.feature.toLowerCase();
            if (feat.includes('email')) {
              setUserPrompt('Summarize key market moves and interest rates for the morning briefing.');
            } else if (feat.includes('copilot')) {
              setUserPrompt('Explain modern portfolio theory in a single sentence.');
            } else if (feat.includes('report')) {
              setUserPrompt('Draft an outline for a mid-market financial expansion report.');
            } else if (feat.includes('research')) {
              setUserPrompt('Compare key performance indicators of top payment networks.');
            } else {
              setUserPrompt(`Analyze performance and generate recommendations for the ${payload.feature} feature.`);
            }
          }
          localStorage.removeItem('playground_replay_payload');
        } catch (e) {
          console.error('Playground replay load failed:', e);
        }
      }
    };
    
    handleReplay();
    window.addEventListener('playground_replay', handleReplay);
    return () => window.removeEventListener('playground_replay', handleReplay);
  }, []);

  const playgroundModels = aiOrchestratorService.filterPlaygroundModels(registryModels);

  const [systemPrompt, setSystemPrompt] = useState<string>(
    'You are an authoritative financial and strategic business advisor for BusinessOS executives.'
  );
  const [userPrompt, setUserPrompt] = useState<string>(
    'Analyze the strategic advantages of decoupling AI routing across flagship reasoning models and fast operational tiers.'
  );

  const [temperature, setTemperature] = useState<number>(0.7);
  const [topP, setTopP] = useState<number>(0.9);
  const [maxTokens, setMaxTokens] = useState<number>(2048);

  const [selectedModels, setSelectedModels] = useState<string[]>([
    'gemini-3.1-pro-high',
    'openrouter/anthropic/claude-3.5-sonnet'
  ]);

  const [loading, setLoading] = useState<boolean>(false);
  const [results, setResults] = useState<PlaygroundResponse[]>([]);

  const toggleModel = (id: string) => {
    setSelectedModels(prev =>
      prev.includes(id) ? (prev.length > 1 ? prev.filter(m => m !== id) : prev) : [...prev, id]
    );
  };

  const executePlayground = async () => {
    if (!userPrompt.trim() || selectedModels.length === 0) return;
    setLoading(true);
    setResults([]);

    const runSingleModel = async (modelId: string): Promise<PlaygroundResponse> => {
      const option = playgroundModels.find(m => m.id === modelId);
      const providerLabel = option?.provider === 'google' ? 'Google Gemini' : 'OpenRouter';

      const start = Date.now();
      const promptTokensEst = Math.max(10, Math.round((systemPrompt.length + userPrompt.length) / 4));

      try {
        const res = await aiOrchestratorService.executeCommentary(
          systemPrompt,
          userPrompt,
          modelId
        );
        const latency = Date.now() - start;
        const textOutput = res?.commentary || JSON.stringify(res, null, 2);
        const completionTokensEst = Math.max(20, Math.round(textOutput.length / 4));

        return {
          modelId,
          provider: providerLabel,
          output: textOutput,
          latencyMs: latency,
          promptTokens: promptTokensEst,
          completionTokens: completionTokensEst,
          totalTokens: promptTokensEst + completionTokensEst,
          temperature,
          topP,
          maxTokens
        };
      } catch (err: any) {
        const latency = Date.now() - start;
        return {
          modelId,
          provider: providerLabel,
          output: `Execution error or failover: ${err.message || 'Error executing request'}`,
          latencyMs: latency,
          promptTokens: promptTokensEst,
          completionTokens: 0,
          totalTokens: promptTokensEst,
          temperature,
          topP,
          maxTokens
        };
      }
    };

    const outcome = await Promise.all(selectedModels.map(id => runSingleModel(id)));
    setResults(outcome);
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header Banner */}
      <div className="card" style={{
        background: '#FAF8F5',
        border: 'var(--border-thin)',
        borderRadius: '8px',
        padding: '1.25rem 1.5rem',
        boxShadow: 'var(--shadow-subtle)'
      }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 'normal', fontFamily: 'var(--font-serif)', color: 'var(--text-primary)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Terminal size={18} style={{ color: 'var(--color-accent)' }} />
          Interactive AI Prompt Engineering Playground
        </h3>
        <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)', maxWidth: '800px' }}>
          Fine-tune system instructions, adjust sampling hyperparameters (Temperature, Top P, Max Tokens), and evaluate reasoning output simultaneously across single or multiple AI models.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.25rem', alignItems: 'start' }} className="playground-grid-responsive">
        {/* Left 2 Columns: Prompt Editors */}
        <div className="card" style={{
          background: '#fff',
          border: 'var(--border-thin)',
          borderRadius: '8px',
          padding: '1.5rem',
          boxShadow: 'var(--shadow-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          <div>
            <label style={{ fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontFamily: 'var(--font-mono)' }}>
              <span>System Prompt (Instructions & Persona)</span>
              <span style={{ fontWeight: 'normal', color: 'var(--text-muted)' }}>Controls model behavior</span>
            </label>
            <textarea
              rows={3}
              value={systemPrompt}
              onChange={e => setSystemPrompt(e.target.value)}
              style={{
                width: '100%',
                background: '#FCFAF6',
                border: '1px solid #C4B9A7',
                borderRadius: '6px',
                padding: '0.5rem 0.75rem',
                fontSize: '0.8rem',
                color: 'var(--text-primary)',
                outline: 'none',
                fontFamily: 'var(--font-mono)'
              }}
              placeholder="Enter system prompt instructions..."
            />
          </div>

          <div>
            <label style={{ fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontFamily: 'var(--font-mono)' }}>
              <span>User Input Prompt</span>
              <span style={{ fontWeight: 'normal', color: 'var(--text-muted)' }}>Primary evaluation task</span>
            </label>
            <textarea
              rows={5}
              value={userPrompt}
              onChange={e => setUserPrompt(e.target.value)}
              style={{
                width: '100%',
                background: '#FCFAF6',
                border: '1px solid #C4B9A7',
                borderRadius: '6px',
                padding: '0.5rem 0.75rem',
                fontSize: '0.8rem',
                color: 'var(--text-primary)',
                outline: 'none',
                fontFamily: 'var(--font-mono)'
              }}
              placeholder="Enter user prompt or input payload..."
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '4px' }}>
            <button
              onClick={executePlayground}
              disabled={loading || !userPrompt.trim()}
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
              <Play size={14} style={{ fill: 'currentColor' }} />
              {loading ? 'Executing Across Selected Models...' : 'Run Prompt Suite'}
            </button>
          </div>
        </div>

        {/* Right Column: Hyperparameters & Model Selection */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card" style={{
            background: '#fff',
            border: 'var(--border-thin)',
            borderRadius: '8px',
            padding: '1.25rem',
            boxShadow: 'var(--shadow-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <h4 style={{ margin: 0, fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--text-primary)', borderBottom: '1px solid #E2DACD', paddingBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-mono)' }}>
              <Settings2 size={14} style={{ color: 'var(--color-accent)' }} />
              Sampling Hyperparameters
            </h4>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', marginBottom: '4px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>
                <span>Temperature</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-accent)' }}>{temperature.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={1.5}
                step={0.05}
                value={temperature}
                onChange={e => setTemperature(parseFloat(e.target.value))}
                style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--color-accent)' }}
              />
              <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>Lower is deterministic, higher is creative</span>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', marginBottom: '4px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>
                <span>Top P (Nucleus Sampling)</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-accent)' }}>{topP.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0.1}
                max={1.0}
                step={0.05}
                value={topP}
                onChange={e => setTopP(parseFloat(e.target.value))}
                style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--color-accent)' }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', marginBottom: '4px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>
                <span>Max Tokens</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-accent)' }}>{maxTokens}</span>
              </div>
              <input
                type="range"
                min={256}
                max={8192}
                step={256}
                value={maxTokens}
                onChange={e => setMaxTokens(parseInt(e.target.value))}
                style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--color-accent)' }}
              />
            </div>

            <div style={{ borderTop: '1px solid #E2DACD', paddingTop: '0.75rem' }}>
              <h5 style={{ margin: '0 0 0.5rem 0', fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                Target Models ({selectedModels.length})
              </h5>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: '180px', overflowY: 'auto' }}>
                {playgroundModels.map(mod => {
                  const active = selectedModels.includes(mod.id);
                  const providerName = mod.provider === 'google' ? 'Google Gemini' : 'OpenRouter';
                  return (
                    <button
                      key={mod.id}
                      onClick={() => toggleModel(mod.id)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '6px 8px',
                        borderRadius: '4px',
                        border: active ? '1px solid var(--color-accent)' : '1px solid #E2DACD',
                        background: active ? '#FDF2F2' : '#FCFAF6',
                        color: active ? 'var(--color-accent)' : 'var(--text-primary)',
                        fontSize: '0.7rem',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: '4px' }}>
                        <span style={{ fontWeight: 'bold', display: 'block' }}>{mod.displayName}</span>
                        <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>{providerName}</span>
                      </div>
                      <span style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        flexShrink: 0,
                        background: active ? 'var(--color-accent)' : '#C4B9A7'
                      }} />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Output Results */}
      {results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
          <h4 style={{ margin: 0, fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Evaluation Output & Complete Telemetry
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
            {results.map((r, idx) => (
              <div key={idx} className="card" style={{
                background: '#fff',
                border: 'var(--border-thin)',
                borderRadius: '8px',
                padding: '1.25rem',
                boxShadow: 'var(--shadow-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #E2DACD', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
                    <div>
                      <span style={{ fontSize: '0.55rem', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--color-accent)', display: 'block' }}>
                        {r.provider}
                      </span>
                      <h5 style={{ margin: 0, fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{r.modelId}</h5>
                    </div>
                    <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', padding: '2px 8px', borderRadius: '12px', background: '#FCFAF6', border: '1px solid #E2DACD', color: 'var(--text-secondary)' }}>
                      {r.latencyMs} ms
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem', textAlign: 'center', fontSize: '0.7rem', marginBottom: '0.5rem' }}>
                    <div style={{ background: '#FCFAF6', borderRadius: '6px', padding: '0.4rem', border: '1px solid #E2DACD' }}>
                      <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>Prompt</span>
                      <span style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{r.promptTokens}</span>
                    </div>
                    <div style={{ background: '#FCFAF6', borderRadius: '6px', padding: '0.4rem', border: '1px solid #E2DACD' }}>
                      <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>Output</span>
                      <span style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{r.completionTokens}</span>
                    </div>
                    <div style={{ background: '#FCFAF6', borderRadius: '6px', padding: '0.4rem', border: '1px solid #E2DACD' }}>
                      <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>Total</span>
                      <span style={{ fontWeight: 'bold', color: 'var(--color-accent)', fontFamily: 'var(--font-mono)' }}>{r.totalTokens}</span>
                    </div>
                  </div>

                  <div style={{
                    background: '#FCFAF6',
                    borderRadius: '6px',
                    padding: '0.75rem',
                    border: '1px solid #E2DACD',
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                    fontFamily: 'var(--font-mono)',
                    lineHeight: '1.5',
                    whiteSpace: 'pre-wrap',
                    maxHeight: '260px',
                    overflowY: 'auto'
                  }}>
                    {r.output}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <style>{`
        @media (max-width: 768px) {
          .playground-grid-responsive {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};
export default AIPlayground;
