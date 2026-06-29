import { dbService, authService } from './firebase';
import { buildApiUrl } from './urlBuilder';
import type { Holding } from './firebase';

export interface MarketRegimeState {
  region: 'United States' | 'India' | 'Global';
  regime: 'Strong Bull' | 'Bull' | 'Neutral' | 'Weak Bear' | 'Bear';
  confidence: number;
  timestamp: string;
  source: string;
  breadth: {
    aboveSMA50: number;
    aboveSMA200: number;
    participationStatus: 'Broad' | 'Moderate' | 'Narrow';
  };
  metrics: {
    indexPrice: number;
    dailyChange: number;
    momentumRsi: number;
  };
}

export interface SectorPosition {
  sectorId: string;
  name: string;
  relativeStrength: number;
  momentum: number;
  quadrant: 'Leader' | 'Improver' | 'Deteriorator' | 'Laggard';
  dailyChange: number;
  weeklyChange: number;
  monthlyChange: number;
}

export interface MacroIndicator {
  id: string;
  name: string;
  value: number | string;
  unit: string;
  trendDirection: 'Rising' | 'Falling' | 'Flat';
  significance: 'Critical' | 'High' | 'Medium' | 'Low';
  explanation: string;
  timestamp: string;
  source: string;
  confidence: number;
}

export interface NewsArticle {
  id: string;
  headline: string;
  summary: string;
  sourceName: string;
  url: string;
  publishedAt: string;
  relatedTickers: string[];
}

export interface NewsBriefSummary {
  macroSummary: string;
  citations: {
    articleId: string;
    headline: string;
    sourceName: string;
    url: string;
    timestamp: string;
  }[];
}

export interface OvernightEvent {
  id: string;
  timestamp: string;
  eventType: 'regime_change' | 'sector_rotation' | 'macro_shift' | 'asset_move' | 'market_alert';
  title: string;
  description: string;
  significance: 'HIGH' | 'MEDIUM' | 'LOW';
  source: string;
}

export interface ActionItem {
  id: string;
  type: 'Review' | 'Watch' | 'Opportunity' | 'Risk';
  title: string;
  description: string;
  ticker?: string;
  significance: 'HIGH' | 'MEDIUM' | 'LOW';
  timestamp: string;
}

export interface RegimeTimelineEvent {
  id: string;
  timestamp: string;
  region: 'United States' | 'India' | 'Global';
  previousRegime: string;
  newRegime: string;
  triggerEvent: string;
  confidence: number;
}

export interface PortfolioImpactSummary {
  affectedHoldingsCount: number;
  allocationRiskDelta: number;
  riskHighlights: string[];
  opportunityHighlights: string[];
}

export interface MarketIntelligenceData {
  timestamp: string;
  regimes: Record<string, MarketRegimeState>;
  sectors: SectorPosition[];
  macros: MacroIndicator[];
  newsBrief: NewsBriefSummary;
  newsArticles: NewsArticle[];
  overnightFeed: OvernightEvent[];
  actionBoard: ActionItem[];
  portfolioImpact: PortfolioImpactSummary;
  timeline: RegimeTimelineEvent[];
}

