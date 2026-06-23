import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { dbService } from '../services/firebase';
import type { Holding, CompanyIntelligence } from '../services/firebase';
import { marketDataService } from '../services/marketDataService';
import type { AssetMetadata } from '../services/marketDataService';
import { PortfolioAnalyticsService } from '../services/portfolioAnalyticsService';
import type { PortfolioAnalytics } from '../services/portfolioAnalyticsService';
import { WatchlistService } from '../services/watchlistService';
import type { WatchlistAssetIntelligence } from '../services/watchlistService';
import { useNavigate } from 'react-router-dom';
import IntelligenceService from '../services/intelligenceService';
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
  Sparkles,
  RefreshCw,
  History,
  Bell,
  Activity
} from 'lucide-react';
import { PlatformHealthWidget } from '../components/PlatformHealthWidget';
import { OnboardingChecklist } from '../components/OnboardingChecklist';
import { PortfolioCSVImporter } from '../components/PortfolioCSVImporter';
import { SampleDataService } from '../services/sampleDataService';
import { DecisionEngineService } from '../services/decisionEngineService';
import type { 
  HistoricalSnapshotRecord, 
  IntelligenceAlert, 
  PortfolioDeltaReport, 
  SimulationAction, 
  SimulationResult 
} from '../services/decisionEngineService';


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
  const [convictions, setConvictions] = useState<any[]>([]);

  // Decision Engine State
  const [alerts, setAlerts] = useState<IntelligenceAlert[]>([]);
  const [deltaReport, setDeltaReport] = useState<PortfolioDeltaReport | null>(null);
  const [historyRecords, setHistoryRecords] = useState<HistoricalSnapshotRecord[]>([]);
  const [selectedTimelineTicker, setSelectedTimelineTicker] = useState<string>('');
  const [simulationActions, setSimulationActions] = useState<SimulationAction[]>([]);
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [simAction, setSimAction] = useState<'buy' | 'sell' | 'adjust_cash' | 'add_new'>('buy');
  const [simTicker, setSimTicker] = useState<string>('');
  const [simExchange] = useState<string>('NASDAQ');
  const [simAmount, setSimAmount] = useState<string>('50000');
  const [simPercentage, setSimPercentage] = useState<string>('');

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

  // Focus trapping for modals (Part 3)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      
      const activeModal = document.querySelector('.modal-content, .csv-import-modal-content');
      if (!activeModal) return;
      
      const focusables = activeModal.querySelectorAll('button, input, select, textarea, [tabindex="0"]');
      if (focusables.length === 0) return;
      
      const first = focusables[0] as HTMLElement;
      const last = focusables[focusables.length - 1] as HTMLElement;
      
      if (e.shiftKey) {
        if (document.activeElement === first) {
          last.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === last) {
          first.focus();
          e.preventDefault();
        }
      }
    };
    
    if (isModalOpen || isCsvImportOpen) {
      window.addEventListener('keydown', handleKeyDown);
      // focus the first element in modal automatically
      setTimeout(() => {
        const activeModal = document.querySelector('.modal-content, .csv-import-modal-content');
        const first = activeModal?.querySelector('button, input, select, textarea, [tabindex="0"]') as HTMLElement;
        first?.focus();
      }, 50);
    }
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isModalOpen, isCsvImportOpen]);

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
      
      await Promise.all(list.map(async (h) => {
        const price = await marketDataService.getPrice(h.ticker, h.exchange, h.currentPrice || h.purchasePrice);
        prices[h.id] = price;
        const meta = await marketDataService.getMetadata(h.ticker, h.exchange);
        metadataMap[h.ticker || h.symbol] = meta;
      }));
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

      try {
        const userConvictions = await IntelligenceService.fetchAllConvictions();
        setConvictions(userConvictions);

        // Fetch company intelligence for all assets
        const intelList: CompanyIntelligence[] = [];
        await Promise.all(list.filter(h => h.ticker !== 'CASH').map(async (h) => {
          try {
            const intel = await IntelligenceService.fetchCompanyIntelligence(h.ticker, h.exchange);
            if (intel) intelList.push(intel);
          } catch (e) {
            console.warn(`Failed to fetch company intelligence for ${h.ticker}`, e);
          }
        }));

        // Seed mock historical snapshots if database is empty
        await DecisionEngineService.seedMockHistoryIfEmpty(user.uid, list, userConvictions, intelList, calcResult);

        // Save daily snapshot and trigger alerts
        await DecisionEngineService.saveDailySnapshotIfNew(user.uid, list, userConvictions, intelList, calcResult);

        // Fetch history and alerts
        const history = await dbService.getAllPortfolioHistoryRecords(user.uid);
        setHistoryRecords(history);

        const activeAlerts = await dbService.getAlerts(user.uid);
        setAlerts(activeAlerts.filter((a: any) => !a.read));

        // Generate daily portfolio delta
        const todayStr = new Date().toISOString().split('T')[0];
        const currentRec = history.find((hr: any) => hr.date === todayStr);
        const yesterdayRec = history.find((hr: any) => hr.date !== todayStr);
        const currentOpps = await dbService.getOpportunities(user.uid).catch(() => []);

        if (currentRec) {
          const delta = DecisionEngineService.generateDailyPortfolioDelta(currentRec, yesterdayRec || null, currentOpps);
          setDeltaReport(delta);
        }

        // Set default timeline target
        const firstAsset = list.find(h => h.ticker !== 'CASH');
        if (firstAsset) {
          setSelectedTimelineTicker(firstAsset.ticker);
        }
      } catch (e) {
        console.warn('Failed to load user convictions on dashboard', e);
      }

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
    const confirmImport = window.confirm(
      "Import Sample Portfolio?\n\n" +
      "- Existing holdings and watchlist assets may be replaced or merged.\n" +
      "- Sample data is strictly for demonstration and testing purposes.\n\n" +
      "Click OK to proceed with 'Import Sample Data', or Cancel to abort."
    );
    if (!confirmImport) return;

    setLoadingHoldings(true);
    try {
      await SampleDataService.loadSampleData(user.uid);
      await fetchHoldings();
    } catch (err) {
      console.error('Failed to load sample data:', err);
      alert('Failed to load sample portfolio data.');
    } finally {
      setLoadingHoldings(false);
    }
  };

  const handleRemoveSampleData = async () => {
    if (!user) return;
    const confirmRemove = window.confirm(
      "Remove Sample Data?\n\n" +
      "This will remove all sample holdings and watchlisted assets loaded for demonstration.\n\n" +
      "Click OK to proceed, or Cancel to abort."
    );
    if (!confirmRemove) return;

    setLoadingHoldings(true);
    try {
      await SampleDataService.removeSampleData(user.uid);
      await fetchHoldings();
    } catch (err) {
      console.error('Failed to remove sample data:', err);
      alert('Failed to remove sample portfolio data.');
    } finally {
      setLoadingHoldings(false);
    }
  };

  const handleDismissAlert = async (alertId: string) => {
    if (!user) return;
    try {
      await dbService.dismissAlert(user.uid, alertId);
      setAlerts(prev => prev.filter(a => a.id !== alertId));
    } catch (e) {
      console.error('Failed to dismiss alert:', e);
    }
  };

  const handleAddSimulationAction = () => {
    if (!simTicker && simAction !== 'adjust_cash') return;
    const amountNum = parseFloat(simAmount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    const action: SimulationAction = {
      type: simAction,
      ticker: simTicker.toUpperCase() || 'CASH',
      exchange: simExchange.toUpperCase() || 'NASDAQ',
      amount: amountNum,
      percentage: simPercentage ? parseFloat(simPercentage) : undefined
    };

    setSimulationActions(prev => [...prev, action]);
    // Reset inputs
    setSimTicker('');
    setSimAmount('50000');
    setSimPercentage('');
  };

  const handleRemoveSimulationAction = (idx: number) => {
    setSimulationActions(prev => prev.filter((_, i) => i !== idx));
  };

  const handleClearSimulation = () => {
    setSimulationActions([]);
    setSimulationResult(null);
  };

  const handleRunSimulation = () => {
    if (holdings.length === 0) return;
    try {
      const prices: Record<string, number> = { ...marketPrices };
      simulationActions.forEach(act => {
        const key = act.ticker;
        if (prices[key] === undefined) {
          prices[key] = 150; // default simulation fallback price
        }
      });

      const metadataMap: Record<string, AssetMetadata | null> = {};
      holdings.forEach(h => {
        metadataMap[h.ticker] = {
          ticker: h.ticker,
          exchange: h.exchange,
          name: h.name,
          currency: h.currency,
          country: h.currency === 'INR' ? 'India' : 'United States',
          industry: h.assetClass === 'Cash' ? 'Cash & Cash Equivalents' : 'Technology'
        };
      });

      const res = DecisionEngineService.runSimulation(
        holdings,
        simulationActions,
        prices,
        metadataMap,
        reportingCurrency,
        usdToInrRate,
        profile?.riskProfile
      );
      setSimulationResult(res);
    } catch (e) {
      console.error('Failed to run simulation:', e);
    }
  };

  const handleLoadScenario = (scenarioType: 'invest_capital' | 'intl_diversify' | 'trim_concentration' | 'cash_buffer') => {
    setSimulationActions([]);
    setSimulationResult(null);

    const firstAsset = holdings.find(h => h.ticker !== 'CASH');

    if (scenarioType === 'invest_capital') {
      setSimulationActions([
        {
          type: 'add_new',
          ticker: 'NVDA',
          exchange: 'NASDAQ',
          amount: 100000
        }
      ]);
    } else if (scenarioType === 'intl_diversify') {
      setSimulationActions([
        {
          type: 'add_new',
          ticker: 'ASML',
          exchange: 'NASDAQ',
          amount: 150000
        }
      ]);
    } else if (scenarioType === 'trim_concentration' && firstAsset) {
      setSimulationActions([
        {
          type: 'sell',
          ticker: firstAsset.ticker,
          exchange: firstAsset.exchange,
          amount: 0,
          percentage: 20
        }
      ]);
    } else if (scenarioType === 'cash_buffer') {
      setSimulationActions([
        {
          type: 'adjust_cash',
          ticker: 'CASH',
          exchange: 'CASH',
          amount: 200000
        }
      ]);
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

      {/* SECTION 2 — ATTENTION REQUIRED (HIGH PRIORITY ALERTS) */}
      {alerts.length > 0 && (
        <div className="card" style={{ padding: '1.5rem 2rem', borderTop: '4px solid var(--color-danger-border)', marginBottom: '2.5rem', background: '#FFFDFB' }}>
          <h3 style={{ fontSize: '1.15rem', fontFamily: 'var(--font-serif)', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-danger-text)' }}>
            <Bell size={18} /> Attention Required — Critical Alerts
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {alerts.map((alert) => (
              <div key={alert.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '0.75rem', borderBottom: '1px dashed #E2DACD', gap: '1.5rem' }}>
                <div style={{ display: 'flex', gap: '0.65rem' }}>
                  <ShieldAlert size={16} style={{ color: alert.priority === 'high' ? 'var(--color-danger-text)' : '#B45309', flexShrink: 0, marginTop: '0.2rem' }} />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: '0.85rem' }}>{alert.title}</strong>
                      <span className="mono-tag" style={{ fontSize: '0.6rem', padding: '0.1rem 0.35rem', textTransform: 'uppercase', background: alert.priority === 'high' ? 'var(--color-danger-bg)' : '#FFFBEB', color: alert.priority === 'high' ? 'var(--color-danger-text)' : '#B45309' }}>
                        {alert.priority} Priority
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{new Date(alert.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.25rem 0' }}>
                      {alert.message}
                    </p>
                    <div style={{ fontSize: '0.75rem', background: '#FCFAF6', border: '1px solid #E2DACD', padding: '0.5rem', marginTop: '0.4rem' }}>
                      <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '0.1rem' }}>Why It Matters</strong>
                      <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: '#333' }}>"{alert.whyItMatters}"</span>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => handleDismissAlert(alert.id)}
                  className="btn btn-secondary btn-sm"
                  style={{ flexShrink: 0, fontSize: '0.7rem', padding: '0.2rem 0.5rem', background: 'transparent' }}
                >
                  Dismiss
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 1 — DAILY PORTFOLIO DELTA */}
      {deltaReport && (
        <div className="card" style={{ padding: '1.5rem 2rem', marginBottom: '2.5rem' }}>
          <div style={{ borderBottom: '1px solid #222222', paddingBottom: '0.5rem', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.3rem', fontFamily: 'var(--font-serif)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={18} style={{ color: 'var(--color-accent)' }} /> Today's Portfolio Delta
            </h2>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>COMPARED TO YESTERDAY</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
            {/* Conviction changes */}
            <div style={{ background: '#FCFAF6', border: '1px solid #E2DACD', padding: '1rem' }}>
              <span className="mono-tag" style={{ fontSize: '0.65rem', background: '#F0EBE1', display: 'block', marginBottom: '0.75rem' }}>Conviction Changes</span>
              {deltaReport.upgrades.length === 0 && deltaReport.downgrades.length === 0 ? (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No conviction rating changes.</span>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.8rem' }}>
                  {deltaReport.upgrades.map((u, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong>{u.ticker}</strong>
                      <span style={{ color: 'var(--color-success-text)', fontFamily: 'var(--font-mono)' }}>{u.prev} → {u.curr} (+{u.curr - u.prev})</span>
                    </div>
                  ))}
                  {deltaReport.downgrades.map((d, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong>{d.ticker}</strong>
                      <span style={{ color: 'var(--color-danger-text)', fontFamily: 'var(--font-mono)' }}>{d.prev} → {d.curr} ({d.curr - d.prev})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Dip Candidates */}
            <div style={{ background: '#FCFAF6', border: '1px solid #E2DACD', padding: '1rem' }}>
              <span className="mono-tag" style={{ fontSize: '0.65rem', background: '#F0EBE1', display: 'block', marginBottom: '0.75rem' }}>Active Dip Changes</span>
              {deltaReport.newDips.length === 0 && deltaReport.resolvedDips.length === 0 ? (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No active pullbacks detected.</span>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.8rem' }}>
                  {deltaReport.newDips.map((nd, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong>{nd.ticker}</strong>
                      <span style={{ color: '#B45309', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', fontSize: '0.7rem', fontWeight: 'bold' }}>{nd.classification} DIP</span>
                    </div>
                  ))}
                  {deltaReport.resolvedDips.map((rd, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong>{rd.ticker}</strong>
                      <span style={{ color: 'var(--color-success-text)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', fontSize: '0.7rem' }}>Resolved ({rd.prevClassification})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Smart Money Inflows */}
            <div style={{ background: '#FCFAF6', border: '1px solid #E2DACD', padding: '1rem' }}>
              <span className="mono-tag" style={{ fontSize: '0.65rem', background: '#F0EBE1', display: 'block', marginBottom: '0.75rem' }}>Smart Money Changes</span>
              {deltaReport.smartMoneyChanges.length === 0 ? (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Institutional flows stable.</span>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.8rem' }}>
                  {deltaReport.smartMoneyChanges.map((sm, i) => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <strong>{sm.ticker}</strong>
                        <span style={{ fontFamily: 'var(--font-mono)', textTransform: 'capitalize', color: sm.currFlow === 'accumulation' ? 'var(--color-success-text)' : 'var(--text-primary)' }}>{sm.currFlow}</span>
                      </div>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Was: {sm.prevFlow}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Portfolio Health Changes */}
            <div style={{ background: '#FCFAF6', border: '1px solid #E2DACD', padding: '1rem' }}>
              <span className="mono-tag" style={{ fontSize: '0.65rem', background: '#F0EBE1', display: 'block', marginBottom: '0.75rem' }}>Portfolio Health Delta</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Health Index:</span>
                  <span style={{ 
                    fontFamily: 'var(--font-mono)', 
                    fontWeight: 'bold',
                    color: (deltaReport.portfolioHealthChange.currScore - deltaReport.portfolioHealthChange.prevScore) >= 0 ? 'var(--color-success-text)' : 'var(--color-danger-text)' 
                  }}>
                    {deltaReport.portfolioHealthChange.prevScore} → {deltaReport.portfolioHealthChange.currScore} ({formatPercent(deltaReport.portfolioHealthChange.currScore - deltaReport.portfolioHealthChange.prevScore).replace('+', '+').replace('%', '')})
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Diversification Index:</span>
                  <span style={{ 
                    fontFamily: 'var(--font-mono)', 
                    fontWeight: 'bold',
                    color: (deltaReport.diversificationChange.currScore - deltaReport.diversificationChange.prevScore) >= 0 ? 'var(--color-success-text)' : 'var(--color-danger-text)' 
                  }}>
                    {deltaReport.diversificationChange.prevScore} → {deltaReport.diversificationChange.currScore} ({formatPercent(deltaReport.diversificationChange.currScore - deltaReport.diversificationChange.prevScore).replace('+', '+').replace('%', '')})
                  </span>
                </div>
              </div>
            </div>
          </div>
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
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {holdings.some(h => ['AAPL', 'MSFT', 'GOOG', 'RELIANCE', 'TCS', 'BTC', 'ETH'].includes(h.ticker)) && (
                  <button 
                    onClick={handleRemoveSampleData} 
                    className="btn btn-secondary btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', borderColor: 'var(--color-danger-text)', color: 'var(--color-danger-text)' }}
                  >
                    <Trash2 size={14} />
                    <span>Clear Sample Data</span>
                  </button>
                )}
                <button onClick={openAddModal} className="btn btn-primary btn-sm">
                  <Plus size={16} />
                  <span>Add Asset</span>
                </button>
              </div>
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
                {/* Desktop View */}
                <div className="financial-table-desktop">
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
                        <th className="num-val">Conviction</th>
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
                            <td className="num-val">
                              {(() => {
                                const conviction = convictions.find(
                                  c => c.ticker.toUpperCase() === holding.ticker.toUpperCase() && c.exchange.toUpperCase() === holding.exchange.toUpperCase()
                                );
                                return conviction ? (
                                  <span 
                                    onClick={() => navigate('/intelligence')}
                                    style={{ 
                                      fontFamily: 'var(--font-mono)', 
                                      fontWeight: 'bold', 
                                      cursor: 'pointer',
                                      textDecoration: 'underline',
                                      color: conviction.overallScore >= 75 ? 'var(--color-success-text)' : conviction.overallScore >= 50 ? 'var(--text-primary)' : 'var(--color-danger-text)'
                                    }}
                                    title={conviction.rationale}
                                  >
                                    {conviction.overallScore}
                                  </span>
                                ) : (
                                  <span 
                                    onClick={() => navigate('/intelligence')} 
                                    style={{ cursor: 'pointer', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}
                                  >
                                    —
                                  </span>
                                );
                              })()}
                            </td>
                            <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                              <button 
                                onClick={() => openEditModal(holding)}
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', marginRight: '0.75rem', padding: '0.25rem' }}
                                title="Edit Asset"
                                aria-label={`Edit ${holding.ticker || holding.symbol}`}
                              >
                                <Edit2 size={14} />
                              </button>
                              <button 
                                onClick={() => handleDeleteHolding(holding.id)}
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-danger-text)', padding: '0.25rem' }}
                                title="Remove Asset"
                                aria-label={`Remove ${holding.ticker || holding.symbol}`}
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

                {/* Mobile View */}
                <div className="financial-cards-mobile" style={{ display: 'none' }}>
                  {holdings.map((holding) => {
                    const price = marketPrices[holding.id] !== undefined ? marketPrices[holding.id] : (holding.currentPrice || holding.purchasePrice);
                    const value = holding.quantity * price;
                    const cost = holding.quantity * holding.purchasePrice;
                    const gain = value - cost;
                    const gainPercent = cost > 0 ? (gain / cost) * 100 : 0;
                    const conviction = convictions.find(
                      c => c.ticker.toUpperCase() === holding.ticker.toUpperCase() && c.exchange.toUpperCase() === holding.exchange.toUpperCase()
                    );
                    return (
                      <div key={holding.id} className="mobile-card">
                        <div className="mobile-card-title">
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '1rem' }}>{holding.ticker || holding.symbol}</span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 'normal' }}>{holding.name}</span>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button 
                              onClick={() => openEditModal(holding)}
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '0.25rem' }}
                              title="Edit Asset"
                              aria-label={`Edit ${holding.ticker || holding.symbol}`}
                            >
                              <Edit2 size={14} />
                            </button>
                            <button 
                              onClick={() => handleDeleteHolding(holding.id)}
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-danger-text)', padding: '0.25rem' }}
                              title="Remove Asset"
                              aria-label={`Remove ${holding.ticker || holding.symbol}`}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                        <div className="mobile-card-row">
                          <span style={{ color: 'var(--text-muted)' }}>Class / Exchange</span>
                          <span>
                            {holding.assetClass} ({holding.exchange})
                          </span>
                        </div>
                        <div className="mobile-card-row">
                          <span style={{ color: 'var(--text-muted)' }}>Quantity</span>
                          <span>{holding.quantity.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 6 })}</span>
                        </div>
                        <div className="mobile-card-row">
                          <span style={{ color: 'var(--text-muted)' }}>Avg Cost / Current</span>
                          <span>{formatCurrency(holding.purchasePrice, holding.currency)} / {formatCurrency(price, holding.currency)}</span>
                        </div>
                        <div className="mobile-card-row">
                          <span style={{ color: 'var(--text-muted)' }}>Total Value</span>
                          <span style={{ fontWeight: 600 }}>{formatCurrency(value, holding.currency)}</span>
                        </div>
                        <div className="mobile-card-row">
                          <span style={{ color: 'var(--text-muted)' }}>Gain/Loss</span>
                          <span style={{ color: gain >= 0 ? 'var(--color-success-text)' : 'var(--color-danger-text)', fontWeight: 'bold' }}>
                            {formatCurrency(gain, holding.currency)} ({formatPercent(gainPercent)})
                          </span>
                        </div>
                        <div className="mobile-card-row">
                          <span style={{ color: 'var(--text-muted)' }}>Conviction Score</span>
                          <span>
                            {conviction ? (
                              <span 
                                onClick={() => navigate('/intelligence')}
                                style={{ 
                                  fontFamily: 'var(--font-mono)', 
                                  fontWeight: 'bold', 
                                  cursor: 'pointer',
                                  textDecoration: 'underline',
                                  color: conviction.overallScore >= 75 ? 'var(--color-success-text)' : conviction.overallScore >= 50 ? 'var(--text-primary)' : 'var(--color-danger-text)'
                                }}
                                title={conviction.rationale}
                              >
                                {conviction.overallScore}
                              </span>
                            ) : (
                              <span 
                                onClick={() => navigate('/intelligence')} 
                                style={{ cursor: 'pointer', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}
                              >
                                —
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
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

              {/* SECTION 3 — PORTFOLIO REBALANCING WORKBENCH & SCENARIO ENGINE */}
              <div className="card" style={{ padding: '2rem 2.5rem' }}>
                <div style={{ borderBottom: '1px solid #222222', paddingBottom: '0.5rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ fontSize: '1.5rem', fontFamily: 'var(--font-serif)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <RefreshCw size={18} /> Rebalancing Simulator & Scenarios
                  </h2>
                  <span className="mono-tag" style={{ fontSize: '0.65rem' }}>Simulation Engine (No Recommendations)</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                  {/* Simulator Actions Column */}
                  <div>
                    <h3 style={{ fontSize: '1rem', fontFamily: 'var(--font-serif)', margin: '0 0 1rem 0', fontWeight: 'bold' }}>Simulate Transactions</h3>
                    
                    {/* Form to add action */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', background: '#FCFAF6', border: '1px solid #E2DACD', padding: '1rem', marginBottom: '1rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        <div>
                          <label style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>Action</label>
                          <select 
                            value={simAction}
                            onChange={(e) => setSimAction(e.target.value as any)}
                            style={{ width: '100%', fontSize: '0.75rem', padding: '0.35rem', background: 'white', border: '1px solid #C4B9A7' }}
                          >
                            <option value="buy">Buy (Add Position)</option>
                            <option value="sell">Sell (Reduce Position)</option>
                            <option value="adjust_cash">Adjust Cash Buffer</option>
                            <option value="add_new">Add New Security</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>Ticker</label>
                          <input 
                            type="text"
                            placeholder="e.g. NVDA"
                            value={simTicker}
                            onChange={(e) => setSimTicker(e.target.value)}
                            disabled={simAction === 'adjust_cash'}
                            style={{ width: '100%', fontSize: '0.75rem', padding: '0.35rem', border: '1px solid #C4B9A7', textTransform: 'uppercase' }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        <div>
                          <label style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>Capital Amount ({reportingCurrency})</label>
                          <input 
                            type="number"
                            value={simAmount}
                            onChange={(e) => setSimAmount(e.target.value)}
                            style={{ width: '100%', fontSize: '0.75rem', padding: '0.35rem', border: '1px solid #C4B9A7' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>Percentage Trim (%)</label>
                          <input 
                            type="number"
                            placeholder="Optional (Sells only)"
                            value={simPercentage}
                            onChange={(e) => setSimPercentage(e.target.value)}
                            disabled={simAction !== 'sell'}
                            style={{ width: '100%', fontSize: '0.75rem', padding: '0.35rem', border: '1px solid #C4B9A7' }}
                          />
                        </div>
                      </div>

                      <button 
                        onClick={handleAddSimulationAction}
                        className="btn btn-secondary btn-sm"
                        style={{ marginTop: '0.5rem', width: '100%', background: 'white' }}
                      >
                        Add Simulation Event
                      </button>
                    </div>

                    {/* Predefined Scenarios (Phase 11.5) */}
                    <div style={{ marginTop: '1.5rem' }}>
                      <h3 style={{ fontSize: '1rem', fontFamily: 'var(--font-serif)', margin: '0 0 0.5rem 0', fontWeight: 'bold' }}>Interactive Scenarios</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        <button onClick={() => handleLoadScenario('invest_capital')} className="btn btn-secondary btn-sm" style={{ fontSize: '0.7rem', padding: '0.4rem', background: 'white' }}>"Invest ₹100k Capital"</button>
                        <button onClick={() => handleLoadScenario('intl_diversify')} className="btn btn-secondary btn-sm" style={{ fontSize: '0.7rem', padding: '0.4rem', background: 'white' }}>"Diversify Internationally"</button>
                        <button onClick={() => handleLoadScenario('trim_concentration')} className="btn btn-secondary btn-sm" style={{ fontSize: '0.7rem', padding: '0.4rem', background: 'white' }}>"Reduce Concentration"</button>
                        <button onClick={() => handleLoadScenario('cash_buffer')} className="btn btn-secondary btn-sm" style={{ fontSize: '0.7rem', padding: '0.4rem', background: 'white' }}>"Build Cash Buffer"</button>
                      </div>
                    </div>
                  </div>

                  {/* Simulation Results Column */}
                  <div style={{ borderLeft: '1px solid #E2DACD', paddingLeft: '2rem' }}>
                    <h3 style={{ fontSize: '1rem', fontFamily: 'var(--font-serif)', margin: '0 0 1rem 0', fontWeight: 'bold' }}>Simulation Log & Projections</h3>
                    
                    {simulationActions.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '2rem 1rem', border: '1px dashed #E2DACD', background: '#FCFAF6', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Add actions or click an interactive scenario to run calculations.
                      </div>
                    ) : (
                      <div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1.25rem', maxHeight: '120px', overflowY: 'auto' }}>
                          {simulationActions.map((act, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', border: '1px solid #E2DACD', padding: '0.35rem 0.5rem', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                              <span>
                                <strong style={{ textTransform: 'uppercase', color: 'var(--color-accent)' }}>{act.type}</strong>{' '}
                                {act.ticker !== 'CASH' && `${act.ticker}`} ({act.percentage ? `${act.percentage}%` : `${formatCurrency(act.amount, reportingCurrency)}`})
                              </span>
                              <button onClick={() => handleRemoveSimulationAction(idx)} style={{ background: 'transparent', border: 'none', color: 'var(--color-danger-text)', cursor: 'pointer', padding: 0 }}>
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                          <button onClick={handleRunSimulation} className="btn btn-primary btn-sm" style={{ flex: 1 }}>
                            Run Simulation Calculations
                          </button>
                          <button onClick={handleClearSimulation} className="btn btn-secondary btn-sm" style={{ background: 'white' }}>
                            Clear
                          </button>
                        </div>

                        {simulationResult && (
                          <div style={{ fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', background: '#FCFAF6', border: '1px solid #E2DACD', padding: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #E2DACD', paddingBottom: '0.25rem' }}>
                              <span style={{ fontWeight: 'bold' }}>Calculated Delta:</span>
                              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold', color: 'var(--color-accent)' }}>Simulated Projection</span>
                            </div>
                            
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>Portfolio Health Score:</span>
                              <span style={{ fontFamily: 'var(--font-mono)' }}>
                                {simulationResult.current.healthScore} → <strong>{simulationResult.simulated.healthScore}</strong> ({simulationResult.deltas.healthScoreDiff >= 0 ? '+' : ''}{simulationResult.deltas.healthScoreDiff})
                              </span>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>Diversification Score:</span>
                              <span style={{ fontFamily: 'var(--font-mono)' }}>
                                {simulationResult.current.diversificationScore} → <strong>{simulationResult.simulated.diversificationScore}</strong> ({simulationResult.deltas.diversificationScoreDiff >= 0 ? '+' : ''}{simulationResult.deltas.diversificationScoreDiff})
                              </span>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>Concentration HHI Index:</span>
                              <span style={{ fontFamily: 'var(--font-mono)' }}>
                                {simulationResult.current.hhi.toFixed(0)} ({simulationResult.current.hhiStatus}) → <strong>{simulationResult.simulated.hhi.toFixed(0)} ({simulationResult.simulated.hhiStatus})</strong>
                              </span>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>Conviction Profile (Avg):</span>
                              <span style={{ fontFamily: 'var(--font-mono)' }}>
                                {simulationResult.current.averageConviction} → <strong>{simulationResult.simulated.averageConviction}</strong> ({simulationResult.deltas.averageConvictionDiff >= 0 ? '+' : ''}{simulationResult.deltas.averageConvictionDiff})
                              </span>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>Top Position Weight:</span>
                              <span style={{ fontFamily: 'var(--font-mono)' }}>
                                {simulationResult.current.topAssetWeight.toFixed(1)}% → <strong>{simulationResult.simulated.topAssetWeight.toFixed(1)}%</strong>
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
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

          {/* SECTION 4 — INTELLIGENCE TIMELINE */}
          <div className="card" style={{ padding: '1.5rem 2rem' }}>
            <div style={{ borderBottom: '1px solid #E2DACD', paddingBottom: '0.5rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.15rem', fontFamily: 'var(--font-serif)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <History size={16} /> Asset Timeline
              </h3>
              <select 
                value={selectedTimelineTicker}
                onChange={(e) => setSelectedTimelineTicker(e.target.value)}
                style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', background: 'white', border: '1px solid #C4B9A7', fontFamily: 'var(--font-mono)' }}
              >
                {holdings.filter(h => h.ticker !== 'CASH').map(h => (
                  <option key={h.id} value={h.ticker}>{h.ticker}</option>
                ))}
              </select>
            </div>

            {(() => {
              const assetHistory = historyRecords
                .map(hr => {
                  const conv = hr.convictions.find(c => c.ticker.toUpperCase() === selectedTimelineTicker.toUpperCase());
                  return {
                    date: hr.date,
                    conviction: conv ? conv.overallScore : null,
                    quality: conv ? conv.qualityScore : null,
                    smartMoneyFlow: conv ? conv.netInstitutionalFlow : null,
                    dipClass: conv ? conv.dipClassification : null
                  };
                })
                .filter(item => item.conviction !== null)
                .sort((a, b) => a.date.localeCompare(b.date));

              if (assetHistory.length === 0) {
                return (
                  <div style={{ textAlign: 'center', padding: '1.5rem 0', color: 'var(--text-muted)', fontSize: '0.75rem', fontStyle: 'italic' }}>
                    No historical logs compiled for {selectedTimelineTicker} yet.
                  </div>
                );
              }

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
                  <div style={{ background: '#FCFAF6', border: '1px solid #E2DACD', padding: '1rem', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: '#555' }}>
                    <div style={{ borderBottom: '1px solid #DDD', paddingBottom: '0.4rem', marginBottom: '0.5rem', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Conviction Score Trend</span>
                      <span style={{ color: 'var(--color-accent)' }}>7-Day History</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      {assetHistory.map((h, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ width: '50px', flexShrink: 0 }}>{h.date.slice(5)}:</span>
                          <div style={{ background: '#E2DACD', height: '10px', flex: 1, borderRadius: 0, position: 'relative' }}>
                            <div style={{ height: '100%', width: `${h.conviction}%`, backgroundColor: '#8c2a2a' }} />
                          </div>
                          <span style={{ width: '40px', textAlign: 'right', fontWeight: 'bold' }}>{h.conviction}/100</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.75rem' }}>
                    <div style={{ background: '#FCFAF6', border: '1px solid #E2DACD', padding: '0.75rem' }}>
                      <strong style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', marginBottom: '0.25rem' }}>Diagnostics</strong>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <div>Quality: <strong>{assetHistory[assetHistory.length - 1].quality || '—'}/100</strong></div>
                        <div>Dip: <strong style={{ color: '#B45309', textTransform: 'uppercase' }}>{assetHistory[assetHistory.length - 1].dipClass || 'No Dip'}</strong></div>
                      </div>
                    </div>
                    <div style={{ background: '#FCFAF6', border: '1px solid #E2DACD', padding: '0.75rem' }}>
                      <strong style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', marginBottom: '0.25rem' }}>Flow Registry</strong>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <div>Flow: <strong style={{ textTransform: 'capitalize' }}>{assetHistory[assetHistory.length - 1].smartMoneyFlow || 'neutral'}</strong></div>
                        <div>As Of: <strong>{assetHistory[assetHistory.length - 1].date}</strong></div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
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
              <div className="form-grid">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="holding-ticker" className="form-label">Ticker Symbol</label>
                  <input 
                    id="holding-ticker"
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
                  <label htmlFor="holding-symbol" className="form-label">Custom Display Tag</label>
                  <input 
                    id="holding-symbol"
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
                <label htmlFor="holding-name" className="form-label">Asset Name</label>
                <input 
                  id="holding-name"
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. Apple Inc., US Dollar" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="form-grid">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="holding-exchange" className="form-label">Exchange</label>
                  <select 
                    id="holding-exchange"
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
                  <label htmlFor="holding-currency" className="form-label">Currency</label>
                  <select 
                    id="holding-currency"
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
                <label htmlFor="holding-assetClass" className="form-label">Asset Class</label>
                <select 
                  id="holding-assetClass"
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

              <div className="form-grid">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="holding-quantity" className="form-label">Quantity</label>
                  <input 
                    id="holding-quantity"
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
                  <label htmlFor="holding-purchasePrice" className="form-label">Avg Buy Price</label>
                  <input 
                    id="holding-purchasePrice"
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
                <label htmlFor="holding-purchaseDate" className="form-label">Purchase Date</label>
                <input 
                  id="holding-purchaseDate"
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
