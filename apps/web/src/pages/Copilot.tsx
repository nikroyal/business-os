import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { CopilotService } from '../services/copilotService';
import type { CopilotSession, CopilotMessage } from '../services/copilotService';
import { ExportService } from '../services/exportService';
import { 
  MessageSquare, 
  Send, 
  Plus, 
  Trash2, 
  Pin, 
  Archive, 
  Star, 
  Search, 
  FileText, 
  Activity,
  Compass, 
  Download,
  CheckCircle,
  ExternalLink
} from 'lucide-react';

const promptSuggestions = [
  { title: "Should I invest in Apple?", prompt: "Should I invest in Apple right now? Walk me through the bull and bear cases, valuation, and what to watch.", icon: "🍎" },
  { title: "How is the economy doing?", prompt: "How is the US economy doing right now? What do the latest inflation, GDP and interest rate trends tell us?", icon: "📈" },
  { title: "Compare NVDA vs AMD", prompt: "Compare Nvidia and AMD. Which looks stronger right now from a business and valuation perspective?", icon: "⚡" },
  { title: "What's happening in markets?", prompt: "Give me a summary of what's happening in global markets and what macro themes I should be paying attention to.", icon: "🌐" },
];

// Inline Markdown Parser: Bold, Italic, Code, Links
const renderInlineMarkdown = (text: string): React.ReactNode[] => {
  const parts: React.ReactNode[] = [];
  let key = 0;
  let currentText = text;
  
  while (currentText) {
    const boldMatch = currentText.match(/^([^\*]*)\*\*([^\*]+)\*\*(.*)$/);
    const codeMatch = currentText.match(/^([^`]*)`([^`]+)`(.*)$/);
    const linkMatch = currentText.match(/^([^\[]*)\[([^\]]+)\]\(([^)]+)\)(.*)$/);
    
    const boldIndex = boldMatch ? currentText.indexOf('**') : -1;
    const codeIndex = codeMatch ? currentText.indexOf('`') : -1;
    const linkIndex = linkMatch ? currentText.indexOf('[') : -1;
    
    const indices = [
      { type: 'bold', index: boldIndex, match: boldMatch },
      { type: 'code', index: codeIndex, match: codeMatch },
      { type: 'link', index: linkIndex, match: linkMatch }
    ].filter(x => x.index !== -1).sort((a, b) => a.index - b.index);
    
    if (indices.length === 0) {
      parts.push(<span key={key++}>{currentText}</span>);
      break;
    }
    
    const primary = indices[0];
    if (primary.type === 'bold' && primary.match) {
      const [_, pre, boldVal, post] = primary.match;
      if (pre) parts.push(<span key={key++}>{pre}</span>);
      parts.push(<strong key={key++} style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{boldVal}</strong>);
      currentText = post;
    } else if (primary.type === 'code' && primary.match) {
      const [_, pre, codeVal, post] = primary.match;
      if (pre) parts.push(<span key={key++}>{pre}</span>);
      parts.push(
        <code key={key++} style={{
          background: '#FAF1F1',
          padding: '0.15rem 0.35rem',
          borderRadius: '3px',
          fontSize: '0.85em',
          fontFamily: 'var(--font-mono, monospace)',
          color: '#c2410c',
          border: '1px solid #fed7aa'
        }}>
          {codeVal}
        </code>
      );
      currentText = post;
    } else if (primary.type === 'link' && primary.match) {
      const [_, pre, linkText, linkUrl, post] = primary.match;
      if (pre) parts.push(<span key={key++}>{pre}</span>);
      parts.push(
        <a key={key++} href={linkUrl} target="_blank" rel="noopener noreferrer" style={{
          color: 'var(--color-accent)',
          textDecoration: 'underline',
          fontWeight: '500'
        }}>
          {linkText}
        </a>
      );
      currentText = post;
    }
  }
  
  return parts.length > 0 ? parts : [text];
};

// Render Table Block Helper
const renderTableBlock = (lines: string[], key: number): React.ReactNode => {
  const rows = lines.map(line => {
    return line.split('|').map(cell => cell.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);
  }).filter(row => row.length > 0);

  if (rows.length === 0) return null;

  const isDivider = (row: string[]) => row.every(cell => cell.startsWith('-') || cell.startsWith(':'));
  const filteredRows = rows.filter(row => !isDivider(row));

  const headers = filteredRows[0];
  const bodyRows = filteredRows.slice(1);

  return (
    <div key={key} style={{ overflowX: 'auto', margin: '0.75rem 0', border: '1px solid #E2DACD', borderRadius: '4px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
        <thead>
          <tr style={{ background: '#FAF8F5', borderBottom: '2px solid var(--color-primary)' }}>
            {headers.map((h, i) => (
              <th key={i} style={{ padding: '0.6rem 0.8rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bodyRows.map((row, rIdx) => (
            <tr key={rIdx} style={{ borderBottom: '1px solid #E2DACD', background: rIdx % 2 === 1 ? '#FAF8F5' : 'transparent' }}>
              {row.map((cell, cIdx) => (
                <td key={cIdx} style={{ padding: '0.6rem 0.8rem', color: 'var(--text-secondary)' }}>
                  {renderInlineMarkdown(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Main Markdown Block Parser
const renderMarkdown = (text: string) => {
  if (!text) return null;

  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let currentBlockType: 'paragraph' | 'ul' | 'ol' | 'code' | 'table' | 'none' = 'none';
  let accumLines: string[] = [];

  const flushBlock = (key: number) => {
    if (accumLines.length === 0) return;
    const content = accumLines.join('\n');
    
    if (currentBlockType === 'code') {
      elements.push(
        <pre key={key} style={{
          background: '#F0EBE1',
          border: '1px solid #E2DACD',
          borderRadius: '4px',
          padding: '1rem',
          overflowX: 'auto',
          fontSize: '0.8rem',
          fontFamily: 'var(--font-mono, monospace)',
          margin: '0.5rem 0',
          color: 'var(--text-primary)'
        }}>
          <code>{content}</code>
        </pre>
      );
    } else if (currentBlockType === 'ul') {
      elements.push(
        <ul key={key} style={{ paddingLeft: '1.5rem', margin: '0.5rem 0', listStyleType: 'disc' }}>
          {accumLines.map((li, i) => (
            <li key={i} style={{ marginBottom: '0.25rem' }}>{renderInlineMarkdown(li)}</li>
          ))}
        </ul>
      );
    } else if (currentBlockType === 'ol') {
      elements.push(
        <ol key={key} style={{ paddingLeft: '1.5rem', margin: '0.5rem 0', listStyleType: 'decimal' }}>
          {accumLines.map((li, i) => (
            <li key={i} style={{ marginBottom: '0.25rem' }}>{renderInlineMarkdown(li)}</li>
          ))}
        </ol>
      );
    } else if (currentBlockType === 'table') {
      elements.push(renderTableBlock(accumLines, key));
    } else {
      elements.push(
        <p key={key} style={{ margin: '0.5rem 0', lineHeight: '1.6' }}>
          {renderInlineMarkdown(content)}
        </p>
      );
    }
    accumLines = [];
    currentBlockType = 'none';
  };

  let blockKey = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      if (currentBlockType === 'code') {
        flushBlock(blockKey++);
      } else {
        flushBlock(blockKey++);
        currentBlockType = 'code';
      }
      continue;
    }

    if (currentBlockType === 'code') {
      accumLines.push(line);
      continue;
    }

    if (trimmed.startsWith('#')) {
      flushBlock(blockKey++);
      const match = trimmed.match(/^(#{1,6})\s+(.*)$/);
      if (match) {
        const level = match[1].length;
        const text = match[2];
        const fontSize = level === 1 ? '1.5rem' : level === 2 ? '1.3rem' : level === 3 ? '1.15rem' : '1rem';
        const margin = level === 1 ? '1.25rem 0 0.5rem' : '0.85rem 0 0.4rem';
        elements.push(
          React.createElement(`h${level}`, {
            key: blockKey++,
            style: {
              fontSize,
              margin,
              fontFamily: 'var(--font-serif)',
              color: 'var(--text-primary)',
              borderBottom: level <= 2 ? '1px solid #E2DACD' : 'none',
              paddingBottom: level <= 2 ? '0.25rem' : '0',
              fontWeight: 'bold'
            }
          }, renderInlineMarkdown(text))
        );
        continue;
      }
    }

    if (trimmed === '---' || trimmed === '***') {
      flushBlock(blockKey++);
      elements.push(<hr key={blockKey++} style={{ border: 'none', borderTop: '1px solid #E2DACD', margin: '1rem 0' }} />);
      continue;
    }

    if (trimmed.startsWith('>')) {
      flushBlock(blockKey++);
      const text = trimmed.substring(1).trim();
      elements.push(
        <blockquote key={blockKey++} style={{
          borderLeft: '4px solid var(--color-accent)',
          paddingLeft: '1rem',
          margin: '0.75rem 0',
          color: 'var(--text-secondary)',
          fontStyle: 'italic',
          background: '#FAF8F5',
          padding: '0.5rem 1rem'
        }}>
          {renderInlineMarkdown(text)}
        </blockquote>
      );
      continue;
    }

    if (trimmed.startsWith('* ') || trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
      if (currentBlockType !== 'ul') {
        flushBlock(blockKey++);
        currentBlockType = 'ul';
      }
      accumLines.push(trimmed.substring(2));
      continue;
    }

    if (/^\d+\.\s/.test(trimmed)) {
      if (currentBlockType !== 'ol') {
        flushBlock(blockKey++);
        currentBlockType = 'ol';
      }
      const matchContent = trimmed.match(/^\d+\.\s+(.*)$/);
      accumLines.push(matchContent ? matchContent[1] : trimmed);
      continue;
    }

    if (trimmed.startsWith('|')) {
      if (currentBlockType !== 'table') {
        flushBlock(blockKey++);
        currentBlockType = 'table';
      }
      accumLines.push(trimmed);
      continue;
    }

    if (!trimmed) {
      flushBlock(blockKey++);
      continue;
    }

    if (currentBlockType !== 'paragraph' && currentBlockType !== 'none') {
      flushBlock(blockKey++);
    }
    currentBlockType = 'paragraph';
    accumLines.push(line);
  }

  flushBlock(blockKey++);
  return <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>{elements}</div>;
};

export const Copilot: React.FC = () => {
  const { user, isMockMode } = useAuth();
  const [sessions, setSessions] = useState<CopilotSession[]>([]);
  const [activeSession, setActiveSession] = useState<CopilotSession | null>(null);
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [sending, setSending] = useState(false);
  
  // Inputs
  const [promptInput, setPromptInput] = useState('');
  const [researchMode, setResearchMode] = useState<'quick' | 'businessos' | 'live' | 'deep'>('businessos');
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  
  // Export states
  const [exporting, setExporting] = useState(false);
  const [exportTicker, setExportTicker] = useState('');
  const [exportExchange, setExportExchange] = useState('NASDAQ');
  const [exportReport, setExportReport] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [errorState, setErrorState] = useState<{ message: string; prompt: string; sessionId: string } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadSessions = async () => {
    try {
      const data = await CopilotService.getSessions(isMockMode);
      setSessions(data);
      if (data.length > 0 && !activeSession) {
        // Auto select first session
        handleSelectSession(data[0]);
      }
    } catch (e) {
      console.error('Failed to load copilot sessions:', e);
    }
  };

  const handleSelectSession = async (session: CopilotSession) => {
    setErrorState(null);
    setActiveSession(session);
    setLoadingHistory(true);
    try {
      const history = await CopilotService.getHistory(session.id, isMockMode);
      setMessages(history);
    } catch (e) {
      console.error('Failed to fetch session messages:', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadSessions();
    }
  }, [user, isMockMode]);

  // Context-binding check on mount or ticker query change
  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const urlTicker = queryParams.get('ticker');
    
    if (urlTicker && user && sessions.length > 0) {
      const tickerName = urlTicker.toUpperCase();
      const defaultPrompt = `Analyze the moat status, solvency risks, and smart money flow indicators for ${tickerName} based on recent disclosures.`;
      
      // Prevent infinite auto-creation if already active
      if (activeSession && activeSession.title.includes(tickerName)) return;

      const matchingSession = sessions.find(s => s.title.includes(tickerName));
      if (matchingSession) {
        handleSelectSession(matchingSession);
      } else {
        setLoadingHistory(true);
        CopilotService.createSession(defaultPrompt, 'deep', isMockMode)
          .then(async (newSession) => {
            setSessions(prev => [newSession, ...prev]);
            setActiveSession(newSession);
            
            const userMsg: CopilotMessage = {
              id: `user_${Date.now()}`,
              sender: 'user',
              content: defaultPrompt,
              timestamp: new Date().toISOString()
            };
            setMessages([userMsg]);
            setSending(true);
            try {
              const reply = await CopilotService.sendChatMessage(newSession.id, defaultPrompt, isMockMode);
              setMessages([userMsg, reply]);
            } catch (err) {
              console.error('Auto session trigger chat failed:', err);
            } finally {
              setSending(false);
              setLoadingHistory(false);
            }
          })
          .catch(err => {
            console.error('Auto session creation failed:', err);
            setLoadingHistory(false);
          });
      }
    }
  }, [user, sessions.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleNewSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptInput.trim()) return;

    setErrorState(null);
    const activePrompt = promptInput;
    setPromptInput('');
    setSending(true);
    let createdSessionId = '';
    try {
      // 1. Create session doc
      const session = await CopilotService.createSession(activePrompt, researchMode, isMockMode);
      createdSessionId = session.id;
      setSessions(prev => [session, ...prev]);
      setActiveSession(session);
      
      // 2. Clear prompt and append message instantly
      const localUserMsg: CopilotMessage = {
        id: `user_${Date.now()}`,
        sender: 'user',
        content: activePrompt,
        timestamp: new Date().toISOString()
      };
      setMessages([localUserMsg]);

      // 3. Dispatch chat call
      const copilotResponse = await CopilotService.sendChatMessage(session.id, activePrompt, isMockMode);
      setMessages(prev => [...prev, copilotResponse]);
      
      // Re-load list to sync counts
      loadSessions();
    } catch (err: any) {
      console.error('Failed to trigger chat initialization:', err);
      setErrorState({
        message: err.message || 'Chat compilation failed. Check tier limits.',
        prompt: activePrompt,
        sessionId: createdSessionId
      });
    } finally {
      setSending(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptInput.trim() || !activeSession || sending) return;

    setErrorState(null);
    const currentPrompt = promptInput;
    setPromptInput('');
    setSending(true);

    const localUserMsg: CopilotMessage = {
      id: `user_${Date.now()}`,
      sender: 'user',
      content: currentPrompt,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, localUserMsg]);

    try {
      const copilotResponse = await CopilotService.sendChatMessage(activeSession.id, currentPrompt, isMockMode);
      setMessages(prev => [...prev, copilotResponse]);
      loadSessions();
    } catch (err: any) {
      console.error('Failed to process message query:', err);
      setErrorState({
        message: err.message || 'Limit reached or rate limit blocked request.',
        prompt: currentPrompt,
        sessionId: activeSession.id
      });
    } finally {
      setSending(false);
    }
  };

  const handleRetry = async () => {
    if (!errorState) return;
    const { prompt, sessionId } = errorState;
    setErrorState(null);
    setSending(true);

    try {
      const copilotResponse = await CopilotService.sendChatMessage(sessionId, prompt, isMockMode);
      setMessages(prev => [...prev, copilotResponse]);
      loadSessions();
    } catch (err: any) {
      console.error('Failed to retry message query:', err);
      setErrorState({
        message: err.message || 'Limit reached or rate limit blocked request.',
        prompt,
        sessionId
      });
    } finally {
      setSending(false);
    }
  };

  const handleSuggestionClick = async (promptText: string) => {
    setPromptInput('');
    setErrorState(null);
    setSending(true);
    let createdSessionId = '';
    try {
      const session = await CopilotService.createSession(promptText, researchMode, isMockMode);
      createdSessionId = session.id;
      setSessions(prev => [session, ...prev]);
      setActiveSession(session);
      
      const localUserMsg: CopilotMessage = {
        id: `user_${Date.now()}`,
        sender: 'user',
        content: promptText,
        timestamp: new Date().toISOString()
      };
      setMessages([localUserMsg]);

      const copilotResponse = await CopilotService.sendChatMessage(session.id, promptText, isMockMode);
      setMessages(prev => [...prev, copilotResponse]);
      loadSessions();
    } catch (err: any) {
      console.error('Failed suggestion trigger:', err);
      setErrorState({
        message: err.message || 'Chat compilation failed.',
        prompt: promptText,
        sessionId: createdSessionId
      });
    } finally {
      setSending(false);
    }
  };

  const handleTogglePin = async (e: React.MouseEvent, session: CopilotSession) => {
    e.stopPropagation();
    try {
      const updated = await CopilotService.updateSession(session.id, { pinned: !session.pinned }, isMockMode);
      setSessions(prev => prev.map(s => s.id === session.id ? updated : s).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
      if (activeSession?.id === session.id) {
        setActiveSession(updated);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleFavorite = async (e: React.MouseEvent, session: CopilotSession) => {
    e.stopPropagation();
    try {
      const updated = await CopilotService.updateSession(session.id, { favorite: !session.favorite }, isMockMode);
      setSessions(prev => prev.map(s => s.id === session.id ? updated : s));
      if (activeSession?.id === session.id) {
        setActiveSession(updated);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleArchive = async (e: React.MouseEvent, session: CopilotSession) => {
    e.stopPropagation();
    try {
      const updated = await CopilotService.updateSession(session.id, { archived: !session.archived }, isMockMode);
      setSessions(prev => prev.map(s => s.id === session.id ? updated : s));
      if (activeSession?.id === session.id) {
        setActiveSession(updated);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete the entire conversation? Messages cannot be restored.')) return;
    try {
      await CopilotService.deleteSession(sessionId, isMockMode);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (activeSession?.id === sessionId) {
        setActiveSession(null);
        setMessages([]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleGenerateResearchReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exportTicker.trim()) return;
    setExporting(true);
    setExportReport(null);
    setExportError(null);
    try {
      const md = await CopilotService.exportReport(exportTicker.toUpperCase().trim(), exportExchange, isMockMode);
      setExportReport(md);
    } catch (err: any) {
      setExportError(err.message || 'Filing facts generation failed for this ticker.');
    } finally {
      setExporting(false);
    }
  };

  // Filter sessions
  const filteredSessions = sessions.filter(s => {
    const matchesSearch = s.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch && (showArchived ? s.archived : !s.archived);
  });

  const pinnedSessions = filteredSessions.filter(s => s.pinned);
  const generalSessions = filteredSessions.filter(s => !s.pinned);

  return (
    <div className="workspace-page" style={{ padding: 0 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', height: '100%', background: 'var(--bg-main)', border: '1px solid #E2DACD', overflow: 'hidden' }}>
      
      {/* Session Navigation panel */}
      <div style={{ borderRight: '1px solid #E2DACD', display: 'flex', flexDirection: 'column', background: '#FAF8F5' }}>
        
        <div style={{ padding: '1.25rem', borderBottom: '1px solid #E2DACD', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--color-accent)', letterSpacing: '0.05em' }}>COPILOT SESSIONS</span>
            <button onClick={() => { setActiveSession(null); setMessages([]); }} className="btn btn-sm btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '0.35rem 0.6rem', fontSize: '0.7rem', border: '1px solid var(--color-accent)', color: 'var(--color-accent)', background: 'transparent', fontFamily: 'var(--font-serif)', fontWeight: 'bold' }}>
              <Plus size={12} /> New Chat
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.35rem', borderBottom: '1px solid #E2DACD', paddingBottom: '0.5rem' }}>
            <button 
              onClick={() => setShowArchived(false)} 
              style={{ flex: 1, fontSize: '0.65rem', padding: '0.35rem', background: !showArchived ? 'var(--color-accent)' : 'transparent', color: !showArchived ? '#fff' : 'var(--text-secondary)', border: !showArchived ? '1px solid var(--color-accent)' : '1px solid #E2DACD', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontWeight: 'bold', textTransform: 'uppercase' }}
            >
              Active
            </button>
            <button 
              onClick={() => setShowArchived(true)} 
              style={{ flex: 1, fontSize: '0.65rem', padding: '0.35rem', background: showArchived ? 'var(--color-accent)' : 'transparent', color: showArchived ? '#fff' : 'var(--text-secondary)', border: showArchived ? '1px solid var(--color-accent)' : '1px solid #E2DACD', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontWeight: 'bold', textTransform: 'uppercase' }}
            >
              Archived
            </button>
          </div>

          <div style={{ position: 'relative' }}>
            <input 
              type="text" 
              placeholder="Search conversations..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '0.4rem 0.5rem 0.4rem 1.8rem', fontSize: '0.75rem', background: 'var(--bg-input)', border: '1px solid #E2DACD', color: 'var(--text-primary)', outline: 'none' }}
            />
            <Search size={12} style={{ position: 'absolute', left: '0.6rem', top: '0.65rem', color: 'var(--text-muted)' }} />
          </div>
        </div>

        {/* Sessions list */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.35rem', padding: '0.75rem' }}>
          
          {pinnedSessions.length > 0 && (
            <>
              <div style={{ padding: '0.25rem 0.5rem', fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--color-accent)', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.05em' }}>Pinned</div>
              {pinnedSessions.map(session => (
                <SessionRow 
                  key={session.id} 
                  session={session} 
                  active={activeSession?.id === session.id}
                  onClick={() => handleSelectSession(session)}
                  onPin={handleTogglePin}
                  onFavorite={handleToggleFavorite}
                  onArchive={handleToggleArchive}
                  onDelete={handleDeleteSession}
                />
              ))}
            </>
          )}

          <div style={{ padding: '0.25rem 0.5rem', fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '0.5rem', fontWeight: 'bold', letterSpacing: '0.05em' }}>Recent</div>
          {generalSessions.length > 0 ? (
            generalSessions.map(session => (
              <SessionRow 
                key={session.id} 
                session={session} 
                active={activeSession?.id === session.id}
                onClick={() => handleSelectSession(session)}
                onPin={handleTogglePin}
                onFavorite={handleToggleFavorite}
                onArchive={handleToggleArchive}
                onDelete={handleDeleteSession}
              />
            ))
          ) : (
            <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}>No conversations found</div>
          )}
        </div>

      </div>

      {/* Main chat client panel */}
      <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg-main)', height: '100%', overflow: 'hidden' }}>
        
        {/* Chat Header controls */}
        {activeSession ? (
          <div style={{ padding: '0.75rem 1.5rem', borderBottom: '1px solid #E2DACD', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MessageSquare size={16} style={{ color: 'var(--color-accent)' }} />
              <strong style={{ fontSize: '0.95rem', fontFamily: 'var(--font-serif)', color: 'var(--text-primary)' }}>{activeSession.title}</strong>
              <span className="mono-tag" style={{ fontSize: '0.6rem', textTransform: 'uppercase', background: '#F0EBE1', padding: '0.15rem 0.4rem', border: '1px solid #E2DACD' }}>{activeSession.researchMode} MODE</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <button 
                onClick={() => ExportService.exportConversationToMarkdown(activeSession, messages)} 
                className="btn btn-sm btn-secondary" 
                style={{ padding: '0.35rem 0.6rem', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', border: '1px solid #E2DACD', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}
                title="Export to Markdown"
              >
                <Download size={12} /> MD
              </button>
              <button 
                onClick={() => ExportService.exportConversationToPDF(activeSession, messages)} 
                className="btn btn-sm btn-secondary" 
                style={{ padding: '0.35rem 0.6rem', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', border: '1px solid #E2DACD', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}
                title="Export to PDF"
              >
                <FileText size={12} /> PDF
              </button>
              <button 
                onClick={(e) => handleTogglePin(e, activeSession)} 
                className="btn btn-sm btn-secondary" 
                style={{ padding: '0.35rem', border: '1px solid #E2DACD', background: 'transparent', color: activeSession.pinned ? 'var(--color-accent)' : 'var(--text-muted)', cursor: 'pointer' }}
                title="Pin Conversation"
              >
                <Pin size={14} />
              </button>
              <button 
                onClick={(e) => handleToggleFavorite(e, activeSession)} 
                className="btn btn-sm btn-secondary" 
                style={{ padding: '0.35rem', border: '1px solid #E2DACD', background: 'transparent', color: activeSession.favorite ? '#B45309' : 'var(--text-muted)', cursor: 'pointer' }}
                title="Favorite"
              >
                <Star size={14} />
              </button>
              <button 
                onClick={(e) => handleToggleArchive(e, activeSession)} 
                className="btn btn-sm btn-secondary" 
                style={{ padding: '0.35rem', border: '1px solid #E2DACD', background: 'transparent', color: activeSession.archived ? 'var(--color-warning-text)' : 'var(--text-muted)', cursor: 'pointer' }}
                title="Archive"
              >
                <Archive size={14} />
              </button>
              <button 
                onClick={(e) => handleDeleteSession(e, activeSession.id)} 
                className="btn btn-sm btn-secondary" 
                style={{ padding: '0.35rem', border: '1px solid #E2DACD', background: 'transparent', color: 'var(--color-danger-text)', cursor: 'pointer' }}
                title="Delete Conversation"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ) : (
          <div style={{ padding: '0.75rem 1.5rem', borderBottom: '1px solid #E2DACD', display: 'flex', alignItems: 'center', background: 'var(--bg-card)', minHeight: '3.1rem' }}>
            <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.03em' }}>START A NEW COPILOT REASONING INTERFACE</span>
          </div>
        )}

        {/* Chat message timeline */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {loadingHistory ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1rem' }}>
              <Activity className="animate-spin" size={24} style={{ color: 'var(--color-accent)' }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>DECRYPTING FIRESTORE MESSAGE CHUNKS...</span>
            </div>
          ) : messages.length > 0 ? (
            <>
              {messages.map((msg) => {
                const isUser = msg.sender === 'user';
                
                // Parse follow-up suggestions from copilot content
                const followUps: string[] = [];
                let cleanedContent = msg.content;
                
                if (!isUser) {
                  const followUpRegex = /^\s*[\*\-]\s*\[Follow-up:\s*(.*?)\]\s*$/gm;
                  let match;
                  while ((match = followUpRegex.exec(msg.content)) !== null) {
                    followUps.push(match[1]);
                  }
                  cleanedContent = msg.content.replace(/^\s*[\*\-]\s*\[Follow-up:\s*.*?\]\s*$/gm, '').trim();
                }

                return (
                  <div 
                    key={msg.id} 
                    style={{ 
                      alignSelf: isUser ? 'flex-end' : 'flex-start',
                      maxWidth: '85%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: isUser ? 'flex-end' : 'flex-start',
                      gap: '0.35rem'
                    }}
                  >
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>
                      {isUser ? 'USER REQUEST' : 'COPILOT ASSISTANCE'} — {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>

                    <div style={{ 
                      background: isUser ? '#FAF1F1' : '#FFFFFF', 
                      border: `1px solid ${isUser ? '#E5D0D1' : '#E2DACD'}`,
                      padding: '1.25rem',
                      color: 'var(--text-primary)',
                      borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                      fontSize: '0.92rem',
                      lineHeight: 1.6,
                      fontFamily: 'var(--font-sans)',
                      textAlign: 'left',
                      boxShadow: 'var(--shadow-subtle)'
                    }}>
                      {isUser ? (
                        <div style={{ whiteSpace: 'pre-wrap' }}>{cleanedContent}</div>
                      ) : (
                        <div>{renderMarkdown(cleanedContent)}</div>
                      )}

                      {/* Collapsible Response Details (Hiding metadata by default) */}
                      {!isUser && msg.metadata && (
                        <details style={{ marginTop: '0.75rem', borderTop: '1px solid #E2DACD', paddingTop: '0.5rem' }}>
                          <summary style={{ cursor: 'pointer', fontSize: '0.72rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', outline: 'none', fontWeight: 'bold' }}>
                            ▼ Response Details
                          </summary>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem', fontSize: '0.72rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                            <div>Actual Model: <strong>{msg.metadata.actualModel || 'Gemini 1.5 Pro'}</strong></div>
                            <div>Requested Model: <strong>{msg.metadata.requestedModel || 'Copilot Router'}</strong></div>
                            <div>Confidence Score: <strong>{msg.metadata.confidenceScore}%</strong></div>
                            <div>Data Freshness: <strong>{msg.metadata.dataFreshness}</strong></div>
                            <div>Execution Cost: <strong>${msg.metadata.executionCost} ({msg.metadata.costLevel} Tier)</strong></div>
                            {msg.metadata.fallbackModelUsed && (
                              <div style={{ color: '#b45309' }}>Failover Engaged: <strong>Yes (Fallback model active)</strong></div>
                            )}
                            {msg.metadata.subsystemsUsed && msg.metadata.subsystemsUsed.length > 0 && (
                              <div>Subsystems Triggered: <strong>{msg.metadata.subsystemsUsed.join(', ')}</strong></div>
                            )}

                            {msg.metadata.usedSources && msg.metadata.usedSources.length > 0 && (
                              <div style={{ marginTop: '0.25rem' }}>
                                <div style={{ fontWeight: 'bold', marginBottom: '0.15rem' }}>Grounded Sources Used:</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', paddingLeft: '0.5rem', borderLeft: '2px solid var(--color-accent)' }}>
                                  {msg.metadata.usedSources.map((s, idx) => (
                                    <span key={idx}>
                                      [{idx + 1}] {s.name} {s.url && (
                                        <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)', textDecoration: 'underline', marginLeft: '0.25rem' }}>
                                          Open Link <ExternalLink size={8} style={{ display: 'inline', verticalAlign: 'middle' }} />
                                        </a>
                                      )}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </details>
                      )}
                    </div>

                    {/* Rendering follow-up suggestions as beautiful chip buttons below bubble */}
                    {!isUser && followUps.length > 0 && (
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.4rem', alignSelf: 'flex-start', maxWidth: '100%' }}>
                        {followUps.map((q, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleSuggestionClick(q)}
                            disabled={sending}
                            style={{
                              background: '#FFFFFF',
                              border: '1px solid var(--color-accent)',
                              color: 'var(--color-accent)',
                              padding: '0.3rem 0.75rem',
                              borderRadius: '16px',
                              fontSize: '0.72rem',
                              cursor: 'pointer',
                              transition: 'all 0.15s',
                              fontFamily: 'var(--font-sans)',
                              fontWeight: '500',
                              outline: 'none',
                              boxShadow: 'var(--shadow-subtle)'
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.background = 'var(--color-accent)';
                              e.currentTarget.style.color = '#fff';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.background = '#FFFFFF';
                              e.currentTarget.style.color = 'var(--color-accent)';
                            }}
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {errorState && (
                <div style={{
                  alignSelf: 'flex-start',
                  maxWidth: '85%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  border: '1px solid #E5D0D1',
                  background: '#FAF1F1',
                  padding: '1.25rem',
                  borderRadius: '4px',
                  boxShadow: 'var(--shadow-subtle)'
                }}>
                  <span style={{ fontSize: '0.65rem', color: '#b91c1c', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>
                    ⚠️ ERROR OCCURRED
                  </span>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', fontWeight: '500' }}>
                    Copilot encountered a response-formatting problem. The response could not be processed.
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#7f1d1d', fontFamily: 'var(--font-mono)' }}>
                    {errorState.message}
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                    <button
                      onClick={handleRetry}
                      style={{
                        padding: '0.4rem 0.8rem',
                        fontSize: '0.75rem',
                        background: 'var(--color-accent)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        transition: 'background 0.15s'
                      }}
                    >
                      Retry
                    </button>
                    <button
                      onClick={() => {
                        setPromptInput(errorState.prompt);
                        setErrorState(null);
                      }}
                      style={{
                        padding: '0.4rem 0.8rem',
                        fontSize: '0.75rem',
                        background: 'transparent',
                        color: 'var(--text-secondary)',
                        border: '1px solid #E2DACD',
                        borderRadius: '3px',
                        cursor: 'pointer'
                      }}
                    >
                      Edit Message
                    </button>
                  </div>
                </div>
              )}
              {sending && (
                <div style={{
                  alignSelf: 'flex-start',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem',
                  maxWidth: '85%'
                }}>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>COPILOT ASSISTANCE</span>
                  <div style={{
                    background: '#FFFFFF',
                    border: '1px solid #E2DACD',
                    padding: '1rem 1.25rem',
                    borderRadius: '12px 12px 12px 2px',
                    boxShadow: 'var(--shadow-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', fontStyle: 'italic' }}>Thinking</span>
                    <span style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      {[0, 1, 2].map(i => (
                        <span key={i} style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: 'var(--color-accent)',
                          display: 'inline-block',
                          animation: `dot-bounce 1.2s ease-in-out ${i * 0.2}s infinite`
                        }} />
                      ))}
                    </span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1.25rem', color: 'var(--text-secondary)', padding: '2rem' }}>
              <Compass size={40} style={{ color: 'var(--color-accent)' }} />
              <h3 style={{ margin: 0, padding: 0, fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>BusinessOS Copilot</h3>
              <p style={{ margin: 0, padding: 0, fontSize: '0.88rem', textAlign: 'center', maxWidth: '400px', fontFamily: 'var(--font-serif)', lineHeight: '1.6', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                Ask complex questions about your active holdings, sector HHI limits, yield curve inversions, macro FRED stats, or recent SEC submissions.
              </p>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '1rem',
                maxWidth: '650px',
                width: '100%',
                marginTop: '1rem'
              }}>
                {promptSuggestions.map((suggestion, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSuggestionClick(suggestion.prompt)}
                    style={{
                      background: '#fff',
                      border: '1px solid #E2DACD',
                      padding: '1rem',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.4rem',
                      alignItems: 'flex-start',
                      transition: 'all 0.2s',
                      boxShadow: 'var(--shadow-subtle)',
                      textAlign: 'left'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = 'var(--color-accent)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = '#E2DACD';
                      e.currentTarget.style.transform = 'none';
                    }}
                  >
                    <span style={{ fontSize: '1.5rem' }}>{suggestion.icon}</span>
                    <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontFamily: 'var(--font-serif)' }}>{suggestion.title}</strong>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>{suggestion.prompt}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Export Full Report section */}
        {activeSession && (
          <div style={{ margin: '0 2rem', padding: '1rem', border: '1px solid #E2DACD', background: 'var(--bg-card)', display: 'flex', flexDirection: 'column', gap: '0.50rem', boxShadow: 'var(--shadow-subtle)' }}>
            <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--color-accent)', textTransform: 'uppercase', fontWeight: 'bold' }}>Expand conversation to Equity Report</span>
            <form onSubmit={handleGenerateResearchReport} style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>Ticker:</span>
                <input 
                  type="text" 
                  placeholder="AAPL" 
                  value={exportTicker} 
                  onChange={e => setExportTicker(e.target.value)}
                  style={{ width: '80px', padding: '0.35rem 0.5rem', fontSize: '0.75rem', background: 'var(--bg-input)', border: '1px solid #E2DACD', color: 'var(--text-primary)', textTransform: 'uppercase', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>Exchange:</span>
                <select 
                  value={exportExchange} 
                  onChange={e => setExportExchange(e.target.value)}
                  style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem', background: 'var(--bg-input)', border: '1px solid #E2DACD', color: 'var(--text-primary)', outline: 'none' }}
                >
                  <option value="NASDAQ">NASDAQ</option>
                  <option value="NYSE">NYSE</option>
                  <option value="NSE">NSE (India)</option>
                  <option value="BSE">BSE (India)</option>
                </select>
              </div>

              <button type="submit" disabled={exporting || !exportTicker} className="btn btn-sm btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', padding: '0.4rem 1rem', background: 'var(--color-accent)', border: '1px solid var(--color-accent)', color: '#fff', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>
                {exporting ? <Activity className="animate-spin" size={12} /> : <FileText size={12} />} Ingest Facts & Compile
              </button>
            </form>

            {exportError && (
              <span style={{ fontSize: '0.72rem', color: '#b91c1c', marginTop: '0.35rem', fontFamily: 'var(--font-mono)' }}>
                ⚠️ {exportError}
              </span>
            )}
            {exportReport && (
              <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-success-text)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}>
                  <CheckCircle size={14} /> Full Research Report compiled successfully.
                </span>
                <button 
                  onClick={() => {
                    const blob = new Blob([exportReport], { type: 'text/markdown' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `BusinessOS_Research_${exportTicker.toUpperCase()}_${new Date().toISOString().split('T')[0]}.md`;
                    a.click();
                  }}
                  className="btn btn-sm btn-secondary"
                  style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', padding: '0.35rem 0.75rem', border: '1px solid #E2DACD', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}
                >
                  <Download size={12} /> Download Markdown (.md)
                </button>
              </div>
            )}
          </div>
        )}

        {/* Input box */}
        <div style={{ padding: '1rem 2rem 1.25rem', borderTop: '1px solid #E2DACD', background: 'var(--bg-card)' }}>
          
          <form onSubmit={activeSession ? handleSendMessage : handleNewSession} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>MODE:</span>
              <div style={{ display: 'flex', gap: '0.3rem' }}>
                {(['quick', 'businessos', 'live', 'deep'] as const).map((m) => {
                  const isActive = (!activeSession && researchMode === m) || (activeSession?.researchMode === m);
                  return (
                    <button 
                      key={m}
                      type="button"
                      onClick={() => {
                        if (!activeSession) setResearchMode(m);
                      }}
                      style={{ 
                        fontSize: '0.62rem', 
                        textTransform: 'uppercase', 
                        padding: '0.2rem 0.5rem',
                        background: isActive ? 'var(--color-accent)' : 'transparent',
                        color: isActive ? '#fff' : 'var(--text-secondary)',
                        border: isActive ? '1px solid var(--color-accent)' : '1px solid #E2DACD',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 'bold',
                        borderRadius: '2px'
                      }}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
              <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Enter to send · Shift+Enter for new line</span>
            </div>

            <div style={{ position: 'relative', display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
              <textarea
                placeholder={activeSession ? "Ask anything about your portfolio, markets, companies or macro..." : "What would you like to explore today?"}
                value={promptInput}
                onChange={e => setPromptInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (promptInput.trim() && !sending) {
                      const syntheticEvent = { preventDefault: () => {} } as React.FormEvent;
                      if (activeSession) handleSendMessage(syntheticEvent);
                      else handleNewSession(syntheticEvent);
                    }
                  }
                }}
                disabled={sending}
                rows={2}
                style={{
                  flex: 1,
                  padding: '0.75rem 1rem',
                  fontSize: '0.88rem',
                  background: 'var(--bg-input)',
                  border: '1px solid #E2DACD',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  borderRadius: '8px',
                  resize: 'none',
                  lineHeight: '1.5',
                  fontFamily: 'var(--font-sans)',
                  transition: 'border-color 0.15s'
                }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-accent)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#E2DACD'; }}
              />
              <button
                type="submit"
                disabled={sending || !promptInput.trim()}
                style={{
                  padding: '0.65rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  background: sending || !promptInput.trim() ? '#E2DACD' : 'var(--color-accent)',
                  border: 'none',
                  color: sending || !promptInput.trim() ? 'var(--text-muted)' : '#fff',
                  cursor: sending || !promptInput.trim() ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 'bold',
                  fontSize: '0.8rem',
                  borderRadius: '8px',
                  transition: 'all 0.15s',
                  flexShrink: 0,
                  alignSelf: 'flex-end'
                }}
              >
                <Send size={15} /> {activeSession ? 'Send' : 'Start'}
              </button>
            </div>

          </form>

        </div>

      </div>

    </div>
    </div>
  );
};

// Session Row helper component
interface SessionRowProps {
  session: CopilotSession;
  active: boolean;
  onClick: () => void;
  onPin: (e: React.MouseEvent, s: CopilotSession) => void;
  onFavorite: (e: React.MouseEvent, s: CopilotSession) => void;
  onArchive: (e: React.MouseEvent, s: CopilotSession) => void;
  onDelete: (e: React.MouseEvent, id: string) => void;
}

const SessionRow: React.FC<SessionRowProps> = ({ 
  session, 
  active, 
  onClick, 
  onPin, 
  onFavorite, 
  onArchive, 
  onDelete 
}) => {
  return (
    <div 
      onClick={onClick}
      style={{ 
        padding: '0.6rem 0.8rem', 
        background: active ? 'var(--bg-card)' : 'transparent',
        border: active ? '1px solid #E2DACD' : '1px solid transparent',
        borderLeft: active ? '3px solid var(--color-accent)' : '3px solid transparent',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.25rem',
        borderRadius: '2px',
        transition: 'all 0.2s',
        boxShadow: active ? 'var(--shadow-subtle)' : 'none'
      }}
      className="session-row"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
        <strong style={{ fontSize: '0.78rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', flex: 1, color: active ? 'var(--text-primary)' : 'var(--text-secondary)', fontFamily: 'var(--font-serif)', fontWeight: active ? 'bold' : 'normal' }}>
          {session.title}
        </strong>
        <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
          <button onClick={e => onPin(e, session)} style={{ background: 'none', border: 'none', padding: '1px', color: session.pinned ? 'var(--color-accent)' : 'var(--text-muted)', cursor: 'pointer' }} title="Pin">
            <Pin size={10} />
          </button>
          <button onClick={e => onFavorite(e, session)} style={{ background: 'none', border: 'none', padding: '1px', color: session.favorite ? '#B45309' : 'var(--text-muted)', cursor: 'pointer' }} title="Favorite">
            <Star size={10} />
          </button>
          <button onClick={e => onArchive(e, session)} style={{ background: 'none', border: 'none', padding: '1px', color: session.archived ? 'var(--color-warning-text)' : 'var(--text-muted)', cursor: 'pointer' }} title="Archive">
            <Archive size={10} />
          </button>
          <button onClick={e => onDelete(e, session.id)} style={{ background: 'none', border: 'none', padding: '1px', color: 'var(--text-muted)', cursor: 'pointer' }} title="Delete">
            <Trash2 size={10} />
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.6rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
        <span style={{ fontWeight: 'bold' }}>{session.researchMode.toUpperCase()}</span>
        <span>{new Date(session.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
      </div>
    </div>
  );
};