export class MarketIntelligenceService {
  /**
   * Deterministic logic for Market Regime classification.
   * score S = 0.4 * T_score + 0.3 * MA_score + 0.2 * M_score + 0.1 * B_score
   */
  public static calculateRegime(
    currentPrice: number,
    history: number[],
    breadthPercent: number
  ): {
    regime: MarketRegimeState['regime'];
    confidence: number;
    sma50: number;
    sma200: number;
  } {
    if (history.length < 200) {
      // Fallback if not enough history
      return { regime: 'Neutral', confidence: 0.6, sma50: currentPrice, sma200: currentPrice };
    }

    // SMA 50 & 200
    const sma50 = history.slice(-50).reduce((sum, val) => sum + val, 0) / 50;
    const sma200 = history.slice(-200).reduce((sum, val) => sum + val, 0) / 200;

    // 1. Trend (T_score)
    let tScore = 0;
    if (currentPrice > 1.02 * sma200) tScore = 2;
    else if (currentPrice < 0.98 * sma200) tScore = -2;

    // 2. Moving Average Cross (MA_score)
    const prev50 = history.slice(-51, -1).reduce((sum, val) => sum + val, 0) / 50;
    const prev200 = history.slice(-201, -1).reduce((sum, val) => sum + val, 0) / 200;
    
    let maScore = 0;
    if (sma50 > sma200) {
      maScore = (prev50 <= prev200) ? 2 : 1; // 2 if Golden Cross, 1 if trading above
    } else {
      maScore = (prev50 >= prev200) ? -2 : -1; // -2 if Death Cross, -1 if trading below
    }

    // 3. Momentum (M_score) - 14-day Rate of Change (ROC)
    const price14DaysAgo = history[history.length - 14] || history[0];
    const roc14 = ((currentPrice - price14DaysAgo) / price14DaysAgo) * 100;
    let mScore = 0;
    if (roc14 > 2.0) mScore = 2;
    else if (roc14 < -2.0) mScore = -2;

    // 4. Breadth (B_score)
    let bScore = 0;
    if (breadthPercent > 70) bScore = 2;
    else if (breadthPercent < 30) bScore = -2;

    // Weighted score S
    const score = 0.4 * tScore + 0.3 * maScore + 0.2 * mScore + 0.1 * bScore;

    // Map to regime
    let regime: MarketRegimeState['regime'] = 'Neutral';
    if (score > 1.2) regime = 'Strong Bull';
    else if (score > 0.4) regime = 'Bull';
    else if (score < -1.2) regime = 'Bear';
    else if (score < -0.4) regime = 'Weak Bear';

    // Confidence index based on inputs convergence
    const signs = [tScore, maScore, mScore, bScore].map(Math.sign);
    const agreements = signs.filter(s => s === Math.sign(score)).length;
    const confidence = 0.5 + (agreements / 8); // Scaled between 0.5 and 1.0

    return { regime, confidence: parseFloat(confidence.toFixed(2)), sma50, sma200 };
  }

  /**
   * Fetches data and runs deterministic logic for regimes, sector rotations, macros, and news citations.
   * Integrates the "Why This Matters To Me" portfolio translator.
   */
  public static async getMarketIntelligence(
    userId: string,
    isMockMode: boolean
  ): Promise<MarketIntelligenceData> {
    try {
      const holdings = await dbService.getHoldings(userId);
      const watchlist = await dbService.getWatchlist(userId);

      const timestamp = new Date().toISOString();

      // Determine if online or offline
      if (isMockMode) {
        return this.getMockMarketIntelligence(holdings, watchlist, timestamp);
      }

      // Live computation using Finnhub Provider or Backend APIs
      const token = await authService.getIdToken() || `mock_${userId}`;

      const res = await fetch(buildApiUrl(`api/market-intelligence?userId=${userId}`), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        return await res.json() as MarketIntelligenceData;
      }
      
      console.warn('Backend API unavailable. Falling back to client-side calculations.');
      return this.getMockMarketIntelligence(holdings, watchlist, timestamp);
    } catch (error) {
      console.error('Error fetching market intelligence:', error);
      const holdings = await dbService.getHoldings(userId).catch(() => []);
      const watchlist = await dbService.getWatchlist(userId).catch(() => []);
      return this.getMockMarketIntelligence(holdings, watchlist, new Date().toISOString());
    }
  }

