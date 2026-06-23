import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Compass, 
  Eye, 
  Lightbulb, 
  FileText, 
  Mail, 
  Sparkles, 
  X,
  ArrowRight,
  ArrowLeft,
  CheckCircle
} from 'lucide-react';

interface OnboardingTourProps {
  onClose: () => void;
}

export const OnboardingTour: React.FC<OnboardingTourProps> = ({ onClose }) => {
  const { user, updateProfile } = useAuth();
  const [slide, setSlide] = useState(0);
  const [completing, setCompleting] = useState(false);

  const handleFinish = async () => {
    setCompleting(true);
    try {
      if (user) {
        await updateProfile({ onboardingCompleted: true });
      }
      onClose();
    } catch (e) {
      console.error('Failed to complete onboarding profile update:', e);
      onClose();
    } finally {
      setCompleting(false);
    }
  };

  const slides = [
    {
      title: "Welcome to BusinessOS",
      subtitle: "A Personal Investing Operating System",
      icon: <Sparkles size={28} style={{ color: 'var(--color-accent)' }} />,
      desc: "BusinessOS is designed to act as your dedicated personal finance, asset management, and investment command center. It operates like an institutional research department working in the background—summarizing market reports, tracking opportunities, and alerting you to portfolio imbalances.",
      details: [
        "Automates asset ledger valuation calculations.",
        "Scans global market data patterns overnight.",
        "Generates Financial Times style editorial intelligence.",
        "Delivers personalized daily dispatch reports to your inbox."
      ]
    },
    {
      title: "Portfolio Command Center",
      subtitle: "Dashboard & Health Scores",
      icon: <Compass size={28} style={{ color: 'var(--color-primary)' }} />,
      desc: "The Dashboard is your quantitative launchpad. Rather than just displaying prices, it calculates professional-grade analytics like HHI concentration risks, geographic exposure, and currency balances. It converts multi-currency accounts dynamically and rates overall portfolio health across 4 key vectors.",
      details: [
        "Asset Allocation Score (capital concentration monitoring).",
        "Sector Balance (diversification check across business sectors).",
        "Risk Profile Alignment (verifies cryptocurrency and beta weights).",
        "Liquidity Cushions (assesses cash buffers and foreign currency hedges)."
      ]
    },
    {
      title: "Watchlist Intelligence",
      subtitle: "Track Potential Targets",
      icon: <Eye size={28} style={{ color: 'var(--color-success-text)' }} />,
      desc: "The Watchlist is more than a list of tickers. Our scanning engines monitor your watchlist continuously. If a tracked stock satisfies value pullback or momentum breakout criteria, the system flags it immediately.",
      details: [
        "Integrates with the scanner to identify active signals.",
        "Sleek visual indicator badges when scanner conditions match.",
        "Interactive filter selectors by regional exchange (US vs. India).",
        "Detailed sidebar returns timeline (1-day, 7-day, 30-day performance)."
      ]
    },
    {
      title: "Opportunity Scanning Engine",
      subtitle: "Automated Investment Scanning",
      icon: <Lightbulb size={28} style={{ color: 'var(--color-accent)' }} />,
      desc: "The Opportunity Engine conducts multi-factor market scans. It assesses historical candle prices and portfolio exposures to trigger deterministic buy signals, keeping you informed of market dislocations.",
      details: [
        "Near 52-Week Low (testing support levels for value entries).",
        "Near 52-Week High Breakouts (tracking momentum spikes).",
        "Significant Pullbacks (scanning for quality companies at discounts).",
        "Portfolio Diversification Gaps (suggesting assets to hedge risks)."
      ]
    },
    {
      title: "Executive Reports",
      subtitle: "Institutional Intelligence Briefings",
      icon: <FileText size={28} style={{ color: 'var(--text-primary)' }} />,
      desc: "Reports translate cold numbers into readable executive briefs. Generating a report runs an overnight evaluation of global indices, aggregates portfolio returns, flags risk alerts, and prepares educational terms.",
      details: [
        "Daily briefings compiled automatically for quick reading.",
        "Actionable risk alert suggestions to hedge downside shocks.",
        "Financial educational blocks explaining technical terminology.",
        "Dynamic local and global market trend summaries."
      ]
    },
    {
      title: "Daily Dispatch Delivery",
      subtitle: "Inbox Automation",
      icon: <Mail size={28} style={{ color: 'var(--color-accent)' }} />,
      desc: "The Dispatch automation delivers these reports directly to your email address at your preferred time. It packages the raw portfolio performance metrics alongside Gemini's narrative context so you can stay updated without opening the web client.",
      details: [
        "Delivers Financial Times/WSJ style newsletters.",
        "Customizable delivery times synced with your timezone.",
        "Toggleable Gemini AI editorial commentaries.",
        "Fully optimized layout for reading on mobile mail clients."
      ]
    }
  ];

  const currentSlide = slides[slide];

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(34, 34, 34, 0.6)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2010
    }}>
      <div style={{
        background: 'var(--bg-card)',
        border: '2px solid var(--text-primary)',
        width: '90%',
        maxWidth: '600px',
        padding: '2.5rem',
        boxShadow: '0 15px 35px rgba(0,0,0,0.2)',
        textAlign: 'left',
        position: 'relative'
      }}>
        
        {/* Skip button top right */}
        <button 
          onClick={handleFinish}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.2rem',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.65rem'
          }}
          disabled={completing}
        >
          <span>SKIP TOUR</span>
          <X size={14} />
        </button>

        {/* Modal Content */}
        <div style={{ minHeight: '340px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          
          <div style={{ animation: 'slideRight 0.2s ease-out' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '46px',
                height: '46px',
                background: '#FCFAF6',
                border: '1px solid #E2DACD'
              }}>
                {currentSlide.icon}
              </div>
              <div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {currentSlide.subtitle}
                </span>
                <h2 style={{ fontSize: '1.4rem', fontFamily: 'var(--font-serif)', margin: 0, border: 'none', padding: 0 }}>
                  {currentSlide.title}
                </h2>
              </div>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.45, marginBottom: '1.25rem' }}>
              {currentSlide.desc}
            </p>

            <div style={{ background: '#FCFAF6', border: '1px solid #E2DACD', padding: '1rem' }}>
              <span style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                Key Capabilities:
              </span>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {currentSlide.details.map((item, idx) => (
                  <li key={idx} style={{ fontSize: '0.8rem', color: 'var(--text-primary)', lineHeight: 1.3 }}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Controls */}
          <div style={{ marginTop: '2rem', borderTop: '1px solid #E2DACD', paddingTop: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {/* Dots */}
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              {slides.map((_, idx) => (
                <div 
                  key={idx}
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: idx === slide ? 'var(--color-accent)' : '#E2DACD',
                    transition: 'all 0.15s ease'
                  }}
                />
              ))}
            </div>

            {/* Navigation buttons */}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              {slide > 0 && (
                <button 
                  onClick={() => setSlide(slide - 1)} 
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                >
                  <ArrowLeft size={14} />
                  <span>Previous</span>
                </button>
              )}

              {slide < slides.length - 1 ? (
                <button 
                  onClick={() => setSlide(slide + 1)} 
                  className="btn btn-primary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                >
                  <span>Next Slide</span>
                  <ArrowRight size={14} />
                </button>
              ) : (
                <button 
                  onClick={handleFinish} 
                  className="btn btn-primary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'var(--color-success-text)', color: '#FFFFFF', borderColor: 'var(--color-success-text)' }}
                  disabled={completing}
                >
                  <CheckCircle size={14} />
                  <span>{completing ? 'Completing...' : 'Finish Tour'}</span>
                </button>
              )}
            </div>

          </div>

        </div>
        
      </div>
      <style>{`
        @keyframes slideRight {
          from { opacity: 0; transform: translateX(8px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
};

export default OnboardingTour;
