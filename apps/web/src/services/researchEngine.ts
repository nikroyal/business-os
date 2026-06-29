import { authService } from './firebase';
import { buildApiUrl } from './urlBuilder';
import { SECDataService } from './secDataService';
import type { SECCompanyFactsData } from './secDataService';
import { InvestorRelationsService } from './investorRelationsService';
import type { IRCompanyData } from './investorRelationsService';
import { NewsDataService } from './newsDataService';
import { CompanyRegistry } from './companyRegistry';

export interface ResearchReport {
  ticker: string;
  exchange: string;
  reportVersion: string;
  generationDate: string;
  executiveSummary: string;
  financialMetricsAnalysis: string;
  risksAndMitigations: string;
  changeDetectionAlerts: {
    metric: string;
    previousValue: string | number;
    currentValue: string | number;
    changePercent: number;
    direction: 'improved' | 'deteriorated' | 'stable';
    source: string;
  }[];
  earningsTrend: {
    quarter: string;
    revenue: number;
    operatingMargin: number;
    netIncome: number;
  }[];
  sourcesUsed: {
    name: string;
    url?: string;
    timestamp: string;
  }[];
  confidenceScore: number;
}

export class ResearchEngine {
  private static readonly REPORT_VERSION = 'v1.0';
  private static readonly CACHE_TTL = 3 * 24 * 60 * 60 * 1000; // 3 Days

