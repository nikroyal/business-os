import { dbService } from './firebase';
import type { Holding, CompanyIntelligence, UserConviction, Opportunity } from './firebase';
import { PortfolioAnalyticsService } from './portfolioAnalyticsService';
import type { PortfolioAnalytics } from './portfolioAnalyticsService';
import type { AssetMetadata } from './marketDataService';

export interface HistoricalAssetConviction {
  ticker: string;
  exchange: string;
  overallScore: number;
  qualityScore: number;
  dipScore: number;
  institutionalScore: number;
  netInstitutionalFlow: 'accumulation' | 'distribution' | 'neutral' | 'unavailable';
  dipClassification: 'Healthy' | 'Uncertain' | 'Dangerous' | 'No Dip';
}

export interface HistoricalAssetHolding {
  ticker: string;
  exchange: string;
  quantity: number;
  value: number;
  percentage: number;
}

export interface HistoricalSnapshotRecord {
  date: string; // YYYY-MM-DD
  userId: string;
  totalValue: number;
  totalCost: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  healthScore: number;
  diversificationScore: number;
  hhi: number;
  hhiStatus: 'Low' | 'Moderate' | 'High';
  topAssetWeight: number;
  holdings: HistoricalAssetHolding[];
  convictions: HistoricalAssetConviction[];
  sectorAllocation: { name: string; value: number; percentage: number }[];
  currencyExposure: { name: string; value: number; percentage: number }[];
  riskFlags: { type: 'info' | 'warning' | 'danger'; message: string; suggestion: string }[];
  updatedAt: string;
}

export interface IntelligenceAlert {
  id: string;
  userId: string;
  priority: 'high' | 'medium' | 'low';
  category: 'conviction' | 'quality' | 'dip' | 'concentration' | 'exposure' | 'smart_money' | 'opportunity';
  title: string;
  message: string;
  ticker?: string;
  exchange?: string;
  previousValue: string | number;
  currentValue: string | number;
  whyItMatters: string;
  timestamp: string;
  source: string;
  read: boolean;
}

export interface PortfolioDeltaReport {
  date: string;
  upgrades: { ticker: string; name: string; prev: number; curr: number }[];
  downgrades: { ticker: string; name: string; prev: number; curr: number }[];
  newDips: { ticker: string; name: string; classification: string }[];
  resolvedDips: { ticker: string; name: string; prevClassification: string }[];
  smartMoneyChanges: { ticker: string; name: string; prevFlow: string; currFlow: string }[];
  newOpportunities: { ticker: string; name: string; rationale: string }[];
  removedOpportunities: { ticker: string; name: string }[];
  portfolioHealthChange: { prevScore: number; currScore: number; prevStatus: string; currStatus: string };
  diversificationChange: { prevScore: number; currScore: number; prevStatus: string; currStatus: string };
}

export interface SimulationAction {
  type: 'buy' | 'sell' | 'adjust_cash' | 'add_new';
  ticker: string;
  exchange: string;
  amount: number; // units/cash
  percentage?: number; // target reduction/weight percentage
}

export interface SimulationResult {
  current: {
    totalValue: number;
    healthScore: number;
    diversificationScore: number;
    hhi: number;
    hhiStatus: string;
    topAssetWeight: number;
    top3Weight: number;
    sectorAllocation: { name: string; percentage: number }[];
    currencyExposure: { name: string; percentage: number }[];
    averageConviction: number;
  };
  simulated: {
    totalValue: number;
    healthScore: number;
    diversificationScore: number;
    hhi: number;
    hhiStatus: string;
    topAssetWeight: number;
    top3Weight: number;
    sectorAllocation: { name: string; percentage: number }[];
    currencyExposure: { name: string; percentage: number }[];
    averageConviction: number;
  };
  deltas: {
    healthScoreDiff: number;
    diversificationScoreDiff: number;
    hhiDiff: number;
    topAssetWeightDiff: number;
    averageConvictionDiff: number;
  };
}

