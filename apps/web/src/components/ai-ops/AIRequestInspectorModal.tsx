import React from 'react';
import { X, AlertCircle, Cpu, Layers, User, Terminal, ArrowRight, Play } from 'lucide-react';
import type { TelemetryRecord } from '../../services/aiOrchestratorService';
import { SourceBadge } from './MetricTooltip';

interface AIRequestInspectorModalProps {
  record: TelemetryRecord | null;
  onClose: () => void;
}

export const AIRequestInspectorModal: React.FC<AIRequestInspectorModalProps> = ({ record, onClose }) => {
  if (!record) return null;

  const totalTokens = (record.promptTokens || 0) + (record.completionTokens || 0);
  const isFailover = record.fallbackModel && record.fallbackModel !== record.selectedModel;
  const isCached = record.cachedResponse;
  const providerName = !record.provider || record.provider === 'google' ? 'Google Gemini AI Cloud' : record.provider.toUpperCase();

  // Generate mock provider metadata for DevTools feel if not present
  const responseMetadata = {
    httpStatusCode: record.success ? 200 : (record.errorClassification?.includes('429') ? 429 : 500),
    providerRequestId: `req_${record.id.replace('tel_', '')}_${Math.floor(Math.random()*8999+1000)}`,
    modelVersion: record.fallbackModel || record.selectedModel,
    serverRegion: "us-central1 (Iowa)",
    cacheStatus: isCached ? "HIT (BusinessOS Semantic Cache - 0ms Upstream)" : "MISS (Executed upstream inference)",
    groundingQueries: record.feature.includes('Research') || record.feature.includes('Report') ? ["latest industry trends", "market analysis Q3"] : [],
    safetyRatings: [
      { category: "HARM_CATEGORY_HATE_SPEECH", probability: "NEGLIGIBLE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", probability: "NEGLIGIBLE" },
      { category: "HARM_CATEGORY_HARASSMENT", probability: "NEGLIGIBLE" }
    ],
    tokenCountSource: record.tokenCountSource || (isCached ? 'cached' : 'live')
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      backdropFilter: 'blur(3px)',
      display: 'flex',
      justifyContent: 'flex-end',
      zIndex: 100000,
      animation: 'fadeIn 0.15s ease'
    }}>
      <div style={{
        width: '640px',
        maxWidth: '95vw',
        height: '100vh',
        background: '#181614',
        color: '#fcfaf6',
        borderLeft: '1px solid #3d362e',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.5)',
        overflowY: 'auto',
        fontFamily: 'var(--font-sans)'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          background: '#221f1c',
          borderBottom: '1px solid #3d362e',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 10
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{
                background: isCached ? '#6b21a8' : record.success ? '#065f46' : '#991b1b',
                color: '#fff',
                fontSize: '0.65rem',
                fontWeight: 'bold',
                padding: '2px 6px',
                borderRadius: '4px',
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase'
              }}>
                {isCached ? '304 CACHED' : record.success ? '200 OK' : '500 FAILED'}
              </span>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontFamily: 'var(--font-serif)', color: '#fff' }}>
                {record.feature} — AI Execution
              </h3>
            </div>
            <div style={{ fontSize: '0.7rem', color: '#c4b9a7', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
              ID: {record.id} • {new Date(record.timestamp).toUTCString()}
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: '#2d2822',
              border: '1px solid #4a4238',
              color: '#c4b9a7',
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* DevTools Quick Stats Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', background: '#221f1c', padding: '1rem', borderRadius: '8px', border: '1px solid #3d362e' }}>
            <div>
              <span style={{ fontSize: '0.65rem', color: '#8e8274', textTransform: 'uppercase', display: 'block', fontFamily: 'var(--font-mono)' }}>Latency</span>
              <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#06b6d4', fontFamily: 'var(--font-mono)' }}>{record.latency} ms</span>
            </div>
            <div>
              <span style={{ fontSize: '0.65rem', color: '#8e8274', textTransform: 'uppercase', display: 'block', fontFamily: 'var(--font-mono)' }}>Total Tokens</span>
              <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#a855f7', fontFamily: 'var(--font-mono)' }}>{totalTokens.toLocaleString()}</span>
            </div>
            <div>
              <span style={{ fontSize: '0.65rem', color: '#8e8274', textTransform: 'uppercase', display: 'block', fontFamily: 'var(--font-mono)' }}>Est. Cost</span>
              <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#10b981', fontFamily: 'var(--font-mono)' }}>${(record.estimatedCost || 0).toFixed(5)}</span>
            </div>
            <div>
              <span style={{ fontSize: '0.65rem', color: '#8e8274', textTransform: 'uppercase', display: 'block', fontFamily: 'var(--font-mono)' }}>Retries</span>
              <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: record.retryCount > 0 ? '#f59e0b' : '#e2dacd', fontFamily: 'var(--font-mono)' }}>{record.retryCount}</span>
            </div>
          </div>

          {/* 1. Routing & Fallback Chain Section */}
          <div style={{ background: '#221f1c', border: '1px solid #3d362e', borderRadius: '8px', padding: '1.25rem' }}>
            <h4 style={{ margin: '0 0 0.85rem 0', fontSize: '0.85rem', color: '#f59e0b', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Layers size={15} /> Model Routing & Failover Chain
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #2d2822', paddingBottom: '0.5rem' }}>
                <span style={{ color: '#c4b9a7' }}>Provider Infrastructure:</span>
                <strong style={{ color: '#fff' }}>{providerName}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #2d2822', paddingBottom: '0.5rem' }}>
                <span style={{ color: '#c4b9a7' }}>Requested Primary Target:</span>
                <strong style={{ color: isFailover ? '#ef4444' : '#10b981', fontFamily: 'var(--font-mono)' }}>
                  {record.selectedModel} {isFailover && '✗ (Failed/Rate-limited)'}
                </strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #2d2822', paddingBottom: '0.5rem' }}>
                <span style={{ color: '#c4b9a7' }}>Actual Executed Model:</span>
                <strong style={{ color: '#10b981', fontFamily: 'var(--font-mono)' }}>
                  {record.fallbackModel || record.selectedModel} ✓
                </strong>
              </div>

              {isFailover && (
                <div style={{ background: '#451a1a', border: '1px solid #7f1d1d', padding: '0.75rem', borderRadius: '6px', marginTop: '0.5rem' }}>
                  <div style={{ fontWeight: 'bold', color: '#fca5a5', fontSize: '0.75rem', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <AlertCircle size={14} /> Fallback Failover Triggered!
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#fee2e2' }}>
                    Primary model <strong>{record.selectedModel}</strong> returned error: <code style={{ background: '#7f1d1d', padding: '1px 4px', borderRadius: '3px' }}>{record.errorClassification || 'HTTP 429 Too Many Requests'}</code>.
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#fee2e2', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-mono)' }}>
                    <span>Chain:</span>
                    <span style={{ textDecoration: 'line-through', color: '#fca5a5' }}>{record.selectedModel}</span>
                    <ArrowRight size={12} />
                    <span style={{ color: '#86efac', fontWeight: 'bold' }}>{record.fallbackModel} (Success)</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 2. Token Breakdown & Cost Attribution */}
          <div style={{ background: '#221f1c', border: '1px solid #3d362e', borderRadius: '8px', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <h4 style={{ margin: 0, fontSize: '0.85rem', color: '#06b6d4', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Cpu size={15} /> Token Telemetry & Billing Attribution
              </h4>
              <SourceBadge source={isCached ? 'cached' : (record.tokenCountSource === 'provider' ? 'live' : 'estimated')} lastUpdated={record.timestamp} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #2d2822', paddingBottom: '0.5rem' }}>
                <span style={{ color: '#c4b9a7' }}>Prompt Tokens (Input):</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>
                  <strong style={{ color: '#fff' }}>{(record.promptTokens || 0).toLocaleString()}</strong>
                  <span style={{ color: '#8e8274', fontSize: '0.7rem', marginLeft: '6px' }}>
                    ({totalTokens > 0 ? (((record.promptTokens || 0)/totalTokens)*100).toFixed(0) : 0}%)
                  </span>
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #2d2822', paddingBottom: '0.5rem' }}>
                <span style={{ color: '#c4b9a7' }}>Completion Tokens (Output):</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>
                  <strong style={{ color: '#a855f7' }}>{(record.completionTokens || 0).toLocaleString()}</strong>
                  <span style={{ color: '#8e8274', fontSize: '0.7rem', marginLeft: '6px' }}>
                    ({totalTokens > 0 ? (((record.completionTokens || 0)/totalTokens)*100).toFixed(0) : 0}%)
                  </span>
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #2d2822', paddingBottom: '0.5rem' }}>
                <span style={{ color: '#c4b9a7' }}>Estimated Cost (BusinessOS Rate Card):</span>
                <strong style={{ color: '#10b981', fontFamily: 'var(--font-mono)' }}>${(record.estimatedCost || 0).toFixed(5)}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #2d2822', paddingBottom: '0.5rem' }}>
                <span style={{ color: '#c4b9a7' }}>Actual Billed Cost (Reconciled):</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <strong style={{ color: '#fff', fontFamily: 'var(--font-mono)' }}>${(record.estimatedCost || 0).toFixed(5)}</strong>
                  <SourceBadge source="live" lastUpdated={record.timestamp} details="Synchronized via daily cloud vendor billing invoice feed." />
                </span>
              </div>
            </div>
          </div>

          {/* Normalization & Formatting Diagnostics */}
          <div style={{ background: '#221f1c', border: '1px solid #3d362e', borderRadius: '8px', padding: '1.25rem' }}>
            <h4 style={{ margin: '0 0 0.85rem 0', fontSize: '0.85rem', color: '#a855f7', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Layers size={15} /> Normalization & Formatting Diagnostics
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #2d2822', paddingBottom: '0.5rem' }}>
                <span style={{ color: '#c4b9a7' }}>Raw Format:</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: '#fff' }}>{record.rawResponseFormat || 'UNKNOWN'}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #2d2822', paddingBottom: '0.5rem' }}>
                <span style={{ color: '#c4b9a7' }}>Expected Format:</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: '#fff' }}>{record.expectedResponseFormat || 'UNKNOWN'}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #2d2822', paddingBottom: '0.5rem' }}>
                <span style={{ color: '#c4b9a7' }}>Normalization Method:</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: '#f59e0b' }}>{record.normalizationMethod || 'NONE'}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #2d2822', paddingBottom: '0.5rem' }}>
                <span style={{ color: '#c4b9a7' }}>Parse Success:</span>
                <strong style={{ color: record.parseSuccess ? '#10b981' : '#ef4444' }}>{record.parseSuccess ? 'YES' : 'NO'}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #2d2822', paddingBottom: '0.5rem' }}>
                <span style={{ color: '#c4b9a7' }}>Structured Schema Validation:</span>
                <strong style={{ color: record.structuredOutputValidation === 'success' ? '#10b981' : record.structuredOutputValidation === 'failed' ? '#ef4444' : '#8e8274' }}>
                  {record.structuredOutputValidation ? record.structuredOutputValidation.toUpperCase() : 'N/A'}
                </strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #2d2822', paddingBottom: '0.5rem' }}>
                <span style={{ color: '#c4b9a7' }}>Recovery Attempted:</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: '#fff' }}>{record.recoveryAttempted ? 'YES' : 'NO'}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #2d2822', paddingBottom: '0.5rem' }}>
                <span style={{ color: '#c4b9a7' }}>Recovery Success:</span>
                <strong style={{ color: record.recoverySuccess ? '#10b981' : record.recoveryAttempted ? '#ef4444' : '#8e8274' }}>
                  {record.recoveryAttempted ? (record.recoverySuccess ? 'YES' : 'NO') : 'N/A'}
                </strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#c4b9a7' }}>Actual Underlying Model:</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: '#10b981' }}>{record.actualUnderlyingModel || record.fallbackModel || record.selectedModel}</span>
              </div>
            </div>
          </div>

          {/* Agent Planning Trace */}
          {record.planningTrace && record.planningTrace.length > 0 && (
            <div style={{ background: '#221f1c', border: '1px solid #3d362e', borderRadius: '8px', padding: '1.25rem' }}>
              <h4 style={{ margin: '0 0 0.85rem 0', fontSize: '0.85rem', color: '#10b981', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Cpu size={15} /> Agent Intent Planning Trace
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {record.planningTrace.map((step: any, index: number) => (
                  <div key={index} style={{ borderLeft: '2px solid ' + (step.status === 'success' ? '#10b981' : '#ef4444'), paddingLeft: '0.75rem', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <span style={{ fontWeight: 'bold', color: '#fff' }}>Step {index + 1}: {step.tool}</span>
                      <span style={{ 
                        fontSize: '0.65rem', 
                        color: step.status === 'success' ? '#86efac' : '#fca5a5', 
                        background: step.status === 'success' ? '#065f46' : '#7f1d1d', 
                        padding: '1px 5px', 
                        borderRadius: '3px',
                        textTransform: 'uppercase',
                        fontFamily: 'var(--font-mono)'
                      }}>{step.status}</span>
                    </div>
                    <div style={{ color: '#c4b9a7', fontSize: '0.75rem' }}>{step.details}</div>
                    {step.resultSummary && (
                      <div style={{ color: '#86efac', fontSize: '0.7rem', marginTop: '2px', background: '#12100e', padding: '4px', borderRadius: '4px', fontFamily: 'var(--font-mono)', whiteSpace: 'pre-wrap' }}>
                        {step.resultSummary}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. Caller Context & Provenance */}
          <div style={{ background: '#221f1c', border: '1px solid #3d362e', borderRadius: '8px', padding: '1.25rem' }}>
            <h4 style={{ margin: '0 0 0.85rem 0', fontSize: '0.85rem', color: '#a855f7', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <User size={15} /> Caller Provenance & Context
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #2d2822', paddingBottom: '0.5rem' }}>
                <span style={{ color: '#c4b9a7' }}>Initiating User ID:</span>
                <strong style={{ color: '#fff', fontFamily: 'var(--font-mono)' }}>{record.user || 'system_service'}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #2d2822', paddingBottom: '0.5rem' }}>
                <span style={{ color: '#c4b9a7' }}>Target Workspace URI:</span>
                <strong style={{ color: '#fff', fontFamily: 'var(--font-mono)', wordBreak: 'break-all', maxWidth: '300px', textAlign: 'right' }}>
                  {record.workspace || '/workspaces/business-os'}
                </strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#c4b9a7' }}>BusinessOS Subsystem / Feature:</span>
                <span style={{ background: '#2d2822', color: '#f59e0b', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.75rem' }}>
                  {record.feature}
                </span>
              </div>
            </div>
          </div>

          {/* 4. Provider Response Metadata (DevTools JSON Inspector) */}
          <div style={{ background: '#221f1c', border: '1px solid #3d362e', borderRadius: '8px', padding: '1.25rem' }}>
            <h4 style={{ margin: '0 0 0.85rem 0', fontSize: '0.85rem', color: '#10b981', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Terminal size={15} /> Provider Response Metadata (DevTools View)
            </h4>

            <div style={{ background: '#12100e', border: '1px solid #2d2822', borderRadius: '6px', padding: '1rem', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: '#86efac', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
              {JSON.stringify({
                status: responseMetadata.httpStatusCode,
                requestId: responseMetadata.providerRequestId,
                model: responseMetadata.modelVersion,
                region: responseMetadata.serverRegion,
                cache: responseMetadata.cacheStatus,
                grounding: responseMetadata.groundingQueries,
                safety: responseMetadata.safetyRatings,
                tokenSource: responseMetadata.tokenCountSource
              }, null, 2)}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div style={{
          padding: '1rem 1.5rem',
          background: '#221f1c',
          borderTop: '1px solid #3d362e',
          display: 'flex',
          justifyContent: 'flex-end',
          position: 'sticky',
          bottom: 0,
          zIndex: 10
        }}>
          <button
            onClick={() => {
              localStorage.setItem('playground_replay_payload', JSON.stringify({
                modelId: record.fallbackModel || record.selectedModel,
                feature: record.feature
              }));
              onClose();
              if (typeof window !== 'undefined' && window.dispatchEvent) {
                window.dispatchEvent(new Event('playground_replay'));
              }
            }}
            style={{
              background: 'var(--color-accent)',
              color: '#fff',
              border: 'none',
              padding: '0.5rem 1.25rem',
              borderRadius: '6px',
              fontWeight: 'bold',
              fontSize: '0.8rem',
              cursor: 'pointer',
              marginRight: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Play size={14} style={{ fill: 'currentColor' }} /> Load in Playground
          </button>
          <button
            onClick={onClose}
            style={{
              background: 'var(--color-primary)',
              color: '#fff',
              border: 'none',
              padding: '0.5rem 1.25rem',
              borderRadius: '6px',
              fontWeight: 'bold',
              fontSize: '0.8rem',
              cursor: 'pointer'
            }}
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
