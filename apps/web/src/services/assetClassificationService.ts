import type { Holding } from './firebase';
import type { AssetMetadata } from './marketDataService';

export interface NormalizedAsset {
  ticker: string;
  exchange: string;
  currency: string;
  sector: string;
  country: string;
  region: string;
}

export class AssetClassificationService {
  /**
   * Normalizes country code or name to standard names and regions
   */
  private static mapCountryAndRegion(
    countryInput?: string, 
    exchange?: string, 
    currency?: string
  ): { country: string; region: string } {
    const cleanCountry = (countryInput || '').trim().toUpperCase();
    const cleanExchange = (exchange || '').trim().toUpperCase();
    const cleanCurrency = (currency || '').trim().toUpperCase();

    // Map by country code or name
    if (cleanCountry === 'US' || cleanCountry === 'USA' || cleanCountry === 'UNITED STATES') {
      return { country: 'United States', region: 'North America' };
    }
    if (cleanCountry === 'IN' || cleanCountry === 'IND' || cleanCountry === 'INDIA') {
      return { country: 'India', region: 'Asia-Pacific' };
    }
    if (cleanCountry === 'GLOBAL') {
      return { country: 'Global', region: 'Global' };
    }

    // Exchange-based fallbacks
    if (cleanExchange === 'NSE' || cleanExchange === 'BSE') {
      return { country: 'India', region: 'Asia-Pacific' };
    }
    if (cleanExchange === 'NASDAQ' || cleanExchange === 'NYSE') {
      return { country: 'United States', region: 'North America' };
    }

    // Asset/Currency fallbacks
    if (cleanExchange === 'CRYPTO') {
      return { country: 'Global', region: 'Global' };
    }
    if (cleanExchange === 'CASH') {
      if (cleanCurrency === 'INR') {
        return { country: 'India', region: 'Asia-Pacific' };
      }
      if (cleanCurrency === 'USD') {
        return { country: 'United States', region: 'North America' };
      }
    }

    return { country: 'Other', region: 'Other' };
  }

  /**
   * Maps sector based on ticker, asset class, metadata industry, or fallbacks
   */
  private static mapSector(
    ticker: string, 
    assetClass?: string, 
    industry?: string
  ): string {
    const cleanTicker = ticker.toUpperCase().trim();
    const cleanClass = (assetClass || '').toLowerCase().trim();

    // Manual mappings for major Indian equities when metadata is missing
    const manualIndianMappings: Record<string, string> = {
      'ICICIBANK': 'Financial Services',
      'HDFCBANK': 'Financial Services',
      'TCS': 'Technology',
      'INFY': 'Technology',
      'RELIANCE': 'Energy / Conglomerate'
    };

    if (cleanTicker in manualIndianMappings) {
      return manualIndianMappings[cleanTicker];
    }

    // Class specific fallbacks
    if (cleanClass === 'crypto') {
      return 'Cryptocurrency';
    }
    if (cleanClass === 'cash') {
      return 'Cash & Cash Equivalents';
    }
    if (cleanClass === 'fixed income') {
      return 'Fixed Income';
    }
    if (cleanClass === 'real estate') {
      return 'Real Estate';
    }

    // Finnhub Industry Metadata
    if (industry && industry.trim().length > 0) {
      return industry.trim();
    }

    return 'Other';
  }

  /**
   * Core entry point to classify an asset or holding.
   */
  public static normalize(
    ticker: string,
    exchange: string,
    currency: string,
    assetClass?: string,
    metadata?: AssetMetadata | null
  ): NormalizedAsset {
    const sector = this.mapSector(ticker, assetClass, metadata?.industry);
    const countryInfo = this.mapCountryAndRegion(metadata?.country, exchange, currency);

    return {
      ticker: ticker.toUpperCase().trim(),
      exchange: exchange.toUpperCase().trim(),
      currency: currency.toUpperCase().trim(),
      sector,
      country: countryInfo.country,
      region: countryInfo.region
    };
  }

  /**
   * Helper to normalize a Holding asset record
   */
  public static normalizeHolding(holding: Holding, metadata?: AssetMetadata | null): NormalizedAsset {
    return this.normalize(
      holding.ticker || holding.symbol,
      holding.exchange,
      holding.currency,
      holding.assetClass,
      metadata
    );
  }
}

export default AssetClassificationService;
