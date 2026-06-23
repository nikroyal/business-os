import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  CheckSquare, 
  Square, 
  Sparkles, 
  ArrowRight,
  Briefcase,
  Eye,
  FileText,
  Lightbulb,
  Settings,
  PartyPopper
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface OnboardingChecklistProps {
  holdingsCount: number;
  watchlistCount: number;
  reportsCount: number;
  opportunitiesCount: number;
  onLoadSample: () => Promise<void>;
}

export const OnboardingChecklist: React.FC<OnboardingChecklistProps> = ({
  holdingsCount,
  watchlistCount,
  reportsCount,
  opportunitiesCount,
  onLoadSample
}) => {
  const navigate = useNavigate();
  const { profile, updateProfile } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [loadingSample, setLoadingSample] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  // Derive task completions
  const hasHoldings = holdingsCount > 0;
  const hasWatchlist = watchlistCount > 0;
  const hasReports = reportsCount > 0;
  const hasOpportunities = opportunitiesCount > 0;
  const hasDispatch = !!profile?.emailDeliveryAddress && (profile.emailPreferences?.dailyBriefing || profile.emailPreferences?.weeklyReport);

  const tasks = [
    {
      id: 'holdings',
      label: 'Add your first portfolio holding',
      completed: hasHoldings,
      actionLabel: 'Add Position',
      onClick: () => {
        // Find manual add asset button or scroll to ledger
        const ledger = document.getElementById('ledger-header');
        if (ledger) {
          ledger.scrollIntoView({ behavior: 'smooth' });
        } else {
          // Fallback, trigger manual click on add position
          const btn = document.querySelector('[data-action="add-asset"]') as HTMLButtonElement;
          if (btn) btn.click();
        }
      },
      icon: <Briefcase size={14} />
    },
    {
      id: 'watchlist',
      label: 'Create an asset watchlist tracker',
      completed: hasWatchlist,
      actionLabel: 'Track Asset',
      onClick: () => navigate('/watchlist'),
      icon: <Eye size={14} />
    },
    {
      id: 'reports',
      label: 'Generate your first market intelligence report',
      completed: hasReports,
      actionLabel: 'Create Report',
      onClick: () => navigate('/reports'),
      icon: <FileText size={14} />
    },
    {
      id: 'opportunities',
      label: 'Review active opportunity scan signals',
      completed: hasOpportunities,
      actionLabel: 'Review Signals',
      onClick: () => navigate('/opportunities'),
      icon: <Lightbulb size={14} />
    },
    {
      id: 'dispatch',
      label: 'Configure automated morning briefings',
      completed: hasDispatch,
      actionLabel: 'Configure Briefings',
      onClick: () => navigate('/settings'),
      icon: <Settings size={14} />
    }
  ];

  const completedCount = tasks.filter(t => t.completed).length;
  const percentComplete = Math.round((completedCount / tasks.length) * 100);

  // Trigger celebration when all items are checked for the first time
  useEffect(() => {
    if (completedCount === tasks.length && tasks.length > 0) {
      const alreadyCelebrated = localStorage.getItem(`onboarding_celebrated_${profile?.uid}`);
      if (!alreadyCelebrated) {
        setShowCelebration(true);
        localStorage.setItem(`onboarding_celebrated_${profile?.uid}`, 'true');
      }
    }
  }, [completedCount, profile?.uid]);

  const handleDismissCelebration = () => {
    setShowCelebration(false);
  };

  const handleCompleteAll = async () => {
    setLoadingSample(true);
    try {
      await onLoadSample();
    } finally {
      setLoadingSample(false);
    }
  };

  const handleHideChecklist = async () => {
    try {
      await updateProfile({ onboardingCompleted: true });
    } catch (e) {
      console.error(e);
    }
  };

  if (profile?.onboardingCompleted) {
    return null;
  }

  return (
    <div className="card" style={{ padding: '1.5rem 2rem', marginBottom: '2rem', border: '1px solid var(--color-accent)', background: '#FCFAF6', animation: 'fadeIn 0.25s ease-out' }}>
      
      {/* Celebration Overlay Modal */}
      {showCelebration && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(34, 34, 34, 0.4)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 3000
        }}>
          <div style={{
            background: 'var(--bg-card)',
            border: '2px solid var(--text-primary)',
            padding: '2.5rem',
            maxWidth: '450px',
            width: '90%',
            textAlign: 'center',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            animation: 'scaleUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
          }}>
            <PartyPopper size={48} style={{ color: 'var(--color-success-text)', margin: '0 auto 1rem auto' }} />
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', marginBottom: '0.5rem' }}>
              Onboarding Complete!
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: '1.5rem' }}>
              Congratulations, {profile?.displayName || 'investor'}! Your BusinessOS is fully configured. All diagnostic scans are online and your newsletter briefs are automated.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button 
                onClick={handleDismissCelebration} 
                className="btn btn-primary"
                style={{ padding: '0.6rem' }}
              >
                Enter Command Center
              </button>
              <button 
                onClick={handleHideChecklist} 
                className="btn"
                style={{ background: 'transparent', border: 'none', textDecoration: 'underline', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', cursor: 'pointer' }}
              >
                Hide Checklist Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed #E2DACD', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Sparkles size={16} style={{ color: 'var(--color-accent)' }} />
          <h3 style={{ fontSize: '1.1rem', fontFamily: 'var(--font-serif)', margin: 0 }}>
            Quick Start Onboarding Guide
          </h3>
          <span style={{ 
            fontFamily: 'var(--font-mono)', 
            fontSize: '0.65rem', 
            background: 'var(--color-accent)', 
            color: '#FFFFFF',
            padding: '0.1rem 0.4rem',
            fontWeight: 'bold',
            borderRadius: '2px'
          }}>
            {percentComplete}% COMPLETED
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button 
            onClick={() => setCollapsed(!collapsed)}
            className="btn btn-secondary btn-sm"
            style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', height: '24px' }}
          >
            {collapsed ? 'Expand Guide' : 'Collapse'}
          </button>
          <button 
            onClick={handleHideChecklist}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.75rem', textDecoration: 'underline', fontFamily: 'var(--font-mono)' }}
          >
            Hide Permanent
          </button>
        </div>
      </div>

      {!collapsed && (
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '2.5rem', alignItems: 'start' }}>
          {/* Checklist items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {tasks.map(task => (
              <div 
                key={task.id}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  padding: '0.25rem 0',
                  opacity: task.completed ? 0.75 : 1
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div style={{ color: task.completed ? 'var(--color-success-text)' : 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                    {task.completed ? <CheckSquare size={18} /> : <Square size={18} />}
                  </div>
                  <span style={{ 
                    fontSize: '0.85rem', 
                    color: 'var(--text-primary)',
                    textDecoration: task.completed ? 'line-through' : 'none' 
                  }}>
                    {task.label}
                  </span>
                </div>
                
                {!task.completed && (
                  <button 
                    onClick={task.onClick}
                    className="btn btn-secondary"
                    style={{ 
                      fontSize: '0.7rem', 
                      padding: '0.2rem 0.6rem', 
                      height: '24px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      fontFamily: 'var(--font-mono)'
                    }}
                  >
                    {task.icon}
                    <span>{task.actionLabel}</span>
                    <ArrowRight size={10} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Quick-load sidebar info */}
          <div style={{ background: '#FCFAF6', borderLeft: '3px solid var(--color-accent)', padding: '1rem 1.25rem' }}>
            <strong style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.4rem', fontFamily: 'var(--font-serif)' }}>
              Explore BusinessOS Instantly?
            </strong>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4, margin: '0 0 1rem 0' }}>
              If you do not have your holdings ledger or tickers ready, click below to load a simulated portfolio mapping and explore all diagnostic charts immediately.
            </p>
            <button 
              onClick={handleCompleteAll}
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.5rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
              disabled={loadingSample}
            >
              <Sparkles size={14} />
              <span>{loadingSample ? 'Injecting Mock Assets...' : 'Load Simulated Portfolio Data'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Styles */}
      <style>{`
        @keyframes scaleUp {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default OnboardingChecklist;
