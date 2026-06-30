import type { Holding } from './firebase';
import type { AssetMetadata } from './marketDataService';
import { AssetClassificationService } from './assetClassificationService';

export interface SectorAllocation {
  name: string;
  value: number;
  percentage: number;
}

export interface GeographicAllocation {
  name: string;
  value: number;
  percentage: number;
  region: string;
}

export interface CurrencyExposure {
  name: string;
  value: number;
  percentage: number;
}

export interface ConcentrationRisk {
  hhi: number;
  status: 'Low' | 'Moderate' | 'High';
  topAssetWeight: number;
  top3Weight: number;
  description: string;
}

export interface PortfolioHoldingItem {
  id: string;
  ticker: string;
  name: string;
  value: number;
  percentage: number;
  gainLossValue: number;
  gainLossPercent: number;
}

export interface ScoreCategory {
  name: string;
  score: number;
  maxScore: number;
  explanation: string;
}

export interface DiversificationMetrics {
  score: number;
  status: 'Poor' | 'Average' | 'Good' | 'Excellent';
  description: string;
  breakdown: ScoreCategory[];
}

export interface RiskFlag {
  type: 'info' | 'warning' | 'danger';
  message: string;
  suggestion: string;
}

export interface PortfolioHealthSummary {
  status: 'Healthy' | 'Warning' | 'Critical';
  score: number;
  summary: string;
  flags: RiskFlag[];
  breakdown: ScoreCategory[];
}

export interface PortfolioAnalytics {
  totalValue: number;
  totalCost: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  
  sectorAllocation: SectorAllocation[];
  geographicAllocation: GeographicAllocation[];
  currencyExposure: CurrencyExposure[];
  
  concentrationRisk: ConcentrationRisk;
  topHoldings: PortfolioHoldingItem[];
  bestPerformers: PortfolioHoldingItem[];
  worstPerformers: PortfolioHoldingItem[];
  
  diversification: DiversificationMetrics;
  health: PortfolioHealthSummary;
}

