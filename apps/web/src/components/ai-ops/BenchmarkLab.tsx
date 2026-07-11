import React, { useState } from 'react';
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

export interface BenchmarkModelOption {
  id: string;
  displayName: string;
  provider: 'Google Gemini' | 'OpenRouter';
  category: string;
  costPerM: string;
}

const REGISTERED_BENCHMARK_MODELS: BenchmarkModelOption[] = [
  { id: 'openrouter/free', displayName: 'OpenRouter: Free Router (Zero Cost)', provider: 'OpenRouter', category: 'Free', costPerM: '$0.00 / $0.00' },
  { id: 'gpt-oss-20b', displayName: 'OpenRouter: GPT-OSS 20B (Free)', provider: 'OpenRouter', category: 'Free', costPerM: '$0.00 / $0.00' },
  { id: 'gemini-3.1-pro-high', displayName: 'Google Gemini 3.1 Pro (High)', provider: 'Google Gemini', category: 'Flagship', costPerM: '$1.25 / $5.00' },
  { id: 'gemini-3.5-flash', displayName: 'Google Gemini 3.5 Flash', provider: 'Google Gemini', category: 'Fast', costPerM: '$0.075 / $0.30' },
  { id: 'gemini-3.1-flash-lite', displayName: 'Google Gemini 3.1 Flash Lite', provider: 'Google Gemini', category: 'Fast', costPerM: '$0.075 / $0.30' },
  { id: 'gpt-oss-120b', displayName: 'OpenRouter: GPT-OSS 120B', provider: 'OpenRouter', category: 'Flagship', costPerM: '$0.15 / $0.60' },
  { id: 'openrouter/google/gemini-2.5-pro', displayName: 'OpenRouter: Gemini 2.5 Pro', provider: 'OpenRouter', category: 'Pro', costPerM: '$1.25 / $5.00' },
  { id: 'openrouter/anthropic/claude-3.5-sonnet', displayName: 'OpenRouter: Claude 3.5 Sonnet', provider: 'OpenRouter', category: 'Flagship', costPerM: '$3.00 / $15.00' },
  { id: 'openrouter/openai/gpt-4o', displayName: 'OpenRouter: OpenAI GPT-4o', provider: 'OpenRouter', category: 'Flagship', costPerM: '$2.50 / $10.00' },
  { id: 'openrouter/meta-llama/llama-3.3-70b-instruct', displayName: 'OpenRouter: Llama 3.3 70B', provider: 'OpenRouter', category: 'Fast', costPerM: '$0.13 / $0.40' },
  { id: 'openrouter/deepseek/deepseek-r1', displayName: 'OpenRouter: DeepSeek R1', provider: 'OpenRouter', category: 'Reasoning', costPerM: '$0.55 / $2.19' }
];

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

