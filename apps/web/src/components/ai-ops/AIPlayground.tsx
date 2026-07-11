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
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/80 to-slate-900 p-6 border border-indigo-500/20 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Terminal className="w-5 h-5 text-indigo-400" />
              Interactive AI Prompt Engineering Playground
            </h3>
            <p className="text-sm text-slate-300 mt-1 max-w-3xl">
              Fine-tune system instructions, adjust sampling hyperparameters (Temperature, Top P, Max Tokens), and evaluate reasoning output simultaneously across single or multiple AI models.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Prompt Editors */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-6 shadow-lg space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2 flex items-center justify-between">
                <span>System Prompt (Instructions & Persona)</span>
                <span className="text-[11px] text-slate-500 font-normal">Controls model behavior</span>
              </label>
              <textarea
                rows={3}
                value={systemPrompt}
                onChange={e => setSystemPrompt(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                placeholder="Enter system prompt instructions..."
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2 flex items-center justify-between">
                <span>User Input Prompt</span>
                <span className="text-[11px] text-slate-500 font-normal">Primary evaluation task</span>
              </label>
              <textarea
                rows={5}
                value={userPrompt}
                onChange={e => setUserPrompt(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                placeholder="Enter user prompt or input payload..."
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={executePlayground}
                disabled={loading || !userPrompt.trim()}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-50"
              >
                <Play className="w-4 h-4 fill-current" />
                {loading ? 'Executing Across Selected Models...' : 'Run Prompt Suite'}
              </button>
            </div>
          </div>
        </div>

        {/* Right 1 Column: Hyperparameters & Model Selection */}
        <div className="space-y-6">
          <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-6 shadow-lg space-y-5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2 border-b border-slate-800 pb-3">
              <Settings2 className="w-4 h-4 text-indigo-400" />
              Sampling Hyperparameters
            </h4>

            <div>
              <div className="flex justify-between text-xs mb-1.5 font-medium">
                <span className="text-slate-300">Temperature</span>
                <span className="text-indigo-400 font-mono">{temperature.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={1.5}
                step={0.05}
                value={temperature}
                onChange={e => setTemperature(parseFloat(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
              />
              <span className="text-[10px] text-slate-500 block mt-1">Lower is deterministic, higher is creative</span>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5 font-medium">
                <span className="text-slate-300">Top P (Nucleus Sampling)</span>
                <span className="text-indigo-400 font-mono">{topP.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0.1}
                max={1.0}
                step={0.05}
                value={topP}
                onChange={e => setTopP(parseFloat(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5 font-medium">
                <span className="text-slate-300">Max Tokens</span>
                <span className="text-indigo-400 font-mono">{maxTokens}</span>
              </div>
              <input
                type="range"
                min={256}
                max={8192}
                step={256}
                value={maxTokens}
                onChange={e => setMaxTokens(parseInt(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
              />
            </div>

            <div className="border-t border-slate-800 pt-4">
              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3">
                Target Models ({selectedModels.length})
              </h5>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {playgroundModels.map(mod => {
                  const active = selectedModels.includes(mod.id);
                  const providerName = mod.provider === 'google' ? 'Google Gemini' : 'OpenRouter';
                  return (
                    <button
                      key={mod.id}
                      onClick={() => toggleModel(mod.id)}
                      className={`w-full text-left p-2.5 rounded-xl border text-xs transition-all flex items-center justify-between ${
                        active
                          ? 'bg-indigo-500/15 border-indigo-500/50 text-white'
                          : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="truncate pr-2">
                        <span className="font-bold block truncate">{mod.displayName}</span>
                        <span className="text-[10px] text-slate-400">{providerName}</span>
                      </div>
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${active ? 'bg-indigo-400' : 'bg-slate-700'}`} />
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
        <div className="space-y-4">
          <h4 className="text-sm font-bold text-white uppercase tracking-wider">
            Evaluation Output & Complete Telemetry
          </h4>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {results.map((r, idx) => (
              <div key={idx} className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-6 flex flex-col justify-between shadow-lg">
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 block">
                        {r.provider}
                      </span>
                      <h5 className="text-sm font-bold text-white">{r.modelId}</h5>
                    </div>
                    <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-slate-800 text-slate-300">
                      {r.latencyMs} ms
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-slate-950 rounded-xl p-2.5 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block uppercase">Prompt Tokens</span>
                      <span className="font-bold text-white">{r.promptTokens}</span>
                    </div>
                    <div className="bg-slate-950 rounded-xl p-2.5 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block uppercase">Output Tokens</span>
                      <span className="font-bold text-white">{r.completionTokens}</span>
                    </div>
                    <div className="bg-slate-950 rounded-xl p-2.5 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block uppercase">Total Tokens</span>
                      <span className="font-bold text-indigo-300">{r.totalTokens}</span>
                    </div>
                  </div>

                  <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-800/80 text-xs text-slate-300 font-mono leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto">
                    {r.output}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
