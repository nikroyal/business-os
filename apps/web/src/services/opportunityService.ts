import { dbService } from './firebase';
import type { Opportunity, Holding, WatchlistItem } from './firebase';
import { marketDataService } from './marketDataService';
import type { AssetMetadata } from './marketDataService';
import { PortfolioAnalyticsService } from './portfolioAnalyticsService';
import type { PortfolioAnalytics } from './portfolioAnalyticsService';
import { AssetClassificationService } from './assetClassificationService';

export class OpportunityService {
  /**
   * Generates and persists investment opportunities for the user.
   */
  public static async generateAndPersist(userId: string): Promise<Opportunity[]> {
    const profile = await dbService.getUserProfile(userId);
    const holdings = await dbService.getHoldings(userId);
    const watchlist = await dbService.getWatchlist(userId);

    // 1. Gather candidates (watchlist, holdings, and fallback default benchmark assets)
    const limitedCandidates = this.gatherCandidates(holdings, watchlist);

    // 2. Fetch prices & metadata for portfolio analytics in chunks
    const { marketPrices, metadataMap } = await this.getPortfolioData(holdings);

    const reportingCurrency = profile?.reportingCurrency || 'USD';
    const usdToInrRate = profile?.usdToInrRate || 83.0;

    // Calculate portfolio analytics
    const analytics = PortfolioAnalyticsService.calculate(
      holdings,
      marketPrices,
      metadataMap,
      reportingCurrency,
      usdToInrRate,
      profile?.riskProfile
    );

    const opportunities: Omit<Opportunity, 'id'>[] = [];
    const generatedTimestamp = new Date().toISOString();

    // 3. For each candidate asset, check rules and generate opportunities in chunks (Part 1, Requirement 4)
    const CANDIDATE_CHUNK_SIZE = 3;
    for (let i = 0; i < limitedCandidates.length; i += CANDIDATE_CHUNK_SIZE) {
      const chunk = limitedCandidates.slice(i, i + CANDIDATE_CHUNK_SIZE);
      await Promise.all(chunk.map(async (candidate) => {
        try {
          await this.evaluateCandidateRules(
            candidate,
            userId,
            holdings,
            analytics,
            reportingCurrency,
            opportunities,
            generatedTimestamp
          );
        } catch (error) {
          console.error(`Failed to generate opportunities for candidate ${candidate.ticker}:`, error);
        }
      }));
    }

    // 4. Persist generated opportunities to Firestore (or local storage fallback)
    const persisted = await dbService.saveOpportunities(userId, opportunities);
    return persisted;
  }

  private static gatherCandidates(holdings: Holding[], watchlist: WatchlistItem[]) {
    const uniqueCandidatesMap = new Map<string, { ticker: string; exchange: string; currency: string; isWatchlist: boolean }>();
    
    // Add holdings first
    holdings.forEach(h => {
      const tickerStr = h.ticker || h.symbol;
      uniqueCandidatesMap.set(`${tickerStr.toUpperCase()}:${h.exchange.toUpperCase()}`, {
        ticker: tickerStr,
        exchange: h.exchange,
        currency: h.currency,
        isWatchlist: false
      });
    });

    // Add watchlist (overwrites or updates isWatchlist to true)
    watchlist.forEach(w => {
      const tickerStr = w.ticker || w.symbol;
      uniqueCandidatesMap.set(`${tickerStr.toUpperCase()}:${w.exchange.toUpperCase()}`, {
        ticker: tickerStr,
        exchange: w.exchange,
        currency: w.currency,
        isWatchlist: true
      });
    });

    // Fallback default assets if unique list is small (< 5 items)
    const defaultAssets = [
      { ticker: 'AAPL', exchange: 'NASDAQ', currency: 'USD' },
      { ticker: 'MSFT', exchange: 'NASDAQ', currency: 'USD' },
      { ticker: 'GOOG', exchange: 'NASDAQ', currency: 'USD' },
      { ticker: 'NVDA', exchange: 'NASDAQ', currency: 'USD' },
      { ticker: 'TSLA', exchange: 'NASDAQ', currency: 'USD' },
      { ticker: 'BTC', exchange: 'CRYPTO', currency: 'USD' },
      { ticker: 'RELIANCE', exchange: 'NSE', currency: 'INR' },
      { ticker: 'TCS', exchange: 'NSE', currency: 'INR' },
    ];

    if (uniqueCandidatesMap.size < 5) {
      defaultAssets.forEach(asset => {
        const key = `${asset.ticker.toUpperCase()}:${asset.exchange.toUpperCase()}`;
        if (!uniqueCandidatesMap.has(key)) {
          uniqueCandidatesMap.set(key, { ...asset, isWatchlist: false });
        }
      });
    }

    const candidateList = Array.from(uniqueCandidatesMap.values());
    
    // Configurable Scan Limit (Part 1, Requirement 4)
    const SCAN_LIMIT = 15;
    return candidateList.slice(0, SCAN_LIMIT);
  }

