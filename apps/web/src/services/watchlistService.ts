import { dbService } from './firebase';
import type { WatchlistItem } from './firebase';
import { marketDataService } from './marketDataService';
import type { MarketQuote, AssetMetadata } from './marketDataService';
import { AssetClassificationService } from './assetClassificationService';
import type { NormalizedAsset } from './assetClassificationService';


export interface WatchlistAssetIntelligence {
  item: WatchlistItem;
  quote: MarketQuote;
  metadata: AssetMetadata | null;
  normalized: NormalizedAsset;
  
  // Scans and intelligence calculations
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  distanceFrom52WeekHigh: number; // percentage, e.g. -5.2%
  distanceFrom52WeekLow: number;  // percentage, e.g. +14.8%
  
  dailyPerformance: number;       // daily change %
  weeklyPerformance: number;      // 7-day change %
  thirtyDayPerformance: number;   // 30-day change %
  ninetyDayPerformance: number;   // 90-day change %
}

export class WatchlistService {
  /**
   * Fetch all watchlisted assets for a user and run opportunity calculations
   */
  public static async getWatchlistIntelligence(userId: string): Promise<WatchlistAssetIntelligence[]> {
    const list = await dbService.getWatchlist(userId);
    
    const results = await Promise.all(list.map(async (item) => {
      try {
        const [quote, metadata, history] = await Promise.all([
          marketDataService.getQuote(item.ticker, item.exchange),
          marketDataService.getMetadata(item.ticker, item.exchange),
          marketDataService.getHistoricalPrices(item.ticker, 365, item.exchange)
        ]);
        
        // Normalize classification
        const normalized = AssetClassificationService.normalize(
          item.ticker,
          item.exchange,
          item.currency,
          'Equity', // Watchlist defaults to Equity class
          metadata
        );

        const livePrice = quote.current;

        // Calculate 52 week high & low
        const allPrices = history.length > 0 ? [...history, livePrice] : [livePrice];
        const fiftyTwoWeekHigh = Math.max(...allPrices);
        const fiftyTwoWeekLow = Math.min(...allPrices);

        const distanceFrom52WeekHigh = fiftyTwoWeekHigh > 0 
          ? ((livePrice - fiftyTwoWeekHigh) / fiftyTwoWeekHigh) * 100 
          : 0;
        const distanceFrom52WeekLow = fiftyTwoWeekLow > 0 
          ? ((livePrice - fiftyTwoWeekLow) / fiftyTwoWeekLow) * 100 
          : 0;

        // Performance checks (using calendar days mapped roughly to trading sessions)
        const len = history.length;
        
        const getPerformanceForPeriod = (tradingDaysAgo: number): number => {
          if (len === 0) return 0;
          const startPrice = history[Math.max(0, len - 1 - tradingDaysAgo)];
          return startPrice > 0 ? ((livePrice - startPrice) / startPrice) * 100 : 0;
        };

        const weeklyPerformance = getPerformanceForPeriod(5);
        const thirtyDayPerformance = getPerformanceForPeriod(20);
        const ninetyDayPerformance = getPerformanceForPeriod(60);

        return {
          item,
          quote,
          metadata,
          normalized,
          fiftyTwoWeekHigh,
          fiftyTwoWeekLow,
          distanceFrom52WeekHigh,
          distanceFrom52WeekLow,
          dailyPerformance: quote.percentChange,
          weeklyPerformance,
          thirtyDayPerformance,
          ninetyDayPerformance
        };
      } catch (error) {
        console.error(`Failed to calculate intelligence for watchlist item ${item.ticker}:`, error);
        // Return item with empty/fallback stats to avoid breaking the page
        return this.fallbackIntelligence(item);
      }
    }));

    return results;
  }

  /**
   * Add ticker to user watchlist
   */
  public static async addAsset(
    userId: string, 
    ticker: string, 
    exchange: string, 
    customSymbol?: string
  ): Promise<WatchlistItem> {
    const cleanTicker = ticker.toUpperCase().trim();
    const cleanExchange = exchange.toUpperCase().trim();
    
    // Configurable Watchlist Cap (Part 1, Requirement 5)
    const WATCHLIST_CAP = 15;
    const currentList = await dbService.getWatchlist(userId);
    if (currentList.length >= WATCHLIST_CAP) {
      throw new Error(`Watchlist limit of ${WATCHLIST_CAP} assets reached. Please remove an asset before tracking another.`);
    }
    
    // Resolve basic metadata to capture default currency
    let currency = 'USD';
    let name = `${cleanTicker} Asset`;
    try {
      const meta = await marketDataService.getMetadata(cleanTicker, cleanExchange);
      if (meta) {
        currency = meta.currency || currency;
        name = meta.name || name;
      }
    } catch {
      if (cleanExchange === 'NSE' || cleanExchange === 'BSE') {
        currency = 'INR';
      }
    }

    return await dbService.addWatchlistItem(userId, {
      symbol: (customSymbol || cleanTicker).toUpperCase().trim(),
      ticker: cleanTicker,
      exchange: cleanExchange,
      currency,
      name
    });
  }

  /**
   * Delete item from watchlist
   */
  public static async removeAsset(userId: string, itemId: string): Promise<void> {
    await dbService.deleteWatchlistItem(userId, itemId);
  }

  private static fallbackIntelligence(item: WatchlistItem): WatchlistAssetIntelligence {
    const fallbackQuote = {
      current: 0,
      change: 0,
      percentChange: 0,
      high: 0,
      low: 0,
      open: 0,
      previousClose: 0
    };
    
    const normalized = AssetClassificationService.normalize(
      item.ticker,
      item.exchange,
      item.currency,
      'Equity'
    );

    return {
      item,
      quote: fallbackQuote,
      metadata: null,
      normalized,
      fiftyTwoWeekHigh: 0,
      fiftyTwoWeekLow: 0,
      distanceFrom52WeekHigh: 0,
      distanceFrom52WeekLow: 0,
      dailyPerformance: 0,
      weeklyPerformance: 0,
      thirtyDayPerformance: 0,
      ninetyDayPerformance: 0
    };
  }
}

export default WatchlistService;
