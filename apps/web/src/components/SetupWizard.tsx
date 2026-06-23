import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { SampleDataService } from '../services/sampleDataService';
import { 
  User, 
  Globe, 
  Mail, 
  Check, 
  ArrowRight,
  ArrowLeft,
  Sparkles
} from 'lucide-react';

interface SetupWizardProps {
  onComplete: () => void;
}

export const SetupWizard: React.FC<SetupWizardProps> = ({ onComplete }) => {
  const { user, profile, updateProfile } = useAuth();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // Setup data state
  const [displayName, setDisplayName] = useState('');
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const [riskProfile, setRiskProfile] = useState<'conservative' | 'moderate' | 'aggressive'>('moderate');
  const [interests, setInterests] = useState<string[]>(['Technology']);
  const [reportingCurrency, setReportingCurrency] = useState<'USD' | 'INR'>('USD');
  const [dailyBriefing, setDailyBriefing] = useState(true);
  const [weeklyReport, setWeeklyReport] = useState(true);
  const [preferredDeliveryTime, setPreferredDeliveryTime] = useState('08:00');
  const [emailDeliveryAddress, setEmailDeliveryAddress] = useState('');
  const [loadSample, setLoadSample] = useState(true);

  // Load setup draft on mount
  useEffect(() => {
    if (!user) return;
    
    // Default delivery email pre-fill
    if (!emailDeliveryAddress && user.email) {
      setEmailDeliveryAddress(user.email);
    }
    
    const draftStr = localStorage.getItem(`setup_wizard_draft_${user.uid}`);
    if (draftStr) {
      try {
        const draft = JSON.parse(draftStr);
        if (draft.step) setCurrentStep(draft.step);
        if (draft.displayName) setDisplayName(draft.displayName);
        if (draft.timezone) setTimezone(draft.timezone);
        if (draft.riskProfile) setRiskProfile(draft.riskProfile);
        if (draft.interests) setInterests(draft.interests);
        if (draft.reportingCurrency) setReportingCurrency(draft.reportingCurrency);
        if (draft.dailyBriefing !== undefined) setDailyBriefing(draft.dailyBriefing);
        if (draft.weeklyReport !== undefined) setWeeklyReport(draft.weeklyReport);
        if (draft.preferredDeliveryTime) setPreferredDeliveryTime(draft.preferredDeliveryTime);
        if (draft.emailDeliveryAddress) setEmailDeliveryAddress(draft.emailDeliveryAddress);
        if (draft.loadSample !== undefined) setLoadSample(draft.loadSample);
      } catch (e) {
        console.warn('Failed to recover setup draft:', e);
      }
    } else if (profile) {
      // Pre-populate from existing profile defaults
      if (profile.displayName) setDisplayName(profile.displayName);
      if (profile.timezone) setTimezone(profile.timezone);
      if (profile.riskProfile) setRiskProfile(profile.riskProfile);
      if (profile.interests && profile.interests.length > 0) setInterests(profile.interests);
      if (profile.reportingCurrency) setReportingCurrency(profile.reportingCurrency);
    }
  }, [user, profile]);

  // Save setup draft on step changes
  const saveDraft = (nextStep: number) => {
    if (!user) return;
    const draft = {
      step: nextStep,
      displayName,
      timezone,
      riskProfile,
      interests,
      reportingCurrency,
      dailyBriefing,
      weeklyReport,
      preferredDeliveryTime,
      emailDeliveryAddress,
      loadSample
    };
    localStorage.setItem(`setup_wizard_draft_${user.uid}`, JSON.stringify(draft));
  };

  const handleNext = () => {
    // Basic validation
    if (currentStep === 1 && !displayName.trim()) {
      alert('Please enter your name.');
      return;
    }
    if (currentStep === 5 && dailyBriefing && !emailDeliveryAddress.trim()) {
      alert('Please enter an email address for daily briefing delivery.');
      return;
    }

    const next = currentStep + 1;
    setCurrentStep(next);
    saveDraft(next);
  };

  const handleBack = () => {
    const prev = currentStep - 1;
    setCurrentStep(prev);
    saveDraft(prev);
  };

  const handleSubmit = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Save profile updates
      await updateProfile({
        displayName,
        timezone,
        riskProfile,
        interests,
        reportingCurrency,
        emailPreferences: {
          dailyBriefing,
          weeklyReport,
          alerts: true
        },
        preferredDeliveryTime,
        preferredTimezone: timezone,
        emailDeliveryAddress,
        aiCommentaryIncluded: true,
        geminiEnabled: true, // Default to true for premium experience
        setupCompleted: true
      });

      // 2. Load sample data if checked
      if (loadSample) {
        await SampleDataService.loadSampleData(user.uid);
      }

      // 3. Clear draft
      localStorage.removeItem(`setup_wizard_draft_${user.uid}`);
      onComplete();
    } catch (e) {
      console.error('Setup failed:', e);
      alert('Profile update failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleInterest = (interest: string) => {
    setInterests(prev => 
      prev.includes(interest) 
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  };

  const interestOptions = [
    'Technology',
    'Real Estate',
    'Crypto & Digital Assets',
    'Energy & Industrials',
    'Healthcare & Biotech',
    'Blue Chip Equities',
    'Emerging Markets',
    'High Yield Dividend Stocks'
  ];

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
      zIndex: 2000
    }}>
      <div style={{
        background: 'var(--bg-card)',
        border: '2px solid var(--text-primary)',
        width: '90%',
        maxWidth: '580px',
        padding: '2.5rem',
        boxShadow: '0 15px 35px rgba(0,0,0,0.2)',
        textAlign: 'left'
      }}>
        
        {/* Wizard Progress Indicator */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '1px solid #E2DACD', paddingBottom: '1rem' }}>
          <div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--color-accent)', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>
              First-Time Configuration
            </span>
            <h2 style={{ fontSize: '1.5rem', fontFamily: 'var(--font-serif)', margin: 0 }}>
              System Setup Wizard
            </h2>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            STEP {currentStep} OF 6
          </div>
        </div>

        {/* STEP 1: Basic Info */}
        {currentStep === 1 && (
          <div style={{ animation: 'fadeIn 0.25s ease-out' }}>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.2rem', marginBottom: '0.75rem' }}>
              Welcome to BusinessOS
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: '1.5rem' }}>
              Let's align the analytical operating system with your identity and local dispatch constraints.
            </p>
            
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label className="form-label">What should the system address you as?</label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. Warren Buffett" 
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  style={{ paddingLeft: '2.25rem' }}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Operating Timezone</label>
              <div style={{ position: 'relative' }}>
                <Globe size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <select 
                  className="form-input form-select" 
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  style={{ paddingLeft: '2.25rem', height: '38px' }}
                >
                  <option value="America/New_York">New York (EST/EDT)</option>
                  <option value="Europe/London">London (GMT/BST)</option>
                  <option value="Asia/Kolkata">Mumbai/Kolkata (IST)</option>
                  <option value="Asia/Tokyo">Tokyo (JST)</option>
                  <option value="UTC">Coordinated Universal Time (UTC)</option>
                </select>
              </div>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>
                Dispatched newsletters and market scan logs synchronize with this clock.
              </span>
            </div>
          </div>
        )}

        {/* STEP 2: Risk Profile */}
        {currentStep === 2 && (
          <div style={{ animation: 'fadeIn 0.25s ease-out' }}>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.2rem', marginBottom: '0.75rem' }}>
              Investment Risk Posture
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: '1.5rem' }}>
              Select a threshold. Our portfolio health calculations will flag exposures exceeding these boundaries.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {[
                { 
                  id: 'conservative', 
                  title: 'Conservative (Capital Preservation)', 
                  desc: 'Focus on shielding capital from downside. System alerts trigger if crypto/speculative assets exceed 5%, or single stock concentration exceeds 10%.' 
                },
                { 
                  id: 'moderate', 
                  title: 'Moderate Balanced Growth', 
                  desc: 'Balanced risk appetite. Allows up to 15% crypto/high-beta volatility, and 15% single asset weights before flagging risk markers.' 
                },
                { 
                  id: 'aggressive', 
                  title: 'Aggressive Capital Appreciation', 
                  desc: 'High volatility tolerance. Risk boundaries expand to 30% volatile crypto/high-beta positions, and up to 25% single stock weights.' 
                }
              ].map(opt => (
                <div 
                  key={opt.id}
                  onClick={() => setRiskProfile(opt.id as any)}
                  style={{
                    border: riskProfile === opt.id ? '2px solid var(--color-accent)' : '1px solid #E2DACD',
                    background: riskProfile === opt.id ? '#FCFAF6' : 'transparent',
                    padding: '1rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <input 
                      type="radio" 
                      checked={riskProfile === opt.id} 
                      onChange={() => {}} 
                      style={{ accentColor: 'var(--color-accent)' }}
                    />
                    <strong style={{ fontSize: '0.9rem', fontFamily: 'var(--font-serif)' }}>{opt.title}</strong>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginLeft: '1.25rem', lineHeight: 1.3 }}>
                    {opt.desc}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 3: Sectors & Interests */}
        {currentStep === 3 && (
          <div style={{ animation: 'fadeIn 0.25s ease-out' }}>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.2rem', marginBottom: '0.75rem' }}>
              Investment Interest Verticals
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: '1.25rem' }}>
              Select the sectors or asset styles you track. Gemini uses these interest areas to filter and prioritize daily newsletter briefs.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              {interestOptions.map(opt => {
                const selected = interests.includes(opt);
                return (
                  <div 
                    key={opt}
                    onClick={() => toggleInterest(opt)}
                    style={{
                      border: selected ? '1px solid var(--color-accent)' : '1px solid #E2DACD',
                      background: selected ? '#FCFAF6' : 'transparent',
                      padding: '0.65rem 0.85rem',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    <div style={{
                      width: '14px',
                      height: '14px',
                      border: '1px solid var(--text-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: selected ? 'var(--color-accent)' : 'transparent',
                      color: '#FFFFFF'
                    }}>
                      {selected && <Check size={10} />}
                    </div>
                    <span>{opt}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 4: Reporting Currency */}
        {currentStep === 4 && (
          <div style={{ animation: 'fadeIn 0.25s ease-out' }}>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.2rem', marginBottom: '0.75rem' }}>
              Portfolio Base Currency
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: '1.5rem' }}>
              Choose your primary base currency. Any assets stored in secondary currencies will automatically convert using daily exchange indexes.
            </p>

            <div style={{ display: 'flex', gap: '1.5rem' }}>
              {[
                { code: 'USD', symbol: '$', label: 'United States Dollar (USD)', note: 'Recommended for global equities & crypto focus.' },
                { code: 'INR', symbol: '₹', label: 'Indian Rupee (INR)', note: 'Recommended for local NSE/BSE equities focus.' }
              ].map(opt => (
                <div
                  key={opt.code}
                  onClick={() => setReportingCurrency(opt.code as any)}
                  style={{
                    flex: 1,
                    border: reportingCurrency === opt.code ? '2px solid var(--color-accent)' : '1px solid #E2DACD',
                    background: reportingCurrency === opt.code ? '#FCFAF6' : 'transparent',
                    padding: '1.5rem 1.25rem',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '45px',
                    height: '45px',
                    borderRadius: '50%',
                    background: reportingCurrency === opt.code ? 'var(--color-accent)' : '#E2DACD',
                    color: reportingCurrency === opt.code ? '#FFFFFF' : 'var(--text-secondary)',
                    fontSize: '1.5rem',
                    fontWeight: 'bold',
                    marginBottom: '0.75rem'
                  }}>
                    {opt.symbol}
                  </div>
                  <strong style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.25rem' }}>{opt.code}</strong>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', lineHeight: 1.3 }}>
                    {opt.note}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 5: Daily Dispatch */}
        {currentStep === 5 && (
          <div style={{ animation: 'fadeIn 0.25s ease-out' }}>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.2rem', marginBottom: '0.75rem' }}>
              Daily Dispatch Preferences
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: '1.25rem' }}>
              Configure your newsletter automation parameters. Our system runs overnight market evaluations and emails your brief at sunrise.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: '#FCFAF6', border: '1px solid #E2DACD', padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input 
                  type="checkbox" 
                  id="chkDaily" 
                  checked={dailyBriefing} 
                  onChange={(e) => setDailyBriefing(e.target.checked)}
                  style={{ accentColor: 'var(--color-accent)' }}
                />
                <label htmlFor="chkDaily" style={{ fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer' }}>
                  Enable Daily morning email brief
                </label>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input 
                  type="checkbox" 
                  id="chkWeekly" 
                  checked={weeklyReport} 
                  onChange={(e) => setWeeklyReport(e.target.checked)}
                  style={{ accentColor: 'var(--color-accent)' }}
                />
                <label htmlFor="chkWeekly" style={{ fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer' }}>
                  Enable Weekly portfolio performance digest
                </label>
              </div>

              {dailyBriefing && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem', borderTop: '1px solid #E2DACD', paddingTop: '1rem', animation: 'fadeIn 0.2s ease-out' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label className="form-label" style={{ marginBottom: 0 }}>Delivery Email Address</label>
                    <div style={{ position: 'relative' }}>
                      <Mail size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      <input 
                        type="email" 
                        className="form-input" 
                        value={emailDeliveryAddress}
                        onChange={(e) => setEmailDeliveryAddress(e.target.value)}
                        style={{ paddingLeft: '2rem', height: '34px', fontSize: '0.8rem' }}
                        required
                      />
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <label className="form-label" style={{ marginBottom: 0, flexShrink: 0 }}>Dispatch Time (Local):</label>
                    <input 
                      type="time" 
                      className="form-input"
                      value={preferredDeliveryTime}
                      onChange={(e) => setPreferredDeliveryTime(e.target.value)}
                      style={{ width: '120px', height: '34px', fontSize: '0.8rem', padding: '0 0.5rem' }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 6: Completion */}
        {currentStep === 6 && (
          <div style={{ animation: 'fadeIn 0.25s ease-out' }}>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.2rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sparkles size={20} style={{ color: 'var(--color-accent)' }} />
              <span>Ready to Begin</span>
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: '1.5rem' }}>
              Configuration settings saved successfully. To help you familiarize yourself with our metrics, we recommend loading our sample database.
            </p>

            <div style={{ border: '1px solid var(--color-accent)', padding: '1.25rem', background: '#FCFAF6', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <input 
                type="checkbox" 
                id="chkSample" 
                checked={loadSample} 
                onChange={(e) => setLoadSample(e.target.checked)}
                style={{ accentColor: 'var(--color-accent)', marginTop: '3px' }}
              />
              <div>
                <label htmlFor="chkSample" style={{ fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer', display: 'block', marginBottom: '0.25rem' }}>
                  Load diversified sample portfolio data
                </label>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.3, display: 'block' }}>
                  Injects 9 diversified assets (US equities, Indian NSE holdings, cash buffers, and crypto), 4 watchlisted symbols, 3 opportunities, and a sample report to explore features immediately. (Note: Injected sample data is for demonstration and might merge with/replace existing data).
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Wizard Footer Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginTop: '2.5rem', borderTop: '1px solid #E2DACD', paddingTop: '1.25rem' }}>
          {currentStep > 1 ? (
            <button 
              onClick={handleBack} 
              className="btn btn-secondary" 
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', height: '36px', padding: '0 1rem' }}
              disabled={loading}
            >
              <ArrowLeft size={14} />
              <span>Back</span>
            </button>
          ) : (
            <div />
          )}

          {currentStep < 6 ? (
            <button 
              onClick={handleNext} 
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', height: '36px', padding: '0 1.25rem' }}
            >
              <span>Continue</span>
              <ArrowRight size={14} />
            </button>
          ) : (
            <button 
              onClick={handleSubmit} 
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', height: '36px', padding: '0 1.5rem' }}
              disabled={loading}
            >
              <span>{loading ? 'Initializing Profile...' : 'Finish Setup'}</span>
              <Check size={14} />
            </button>
          )}
        </div>

      </div>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default SetupWizard;
