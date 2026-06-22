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
  Check
} from 'lucide-react';

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
        }
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

      <div style={{ borderBottom: '1px solid #222222', paddingBottom: '1.5rem', marginBottom: '2.5rem' }}>
        <span className="mono-tag" style={{ color: 'var(--color-accent)', marginBottom: '0.25rem', display: 'block' }}>
          Platform Settings
        </span>
        <h1 style={{ border: 'none', padding: 0, margin: 0, fontSize: '2.5rem' }}>Preferences Configuration</h1>
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
