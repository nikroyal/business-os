import React, { useState } from 'react';
import type { ModelMetadataWithStats, OrchestratorConfig } from '../services/aiOrchestratorService';
import { ArrowUp, ArrowDown, Save, CheckCircle, AlertCircle, Move, Zap, Shield, Eye, EyeOff } from 'lucide-react';

interface FallbackPriorityEditorProps {
  models: ModelMetadataWithStats[];
  config: OrchestratorConfig;
  isOwner: boolean;
  onSaveConfig: (newConfig: OrchestratorConfig) => Promise<boolean>;
  onUpdateConfig: (newConfig: OrchestratorConfig) => void;
}

const NUMBER_BALLS = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];

export const FallbackPriorityEditor: React.FC<FallbackPriorityEditorProps> = ({
  models,
  config,
  isOwner,
  onSaveConfig,
  onUpdateConfig
}) => {
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [draggedItem, setDraggedItem] = useState<{ category: 'flash' | 'pro'; index: number } | null>(null);

  // Derive current Flash and Pro chains
  const defaultFlashOrder = ["gemini-3.5-flash", "gemini-2.5-flash", "gemini-3.1-flash-lite", "gemini-2.5-flash-lite", "gemini-flash-latest"];
  const defaultProOrder = ["gemini-3.1-pro-preview", "gemini-2.5-pro", "gemini-3.5-flash", "gemini-2.5-flash", "gemini-pro-latest"];

  const flashOrder: string[] = config.flashFallbackOrder && config.flashFallbackOrder.length > 0
    ? config.flashFallbackOrder
    : defaultFlashOrder;

  const proOrder: string[] = config.proFallbackOrder && config.proFallbackOrder.length > 0
    ? config.proFallbackOrder
    : defaultProOrder;

  const getModelObj = (id: string) => models.find(m => m.id === id) || {
    id,
    displayName: id.replace(/-/g, ' ').toUpperCase(),
    category: id.includes('pro') ? 'Pro' : 'Flash',
    enabled: true,
    capabilityScore: 90,
    speedScore: 90,
    status: 'production'
  } as ModelMetadataWithStats;

  const handleMove = (category: 'flash' | 'pro', fromIndex: number, toIndex: number) => {
    if (!isOwner) return;
    const currentList = category === 'flash' ? [...flashOrder] : [...proOrder];
    if (toIndex < 0 || toIndex >= currentList.length || fromIndex === toIndex) return;

    const [moved] = currentList.splice(fromIndex, 1);
    currentList.splice(toIndex, 0, moved);

    const newConfig = {
      ...config,
      flashFallbackOrder: category === 'flash' ? currentList : flashOrder,
      proFallbackOrder: category === 'pro' ? currentList : proOrder
    };
    onUpdateConfig(newConfig);
    setSaveMessage(null);
  };

  const handleToggleEnable = (modelId: string) => {
    if (!isOwner) return;
    const modelObj = getModelObj(modelId);
    const mConfig = config.modelOverrides?.[modelId] || {};
    const currentlyEnabled = mConfig.enabled !== undefined ? mConfig.enabled : (modelObj.enabled !== undefined ? modelObj.enabled : true);

    const newOverrides = {
      ...(config.modelOverrides || {}),
      [modelId]: {
        ...mConfig,
        enabled: !currentlyEnabled
      }
    };

    onUpdateConfig({
      ...config,
      modelOverrides: newOverrides
    });
    setSaveMessage(null);
  };

  const handleSave = async () => {
    if (!isOwner) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      const success = await onSaveConfig({
        ...config,
        flashFallbackOrder: flashOrder,
        proFallbackOrder: proOrder
      });
      if (success) {
        setSaveMessage({
          type: 'success',
          text: 'Fallback priorities saved to Firestore! The Orchestrator is immediately using this chain.'
        });
      } else {
        setSaveMessage({
          type: 'error',
          text: 'Failed to save fallback priorities to server.'
        });
      }
    } catch (err: any) {
      setSaveMessage({
        type: 'error',
        text: err.message || 'Error saving priorities.'
      });
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMessage(null), 6000);
    }
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, category: 'flash' | 'pro', index: number) => {
    if (!isOwner) return;
    setDraggedItem({ category, index });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetCategory: 'flash' | 'pro', targetIndex: number) => {
    e.preventDefault();
    if (!draggedItem || draggedItem.category !== targetCategory) return;
    handleMove(targetCategory, draggedItem.index, targetIndex);
    setDraggedItem(null);
  };

  const renderList = (category: 'flash' | 'pro', title: string, subtitle: string, list: string[], icon: React.ReactNode) => (
    <div className="card" style={{
      flex: 1,
      minWidth: '320px',
      background: '#fff',
      border: '1px solid #E2DACD',
      borderRadius: '8px',
      padding: '1.25rem',
      boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
        {icon}
        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--text-primary)', fontFamily: 'var(--font-serif)' }}>
          {title}
        </h4>
      </div>
      <p style={{ margin: '0 0 1rem 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
        {subtitle}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {list.map((modelId, index) => {
          const model = getModelObj(modelId);
          const mConfig = config.modelOverrides?.[modelId] || {};
          const isEnabled = mConfig.enabled !== undefined ? mConfig.enabled : (model.enabled !== undefined ? model.enabled : true);
          const numBall = NUMBER_BALLS[index] || `(${index + 1})`;
          const isBeingDragged = draggedItem?.category === category && draggedItem?.index === index;

          return (
            <div
              key={modelId}
              draggable={isOwner}
              onDragStart={(e) => handleDragStart(e, category, index)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, category, index)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.65rem 0.85rem',
                background: isBeingDragged ? '#F4F0EA' : isEnabled ? '#FCFAF6' : '#F8F6F0',
                border: isBeingDragged ? '1px dashed var(--color-primary)' : '1px solid #E2DACD',
                borderRadius: '6px',
                opacity: isEnabled ? 1 : 0.55,
                transition: 'all 0.15s ease',
                cursor: isOwner ? 'grab' : 'default',
                position: 'relative'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                {isOwner && (
                  <Move size={14} style={{ color: '#C4B9A7', cursor: 'grab', flexShrink: 0 }} title="Drag to reorder" />
                )}
                <span style={{ fontSize: '1rem', color: isEnabled ? 'var(--color-primary)' : '#888', fontWeight: 'bold' }}>
                  {numBall}
                </span>
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    {model.displayName}
                    {model.status === 'preview' && (
                      <span style={{ fontSize: '0.55rem', background: '#a855f718', border: '1px solid #a855f733', color: '#a855f7', padding: '1px 4px', borderRadius: '3px' }}>
                        PREVIEW
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                    {modelId} • Cap: {model.capabilityScore || 'N/A'} • Spd: {model.speedScore || 'N/A'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                {isOwner && (
                  <>
                    <button
                      onClick={() => handleToggleEnable(modelId)}
                      title={isEnabled ? "Disable in fallback chain" : "Enable in fallback chain"}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: isEnabled ? '#10b981' : '#ef4444',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '4px'
                      }}
                    >
                      {isEnabled ? <Eye size={15} /> : <EyeOff size={15} />}
                    </button>
                    <div style={{ width: '1px', height: '16px', background: '#E2DACD', margin: '0 2px' }} />
                    <button
                      onClick={() => handleMove(category, index, index - 1)}
                      disabled={index === 0}
                      title="Move Up"
                      style={{
                        background: '#fff',
                        border: '1px solid #C4B9A7',
                        color: index === 0 ? '#CCC' : 'var(--text-primary)',
                        borderRadius: '4px',
                        padding: '3px 6px',
                        cursor: index === 0 ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <ArrowUp size={13} />
                    </button>
                    <button
                      onClick={() => handleMove(category, index, index + 1)}
                      disabled={index === list.length - 1}
                      title="Move Down"
                      style={{
                        background: '#fff',
                        border: '1px solid #C4B9A7',
                        color: index === list.length - 1 ? '#CCC' : 'var(--text-primary)',
                        borderRadius: '4px',
                        padding: '3px 6px',
                        cursor: index === list.length - 1 ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <ArrowDown size={13} />
                    </button>
                  </>
                )}
                {!isOwner && (
                  <span style={{ fontSize: '0.65rem', fontWeight: 'bold', color: isEnabled ? '#10b981' : '#ef4444', textTransform: 'uppercase' }}>
                    {isEnabled ? 'Active' : 'Disabled'}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
        background: 'linear-gradient(135deg, #1e1b18 0%, #2d2822 100%)',
        color: '#fff',
        padding: '1.25rem 1.5rem',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
      }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontFamily: 'var(--font-serif)', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fcfaf6' }}>
            <Zap size={18} style={{ color: '#f59e0b' }} /> Visual Fallback Priority Editor
          </h3>
          <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.75rem', color: '#c4b9a7', maxWidth: '650px' }}>
            Drag and drop models or use move arrows to customize the runtime failover chain. When a primary model experiences rate-limits or errors, the orchestrator instantly cascades down this exact priority sequence.
          </p>
        </div>

        {isOwner ? (
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              background: 'var(--color-primary)',
              color: '#fff',
              border: 'none',
              padding: '0.6rem 1.2rem',
              borderRadius: '6px',
              fontWeight: 'bold',
              fontSize: '0.8rem',
              cursor: saving ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
            }}
          >
            <Save size={15} />
            {saving ? 'Saving to Firestore...' : 'Save Priorities & Config'}
          </button>
        ) : (
          <div style={{ fontSize: '0.75rem', color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '0.4rem 0.8rem', borderRadius: '4px', border: '1px solid rgba(245,158,11,0.3)' }}>
            Owner access required to edit fallback priority chain.
          </div>
        )}
      </div>

      {saveMessage && (
        <div style={{
          padding: '0.75rem 1rem',
          borderRadius: '6px',
          background: saveMessage.type === 'success' ? '#ecfdf5' : '#fef2f2',
          border: `1px solid ${saveMessage.type === 'success' ? '#10b981' : '#ef4444'}`,
          color: saveMessage.type === 'success' ? '#065f46' : '#991b1b',
          fontSize: '0.8rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          {saveMessage.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {saveMessage.text}
        </div>
      )}

      <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
        {renderList(
          'flash',
          'Automatic (Flash Tasks)',
          'Default chain for Editorial Commentary, Copilot chat, and fast queries.',
          flashOrder,
          <Zap size={16} style={{ color: '#06b6d4' }} />
        )}
        {renderList(
          'pro',
          'Pro Tasks Chain',
          'Default chain for Deep Research, Comprehensive Reports, and Complex Analysis.',
          proOrder,
          <Shield size={16} style={{ color: '#a855f7' }} />
        )}
      </div>
    </div>
  );
};
