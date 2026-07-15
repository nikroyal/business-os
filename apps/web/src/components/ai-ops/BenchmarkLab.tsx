import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Sparkles, 
  CheckCircle2, 
  CheckSquare,
  Square,
  FileText,
  FileJson
} from 'lucide-react';
import { aiOrchestratorService } from '../../services/aiOrchestratorService';
import type { ModelMetadataWithStats } from '../../services/aiOrchestratorService';

export interface BenchmarkRecord {
  provider: string;
  modelId: string;
  response: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  cost: string;
  finishReason: string;
  retryCount: number;
  cacheHit: boolean;
  errorClassification: string;
  timestamp: string;
}

const PRESET_PROMPTS = [
  {
    label: 'Financial Executive Summary',
    prompt: 'Summarize key Q3 portfolio performance risk factors and suggest 3 hedging actions in concise bullet points.'
  },
  {
    label: 'Company Moat & SWOT Analysis',
    prompt: 'Provide a structured competitive moat and defensibility assessment for a mid-market fintech payment processor.'
  },
  {
    label: 'Editorial Commentary Briefing',
    prompt: 'Draft an authoritative executive commentary paragraph discussing interest rate volatility impact on SaaS equity valuations.'
  }
];

export const BenchmarkLab: React.FC<{ models?: ModelMetadataWithStats[] }> = ({ models }) => {
  const [registryModels, setRegistryModels] = useState<ModelMetadataWithStats[]>(models || []);

  useEffect(() => {
    if (!models || models.length === 0) {
      aiOrchestratorService.getRegistryModels().then(setRegistryModels);
    } else {
      setRegistryModels(models);
    }
  }, [models]);

  const benchmarkModels = aiOrchestratorService.filterBenchmarkModels(registryModels);
  const [selectedModels, setSelectedModels] = useState<string[]>([
    'gemini-3.1-pro-high',
    'openrouter/anthropic/claude-3.5-sonnet',
    'openrouter/google/gemini-2.5-pro'
  ]);
  const [promptText, setPromptText] = useState(PRESET_PROMPTS[0].prompt);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<BenchmarkRecord[]>([]);

  const toggleModelSelection = (id: string) => {
    setSelectedModels(prev => 
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const selectAllModels = () => {
    setSelectedModels(benchmarkModels.map(m => m.id));
  };

  const clearSelection = () => {
    setSelectedModels([]);
  };

  const runParallelBenchmark = async () => {
    if (selectedModels.length === 0 || !promptText.trim()) return;
    setLoading(true);
    setResults([]);

    const runModelBenchmark = async (modelId: string): Promise<BenchmarkRecord> => {
      const option = benchmarkModels.find(m => m.id === modelId);
      const providerLabel = option?.provider === 'google' ? 'Google Gemini' : 'OpenRouter';

      const start = Date.now();
      const promptTokensEst = Math.max(10, Math.round(promptText.length / 4));
      try {
        const res = await aiOrchestratorService.executeCommentary(
          'You are a senior executive AI benchmark analyst.',
          promptText,
          modelId
        );
        const latency = Date.now() - start;
        const responseText = res?.commentary || JSON.stringify(res, null, 2);
        const completionTokensEst = Math.max(20, Math.round(responseText.length / 4));
        const totalTokens = promptTokensEst + completionTokensEst;

        let costEst = '~$0.0025';
        if (modelId.includes('claude-3.5-sonnet')) costEst = '~$0.0052';
        else if (modelId.includes('flash-lite') || modelId.includes('llama')) costEst = '~$0.0003';

        return {
          provider: providerLabel,
          modelId,
          response: responseText,
          promptTokens: promptTokensEst,
          completionTokens: completionTokensEst,
          totalTokens,
          latencyMs: latency,
          cost: costEst,
          finishReason: 'STOP',
          retryCount: 0,
          cacheHit: false,
          errorClassification: 'SUCCESS',
          timestamp: new Date().toISOString()
        };
      } catch (err: any) {
        const latency = Date.now() - start;
        return {
          provider: providerLabel,
          modelId,
          response: `Execution error/fallback: ${err.message || 'Error occurred'}`,
          promptTokens: promptTokensEst,
          completionTokens: 0,
          totalTokens: promptTokensEst,
          latencyMs: latency,
          cost: '$0.0000',
          finishReason: 'ERROR',
          retryCount: 1,
          cacheHit: false,
          errorClassification: 'EXECUTION_FAILOVER',
          timestamp: new Date().toISOString()
        };
      }
    };

    const benchmarkPromises = selectedModels.map(id => runModelBenchmark(id));
    const finishedRecords = await Promise.all(benchmarkPromises);
    setResults(finishedRecords);
    setLoading(false);
  };

  const downloadCSV = () => {
    if (results.length === 0) return;
    const headers = [
      'Provider',
      'Model ID',
      'Prompt Tokens',
      'Completion Tokens',
      'Total Tokens',
      'Latency (ms)',
      'Estimated Cost',
      'Finish Reason',
      'Retry Count',
      'Cache Hit',
      'Error Classification',
      'Timestamp',
      'Response'
    ];

    const escapeCsv = (str: string) => `"${str.replace(/"/g, '""')}"`;

    const rows = results.map(r => [
      escapeCsv(r.provider),
      escapeCsv(r.modelId),
      r.promptTokens,
      r.completionTokens,
      r.totalTokens,
      r.latencyMs,
      escapeCsv(r.cost),
      escapeCsv(r.finishReason),
      r.retryCount,
      r.cacheHit ? 'true' : 'false',
      escapeCsv(r.errorClassification),
      escapeCsv(r.timestamp),
      escapeCsv(r.response)
    ].join(','));

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `businessos_ai_benchmark_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadJSON = () => {
    if (results.length === 0) return;
    const payload = {
      benchmarkMetadata: {
        exportedAt: new Date().toISOString(),
        prompt: promptText,
        modelsTestedCount: results.length
      },
      records: results
    };
    const jsonContent = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `businessos_ai_benchmark_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
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
        <div>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 'normal', fontFamily: 'var(--font-serif)', color: 'var(--text-primary)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={18} style={{ color: 'var(--color-accent)' }} />
            Parallel Multi-Model Benchmark Lab
          </h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)', maxWidth: '800px' }}>
            Execute identical analytical instructions concurrently across any number of registered AI models. Compare latency, token efficiency, response quality, and export structured datasets for ChatGPT analysis.
          </p>
        </div>

        {results.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={downloadCSV}
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', borderRadius: '6px' }}
            >
              <FileText size={12} style={{ color: 'var(--color-success-text)' }} />
              Export CSV
            </button>
            <button
              onClick={downloadJSON}
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', borderRadius: '6px' }}
            >
              <FileJson size={12} style={{ color: 'var(--color-accent)' }} />
              Export JSON
            </button>
          </div>
        )}
      </div>

      {/* Model Multi-Select & Prompt Editor */}
      <div className="card" style={{
        background: '#fff',
        border: 'var(--border-thin)',
        borderRadius: '8px',
        padding: '1.5rem',
        boxShadow: 'var(--shadow-subtle)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem'
      }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
              Select Candidate Models ({selectedModels.length} selected)
            </span>
            <div style={{ display: 'flex', gap: '10px', fontSize: '0.7rem' }}>
              <button
                onClick={selectAllModels}
                style={{ background: 'none', border: 'none', color: 'var(--color-accent)', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Select All
              </button>
              <span style={{ color: '#C4B9A7' }}>|</span>
              <button
                onClick={clearSelection}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                Clear Selection
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.5rem' }}>
            {benchmarkModels.map(model => {
              const isSelected = selectedModels.includes(model.id);
              const providerName = model.provider === 'google' ? 'Google Gemini' : 'OpenRouter';
              return (
                <button
                  key={model.id}
                  onClick={() => toggleModelSelection(model.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: isSelected ? '1px solid var(--color-accent)' : '1px solid #E2DACD',
                    background: isSelected ? '#FDF2F2' : '#FCFAF6',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    textAlign: 'left'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                    {isSelected ? (
                      <CheckSquare size={13} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
                    ) : (
                      <Square size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    )}
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 'bold', display: 'block', color: 'var(--text-primary)' }}>
                        {model.displayName}
                      </span>
                      <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>
                        {providerName} • {model.category}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Preset Prompts */}
        <div>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: 'bold', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>Preset Benchmark Instructions:</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {PRESET_PROMPTS.map((p, idx) => (
              <button
                key={idx}
                onClick={() => setPromptText(p.prompt)}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px' }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label style={{ fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', fontFamily: 'var(--font-mono)' }}>
            Test Evaluation Prompt
          </label>
          <textarea
            rows={3}
            value={promptText}
            onChange={e => setPromptText(e.target.value)}
            style={{
              width: '100%',
              background: '#FCFAF6',
              border: '1px solid #C4B9A7',
              borderRadius: '6px',
              padding: '0.5rem 0.75rem',
              fontSize: '0.8rem',
              color: 'var(--text-primary)',
              outline: 'none'
            }}
            placeholder="Enter instruction prompt for parallel execution across selected models..."
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={runParallelBenchmark}
            disabled={loading || selectedModels.length === 0 || !promptText.trim()}
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
            {loading ? 'Executing Parallel Benchmark Suite...' : `Execute Benchmark Across ${selectedModels.length} Models`}
          </button>
        </div>
      </div>

      {/* Results Table & Cards */}
      {results.length > 0 && (
        <div className="card" style={{
          background: '#fff',
          border: 'var(--border-thin)',
          borderRadius: '8px',
          padding: 0,
          boxShadow: 'var(--shadow-subtle)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid #E2DACD', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FCFAF6' }}>
            <h4 style={{ margin: 0, fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-primary)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
              Parallel Execution Telemetry & Comparison Matrix
            </h4>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
              {results.length} model evaluations completed
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.7rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--color-primary)', color: 'var(--text-secondary)', background: '#FCFAF6', fontWeight: 'bold' }}>
                  <th style={{ padding: '0.5rem 0.75rem' }}>Provider</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>Model ID</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>Latency</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>Tokens (P/C/Total)</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>Est. Cost</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>Status</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>Response Output Preview</th>
                </tr>
              </thead>
              <tbody>
                {results.map((rec, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #E2DACD' }}>
                    <td style={{ padding: '0.6rem 0.75rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>
                      <span style={{ fontSize: '0.6rem', border: '1px solid #C4B9A7', background: '#FCFAF6', padding: '1px 6px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', borderRadius: '4px' }}>
                        {rec.provider}
                      </span>
                    </td>
                    <td style={{ padding: '0.6rem 0.75rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{rec.modelId}</td>
                    <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{rec.latencyMs} ms</td>
                    <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                      {rec.promptTokens} / {rec.completionTokens} / <strong style={{ color: 'var(--text-primary)' }}>{rec.totalTokens}</strong>
                    </td>
                    <td style={{ padding: '0.6rem 0.75rem', color: 'var(--color-success-text)', fontWeight: 'bold' }}>{rec.cost}</td>
                    <td style={{ padding: '0.6rem 0.75rem' }}>
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
                        <CheckCircle2 size={10} />
                        {rec.errorClassification}
                      </span>
                    </td>
                    <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text-secondary)', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={rec.response}>
                      {rec.response.slice(0, 140)}...
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
export default BenchmarkLab;
