import { authService } from './firebase';
import { CompanyRegistry } from './companyRegistry';

export interface IRAnnouncement {
  id: string;
  type: 'Investor Presentation' | 'Earnings Release' | 'Annual Report' | 'Exchange Announcement';
  title: string;
  publishDate: string;
  url: string;
  summary: string;
  category: string;
}

export interface IRCompanyData {
  ticker: string;
  updatedAt: string;
  announcements: IRAnnouncement[];
  provenance: {
    source: string;
    timestamp: string;
    confidence: 'High' | 'Medium' | 'Low';
  };
}

export class InvestorRelationsService {
  private static readonly CACHE_TTL = 1 * 24 * 60 * 60 * 1000; // 24 Hours

  /**
   * Fetches latest investor relations filings and announcements.
   * Utilizes the CompanyRegistry to verify IR mapping.
   */
  public static async getIRData(
    ticker: string,
    isMockMode: boolean
  ): Promise<IRCompanyData | null> {
    const registry = CompanyRegistry.getEntry(ticker);
    if (!registry || !registry.hasIrCoverage) {
      return null;
    }

    const cacheKey = `ir_data_${ticker.toUpperCase()}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.cachedAt < this.CACHE_TTL) {
          return parsed.data;
        }
      } catch (e) {
        console.warn('Failed to parse cached IR data, refetching...');
      }
    }

    if (isMockMode) {
      const mockData = this.getMockIRData(ticker);
      this.writeCache(cacheKey, mockData);
      return mockData;
    }

    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';
      const token = await authService.getIdToken() || 'mock_anonymous';
      const res = await fetch(`${baseUrl}/api/market-data/ir-disclosures?ticker=${encodeURIComponent(ticker)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json() as IRCompanyData;
        if (data) {
          this.writeCache(cacheKey, data);
          return data;
        }
      }
    } catch (e) {
      console.warn('Failed to fetch live IR disclosures:', e);
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

  private static getMockIRData(ticker: string): IRCompanyData {
    const timestamp = new Date().toISOString();
    const symbol = ticker.toUpperCase().trim();

    // Standardized filings list matching Indian SEC equivalents
    const announcements: IRAnnouncement[] = [
      {
        id: `${symbol}_ir_1`,
        type: 'Investor Presentation',
        title: 'Investor Presentation Q4 & FY26 — Strategic Roadmap & Operating Matrices',
        publishDate: '2026-05-15',
        url: 'https://reliance.com/investor-relations/q4-fy26-presentation.pdf',
        summary: 'Detailed overview of expansion channels, segment operating margins, capital allocation, and new growth verticals.',
        category: 'Earnings Presentations'
      },
      {
        id: `${symbol}_ir_2`,
        type: 'Earnings Release',
        title: 'Audited Financial Results & Earnings Press Release for the Quarter Ended March 31, 2026',
        publishDate: '2026-05-14',
        url: 'https://reliance.com/investor-relations/audited-results-q4-fy26.pdf',
        summary: 'Official financial press release reporting quarterly revenue increase, EPS metrics, and dividend declarations.',
        category: 'Financial Results'
      },
      {
        id: `${symbol}_ir_3`,
        type: 'Exchange Announcement',
        title: 'SEBI Disclosure: Board Approval for Strategic Joint Venture and Green Infrastructure Funding',
        publishDate: '2026-04-10',
        url: 'https://reliance.com/investor-relations/sebi-disclosure-jv-green-cloud.pdf',
        summary: 'Regulatory notification detailing capital commitment and contract execution for the green initiative project.',
        category: 'Exchange Disclosures'
      },
      {
        id: `${symbol}_ir_4`,
        type: 'Annual Report',
        title: 'Annual Integrated Report FY25 — Corporate Governance & Financial Statements',
        publishDate: '2025-07-28',
        url: 'https://reliance.com/investor-relations/annual-report-fy25.pdf',
        summary: 'Full annual corporate integrated report covering audit reviews, director valuations, and notes to accounts.',
        category: 'Annual Reports'
      }
    ];

    return {
      ticker: symbol,
      updatedAt: timestamp,
      announcements,
      provenance: {
        source: 'Corporate Investor Relations & SEBI Disclosures Feed',
        timestamp,
        confidence: 'High'
      }
    };
  }
}
export default InvestorRelationsService;
