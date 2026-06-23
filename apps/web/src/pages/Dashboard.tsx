import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { dbService } from '../services/firebase';
import type { Holding } from '../services/firebase';
import { marketDataService } from '../services/marketDataService';
import type { AssetMetadata } from '../services/marketDataService';
import { PortfolioAnalyticsService } from '../services/portfolioAnalyticsService';
import type { PortfolioAnalytics } from '../services/portfolioAnalyticsService';
import { WatchlistService } from '../services/watchlistService';
import type { WatchlistAssetIntelligence } from '../services/watchlistService';
import { useNavigate } from 'react-router-dom';
import { 
  CheckCircle, 
  Calendar, 
  Plus, 
  Edit2, 
  Trash2, 
  TrendingUp, 
  TrendingDown, 
  Briefcase,
  AlertCircle,
  X,
  ChevronRight,
  ShieldAlert,
  FileSpreadsheet,
  Sparkles
} from 'lucide-react';
import { PlatformHealthWidget } from '../components/PlatformHealthWidget';
import { OnboardingChecklist } from '../components/OnboardingChecklist';
import { PortfolioCSVImporter } from '../components/PortfolioCSVImporter';
import { SampleDataService } from '../services/sampleDataService';


// Map sectors/industries to consistent editorial colors
const SECTOR_COLORS: Record<string, string> = {
  'Technology': '#8c2a2a',
  'Financial Services': '#4A5568',
  'Energy / Conglomerate': '#B45309',
  'Energy': '#D97706',
  'Cryptocurrency': '#2C6B50',
  'Cash & Cash Equivalents': '#555555',
  'Automotive': '#9A3412',
  'Real Estate': '#B59963',
  'Other': '#718096'
};

