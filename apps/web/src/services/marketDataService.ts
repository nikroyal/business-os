export interface AssetMetadata {
  ticker: string;
  exchange: string;
  name: string;
  currency: string;
  country?: string;
  industry?: string;
  marketCapitalization?: number;
}

export interface MarketQuote {
  current: number;
  change: number;
  percentChange: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
}

export interface MarketDataProvider {
  name: string;
  getPrice(ticker: string, exchange?: string): Promise<number>;
  getQuote(ticker: string, exchange?: string): Promise<MarketQuote>;
  getMetadata(ticker: string, exchange?: string): Promise<AssetMetadata | null>;
  getHistoricalPrices(ticker: string, days: number, exchange?: string): Promise<number[]>;
}

/**
 * Live Finnhub Provider with Caching, Rate-Limit Protection, and Suffix Mapping
 */
export class FinnhubProvider implements MarketDataProvider {
  name = 'Finnhub';

  // Cache store and time-to-live settings
  private cache = new Map<string, { data: any; timestamp: number }>();
  private readonly PRICE_TTL = 5 * 60 * 1000;         // 5 minutes
  private readonly METADATA_TTL = 24 * 60 * 60 * 1000;  // 24 hours

  // Throttling fields to enforce standard rate limiting
  private lastCallTime = 0;
  private readonly MIN_CALL_INTERVAL = 1100; // 1.1s intervals (~54 requests/min)

  /**
   * Spacing out consecutive API requests to protect against the 60 calls/min rate limits
   */
  private async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastCallTime;
    if (elapsed < this.MIN_CALL_INTERVAL) {
      const waitTime = this.MIN_CALL_INTERVAL - elapsed;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    this.lastCallTime = Date.now();
  }

  /**
   * Retrieves the backend api base URL
   */
  private getApiBaseUrl(): string {
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';
    return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  }

  /**
   * Formats ticker to canonical Finnhub symbol. Add .NS for NSE and .BO for BSE.
   */
  private formatSymbol(ticker: string, exchange?: string): string {
    const cleanTicker = ticker.toUpperCase().trim();
    if (!exchange) return cleanTicker;

    const cleanExchange = exchange.toUpperCase().trim();
    if (cleanExchange === 'NSE') {
      return `${cleanTicker}.NS`;
    }
    if (cleanExchange === 'BSE') {
      return `${cleanTicker}.BO`;
    }
    return cleanTicker;
  }

  /**
   * Fetches live price for a given asset ticker
   */
  async getPrice(ticker: string, exchange?: string): Promise<number> {
    const quote = await this.getQuote(ticker, exchange);
    return quote.current;
  }

