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
  Info,
  Download,
  CheckCircle,
  ExternalLink
} from 'lucide-react';

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleNewSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptInput.trim()) return;

    setSending(true);
    try {
      // 1. Create session doc
      const session = await CopilotService.createSession(promptInput, researchMode, isMockMode);
      setSessions(prev => [session, ...prev]);
      setActiveSession(session);
      
      // 2. Clear prompt and append message instantly
      const localUserMsg: CopilotMessage = {
        id: `user_${Date.now()}`,
        sender: 'user',
        content: promptInput,
        timestamp: new Date().toISOString()
      };
      setMessages([localUserMsg]);
      const activePrompt = promptInput;
      setPromptInput('');

      // 3. Dispatch chat call
      const copilotResponse = await CopilotService.sendChatMessage(session.id, activePrompt, isMockMode);
      setMessages(prev => [...prev, copilotResponse]);
      
      // Re-load list to sync counts
      loadSessions();
    } catch (err: any) {
      console.error('Failed to trigger chat initialization:', err);
      alert(err.message || 'Chat compilation failed. Check tier limits.');
    } finally {
      setSending(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptInput.trim() || !activeSession || sending) return;

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
      alert(err.message || 'Limit reached or rate limit blocked request.');
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
    try {
      const md = await CopilotService.exportReport(exportTicker.toUpperCase().trim(), exportExchange, isMockMode);
      setExportReport(md);
    } catch (err: any) {
      alert('Filing facts generation failed for this ticker.');
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
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', minHeight: 'calc(100vh - 4.5rem)', background: 'var(--bg-main)', border: '1px solid #E2DACD', borderRadius: '4px', overflow: 'hidden' }}>
      
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
      <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg-main)' }}>
        
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
              {messages.map((msg) => (
                <div 
                  key={msg.id} 
                  style={{ 
                    alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                    gap: '0.35rem'
                  }}
                >
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>
                    {msg.sender === 'user' ? 'USER REQUEST' : 'COPILOT ASSISTANCE'} — {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>

                  <div style={{ 
                    background: msg.sender === 'user' ? '#FAF1F1' : 'var(--bg-card)', 
                    border: `1px solid ${msg.sender === 'user' ? '#E5D0D1' : '#E2DACD'}`,
                    padding: '1.25rem',
                    color: 'var(--text-primary)',
                    borderRadius: '4px',
                    fontSize: '0.9rem',
                    lineHeight: 1.6,
                    fontFamily: 'var(--font-sans)',
                    textAlign: 'left',
                    boxShadow: 'var(--shadow-subtle)'
                  }}>
                    {/* Render custom markdown details */}
                    <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>

                    {/* Copilot Metadata, Citations, Freshness indicators */}
                    {msg.metadata && (
                      <div style={{ borderTop: '1px solid #E2DACD', marginTop: '0.75rem', paddingTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        
                        {/* Cost & Freshness bar */}
                        <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', fontSize: '0.7rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                          <span>
                            Cost Level: <b style={{ color: msg.metadata.costLevel === 'High' ? 'var(--color-danger-text)' : msg.metadata.costLevel === 'Medium' ? 'var(--color-warning-text)' : 'var(--color-success-text)' }}>
                              {msg.metadata.costLevel === 'High' ? '🔴 High' : msg.metadata.costLevel === 'Medium' ? '🟡 Medium' : '🟢 Very Low'}
                            </b>
                          </span>
                          <span>Confidence: <b style={{ color: 'var(--text-primary)' }}>{msg.metadata.confidenceScore}%</b></span>
                          <span>Data Freshness: <b style={{ color: 'var(--color-success-text)' }}>{msg.metadata.dataFreshness}</b></span>
                        </div>

                        {/* Collapsible Source indexing */}
                        {msg.metadata.usedSources && msg.metadata.usedSources.length > 0 && (
                          <details style={{ marginTop: '0.25rem' }}>
                            <summary style={{ cursor: 'pointer', fontSize: '0.7rem', color: 'var(--color-accent)', fontFamily: 'var(--font-mono)', outline: 'none', fontWeight: 'bold' }}>
                              View Grounded Sources Used ({msg.metadata.usedSources.length})
                            </summary>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', padding: '0.5rem 0', paddingLeft: '0.75rem', borderLeft: '2px solid var(--color-accent)', marginTop: '0.35rem' }}>
                              {msg.metadata.usedSources.map((s, idx) => (
                                <span key={idx} style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                                  [{idx + 1}] {s.name} {s.url && (
                                    <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)', textDecoration: 'underline', marginLeft: '0.25rem', fontWeight: 500 }}>
                                      Open Source <ExternalLink size={10} style={{ display: 'inline', verticalAlign: 'middle' }} />
                                    </a>
                                  )}
                                </span>
                              ))}
                            </div>
                          </details>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {sending && (
                <div style={{ alignSelf: 'flex-start', display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'var(--bg-card)', border: '1px solid #E2DACD', padding: '0.5rem 1rem', borderRadius: '4px', boxShadow: 'var(--shadow-subtle)' }}>
                  <Activity className="animate-spin" size={14} style={{ color: 'var(--color-accent)' }} />
                  <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>Copilot is reasoning...</span>
                </div>
              )}
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1.25rem', color: 'var(--text-secondary)', padding: '2rem' }}>
              <Compass size={40} style={{ color: 'var(--color-accent)' }} />
              <h3 style={{ margin: 0, padding: 0, fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>BusinessOS Copilot</h3>
              <p style={{ margin: 0, padding: 0, fontSize: '0.88rem', textAlign: 'center', maxWidth: '400px', fontFamily: 'var(--font-serif)', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
                Ask complex questions about your active holdings, sector HHI limits, yield curve inversions, macro FRED stats, or recent SEC submissions.
              </p>
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
        <div style={{ padding: '1.25rem 2rem 1.5rem', borderTop: '1px solid #E2DACD', background: 'var(--bg-card)' }}>
          
          <form onSubmit={activeSession ? handleSendMessage : handleNewSession} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>RESEARCH MODE:</span>
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                {(['quick', 'businessos', 'live', 'deep'] as const).map((m) => {
                  const isActive = (!activeSession && researchMode === m) || (activeSession?.researchMode === m);
                  return (
                    <button 
                      key={m}
                      type="button"
                      onClick={() => {
                        if (!activeSession) {
                          setResearchMode(m);
                        } else {
                          alert('To switch modes, please start a New Chat.');
                        }
                      }}
                      style={{ 
                        fontSize: '0.65rem', 
                        textTransform: 'uppercase', 
                        padding: '0.25rem 0.5rem',
                        background: isActive ? 'var(--color-accent)' : 'var(--bg-input)',
                        color: isActive ? '#fff' : 'var(--text-secondary)',
                        border: isActive ? '1px solid var(--color-accent)' : '1px solid #E2DACD',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 'bold'
                      }}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>

              {!activeSession && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                  <Info size={12} style={{ color: 'var(--color-accent)' }} />
                  <span>Quick/BusinessOS use cached logs. Live/Deep crawl fresh web news.</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <input 
                type="text" 
                placeholder={activeSession ? "Ask Copilot a question..." : "Enter your initial prompt to start a conversation..."}
                value={promptInput}
                onChange={e => setPromptInput(e.target.value)}
                disabled={sending}
                style={{ flex: 1, padding: '0.75rem 1rem', fontSize: '0.85rem', background: 'var(--bg-input)', border: '1px solid #E2DACD', color: 'var(--text-primary)', outline: 'none', borderRadius: '2px' }}
              />
              <button type="submit" disabled={sending || !promptInput.trim()} className="btn" style={{ padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--color-accent)', border: '1px solid var(--color-accent)', color: '#fff', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>
                <Send size={16} /> <span>{activeSession ? 'Send' : 'Start'}</span>
              </button>
            </div>

          </form>

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
