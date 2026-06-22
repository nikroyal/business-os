import React from 'react';
import { useAuth } from '../context/AuthContext';
import { CheckCircle, Calendar } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { profile } = useAuth();

  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div style={{ animation: 'fadeIn 0.25s ease-out', textAlign: 'left' }}>
      
      {/* Editorial Header Header bar */}
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
            Daily Intelligence Briefing
          </span>
          <h1 style={{ border: 'none', padding: 0, margin: 0, fontSize: '2.5rem' }}>
            Good morning, {profile?.displayName || 'Investor'}
          </h1>
        </div>
        
        {/* Newspaper Date Meta */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <Calendar size={14} />
            <span>{formattedDate}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-success-text)' }}>
            <CheckCircle size={12} />
            <span>CORE ARCHITECTURE ACTIVE</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2.5rem' }}>
        
        {/* Left Column: Briefing Analysis */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
          
          <div className="card" style={{ padding: '2.5rem' }}>
            <div className="article-meta">
              <span>Section: Onboarding</span>
              <span>•</span>
              <span>Updated: Real-time</span>
            </div>
            
            <h2 style={{ fontSize: '1.75rem', marginBottom: '1.25rem', fontStyle: 'italic', fontFamily: 'var(--font-serif)' }}>
              Core Foundations Complete for BusinessOS V1 Scaffold
            </h2>
            
            <p style={{ marginBottom: '1.25rem', fontSize: '1rem', color: 'var(--text-secondary)' }}>
              Welcome to the initial core configuration of the BusinessOS platform. The setup manages your secure user sessions on the edge using Cloudflare Workers and establishes the profile settings infrastructure.
            </p>
            
            <p style={{ marginBottom: '2rem', fontSize: '1rem', color: 'var(--text-secondary)' }}>
              In the upcoming stages, the opportunity scanner, portfolio tracker, and Gemini report generator will build on top of these verified foundations. Customize your analysis targets under the settings panel.
            </p>

            <div style={{ 
              padding: '1.25rem', 
              background: '#FAF8F5', 
              borderLeft: '3px solid var(--text-primary)', 
              fontSize: '0.85rem' 
            }}>
              <strong style={{ fontFamily: 'var(--font-serif)', fontSize: '0.95rem', display: 'block', marginBottom: '0.5rem' }}>
                Completed Deliverables Checklist:
              </strong>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>
                <div>• Monorepo Workspace Init</div>
                <div>• Secure Authentication Routing</div>
                <div>• User Settings Profile Firestore schemas</div>
                <div>• Cloudflare Workers Scaffold Integration</div>
                <div>• Demo Memory Database Adaptation</div>
                <div>• Custom Editorial Design Tokens</div>
              </div>
            </div>
          </div>

          {/* Snapshot Summary Card */}
          <div className="card">
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', borderBottom: '1px solid #E2DACD', paddingBottom: '0.5rem' }}>
              Strategic Parameters Snapshot
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1rem' }}>
              <div style={{ padding: '1rem', background: '#FCFAF6', border: '1px solid #E2DACD' }}>
                <span className="mono-tag" style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Risk Profile Mode</span>
                <span style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--color-accent)', display: 'block', marginTop: '0.25rem', textTransform: 'capitalize', fontFamily: 'var(--font-serif)' }}>
                  {profile?.riskProfile || 'Moderate'}
                </span>
              </div>
              <div style={{ padding: '1rem', background: '#FCFAF6', border: '1px solid #E2DACD' }}>
                <span className="mono-tag" style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Configured Timezone</span>
                <span style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginTop: '0.25rem', fontFamily: 'var(--font-serif)' }}>
                  {profile?.timezone || 'UTC'}
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Editorial Sidebars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
          
          {/* Interests track widget */}
          <div className="card" style={{ padding: '1.5rem 2rem' }}>
            <h3 style={{ fontSize: '1.15rem', marginBottom: '1rem', borderBottom: '1px solid #E2DACD', paddingBottom: '0.5rem', fontFamily: 'var(--font-serif)' }}>
              Analysis Verticals
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Focus categories assigned to the scanning agent.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {profile?.interests && profile.interests.length > 0 ? (
                profile.interests.map((interest: string, idx: number) => (
                  <div key={idx} style={{
                    padding: '0.5rem 0.75rem',
                    background: '#FCFAF6',
                    border: '1px solid #E2DACD',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)',
                    textTransform: 'uppercase'
                  }}>
                    {interest}
                  </div>
                ))
              ) : (
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  No tracks configured.
                </span>
              )}
            </div>
          </div>

          {/* Alerts configuration state card */}
          <div className="card" style={{ padding: '1.5rem 2rem' }}>
            <h3 style={{ fontSize: '1.15rem', marginBottom: '1rem', borderBottom: '1px solid #E2DACD', paddingBottom: '0.5rem', fontFamily: 'var(--font-serif)' }}>
              Dispatch Status
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #E2DACD', paddingBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>Daily Briefing:</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold', fontSize: '0.75rem', color: profile?.emailPreferences?.dailyBriefing ? 'var(--color-success-text)' : 'var(--color-danger-text)' }}>
                  {profile?.emailPreferences?.dailyBriefing ? 'ON' : 'OFF'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #E2DACD', paddingBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>Weekly Summary:</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold', fontSize: '0.75rem', color: profile?.emailPreferences?.weeklyReport ? 'var(--color-success-text)' : 'var(--color-danger-text)' }}>
                  {profile?.emailPreferences?.weeklyReport ? 'ON' : 'OFF'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.25rem' }}>
                <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>Critical Alerts:</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold', fontSize: '0.75rem', color: profile?.emailPreferences?.alerts ? 'var(--color-success-text)' : 'var(--color-danger-text)' }}>
                  {profile?.emailPreferences?.alerts ? 'ON' : 'OFF'}
                </span>
              </div>
            </div>
          </div>

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
export default Dashboard;
