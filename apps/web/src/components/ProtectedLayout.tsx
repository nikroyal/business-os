import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Sidebar } from './Sidebar';
import { SetupWizard } from './SetupWizard';
import { OnboardingTour } from './OnboardingTour';

export const ProtectedLayout: React.FC = () => {
  const { user, profile, loading, refreshProfile } = useAuth();

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

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className="main-content">
        <Outlet />
      </main>

      {/* Onboarding Modals Interceptors */}
      {showSetup && <SetupWizard onComplete={refreshProfile} />}
      {showTour && <OnboardingTour onClose={refreshProfile} />}
    </div>
  );
};
export default ProtectedLayout;
