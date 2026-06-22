import type { UserProfile, Holding, DailyReport } from './firebase';
import type { PortfolioAnalytics } from './portfolioAnalyticsService';
import type { WatchlistAssetIntelligence } from './watchlistService';

export class IntelligenceService {
  // Rotating learning terms dictionary for the "Learning Item of the Day"
  private static LEARNING_ITEMS = [
    {
      term: 'Herfindahl-Hirschman Index (HHI)',
      definition: 'A mathematical measure of concentration risk, calculated by squaring the portfolio weight percentage of each asset.',
      context: 'In portfolio management, an HHI under 1,500 indicates solid diversification, while an HHI above 3,000 indicates high concentration in a few large assets, increasing vulnerability to single-asset shocks.'
    },
    {
      term: 'Currency Exposure Risk',
      definition: 'The risk of investment value fluctuations due to shifts in exchange rates relative to your base reporting currency.',
      context: 'If your base reporting currency is INR and you hold 40% in USD-denominated assets like Apple, your net portfolio value in INR will decrease if the USD depreciates, even if Apple shares stay flat.'
    },
    {
      term: 'Asset Allocation Strategy',
      definition: 'The process of distributing capital across different categories (Equities, Cryptocurrencies, Cash, Fixed Income) based on risk tolerance.',
      context: 'Asset allocation is widely considered the single most critical driver of portfolio returns and volatility, far outweighing individual stock picking.'
    },
    {
      term: 'Unrealized vs. Realized Gains',
      definition: 'Unrealized gains (paper profits) are gains on assets still held in your possession. Realized gains are locked-in profits from assets sold.',
      context: 'Paper gains can evaporate quickly during market corrections. A sound strategy involves occasional rebalancing to lock in gains and maintain target allocations.'
    },
    {
      term: 'Portfolio Rebalancing',
      definition: 'The process of buying or selling assets to restore your portfolio to its original or desired level of asset allocation.',
      context: 'Without periodic rebalancing, high-performing volatile assets (like Crypto) can grow to dominate your portfolio, shifting your risk profile from moderate to aggressive without your active choice.'
    }
  ];

  /**
   * Main entry point to compile and generate a daily report.
   * Structured to cleanly swap in the Gemini LLM text generation pipeline in Phase 7.
   */
  public static async generateReport(
    userId: string,
    profile: UserProfile | null,
    holdings: Holding[],
    analytics: PortfolioAnalytics,
    watchlist: WatchlistAssetIntelligence[]
  ): Promise<Omit<DailyReport, 'id' | 'createdAt'>> {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    
    // Title in the Financial Times editorial tone
    const title = `Daily Dispatch: Macro Overview & Portfolio Analysis — ${today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

    // 1. Compile Market Snapshot based on actual watchlist/portfolio prices
    const marketSnapshot = this.compileMarketSnapshot(watchlist, holdings);

    // 2. Compile Portfolio Summary
    const portfolioSummary = this.compilePortfolioSummary(analytics);

    // 3. Compile Watchlist Movers (top 3 absolute performers)
    const watchlistMovers = this.compileWatchlistMovers(watchlist);

    // 4. Compile Risk Flags from analytics
    const riskFlags = analytics.health.flags.map(f => ({
      level: f.type,
      message: f.message,
      suggestion: f.suggestion
    }));

    // 5. Select a Rotating Learning Item based on day of month
    const learningIdx = today.getDate() % this.LEARNING_ITEMS.length;
    const learningItem = this.LEARNING_ITEMS[learningIdx];

    // 6. Generate editorial summary text (Simulates Gemini summary)
    const summary = this.generateEditorialSummary(analytics, marketSnapshot.globalTrend, profile);

    return {
      userId,
      date: dateStr,
      title,
      summary,
      sections: {
        marketSnapshot,
        portfolioSummary,
        watchlistMovers,
        riskFlags,
        learningItem
      }
    };
  }

  /**
   * Compiles dynamic market snapshot messages using live watchlist and holdings metrics
   */
  private static compileMarketSnapshot(
    watchlist: WatchlistAssetIntelligence[],
    holdings: Holding[]
  ): { globalTrend: 'bullish' | 'bearish' | 'neutral'; usMarket: string; indianMarket: string; cryptoMarket: string } {
    // Collect all price changes to determine a market bias
    const changes: number[] = [];
    watchlist.forEach(w => { if (w.quote.current > 0) changes.push(w.quote.percentChange); });
    
    // Average change
    const avgChange = changes.length > 0 ? changes.reduce((a, b) => a + b, 0) / changes.length : 0;
    
    let globalTrend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    if (avgChange > 0.4) globalTrend = 'bullish';
    else if (avgChange < -0.4) globalTrend = 'bearish';

    // Sector summaries
    const hasUS = watchlist.some(w => ['NASDAQ', 'NYSE'].includes(w.item.exchange)) || 
                  holdings.some(h => ['NASDAQ', 'NYSE'].includes(h.exchange));
    const hasIN = watchlist.some(w => ['NSE', 'BSE'].includes(w.item.exchange)) ||
                  holdings.some(h => ['NSE', 'BSE'].includes(h.exchange));
    const hasCrypto = watchlist.some(w => w.item.exchange === 'CRYPTO') ||
                      holdings.some(h => h.exchange === 'CRYPTO');

    // Build specific descriptions
    let usMarket = 'US Equities are experiencing flat trading conditions with low volume volatility.';
    if (hasUS) {
      const usMovers = watchlist.filter(w => ['NASDAQ', 'NYSE'].includes(w.item.exchange));
      const usAvg = usMovers.length > 0 ? usMovers.reduce((acc, w) => acc + w.quote.percentChange, 0) / usMovers.length : avgChange;
      if (usAvg > 0.5) {
        usMarket = 'US indices ticked upward in early sessions, led by broad-market technology buying and positive earnings previews.';
      } else if (usAvg < -0.5) {
        usMarket = 'US Equities retreated amid inflation concerns and rising yields, prompting risk-off liquidations.';
      }
    }

    let indianMarket = 'Indian Equities remained steady, with institutional flows showing balanced domestic activity.';
    if (hasIN) {
      const inMovers = watchlist.filter(w => ['NSE', 'BSE'].includes(w.item.exchange));
      const inAvg = inMovers.length > 0 ? inMovers.reduce((acc, w) => acc + w.quote.percentChange, 0) / inMovers.length : avgChange;
      if (inAvg > 0.5) {
        indianMarket = 'Indian markets exhibited strength. Solid performance in index heavyweights supported BSE Sensex and Nifty benchmarks.';
      } else if (inAvg < -0.5) {
        indianMarket = 'Indian indices experienced profit-taking. High valuations and global headwinds weighed on major banking and tech sectors.';
      }
    }

    let cryptoMarket = 'Cryptocurrency assets displayed tight ranges, aligning with traditional asset indexes.';
    if (hasCrypto) {
      const btc = watchlist.find(w => w.item.ticker === 'BTC');
      const cryptoMovers = watchlist.filter(w => w.item.exchange === 'CRYPTO');
      const cryptoAvg = cryptoMovers.length > 0 ? cryptoMovers.reduce((acc, w) => acc + w.quote.percentChange, 0) / cryptoMovers.length : (btc ? btc.quote.percentChange : avgChange);
      
      if (cryptoAvg > 1.5) {
        cryptoMarket = 'Cryptocurrency networks surged, showing high capital inflows and liquid momentum led by Bitcoin (BTC) breakout attempts.';
      } else if (cryptoAvg < -1.5) {
        cryptoMarket = 'Cryptocurrency markets fell under selling pressure, leading to leverage flushing and a retracement in major tokens.';
      }
    }

    return {
      globalTrend,
      usMarket,
      indianMarket,
      cryptoMarket
    };
  }

  /**
   * Compiles portfolio statistics summary
   */
  private static compilePortfolioSummary(analytics: PortfolioAnalytics): {
    totalValue: number;
    totalGainLoss: number;
    performanceLabel: string;
    allocationHighlights: string;
  } {
    const totalValue = analytics.totalValue;
    const totalGainLoss = analytics.totalGainLoss;
    const gainPercent = analytics.totalGainLossPercent;

    let performanceLabel = 'Steady Ledger';
    if (gainPercent > 5) {
      performanceLabel = 'Strong Outperformance';
    } else if (gainPercent > 0) {
      performanceLabel = 'Modest Gains';
    } else if (gainPercent < -5) {
      performanceLabel = 'Elevated Portfolio Drawdown';
    } else if (gainPercent < 0) {
      performanceLabel = 'Minor Losses';
    }

    // Allocation highlight
    let allocationHighlights = 'Asset classes are distributed evenly across cash, fixed income, and equities.';
    if (analytics.sectorAllocation.length > 0) {
      const topSector = analytics.sectorAllocation[0];
      allocationHighlights = `The portfolio's primary exposure is concentrated in the ${topSector.name} sector, representing ${topSector.percentage.toFixed(1)}% of total value.`;
    }