export class PortfolioAnalyticsService {
  /**
   * Main calculation engine
   */
  public static calculate(
    holdings: Holding[],
    marketPrices: Record<string, number>,
    metadataMap: Record<string, AssetMetadata | null>,
    reportingCurrency: 'USD' | 'INR',
    usdToInrRate: number,
    userRiskProfile?: 'conservative' | 'moderate' | 'aggressive'
  ): PortfolioAnalytics {
    const riskProfile = userRiskProfile || 'moderate';

    // 1. Convert everything to reporting currency and build a list of holding valuations
    let totalValue = 0;
    let totalCost = 0;

    const items = holdings.map(h => {
      const livePrice = marketPrices[h.id] !== undefined ? marketPrices[h.id] : (h.currentPrice || h.purchasePrice);
      const metadata = metadataMap[h.ticker || h.symbol] || null;
      
      // Classify the asset
      const classification = AssetClassificationService.normalizeHolding(h, metadata);
      
      const holdingCostBasis = h.quantity * h.purchasePrice;
      const holdingValue = h.quantity * livePrice;

      // Currency conversions
      let valueInReporting = holdingValue;
      let costInReporting = holdingCostBasis;

      if (h.currency !== reportingCurrency) {
        if (h.currency === 'INR' && reportingCurrency === 'USD') {
          valueInReporting = holdingValue / usdToInrRate;
          costInReporting = holdingCostBasis / usdToInrRate;
        } else if (h.currency === 'USD' && reportingCurrency === 'INR') {
          valueInReporting = holdingValue * usdToInrRate;
          costInReporting = holdingCostBasis * usdToInrRate;
        }
      }

      totalValue += valueInReporting;
      totalCost += costInReporting;

      const gainLossValue = valueInReporting - costInReporting;
      const gainLossPercent = costInReporting > 0 ? (gainLossValue / costInReporting) * 100 : 0;

      return {
        holding: h,
        classification,
        valueInReporting,
        costInReporting,
        gainLossValue,
        gainLossPercent
      };
    });

    const totalGainLoss = totalValue - totalCost;
    const totalGainLossPercent = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;

    if (holdings.length === 0) {
      return this.emptyAnalytics();
    }

    // Sort items by value in reporting currency descending
    items.sort((a, b) => b.valueInReporting - a.valueInReporting);

    // 2. Sector Allocation
    const sectorMap: Record<string, number> = {};
    items.forEach(item => {
      const s = item.classification.sector;
      sectorMap[s] = (sectorMap[s] || 0) + item.valueInReporting;
    });
    const sectorAllocation: SectorAllocation[] = Object.entries(sectorMap)
      .map(([name, val]) => ({
        name,
        value: val,
        percentage: totalValue > 0 ? (val / totalValue) * 100 : 0
      }))
      .sort((a, b) => b.value - a.value);

    // 3. Geographic Allocation
    const geoMap: Record<string, { value: number; region: string }> = {};
    items.forEach(item => {
      const country = item.classification.country;
      const region = item.classification.region;
      if (!geoMap[country]) {
        geoMap[country] = { value: 0, region };
      }
      geoMap[country].value += item.valueInReporting;
    });
    const geographicAllocation: GeographicAllocation[] = Object.entries(geoMap)
      .map(([name, detail]) => ({
        name,
        value: detail.value,
        percentage: totalValue > 0 ? (detail.value / totalValue) * 100 : 0,
        region: detail.region
      }))
      .sort((a, b) => b.value - a.value);

    // 4. Currency Exposure
    const currencyMap: Record<string, number> = {};
    items.forEach(item => {
      const cur = item.classification.currency;
      currencyMap[cur] = (currencyMap[cur] || 0) + item.valueInReporting;
    });
    const currencyExposure: CurrencyExposure[] = Object.entries(currencyMap)
      .map(([name, val]) => ({
        name,
        value: val,
        percentage: totalValue > 0 ? (val / totalValue) * 100 : 0
      }))
      .sort((a, b) => b.value - a.value);

    // 5. Top Holdings
    const topHoldings: PortfolioHoldingItem[] = items.map(item => ({
      id: item.holding.id,
      ticker: item.holding.ticker || item.holding.symbol,
      name: item.holding.name,
      value: item.valueInReporting,
      percentage: totalValue > 0 ? (item.valueInReporting / totalValue) * 100 : 0,
      gainLossValue: item.gainLossValue,
      gainLossPercent: item.gainLossPercent
    }));

    // 6. Best and Worst Performers (Unrealized returns since purchase)
    const sortedByPerformance = [...topHoldings].sort((a, b) => b.gainLossPercent - a.gainLossPercent);
    const bestPerformers = sortedByPerformance.slice(0, 3).filter(x => x.gainLossPercent > 0);
    const worstPerformers = [...sortedByPerformance].reverse().slice(0, 3).filter(x => x.gainLossPercent < 0);

    // 7. Concentration Risk (HHI calculation)
    let hhi = 0;
    items.forEach(item => {
      const weight = totalValue > 0 ? (item.valueInReporting / totalValue) * 100 : 0;
      hhi += weight * weight;
    });

    const topAssetWeight = topHoldings.length > 0 ? topHoldings[0].percentage : 0;
    const top3Weight = topHoldings.slice(0, 3).reduce((acc, x) => acc + x.percentage, 0);

    let concentrationStatus: 'Low' | 'Moderate' | 'High' = 'Low';
    let concentrationDesc = '';
    if (hhi >= 3000) {
      concentrationStatus = 'High';
      concentrationDesc = 'Portfolio is highly concentrated in a few assets, representing elevated volatility risk.';
    } else if (hhi >= 1500) {
      concentrationStatus = 'Moderate';
      concentrationDesc = 'Portfolio shows moderate concentration. Balanced, but contains moderate single-name exposure.';
    } else {
      concentrationStatus = 'Low';
      concentrationDesc = 'Portfolio is well-diversified. Exposure is distributed safely across assets.';
    }

    const concentrationRisk: ConcentrationRisk = {
      hhi,
      status: concentrationStatus,
      topAssetWeight,
      top3Weight,
      description: concentrationDesc
    };

    // 8. Diversification score calculations (0-100 pts scale)
    const uniqueAssetClasses = new Set(holdings.map(h => h.assetClass));
    
    // Category A: Asset Breadth (40 pts)
    const assetCountScore = Math.min(10, holdings.length) * 4;
    const breadthExplanation = `Holdings: ${holdings.length} asset(s). Target: 10+ assets for optimal risk distribution. (${assetCountScore}/40 pts)`;

    // Category B: Asset Class Diversity (30 pts)
    const assetClassScore = Math.min(3, uniqueAssetClasses.size) * 10;
    const classExplanation = `Asset Classes: ${uniqueAssetClasses.size} class(es). Target: 3+ distinct asset classes (e.g. Cash, Fixed Income, Equities). (${assetClassScore}/30 pts)`;

    // Category C: Weight Distribution (30 pts)
    let concentrationScore = 0;
    if (hhi < 1000) concentrationScore = 30;
    else if (hhi < 1800) concentrationScore = 25;
    else if (hhi < 3000) concentrationScore = 15;
    else if (hhi < 6000) concentrationScore = 5;
    const concentrationScoreExplanation = `Concentration index (HHI) of ${hhi.toFixed(0)}. Lower index indicates more balanced weights. (${concentrationScore}/30 pts)`;

    const divScore = assetCountScore + assetClassScore + concentrationScore;
    let divStatus: 'Poor' | 'Average' | 'Good' | 'Excellent' = 'Average';
    let divDesc = '';
    if (divScore >= 80) {
      divStatus = 'Excellent';
      divDesc = 'Strong asset count, class mixture, and balanced weighting provide robust diversification.';
    } else if (divScore >= 60) {
      divStatus = 'Good';
      divDesc = 'Good diversification. Safe distribution across multiple assets and classes.';
    } else if (divScore >= 40) {
      divStatus = 'Average';
      divDesc = 'Moderate diversification. Higher volatility risk due to asset concentration.';
    } else {
      divStatus = 'Poor';
      divDesc = 'Highly vulnerable portfolio. Concentrated in too few assets or asset classes.';
    }

    const diversificationBreakdown: ScoreCategory[] = [
      { name: 'Asset Breadth', score: assetCountScore, maxScore: 40, explanation: breadthExplanation },
      { name: 'Asset Class Diversity', score: assetClassScore, maxScore: 30, explanation: classExplanation },
      { name: 'Weight Distribution', score: concentrationScore, maxScore: 30, explanation: concentrationScoreExplanation }
    ];

    const diversification: DiversificationMetrics = {
      score: divScore,
      status: divStatus,
      description: divDesc,
      breakdown: diversificationBreakdown
    };

    // 9. Risk Flags & Warnings + Health Score calculations (0-100 pts scale)
    const flags: RiskFlag[] = [];
    
    // Category A: Single Asset Weight (25 pts)
    let singleAssetScore = 25;
    let singleAssetExplanation = '';
    if (topAssetWeight <= 15) {
      singleAssetScore = 25;
      singleAssetExplanation = `Top asset weight is safe at ${topAssetWeight.toFixed(1)}% of total value (Target: <= 15%). (25/25 pts)`;
    } else {
      singleAssetScore = Math.max(0, Math.round(25 - (topAssetWeight - 15) * (25 / 35)));
      singleAssetExplanation = `Top asset ${topHoldings[0]?.ticker || 'N/A'} is over-allocated at ${topAssetWeight.toFixed(1)}% of total value. Trimming recommended. (${singleAssetScore}/25 pts)`;
      if (topAssetWeight > 30) {
        flags.push({
          type: 'danger',
          message: `High Asset Concentration (${topAssetWeight.toFixed(1)}% in ${topHoldings[0]?.ticker || 'N/A'})`,
          suggestion: 'Trim position in largest asset to rebalance risk exposure.'
        });
      }
    }

    // Category B: Sector Balance (25 pts)
    let sectorScore = 25;
    let sectorExplanation = '';
    const topSectorWeight = sectorAllocation.length > 0 ? sectorAllocation[0].percentage : 0;
    const topSectorName = sectorAllocation.length > 0 ? sectorAllocation[0].name : 'N/A';
    if (topSectorWeight <= 25) {
      sectorScore = 25;
      sectorExplanation = `Largest sector (${topSectorName}) accounts for ${topSectorWeight.toFixed(1)}% (Target: <= 25%). (25/25 pts)`;
    } else {
      sectorScore = Math.max(0, Math.round(25 - (topSectorWeight - 25) * (25 / 40)));
      sectorExplanation = `Largest sector (${topSectorName}) accounts for ${topSectorWeight.toFixed(1)}%, creating industry concentration. (${sectorScore}/25 pts)`;
      if (topSectorWeight > 50) {
        flags.push({
          type: 'danger',
          message: `Sector Over-exposure (${topSectorWeight.toFixed(1)}% in ${topSectorName})`,
          suggestion: 'Reallocate capital into other industries to hedge against sector-specific recessions.'
        });
      }
    }

    // Category C: Risk Profile Alignment (25 pts)
    let riskAlignmentScore = 25;
    let riskExplanation = '';
    
    const cryptoExposure = holdings
      .filter(h => h.assetClass.toLowerCase() === 'crypto')
      .reduce((acc, h) => {
        const livePrice = marketPrices[h.id] !== undefined ? marketPrices[h.id] : (h.currentPrice || h.purchasePrice);
        let val = h.quantity * livePrice;
        if (h.currency !== reportingCurrency) {
          if (h.currency === 'INR' && reportingCurrency === 'USD') val /= usdToInrRate;
          else if (h.currency === 'USD' && reportingCurrency === 'INR') val *= usdToInrRate;
        }
        return acc + val;
      }, 0);
    const cryptoPercent = totalValue > 0 ? (cryptoExposure / totalValue) * 100 : 0;

    if (riskProfile === 'conservative') {
      if (cryptoPercent <= 5) {
        riskAlignmentScore = 25;
        riskExplanation = `Volatile asset weight is low at ${cryptoPercent.toFixed(1)}%, matching your conservative profile. (25/25 pts)`;
      } else {
        riskAlignmentScore = Math.max(0, Math.round(25 - (cryptoPercent - 5) * (25 / 25)));
        riskExplanation = `High exposure to volatile assets (${cryptoPercent.toFixed(1)}% Crypto) violates conservative boundaries (Target: <= 5%). (${riskAlignmentScore}/25 pts)`;
        if (cryptoPercent > 10) {
          flags.push({
            type: 'danger',
            message: `Conservative Profile Violations (Crypto: ${cryptoPercent.toFixed(1)}%)`,
            suggestion: 'Reduce cryptocurrency weight to under 5% to preserve capital.'
          });
        }
      }
    } else if (riskProfile === 'moderate') {
      if (cryptoPercent <= 15) {
        riskAlignmentScore = 25;
        riskExplanation = `Crypto exposure of ${cryptoPercent.toFixed(1)}% aligns well with your moderate profile. (25/25 pts)`;
      } else {
        riskAlignmentScore = Math.max(0, Math.round(25 - (cryptoPercent - 15) * (25 / 25)));
        riskExplanation = `Crypto exposure of ${cryptoPercent.toFixed(1)}% exceeds moderate parameters (Target: <= 15%). (${riskAlignmentScore}/25 pts)`;
        if (cryptoPercent > 20) {
          flags.push({
            type: 'warning',
            message: `Elevated Crypto Volatility Risk (${cryptoPercent.toFixed(1)}%)`,
            suggestion: 'Consider rebalancing to traditional equities or fixed income to mitigate drawdowns.'
          });
        }
      }
    } else { // aggressive
      if (cryptoPercent <= 30) {
        riskAlignmentScore = 25;
        riskExplanation = `Crypto exposure of ${cryptoPercent.toFixed(1)}% is acceptable under your aggressive profile (Target: <= 30%). (25/25 pts)`;
      } else {
        riskAlignmentScore = Math.max(0, Math.round(25 - (cryptoPercent - 30) * (25 / 30)));
        riskExplanation = `Crypto exposure of ${cryptoPercent.toFixed(1)}% is high even for an aggressive profile. (${riskAlignmentScore}/25 pts)`;
        if (cryptoPercent > 40) {
          flags.push({
            type: 'warning',
            message: `Extreme Volatility Exposure (Crypto: ${cryptoPercent.toFixed(1)}%)`,
            suggestion: 'Ensure trailing stops are set to protect capital from flash crashes.'
          });
        }
      }
    }

    // Category D: Cash Buffer & Currency Hedging (25 pts)
    let liquidityScore = 25;
    let liquidityExplanation = '';
    const cashHolding = holdings.filter(h => h.assetClass.toLowerCase() === 'cash');
    const cashValue = cashHolding.reduce((acc, h) => {
      const livePrice = marketPrices[h.id] !== undefined ? marketPrices[h.id] : (h.currentPrice || h.purchasePrice);
      let val = h.quantity * livePrice;
      if (h.currency !== reportingCurrency) {
        if (h.currency === 'INR' && reportingCurrency === 'USD') val /= usdToInrRate;
        else if (h.currency === 'USD' && reportingCurrency === 'INR') val *= usdToInrRate;
      }
      return acc + val;
    }, 0);
    const cashPercent = totalValue > 0 ? (cashValue / totalValue) * 100 : 0;
    const dominantCurrencyWeight = currencyExposure.length > 0 ? currencyExposure[0].percentage : 100;

    let points = 25;
    const liquidityComments = [];
    if (cashPercent < 5) {
      points -= 10;
      liquidityComments.push('No Cash Buffer: cash is under 5% (allocating 5-15% preserves tactical buying power)');
      if (cashPercent === 0) {
        flags.push({
          type: 'info',
          message: 'No Dedicated Cash Cushion',
          suggestion: 'Allocate 5-10% of portfolio to cash equivalents to capture opportunities during market dips.'
        });
      }
    } else if (cashPercent > 30) {
      points -= 5;
      liquidityComments.push('Over-liquid: cash exceeds 30%, which may drag inflation-adjusted returns');
    }
    
    if (dominantCurrencyWeight > 85) {
      points -= 5;
      liquidityComments.push(`Unhedged Currency: ${dominantCurrencyWeight.toFixed(1)}% in home currency`);
      flags.push({
        type: 'warning',
        message: `Unhedged Currency Exposure (${dominantCurrencyWeight.toFixed(1)}% in ${currencyExposure[0]?.name || 'USD'})`,
        suggestion: 'Diversify into foreign equities or international funds to hedge home currency volatility.'
      });
    }

    liquidityScore = Math.max(0, points);
    liquidityExplanation = liquidityComments.length > 0 
      ? `Concerns: ${liquidityComments.join('; ')}. (${liquidityScore}/25 pts)`
      : `Liquidity cash buffer of ${cashPercent.toFixed(1)}% and currency spreads are optimized. (25/25 pts)`;

    const healthScore = singleAssetScore + sectorScore + riskAlignmentScore + liquidityScore;
    
    // Warning: small asset pool (applies overall health check penalty)
    if (holdings.length < 3) {
      flags.push({
        type: 'warning',
        message: 'Under-diversified Asset Pool',
        suggestion: 'Add at least 3-5 uncorrelated assets to shield capital from single-company shocks.'
      });
    }

    const healthBreakdown: ScoreCategory[] = [
      { name: 'Asset Allocation', score: singleAssetScore, maxScore: 25, explanation: singleAssetExplanation },
      { name: 'Sector Balance', score: sectorScore, maxScore: 25, explanation: sectorExplanation },
      { name: 'Risk Alignment', score: riskAlignmentScore, maxScore: 25, explanation: riskExplanation },
      { name: 'Liquidity & FX Hedging', score: liquidityScore, maxScore: 25, explanation: liquidityExplanation }
    ];

    let healthStatus: 'Healthy' | 'Warning' | 'Critical' = 'Healthy';
    let healthSummary = '';
    if (healthScore >= 75) {
      healthStatus = 'Healthy';
      healthSummary = 'Portfolio metrics align well with security recommendations and risk tolerances.';
    } else if (healthScore >= 45) {
      healthStatus = 'Warning';
      healthSummary = 'Portfolio has moderate risk exposure. Rebalancing recommended to mitigate downside.';
    } else {
      healthStatus = 'Critical';
      healthSummary = 'Severe concentration or classification mismatch detected. Immediate rebalancing advised.';
    }

    const health: PortfolioHealthSummary = {
      status: healthStatus,
      score: healthScore,
      summary: healthSummary,
      flags,
      breakdown: healthBreakdown
    };

    return {
      totalValue,
      totalCost,
      totalGainLoss,
      totalGainLossPercent,
      sectorAllocation,
      geographicAllocation,
      currencyExposure,
      concentrationRisk,
      topHoldings,
      bestPerformers,
      worstPerformers,
      diversification,
      health
    };
  }

  private static emptyAnalytics(): PortfolioAnalytics {
    return {
      totalValue: 0,
      totalCost: 0,
      totalGainLoss: 0,
      totalGainLossPercent: 0,
      sectorAllocation: [],
      geographicAllocation: [],
      currencyExposure: [],
      concentrationRisk: {
        hhi: 0,
        status: 'Low',
        topAssetWeight: 0,
        top3Weight: 0,
        description: 'No holdings in portfolio.'
      },
      topHoldings: [],
      bestPerformers: [],
      worstPerformers: [],
      diversification: {
        score: 0,
        status: 'Poor',
        description: 'Portfolio holds no assets.',
        breakdown: []
      },
      health: {
        status: 'Healthy',
        score: 100,
        summary: 'No active holdings. Ready for initial asset ledger allocation.',
        flags: [],
        breakdown: []
      }
    };
  }
}

export default PortfolioAnalyticsService;
