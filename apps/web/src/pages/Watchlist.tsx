import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Plus, 
  Trash2, 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  Calendar,
  Eye,
  Info
} from 'lucide-react';
import { WatchlistService } from '../services/watchlistService';
import type { WatchlistAssetIntelligence } from '../services/watchlistService';
import { marketDataService } from '../services/marketDataService';
import { PlatformHealthWidget } from '../components/PlatformHealthWidget';
import { OpportunityService } from '../services/opportunityService';
import type { Opportunity } from '../services/firebase';

export const Watchlist: React.FC = () => {
  const { user } = useAuth();
  
  const [watchlist, setWatchlist] = useState<WatchlistAssetIntelligence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<WatchlistAssetIntelligence | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [exchangeFilter, setExchangeFilter] = useState<'all' | 'us' | 'india'>('all');
  const [sortBy, setSortBy] = useState<'ticker' | 'changeDesc' | 'changeAsc' | 'priceDesc'>('ticker');
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);

  // Form state
  const [ticker, setTicker] = useState('');
  const [exchange, setExchange] = useState('NASDAQ');
  const [customSymbol, setCustomSymbol] = useState('');
  const [namePreview, setNamePreview] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const fetchWatchlist = async (selectFirst = false) => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [data, opps] = await Promise.all([
        WatchlistService.getWatchlistIntelligence(user.uid),
        OpportunityService.getStoredOpportunities(user.uid).catch(oppErr => {
          console.warn('Failed to load opportunities for watchlist badges:', oppErr);
          return [] as Opportunity[];
        })
      ]);
      
      setWatchlist(data);
      setOpportunities(opps);
      setLastUpdated(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      
      // Auto-select the first asset if requested or preserve existing selection
      if (data.length > 0) {
        if (selectFirst) {
          setSelectedAsset(data[0]);
        } else if (selectedAsset) {
          const updated = data.find((item: WatchlistAssetIntelligence) => item.item.id === selectedAsset.item.id);
          setSelectedAsset(updated || data[0]);
        }
      } else {
        setSelectedAsset(null);
      }
    } catch (err) {
      console.error('Error loading watchlist:', err);
      setError('Failed to resolve watchlist data and intelligence metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchWatchlist(true);
    }
  }, [user]);

  // Pre-fill metadata when ticker fields lose focus
  const handleTickerBlur = async () => {
    if (!ticker) return;
    const cleanTicker = ticker.toUpperCase().trim();
    setFormError(null);
    try {
      const metadata = await marketDataService.getMetadata(cleanTicker, exchange);
      if (metadata) {
        setNamePreview(metadata.name);
        if (!customSymbol) {
          setCustomSymbol(metadata.ticker);
        }
      } else {
        setNamePreview('');
      }
    } catch (err) {
      console.warn('Metadata preview failed:', err);
    }
  };

  const handleAddAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!ticker.trim()) {
      setFormError('Ticker symbol is required.');
      return;
    }

    setIsAdding(true);
    setFormError(null);

    // Guard against duplicate watchlist items
    const isDuplicate = watchlist.some(
      x => x.item.ticker.toUpperCase().trim() === ticker.toUpperCase().trim() && 
           x.item.exchange.toUpperCase().trim() === exchange.toUpperCase().trim()
    );
    if (isDuplicate) {
      setFormError(`${ticker.toUpperCase()} is already on your watchlist.`);
      setIsAdding(false);
      return;
    }

    try {
      await WatchlistService.addAsset(
        user.uid,
        ticker,
        exchange,
        customSymbol || ticker
      );
      // Reset form
      setTicker('');
      setCustomSymbol('');
      setNamePreview('');
      setExchange('NASDAQ');
      
      await fetchWatchlist();
    } catch (err: any) {
      setFormError(err.message || 'Failed to add asset to watchlist.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveAsset = async (itemId: string, tickerStr: string) => {
    if (!user) return;
    if (window.confirm(`Are you sure you want to stop tracking ${tickerStr}?`)) {
      try {
        await WatchlistService.removeAsset(user.uid, itemId);
        if (selectedAsset?.item.id === itemId) {
          setSelectedAsset(null);
        }
        await fetchWatchlist();
      } catch (err) {
        console.error('Error removing asset:', err);
        alert('Failed to remove asset.');

      }
    }
  };

  const formatCurrency = (val: number, currencyCode: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(val);
  };

  const formatPercent = (val: number) => {
    const sign = val > 0 ? '+' : '';
    return `${sign}${val.toFixed(2)}%`;
  };

  const formatMarketCap = (val?: number) => {
    if (!val || val === 0) return '—';
    if (val >= 1000000) {
      return `${(val / 1000000).toFixed(2)}T`;
    }
    if (val >= 1000) {
      return `${(val / 1000).toFixed(2)}B`;
    }
    return `${val.toFixed(2)}M`;
  };
  const filteredAndSortedWatchlist = watchlist
    .filter(entry => {
      if (exchangeFilter === 'all') return true;
      const ex = entry.item.exchange.toUpperCase();
      if (exchangeFilter === 'us') {
        return ex === 'NASDAQ' || ex === 'NYSE';
      }
      if (exchangeFilter === 'india') {
        return ex === 'NSE' || ex === 'BSE';
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'ticker') {
        return a.item.symbol.localeCompare(b.item.symbol);
      }
      if (sortBy === 'changeDesc') {
        return b.quote.percentChange - a.quote.percentChange;
      }
      if (sortBy === 'changeAsc') {
        return a.quote.percentChange - b.quote.percentChange;
      }
      if (sortBy === 'priceDesc') {
        return b.quote.current - a.quote.current;
      }
      return 0;
    });

  return (
    <div style={{ animation: 'fadeIn 0.25s ease-out', textAlign: 'left' }}>
      
      {/* Editorial Header bar */}
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
            Opportunity Scanning & Market Monitor
          </span>
          <h1 style={{ border: 'none', padding: 0, margin: 0, fontSize: '2.5rem' }}>
            Watchlist Intelligence
          </h1>
        </div>
        
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <Calendar size={14} />
              <span>{formattedDate}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-success-text)' }}>
              <Eye size={12} />
              <span>WATCHLIST ONLINE {lastUpdated ? `(UPDATED ${lastUpdated})` : ''}</span>
            </div>
          </div>
          <PlatformHealthWidget />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2.5rem', alignItems: 'start' }}>
        
        {/* Left Side: Ledger & Add Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
          
          {/* Add Asset Form Card */}
          <div className="card" style={{ padding: '1.5rem 2rem' }}>
            <h3 style={{ fontSize: '1.15rem', marginBottom: '1rem', borderBottom: '1px solid #E2DACD', paddingBottom: '0.5rem', fontFamily: 'var(--font-serif)' }}>
              Track New Market Asset
            </h3>
            <form onSubmit={handleAddAsset} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: '120px' }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Exchange</label>
                <select 
                  className="form-input form-select" 
                  value={exchange} 
                  onChange={(e) => setExchange(e.target.value)}
                  style={{ height: '38px', padding: '0.25rem 0.5rem' }}
                >
                  <option value="NASDAQ">NASDAQ (US)</option>
                  <option value="NYSE">NYSE (US)</option>
                  <option value="NSE">NSE (India)</option>
                  <option value="BSE">BSE (India)</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: '1', minWidth: '150px' }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Ticker Symbol</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. MSFT, RELIANCE, AAPL" 
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value)}
                  onBlur={handleTickerBlur}
                  style={{ height: '38px' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: '120px' }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Display Tag</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. MSFT" 
                  value={customSymbol}
                  onChange={(e) => setCustomSymbol(e.target.value)}
                  style={{ height: '38px' }}
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ height: '38px', display: 'flex', alignItems: 'center', gap: '0.4rem' }} disabled={isAdding}>
                <Plus size={16} />
                <span>{isAdding ? 'Adding...' : 'Track'}</span>
              </button>
            </form>

            {namePreview && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                Asset Matched: <strong style={{ color: 'var(--text-primary)' }}>{namePreview}</strong>
              </div>
            )}

            {formError && (
              <div style={{ 
                marginTop: '1rem',
                background: 'var(--color-danger-bg)', 
                border: '1px solid var(--color-danger-border)', 
                color: 'var(--color-danger-text)', 
                padding: '0.5rem 0.75rem', 
                fontSize: '0.75rem', 
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <AlertCircle size={14} />
                <span>{formError}</span>
              </div>
            )}
          </div>

          {/* Watchlist Ledger */}
          <div className="card" style={{ padding: '2rem 2.5rem' }}>
            <div style={{ borderBottom: '1px solid #222222', paddingBottom: '0.75rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <h2 style={{ fontSize: '1.5rem', fontFamily: 'var(--font-serif)', margin: 0 }}>
                  Watched Assets Ledger
                </h2>
                
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Market:</span>
                    <select
                      className="form-input form-select"
                      value={exchangeFilter}
                      onChange={(e) => setExchangeFilter(e.target.value as any)}
                      style={{ height: '30px', padding: '0 0.5rem', fontSize: '0.75rem', minWidth: '110px', background: '#FCFAF6', border: '1px solid #E2DACD', fontFamily: 'var(--font-mono)' }}
                    >
                      <option value="all">All Markets</option>
                      <option value="us">US Markets</option>
                      <option value="india">India Markets</option>
                    </select>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Sort:</span>
                    <select
                      className="form-input form-select"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      style={{ height: '30px', padding: '0 0.5rem', fontSize: '0.75rem', minWidth: '150px', background: '#FCFAF6', border: '1px solid #E2DACD', fontFamily: 'var(--font-mono)' }}
                    >
                      <option value="ticker">Ticker (A-Z)</option>
                      <option value="changeDesc">Change (High to Low)</option>
                      <option value="changeAsc">Change (Low to High)</option>
                      <option value="priceDesc">Price (High to Low)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {loading && watchlist.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
                <span className="mono-tag">Resolving Ledger Intelligence...</span>
              </div>
            ) : error ? (
              <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--color-danger-text)' }}>
                <AlertCircle size={32} style={{ marginBottom: '0.5rem' }} />
                <p>{error}</p>
                <button onClick={() => fetchWatchlist()} className="btn btn-secondary btn-sm">Retry</button>
              </div>
            ) : watchlist.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem 1rem', border: '1px dashed #E2DACD', background: '#FCFAF6' }}>
                <Eye size={36} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
                <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', marginBottom: '1rem' }}>No assets are currently being watched.</p>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Use the form above to track equities without buying them.</span>
              </div>
            ) : (
              <div className="financial-table-wrapper">
                <table className="financial-table">
                  <thead>
                    <tr>
                      <th>Ticker</th>
                      <th>Sector / Industry</th>
                      <th>Country</th>
                      <th className="num-val">Market Cap</th>
                      <th className="num-val">Live Price</th>
                      <th className="num-val">Daily Change</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAndSortedWatchlist.map((entry) => {
                      const isSelected = selectedAsset?.item.id === entry.item.id;
                      const hasPrice = entry.quote.current > 0;
                      const matchingOpps = opportunities.filter(
                        opp => opp.ticker.toUpperCase() === entry.item.ticker.toUpperCase() && 
                               opp.exchange.toUpperCase() === entry.item.exchange.toUpperCase()
                      );
                      return (
                        <tr 
                          key={entry.item.id}
                          onClick={() => setSelectedAsset(entry)}
                          style={{ 
                            cursor: 'pointer',
                            backgroundColor: isSelected ? '#F5EFE6' : 'transparent',
                            borderLeft: isSelected ? '3px solid var(--color-accent)' : 'none'
                          }}
                        >
                          <td style={{ fontWeight: 600 }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>{entry.item.symbol}</span>
                                {matchingOpps.length > 0 && (
                                  <span style={{
                                    backgroundColor: 'var(--color-accent)',
                                    color: '#FFFFFF',
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: '0.6rem',
                                    padding: '0.1rem 0.3rem',
                                    borderRadius: '2px',
                                    fontWeight: 'bold',
                                    letterSpacing: '0.5px'
                                  }} title={`${matchingOpps.length} active opportunity signal(s) detected`}>
                                    SIGNAL
                                  </span>
                                )}
                              </div>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 'normal' }}>{entry.metadata?.name || entry.item.name}</span>
                            </div>
                          </td>
                          <td>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              {entry.normalized.sector}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '0.75rem' }}>{entry.normalized.country}</span>
                              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{entry.normalized.region}</span>
                            </div>
                          </td>
                          <td className="num-val">
                            <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                              {formatMarketCap(entry.metadata?.marketCapitalization)}
                            </span>
                          </td>
                          <td className="num-val" style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                            {hasPrice ? formatCurrency(entry.quote.current, entry.item.currency) : '—'}
                          </td>
                          <td className="num-val" style={{ color: entry.quote.percentChange >= 0 ? 'var(--color-success-text)' : 'var(--color-danger-text)' }}>
                            {hasPrice ? (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.25rem', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: 600 }}>
                                {entry.quote.percentChange >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                <span>{formatPercent(entry.quote.percentChange)}</span>
                              </div>
                            ) : '—'}
                          </td>
                          <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                            <button 
                              onClick={() => handleRemoveAsset(entry.item.id, entry.item.symbol)}
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-danger-text)', padding: '0.25rem' }}
                              title="Stop Tracking"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

        {/* Right Side: Selected Asset Intelligence Summary */}
        <div>
          {selectedAsset ? (
            <div className="card" style={{ padding: '2rem 1.75rem', position: 'sticky', top: '1.5rem', animation: 'fadeIn 0.2s ease-out' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid var(--text-primary)', paddingBottom: '0.75rem', marginBottom: '1.5rem' }}>
                <div>
                  <span className="mono-tag" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.25rem', display: 'block' }}>
                    Asset Profile & Scanning Analysis
                  </span>
                  <h3 style={{ fontSize: '1.4rem', fontFamily: 'var(--font-serif)', margin: 0 }}>
                    {selectedAsset.item.symbol}
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {selectedAsset.metadata?.name || selectedAsset.item.name}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="mono-tag" style={{ fontSize: '0.65rem', background: '#E2DACD' }}>{selectedAsset.item.exchange}</span>
                </div>
              </div>

              {/* Valuation & Details Box */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: '#FCFAF6', border: '1px solid #E2DACD', padding: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', fontFamily: 'var(--font-mono)' }}>Live Quote</span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>
                    {selectedAsset.quote.current > 0 ? formatCurrency(selectedAsset.quote.current, selectedAsset.item.currency) : '—'}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', fontFamily: 'var(--font-mono)' }}>Daily Change</span>
                  <span style={{ 
                    fontSize: '1.1rem', 
                    fontWeight: 'bold', 
                    fontFamily: 'var(--font-mono)',
                    color: selectedAsset.quote.percentChange >= 0 ? 'var(--color-success-text)' : 'var(--color-danger-text)'
                  }}>
                    {selectedAsset.quote.current > 0 ? formatPercent(selectedAsset.quote.percentChange) : '—'}
                  </span>
                </div>
              </div>

              {/* Opportunity Scanning Section */}
              <h4 style={{ fontSize: '0.9rem', textTransform: 'uppercase', borderBottom: '1px solid #E2DACD', paddingBottom: '0.25rem', marginBottom: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                Opportunity Signals
              </h4>
              
              {/* Active Opportunity Signals */}
              {(() => {
                const itemOpps = opportunities.filter(
                  opp => opp.ticker.toUpperCase() === selectedAsset.item.ticker.toUpperCase() && 
                         opp.exchange.toUpperCase() === selectedAsset.item.exchange.toUpperCase()
                );
                if (itemOpps.length === 0) return null;
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
                    {itemOpps.map((opp) => (
                      <div key={opp.id} style={{
                        backgroundColor: '#FCFAF6',
                        border: '1px solid var(--color-accent)',
                        padding: '0.75rem',
                        animation: 'fadeIn 0.25s ease-out'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--color-accent)', fontWeight: 'bold' }}>
                            ⚡ ACTIVE SYSTEM SIGNAL
                          </span>
                          <span style={{ 
                            fontFamily: 'var(--font-mono)', 
                            fontSize: '0.6rem', 
                            background: 'var(--color-accent)', 
                            color: '#FFFFFF', 
                            padding: '0.1rem 0.3rem',
                            fontWeight: 'bold'
                          }}>
                            {opp.confidenceScore}% CONFIDENCE
                          </span>
                        </div>
                        <span style={{ fontSize: '0.85rem', fontFamily: 'var(--font-serif)', display: 'block', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                          {opp.title}
                        </span>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                          {opp.rationale}
                        </p>
                      </div>
                    ))}
                  </div>
                );
              })()}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                
                {/* 52w High */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>52-Week High:</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
                      {selectedAsset.fiftyTwoWeekHigh > 0 ? formatCurrency(selectedAsset.fiftyTwoWeekHigh, selectedAsset.item.currency) : '—'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                    <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Distance from peak:</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-danger-text)', fontWeight: 'bold' }}>
                      {selectedAsset.fiftyTwoWeekHigh > 0 ? selectedAsset.distanceFrom52WeekHigh.toFixed(2) + '%' : '—'}
                    </span>
                  </div>
                </div>

                {/* 52w Low */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>52-Week Low:</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
                      {selectedAsset.fiftyTwoWeekLow > 0 ? formatCurrency(selectedAsset.fiftyTwoWeekLow, selectedAsset.item.currency) : '—'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                    <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Rebound from low:</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-success-text)', fontWeight: 'bold' }}>
                      {selectedAsset.fiftyTwoWeekLow > 0 ? '+' + selectedAsset.distanceFrom52WeekLow.toFixed(2) + '%' : '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Performance Returns Timeline */}
              <h4 style={{ fontSize: '0.9rem', textTransform: 'uppercase', borderBottom: '1px solid #E2DACD', paddingBottom: '0.25rem', marginBottom: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                Returns Timeline
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', borderBottom: '1px dashed #E2DACD', paddingBottom: '0.4rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Daily Performance:</span>
                  <span style={{ 
                    fontFamily: 'var(--font-mono)', 
                    fontWeight: 'bold',
                    color: selectedAsset.dailyPerformance >= 0 ? 'var(--color-success-text)' : 'var(--color-danger-text)' 
                  }}>
                    {selectedAsset.quote.current > 0 ? formatPercent(selectedAsset.dailyPerformance) : '—'}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', borderBottom: '1px dashed #E2DACD', paddingBottom: '0.4rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Weekly Return (7d):</span>
                  <span style={{ 
                    fontFamily: 'var(--font-mono)', 
                    fontWeight: 'bold',
                    color: selectedAsset.weeklyPerformance >= 0 ? 'var(--color-success-text)' : 'var(--color-danger-text)' 
                  }}>
                    {selectedAsset.quote.current > 0 ? formatPercent(selectedAsset.weeklyPerformance) : '—'}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', borderBottom: '1px dashed #E2DACD', paddingBottom: '0.4rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Monthly Return (30d):</span>
                  <span style={{ 
                    fontFamily: 'var(--font-mono)', 
                    fontWeight: 'bold',
                    color: selectedAsset.thirtyDayPerformance >= 0 ? 'var(--color-success-text)' : 'var(--color-danger-text)' 
                  }}>
                    {selectedAsset.quote.current > 0 ? formatPercent(selectedAsset.thirtyDayPerformance) : '—'}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', paddingBottom: '0.25rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Quarterly Return (90d):</span>
                  <span style={{ 
                    fontFamily: 'var(--font-mono)', 
                    fontWeight: 'bold',
                    color: selectedAsset.ninetyDayPerformance >= 0 ? 'var(--color-success-text)' : 'var(--color-danger-text)' 
                  }}>
                    {selectedAsset.quote.current > 0 ? formatPercent(selectedAsset.ninetyDayPerformance) : '—'}
                  </span>
                </div>
              </div>

              {/* Opportunity Scanner Disclaimer */}
              <div style={{ 
                marginTop: '1.5rem',
                border: '1px solid #E2DACD',
                padding: '0.75rem',
                background: '#FCFAF6',
                display: 'flex',
                gap: '0.5rem',
                alignItems: 'flex-start'
              }}>
                <Info size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0, marginTop: '0.1rem' }} />
                <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', lineHeight: 1.3 }}>
                  This panel computes raw price indicators for future opportunity scanning. AI-generated commentary and scan reports will be activated in the next phase.
                </span>
              </div>

            </div>
          ) : (
            <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', borderStyle: 'dashed' }}>
              <Info size={24} style={{ margin: '0 auto 0.5rem auto' }} />
              <p style={{ fontSize: '0.85rem', fontFamily: 'var(--font-serif)', fontStyle: 'italic', margin: 0 }}>
                Select an asset in the ledger to view opportunity scan stats.
              </p>
            </div>
          )}
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

export default Watchlist;
