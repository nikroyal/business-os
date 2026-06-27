import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { CompanyRegistry } from '../services/companyRegistry';
import { 
  Search, 
  Compass, 
  TrendingUp, 
  Eye, 
  Lightbulb, 
  FileText, 
  Brain, 
  MessageSquare, 
  Settings, 
  Plus, 
  X,
  Sparkles,
  Command
} from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PaletteItem {
  id: string;
  title: string;
  subtitle?: string;
  category: 'Workspaces' | 'Companies' | 'Actions';
  icon: React.ReactNode;
  action: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Build commands lists
  const staticItems: PaletteItem[] = [
    // Workspaces
    {
      id: 'ws-dashboard',
      title: 'Go to Portfolio Workspace',
      subtitle: 'Overview, holdings, delta reports, and rebalancing options',
      category: 'Workspaces',
      icon: <Compass size={16} />,
      action: () => { navigate('/dashboard'); onClose(); }
    },
    {
      id: 'ws-markets',
      title: 'Go to Market Workspace',
      subtitle: 'Index performance, economic calendars, and FRED indexes',
      category: 'Workspaces',
      icon: <TrendingUp size={16} />,
      action: () => { navigate('/markets'); onClose(); }
    },
    {
      id: 'ws-watchlist',
      title: 'Go to Watchlist Hub',
      subtitle: 'Surveillance list for dip monitoring and qualitative moats',
      category: 'Workspaces',
      icon: <Eye size={16} />,
      action: () => { navigate('/watchlist'); onClose(); }
    },
    {
      id: 'ws-opportunities',
      title: 'Go to Opportunity Workspace',
      subtitle: 'Scan catalysts, institutional rotations, and 5-year macro trends',
      category: 'Workspaces',
      icon: <Lightbulb size={16} />,
      action: () => { navigate('/opportunities'); onClose(); }
    },
    {
      id: 'ws-reports',
      title: 'Go to Reports Workspace',
      subtitle: 'Historical briefings, daily dispatches, and regulatory logs',
      category: 'Workspaces',
      icon: <FileText size={16} />,
      action: () => { navigate('/reports'); onClose(); }
    },
    {
      id: 'ws-intelligence',
      title: 'Go to Company Intelligence Workspace',
      subtitle: 'Canonical workspace for mounting individual assets',
      category: 'Workspaces',
      icon: <Brain size={16} />,
      action: () => { navigate('/intelligence'); onClose(); }
    },
    {
      id: 'ws-copilot',
      title: 'Go to AI Copilot Workspace',
      subtitle: 'Prompt templates, document synthesis, and conversational analysis',
      category: 'Workspaces',
      icon: <MessageSquare size={16} />,
      action: () => { navigate('/copilot'); onClose(); }
    },
    {
      id: 'ws-settings',
      title: 'Go to Settings Workspace',
      subtitle: 'Modify risk profiles, interest lists, and credential API keys',
      category: 'Workspaces',
      icon: <Settings size={16} />,
      action: () => { navigate('/settings'); onClose(); }
    },
    // Custom Actions
    {
      id: 'act-add-holding',
      title: 'Add New Holding to Portfolio',
      subtitle: 'Create manual holding item or upload transaction sheet',
      category: 'Actions',
      icon: <Plus size={16} />,
      action: () => { navigate('/dashboard'); onClose(); } // Dashboard triggers manual modals
    },
    {
      id: 'act-start-fresh-copilot',
      title: 'Start Fresh Copilot Conversation',
      subtitle: 'Wipe conversation history and start analytical brief',
      category: 'Actions',
      icon: <Sparkles size={16} />,
      action: () => { navigate('/copilot?reset=true'); onClose(); }
    }
  ];

  // Fetch Companies Registry
  const companyItems: PaletteItem[] = CompanyRegistry.listAll().map(c => ({
    id: `comp-${c.ticker}`,
    title: `${c.ticker} - ${c.sector}`,
    subtitle: `${c.industry} | ${c.exchange} listed`,
    category: 'Companies',
    icon: <Brain size={16} style={{ color: 'var(--color-accent)' }} />,
    action: () => { navigate(`/intelligence/${c.ticker.toLowerCase()}`); onClose(); }
  }));

  const allItems = [...staticItems, ...companyItems];

  // Filter based on query string
  const filteredItems = allItems.filter(item => {
    const q = query.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.subtitle?.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
    );
  });

  // Handle global key events for palette control
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredItems.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredItems.length) % filteredItems.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          filteredItems[selectedIndex].action();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filteredItems, onClose]);

  // Keep selected item in scroll view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector('[aria-selected="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  const categories: ('Workspaces' | 'Companies' | 'Actions')[] = ['Workspaces', 'Companies', 'Actions'];

  // Flattened mapping index for arrow navigation
  let absoluteIdxCounter = 0;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Search Input Bar */}
        <div style={styles.inputContainer}>
          <Search size={18} style={styles.searchIcon} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search workspaces, companies, or commands (Ctrl+K)..."
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            style={styles.input}
          />
          <button style={styles.closeBtn} onClick={onClose} aria-label="Close Command Palette">
            <X size={16} />
          </button>
        </div>

        {/* Dense List Area */}
        <div style={styles.list} ref={listRef}>
          {filteredItems.length === 0 ? (
            <div style={styles.empty}>
              No commands, companies, or workspaces matching "<strong>{query}</strong>" found.
            </div>
          ) : (
            categories.map(category => {
              const categoryItems = filteredItems.filter(item => item.category === category);
              if (categoryItems.length === 0) return null;

              return (
                <div key={category} style={styles.categoryGroup}>
                  <div style={styles.categoryTitle}>{category}</div>
                  <div style={styles.categoryItemsList}>
                    {categoryItems.map(item => {
                      const currentAbsoluteIdx = absoluteIdxCounter++;
                      const isSelected = currentAbsoluteIdx === selectedIndex;

                      return (
                        <div
                          key={item.id}
                          onClick={item.action}
                          onMouseEnter={() => setSelectedIndex(currentAbsoluteIdx)}
                          aria-selected={isSelected}
                          style={{
                            ...styles.item,
                            ...(isSelected ? styles.itemSelected : {})
                          }}
                        >
                          <div style={styles.itemLeft}>
                            <div style={{
                              ...styles.iconWrapper,
                              ...(isSelected ? styles.iconWrapperSelected : {})
                            }}>
                              {item.icon}
                            </div>
                            <div style={styles.itemText}>
                              <div style={styles.itemTitle}>{item.title}</div>
                              {item.subtitle && <div style={styles.itemSubtitle}>{item.subtitle}</div>}
                            </div>
                          </div>
                          {isSelected && (
                            <span style={styles.itemKeyHint}>
                              ⏎ ENTER
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div style={styles.footer}>
          <div style={styles.footerItem}><Command size={10} /> + K / Esc to close</div>
          <div style={styles.footerItem}>↑↓ to navigate</div>
          <div style={styles.footerItem}>⏎ to select</div>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    background: 'rgba(26, 26, 26, 0.45)',
    backdropFilter: 'blur(3px)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: '10vh',
    zIndex: 9999,
  },
  modal: {
    width: '100%',
    maxWidth: '640px',
    background: '#FAF8F5', // warm editorial background
    border: '2px solid #222222',
    boxShadow: '0 12px 30px rgba(0,0,0,0.18)',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '70vh',
  },
  inputContainer: {
    display: 'flex',
    alignItems: 'center',
    borderBottom: '1px solid #E2DACD',
    padding: '0 1rem',
    background: '#FFFFFF',
  },
  searchIcon: {
    color: '#8c2a2a',
    flexShrink: 0,
  },
  input: {
    flexGrow: 1,
    border: 'none',
    outline: 'none',
    padding: '1.25rem 1rem',
    fontSize: '0.9rem',
    fontFamily: 'var(--font-sans)',
    background: 'transparent',
    color: '#1A1A1A',
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: '#888',
    padding: '0.25rem',
  },
  list: {
    overflowY: 'auto',
    flexGrow: 1,
    padding: '1rem 0',
  },
  empty: {
    textAlign: 'center',
    padding: '3rem 1.5rem',
    fontFamily: 'var(--font-serif)',
    fontSize: '0.9rem',
    color: '#666',
  },
  categoryGroup: {
    marginBottom: '1rem',
  },
  categoryTitle: {
    padding: '0.25rem 1.5rem',
    fontSize: '0.65rem',
    fontFamily: 'var(--font-mono)',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: '#8c2a2a',
    background: '#F1EDE6',
    borderBottom: '1px solid #E2DACD',
    borderTop: '1px solid #E2DACD',
  },
  categoryItemsList: {
    display: 'flex',
    flexDirection: 'column',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.65rem 1.5rem',
    cursor: 'pointer',
    borderLeft: '4px solid transparent',
    transition: 'all 0.15s ease-in-out',
  },
  itemSelected: {
    background: '#FFFFFF',
    borderLeft: '4px solid #8c2a2a',
  },
  itemLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    minWidth: 0,
  },
  iconWrapper: {
    width: '28px',
    height: '28px',
    background: '#FAF8F5',
    border: '1px solid #E2DACD',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#555555',
  },
  iconWrapperSelected: {
    background: '#FDF2F2',
    borderColor: '#F8B4B4',
    color: '#8c2a2a',
  },
  itemText: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  itemTitle: {
    fontSize: '0.8rem',
    fontWeight: 600,
    fontFamily: 'var(--font-sans)',
    color: '#222222',
  },
  itemSubtitle: {
    fontSize: '0.7rem',
    color: '#666',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    marginTop: '2px',
  },
  itemKeyHint: {
    fontSize: '0.6rem',
    fontFamily: 'var(--font-mono)',
    color: '#8c2a2a',
    fontWeight: 'bold',
    background: '#FDF2F2',
    border: '1px solid #F8B4B4',
    padding: '2px 6px',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    gap: '1.5rem',
    padding: '0.75rem 1.5rem',
    borderTop: '1px solid #E2DACD',
    background: '#FAF8F5',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.6rem',
    color: '#888',
  },
  footerItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
  }
};

export default CommandPalette;