  private static async getPortfolioData(holdings: Holding[]) {
    const marketPrices: Record<string, number> = {};
    const metadataMap: Record<string, AssetMetadata | null> = {};
    
    const HOLDINGS_CHUNK_SIZE = 5;
    for (let i = 0; i < holdings.length; i += HOLDINGS_CHUNK_SIZE) {
      const chunk = holdings.slice(i, i + HOLDINGS_CHUNK_SIZE);
      await Promise.all(chunk.map(async (h) => {
        const tickerStr = h.ticker || h.symbol;
        const [quote, meta] = await Promise.all([
          marketDataService.getQuote(tickerStr, h.exchange),
          marketDataService.getMetadata(tickerStr, h.exchange)
        ]);
        marketPrices[h.id] = quote.current;
        metadataMap[tickerStr] = meta;
      }));
    }
    return { marketPrices, metadataMap };
  }

  private static async evaluateCandidateRules(
    candidate: { ticker: string; exchange: string; currency: string; isWatchlist: boolean },
    userId: string,
    holdings: Holding[],
    analytics: PortfolioAnalytics,
    reportingCurrency: string,
    opportunities: Omit<Opportunity, 'id'>[],
    generatedTimestamp: string
  ) {
    const { ticker, exchange, isWatchlist } = candidate;
    
    const [quote, meta, history] = await Promise.all([
      marketDataService.getQuote(ticker, exchange),
      marketDataService.getMetadata(ticker, exchange),
      marketDataService.getHistoricalPrices(ticker, 365, exchange)
    ]);

    const livePrice = quote.current;
    if (livePrice <= 0) return; // Skip assets with invalid prices

    // Basic classification
    const normalized = AssetClassificationService.normalize(
      ticker,
      exchange,
      candidate.currency,
      'Equity',
      meta
    );

    // 52-week and momentum calculations
    const allPrices = history.length > 0 ? [...history, livePrice] : [livePrice];
    const fiftyTwoWeekHigh = Math.max(...allPrices);
    const fiftyTwoWeekLow = Math.min(...allPrices);

    const distanceFrom52WeekHigh = fiftyTwoWeekHigh > 0
      ? ((livePrice - fiftyTwoWeekHigh) / fiftyTwoWeekHigh) * 100
      : 0;
    const distanceFrom52WeekLow = fiftyTwoWeekLow > 0
      ? ((livePrice - fiftyTwoWeekLow) / fiftyTwoWeekLow) * 100
      : 0;

    const len = history.length;
    const getPerformanceForPeriod = (tradingDaysAgo: number): number => {
      if (len === 0) return 0;
      const startPrice = history[Math.max(0, len - 1 - tradingDaysAgo)];
      return startPrice > 0 ? ((livePrice - startPrice) / startPrice) * 100 : 0;
    };

    const thirtyDayPerformance = getPerformanceForPeriod(20);
    const ninetyDayPerformance = getPerformanceForPeriod(60);

    // Helper to construct base tags (includes 'watchlist' if applicable)
    const getTags = (baseTag: 'momentum' | 'value' | 'diversification'): ('momentum' | 'value' | 'diversification' | 'watchlist')[] => {
      const tags: ('momentum' | 'value' | 'diversification' | 'watchlist')[] = [baseTag];
      if (isWatchlist) {
        tags.push('watchlist');
      }
      return tags;
    };

    const candidateClass = exchange.toUpperCase() === 'CRYPTO' ? 'Crypto' : (exchange.toUpperCase() === 'CASH' ? 'Cash' : 'Equity');

    // --- RULE 1: Near 52-Week Low ---
    if (distanceFrom52WeekLow >= 0 && distanceFrom52WeekLow <= 10) {
      const score = Math.max(50, Math.min(95, Math.round(95 - distanceFrom52WeekLow * 4.5)));
      opportunities.push({
        userId,
        title: "Near 52-Week Low Support Test",
        ticker,
        exchange,
        rationale: `${meta?.name || ticker} is trading at ${livePrice} ${normalized.currency}, which is only ${distanceFrom52WeekLow.toFixed(1)}% above its 52-week low of ${fiftyTwoWeekLow.toFixed(2)}. Historical support levels may trigger buying interest.`,
        confidenceScore: score,
        supportingMetrics: {
          ruleMatched: "Near 52-week low",
          currentPrice: livePrice,
          metricValue: `${distanceFrom52WeekLow.toFixed(1)}% above 52W Low`,
          fiftyTwoWeekLow,
          distanceFrom52WeekLow
        },
        generatedTimestamp,
        tags: getTags('value')
      });
    }

    // --- RULE 2: Near 52-Week High Breakout ---
    if (distanceFrom52WeekHigh >= -5 && distanceFrom52WeekHigh <= 1) {
      const score = Math.max(50, Math.min(95, Math.round(95 + distanceFrom52WeekHigh * 5.0)));
      opportunities.push({
        userId,
        title: "Potential 52-Week High Breakout",
        ticker,
        exchange,
        rationale: `${meta?.name || ticker} is trading at ${livePrice} ${normalized.currency}, which is within ${Math.abs(distanceFrom52WeekHigh).toFixed(1)}% of its 52-week high of ${fiftyTwoWeekHigh.toFixed(2)}. Rising price action near resistance suggests breakout momentum.`,
        confidenceScore: score,
        supportingMetrics: {
          ruleMatched: "Near 52-week high breakout",
          currentPrice: livePrice,
          metricValue: `${Math.abs(distanceFrom52WeekHigh).toFixed(1)}% from 52W High`,
          fiftyTwoWeekHigh,
          distanceFrom52WeekHigh
        },
        generatedTimestamp,
        tags: getTags('momentum')
      });
    }

    // --- RULE 3: Strong 30-Day Momentum ---
    if (thirtyDayPerformance >= 12) {
      const score = Math.max(50, Math.min(95, Math.round(65 + thirtyDayPerformance * 1.2)));
      opportunities.push({
        userId,
        title: "Strong 30-Day Momentum",
        ticker,
        exchange,
        rationale: `${meta?.name || ticker} has shown strong short-term upward momentum, gaining ${thirtyDayPerformance.toFixed(1)}% over the last 30 days. Current price is ${livePrice} ${normalized.currency}.`,
        confidenceScore: score,
        supportingMetrics: {
          ruleMatched: "Strong 30-day momentum",
          currentPrice: livePrice,
          metricValue: `+${thirtyDayPerformance.toFixed(1)}% (30d)`,
          thirtyDayPerformance
        },
        generatedTimestamp,
        tags: getTags('momentum')
      });
    }

    // --- RULE 4: Strong 90-Day Momentum ---
    if (ninetyDayPerformance >= 25) {
      const score = Math.max(50, Math.min(95, Math.round(60 + ninetyDayPerformance * 0.8)));
      opportunities.push({
        userId,
        title: "Strong 90-Day Momentum",
        ticker,
        exchange,
        rationale: `${meta?.name || ticker} exhibits robust medium-term momentum, gaining ${ninetyDayPerformance.toFixed(1)}% over the last 90 days. Current price is ${livePrice} ${normalized.currency}.`,
        confidenceScore: score,
        supportingMetrics: {
          ruleMatched: "Strong 90-day momentum",
          currentPrice: livePrice,
          metricValue: `+${ninetyDayPerformance.toFixed(1)}% (90d)`,
          ninetyDayPerformance
        },
        generatedTimestamp,
        tags: getTags('momentum')
      });
    }

    // --- RULE 5: Large Pullback Opportunities ---
    if (distanceFrom52WeekHigh <= -15 && distanceFrom52WeekHigh >= -45) {
      const score = Math.max(50, Math.min(95, Math.round(65 + Math.abs(distanceFrom52WeekHigh) * 0.7)));
      opportunities.push({
        userId,
        title: "Significant Pullback Discount",
        ticker,
        exchange,
        rationale: `${meta?.name || ticker} has pulled back by ${Math.abs(distanceFrom52WeekHigh).toFixed(1)}% from its 52-week high of ${fiftyTwoWeekHigh.toFixed(2)} ${normalized.currency}. Current price is ${livePrice} ${normalized.currency}. This pullback may offer a value-oriented entry discount.`,
        confidenceScore: score,
        supportingMetrics: {
          ruleMatched: "Large pullback opportunity",
          currentPrice: livePrice,
          metricValue: `${distanceFrom52WeekHigh.toFixed(1)}% from 52W High`,
          fiftyTwoWeekHigh,
          distanceFrom52WeekHigh
        },
        generatedTimestamp,
        tags: getTags('value')
      });
    }

    // Only run portfolio-dependent rules if user has existing holdings
    if (holdings.length > 0) {

      // --- RULE 6: Portfolio Diversification (Asset Class) ---
      const hasAssetClass = holdings.some(h => {
        return h.assetClass && h.assetClass.toLowerCase() === candidateClass.toLowerCase();
      });

      if (!hasAssetClass) {
        opportunities.push({
          userId,
          title: "Portfolio Class Diversification",
          ticker,
          exchange,
          rationale: `Your portfolio currently has 0% exposure to the ${candidateClass} asset class. Adding ${meta?.name || ticker} (${livePrice} ${normalized.currency}) introduces class diversification and helps reduce overall volatility.`,
          confidenceScore: 80,
          supportingMetrics: {
            ruleMatched: "Portfolio diversification",
            currentPrice: livePrice,
            metricValue: `New Asset Class (${candidateClass})`,
            candidateClass
          },
          generatedTimestamp,
          tags: getTags('diversification')
        });
      }

      // --- RULE 7: Sector Underexposure ---
      if (candidateClass === 'Equity') {
        const candidateSector = normalized.sector;
        if (candidateSector && candidateSector !== 'Other' && candidateSector !== 'N/A') {
          const currentSectorAlloc = analytics.sectorAllocation.find(s => s.name.toLowerCase() === candidateSector.toLowerCase());
          const sectorWeight = currentSectorAlloc ? currentSectorAlloc.percentage : 0;
          
          if (sectorWeight < 5) {
            const score = Math.max(50, Math.round(90 - sectorWeight * 3));
            opportunities.push({
              userId,
              title: "Sector Underexposure Rebalance",
              ticker,
              exchange,
              rationale: `Your portfolio has low exposure (${sectorWeight.toFixed(1)}%) to the ${candidateSector} sector. Investing in ${meta?.name || ticker} (${livePrice} ${normalized.currency}) improves sector-level diversification.`,
              confidenceScore: score,
              supportingMetrics: {
                ruleMatched: "Sector underexposure",
                currentPrice: livePrice,
                metricValue: `${sectorWeight.toFixed(1)}% Portfolio Sector Allocation`,
                candidateSector,
                sectorWeight
              },
              generatedTimestamp,
              tags: getTags('diversification')
            });
          }
        }
      }

      // --- RULE 8: Currency Diversification ---
      const dominantCurrency = analytics.currencyExposure.length > 0 ? analytics.currencyExposure[0].name : reportingCurrency;
      const dominantCurrencyWeight = analytics.currencyExposure.length > 0 ? analytics.currencyExposure[0].percentage : 100;
      const candidateCurrency = normalized.currency;

      if (candidateCurrency !== dominantCurrency && dominantCurrencyWeight > 70) {
        opportunities.push({
          userId,
          title: "Currency Risk Mitigation",
          ticker,
          exchange,
          rationale: `${meta?.name || ticker} is denominated in ${candidateCurrency}, helping diversify away from the portfolio's dominant currency exposure of ${dominantCurrency} (${dominantCurrencyWeight.toFixed(1)}%).`,
          confidenceScore: 75,
          supportingMetrics: {
            ruleMatched: "Currency diversification",
            currentPrice: livePrice,
            metricValue: `Diversify from ${dominantCurrency} to ${candidateCurrency}`,
            candidateCurrency,
            dominantCurrency,
            dominantCurrencyWeight
          },
          generatedTimestamp,
          tags: getTags('diversification')
        });
      }
    }
  }

  /**
   * Retrieves already generated and stored opportunities.
   */
  public static async getStoredOpportunities(userId: string): Promise<Opportunity[]> {
    return await dbService.getOpportunities(userId);
  }
}

export default OpportunityService;
