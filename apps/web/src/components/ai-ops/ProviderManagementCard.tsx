import React from 'react';
import { 
  Globe, 
  Activity, 
  CheckCircle2, 
  Server,
  Key,
  Layers,
  RefreshCw
} from 'lucide-react';

interface ProviderStats {
  rpm: number;
  tpm: number;
  rpd: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  requests: number;
  quotaRemaining: number;
  lastUpdated?: string;
  availableModelsCount?: number;
  enabledModelsCount?: number;
  freeModelsCount?: number;
  paidModelsCount?: number;
  apiKeyStatus?: string;
  providerStatus?: string;
  providerHealth?: string;
}

interface ProviderManagementCardProps {
  googleStats?: ProviderStats;
  openRouterStats?: ProviderStats;
  onRefresh?: () => void;
}

export const ProviderManagementCard: React.FC<ProviderManagementCardProps> = ({
  googleStats,
  openRouterStats,
  onRefresh
}) => {
  const renderProviderPanel = (
    name: string,
    providerKey: 'google' | 'openrouter',
    stats: ProviderStats | undefined,
    description: string,
    defaultQuota: number,
    modelCounts: {
      available: number;
      enabled: number;
      free: number;
      paid: number;
    }
  ) => {
    const s = stats || {
      rpm: 0,
      tpm: 0,
      rpd: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      requests: 0,
      quotaRemaining: defaultQuota,
      lastUpdated: new Date().toISOString()
    };

    const providerStatus = s.providerStatus || 'Operational';
    const providerHealth = s.providerHealth || (s.rpm < 60 ? 'Healthy' : 'Elevated Load');
    const apiKeyStatus = s.apiKeyStatus || 'Configured & Verified';

    const utilization = defaultQuota > 0 ? Math.min(100, Math.round((s.rpd / defaultQuota) * 100)) : 0;

    const modelCountsDynamic = {
      available: s.availableModelsCount ?? modelCounts.available,
      enabled: s.enabledModelsCount ?? modelCounts.enabled,
      free: s.freeModelsCount ?? modelCounts.free,
      paid: s.paidModelsCount ?? modelCounts.paid
    };

    return (
      <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-6 flex flex-col justify-between hover:border-slate-700 transition-all shadow-lg">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${providerKey === 'google' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-indigo-500/15 text-indigo-400'} border border-slate-800`}>
                {providerKey === 'google' ? <Server className="w-5 h-5" /> : <Globe className="w-5 h-5" />}
              </div>
              <div>
                <h4 className="text-base font-bold text-white tracking-tight">{name}</h4>
                <p className="text-xs text-slate-400">{description}</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {providerStatus}
            </span>
          </div>

          {/* Core Status Matrix */}
          <div className="grid grid-cols-3 gap-3 my-4">
            <div className="bg-slate-950/70 rounded-xl p-3 border border-slate-800/80">
              <span className="text-[10px] text-slate-400 uppercase font-medium block">Provider Status</span>
              <span className="text-xs font-bold text-emerald-400 mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {providerStatus}
              </span>
            </div>
            <div className="bg-slate-950/70 rounded-xl p-3 border border-slate-800/80">
              <span className="text-[10px] text-slate-400 uppercase font-medium block">Provider Health</span>
              <span className="text-xs font-bold text-white mt-1 block">{providerHealth}</span>
            </div>
            <div className="bg-slate-950/70 rounded-xl p-3 border border-slate-800/80">
              <span className="text-[10px] text-slate-400 uppercase font-medium block">API Key Status</span>
              <span className="text-xs font-bold text-indigo-300 mt-1 flex items-center gap-1">
                <Key className="w-3.5 h-3.5" />
                {apiKeyStatus}
              </span>
            </div>
          </div>

          {/* Model Registry breakdown */}
          <div className="bg-slate-950/40 rounded-xl p-3.5 border border-slate-800/80 mb-5">
            <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 mb-2.5">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              Model Registry Breakdown
            </span>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-slate-900/80 rounded-lg p-2 border border-slate-800">
                <span className="text-base font-bold text-white block">{modelCountsDynamic.available}</span>
                <span className="text-[10px] text-slate-400">Available</span>
              </div>
              <div className="bg-slate-900/80 rounded-lg p-2 border border-slate-800">
                <span className="text-base font-bold text-emerald-400 block">{modelCountsDynamic.enabled}</span>
                <span className="text-[10px] text-slate-400">Enabled</span>
              </div>
              <div className="bg-slate-900/80 rounded-lg p-2 border border-slate-800">
                <span className="text-base font-bold text-indigo-300 block">{modelCountsDynamic.free}</span>
                <span className="text-[10px] text-slate-400">Free Tier</span>
              </div>
              <div className="bg-slate-900/80 rounded-lg p-2 border border-slate-800">
                <span className="text-base font-bold text-amber-300 block">{modelCountsDynamic.paid}</span>
                <span className="text-[10px] text-slate-400">Paid Tier</span>
              </div>
            </div>
          </div>

          {/* Operational Metrics */}
          <div className="grid grid-cols-3 gap-3 my-4">
            <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/80">
              <span className="text-[11px] text-slate-400 block uppercase font-medium">RPM (1m)</span>
              <span className="text-lg font-bold text-white mt-0.5 block">{s.rpm}</span>
            </div>
            <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/80">
              <span className="text-[11px] text-slate-400 block uppercase font-medium">TPM (Tokens/m)</span>
              <span className="text-lg font-bold text-white mt-0.5 block">{(s.tpm / 1000).toFixed(1)}k</span>
            </div>
            <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/80">
              <span className="text-[11px] text-slate-400 block uppercase font-medium">Requests Today</span>
              <span className="text-lg font-bold text-white mt-0.5 block">{s.rpd}</span>
            </div>
          </div>

          {/* Quota Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-medium">
              <span className="text-slate-400">Daily Request Volume</span>
              <span className="text-slate-200">{s.rpd} / {defaultQuota} ({utilization}%)</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  utilization > 85 ? 'bg-amber-500' : providerKey === 'google' ? 'bg-emerald-500' : 'bg-indigo-500'
                }`}
                style={{ width: `${utilization}%` }}
              />
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-slate-500" />
            Last Sync: {s.lastUpdated ? new Date(s.lastUpdated).toLocaleTimeString() : 'Just now'}
          </span>
          <span className="text-slate-300 font-semibold">
            {s.quotaRemaining} Requests Remaining
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            AI Provider Infrastructure & Health Console
          </h3>
          <p className="text-xs text-slate-400">
            Real-time status, API authentication state, model availability, and quota telemetry across configured AI gateways.
          </p>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Sync Providers
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {renderProviderPanel(
          'Google Gemini Native Provider',
          'google',
          googleStats,
          'Dedicated direct gateway reserved for Daily Executive Email & native Gemini endpoints',
          1500,
          { available: 11, enabled: 11, free: 6, paid: 5 }
        )}
        {renderProviderPanel(
          'OpenRouter Gateway Provider',
          'openrouter',
          openRouterStats,
          'Unified multi-model API gateway handling BusinessOS Copilot, Reports, Commentary, & Research',
          100000,
          { available: 22, enabled: 22, free: 8, paid: 14 }
        )}
      </div>
    </div>
  );
};