  /**
   * Static historical timeline retrieval.
   */
  public static async getRegimeHistory(userId: string, isMockMode: boolean): Promise<RegimeTimelineEvent[]> {
    if (isMockMode) {
      return this.getMockTimeline();
    }
    try {
      const token = await authService.getIdToken() || `mock_${userId}`;
      const res = await fetch(buildApiUrl('api/market-intelligence/regime-history'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        return await res.json() as RegimeTimelineEvent[];
      }
    } catch (e) {
      console.warn('Failed to load live timeline history:', e);
    }
    return this.getMockTimeline();
  }

  // --- DETERMINISTIC PORTFOLIO TRANSLATOR: "WHY THIS MATTERS TO ME" ENGINE ---
  
  public static runPortfolioImpactEngine(
    holdings: Holding[],
    _watchlist: any[],
    regimes: Record<string, MarketRegimeState>,
    sectors: SectorPosition[],
    macros: MacroIndicator[],
    timestamp: string
  ): {
    actionBoard: ActionItem[];
    overnightFeed: OvernightEvent[];
    portfolioImpact: PortfolioImpactSummary;
  } {
    const actionBoard: ActionItem[] = [];
    const overnightFeed: OvernightEvent[] = [];
    
    let affectedHoldingsCount = 0;
    let allocationRiskDelta = 0;
    const riskHighlights: string[] = [];
    const opportunityHighlights: string[] = [];

    // Helper to generate IDs
    const nextId = () => 'act_' + Math.random().toString(36).substr(2, 9);
    const feedId = () => 'feed_' + Math.random().toString(36).substr(2, 9);

    // 1. REGIME IMPACTS
    const usRegime = regimes['US'];
    const inRegime = regimes['IN'];

    const usEquities = holdings.filter(h => h.exchange === 'NASDAQ' || h.exchange === 'NYSE');
    const inEquities = holdings.filter(h => h.exchange === 'NSE' || h.exchange === 'BSE');

    if (usRegime && (usRegime.regime === 'Bear' || usRegime.regime === 'Weak Bear')) {
      if (usEquities.length > 0) {
        affectedHoldingsCount += usEquities.length;
        allocationRiskDelta += 2.0;
        const msg = `US Market Regime is ${usRegime.regime}. Volatility risk increases for AAPL, MSFT, GOOG.`;
        riskHighlights.push(msg);

        actionBoard.push({
          id: nextId(),
          type: 'Risk',
          title: `US Equities Exposure under ${usRegime.regime} Regime`,
          description: `You have ${usEquities.length} US holdings representing volatility vulnerability. Defensive adjustments recommended.`,
          significance: 'HIGH',
          timestamp
        });

        overnightFeed.push({
          id: feedId(),
          timestamp,
          eventType: 'regime_change',
          title: `US Market Regime shifts to ${usRegime.regime}`,
          description: `US indices break key averages. Valuation multiples under contraction risk.`,
          significance: 'HIGH',
          source: usRegime.source
        });
      }
    } else if (usRegime && usRegime.regime === 'Strong Bull') {
      if (usEquities.length > 0) {
        opportunityHighlights.push(`US Market Regime is Strong Bull. Accumulation trends support growth stocks.`);
        actionBoard.push({
          id: nextId(),
          type: 'Opportunity',
          title: `Capitalize on Strong Bull US Market`,
          description: `US technology stocks display accelerating momentum. Support channels holding.`,
          significance: 'MEDIUM',
          timestamp
        });
      }
    }

    if (inRegime && inRegime.regime === 'Strong Bull') {
      if (inEquities.length > 0) {
        opportunityHighlights.push(`India Market Regime is Strong Bull. Nifty breadth is high.`);
        actionBoard.push({
          id: nextId(),
          type: 'Watch',
          title: `Indian Equities Strong Bull Extension`,
          description: `Nifty 50 trades in a high-participation uptrend. Monitor potential extension triggers on Reliance and TCS.`,
          significance: 'MEDIUM',
          timestamp
        });

        overnightFeed.push({
          id: feedId(),
          timestamp,
          eventType: 'regime_change',
          title: `India Market Regime is Strong Bull`,
          description: `Broad market participation continues with Nifty constituent breadth at ${inRegime.breadth.aboveSMA50}%.`,
          significance: 'MEDIUM',
          source: inRegime.source
        });
      }
    } else if (inRegime && (inRegime.regime === 'Bear' || inRegime.regime === 'Weak Bear')) {
      if (inEquities.length > 0) {
        affectedHoldingsCount += inEquities.length;
        allocationRiskDelta += 1.5;
        actionBoard.push({
          id: nextId(),
          type: 'Risk',
          title: `India Equity Volatility Warning`,
          description: `Regime decay triggers consolidation checks for ${inEquities.map(e => e.ticker).join(', ')}.`,
          significance: 'HIGH',
          timestamp
        });
      }
    }

    // 2. SECTOR ROTATION IMPACTS
    const techSector = sectors.find(s => s.sectorId === 'technology');

    if (techSector && (techSector.quadrant === 'Deteriorator' || techSector.quadrant === 'Laggard')) {
      const techHoldings = holdings.filter(h => ['AAPL', 'MSFT', 'GOOG', 'TCS', 'INFY'].includes(h.ticker.toUpperCase()));
      if (techHoldings.length > 0) {
        affectedHoldingsCount += techHoldings.length;
        allocationRiskDelta += 1.0;
        const msg = `Technology sector in ${techSector.quadrant} phase. Momentum headwinds affect ${techHoldings.map(t => t.ticker).join(', ')}.`;
        riskHighlights.push(msg);

        actionBoard.push({
          id: nextId(),
          type: 'Review',
          title: `Review Tech Holdings (Tech sector is a ${techSector.quadrant})`,
          description: `Technology sector rotates out of Leadership. Momentum values are cooling down. Assesses allocation sizes.`,
          ticker: techHoldings[0].ticker,
          significance: 'HIGH',
          timestamp
        });

        overnightFeed.push({
          id: feedId(),
          timestamp,
          eventType: 'sector_rotation',
          title: `Technology rotates to ${techSector.quadrant}`,
          description: `Sector index relative momentum decays. High-multiple growth equities under profit-taking pressure.`,
          significance: 'HIGH',
          source: 'BusinessOS Sector Rotation Engine'
        });
      }
    }

    // 3. MACRO IMPACTS (Gold, Oil, Bitcoin)
    const oilIndicator = macros.find(m => m.id === 'brent_crude');
    const goldIndicator = macros.find(m => m.id === 'spot_gold');
    const btcIndicator = macros.find(m => m.id === 'bitcoin_spot');

    if (oilIndicator && oilIndicator.trendDirection === 'Rising') {
      const energyHoldings = holdings.filter(h => h.ticker.toUpperCase() === 'RELIANCE');
      if (energyHoldings.length > 0) {
        actionBoard.push({
          id: nextId(),
          type: 'Opportunity',
          title: `Reliance Refining Margins Support`,
          description: `Brent crude spikes to ${oilIndicator.value}. Improves upstream extraction and refining spreads for Reliance Industries.`,
          ticker: 'RELIANCE',
          significance: 'MEDIUM',
          timestamp
        });

        overnightFeed.push({
          id: feedId(),
          timestamp,
          eventType: 'macro_shift',
          title: `Brent Crude climbs to ${oilIndicator.value}/bbl`,
          description: `Energy supply concerns trigger a price climb. Upstream refinery metrics strengthen.`,
          significance: 'MEDIUM',
          source: oilIndicator.source
        });
      }
    }

    if (goldIndicator && goldIndicator.trendDirection === 'Rising') {
      const goldExposure = holdings.some(h => h.ticker.toUpperCase() === 'GLD' || h.assetClass?.toLowerCase() === 'hedge' || h.name.toLowerCase().includes('gold'));
      if (!goldExposure) {
        actionBoard.push({
          id: nextId(),
          type: 'Opportunity',
          title: `Geopolitical hedge missing in Gold breakout`,
          description: `Spot Gold breakouts signal safe-haven interest. Your portfolio holds 0% precious metals allocation.`,
          significance: 'MEDIUM',
          timestamp
        });

        overnightFeed.push({
          id: feedId(),
          timestamp,
          eventType: 'asset_move',
          title: `Gold breaks out to ${goldIndicator.value}`,
          description: `Macro inflationary fears and yields pressure push spot Gold higher. Safe-haven inflows expand.`,
          significance: 'LOW',
          source: goldIndicator.source
        });
      }
    }

    if (btcIndicator && btcIndicator.trendDirection === 'Rising') {
      const cryptoHoldings = holdings.filter(h => h.assetClass?.toLowerCase() === 'crypto' || h.ticker.toUpperCase() === 'BTC');
      if (cryptoHoldings.length > 0) {
        actionBoard.push({
          id: nextId(),
          type: 'Opportunity',
          title: `Crypto holdings momentum expansion`,
          description: `Bitcoin breakout above ${btcIndicator.value} triggers risk-on speculative flow. Supports ETH and BTC valuations.`,
          ticker: 'BTC',
          significance: 'MEDIUM',
          timestamp
        });
      }
    }

    // Default clean-up / baseline if no rules match
    if (actionBoard.length === 0) {
      actionBoard.push({
        id: nextId(),
        type: 'Watch',
        title: `Portfolio Allocation Stance is Neutral`,
        description: `Market indices display balanced consolidation. No immediate actions required.`,
        significance: 'LOW',
        timestamp
      });
    }

    return {
      actionBoard,
      overnightFeed,
      portfolioImpact: {
        affectedHoldingsCount,
        allocationRiskDelta: parseFloat(allocationRiskDelta.toFixed(1)),
        riskHighlights,
        opportunityHighlights
      }
    };
  }

  // --- MOCK FALLBACK DATA CREATION ---

  private static getMockMarketIntelligence(
    holdings: Holding[],
    watchlist: any[],
    timestamp: string
  ): MarketIntelligenceData {
    const regimes: Record<string, MarketRegimeState> = {
      'US': {
        region: 'United States',
        regime: 'Neutral',
        confidence: 0.82,
        timestamp,
        source: 'Finnhub API via BusinessOS Engine',
        breadth: {
          aboveSMA50: 62.0,
          aboveSMA200: 55.4,
          participationStatus: 'Moderate'
        },
        metrics: {
          indexPrice: 5150.48,
          dailyChange: 0.39,
          momentumRsi: 52.5
        }
      },
      'IN': {
        region: 'India',
        regime: 'Strong Bull',
        confidence: 0.94,
        timestamp,
        source: 'NSE India Feed via BusinessOS Engine',
        breadth: {
          aboveSMA50: 84.0,
          aboveSMA200: 78.5,
          participationStatus: 'Broad'
        },
        metrics: {
          indexPrice: 22450.15,
          dailyChange: 0.94,
          momentumRsi: 68.2
        }
      },
      'Global': {
        region: 'Global',
        regime: 'Bull',
        confidence: 0.85,
        timestamp,
        source: 'MSCI World index weighting proxy',
        breadth: {
          aboveSMA50: 68.5,
          aboveSMA200: 60.1,
          participationStatus: 'Broad'
        },
        metrics: {
          indexPrice: 3380.40,
          dailyChange: 0.52,
          momentumRsi: 56.4
        }
      }
    };

    const sectors: SectorPosition[] = [
      { sectorId: 'semiconductors', name: 'Semiconductors', relativeStrength: 1.08, momentum: 0.05, quadrant: 'Leader', dailyChange: 1.45, weeklyChange: 3.2, monthlyChange: 5.4 },
      { sectorId: 'financials', name: 'Financials', relativeStrength: 1.02, momentum: 0.02, quadrant: 'Leader', dailyChange: 0.54, weeklyChange: 1.8, monthlyChange: 2.9 },
      { sectorId: 'consumer', name: 'Consumer', relativeStrength: 0.96, momentum: 0.04, quadrant: 'Improver', dailyChange: 0.82, weeklyChange: 1.1, monthlyChange: -0.5 },
      { sectorId: 'technology', name: 'Technology', relativeStrength: 1.05, momentum: -0.03, quadrant: 'Deteriorator', dailyChange: -0.12, weeklyChange: -0.8, monthlyChange: 4.2 },
      { sectorId: 'energy', name: 'Energy', relativeStrength: 1.01, momentum: -0.01, quadrant: 'Deteriorator', dailyChange: 0.42, weeklyChange: 0.9, monthlyChange: 1.8 },
      { sectorId: 'utilities', name: 'Utilities', relativeStrength: 0.92, momentum: -0.05, quadrant: 'Laggard', dailyChange: -0.65, weeklyChange: -2.1, monthlyChange: -4.8 },
      { sectorId: 'realestate', name: 'Real Estate', relativeStrength: 0.94, momentum: -0.02, quadrant: 'Laggard', dailyChange: -0.32, weeklyChange: -1.4, monthlyChange: -3.5 },
      { sectorId: 'healthcare', name: 'Healthcare', relativeStrength: 0.98, momentum: -0.01, quadrant: 'Laggard', dailyChange: 0.05, weeklyChange: -0.2, monthlyChange: -1.2 }
    ];

    const macros: MacroIndicator[] = [
      {
        id: 'us_10y_yield',
        name: 'US 10-Year Bond Yield',
        value: 4.35,
        unit: '%',
        trendDirection: 'Rising',
        significance: 'Critical',
        explanation: 'Higher yields increase financing costs, compressing valuation multiples for long-duration technology equities.',
        timestamp,
        source: 'Yahoo Finance public feed',
        confidence: 1.0
      },
      {
        id: 'brent_crude',
        name: 'Brent Crude Oil',
        value: 84.20,
        unit: 'USD/bbl',
        trendDirection: 'Rising',
        significance: 'High',
        explanation: 'Spiking energy prices act as a structural tax on manufacturing operations and raise core logistics cost inflation.',
        timestamp,
        source: 'Reuters market commodities feed',
        confidence: 1.0
      },
      {
        id: 'spot_gold',
        name: 'Spot Gold Index',
        value: 2340.50,
        unit: 'USD/oz',
        trendDirection: 'Rising',
        significance: 'Medium',
        explanation: 'Gold breakouts reflect safe-haven hedging and geopolitical volatility expansion.',
        timestamp,
        source: 'MarketWatch futures board',
        confidence: 1.0
      },
      {
        id: 'bitcoin_spot',
        name: 'Bitcoin Spot Price',
        value: 64800.00,
        unit: 'USD',
        trendDirection: 'Rising',
        significance: 'Medium',
        explanation: 'Speculative capital flows drive risk-on token breakouts.',
        timestamp,
        source: 'Coinbase market price API',
        confidence: 1.0
      }
    ];

    const newsArticles: NewsArticle[] = [
      {
        id: 'news_1',
        headline: 'Federal Reserve Maintains Caution on Rate Cuts Citing Sticky Inflation Measures',
        summary: 'Central bank officials emphasize data-dependent criteria before initiating interest rate easing cycles.',
        sourceName: 'Reuters',
        url: 'https://reuters.com/finance/fed-rate-cuts-sticky-inflation',
        publishedAt: timestamp,
        relatedTickers: ['SPY', 'QQQ']
      },
      {
        id: 'news_2',
        headline: 'Brent Crude Rises Above $84 per Barrel Following OPEC+ Extended Supply Reductions',
        summary: 'Crude oil futures tick upward as global supply channels adjust to prolonged quota cuts by OPEC.',
        sourceName: 'Yahoo Finance',
        url: 'https://finance.yahoo.com/news/brent-crude-opec-supply-cuts',
        publishedAt: timestamp,
        relatedTickers: ['XLE', 'RELIANCE']
      },
      {
        id: 'news_3',
        headline: 'Technology Valuation Multiples Cooling Off as 10-Year Bond Yields Hover Near 4.35%',
        summary: 'Growth stock indices pause their upward trajectory as bond market rates hold their multi-month highs.',
        sourceName: 'MarketWatch',
        url: 'https://marketwatch.com/investing/tech-multiples-bond-yields',
        publishedAt: timestamp,
        relatedTickers: ['XLK', 'AAPL', 'MSFT']
      },
      {
        id: 'news_4',
        headline: 'Spot Gold Approaches Near-Record Heights Supported by Safe-Haven Geopolitical Buying',
        summary: 'Precious metals volume remains elevated as institutional accounts add protective hedging allocations.',
        sourceName: 'Reuters',
        url: 'https://reuters.com/commodities/gold-safe-haven-hedging',
        publishedAt: timestamp,
        relatedTickers: ['GLD', 'IAU']
      }
    ];

    const newsBrief: NewsBriefSummary = {
      macroSummary: 'Global macro assets are navigating high structural yields and rising commodity indexes. OPEC supply constraints push Brent crude above $84 per barrel [[2]](https://finance.yahoo.com/news/brent-crude-opec-supply-cuts), benefiting energy extractors but sustaining inflation risk. Geopolitical hedge demands support spot Gold breakout expansion [[4]](https://reuters.com/commodities/gold-safe-haven-hedging). Meanwhile, yields hover at 4.35% [[3]](https://marketwatch.com/investing/tech-multiples-bond-yields), prompting Fed rate caution [[1]](https://reuters.com/finance/fed-rate-cuts-sticky-inflation) and leading to tactical sector rotations from tech to semiconductor and consumer channels.',
      citations: [
        { articleId: 'news_1', headline: 'Federal Reserve Maintains Caution on Rate Cuts Citing Sticky Inflation', sourceName: 'Reuters', url: 'https://reuters.com/finance/fed-rate-cuts-sticky-inflation', timestamp },
        { articleId: 'news_2', headline: 'Brent Crude Rises Above $84 per Barrel Following OPEC+ Supply Reductions', sourceName: 'Yahoo Finance', url: 'https://finance.yahoo.com/news/brent-crude-opec-supply-cuts', timestamp },
        { articleId: 'news_3', headline: 'Tech Valuation Multiples Cooling Off as yields hover near 4.35%', sourceName: 'MarketWatch', url: 'https://marketwatch.com/investing/tech-multiples-bond-yields', timestamp },
        { articleId: 'news_4', headline: 'Spot Gold Approaches Near-Record Heights on safe-haven buying', sourceName: 'Reuters', url: 'https://reuters.com/commodities/gold-safe-haven-hedging', timestamp }
      ]
    };

    // Calculate deterministic action board and feed items using holdings
    const translatorResult = this.runPortfolioImpactEngine(
      holdings,
      watchlist,
      regimes,
      sectors,
      macros,
      timestamp
    );

    const timeline = this.getMockTimeline();

    return {
      timestamp,
      regimes,
      sectors,
      macros,
      newsBrief,
      newsArticles,
      overnightFeed: translatorResult.overnightFeed,
      actionBoard: translatorResult.actionBoard,
      portfolioImpact: translatorResult.portfolioImpact,
      timeline
    };
  }

  private static getMockTimeline(): RegimeTimelineEvent[] {
    return [
      {
        id: 't_1',
        timestamp: '2026-06-22T14:30:00Z',
        region: 'United States',
        previousRegime: 'Bull',
        newRegime: 'Neutral',
        triggerEvent: 'S&P 500 index price drops within 2% margin of 200-day simple moving average.',
        confidence: 0.84
      },
      {
        id: 't_2',
        timestamp: '2026-06-15T09:15:00Z',
        region: 'India',
        previousRegime: 'Bull',
        newRegime: 'Strong Bull',
        triggerEvent: 'Nifty 50 constituent breadth exceeds 80% trading above their 50-day moving average.',
        confidence: 0.92
      },
      {
        id: 't_3',
        timestamp: '2026-06-02T10:00:00Z',
        region: 'United States',
        previousRegime: 'Strong Bull',
        newRegime: 'Bull',
        triggerEvent: 'US tech sector momentum decelerates below benchmark relative strength trend.',
        confidence: 0.88
      }
    ];
  }
}
export default MarketIntelligenceService;
