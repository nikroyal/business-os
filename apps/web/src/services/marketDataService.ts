export interface AssetMetadata {
  ticker: string;
  exchange: string;
  name: string;
  currency: string;
}

export interface MarketDataProvider {
  name: string;
  getPrice(ticker: string, exchange?: string): Promise<number>;
  getMetadata(ticker: string, exchange?: string): Promise<AssetMetadata | null>;
}

/**
 * FinnhubProvider Scaffold
 * Relies on simulated returns for Phase 3 before live API keys and endpoints are added.
 */
export class FinnhubProvider implements MarketDataProvider {
  name = 'Finnhub';

  async getPrice(ticker: string, exchange?: string): Promise<number> {
    console.log(`[FinnhubProvider] Scaffold getPrice requested for ${ticker} on ${exchange || 'NASDAQ'}`);
    
    // Static mock prices for demonstration/testing
    const mockPrices: Record<string, number> = {
      'AAPL': 175.50,
      'GOOG': 150.20,
      'NVDA': 125.80,
      'MSFT': 420.10,
      'TSLA': 180.40,
      'BTC': 65000.00,
      'RELIANCE': 2950.00,
      'TCS': 3850.00
    };

    const cleanTicker = ticker.toUpperCase().trim();
    if (cleanTicker in mockPrices) {
      return mockPrices[cleanTicker];
    }

    return 100.00; // Return flat baseline default price
  }

  async getMetadata(ticker: string, exchange?: string): Promise<AssetMetadata | null> {
    console.log(`[FinnhubProvider] Scaffold getMetadata requested for ${ticker} on ${exchange || 'NASDAQ'}`);
    
    const mockMetadata: Record<string, AssetMetadata> = {
      'AAPL': { ticker: 'AAPL', exchange: 'NASDAQ', name: 'Apple Inc.', currency: 'USD' },
      'GOOG': { ticker: 'GOOG', exchange: 'NASDAQ', name: 'Alphabet Inc.', currency: 'USD' },
      'NVDA': { ticker: 'NVDA', exchange: 'NASDAQ', name: 'NVIDIA Corporation', currency: 'USD' },
      'MSFT': { ticker: 'MSFT', exchange: 'NASDAQ', name: 'Microsoft Corporation', currency: 'USD' },
      'TSLA': { ticker: 'TSLA', exchange: 'NASDAQ', name: 'Tesla Inc.', currency: 'USD' },
      'BTC': { ticker: 'BTC', exchange: 'CRYPTO', name: 'Bitcoin', currency: 'USD' },
      'RELIANCE': { ticker: 'RELIANCE', exchange: 'NSE', name: 'Reliance Industries Ltd.', currency: 'INR' },
      'TCS': { ticker: 'TCS', exchange: 'NSE', name: 'Tata Consultancy Services Ltd.', currency: 'INR' }
    };

    const cleanTicker = ticker.toUpperCase().trim();
    if (cleanTicker in mockMetadata) {
      return mockMetadata[cleanTicker];
    }

    // Default dynamic structure if not hardcoded
    return {
      ticker: cleanTicker,
      exchange: exchange || 'NASDAQ',
      name: `${cleanTicker} Asset`,
      currency: exchange === 'NSE' || exchange === 'BSE' ? 'INR' : 'USD'
    };
  }
}

/**
 * MarketDataService orchestrator
 * Aggregates calls to selected provider (defaults to Finnhub) and acts as layout intermediary.
 */
class MarketDataServiceImpl {
  private provider: MarketDataProvider;

  constructor() {
    this.provider = new FinnhubProvider();
  }

  /**
   * Inject a different provider at runtime if needed
   */
  setProvider(provider: MarketDataProvider) {
    this.provider = provider;
  }

  /**
   * Retrieves valuation price for a canonical ticker and exchange
   */
  async getPrice(ticker: string, exchange?: string, fallbackPrice?: number): Promise<number> {
    try {
      return await this.provider.getPrice(ticker, exchange);
    } catch (err) {
      console.warn(`[MarketDataService] Failed to retrieve price for ${ticker}:`, err);
      return fallbackPrice !== undefined ? fallbackPrice : 0;
    }
  }

  /**
   * Retrieves company and symbol metadata details
   */
  async getMetadata(ticker: string, exchange?: string): Promise<AssetMetadata | null> {
    try {
      return await this.provider.getMetadata(ticker, exchange);
    } catch (err) {
      console.warn(`[MarketDataService] Failed to retrieve metadata for ${ticker}:`, err);
      return null;
    }
  }
}

export const marketDataService = new MarketDataServiceImpl();
export default marketDataService;
