import React from 'react';
import { 
  Cpu, 
  Globe, 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  Zap, 
  TrendingUp, 
  ShieldCheck,
  Server
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
  lastUpdated: string;
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
    badgeColor: string,
    description: string,
    defaultQuota: number
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

    const isHealthy = s.rpm < 60;
    const utilization = defaultQuota > 0 ? Math.min(100, Math.round((s.rpd / defaultQuota) * 100)) : 0;

    return (
      <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-6 flex flex-col justify-between hover:border-slate-700 transition-all shadow-lg">
        <div>
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
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
              isHealthy 
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isHealthy ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              {isHealthy ? 'Operational' : 'Elevated Load'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 my-5">
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
              <span className="text-slate-400">Daily Quota Utilization</span>
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
            Multi-Provider AI Infrastructure & Telemetry
          </h3>
          <p className="text-xs text-slate-400">
            Real-time status, quota consumption, and operational metrics for integrated AI providers.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {renderProviderPanel(
          'Google Gemini Native Tier',
          'google',
          googleStats,
          'emerald',
          'Dedicated connection for Daily Executive Email & native Gemini 3.1 Pro models',
          1500
        )}
        {renderProviderPanel(
          'OpenRouter Enterprise Tier',
          'openrouter',
          openRouterStats,
          'indigo',
          'Primary gateway for multi-model intelligence (Claude 3.5 Sonnet, GPT-4o, Gemini 2.5 Pro)',
          100000
        )}
      </div>
    </div>
  );
};