  /**
   * Compiles the research report leveraging the shared report cache.
   * Caches by ticker, exchange, report version, and date.
   */
  public static async generateResearchReport(
    ticker: string,
    exchange: string,
    isMockMode: boolean
  ): Promise<ResearchReport> {
    const cleanTicker = ticker.toUpperCase().trim();
    const cleanExchange = exchange.toUpperCase().trim();
    const dateStr = new Date().toISOString().split('T')[0];

    const cacheKey = `research_report_${cleanTicker}_${cleanExchange}_${this.REPORT_VERSION}_${dateStr}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.cachedAt < this.CACHE_TTL) {
          return parsed.data;
        }
      } catch (e) {
        console.warn('Failed to parse cached research report, compiling a new one...');
      }
    }

    // 1. Gather verified data sources first (Data Moat architecture)
    const [secData, irData, newsArticles] = await Promise.all([
      SECDataService.getCompanyFacts(cleanTicker, isMockMode),
      InvestorRelationsService.getIRData(cleanTicker, isMockMode),
      NewsDataService.getCompanyNews(cleanTicker, isMockMode)
    ]);

    let report: ResearchReport;

    if (isMockMode) {
      report = this.compileMockResearchReport(cleanTicker, cleanExchange, dateStr, secData, irData, newsArticles);
      this.writeCache(cacheKey, report);
      return report;
    }

    try {
      const token = await authService.getIdToken() || 'mock_anonymous';
      
      const res = await fetch(buildApiUrl('api/market-data/compile-research'), {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ticker: cleanTicker,
          exchange: cleanExchange,
          version: this.REPORT_VERSION,
          secData,
          irData,
          newsArticles
        })
      });

      if (res.ok) {
        report = await res.json() as ResearchReport;
        this.writeCache(cacheKey, report);
        return report;
      } else {
        throw new Error(`Failed to compile research: HTTP ${res.status}`);
      }
    } catch (e) {
      console.error('Failed to compile live research report:', e);
      throw e;
    }
  }

  /**
   * Deterministic Filing Change Detector & Earnings Intelligence compiler.
   */
  private static compileMockResearchReport(
    ticker: string,
    exchange: string,
    dateStr: string,
    secData: SECCompanyFactsData | null,
    irData: IRCompanyData | null,
    newsArticles: any[]
  ): ResearchReport {
    const registry = CompanyRegistry.getEntry(ticker);
    const hasSec = registry ? registry.hasSecCoverage : false;

    const changeDetectionAlerts: ResearchReport['changeDetectionAlerts'] = [];
    const earningsTrend: ResearchReport['earningsTrend'] = [];
    const sourcesUsed: ResearchReport['sourcesUsed'] = [];

    // Form sources list
    if (secData) {
      sourcesUsed.push({ name: 'SEC EDGAR Submissions Feed', timestamp: secData.updatedAt });
      secData.recentFilings.slice(0, 3).forEach(f => {
        sourcesUsed.push({ name: `SEC EDGAR Form ${f.form}`, url: f.url, timestamp: f.filingDate });
      });
    }
    if (irData) {
      sourcesUsed.push({ name: 'Investor Relations filings', timestamp: irData.updatedAt });
      irData.announcements.slice(0, 3).forEach(a => {
        sourcesUsed.push({ name: `${a.type} Disclosures`, url: a.url, timestamp: a.publishDate });
      });
    }
    newsArticles.slice(0, 3).forEach(n => {
      sourcesUsed.push({ name: `Reuters / Yahoo news: "${n.headline.slice(0, 30)}..."`, url: n.url, timestamp: n.publishedAt });
    });

    // Run Filing Change Detector and populate Earnings history
    if (hasSec && secData && secData.history.length >= 2) {
      const history = secData.history;
      const current = history[history.length - 1];
      const previous = history[history.length - 2];

      // Detect Revenue shifts
      const revDiff = ((current.revenue - previous.revenue) / previous.revenue) * 100;
      changeDetectionAlerts.push({
        metric: 'Quarterly Revenue',
        previousValue: previous.revenue.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }),
        currentValue: current.revenue.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }),
        changePercent: parseFloat(revDiff.toFixed(2)),
        direction: revDiff > 0 ? 'improved' : 'deteriorated',
        source: 'SEC EDGAR Form 10-Q'
      });

      // Detect Margin shifts
      const marginDiff = current.operatingMargin - previous.operatingMargin;
      changeDetectionAlerts.push({
        metric: 'Operating Margin',
        previousValue: `${previous.operatingMargin.toFixed(1)}%`,
        currentValue: `${current.operatingMargin.toFixed(1)}%`,
        changePercent: parseFloat(marginDiff.toFixed(2)),
        direction: marginDiff > 0 ? 'improved' : marginDiff < 0 ? 'deteriorated' : 'stable',
        source: 'SEC EDGAR Form 10-Q'
      });

      // Ingest into trends list
      history.forEach(h => {
        earningsTrend.push({
          quarter: h.date,
          revenue: h.revenue,
          operatingMargin: h.operatingMargin,
          netIncome: h.netIncome
        });
      });
    } else {
      // Indian company (fallback calculations from mock databases / Finnhub)
      const mockIndianHistory = [
        { date: '2025-09-30', revenue: 215000000000, netIncome: 18200000000, operatingIncome: 22100000000, operatingMargin: 10.27, debtToEquity: 0.12 },
        { date: '2025-12-31', revenue: 228000000000, netIncome: 19400000000, operatingIncome: 24500000000, operatingMargin: 10.74, debtToEquity: 0.11 },
        { date: '2026-03-31', revenue: 236000000000, netIncome: 20100000000, operatingIncome: 25100000000, operatingMargin: 10.63, debtToEquity: 0.10 }
      ];

      const current = mockIndianHistory[mockIndianHistory.length - 1];
      const previous = mockIndianHistory[mockIndianHistory.length - 2];

      const revDiff = ((current.revenue - previous.revenue) / previous.revenue) * 100;
      changeDetectionAlerts.push({
        metric: 'Quarterly Revenue (INR)',
        previousValue: `₹${(previous.revenue / 10000000).toFixed(0)} Cr`,
        currentValue: `₹${(current.revenue / 10000000).toFixed(0)} Cr`,
        changePercent: parseFloat(revDiff.toFixed(2)),
        direction: revDiff > 0 ? 'improved' : 'deteriorated',
        source: 'Investor Relations Earnings Release'
      });

      const marginDiff = current.operatingMargin - previous.operatingMargin;
      changeDetectionAlerts.push({
        metric: 'Operating Margin',
        previousValue: `${previous.operatingMargin.toFixed(1)}%`,
        currentValue: `${current.operatingMargin.toFixed(1)}%`,
        changePercent: parseFloat(marginDiff.toFixed(2)),
        direction: marginDiff > 0 ? 'improved' : marginDiff < 0 ? 'deteriorated' : 'stable',
        source: 'Investor Relations Earnings Release'
      });

      mockIndianHistory.forEach(h => {
        earningsTrend.push({
          quarter: h.date,
          revenue: h.revenue,
          operatingMargin: h.operatingMargin,
          netIncome: h.netIncome
        });
      });
    }

    // AI summary template matching
    const executiveSummary = hasSec 
      ? `${ticker} demonstrates structural operational efficiency. Successive filing comparison reports steady quarterly sales. Debt levels are conservatively low at ${secData?.history[secData.history.length-1]?.debtToEquity.toFixed(2)}x, reducing macro volatility exposure.` 
      : `${ticker} exhibits stable domestic leadership in the Nifty index. Investor presentations indicate robust capacity deployments, with quarterly revenues growing at ${changeDetectionAlerts[0]?.changePercent}% quarter-on-quarter.`;

    const financialMetricsAnalysis = `Operating margin shifts indicate stable structural cost alignments. Margin is holding steady at ${earningsTrend[earningsTrend.length-1]?.operatingMargin.toFixed(1)}% due to resource controls. Speculative capital allocations remain low.`;
    
    const risksAndMitigations = `Key risks involve raw material cost increments and regional supply bottlenecks. Mitigation involves long-term contract pricing and inventory safety margins.`;

    return {
      ticker,
      exchange,
      reportVersion: this.REPORT_VERSION,
      generationDate: dateStr,
      executiveSummary,
      financialMetricsAnalysis,
      risksAndMitigations,
      changeDetectionAlerts,
      earningsTrend,
      sourcesUsed,
      confidenceScore: hasSec ? 95 : 88
    };
  }

  private static writeCache(key: string, data: any) {
    try {
      localStorage.setItem(key, JSON.stringify({
        cachedAt: Date.now(),
        data
      }));
    } catch (e) {
      console.warn('LocalStorage limit exceeded, caching skipped:', e);
    }
  }
}
export default ResearchEngine;
