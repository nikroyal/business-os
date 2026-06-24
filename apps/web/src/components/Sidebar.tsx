import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Compass, 
  Settings, 
  LogOut, 
  BookOpen,
  Database,
  Eye,
  FileText,
  Lightbulb,
  Brain,
  TrendingUp
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { profile, logout, isMockMode } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <aside className="sidebar">
      <div className="logo-container">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <div className="user-avatar" style={{ background: 'var(--color-primary)', width: '32px', height: '32px', borderRadius: 0 }}>
            <BookOpen size={16} />
          </div>
          <span className="logo-text">BusinessOS</span>
        </div>
        <span className="logo-subtext">Financial Dispatch</span>
      </div>

      <nav className="nav-menu" aria-label="Main Navigation">
        <NavLink 
          to="/dashboard" 
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <Compass size={20} />
          <span>Dashboard</span>
        </NavLink>

        <NavLink 
          to="/markets" 
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <TrendingUp size={20} />
          <span>Markets</span>
        </NavLink>

        <NavLink 
          to="/watchlist" 
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <Eye size={20} />
          <span>Watchlist</span>
        </NavLink>

        <NavLink 
          to="/opportunities" 
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <Lightbulb size={20} />
          <span>Opportunities</span>
        </NavLink>

        <NavLink 
          to="/reports" 
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <FileText size={20} />
          <span>Reports</span>
        </NavLink>

        <NavLink 
          to="/intelligence" 
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <Brain size={20} />
          <span>Intelligence Hub</span>
        </NavLink>
        
        <NavLink 
          to="/settings" 
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <Settings size={20} />
          <span>Settings</span>
        </NavLink>
      </nav>



      <div className="sidebar-footer">
        {isMockMode && (
          <div className="user-widget" style={{ 
            border: '1px solid var(--color-warning-border)', 
            background: 'var(--color-warning-bg)', 
            padding: '0.5rem',
            marginBottom: '0.5rem'
          }}>
            <Database size={14} style={{ color: 'var(--color-warning-text)', flexShrink: 0 }} />
            <div className="user-info">
              <span className="user-name" style={{ color: 'var(--color-warning-text)', fontSize: '0.7rem', fontWeight: 'bold' }}>Offline Demo Mode</span>
              <span className="user-email" style={{ fontSize: '0.6rem' }}>Firebase Disabled</span>
            </div>
          </div>
        )}

        <div className="user-widget">
          <div className="user-avatar">
            {getInitials(profile?.displayName || profile?.email)}
          </div>
          <div className="user-info">
            <span className="user-name">{profile?.displayName || 'User'}</span>
            <span className="user-email">{profile?.email}</span>
          </div>
        </div>

        <button onClick={handleLogout} className="btn btn-secondary btn-sm" style={{ width: '100%' }}>
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};
export default Sidebar;