export const Dashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [marketPrices, setMarketPrices] = useState<Record<string, number>>({});
  const [analytics, setAnalytics] = useState<PortfolioAnalytics | null>(null);
  const [watchlistSummary, setWatchlistSummary] = useState<WatchlistAssetIntelligence[]>([]);
  const [loadingHoldings, setLoadingHoldings] = useState(true);
  const [reportsCount, setReportsCount] = useState(0);
  const [opportunitiesCount, setOpportunitiesCount] = useState(0);
  const [isCsvImportOpen, setIsCsvImportOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHolding, setEditingHolding] = useState<Holding | null>(null);
  const [saving, setSaving] = useState(false);

  // Form Fields
  const [symbol, setSymbol] = useState('');
  const [name, setName] = useState('');
  const [ticker, setTicker] = useState('');
  const [exchange, setExchange] = useState('NASDAQ');
  const [currency, setCurrency] = useState('USD');
  const [assetClass, setAssetClass] = useState('Equity');
  const [quantity, setQuantity] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);

  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const reportingCurrency = profile?.reportingCurrency || 'INR';
  const usdToInrRate = profile?.usdToInrRate || 83.50;

  const fetchHoldings = async () => {
    if (!user) return;
    setLoadingHoldings(true);
    setError(null);
    try {
      const list = await dbService.getHoldings(user.uid);
      setHoldings(list);

      // Fetch prices and metadata via services
      const prices: Record<string, number> = {};
      const metadataMap: Record<string, AssetMetadata | null> = {};
      
      for (const h of list) {
        prices[h.id] = await marketDataService.getPrice(h.ticker, h.exchange, h.currentPrice || h.purchasePrice);
        const meta = await marketDataService.getMetadata(h.ticker, h.exchange);
        metadataMap[h.ticker || h.symbol] = meta;
      }
      setMarketPrices(prices);

      // Run analytics engine
      const calcResult = PortfolioAnalyticsService.calculate(
        list,
        prices,
        metadataMap,
        reportingCurrency,
        usdToInrRate,
        profile?.riskProfile
      );
      setAnalytics(calcResult);

      // Save daily portfolio snapshot
      const todayStr = new Date().toISOString().split('T')[0];
      await dbService.savePortfolioSnapshot(user.uid, {
        date: todayStr,
        portfolioValue: calcResult.totalValue,
        investedCapital: calcResult.totalCost,
        gainLoss: calcResult.totalGainLoss,
        holdingsCount: list.length
      });

      // Fetch watchlist intelligence
      const watchListIntell = await WatchlistService.getWatchlistIntelligence(user.uid);
      setWatchlistSummary(watchListIntell.slice(0, 5)); // display top 5 on dashboard

      // Fetch counts for onboarding checklist
      const [reports, opps] = await Promise.all([
        dbService.getReports(user.uid).catch(() => []),
        dbService.getOpportunities(user.uid).catch(() => [])
      ]);
      setReportsCount(reports.length);
      setOpportunitiesCount(opps.length);

      setLastUpdated(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err: any) {
      console.error('Error compiling dashboard portfolio data:', err);
      setError('Failed to resolve portfolio stats and compile analytics reports.');
    } finally {
      setLoadingHoldings(false);
    }
  };

  const handleLoadSampleData = async () => {
    if (!user) return;
    try {
      await SampleDataService.loadSampleData(user.uid);
      await fetchHoldings();
    } catch (err) {
      console.error('Failed to load sample data:', err);
      alert('Failed to load sample portfolio data.');
    }
  };

  useEffect(() => {
    if (user) {
      fetchHoldings();
    }
  }, [user, reportingCurrency, usdToInrRate, profile?.riskProfile]);

  const openAddModal = () => {
    setEditingHolding(null);
    setSymbol('');
    setName('');
    setTicker('');
    setExchange('NASDAQ');
    setCurrency('USD');
    setAssetClass('Equity');
    setQuantity('');
    setPurchasePrice('');
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (holding: Holding) => {
    setEditingHolding(holding);
    setSymbol(holding.symbol);
    setName(holding.name);
    setTicker(holding.ticker || holding.symbol);
    setExchange(holding.exchange || 'NASDAQ');
    setCurrency(holding.currency || 'USD');
    setAssetClass(holding.assetClass);
    setQuantity(holding.quantity.toString());
    setPurchasePrice(holding.purchasePrice.toString());
    setPurchaseDate(holding.purchaseDate || new Date().toISOString().split('T')[0]);
    setError(null);
    setIsModalOpen(true);
  };

  // Pre-fill details using MarketDataService metadata helper
  const handleTickerBlur = async () => {
    if (!ticker) return;
    const cleanTicker = ticker.toUpperCase().trim();
    try {
      const metadata = await marketDataService.getMetadata(cleanTicker, exchange);
      if (metadata) {
        if (!name) setName(metadata.name);
        if (!symbol) setSymbol(metadata.ticker);
        if (metadata.exchange && exchange === 'NASDAQ') setExchange(metadata.exchange);
        if (metadata.currency) setCurrency(metadata.currency);
      }
    } catch (err) {
      console.warn('Error pre-filling ticker metadata:', err);
    }
  };

  const handleSaveHolding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!symbol || !ticker || !exchange || !currency || !quantity || !purchasePrice || !purchaseDate) {
      setError('Please fill in all required fields.');
      return;
    }

    const qty = parseFloat(quantity);
    const pPrice = parseFloat(purchasePrice);

    if (isNaN(qty) || qty <= 0) {
      setError('Quantity must be a positive number.');
      return;
    }
    if (isNaN(pPrice) || pPrice < 0) {
      setError('Purchase price must be positive or zero.');
      return;
    }

    setSaving(true);
    setError(null);

    // Get current price from the marketDataService or fallback to purchase price
    let currentValPrice = pPrice;
    try {
      currentValPrice = await marketDataService.getPrice(ticker.toUpperCase().trim(), exchange, pPrice);
    } catch (err) {
      console.warn('Failed to pre-fetch price during save, using purchase price:', err);
    }

    const data = {
      symbol: symbol.toUpperCase().trim(),
      ticker: ticker.toUpperCase().trim(),
      exchange,
      currency,
      assetClass,
      name: name.trim() || `${ticker.toUpperCase().trim()} Asset`,
      quantity: qty,
      purchasePrice: pPrice,
      purchaseDate,
      currentPrice: currentValPrice
    };

    try {
      if (editingHolding) {
        await dbService.updateHolding(user.uid, editingHolding.id, data);
      } else {
        await dbService.addHolding(user.uid, data);
      }
      setIsModalOpen(false);
      await fetchHoldings();
    } catch (err: any) {
      console.error('Error saving holding:', err);
      setError(err.message || 'Failed to save holding.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteHolding = async (holdingId: string) => {
    if (!user) return;
    if (window.confirm('Are you sure you want to remove this asset from your portfolio?')) {
      try {
        await dbService.deleteHolding(user.uid, holdingId);
        await fetchHoldings();
      } catch (err: any) {
        console.error('Error deleting holding:', err);
        alert('Failed to delete holding.');
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
            Daily Intelligence & Asset Ledger
          </span>
          <h1 style={{ border: 'none', padding: 0, margin: 0, fontSize: '2.5rem' }}>
            Portfolio Dashboard
          </h1>
        </div>
        
        {/* Newspaper Date Meta */}
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <Calendar size={14} />
              <span>{formattedDate}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-success-text)' }}>
              <CheckCircle size={12} />
              <span>PORTFOLIO LEDGER ONLINE {lastUpdated ? `(UPDATED AT ${lastUpdated})` : ''}</span>
            </div>
          </div>
          <PlatformHealthWidget />
        </div>
      </div>

      <OnboardingChecklist 
        holdingsCount={holdings.length}
        watchlistCount={watchlistSummary.length}
        reportsCount={reportsCount}
        opportunitiesCount={opportunitiesCount}
        onLoadSample={handleLoadSampleData}
      />

      {error && (
        <div style={{ 
          background: 'var(--color-danger-bg)', 
          border: '1px solid var(--color-danger-border)', 
          color: 'var(--color-danger-text)', 
          padding: '1rem 1.5rem', 
          marginBottom: '2rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      <div className="dashboard-grid">
        
        {/* Left Column: Metrics, Health, Ledger, Detailed Allocations */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
          
          {/* Portfolio Metric Highlights */}
          <div className="metric-summary-grid">
            <div className="metric-card">
              <span className="metric-label">Total Value ({reportingCurrency})</span>
              <div className="metric-value">
                {analytics ? formatCurrency(analytics.totalValue, reportingCurrency) : formatCurrency(0, reportingCurrency)}
              </div>
              <div className="metric-change" style={{ color: 'var(--text-secondary)' }}>
                <span>Converted portfolio value</span>
              </div>
            </div>
            
            <div className="metric-card">
              <span className="metric-label">Invested Capital ({reportingCurrency})</span>
              <div className="metric-value">
                {analytics ? formatCurrency(analytics.totalCost, reportingCurrency) : formatCurrency(0, reportingCurrency)}
              </div>
              <div className="metric-change" style={{ color: 'var(--text-secondary)' }}>
                <span>Converted cost basis</span>
              </div>
            </div>
            
            <div className="metric-card success" style={{ 
              borderTopColor: (analytics?.totalGainLoss || 0) >= 0 ? 'var(--color-success-border)' : 'var(--color-danger-border)' 
            }}>
              <span className="metric-label">Total Gain / Loss ({reportingCurrency})</span>
              <div className="metric-value" style={{ 
                color: (analytics?.totalGainLoss || 0) >= 0 ? 'var(--color-success-text)' : 'var(--color-danger-text)' 
              }}>
                {analytics ? formatCurrency(analytics.totalGainLoss, reportingCurrency) : formatCurrency(0, reportingCurrency)}
              </div>
              <div className="metric-change" style={{ 
                color: (analytics?.totalGainLoss || 0) >= 0 ? 'var(--color-success-text)' : 'var(--color-danger-text)' 
              }}>
                {(analytics?.totalGainLoss || 0) >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                <span>{analytics ? formatPercent(analytics.totalGainLossPercent) : '0.00%'}</span>
              </div>
            </div>
          </div>

          {/* New row: Health Summary & Diversification Gauge side-by-side */}
          {analytics && holdings.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              
              {/* Portfolio Health Summary Widget */}
              <div className="card" style={{ padding: '1.5rem 2rem', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E2DACD', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1.15rem', fontFamily: 'var(--font-serif)', margin: 0 }}>
                    Portfolio Health Summary
                  </h3>
                  <span style={{ 
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.7rem',
                    fontWeight: 'bold',
                    padding: '0.2rem 0.5rem',
                    border: '1px solid',
                    color: analytics.health.status === 'Healthy' ? 'var(--color-success-text)' : analytics.health.status === 'Warning' ? '#B45309' : 'var(--color-danger-text)',
                    borderColor: analytics.health.status === 'Healthy' ? 'var(--color-success-border)' : analytics.health.status === 'Warning' ? '#F59E0B' : 'var(--color-danger-border)',
                    backgroundColor: analytics.health.status === 'Healthy' ? 'var(--color-success-bg)' : analytics.health.status === 'Warning' ? '#FFFBEB' : 'var(--color-danger-bg)',
                    textTransform: 'uppercase'
                  }}>
                    {analytics.health.status} ({analytics.health.score}/100)
                  </span>
                </div>
                
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 1rem 0', lineHeight: 1.4 }}>
                  {analytics.health.summary}
                </p>

                {/* Score Breakdown List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px dashed #E2DACD', paddingBottom: '1rem' }}>
                  {analytics.health.breakdown?.map((cat, idx) => (
                    <div key={idx} style={{ fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 'bold' }}>{cat.name}</span>
                        <span style={{ fontFamily: 'var(--font-mono)' }}>{cat.score} / {cat.maxScore}</span>
                      </div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{cat.explanation}</span>
                    </div>
                  ))}
                </div>

                {analytics.health.flags.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '180px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                    {analytics.health.flags.map((flag, idx) => (
                      <div key={idx} style={{ 
                        display: 'flex', 
                        gap: '0.5rem', 
                        borderLeft: `3px solid ${flag.type === 'danger' ? 'var(--color-danger-border)' : flag.type === 'warning' ? '#F59E0B' : 'var(--color-primary)'}`,
                        paddingLeft: '0.6rem',
                        fontSize: '0.75rem'
                      }}>
                        <ShieldAlert size={14} style={{ 
                          color: flag.type === 'danger' ? 'var(--color-danger-text)' : flag.type === 'warning' ? '#B45309' : 'var(--text-secondary)',
                          flexShrink: 0,
                          marginTop: '0.1rem'
                        }} />
                        <div>
                          <strong style={{ color: 'var(--text-primary)', display: 'block' }}>{flag.message}</strong>
                          <span style={{ color: 'var(--text-muted)' }}>{flag.suggestion}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed #E2DACD', background: '#FCFAF6', padding: '1rem', textAlign: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      No risk warnings. Portfolio metrics are fully secure.
                    </span>
                  </div>
                )}
              </div>

              {/* Portfolio Diversification Score Widget */}
              <div className="card" style={{ padding: '1.5rem 2rem', display: 'flex', flexDirection: 'column' }}>
                <div style={{ borderBottom: '1px solid #E2DACD', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1.15rem', fontFamily: 'var(--font-serif)', margin: 0 }}>
                    Diversification Score
                  </h3>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1rem', marginTop: '0.5rem' }}>
                  <div style={{ position: 'relative', width: '70px', height: '70px', borderRadius: '50%', background: '#F0EBE1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: '1.3rem', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>
                      {analytics.diversification.score}
                    </span>
                  </div>
                  <div>
                    <span className="mono-tag" style={{ 
                      fontSize: '0.65rem', 
                      background: analytics.diversification.status === 'Excellent' ? 'var(--color-success-bg)' : analytics.diversification.status === 'Good' ? '#ECFDF5' : analytics.diversification.status === 'Average' ? '#FFFBEB' : 'var(--color-danger-bg)',
                      color: analytics.diversification.status === 'Excellent' ? 'var(--color-success-text)' : analytics.diversification.status === 'Good' ? '#059669' : analytics.diversification.status === 'Average' ? '#B45309' : 'var(--color-danger-text)'
                    }}>
                      {analytics.diversification.status} Rating
                    </span>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0', lineHeight: 1.3 }}>
                      {analytics.diversification.description}
                    </p>
                  </div>
                </div>

                {/* Score Breakdown List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px dashed #E2DACD', paddingBottom: '1rem' }}>
                  {analytics.diversification.breakdown?.map((cat, idx) => (
                    <div key={idx} style={{ fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 'bold' }}>{cat.name}</span>
                        <span style={{ fontFamily: 'var(--font-mono)' }}>{cat.score} / {cat.maxScore}</span>
                      </div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{cat.explanation}</span>
                    </div>
                  ))}
                </div>

                {/* Score Progress Bar */}
                <div style={{ background: '#E2DACD', height: '6px', width: '100%', borderRadius: 0, position: 'relative', overflow: 'hidden', marginTop: 'auto', marginBottom: '0.5rem' }}>
                  <div style={{ 
                    height: '100%', 
                    width: `${analytics.diversification.score}%`, 
                    backgroundColor: analytics.diversification.score >= 80 ? 'var(--color-success-text)' : analytics.diversification.score >= 60 ? '#10B981' : analytics.diversification.score >= 40 ? '#F59E0B' : 'var(--color-danger-text)' 
                  }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  <span>POOR</span>
                  <span>AVERAGE</span>
                  <span>GOOD</span>
                  <span>EXCELLENT</span>
                </div>
              </div>

            </div>
          )}

          {/* Holdings Section */}
          <div className="card" style={{ padding: '2rem 2.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #222222', paddingBottom: '0.75rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontFamily: 'var(--font-serif)', margin: 0 }}>
                Asset Ledger
              </h2>
              <button onClick={openAddModal} className="btn btn-primary btn-sm">
                <Plus size={16} />
                <span>Add Asset</span>
              </button>
            </div>

            {loadingHoldings ? (
              <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
                <span className="mono-tag">Loading Ledger...</span>
              </div>
            ) : holdings.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem 1.5rem', border: '1px dashed #E2DACD', background: '#FCFAF6', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                <Briefcase size={36} style={{ color: 'var(--text-muted)' }} />
                <div>
                  <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '1.05rem', margin: '0 0 0.4rem 0' }}>
                    No assets configured in this portfolio ledger.
                  </p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '420px', margin: 0, lineHeight: 1.4 }}>
                    To begin generating risk indexes, sector allocations, and currency exposure diagnostics, you must establish your asset positions.
                  </p>
                </div>
                
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '0.5rem' }}>
                  <button onClick={openAddModal} className="btn btn-primary btn-sm">
                    Add Position Manually
                  </button>
                  <button onClick={() => setIsCsvImportOpen(true)} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <FileSpreadsheet size={14} />
                    <span>Import Ledger from CSV</span>
                  </button>
                  <button onClick={handleLoadSampleData} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Sparkles size={14} />
                    <span>Load Diversified Sample Data</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="financial-table-wrapper">
                <table className="financial-table">
                  <thead>
                    <tr>
                      <th>Asset</th>
                      <th>Class</th>
                      <th>Exchange</th>
                      <th className="num-val">Qty</th>
                      <th className="num-val">Avg Cost</th>
                      <th className="num-val">Current</th>
                      <th className="num-val">Value</th>
                      <th className="num-val">Gain/Loss</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {holdings.map((holding) => {
                      const price = marketPrices[holding.id] !== undefined ? marketPrices[holding.id] : (holding.currentPrice || holding.purchasePrice);
                      const value = holding.quantity * price;
                      const cost = holding.quantity * holding.purchasePrice;
                      const gain = value - cost;
                      const gainPercent = cost > 0 ? (gain / cost) * 100 : 0;
                      return (
                        <tr key={holding.id}>
                          <td style={{ fontWeight: 600 }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>{holding.ticker || holding.symbol}</span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 'normal' }}>{holding.name}</span>
                            </div>
                          </td>
                          <td>
                            <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                              {holding.assetClass}
                            </span>
                          </td>
                          <td>
                            <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                              {holding.exchange}
                            </span>
                          </td>
                          <td className="num-val">{holding.quantity.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 6 })}</td>
                          <td className="num-val">{formatCurrency(holding.purchasePrice, holding.currency)}</td>
                          <td className="num-val">{formatCurrency(price, holding.currency)}</td>
                          <td className="num-val" style={{ fontWeight: 600 }}>{formatCurrency(value, holding.currency)}</td>
                          <td className="num-val" style={{ color: gain >= 0 ? 'var(--color-success-text)' : 'var(--color-danger-text)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                              <span>{formatCurrency(gain, holding.currency)}</span>
                              <span style={{ fontSize: '0.7rem', opacity: 0.85 }}>{formatPercent(gainPercent)}</span>
                            </div>
                          </td>
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <button 
                              onClick={() => openEditModal(holding)}
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', marginRight: '0.75rem', padding: '0.25rem' }}
                              title="Edit Asset"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button 
                              onClick={() => handleDeleteHolding(holding.id)}
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-danger-text)', padding: '0.25rem' }}
                              title="Remove Asset"
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

          {/* Allocation Details Section - Sectors, Countries, and Currencies */}
          {analytics && holdings.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
              
              {/* Sector & Geographic Allocation Cards side-by-side */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                
                {/* Sector Allocation */}
                <div className="card" style={{ padding: '1.5rem 2rem' }}>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '1rem', borderBottom: '1px solid #E2DACD', paddingBottom: '0.5rem', fontFamily: 'var(--font-serif)', margin: 0 }}>
                    Sector Allocation
                  </h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '1rem' }}>
                    {analytics.sectorAllocation.map((item, idx) => {
                      const color = SECTOR_COLORS[item.name] || SECTOR_COLORS['Other'];
                      return (
                        <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                            <span style={{ fontWeight: 500 }}>{item.name}</span>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                              <span style={{ marginRight: '0.5rem', color: 'var(--text-secondary)' }}>{formatCurrency(item.value, reportingCurrency)}</span>
                              <span style={{ fontWeight: 'bold' }}>{item.percentage.toFixed(1)}%</span>
                            </div>
                          </div>
                          <div style={{ background: '#E2DACD', height: '5px', width: '100%' }}>
                            <div style={{ height: '100%', width: `${item.percentage}%`, backgroundColor: color }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Geographic Allocation */}
                <div className="card" style={{ padding: '1.5rem 2rem' }}>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '1rem', borderBottom: '1px solid #E2DACD', paddingBottom: '0.5rem', fontFamily: 'var(--font-serif)', margin: 0 }}>
                    Geographic Allocation
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '1rem' }}>
                    {analytics.geographicAllocation.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                          <div>
                            <span style={{ fontWeight: 500 }}>{item.name}</span>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginLeft: '0.4rem' }}>({item.region})</span>
                          </div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                            <span style={{ marginRight: '0.5rem', color: 'var(--text-secondary)' }}>{formatCurrency(item.value, reportingCurrency)}</span>
                            <span style={{ fontWeight: 'bold' }}>{item.percentage.toFixed(1)}%</span>
                          </div>
                        </div>
                        <div style={{ background: '#E2DACD', height: '5px', width: '100%' }}>
                          <div style={{ 
                            height: '100%', 
                            width: `${item.percentage}%`, 
                            backgroundColor: item.name === 'United States' ? '#8c2a2a' : item.name === 'India' ? '#B45309' : item.name === 'Global' ? '#2C6B50' : '#718096' 
                          }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Currency Exposure */}
              <div className="card" style={{ padding: '1.5rem 2rem' }}>
                <h3 style={{ fontSize: '1.15rem', marginBottom: '1rem', borderBottom: '1px solid #E2DACD', paddingBottom: '0.5rem', fontFamily: 'var(--font-serif)', margin: 0 }}>
                  Currency Exposure
                </h3>
                <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
                  {analytics.currencyExposure.map((item, idx) => (
                    <div key={idx} style={{ 
                      flex: '1', 
                      minWidth: '150px', 
                      background: '#FCFAF6', 
                      border: '1px solid #E2DACD', 
                      padding: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.25rem'
                    }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>{item.name} Exposure</span>
                      <span style={{ fontSize: '1.25rem', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>
                        {item.percentage.toFixed(2)}%
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {formatCurrency(item.value, reportingCurrency)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Right Column: Editorial Sidebars (Concentration Risk, Winners/Losers, Watchlist Summary, Strategic Parameters) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
          
          {/* Concentration Risk Card */}
          {analytics && holdings.length > 0 && (
            <div className="card" style={{ padding: '1.5rem 2rem' }}>
              <h3 style={{ fontSize: '1.15rem', marginBottom: '1rem', borderBottom: '1px solid #E2DACD', paddingBottom: '0.5rem', fontFamily: 'var(--font-serif)', margin: 0 }}>
                Concentration Risk
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Herfindahl Index (HHI):</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>{analytics.concentrationRisk.hhi.toFixed(0)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Concentration Status:</span>
                  <span style={{ 
                    fontFamily: 'var(--font-mono)', 
                    fontWeight: 'bold',
                    color: analytics.concentrationRisk.status === 'High' ? 'var(--color-danger-text)' : analytics.concentrationRisk.status === 'Moderate' ? '#B45309' : 'var(--color-success-text)' 
                  }}>{analytics.concentrationRisk.status}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Top Holding Weight:</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{analytics.concentrationRisk.topAssetWeight.toFixed(1)}%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Top 3 Assets Weight:</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{analytics.concentrationRisk.top3Weight.toFixed(1)}%</span>
                </div>
                
                <div style={{ 
                  marginTop: '0.5rem',
                  borderTop: '1px dashed #E2DACD',
                  paddingTop: '0.75rem',
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.3
                }}>
                  {analytics.concentrationRisk.description}
                </div>
              </div>
            </div>
          )}

          {/* Top Winners & Top Losers Performers Card */}
          {analytics && holdings.length > 0 && (
            <div className="card" style={{ padding: '1.5rem 2rem' }}>
              <h3 style={{ fontSize: '1.15rem', marginBottom: '1rem', borderBottom: '1px solid #E2DACD', paddingBottom: '0.5rem', fontFamily: 'var(--font-serif)', margin: 0 }}>
                Top Performers
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1.0rem' }}>
                
                {/* Winners */}
                <div>
                  <span className="mono-tag" style={{ fontSize: '0.65rem', background: '#ECFDF5', color: '#059669', marginBottom: '0.5rem', display: 'inline-block' }}>Top Winners</span>
                  {analytics.bestPerformers.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {analytics.bestPerformers.map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{item.ticker}</span>
                          <span style={{ color: 'var(--color-success-text)', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>
                            {formatPercent(item.gainLossPercent)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No positive overall gains.</span>
                  )}
                </div>

                {/* Losers */}
                <div>
                  <span className="mono-tag" style={{ fontSize: '0.65rem', background: 'var(--color-danger-bg)', color: 'var(--color-danger-text)', marginBottom: '0.5rem', display: 'inline-block' }}>Top Losers</span>
                  {analytics.worstPerformers.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {analytics.worstPerformers.map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{item.ticker}</span>
                          <span style={{ color: 'var(--color-danger-text)', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>
                            {formatPercent(item.gainLossPercent)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No negative overall gains.</span>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* Watchlist Summary Widget */}
          <div className="card" style={{ padding: '1.5rem 2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E2DACD', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontFamily: 'var(--font-serif)', margin: 0 }}>
                Monitored Securities
              </h3>
              <button 
                onClick={() => navigate('/watchlist')}
                style={{ 
                  background: 'transparent', 
                  border: 'none', 
                  cursor: 'pointer', 
                  color: 'var(--color-accent)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  gap: '0.1rem' 
                }}
              >
                <span>Edit</span>
                <ChevronRight size={14} />
              </button>
            </div>

            {watchlistSummary.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: '0 0 0.5rem 0' }}>
                  No securities monitored.
                </p>
                <button onClick={() => navigate('/watchlist')} className="btn btn-secondary btn-sm" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}>
                  Setup Watchlist
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {watchlistSummary.map((asset) => {
                  const hasPrice = asset.quote.current > 0;
                  return (
                    <div 
                      key={asset.item.id} 
                      onClick={() => navigate('/watchlist')}
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        paddingBottom: '0.5rem', 
                        borderBottom: '1px dashed #E2DACD',
                        cursor: 'pointer'
                      }}
                    >
                      <div>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: 'bold', display: 'block' }}>{asset.item.symbol}</span>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{asset.item.exchange}</span>
                      </div>
                      <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                        <span style={{ fontWeight: 600, display: 'block' }}>
                          {hasPrice ? formatCurrency(asset.quote.current, asset.item.currency) : '—'}
                        </span>
                        <span style={{ 
                          fontSize: '0.65rem', 
                          fontWeight: 'bold',
                          color: asset.quote.percentChange >= 0 ? 'var(--color-success-text)' : 'var(--color-danger-text)'
                        }}>
                          {hasPrice ? formatPercent(asset.quote.percentChange) : '—'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Strategic Parameters Snapshot */}
          <div className="card" style={{ padding: '1.5rem 2rem' }}>
            <h3 style={{ fontSize: '1.15rem', marginBottom: '1rem', borderBottom: '1px solid #E2DACD', paddingBottom: '0.5rem', fontFamily: 'var(--font-serif)', margin: 0 }}>
              Strategic Parameters Snapshot
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              <div>
                <span className="mono-tag" style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Risk Profile Mode</span>
                <span style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--color-accent)', display: 'block', textTransform: 'capitalize', fontFamily: 'var(--font-serif)' }}>
                  {profile?.riskProfile || 'Moderate'}
                </span>
              </div>
              <div>
                <span className="mono-tag" style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Reporting Base</span>
                <span style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', display: 'block', fontFamily: 'var(--font-serif)' }}>
                  {reportingCurrency} (1 USD = {usdToInrRate} INR)
                </span>
              </div>
            </div>
          </div>

          {/* Interests track widget */}
          <div className="card" style={{ padding: '1.5rem 2rem' }}>
            <h3 style={{ fontSize: '1.15rem', marginBottom: '1rem', borderBottom: '1px solid #E2DACD', paddingBottom: '0.5rem', fontFamily: 'var(--font-serif)', margin: 0 }}>
              Analysis Verticals
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem', margin: 0 }}>
              Focus categories assigned to the scanning agent.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
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
            <h3 style={{ fontSize: '1.15rem', marginBottom: '1rem', borderBottom: '1px solid #E2DACD', paddingBottom: '0.5rem', fontFamily: 'var(--font-serif)', margin: 0 }}>
              Dispatch Status
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem', marginTop: '1rem' }}>
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

      {/* Add/Edit Modal Dialog */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={() => setIsModalOpen(false)}
              style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
            >
              <X size={20} />
            </button>
            
            <h3 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', borderBottom: '2px solid var(--text-primary)', paddingBottom: '0.5rem', fontFamily: 'var(--font-serif)' }}>
              {editingHolding ? 'Modify Asset' : 'Add New Asset'}
            </h3>
            
            {error && (
              <div style={{ 
                background: 'var(--color-danger-bg)', 
                border: '1px solid var(--color-danger-border)', 
                color: 'var(--color-danger-text)', 
                padding: '0.75rem 1rem', 
                fontSize: '0.8rem', 
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}
            
            <form onSubmit={handleSaveHolding} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Ticker Symbol</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. AAPL, BTC, TCS" 
                    value={ticker}
                    onChange={(e) => setTicker(e.target.value)}
                    onBlur={handleTickerBlur}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Custom Display Tag</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. AAPL" 
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Asset Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. Apple Inc., US Dollar" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Exchange</label>
                  <select 
                    className="form-input form-select"
                    value={exchange}
                    onChange={(e) => setExchange(e.target.value)}
                  >
                    <option value="NASDAQ">NASDAQ</option>
                    <option value="NYSE">NYSE</option>
                    <option value="NSE">NSE (India)</option>
                    <option value="BSE">BSE (India)</option>
                    <option value="CRYPTO">Crypto Exchange</option>
                    <option value="CASH">Cash Holdings</option>
                    <option value="OTHER">Other / Private</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Currency</label>
                  <select 
                    className="form-input form-select"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                  >
                    <option value="USD">USD ($)</option>
                    <option value="INR">INR (₹)</option>
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Asset Class</label>
                <select 
                  className="form-input form-select"
                  value={assetClass}
                  onChange={(e) => setAssetClass(e.target.value)}
                >
                  <option value="Equity">Equity (Stock / ETF)</option>
                  <option value="Crypto">Cryptocurrency</option>
                  <option value="Cash">Cash & Equivalents</option>
                  <option value="Fixed Income">Fixed Income (Bonds)</option>
                  <option value="Real Estate">Real Estate</option>
                  <option value="Other">Commodities & Other</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Quantity</label>
                  <input 
                    type="number" 
                    step="any"
                    className="form-input" 
                    placeholder="0.00" 
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Avg Buy Price</label>
                  <input 
                    type="number" 
                    step="any"
                    className="form-input" 
                    placeholder="0.00" 
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label">Purchase Date</label>
                <input 
                  type="date" 
                  className="form-input" 
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="btn btn-secondary btn-sm"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary btn-sm"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Asset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isCsvImportOpen && (
        <PortfolioCSVImporter 
          onClose={() => setIsCsvImportOpen(false)} 
          onImportComplete={fetchHoldings} 
        />
      )}
      
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
