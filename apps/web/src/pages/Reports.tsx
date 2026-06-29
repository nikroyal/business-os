import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { dbService } from '../services/firebase';
import type { DailyReport } from '../services/firebase';
import { PortfolioAnalyticsService } from '../services/portfolioAnalyticsService';
import { WatchlistService } from '../services/watchlistService';
import { IntelligenceService } from '../services/intelligenceService';
import { marketDataService } from '../services/marketDataService';
import type { AssetMetadata } from '../services/marketDataService';
import { 
  Calendar, 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  BookOpen,
  Info,
  ChevronRight,
  FileText,
  Sparkles,
  Download
} from 'lucide-react';
import { GeminiService } from '../services/geminiService';
import { OpportunityService } from '../services/opportunityService';
import type { AICommentary } from '../services/firebase';
import { PlatformHealthWidget } from '../components/PlatformHealthWidget';
import { SampleDataService } from '../services/sampleDataService';
import { ExportService } from '../services/exportService';

export const Reports: React.FC = () => {
  const { user, profile } = useAuth();
  
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  // Gemini state
  const [aiCommentary, setAiCommentary] = useState<AICommentary | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  const loadAICommentary = async (report: DailyReport) => {
    if (!user) return;
    setAiCommentary(null);
    if (!profile?.geminiEnabled) return;
    
    setLoadingAi(true);
    try {
      const listHoldings = await dbService.getHoldings(user.uid);
      const prices: Record<string, number> = {};
      const metadataMap: Record<string, AssetMetadata | null> = {};
      
      await Promise.all(listHoldings.map(async (h) => {
        const tickerStr = h.ticker || h.symbol;
        const [price, meta] = await Promise.all([
          marketDataService.getPrice(tickerStr, h.exchange, h.currentPrice || h.purchasePrice),
          marketDataService.getMetadata(tickerStr, h.exchange)
        ]);
        prices[h.id] = price;
        metadataMap[tickerStr] = meta;
      }));

      const reportingCurrency = profile?.reportingCurrency || 'INR';
      const usdToInrRate = profile?.usdToInrRate || 83.50;

      const analytics = PortfolioAnalyticsService.calculate(
        listHoldings,
        prices,
        metadataMap,
        reportingCurrency,
        usdToInrRate,
        profile?.riskProfile
      );

      const opportunities = await OpportunityService.getStoredOpportunities(user.uid);

      const commentary = await GeminiService.generateEditorialCommentary(
        user.uid,
        profile,
        report,
        analytics,
        opportunities,
        `report_${report.id}`
      );
      setAiCommentary(commentary);
    } catch (err: any) {
      console.warn("AI Commentary fetching error:", err);
    } finally {
      setLoadingAi(false);
    }
  };

  useEffect(() => {
    if (selectedReport) {
      loadAICommentary(selectedReport);
    } else {
      setAiCommentary(null);
    }
  }, [selectedReport, profile]);

  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const fetchReports = async (selectFirst = false) => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const list = await dbService.getReports(user.uid);
      setReports(list);
      if (list.length > 0) {
        if (selectFirst || !selectedReport) {
          setSelectedReport(list[0]);
        } else {
          const updated = list.find(r => r.id === selectedReport.id);
          setSelectedReport(updated || list[0]);
        }
      } else {
        setSelectedReport(null);
      }
    } catch (err) {
      console.error('Error fetching reports:', err);
      setError('Failed to load daily reports database.');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadSampleReports = async () => {
    if (!user) return;
    const confirmImport = window.confirm(
      "Import Sample Portfolio?\n\n" +
      "- Existing holdings and watchlist assets may be replaced or merged.\n" +
      "- Sample data is strictly for demonstration and testing purposes.\n\n" +
      "Click OK to proceed with 'Import Sample Data', or Cancel to abort."
    );
    if (!confirmImport) return;

    setLoading(true);
    setError(null);
    try {
      await SampleDataService.loadSampleData(user.uid);
      await fetchReports(true);
    } catch (err) {
      console.error(err);
      setError('Failed to load sample reports.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchReports(true);
    }
  }, [user]);

  const handleGenerateReport = async () => {
    if (!user) return;
    setGenerating(true);
    setError(null);

    try {
      // 1. Gather all current state to feed into the pipeline
      const listHoldings = await dbService.getHoldings(user.uid);
      
      const prices: Record<string, number> = {};
      const metadataMap: Record<string, AssetMetadata | null> = {};
      
      await Promise.all(listHoldings.map(async (h) => {
        const tickerStr = h.ticker || h.symbol;
        const [price, meta] = await Promise.all([
          marketDataService.getPrice(tickerStr, h.exchange, h.currentPrice || h.purchasePrice),
          marketDataService.getMetadata(tickerStr, h.exchange)
        ]);
        prices[h.id] = price;
        metadataMap[tickerStr] = meta;
      }));

      // Converted exchange rate variables from user settings
      const reportingCurrency = profile?.reportingCurrency || 'INR';
      const usdToInrRate = profile?.usdToInrRate || 83.50;

      // 2. Resolve analytics
      const analytics = PortfolioAnalyticsService.calculate(
        listHoldings,
        prices,
        metadataMap,
        reportingCurrency,
        usdToInrRate,
        profile?.riskProfile
      );

      // 3. Resolve watchlist intelligence
      const watchlistData = await WatchlistService.getWatchlistIntelligence(user.uid);

      // 4. Invoke Daily Intelligence Service Pipeline
      const newReportData = await IntelligenceService.generateReport(
        user.uid,
        profile,
        listHoldings,
        analytics,
        watchlistData
      );

      // 5. Persist to Firestore / LocalStorage
      const savedReport = await dbService.saveReport(user.uid, newReportData);
      
      // 6. Reload report index
      await fetchReports(false);
      setSelectedReport(savedReport);
    } catch (err: any) {
      console.error('Error generating daily intelligence briefing:', err);
      setError(err.message || 'Pipeline failure during intelligence report compilation.');
    } finally {
      setGenerating(false);
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
    <div className="workspace-page" style={{ animation: 'fadeIn 0.25s ease-out', textAlign: 'left' }}>
      
      {/* Editorial Header bar */}
      <div className="workspace-header" style={{ 
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
            Newspaper Archive & Daily Briefings
          </span>
          <h1 style={{ border: 'none', padding: 0, margin: 0, fontSize: '2.5rem' }}>
            Daily Intelligence Dispatch
          </h1>
        </div>
        
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <Calendar size={14} />
              <span>{formattedDate}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-success-text)' }}>
              <BookOpen size={12} />
              <span>DISPATCH SERVICE ACTIVE</span>
            </div>
          </div>
          <PlatformHealthWidget />
        </div>
      </div>

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
          <AlertTriangle size={20} />
          <span>{error}</span>
        </div>
      )}

      <div className="workspace-body reports-grid-layout" style={{ flexGrow: 1, overflow: 'hidden', height: '100%' }}>
        
        {/* Left Side: Report History Archive */}
        <div className="scrollable-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%' }}>
          
          <button 
            onClick={handleGenerateReport} 
            className="btn btn-primary" 
            style={{ width: '100%', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
            disabled={generating}
          >
            <Plus size={16} />
            <span>{generating ? 'Drafting Briefing...' : 'Generate Daily Report'}</span>
          </button>

          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', borderBottom: '1px solid #E2DACD', paddingBottom: '0.5rem', marginBottom: '1rem', fontFamily: 'var(--font-serif)', textTransform: 'uppercase' }}>
              Archive Index
            </h3>

            {loading && reports.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-secondary)', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
                Syncing Archives...
              </div>
            ) : reports.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', border: '1px dashed #E2DACD', background: '#FCFAF6', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                <FileText size={28} style={{ color: 'var(--text-secondary)' }} />
                <div>
                  <p style={{ fontSize: '0.85rem', fontStyle: 'italic', fontFamily: 'var(--font-serif)', margin: '0 0 0.25rem 0' }}>
                    No market briefings generated.
                  </p>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', maxWidth: '280px', margin: '0 auto', lineHeight: 1.3 }}>
                    Establish your portfolio first or load mock configurations to evaluate daily dispatches.
                  </p>
                </div>
                <button 
                  onClick={handleLoadSampleReports}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.5rem', fontSize: '0.7rem', height: '24px' }}
                >
                  <Sparkles size={12} />
                  <span>Load Sample Report</span>
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '450px', overflowY: 'auto' }}>
                {reports.map((report) => {
                  const isSelected = selectedReport?.id === report.id;
                  const dateLabel = new Date(report.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  });
                  return (
                    <div
                      key={report.id}
                      onClick={() => setSelectedReport(report)}
                      style={{
                        padding: '0.75rem 1rem',
                        border: isSelected ? '1px solid var(--text-primary)' : '1px solid #E2DACD',
                        background: isSelected ? '#F5EFE6' : '#FCFAF6',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderLeft: isSelected ? '3px solid var(--color-accent)' : '1px solid #E2DACD'
                      }}
                    >
                      <div style={{ textAlign: 'left', flex: 1, paddingRight: '0.5rem' }}>
                        <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', display: 'block' }}>
                          {dateLabel}
                        </span>
                        <strong style={{ fontSize: '0.8rem', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>
                          {report.title.split(': ').slice(-1)[0]}
                        </strong>
                      </div>
                      <ChevronRight size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Selected Report Detail */}
        <div className="scrollable-panel" style={{ height: '100%', paddingRight: '0.5rem' }}>
          {generating ? (
            <div className="card" style={{ padding: '4rem 2rem', textAlign: 'center', border: '1px dashed #222' }}>
              <div style={{ 
                margin: '0 auto 1.5rem auto',
                width: '40px',
                height: '40px',
                border: '3px solid #E2DACD',
                borderTopColor: 'var(--color-accent)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              <h3 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-serif)', marginBottom: '0.5rem' }}>Drafting Financial Dispatch</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto 1rem auto' }}>
                Connecting ledger balances, evaluating market quote matrices, scanning watchlist opportunities, and compiling the Learning Item database...
              </p>
              <span className="mono-tag" style={{ fontSize: '0.65rem' }}>Pipeline Step: Compiling Sections</span>
            </div>
          ) : selectedReport ? (
            <div className="card" style={{ padding: '2.5rem 3rem', animation: 'fadeIn 0.2s ease-out' }}>
              
              {/* Export Actions Toolbar */}
              <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginBottom: '1rem' }}>
                <button 
                  onClick={() => ExportService.exportDailyReportToMarkdown(selectedReport, aiCommentary, profile?.reportingCurrency || 'INR')}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', height: '28px' }}
                >
                  <Download size={12} />
                  <span>Export Markdown</span>
                </button>
                <button 
                  onClick={() => ExportService.exportDailyReportToPDF(selectedReport, aiCommentary, profile?.reportingCurrency || 'INR')}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', height: '28px' }}
                >
                  <FileText size={12} />
                  <span>Export PDF</span>
                </button>
              </div>

              {/* Report Header */}
              <div style={{ textAlign: 'center', borderBottom: '2px solid var(--text-primary)', paddingBottom: '1.5rem', marginBottom: '2rem' }}>
                <span className="mono-tag" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  BusinessOS Editorial Board • Intelligence Division
                </span>
                <h2 style={{ fontSize: '1.8rem', fontFamily: 'var(--font-serif)', margin: '0.5rem 0', fontWeight: 'bold', lineHeight: 1.25 }}>
                  {selectedReport.title}
                </h2>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  <span>PUBLISHED: {new Date(selectedReport.createdAt).toLocaleString()}</span>
                  <span>•</span>
                  <span>INDEX ID: {selectedReport.id.toUpperCase()}</span>
                </div>
              </div>

              {/* Summary Paragraph / Dropcap */}
              <div style={{ marginBottom: '2rem', borderBottom: '1px solid #E2DACD', paddingBottom: '1.5rem' }}>
                <p style={{ fontSize: '1.05rem', lineHeight: 1.55, fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: '#333', textIndent: '1rem' }}>
                  {selectedReport.summary}
                </p>
              </div>

              {/* Gemini AI Editorial Summary Panel */}
              {profile?.geminiEnabled && (
                <div style={{ 
                  marginBottom: '2.5rem', 
                  background: '#FAF8F5', 
                  border: '1px solid var(--text-primary)', 
                  padding: '1.5rem 2rem',
                  boxShadow: 'var(--shadow-subtle)'
                }}>
                  <h3 style={{ 
                    fontSize: '0.85rem', 
                    fontFamily: 'var(--font-mono)', 
                    textTransform: 'uppercase', 
                    color: 'var(--color-accent)', 
                    marginBottom: '1rem', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.4rem',
                    fontWeight: 600
                  }}>
                    <Sparkles size={14} />
                    <span>Gemini AI Editorial Intelligence</span>
                  </h3>
                  
                  {loadingAi ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      <div className="spinner" style={{ 
                        width: 14, 
                        height: 14, 
                        border: '2px solid rgba(0,0,0,0.1)', 
                        borderTopColor: 'var(--color-accent)', 
                        borderRadius: '50%', 
                        animation: 'spin 1s linear infinite' 
                      }} />
                      <span>Drafting editorial layer...</span>
                    </div>
                  ) : aiCommentary ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      {aiCommentary.fallbackModelUsed && (
                        <div style={{
                          fontSize: '0.75rem',
                          backgroundColor: 'rgba(245, 158, 11, 0.1)',
                          border: '1px solid rgba(245, 158, 11, 0.3)',
                          color: '#b45309',
                          padding: '0.5rem 0.75rem',
                          borderRadius: '0.25rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          fontFamily: 'var(--font-mono)'
                        }}>
                          <span style={{ fontWeight: 'bold' }}>⚠️ FAILOVER NOTICE:</span>
                          <span>{aiCommentary.infoMessage || 'Fallback model used due to high demand.'}</span>
                        </div>
                      )}
                      <p style={{ fontSize: '0.95rem', fontFamily: 'var(--font-serif)', lineHeight: 1.6, textIndent: '1rem', margin: 0, color: 'var(--text-primary)' }}>
                        {aiCommentary.executiveSummary}
                      </p>
                      
                      <div className="reports-commentary-layout" style={{ 
                        borderTop: '1px dashed #E2DACD', 
                        paddingTop: '1rem',
                        marginTop: '0.5rem'
                      }}>
                        <div>
                          <h5 style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '0.4rem', fontWeight: 600 }}>
                            AI Portfolio Commentary
                          </h5>
                          <p style={{ fontSize: '0.8rem', lineHeight: 1.4, margin: 0, color: 'var(--text-secondary)' }}>
                            {aiCommentary.portfolioCommentary}
                          </p>
                        </div>
                        <div>
                          <h5 style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '0.4rem', fontWeight: 600 }}>
                            AI Market Context
                          </h5>
                          <p style={{ fontSize: '0.8rem', lineHeight: 1.4, margin: 0, color: 'var(--text-secondary)' }}>
                            {aiCommentary.marketContext}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      Gemini commentary temporarily unavailable. Verify API key credentials in Settings.
                    </div>
                  )}
                </div>
              )}

              {/* Sections Double Column Layout */}
              <div className="reports-sections-layout" style={{ alignItems: 'start' }}>
                
                {/* Left Panel: Market Snapshot & Portfolio Metrics */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  
                  {/* Market Intelligence Brief */}
                  {selectedReport.sections.marketIntelligenceBrief && (
                    <div style={{ 
                      background: 'var(--color-bg-secondary)', 
                      border: '1px solid var(--color-border)', 
                      padding: '1rem', 
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                      borderRadius: '4px'
                    }}>
                      <h4 style={{ 
                        fontSize: '0.8rem', 
                        margin: '0 0 0.25rem 0', 
                        fontFamily: 'var(--font-mono)', 
                        textTransform: 'uppercase', 
                        color: 'var(--color-accent)',
                        border: 'none',
                        padding: 0
                      }}>
                        Market Intelligence Brief
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.75rem', lineHeight: 1.4 }}>
                        <div><strong>Active Regimes:</strong> {selectedReport.sections.marketIntelligenceBrief.regimes}</div>
                        <div><strong>Sector Leadership:</strong> Strongest: {selectedReport.sections.marketIntelligenceBrief.strongestSectors} | Weakest: {selectedReport.sections.marketIntelligenceBrief.weakestSectors}</div>
                        <div><strong>Macro:</strong> {selectedReport.sections.marketIntelligenceBrief.macroDevelopments}</div>
                        <div><strong>Notable Changes:</strong> {selectedReport.sections.marketIntelligenceBrief.notableChanges}</div>
                      </div>
                    </div>
                  )}

                  {/* Market Snapshot */}
                  <div>
                    <h4 style={{ fontSize: '0.9rem', borderBottom: '1px solid #222', paddingBottom: '0.25rem', marginBottom: '0.75rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Market Indices</span>
                      <span className="mono-tag" style={{ 
                        fontSize: '0.6rem',
                        background: selectedReport.sections.marketSnapshot.globalTrend === 'bullish' ? 'var(--color-success-bg)' : selectedReport.sections.marketSnapshot.globalTrend === 'bearish' ? 'var(--color-danger-bg)' : '#E2DACD',
                        color: selectedReport.sections.marketSnapshot.globalTrend === 'bullish' ? 'var(--color-success-text)' : selectedReport.sections.marketSnapshot.globalTrend === 'bearish' ? 'var(--color-danger-text)' : 'var(--text-secondary)'
                      }}>
                        {selectedReport.sections.marketSnapshot.globalTrend}
                      </span>
                    </h4>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.8rem', lineHeight: 1.4 }}>
                      <div>
                        <strong style={{ display: 'block', color: 'var(--text-primary)' }}>US Equities:</strong>
                        <span style={{ color: 'var(--text-secondary)' }}>{selectedReport.sections.marketSnapshot.usMarket}</span>
                      </div>
                      <div>
                        <strong style={{ display: 'block', color: 'var(--text-primary)' }}>Indian Markets:</strong>
                        <span style={{ color: 'var(--text-secondary)' }}>{selectedReport.sections.marketSnapshot.indianMarket}</span>
                      </div>
                      <div>
                        <strong style={{ display: 'block', color: 'var(--text-primary)' }}>Cryptocurrency:</strong>
                        <span style={{ color: 'var(--text-secondary)' }}>{selectedReport.sections.marketSnapshot.cryptoMarket}</span>
                      </div>
                    </div>
                  </div>

                  {/* Portfolio Analytics Summary */}
                  <div>
                    <h4 style={{ fontSize: '0.9rem', borderBottom: '1px solid #222', paddingBottom: '0.25rem', marginBottom: '0.75rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
                      Portfolio Summary
                    </h4>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Valuation:</span>
                        <strong style={{ fontFamily: 'var(--font-mono)' }}>
                          {formatCurrency(selectedReport.sections.portfolioSummary.totalValue, profile?.reportingCurrency || 'INR')}
                        </strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Returns Basis:</span>
                        <strong style={{ 
                          fontFamily: 'var(--font-mono)',
                          color: selectedReport.sections.portfolioSummary.totalGainLoss >= 0 ? 'var(--color-success-text)' : 'var(--color-danger-text)'
                        }}>
                          {formatCurrency(selectedReport.sections.portfolioSummary.totalGainLoss, profile?.reportingCurrency || 'INR')}
                        </strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Ledger Posture:</span>
                        <span className="mono-tag" style={{ fontSize: '0.65rem' }}>{selectedReport.sections.portfolioSummary.performanceLabel}</span>
                      </div>
                    </div>

                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4, fontStyle: 'italic', borderTop: '1px dashed #E2DACD', paddingTop: '0.5rem' }}>
                      {selectedReport.sections.portfolioSummary.allocationHighlights}
                    </p>
                  </div>

                </div>

                {/* Right Panel: Watchlist Movers, Risk Assessment & Learning Item */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  
                  {/* Watchlist Movers */}
                  <div>
                    <h4 style={{ fontSize: '0.9rem', borderBottom: '1px solid #222', paddingBottom: '0.25rem', marginBottom: '0.75rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
                      Monitored Movers
                    </h4>

                    {selectedReport.sections.watchlistMovers && selectedReport.sections.watchlistMovers.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {selectedReport.sections.watchlistMovers.map((mover, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', borderBottom: '1px dashed #E2DACD', paddingBottom: '0.4rem' }}>
                            <div>
                              <strong style={{ fontFamily: 'var(--font-mono)' }}>{mover.ticker}</strong>
                              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: '0.4rem' }}>({mover.exchange})</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                              <span>{formatCurrency(mover.price, mover.exchange === 'NSE' || mover.exchange === 'BSE' ? 'INR' : 'USD')}</span>
                              <span style={{ 
                                color: mover.direction === 'up' ? 'var(--color-success-text)' : 'var(--color-danger-text)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.1rem'
                              }}>
                                {mover.direction === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                <span>{formatPercent(mover.changePercent)}</span>
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No active watchlist indices monitored.</span>
                    )}
                  </div>

                  {/* Risk Assessment */}
                  <div>
                    <h4 style={{ fontSize: '0.9rem', borderBottom: '1px solid #222', paddingBottom: '0.25rem', marginBottom: '0.75rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
                      Risk Assessment
                    </h4>

                    {selectedReport.sections.riskFlags && selectedReport.sections.riskFlags.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {selectedReport.sections.riskFlags.map((flag, idx) => (
                          <div key={idx} style={{ 
                            borderLeft: `2px solid ${flag.level === 'danger' ? 'var(--color-danger-border)' : flag.level === 'warning' ? '#F59E0B' : 'var(--color-primary)'}`,
                            paddingLeft: '0.5rem',
                            fontSize: '0.75rem',
                            lineHeight: 1.35
                          }}>
                            <strong style={{ 
                              color: flag.level === 'danger' ? 'var(--color-danger-text)' : flag.level === 'warning' ? '#B45309' : 'var(--text-primary)',
                              display: 'block' 
                            }}>
                              {flag.message}
                            </strong>
                            <span style={{ color: 'var(--text-secondary)' }}>{flag.suggestion}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-success-text)', fontSize: '0.75rem' }}>
                        <span className="mono-tag" style={{ background: 'var(--color-success-bg)', color: 'var(--color-success-text)' }}>SECURE</span>
                        <span>No warning flags active. Portfolio in low vulnerability state.</span>
                      </div>
                    )}
                  </div>

                  {/* Learning Item of the Day */}
                  <div style={{ background: '#FCFAF6', border: '1px solid #E2DACD', padding: '1rem', marginTop: '0.5rem' }}>
                    <h5 style={{ 
                      fontSize: '0.7rem', 
                      fontFamily: 'var(--font-mono)', 
                      margin: '0 0 0.5rem 0', 
                      color: 'var(--color-accent)', 
                      textTransform: 'uppercase',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem' 
                    }}>
                      <Info size={12} />
                      <span>Term of the Day</span>
                    </h5>
                    <strong style={{ fontSize: '0.85rem', fontFamily: 'var(--font-serif)', display: 'block', marginBottom: '0.25rem' }}>
                      {selectedReport.sections.learningItem.term}
                    </strong>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4, margin: '0 0 0.5rem 0' }}>
                      {selectedReport.sections.learningItem.definition}
                    </p>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.3, fontStyle: 'italic', borderTop: '1px dashed #E2DACD', paddingTop: '0.4rem', margin: 0 }}>
                      {selectedReport.sections.learningItem.context}
                    </p>
                  </div>

                </div>

              </div>

              {/* Gemini disclaimer box */}
              <div style={{ 
                marginTop: '2.5rem',
                borderTop: '1px solid #222',
                paddingTop: '1rem',
                fontSize: '0.65rem',
                color: 'var(--text-muted)',
                textAlign: 'center',
                fontStyle: 'italic'
              }}>
                This daily briefing compilation is processed deterministically. {profile?.geminiEnabled ? "Google Gemini editorial layers are active." : "Gemini Editorial Commentary is currently disabled in Settings."}
              </div>

            </div>
          ) : (
            <div className="card" style={{ padding: '6rem 2rem', textAlign: 'center', borderStyle: 'dashed' }}>
              <FileText size={36} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem auto' }} />
              <h3 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-serif)', marginBottom: '0.5rem' }}>No Archive Selected</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '300px', margin: '0 auto 1.25rem auto' }}>
                Select a dispatch record from the left index, or generate a new market analysis above.
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
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default Reports;