    return {
      totalValue,
      totalGainLoss,
      performanceLabel,
      allocationHighlights
    };
  }

  /**
   * Extracts top 3 movers on the watchlist
   */
  private static compileWatchlistMovers(
    watchlist: WatchlistAssetIntelligence[]
  ): { ticker: string; exchange: string; price: number; changePercent: number; direction: 'up' | 'down' }[] {
    const list = [...watchlist]
      .filter(w => w.quote.current > 0)
      .sort((a, b) => Math.abs(b.quote.percentChange) - Math.abs(a.quote.percentChange))
      .slice(0, 3)
      .map(w => ({
        ticker: w.item.symbol,
        exchange: w.item.exchange,
        price: w.quote.current,
        changePercent: w.quote.percentChange,
        direction: w.quote.percentChange >= 0 ? 'up' as const : 'down' as const
      }));

    return list;
  }

  /**
   * Simulates an editorial summary paragraph (will be generated by Gemini in Phase 7)
   */
  private static generateEditorialSummary(
    analytics: PortfolioAnalytics, 
    globalTrend: string,
    profile: UserProfile | null
  ): string {
    const name = profile?.displayName || 'Investor';
    const changeLabel = analytics.totalGainLoss >= 0 ? 'net gain' : 'net loss';
    const percentStr = Math.abs(analytics.totalGainLossPercent).toFixed(2);
    
    let advice = 'The index remains balanced. Maintaining a steady allocation while letting volatility settle is advised.';
    if (analytics.health.status === 'Critical') {
      advice = 'Urgent attention is needed on your risk metrics. Address the heavy concentration alerts to protect capital.';
    } else if (analytics.health.status === 'Warning') {
      advice = 'Several warnings are flagged. Trimming over-allocated positions would restore your portfolio to target safety limits.';
    } else if (globalTrend === 'bullish') {
      advice = 'Market momentum is favorable. Monitor trailing stops and allow your winning positions to compound safely.';
    }

    return `Dear ${name}, your portfolio registered a ${changeLabel} of ${percentStr}% today, closing with a valuation of ${analytics.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. Global market indexes exhibited a ${globalTrend} posture. ${advice}`;
  }
}

export default IntelligenceService;
