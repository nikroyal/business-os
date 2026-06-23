import { dbService } from './firebase';
import type { Holding, WatchlistItem, DailyReport, Opportunity } from './firebase';
import IntelligenceService from './intelligenceService';

export class SampleDataService {
  /**
   * Loads a comprehensive, realistic diversified portfolio and associated mock data for the user.
   */
  public static async loadSampleData(userId: string): Promise<void> {
    // 1. Realistic holdings
    const sampleHoldings: Omit<Holding, 'id' | 'userId' | 'createdAt' | 'updatedAt'>[] = [
      {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        ticker: 'AAPL',
        exchange: 'NASDAQ',
        assetClass: 'Equity',
        currency: 'USD',
        quantity: 45,
        purchasePrice: 172.50,
        purchaseDate: '2025-10-15',
        currentPrice: 182.30
      },
      {
        symbol: 'MSFT',
        name: 'Microsoft Corporation',
        ticker: 'MSFT',
        exchange: 'NASDAQ',
        assetClass: 'Equity',
        currency: 'USD',
        quantity: 25,
        purchasePrice: 345.00,
        purchaseDate: '2025-11-02',
        currentPrice: 388.50
      },
      {
        symbol: 'GOOG',
        name: 'Alphabet Inc.',
        ticker: 'GOOG',
        exchange: 'NASDAQ',
        assetClass: 'Equity',
        currency: 'USD',
        quantity: 35,
        purchasePrice: 128.00,
        purchaseDate: '2025-12-10',
        currentPrice: 142.10
      },
      {
        symbol: 'RELIANCE',
        name: 'Reliance Industries Ltd.',
        ticker: 'RELIANCE',
        exchange: 'NSE',
        assetClass: 'Equity',
        currency: 'INR',
        quantity: 80,
        purchasePrice: 2280.00,
        purchaseDate: '2025-09-20',
        currentPrice: 2450.00
      },
      {
        symbol: 'TCS',
        name: 'Tata Consultancy Services',
        ticker: 'TCS',
        exchange: 'NSE',
        assetClass: 'Equity',
        currency: 'INR',
        quantity: 40,
        purchasePrice: 3350.00,
        purchaseDate: '2025-10-05',
        currentPrice: 3520.00
      },
      {
        symbol: 'BTC',
        name: 'Bitcoin',
        ticker: 'BTC',
        exchange: 'CRYPTO',
        assetClass: 'Crypto',
        currency: 'USD',
        quantity: 0.45,
        purchasePrice: 41200.00,
        purchaseDate: '2025-08-14',
        currentPrice: 43500.00
      },
      {
        symbol: 'ETH',
        name: 'Ethereum',
        ticker: 'ETH',
        exchange: 'CRYPTO',
        assetClass: 'Crypto',
        currency: 'USD',
        quantity: 3.5,
        purchasePrice: 2150.00,
        purchaseDate: '2025-08-15',
        currentPrice: 2280.00
      },
      {
        symbol: 'USD_CASH',
        name: 'USD Cash Reserves',
        ticker: 'CASH',
        exchange: 'CASH',
        assetClass: 'Cash',
        currency: 'USD',
        quantity: 8500,
        purchasePrice: 1.00,
        purchaseDate: '2025-01-01',
        currentPrice: 1.00
      },
      {
        symbol: 'INR_CASH',
        name: 'INR Operating Account',
        ticker: 'CASH',
        exchange: 'CASH',
        assetClass: 'Cash',
        currency: 'INR',
        quantity: 150000,
        purchasePrice: 1.00,
        purchaseDate: '2025-01-01',
        currentPrice: 1.00
      }
    ];

    // Load holdings
    const existingHoldings = await dbService.getHoldings(userId);
    if (existingHoldings.length === 0) {
      for (const h of sampleHoldings) {
        await dbService.addHolding(userId, h);
        if (h.ticker !== 'CASH') {
          await IntelligenceService.recalculateConviction(h.ticker, h.exchange);
        }
      }
    }

    // 2. Realistic watchlist assets
    const sampleWatchlist: Omit<WatchlistItem, 'id' | 'userId' | 'addedAt'>[] = [
      {
        symbol: 'NVDA',
        ticker: 'NVDA',
        exchange: 'NASDAQ',
        currency: 'USD',
        name: 'NVIDIA Corporation'
      },
      {
        symbol: 'TSLA',
        ticker: 'TSLA',
        exchange: 'NASDAQ',
        currency: 'USD',
        name: 'Tesla, Inc.'
      },
      {
        symbol: 'INFY',
        ticker: 'INFY',
        exchange: 'NSE',
        currency: 'INR',
        name: 'Infosys Limited'
      },
      {
        symbol: 'SOL',
        ticker: 'SOL',
        exchange: 'CRYPTO',
        currency: 'USD',
        name: 'Solana'
      }
    ];

    const existingWatchlist = await dbService.getWatchlist(userId);
    if (existingWatchlist.length === 0) {
      for (const w of sampleWatchlist) {
        await dbService.addWatchlistItem(userId, w);
      }
    }

    // 3. Realistic scanned opportunities
    const generatedTimestamp = new Date().toISOString();
    const sampleOpportunities: Omit<Opportunity, 'id'>[] = [
      {
        userId,
        title: 'Significant Pullback Discount',
        ticker: 'TSLA',
        exchange: 'NASDAQ',
        rationale: 'Tesla, Inc. (TSLA) is trading at 218.40 USD, representing a 22.4% pullback from its 52-week high of 281.50 USD. The current correction moves its price action within historical dynamic support parameters, suggesting a strong entry premium for long-term growth accounts.',
        confidenceScore: 84,
        supportingMetrics: {
          ruleMatched: 'Large pullback opportunity',
          currentPrice: 218.40,
          metricValue: '-22.4% from 52W High',
          fiftyTwoWeekHigh: 281.50,
          distanceFrom52WeekHigh: -22.4
        },
        generatedTimestamp,
        tags: ['value', 'watchlist']
      },
      {
        userId,
        title: 'Potential 52-Week High Breakout',
        ticker: 'NVDA',
        exchange: 'NASDAQ',
        rationale: 'NVIDIA Corporation (NVDA) has advanced to 495.20 USD, sitting just 0.8% below its annual resistance peak of 499.00 USD. Relative volume (RVOL) is expanding at 1.45x, showing strong institutional accumulation that may support a breakout run.',
        confidenceScore: 89,
        supportingMetrics: {
          ruleMatched: 'Near 52-week high breakout',
          currentPrice: 495.20,
          metricValue: '-0.8% from 52W High',
          fiftyTwoWeekHigh: 499.00,
          distanceFrom52WeekHigh: -0.8
        },
        generatedTimestamp,
        tags: ['momentum', 'watchlist']
      },
      {
        userId,
        title: 'Portfolio Class Diversification',
        ticker: 'INR_CASH',
        exchange: 'CASH',
        rationale: 'Your asset class distribution shows cash allocation below security limits (Target: 5-15%). Holding cash cushions maintains liquidity buffers to acquire opportunities during unexpected macroeconomic drawdowns.',
        confidenceScore: 90,
        supportingMetrics: {
          ruleMatched: 'Portfolio diversification',
          currentPrice: 1.00,
          metricValue: 'Cash Reserves cushion check',
          candidateClass: 'Cash'
        },
        generatedTimestamp,
        tags: ['diversification']
      }
    ];

    const existingOpps = await dbService.getOpportunities(userId);
    if (existingOpps.length === 0) {
      await dbService.saveOpportunities(userId, sampleOpportunities);
    }

    // 4. Realistic intelligence reports
    const sampleReports = await dbService.getReports(userId);
    if (sampleReports.length === 0) {
      const mockReport: Omit<DailyReport, 'id' | 'createdAt'> = {
        userId,
        date: new Date().toISOString().split('T')[0],
        title: 'Daily Market Briefing & Portfolio Intelligence',
        summary: 'Macro indices show bullish tech momentum ahead of corporate earnings. Core portfolio health graded at Healthy (82/100) with minor HHI single-stock concentration concerns.',
        sections: {
          marketSnapshot: {
            globalTrend: 'bullish',
            usMarket: 'S&P 500 up 0.45%, Nasdaq Composite rises 0.72% on semiconductor demand.',
            indianMarket: 'Nifty 50 trades flat with positive bias (+0.12%), IT leads gains.',
            cryptoMarket: 'Bitcoin consolidates near $43,500 (+0.8%), altcoins print minor recoveries.'
          },
          portfolioSummary: {
            totalValue: 55432.50,
            totalGainLoss: 4210.80,
            performanceLabel: 'Strong Outperformance',
            allocationHighlights: 'Portfolio is 72% US Equities, 15% Indian Equities, 8% Crypto, and 5% Cash Buffer.'
          },
          watchlistMovers: [
            {
              ticker: 'NVDA',
              exchange: 'NASDAQ',
              price: 495.20,
              changePercent: 3.42,
              direction: 'up'
            },
            {
              ticker: 'TSLA',
              exchange: 'NASDAQ',
              price: 218.40,
              changePercent: -1.85,
              direction: 'down'
            }
          ],
          riskFlags: [
            {
              level: 'warning',
              message: 'Single Asset Concentration (MSFT is 18.5% of total ledger)',
              suggestion: 'Consider trimming position or routing fresh cash flows to cash/foreign indices to bring weighting below 15%.'
            }
          ],
          learningItem: {
            term: 'HHI Concentration Index',
            definition: 'The Herfindahl-Hirschman Index is a quantitative measure of portfolio concentration risk, calculated by summing the squares of individual asset percentages.',
            context: 'A portfolio with an HHI under 1,500 is considered highly diversified, whereas values above 2,500 signal extreme concentration.'
          }
        }
      };

      await dbService.saveReport(userId, mockReport);
    }
  }

