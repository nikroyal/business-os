import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Save, 
  User, 
  Shield, 
  MapPin, 
  Mail, 
  Sparkles, 
  Info,
  Check,
  Calendar,
  CheckCircle
} from 'lucide-react';
import { PlatformHealthWidget } from '../components/PlatformHealthWidget';

const AVAILABLE_INTERESTS = [
  'Artificial Intelligence',
  'Semiconductors',
  'Technology',
  'Business',
  'Entrepreneurship',
  'Economics',
  'Long-Term Wealth Creation',
  'Biotechnology',
  'Cybersecurity',
  'Quantum Computing',
  'Robotics'
];

export const Settings: React.FC = () => {
  const { profile, updateProfile } = useAuth();
  
  const [displayName, setDisplayName] = useState('');
  const [riskProfile, setRiskProfile] = useState<'conservative' | 'moderate' | 'aggressive'>('moderate');
  const [interests, setInterests] = useState<string[]>([]);
  const [timezone, setTimezone] = useState('UTC');
  const [dailyBriefing, setDailyBriefing] = useState(true);
  const [weeklyReport, setWeeklyReport] = useState(true);
  const [alerts, setAlerts] = useState(true);
  
  // Phase 4 Settings
  const [reportingCurrency, setReportingCurrency] = useState<'USD' | 'INR'>('INR');
  const [usdToInrRate, setUsdToInrRate] = useState('83.50');

  // Gemini Settings
  const [geminiEnabled, setGeminiEnabled] = useState(false);
  const [geminiModel, setGeminiModel] = useState('gemini-1.5-flash');
  const [geminiTone, setGeminiTone] = useState<'editorial' | 'analytical' | 'succinct'>('editorial');

  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || '');
      setRiskProfile(profile.riskProfile || 'moderate');
      setInterests(profile.interests || []);
      setTimezone(profile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
      setDailyBriefing(profile.emailPreferences?.dailyBriefing ?? true);
      setWeeklyReport(profile.emailPreferences?.weeklyReport ?? true);
      setAlerts(profile.emailPreferences?.alerts ?? true);
      setReportingCurrency(profile.reportingCurrency || 'INR');
      setUsdToInrRate((profile.usdToInrRate ?? 83.50).toString());
      setGeminiEnabled(profile.geminiEnabled ?? false);
      setGeminiModel(profile.geminiModel || 'gemini-1.5-flash');
      setGeminiTone(profile.geminiTone || 'editorial');
    }
  }, [profile]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleInterestToggle = (interest: string) => {
    if (interests.includes(interest)) {
      setInterests(interests.filter(i => i !== interest));
    } else {
      setInterests([...interests, interest]);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfile({
        displayName,
        riskProfile,
        interests,
        timezone,
        emailPreferences: {
          dailyBriefing,
          weeklyReport,
          alerts
        },
        reportingCurrency,
        usdToInrRate: parseFloat(usdToInrRate) || 83.50,
        geminiEnabled,
        geminiModel,
        geminiTone
      });
      showToast('Settings saved successfully.');
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Failed to save settings.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const timezones = (Intl as any).supportedValuesOf 
    ? (Intl as any).supportedValuesOf('timeZone') 
    : ['UTC', 'America/New_York', 'Europe/London', 'Asia/Tokyo', 'Asia/Kolkata'];

  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div style={{ animation: 'fadeIn 0.25s ease-out', maxWidth: '850px', margin: '0 auto', textAlign: 'left' }}>
      
      {/* Toast Alert Widget */}
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            <Info size={16} />
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      <div style={{ 
        borderBottom: '1px solid #222222', 
        paddingBottom: '1.5rem', 
        marginBottom: '2.5rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <span className="mono-tag" style={{ color: 'var(--color-accent)', marginBottom: '0.25rem', display: 'block' }}>
            Platform Settings
          </span>
          <h1 style={{ border: 'none', padding: 0, margin: 0, fontSize: '2.5rem' }}>Preferences Configuration</h1>
        </div>

        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <Calendar size={14} />
              <span>{formattedDate}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-success-text)' }}>
              <CheckCircle size={12} style={{ color: 'var(--color-success-text)' }} />
              <span>SETTINGS MODULE ACTIVE</span>
            </div>
          </div>
          <PlatformHealthWidget />
        </div>
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Section 1: User Profile Settings */}
        <section className="card">
          <h2 style={{ fontSize: '1.35rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-serif)' }}>
            <User size={18} style={{ color: 'var(--color-accent)' }} />
            Reader Profile
          </h2>
          
          <div className="form-group">
            <label className="form-label">Display Name</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Your Name" 
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Registered Email (Read-only)</label>
            <input 
              type="email" 
              className="form-input" 
              disabled 
              style={{ opacity: 0.6, cursor: 'not-allowed', background: '#FAF8F5' }}
              value={profile?.email || ''} 
            />
          </div>
        </section>

        {/* Section 2: Investment Risk Profile */}
        <section className="card">
          <h2 style={{ fontSize: '1.35rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-serif)' }}>
            <Shield size={18} style={{ color: 'var(--color-accent)' }} />
            Risk Profile Strategy
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            Specifies volatility boundaries for stock metrics scans and weighting rules.
          </p>

          <div className="risk-grid">
            <div 
              className={`risk-card ${riskProfile === 'conservative' ? 'active' : ''}`}
              onClick={() => setRiskProfile('conservative')}
            >
              <span className="risk-title">Conservative</span>
              <span className="risk-desc">Mitigate capital drawdown and prioritize value.</span>
            </div>
            
            <div 
              className={`risk-card ${riskProfile === 'moderate' ? 'active' : ''}`}
              onClick={() => setRiskProfile('moderate')}
            >
              <span className="risk-title">Moderate</span>
              <span className="risk-desc">Balanced growth orientation and equity analysis.</span>
            </div>
            
            <div 
              className={`risk-card ${riskProfile === 'aggressive' ? 'active' : ''}`}
              onClick={() => setRiskProfile('aggressive')}
            >
              <span className="risk-title">Aggressive</span>
              <span className="risk-desc">Target dynamic trends and high momentum verticals.</span>
            </div>
          </div>
        </section>

        {/* Section 3: Timezone Settings */}
        <section className="card">
          <h2 style={{ fontSize: '1.35rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-serif)' }}>
            <MapPin size={18} style={{ color: 'var(--color-accent)' }} />
            Local Timezone
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            Briefing emails will be generated relative to this selected timezone.
          </p>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Preferred Timezone</label>
            <select 
              className="form-input form-select"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            >
              {timezones.map((tz: string) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>
        </section>

        {/* Section 4: Investment Interests */}
        <section className="card">
          <h2 style={{ fontSize: '1.35rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-serif)' }}>
            <Sparkles size={18} style={{ color: 'var(--color-accent)' }} />
            Focus Tracks & Research Verticals
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            Select industry verticals and themes the scanning system should index for daily summaries.
          </p>

          <div className="checkbox-card-grid">
            {AVAILABLE_INTERESTS.map((interest) => {
              const active = interests.includes(interest);
              return (
                <div 
                  key={interest} 
                  className={`checkbox-card ${active ? 'active' : ''}`}
                  onClick={() => handleInterestToggle(interest)}
                >
                  <span style={{ fontSize: '0.8rem', fontWeight: 500, fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
                    {interest}
                  </span>
                  {active && <Check size={14} style={{ color: 'var(--text-primary)' }} />}
                </div>
              );
            })}
          </div>
        </section>

        {/* Section 5: Email Preferences */}
        <section className="card">
          <h2 style={{ fontSize: '1.35rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-serif)' }}>
            <Mail size={18} style={{ color: 'var(--color-accent)' }} />
            Briefing Dispatches
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            Select which research publications are emailed to your account.
          </p>

          <div className="toggle-switch">
            <div>
              <span style={{ fontSize: '0.9rem', fontWeight: 600, display: 'block' }}>Daily Morning Briefing</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Emailed at 7:00 AM local time daily.</span>
            </div>
            <label className="switch">
              <input 
                type="checkbox" 
                checked={dailyBriefing}
                onChange={(e) => setDailyBriefing(e.target.checked)}
              />
              <span className="slider"></span>
            </label>
          </div>

          <div className="toggle-switch">
            <div>
              <span style={{ fontSize: '0.9rem', fontWeight: 600, display: 'block' }}>Weekly Sunday Aggregates</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Emailed at 7:00 AM local time Sundays.</span>
            </div>
            <label className="switch">
              <input 
                type="checkbox" 
                checked={weeklyReport}
                onChange={(e) => setWeeklyReport(e.target.checked)}
              />
              <span className="slider"></span>
            </label>
          </div>

          <div className="toggle-switch" style={{ marginBottom: 0 }}>
            <div>
              <span style={{ fontSize: '0.9rem', fontWeight: 600, display: 'block' }}>Market Scanning Alerts</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Real-time updates regarding watchlist drops.</span>
            </div>
            <label className="switch">
              <input 
                type="checkbox" 
                checked={alerts}
                onChange={(e) => setAlerts(e.target.checked)}
              />
              <span className="slider"></span>
            </label>
          </div>
        </section>

        {/* Section 6: Market Data & Portfolio Currency */}
        <section className="card">
          <h2 style={{ fontSize: '1.35rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-serif)' }}>
            <Sparkles size={18} style={{ color: 'var(--color-accent)' }} />
            Market Data & Reporting Currency
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            Set your reporting and base valuation currency options.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: 0 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Portfolio Reporting Currency</label>
              <select 
                className="form-input form-select"
                value={reportingCurrency}
                onChange={(e) => setReportingCurrency(e.target.value as 'USD' | 'INR')}
              >
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">USD to INR Conversion Rate</label>
              <input 
                type="number" 
                step="any"
                className="form-input" 
                placeholder="83.50" 
                value={usdToInrRate}
                onChange={(e) => setUsdToInrRate(e.target.value)}
                required
              />
            </div>
          </div>
        </section>

        {/* Section 7: Gemini AI Editorial Integration */}
        <section className="card">
          <h2 style={{ fontSize: '1.35rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-serif)' }}>
            <Sparkles size={18} style={{ color: 'var(--color-accent)' }} />
            Gemini Editorial Intelligence Layer
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            Transform deterministic analytics into professional editorial commentary using Google Gemini.
          </p>

          <div className="toggle-switch" style={{ marginBottom: '1.5rem', borderBottom: '1px dashed #E2DACD', paddingBottom: '1.5rem' }}>
            <div>
              <span style={{ fontSize: '0.9rem', fontWeight: 600, display: 'block' }}>Enable Gemini AI Commentary</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Toggle the editorial commentary blocks on Reports and Opportunities.</span>
            </div>
            <label className="switch">
              <input 
                type="checkbox" 
                checked={geminiEnabled}
                onChange={(e) => setGeminiEnabled(e.target.checked)}
              />
              <span className="slider"></span>
            </label>
          </div>

          {geminiEnabled && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Model Selection</label>
                  <select 
                    className="form-input form-select"
                    value={geminiModel}
                    onChange={(e) => setGeminiModel(e.target.value)}
                  >
                    <option value="gemini-1.5-flash">Gemini 1.5 Flash (Recommended)</option>
                    <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                    <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Editorial Tone</label>
                  <select 
                    className="form-input form-select"
                    value={geminiTone}
                    onChange={(e) => setGeminiTone(e.target.value as any)}
                  >
                    <option value="editorial">Editorial (Financial Times style)</option>
                    <option value="analytical">Analytical (Wall Street Analyst style)</option>
                    <option value="succinct">Succinct (Concise Executive summary)</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Submit Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '3rem' }}>
          <button 
            type="submit" 
            disabled={saving}
            className="btn btn-primary"
            style={{ minWidth: '180px' }}
          >
            <Save size={16} />
            <span>{saving ? 'Updating...' : 'Save Preferences'}</span>
          </button>
        </div>

      </form>
    </div>
  );
};
export default Settings;
