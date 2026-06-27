import React, { useState, useEffect } from 'react';
import { Navigate, Outlet, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Sidebar } from './Sidebar';
import { SetupWizard } from './SetupWizard';
import { OnboardingTour } from './OnboardingTour';
import { PlatformHealthWidget } from './PlatformHealthWidget';
import { CommandPalette } from './CommandPalette';
import { Search, Command, User as UserIcon } from 'lucide-react';

export const ProtectedLayout: React.FC = () => {
  const { user, profile, loading, refreshProfile } = useAuth();
  const location = useLocation();
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);

  // Global key listener for Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'var(--bg-main)',
        color: 'var(--text-secondary)'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div className="spinner" style={{
            width: 40,
            height: 40,
            border: '3px solid rgba(139, 92, 246, 0.2)',
            borderTop: '3px solid var(--color-primary)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 500 }}>Initializing BusinessOS...</p>
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const showSetup = profile && !profile.setupCompleted;
  const showTour = profile && profile.setupCompleted && !profile.onboardingCompleted;

  // Resolve current workspace title for breadcrumbs
  const getBreadcrumbs = () => {
    const path = location.pathname;
    if (path.startsWith('/dashboard')) return ['Workspaces', 'Portfolio'];
    if (path.startsWith('/markets')) return ['Workspaces', 'Markets'];
    if (path.startsWith('/watchlist')) return ['Workspaces', 'Watchlist'];
    if (path.startsWith('/opportunities')) return ['Workspaces', 'Opportunities'];
    if (path.startsWith('/reports')) return ['Workspaces', 'Reports'];
    if (path.startsWith('/intelligence')) {
      const parts = path.split('/');
      if (parts[2]) {
        return ['Workspaces', 'Company', parts[2].toUpperCase()];
      }
      return ['Workspaces', 'Company Intelligence'];
    }
    if (path.startsWith('/copilot')) return ['Workspaces', 'Copilot'];
    if (path.startsWith('/developer')) return ['System', 'Operations Console'];
    if (path.startsWith('/settings')) return ['User', 'Settings'];
    return ['BusinessOS'];
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <div className="dashboard-layout">
      <Sidebar />
      
      {/* Workspace Area Wrap */}
      <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, height: '100vh', overflow: 'hidden' }}>
        
        {/* Editorial Global Top Bar Header */}
        <header style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.85rem 2rem',
          borderBottom: '1px solid #E2DACD',
          background: '#FAF8F5',
          zIndex: 90
        }}>
          {/* Left breadcrumb info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <span style={{ color: '#888' }}>/</span>}
                <span style={{ 
                  fontWeight: idx === breadcrumbs.length - 1 ? 'bold' : 'normal',
                  color: idx === breadcrumbs.length - 1 ? '#8c2a2a' : '#555'
                }}>
                  {crumb}
                </span>
              </React.Fragment>
            ))}
          </div>

          {/* Center search button trigger */}
          <div 
            onClick={() => setIsPaletteOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: '#FFFFFF',
              border: '1px solid #E2DACD',
              padding: '0.4rem 1rem',
              width: '280px',
              cursor: 'pointer',
              color: '#888',
              fontSize: '0.75rem',
              transition: 'var(--transition-editorial)'
            }}
            className="global-search-trigger"
          >
            <Search size={14} style={{ color: '#8c2a2a' }} />
            <span style={{ flexGrow: 1, textAlign: 'left' }}>Search or command...</span>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1px',
              background: '#F1EDE6',
              border: '1px solid #E2DACD',
              padding: '1px 4px',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.65rem',
              fontWeight: 'bold'
            }}>
              <Command size={10} />K
            </div>
          </div>

          {/* Right actions widget items */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <PlatformHealthWidget />
            
            {/* Header User profile widget */}
            <Link to="/settings" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              textDecoration: 'none',
              color: '#222222',
              fontSize: '0.75rem',
              fontFamily: 'var(--font-sans)',
              fontWeight: 500
            }}>
              <div style={{
                width: '24px',
                height: '24px',
                background: '#222222',
                color: '#FFFFFF',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.65rem',
                fontFamily: 'var(--font-serif)',
                fontWeight: 'bold'
              }}>
                {profile?.displayName ? profile.displayName[0].toUpperCase() : <UserIcon size={12} />}
              </div>
              <span className="hidden sm:inline">{profile?.displayName?.split(' ')[0] || 'Profile'}</span>
            </Link>
          </div>
        </header>

        {/* Workspace views slot */}
        <main className="main-content" style={{ flexGrow: 1, overflowY: 'auto', background: 'var(--bg-main)', position: 'relative' }}>
          <Outlet />
        </main>
      </div>

      {/* Global Command Palette dialog */}
      <CommandPalette 
        isOpen={isPaletteOpen} 
        onClose={() => setIsPaletteOpen(false)} 
      />

      {/* Onboarding Modals Interceptors */}
      {showSetup && <SetupWizard onComplete={refreshProfile} />}
      {showTour && <OnboardingTour onClose={refreshProfile} />}

      <style>{`
        .global-search-trigger:hover {
          border-color: #8c2a2a !important;
          background-color: #FCFAF6 !important;
        }
      `}</style>
    </div>
  );
};
export default ProtectedLayout;