export class DecisionEngineService {
  /**
   * Compiles the current state into a serializable HistoricalSnapshotRecord.
   */
  public static createCurrentSnapshotRecord(
    userId: string,
    holdings: Holding[],
    convictions: UserConviction[],
    intelList: CompanyIntelligence[],
    analytics: PortfolioAnalytics
  ): HistoricalSnapshotRecord {
    const todayStr = new Date().toISOString().split('T')[0];

    const mappedHoldings: HistoricalAssetHolding[] = analytics.topHoldings.map(th => {
      const match = holdings.find(h => h.ticker === th.ticker);
      return {
        ticker: th.ticker,
        exchange: match?.exchange || 'NASDAQ',
        quantity: match?.quantity || 0,
        value: th.value,
        percentage: th.percentage
      };
    });

    const mappedConvictions: HistoricalAssetConviction[] = convictions.map(c => {
      const intel = intelList.find(i => i.ticker.toUpperCase() === c.ticker.toUpperCase() && i.exchange.toUpperCase() === c.exchange.toUpperCase());
      
      let dipClass: 'Healthy' | 'Uncertain' | 'Dangerous' | 'No Dip' = 'No Dip';
      if (intel?.dip.dipDetected) {
        dipClass = intel.dip.classification as any || 'Uncertain';
      }

      return {
        ticker: c.ticker,
        exchange: c.exchange,
        overallScore: c.overallScore,
        qualityScore: intel?.qualityScore || c.breakdown.fundamentalFactor.score || 0,
        dipScore: c.breakdown.dipFactor.score,
        institutionalScore: c.breakdown.institutionalFactor.score,
        netInstitutionalFlow: intel?.smartMoney.netInstitutionalFlow || 'unavailable',
        dipClassification: dipClass
      };
    });

    return {
      date: todayStr,
      userId,
      totalValue: analytics.totalValue,
      totalCost: analytics.totalCost,
      totalGainLoss: analytics.totalGainLoss,
      totalGainLossPercent: analytics.totalGainLossPercent,
      healthScore: analytics.health.score,
      diversificationScore: analytics.diversification.score,
      hhi: analytics.concentrationRisk.hhi,
      hhiStatus: analytics.concentrationRisk.status,
      topAssetWeight: analytics.concentrationRisk.topAssetWeight,
      holdings: mappedHoldings,
      convictions: mappedConvictions,
      sectorAllocation: analytics.sectorAllocation,
      currencyExposure: analytics.currencyExposure,
      riskFlags: analytics.health.flags.map(f => ({
        type: f.type,
        message: f.message,
        suggestion: f.suggestion
      })),
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Generates Intelligence Alerts comparing current record to previous record.
   */
  public static detectChangeEvents(
    current: HistoricalSnapshotRecord,
    previous: HistoricalSnapshotRecord
  ): IntelligenceAlert[] {
    const alerts: IntelligenceAlert[] = [];
    const timestamp = new Date().toISOString();
    const userId = current.userId;

    // 1. Conviction drops > 15 points (HIGH)
    current.convictions.forEach(currConv => {
      const prevConv = previous.convictions.find(c => c.ticker === currConv.ticker && c.exchange === currConv.exchange);
      if (prevConv && prevConv.overallScore - currConv.overallScore > 15) {
        alerts.push({
          id: `alert_conv_drop_${currConv.ticker}_${current.date}`,
          userId,
          priority: 'high',
          category: 'conviction',
          title: `Severe Conviction Drop: ${currConv.ticker}`,
          message: `The conviction index of ${currConv.ticker} dropped sharply from ${prevConv.overallScore}/100 to ${currConv.overallScore}/100.`,
          ticker: currConv.ticker,
          exchange: currConv.exchange,
          previousValue: prevConv.overallScore,
          currentValue: currConv.overallScore,
          whyItMatters: `A drop of >15 points indicates a structural failure in the asset's thesis, institutional flight, or a severe cash generation warning.`,
          timestamp,
          source: 'Conviction Engine',
          read: false
        });
      }
      
      // Quality score drops >= 5 points (HIGH)
      if (prevConv && prevConv.qualityScore - currConv.qualityScore >= 5) {
        alerts.push({
          id: `alert_qual_drop_${currConv.ticker}_${current.date}`,
          userId,
          priority: 'high',
          category: 'quality',
          title: `Quality Score Deterioration: ${currConv.ticker}`,
          message: `Fundamental quality rating for ${currConv.ticker} deteriorated from ${prevConv.qualityScore}/100 to ${currConv.qualityScore}/100.`,
          ticker: currConv.ticker,
          exchange: currConv.exchange,
          previousValue: prevConv.qualityScore,
          currentValue: currConv.qualityScore,
          whyItMatters: `Deteriorating capital efficiency, margin compression, or rising balance sheet leverage is weakening the competitive moat.`,
          timestamp,
          source: 'Quality Framework',
          read: false
        });
      }

      // Dangerous Dip Classification (HIGH)
      if (prevConv && currConv.dipClassification === 'Dangerous' && prevConv.dipClassification !== 'Dangerous') {
        alerts.push({
          id: `alert_danger_dip_${currConv.ticker}_${current.date}`,
          userId,
          priority: 'high',
          category: 'dip',
          title: `Dangerous Dip Classification: ${currConv.ticker}`,
          message: `${currConv.ticker} has breached critical support lines and is flagged under a Dangerous Dip pattern.`,
          ticker: currConv.ticker,
          exchange: currConv.exchange,
          previousValue: prevConv.dipClassification,
          currentValue: currConv.dipClassification,
          whyItMatters: `Dangerous dips show high volatility and structural deterioration, presenting liquidation risks rather than a mean-reverting opportunity.`,
          timestamp,
          source: 'Dip technical Workbench',
          read: false
        });
      }

      // Smart Money Flow Deterioration (MEDIUM)
      if (prevConv && prevConv.netInstitutionalFlow === 'accumulation' && currConv.netInstitutionalFlow !== 'accumulation' && currConv.netInstitutionalFlow !== 'unavailable') {
        alerts.push({
          id: `alert_smart_det_${currConv.ticker}_${current.date}`,
          userId,
          priority: 'medium',
          category: 'smart_money',
          title: `Institutional Inflow Ceased: ${currConv.ticker}`,
          message: `Smart money net flow registry for ${currConv.ticker} fell from accumulation to ${currConv.netInstitutionalFlow}.`,
          ticker: currConv.ticker,
          exchange: currConv.exchange,
          previousValue: prevConv.netInstitutionalFlow,
          currentValue: currConv.netInstitutionalFlow,
          whyItMatters: `Institutional support is slowing down or exiting, indicating options sentiment pivots or 13F registry outflows.`,
          timestamp,
          source: 'Smart Money Terminal',
          read: false
        });
      }

      // Quality Score Improvements (LOW)
      if (prevConv && currConv.qualityScore - prevConv.qualityScore >= 5) {
        alerts.push({
          id: `alert_qual_imp_${currConv.ticker}_${current.date}`,
          userId,
          priority: 'low',
          category: 'quality',
          title: `Quality Score Improvement: ${currConv.ticker}`,
          message: `Quality framework score for ${currConv.ticker} rose by +${currConv.qualityScore - prevConv.qualityScore} points to ${currConv.qualityScore}/100.`,
          ticker: currConv.ticker,
          exchange: currConv.exchange,
          previousValue: prevConv.qualityScore,
          currentValue: currConv.qualityScore,
          whyItMatters: `The business model shows improved operating margins or lower leverage ratios.`,
          timestamp,
          source: 'Quality Framework',
          read: false
        });
      }
    });

    // 2. Severe concentration risk (HIGH)
    if (current.hhiStatus === 'High' && previous.hhiStatus !== 'High') {
      alerts.push({
        id: `alert_conc_high_${current.date}`,
        userId,
        priority: 'high',
        category: 'concentration',
        title: 'Severe Concentration Risk Flagged',
        message: `Portfolio HHI has crossed into the 'High' risk boundary (Current HHI: ${current.hhi}).`,
        previousValue: previous.hhiStatus,
        currentValue: current.hhiStatus,
        whyItMatters: `High concentration makes portfolio performance overly dependent on a few assets, increasing single-stock vulnerability.`,
        timestamp,
        source: 'Portfolio Analytics Engine',
        read: false
      });
    }

    if (current.topAssetWeight > 30 && previous.topAssetWeight <= 30) {
      alerts.push({
        id: `alert_top_weight_${current.date}`,
        userId,
        priority: 'high',
        category: 'concentration',
        title: 'Concentration Warning: Top Asset Weight Exceeds 30%',
        message: `Your largest single position weight is now ${current.topAssetWeight.toFixed(1)}% of the total ledger.`,
        previousValue: `${previous.topAssetWeight.toFixed(1)}%`,
        currentValue: `${current.topAssetWeight.toFixed(1)}%`,
        whyItMatters: `Any single holding exceeding 30% creates extreme single-point-of-failure risks.`,
        timestamp,
        source: 'Portfolio Analytics Engine',
        read: false
      });
    }

    // 3. Allocation Drift > 5% (MEDIUM)
    current.holdings.forEach(currHold => {
      const prevHold = previous.holdings.find(h => h.ticker === currHold.ticker && h.exchange === currHold.exchange);
      if (prevHold && Math.abs(currHold.percentage - prevHold.percentage) > 5.0) {
        alerts.push({
          id: `alert_drift_${currHold.ticker}_${current.date}`,
          userId,
          priority: 'medium',
          category: 'concentration',
          title: `Position Drift Detected: ${currHold.ticker}`,
          message: `${currHold.ticker} weight shifted by ${(currHold.percentage - prevHold.percentage).toFixed(1)}% (previous: ${prevHold.percentage.toFixed(1)}% -> current: ${currHold.percentage.toFixed(1)}%).`,
          ticker: currHold.ticker,
          exchange: currHold.exchange,
          previousValue: `${prevHold.percentage.toFixed(1)}%`,
          currentValue: `${currHold.percentage.toFixed(1)}%`,
          whyItMatters: `Organic price moves are shifting position sizes away from target risk exposures.`,
          timestamp,
          source: 'Portfolio Analytics Engine',
          read: false
        });
      }
    });

    // 4. Sector Overexposure > 40% (MEDIUM)
    current.sectorAllocation.forEach(currSec => {
      const prevSec = previous.sectorAllocation.find(s => s.name === currSec.name);
      if (currSec.percentage > 40 && (!prevSec || prevSec.percentage <= 40)) {
        alerts.push({
          id: `alert_sector_over_${currSec.name}_${current.date}`,
          userId,
          priority: 'medium',
          category: 'exposure',
          title: `Sector Concentration Over 40%: ${currSec.name}`,
          message: `${currSec.name} sector allocation has reached ${currSec.percentage.toFixed(1)}% of your portfolio.`,
          previousValue: prevSec ? `${prevSec.percentage.toFixed(1)}%` : '0%',
          currentValue: `${currSec.percentage.toFixed(1)}%`,
          whyItMatters: `High sector concentration exposes the portfolio to systemic industry-wide drawdowns.`,
          timestamp,
          source: 'Portfolio Analytics Engine',
          read: false
        });
      }
    });

    // 5. Currency Concentration > 60% (MEDIUM)
    current.currencyExposure.forEach(currCurr => {
      const prevCurr = previous.currencyExposure.find(c => c.name === currCurr.name);
      if (currCurr.percentage > 60 && (!prevCurr || prevCurr.percentage <= 60)) {
        alerts.push({
          id: `alert_currency_over_${currCurr.name}_${current.date}`,
          userId,
          priority: 'medium',
          category: 'exposure',
          title: `Currency Exposure Over 60%: ${currCurr.name}`,
          message: `Foreign currency exposure in ${currCurr.name} is now ${currCurr.percentage.toFixed(1)}% of the portfolio.`,
          previousValue: prevCurr ? `${prevCurr.percentage.toFixed(1)}%` : '0%',
          currentValue: `${currCurr.percentage.toFixed(1)}%`,
          whyItMatters: `High currency concentration introduces significant FX exchange-rate volatility.`,
          timestamp,
          source: 'Portfolio Analytics Engine',
          read: false
        });
      }
    });

    return alerts;
  }

  /**
   * Computes the daily portfolio changes list.
   */
  public static generateDailyPortfolioDelta(
    current: HistoricalSnapshotRecord,
    previous: HistoricalSnapshotRecord | null,
    opportunities: Opportunity[]
  ): PortfolioDeltaReport {
    const todayStr = current.date;
    
    if (!previous) {
      // Empty/first-day delta
      return {
        date: todayStr,
        upgrades: [],
        downgrades: [],
        newDips: [],
        resolvedDips: [],
        smartMoneyChanges: [],
        newOpportunities: opportunities.map(o => ({ ticker: o.ticker, name: o.ticker, rationale: o.rationale })),
        removedOpportunities: [],
        portfolioHealthChange: { prevScore: current.healthScore, currScore: current.healthScore, prevStatus: 'Healthy', currStatus: 'Healthy' },
        diversificationChange: { prevScore: current.diversificationScore, currScore: current.diversificationScore, prevStatus: 'Average', currStatus: 'Average' }
      };
    }

    const upgrades: { ticker: string; name: string; prev: number; curr: number }[] = [];
    const downgrades: { ticker: string; name: string; prev: number; curr: number }[] = [];
    const newDips: { ticker: string; name: string; classification: string }[] = [];
    const resolvedDips: { ticker: string; name: string; prevClassification: string }[] = [];
    const smartMoneyChanges: { ticker: string; name: string; prevFlow: string; currFlow: string }[] = [];

    // Compare convictions
    current.convictions.forEach(currConv => {
      const prevConv = previous.convictions.find(c => c.ticker === currConv.ticker && c.exchange === currConv.exchange);
      if (prevConv) {
        // Conviction upgrades/downgrades
        if (currConv.overallScore > prevConv.overallScore) {
          upgrades.push({ ticker: currConv.ticker, name: currConv.ticker, prev: prevConv.overallScore, curr: currConv.overallScore });
        } else if (currConv.overallScore < prevConv.overallScore) {
          downgrades.push({ ticker: currConv.ticker, name: currConv.ticker, prev: prevConv.overallScore, curr: currConv.overallScore });
        }

        // Smart money flow changes
        if (currConv.netInstitutionalFlow !== prevConv.netInstitutionalFlow) {
          smartMoneyChanges.push({
            ticker: currConv.ticker,
            name: currConv.ticker,
            prevFlow: prevConv.netInstitutionalFlow,
            currFlow: currConv.netInstitutionalFlow
          });
        }

        // Dip changes
        if (currConv.dipClassification !== prevConv.dipClassification) {
          if (currConv.dipClassification !== 'No Dip') {
            newDips.push({ ticker: currConv.ticker, name: currConv.ticker, classification: currConv.dipClassification });
          } else {
            resolvedDips.push({ ticker: currConv.ticker, name: currConv.ticker, prevClassification: prevConv.dipClassification });
          }
        }
      } else {
        // Newly added conviction
        if (currConv.overallScore >= 75) {
          upgrades.push({ ticker: currConv.ticker, name: currConv.ticker, prev: 0, curr: currConv.overallScore });
        }
        if (currConv.dipClassification !== 'No Dip') {
          newDips.push({ ticker: currConv.ticker, name: currConv.ticker, classification: currConv.dipClassification });
        }
      }
    });

    // Opportunities changes (mock delta check)
    // New opportunities: present in opportunities list, but not in previous convictions
    const newOpportunities = opportunities
      .filter(o => !previous.convictions.some(c => c.ticker === o.ticker))
      .map(o => ({ ticker: o.ticker, name: o.ticker, rationale: o.rationale }));

    const removedOpportunities = previous.convictions
      .filter(c => !current.convictions.some(curr => curr.ticker === c.ticker) && !opportunities.some(o => o.ticker === c.ticker))
      .map(c => ({ ticker: c.ticker, name: c.ticker }));

    // Status mapper helpers
    const getHealthStatus = (score: number) => score >= 80 ? 'Healthy' : score >= 50 ? 'Warning' : 'Critical';
    const getDivStatus = (score: number) => score >= 85 ? 'Excellent' : score >= 70 ? 'Good' : score >= 50 ? 'Average' : 'Poor';

    return {
      date: todayStr,
      upgrades,
      downgrades,
      newDips,
      resolvedDips,
      smartMoneyChanges,
      newOpportunities,
      removedOpportunities,
      portfolioHealthChange: {
        prevScore: previous.healthScore,
        currScore: current.healthScore,
        prevStatus: getHealthStatus(previous.healthScore),
        currStatus: getHealthStatus(current.healthScore)
      },
      diversificationChange: {
        prevScore: previous.diversificationScore,
        currScore: current.diversificationScore,
        prevStatus: getDivStatus(previous.diversificationScore),
        currStatus: getDivStatus(current.diversificationScore)
      }
    };
  }

  /**
   * Portfolio Rebalancing Simulator & Scenario calculation logic.
   */
  public static runSimulation(
    holdings: Holding[],
    actions: SimulationAction[],
    prices: Record<string, number>,
    metadata: Record<string, AssetMetadata | null>,
    reportingCurrency: 'USD' | 'INR',
    rate: number,
    risk: 'conservative' | 'moderate' | 'aggressive' = 'moderate'
  ): SimulationResult {
    // 1. Resolve current baseline analytics
    const currentAnalytics = PortfolioAnalyticsService.calculate(
      holdings,
      prices,
      metadata,
      reportingCurrency,
      rate,
      risk
    );

    // 2. Clone holdings to build simulated list
    const simHoldings: Holding[] = JSON.parse(JSON.stringify(holdings));

    // Resolve CASH holding reference
    let cashHolding = simHoldings.find(h => h.ticker === 'CASH');
    if (!cashHolding) {
      cashHolding = {
        id: 'cash_sim_id',
        userId: holdings[0]?.userId || 'mock_anonymous',
        symbol: 'CASH',
        name: 'Cash Equivalents',
        ticker: 'CASH',
        exchange: 'CASH',
        assetClass: 'Cash',
        currency: reportingCurrency,
        quantity: 0,
        purchasePrice: 1.0,
        currentPrice: 1.0,
        purchaseDate: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      simHoldings.push(cashHolding);
    }

    // Apply simulation actions
    actions.forEach(act => {
      const livePrice = prices[act.ticker] !== undefined ? prices[act.ticker] : (prices[`${act.ticker}:${act.exchange}`] || 1.0);
      const isCash = act.ticker === 'CASH';

      if (act.type === 'buy') {
        // Buy action: add NVDA, reduce cash
        if (isCash) {
          cashHolding!.quantity += act.amount;
        } else {
          let hold = simHoldings.find(h => h.ticker.toUpperCase() === act.ticker.toUpperCase() && h.exchange.toUpperCase() === act.exchange.toUpperCase());
          if (!hold) {
            // Add new simulated asset holding
            hold = {
              id: `sim_h_${act.ticker}`,
              userId: cashHolding!.userId,
              symbol: act.ticker,
              name: act.ticker,
              ticker: act.ticker,
              exchange: act.exchange,
              assetClass: 'Equity',
              currency: 'USD',
              quantity: 0,
              purchasePrice: livePrice,
              currentPrice: livePrice,
              purchaseDate: new Date().toISOString().split('T')[0],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            simHoldings.push(hold);
          }
          hold.quantity += act.amount / livePrice;
          
          // Deduct from CASH
          let valueInCashCurrency = act.amount;
          if (cashHolding!.currency !== 'USD') {
            valueInCashCurrency = act.amount * rate;
          }
          cashHolding!.quantity -= valueInCashCurrency;
        }
      } else if (act.type === 'sell') {
        // Sell action: reduce position size
        const hold = simHoldings.find(h => h.ticker.toUpperCase() === act.ticker.toUpperCase() && h.exchange.toUpperCase() === act.exchange.toUpperCase());
        if (hold) {
          const qtyToReduce = act.percentage 
            ? hold.quantity * (act.percentage / 100) 
            : Math.min(act.amount, hold.quantity);

          hold.quantity -= qtyToReduce;
          const cashCredited = qtyToReduce * livePrice;
          
          // Add to CASH
          let creditedInCashCurrency = cashCredited;
          if (cashHolding!.currency !== 'USD') {
            creditedInCashCurrency = cashCredited * rate;
          }
          cashHolding!.quantity += creditedInCashCurrency;
        }
      } else if (act.type === 'adjust_cash') {
        cashHolding!.quantity += act.amount;
      } else if (act.type === 'add_new') {
        // Add completely new holding with amount capital (adds capital and buys asset)
        let hold = simHoldings.find(h => h.ticker.toUpperCase() === act.ticker.toUpperCase() && h.exchange.toUpperCase() === act.exchange.toUpperCase());
        if (!hold) {
          hold = {
            id: `sim_h_${act.ticker}`,
            userId: cashHolding!.userId,
            symbol: act.ticker,
            name: act.ticker,
            ticker: act.ticker,
            exchange: act.exchange,
            assetClass: 'Equity',
            currency: 'USD',
            quantity: 0,
            purchasePrice: livePrice,
            currentPrice: livePrice,
            purchaseDate: new Date().toISOString().split('T')[0],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          simHoldings.push(hold);
        }
        hold.quantity += act.amount / livePrice;
      }
    });

    // 3. Re-calculate simulated portfolio metrics
    const simAnalytics = PortfolioAnalyticsService.calculate(
      simHoldings.filter(h => h.quantity > 0 || h.ticker === 'CASH'), // exclude zeroed holdings
      prices,
      metadata,
      reportingCurrency,
      rate,
      risk
    );

    const getAvgConv = (ans: PortfolioAnalytics) => {
      return Math.round(75 + (ans.diversification.score / 10) - (ans.concentrationRisk.topAssetWeight / 5));
    };

    return {
      current: {
        totalValue: currentAnalytics.totalValue,
        healthScore: currentAnalytics.health.score,
        diversificationScore: currentAnalytics.diversification.score,
        hhi: currentAnalytics.concentrationRisk.hhi,
        hhiStatus: currentAnalytics.concentrationRisk.status,
        topAssetWeight: currentAnalytics.concentrationRisk.topAssetWeight,
        top3Weight: currentAnalytics.concentrationRisk.top3Weight,
        sectorAllocation: currentAnalytics.sectorAllocation.map(s => ({ name: s.name, percentage: s.percentage })),
        currencyExposure: currentAnalytics.currencyExposure.map(c => ({ name: c.name, percentage: c.percentage })),
        averageConviction: getAvgConv(currentAnalytics)
      },
      simulated: {
        totalValue: simAnalytics.totalValue,
        healthScore: simAnalytics.health.score,
        diversificationScore: simAnalytics.diversification.score,
        hhi: simAnalytics.concentrationRisk.hhi,
        hhiStatus: simAnalytics.concentrationRisk.status,
        topAssetWeight: simAnalytics.concentrationRisk.topAssetWeight,
        top3Weight: simAnalytics.concentrationRisk.top3Weight,
        sectorAllocation: simAnalytics.sectorAllocation.map(s => ({ name: s.name, percentage: s.percentage })),
        currencyExposure: simAnalytics.currencyExposure.map(c => ({ name: c.name, percentage: c.percentage })),
        averageConviction: getAvgConv(simAnalytics)
      },
      deltas: {
        healthScoreDiff: simAnalytics.health.score - currentAnalytics.health.score,
        diversificationScoreDiff: simAnalytics.diversification.score - currentAnalytics.diversification.score,
        hhiDiff: simAnalytics.concentrationRisk.hhi - currentAnalytics.concentrationRisk.hhi,
        topAssetWeightDiff: simAnalytics.concentrationRisk.topAssetWeight - currentAnalytics.concentrationRisk.topAssetWeight,
        averageConvictionDiff: getAvgConv(simAnalytics) - getAvgConv(currentAnalytics)
      }
    };
  }

  /**
   * Checks if history has snapshots today; if not, writes current.
   * Compiles alerts for any delta events and writes them.
   */
  public static async saveDailySnapshotIfNew(
    userId: string,
    holdings: Holding[],
    convictions: UserConviction[],
    intelList: CompanyIntelligence[],
    analytics: PortfolioAnalytics
  ): Promise<void> {
    const todayStr = new Date().toISOString().split('T')[0];
    
    // 1. Create snapshot record
    const snapshot = this.createCurrentSnapshotRecord(userId, holdings, convictions, intelList, analytics);
    
    // 2. Fetch yesterday's snapshot to run change delta comparisons
    const historyList = await dbService.getAllPortfolioHistoryRecords(userId);
    const yesterdayRecord = historyList.find(h => h.date !== todayStr); // get most recent non-today record

    // Write today's snapshot record
    await dbService.savePortfolioHistoryRecord(userId, snapshot);

    if (yesterdayRecord) {
      // 3. Detect change triggers and fire alerts
      const alerts = this.detectChangeEvents(snapshot, yesterdayRecord);
      for (const alert of alerts) {
        await dbService.saveAlert(userId, alert);
      }
    }
  }

  /**
   * Seeds historical snapshots (past 7 days) if none exist.
   * Assures that when mock/demo mode runs, charts and change detection dashboards are pre-populated.
   */
  public static async seedMockHistoryIfEmpty(
    userId: string,
    holdings: Holding[],
    convictions: UserConviction[],
    intelList: CompanyIntelligence[],
    analytics: PortfolioAnalytics
  ): Promise<void> {
    const history = await dbService.getAllPortfolioHistoryRecords(userId);
    if (history.length > 0) return; // already seeded/populated

    console.log('Seeding historical snapshots for demonstration workflow...');
    const snapshotBase = this.createCurrentSnapshotRecord(userId, holdings, convictions, intelList, analytics);

    // Seed past 7 days with minor noisy fluctuations
    for (let i = 7; i >= 1; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];

      // Add minor fluctuations
      const factor = 1 - (i * 0.015) + (Math.sin(i) * 0.01);
      const seedSnapshot: HistoricalSnapshotRecord = {
        ...snapshotBase,
        date: dateStr,
        totalValue: snapshotBase.totalValue * factor,
        healthScore: Math.max(50, Math.min(100, Math.round(snapshotBase.healthScore - (i % 3) + 2))),
        diversificationScore: Math.max(50, Math.min(100, Math.round(snapshotBase.diversificationScore - (i % 2)))),
        hhi: snapshotBase.hhi + (i * 20),
        topAssetWeight: snapshotBase.topAssetWeight + (i * 0.5),
        convictions: snapshotBase.convictions.map(c => ({
          ...c,
          overallScore: Math.max(40, Math.min(100, c.overallScore - (i % 3) * 2)),
          qualityScore: Math.max(40, Math.min(100, c.qualityScore - (i % 2))),
          dipClassification: (i === 4 && c.ticker === 'AAPL') ? 'Healthy' : c.dipClassification
        })),
        updatedAt: d.toISOString()
      };
      await dbService.savePortfolioHistoryRecord(userId, seedSnapshot);
    }
  }
}
