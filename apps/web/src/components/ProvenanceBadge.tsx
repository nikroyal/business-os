import React from 'react';
import { Shield, ShieldAlert, ShieldCheck } from 'lucide-react';

export interface ProvenanceBadgeProps {
  category: 'Real Market Data' | 'Derived Analytics' | 'Regulatory Filings' | 'News Intelligence' | 'Macro Data' | 'AI Commentary' | 'User Data';
  source: string;
  timestamp: string;
  confidence: 'High' | 'Medium' | 'Low';
  style?: React.CSSProperties;
}

export const ProvenanceBadge: React.FC<ProvenanceBadgeProps> = ({
  category,
  source,
  timestamp,
  confidence,
  style
}) => {
  const getConfidenceIcon = () => {
    switch (confidence) {
      case 'High':
        return <ShieldCheck size={10} style={{ color: '#34a853' }} />;
      case 'Medium':
        return <Shield size={10} style={{ color: '#fbbc05' }} />;
      case 'Low':
        return <ShieldAlert size={10} style={{ color: '#ea4335' }} />;
      default:
        return <Shield size={10} />;
    }
  };

  const formattedTime = () => {
    try {
      const date = new Date(timestamp);
      const diffMs = Date.now() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch (e) {
      return 'recent';
    }
  };

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.4rem',
      fontFamily: 'var(--font-mono, monospace)',
      fontSize: '8px',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      background: 'var(--color-bg-secondary, #faf8f5)',
      border: '1px solid var(--color-border, #e5e2d9)',
      padding: '2px 6px',
      borderRadius: '2px',
      color: 'var(--text-secondary, #666)',
      ...style
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
        {getConfidenceIcon()}
        <span style={{ fontWeight: 'bold' }}>{category}</span>
      </div>
      <span style={{ color: 'var(--color-border, #dcd9cd)' }}>|</span>
      <span>{source}</span>
      <span style={{ color: 'var(--color-border, #dcd9cd)' }}>|</span>
      <span>{formattedTime()}</span>
    </div>
  );
};

export default ProvenanceBadge;
