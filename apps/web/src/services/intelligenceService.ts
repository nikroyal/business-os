import type { UserProfile, Holding, DailyReport } from './firebase';
import type { PortfolioAnalytics } from './portfolioAnalyticsService';
import type { WatchlistAssetIntelligence } from './watchlistService';
import { authService, dbService } from './firebase';
import { buildApiUrl } from './urlBuilder';
import type { CompanyIntelligence, UserConviction } from './firebase';



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

    const marketIntelligenceBrief = {
      regimes: "US: Neutral | India: Strong Bull",
      strongestSectors: "Semiconductors, Financials",
      weakestSectors: "Utilities, Real Estate",
      macroDevelopments: "Brent Crude oil climbs to $84.20/bbl on OPEC supply cuts. Spot Gold continues breakout on geopolitical hedging. US 10-Year yield rising near 4.35% pressures growth stock valuations.",
      notableChanges: "US Market Regime downgraded from Bullish to Neutral due to index trend cooling near 200-day SMA."
    };

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
        learningItem,
        marketIntelligenceBrief
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

  private static async fetchWithAuth(path: string, init?: RequestInit): Promise<Response> {
    const token = await authService.getIdToken();
    const headers = {
      ...(init?.headers || {}),
      'Authorization': `Bearer ${token}`
    };
    return fetch(buildApiUrl(path), {
      ...(init || {}),
      headers
    });
  }

  private static generateMockIntelligence(ticker: string, exchange: string): CompanyIntelligence {
    const cleanTicker = ticker.toUpperCase().trim();
    const cleanExchange = exchange.toUpperCase().trim();
    
    let name = cleanTicker;
    let sector = 'Technology';
    let moatRating: 'wide' | 'narrow' | 'none' = 'narrow';
    let moatRationale = 'Moderate scale advantages and brand equity.';
    let leverage = 0.45;
    let fcfMargin = 18.5;
    let risks = ['Market volatility', 'Intense industry competition'];
    
    // Fundamental variables
    let revGrowth: number | null = 8.5;
    let epsGrowth: number | null = 12.1;
    let roic: number | null = 16.4;
    let grossMargin: number | null = 42.5;
    let operatingMargin: number | null = 22.1;
    let debtToEquity: number | null = 0.45;
    let marketCap = 850000;
    let industry = 'Technology Hardware';

    if (cleanTicker === 'AAPL') {
      name = 'Apple Inc.';
      sector = 'Technology';
      moatRating = 'wide';
      moatRationale = 'Deep ecosystem integration, high switching costs, and strong brand pricing power.';
      leverage = 0.45;
      fcfMargin = 26.2;
      risks = ['Antitrust regulatory crackdowns on App Store fees', 'Hardware cycle stagnation'];
      revGrowth = 5.2;
      epsGrowth = 9.4;
      roic = 28.5;
      grossMargin = 44.3;
      operatingMargin = 30.2;
      marketCap = 2950000;
    } else if (cleanTicker === 'MSFT') {
      name = 'Microsoft Corporation';
      sector = 'Technology';
      moatRating = 'wide';
      moatRationale = 'High enterprise switching costs, dominant Windows/Office market share, and Azure cloud growth.';
      leverage = 0.28;
      fcfMargin = 34.5;
      risks = ['Rapid shift to generative AI workloads inflating capital expenditures', 'Cybersecurity vulnerabilities'];
      revGrowth = 12.4;
      epsGrowth = 15.2;
      roic = 24.1;
      grossMargin = 69.2;
      operatingMargin = 43.1;
      marketCap = 3150000;
      industry = 'Software Infrastructure';
    } else if (cleanTicker === 'GOOG' || cleanTicker === 'GOOGL') {
      name = 'Alphabet Inc.';
      sector = 'Technology';
      moatRating = 'wide';
      moatRationale = 'Dominant search market share (90%+), Android ecosystem, and YouTube network effects.';
      leverage = 0.12;
      fcfMargin = 22.8;
      risks = ['Search share erosion from generative AI competitors', 'Regulatory antitrust investigations'];
      revGrowth = 11.2;
      epsGrowth = 14.5;
      roic = 19.8;
      grossMargin = 56.4;
      operatingMargin = 27.5;
      marketCap = 1750000;
      industry = 'Interactive Media';
    } else if (cleanTicker === 'RELIANCE') {
      name = 'Reliance Industries Ltd.';
      sector = 'Energy / Conglomerate';
      moatRating = 'narrow';
      moatRationale = 'Massive refining scale advantages and dominant telecom market share via Jio.';
      leverage = 0.65;
      fcfMargin = 14.2;
      risks = ['Capital expenditure drag in telecom rollout', 'Oil refining margin volatility'];
      revGrowth = 6.4;
      epsGrowth = 8.1;
      roic = 11.2;
      grossMargin = 24.5;
      operatingMargin = 12.1;
      marketCap = 210000;
      industry = 'Oil & Gas / Telecom';
    } else if (cleanTicker === 'TCS') {
      name = 'Tata Consultancy Services';
      sector = 'Technology';
      moatRating = 'wide';
      moatRationale = 'Deep integration in enterprise IT operations and low attrition capabilities.';
      leverage = 0.05;
      fcfMargin = 24.1;
      risks = ['Global enterprise IT spending slowdown', 'Wage inflation affecting operating margins'];
      revGrowth = 7.9;
      epsGrowth = 11.5;
      roic = 32.1;
      grossMargin = 41.5;
      operatingMargin = 25.4;
      marketCap = 145000;
      industry = 'IT Services';
    } else if (cleanTicker === 'TSLA') {
      name = 'Tesla, Inc.';
      sector = 'Automotive';
      moatRating = 'narrow';
      moatRationale = 'EV battery cost advantages, direct-to-consumer delivery infrastructure, and proprietary Supercharger network.';
      leverage = 0.08;
      fcfMargin = 10.5;
      risks = ['Operating margins compression from retail EV price cuts', 'Production delays of next-gen vehicles'];
      revGrowth = 18.2;
      epsGrowth = 22.4;
      roic = 14.5;
      grossMargin = 18.2;
      operatingMargin = 9.5;
      marketCap = 720000;
      industry = 'Automotive Manufacturing';
    } else if (cleanTicker === 'NVDA') {
      name = 'NVIDIA Corporation';
      sector = 'Technology';
      moatRating = 'wide';
      moatRationale = 'CUDA software platform ecosystem lock-in, advanced GPU architecture dominance.';
      leverage = 0.15;
      fcfMargin = 45.2;
      risks = ['Cyclical semiconductor spending downturns', 'Supply chain packaging bottlenecks at TSMC'];
      revGrowth = 98.4;
      epsGrowth = 124.5;
      roic = 48.2;
      grossMargin = 74.5;
      operatingMargin = 55.2;
      marketCap = 1200000;
      industry = 'Semiconductors';
    } else if (cleanTicker === 'INFY') {
      name = 'Infosys Limited';
      sector = 'Technology';
      moatRating = 'narrow';
      moatRationale = 'Strong global enterprise IT delivery model and skilled engineering base.';
      leverage = 0.08;
      fcfMargin = 19.5;
      risks = ['Offshore labor costs rising', 'Transition delays to cloud enablement services'];
      revGrowth = 6.2;
      epsGrowth = 9.5;
      roic = 26.5;
      grossMargin = 38.5;
      operatingMargin = 21.0;
      marketCap = 820000;
      industry = 'IT Services';
    } else if (cleanTicker === 'BTC') {
      name = 'Bitcoin';
      sector = 'Cryptocurrency';
      moatRating = 'wide';
      moatRationale = 'Decentralized proof-of-work security network effects and absolute digital scarcity.';
      leverage = 0.0;
      fcfMargin = 100.0;
      risks = ['Macro liquidity contractions', 'Global regulatory restrictions on mining operations'];
      revGrowth = null;
      epsGrowth = null;
      roic = null;
      grossMargin = null;
      operatingMargin = null;
      debtToEquity = null;
      marketCap = 850000;
      industry = 'Digital Currency';
    } else if (cleanTicker === 'ETH') {
      name = 'Ethereum';
      sector = 'Cryptocurrency';
      moatRating = 'wide';
      moatRationale = 'Dominant developer ecosystem, high transaction volume, and smart contract protocol lock-in.';
      leverage = 0.0;
      fcfMargin = 100.0;
      risks = ['Protocol fee competition from high-speed Layer 1 alternatives', 'Technical upgrade execution risks'];
      revGrowth = null;
      epsGrowth = null;
      roic = null;
      grossMargin = null;
      operatingMargin = null;
      debtToEquity = null;
      marketCap = 270000;
      industry = 'Smart Contract Platform';
    }

    let moatPts = 10;
    if (moatRating === 'wide') moatPts = 40;
    else if (moatRating === 'narrow') moatPts = 25;
    
    let leveragePts = 0;
    if (leverage < 0.4) leveragePts = 30;
    else if (leverage < 1.0) leveragePts = 20;
    else if (leverage < 1.8) leveragePts = 10;

    let fcfPts = 0;
    if (fcfMargin > 25) fcfPts = 30;
    else if (fcfMargin >= 15) fcfPts = 20;
    else if (fcfMargin >= 5) fcfPts = 10;

    const qualityScore = moatPts + leveragePts + fcfPts;
    const qualityRationale = `${name} has a Quality Score of ${qualityScore}/100. Breakdown - Moat: ${moatRating.toUpperCase()} (${moatPts}/40), Leverage: ${leverage.toFixed(2)} (${leveragePts}/30), FCF Margin: ${fcfMargin.toFixed(1)}% (${fcfPts}/30).`;

    const qualityBreakdown = {
      moat: { score: moatPts, max: 40, weight: 0.4, contribution: moatPts, value: moatRating.toUpperCase(), rationale: moatRationale },
      leverage: { score: leveragePts, max: 30, weight: 0.3, contribution: leveragePts, value: leverage, rationale: `Leverage ratio is ${leverage.toFixed(2)}.` },
      fcfMargin: { score: fcfPts, max: 30, weight: 0.3, contribution: fcfPts, value: fcfMargin, rationale: `Free Cash Flow Margin is ${fcfMargin.toFixed(1)}%.` }
    };

    // Dip logic
    const dipDetected = cleanTicker === 'TSLA' || cleanTicker === 'RELIANCE';
    const severityPercent = dipDetected ? -15.4 : 0;
    const zScore = dipDetected ? -2.15 : 0;
    const catalyst = dipDetected 
      ? `Recent stock movement shows unusual decline (${severityPercent.toFixed(1)}%) driven by temporary margins adjustments.` 
      : 'No unusual price decline detected.';
    const isStructural = false;

    // Classification
    let classification: 'Healthy' | 'Uncertain' | 'Dangerous' = 'Healthy';
    let classificationRationale = 'Asset is trading within standard volatility ranges.';
    
    if (dipDetected) {
      if (qualityScore >= 70 && !isStructural) {
        classification = 'Healthy';
        classificationRationale = `Transient dip detected on high quality business (Quality Score ${qualityScore}/100) with a Z-score of ${zScore.toFixed(2)}. Indicates an institutional buy-the-dip window.`;
      } else if (qualityScore < 40 || isStructural) {
        classification = 'Dangerous';
        classificationRationale = `Decline detected on low-grade asset (Quality Score ${qualityScore}/100). Elevated risk of capital impairment.`;
      } else {
        classification = 'Uncertain';
        classificationRationale = `Decline detected on mid-grade asset (Quality Score ${qualityScore}/100). Catalysts are mixed, warranting standard allocation limits.`;
      }
    }

    const timestamp = new Date().toISOString();

    return {
      ticker: cleanTicker,
      exchange: cleanExchange,
      name,
      sector,
      qualityScore,
      qualityRationale,
      qualityBreakdown,
      research: {
        moatRating,
        moatRationale,
        fundamentalHealthScore: Math.round(qualityScore),
        leverageRatio: leverage,
        freeCashFlowMargin: fcfMargin,
        majorRisks: risks,
        fundamentals: {
          revenueGrowthYoy: revGrowth,
          earningsGrowthYoy: epsGrowth,
          roic,
          grossMargin,
          operatingMargin,
          debtToEquity,
          marketCapMillions: marketCap,
          industry
        },
        updatedAt: timestamp
      },
      dip: {
        dipDetected,
        severityPercent,
        zScore,
        catalyst,
        isStructural,
        currentPrice: cleanTicker === 'AAPL' ? 182.30 : (cleanTicker === 'TSLA' ? 218.40 : 100),
        fiftyTwoWeekHigh: cleanTicker === 'AAPL' ? 199.50 : (cleanTicker === 'TSLA' ? 281.50 : 120),
        fiftyTwoWeekLow: cleanTicker === 'AAPL' ? 165.00 : (cleanTicker === 'TSLA' ? 210.00 : 90),
        ema50: cleanTicker === 'AAPL' ? 179.20 : (cleanTicker === 'TSLA' ? 235.40 : 98),
        volatility: 4.25,
        qualityScore,
        classification,
        classificationRationale,
        updatedAt: timestamp
      },
      smartMoney: {
        institutionalOwnershipPercent: null,
        netInstitutionalFlow: 'unavailable',
        accumulationScore: 12,
        optionsVolumeRatio: null,
        optionSentiment: 'unavailable',
        insiderTransactions: {
          value: null,
          source: 'Finnhub Insider Transactions API',
          timestamp,
          freshness: 'Data unavailable',
          confidence: 'none'
        },
        insiderSentiment: {
          value: null,
          source: 'Finnhub Insider Sentiment API',
          timestamp,
          freshness: 'Data unavailable',
          confidence: 'none'
        },
        optionsVolume: {
          value: null,
          source: 'Finnhub Options Volume API',
          timestamp,
          freshness: 'Data unavailable',
          confidence: 'none'
        },
        institutionalOwnership: {
          value: null,
          source: 'SEC Form 13F database',
          timestamp,
          freshness: 'Data unavailable',
          confidence: 'none'
        },
        updatedAt: timestamp
      },
      updatedAt: timestamp
    };
  }

  private static calculateMockConviction(
    userId: string,
    intel: CompanyIntelligence,
    holding: Holding | null,
    riskProfile: 'conservative' | 'moderate' | 'aggressive' = 'moderate'
  ): UserConviction {
    const weight = holding ? 10 : 0;
    
    // 1. Allocation Factor
    let rawAllocationScore = 100;
    let allocationExplanation = '';
    if (riskProfile === 'conservative') {
      const penalty = Math.max(0, Math.min(100, (weight - 10) * 10));
      rawAllocationScore = Math.round(100 - penalty);
      allocationExplanation = `Holding weight is ${weight}%. Conservative weight ceiling is 10%. Raw Allocation Score: ${rawAllocationScore}/100. Weight: 25%. Contribution: ${Math.round(rawAllocationScore * 0.25)}/25.`;
    } else {
      const diff = Math.abs(weight - 15);
      const penalty = Math.max(0, Math.min(100, diff * 6.67));
      rawAllocationScore = Math.round(100 - penalty);
      allocationExplanation = `Holding weight is ${weight}%. Target optimal weight is 15%. Raw Allocation Score: ${rawAllocationScore}/100. Weight: 25%. Contribution: ${Math.round(rawAllocationScore * 0.25)}/25.`;
    }
    const allocationContribution = Math.round(rawAllocationScore * 0.25);

    // 2. Fundamental Factor
    const rawFundamentalScore = intel.qualityScore;
    const fundamentalContribution = Math.round(rawFundamentalScore * 0.25);
    const fundamentalExplanation = `Fundamental Quality Score is ${intel.qualityScore}/100. Raw Score: ${rawFundamentalScore}/100. Weight: 25%. Contribution: ${fundamentalContribution}/25. Details: ${intel.qualityRationale}`;

    // 3. Dip Factor
    let rawDipScore = 40; // baseline
    let dipExplanation = 'No unusual dip detected. Traded asset is priced within standard deviations. Raw Score: 40/100 (baseline). Weight: 25%. Contribution: 10/25.';
    if (intel.dip.dipDetected) {
      if (intel.dip.isStructural) {
        rawDipScore = 12;
        dipExplanation = `Unusual dip detected (${intel.dip.severityPercent.toFixed(1)}%), but catalyst is STRUCTURAL (risk of structural value trap). Raw Score: 12/100. Weight: 25%. Contribution: 3/25.`;
      } else {
        if (intel.dip.zScore <= -2.0) {
          rawDipScore = 100;
          dipExplanation = `Significant transient dip deviation (Z-score ${intel.dip.zScore.toFixed(2)}, severity ${intel.dip.severityPercent.toFixed(1)}%). Optimal buying discount. Raw Score: 100/100. Weight: 25%. Contribution: 25/25.`;
        } else {
          rawDipScore = 72;
          dipExplanation = `Moderate transient dip deviation (Z-score ${intel.dip.zScore.toFixed(2)}, severity ${intel.dip.severityPercent.toFixed(1)}%). Raw Score: 72/100. Weight: 25%. Contribution: 18/25.`;
        }
      }
    }
    const dipContribution = Math.round(rawDipScore * 0.25);

    // 4. Institutional Factor
    const rawInstScore = Math.round(intel.smartMoney.accumulationScore * 4);
    const instContribution = Math.round(rawInstScore * 0.25);
    
    const instPercentText = intel.smartMoney.institutionalOwnershipPercent !== null 
      ? `${intel.smartMoney.institutionalOwnershipPercent}%` 
      : 'Data unavailable';
    const netFlowText = intel.smartMoney.netInstitutionalFlow !== 'unavailable'
      ? intel.smartMoney.netInstitutionalFlow.toUpperCase()
      : 'UNAVAILABLE';
    const optionSentimentText = intel.smartMoney.optionSentiment !== 'unavailable'
      ? intel.smartMoney.optionSentiment.toUpperCase()
      : 'UNAVAILABLE';
    const instExplanation = `Institutional holdings: ${instPercentText}. Net Flow: ${netFlowText}. Options Sentiment: ${optionSentimentText}. Raw Score: ${rawInstScore}/100. Weight: 25%. Contribution: ${instContribution}/25.`;

    const overallScore = allocationContribution + fundamentalContribution + dipContribution + instContribution;

    let rationale = `${intel.name} displays an overall Conviction Score of ${overallScore}/100 based on your ${riskProfile} risk posture. `;
    if (overallScore >= 80) {
      rationale += `High conviction allocation is supported by excellent structural quality (${intel.qualityScore}/100) and favorable accumulation indices.`;
    } else if (overallScore >= 50) {
      rationale += `Moderate conviction. The asset is fundamentally healthy but lacks deep buying discounts or options tailwinds.`;
    } else {
      rationale += `Low conviction. Elevated structural risks or aggressive net selling by institutions suggest caution.`;
    }

    return {
      userId,
      ticker: intel.ticker,
      exchange: intel.exchange,
      overallScore,
      breakdown: {
        allocationFactor: { score: rawAllocationScore, max: 100, weight: 0.25, contribution: allocationContribution, explanation: allocationExplanation },
        fundamentalFactor: { score: rawFundamentalScore, max: 100, weight: 0.25, contribution: fundamentalContribution, explanation: fundamentalExplanation },
        dipFactor: { score: rawDipScore, max: 100, weight: 0.25, contribution: dipContribution, explanation: dipExplanation },
        institutionalFactor: { score: rawInstScore, max: 100, weight: 0.25, contribution: instContribution, explanation: instExplanation }
      },
      rationale,
      updatedAt: new Date().toISOString()
    };
  }

  public static async fetchCompanyIntelligence(ticker: string, exchange = 'NASDAQ'): Promise<CompanyIntelligence | null> {
    if (authService.isMock) {
      let local = await dbService.getCompanyIntelligence(ticker, exchange);
      if (!local) {
        local = this.generateMockIntelligence(ticker, exchange);
        try {
          await dbService.saveCompanyIntelligence(local);
        } catch (e) {
          console.warn('Failed to save company intelligence to local cache:', e);
        }
      }
      return local;
    }

    try {
      const res = await this.fetchWithAuth(`api/intelligence/company?symbol=${encodeURIComponent(ticker)}&exchange=${encodeURIComponent(exchange)}`);
      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      console.warn(`Endpoint failed for ${ticker}. Falling back to client-side compilation:`, err);
      let local = await dbService.getCompanyIntelligence(ticker, exchange);
      if (!local) {
        local = this.generateMockIntelligence(ticker, exchange);
        try {
          await dbService.saveCompanyIntelligence(local);
        } catch (e) {
          console.warn('Failed to save fallback company intelligence to db:', e);
        }
      }
      return local;
    }
  }

  public static async recalculateConviction(ticker: string, exchange = 'NASDAQ'): Promise<UserConviction | null> {
    const user = authService.getCurrentUser ? authService.getCurrentUser() : null;
    const mockUid = user?.uid || 'mock_anonymous';

    if (authService.isMock) {
      const intel = await this.fetchCompanyIntelligence(ticker, exchange);
      if (!intel) return null;
      
      const holdings = await dbService.getHoldings(mockUid);
      const targetHolding = holdings.find(h => h.ticker.toUpperCase() === ticker.toUpperCase() && h.exchange.toUpperCase() === exchange.toUpperCase());
      
      const profile = await dbService.getUserProfile(mockUid);
      const risk = profile?.riskProfile || 'moderate';

      const conv = this.calculateMockConviction(mockUid, intel, targetHolding || null, risk);
      try {
        await dbService.saveUserConviction(conv);
      } catch (e) {
        console.warn('Failed to save conviction in local cache:', e);
      }
      return conv;
    }

    try {
      const res = await this.fetchWithAuth('api/intelligence/recalculate-conviction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker, exchange })
      });
      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      console.warn(`Recalculate endpoint failed. Compiling conviction locally:`, err);
      const intel = await this.fetchCompanyIntelligence(ticker, exchange);
      if (!intel) return null;
      
      const holdings = await dbService.getHoldings(mockUid);
      const targetHolding = holdings.find(h => h.ticker.toUpperCase() === ticker.toUpperCase() && h.exchange.toUpperCase() === exchange.toUpperCase());
      
      const profile = await dbService.getUserProfile(mockUid);
      const risk = profile?.riskProfile || 'moderate';

      const conv = this.calculateMockConviction(mockUid, intel, targetHolding || null, risk);
      try {
        await dbService.saveUserConviction(conv);
      } catch (e) {
        console.warn('Failed to save fallback conviction to db:', e);
      }
      return conv;
    }
  }

  public static async fetchAllConvictions(): Promise<UserConviction[]> {
    const user = authService.getCurrentUser ? authService.getCurrentUser() : null;
    const mockUid = user?.uid || 'mock_anonymous';

    if (authService.isMock) {
      return await dbService.getAllUserConvictions(mockUid);
    }

    try {
      const res = await this.fetchWithAuth('api/intelligence/convictions');
      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      console.warn(`Listing convictions failed. Pulling from local store:`, err);
      return await dbService.getAllUserConvictions(mockUid);
    }
  }

  private static buildCaseStudyNarrative(conceptId: string, intel: CompanyIntelligence): string {
    let dynamicNarrative = '';
    if (conceptId === 'operating_leverage') {
      const gm = intel.research.fundamentals?.grossMargin;
      const om = intel.research.fundamentals?.operatingMargin;
      const gmText = gm !== null && gm !== undefined ? `${gm.toFixed(1)}%` : 'strong';
      const omText = om !== null && om !== undefined ? `${om.toFixed(1)}%` : 'healthy';
      dynamicNarrative = `${intel.name} illustrates operating leverage in the ${intel.sector} sector. With a gross margin of ${gmText} and an operating margin of ${omText}, unit economics are highly favorable. As sales expand, fixed costs (such as research and development and infrastructure) remain stable, driving operating profits to expand much faster than top-line revenues.`;
    } else if (conceptId === 'economic_moats') {
      const roic = intel.research.fundamentals?.roic;
      const roicText = roic !== null && roic !== undefined ? `${roic.toFixed(1)}%` : 'strong';
      dynamicNarrative = `${intel.name}'s competitive advantage is evaluated as a "${intel.research.moatRating.toUpperCase()}" moat, backed by ROIC of ${roicText}. Qualitative assessment shows: ${intel.research.moatRationale}. High moat profiles allow companies to defend their profit margins against competitive duplication, leading to sustained high returns on capital.`;
    } else if (conceptId === 'free_cash_flow_margin') {
      const rg = intel.research.fundamentals?.revenueGrowthYoy;
      const eg = intel.research.fundamentals?.earningsGrowthYoy;
      const rgText = rg !== null && rg !== undefined ? `+${rg.toFixed(1)}% YoY` : 'steady growth';
      const egText = eg !== null && eg !== undefined ? `+${eg.toFixed(1)}% YoY` : 'steady expansion';
      dynamicNarrative = `${intel.name} converts revenue to deployable cash with a Free Cash Flow (FCF) margin of ${intel.research.freeCashFlowMargin.toFixed(1)}%, backed by YoY revenue growth of ${rgText} and earnings growth of ${egText}. This high conversion indicates low capital intensity, allowing ${intel.name} to self-fund expansion, pay down leverage, or return cash to owners.`;
    } else if (conceptId === 'financial_solvency') {
      const de = intel.research.fundamentals?.debtToEquity !== null && intel.research.fundamentals?.debtToEquity !== undefined 
        ? intel.research.fundamentals.debtToEquity 
        : intel.research.leverageRatio;
      dynamicNarrative = `Evaluating ${intel.name}'s balance sheet solvency showing a Debt/Equity ratio of ${de.toFixed(2)}. In general, leverage ratios below 0.50 indicate conservative capital structure and strong safety buffers. This profile reduces insolvency risks during macro rate-hiking cycles, assuring structural stability.`;
    }
    return dynamicNarrative;
  }

  public static async fetchBusinessSchoolCase(conceptId: string, symbol: string, exchange = 'NASDAQ'): Promise<any> {
    const CONCEPTS: Record<string, { name: string; definition: string; equation: string }> = {
      operating_leverage: {
        name: 'Operating Leverage',
        definition: 'A measure of how revenue growth translates into growth in operating income based on the ratio of fixed vs variable costs.',
        equation: 'Operating Leverage = % Change in EBIT / % Change in Revenue'
      },
      economic_moats: {
        name: 'Economic Moats',
        definition: 'A business\'s ability to maintain a competitive advantage over its competitors to protect its long-term profits and market share.',
        equation: 'Moat Strength = High Return on Invested Capital (ROIC) vs Cost of Capital (WACC)'
      },
      free_cash_flow_margin: {
        name: 'Free Cash Flow Margin',
        definition: 'The percentage of revenue that a company converts into free cash flow, representing true deployable cash profits.',
        equation: 'FCF Margin = Free Cash Flow / Revenue'
      },
      financial_solvency: {
        name: 'Leverage & Financial Solvency',
        definition: 'Evaluating a company\'s debt burden relative to its equity capitalization to measure structural insolvency risk.',
        equation: 'Leverage Ratio = Total Debt / Total Equity'
      }
    };

    const concept = CONCEPTS[conceptId];
    if (!concept) return null;

    if (authService.isMock) {
      const intel = await this.fetchCompanyIntelligence(symbol, exchange);
      if (!intel) return null;

      const dynamicNarrative = this.buildCaseStudyNarrative(conceptId, intel);

      return {
        conceptId,
        conceptName: concept.name,
        definition: concept.definition,
        equation: concept.equation,
        companyExample: symbol.toUpperCase(),
        companyName: intel.name,
        caseStudyNarrative: dynamicNarrative,
        updatedAt: new Date().toISOString()
      };
    }

    try {
      const res = await this.fetchWithAuth(`api/intelligence/business-school/case?conceptId=${encodeURIComponent(conceptId)}&symbol=${encodeURIComponent(symbol)}&exchange=${encodeURIComponent(exchange)}`);
      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      console.warn(`Business School Case study fetch failed, rendering locally:`, err);
      const intel = await this.fetchCompanyIntelligence(symbol, exchange);
      if (!intel) return null;

      const dynamicNarrative = this.buildCaseStudyNarrative(conceptId, intel);

      return {
        conceptId,
        conceptName: concept.name,
        definition: concept.definition,
        equation: concept.equation,
        companyExample: symbol.toUpperCase(),
        companyName: intel.name,
        caseStudyNarrative: dynamicNarrative,
        updatedAt: new Date().toISOString()
      };
    }
  }
}

export default IntelligenceService;

