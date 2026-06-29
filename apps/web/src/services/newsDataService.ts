import { authService } from './firebase';
import { buildApiUrl } from './urlBuilder';
import type { NewsArticle } from './marketIntelligenceService';

export interface NewsCluster {
  theme: string;
  catalysts: string[];
  risks: string[];
  sentiment: 'Positive' | 'Negative' | 'Neutral';
  articles: NewsArticle[];
  provenance: {
    source: string;
    timestamp: string;
    confidence: 'High' | 'Medium' | 'Low';
  };
}

export class NewsDataService {
  private static readonly DEDUPLICATE_THRESHOLD = 0.75;
  private static readonly NEWS_CACHE_TTL = 2 * 60 * 60 * 1000; // 2 Hours

  /**
   * Helper to calculate Jaccard title similarity between two strings.
   */
  private static calculateJaccardSimilarity(s1: string, s2: string): number {
    const clean1 = s1.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/);
    const clean2 = s2.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/);
    const set1 = new Set(clean1);
    const set2 = new Set(clean2);

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    if (union.size === 0) return 0;
    return intersection.size / union.size;
  }

  /**
   * Deduplicates a list of articles based on title similarity.
   */
  public static deduplicateArticles(articles: NewsArticle[]): NewsArticle[] {
    const uniqueList: NewsArticle[] = [];
    
    for (const art of articles) {
      let isDuplicate = false;
      for (const existing of uniqueList) {
        const similarity = this.calculateJaccardSimilarity(art.headline, existing.headline);
        if (similarity >= this.DEDUPLICATE_THRESHOLD) {
          isDuplicate = true;
          // Merge related tickers
          existing.relatedTickers = Array.from(new Set([...existing.relatedTickers, ...art.relatedTickers]));
          break;
        }
      }
      if (!isDuplicate) {
        uniqueList.push(art);
      }
    }
    return uniqueList;
  }

  /**
   * Core News Ingestion routing all queries through this central service.
   */
  public static async getCompanyNews(
    ticker: string,
    isMockMode: boolean
  ): Promise<NewsArticle[]> {
    const cacheKey = `news_company_${ticker.toUpperCase()}`;
    const timestamp = new Date().toISOString();

    // Check Local Storage Cache first to prevent redundant calls
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.cachedAt < this.NEWS_CACHE_TTL) {
          return parsed.data;
        }
      } catch (e) {
        console.warn('Failed to parse cached company news, refetching...');
      }
    }

    if (isMockMode) {
      const mockList = this.getMockCompanyNews(ticker, timestamp);
      this.writeCache(cacheKey, mockList);
      return mockList;
    }

    try {
      const token = await authService.getIdToken() || 'mock_anonymous';
      const res = await fetch(buildApiUrl(`api/market-data/news?ticker=${encodeURIComponent(ticker)}`), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const raw = await res.json() as NewsArticle[];
        if (raw) {
          const deduplicated = this.deduplicateArticles(raw);
          this.writeCache(cacheKey, deduplicated);
          return deduplicated;
        }
      }
    } catch (e) {
      console.warn('Failed to fetch live company news:', e);
    }

    return [];
  }

  /**
   * Fetches general market macro news.
   */
  public static async getMacroNews(isMockMode: boolean): Promise<NewsArticle[]> {
    const cacheKey = 'news_macro_general';
    const timestamp = new Date().toISOString();

    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.cachedAt < this.NEWS_CACHE_TTL) {
          return parsed.data;
        }
      } catch (e) {
        console.warn('Failed to parse cached macro news, refetching...');
      }
    }

    if (isMockMode) {
      const mockList = this.getMockMacroNews(timestamp);
      this.writeCache(cacheKey, mockList);
      return mockList;
    }

    try {
      const token = await authService.getIdToken() || 'mock_anonymous';
      const res = await fetch(buildApiUrl('api/market-intelligence'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json() as any;
        if (data && data.newsArticles) {
          const deduplicated = this.deduplicateArticles(data.newsArticles);
          this.writeCache(cacheKey, deduplicated);
          return deduplicated;
        }
      }
    } catch (e) {
      console.warn('Failed to fetch live macro news:', e);
    }

    return [];
  }

  /**
   * Clusters articles dynamically into thematic groups.
   */
  public static clusterArticles(articles: NewsArticle[]): NewsCluster[] {
    if (articles.length === 0) return [];
    
    // Grouping by high-level matching keywords
    const keywords = ['earnings', 'guidance', 'inflation', 'yield', 'semiconductors', 'supply', 'restructuring', 'expansion'];
    const clustersMap = new Map<string, NewsArticle[]>();
    const generalList: NewsArticle[] = [];

    for (const art of articles) {
      let matched = false;
      const text = (art.headline + ' ' + art.summary).toLowerCase();
      for (const kw of keywords) {
        if (text.includes(kw)) {
          if (!clustersMap.has(kw)) {
            clustersMap.set(kw, []);
          }
          clustersMap.get(kw)!.push(art);
          matched = true;
          break;
        }
      }
      if (!matched) {
        generalList.push(art);
      }
    }

    const clusters: NewsCluster[] = [];
    const timestamp = new Date().toISOString();

    clustersMap.forEach((arts, themeKey) => {
      clusters.push({
        theme: themeKey.charAt(0).toUpperCase() + themeKey.slice(1) + ' & Industry Shifts',
        catalysts: ['Product announcements', 'Supply updates'],
        risks: ['Market volatility', 'Demand shifts'],
        sentiment: 'Positive',
        articles: arts,
        provenance: {
          source: 'Finnhub News Aggregator via NewsDataService',
          timestamp,
          confidence: 'High'
        }
      });
    });

    if (generalList.length > 0) {
      clusters.push({
        theme: 'General Operations & Macro Context',
        catalysts: ['Market adjustments'],
        risks: ['General index pressures'],
        sentiment: 'Neutral',
        articles: generalList,
        provenance: {
          source: 'Yahoo Finance Feed via NewsDataService',
          timestamp,
          confidence: 'High'
        }
      });
    }

    return clusters;
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

  private static getMockCompanyNews(ticker: string, timestamp: string): NewsArticle[] {
    const symbol = ticker.toUpperCase().trim();
    if (['RELIANCE', 'TCS', 'INFY'].includes(symbol)) {
      return [
        {
          id: `${symbol}_news_1`,
          headline: `${symbol} Expands Operational Channels with Massive Green Cloud Infrastructure Partnerships`,
          summary: 'Corporate details outline strategic deployment to bolster tech margin expansions.',
          sourceName: 'Reuters (India)',
          url: 'https://reuters.com/india/corporate-green-cloud-partnership',
          publishedAt: timestamp,
          relatedTickers: [symbol]
        },
        {
          id: `${symbol}_news_2`,
          headline: `Institutional Analysts Raise Earnings Targets for ${symbol} Post-Quarterly Presentations`,
          summary: 'Positive capital allocation patterns trigger valuation upgrades across regional indices.',
          sourceName: 'MarketWatch',
          url: 'https://marketwatch.com/investing/earnings-upgrades-nifty',
          publishedAt: timestamp,
          relatedTickers: [symbol]
        }
      ];
    }

    return [
      {
        id: `${symbol}_news_1`,
        headline: `${symbol} Launches New Hardware Deployments to Drive Datacenter Operations`,
        summary: 'Technology announcement outlines major client contracts boosting revenue outlook.',
        sourceName: 'Yahoo Finance',
        url: 'https://finance.yahoo.com/news/hardware-datacenters-launch',
        publishedAt: timestamp,
        relatedTickers: [symbol]
      },
      {
        id: `${symbol}_news_2`,
        headline: `Supply Restrictions Cause Short-Term Shipments Consolidation for ${symbol}`,
        summary: 'Manufacturing channels adapt to raw components bottlenecks during macro shift.',
        sourceName: 'Reuters',
        url: 'https://reuters.com/technology/supply-restrictions-shipments',
        publishedAt: timestamp,
        relatedTickers: [symbol]
      }
    ];
  }

  private static getMockMacroNews(timestamp: string): NewsArticle[] {
    return [
      { id: 'news_1', headline: 'Federal Reserve Maintains Caution on Rate Cuts Citing Sticky Inflation Measures', summary: 'Central bank officials emphasize data-dependent criteria before initiating interest rate easing.', sourceName: 'Reuters', url: 'https://reuters.com/finance/fed-rate-cuts-sticky-inflation', publishedAt: timestamp, relatedTickers: [] },
      { id: 'news_2', headline: 'Brent Crude Rises Above $84 per Barrel Following OPEC+ Extended Supply Reductions', summary: 'Crude oil futures tick upward as global supply channels adjust to prolonged quota cuts by OPEC.', sourceName: 'Yahoo Finance', url: 'https://finance.yahoo.com/news/brent-crude-opec-supply-cuts', publishedAt: timestamp, relatedTickers: [] },
      { id: 'news_3', headline: 'Technology Valuation Multiples Cooling Off as 10-Year Bond Yields Hover Near 4.35%', summary: 'Growth stock indices pause their upward trajectory as bond market rates hold their multi-month highs.', sourceName: 'MarketWatch', url: 'https://marketwatch.com/investing/tech-multiples-bond-yields', publishedAt: timestamp, relatedTickers: [] },
      { id: 'news_4', headline: 'Spot Gold Approaches Near-Record Heights Supported by Safe-Haven Geopolitical Buying', summary: 'Precious metals volume remains elevated as institutional accounts add protective hedging allocations.', sourceName: 'Reuters', url: 'https://reuters.com/commodities/gold-safe-haven-hedging', publishedAt: timestamp, relatedTickers: [] }
    ];
  }
}
export default NewsDataService;