  /**
   * Removes only the sample data from Firestore/LocalStorage.
   */
  public static async removeSampleData(userId: string): Promise<void> {
    // 1. Remove sample holdings
    const holdings = await dbService.getHoldings(userId);
    const sampleHoldingsTickers = ['AAPL', 'MSFT', 'GOOG', 'RELIANCE', 'TCS', 'BTC', 'ETH'];
    for (const h of holdings) {
      if (sampleHoldingsTickers.includes(h.ticker.toUpperCase())) {
        await dbService.deleteHolding(userId, h.id);
      }
    }

    // 2. Remove sample watchlist items
    const watchlist = await dbService.getWatchlist(userId);
    const sampleWatchlistTickers = ['NVDA', 'TSLA', 'INFY', 'SOL'];
    for (const w of watchlist) {
      if (sampleWatchlistTickers.includes(w.ticker.toUpperCase())) {
        await dbService.deleteWatchlistItem(userId, w.id);
      }
    }

    // 3. Remove sample opportunities
    const opportunities = await dbService.getOpportunities(userId);
    const sampleOppsTitles = ['Significant Pullback Discount', 'Potential 52-Week High Breakout', 'Portfolio Class Diversification'];
    const remainingOpps = opportunities.filter(o => 
      !sampleOppsTitles.includes(o.title) && 
      !sampleHoldingsTickers.includes(o.ticker.toUpperCase()) && 
      !sampleWatchlistTickers.includes(o.ticker.toUpperCase())
    );
    await dbService.saveOpportunities(userId, remainingOpps);

    // 4. Remove sample reports
    const reports = await dbService.getReports(userId);
    const remainingReports = reports.filter(r => !r.title.includes('Sample') && !r.title.includes('Diversified Audit'));
    if (typeof window !== 'undefined') {
      localStorage.setItem(`reports_${userId}`, JSON.stringify(remainingReports));
    }
  }

  /**
   * Resets all user portfolio data back to empty so they can start clean.
   */
  public static async clearUserData(userId: string): Promise<void> {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`holdings_${userId}`);
      localStorage.removeItem(`watchlist_${userId}`);
      localStorage.removeItem(`reports_${userId}`);
      localStorage.removeItem(`opportunities_${userId}`);
      localStorage.removeItem(`ai_commentary_${userId}`);
      
      // Reset checklist markers
      localStorage.removeItem(`checklist_completed_${userId}`);
    }
  }
}

export default SampleDataService;