  /**
   * Fetches full quote details (live price, change %, etc.)
   */
  async getQuote(ticker: string, exchange?: string): Promise<MarketQuote> {
    const symbol = this.formatSymbol(ticker, exchange);
    const cacheKey = `quote_${symbol}`;
    
    // Check Cache
    const cached = this.cache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < this.PRICE_TTL)) {
      return cached.data;
    }

    await this.throttle();

    try {
      const apiBaseUrl = this.getApiBaseUrl();
      const url = `${apiBaseUrl}/api/market-data/quote?symbol=${encodeURIComponent(symbol)}`;
      const res = await fetch(url);
      
      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}`);
      }

      const data = await res.json();
      
      // c is the current price returned by Finnhub
      if (data && typeof data.c === 'number' && data.c > 0) {
        const quote: MarketQuote = {
          current: data.c,
          change: data.d || 0,
          percentChange: data.dp || 0,
          high: data.h || data.c,
          low: data.l || data.c,
          open: data.o || data.c,
          previousClose: data.pc || data.c
        };
        this.cache.set(cacheKey, { data: quote, timestamp: Date.now() });
        return quote;
      }

      // Suffix fallback: if ticker fails with NS/BO suffix, try standard lookup as fallback
      if (symbol.includes('.')) {
        console.warn(`[FinnhubProvider] Suffix quote failed for ${symbol}. Retrying unsuffixed.`);
        const baseSymbol = ticker.toUpperCase().trim();
        const baseRes = await fetch(`${apiBaseUrl}/api/market-data/quote?symbol=${encodeURIComponent(baseSymbol)}`);
        if (baseRes.ok) {
          const baseData = await baseRes.json();
          if (baseData && typeof baseData.c === 'number' && baseData.c > 0) {
            const quote: MarketQuote = {
              current: baseData.c,
              change: baseData.d || 0,
              percentChange: baseData.dp || 0,
              high: baseData.h || baseData.c,
              low: baseData.l || baseData.c,
              open: baseData.o || baseData.c,
              previousClose: baseData.pc || baseData.c
            };
            this.cache.set(cacheKey, { data: quote, timestamp: Date.now() });
            return quote;
          }
        }
      }

      console.warn(`[FinnhubProvider] Finnhub returned invalid response for ${symbol}. Falling back to mock.`);
      return this.getMockQuote(ticker, exchange);
    } catch (err: any) {
      console.error(`[FinnhubProvider] Live quote fetch failed for ${symbol}:`, err);
      return this.getMockQuote(ticker, exchange);
    }
  }

  /**
   * Fetches metadata profile for a given asset ticker
   */
  async getMetadata(ticker: string, exchange?: string): Promise<AssetMetadata | null> {
    const symbol = this.formatSymbol(ticker, exchange);
    const cacheKey = `metadata_${symbol}`;

    // Check Cache
    const cached = this.cache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < this.METADATA_TTL)) {
      return cached.data;
    }

    await this.throttle();

    try {
      const apiBaseUrl = this.getApiBaseUrl();
      const url = `${apiBaseUrl}/api/market-data/metadata?symbol=${encodeURIComponent(symbol)}`;
      const res = await fetch(url);
      
      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}`);
      }

      const data = await res.json();
      
      if (data && data.name) {
        const metadata: AssetMetadata = {
          ticker: data.ticker || ticker.toUpperCase().trim(),
          exchange: exchange || (data.exchange ? data.exchange.split(' ')[0] : 'NASDAQ'),
          name: data.name,
          currency: data.currency || (exchange === 'NSE' || exchange === 'BSE' ? 'INR' : 'USD'),
          country: data.country,
          industry: data.finnhubIndustry,
          marketCapitalization: data.marketCapitalization
        };
        this.cache.set(cacheKey, { data: metadata, timestamp: Date.now() });
        return metadata;
      }

      // Retry unsuffixed if suffix failed
      if (symbol.includes('.')) {
        console.warn(`[FinnhubProvider] Suffix metadata lookup failed for ${symbol}. Retrying unsuffixed.`);
        const baseSymbol = ticker.toUpperCase().trim();
        const baseRes = await fetch(`${apiBaseUrl}/api/market-data/metadata?symbol=${encodeURIComponent(baseSymbol)}`);
        if (baseRes.ok) {
          const baseData = await baseRes.json();
          if (baseData && baseData.name) {
            const metadata: AssetMetadata = {
              ticker: baseData.ticker || baseSymbol,
              exchange: exchange || 'NASDAQ',
              name: baseData.name,
              currency: baseData.currency || 'USD',
              country: baseData.country,
              industry: baseData.finnhubIndustry,
              marketCapitalization: baseData.marketCapitalization
            };
            this.cache.set(cacheKey, { data: metadata, timestamp: Date.now() });
            return metadata;
          }
        }
      }

      return this.getMockMetadata(ticker, exchange);
    } catch (err: any) {
      console.error(`[FinnhubProvider] Live metadata lookup failed for ${symbol}:`, err);
      return this.getMockMetadata(ticker, exchange);
    }
  }

  /**
   * Fetches historical stock daily candles
   */
  async getHistoricalPrices(ticker: string, days: number, exchange?: string): Promise<number[]> {
    const symbol = this.formatSymbol(ticker, exchange);
    const cacheKey = `history_${symbol}_${days}`;

    // Check Cache
    const cached = this.cache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < this.PRICE_TTL)) {
      return cached.data;
    }

    await this.throttle();

    try {
      const to = Math.floor(Date.now() / 1000);
      const from = to - (days * 24 * 60 * 60);
      const apiBaseUrl = this.getApiBaseUrl();
      const url = `${apiBaseUrl}/api/market-data/historical?symbol=${encodeURIComponent(symbol)}&from=${from}&to=${to}`;
      const res = await fetch(url);

      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}`);
      }

      const data = await res.json();
      if (data && data.s === 'ok' && Array.isArray(data.c)) {
        this.cache.set(cacheKey, { data: data.c, timestamp: Date.now() });
        return data.c;
      }

      // Retry unsuffixed if suffix failed
      if (symbol.includes('.')) {
        console.warn(`[FinnhubProvider] Suffix history candle failed for ${symbol}. Retrying unsuffixed.`);
        const baseSymbol = ticker.toUpperCase().trim();
        const baseRes = await fetch(`${apiBaseUrl}/api/market-data/historical?symbol=${encodeURIComponent(baseSymbol)}&from=${from}&to=${to}`);
        if (baseRes.ok) {
          const baseData = await baseRes.json();
          if (baseData && baseData.s === 'ok' && Array.isArray(baseData.c)) {
            this.cache.set(cacheKey, { data: baseData.c, timestamp: Date.now() });
            return baseData.c;
          }
        }
      }

      return this.getMockHistory(ticker, days, exchange);
    } catch (err: any) {
      console.error(`[FinnhubProvider] Live history fetch failed for ${symbol}:`, err);
      return this.getMockHistory(ticker, days, exchange);
    }
  }

  // --- MOCK FALLBACK UTILITIES ---

  private getMockPrice(ticker: string, exchange?: string): number {
    const cleanTicker = ticker.toUpperCase().trim();
    const mockPrices: Record<string, number> = {
      'AAPL': 178.45,
      'GOOG': 152.10,
      'NVDA': 128.25,
      'MSFT': 422.30,
      'TSLA': 184.50,
      'BTC': 64800.00,
      'RELIANCE': 2945.50,
      'TCS': 3820.00,
      'ICICIBANK': 1110.45,
      'HDFCBANK': 1485.60,
      'INFY': 1530.80
    };

    if (cleanTicker in mockPrices) {
      return mockPrices[cleanTicker];
    }
    return exchange === 'NSE' || exchange === 'BSE' ? 450.00 : 100.00;
  }

  private getMockQuote(ticker: string, exchange?: string): MarketQuote {
    const current = this.getMockPrice(ticker, exchange);
    // Consistent mock change percentages for standard assets
    const cleanTicker = ticker.toUpperCase().trim();
    const mockChanges: Record<string, number> = {
      'AAPL': 1.45,
      'GOOG': -0.85,
      'NVDA': 4.12,
      'MSFT': 0.15,
      'TSLA': -2.34,
      'BTC': 2.89,
      'RELIANCE': 0.67,
      'TCS': -1.12,
      'ICICIBANK': 1.23,
      'HDFCBANK': -0.45,
      'INFY': -1.65
    };
    const percentChange = mockChanges[cleanTicker] !== undefined ? mockChanges[cleanTicker] : (Math.random() - 0.5) * 3;
    const change = current * (percentChange / 100);
    const previousClose = current - change;
    return {
      current,
      change,
      percentChange,
      high: Math.max(current, previousClose) * 1.01,
      low: Math.min(current, previousClose) * 0.99,
      open: previousClose * (1 + (Math.random() - 0.5) * 0.005),
      previousClose
    };
  }

  private getMockMetadata(ticker: string, exchange?: string): AssetMetadata {
    const cleanTicker = ticker.toUpperCase().trim();
    const mockMetadata: Record<string, AssetMetadata> = {
      'AAPL': { ticker: 'AAPL', exchange: 'NASDAQ', name: 'Apple Inc.', currency: 'USD', country: 'US', industry: 'Technology', marketCapitalization: 2800000 },
      'GOOG': { ticker: 'GOOG', exchange: 'NASDAQ', name: 'Alphabet Inc.', currency: 'USD', country: 'US', industry: 'Technology', marketCapitalization: 1900000 },
      'NVDA': { ticker: 'NVDA', exchange: 'NASDAQ', name: 'NVIDIA Corporation', currency: 'USD', country: 'US', industry: 'Technology', marketCapitalization: 3100000 },
      'MSFT': { ticker: 'MSFT', exchange: 'NASDAQ', name: 'Microsoft Corporation', currency: 'USD', country: 'US', industry: 'Technology', marketCapitalization: 3200000 },
      'TSLA': { ticker: 'TSLA', exchange: 'NASDAQ', name: 'Tesla Inc.', currency: 'USD', country: 'US', industry: 'Automotive', marketCapitalization: 600000 },
      'BTC': { ticker: 'BTC', exchange: 'CRYPTO', name: 'Bitcoin', currency: 'USD', country: 'Global', industry: 'Cryptocurrency', marketCapitalization: 1300000 },
      'RELIANCE': { ticker: 'RELIANCE', exchange: 'NSE', name: 'Reliance Industries Ltd.', currency: 'INR', country: 'IN', industry: 'Energy / Conglomerate', marketCapitalization: 200000 },
      'TCS': { ticker: 'TCS', exchange: 'NSE', name: 'Tata Consultancy Services Ltd.', currency: 'INR', country: 'IN', industry: 'Technology', marketCapitalization: 140000 },
      'ICICIBANK': { ticker: 'ICICIBANK', exchange: 'NSE', name: 'ICICI Bank Ltd.', currency: 'INR', country: 'IN', industry: 'Financial Services', marketCapitalization: 78000 },
      'HDFCBANK': { ticker: 'HDFCBANK', exchange: 'NSE', name: 'HDFC Bank Ltd.', currency: 'INR', country: 'IN', industry: 'Financial Services', marketCapitalization: 110000 },
      'INFY': { ticker: 'INFY', exchange: 'NSE', name: 'Infosys Ltd.', currency: 'INR', country: 'IN', industry: 'Technology', marketCapitalization: 63000 }
    };

    if (cleanTicker in mockMetadata) {
      return mockMetadata[cleanTicker];
    }

    return {
      ticker: cleanTicker,
      exchange: exchange || 'NASDAQ',
      name: `${cleanTicker} Asset`,
      currency: exchange === 'NSE' || exchange === 'BSE' ? 'INR' : 'USD',
      country: exchange === 'NSE' || exchange === 'BSE' ? 'IN' : 'US',
      industry: 'Other',
      marketCapitalization: 10000
    };
  }

  private getMockHistory(ticker: string, days: number, exchange?: string): number[] {
    const base = this.getMockPrice(ticker, exchange);
    const history: number[] = new Array(days);
    let current = base;
    for (let i = days - 1; i >= 0; i--) {
      history[i] = current;
      const change = (Math.random() - 0.5) * (base * 0.015);
      current = Math.max(1.0, current - change);
    }
    return history;
  }
}

class MarketDataServiceImpl {
  private provider: MarketDataProvider;

  constructor() {
    this.provider = new FinnhubProvider();
  }

  setProvider(provider: MarketDataProvider) {
    this.provider = provider;
  }

  async getPrice(ticker: string, exchange?: string, fallbackPrice?: number): Promise<number> {
    try {
      return await this.provider.getPrice(ticker, exchange);
    } catch (err) {
      console.warn(`[MarketDataService] Error resolving price for ${ticker}:`, err);
      return fallbackPrice !== undefined ? fallbackPrice : 0;
    }
  }

  async getQuote(ticker: string, exchange?: string): Promise<MarketQuote> {
    try {
      return await this.provider.getQuote(ticker, exchange);
    } catch (err) {
      console.warn(`[MarketDataService] Error resolving quote for ${ticker}:`, err);
      const price = this.getPrice(ticker, exchange);
      const val = await price;
      return {
        current: val,
        change: 0,
        percentChange: 0,
        high: val,
        low: val,
        open: val,
        previousClose: val
      };
    }
  }

  async getMetadata(ticker: string, exchange?: string): Promise<AssetMetadata | null> {
    try {
      return await this.provider.getMetadata(ticker, exchange);
    } catch (err) {
      console.warn(`[MarketDataService] Error resolving metadata for ${ticker}:`, err);
      return null;
    }
  }

  async getHistoricalPrices(ticker: string, days: number, exchange?: string): Promise<number[]> {
    try {
      return await this.provider.getHistoricalPrices(ticker, days, exchange);
    } catch (err) {
      console.warn(`[MarketDataService] Error resolving historical candles for ${ticker}:`, err);
      return [];
    }
  }
}

export const marketDataService = new MarketDataServiceImpl();
export default marketDataService;