export const BenchmarkLab: React.FC = () => {
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
    setSelectedModels(REGISTERED_BENCHMARK_MODELS.map(m => m.id));
  };

  const clearSelection = () => {
    setSelectedModels([]);
  };

  const runParallelBenchmark = async () => {
    if (selectedModels.length === 0 || !promptText.trim()) return;
    setLoading(true);
    setResults([]);

    const runModelBenchmark = async (modelId: string): Promise<BenchmarkRecord> => {
      const option = REGISTERED_BENCHMARK_MODELS.find(m => m.id === modelId) || {
        id: modelId,
        displayName: modelId,
        provider: modelId.startsWith('openrouter/') ? 'OpenRouter' : 'Google Gemini',
        category: 'Standard',
        costPerM: '$1.00 / $3.00'
      };

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
          provider: option.provider,
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
          provider: option.provider,
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
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/80 to-slate-900 p-6 border border-indigo-500/20 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              Parallel Multi-Model Benchmark Lab
            </h3>
            <p className="text-sm text-slate-300 mt-1 max-w-3xl">
              Execute identical analytical instructions concurrently across any number of registered AI models. Compare latency, token efficiency, response quality, and export structured datasets for ChatGPT analysis.
            </p>
          </div>

          {results.length > 0 && (
            <div className="flex items-center gap-3">
              <button
                onClick={downloadCSV}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
              >
                <FileText className="w-4 h-4 text-emerald-400" />
                Export CSV
              </button>
              <button
                onClick={downloadJSON}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
              >
                <FileJson className="w-4 h-4 text-indigo-400" />
                Export JSON
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Model Multi-Select & Prompt Editor */}
      <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-6 shadow-lg space-y-5">
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Select Candidate Models ({selectedModels.length} selected)
            </span>
            <div className="flex items-center gap-3 text-xs">
              <button
                onClick={selectAllModels}
                className="text-indigo-400 hover:text-indigo-300 font-medium"
              >
                Select All
              </button>
              <button
                onClick={clearSelection}
                className="text-slate-400 hover:text-slate-300 font-medium"
              >
                Clear Selection
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {REGISTERED_BENCHMARK_MODELS.map(model => {
              const isSelected = selectedModels.includes(model.id);
              return (
                <button
                  key={model.id}
                  onClick={() => toggleModelSelection(model.id)}
                  className={`flex items-center justify-between p-3.5 rounded-xl border transition-all text-left ${
                    isSelected
                      ? 'bg-indigo-500/15 border-indigo-500/50 text-white shadow-sm'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-600 flex-shrink-0" />
                    )}
                    <div>
                      <span className={`text-xs font-bold block ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                        {model.displayName}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {model.provider} • {model.category}
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
          <span className="text-xs font-medium text-slate-400 block mb-2">Preset Benchmark Instructions:</span>
          <div className="flex flex-wrap gap-2">
            {PRESET_PROMPTS.map((p, idx) => (
              <button
                key={idx}
                onClick={() => setPromptText(p.prompt)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Test Evaluation Prompt
          </label>
          <textarea
            rows={3}
            value={promptText}
            onChange={e => setPromptText(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
            placeholder="Enter instruction prompt for parallel execution across selected models..."
          />
        </div>

        <div className="flex justify-end">
          <button
            onClick={runParallelBenchmark}
            disabled={loading || selectedModels.length === 0 || !promptText.trim()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-50"
          >
            <Play className="w-4 h-4 fill-current" />
            {loading ? 'Executing Parallel Benchmark Suite...' : `Execute Benchmark Across ${selectedModels.length} Models`}
          </button>
        </div>
      </div>

      {/* Results Table & Cards */}
      {results.length > 0 && (
        <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 overflow-hidden shadow-lg">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">
              Parallel Execution Telemetry & Comparison Matrix
            </h4>
            <span className="text-xs text-slate-400">
              {results.length} model evaluations completed
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Provider</th>
                  <th className="py-3.5 px-4">Model ID</th>
                  <th className="py-3.5 px-4">Latency</th>
                  <th className="py-3.5 px-4">Tokens (P/C/Total)</th>
                  <th className="py-3.5 px-4">Est. Cost</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Response Output Preview</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {results.map((rec, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-4 px-4 font-semibold text-slate-300">
                      <span className="px-2.5 py-1 rounded-full text-[10px] bg-slate-800 border border-slate-700">
                        {rec.provider}
                      </span>
                    </td>
                    <td className="py-4 px-4 font-bold text-white">{rec.modelId}</td>
                    <td className="py-4 px-4 text-slate-300 font-mono">{rec.latencyMs} ms</td>
                    <td className="py-4 px-4 text-slate-300 font-mono">
                      {rec.promptTokens} / {rec.completionTokens} / <strong className="text-white">{rec.totalTokens}</strong>
                    </td>
                    <td className="py-4 px-4 text-emerald-400 font-semibold">{rec.cost}</td>
                    <td className="py-4 px-4">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3" />
                        {rec.errorClassification}
                      </span>
                    </td>
                    <td className="py-4 px-4 max-w-md text-slate-300 truncate">
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
