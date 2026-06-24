export interface CompanyRegistryEntry {
  ticker: string;
  exchange: string;
  country: string;
  sector: string;
  industry: string;
  ISIN?: string;
  CIK?: string;
  hasSecCoverage: boolean;
  hasIrCoverage: boolean;
}

export class CompanyRegistry {
  private static registry: Record<string, CompanyRegistryEntry> = {
    'AAPL': {
      ticker: 'AAPL', exchange: 'NASDAQ', country: 'US', sector: 'Technology', industry: 'Consumer Electronics',
      CIK: '0000320193', hasSecCoverage: true, hasIrCoverage: true
    },
    'MSFT': {
      ticker: 'MSFT', exchange: 'NASDAQ', country: 'US', sector: 'Technology', industry: 'Software - Infrastructure',
      CIK: '0000789019', hasSecCoverage: true, hasIrCoverage: true
    },
    'GOOG': {
      ticker: 'GOOG', exchange: 'NASDAQ', country: 'US', sector: 'Technology', industry: 'Internet Content & Information',
      CIK: '0001652044', hasSecCoverage: true, hasIrCoverage: true
    },
    'NVDA': {
      ticker: 'NVDA', exchange: 'NASDAQ', country: 'US', sector: 'Technology', industry: 'Semiconductors',
      CIK: '0001045810', hasSecCoverage: true, hasIrCoverage: true
    },
    'TSLA': {
      ticker: 'TSLA', exchange: 'NASDAQ', country: 'US', sector: 'Consumer Cyclical', industry: 'Auto Manufacturers',
      CIK: '0001318605', hasSecCoverage: true, hasIrCoverage: true
    },
    'RELIANCE': {
      ticker: 'RELIANCE', exchange: 'NSE', country: 'IN', sector: 'Energy', industry: 'Oil & Gas Refining & Marketing',
      ISIN: 'INE002A01018', hasSecCoverage: false, hasIrCoverage: true
    },
    'TCS': {
      ticker: 'TCS', exchange: 'NSE', country: 'IN', sector: 'Technology', industry: 'Information Technology Services',
      ISIN: 'INE467B01029', hasSecCoverage: false, hasIrCoverage: true
    },
    'ICICIBANK': {
      ticker: 'ICICIBANK', exchange: 'NSE', country: 'IN', sector: 'Financial Services', industry: 'Banks - Regional',
      ISIN: 'INE090A01021', hasSecCoverage: false, hasIrCoverage: true
    },
    'HDFCBANK': {
      ticker: 'HDFCBANK', exchange: 'NSE', country: 'IN', sector: 'Financial Services', industry: 'Banks - Regional',
      ISIN: 'INE040A01034', hasSecCoverage: false, hasIrCoverage: true
    },
    'INFY': {
      ticker: 'INFY', exchange: 'NSE', country: 'IN', sector: 'Technology', industry: 'Information Technology Services',
      ISIN: 'INE009A01021', hasSecCoverage: false, hasIrCoverage: true
    }
  };

  /**
   * Resolve registry entry for a ticker.
   */
  public static getEntry(ticker: string): CompanyRegistryEntry | null {
    const cleanTicker = ticker.toUpperCase().trim();
    if (cleanTicker in this.registry) {
      return this.registry[cleanTicker];
    }
    return null;
  }

  /**
   * Determines if a company is US-listed and contains SEC coverage.
   */
  public static useSecCoverage(ticker: string): boolean {
    const entry = this.getEntry(ticker);
    return entry ? entry.hasSecCoverage : false;
  }

  /**
   * Determines if a company has Investor Relations filings (Indian parity source).
   */
  public static useIrCoverage(ticker: string): boolean {
    const entry = this.getEntry(ticker);
    return entry ? entry.hasIrCoverage : false;
  }

  /**
   * Lists all companies in the registry.
   */
  public static listAll(): CompanyRegistryEntry[] {
    return Object.values(this.registry);
  }
}
export default CompanyRegistry;
