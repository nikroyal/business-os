import { authService } from './firebase';
import { CompanyRegistry } from './companyRegistry';

export interface SECFilingItem {
  id: string;
  form: '10-K' | '10-Q' | '8-K' | 'Form 4' | '13F';
  filingDate: string;
  reportDate: string;
  url: string;
  summary: string;
  accessionNumber: string;
  primaryDocument: string;
  cik: string;
}

export interface SECHistoricalMetrics {
  date: string;
  revenue: number;
  netIncome: number;
  operatingIncome: number;
  operatingMargin: number;
  debtToEquity: number;
}

export interface SECCompanyFactsData {
  ticker: string;
  cik: string;
  updatedAt: string;
  recentFilings: SECFilingItem[];
  history: SECHistoricalMetrics[];
  provenance: {
    source: string;
    timestamp: string;
    confidence: 'High' | 'Medium' | 'Low';
  };
}

export class SECDataService {
  private static readonly CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 Days

  /**
   * Fetches cached filing submissions and company facts.
   * Leverages the CompanyRegistry to verify coverage before querying.
   */
  public static async getCompanyFacts(
    ticker: string,
    isMockMode: boolean
  ): Promise<SECCompanyFactsData | null> {
    const registry = CompanyRegistry.getEntry(ticker);
    if (!registry || !registry.hasSecCoverage || !registry.CIK) {
      // Graceful fallback for non-SEC companies (India)
      return null;
    }

    const cacheKey = `sec_facts_${ticker.toUpperCase()}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.cachedAt < this.CACHE_TTL) {
          return parsed.data;
        }
      } catch (e) {
        console.warn('Failed to parse cached SEC facts, refetching...');
      }
    }

    if (isMockMode) {
      const mockData = this.getMockCompanyFacts(ticker, registry.CIK);
      this.writeCache(cacheKey, mockData);
      return mockData;
    }

    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';
      const token = await authService.getIdToken() || 'mock_anonymous';
      const res = await fetch(`${baseUrl}/api/market-intelligence/sec-facts?ticker=${encodeURIComponent(ticker)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const facts = await res.json() as SECCompanyFactsData | null;
        if (facts) {
          this.writeCache(cacheKey, facts);
          return facts;
        }
      }
    } catch (e) {
      console.warn('Failed to fetch live SEC facts:', e);
    }

    return null;
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

  private static getMockCompanyFacts(ticker: string, cik: string): SECCompanyFactsData {
    const timestamp = new Date().toISOString();
    
    // Core US index profiles history matching Apple/Microsoft scale
    const mockHistory: Record<string, SECHistoricalMetrics[]> = {
      'AAPL': [
        { date: '2025-09-30', revenue: 90150000000, netIncome: 22960000000, operatingIncome: 25420000000, operatingMargin: 28.2, debtToEquity: 1.45 },
        { date: '2025-12-31', revenue: 119580000000, netIncome: 33920000000, operatingIncome: 37400000000, operatingMargin: 31.3, debtToEquity: 1.42 },
        { date: '2026-03-31', revenue: 90750000000, netIncome: 23640000000, operatingIncome: 26270000000, operatingMargin: 28.9, debtToEquity: 1.40 }
      ],
      'MSFT': [
        { date: '2025-09-30', revenue: 56520000000, netIncome: 22290000000, operatingIncome: 26900000000, operatingMargin: 47.6, debtToEquity: 0.28 },
        { date: '2025-12-31', revenue: 62020000000, netIncome: 21870000000, operatingIncome: 27030000000, operatingMargin: 43.6, debtToEquity: 0.26 },
        { date: '2026-03-31', revenue: 61860000000, netIncome: 21940000000, operatingIncome: 27580000000, operatingMargin: 44.6, debtToEquity: 0.25 }
      ]
    };

    const history = mockHistory[ticker.toUpperCase()] || [
      { date: '2025-09-30', revenue: 12500000000, netIncome: 2500000000, operatingIncome: 3200000000, operatingMargin: 25.6, debtToEquity: 0.50 },
      { date: '2025-12-31', revenue: 14800000000, netIncome: 3100000000, operatingIncome: 3900000000, operatingMargin: 26.3, debtToEquity: 0.48 },
      { date: '2026-03-31', revenue: 15100000000, netIncome: 3220000000, operatingIncome: 4100000000, operatingMargin: 27.1, debtToEquity: 0.45 }
    ];

    const filingsList: SECFilingItem[] = [
      {
        id: `${ticker}_filing_1`,
        form: '10-Q',
        filingDate: '2026-04-28',
        reportDate: '2026-03-31',
        url: `https://www.sec.gov/Archives/edgar/data/${cik}/000032019326000010/index.htm`,
        summary: `Filing Form 10-Q reports standard net sales operations representing total quarterly valuation. Current liquidity reserves expand.`,
        accessionNumber: '0000320193-26-000010',
        primaryDocument: 'aapl-20260331.htm',
        cik
      },
      {
        id: `${ticker}_filing_2`,
        form: '10-Q',
        filingDate: '2026-01-30',
        reportDate: '2025-12-31',
        url: `https://www.sec.gov/Archives/edgar/data/${cik}/000032019326000002/index.htm`,
        summary: `Quarterly filing form 10-Q reports exceptional hardware deployments margins and seasonal operations metrics.`,
        accessionNumber: '0000320193-26-000002',
        primaryDocument: 'aapl-20251231.htm',
        cik
      },
      {
        id: `${ticker}_filing_3`,
        form: '10-K',
        filingDate: '2025-10-31',
        reportDate: '2025-09-30',
        url: `https://www.sec.gov/Archives/edgar/data/${cik}/000032019325000123/index.htm`,
        summary: `Annual Form 10-K provides comprehensive balance sheet audit structure. Strategic corporate risk vectors detail competitive advantages.`,
        accessionNumber: '0000320193-25-000123',
        primaryDocument: 'aapl-20250930.htm',
        cik
      }
    ];

    return {
      ticker: ticker.toUpperCase(),
      cik,
      updatedAt: timestamp,
      recentFilings: filingsList,
      history,
      provenance: {
        source: 'SEC EDGAR Database Ingestion Service',
        timestamp,
        confidence: 'High'
      }
    };
  }
}
export default SECDataService;
