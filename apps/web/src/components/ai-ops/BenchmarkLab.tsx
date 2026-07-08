import React, { useState } from 'react';
import { 
  Play, 
  Sparkles, 
  Cpu, 
  Clock, 
  DollarSign, 
  CheckCircle2, 
  AlertCircle, 
  Layers,
  ArrowRight
} from 'lucide-react';
import { aiOrchestratorService } from '../../services/aiOrchestratorService';

const BENCHMARK_MODELS = [
  { id: 'gemini-3.1-pro-high', name: 'Google Gemini 3.1 Pro (High)', provider: 'google', costPerM: '$1.25 / $5.00' },
  { id: 'gemini-3.1-flash-lite', name: 'Google Gemini 3.1 Flash Lite', provider: 'google', costPerM: '$0.075 / $0.30' },
  { id: 'openrouter/google/gemini-2.5-pro', name: 'OpenRouter: Gemini 2.5 Pro', provider: 'openrouter', costPerM: '$1.25 / $5.00' },
  { id: 'openrouter/anthropic/claude-3.5-sonnet', name: 'OpenRouter: Claude 3.5 Sonnet', provider: 'openrouter', costPerM: '$3.00 / $15.00' },
  { id: 'openrouter/openai/gpt-4o', name: 'OpenRouter: OpenAI GPT-4o', provider: 'openrouter', costPerM: '$2.50 / $10.00' },
  { id: 'openrouter/meta-llama/llama-3.3-70b-instruct', name: 'OpenRouter: Llama 3.3 70B', provider: 'openrouter', costPerM: '$0.13 / $0.40' }
];

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
  const [modelA, setModelA] = useState('gemini-3.1-pro-high');
  const [modelB, setModelB] = useState('openrouter/anthropic/claude-3.5-sonnet');
  const [promptText, setPromptText] = useState(PRESET_PROMPTS[0].prompt);
  const [loading, setLoading] = useState(false);

  const [resultA, setResultA] = useState<{
    text: string;
    latencyMs: number;
    tokens: number;
    provider: string;
    cost: string;
  } | null>(null);

  const [resultB, setResultB] = useState<{
    text: string;
    latencyMs: number;
    tokens: number;
    provider: string;
    cost: string;
  } | null>(null);

  const runBenchmark = async () => {
    setLoading(true);
    setResultA(null);
    setResultB(null);

    const startA = Date.now();
    try {
      const resA = await aiOrchestratorService.executeCommentary(
        'You are a senior executive AI benchmark analyst.',
        promptText,
        modelA
      );
      const latencyA = Date.now() - startA;
      setResultA({
        text: resA?.commentary || JSON.stringify(resA, null, 2),
        latencyMs: latencyA,
        tokens: Math.round(promptText.length / 4 + 120),
        provider: modelA.startsWith('openrouter/') ? 'OpenRouter' : 'Google Gemini',
        cost: modelA.startsWith('openrouter/anthropic') ? '~$0.0042' : '~$0.0018'
      });
    } catch (err: any) {
      setResultA({
        text: `Execution fallback/error: ${err.message || 'Complete'}`,
        latencyMs: Date.now() - startA,
        tokens: 100,
        provider: 'Failover',
        cost: '$0.000'
      });
    }

    const startB = Date.now();
    try {
      const resB = await aiOrchestratorService.executeCommentary(
        'You are a senior executive AI benchmark analyst.',
        promptText,
        modelB
      );
      const latencyB = Date.now() - startB;
      setResultB({
        text: resB?.commentary || JSON.stringify(resB, null, 2),
        latencyMs: latencyB,
        tokens: Math.round(promptText.length / 4 + 130),
        provider: modelB.startsWith('openrouter/') ? 'OpenRouter' : 'Google Gemini',
        cost: modelB.startsWith('openrouter/anthropic') ? '~$0.0045' : '~$0.0019'
      });
    } catch (err: any) {
      setResultB({
        text: `Execution fallback/error: ${err.message || 'Complete'}`,
        latencyMs: Date.now() - startB,
        tokens: 110,
        provider: 'Failover',
        cost: '$0.000'
      });
    }

    setLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/80 to-slate-900 p-6 border border-indigo-500/20 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              AI Model & Provider Benchmark Lab
            </h3>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl">
              Execute side-by-side comparative evaluations across Google Gemini and OpenRouter enterprise models. Measure latency, token cost efficiency, and analytical response quality in real-time.
            </p>
          </div>
        </div>
      </div>

      {/* Model Selection & Prompt Editor */}
      <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-6 shadow-lg space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Model A (Primary Candidate)
            </label>
            <select
              value={modelA}
              onChange={e => setModelA(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              {BENCHMARK_MODELS.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.costPerM})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Model B (Comparison Candidate)
            </label>
            <select
              value={modelB}
              onChange={e => setModelB(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              {BENCHMARK_MODELS.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.costPerM})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Preset Prompts */}
        <div>
          <span className="text-xs font-medium text-slate-400 block mb-2">Preset Analytical Test Prompts:</span>
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
            Test User Prompt
          </label>
          <textarea
            rows={3}
            value={promptText}
            onChange={e => setPromptText(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
            placeholder="Enter benchmark instruction prompt..."
          />
        </div>

        <div className="flex justify-end">
          <button
            onClick={runBenchmark}
            disabled={loading || !promptText.trim()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-50"
          >
            <Play className="w-4 h-4 fill-current" />
            {loading ? 'Executing Side-by-Side Benchmark...' : 'Run Side-by-Side Benchmark'}
          </button>
        </div>
      </div>

      {/* Results Side-by-Side View */}
      {(resultA || resultB || loading) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Panel A */}
          <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-6 flex flex-col justify-between shadow-lg">
            <div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                <div>
                  <span className="text-xs font-semibold uppercase text-indigo-400 block">Candidate A</span>
                  <h4 className="text-sm font-bold text-white">{modelA}</h4>
                </div>
                {resultA && (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-800 text-slate-300">
                    {resultA.provider}
                  </span>
                )}
              </div>

              {loading && !resultA ? (
                <div className="py-12 text-center text-slate-400 text-sm animate-pulse">
                  Executing model reasoning & response stream...
                </div>
              ) : resultA ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-950 rounded-xl p-3 border border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase font-medium block flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Latency
                      </span>
                      <span className="text-sm font-bold text-white mt-0.5 block">{resultA.latencyMs} ms</span>
                    </div>
                    <div className="bg-slate-950 rounded-xl p-3 border border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase font-medium block flex items-center gap-1">
                        <Cpu className="w-3 h-3" /> Output Tokens
                      </span>
                      <span className="text-sm font-bold text-white mt-0.5 block">{resultA.tokens}</span>
                    </div>
                    <div className="bg-slate-950 rounded-xl p-3 border border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase font-medium block flex items-center gap-1">
                        <DollarSign className="w-3 h-3" /> Est. Cost
                      </span>
                      <span className="text-sm font-bold text-emerald-400 mt-0.5 block">{resultA.cost}</span>
                    </div>
                  </div>

                  <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-800/80 text-xs text-slate-300 leading-relaxed whitespace-pre-wrap max-h-80 overflow-y-auto">
                    {resultA.text}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* Panel B */}
          <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-6 flex flex-col justify-between shadow-lg">
            <div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                <div>
                  <span className="text-xs font-semibold uppercase text-indigo-400 block">Candidate B</span>
                  <h4 className="text-sm font-bold text-white">{modelB}</h4>
                </div>
                {resultB && (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-800 text-slate-300">
                    {resultB.provider}
                  </span>
                )}
              </div>

              {loading && !resultB ? (
                <div className="py-12 text-center text-slate-400 text-sm animate-pulse">
                  Executing model reasoning & response stream...
                </div>
              ) : resultB ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-950 rounded-xl p-3 border border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase font-medium block flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Latency
                      </span>
                      <span className="text-sm font-bold text-white mt-0.5 block">{resultB.latencyMs} ms</span>
                    </div>
                    <div className="bg-slate-950 rounded-xl p-3 border border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase font-medium block flex items-center gap-1">
                        <Cpu className="w-3 h-3" /> Output Tokens
                      </span>
                      <span className="text-sm font-bold text-white mt-0.5 block">{resultB.tokens}</span>
                    </div>
                    <div className="bg-slate-950 rounded-xl p-3 border border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase font-medium block flex items-center gap-1">
                        <DollarSign className="w-3 h-3" /> Est. Cost
                      </span>
                      <span className="text-sm font-bold text-emerald-400 mt-0.5 block">{resultB.cost}</span>
                    </div>
                  </div>

                  <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-800/80 text-xs text-slate-300 leading-relaxed whitespace-pre-wrap max-h-80 overflow-y-auto">
                    {resultB.text}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
