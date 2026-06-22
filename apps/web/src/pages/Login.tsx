import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, User, BookOpen, AlertCircle, Database } from 'lucide-react';

export const Login: React.FC = () => {
  const { login, signup, isMockMode } = useAuth();
  const navigate = useNavigate();
  
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isSignUp) {
        await signup(email, password, displayName);
      } else {
        await login(email, password);
      }
      navigate('/dashboard');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="card auth-card">
        
        <div style={{ textAlign: 'center', marginBottom: '2.5rem', borderBottom: '1px solid #E2DACD', paddingBottom: '1.5rem' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '40px',
            height: '40px',
            background: 'var(--color-primary)',
            color: '#FFFFFF',
            marginBottom: '1rem'
          }}>
            <BookOpen size={20} />
          </div>
          <h1 style={{ 
            fontSize: '2rem', 
            marginBottom: '0.5rem', 
            fontFamily: 'var(--font-serif)',
            fontStyle: 'normal',
            borderBottom: 'none',
            paddingBottom: 0
          }}>
            BusinessOS
          </h1>
          <p style={{ 
            fontFamily: 'var(--font-mono)', 
            fontSize: '0.65rem', 
            textTransform: 'uppercase', 
            color: 'var(--text-muted)',
            letterSpacing: '0.08em'
          }}>
            AI-Powered Investing & Market Analysis
          </p>
        </div>

        {isMockMode && (
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
            padding: '1rem',
            background: 'var(--color-warning-bg)',
            border: '1px solid var(--color-warning-border)',
            borderRadius: 0,
            marginBottom: '1.5rem',
            fontSize: '0.75rem',
            color: 'var(--color-warning-text)',
            textAlign: 'left',
            lineHeight: 1.4
          }}>
            <Database size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>DEMO MODE (OFFLINE DATABASE)</strong><br />
              Firebase credentials not configured. User data will be persisted locally in browser cache.
            </div>
          </div>
        )}

        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
            padding: '1rem',
            background: 'var(--color-danger-bg)',
            border: '1px solid var(--color-danger-border)',
            borderRadius: 0,
            marginBottom: '1.5rem',
            fontSize: '0.75rem',
            color: 'var(--color-danger-text)',
            textAlign: 'left'
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {isSignUp && (
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{
                  position: 'absolute',
                  left: '1rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)'
                }} />
                <input
                  type="text"
                  required
                  placeholder="John Doe"
                  className="form-input"
                  style={{ paddingLeft: '2.5rem' }}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email address</label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{
                position: 'absolute',
                left: '1rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)'
              }} />
              <input
                type="email"
                required
                placeholder="investor@publication.com"
                className="form-input"
                style={{ paddingLeft: '2.5rem' }}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '2rem' }}>
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{
                position: 'absolute',
                left: '1rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)'
              }} />
              <input
                type="password"
                required
                placeholder="••••••••"
                className="form-input"
                style={{ paddingLeft: '2.5rem' }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ width: '100%', padding: '0.85rem' }}
          >
            {loading ? 'Authenticating...' : isSignUp ? 'Create Investor Profile' : 'Sign In to Dashboard'}
          </button>
        </form>

        <div style={{ marginTop: '1.75rem', textAlign: 'center', fontSize: '0.8rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
          <span style={{ color: 'var(--text-muted)' }}>
            {isSignUp ? 'Already registered? ' : "New reader? "}
          </span>
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-accent)',
              fontWeight: 'bold',
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: 0,
              fontFamily: 'var(--font-mono)'
            }}
          >
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </div>
      </div>
    </div>
  );
};
export default Login;
